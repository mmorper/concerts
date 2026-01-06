/**
 * Ticketmaster Discovery API Service
 * Fetches upcoming tour dates for artists with 24-hour client-side caching
 *
 * API Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 * Free tier: 5,000 API calls/day, 5 requests/second
 * Requires API key from: https://developer.ticketmaster.com/
 */

import type {
  TourEvent,
  TourDatesCacheEntry,
  TourDatesResult,
  TicketmasterResponse,
  TicketmasterEvent
} from '../types/tourDates'

// Cache configuration
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
const tourDatesCache = new Map<string, TourDatesCacheEntry>()

/**
 * Generate cache key from artist name
 * Normalizes to lowercase and trims whitespace
 */
function getCacheKey(artistName: string): string {
  return artistName.toLowerCase().trim()
}

/**
 * Check if cached entry is still valid
 */
function isCacheValid(entry: TourDatesCacheEntry): boolean {
  return Date.now() - entry.timestamp < entry.ttl
}

/**
 * Normalize Ticketmaster event to our TourEvent format
 */
function normalizeTicketmasterEvent(event: TicketmasterEvent): TourEvent {
  const venue = event._embedded?.venues?.[0]
  const attractions = event._embedded?.attractions || []

  // Build ISO 8601 datetime
  let datetime = event.dates.start.dateTime
  if (!datetime && event.dates.start.localDate) {
    const time = event.dates.start.localTime || '20:00:00'
    datetime = `${event.dates.start.localDate}T${time}`
  }

  return {
    id: event.id,
    url: event.url,
    datetime: datetime || event.dates.start.localDate,
    venue: {
      name: venue?.name || 'TBA',
      city: venue?.city.name || 'TBA',
      region: venue?.state?.stateCode || venue?.country.countryCode || '',
      country: venue?.country.countryCode || '',
      latitude: venue?.location?.latitude,
      longitude: venue?.location?.longitude
    },
    offers: event.url ? [{
      type: 'Tickets',
      url: event.url,
      status: event.saleStatus || 'unknown'
    }] : undefined,
    lineup: attractions.map(a => a.name),
    description: event.name
  }
}

/**
 * Search for artist by name to get attraction ID
 * Ticketmaster requires attraction ID, not artist name
 */
async function searchArtist(artistName: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.warn('[Ticketmaster] Missing or placeholder VITE_TICKETMASTER_API_KEY in .env')
    return null
  }

  const encodedArtist = encodeURIComponent(artistName)
  const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodedArtist}&apikey=${apiKey}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[Ticketmaster] Artist search failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    const attractions = data._embedded?.attractions || []

    // Return first exact or partial match
    if (attractions.length > 0) {
      // Try exact match first (case insensitive)
      const exactMatch = attractions.find((a: any) =>
        a.name.toLowerCase() === artistName.toLowerCase()
      )
      return exactMatch?.id || attractions[0].id
    }

    return null
  } catch (error) {
    console.error('[Ticketmaster] Artist search error:', error)
    return null
  }
}

/**
 * Fetch tour dates from Ticketmaster API (without cache)
 * @param artistName - Artist name (will search for attraction ID)
 * @returns Array of upcoming tour events (empty if none found)
 */
async function fetchTourDatesFromAPI(artistName: string): Promise<TourEvent[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.warn('[Ticketmaster] Missing or placeholder API key')
    return []
  }

  // Step 1: Search for artist to get attraction ID
  const attractionId = await searchArtist(artistName)

  if (!attractionId) {
    return []
  }

  // Step 2: Fetch events for attraction
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?attractionId=${attractionId}&sort=date,asc&apikey=${apiKey}`

  try {
    const response = await fetch(url)

    // 404 means no events found
    if (response.status === 404) {
      return []
    }

    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`)
    }

    const data: TicketmasterResponse = await response.json()
    const events = data._embedded?.events || []

    // Normalize to our format
    return events.map(normalizeTicketmasterEvent)
  } catch (error) {
    if (error instanceof Error) {
      console.error('[Ticketmaster] Failed to fetch tour dates:', error.message)
    }
    throw error
  }
}

/**
 * Try fetching with artist name normalization fallback
 * If initial fetch returns empty, tries removing "The " prefix
 *
 * Example: "The National" → "National"
 */
async function fetchWithFallback(artistName: string): Promise<TourEvent[]> {
  // Try exact name first
  let events = await fetchTourDatesFromAPI(artistName)

  // If empty and name starts with "The ", try without it
  if (events.length === 0 && /^the\s+/i.test(artistName)) {
    const normalized = artistName.replace(/^the\s+/i, '').trim()

    if (normalized !== artistName) {
      console.log(`[Ticketmaster] Retrying without "The": ${normalized}`)
      events = await fetchTourDatesFromAPI(normalized)
    }
  }

  return events
}

/**
 * Fetch upcoming tour dates with caching and fallback
 * Main entry point for components
 *
 * @param artistName - Artist name
 * @returns Tour dates result with events, count, and cache status
 */
export async function fetchTourDates(artistName: string): Promise<TourDatesResult> {
  const cacheKey = getCacheKey(artistName)
  const cached = tourDatesCache.get(cacheKey)

  // Return cached data if still valid
  if (cached && isCacheValid(cached)) {
    return {
      events: cached.data,
      count: cached.count,
      cached: true
    }
  }

  // Fetch fresh data with fallback
  try {
    const events = await fetchWithFallback(artistName)

    // Cache the result (even if empty)
    const cacheEntry: TourDatesCacheEntry = {
      data: events,
      timestamp: Date.now(),
      ttl: CACHE_TTL,
      count: events.length
    }

    tourDatesCache.set(cacheKey, cacheEntry)

    return {
      events,
      count: events.length,
      cached: false
    }
  } catch (error) {
    // If we have stale cached data, return it as fallback
    if (cached) {
      console.warn('[Ticketmaster] Using stale cached tour dates due to fetch error')
      return {
        events: cached.data,
        count: cached.count,
        cached: true
      }
    }

    // No cached data available - throw error
    throw error
  }
}

/**
 * Clear tour dates cache
 * Useful for testing or manual refresh
 */
export function clearTourDatesCache(): void {
  tourDatesCache.clear()
}

/**
 * Get cache stats for debugging
 */
export function getTourDatesCacheStats() {
  const entries = Array.from(tourDatesCache.entries())
  const now = Date.now()

  return {
    total: entries.length,
    valid: entries.filter(([, entry]) => isCacheValid(entry)).length,
    expired: entries.filter(([, entry]) => !isCacheValid(entry)).length,
    oldestEntry: entries.length > 0
      ? Math.min(...entries.map(([, e]) => now - e.timestamp))
      : 0
  }
}
