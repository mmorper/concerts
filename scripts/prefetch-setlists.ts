#!/usr/bin/env tsx
/**
 * Pre-fetch setlists at build time
 *
 * This script fetches setlists for all concerts in concerts.json
 * and generates a static cache file at public/data/setlists-cache.json
 *
 * Historical concert setlists are immutable, so this approach:
 * - Eliminates runtime API calls for cached data
 * - Reduces API quota usage
 * - Improves performance (instant load from static JSON)
 * - Works reliably in production (no CORS or proxy needed)
 *
 * Usage:
 *   npm run prefetch:setlists
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'
import { createBackup } from './utils/backup.js'
import { normalizeVenueName } from '../src/utils/normalize.js'

// Load environment variables from .env file
dotenvConfig()

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Concert {
  id: string
  date: string
  headliner: string
  openers?: string[]
  venue: string
  city: string
  state: string
}

export interface Setlist {
  id: string
  eventDate: string
  artist: {
    mbid: string
    name: string
    sortName: string
    disambiguation: string
    url: string
  }
  venue: {
    id: string
    name: string
    city: {
      id: string
      name: string
      state: string
      stateCode: string
      coords: {
        lat: number
        long: number
      }
      country: {
        code: string
        name: string
      }
    }
  }
  sets: {
    set: Array<{
      name?: string
      encore?: number
      song: Array<{
        name: string
        cover?: {
          mbid: string
          name: string
          sortName: string
          disambiguation: string
          url: string
        }
        info?: string
        tape?: boolean
      }>
    }>
  }
  info?: string
  url: string
}

interface SetlistSearchResponse {
  type: string
  itemsPerPage: number
  page: number
  total: number
  setlist: Setlist[]
}

export interface SetlistCacheEntry {
  concertId: string
  artistName: string
  date: string
  venue: string
  city: string
  setlist: Setlist | null
  /**
   * Whole days between the setlist's own date and the concert's, when they disagree.
   *
   * Absent means they matched exactly, which is 82% of the corpus. Present means the gate
   * allowed a one-day gap — a show crossing midnight, a timezone, or our own date being
   * off by one. It is written down so the disagreement is visible rather than inferred by
   * whoever next compares the two files.
   */
  dateGap?: number
  fetchedAt: string
  error?: string
}

interface SetlistCache {
  version: string
  generatedAt: string
  entries: SetlistCacheEntry[]
}

// Map neighborhood names to official city names
function mapCityName(city: string): string {
  const cityLower = city.toLowerCase().trim()

  if (cityLower === 'hollywood') return 'Los Angeles'
  if (cityLower === 'west hollywood') return 'Los Angeles'

  return city
}

// Calculate string similarity using Levenshtein distance
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1.0

  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0 || len2 === 0) return 0

  const matrix: number[][] = []

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  const distance = matrix[len2][len1]
  const maxLen = Math.max(len1, len2)
  return 1 - (distance / maxLen)
}

// Calculate match score for a setlist result
function calculateMatchScore(
  result: Setlist,
  params: { artistName: string; venueName: string; city: string }
): number {
  let score = 0

  // Venue name matching
  const resultVenue = normalizeVenueName(result.venue.name)
  const paramsVenue = normalizeVenueName(params.venueName)

  if (resultVenue === paramsVenue) {
    score += 0.5
  } else {
    const venueSimilarity = stringSimilarity(resultVenue, paramsVenue)
    if (venueSimilarity > 0.7) {
      score += venueSimilarity * 0.5
    }
  }

  // City matching
  const resultCity = result.venue.city.name.toLowerCase().trim()
  const paramsCity = params.city.toLowerCase().trim()

  if (resultCity === paramsCity) {
    score += 0.3
  } else {
    const citySimilarity = stringSimilarity(resultCity, paramsCity)
    if (citySimilarity > 0.7) {
      score += citySimilarity * 0.3
    }
  }

  // Artist name similarity
  const artistSimilarity = stringSimilarity(result.artist.name, params.artistName)
  score += artistSimilarity * 0.2

  return score
}

