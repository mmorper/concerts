/**
 * TourDatesPanel - Displays upcoming tour dates from Bandsintown
 * Slides in from left (Concert History panel) covering Spotify panel
 * Uses identical animation pattern as LinerNotesPanel (slideInFromLeft)
 * Size: 380×380px content (10px padding inside 400×400px panel)
 */

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { TourEvent } from '../../../types/tourDates'
import { haptics } from '../../../utils/haptics'

interface TourDatesPanelProps {
  artistName: string
  tourDates: TourEvent[] | null
  isLoading: boolean
  error: string | null
  onClose: () => void
}

/**
 * Main tour dates panel component
 */
export function TourDatesPanel({
  artistName,
  tourDates,
  isLoading,
  error,
  onClose
}: TourDatesPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [isClosing, setIsClosing] = useState(false)

  // Focus close button when panel opens (accessibility)
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Handle close with animation
  const handleClose = () => {
    haptics.light()
    setIsClosing(true)
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose()
    }, 350) // Match slideOutToLeft animation duration
  }

  return (
    <div
      className={`absolute top-0 right-0 w-[400px] h-[400px] ${
        isClosing ? 'liner-notes-panel-closing' : 'liner-notes-panel'
      }`}
      style={{
        zIndex: 25, // Above Spotify panel (20) but below cover (30)
        background: 'rgba(32, 32, 32, 0.98)', // Slightly lighter than gatefold for distinction
        padding: '10px'
      }}
      role="dialog"
      aria-modal="false"
      aria-label={`Upcoming tour dates for ${artistName}`}
    >
      <div
        className="w-full h-full"
        style={{
          background: 'transparent',
          borderRadius: '4px',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative'
        }}
      >
        <div className="w-[380px] h-[380px] flex flex-col relative z-10">
          {/* Close Button */}
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="absolute top-[16px] right-[16px] w-6 h-6 flex items-center justify-center text-white hover:text-[#1DB954] transition-all duration-150 hover:scale-110 touchable-subtle"
            aria-label="Close tour dates"
            style={{ zIndex: 30 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Minimal Header */}
          <div className="flex-shrink-0 pt-8 px-8 pb-4">
            <h2 className="font-sans text-xs font-semibold text-[#1DB954] uppercase tracking-wider">
              {isLoading ? 'Checking tour dates...' : 'Upcoming Tour Dates'}
            </h2>
          </div>

          {/* Content Area - Scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8 tour-dates-scrollbar">
            {isLoading && <LoadingState />}
            {error && <ErrorState error={error} />}
            {!isLoading && !error && (!tourDates || tourDates.length === 0) && <NoToursState />}
            {!isLoading && !error && tourDates && tourDates.length > 0 && (
              <TourDatesContent tourDates={tourDates} />
            )}
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
              background: 'rgba(29, 185, 84, 0.15)',
              width: `${60 + Math.random() * 30}%`
            }}
          />
          <div
            className="h-2.5 rounded animate-pulse"
            style={{
              background: 'rgba(29, 185, 84, 0.1)',
              width: `${40 + Math.random() * 20}%`
            }}
          />
        </div>
      ))}

      <p className="font-sans text-xs text-[#737373] text-center pt-4">
        Loading from Ticketmaster...
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
      <p className="font-sans text-base text-white mb-2 font-medium">
        Unable to load tour dates
      </p>
      <p className="font-sans text-sm text-[#a3a3a3] max-w-[280px]">
        {error || 'Check your connection and try again.'}
      </p>
    </div>
  )
}

/**
 * No tours state
 */
function NoToursState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <div className="text-4xl mb-4">🎫</div>
      <p className="font-sans text-base text-white mb-2 font-medium">
        No upcoming shows
      </p>
      <p className="font-sans text-sm text-[#a3a3a3] mb-1">
        scheduled
      </p>
      <p className="font-sans text-xs text-[#737373] max-w-[280px] mt-4 leading-relaxed">
        Check back later or follow the artist on Ticketmaster to get notified.
      </p>
    </div>
  )
}

/**
 * Tour dates content display
 */
function TourDatesContent({ tourDates }: { tourDates: TourEvent[] }) {
  return (
    <div className="flex flex-col h-full">
      {/* Tour Dates List - Scrollable */}
      <ul className="list-none flex flex-col gap-1.5 flex-1 overflow-y-auto pr-2">
        {tourDates.map((event) => (
          <TourDateItem key={event.id} event={event} />
        ))}
      </ul>

      {/* Attribution Footer */}
      <div className="pt-4 mt-4 border-t border-[rgba(255,255,255,0.1)] flex-shrink-0">
        <p className="font-sans text-[0.6875rem] text-[#737373]">
          via Ticketmaster
        </p>
      </div>
    </div>
  )
}

/**
 * Individual tour date item - Horizontal layout matching Concert History
 * Format: DD MMM YYYY    City, State    Tickets →
 *                        Venue
 */
function TourDateItem({ event }: { event: TourEvent }) {
  // Format date to match Concert History (dd MMM yyyy)
  const eventDate = new Date(event.datetime)
  const formattedDate = format(eventDate, 'dd MMM yyyy')

  // Get location (city, state/region)
  const location = event.venue.region
    ? `${event.venue.city}, ${event.venue.region}`
    : event.venue.city

  // Get ticket URL (prefer offers, fallback to event URL)
  const ticketUrl = event.offers?.[0]?.url || event.url

  return (
    <li
      className="group flex items-center gap-4 text-[0.95rem] text-[#e5e5e5] py-1.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.04] transition-colors duration-150 rounded px-2 -mx-2"
    >
      {/* Date */}
      <span className="font-sans text-xs text-[#737373] font-medium min-w-[85px] flex-shrink-0 tabular-nums">
        {formattedDate}
      </span>

      {/* Venue & Location - Two lines */}
      <div className="flex-1 flex flex-col gap-0.5">
        <span className="font-sans text-xs text-[#e5e5e5]">
          {location}
        </span>
        <span className="font-sans text-xs text-[#737373]">
          {event.venue.name}
        </span>
      </div>

      {/* Ticket link */}
      {ticketUrl && (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center flex-shrink-0 text-xs font-medium text-[#8b8b8b] hover:text-[#1DB954] transition-all duration-150 touchable-subtle"
          onClick={(e) => {
            e.stopPropagation()
            haptics.light()
          }}
          aria-label={`Get tickets for ${event.venue.name}`}
        >
          Tickets
        </a>
      )}
    </li>
  )
}
