import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { PARALLAX, LAYOUT, FALLBACK, COLORS } from './constants'
import type { TimelineHoverContentProps } from './types'

/**
 * Content component for the timeline hover preview
 *
 * Displays artist photo, artist name, venue, year, and concert count
 * with a clean card-based layout and parallax effect.
 *
 * @param props - Component props
 * @returns React component
 */
export function TimelineHoverContent({
  artistName,
  year,
  concertCount,
  venue,
  imageUrl,
  onClick,
}: TimelineHoverContentProps) {
  const [localMousePosition, setLocalMousePosition] = useState({ x: 0, y: 0 })

  /**
   * Track mouse position relative to the image for parallax effect
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!PARALLAX.ENABLED) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2

    setLocalMousePosition({ x, y })
  }, [])

  // Calculate parallax offsets
  const parallaxX = PARALLAX.ENABLED
    ? (localMousePosition.x / (LAYOUT.WIDTH / 2)) * PARALLAX.MAX_SHIFT_X
    : 0
  const parallaxY = PARALLAX.ENABLED
    ? (localMousePosition.y / (LAYOUT.IMAGE_HEIGHT / 2)) * PARALLAX.MAX_SHIFT_Y
    : 0

  // Use fallback image if no artist image available
  const displayImageUrl = imageUrl || FALLBACK.IMAGE_URL

  // Format concert count text
  const countText = concertCount === 1
    ? '1 concert'
    : `one of ${concertCount} concerts`

  return (
    <div
      style={{
        width: LAYOUT.WIDTH,
        minHeight: LAYOUT.MIN_HEIGHT,
        backgroundColor: COLORS.POPUP_BG,
        border: `1px solid ${COLORS.POPUP_BORDER}`,
        borderRadius: LAYOUT.BORDER_RADIUS,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) {
          onClick()
        }
      }}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `View ${artistName} concert details` : undefined}
    >
      {/* Artist Image with Parallax */}
      <div
        style={{
          width: '100%',
          height: LAYOUT.IMAGE_HEIGHT,
          overflow: 'hidden',
          position: 'relative',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setLocalMousePosition({ x: 0, y: 0 })}
      >
        <motion.img
          src={displayImageUrl}
          alt={artistName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transform: 'scale(1.1)', // Slightly larger for parallax without exposing edges
          }}
          animate={{
            x: parallaxX,
            y: parallaxY,
          }}
          transition={{
            duration: PARALLAX.ENABLED ? 0.2 : 0,
            ease: 'easeOut',
          }}
        />
      </div>

      {/* Text Content */}
      <div style={{ padding: `${LAYOUT.PADDING}px` }}>
        {/* Line 1: Artist Name */}
        <div
          style={{
            fontSize: '17px',
            fontWeight: 600,
            color: COLORS.TEXT_PRIMARY,
            lineHeight: 1.3,
            marginBottom: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {artistName}
        </div>

        {/* Line 2: Venue */}
        <div
          style={{
            fontSize: '14px',
            fontWeight: 400,
            color: COLORS.TEXT_SECONDARY,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          at {venue}
        </div>

        {/* Divider */}
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: `1px solid ${COLORS.DIVIDER}`,
          }}
        >
          {/* Line 3: Year · Count */}
          <div
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: COLORS.TEXT_ACCENT,
              lineHeight: 1.4,
            }}
          >
            {year} · {countText}
          </div>
        </div>
      </div>
    </div>
  )
}
