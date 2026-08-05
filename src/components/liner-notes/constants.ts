import type React from 'react'
import type { PostCategory } from '../../types/liner-notes'

/** Category accent colors per spec */
export const CATEGORY_ACCENT_COLORS: Record<PostCategory, string> = {
  cultural: '#1e3a8a',   // The Scene — New Wave blue
  personal: '#5b21b6',   // I Was There — Alternative violet
  'deep-cut': '#0e7490', // Deep Cuts — darker teal for legibility
}

/**
 * Shown when a post's image URL fails to load.
 *
 * The pipeline re-resolves and repairs post images on every run, but a
 * third-party URL can be revoked between runs, so the UI needs its own net —
 * otherwise a revoked image renders as a broken-image box (#252).
 */
export const IMAGE_FALLBACK_SRC = '/images/venues/fallback-active.jpg'

/** Swap in the fallback once; `onerror = null` stops a loop if it 404s too. */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.src.endsWith(IMAGE_FALLBACK_SRC)) return
  img.onerror = null
  img.src = IMAGE_FALLBACK_SRC
}

/** Display labels for each category */
export const CATEGORY_LABELS: Record<PostCategory, string> = {
  cultural: 'The Scene',
  personal: 'I Was There',
  'deep-cut': 'Deep Cuts',
}
