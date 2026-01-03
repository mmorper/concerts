/**
 * Timeline Hover Preview Types
 *
 * Type definitions for the timeline hover preview feature
 */

/**
 * Artist metadata from artists-metadata.json
 */
export interface ArtistMetadata {
  name: string
  normalizedName: string
  image?: string
  fetchedAt: string
  dataSource: 'mock' | 'spotify' | 'theaudiodb'
}

/**
 * Hover state for a timeline dot
 */
export interface TimelineHoverState {
  artistName: string
  year: number
  concertCount: number
  venue: string
  position: { x: number; y: number }
  isHovering: boolean
}

/**
 * Props for TimelineHoverPreview component
 */
export interface TimelineHoverPreviewProps {
  hoverState: TimelineHoverState | null
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

/**
 * Props for TimelineHoverContent component
 */
export interface TimelineHoverContentProps {
  artistName: string
  year: number
  concertCount: number
  venue: string
  imageUrl?: string
}