/**
 * How far a setlist's own date may sit from the concert's before it is a different show.
 *
 * 🔴 THE DATE WAS NOT SCORED AT ALL, AND THAT IS THE WHOLE BUG. `calculateMatchScore`
 * weighs venue, city and artist. Three nights of one residency score identically on all
 * three, so whichever sorted first won — and Social Distortion's 6 December Belasco show
 * got the 8 December setlist, from a run where the archive holds nights 6, 7 and 8.
 *
 * Measured across 293 cached setlists before choosing this number:
 *
 *     exact   241   82.3%
 *     1 day    29    9.9%
 *     2-7d      7    2.4%
 *     8-30d     4    1.4%
 *     31d+     12    4.1%     ← Depeche Mode 259 days, Bear Hands 241, Maxi Priest 196
 *
 * One day is kept because it is genuinely ambiguous: a show crossing midnight, a timezone,
 * or our own date being off by one — which it was for Social Distortion, where the
 * photographs settled it. Everything past that is a different concert. All 23 the gate
 * drops were inspected and every one is wrong.
 *
 * The asymmetry is deliberate and it is the archive's: losing a setlist costs song data,
 * and keeping a wrong one puts songs in a post that were never played. A note that says
 * less is recoverable. A note that says something false is the fabricated memory this
 * project refuses everywhere else.
 */
const MAX_DATE_GAP_DAYS = 1

/** setlist.fm returns `DD-MM-YYYY`; the archive stores `YYYY-MM-DD`. */
function eventDateToIso(eventDate: string): string | null {
  const parts = eventDate.split('-')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  return `${y}-${m}-${d}`
}

