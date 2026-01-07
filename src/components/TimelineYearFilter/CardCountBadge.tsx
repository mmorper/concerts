import type { CardCountBadgeProps } from './types'

/**
 * Badge showing concert count for years with 6+ concerts
 *
 * Displays in pill format at top-right of card stack
 */
export function CardCountBadge({ count }: CardCountBadgeProps) {
  const text = count === 1 ? '1 show' : `${count} shows`

  return (
    <div
      className="absolute top-2 right-2 z-50"
      style={{
        backgroundColor: 'white',
        color: '#1e293b', // slate-800
        fontSize: '12px',
        fontWeight: 600,
        padding: '4px 8px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  )
}
