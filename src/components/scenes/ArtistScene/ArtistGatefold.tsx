import { useEffect, useRef, useState } from 'react'
import { getGenreColor } from '../../../constants/colors'
import { ConcertHistoryPanel } from './ConcertHistoryPanel'
import { SpotifyPanel } from './SpotifyPanel'
import { LinerNotesPanel } from './LinerNotesPanel'
import { TourDatesPanel } from './TourDatesPanel'
import { fetchSetlist } from '../../../services/setlistfm'
import { useTourDates } from '../../../hooks/useTourDates'
import { useGatefoldOrientation } from '../../../hooks/useGatefoldOrientation'
import { haptics } from '../../../utils/haptics'
import type { ArtistCard, ArtistConcert } from './types'
import type { Setlist } from '../../../types/setlist'
import { analytics } from '../../../services/analytics'

// Active panel type - only one panel can be visible at a time
type ActivePanel = 'none' | 'setlist' | 'tour-dates'

interface ArtistGatefoldProps {
  artist: ArtistCard | null
  onClose: () => void
  clickedTileRect: DOMRect | null
  reducedMotion: boolean
  getArtistImage: (artistName: string) => string | undefined
}

// Constants matching prototype
const PANEL_SIZE = 400
const SPINE_WIDTH = 12
const SPINE_HEIGHT = 12 // Phone spine height
const CLOSED_WIDTH = PANEL_SIZE
const OPEN_WIDTH = PANEL_SIZE + SPINE_WIDTH + PANEL_SIZE // 812px

/**
 * Main gatefold overlay component
 * Handles flying tile animation and book-opening effect
 */
