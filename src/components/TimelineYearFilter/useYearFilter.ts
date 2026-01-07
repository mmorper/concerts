import { useState, useCallback, useEffect } from 'react'

/**
 * State for year filter feature
 */
export interface YearFilterState {
  /** Currently selected year (null if none selected) */
  selectedYear: number | null
  /** Whether the card stack is expanded */
  isExpanded: boolean
  /** Index of currently hovered card (null if none) */
  hoveredCardIndex: number | null
}

/**
 * Hook to manage year filter state for timeline
 *
 * Handles selection, expansion, and hover state for the year filter feature.
 * Only active on tablet+ devices (≥768px).
 *
 * @returns Object with filter state and control functions
 */
export function useYearFilter() {
  const [filterState, setFilterState] = useState<YearFilterState>({
    selectedYear: null,
    isExpanded: false,
    hoveredCardIndex: null,
  })

  // Track if device is tablet or larger
  const [isTabletOrLarger, setIsTabletOrLarger] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  )

  // Update on resize
  useEffect(() => {
    const handleResize = () => {
      const isLarge = window.innerWidth >= 768
      setIsTabletOrLarger(isLarge)

      // Close expanded state if resizing below tablet
      if (!isLarge && filterState.isExpanded) {
        setFilterState(prev => ({
          ...prev,
          isExpanded: false,
          selectedYear: null,
          hoveredCardIndex: null,
        }))
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [filterState.isExpanded])

  /**
   * Handle clicking a year dot
   * Toggles selection and expansion
   */
  const handleYearClick = useCallback((year: number) => {
    if (!isTabletOrLarger) {
      // Mobile: no-op, existing preview behavior continues
      return
    }

    setFilterState(prev => {
      // If clicking the same year, collapse
      if (prev.selectedYear === year && prev.isExpanded) {
        return {
          selectedYear: null,
          isExpanded: false,
          hoveredCardIndex: null,
        }
      }

      // Otherwise, select and expand
      return {
        selectedYear: year,
        isExpanded: true,
        hoveredCardIndex: null,
      }
    })
  }, [isTabletOrLarger])

  /**
   * Handle hovering over a card in the stack
   */
  const handleCardHover = useCallback((index: number | null) => {
    setFilterState(prev => ({
      ...prev,
      hoveredCardIndex: index,
    }))
  }, [])

  /**
   * Collapse the expanded state (close cards)
   */
  const collapse = useCallback(() => {
    setFilterState({
      selectedYear: null,
      isExpanded: false,
      hoveredCardIndex: null,
    })
  }, [])

  /**
   * Handle clicking outside the timeline area
   */
  const handleClickOutside = useCallback(() => {
    if (filterState.isExpanded) {
      collapse()
    }
  }, [filterState.isExpanded, collapse])

  // Add escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && filterState.isExpanded) {
        collapse()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [filterState.isExpanded, collapse])

  return {
    filterState,
    isTabletOrLarger,
    handleYearClick,
    handleCardHover,
    collapse,
    handleClickOutside,
  }
}
