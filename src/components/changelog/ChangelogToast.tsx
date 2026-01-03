/**
 * ChangelogToast Component
 *
 * Bottom-center toast notification for new features
 * Auto-dismisses after 10 seconds with progress bar
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { ChangelogToastProps } from './types'
import { TOAST } from './constants'

export function ChangelogToast({
  isVisible,
  newFeatureCount,
  onDismiss,
  onNavigate,
}: ChangelogToastProps) {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(100)

  // Auto-dismiss timer and progress bar
  useEffect(() => {
    if (!isVisible) {
      setProgress(100) // Reset progress when hidden
      return
    }

    // Auto-dismiss after duration
    const dismissTimer = setTimeout(() => {
      onDismiss()
    }, TOAST.AUTO_DISMISS_DURATION)

    // Progress bar countdown
    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / TOAST.AUTO_DISMISS_DURATION) * 100)
      setProgress(remaining)
    }, 50) // Update every 50ms for smooth animation

    return () => {
      clearTimeout(dismissTimer)
      clearInterval(progressInterval)
    }
  }, [isVisible, onDismiss])

  // Handle ESC key
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, onDismiss])

  // Handle navigation
  const handleNavigate = () => {
    onNavigate()
    navigate('/changelog')
  }

  // Handle click anywhere on toast to navigate
  const handleToastClick = () => {
    handleNavigate()
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 100,
            damping: 20,
            duration: 0.5,
          }}
          className="fixed left-1/2 z-[9999] cursor-pointer"
          style={{
            bottom: `${TOAST.BOTTOM_OFFSET}px`,
            transform: 'translateX(-50%)',
            width: `min(${TOAST.WIDTH}px, calc(100vw - 32px))`,
          }}
          onClick={handleToastClick}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            className="rounded-xl p-6 backdrop-blur-sm"
            style={{
              backgroundColor: TOAST.BG_COLOR,
              borderWidth: '2px',
              borderColor: TOAST.BORDER_COLOR,
            }}
          >
            {/* Content */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <span className="text-lg font-semibold text-white">
                  {newFeatureCount} new feature{newFeatureCount !== 1 ? 's' : ''} added!
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation() // Prevent toast click
                  onDismiss()
                }}
                className="text-slate-400 hover:text-white transition-colors text-2xl leading-none -mt-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>

            <p className="text-slate-400 mb-4">
              Check out what's new in the concert archive
            </p>

            <button
              onClick={(e) => {
                e.stopPropagation() // Prevent double navigation
                handleNavigate()
              }}
              className="w-full py-3 rounded-lg font-medium transition-colors min-h-[44px]"
              style={{
                backgroundColor: TOAST.BUTTON_BG,
                color: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = TOAST.BUTTON_HOVER
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = TOAST.BUTTON_BG
              }}
              aria-label="View new features in changelog"
            >
              See What's Playing →
            </button>

            {/* Progress bar */}
            <div className="mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{
                  backgroundColor: '#f59e0b', // amber-500
                  width: `${progress}%`,
                }}
                transition={{ duration: 0.05 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
