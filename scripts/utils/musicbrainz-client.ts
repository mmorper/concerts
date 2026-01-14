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

export class MusicBrainzClient {
  private baseUrl = 'https://musicbrainz.org/ws/2/'
  private coverArtUrl = 'https://coverartarchive.org/release-group/'
  private rateLimiter: RateLimiter

  constructor() {
    // MusicBrainz requires 1 request per second
    this.rateLimiter = new RateLimiter(1)
  }

  /**
   * Search for artist by name, return MBID
   * Uses fuzzy matching with Levenshtein distance
   */
  async searchArtist(artistName: string): Promise<string | null> {
    await this.rateLimiter.wait()

    try {
      const encodedName = encodeURIComponent(artistName)
      const url = `${this.baseUrl}artist?query=${encodedName}&fmt=json`

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
          return this.searchArtist(artistName) // Retry
        }
        throw new Error(`MusicBrainz API error: ${response.status}`)
      }

      const data: MusicBrainzArtistSearchResponse = await response.json()

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

      // Require at least 80% similarity
      if (bestSimilarity < 0.8) {
        console.warn(`  ⚠️  Low confidence match: "${artistName}" → "${bestMatch.name}" (${(bestSimilarity * 100).toFixed(0)}%)`)
        return null
      }

      return bestMatch.id
    } catch (error) {
      console.error(`  ❌ Failed to search artist: ${artistName}`, error)
      return null
    }
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
