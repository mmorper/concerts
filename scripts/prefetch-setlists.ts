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

interface Setlist {
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

interface SetlistCacheEntry {
  concertId: string
  artistName: string
  date: string
  venue: string
  city: string
  setlist: Setlist | null
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

// Normalize venue name
function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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

// Find best matching setlist from search results
function findBestSetlistMatch(
  results: Setlist[],
  params: { artistName: string; venueName: string; city: string }
): Setlist | null {
  if (results.length === 0) return null

  const scored = results.map(result => ({
    result,
    score: calculateMatchScore(result, params)
  }))

  scored.sort((a, b) => b.score - a.score)

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
      city: mappedCity
    })

    return bestMatch

  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error fetching setlist')
  }
}

// Delay helper to respect rate limits
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
      existingCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      console.log(`📦 Found existing cache with ${existingCache.entries.length} entries`)
      console.log(`   Cache generated: ${existingCache.generatedAt}`)

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
    if (existing && existing.setlist !== null) {
      // We have a valid cached setlist - reuse it
      cacheEntries.push(existing)
      cacheHitCount++
      console.log(`${progress} ${artistType} ✓ ${artistName} at ${concert.venue} (cached)`)
      continue
    }

    // Need to fetch from API
    console.log(`${progress} ${artistType} 🔍 ${artistName} at ${concert.venue}...`)

    try {
      const setlist = await fetchSetlistFromAPI(concert, artistName, apiKey)

      const entry: SetlistCacheEntry = {
        concertId: concert.id,
        artistName: artistName,
        date: concert.date,
        venue: concert.venue,
        city: concert.city,
        setlist,
        fetchedAt: new Date().toISOString()
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
