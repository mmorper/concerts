/**
 * Changelog Feature - Constants
 *
 * Centralized configuration for colors, layout, animations, and scene mapping
 */

/**
 * Toast notification configuration
 */
export const TOAST = {
  /** Toast width in pixels */
  WIDTH: 450,

  /** Minimum toast height */
  MIN_HEIGHT: 120,

  /** Maximum toast height */
  MAX_HEIGHT: 180,

  /** Distance from bottom of viewport */
  BOTTOM_OFFSET: 80,

  /** Z-index (above all other elements) */
  Z_INDEX: 9999,

  /** Slide animation duration (ms) */
  SLIDE_DURATION: 500,

  /** Auto-dismiss duration (ms) */
  AUTO_DISMISS_DURATION: 10000, // 10 seconds

  /** Initial delay before showing toast (ms) */
  INITIAL_DELAY: 2000, // 2 seconds

  /** Background color (black with 90% opacity) */
  BG_COLOR: 'rgba(0, 0, 0, 0.90)',

  /** Border color (amber-600) */
  BORDER_COLOR: '#d97706',

  /** Primary text color */
  TEXT_PRIMARY: '#ffffff',

  /** Accent text color (amber-400) */
  TEXT_ACCENT: '#fbbf24',

  /** Button background color */
  BUTTON_BG: '#d97706',

  /** Button hover background color */
  BUTTON_HOVER: '#f59e0b',
} as const

/**
 * Layout configuration
 */
export const LAYOUT = {
  /** Card padding in pixels */
  CARD_PADDING: 32,

  /** Card border radius in pixels */
  CARD_BORDER_RADIUS: 16,

  /** Gap between cards in pixels */
  CARD_GAP: 32,

  /** Maximum content width in pixels */
  MAX_WIDTH: 1200,
} as const

/**
 * Color palette (concert poster theme)
 */
export const COLORS = {
  /** Primary background (pure black) */
  BG_PRIMARY: '#000000',

  /** Card background (very dark gray) */
  BG_CARD: '#0a0a0a',

  /** Primary text color (white) */
  TEXT_PRIMARY: '#ffffff',

  /** Secondary text color (slate-400) */
  TEXT_SECONDARY: '#94a3b8',

  /** Default border color (slate-700) */
  BORDER_DEFAULT: '#334155',

  /** Hover border color (amber-500) */
  BORDER_HOVER: '#f59e0b',

  /** Primary accent color (amber-600) */
  ACCENT_PRIMARY: '#d97706',

  /** Secondary accent color (amber-400) */
  ACCENT_SECONDARY: '#fbbf24',
} as const

/**
 * Animation configuration
 */
export const ANIMATION = {
  /** Slide animation duration (ms) */
  SLIDE_DURATION: 500,

  /** Fade animation duration (ms) */
  FADE_DURATION: 300,

  /** Hover animation duration (ms) */
  HOVER_DURATION: 200,

  /** Stagger delay between cards (ms) */
  STAGGER_DELAY: 100,
} as const

/**
 * Scene name to scene number mapping
 * Used for deep linking: /?scene=timeline
 */
export const SCENE_MAP: Record<string, number> = {
  timeline: 1,
  venues: 2,
  geography: 3,
  genres: 4,
  artists: 5,
}

/**
 * Scene names array (index 0 = scene 1)
 */
export const SCENE_NAMES = ['timeline', 'venues', 'geography', 'genres', 'artists']

/**
 * Get scene number from scene name
 */
export function getSceneNumber(sceneName: string): number | null {
  return SCENE_MAP[sceneName] || null
}

/**
 * Get scene name from scene number (1-5)
 */
export function getSceneName(sceneNumber: number): string | null {
  return SCENE_NAMES[sceneNumber - 1] || null
}

/**
 * Generate deep link URL for a scene number
 */
export function generateDeepLink(sceneNumber: number): string {
  const sceneName = getSceneName(sceneNumber)
  return sceneName ? `/?scene=${sceneName}` : '/'
}

/**
 * localStorage keys
 */
export const STORAGE_KEYS = {
  /** Last seen changelog timestamp (localStorage) */
  LAST_SEEN: 'morperhaus_changelog_lastSeen',

  /** Dismissed versions in session (sessionStorage) */
  DISMISSED_SESSION: 'morperhaus_changelog_dismissedSession',
} as const
