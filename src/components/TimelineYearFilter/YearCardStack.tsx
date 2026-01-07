import { useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { StackedCard } from './StackedCard'
import { CardCountBadge } from './CardCountBadge'
import { haptics } from '../../utils/haptics'
import type { YearCardStackProps } from './types'

/**
 * Container for stacked concert cards for a selected year
 *
 * Positions cards to fan out beside the popup (left or right based on space)
 */
export function YearCardStack({
  year: _year, // unused but part of interface
  concerts,
  popupPosition,
  hoveredCardIndex,
  onCardHover,
  onCardClick,
  onDismiss: _onDismiss, // handled by click outside in parent
  onMouseEnter,
  onMouseLeave,
}: YearCardStackProps) {
  const concertCount = concerts.length

  // If no concerts (shouldn't happen, but safety check), don't render
  if (concertCount === 0) return null

  // Calculate card layout and positioning
  const layout = useMemo(() => {
    const cardWidth = 180
    const cardGap = 12 // Gap between popup and first card
    const maxVisibleCards = Math.min(concertCount, 8) // Cap at 8 visible cards

    // Determine offset based on count (2x spacing for better visibility)
    let offsetPerCard = 0
    if (concertCount === 1) {
      offsetPerCard = 0 // Single card
    } else if (concertCount === 2) {
      offsetPerCard = cardWidth + 16 // Gap between cards
    } else if (concertCount >= 3 && concertCount <= 5) {
      offsetPerCard = 60 // Moderate overlap (2x from 30)
    } else if (concertCount >= 6) {
      offsetPerCard = 40 // Tighter overlap (2x from 20)
    }

    // Total width needed for card stack
    const stackWidth = concertCount === 1
      ? cardWidth
      : cardWidth + (maxVisibleCards - 1) * offsetPerCard

    // Determine if we should fan left or right
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const edgeMargin = 32

    // Calculate available space on left and right of popup
    const spaceOnLeft = popupPosition.x - edgeMargin
    const spaceOnRight = viewportWidth - (popupPosition.x + popupPosition.width) - edgeMargin

    // Prefer fanning to the left (default), but use right if insufficient space
    const fanToLeft = spaceOnLeft >= stackWidth + cardGap || spaceOnLeft > spaceOnRight

    // Calculate stack position
    let stackLeft: number
    if (fanToLeft) {
      // Position to the left of popup
      stackLeft = popupPosition.x - stackWidth - cardGap
      // Ensure not too close to left edge
      if (stackLeft < edgeMargin) {
        stackLeft = edgeMargin
      }
    } else {
      // Position to the right of popup
      stackLeft = popupPosition.x + popupPosition.width + cardGap
      // Ensure not too close to right edge
      if (stackLeft + stackWidth > viewportWidth - edgeMargin) {
        stackLeft = viewportWidth - stackWidth - edgeMargin
      }
    }

    // Vertical position: align with popup top (pleasing alignment)
    const stackTop = popupPosition.y

    // Calculate where popup center is relative to stack left edge
    // This is where all cards should start (to fan out from popup)
    const popupCenterRelativeToStack = fanToLeft
      ? stackWidth + cardGap + (popupPosition.width / 2) // Popup is to the right
      : -(cardGap + popupPosition.width / 2) // Popup is to the left

    return {
      stackLeft,
      stackTop,
      stackWidth,
      offsetPerCard,
      maxVisibleCards,
      fanToLeft,
      initialX: popupCenterRelativeToStack - (cardWidth / 2), // Center the card on popup center
    }
  }, [popupPosition, concertCount])

  // Prepare visible concerts (limit to 8)
  const visibleConcerts = useMemo(() => {
    return concerts.slice(0, layout.maxVisibleCards)
  }, [concerts, layout.maxVisibleCards])

  // Subtle rotation for organic feel
  const getRotation = (index: number, total: number) => {
    if (total === 1) return 0
    // Very subtle rotation: -1° to +1°
    const range = 2
    const step = range / (total - 1)
    return -1 + index * step
  }

  // Stop event propagation on container to prevent dismiss
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Trigger haptic when cards first appear
  useEffect(() => {
    haptics.light()
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        left: layout.stackLeft,
        top: layout.stackTop,
        width: layout.stackWidth,
        height: '240px', // Approximate card height
        zIndex: 99, // Below popup (which is 100)
        pointerEvents: 'auto',
      }}
      onClick={handleContainerClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Show badge for 6+ concerts */}
      {concertCount >= 6 && <CardCountBadge count={concertCount + 1} />}

      {/* Render stacked cards */}
      <AnimatePresence>
        {visibleConcerts.map((concert, index) => (
          <StackedCard
            key={concert.id}
            concert={concert}
            stackPosition={index}
            totalCards={visibleConcerts.length}
            isHovered={hoveredCardIndex === index}
            initialX={layout.initialX}
            offsetX={index * layout.offsetPerCard}
            rotation={getRotation(index, visibleConcerts.length)}
            onHover={() => {
              onCardHover(index)
              haptics.light()
            }}
            onHoverEnd={() => onCardHover(null)}
            onClick={() => {
              haptics.light()
              onCardClick(concert)
            }}
          />
        ))}
      </AnimatePresence>

      {/* Show "+N more" indicator if needed */}
      {concertCount > layout.maxVisibleCards && (
        <div
          style={{
            position: 'absolute',
            bottom: '-24px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '12px',
            fontWeight: 500,
            color: '#94a3b8',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          +{concertCount - layout.maxVisibleCards} more
        </div>
      )}
    </div>
  )
}
