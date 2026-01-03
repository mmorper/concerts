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
  WIDTH: 320,

  /** Popup height in pixels */
  HEIGHT: 180,

  /** Distance from cursor/dot in pixels */
  OFFSET_Y: -20,

  /** Minimum distance from viewport edge in pixels */
  EDGE_MARGIN: 16,
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
  /** Gradient colors for when no artist image is available */
  GRADIENT_START: '#6366f1', // indigo-500
  GRADIENT_END: '#a5b4fc', // indigo-300
} as const
