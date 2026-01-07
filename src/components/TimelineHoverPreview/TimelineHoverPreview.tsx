import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TimelineHoverContent } from './TimelineHoverContent'
import { useArtistMetadata } from './useArtistMetadata'
import { ANIMATION, LAYOUT, BREAKPOINTS, COLORS } from './constants'
import type { TimelineHoverPreviewProps } from './types'

/**
 * Main Timeline Hover Preview Component
 *
 * Displays a preview popup when hovering over timeline dots.
 * Handles positioning, animations, and responsive behavior.
 *
 * @param props - Component props
 * @returns React component
 */
export function TimelineHoverPreview({
  hoverState,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: TimelineHoverPreviewProps) {
  const { getArtistImage } = useArtistMetadata()

  // Check if viewport is mobile
  // Note: We now ENABLE popups on mobile for touch interactions (v1.7.9)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.MOBILE_MAX

  /**
   * Calculate popup position to keep it within viewport bounds
   * Returns position and whether popup should be above or below the dot
   */
  const position = useMemo(() => {
    if (!hoverState) return { x: 0, y: 0, isAbove: true }

    const { x, y } = hoverState.position
    let popupX = x - LAYOUT.WIDTH / 2

    // Estimate popup height (MIN_HEIGHT + content)
    const estimatedHeight = LAYOUT.MIN_HEIGHT + 20

    // On mobile, prefer showing above to avoid finger occlusion
    const preferAbove = isMobile

    // Determine if popup should be above or below
    const spaceAbove = y - LAYOUT.OFFSET_Y - LAYOUT.ARROW_SIZE
    const spaceBelow = window.innerHeight - y - LAYOUT.OFFSET_Y - LAYOUT.ARROW_SIZE
    const isAbove = preferAbove
      ? spaceAbove >= LAYOUT.MIN_HEIGHT // If mobile and enough space, always show above
      : spaceAbove >= estimatedHeight || spaceAbove > spaceBelow

    // Calculate vertical position with extra offset on mobile for finger clearance
    const mobileOffset = isMobile ? 60 : 0
    let popupY = isAbove
      ? y - LAYOUT.OFFSET_Y - LAYOUT.ARROW_SIZE - estimatedHeight - mobileOffset
      : y + LAYOUT.OFFSET_Y + LAYOUT.ARROW_SIZE

    // Keep within horizontal bounds
    const maxX = window.innerWidth - LAYOUT.WIDTH - LAYOUT.EDGE_MARGIN
    popupX = Math.max(LAYOUT.EDGE_MARGIN, Math.min(popupX, maxX))

    // Keep within vertical bounds
    if (isAbove) {
      popupY = Math.max(LAYOUT.EDGE_MARGIN, popupY)
    } else {
      const maxY = window.innerHeight - estimatedHeight - LAYOUT.EDGE_MARGIN
      popupY = Math.min(maxY, popupY)
    }

    return { x: popupX, y: popupY, isAbove }
  }, [hoverState, isMobile])

  if (!hoverState) {
    return null
  }

  const imageUrl = getArtistImage(hoverState.artistName)

  return (
    <AnimatePresence>
      {hoverState && (
        <motion.div
          key="timeline-hover-popup"
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{
            duration: ANIMATION.FADE_DURATION / 1000,
            ease: 'easeOut',
            layout: { duration: 0.2, ease: 'easeOut' },
            exit: { duration: 0.25, delay: 0.1, ease: 'easeOut' }, // Slight delay for elegance
          }}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            pointerEvents: 'auto',
            zIndex: 100,
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* Pointer Arrow */}
          <div
            style={{
              position: 'absolute',
              left: hoverState.position.x - position.x - LAYOUT.ARROW_SIZE,
              [position.isAbove ? 'bottom' : 'top']: -LAYOUT.ARROW_SIZE,
              width: 0,
              height: 0,
              borderLeft: `${LAYOUT.ARROW_SIZE}px solid transparent`,
              borderRight: `${LAYOUT.ARROW_SIZE}px solid transparent`,
              [position.isAbove ? 'borderTop' : 'borderBottom']: `${LAYOUT.ARROW_SIZE}px solid ${COLORS.POPUP_BG}`,
            }}
          />

          <TimelineHoverContent
            artistName={hoverState.artistName}
            year={hoverState.year}
            concertCount={hoverState.concertCount}
            venue={hoverState.venue}
            imageUrl={imageUrl}
            onClick={onClick ? () => onClick(hoverState.artistName) : undefined}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
