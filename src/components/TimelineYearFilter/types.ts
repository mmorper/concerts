/**
 * Timeline Year Filter Types
 *
 * Type definitions for the year filter feature
 */

import type { Concert } from '../../types/concert'

/**
 * Props for YearCardStack component
 */
export interface YearCardStackProps {
  /** Year being displayed */
  year: number
  /** All concerts for this year (excluding first one shown in popup) */
  concerts: Concert[]
  /** Position of the popup on screen (for relative positioning) */
  popupPosition: { x: number; y: number; width: number }
  /** Currently hovered card index */
  hoveredCardIndex: number | null
  /** Callback when a card is hovered */
  onCardHover: (index: number | null) => void
  /** Callback when a card is clicked (navigate to artist) */
  onCardClick: (concert: Concert) => void
  /** Callback when clicking outside to dismiss */
  onDismiss: () => void
  /** Callback when mouse enters card stack (keeps hover state alive) */
  onMouseEnter?: () => void
  /** Callback when mouse leaves card stack */
  onMouseLeave?: () => void
}

/**
 * Props for StackedCard component
 */
export interface StackedCardProps {
  /** Concert data */
  concert: Concert
  /** Position in the stack (for z-index) */
  stackPosition: number
  /** Total number of cards in stack */
  totalCards: number
  /** Whether this card is currently hovered */
  isHovered: boolean
  /** Initial X position (where popup is) */
  initialX: number
  /** Horizontal offset for fan layout */
  offsetX: number
  /** Optional rotation for organic feel */
  rotation?: number
  /** Callback when card is hovered */
  onHover: () => void
  /** Callback when hover ends */
  onHoverEnd: () => void
  /** Callback when card is clicked */
  onClick: () => void
}

/**
 * Props for CardCountBadge component
 */
export interface CardCountBadgeProps {
  /** Number of concerts */
  count: number
}
