import type { PostCategory } from '../../types/liner-notes'

/** Category accent colors per spec */
export const CATEGORY_ACCENT_COLORS: Record<PostCategory, string> = {
  cultural: '#1e3a8a',   // New Wave blue
  personal: '#5b21b6',   // Alternative violet
  'deep-cut': '#06b6d4', // Electronic cyan
}

/** Display labels for each category */
export const CATEGORY_LABELS: Record<PostCategory, string> = {
  cultural: 'Cultural Context',
  personal: 'Personal Connection',
  'deep-cut': 'Deep-Cut',
}
