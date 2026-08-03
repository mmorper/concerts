// src/utils/pageTracking.ts

/**
 * Scene name to display title mapping
 * Ensures each scene has a unique title for SEO and analytics
 */
const SCENE_TITLES: Record<number, string> = {
  1: '179 Concerts (1984-2026) | Morperhaus Concert Archives',
  2: 'Venues | Concert Archives',
  3: 'Geography | Concert Archives',
  4: 'Genres | Concert Archives',
  5: 'Artists | Concert Archives',
  6: 'Ask the Archive | Concert Archives',
}

/**
 * Scene number to URL parameter name mapping
 */
const SCENE_NAMES: Record<number, string> = {
  1: 'timeline',
  2: 'venues',
  3: 'geography',
  4: 'genres',
  5: 'artists',
  6: 'ask',
}

interface DeepLinkParams {
  artist?: string | null
  venue?: string | null
  /** Concert date from `?show=` (#196), already resolved against the archive */
  show?: string | null
  /** Venue of the resolved show — display only, never part of the URL */
  showVenue?: string | null
}

/**
 * Formats an ISO date for a page title: "2026-07-31" → "July 31, 2026"
 *
 * Parsed at local midnight rather than as a bare ISO string, which JS would
 * treat as UTC and render as the previous day west of Greenwich.
 */
function formatShowDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Formats a normalized name for display (reverses normalization)
 * Example: "depeche-mode" → "Depeche Mode"
 */
function formatEntityName(normalizedName: string): string {
  return normalizedName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Builds the page path (URL) from current scene and deep link parameters
 */
export function buildPagePath(
  sceneNumber: number,
  params?: DeepLinkParams
): string {
  const sceneName = SCENE_NAMES[sceneNumber]

  // Base path with scene
  const searchParams = new URLSearchParams()
  searchParams.set('scene', sceneName)

  // Add entity parameters if present
  if (params?.artist) {
    searchParams.set('artist', params.artist)
  }
  if (params?.venue) {
    searchParams.set('venue', params.venue)
  }
  if (params?.show) {
    searchParams.set('show', params.show)
  }

  return `/?${searchParams.toString()}`
}

/**
 * Builds the page title from current scene and deep link parameters
 */
export function buildPageTitle(
  sceneNumber: number,
  params?: DeepLinkParams
): string {
  const baseTitle = SCENE_TITLES[sceneNumber]

  // If no deep link params, return base scene title
  if (!params?.artist && !params?.venue && !params?.show) {
    return baseTitle
  }

  // Format entity names for display
  const artistDisplay = params.artist ? formatEntityName(params.artist) : null
  const venueDisplay = params.venue ? formatEntityName(params.venue) : null

  // #196 — a setlist view is a distinct page. Without this, arriving on a
  // shared setlist link and browsing to the artist report as the same
  // pageview, which also muddies #36's setlist_button_clicked reporting.
  if (params.show && artistDisplay) {
    const where = params.showVenue ? ` at ${params.showVenue}` : ''
    return `${artistDisplay}${where} · ${formatShowDate(params.show)} | Concert Archives`
  }

  // Build descriptive title based on deep link combination
  if (artistDisplay && venueDisplay) {
    return `${artistDisplay} at ${venueDisplay} | Concert Archives`
  } else if (artistDisplay) {
    return `${artistDisplay} | Artists | Concert Archives`
  } else if (venueDisplay) {
    return `${venueDisplay} | Venues | Concert Archives`
  }

  return baseTitle
}
