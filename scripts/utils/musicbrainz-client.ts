/**
 * MusicBrainz API Client
 *
 * Rate limit: 1 request per second (strictly enforced)
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 *
 * Data License: CC0 (public domain)
 */

import { RateLimiter } from './rate-limiter'

// User-Agent required by MusicBrainz API
const USER_AGENT = 'Morperhaus-Concerts/3.5.0 (concerts@morperhaus.org)'

/**
 * 503 handling for the track-listing methods.
 *
 * The attempt count is threaded through the recursive call rather than held in
 * a helper — a helper that defaults its own depth parameter resets to zero on
 * every recursion, so the bound never fires and a sustained outage becomes a
 * silent infinite loop. The older methods in this file still recurse on 503
 * with no bound at all.
 */
const MAX_503_RETRIES = 2
const RETRY_DELAY_MS = 2000

interface MusicBrainzArtist {
  id: string
  name: string
  disambiguation?: string
  score?: number
  country?: string
}

interface MusicBrainzArtistSearchResponse {
  artists: MusicBrainzArtist[]
  count: number
}

interface MusicBrainzReleaseGroup {
  id: string
  title: string
  'first-release-date'?: string
  'primary-type'?: string
  'secondary-types'?: string[]
  disambiguation?: string
}

interface MusicBrainzReleaseGroupResponse {
  'release-groups': MusicBrainzReleaseGroup[]
  'release-group-count': number
}

export interface Album {
  id: string
  title: string
  releaseDate: string
  year: number
  primaryType: string
  secondaryTypes: string[]
  disambiguation: string
  coverUrl: string
  coverAvailable: boolean
}

/** One release inside a release-group, with its track listing. */
interface MusicBrainzRelease {
  id: string
  title: string
  date?: string
  status?: string
  media?: Array<{ tracks?: Array<{ title: string; position?: number }> }>
}

interface MusicBrainzReleaseBrowseResponse {
  releases: MusicBrainzRelease[]
  'release-count': number
}

export class MusicBrainzClient {
  private baseUrl = 'https://musicbrainz.org/ws/2/'
  private coverArtUrl = 'https://coverartarchive.org/release-group/'
  private rateLimiter: RateLimiter

  constructor() {
    // MusicBrainz requires 1 request per second
    this.rateLimiter = new RateLimiter(1)
  }

  /**
   * Search for artist by name, return MBID.
   *
   * 🔴 `null` means MusicBrainz ANSWERED AND HAD NOTHING. It never means "we
   * could not ask." That distinction is load-bearing, because the caller caches
   * a null for ninety days as "this artist is not in MusicBrainz" — so a
   * two-second outage used to become a three-month lie.
   *
   * It is not hypothetical. 25 of 257 artists carried `mbid: null`, including
   * The Beach Boys, The Bangles, Jane Wiedlin and Gene Loves Jezebel. Every one
   * of them resolves at **score 100** when the server actually replies; they
   * were cached during a batch run that tripped MusicBrainz's throttle. The old
   * code had two ways to reach that outcome and neither left a trace:
   *
   * 1. The 503 branch recursed with no bound — the same defect this file's
   *    header already records for the older methods.
   * 2. A blanket `catch { return null }` swallowed every network error, parse
   *    failure and non-503 status into the same "not found" the caller trusts.
   *
   * Anything that is not a real answer now THROWS. The caller already has a
   * try/catch that logs and skips without writing a cache entry, so a failure
   * costs one artist on one run and is retried on the next.
   */
  async searchArtist(artistName: string): Promise<string | null> {
    const data = await this.searchArtistRaw(artistName)

    if (!data.artists || data.artists.length === 0) {
      return null
    }

    // Find best match using fuzzy matching
    let bestMatch = data.artists[0]
    let bestSimilarity = this.stringSimilarity(artistName, bestMatch.name)

    // Check other results for better matches
    for (const artist of data.artists.slice(1)) {
      const similarity = this.stringSimilarity(artistName, artist.name)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = artist
      }
    }

    // Require at least 80% similarity. This one IS a real answer — MusicBrainz
    // replied and the best it had was not close enough — so it caches, and the
    // fix for a genuine mis-resolution is an MBID_CORRECTIONS entry.
    if (bestSimilarity < 0.8) {
      console.warn(`  ⚠️  Low confidence match: "${artistName}" → "${bestMatch.name}" (${(bestSimilarity * 100).toFixed(0)}%)`)
      return null
    }

