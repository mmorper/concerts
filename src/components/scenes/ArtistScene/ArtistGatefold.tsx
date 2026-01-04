import { useEffect, useRef, useState } from 'react'
import { getGenreColor } from '../../../constants/colors'
import { ConcertHistoryPanel } from './ConcertHistoryPanel'
import { SpotifyPanel } from './SpotifyPanel'
import { LinerNotesPanel } from './LinerNotesPanel'
import { fetchSetlist } from '../../../services/setlistfm'
import type { ArtistCard, ArtistConcert } from './types'
import type { Setlist } from '../../../types/setlist'

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

  // Liner notes state
  const [selectedConcert, setSelectedConcert] = useState<ArtistConcert | null>(null)
  const [setlistData, setSetlistData] = useState<Setlist | null>(null)
  const [isLoadingSetlist, setIsLoadingSetlist] = useState(false)
  const [setlistError, setSetlistError] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const flyingTileRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Cover image loading state - must be before early return
  const [coverImageLoaded, setCoverImageLoaded] = useState(false)

  // Get positioning functions
  const getClosedPosition = () => ({
    left: (window.innerWidth - CLOSED_WIDTH) / 2,
    top: (window.innerHeight - PANEL_SIZE) / 2
  })

  const getOpenPosition = () => ({
    left: (window.innerWidth - OPEN_WIDTH) / 2 + PANEL_SIZE, // +400 because cover opens to left
    top: (window.innerHeight - PANEL_SIZE) / 2
  })

  // Open animation sequence
  useEffect(() => {
    if (!artist || !clickedTileRect) return

    const openGatefold = async () => {
      setIsAnimating(true)
      const closedPos = getClosedPosition()
      const openPos = getOpenPosition()

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

        // Step 2: Animate tile to center (500ms)
        tile.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        tile.style.left = `${closedPos.left}px`
        tile.style.top = `${closedPos.top}px`
        tile.style.width = `${PANEL_SIZE}px`
        tile.style.height = `${PANEL_SIZE}px`
        tile.style.fontSize = '8rem'
        tile.style.borderRadius = '4px'
        tile.style.boxShadow = '0 25px 50px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.3)'
      }

      // Step 3: After tile arrives (500ms), hide flying tile and show gatefold
      await new Promise(resolve => setTimeout(resolve, 500))

      setShowFlyingTile(false)

      // Position wrapper at closed position (where flying tile ended)
      if (wrapperRef.current) {
        const wrapper = wrapperRef.current
        wrapper.style.left = `${closedPos.left}px`
        wrapper.style.top = `${closedPos.top}px`
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
        wrapper.style.transition = 'left 0.8s cubic-bezier(0.4, 0, 0.2, 1), top 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
        wrapper.style.left = `${openPos.left}px`
        wrapper.style.top = `${openPos.top}px`

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

  // Handle setlist click from concert row
  const handleSetlistClick = async (concert: ArtistConcert) => {
    // If clicking the same concert, close liner notes
    if (selectedConcert?.date === concert.date && selectedConcert?.venue === concert.venue) {
      handleCloseLinerNotes()
      return
    }

    // Set selected concert and start loading
    setSelectedConcert(concert)
    setSetlistData(null)
    setIsLoadingSetlist(true)
    setSetlistError(null)

    try {
      // Fetch setlist with static cache lookup by concert ID
      const setlist = await fetchSetlist({
        concertId: concert.concertId, // Enable static cache lookup
        artistName: artist?.name || '',
        date: concert.date,
        venueName: concert.venue,
        city: concert.city.split(',')[0].trim() // Extract city from "City, State"
      })

      setSetlistData(setlist)
    } catch (error) {
      // Handle structured errors
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

  // Close liner notes panel
  const handleCloseLinerNotes = () => {
    // Delay clearing state until after the slide-out animation completes (350ms)
    // This prevents the Spotify panel from un-dimming while the liner notes are sliding out
    setTimeout(() => {
      setSelectedConcert(null)
      setSetlistData(null)
      setSetlistError(null)
      setIsLoadingSetlist(false)
    }, 350)
  }

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
      tile.style.transition = 'none'
      tile.style.left = `${closedPos.left}px`
      tile.style.top = `${closedPos.top}px`
      tile.style.width = `${PANEL_SIZE}px`
      tile.style.height = `${PANEL_SIZE}px`
      tile.style.fontSize = '8rem'
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

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && artist) {
        // If liner notes are open, close them first
        if (selectedConcert) {
          handleCloseLinerNotes()
        } else {
          // Otherwise close the entire gatefold
          handleClose()
        }
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [artist, isAnimating, selectedConcert])

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
          className="fixed flex items-center justify-center font-sans font-semibold text-white/90 pointer-events-none"
          style={{
            background: gradient,
            zIndex: 99999
          }}
        >
          {initials}
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
              Click anywhere or press ESC to close
            </div>
          )}

          {/* Gatefold Wrapper */}
          <div
            ref={wrapperRef}
            className={`absolute ${showGatefold ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
            style={{ transformStyle: 'preserve-3d' }}
            onClick={(e) => e.stopPropagation()}
          >
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
                {/* Spine */}
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

                <SpotifyPanel artist={artist} dimmed={!!selectedConcert} />

                {/* Liner Notes Panel - slides over Spotify panel */}
                {selectedConcert && (
                  <LinerNotesPanel
                    concert={selectedConcert}
                    artistName={artist.name}
                    setlist={setlistData}
                    isLoading={isLoadingSetlist}
                    error={setlistError}
                    onClose={handleCloseLinerNotes}
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
                  {imageUrl ? (
                    <>
                      {/* Placeholder underneath while image loads */}
                      {!coverImageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {initials}
                        </div>
                      )}
                      {/* Artist image that fades in when loaded */}
                      <img
                        key={artist.name} // Force new image element for each artist
                        src={imageUrl}
                        alt={artist.name}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                          coverImageLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoad={() => setCoverImageLoaded(true)}
                        onError={() => {
                          // If image fails to load, show it immediately (will show broken image or fallback)
                          setCoverImageLoaded(true)
                        }}
                      />
                    </>
                  ) : (
                    initials
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
                  />
                </div>
              </div>
            </div>
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
