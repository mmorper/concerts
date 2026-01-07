import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useArtistMetadata } from '../TimelineHoverPreview/useArtistMetadata'
import { FALLBACK, LAYOUT, COLORS } from '../TimelineHoverPreview/constants'
import type { StackedCardProps } from './types'

/**
 * Individual concert card in the stacked year filter display
 *
 * Matches TimelineHoverPreview styling exactly for visual consistency
 */
export function StackedCard({
  concert,
  stackPosition,
  totalCards: _totalCards, // unused but part of interface
  isHovered,
  initialX,
  offsetX,
  rotation = 0,
  cardIndex,
  isDragging: _isDragging, // unused - touch handling moved to parent
  onHover,
  onHoverEnd,
  onClick,
}: StackedCardProps) {
  const { getArtistImage } = useArtistMetadata()
  const imageUrl = getArtistImage(concert.headliner) || FALLBACK.IMAGE_URL

  // Detect if device supports touch (for conditional mouse handlers)
  const isTouchDevice = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  // Format date as "Month Day"
  const dateObj = new Date(concert.date)
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  // Note: Touch handling moved to parent container (YearCardStack)
  // to avoid event bubbling issues and allow proper drag detection

  /**
   * Handle regular click on non-touch devices (desktop)
   */
  const handleClick = useCallback((_e: React.MouseEvent) => {
    if (isTouchDevice) return // Touch devices use handleTouchEnd
    onClick()
  }, [isTouchDevice, onClick])

  /**
   * Handle hover end
   */
  const handleHoverEnd = useCallback(() => {
    onHoverEnd()
  }, [onHoverEnd])

  // Calculate z-index: hovered card goes to top, otherwise stack position
  const zIndex = isHovered ? 999 : stackPosition

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, x: initialX }}
      animate={{
        opacity: 1,
        scale: isHovered ? 1.05 : 1,
        x: offsetX,
        rotate: rotation,
      }}
      exit={{
        opacity: 0,
        scale: 0.9,
        x: initialX, // Collapse back to popup position
        rotate: 0, // Remove rotation
      }}
      transition={{
        duration: 0.3,
        delay: stackPosition * 0.05, // Stagger animation
        ease: [0.34, 1.56, 0.64, 1], // Spring easing
        layout: { duration: 0.15, ease: 'easeOut' },
        exit: { duration: 0.25, ease: 'easeInOut' }, // Smooth exit
      }}
      style={{
        position: 'absolute',
        width: LAYOUT.WIDTH, // Match popup width (220px)
        zIndex,
        cursor: 'pointer',
      }}
      onMouseEnter={isTouchDevice ? undefined : onHover}
      onMouseLeave={isTouchDevice ? undefined : handleHoverEnd}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onClick()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View ${concert.headliner} concert at ${concert.venue}`}
      data-card-index={cardIndex}
    >
      <div
        style={{
          width: LAYOUT.WIDTH,
          backgroundColor: COLORS.POPUP_BG,
          border: `1px solid ${COLORS.POPUP_BORDER}`,
          borderRadius: LAYOUT.BORDER_RADIUS,
          overflow: 'hidden',
          boxShadow: isHovered
            ? '0 12px 48px rgba(0, 0, 0, 0.5)' // Larger on hover
            : '0 10px 40px rgba(0, 0, 0, 0.4)', // Match popup shadow
          transition: 'box-shadow 150ms ease-out',
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
        }}
      >
        {/* Artist Image - same height as popup */}
        <div style={{ width: '100%', height: LAYOUT.IMAGE_HEIGHT, overflow: 'hidden' }}>
          <img
            src={imageUrl}
            alt={concert.headliner}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />
        </div>

        {/* Text Content - match popup exactly */}
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
            {concert.headliner}
          </div>

          {/* Line 2: Venue - match "at {venue}" format */}
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
            at {concert.venue}
          </div>

          {/* Divider */}
          <div
            style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: `1px solid ${COLORS.DIVIDER}`,
            }}
          >
            {/* Line 3: Date */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: COLORS.TEXT_ACCENT,
                lineHeight: 1.4,
              }}
            >
              {formattedDate}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
