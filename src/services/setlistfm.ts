/**
 * setlist.fm API service
 * Fetches concert setlists with caching and fuzzy matching
 * API Documentation: https://api.setlist.fm/docs/1.0/index.html
 */

import type {
  Setlist,
  SetlistSearchResponse,
  SetlistSearchParams,
  CachedSetlist,
  SetlistError
} from '../types/setlist'
import { normalizeArtistName } from '../utils/normalize'

// Cache configuration
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
const memoryCache = new Map<string, CachedSetlist>()

// Static cache (pre-fetched at build time)
let staticCache: Map<string, Setlist | null> | null = null
let staticCacheLoadAttempted = false

// API configuration
// In development, use Vite proxy to avoid CORS issues
// In production, static cache should handle most requests
const API_BASE_URL = import.meta.env.DEV
  ? '/api/setlistfm'  // Proxied through Vite dev server
  : 'https://api.setlist.fm/rest/1.0' // Direct (will need backend proxy in prod)

/**
 * Generate cache key from search parameters (for memory cache)
 */
function getCacheKey(params: SetlistSearchParams): string {
  return `${params.artistName}|${params.date}|${params.venueName}|${params.city}`.toLowerCase()
}

/**
 * Load static cache from pre-fetched setlists file
 * This is a one-time load that happens on first use
 */
async function loadStaticCache(): Promise<void> {
  if (staticCacheLoadAttempted) return
  staticCacheLoadAttempted = true

  try {
    const response = await fetch('/data/setlists-cache.json')
    if (!response.ok) {
      console.warn('Static setlist cache not found - will use API fallback')
      return
    }

    const data = await response.json()
    staticCache = new Map()

    // Index by composite key (concertId:normalizedArtistName) for O(1) lookups
    // This allows multiple artists (headliner + openers) to have separate setlists
    // for the same concert ID
    for (const entry of data.entries) {
      const normalizedArtist = normalizeArtistName(entry.artistName)
      const cacheKey = `${entry.concertId}:${normalizedArtist}`
      staticCache.set(cacheKey, entry.setlist)
    }

    console.log(`Loaded ${staticCache.size} setlists from static cache`)
  } catch (error) {
    console.warn('Failed to load static setlist cache:', error)
  }
}

/**
 * Look up setlist in static cache by concert ID and artist name
 * Uses composite key (concertId:normalizedArtistName) to support multiple
 * artists (headliner + openers) at the same concert
 */
async function getFromStaticCache(
  concertId?: string,
  artistName?: string
): Promise<Setlist | null | undefined> {
  if (!concertId || !artistName) return undefined

  // Load static cache on first use
  await loadStaticCache()

  if (!staticCache) return undefined

  // Build composite cache key
  const normalizedArtist = normalizeArtistName(artistName)
  const cacheKey = `${concertId}:${normalizedArtist}`

  // Check if we have this artist's setlist for this concert
  if (staticCache.has(cacheKey)) {
    return staticCache.get(cacheKey) || null
  }

  return undefined
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1.0

  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0 || len2 === 0) return 0

  // Levenshtein distance calculation
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

/**
 * Normalize venue name for comparison
 * Removes common prefixes, punctuation, and extra whitespace
 */
function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, '') // Remove leading "The"
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim()
}

/**
 * Normalize city name for comparison
 * Handles common variations and abbreviations
 */
function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Map neighborhood/district names to their parent city
 * setlist.fm uses official city names, not neighborhoods
 */
function mapCityName(city: string): string {
  const cityLower = city.toLowerCase().trim()

  // Hollywood → Los Angeles
  if (cityLower === 'hollywood') return 'Los Angeles'

  // Add more mappings as needed
  // West Hollywood → Los Angeles
  if (cityLower === 'west hollywood') return 'Los Angeles'

  // Return original if no mapping found
  return city
}

/**
 * Calculate match score for a setlist result
 * Returns a score between 0 and 1
 * - 0.5 points for exact venue match
 * - 0.3 points for city match
 * - 0.2 points for artist name similarity
 */
