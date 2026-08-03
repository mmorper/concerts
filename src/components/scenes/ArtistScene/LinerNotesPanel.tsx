/**
 * LinerNotesPanel - Displays concert setlist from setlist.fm
 * Slides in from the left (Concert History panel) like pulling liner notes from a vinyl sleeve
 * Covers the Spotify panel when open
 * Size: 440×440px (10px margin inside 460×460px panel on desktop), 380×380px on smaller viewports
 */

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { Setlist } from '../../../types/setlist'
import type { ArtistConcert } from './types'
import { haptics } from '../../../utils/haptics'
import { useShareSetlistLink } from '../../../hooks/useShareSetlistLink'

interface LinerNotesPanelProps {
  concert: ArtistConcert
  artistName: string
  /** Normalized artist name — the `artist` value in the share link (#196) */
  artistSlug: string
  setlist: Setlist | null
  isLoading: boolean
  error: string | null
  onClose: () => void
  isPhone?: boolean // v3.2.0 - Phone layout mode (slides from top)
}

/**
 * Main liner notes panel component
 * Desktop: Slides from left (Concert History → Spotify)
 * Phone: Slides from top (covering Concert History panel)
 */
export function LinerNotesPanel({
  concert,
  artistName,
  artistSlug,
  setlist,
  isLoading,
  error,
  onClose,
  isPhone = false
}: LinerNotesPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [isClosing, setIsClosing] = useState(false)

  // #196 — share link for this specific night. Desktop copies to clipboard;
  // the confirmation is the inline icon swap below, never a toast (the toast
  // system carries session-priority logic this has no business entering).
  const { share, status: shareStatus } = useShareSetlistLink({
    artistSlug,
    date: concert.date,
    artistName,
    venue: concert.venue,
    isPhone
  })

  // Only offer the link once there's a setlist to link to. Mirrors the
  // content area below: loading, error, and no-setlist all render instead of
  // a setlist, and a link promising one would be a lie in all three.
  const canShare = !isLoading && !error && !!setlist

  // Focus close button when panel opens (accessibility)
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Handle close with animation
  const handleClose = () => {
    haptics.light() // Haptic feedback on close
    setIsClosing(true)
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose()
    }, 350) // Match animation duration
  }

  // Responsive sizing: 460px on desktop/tablet landscape (1024px+), 400px on smaller viewports
  const panelSize = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 460 : 400
  const contentSize = panelSize - 20 // Account for 10px padding on each side

  return (
    <div
      className={`absolute ${
        isPhone
          ? isClosing ? 'phone-liner-notes-panel-closing' : 'phone-liner-notes-panel'
          : isClosing ? 'liner-notes-panel-closing' : 'liner-notes-panel'
      } ${isPhone ? 'top-0 left-0 w-full h-full' : 'top-0 right-0'}`}
      style={{
        width: isPhone ? '100%' : `${panelSize}px`,
        height: isPhone ? '100%' : `${panelSize}px`,
        zIndex: 25, // Above Spotify panel (20) but below cover (30)
        // Always use solid background to prevent bleed-through during animation
        background: 'linear-gradient(135deg, #f5f5f0 0%, #e8e8e0 100%)',
        padding: '10px'
      }}
      role="dialog"
      aria-modal="false"
      aria-label={`Setlist for ${artistName} on ${format(new Date(concert.date + 'T00:00:00'), 'MMMM d, yyyy')}`}
    >
      <div
        className="w-full h-full liner-notes-paper"
        style={{
          background: 'transparent', // Parent now provides background
          borderRadius: '4px',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6), inset -2px 0 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(180, 170, 150, 0.3)',
          position: 'relative'
        }}
      >
        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\' /%3E%3C/svg%3E")',
            borderRadius: '4px',
            mixBlendMode: 'multiply'
          }}
        />

        {/* Paper curl shadow effect (bottom-right corner) */}
        <div
          className="absolute bottom-0 right-0 w-20 h-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at bottom right, rgba(0, 0, 0, 0.15) 0%, transparent 70%)',
            borderRadius: '0 0 4px 0'
          }}
        />

        <div className="flex flex-col relative z-10" style={{ width: `${contentSize}px`, height: `${contentSize}px` }}>
          {/* Close Button */}
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="absolute top-[20px] right-[20px] w-6 h-6 flex items-center justify-center text-[#4a4a40] hover:text-[#1DB954] transition-all duration-150 hover:scale-110 touchable-subtle"
            aria-label="Close setlist"
            style={{ zIndex: 30 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Share Link Button (#196) - left of the close button, with a gap.
              Close is destructive here (it discards the panel you're about to
              share), so the two must not sit flush. */}
          {canShare && (
            <button
              onClick={share}
              className="absolute top-[20px] right-[52px] w-6 h-6 flex items-center justify-center text-[#4a4a40] hover:text-[#1DB954] transition-all duration-150 hover:scale-110 touchable-subtle"
              aria-label={`Copy link to this setlist — ${artistName} at ${concert.venue}`}
              title={shareStatus === 'copied' ? 'Link copied' : 'Copy link to this setlist'}
              style={{ zIndex: 30 }}
            >
              {shareStatus === 'copied' ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : shareStatus === 'error' ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
              )}
            </button>
          )}

          {/* Compact Header - Just date and venue */}
          <div className="flex-shrink-0 pt-6 px-7 pb-3">
            <p className="font-sans text-[0.8125rem] text-[#6a6a60] tracking-wide">
              {format(new Date(concert.date + 'T00:00:00'), 'MMMM d, yyyy')} · {concert.venue}
            </p>
          </div>

          {/* Subtle divider */}
          <div
            className="flex-shrink-0 mx-7 mb-4"
            style={{
              height: '1px',
              background: 'linear-gradient(to right, transparent, rgba(100, 100, 90, 0.2) 20%, rgba(100, 100, 90, 0.2) 80%, transparent)'
            }}
          />

          {/* Content Area - Scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-7 pb-7 liner-notes-scrollbar">
            {isLoading && <LoadingState />}
            {error && <ErrorState error={error} />}
            {!isLoading && !error && !setlist && <NotFoundState />}
            {!isLoading && !error && setlist && <SetlistContent setlist={setlist} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading state with skeleton animation
 */
function LoadingState() {
  return (
    <div className="space-y-6">
      {/* Skeleton bars */}
      {[1, 2, 3, 4, 5].map((idx) => (
        <div key={idx} className="space-y-2">
          <div
            className="h-3 rounded animate-pulse"
            style={{
              background: 'rgba(100, 100, 90, 0.15)',
              width: `${60 + Math.random() * 30}%`
            }}
          />
          <div
            className="h-2.5 rounded animate-pulse"
            style={{
              background: 'rgba(100, 100, 90, 0.1)',
              width: `${40 + Math.random() * 20}%`
            }}
          />
        </div>
      ))}

      <p className="font-sans text-xs text-[#7a7a70] text-center pt-4">
        Loading setlist...
      </p>
    </div>
  )
}

/**
 * Error state
 */
function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="text-4xl mb-4">⚠️</div>
      <p className="font-sans text-base text-[#3a3a30] mb-2 font-medium">
        Unable to load setlist
      </p>
      <p className="font-sans text-sm text-[#6a6a60] max-w-[280px]">
        {error || 'Check your connection and try again.'}
      </p>
    </div>
  )
}

