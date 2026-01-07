import { useState, useCallback, useEffect, useRef } from 'react'

interface UseTimelineAnimationOptions {
  startYear: number
  endYear: number
  onYearChange: (year: number) => void
  onComplete: () => void
  /** Milliseconds per year (default: 120ms = ~2.5 years/second) */
  msPerYear?: number
  /** Initial delay before starting animation (default: 500ms) */
  initialDelay?: number
}

interface UseTimelineAnimationReturn {
  isPlaying: boolean
  play: () => void
  pause: () => void
  reset: () => void
}

/**
 * Hook for managing timeline auto-play animation
 *
 * Animates from startYear to endYear at a configurable rate,
 * with support for pause/resume and reset functionality.
 */
export function useTimelineAnimation({
  startYear,
  endYear,
  onYearChange,
  onComplete,
  msPerYear = 120,
  initialDelay = 500,
}: UseTimelineAnimationOptions): UseTimelineAnimationReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const animationRef = useRef<number | null>(null)
  const lastFrameTime = useRef(0)
  const currentYearRef = useRef(startYear)
  const hasStarted = useRef(false)

  const play = useCallback(() => {
    if (!hasStarted.current) {
      hasStarted.current = true
      // Initial delay before starting
      setTimeout(() => {
        setIsPlaying(true)
        lastFrameTime.current = 0
      }, initialDelay)
    } else {
      setIsPlaying(true)
      lastFrameTime.current = 0
    }
  }, [initialDelay])

  const pause = useCallback(() => {
    setIsPlaying(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    pause()
    currentYearRef.current = startYear
    onYearChange(startYear)
    hasStarted.current = false
  }, [pause, startYear, onYearChange])

  useEffect(() => {
    if (!isPlaying) return

    const animate = (timestamp: number) => {
      if (!lastFrameTime.current) {
        lastFrameTime.current = timestamp
      }

      const elapsed = timestamp - lastFrameTime.current

      // Advance based on msPerYear
      if (elapsed >= msPerYear) {
        lastFrameTime.current = timestamp

        currentYearRef.current += 1

        if (currentYearRef.current >= endYear) {
          currentYearRef.current = endYear
          onYearChange(endYear)
          setIsPlaying(false)
          onComplete()
          return
        }

        onYearChange(currentYearRef.current)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [isPlaying, endYear, msPerYear, onYearChange, onComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return { isPlaying, play, pause, reset }
}
