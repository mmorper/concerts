/**
 * ChangelogToast Component
 *
 * Bottom-right toast for new changelog features or new liner note posts.
 * Auto-dismisses after 10 seconds with progress bar.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { ChangelogToastProps } from './types'
import { TOAST } from './constants'

export function ChangelogToast({
  isVisible,
  type = 'changelog',
  // changelog mode
  newFeatureCount = 0,
  latestRelease,
  newReleases = [],
  // liner-notes mode
  newPosts = [],
  latestPost,
  onDismiss,
  onNavigate,
}: ChangelogToastProps) {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(100)

  const isLinerNotes = type === 'liner-notes'
  const accentColor = isLinerNotes ? TOAST.LINER_NOTES_ACCENT : TOAST.BORDER_COLOR
  const accentHover = isLinerNotes ? TOAST.LINER_NOTES_ACCENT_HOVER : TOAST.BUTTON_HOVER
  const ctaLabel = isLinerNotes ? 'Read the Liner Notes →' : "See What's Playing →"
  const ctaRoute = isLinerNotes ? '/liner-notes' : '/whats-playing'

  // Auto-dismiss timer and progress bar
  useEffect(() => {
    if (!isVisible) {
      setProgress(100)
      return
    }

    const dismissTimer = setTimeout(() => {
      onDismiss()
    }, TOAST.AUTO_DISMISS_DURATION)

    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / TOAST.AUTO_DISMISS_DURATION) * 100)
      setProgress(remaining)
    }, 50)

    return () => {
      clearTimeout(dismissTimer)
      clearInterval(progressInterval)
    }
  }, [isVisible, onDismiss])

  // Handle ESC key
  useEffect(() => {
    if (!isVisible) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, onDismiss])

  const handleNavigate = () => {
    onNavigate()
    navigate(ctaRoute)
  }

  // ── Content rendering ───────────────────────────────────────

  function renderContent() {
    if (isLinerNotes) {
      const count = newPosts.length
      if (count === 1 && latestPost) {
        return (
          <>
            {/* top row: image + headline sized to ~2 headline lines */}
            <div className="flex items-start gap-2.5 mb-2">
              {latestPost.image?.url && (
                <img
                  src={latestPost.image.url}
                  alt={latestPost.image.alt}
                  className="rounded-md object-cover flex-shrink-0"
                  style={{ width: 40, height: 40 }}
                />
              )}
              <div className="text-sm font-semibold text-white leading-snug flex-1">
                {latestPost.headline}
              </div>
            </div>
            {/* prose spans full width beneath */}
            <div className="text-xs text-slate-400 leading-relaxed">
              {latestPost.prose.slice(0, 110).trimEnd()}…
            </div>
          </>
        )
      }
      if (count <= 3) {
        return (
          <>
            <div className="text-sm font-semibold text-white mb-2">
              {count} new liner notes
            </div>
            <div className="text-xs text-slate-300 space-y-1">
              {newPosts.slice(0, 3).map((post) => (
                <div key={post.id}>• {post.headline}</div>
              ))}
            </div>
          </>
        )
      }
      return (
        <>
          <div className="text-sm font-semibold text-white mb-1">
            {count} new liner notes
          </div>
          <div className="text-xs text-slate-400">
            New stories from your concert history
          </div>
        </>
      )
    }

    // changelog mode (unchanged logic)
    if (newFeatureCount === 1 && latestRelease) {
      return (
        <>
          <div className="text-sm font-semibold text-white mb-1">
            {latestRelease.title}
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            {latestRelease.description}
          </div>
        </>
      )
    }
    if (newFeatureCount <= 3) {
      return (
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
      )
    }
    return (
      <>
        <div className="text-sm font-semibold text-white mb-1">
          {newFeatureCount} new features added
        </div>
        <div className="text-xs text-slate-400">
          Multiple updates since your last visit
        </div>
      </>
    )
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, duration: 0.4 }}
          className="fixed z-[9999] cursor-pointer left-4 right-4 bottom-[calc(56px+env(safe-area-inset-bottom))] md:left-auto md:right-6 md:w-80 md:bottom-6"
          onClick={handleNavigate}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            className="rounded-lg p-4 backdrop-blur-sm"
            style={{
              backgroundColor: TOAST.BG_COLOR,
              borderWidth: '2px',
              borderColor: accentColor,
            }}
          >
            {/* Content */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                {renderContent()}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
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
                e.stopPropagation()
                handleNavigate()
              }}
              className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: accentColor, color: 'white' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = accentHover }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = accentColor }}
              aria-label={ctaLabel}
            >
              {ctaLabel}
            </button>

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{ backgroundColor: accentColor, width: `${progress}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
