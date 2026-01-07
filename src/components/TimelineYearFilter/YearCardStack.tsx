import { useEffect, useMemo, useRef, useState } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const lastHoveredRef = useRef<number | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const touchStartCardRef = useRef<number | null>(null)

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

  /**
   * Handle touch start - begin tracking drag and record start position
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    const touch = e.touches[0]

    // Record touch start position for tap detection
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }

    // Find which card is under the initial touch
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    const cardElement = element?.closest('[data-card-index]') as HTMLElement
    if (cardElement) {
      const index = parseInt(cardElement.dataset.cardIndex || '-1', 10)
      if (index >= 0) {
        touchStartCardRef.current = index
        lastHoveredRef.current = index
        onCardHover(index)
        // Don't set isDragging yet - wait for touchmove to confirm drag
      }
    }
  }

  /**
   * Handle touch move - update focus as finger drags across cards
   */
  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation()

    // Detect if user has moved significantly (indicates drag, not tap)
    if (!isDragging && touchStartPosRef.current) {
      const touch = e.touches[0]
      const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
      const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)
      const DRAG_THRESHOLD = 10 // pixels

      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        console.log('[YearCardStack] Movement detected, setting isDragging=true')
        setIsDragging(true)
        haptics.light()
      }
    }

    const touch = e.touches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    const cardElement = element?.closest('[data-card-index]') as HTMLElement

    if (cardElement) {
      const index = parseInt(cardElement.dataset.cardIndex || '-1', 10)
      if (index >= 0 && index !== lastHoveredRef.current) {
        lastHoveredRef.current = index
        onCardHover(index)
        if (isDragging) {
          haptics.light()
        }
      }
    }
  }

  /**
   * Handle touch end - detect tap vs drag and handle navigation
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation()

    const wasDragging = isDragging
    const touchStartCard = touchStartCardRef.current
    const touchEndCard = lastHoveredRef.current

    console.log('[YearCardStack] handleTouchEnd', {
      wasDragging,
      touchStartCard,
      touchEndCard,
    })

    if (wasDragging) {
      // User was dragging - just end drag state
      console.log('[YearCardStack] Was dragging, ending drag state')
      setIsDragging(false)
      // Keep last hovered card focused for next tap
    } else {
      // User tapped without dragging - navigate if tapping focused card
      console.log('[YearCardStack] Was tap, checking if should navigate')
      if (touchStartCard !== null && touchStartCard === touchEndCard && touchEndCard === hoveredCardIndex) {
        // Tapped the currently focused/hovered card - navigate
        const concert = visibleConcerts[touchStartCard]
        if (concert) {
          console.log('[YearCardStack] Navigating to', concert.headliner)
          onCardClick(concert)
          haptics.medium()
        }
      } else {
        // First tap on this card - just focus it
        console.log('[YearCardStack] First tap, focusing card')
        haptics.light()
      }
    }

    // Reset touch tracking
    touchStartPosRef.current = null
    touchStartCardRef.current = null
  }

  // Trigger haptic when cards first appear
  useEffect(() => {
    haptics.light()
  }, [])

  return (
    <div
      ref={containerRef}
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
            cardIndex={index}
            isDragging={isDragging}
            onHover={() => {
              onCardHover(index)
              haptics.light()
            }}
            onHoverEnd={() => onCardHover(null)}
            onClick={() => onCardClick(concert)}
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
