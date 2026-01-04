/**
 * LinerNotesPanel - Displays concert setlist from setlist.fm
 * Slides in from the left (Concert History panel) like pulling liner notes from a vinyl sleeve
 * Covers the Spotify panel when open
 * Size: 380×380px (10px margin inside 400×400px panel)
 */

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { Setlist } from '../../../types/setlist'
import type { ArtistConcert } from './types'
import { haptics } from '../../../utils/haptics'

interface LinerNotesPanelProps {
  concert: ArtistConcert
  artistName: string
  setlist: Setlist | null
  isLoading: boolean
  error: string | null
  onClose: () => void
}

/**
 * Main liner notes panel component
 */
export function LinerNotesPanel({
  concert,
  artistName,
  setlist,
  isLoading,
  error,
  onClose
}: LinerNotesPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [isClosing, setIsClosing] = useState(false)

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

  return (
    <div
      className={`absolute top-0 right-0 w-[400px] h-[400px] ${
        isClosing ? 'liner-notes-panel-closing' : 'liner-notes-panel'
      }`}
      style={{
        zIndex: 25, // Above Spotify panel (20) but below cover (30)
        // Add solid background during closing to prevent bleed-through
        background: isClosing ? 'linear-gradient(135deg, #f5f5f0 0%, #e8e8e0 100%)' : 'transparent'
      }}
      role="dialog"
      aria-modal="false"
      aria-label={`Setlist for ${artistName} on ${format(new Date(concert.date), 'MMMM d, yyyy')}`}
    >
      <div
        className="w-full h-full p-[10px] liner-notes-paper"
        style={{
          background: 'linear-gradient(135deg, #f5f5f0 0%, #e8e8e0 100%)',
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

        <div className="w-[380px] h-[380px] flex flex-col relative z-10">
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

          {/* Compact Header - Just date and venue */}
          <div className="flex-shrink-0 pt-6 px-7 pb-3">
            <p className="font-sans text-[0.8125rem] text-[#6a6a60] tracking-wide">
              {format(new Date(concert.date), 'MMMM d, yyyy')} · {concert.venue}
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
