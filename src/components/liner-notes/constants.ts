import type { PostCategory } from '../../types/liner-notes'

/** Category accent colors per spec */
export const CATEGORY_ACCENT_COLORS: Record<PostCategory, string> = {
  cultural: '#1e3a8a',   // The Scene — New Wave blue
  personal: '#5b21b6',   // I Was There — Alternative violet
  'deep-cut': '#0e7490', // Deep Cuts — darker teal for legibility
}

/** Display labels for each category */
export const CATEGORY_LABELS: Record<PostCategory, string> = {
  cultural: 'The Scene',
  personal: 'I Was There',
  'deep-cut': 'Deep Cuts',
}
