import { format } from 'date-fns'
import { getGenreColor } from '../../../constants/colors'
import { useArtistMetadata } from '../../TimelineHoverPreview/useArtistMetadata'
import type { ArtistCard, ArtistConcert } from './types'

interface ConcertHistoryPanelProps {
  artist: ArtistCard
  onSetlistClick?: (concert: ArtistConcert) => void
  openSetlistConcert?: ArtistConcert | null // Currently open setlist concert
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
  openSetlistConcert
}: ConcertHistoryPanelProps) {
  const { getArtistImage } = useArtistMetadata()
  const artistImage = getArtistImage(artist.name)
  const genreColor = getGenreColor(artist.primaryGenre)
  const initials = getArtistInitials(artist.name)

  // Create gradient for album art placeholder
  const gradient = `linear-gradient(135deg, ${genreColor} 0%, ${adjustColor(genreColor, -30)} 100%)`

  return (
    <div
      className="w-[400px] h-[400px] flex flex-col p-8"
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
        <div className="flex flex-col justify-center">
          <h2 className="font-serif text-3xl font-medium text-white tracking-tight leading-tight mb-2">
            {artist.name}
          </h2>
          <p className="font-sans text-sm text-[#a3a3a3]">
            {artist.primaryGenre} · {artist.timesSeen} {artist.timesSeen === 1 ? 'show' : 'shows'}
          </p>
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
                className="concert-row group flex items-center gap-4 text-[0.95rem] text-[#e5e5e5] py-1.5 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.04] transition-colors duration-150 rounded px-2 -mx-2"
              >
                <span className="font-sans text-xs text-[#737373] font-medium min-w-[85px] flex-shrink-0 tabular-nums">
                  {format(new Date(concert.date), 'dd MMM yyyy')}
                </span>
                <span className="font-sans text-[#e5e5e5] flex-1">
                  {concert.venue}
                </span>

                {/* Inline Setlist Link - always visible if callback provided */}
                {onSetlistClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSetlistClick(concert)
                    }}
                    className={`setlist-link flex items-center gap-1.5 flex-shrink-0 transition-all duration-150 relative ${
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
