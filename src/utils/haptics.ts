/**
 * Haptic Feedback Utility (v1.7.7)
 *
 * Provides tactile feedback using the Web Vibration API for Android and a
 * checkbox switch workaround for iOS Safari (iOS 17.4+).
 *
 * Browser Support:
 * - Chrome/Edge for Android: Full support via Vibration API
 * - Safari iOS 17.4+: Checkbox switch workaround
 * - Firefox Android: Full support via Vibration API
 * - Desktop browsers: Gracefully degrades (no-op)
 *
 * Technical Note:
 * Safari iOS does not support navigator.vibrate(), so we use a workaround with
 * <input type="checkbox" switch> which triggers haptic feedback when toggled.
 *
 * Usage:
 * ```typescript
 * import { haptics } from '@/utils/haptics'
 *
 * // On button tap
 * haptics.light()
 *
 * // On successful async operation
 * haptics.success()
 * ```
 */

/**
 * Check if vibration API is supported (Android)
 */
const isVibrationSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

/**
 * Check if we're on iOS Safari (needs checkbox workaround)
 */
const isIOSSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const webkit = /WebKit/.test(ua)
  const notChrome = !/CriOS|Chrome/.test(ua)
  return iOS && webkit && notChrome
}

/**
 * Trigger haptic feedback on iOS using checkbox switch
 * This exploits iOS 17.4+ native haptic feedback on switch toggles
 */
const triggerIOSHaptic = (pattern: 'light' | 'medium' | 'heavy' | 'success' | 'error'): void => {
  // Create hidden checkbox with switch attribute
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.setAttribute('switch', '')
  checkbox.style.position = 'fixed'
  checkbox.style.left = '-9999px'
  checkbox.style.opacity = '0'
  checkbox.style.pointerEvents = 'none'

  // Create label (required for programmatic triggering)
  const label = document.createElement('label')
  label.style.position = 'fixed'
  label.style.left = '-9999px'
  label.style.opacity = '0'
  label.style.pointerEvents = 'none'
  label.appendChild(checkbox)

  document.body.appendChild(label)

  // Trigger haptic based on pattern
  switch (pattern) {
    case 'light':
    case 'medium':
    case 'heavy':
      // Single haptic
      setTimeout(() => {
        label.click()
        setTimeout(() => document.body.removeChild(label), 50)
      }, 0)
      break
    case 'success':
      // Double haptic (quick succession)
      setTimeout(() => {
        label.click()
        setTimeout(() => {
          label.click()
          setTimeout(() => document.body.removeChild(label), 50)
        }, 100)
      }, 0)
      break
    case 'error':
      // Triple haptic (error pattern)
      setTimeout(() => {
        label.click()
        setTimeout(() => {
          label.click()
          setTimeout(() => {
            label.click()
            setTimeout(() => document.body.removeChild(label), 50)
          }, 150)
        }, 150)
      }, 0)
      break
  }
}

/**
 * Haptic feedback patterns
 */
export const haptics = {
  /**
   * Light haptic (10ms on Android, single tap on iOS)
   * Use for: Most tap interactions, navigation dots, timeline dots, genre segments
   */
  light: (): void => {
    if (isIOSSafari()) {
      triggerIOSHaptic('light')
    } else if (isVibrationSupported()) {
      navigator.vibrate(10)
    }
  },

  /**
   * Medium haptic (20ms on Android, single tap on iOS)
   * Use for: Major actions like opening gatefold, expanding venues
   */
  medium: (): void => {
    if (isIOSSafari()) {
      triggerIOSHaptic('medium')
    } else if (isVibrationSupported()) {
      navigator.vibrate(20)
    }
  },

  /**
   * Heavy haptic (50ms on Android, single tap on iOS)
   * Use for: Drill-down actions, major state changes
   * Note: Use sparingly to conserve battery
   */
  heavy: (): void => {
    if (isIOSSafari()) {
      triggerIOSHaptic('heavy')
    } else if (isVibrationSupported()) {
      navigator.vibrate(50)
    }
  },

  /**
   * Success pattern (double tap)
   * Use for: Successful async operations like setlist loaded
   */
  success: (): void => {
    if (isIOSSafari()) {
      triggerIOSHaptic('success')
    } else if (isVibrationSupported()) {
      navigator.vibrate([10, 50, 10])
    }
  },

  /**
   * Error pattern (triple tap)
   * Use for: API errors, validation failures
   */
  error: (): void => {
    if (isIOSSafari()) {
      triggerIOSHaptic('error')
    } else if (isVibrationSupported()) {
      navigator.vibrate([50, 100, 50])
    }
  },
}

/**
 * Cancel any ongoing vibration (Android only)
 * Useful if user navigates away during a long vibration pattern
 * Note: iOS checkbox haptics cannot be cancelled once triggered
 */
export const cancelHaptics = (): void => {
  if (isVibrationSupported()) {
    navigator.vibrate(0)
  }
}
