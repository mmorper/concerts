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
  location?: {
    latitude: number
    longitude: number
  }
}

interface PlacesCache {
  [key: string]: {
    placeId: string | null
    placeDetails: PlaceDetails | null
    searchedAt: string
    expiresAt: string | null
    /**
     * When the cached `placeDetails.photos` list goes stale. Separate from
     * `expiresAt` because photo names rot in days while a place ID does not
     * (#315). Absent on entries written before that split — treated as stale so
     * they refresh once.
     */
    photosExpireAt?: string | null
  }
}

const CACHE_PATH = path.join(__dirname, '../../public/data/venue-photos-cache.json')
/**
 * Read the key at call time, not import time.
 *
 * Binding it to a module-level const made the module untestable: `config()`
 * above loads the real `.env` during import, so a test could never substitute a
 * fake key and would fire live requests with the operator's real credential. It
 * also meant any caller that set the variable after importing this module was
 * silently ignored.
 */
function apiKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY || ''
}

/**
 * How long a place's *identity* stays good. A place ID is stable — measured on
 * 2026-08-22, every venue re-searched from scratch came back with the same ID
 * it was cached with in July — so there is no reason to re-run a Text Search
 * often.
 */
const CACHE_TTL_DAYS = 90

/**
 * How long a place's *photo list* stays good — far shorter than the identity
 * above, because photo resource names are not stable (#315).
 *
 * Google rotates the opaque `photos[].name` tokens. On 2026-08-22 every photo
 * name cached on 2026-07-13 (the `AWCwyd…` generation) returned
 * `400 INVALID_ARGUMENT — "The photo resource in the request is invalid"`,
 * while a fresh Place Details call for the same place ID returned working names
 * in a new `AVoNoX…` generation. That rotation is what killed 65 of 67 venue
 * photos between 2026-08-10 and 2026-08-13.
 *
 * Under the old single 90-day TTL the cache went on serving those dead names
 * until 2026-10-11, so every weekly run burned ~870 futile calls rediscovering
 * that they were dead. Seven days keeps the photo list fresher than the weekly
 * refresh cadence, so a run never starts from names it already knows are old.
 */
