/**
 * Static mapping of cities to geographic coordinates
 * This avoids the need for geocoding API calls at runtime
 *
 * To add new cities:
 * 1. Find coordinates at https://www.latlong.net/
 * 2. Add entry in format: 'City, ST': { lat: X.XXXX, lng: -Y.YYYY }
 */

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Colorado
  'Morrison, CO': { lat: 39.6653, lng: -105.2055 },
  'Denver, CO': { lat: 39.7392, lng: -104.9903 },
  'Boulder, CO': { lat: 40.0150, lng: -105.2705 },
  'Colorado Springs, CO': { lat: 38.8339, lng: -104.8214 },
  'Fort Collins, CO': { lat: 40.5853, lng: -105.0844 },
  'Aspen, CO': { lat: 39.1911, lng: -106.8175 },
  'Telluride, CO': { lat: 37.9375, lng: -107.8123 },

  // Add more cities as needed below
  // Format: 'City, State': { lat: latitude, lng: longitude },
}

/**
 * Get coordinates for a city/state string
 * Returns undefined if city not found in mapping
 */
export function getCityCoordinates(cityState: string): { lat: number; lng: number } | undefined {
  return CITY_COORDINATES[cityState]
}

/**
 * Get a default/fallback coordinate (Denver, CO)
 */
export function getDefaultCoordinates(): { lat: number; lng: number } {
  return { lat: 39.7392, lng: -104.9903 }
}
