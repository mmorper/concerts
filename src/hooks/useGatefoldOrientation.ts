import { useState, useEffect } from 'react'

interface GatefoldOrientation {
  isPhone: boolean
  dimensions: { width: number; height: number }
  safeAreas: { top: number; bottom: number; left: number; right: number }
}

/**
 * Hook to detect viewport orientation and dimensions for gatefold layout
 * Returns phone detection (<768px), viewport dimensions, and safe area insets
 */
export function useGatefoldOrientation(): GatefoldOrientation {
  const [state, setState] = useState<GatefoldOrientation>({
    isPhone: false,
    dimensions: { width: 0, height: 0 },
    safeAreas: { top: 0, bottom: 0, left: 0, right: 0 }
  })

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      // Read CSS env variables for safe areas (iOS notch, home indicator, etc.)
      const style = getComputedStyle(document.documentElement)

      // Helper to parse env() values with fallback
      const parseSafeArea = (envVar: string): number => {
        const value = style.getPropertyValue(envVar)
        // Try to parse as integer, default to 0
        const parsed = parseInt(value || '0', 10)
        return isNaN(parsed) ? 0 : parsed
      }

      const safeAreas = {
        top: parseSafeArea('safe-area-inset-top'),
        bottom: parseSafeArea('safe-area-inset-bottom'),
        left: parseSafeArea('safe-area-inset-left'),
        right: parseSafeArea('safe-area-inset-right')
      }

      setState({
        isPhone: width < 768,
        dimensions: { width, height },
        safeAreas
      })
    }

    // Initial update
    update()

    // Listen for viewport changes
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return state
}