const PHOTO_TTL_DAYS = 7

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
 * Whether a cached photo list has aged out.
 *
 * Unlike `isCacheExpired`, a missing timestamp means **stale**, not immortal.
 * Entries written before the identity/photo TTL split (#315) carry no
 * `photosExpireAt`, and those are exactly the ones holding rotated names — so
 * the absent value has to mean "refresh me once".
 */
function arePhotosStale(photosExpireAt: string | null | undefined): boolean {
  if (!photosExpireAt) return true
  return new Date(photosExpireAt) < new Date()
}

/** ISO timestamp `days` from now. */
function daysFromNow(days: number): string {
  const at = new Date()
  at.setDate(at.getDate() + days)
  return at.toISOString()
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
  if (!apiKey()) {
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
        'X-Goog-Api-Key': apiKey(),
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
  if (!apiKey()) {
    console.warn('Warning: GOOGLE_PLACES_API_KEY not set, skipping Places API call')
    return null
  }

  const url = `https://places.googleapis.com/v1/places/${placeId}`

  try {
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey(),
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,rating,userRatingCount,websiteUri,types,photos,location',
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

export type PhotoFetch =
  /** Resolved. `uri` is live as of this moment, not forever. */
  | { ok: true; uri: string }
  /**
   * The photo resource name is no longer one Google recognises (400/404), or
   * the photo is gone (403). Walking to the next candidate is pointless if the
   * whole list came from the same stale cache entry — re-fetch Place Details.
   */
  | { ok: false; reason: 'stale' }
  /**
   * Rate limited or a server-side blip that outlasted our retries. Says nothing
   * about whether the photo exists, so the caller **must not** downgrade the
   * venue to a fallback on this — see `resolveLivePhotoUrls`.
   */
  | { ok: false; reason: 'throttled' }
  /** No API key configured. */
  | { ok: false; reason: 'unconfigured' }

/** Retries for a 429 or 5xx on the photo endpoint, beyond the first attempt. */
const PHOTO_MAX_RETRIES = 4

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Resolve a photo resource name to a CDN photo URI, retrying transient refusals.
 *
 * `skipHttpRedirect=true` returns the lh3.googleusercontent.com URL rather than
 * a redirect, so venues-metadata.json stores a directly usable URL instead of a
 * short-lived API resource reference.
 *
 * **The returned URL is long-lived but revocable, not permanent.** This comment
 * previously called it "permanent" and "stable"; measurement disproved that
 * (#252) — on 2026-08-05 a 215-day-old URL was healthy while a 30-day-old one
 * returned 403. Age does not predict breakage.
 *
 * What #315 then established is that the *resource name* is perishable too, and
 * on a much tighter clock: Google rotates these tokens, and when it does, both
 * the name and every URL previously minted from it die together. So a stored
 * URL cannot be trusted, and neither can a stored name — which is why the cache
 * now ages photos out on `PHOTO_TTL_DAYS` rather than the 90-day identity TTL.
 *
 * Retries matter here for a reason specific to this endpoint: the 2026-08-22
 * measurement saw **227 × HTTP 429** in a single 79-venue run. The old code
 * treated a 429 exactly like a 404 and returned null, so throttling cost ten
 * venues a photo they demonstrably still had. A 429 is a "come back later", not
 * an answer about the photo, and is now reported as such.
 */
async function fetchPhoto(photoName: string, maxHeightPx: number): Promise<PhotoFetch> {
  if (!apiKey()) {
    return { ok: false, reason: 'unconfigured' }
  }
  const url =
    `https://places.googleapis.com/v1/${photoName}/media` +
    `?maxHeightPx=${maxHeightPx}&skipHttpRedirect=true`

  for (let attempt = 0; attempt <= PHOTO_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'X-Goog-Api-Key': apiKey() },
      })

      if (response.ok) {
        const data = await response.json()
        return data.photoUri
          ? { ok: true, uri: data.photoUri }
          : { ok: false, reason: 'stale' }
      }

      const transient = response.status === 429 || response.status >= 500
      if (!transient) {
        // 400 INVALID_ARGUMENT is the rotated-name case and is expected until
        // the cache turns over; log it quietly so it does not drown the run.
        console.warn(`  ⚠ photo ${response.status} (stale name) for ${photoName.slice(0, 48)}…`)
        return { ok: false, reason: 'stale' }
      }

      if (attempt === PHOTO_MAX_RETRIES) {
        console.warn(`  ⚠ photo ${response.status} after ${attempt + 1} attempts — treating as throttled`)
        return { ok: false, reason: 'throttled' }
      }

      // Honour Retry-After when Google sends one; otherwise exponential
      // backoff with jitter so 79 venues do not resynchronise into a new burst.
      const retryAfter = Number(response.headers.get('retry-after'))
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 500 * 2 ** attempt + Math.random() * 250
      await sleep(backoff)
    } catch (error) {
      if (attempt === PHOTO_MAX_RETRIES) {
        console.error(`Error fetching photo URI for ${photoName}:`, error)
        return { ok: false, reason: 'throttled' }
      }
      await sleep(500 * 2 ** attempt + Math.random() * 250)
    }
  }
  return { ok: false, reason: 'throttled' }
}

export { fetchPhoto }

/**
 * Back-compat wrapper: collapses the outcome to a URL or null.
 *
 * Prefer `fetchPhoto` — the distinction between "stale" and "throttled" is the
 * whole point of #315 and this signature cannot carry it.
 */
export async function fetchPhotoUri(photoName: string, maxHeightPx: number): Promise<string | null> {
  const result = await fetchPhoto(photoName, maxHeightPx)
  return result.ok ? result.uri : null
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
    } else if (entry.placeId && arePhotosStale(entry.photosExpireAt)) {
      /**
       * Identity is still good but the photo list has aged out (#315). Re-run
       * Place Details against the cached place ID — that is the call which
       * mints new photo resource names — and skip the Text Search, which would
       * only rediscover a place ID we already hold. One call instead of two.
       */
      console.log(`📷 Photo names stale, refreshing details: ${venue}, ${city}, ${state}`)
      const refreshed = await getPlaceDetails(entry.placeId)
      if (refreshed) {
        cache[cacheKey] = {
          ...entry,
          placeDetails: refreshed,
          photosExpireAt: daysFromNow(PHOTO_TTL_DAYS),
        }
        saveCache()
        return refreshed
      }
      // Details call failed — better to hand back the stale list than nothing;
      // the caller walks candidates and falls back on its own terms.
      console.warn(`  ⚠ Could not refresh photo names, using cached list`)
      return entry.placeDetails
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

  // Store in cache. Identity and photos age out on separate clocks (#315).
  cache[cacheKey] = {
    placeId,
    placeDetails,
    searchedAt: new Date().toISOString(),
    expiresAt: daysFromNow(CACHE_TTL_DAYS),
    photosExpireAt: daysFromNow(PHOTO_TTL_DAYS),
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
