/**
 * TagFilterRow — secondary tag filter row for /liner-notes
 * Horizontal scroll on mobile, wraps on desktop
 * Spec: docs/specs/future/liner-notes-design-mocks.md
 */

interface TagFilterRowProps {
  tags: string[]
  activeTag: string | null
  onTagClick: (tag: string) => void
}

export function TagFilterRow({ tags, activeTag, onTagClick }: TagFilterRowProps) {
  if (tags.length === 0) return null

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      role="group"
      aria-label="Filter by tag"
    >
      {tags.map((tag) => {
        const isActive = activeTag === tag
        return (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="flex-shrink-0 font-sans text-xs font-medium rounded-full transition-colors"
            style={{
              padding: '2px 8px',
              minHeight: '44px',
              backgroundColor: isActive ? '#e0e7ff' : '#f3f4f6',
              color: isActive ? '#4338ca' : '#9ca3af',
            }}
            aria-pressed={isActive}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}