/**
 * Not found state
 */
function NotFoundState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="text-4xl mb-4">📋</div>
      <p className="font-sans text-base text-[#3a3a30] mb-2 font-medium">
        No setlist available
      </p>
      <p className="font-sans text-sm text-[#6a6a60] mb-1">
        for this concert
      </p>
      <p className="font-sans text-xs text-[#7a7a70] max-w-[280px] mt-4 leading-relaxed">
        Setlists are community-contributed and may not exist for all shows.
      </p>
    </div>
  )
}

/**
 * Setlist content display
 */
function SetlistContent({ setlist }: { setlist: Setlist }) {
  // Show tour info if available
  const showTourInfo = setlist.tour && setlist.tour.name

  // Count total songs
  let totalSongs = 0
  if (setlist.sets && setlist.sets.set) {
    for (const set of setlist.sets.set) {
      totalSongs += set.song.length
    }
  }

  return (
    <div className="space-y-5">
      {/* Tour Info (if available) */}
      {showTourInfo && (
        <div className="pb-2">
          <p className="font-sans text-xs text-[#7a7a70] italic">
            {setlist.tour!.name}
          </p>
        </div>
      )}

      {/* Show Notes (if available) */}
      {setlist.info && (
        <div className="pb-2">
          <p className="font-sans text-sm text-[#5a5a50] italic leading-relaxed">
            "{setlist.info}"
          </p>
        </div>
      )}

      {/* Sets */}
      {setlist.sets && setlist.sets.set && setlist.sets.set.length > 0 ? (
        setlist.sets.set.map((set, setIdx) => {
          // Determine set name
          let setName = 'SET'
          if (set.encore) {
            setName = set.encore === 1 ? 'ENCORE' : `ENCORE ${set.encore}`
          } else if (set.name) {
            setName = set.name.toUpperCase()
          } else if (setlist.sets.set.length > 1 && !set.encore) {
            setName = `SET ${setIdx + 1}`
          }

          return (
            <div key={setIdx} className="space-y-3">
              {/* Set Header */}
              <h3 className="font-sans text-[0.75rem] font-bold text-[#2a5a2a] uppercase tracking-wider">
                {setName}
              </h3>

              {/* Song List */}
              <ol className="space-y-1.5">
                {set.song.map((song, songIdx) => (
                  <li
                    key={songIdx}
                    className="flex items-baseline gap-3 font-sans text-[0.9375rem] text-[#2a2a25]"
                  >
                    <span className="font-sans text-[0.875rem] font-medium text-[#8a8a80] min-w-[20px] tabular-nums">
                      {songIdx + 1}.
                    </span>
                    <span className="flex-1">
                      {song.name}
                      {song.cover && (
                        <span className="text-[#7a7a70] text-[0.8125rem] ml-2">
                          ({song.cover.name} cover)
                        </span>
                      )}
                      {song.with && (
                        <span className="text-[#7a7a70] text-[0.8125rem] ml-2">
                          (with {song.with.name})
                        </span>
                      )}
                      {song.tape && (
                        <span className="text-[#7a7a70] text-[0.8125rem] ml-2">
                          (tape)
                        </span>
                      )}
                      {song.info && (
                        <span className="text-[#7a7a70] text-[0.8125rem] block ml-[32px] mt-0.5">
                          {song.info}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )
        })
      ) : (
        <p className="font-sans text-sm text-[#7a7a70] text-center py-4">
          No songs listed for this show
        </p>
      )}

      {/* Attribution Footer */}
      <div className="pt-6 border-t border-[rgba(100,100,90,0.15)]">
        <div className="flex items-center justify-between">
          <p className="font-sans text-[0.6875rem] text-[#8a8a80]">
            via setlist.fm
          </p>
          {totalSongs > 0 && (
            <p className="font-sans text-[0.6875rem] text-[#8a8a80]">
              {totalSongs} {totalSongs === 1 ? 'song' : 'songs'}
            </p>
          )}
        </div>
        {setlist.url && (
          <a
            href={setlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[0.6875rem] text-[#2a5a2a] hover:text-[#1DB954] hover:underline inline-block mt-1 transition-colors"
          >
            View on setlist.fm →
          </a>
        )}
      </div>
    </div>
  )
}
