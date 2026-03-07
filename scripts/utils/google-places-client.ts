import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env file
config()

interface PlacePhoto {
  name: string
  widthPx: number
  heightPx: number
  authorAttributions: Array<{
    displayName: string
    uri: string
    photoUri: string
  }>
}

interface PlaceDetails {
  id: string
  displayName: {
    text: string
    languageCode: string
  }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  types?: string[]
  photos?: PlacePhoto[]
}

interface PlacesCache {
  [key: string]: {
    placeId: string | null
    placeDetails: PlaceDetails | null
    searchedAt: string
    expiresAt: string | null
  }
}

const CACHE_PATH = path.join(__dirname, '../../public/data/venue-photos-cache.json')
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || ''
const CACHE_TTL_DAYS = 90

let cache: PlacesCache = {}

/**
 * Load cache from disk
 */
export function loadCache(): void {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const content = fs.readFileSync(CACHE_PATH, 'utf-8')
      cache = JSON.parse(content)
    } else {
      cache = {}
    }
  } catch (error) {
    console.warn('Warning: Could not load Places API cache:', error)
    cache = {}
  }
}

/**
 * Save cache to disk
 */
export function saveCache(): void {
  try {
    const dir = path.dirname(CACHE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
  } catch (error) {
    console.error('Error: Could not save Places API cache:', error)
  }
}

/**
 * Generate cache key from venue details
 */
export function getCacheKey(venue: string, city: string, state: string): string {
  return `${venue}|${city}|${state}`.toLowerCase().trim()
}

/**
 * Check if cache entry is expired
 */
function isCacheExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false // Manual entries don't expire
  return new Date(expiresAt) < new Date()
}

/**
 * Search for venue by name and location using Text Search API
 */
async function findPlace(
  venueName: string,
  city: string,
  state: string,
  lat?: number,
  lng?: number
): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Warning: GOOGLE_PLACES_API_KEY not set, skipping Places API call')
    return null
  }

  const query = `${venueName}, ${city}, ${state}`
  const url = 'https://places.googleapis.com/v1/places:searchText'

  const body: any = {
    textQuery: query,
  }

  // Add location bias if coordinates provided
  if (lat && lng) {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 1000, // 1km radius
      },
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.warn(`Warning: Places API request failed - ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    if (!data.places || data.places.length === 0) {
      console.warn(`No place found for: ${query}`)
      return null
    }

    return data.places[0].id
  } catch (error) {
    console.error(`Error searching for place "${query}":`, error)
    return null
  }
}

/**
 * Get place details including photos
 */
async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Warning: GOOGLE_PLACES_API_KEY not set, skipping Places API call')
    return null
  }

  const url = `https://places.googleapis.com/v1/places/${placeId}`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,rating,userRatingCount,websiteUri,types,photos',
      },
    })

    if (!response.ok) {
      console.error(`Failed to fetch place details: ${placeId} - ${response.status}`)
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Error fetching place details for ${placeId}:`, error)
    return null
  }
}

/**
 * Fetch the permanent CDN photo URI for a given photo resource name.
 * Uses skipHttpRedirect=true to resolve the API reference to a stable
 * lh3.googleusercontent.com URL at data-refresh time, avoiding expiring
 * API resource references being stored in venues-metadata.json.
 */
export async function fetchPhotoUri(photoName: string, maxHeightPx: number): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    return null
  }
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&skipHttpRedirect=true&key=${GOOGLE_PLACES_API_KEY}`
  try {
    const response = await fetch(url, {
      headers: { 'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY },
    })
    if (!response.ok) {
      console.warn(`Warning: photo fetch failed (${response.status}) for ${photoName}`)
      return null
    }
    const data = await response.json()
    return data.photoUri ?? null
  } catch (error) {
    console.error(`Error fetching photo URI for ${photoName}:`, error)
    return null
  }
}

/**
 * Get venue place details with cache-first logic
 */
export async function getVenuePlaceDetails(
  venue: string,
  city: string,
  state: string,
  lat?: number,
  lng?: number,
  forceRefresh: boolean = false
): Promise<PlaceDetails | null> {
  if (!venue || !city || !state) {
    return null
  }

  // Load cache if not already loaded
  if (Object.keys(cache).length === 0) {
    loadCache()
  }

  const cacheKey = getCacheKey(venue, city, state)

  // Check cache first (unless force refresh)
  if (!forceRefresh && cache[cacheKey]) {
    const entry = cache[cacheKey]

    // Check if expired
    if (entry.expiresAt && isCacheExpired(entry.expiresAt)) {
      console.log(`⏰ Cache expired for: ${venue}, ${city}, ${state}`)
    } else {
      console.log(`✓ Cache hit: ${venue}, ${city}, ${state}`)
      return entry.placeDetails
    }
  }

  // Cache miss or expired - fetch from API
  console.log(`⚡ Fetching from Places API: ${venue}, ${city}, ${state}`)

  // Step 1: Find place ID
  const placeId = await findPlace(venue, city, state, lat, lng)

  if (!placeId) {
    // Store null result to avoid repeated failed lookups
    cache[cacheKey] = {
      placeId: null,
      placeDetails: null,
      searchedAt: new Date().toISOString(),
      expiresAt: null, // Failed searches don't expire
    }
    saveCache()
    return null
  }

  // Rate limiting between Text Search and Place Details
  await new Promise(resolve => setTimeout(resolve, 100))

  // Step 2: Get place details
  const placeDetails = await getPlaceDetails(placeId)

  // Store in cache
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS)

  cache[cacheKey] = {
    placeId,
    placeDetails,
    searchedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  saveCache()

  return placeDetails
}

/**
 * Batch fetch place details for multiple venues with rate limiting
 */
export async function batchFetchVenuePlaces(
  venues: Array<{ venue: string; city: string; state: string; lat?: number; lng?: number }>,
  forceRefresh: boolean = false
): Promise<Map<string, PlaceDetails | null>> {
  loadCache()
  const results = new Map<string, PlaceDetails | null>()

  for (const { venue, city, state, lat, lng } of venues) {
    const placeDetails = await getVenuePlaceDetails(venue, city, state, lat, lng, forceRefresh)
    const key = getCacheKey(venue, city, state)
    results.set(key, placeDetails)

    // Rate limiting: 20ms delay between requests (safe for API limits)
    await new Promise(resolve => setTimeout(resolve, 20))
  }

  saveCache()
  return results
}
