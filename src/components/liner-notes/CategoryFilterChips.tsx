/**
 * CategoryFilterChips — horizontal category filter pills for /liner-notes
 * Matches the app's compact pill pattern (cf. ArtistSearchTypeahead, TourBadge).
 */

import type { PostCategory } from '../../types/liner-notes'
import { CATEGORY_ACCENT_COLORS, CATEGORY_LABELS } from './constants'

type ActiveCategory = PostCategory | 'all'

const CHIP_ORDER: ActiveCategory[] = ['all', 'cultural', 'personal', 'deep-cut']
const ALL_COLOR = '#1f2937'

interface CategoryFilterChipsProps {
  active: ActiveCategory
  onChange: (cat: ActiveCategory) => void
}

export function CategoryFilterChips({ active, onChange }: CategoryFilterChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by category">
      {CHIP_ORDER.map((id) => {
        const isActive = active === id
        const color = id === 'all' ? ALL_COLOR : CATEGORY_ACCENT_COLORS[id as PostCategory]
        const label = id === 'all' ? 'All' : CATEGORY_LABELS[id as PostCategory]

        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={isActive}
            className="font-sans font-semibold rounded-full transition-colors"
            style={{
              fontSize: 12,
              padding: '4px 12px',
              minHeight: 28,
              backgroundColor: isActive ? color : 'transparent',
              color: isActive ? '#ffffff' : '#6b7280',
              border: `1.5px solid ${isActive ? color : '#d1d5db'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
