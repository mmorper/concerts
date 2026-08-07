/**
 * Enrich artists with top 5 tracks from iTunes
 *
 * Quality bar: At least 40% of tracks must have VALIDATED preview URLs (2 of 5 tracks)
 * Preview URLs are tested with HEAD requests to ensure they're actually accessible
 * Only artists meeting this threshold are included in output
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { iTunesClient, type NormalizedTrack } from './utils/itunes-client.js'
import { normalizeArtistName } from '../src/utils/normalize.js'
import { foldArtistName } from './utils/artist-key.js'

// Configuration
const AUDIO_PREVIEW_CONFIG = {
  trackLimit: 5,               // Always fetch exactly 5 tracks
  minPreviewCoverage: 0.4,     // At least 2/5 must have VALIDATED preview URLs
  rateLimitMs: 600,            // 600ms between API requests (~1.6 req/sec)
  validationDelayMs: 100,      // 100ms between validation requests
  timeout: 5000,               // 5-second timeout per request
}

interface Concert {
  headliner: string
  headlinerNormalized: string
  openers?: string[]
}

interface ArtistTopTracksData {
  [artistNormalized: string]: {
    name: string
    source: 'itunes'
    fetchedAt: string
    /** How this artist was resolved, and to whom. One record, not one per track (#275). */
    resolvedVia?: ResolvedVia
    itunesArtistId?: number
    itunesArtistName?: string
    tracks: Omit<NormalizedTrack, 'artistName' | 'artistId'>[]
  }
}

/**
 * Simple rate limiter
 */
class RateLimiter {
  private lastCallTime = 0

  constructor(private delayMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now()
    const timeSinceLastCall = now - this.lastCallTime
    const waitTime = Math.max(0, this.delayMs - timeSinceLastCall)

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastCallTime = Date.now()
  }
}

// normalizeArtistName is imported from src/utils/normalize.ts.
//
// This file used to carry its own copy that *deleted* special characters
// (`[^a-z0-9\s-]` → '') where the canonical one *hyphenates* them. The two agree
// whenever punctuation sits next to a space — which is most names — so the
// divergence hid for a long time. It only shows up on internal punctuation:
// "The Go-Go's" keyed as `the-go-gos` here but `the-go-go-s` everywhere else.
//
// The SPA hook matched this file's spelling, so audio previews worked there. The
// liner-notes pipeline uses the canonical form, so `curate.ts` (album art,
// audio) and `score.ts` (the 3-point audio-preview bonus) silently missed for
// eight artists (#259).

/**
 * Validate that a preview URL is actually accessible
 */
async function validatePreviewUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AUDIO_PREVIEW_CONFIG.timeout)

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Check for successful response and audio content type
    if (!response.ok) return false

    const contentType = response.headers.get('content-type')
    return contentType ? contentType.includes('audio') : true // Allow if no content-type header
  } catch (error) {
    // URL is not accessible (timeout, network error, CORS, etc.)
    return false
  }
}

/**
 * Validate and filter tracks to only include those with working preview URLs
 */
async function validateTracks(tracks: NormalizedTrack[]): Promise<NormalizedTrack[]> {
  const validatedTracks: NormalizedTrack[] = []
  const rateLimiter = new RateLimiter(AUDIO_PREVIEW_CONFIG.validationDelayMs)

  for (const track of tracks) {
    if (!track.previewUrl) {
      // Keep tracks without preview URLs (they'll be shown as disabled in UI)
      validatedTracks.push(track)
      continue
    }

    await rateLimiter.wait()
    const isValid = await validatePreviewUrl(track.previewUrl)

    if (isValid) {
      validatedTracks.push(track)
    } else {
      // Invalid URL: convert to null preview
      console.log(`    ⚠️  Invalid preview URL: ${track.name}`)
      validatedTracks.push({
        ...track,
        previewUrl: null
      })
    }
  }

  return validatedTracks
}

/**
 * Check if tracks meet quality bar (40% preview coverage)
 */
function meetsQualityBar(tracks: NormalizedTrack[]): boolean {
  if (tracks.length === 0) return false

  const previewCount = tracks.filter(t => t.previewUrl !== null).length
  const coverage = previewCount / tracks.length

  return coverage >= AUDIO_PREVIEW_CONFIG.minPreviewCoverage
}

