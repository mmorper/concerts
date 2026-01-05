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
  latestRelease,
  newReleases,
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
    navigate('/liner-notes')
  }

  // Handle click anywhere on toast to navigate
  const handleToastClick = () => {
    handleNavigate()
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{
            type: 'spring',
            stiffness: 100,
            damping: 20,
            duration: 0.5,
          }}
          className="fixed z-[9999] cursor-pointer"
          style={{
            bottom: `${TOAST.BOTTOM_OFFSET}px`,
            right: `${TOAST.RIGHT_OFFSET}px`,
            width: `min(${TOAST.WIDTH}px, calc(100vw - 48px))`,
          }}
          onClick={handleToastClick}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            className="rounded-lg p-4 backdrop-blur-sm"
            style={{
              backgroundColor: TOAST.BG_COLOR,
              borderWidth: '2px',
              borderColor: TOAST.BORDER_COLOR,
            }}
          >
            {/* Content */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                {newFeatureCount === 1 ? (
                  // Single feature: Show title and description
                  <>
                    <div className="text-sm font-semibold text-white mb-1">
                      {latestRelease.title}
                    </div>
                    <div className="text-xs text-slate-400 leading-relaxed">
                      {latestRelease.description}
                    </div>
                  </>
                ) : newFeatureCount <= 3 ? (
                  // 2-3 features: Show titles as list
                  <>
                    <div className="text-sm font-semibold text-white mb-2">
                      {newFeatureCount} new features
                    </div>
                    <div className="text-xs text-slate-300 space-y-1">
                      {newReleases.slice(0, 3).map((release) => (
                        <div key={release.version}>• {release.title}</div>
                      ))}
                    </div>
                  </>
                ) : (
                  // 4+ features: Generic message
                  <>
                    <div className="text-sm font-semibold text-white mb-1">
                      {newFeatureCount} new features added
                    </div>
                    <div className="text-xs text-slate-400">
                      Multiple updates since your last visit
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation() // Prevent toast click
                  onDismiss()
                }}
                className="text-slate-400 hover:text-white transition-colors text-xl leading-none -mt-1 ml-3 min-w-[32px] min-h-[32px] flex items-center justify-center flex-shrink-0"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation() // Prevent double navigation
                handleNavigate()
              }}
              className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors"
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
            <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
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