    return bestMatch.id
  }

  /**
   * One search, retried on 503, throwing if it never gets an answer.
   *
   * The attempt count is a loop rather than a recursive default parameter, for
   * the reason this file's header gives: a helper that defaults its own depth
   * resets to zero on every recursion, so the bound never fires and a sustained
   * outage becomes a silent infinite loop.
   */
  private async searchArtistRaw(artistName: string): Promise<MusicBrainzArtistSearchResponse> {
    const url = `${this.baseUrl}artist?query=${encodeURIComponent(artistName)}&fmt=json`
    let lastError = ''

    for (let attempt = 0; attempt <= MAX_503_RETRIES; attempt++) {
      await this.rateLimiter.wait()

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
        })

        if (response.status === 503 || response.status === 429) {
          lastError = `HTTP ${response.status} — MusicBrainz busy`
          console.warn(`  ⚠️  ${lastError}, retrying (${attempt + 1}/${MAX_503_RETRIES + 1})`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }

        if (!response.ok) {
          throw new Error(`MusicBrainz API error: ${response.status}`)
        }

        return await response.json() as MusicBrainzArtistSearchResponse
      } catch (error) {
        // A thrown non-503 is not retried — it is not a busy server, and
        // hammering it would not help.
        if (lastError === '') throw error
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    throw new Error(
      `MusicBrainz never answered for "${artistName}" after ${MAX_503_RETRIES + 1} attempts (${lastError}). ` +
      `Not caching a null — see the note on searchArtist.`
    )
  }

  /**
   * Fetch discography for artist by MBID
   */
  async getDiscography(mbid: string, artistName: string): Promise<Album[]> {
    await this.rateLimiter.wait()

    try {
      // Fetch up to 100 release groups (handles most artists)
      const url = `${this.baseUrl}release-group?artist=${mbid}&limit=100&fmt=json`

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 503) {
          console.warn('  ⚠️  Rate limit hit, waiting 2 seconds...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          return this.getDiscography(mbid, artistName) // Retry
        }
        throw new Error(`MusicBrainz API error: ${response.status}`)
      }

      const data: MusicBrainzReleaseGroupResponse = await response.json()

      if (!data['release-groups'] || data['release-groups'].length === 0) {
        return []
      }

      // Warn if artist has more than 100 albums (pagination needed)
      if (data['release-group-count'] > 100) {
        console.warn(`  ⚠️  Artist "${artistName}" has ${data['release-group-count']} albums (showing first 100)`)
      }

      // Process albums
      const albums: Album[] = []

      for (const rg of data['release-groups']) {
        // Skip albums without release dates (drafts)
        if (!rg['first-release-date']) {
          continue
        }

        // Parse release date and year
        const releaseDate = rg['first-release-date']
        const year = parseInt(releaseDate.split('-')[0], 10)

        if (isNaN(year)) {
          continue
        }

        // Build album entry (skip cover art check for MVP)
        const album: Album = {
          id: rg.id,
          title: rg.title,
          releaseDate,
          year,
          primaryType: rg['primary-type'] || 'Album',
          secondaryTypes: rg['secondary-types'] || [],
          disambiguation: rg.disambiguation || '',
          coverUrl: `${this.coverArtUrl}${rg.id}/front-500.jpg`,
          coverAvailable: true // Assume available, handle 404s in UI
        }

        albums.push(album)
      }

      // Sort by release date (newest first for UI)
      albums.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))

      return albums
    } catch (error) {
      console.error(`  ❌ Failed to fetch discography for MBID: ${mbid}`, error)
      return []
    }
  }

  /**
   * Track titles for a release-group (v5.5 song → album attribution, #276).
   *
   * A release-GROUP is the abstract record ("Violator"); a RELEASE is a
   * specific pressing of it, and only releases carry track listings. So this
   * browses the group's releases, takes ONE, and reads its media.
   *
   * Which one matters. Preference order:
   *   1. Official status — avoids promos and bootleg pressings
   *   2. Earliest date   — the original tracklist, not a reissue's bonus discs
   *
   * Picking a deluxe reissue instead would attribute B-sides and demos to the
   * album as though they had always been on it, which is precisely the kind of
   * plausible-but-false claim this feature must not generate.
   *
   * Returns [] on any failure. A group with no usable release is a normal
   * outcome, not an error — the caller leaves those songs unattributed.
   */
  async getReleaseGroupTracks(releaseGroupMbid: string): Promise<string[]> {
    // TWO requests, deliberately — it is both faster and more accurate than
    // pulling every pressing's track listing at once. Measured on Violator:
    //
    //   browse + inc=recordings, limit=100   4.0s   183 KB
    //   browse alone, then one release       1.5s    34 KB
    //
    // A popular album has dozens of pressings and the combined query drags in
    // all of them. Worse, the one-shot version picked a pressing whose titles
    // merge hidden interludes — "Enjoy the Silence / Interlude #2: Crucified" —
    // where choosing deliberately returns the canonical nine-track listing.
    const chosen = await this.pickCanonicalRelease(releaseGroupMbid)
    if (!chosen) return []

    return this.getReleaseTracks(chosen)
  }

  /**
   * The release whose track listing best represents a release-group.
   *
   * Official first, then earliest. A promo or a deluxe reissue would attribute
   * B-sides and demos to the album as though they had always been on it —
   * exactly the plausible-but-false claim this feature must never generate.
   */
  private async pickCanonicalRelease(
    releaseGroupMbid: string,
    attempt = 0
  ): Promise<string | null> {
    await this.rateLimiter.wait()

    try {
      const url = `${this.baseUrl}release?release-group=${releaseGroupMbid}&limit=100&fmt=json`
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
      })

      if (!response.ok) {
        if (response.status === 503) {
          if (attempt >= MAX_503_RETRIES) {
            console.warn(`  ⚠️  MusicBrainz still 503 after ${MAX_503_RETRIES} retries — skipping ${releaseGroupMbid}`)
            return null
          }
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
          return this.pickCanonicalRelease(releaseGroupMbid, attempt + 1)
        }
        throw new Error(`MusicBrainz API error: ${response.status}`)
      }

      const data: MusicBrainzReleaseBrowseResponse = await response.json()
      const releases = data.releases ?? []
      if (releases.length === 0) return null

      const sorted = [...releases].sort((a, b) => {
        const officialA = a.status === 'Official' ? 0 : 1
        const officialB = b.status === 'Official' ? 0 : 1
        if (officialA !== officialB) return officialA - officialB
        return (a.date || '9999').localeCompare(b.date || '9999')
      })

      return sorted[0]?.id ?? null
    } catch (error) {
      console.error(`  ❌ Failed to browse releases for release-group: ${releaseGroupMbid}`, error)
      return null
    }
  }

  /** Track titles for one specific release. */
  private async getReleaseTracks(releaseMbid: string, attempt = 0): Promise<string[]> {
    await this.rateLimiter.wait()

    try {
      const url = `${this.baseUrl}release/${releaseMbid}?inc=recordings&fmt=json`
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
      })

      if (!response.ok) {
        if (response.status === 503) {
          if (attempt >= MAX_503_RETRIES) {
            console.warn(`  ⚠️  MusicBrainz still 503 after ${MAX_503_RETRIES} retries — skipping ${releaseMbid}`)
            return []
          }
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
          return this.getReleaseTracks(releaseMbid, attempt + 1)
        }
        throw new Error(`MusicBrainz API error: ${response.status}`)
      }

      const data: MusicBrainzRelease = await response.json()
      const titles = (data.media ?? [])
        .flatMap(m => m.tracks ?? [])
        .map(t => t.title)
        .filter(Boolean)

      // De-duplicate: a double album can repeat a title across discs, and a
      // reprise is not a second song for attribution purposes.
      return [...new Set(titles)]
    } catch (error) {
      console.error(`  ❌ Failed to fetch tracks for release: ${releaseMbid}`, error)
      return []
    }
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns value between 0 (no match) and 1 (perfect match)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()

    if (s1 === s2) return 1
    if (s1.length === 0 || s2.length === 0) return 0

    const len1 = s1.length
    const len2 = s2.length
    const matrix: number[][] = []

    // Initialize matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j
    }

    // Fill matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    const distance = matrix[len2][len1]
    const maxLen = Math.max(len1, len2)
    return 1 - (distance / maxLen)
  }
}
