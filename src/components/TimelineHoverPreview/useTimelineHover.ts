import { useState, useCallback, useRef, useEffect } from 'react'
import type { TimelineHoverState } from './types'
import { ANIMATION } from './constants'

/**
 * Hook to manage timeline hover state with delays and transitions
 *
 * Handles the logic for showing/hiding the preview popup with appropriate
 * delays for hover entry (120ms), exit (300ms linger), and content crossfade.
 *
 * @returns Object with hover state and control functions
 */
export function useTimelineHover() {
  const [hoverState, setHoverState] = useState<TimelineHoverState | null>(null)
  const hoverTimeoutRef = useRef<number | null>(null)
  const lingerTimeoutRef = useRef<number | null>(null)
  const isHoveringRef = useRef(false)

  /**
   * Clear all active timeouts
   */
  const clearTimeouts = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (lingerTimeoutRef.current) {
      clearTimeout(lingerTimeoutRef.current)
      lingerTimeoutRef.current = null
    }
  }, [])

  /**
   * Handle mouse entering a timeline dot
   *
   * @param artistName - Name of the artist
   * @param year - Concert year
   * @param concertCount - Number of concerts that year
   * @param position - Screen position of the dot {x, y}
   */
  const handleMouseEnter = useCallback((
    artistName: string,
    year: number,
    concertCount: number,
    position: { x: number; y: number }
  ) => {
    clearTimeouts()
    isHoveringRef.current = true

    // Wait 120ms before showing popup
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoverState({
        artistName,
        year,
        concertCount,
        position,
        isHovering: true,
      })
    }, ANIMATION.HOVER_DELAY)
  }, [clearTimeouts])

  /**
   * Handle mouse leaving a timeline dot
   *
   * Waits 300ms before hiding to allow mouse movement to popup
   */
  const handleMouseLeave = useCallback(() => {
    clearTimeouts()
    isHoveringRef.current = false

    // Wait 300ms before hiding (linger delay)
    lingerTimeoutRef.current = window.setTimeout(() => {
      if (!isHoveringRef.current) {
        setHoverState(null)
      }
    }, ANIMATION.LINGER_DELAY)
  }, [clearTimeouts])

  /**
   * Handle mouse entering the popup itself
   *
   * Cancels the linger timeout to keep popup visible
   */
  const handlePopupMouseEnter = useCallback(() => {
    clearTimeouts()
    isHoveringRef.current = true
  }, [clearTimeouts])

  /**
   * Handle mouse leaving the popup
   *
   * Immediately hides the popup
   */
  const handlePopupMouseLeave = useCallback(() => {
    clearTimeouts()
    isHoveringRef.current = false
    setHoverState(null)
  }, [clearTimeouts])

  /**
   * Update position of existing hover state
   * Used when moving between dots without full re-hover
   */
  const updatePosition = useCallback((position: { x: number; y: number }) => {
    setHoverState(prev => prev ? { ...prev, position } : null)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearTimeouts()
    }
  }, [clearTimeouts])

  return {
    hoverState,
    handleMouseEnter,
    handleMouseLeave,
    handlePopupMouseEnter,
    handlePopupMouseLeave,
    updatePosition,
  }
}
