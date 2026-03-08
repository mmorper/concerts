/**
 * CategoryFilterChips — category filter grid for /liner-notes
 * Spec: docs/specs/future/mocks-agentic-liner-notes-v3/liner-notes-feed.html
 *
 * Equal-width 4-column grid (2-column on mobile).
 * Each chip has a colored dot + label. Active chip fills with category color.
 */

import { useState } from 'react'
import type { PostCategory } from '../../types/liner-notes'
import { CATEGORY_ACCENT_COLORS, CATEGORY_LABELS } from './constants'

type ActiveCategory = PostCategory | 'all'

const CHIP_ORDER: ActiveCategory[] = ['all', 'cultural', 'personal', 'deep-cut']
const ALL_COLOR = '#1f2937'

interface CategoryFilterChipsProps {
  active: ActiveCategory
  onChange: (cat: ActiveCategory) => void
}

interface ChipProps {
  label: string
  dotColor: string
  isActive: boolean
  activeColor: string
  onClick: () => void
}

function Chip({ label, dotColor, isActive, activeColor, onClick }: ChipProps) {
  const [hovered, setHovered] = useState(false)

  const bg = isActive ? activeColor : hovered ? '#f9fafb' : '#ffffff'
  const color = isActive ? '#ffffff' : hovered ? activeColor : '#6b7280'
  const borderColor = isActive ? 'transparent' : hovered ? activeColor : '#e5e7eb'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={isActive}
      className="font-sans font-semibold transition-colors flex items-center justify-center gap-2"
      style={{
        height: 40,
        borderRadius: 8,
        fontSize: 13,
        border: `1.5px solid ${borderColor}`,
        backgroundColor: bg,
        color,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: isActive ? 'rgba(255,255,255,0.6)' : dotColor,
        }}
      />
      {label}
    </button>
  )
}

export function CategoryFilterChips({ active, onChange }: CategoryFilterChipsProps) {
  return (
    <div>
      <p
        className="font-sans font-semibold uppercase"
        style={{ fontSize: 11, letterSpacing: '0.07em', color: '#9ca3af', marginBottom: 10 }}
      >
        Browse by
      </p>
      <div
        role="group"
        aria-label="Filter by category"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {CHIP_ORDER.map((id) => {
          const activeColor = id === 'all' ? ALL_COLOR : CATEGORY_ACCENT_COLORS[id as PostCategory]
          const dotColor = id === 'all' ? ALL_COLOR : CATEGORY_ACCENT_COLORS[id as PostCategory]
          const label = id === 'all' ? 'All' : CATEGORY_LABELS[id as PostCategory]

          return (
            <Chip
              key={id}
              label={label}
              dotColor={dotColor}
              isActive={active === id}
              activeColor={activeColor}
              onClick={() => onChange(id)}
            />
          )
        })}
      </div>
    </div>
  )
}
