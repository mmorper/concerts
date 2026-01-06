/**
 * useTourDates Hook - Eager loading of tour dates for Artist Gatefold
 *
 * Automatically fetches tour dates when artist prop changes
 * Returns loading state, tour data, and error information
 * Used by ConcertHistoryPanel to show tour badge
 */

import { useState, useEffect, useRef } from 'react'
import { fetchTourDates } from '../services/ticketmaster'
import type { TourEvent } from '../types/tourDates'

export interface UseTourDatesResult {
  tourDates: TourEvent[] | null
  tourCount: number
  isLoading: boolean
  error: string | null
  cached: boolean
  refetch: () => void
}

export interface UseTourDatesOptions {
  /**
   * Delay before fetching (ms)
   * Default: 50ms (gives gatefold animation time to settle)
   */
  delay?: number

  /**
   * Enable automatic fetching
   * Default: true
   */
  enabled?: boolean
}

/**
 * Hook for eager loading of tour dates
 *
 * @param artistName - Artist name to fetch tours for
 * @param options - Optional configuration
 * @returns Tour dates result with loading/error states
 *
 * @example
 * const { tourDates, tourCount, isLoading } = useTourDates('The National')
 *
 * if (tourCount > 0) {
 *   return <TourBadge count={tourCount} onClick={handleClick} />
 * }
 */
export function useTourDates(
  artistName: string | null,
  options: UseTourDatesOptions = {}
): UseTourDatesResult {
  const { delay = 50, enabled = true } = options

  const [tourDates, setTourDates] = useState<TourEvent[] | null>(null)
  const [tourCount, setTourCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  // Track abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch function (can be called manually via refetch)
  const fetchData = async () => {
    if (!artistName || !enabled) {
      return
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      // Optional delay to let gatefold animation settle
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      const result = await fetchTourDates(artistName)

      // Check if request was aborted
      if (abortControllerRef.current.signal.aborted) {
        return
      }

      setTourDates(result.events)
      setTourCount(result.count)
      setCached(result.cached)
      setError(null)
    } catch (err) {
      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      // Set error state (but don't throw - fail silently)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tour dates'
      setError(errorMessage)
      setTourDates(null)
      setTourCount(0)
      setCached(false)

      // Log to console for debugging
      console.error('Tour dates fetch error:', errorMessage)
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false)
      }
    }
  }

  // Effect: Fetch when artist changes
  useEffect(() => {
    // Reset state when artist changes
    setTourDates(null)
    setTourCount(0)
    setError(null)
    setCached(false)

    if (artistName && enabled) {
      fetchData()
    }

    // Cleanup: Abort any in-flight requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [artistName, enabled])

  return {
    tourDates,
    tourCount,
    isLoading,
    error,
    cached,
    refetch: fetchData
  }
}
