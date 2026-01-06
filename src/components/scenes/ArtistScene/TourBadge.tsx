/**
 * TourBadge - Displays "ON TOUR" badge in Concert History Panel
 *
 * Only visible when artist has upcoming tour dates
 * Features pulsing green dot animation (Spotify green)
 * Clickable to open/close tour dates panel
 */

import { useState, useEffect } from 'react'
import { haptics } from '../../../utils/haptics'

export interface TourBadgeProps {
  /** Number of upcoming tour dates */
  tourCount: number
  /** Whether tour panel is currently open */
  isActive?: boolean
  /** Click handler */
  onClick: () => void
  /** Whether badge should be visible (fades in when true) */
  show?: boolean
}

/**
 * Tour Badge Component
 * Shows pulsing "ON TOUR · X dates" badge
 */
export function TourBadge({ tourCount, onClick, show = true }: TourBadgeProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Fade in animation when show prop changes
  useEffect(() => {
    if (show) {
      // Small delay for smooth fade-in
      const timer = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [show])

  const handleClick = () => {
    haptics.light()
    onClick()
  }

  // Don't render if no tour dates
  if (tourCount === 0) {
    return null
  }

  return (
    <button
      onClick={handleClick}
      className={`
        tour-badge
        inline-flex items-center gap-1.5
        px-3 py-1.5
        bg-[rgba(29,185,84,0.15)] hover:bg-[rgba(29,185,84,0.25)]
        border border-[rgba(29,185,84,0.3)] hover:border-[rgba(29,185,84,0.5)]
        rounded-xl
        font-sans text-xs font-semibold text-[#1DB954]
        uppercase tracking-wider
        cursor-pointer
        transition-all duration-150 ease-out
        hover:scale-[1.02]
        touchable-subtle
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        ${!isVisible ? 'pointer-events-none' : ''}
      `}
      style={{
        transitionProperty: 'opacity, transform, background-color, border-color',
        transitionDuration: isVisible ? '200ms' : '150ms',
      }}
      aria-label={`View ${tourCount} upcoming ${tourCount === 1 ? 'show' : 'shows'}`}
      type="button"
    >
      {/* Pulsing dot */}
      <span
        className="w-1.5 h-1.5 bg-[#1DB954] rounded-full animate-pulse-dot"
        aria-hidden="true"
      />

      {/* Label */}
      <span>
        ON TOUR · {tourCount} {tourCount === 1 ? 'date' : 'dates'}
      </span>
    </button>
  )
}
