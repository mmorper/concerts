/**
 * Centralized Test Selectors
 *
 * Organizes all data-testid selectors by scene for maintainability.
 * When component structure changes, update selectors here instead of
 * in multiple test files.
 */

/**
 * Common selectors used across multiple scenes
 */
export const COMMON = {
  sceneContainer: (index) => `[data-testid="scene-${index}"]`,
  sceneTitle: `[data-testid="scene-title"]`,
  sceneSubtitle: `[data-testid="scene-subtitle"]`,
  loading: `[data-testid="loading"]`,
  error: `[data-testid="error"]`
}

/**
 * Scene 1: Timeline (Hero)
 * Interactive concert timeline with year navigation
 */
export const TIMELINE = {
  scene: `[data-testid="scene-timeline"]`,
  svg: `[data-testid="timeline-svg"]`,
  yearDot: `[data-testid="year-dot"]`,
  yearDotWithYear: (year) => `[data-testid="year-dot"][data-year="${year}"]`,
  hoverPreview: `[data-testid="timeline-hover-preview"]`,
  previewYear: `[data-testid="preview-year"]`,
  previewConcertCount: `[data-testid="preview-concert-count"]`,
  previewArtists: `[data-testid="preview-artists"]`,
  title: `[data-testid="timeline-title"]`,
  subtitle: `[data-testid="timeline-subtitle"]`,
  stats: `[data-testid="timeline-stats"]`
}

/**
 * Scene 2: Venues
 * D3 force-directed graph of concert venues
 */
export const VENUES = {
  scene: `[data-testid="venues-scene"]`,
  svg: `[data-testid="venues-svg"]`,
  venueNode: `[data-testid="venue-node"]`,
  venueNodeById: (id) => `[data-testid="venue-node"][data-venue="${id}"]`,
  venueLabel: `[data-testid="venue-label"]`,
  tooltip: `[data-testid="venue-tooltip"]`,
  tooltipName: `[data-testid="tooltip-venue-name"]`,
  tooltipConcertCount: `[data-testid="tooltip-concert-count"]`,
  tooltipCity: `[data-testid="tooltip-city"]`,
  legend: `[data-testid="venues-legend"]`,
  title: `[data-testid="venues-title"]`
}

/**
 * Scene 3: Map
 * Leaflet map showing concert venues geographically
 */
export const MAP = {
  scene: `[data-testid="map-scene"]`,
  container: `[data-testid="map-container"]`,
  marker: `[data-testid="map-marker"]`,
  markerById: (id) => `[data-testid="map-marker"][data-venue="${id}"]`,
  popup: `[data-testid="map-popup"]`,
  popupVenueName: `[data-testid="popup-venue-name"]`,
  popupConcertCount: `[data-testid="popup-concert-count"]`,
  popupConcerts: `[data-testid="popup-concerts"]`,
  controls: `[data-testid="map-controls"]`,
  zoomIn: `[data-testid="map-zoom-in"]`,
  zoomOut: `[data-testid="map-zoom-out"]`,
  title: `[data-testid="map-title"]`
}

/**
 * Scene 4: Bands/Venues Network
 * D3 force-directed network showing artist-venue relationships
 */
export const NETWORK = {
  scene: `[data-testid="scene-network"]`,
  svg: `[data-testid="network-svg"]`,
  artistNode: `[data-testid="artist-node"]`,
  artistNodeById: (id) => `[data-testid="artist-node"][data-artist="${id}"]`,
  venueNode: `[data-testid="venue-node"]`,
  venueNodeById: (id) => `[data-testid="venue-node"][data-venue="${id}"]`,
  link: `[data-testid="network-link"]`,
  artistLabel: `[data-testid="artist-label"]`,
  venueLabel: `[data-testid="venue-label"]`,
  tooltip: `[data-testid="network-tooltip"]`,
  tooltipName: `[data-testid="tooltip-node-name"]`,
  tooltipType: `[data-testid="tooltip-node-type"]`,
  tooltipConnections: `[data-testid="tooltip-connections"]`,
  legend: `[data-testid="network-legend"]`,
  title: `[data-testid="network-title"]`
}

/**
 * Scene 5: Genres
 * Interactive genre treemap and timeline
 */