/** Whole days between a setlist's date and the concert's, or null if unreadable. */
export function setlistDateGap(eventDate: string, concertDate: string): number | null {
  const iso = eventDateToIso(eventDate)
  if (!iso) return null
  const a = Date.parse(`${iso}T00:00:00Z`)
  const b = Date.parse(`${concertDate}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round(Math.abs(a - b) / 86_400_000)
}

// Find best matching setlist from search results
export function findBestSetlistMatch(
  results: Setlist[],
  params: { artistName: string; venueName: string; city: string; concertDate: string }
): Setlist | null {
  if (results.length === 0) return null

  /* The gate runs BEFORE scoring, not as another weight. A weight can be outvoted by a
     venue name matching perfectly — which is exactly what happens on a residency, where
     every candidate has the same venue. A different night is not a worse match; it is a
     different show, and no amount of venue similarity makes it the right one. */
  const sameNight = results.filter(result => {
    const gap = setlistDateGap(result.eventDate, params.concertDate)
    return gap !== null && gap <= MAX_DATE_GAP_DAYS
  })

  if (sameNight.length === 0) return null

  const scored = sameNight.map(result => ({
    result,
    score: calculateMatchScore(result, params),
    /* Exact beats near, before venue or city get a say. Two candidates a day apart with
       identical venues would otherwise be settled by sort order, which is how this went
       wrong in the first place. */
    gap: setlistDateGap(result.eventDate, params.concertDate) ?? Number.MAX_SAFE_INTEGER
  }))

  scored.sort((a, b) => a.gap - b.gap || b.score - a.score)

  const best = scored[0]
  const MATCH_THRESHOLD = 0.5

  if (best.score >= MATCH_THRESHOLD) {
    return best.result
  }

  return null
}

// Fetch setlist from setlist.fm API for a specific artist
async function fetchSetlistFromAPI(
  concert: Concert,
  artistName: string,
  apiKey: string
): Promise<Setlist | null> {
  const mappedCity = mapCityName(concert.city)
  const year = concert.date.split('-')[0]

  const url = new URL('https://api.setlist.fm/rest/1.0/search/setlists')
  url.searchParams.append('artistName', artistName)
  url.searchParams.append('cityName', mappedCity)
  url.searchParams.append('year', year)

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    })

    if (response.status === 429) {
      throw new Error('Rate limit exceeded')
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data: SetlistSearchResponse = await response.json()

    if (!data.setlist || data.setlist.length === 0) {
      return null
    }

    // Find best match using fuzzy matching
    const bestMatch = findBestSetlistMatch(data.setlist, {
      artistName,
      venueName: concert.venue,
      city: mappedCity,
      concertDate: concert.date
    })

    return bestMatch

  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error fetching setlist')
  }
}

/**
 * The other names setlist.fm files an act under, tried only when the archive's own name
 * finds nothing. Keyed by the archive's billing (concerts.json); the cache entry keeps that
 * billing, so every reader (site, Ask, MCP) still finds the set under the archive's name.
 *
 * Thompson Twins: since the reunion, setlist.fm lists the shows under "Thompson Twins' Tom
 * Bailey", a separate artist page. A search for "Thompson Twins" in Glasgow, 2026 returned
 * 404 (no results) on every run, so the Pavilion Theatre night (2026-09-16) never had the
 * headliner's set — while 1984 and 1985, filed under "Thompson Twins", matched fine.
 *
 * Add an act here only when setlist.fm is known to list it under another name. The search
 * is still constrained by city and year, and the match by venue and date.
 */
export const SETLISTFM_BILLINGS: Record<string, string[]> = {
  'Thompson Twins': ["Thompson Twins' Tom Bailey", 'Tom Bailey'],
}

/** setlist.fm answers a search with no results as HTTP 404. */
const isNoResults = (e: unknown) => e instanceof Error && /API error: 404\b/.test(e.message)

/**
 * Search under the archive's name, then each setlist.fm billing, until one finds the show.
 * A "no results" (404) on a name moves on to the next; any other error stops and is thrown,
 * as is the last name's. `pause` runs between requests (setlist.fm's ~1 req/s limit).
 */
export async function fetchSetlistUnderBillings(
  artistName: string,
  search: (name: string) => Promise<Setlist | null>,
  pause: () => Promise<void> = () => delay(1500),
  billings: Record<string, string[]> = SETLISTFM_BILLINGS,
): Promise<Setlist | null> {
  const names = [artistName, ...(billings[artistName] ?? [])]
  for (let i = 0; i < names.length; i++) {
    const last = i === names.length - 1
    if (i > 0) await pause()
    try {
      const found = await search(names[i])
      if (found || last) return found
    } catch (e) {
      if (last || !isNoResults(e)) throw e
    }
    console.log(`      ↪ nothing under "${names[i]}" — trying "${names[i + 1]}"`)
  }
  return null
}

// Delay helper to respect rate limits
/**
 * How long after a show an empty setlist.fm page is still worth asking about again.
 *
 * setlist.fm creates the event page before the show, with no songs, and fans fill it in
 * over the following days. The Hollywood Bowl bill (Human League, Alison Moyet, Soft Cell,
 * 2026-06-04) was fetched on 06-02 — two days early — and the empty pages were reused on
 * every run after, so the site never showed any of the three sets. Past this window an
 * empty page is almost always empty for good (most of the ~100 empty entries are 1980s
 * shows), so they are not re-asked every week.
 */
const EMPTY_SETLIST_RETRY_DAYS = 30

/** Songs across all sets; 0 for an event page with nothing filled in. */
export function setlistSongCount(setlist: Pick<Setlist, 'sets'> | null): number {
  return (setlist?.sets?.set ?? []).reduce((n, s) => n + (s.song?.length ?? 0), 0)
}

/**
 * Whether a cached entry can be reused as-is. A found setlist with songs is final. A
 * missing or empty one is reused only if it was fetched well after the show — one fetched
 * before or soon after the night is asked about again until the window closes.
 */
export function canReuseCachedSetlist(
  entry: Pick<SetlistCacheEntry, 'setlist' | 'fetchedAt' | 'date'>,
): boolean {
  if (entry.setlist === null) return false // unchanged: a miss is always retried
  if (setlistSongCount(entry.setlist) > 0) return true
  const fetched = Date.parse(entry.fetchedAt)
  const show = Date.parse(`${entry.date}T00:00:00Z`)
  if (Number.isNaN(fetched) || Number.isNaN(show)) return false
  return fetched - show > EMPTY_SETLIST_RETRY_DAYS * 24 * 60 * 60 * 1000
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main(options: { forceRefresh?: boolean } = {}) {
  const { forceRefresh = false } = options

  console.log(`🎵 Pre-fetching setlists for all concerts...${forceRefresh ? ' (FORCE REFRESH)' : ''}\n`)

  // Get API key from environment
  const apiKey = process.env.VITE_SETLISTFM_API_KEY
  if (!apiKey) {
    console.error('❌ Error: VITE_SETLISTFM_API_KEY environment variable not set')
    console.error('   Please set it in your .env file or environment')
    process.exit(1)
  }

  // Read concerts.json
  const concertsPath = path.resolve(__dirname, '../public/data/concerts.json')
  const concertsData = JSON.parse(fs.readFileSync(concertsPath, 'utf-8'))
  const concerts: Concert[] = concertsData.concerts

  console.log(`📊 Found ${concerts.length} concerts to process\n`)

  // Check if cache already exists
  const cachePath = path.resolve(__dirname, '../public/data/setlists-cache.json')
  let existingCache: SetlistCache | null = null

  if (fs.existsSync(cachePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      existingCache = parsed
      console.log(`📦 Found existing cache with ${parsed.entries.length} entries`)
      console.log(`   Cache generated: ${parsed.generatedAt}`)

      if (forceRefresh) {
        console.log('   🔄 Force refresh enabled - will re-fetch all setlists')
        // Create backup before clearing cache
        createBackup(cachePath, { maxBackups: 10, verbose: true })
        existingCache = null
      }
      console.log()
    } catch (error) {
      console.warn('⚠️  Warning: Could not read existing cache, starting fresh\n')
    }
  }

  // Build map of existing cache entries using composite key (concertId:artistName)
  const existingEntries = new Map<string, SetlistCacheEntry>()
  if (existingCache && !forceRefresh) {
    for (const entry of existingCache.entries) {
      // Use composite key to support multiple artists per concert
      const cacheKey = `${entry.concertId}:${entry.artistName}`
      existingEntries.set(cacheKey, entry)
    }
  }

  const cacheEntries: SetlistCacheEntry[] = []
  let fetchCount = 0
  let cacheHitCount = 0
  let notFoundCount = 0
  let errorCount = 0

  // Build list of all artists to fetch (headliners + openers)
  interface ArtistToFetch {
    concert: Concert
    artistName: string
    isHeadliner: boolean
  }

  const artistsToFetch: ArtistToFetch[] = []
  for (const concert of concerts) {
    // Add headliner
    artistsToFetch.push({
      concert,
      artistName: concert.headliner,
      isHeadliner: true
    })

    // Add openers
    if (concert.openers && concert.openers.length > 0) {
      for (const opener of concert.openers) {
        if (opener && opener.trim()) {
          artistsToFetch.push({
            concert,
            artistName: opener.trim(),
            isHeadliner: false
          })
        }
      }
    }
  }

  console.log(`📊 Total artists to fetch: ${artistsToFetch.length} (headliners + openers)\n`)

  // Process each artist
  for (let i = 0; i < artistsToFetch.length; i++) {
    const { concert, artistName, isHeadliner } = artistsToFetch[i]
    const progress = `[${i + 1}/${artistsToFetch.length}]`
    const artistType = isHeadliner ? '🎤' : '🎸'

    // Build cache key for this specific artist at this concert
    const cacheKey = `${concert.id}:${artistName}`

    // Check if we already have this in cache
    const existing = existingEntries.get(cacheKey)
    if (existing && canReuseCachedSetlist(existing)) {
      // A setlist with songs, or an empty page fetched long enough after the show to trust
      cacheEntries.push(existing)
      cacheHitCount++
      console.log(`${progress} ${artistType} ✓ ${artistName} at ${concert.venue} (cached)`)
      continue
    }

    // Need to fetch from API
    console.log(`${progress} ${artistType} 🔍 ${artistName} at ${concert.venue}...`)

    try {
      const setlist = await fetchSetlistUnderBillings(artistName, (name) => fetchSetlistFromAPI(concert, name, apiKey))

      /* A near match is recorded, never assumed. The gate lets a one-day gap through
         because it is genuinely ambiguous, but "ambiguous" is not "the same" — and the one
         time this mattered, the archive's date was the wrong one and the photographs said
         so. Writing the gap down means a later reader can tell which of the two dates to
         doubt, instead of finding two files that quietly disagree. */
      const dateGap = setlist ? setlistDateGap(setlist.eventDate, concert.date) : null

      const entry: SetlistCacheEntry = {
        concertId: concert.id,
        artistName: artistName,
        date: concert.date,
        venue: concert.venue,
        city: concert.city,
        setlist,
        ...(dateGap ? { dateGap } : {}),
        fetchedAt: new Date().toISOString()
      }

      if (dateGap) {
        console.log(`${progress}    ⚠️  setlist is ${dateGap} day off — ${setlist!.eventDate} vs ${concert.date}`)
      }

      cacheEntries.push(entry)

      if (setlist) {
        const songCount = setlist.sets.set.reduce((acc, s) => acc + s.song.length, 0)
        console.log(`${progress} ${artistType} ✅ Found setlist with ${songCount} songs`)
        fetchCount++
      } else {
        console.log(`${progress} ${artistType} ⚪ No setlist found`)
        notFoundCount++
      }

      // Rate limiting: setlist.fm free tier allows ~1 request per second
      // Add 1.5 second delay between requests to be safe
      if (i < artistsToFetch.length - 1) {
        await delay(1500)
      }

    } catch (error) {
      console.error(`${progress} ${artistType} ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)

      const entry: SetlistCacheEntry = {
        concertId: concert.id,
        artistName: artistName,
        date: concert.date,
        venue: concert.venue,
        city: concert.city,
        setlist: null,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      cacheEntries.push(entry)
      errorCount++

      // If rate limited, wait longer before continuing
      if (error instanceof Error && error.message.includes('Rate limit')) {
        console.log('⏳ Rate limited - waiting 60 seconds...')
        await delay(60000)
      } else {
        // Still wait a bit after errors
        await delay(2000)
      }
    }
  }

  // Generate cache file
  const cache: SetlistCache = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    entries: cacheEntries
  }

  // Ensure output directory exists
  const outputDir = path.dirname(cachePath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write cache file
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2))

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('✨ Pre-fetch complete!')
  console.log('='.repeat(60))
  console.log(`📊 Total concerts: ${concerts.length}`)
  console.log(`🎵 Total artists (headliners + openers): ${artistsToFetch.length}`)
  console.log(`📦 Used cached: ${cacheHitCount}`)
  console.log(`🔍 Fetched new: ${fetchCount}`)
  console.log(`⚪ Not found: ${notFoundCount}`)
  console.log(`❌ Errors: ${errorCount}`)
  console.log(`\n💾 Cache saved to: ${path.relative(process.cwd(), cachePath)}`)
  console.log(`📦 Cache size: ${(fs.statSync(cachePath).size / 1024).toFixed(2)} KB`)
  console.log(`📝 Total cache entries: ${cacheEntries.length}`)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const forceRefresh = process.argv.includes('--force-refresh')
  main({ forceRefresh }).catch(error => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
}

// Export for use in build pipeline
export default main