export function ArtistGatefold({
  artist,
  onClose,
  clickedTileRect,
  reducedMotion,
  getArtistImage
}: ArtistGatefoldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showFlyingTile, setShowFlyingTile] = useState(false)
  const [showGatefold, setShowGatefold] = useState(false)
  const [showCloseHint, setShowCloseHint] = useState(false)

  // Active panel state (v1.6.0) - only one panel visible at a time
  const [activePanel, setActivePanel] = useState<ActivePanel>('none')
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Liner notes state
  const [selectedConcert, setSelectedConcert] = useState<ArtistConcert | null>(null)
  const [setlistData, setSetlistData] = useState<Setlist | null>(null)
  const [isLoadingSetlist, setIsLoadingSetlist] = useState(false)
  const [setlistError, setSetlistError] = useState<string | null>(null)

  // Tour dates eager loading (v1.6.0)
  const { tourDates, tourCount, isLoading: isLoadingTourDates, error: tourDatesError } = useTourDates(
    artist?.name || null,
    { delay: 100, enabled: !!artist }
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const flyingTileRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Cover image loading state - must be before early return
  const [coverImageLoaded, setCoverImageLoaded] = useState(false)

  // Phone/desktop orientation detection (v3.2.0)
  const { isPhone, dimensions, safeAreas } = useGatefoldOrientation()

  // Phone helper functions (v3.2.0)
  const getPhonePanelHeight = () => {
    const { height } = dimensions
    const { top, bottom } = safeAreas
    return Math.floor((height - top - bottom - SPINE_HEIGHT) / 2)
  }

  const getPhoneClosedPosition = () => ({
    left: 0,
    top: dimensions.height - getPhonePanelHeight() - safeAreas.bottom,
    width: dimensions.width,
    height: getPhonePanelHeight()
  })

  const getPhoneOpenPosition = () => ({
    left: 0,
    top: safeAreas.top + getPhonePanelHeight(), // Cover bottom at spine
    width: dimensions.width,
    height: getPhonePanelHeight()
  })

  // Get positioning functions (desktop)
  const getClosedPosition = () => {
    if (isPhone) {
      const phonePos = getPhoneClosedPosition()
      return { left: phonePos.left, top: phonePos.top }
    }
    return {
      left: (window.innerWidth - CLOSED_WIDTH) / 2,
      top: (window.innerHeight - PANEL_SIZE) / 2
    }
  }

  const getOpenPosition = () => {
    if (isPhone) {
      const phonePos = getPhoneOpenPosition()
      return { left: phonePos.left, top: phonePos.top }
    }
    return {
      left: (window.innerWidth - OPEN_WIDTH) / 2 + PANEL_SIZE, // +400 because cover opens to left
      top: (window.innerHeight - PANEL_SIZE) / 2
    }
  }

  // Open animation sequence
  useEffect(() => {
    if (!artist || !clickedTileRect) return

    const openGatefold = async () => {
      setIsAnimating(true)
      const closedPos = getClosedPosition()
      const openPos = getOpenPosition()

      // Preload the image before starting animations
      const artistImage = getArtistImage(artist.name)
      const imageUrl = artistImage || artist.albumCover
      if (imageUrl) {
        const img = new Image()
        img.src = imageUrl
        img.onload = () => setCoverImageLoaded(true)
        img.onerror = () => setCoverImageLoaded(false)
      }

      if (reducedMotion) {
        // Skip animations for reduced motion
        setShowGatefold(true)
        setIsOpen(true)
        setShowCloseHint(true)

        if (wrapperRef.current) {
          wrapperRef.current.style.left = `${openPos.left}px`
          wrapperRef.current.style.top = `${openPos.top}px`
        }

        setIsAnimating(false)
        return
      }

      // Step 1: Show flying tile at original position
      setShowFlyingTile(true)

      if (flyingTileRef.current) {
        const tile = flyingTileRef.current
        tile.style.left = `${clickedTileRect.left}px`
        tile.style.top = `${clickedTileRect.top}px`
        tile.style.width = `${clickedTileRect.width}px`
        tile.style.height = `${clickedTileRect.height}px`
        tile.style.fontSize = '1.8vw'
        tile.style.borderRadius = '0'
        tile.style.transition = 'none'

        // Force reflow
        tile.offsetHeight

        // Step 2: Animate tile to closed position (500ms)
        // Phone: target size matches panel height; Desktop: 400x400
        const targetWidth = isPhone ? getPhoneClosedPosition().width : PANEL_SIZE
        const targetHeight = isPhone ? getPhoneClosedPosition().height : PANEL_SIZE
        const targetFontSize = isPhone ? '6rem' : '8rem'

        tile.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        tile.style.left = `${closedPos.left}px`
        tile.style.top = `${closedPos.top}px`
        tile.style.width = `${targetWidth}px`
        tile.style.height = `${targetHeight}px`
        tile.style.fontSize = targetFontSize
        tile.style.borderRadius = '4px'
        tile.style.boxShadow = '0 25px 50px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.3)'
      }

      // Step 3: After tile arrives (500ms), hide flying tile and show gatefold
      await new Promise(resolve => setTimeout(resolve, 500))

      setShowFlyingTile(false)

      // Position wrapper at closed position (where flying tile ended)
      if (wrapperRef.current) {
        const wrapper = wrapperRef.current
        // Phone layout uses fixed positioning at top-left (full viewport)
        if (isPhone) {
          wrapper.style.left = '0px'
          wrapper.style.top = '0px'
        } else {
          wrapper.style.left = `${closedPos.left}px`
          wrapper.style.top = `${closedPos.top}px`
        }
        wrapper.style.transition = 'none'
      }

      // Show the gatefold (still closed at center)
      setShowGatefold(true)

      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 10))

      if (wrapperRef.current) {
        const wrapper = wrapperRef.current

        // Force reflow
        wrapper.offsetHeight

        // Start animating to open position and opening cover simultaneously (800ms)
        // Phone layout doesn't move the wrapper (stays at 0,0), only desktop moves
        if (!isPhone) {
          wrapper.style.transition = 'left 0.8s cubic-bezier(0.4, 0, 0.2, 1), top 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          wrapper.style.left = `${openPos.left}px`
          wrapper.style.top = `${openPos.top}px`
        }

        // Small delay then trigger the cover opening animation
        setTimeout(() => {
          setIsOpen(true)

          // Show close hint after animations settle
          setTimeout(() => {
            setShowCloseHint(true)
            setIsAnimating(false)
          }, 600)
        }, 50)
      }
    }

    openGatefold()
  }, [artist, clickedTileRect, reducedMotion])

  // Handle setlist click from concert row (v1.6.0 - updated for activePanel)
  const handleSetlistClick = async (concert: ArtistConcert) => {
    // If clicking the same concert AND setlist is active, close it (toggle)
    if (activePanel === 'setlist' &&
        selectedConcert?.date === concert.date &&
        selectedConcert?.venue === concert.venue) {
      handleClosePanel()
      return
    }

    // If tour panel is open, trigger crossfade transition
    if (activePanel === 'tour-dates' && !isTransitioning) {
      setIsTransitioning(true)
      // Wait 100ms (crossfade overlap), then switch panels
      setTimeout(() => {
        setActivePanel('none')
        setTimeout(() => {
          openSetlistPanel(concert)
          setIsTransitioning(false)
        }, 100)
      }, 100)
      return
    }

    // Otherwise, open setlist panel normally
    openSetlistPanel(concert)
  }

  // Open setlist panel helper
  const openSetlistPanel = async (concert: ArtistConcert) => {
    // Track setlist tab view
    analytics.trackEvent('artist_tab_viewed', {
      artist_name: artist?.name || '',
      tab_name: 'setlist',
    })

    setSelectedConcert(concert)
    setSetlistData(null)
    setIsLoadingSetlist(true)
    setSetlistError(null)
    setActivePanel('setlist')

    try {
      const setlist = await fetchSetlist({
        concertId: concert.concertId,
        artistName: artist?.name || '',
        date: concert.date,
        venueName: concert.venue,
        city: concert.city.split(',')[0].trim()
      })
      setSetlistData(setlist)
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'type' in error) {
        const structuredError = error as any
        setSetlistError(structuredError.message)
      } else {
        setSetlistError('Unable to load setlist. Please try again.')
      }
    } finally {
      setIsLoadingSetlist(false)
    }
  }

  // Handle tour badge click (v1.6.0)
  const handleTourBadgeClick = () => {
    // If tour panel already open, close it (toggle)
    if (activePanel === 'tour-dates') {
      handleClosePanel()
      return
    }

    // Track tour dates tab view
    analytics.trackEvent('artist_tab_viewed', {
      artist_name: artist?.name || '',
      tab_name: 'tour-dates',
    })

    // If setlist panel is open, trigger crossfade transition
    if (activePanel === 'setlist' && !isTransitioning) {
      setIsTransitioning(true)
      // Wait 100ms (crossfade overlap), then switch panels
      setTimeout(() => {
        setActivePanel('none')
        setTimeout(() => {
          setActivePanel('tour-dates')
          setIsTransitioning(false)
        }, 100)
      }, 100)
      return
    }

    // Otherwise, open tour panel normally
    setActivePanel('tour-dates')
  }

  // Close active panel (unified handler for v1.6.0)
  const handleClosePanel = () => {
    setActivePanel('none')

    // Delay clearing state until after animation completes (350ms)
    setTimeout(() => {
      setSelectedConcert(null)
      setSetlistData(null)
      setSetlistError(null)
      setIsLoadingSetlist(false)
    }, 350)
  }

  // Legacy handler (keep for backward compatibility)
  const handleCloseLinerNotes = handleClosePanel

  // Close animation
  const handleClose = async () => {
    if (isAnimating || !artist) return

    setIsAnimating(true)
    setShowCloseHint(false)
    setIsOpen(false)

    // Close liner notes if open
    handleCloseLinerNotes()

    if (reducedMotion) {
      // Instant close for reduced motion
      onClose()
      return
    }

    const closedPos = getClosedPosition()

    // Move wrapper back to closed position while closing cover (800ms)
    if (wrapperRef.current) {
      wrapperRef.current.style.left = `${closedPos.left}px`
      wrapperRef.current.style.top = `${closedPos.top}px`
    }

    // After cover closes
    await new Promise(resolve => setTimeout(resolve, 800))

    setShowGatefold(false)

    if (clickedTileRect && flyingTileRef.current) {
      // Show flying tile at closed position
      setShowFlyingTile(true)

      const tile = flyingTileRef.current
      const startWidth = isPhone ? getPhoneClosedPosition().width : PANEL_SIZE
      const startHeight = isPhone ? getPhoneClosedPosition().height : PANEL_SIZE
      const startFontSize = isPhone ? '6rem' : '8rem'

      tile.style.transition = 'none'
      tile.style.left = `${closedPos.left}px`
      tile.style.top = `${closedPos.top}px`
      tile.style.width = `${startWidth}px`
      tile.style.height = `${startHeight}px`
      tile.style.fontSize = startFontSize
      tile.style.borderRadius = '4px'

      // Force reflow
      tile.offsetHeight

      // Animate back to grid (400ms)
      tile.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      tile.style.left = `${clickedTileRect.left}px`
      tile.style.top = `${clickedTileRect.top}px`
      tile.style.width = `${clickedTileRect.width}px`
      tile.style.height = `${clickedTileRect.height}px`
      tile.style.fontSize = '1.8vw'
      tile.style.borderRadius = '0'
      tile.style.boxShadow = 'none'

      await new Promise(resolve => setTimeout(resolve, 400))
    }

    onClose()
  }

  // Touch handlers for swipe-to-close (v3.2.0 - phone only)
  // Using useEffect with native events to enable passive listeners for better scroll performance
  useEffect(() => {
    if (!isPhone || !overlayRef.current) return

    const overlay = overlayRef.current
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!artist) return

      const SWIPE_THRESHOLD = 100 // pixels
      const touchEndY = e.changedTouches[0].clientY
      const deltaY = touchEndY - touchStartY

      // Swipe down detected
      if (deltaY > SWIPE_THRESHOLD) {
        haptics.light()
        handleClose()
      }
    }

    // Add passive listeners for better scroll performance
    overlay.addEventListener('touchstart', handleTouchStart, { passive: true })
    overlay.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      overlay.removeEventListener('touchstart', handleTouchStart)
      overlay.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isPhone, artist, handleClose])

  // Handle ESC key (v1.6.0 - updated for activePanel)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && artist) {
        // If any panel is open, close it first
        if (activePanel !== 'none') {
          handleClosePanel()
        } else {
          // Otherwise close the entire gatefold
          handleClose()
        }
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [artist, isAnimating, activePanel])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isOpen && !isAnimating && wrapperRef.current) {
        const openPos = getOpenPosition()
        wrapperRef.current.style.transition = 'none'
        wrapperRef.current.style.left = `${openPos.left}px`
        wrapperRef.current.style.top = `${openPos.top}px`
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, isAnimating])

  // Reset cover image loaded state when artist changes
  useEffect(() => {
    setCoverImageLoaded(false)
  }, [artist?.name])

  if (!artist) return null

  const genreColor = getGenreColor(artist.primaryGenre)
  const gradient = `linear-gradient(135deg, ${genreColor} 0%, ${adjustColor(genreColor, -30)} 100%)`
  const initials = getArtistInitials(artist.name)

  // Unified image sourcing: artist photo → album cover → placeholder
  const artistImage = getArtistImage(artist.name)
  const imageUrl = artistImage || artist.albumCover

  return (
    <>
      {/* Flying Tile */}
      {showFlyingTile && (
        <div
          ref={flyingTileRef}
          className="fixed flex items-center justify-center font-sans font-semibold text-white/90 pointer-events-none overflow-hidden"
          style={{
            background: gradient,
            zIndex: 99999
          }}
        >
          {/* Always show initials as base */}
          <div className="absolute inset-0 flex items-center justify-center">
            {initials}
          </div>
          {/* Show image if loaded */}
          {imageUrl && coverImageLoaded && (
            <img
              src={imageUrl}
              alt={artist.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>
      )}

      {/* Gatefold Overlay */}
      {showGatefold && (
        <div
          ref={overlayRef}
          className="fixed inset-0 pointer-events-auto"
          style={{
            zIndex: 99998,
            perspective: '2000px'
          }}
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${artist.name} details`}
        >
          {/* Close Hint */}
          {showCloseHint && (
            <div
              className="fixed bottom-20 left-1/2 -translate-x-1/2 font-sans text-xs text-white/50 uppercase tracking-widest whitespace-nowrap transition-opacity duration-300"
              style={{ zIndex: 100000 }}
              aria-live="polite"
            >
              {isPhone ? 'Tap or swipe down to close' : 'Click anywhere or press ESC to close'}
            </div>
          )}

          {/* Gatefold Wrapper */}
          <div
            ref={wrapperRef}
            className={`${isPhone ? '' : 'absolute'} ${showGatefold ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
            style={{ transformStyle: 'preserve-3d' }}
            onClick={(e) => e.stopPropagation()}
          >
            {!isPhone ? (
              /* ============ DESKTOP LAYOUT (Horizontal) ============ */
              <div
                className="flex relative"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Right Panel (Spotify) - revealed by cover opening */}
                <div
                  className={`transform-gpu transition-transform duration-800 ${
                    isOpen ? 'rotate-y-[-15deg]' : 'rotate-y-0'
                  }`}
                  style={{
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'left center',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {/* Vertical Spine (Desktop) */}
                  <div
                    className={`absolute left-[-6px] top-0 w-[12px] h-[400px] rounded-sm transition-opacity duration-400 ${
                      isOpen ? 'opacity-100 delay-300' : 'opacity-0'
                    }`}
                    style={{
                      background: 'linear-gradient(to right, #0a0a0a 0%, #1a1a1a 20%, #0a0a0a 50%, #1a1a1a 80%, #0a0a0a 100%)',
                      boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.8)',
                      zIndex: 15
                    }}
                  >
                    <div
                      className="absolute top-2.5 bottom-2.5 left-1/2 w-0.5 -translate-x-1/2"
                      style={{
                        background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 10%, rgba(0,0,0,0.6) 90%, transparent 100%)'
                      }}
                    />
                  </div>

                  <SpotifyPanel artist={artist} />

                  {/* Liner Notes Panel - slides from left (desktop) */}
                  {activePanel === 'setlist' && selectedConcert && (
                    <LinerNotesPanel
                      concert={selectedConcert}
                      artistName={artist.name}
                      setlist={setlistData}
                      isLoading={isLoadingSetlist}
                      error={setlistError}
                      onClose={handleClosePanel}
                    />
                  )}

                  {/* Tour Dates Panel - slides from left (desktop) */}
                  {activePanel === 'tour-dates' && (
                    <TourDatesPanel
                      artistName={artist.name}
                      tourDates={tourDates}
                      isLoading={isLoadingTourDates}
                      error={tourDatesError}
                      onClose={handleClosePanel}
                    />
                  )}
                </div>

                {/* Cover (opens to become left panel) */}
                <div
                  className={`absolute top-0 left-0 transform-gpu transition-transform duration-800 ${
                    isOpen ? 'rotate-y-[-165deg]' : 'rotate-y-0'
                  }`}
                  style={{
                    width: PANEL_SIZE,
                    height: PANEL_SIZE,
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'left center',
                    zIndex: 20,
                    cursor: 'pointer',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {/* Front of cover (album art) */}
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded text-[8rem] font-sans font-semibold text-white/90 overflow-hidden"
                    style={{
                      background: gradient,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    {!coverImageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {initials}
                      </div>
                    )}
                    {imageUrl && (
                      <img
                        key={artist.name}
                        src={imageUrl}
                        alt={artist.name}
                        className={`absolute inset-0 w-full h-full object-cover ${
                          coverImageLoaded ? 'opacity-100' : 'opacity-0 transition-opacity duration-300'
                        }`}
                        onLoad={() => setCoverImageLoaded(true)}
                        onError={() => setCoverImageLoaded(false)}
                      />
                    )}
                  </div>

                  {/* Back of cover (concert history) */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)'
                    }}
                  >
                    <ConcertHistoryPanel
                      artist={artist}
                      onSetlistClick={handleSetlistClick}
                      openSetlistConcert={selectedConcert}
                      tourCount={tourCount}
                      isTourPanelActive={activePanel === 'tour-dates'}
                      onTourBadgeClick={handleTourBadgeClick}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ============ PHONE LAYOUT (Vertical) ============ */
              <div
                className="flex flex-col relative"
                style={{ transformStyle: 'preserve-3d', width: getPhoneClosedPosition().width, height: '100vh' }}
              >
                {/* Top Panel (Concert History) - revealed by cover opening */}
                <div
                  className={`flex-1 transform-gpu transition-transform duration-800 ${
                    isOpen ? 'rotate-x-[-15deg]' : 'rotate-x-0'
                  } origin-center-bottom`}
                  style={{
                    transformStyle: 'preserve-3d',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <ConcertHistoryPanel
                    artist={artist}
                    onSetlistClick={handleSetlistClick}
                    openSetlistConcert={selectedConcert}
                    tourCount={tourCount}
                    isTourPanelActive={activePanel === 'tour-dates'}
                    onTourBadgeClick={handleTourBadgeClick}
                    isPhone={true}
                  />

                  {/* Liner Notes Panel - slides from top (phone) */}
                  {activePanel === 'setlist' && selectedConcert && (
                    <LinerNotesPanel
                      concert={selectedConcert}
                      artistName={artist.name}
                      setlist={setlistData}
                      isLoading={isLoadingSetlist}
                      error={setlistError}
                      onClose={handleClosePanel}
                      isPhone={true}
                    />
                  )}

                  {/* Tour Dates Panel - slides from top (phone) */}
                  {activePanel === 'tour-dates' && (
                    <TourDatesPanel
                      artistName={artist.name}
                      tourDates={tourDates}
                      isLoading={isLoadingTourDates}
                      error={tourDatesError}
                      onClose={handleClosePanel}
                      isPhone={true}
                    />
                  )}
                </div>

                {/* Horizontal Spine (Phone) */}
                <div
                  className={`relative transition-opacity duration-400 ${
                    isOpen ? 'opacity-100 delay-300' : 'opacity-0'
                  }`}
                  style={{
                    height: SPINE_HEIGHT,
                    width: '100%',
                    background: 'linear-gradient(to bottom, #0a0a0a 0%, #1a1a1a 20%, #0a0a0a 50%, #1a1a1a 80%, #0a0a0a 100%)',
                    boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.8)',
                    zIndex: 15
                  }}
                >
                  <div
                    className="absolute left-2.5 right-2.5 top-1/2 h-0.5 -translate-y-1/2"
                    style={{
                      background: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 10%, rgba(0,0,0,0.6) 90%, transparent 100%)'
                    }}
                  />
                </div>

                {/* Bottom Panel (Spotify) */}
                <div
                  className={`flex-1 transform-gpu transition-transform duration-800 ${
                    isOpen ? 'rotate-x-15' : 'rotate-x-0'
                  } origin-center-top`}
                  style={{
                    transformStyle: 'preserve-3d',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <SpotifyPanel artist={artist} isPhone={true} />
                </div>

                {/* Cover (opens upward from bottom half) */}
                <div
                  className={`absolute transform-gpu transition-transform duration-800 ${
                    isOpen ? 'rotate-x-165' : 'rotate-x-0'
                  } origin-center-bottom`}
                  style={{
                    width: '100%',
                    height: getPhonePanelHeight(),
                    bottom: 0,
                    left: 0,
                    transformStyle: 'preserve-3d',
                    zIndex: 20,
                    cursor: 'pointer',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {/* Front of cover (album art) */}
                  <div
                    className="absolute inset-0 flex items-center justify-center text-[6rem] font-sans font-semibold text-white/90 overflow-hidden"
                    style={{
                      background: gradient,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    {!coverImageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {initials}
                      </div>
                    )}
                    {imageUrl && (
                      <img
                        key={artist.name}
                        src={imageUrl}
                        alt={artist.name}
                        className={`absolute inset-0 w-full h-full object-cover ${
                          coverImageLoaded ? 'opacity-100' : 'opacity-0 transition-opacity duration-300'
                        }`}
                        onLoad={() => setCoverImageLoaded(true)}
                        onError={() => setCoverImageLoaded(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Get artist initials for display
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
