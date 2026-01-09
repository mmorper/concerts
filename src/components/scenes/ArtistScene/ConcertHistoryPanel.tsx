import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Link2 } from 'lucide-react'
import { getGenreColor } from '../../../constants/colors'
import { useArtistMetadata } from '../../TimelineHoverPreview/useArtistMetadata'
import { TourBadge } from './TourBadge'
import type { ArtistCard, ArtistConcert } from './types'
import { haptics } from '../../../utils/haptics'
import { normalizeVenueName } from '../../../utils/normalize'
import { analytics } from '../../../services/analytics'

interface ConcertHistoryPanelProps {
  artist: ArtistCard
  onSetlistClick?: (concert: ArtistConcert) => void
  openSetlistConcert?: ArtistConcert | null // Currently open setlist concert
  tourCount?: number // v1.6.0 - Number of upcoming tour dates
  isTourPanelActive?: boolean // v1.6.0 - Whether tour panel is currently open
  onTourBadgeClick?: () => void // v1.6.0 - Handler for tour badge click
  isPhone?: boolean // v3.2.0 - Phone layout mode
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

  // Take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Left panel of gatefold - Concert history with dark theme
 * Displays on the inside of the opened cover (left side)
 * Size: 400×400px
 */
export function ConcertHistoryPanel({
  artist,
  onSetlistClick,
  openSetlistConcert,
  tourCount = 0,
  isTourPanelActive = false,
  onTourBadgeClick,
  isPhone = false
}: ConcertHistoryPanelProps) {
  const navigate = useNavigate()
  const { getArtistImage } = useArtistMetadata()
  const artistImage = getArtistImage(artist.name)
  const genreColor = getGenreColor(artist.primaryGenre)
  const initials = getArtistInitials(artist.name)
  const [showCopiedToast, setShowCopiedToast] = useState(false)

  // Create gradient for album art placeholder
  const gradient = `linear-gradient(135deg, ${genreColor} 0%, ${adjustColor(genreColor, -30)} 100%)`

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/?scene=artists&artist=${artist.normalizedName}`

    try {
      await navigator.clipboard.writeText(url)
      haptics.light() // Haptic feedback on successful copy
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleVenueClick = (venueName: string, concertDate: string) => {
    const normalizedVenue = normalizeVenueName(venueName)
    const normalizedArtist = artist.normalizedName

    // Track venue click
    analytics.trackEvent('venue_clicked_from_artist', {
      artist_name: artist.name,
      venue_name: venueName,
      concert_date: concertDate,
    })

    // Navigate with both venue and artist parameters for focused spotlight
    haptics.light() // Haptic feedback on venue navigation
    navigate(`/?scene=venues&venue=${normalizedVenue}&artist=${normalizedArtist}`)
  }

  return (
    <div
      className={`${isPhone ? 'w-full h-full' : 'w-[400px] h-[400px]'} flex flex-col p-8`}
      style={{
        background: 'linear-gradient(145deg, #181818 0%, #121212 100%)',
        borderRadius: '4px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Artist Header */}
      <div className="flex gap-5 mb-7 flex-shrink-0">
        {/* Artist Photo or Gradient Placeholder */}
        {artistImage ? (
          <img
            src={artistImage}
            alt={`Photo of ${artist.name}`}
            className="w-[100px] h-[100px] flex-shrink-0 object-cover object-center"
            style={{
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
            }}
          />
        ) : (
          <div
            className="w-[100px] h-[100px] flex items-center justify-center rounded flex-shrink-0"
            style={{
              background: gradient,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
            }}
          >
            <span className="font-sans text-4xl font-semibold text-white">
              {initials}
            </span>
          </div>
        )}

        {/* Artist Info */}
        <div className="flex flex-col justify-center flex-1">
          <div className="flex items-start gap-3 relative">
            <h2 className="font-serif text-3xl font-medium text-white tracking-tight leading-tight">
              {artist.name}
            </h2>
            <button
              onClick={handleCopyLink}
              className="text-white/40 hover:text-white/90 transition-colors duration-150 flex-shrink-0 p-3 -m-3 min-w-[44px] min-h-[44px] flex items-center justify-center touchable-subtle"
              aria-label={`Copy link to ${artist.name}`}
              title="Copy link"
            >
              <Link2 size={18} />
            </button>

            {/* Copy confirmation tooltip */}
            {showCopiedToast && (
              <div
                className="absolute -top-8 right-0 px-2 py-1 bg-black/90 text-white text-xs font-medium rounded shadow-lg animate-fade-in pointer-events-none"
                role="status"
                aria-live="polite"
              >
                Copied!
              </div>
            )}
          </div>
          <p className="font-sans text-sm text-[#a3a3a3] mt-2">
            {artist.primaryGenre} · {artist.timesSeen} {artist.timesSeen === 1 ? 'show' : 'shows'}
          </p>

          {/* Tour Badge (v1.6.0) - Only shows if artist has upcoming dates */}
          {tourCount > 0 && onTourBadgeClick && (
            <div className="mt-2">
              <TourBadge
                tourCount={tourCount}
                isActive={isTourPanelActive}
                onClick={onTourBadgeClick}
                show={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Concert History Section */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="font-sans text-xs font-semibold text-[#1DB954] uppercase tracking-wider mb-3.5 flex-shrink-0">
          Concert History
        </div>

        {/* Concert List - Scrollable */}
        <ul className="list-none flex flex-col gap-1.5 overflow-y-auto pr-2">
          {artist.concerts.map((concert, idx) => {
            const isSetlistOpen = openSetlistConcert?.date === concert.date &&
                                  openSetlistConcert?.venue === concert.venue

            return (
              <li
                key={idx}
                className="concert-row group flex items-start gap-4 text-xs text-[#e5e5e5] py-1.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.04] transition-colors duration-150 rounded px-2 -mx-2"
              >
                <span className="font-sans text-[#737373] font-medium min-w-[85px] flex-shrink-0 tabular-nums pt-0.5">
                  {format(new Date(concert.date), 'dd MMM yyyy')}
                </span>
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="font-sans text-[#e5e5e5]">
                    {concert.city}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleVenueClick(concert.venue, concert.date)
                    }}
                    className="font-sans text-white hover:text-[#6366f1] underline decoration-1 underline-offset-2 text-left transition-colors duration-150 touchable-subtle"
                    aria-label={`View ${concert.venue} in venues scene`}
                  >
                    {concert.venue}
                  </button>
                </div>

                {/* Inline Setlist Link - always visible if callback provided */}
                {onSetlistClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      haptics.light() // Haptic feedback on setlist open
                      onSetlistClick(concert)
                    }}
                    className={`setlist-link flex items-center gap-1.5 flex-shrink-0 transition-all duration-150 relative touchable-subtle ${
                      isSetlistOpen ? 'setlist-link-active' : ''
                    }`}
                    aria-label={`View setlist for ${concert.venue}`}
                  >
                    {/* Musical note icon */}
                    <svg
                      className="w-3.5 h-3.5 pointer-events-none"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    <span className="text-xs font-medium pointer-events-none">Setlist</span>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
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
