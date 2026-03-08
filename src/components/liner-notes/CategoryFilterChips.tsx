/**
 * CategoryFilterChips — category filter pill row for /liner-notes
 * Spec: docs/specs/future/liner-notes-design-mocks.md
 */

import type { PostCategory } from '../../types/liner-notes'
import { CATEGORY_ACCENT_COLORS, CATEGORY_LABELS } from './constants'

type ActiveCategory = PostCategory | 'all'

const CHIP_ORDER: ActiveCategory[] = ['all', 'cultural', 'personal', 'deep-cut']

interface CategoryFilterChipsProps {
  active: ActiveCategory
  onChange: (cat: ActiveCategory) => void
}

export function CategoryFilterChips({ active, onChange }: CategoryFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      {CHIP_ORDER.map((id) => {
        const isActive = active === id
        const color = id === 'all' ? '#374151' : CATEGORY_ACCENT_COLORS[id as PostCategory]
        const label = id === 'all' ? 'All' : CATEGORY_LABELS[id as PostCategory]

        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="font-sans text-sm font-medium rounded-full px-3 transition-colors"
            style={{
              height: '36px',
              minHeight: '44px',
              backgroundColor: isActive ? color : '#ffffff',
              color: isActive ? '#ffffff' : '#374151',
              border: isActive ? 'none' : '1px solid #d1d5db',
            }}
            aria-pressed={isActive}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
