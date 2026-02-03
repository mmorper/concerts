import { Music } from 'lucide-react'
import { useArtistTopTracks } from '../../../hooks/useArtistTopTracks'
import { AudioPreviewPlayer } from './AudioPreviewPlayer'
import type { ArtistCard } from './types'

interface SpotifyPanelProps {
  artist: ArtistCard
  isPhone?: boolean // v3.2.0 - Phone layout mode
}

/**
 * Right panel of gatefold - Audio preview player with top tracks
 * Size: 400×400px (desktop) or full-width panel (phone)
 */
export function SpotifyPanel({ artist, isPhone = false }: SpotifyPanelProps) {
  const { tracks, source, streamingUrl, loading, error } = useArtistTopTracks(artist.name)

  // Responsive sizing: 460px on desktop/tablet landscape (1024px+), 400px on smaller viewports
  const panelSize = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 460 : 400

  return (
    <div
      data-testid="audio-preview-panel"
      className={`flex flex-col ${isPhone ? 'w-full h-full p-6' : 'p-10'}`}
      style={{
        width: isPhone ? '100%' : `${panelSize}px`,
        height: isPhone ? '100%' : `${panelSize}px`,
        background: 'linear-gradient(145deg, #121212 0%, #181818 100%)',
        borderRadius: isPhone ? '0' : '4px',
        boxShadow: isPhone ? 'none' : '0 25px 50px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Music className="w-[18px] h-[18px] text-gray-400" />
        <span className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Top Tracks
        </span>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {loading ? (
          // Loading State
          <LoadingState />
        ) : error ? (
          // Error State
          <ErrorState message={error} />
        ) : tracks && tracks.length > 0 && source && streamingUrl ? (
          // Player State
          <AudioPreviewPlayer
            artistName={artist.name}
            tracks={tracks}
            source={source}
            streamingUrl={streamingUrl}
            isPhone={isPhone}
          />
        ) : (
          // Empty State (no data available for this artist)
          <EmptyState />
        )}
      </div>
    </div>
  )
}

/**
 * Loading state while fetching top tracks data
 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4">
        <Music className="w-6 h-6 text-gray-600" />
      </div>
      <p className="font-sans text-sm text-gray-500 mb-1">
        Track Previews
      </p>
      <p className="font-sans text-xs text-gray-600">
        Loading...
      </p>
    </div>
  )
}

/**
 * Empty state when no tracks are available for this artist
 * (Artist doesn't meet 40% preview coverage quality bar)
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Music className="w-6 h-6 text-gray-700" />
      </div>
      <p className="font-sans text-sm text-gray-500 text-center px-8">
        Track previews not available for this artist
      </p>
    </div>
  )
}

/**
 * Error state when data loading fails
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Music className="w-6 h-6 text-gray-700" />
      </div>
      <p className="font-sans text-sm text-gray-500 text-center px-8 mb-2">
        Unable to load track previews
      </p>
      <p className="font-sans text-xs text-gray-600 text-center px-8">
        {message}
      </p>
    </div>
  )
}