/**
 * Count tracks with preview URLs
 */
function countPreviews(tracks: NormalizedTrack[]): number {
  return tracks.filter(t => t.previewUrl !== null).length
}

/**
 * Load existing cache if it exists
 */
function loadExistingCache(): ArtistTopTracksData {
  const cachePath = resolve('public/data/artists-top-tracks.json')

  try {
    const cacheData = readFileSync(cachePath, 'utf-8')
    return JSON.parse(cacheData)
  } catch (error) {
    // Cache doesn't exist yet, return empty object
    return {}
  }
}

/**
 * Check if artist should be skipped (already enriched recently).
 * iTunes URLs are stable indefinitely, so a 30-day TTL is sufficient.
 */
function shouldSkip(
  normalized: string,
  existingCache: ArtistTopTracksData
): boolean {
  const cached = existingCache[normalized]
  if (!cached) return false

  const fetchedAt = new Date(cached.fetchedAt).getTime()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return Date.now() - fetchedAt < thirtyDays
}

/**
 * iTunes search aliases for artists whose names don't match Apple Music's catalog.
 * Maps the concert data name → search term to use with the iTunes Search API.
 */
const SEARCH_ALIASES: Record<string, string> = {
  "Brian Setzer \u201968 Comeback Special": "Brian Setzer",
  "Brian Setzer and the Nashvillians": "Brian Setzer",
}

/**
 * iTunes artist ID overrides for artists where name-based search is unreliable.
 * Maps the concert data name → iTunes artist ID (from music.apple.com/us/artist/.../ID).
 * Uses the iTunes Lookup API which is exact and unambiguous.
 *
 * Add an entry only with a stated reason — same discipline as MBID_CORRECTIONS
 * in enrich-discography.ts and RELEASE_EXCLUSIONS in derive-album-eras.ts. A
 * short common word is the tell: the shorter and more generic the name, the
 * more of the catalogue competes for it.
 */
const ARTIST_ID_OVERRIDES: Record<string, number> = {
  "The Roots": 43680,

  // #275 — all four resolved to a different act entirely under name search.
  // IDs verified against the Lookup API's top tracks before pinning.
  "ABC": 391195,              // was matching children's alphabet songs; this is Martin Fry's ABC (The Lexicon of Love)
  "Bad Religion": 150160,     // was returning Frank Ocean's channel ORANGE
  "Common Sense": 15898676,   // the SoCal reggae band that opened for The English Beat — not Common, not the dance act
  "Chris Shiflett": 214324366, // his solo work (Hard Lessons, Lost at Sea) — was returning Foo Fighters
}

/**
 * How an artist's tracks were resolved. Stored once per artist, never per track.
 */
type ResolvedVia = 'artist-id' | 'alias' | 'search'

/**
 * Over-fetch, then discard impostors. Filtering a 5-track response leaves fewer
 * than 5; asking for 10 means five genuine tracks usually survive.
 */
const CANDIDATE_MULTIPLIER = 2

/**
 * Keep only the tracks actually billed to the artist we asked for.
 *
 * The failure this catches is silent by construction (#275): a wrong-artist
 * track is well-formed, has a working preview, and clears the quality bar. Its
 * only symptom is an album title that will not match the artist's discography,
 * surfacing two layers downstream as unexplained recall loss.
 *
 * **Per track, not per artist.** An artist-level verdict is not enough, because
 * contamination is not all-or-nothing:
 *
 *   Bad Religion   4 of 5 genuine, 1 Frank Ocean (channel ORANGE)
 *   Chris Shiflett 2 of 5 genuine, 2 Foo Fighters, 1 guest credit on a comp
 *   ABC            1 of 5 genuine, 4 children's alphabet songs
 *
 * A majority rule keeps Bad Religion's Frank Ocean track. A unanimity rule
 * throws away four good Bad Religion tracks to remove one bad one. Filtering
 * per track does neither.
 *
 * **Pinning an artist ID does not remove the need for this.** The Lookup API is
 * exact about the artist but still returns guest credits — Chris Shiflett's
 * top five includes "Goin' Nowhere (feat. Chris Shiflett)", billed to another
 * act on a compilation. A record he appears on is not a record he made, and
 * that distinction is the whole point of the album signal downstream.
 */
