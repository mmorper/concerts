/**
 * PhoneArtistModal - Mobile-native modal for Artist Scene
 * Replaces the desktop gatefold on phone viewports (<768px)
 *
 * Features:
 * - Full-screen modal with tabbed navigation (History, Upcoming, Top Tracks)
 * - Setlist overlay slides from right
 * - Swipe-down and X to dismiss
 * - Standard iOS/Android modal patterns
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { X, Link2, History, Calendar, Music, Share2, Check, AlertTriangle } from 'lucide-react'
import { useShareSetlistLink } from '../../../hooks/useShareSetlistLink'
import { artistDeepLink, absoluteUrl } from '../../../utils/deepLinks'
import { getGenreColor } from '../../../constants/colors'
import { useArtistMetadata } from '../../TimelineHoverPreview/useArtistMetadata'
import { useTourDates } from '../../../hooks/useTourDates'
import { useLinerNotesCount } from '../../../hooks/useLinerNotesCount'
import { fetchSetlist } from '../../../services/setlistfm'
import { TourBadge } from './TourBadge'
import { LinerNotesBadge } from './LinerNotesBadge'
import { AudioPreviewPanel } from './AudioPreviewPanel'
import { haptics } from '../../../utils/haptics'
import { normalizeVenueName } from '../../../utils/normalize'
import type { ArtistCard, ArtistConcert } from './types'
import type { Setlist } from '../../../types/setlist'
import { analytics } from '../../../services/analytics'
import { isUpcomingConcert } from '../../../utils/concertUtils'
import { UpcomingBadge } from '../../UpcomingBadge'

// Tab types
type TabId = 'history' | 'upcoming' | 'tracks'

interface PhoneArtistModalProps {
  artist: ArtistCard | null
  onClose: () => void
  reducedMotion: boolean
  /** Concert date from `?show=` — opens that setlist on mount (#196) */
  pendingSetlistFocus?: string | null
}

/**
 * Get artist initials for placeholder display
 */
function getArtistInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Adjust color brightness for gradient effect
 */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function PhoneArtistModal({
  artist,
  onClose,
  reducedMotion,
  pendingSetlistFocus
}: PhoneArtistModalProps) {
  const navigate = useNavigate()
  const { getArtistImage } = useArtistMetadata()

  // Animation states
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('history')

  // Setlist overlay state
  const [selectedConcert, setSelectedConcert] = useState<ArtistConcert | null>(null)
  const [setlistData, setSetlistData] = useState<Setlist | null>(null)
  const [isLoadingSetlist, setIsLoadingSetlist] = useState(false)
  const [setlistError, setSetlistError] = useState<string | null>(null)
  const [showSetlistOverlay, setShowSetlistOverlay] = useState(false)

  // Copy link toast
  const [showCopiedToast, setShowCopiedToast] = useState(false)

  // Refs
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)

  // Tour dates
  const { tourDates, tourCount, isLoading: isLoadingTourDates, error: tourDatesError } = useTourDates(
    artist?.name || null,
    { delay: 100, enabled: !!artist }
  )

  // Liner notes count
  const { count: linerNotesCount } = useLinerNotesCount(artist?.normalizedName ?? null)

  // Determine if Upcoming tab should show
  const showUpcomingTab = tourCount > 0

  // Handle venue click - navigate to Venues scene with venue+artist context
  const handleVenueClick = useCallback((venueName: string) => {
    if (!artist) return
    const normalizedVenue = normalizeVenueName(venueName)
    const normalizedArtist = artist.normalizedName
    haptics.light()
    navigate(`/?scene=venues&venue=${normalizedVenue}&artist=${normalizedArtist}`)
  }, [artist, navigate])

  // Open animation on mount
  useEffect(() => {
    if (artist) {
      if (reducedMotion) {
        // Instant show for reduced motion
        setIsVisible(true)
      } else {
        // Trigger open animation
        requestAnimationFrame(() => {
          setIsVisible(true)
        })
      }
    }
  }, [artist, reducedMotion])

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (isClosing) return

    // If setlist overlay is open, close it first
    if (showSetlistOverlay) {
      handleCloseSetlist()
      return
    }

    setIsClosing(true)
    haptics.light()

    if (reducedMotion) {
      onClose()
      return
    }

    // Wait for close animation
    setTimeout(() => {
      onClose()
    }, 250)
  }, [isClosing, showSetlistOverlay, reducedMotion, onClose])

  // Handle backdrop tap
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && artist) {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [artist, handleClose])

  // Swipe-down-to-close gesture
  useEffect(() => {
    if (!modalRef.current) return

    const modal = modalRef.current

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const SWIPE_THRESHOLD = 100
      const deltaY = e.changedTouches[0].clientY - touchStartY.current

      if (deltaY > SWIPE_THRESHOLD) {
        handleClose()
      }
    }

    modal.addEventListener('touchstart', handleTouchStart, { passive: true })
    modal.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      modal.removeEventListener('touchstart', handleTouchStart)
      modal.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleClose])

  // Handle tab switch
  const handleTabSwitch = (tabId: TabId) => {
    if (tabId === activeTab) return

    haptics.light()

    // Track tab view
    analytics.trackEvent('artist_tab_viewed', {
      artist_name: artist?.name || '',
      tab_name: tabId,
    })

    setActiveTab(tabId)

    // Reset scroll position
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }

  // Handle copy link
  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!artist) return

    // Haptic feedback immediately on tap
    haptics.light()

    // Built from the shared builder so this link can't drift from the
    // contract (docs/DEEP_LINKING.md v1.2 / test/fixtures/deep-link-urls.json).
    const url = absoluteUrl(artistDeepLink(artist.normalizedName))

    try {
      await navigator.clipboard.writeText(url)
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
      // Fallback for iOS Safari in secure context
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setShowCopiedToast(true)
        setTimeout(() => setShowCopiedToast(false), 2000)
      } catch {
        console.error('Fallback copy failed')
      }
      document.body.removeChild(textArea)
    }
  }

  // Handle tour badge click - switch to Upcoming tab
  const handleTourBadgeClick = () => {
    if (showUpcomingTab) {
      handleTabSwitch('upcoming')
    }
  }

  // Handle setlist click
  const handleSetlistClick = async (concert: ArtistConcert) => {
    if (!artist) return

    // Track setlist click
    analytics.trackEvent('setlist_button_clicked', {
      artist_name: artist.name,
      concert_date: concert.date,
      venue_name: concert.venue,
      device_type: 'mobile',
    })

    setSelectedConcert(concert)
    setSetlistData(null)
    setIsLoadingSetlist(true)
    setSetlistError(null)
    setShowSetlistOverlay(true)

    try {
      const setlist = await fetchSetlist({
        concertId: concert.concertId,
        artistName: artist.name,
        date: concert.date,
        venueName: concert.venue,
        city: concert.city.split(',')[0].trim()
      })
      setSetlistData(setlist)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        setSetlistError((error as { message: string }).message)
      } else {
        setSetlistError('Unable to load setlist. Please try again.')
      }
    } finally {
      setIsLoadingSetlist(false)
    }
  }

  // #196 — stage three of the deep-link restore, phone path. The modal is
  // already mounted by the time this runs (ArtistScene only renders it once
  // an artist is open), so there's no open-animation to sequence behind here.
  const restoredSetlistRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingSetlistFocus || !artist) return
    // Restore once per deep link, or dismissing the overlay would reopen it.
    if (restoredSetlistRef.current === pendingSetlistFocus) return

    const concert = artist.concerts.find(c => c.date === pendingSetlistFocus)
    // Stale link for this artist — leave the modal open, don't error.
    if (!concert) return

    restoredSetlistRef.current = pendingSetlistFocus
    handleSetlistClick(concert)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSetlistFocus, artist])

  // Handle close setlist
  const handleCloseSetlist = () => {
    setShowSetlistOverlay(false)
    haptics.light()

    // Clear data after animation
    setTimeout(() => {
      setSelectedConcert(null)
      setSetlistData(null)
      setSetlistError(null)
    }, 250)
  }

  if (!artist) return null

  const genreColor = getGenreColor(artist.primaryGenre)
  const gradient = `linear-gradient(135deg, ${genreColor} 0%, ${adjustColor(genreColor, -30)} 100%)`
  const initials = getArtistInitials(artist.name)
  const artistImage = getArtistImage(artist.name)

  // Build tabs array with brand colors
  const tabs: { id: TabId; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'history', label: 'CONCERT HISTORY', icon: <History size={16} />, color: '#a78bfa' }, // violet-400
    ...(showUpcomingTab ? [{ id: 'upcoming' as TabId, label: 'UPCOMING', icon: <Calendar size={16} />, color: '#fbbf24' }] : []), // amber-400
    { id: 'tracks', label: 'TOP TRACKS', icon: <Music size={16} />, color: '#1DB954' } // green for music
  ]

  return (
    <div
      className={`fixed inset-0 z-[99998] ${
        reducedMotion ? '' : 'transition-opacity duration-300'
      } ${
        isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${artist.name} details`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={modalRef}
        className={`absolute inset-3 bg-black rounded-2xl overflow-hidden flex flex-col ${
          reducedMotion ? '' : 'transition-transform duration-300 ease-out'
        } ${
          isVisible && !isClosing ? 'translate-y-0' : 'translate-y-[50px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dismiss Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        {/* Header Section */}
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex gap-4">
            {/* Artist Photo */}
            {artistImage ? (
              <img
                src={artistImage}
                alt={artist.name}
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: gradient }}
              >
                <span className="font-sans text-2xl font-semibold text-white">
                  {initials}
                </span>
              </div>
            )}

            {/* Artist Info */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-1">
                <h2 className="font-serif text-2xl font-medium text-white truncate">
                  {artist.name}
                </h2>
                <button
                  onClick={handleCopyLink}
                  className="flex-shrink-0 w-11 h-11 text-gray-500 hover:text-white active:text-white transition-colors flex items-center justify-center touch-manipulation"
                  aria-label={`Copy link to ${artist.name}`}
                  type="button"
                >
                  <Link2 size={18} />
                </button>

                {/* Copy confirmation toast */}
                {showCopiedToast && (
                  <div
                    className="absolute top-2 right-16 px-2 py-1 bg-black/90 text-white text-xs font-medium rounded shadow-lg animate-fade-in"
                    role="status"
                  >
                    Copied!
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-400 mt-1">
                {artist.primaryGenre} · {artist.timesSeen} {artist.timesSeen === 1 ? 'show' : 'shows'}
              </p>

              {/* Badges row — Tour + Liner Notes */}
              {(tourCount > 0 || linerNotesCount > 0) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tourCount > 0 && (
                    <TourBadge
                      tourCount={tourCount}
                      artistName={artist.name}
                      isActive={activeTab === 'upcoming'}
                      onClick={handleTourBadgeClick}
                      show={true}
                    />
                  )}
                  {linerNotesCount > 0 && (
                    <LinerNotesBadge
                      count={linerNotesCount}
                      artistNormalizedName={artist.normalizedName}
                      artistName={artist.name}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex-shrink-0 border-b border-white/10">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabSwitch(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-xs font-medium uppercase tracking-wider transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <span style={{ color: activeTab === tab.id ? tab.color : undefined }}>
                  {tab.icon}
                </span>
                <span className="hidden xs:inline">{tab.label}</span>

                {/* Active underline - matches tab brand color */}
                {activeTab === tab.id && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: tab.color }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Area */}
        <div
          ref={contentRef}
          className={`flex-1 overflow-y-auto relative ${
            showSetlistOverlay ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-4">
              {/* Section Label */}
              <div className="flex items-center gap-2 mb-4">
                <History size={18} className="text-violet-400" />
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
                  Concert History
                </span>
              </div>

              <ul className="space-y-1">
                {artist.concerts.map((concert, idx) => {
                  const isUpcoming = isUpcomingConcert(concert.date)
                  return (
                    <li
                      key={idx}
                      className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0"
                    >
                      <span
                        className="text-xs font-medium min-w-[85px] tabular-nums pt-0.5 text-gray-500"
                        style={isUpcoming ? { color: '#818cf8', fontWeight: 600 } : undefined}
                      >
                        {format(new Date(concert.date + 'T00:00:00'), 'dd MMM yyyy')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{concert.city}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleVenueClick(concert.venue)
                          }}
                          className="text-xs text-white hover:text-[#6366f1] underline decoration-1 underline-offset-2 text-left transition-colors touchable-subtle"
                          aria-label={`View ${concert.venue} in venues scene`}
                        >
                          {concert.venue}
                        </button>
                      </div>
                      {isUpcoming ? (
                        <div className="flex-shrink-0 pt-0.5">
                          <UpcomingBadge size="sm" />
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSetlistClick(concert)}
                          className="flex items-center gap-1 text-xs font-medium text-[#22c55e] hover:text-[#4ade80] transition-colors flex-shrink-0 py-1"
                          aria-label={`View setlist for ${concert.venue}`}
                        >
                          <Music size={14} />
                          <span>Setlist</span>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Upcoming Tab */}
          {activeTab === 'upcoming' && (
            <div className="p-4">
              {/* Section Label */}
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={18} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Upcoming Shows
                </span>
              </div>

              {isLoadingTourDates ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Loading tour dates...</p>
                </div>
              ) : tourDatesError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">{tourDatesError}</p>
                </div>
              ) : tourDates && tourDates.length > 0 ? (
                <ul className="space-y-1">
                  {tourDates.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0"
                    >
                      <span className="text-xs text-gray-500 font-medium min-w-[85px] tabular-nums pt-0.5">
                        {format(new Date(event.datetime), 'dd MMM yyyy')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          {event.venue.city}{event.venue.region ? `, ${event.venue.region}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">{event.venue.name}</p>
                      </div>
                      {(event.offers?.[0]?.url || event.url) && (
                        <a
                          href={event.offers?.[0]?.url || event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#a3a3a3] hover:text-[#1DB954] transition-colors flex-shrink-0"
                          onClick={() => haptics.light()}
                        >
                          Tickets
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No upcoming shows</p>
                </div>
              )}

              {/* Ticketmaster attribution */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-[11px] text-gray-600">via Ticketmaster</p>
              </div>
            </div>
          )}

          {/* Top Tracks Tab */}
          {activeTab === 'tracks' && (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <AudioPreviewPanel artist={artist} isPhone={true} />
            </div>
          )}
        </div>

        {/* Setlist Overlay */}
        {showSetlistOverlay && selectedConcert && (
          <SetlistOverlay
            concert={selectedConcert}
            artistName={artist.name}
            artistSlug={artist.normalizedName}
            setlist={setlistData}
            isLoading={isLoadingSetlist}
            error={setlistError}
            onClose={handleCloseSetlist}
            reducedMotion={reducedMotion}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Setlist Overlay - Slides from right
 */
interface SetlistOverlayProps {
  concert: ArtistConcert
  artistName: string
  /** Normalized artist name — the `artist` value in the share link (#196) */
  artistSlug: string
  setlist: Setlist | null
  isLoading: boolean
  error: string | null
  onClose: () => void
  reducedMotion?: boolean
}

function SetlistOverlay({
  concert,
  artistName,
  artistSlug,
  setlist,
  isLoading,
  error,
  onClose,
  reducedMotion = false
}: SetlistOverlayProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  // Open animation
  useEffect(() => {
    if (reducedMotion) {
      setIsVisible(true)
    } else {
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    }
  }, [reducedMotion])

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)

    if (reducedMotion) {
      onClose()
      return
    }

    setTimeout(() => {
      onClose()
    }, 250)
  }, [isClosing, onClose, reducedMotion])

  // Swipe gestures (right to close, down to close)
  useEffect(() => {
    if (!overlayRef.current) return

    const overlay = overlayRef.current

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const SWIPE_THRESHOLD = 100
      const deltaX = e.changedTouches[0].clientX - touchStartX.current
      const deltaY = e.changedTouches[0].clientY - touchStartY.current

      // Swipe right or swipe down to close
      if (deltaX > SWIPE_THRESHOLD || deltaY > SWIPE_THRESHOLD) {
        haptics.light()
        handleClose()
      }
    }

    overlay.addEventListener('touchstart', handleTouchStart, { passive: true })
    overlay.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      overlay.removeEventListener('touchstart', handleTouchStart)
      overlay.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleClose])

  // #196 — phone shares via the OS sheet when available, clipboard otherwise.
  const { share, status: shareStatus } = useShareSetlistLink({
    artistSlug,
    date: concert.date,
    artistName,
    venue: concert.venue,
    isPhone: true
  })

  // The overlay renders one of four things: a skeleton, an error, "No setlist
  // available", or the setlist. Only the last one is shareable — a link
  // promising a setlist would be a lie in the other three.
  const canShare = !isLoading && !error && !!setlist

  // Count total songs
  let totalSongs = 0
  if (setlist?.sets?.set) {
    for (const set of setlist.sets.set) {
      totalSongs += set.song.length
    }
  }

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 bg-[#1a1a1a] z-20 flex flex-col ${
        reducedMotion ? '' : 'transition-transform duration-300 ease-out'
      } ${
        isVisible && !isClosing ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xs font-semibold text-[#1DB954] uppercase tracking-wider mb-1">
              Setlist
            </h3>
            <p className="text-sm text-gray-400">
              {artistName} · {concert.venue}
            </p>
            <p className="text-xs text-gray-500">
              {format(new Date(concert.date + 'T00:00:00'), 'MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-start gap-1 -mr-2 -mt-2">
            {/* Share (#196). stopPropagation matters here: the overlay root
                listens for a right-swipe to close, and this control sits in
                the corner where that gesture starts. */}
            {canShare && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  share()
                }}
                className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white active:text-[#1DB954] transition-colors"
                aria-label={`Share link to this setlist — ${artistName} at ${concert.venue}`}
              >
                {shareStatus === 'copied' ? (
                  <Check size={22} className="text-[#1DB954]" />
                ) : shareStatus === 'error' ? (
                  <AlertTriangle size={22} />
                ) : (
                  <Share2 size={22} />
                )}
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              aria-label="Close setlist"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-3 bg-gray-800 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                <div className="h-2.5 bg-gray-800 rounded animate-pulse" style={{ width: `${40 + Math.random() * 20}%` }} />
              </div>
            ))}
            <p className="text-xs text-gray-500 text-center mt-4">Loading setlist...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-4xl mb-4">⚠️</p>
            <p className="text-sm text-white mb-2">Unable to load setlist</p>
            <p className="text-xs text-gray-500">{error}</p>
          </div>
        )}

        {!isLoading && !error && !setlist && (
          <div className="text-center py-8">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-sm text-white mb-2">No setlist available</p>
            <p className="text-xs text-gray-500">for this concert</p>
            <p className="text-xs text-gray-600 mt-4 max-w-[280px] mx-auto">
              Setlists are community-contributed and may not exist for all shows.
            </p>
          </div>
        )}

        {!isLoading && !error && setlist && (
          <div className="space-y-5">
            {/* Tour info */}
            {setlist.tour?.name && (
              <p className="text-xs text-gray-500 italic">{setlist.tour.name}</p>
            )}

            {/* Show notes */}
            {setlist.info && (
              <p className="text-sm text-gray-400 italic">"{setlist.info}"</p>
            )}

            {/* Sets */}
            {setlist.sets?.set?.map((set, setIdx) => {
              let setName = 'SET'
              if (set.encore) {
                setName = set.encore === 1 ? 'ENCORE' : `ENCORE ${set.encore}`
              } else if (set.name) {
                setName = set.name.toUpperCase()
              } else if (setlist.sets.set.length > 1 && !set.encore) {
                setName = `SET ${setIdx + 1}`
              }

              return (
                <div key={setIdx} className="space-y-2">
                  <h4 className="text-xs font-bold text-[#1DB954] uppercase tracking-wider">
                    {setName}
                  </h4>
                  <ol className="space-y-1.5">
                    {set.song.map((song, songIdx) => (
                      <li key={songIdx} className="flex items-baseline gap-3 text-sm text-white">
                        <span className="text-xs text-gray-500 min-w-[20px] tabular-nums">
                          {songIdx + 1}.
                        </span>
                        <span className="flex-1">
                          {song.name}
                          {song.cover && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({song.cover.name} cover)
                            </span>
                          )}
                          {song.with && (
                            <span className="text-xs text-gray-500 ml-2">
                              (with {song.with.name})
                            </span>
                          )}
                          {song.tape && (
                            <span className="text-xs text-gray-500 ml-2">(tape)</span>
                          )}
                          {song.info && (
                            <span className="text-xs text-gray-500 block ml-[32px] mt-0.5">
                              {song.info}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )
            })}

            {/* Attribution */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <p className="text-[11px] text-gray-600">via setlist.fm</p>
              {totalSongs > 0 && (
                <p className="text-[11px] text-gray-600">
                  {totalSongs} {totalSongs === 1 ? 'song' : 'songs'}
                </p>
              )}
            </div>

            {setlist.url && (
              <a
                href={setlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#1DB954] hover:underline inline-block"
              >
                View on setlist.fm →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
