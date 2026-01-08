import { getGenreColor } from '../../../constants/colors'
import type { ArtistCard } from './types'

interface SpotifyPanelProps {
  artist: ArtistCard
  isPhone?: boolean // v3.2.0 - Phone layout mode
}

/**
 * Right panel of gatefold - Spotify player with skeleton state
 * Phase 1: Shows "Coming Soon" placeholder
 * Size: 400×400px (desktop) or full-width panel (phone)
 */
export function SpotifyPanel({ artist, isPhone = false }: SpotifyPanelProps) {
  const genreColor = getGenreColor(artist.primaryGenre)

  // Create gradient for track art placeholders (30% opacity)
  const placeholderColor = adjustColorOpacity(genreColor, 0.3)

  return (
    <div
      className={`flex flex-col ${isPhone ? 'w-full h-full p-6' : 'w-[400px] h-[400px] p-8'}`}
      style={{
        background: 'linear-gradient(145deg, #121212 0%, #181818 100%)',
        borderRadius: isPhone ? '0' : '4px',
        boxShadow: isPhone ? 'none' : '0 25px 50px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Spotify Section */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Section Label */}
        <div className="font-sans text-xs font-semibold text-[#1DB954] uppercase tracking-wider mb-4 flex items-center gap-2 flex-shrink-0">
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Top Tracks
        </div>

        {/* Spotify Embed Container */}
        <div className="flex-1 bg-black rounded-xl overflow-hidden min-h-0">
          <div className="w-full h-full p-4 flex flex-col gap-0.5 bg-[#121212] overflow-hidden">
            {/* Play Button */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mb-3 flex-shrink-0"
              style={{
                background: 'rgba(29, 185, 84, 0.5)',
                boxShadow: '0 4px 12px rgba(29, 185, 84, 0.3)'
              }}
            >
              <svg className="w-3.5 h-3.5 fill-black ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>

            {/* Coming Soon Message */}
            <div className="text-center py-4 flex-shrink-0">
              <p className="font-sans text-sm text-[#737373] mb-1">
                Spotify Integration
              </p>
              <p className="font-sans text-xs text-[#737373]">
                Coming Soon
              </p>
            </div>

            {/* Skeleton Track Rows */}
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className="flex items-center gap-3 p-2 rounded flex-shrink-0"
              >
                {/* Track Number */}
                <span className="font-sans text-sm text-[#a3a3a3] w-5 text-center">
                  {num}
                </span>

                {/* Track Art Placeholder */}
                <div
                  className="w-10 h-10 rounded flex-shrink-0"
                  style={{ background: placeholderColor }}
                />

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  {/* Track Name Skeleton */}
                  <div
                    className="h-3 rounded mb-1"
                    style={{
                      background: '#2a2a2a',
                      width: `${60 + Math.random() * 30}%`
                    }}
                  />
                  {/* Artist Name Skeleton */}
                  <div
                    className="h-2.5 rounded"
                    style={{
                      background: '#2a2a2a',
                      width: `${40 + Math.random() * 20}%`
                    }}
                  />
                </div>

                {/* Duration Skeleton */}
                <div
                  className="h-3 w-8 rounded"
                  style={{ background: '#2a2a2a' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Adjust color with opacity for skeleton placeholders
 */
function adjustColorOpacity(hex: string, opacity: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 0xFF
  const g = (num >> 8) & 0xFF
  const b = num & 0xFF
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