export function keepTracksBilledTo(
  expected: string,
  candidates: NormalizedTrack[]
): { kept: NormalizedTrack[]; dropped: NormalizedTrack[]; sawInstead: string | null } {
  const want = foldArtistName(expected)
  const kept: NormalizedTrack[] = []
  const dropped: NormalizedTrack[] = []

  for (const track of candidates) {
    ;(foldArtistName(track.artistName) === want ? kept : dropped).push(track)
  }

  // The most common impostor — what iTunes actually thought we meant, which is
  // the useful thing to print when a whole artist fails.
  const tally = new Map<string, number>()
  for (const t of dropped) tally.set(t.artistName, (tally.get(t.artistName) ?? 0) + 1)
  const sawInstead = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return { kept, dropped, sawInstead }
}

/**
 * Strip transient provenance before persisting. See NormalizedTrack.
 */
function forStorage(tracks: NormalizedTrack[]): Omit<NormalizedTrack, 'artistName' | 'artistId'>[] {
  return tracks.map(({ artistName: _a, artistId: _i, ...track }) => track)
}

/**
 * Main enrichment function
 */
export async function enrichTopTracks() {
  console.log('🎵 Enriching artist top tracks...\n')

  // Load concerts data
  const concertsPath = resolve('public/data/concerts.json')
  const concertsData = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts: Concert[] = concertsData.concerts || concertsData

  // Get unique artists (headliners + openers)
  const uniqueArtists = new Set<string>()
  concerts.forEach((concert: Concert) => {
    uniqueArtists.add(concert.headliner)
    if (concert.openers) {
      concert.openers.forEach(opener => uniqueArtists.add(opener))
    }
  })

  const artists = Array.from(uniqueArtists).sort()

  console.log(`Found ${artists.length} unique artists\n`)

  // Initialize clients
  const itunes = new iTunesClient()
  const rateLimiter = new RateLimiter(AUDIO_PREVIEW_CONFIG.rateLimitMs)

  // Load existing cache
  const existingCache = loadExistingCache()
  const results: ArtistTopTracksData = { ...existingCache }

  let enriched = 0
  let skipped = 0
  let failed = 0
  const misresolved: Array<{ artist: string; got: string }> = []

  for (const artistName of artists) {
    const normalized = normalizeArtistName(artistName)

    // Skip if already enriched recently (within 30 days)
    if (shouldSkip(normalized, existingCache)) {
      console.log(`⏭️  Skipping ${artistName} (cached)`)
      skipped++
      continue
    }

    console.log(`\nFetching tracks for: ${artistName}`)

    try {
      await rateLimiter.wait()

      // Use artist ID lookup if available (exact, no ambiguity), otherwise name search with alias fallback
      const artistIdOverride = ARTIST_ID_OVERRIDES[artistName]
      const searchName = SEARCH_ALIASES[artistName] ?? artistName

      console.log(`  → Trying iTunes${artistIdOverride ? ` (by artist ID ${artistIdOverride})` : searchName !== artistName ? ` (alias: "${searchName}")` : ''}...`)
      const candidateLimit = AUDIO_PREVIEW_CONFIG.trackLimit * CANDIDATE_MULTIPLIER
      const candidates = artistIdOverride
        ? await itunes.getTopTracksByArtistId(artistIdOverride, candidateLimit)
        : await itunes.getTopTracks(searchName, candidateLimit)

      // Compare against the SEARCH name: aliases exist precisely to redirect, so
      // "Brian Setzer '68 Comeback Special" resolving to "Brian Setzer" is the
      // alias working, not drift.
      const { kept, dropped, sawInstead } = keepTracksBilledTo(searchName, candidates)
      if (dropped.length > 0) {
        console.log(`  🚫 Dropped ${dropped.length} track(s) billed to someone else (e.g. "${sawInstead}")`)
      }

      const iTunesTracks = kept.slice(0, AUDIO_PREVIEW_CONFIG.trackLimit)

      // Too few genuine tracks to work with. Fail closed and say why — storing
      // the impostors is what #275 did, and the wrong album names it left
      // behind are indistinguishable from missing data.
      if (candidates.length > 0 && iTunesTracks.length < AUDIO_PREVIEW_CONFIG.trackLimit) {
        console.log(
          `  ❌ Only ${iTunesTracks.length}/${AUDIO_PREVIEW_CONFIG.trackLimit} tracks billed to "${searchName}"` +
          (sawInstead ? ` — iTunes mostly returned "${sawInstead}".` : '.') +
          (artistIdOverride ? '' : ' Pin an ARTIST_ID_OVERRIDE to fix.')
        )
        misresolved.push({ artist: artistName, got: sawInstead ?? '(too few tracks)' })
        failed++
        continue
      }

      if (iTunesTracks.length === AUDIO_PREVIEW_CONFIG.trackLimit) {
        console.log(`  🔍 Validating ${iTunesTracks.length} iTunes previews...`)
        const validatedTracks = await validateTracks(iTunesTracks)

        if (meetsQualityBar(validatedTracks)) {
          const previewCount = countPreviews(validatedTracks)
          console.log(`  ✅ iTunes: ${previewCount}/${AUDIO_PREVIEW_CONFIG.trackLimit} validated tracks`)

          results[normalized] = {
            name: artistName,
            source: 'itunes',
            fetchedAt: new Date().toISOString(),
            resolvedVia: artistIdOverride ? 'artist-id' : searchName !== artistName ? 'alias' : 'search',
            itunesArtistId: validatedTracks[0]?.artistId,
            itunesArtistName: validatedTracks[0]?.artistName,
            tracks: forStorage(validatedTracks)
          }
          enriched++
          continue
        } else {
          const previewCount = countPreviews(validatedTracks)
          console.log(`  ⚠️  iTunes: only ${previewCount}/${AUDIO_PREVIEW_CONFIG.trackLimit} validated (below quality bar)`)
        }
      }

      // iTunes did not meet quality bar — no preview available for this artist
      const previewCount = iTunesTracks ? countPreviews(iTunesTracks) : 0
      console.log(
        `  ❌ Insufficient iTunes preview coverage (${previewCount}/${iTunesTracks?.length || 0} validated)`
      )
      failed++

    } catch (error) {
      console.error(`  ❌ Error fetching ${artistName}:`, error)
      failed++
    }
  }

  // Drop records for artists no longer in the archive. Same accumulation as
  // artists-metadata.json (#255): this writes the whole object back with no
  // delete path, so any key ever written survives forever.
  const liveKeys = new Set(artists.map(normalizeArtistName))
  const orphans = Object.keys(results).filter(key => !liveKeys.has(key))
  for (const key of orphans) {
    delete results[key]
  }
  if (orphans.length > 0) {
    console.log(`\n🧹 Pruned ${orphans.length} record(s) with no artist in concerts.json:`)
    for (const key of orphans) console.log(`   − ${key}`)
  }

  // Save results
  const outputPath = resolve('public/data/artists-top-tracks.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')

  if (misresolved.length > 0) {
    console.log(`\n⚠️  ${misresolved.length} artist(s) rejected — iTunes returned the wrong act:`)
    for (const m of misresolved) console.log(`   − ${m.artist} → got "${m.got}"`)
    console.log(`   Fix by pinning an ARTIST_ID_OVERRIDE. Rejected, not stored — see #275.`)
  }

  console.log(`\n📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched}`)
  console.log(`   🚫 Wrong artist (rejected): ${misresolved.length}`)
  console.log(`   🧹 Pruned (orphaned): ${orphans.length}`)
  console.log(`   ⏭️  Skipped (cached): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📁 Total in cache: ${Object.keys(results).length}`)

  const coveragePercent = ((Object.keys(results).length / artists.length) * 100).toFixed(1)
  console.log(`   📈 Coverage: ${coveragePercent}% (${Object.keys(results).length}/${artists.length} artists)`)

  console.log(`\n🎉 Done! Saved to ${outputPath}`)
}

// Run the enrichment (only when executed directly, not when imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichTopTracks().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