export const GENRES = {
  scene: `[data-testid="scene-genres"]`,
  treemap: `[data-testid="genre-treemap"]`,
  treemapCell: `[data-testid="genre-cell"]`,
  treemapCellByGenre: (genre) => `[data-testid="genre-cell"][data-genre="${genre}"]`,
  treemapLabel: `[data-testid="genre-label"]`,
  timeline: `[data-testid="genre-timeline"]`,
  timelineSlider: `[data-testid="timeline-slider"]`,
  timelineYearLabel: `[data-testid="timeline-year"]`,
  timelineConcertCount: `[data-testid="timeline-concert-count"]`,
  tooltip: `[data-testid="genre-tooltip"]`,
  tooltipGenre: `[data-testid="tooltip-genre-name"]`,
  tooltipCount: `[data-testid="tooltip-show-count"]`,
  tooltipPercentage: `[data-testid="tooltip-percentage"]`,
  title: `[data-testid="genres-title"]`
}

/**
 * Artist Scene
 * Album gatefold-style artist profile
 */
export const ARTIST = {
  scene: `[data-testid="scene-artist"]`,
  searchTypeahead: `[data-testid="artist-search"]`,
  searchInput: `[data-testid="artist-search-input"]`,
  searchResults: `[data-testid="search-results"]`,
  searchResultItem: `[data-testid="search-result-item"]`,

  // Album gatefold
  gatefold: `[data-testid="artist-gatefold"]`,
  gatefoldCover: `[data-testid="gatefold-cover"]`,
  gatefoldLeft: `[data-testid="gatefold-left"]`,
  gatefoldRight: `[data-testid="gatefold-right"]`,

  // Artist card
  artistCard: `[data-testid="artist-card"]`,
  artistCardById: (id) => `[data-testid="artist-card"][data-artist="${id}"]`,
  artistCardFront: `[data-testid="card-front"]`,
  artistCardBack: `[data-testid="card-back"]`,
  artistImage: `[data-testid="artist-image"]`,
  artistName: `[data-testid="artist-name"]`,

  // Panels (liner notes style)
  spotifyPanel: `[data-testid="spotify-panel"]`,
  spotifyMostPopularAlbum: `[data-testid="spotify-album"]`,
  spotifyTopTracks: `[data-testid="spotify-tracks"]`,
  spotifyTrackItem: `[data-testid="spotify-track"]`,

  concertHistoryPanel: `[data-testid="concert-history-panel"]`,
  concertHistoryItem: `[data-testid="concert-item"]`,
  concertDate: `[data-testid="concert-date"]`,
  concertVenue: `[data-testid="concert-venue"]`,

  tourDatesPanel: `[data-testid="tour-dates-panel"]`,
  tourDateItem: `[data-testid="tour-date-item"]`,
  tourBadge: `[data-testid="tour-badge"]`,

  linerNotesPanel: `[data-testid="liner-notes-panel"]`,
  bio: `[data-testid="artist-bio"]`,
  formed: `[data-testid="artist-formed"]`,
  website: `[data-testid="artist-website"]`,
  genres: `[data-testid="artist-genres"]`,

  // Discography
  discographySection: `[data-testid="discography"]`,
  albumItem: `[data-testid="album-item"]`,
  albumCover: `[data-testid="album-cover"]`,
  albumTitle: `[data-testid="album-title"]`,
  albumYear: `[data-testid="album-year"]`,

  // Mobile modal
  mobileModal: `[data-testid="artist-modal"]`,
  mobileModalClose: `[data-testid="modal-close"]`,

  // Placeholder
  placeholder: `[data-testid="artist-placeholder"]`,
  placeholderMessage: `[data-testid="placeholder-message"]`,

  title: `[data-testid="artist-scene-title"]`
}

/**
 * Deep linking parameters
 * Used for URL-based navigation
 */
export const DEEP_LINKS = {
  scenes: {
    timeline: '?scene=timeline',
    venues: '?scene=venues',
    map: '?scene=map',
    bands: '?scene=bands',
    genres: '?scene=genres',
    artists: '?scene=artists'
  },
  artistByName: (artist) => `?scene=artists&artist=${artist}`,
  venueByName: (venue) => `?scene=venues&venue=${venue}`,
  yearByDate: (year) => `?scene=timeline&year=${year}`
}

/**
 * Helper to build selector with dynamic data attribute
 *
 * @param {string} testId - Base test ID
 * @param {Object} dataAttrs - Additional data attributes
 * @returns {string} CSS selector
 *
 * @example
 * buildSelector('artist-card', { artist: 'depeche-mode' })
 * // => '[data-testid="artist-card"][data-artist="depeche-mode"]'
 */
export function buildSelector(testId, dataAttrs = {}) {
  let selector = `[data-testid="${testId}"]`

  for (const [key, value] of Object.entries(dataAttrs)) {
    selector += `[data-${key}="${value}"]`
  }

  return selector
}
