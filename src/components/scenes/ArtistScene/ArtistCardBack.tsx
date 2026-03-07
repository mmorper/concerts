import { format } from 'date-fns'
import type { ArtistCard } from './types'

interface ArtistCardBackProps {
  artist: ArtistCard
}

/**
 * Back of the artist card - shows concert history and Spotify info
 * Size: 200px (same as front, will be scaled to 400px via transform)
 */
export function ArtistCardBack({ artist }: ArtistCardBackProps) {
  // Back must be same size as front (200px) - scaling is done via transform
  const dimension = 'w-[200px] h-[200px]'
  const sizes = {
    name: 'text-sm',       // Artist name - will be ~28px at 2x scale
    times: 'text-[10px]',  // "Seen X times" - will be ~20px at 2x scale
    concert: 'text-[9px]'  // Concert list items - will be ~18px at 2x scale
  }

  return (
    <div
      className={`${dimension} bg-white p-2 flex flex-col overflow-hidden border border-gray-300`}
      style={{
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Header */}
      <div className="mb-1.5 pb-1.5 border-b border-gray-200">
        <h3 className={`${sizes.name} font-sans font-semibold text-gray-900 leading-tight truncate`}>
          {artist.name}
        </h3>
        <p className={`${sizes.times} text-gray-500 mt-0.5`}>
          Seen {artist.timesSeen} {artist.timesSeen === 1 ? 'time' : 'times'}
        </p>
      </div>

      {/* Concert List - Scrollable with comfortable spacing */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <div className="space-y-0.5">
          {artist.concerts.map((concert, idx) => (
            <div key={idx} className="text-gray-700">
              <div className={`${sizes.concert} font-medium`}>
                {format(new Date(concert.date + 'T00:00:00'), 'MMM yyyy')}
              </div>
              <div className={`${sizes.concert} text-gray-500`}>{concert.venue}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Spotify Section */}
      <div className="mt-1.5 pt-1.5 border-t border-gray-200">
        {artist.spotifyArtistUrl ? (
          <a
            href={artist.spotifyArtistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${sizes.concert} text-green-600 hover:text-green-700 font-medium flex items-center gap-2`}
            onClick={e => e.stopPropagation()}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Open in Spotify
          </a>
        ) : (
          <div className={`${sizes.concert} text-gray-400 italic`}>
            Coming soon with Spotify
          </div>
        )}
      </div>
    </div>
  )
}
