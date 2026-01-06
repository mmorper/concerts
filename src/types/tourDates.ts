/**
 * Tour Dates Types - Ticketmaster Discovery API Response
 * Used for displaying upcoming tour dates in the Artist Gatefold
 */

/**
 * Single tour event from Ticketmaster API (normalized format)
 */
export interface TourEvent {
  id: string
  url: string // Ticketmaster event page URL
  datetime: string // ISO 8601 format: "2026-03-15T20:00:00"
  venue: {
    name: string
    city: string
    region: string // State/province (e.g., "NY", "CA")
    country: string
    latitude?: string
    longitude?: string
  }
  offers?: Array<{
    type: string // Usually "Tickets"
    url: string // Ticket purchase URL
    status: string // "onsale", "offsale", etc.
  }>
  lineup?: string[] // Array of artist names performing
  description?: string
}

/**
 * Cache entry for tour dates
 */
export interface TourDatesCacheEntry {
  data: TourEvent[]
  timestamp: number
  ttl: number
  count: number // Convenience field for badge display
}

/**
 * Tour dates fetch result
 */
export interface TourDatesResult {
  events: TourEvent[]
  count: number
  cached: boolean
}

/**
 * Ticketmaster API Response Types (raw format)
 */

export interface TicketmasterEvent {
  id: string
  name: string
  type: string
  url: string
  dates: {
    start: {
      localDate: string // YYYY-MM-DD
      localTime?: string // HH:MM:SS
      dateTime?: string // ISO 8601
    }
    status?: {
      code: string
    }
    timezone?: string
  }
  _embedded?: {
    venues?: Array<{
      name: string
      city: {
        name: string
      }
      state?: {
        name: string
        stateCode: string
      }
      country: {
        name: string
        countryCode: string
      }
      location?: {
        latitude: string
        longitude: string
      }
    }>
    attractions?: Array<{
      name: string
      id: string
    }>
  }
  priceRanges?: Array<{
    type: string
    currency: string
    min: number
    max: number
  }>
  saleStatus?: string
}

export interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[]
  }
  page: {
    size: number
    totalElements: number
    totalPages: number
    number: number
  }
}