function calculateMatchScore(result: Setlist, params: SetlistSearchParams): number {
  let score = 0

  // Venue name matching (strongest signal)
  const resultVenue = normalizeVenueName(result.venue.name)
  const paramsVenue = normalizeVenueName(params.venueName)

  if (resultVenue === paramsVenue) {
    score += 0.5
  } else {
    // Partial credit for similar venue names
    const venueSimilarity = stringSimilarity(resultVenue, paramsVenue)
    if (venueSimilarity > 0.7) {
      score += venueSimilarity * 0.5
    }
  }

  // City matching
  const resultCity = normalizeCityName(result.venue.city.name)
  const paramsCity = normalizeCityName(params.city)

  if (resultCity === paramsCity) {
    score += 0.3
  } else {
    // Partial credit for similar city names
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
 * Find best matching setlist from search results
 * Returns null if no match meets the threshold (0.5)
 */
function findBestSetlistMatch(
  results: Setlist[],
  params: SetlistSearchParams
): Setlist | null {
  if (results.length === 0) return null

  // Score each result
  const scored = results.map(result => ({
    result,
    score: calculateMatchScore(result, params)
  }))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Return best match if score exceeds threshold
  const best = scored[0]
  const MATCH_THRESHOLD = 0.5

  if (best.score >= MATCH_THRESHOLD) {
    return best.result
  }

  return null
}

/**
 * Fetch setlist from setlist.fm API with retry logic
 */
async function fetchFromAPI(params: SetlistSearchParams): Promise<Setlist | null> {
  // Build search URL
  // Note: Search by artist, city, and year to allow fuzzy date matching
  // (our data might be off by a day)
  const searchPath = `${API_BASE_URL}/search/setlists`
  const url = new URL(searchPath, window.location.origin)
  url.searchParams.append('artistName', params.artistName)

  // Map neighborhood names to official city names (Hollywood → Los Angeles)
  const mappedCity = mapCityName(params.city)
  url.searchParams.append('cityName', mappedCity)

  // Use year instead of exact date to be more forgiving
  const year = params.date.split('-')[0]
  url.searchParams.append('year', year)

  // In dev, the proxy adds the API key. In prod, we'll need a backend proxy.
  const headers: HeadersInit = {
    'Accept': 'application/json'
  }

  // Only add API key if making direct request (production)
  if (!import.meta.env.DEV) {
    const apiKey = import.meta.env.VITE_SETLISTFM_API_KEY
    if (!apiKey) {
      throw new Error('setlist.fm API key not configured')
    }
    headers['x-api-key'] = apiKey
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    })

    // Handle rate limiting
    if (response.status === 429) {
      const error: SetlistError = {
        type: 'rate_limit',
        message: 'Too many requests. Please wait a moment and try again.'
      }
      throw error
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const error: SetlistError = {
        type: 'api_error',
        status: response.status,
        message: `setlist.fm API error: ${response.status} ${response.statusText}`
      }
      throw error
    }

    const data: SetlistSearchResponse = await response.json()

    // No results found
    if (!data.setlist || data.setlist.length === 0) {
      return null
    }

    // Find best match using fuzzy matching
    const bestMatch = findBestSetlistMatch(data.setlist, params)

    return bestMatch

  } catch (error) {
    // Network errors
    if (error instanceof TypeError) {
      const networkError: SetlistError = {
        type: 'network',
        message: 'Unable to connect to setlist.fm. Check your internet connection.'
      }
      throw networkError
    }

    // Re-throw structured errors
    if (typeof error === 'object' && error !== null && 'type' in error) {
      throw error
    }

    // Unknown errors
    const unknownError: SetlistError = {
      type: 'unknown',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    }
    throw unknownError
  }
}

/**
 * Fetch setlist with three-tier caching:
 * 1. Static cache (pre-fetched at build time) - checked by concert ID + artist name
 * 2. Memory cache (runtime) - checked by search params
 * 3. API fetch (fallback) - only if not in either cache
 */
export async function fetchSetlist(
  params: SetlistSearchParams
): Promise<Setlist | null> {
  // Tier 1: Check static cache first (O(1) lookup by concert ID + artist name)
  if (params.concertId && params.artistName) {
    const staticResult = await getFromStaticCache(params.concertId, params.artistName)
    if (staticResult !== undefined) {
      // Static cache hit (may be null if we know there's no setlist)
      return staticResult
    }
  }

  // Tier 2: Check memory cache
  const cacheKey = getCacheKey(params)
  const cached = memoryCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    // Memory cache hit - return cached data
    return cached.data
  }

  // Tier 3: Cache miss - fetch from API
  try {
    const data = await fetchFromAPI(params)

    // Cache the result in memory (including null for "not found")
    memoryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    })

    return data

  } catch (error) {
    // Don't cache errors - let them propagate
    throw error
  }
}

/**
 * Clear the memory cache
 * Useful for testing or manual refresh
 * Note: Does not clear the static cache (build-time cache)
 */
export function clearSetlistCache(): void {
  memoryCache.clear()
}

/**
 * Get cache statistics
 * Useful for debugging and monitoring
 */
export function getCacheStats(): {
  memoryCache: {
    size: number
    entries: Array<{ key: string; timestamp: number; hasData: boolean }>
  }
  staticCache: {
    size: number
    loaded: boolean
  }
} {
  const memoryCacheEntries = Array.from(memoryCache.entries()).map(([key, value]) => ({
    key,
    timestamp: value.timestamp,
    hasData: value.data !== null
  }))

  return {
    memoryCache: {
      size: memoryCache.size,
      entries: memoryCacheEntries
    },
    staticCache: {
      size: staticCache?.size ?? 0,
      loaded: staticCache !== null
    }
  }
}
