/**
 * Timeline Hover Preview Constants
 *
 * Configuration values for animations, positioning, and behavior
 */

/**
 * Animation timing (in milliseconds)
 */
export const ANIMATION = {
  /** Delay before popup appears on hover */
  HOVER_DELAY: 120,

  /** Delay before popup appears on touch (shorter for better touch responsiveness) */
  TOUCH_HOVER_DELAY: 50,

  /** Duration of fade in/out animations */
  FADE_DURATION: 180,

  /** Duration of content crossfade when moving between dots */
  CROSSFADE_DURATION: 180,

  /** Delay before popup disappears after mouse leaves */
  LINGER_DELAY: 300,

  /** Duration of parallax movement */
  PARALLAX_DURATION: 200,
} as const

/**
 * Positioning and layout
 */
export const LAYOUT = {
  /** Popup width in pixels */
  WIDTH: 220,

  /** Minimum popup height in pixels */
  MIN_HEIGHT: 200,

  /** Artist image height in pixels */
  IMAGE_HEIGHT: 140,

  /** Distance from cursor/dot in pixels */
  OFFSET_Y: 70,

  /** Minimum distance from viewport edge in pixels */
  EDGE_MARGIN: 16,

  /** Internal padding (16px each side) */
  PADDING: 16,

  /** Popup border radius */
  BORDER_RADIUS: 12,

  /** Image border radius */
  IMAGE_BORDER_RADIUS: 8,

  /** Pointer arrow size */
  ARROW_SIZE: 8,
} as const

/**
 * Parallax effect settings
 */
export const PARALLAX = {
  /** Maximum horizontal shift in pixels */
  MAX_SHIFT_X: 6,

  /** Maximum vertical shift in pixels */
  MAX_SHIFT_Y: 6,

  /** Enabled only when mouse is within popup bounds */
  ENABLED: true,
} as const

/**
 * Responsive breakpoints
 */
export const BREAKPOINTS = {
  /** Disable hover preview below this width (in pixels) */
  MOBILE_MAX: 768,
} as const

/**
 * Image fallback
 */
export const FALLBACK = {
  /** Fallback image path for when no artist image is available */
  IMAGE_URL: '/images/venues/fallback-active.jpg',
} as const

/**
 * Color palette
 */
export const COLORS = {
  /** Popup background - deep indigo-purple */
  POPUP_BG: '#1e1e3f',

  /** Popup border - indigo-700 */
  POPUP_BORDER: '#3730a3',

  /** Primary text color (artist name) */
  TEXT_PRIMARY: '#ffffff',

  /** Secondary text color (venue) */
  TEXT_SECONDARY: '#94a3b8', // slate-400

  /** Accent text color (year + count) */
  TEXT_ACCENT: '#a5b4fc', // indigo-300 for better contrast on dark bg

  /** Divider color */
  DIVIDER: 'rgba(99, 102, 241, 0.2)', // indigo-500/20
} as const
