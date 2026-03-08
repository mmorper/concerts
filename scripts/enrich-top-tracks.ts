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
    tracks: NormalizedTrack[]
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

/**
 * Normalize artist name to hyphenated lowercase
 */
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/-+/g, '-')           // Collapse hyphens
    .replace(/^-|-$/g, '')         // Trim hyphens
}

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

      // Try iTunes first (no auth tokens, more reliable)
      console.log(`  → Trying iTunes...`)
      const iTunesTracks = await itunes.getTopTracks(
        artistName,
        AUDIO_PREVIEW_CONFIG.trackLimit
      )

      if (iTunesTracks && iTunesTracks.length === AUDIO_PREVIEW_CONFIG.trackLimit) {
        console.log(`  🔍 Validating ${iTunesTracks.length} iTunes previews...`)
        const validatedTracks = await validateTracks(iTunesTracks)

        if (meetsQualityBar(validatedTracks)) {
          const previewCount = countPreviews(validatedTracks)
          console.log(`  ✅ iTunes: ${previewCount}/${AUDIO_PREVIEW_CONFIG.trackLimit} validated tracks`)

          results[normalized] = {
            name: artistName,
            source: 'itunes',
            fetchedAt: new Date().toISOString(),
            tracks: validatedTracks
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

  // Save results
  const outputPath = resolve('public/data/artists-top-tracks.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')

  console.log(`\n📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched}`)
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
