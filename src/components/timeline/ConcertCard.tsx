import { useState } from 'react'
import type { Concert } from '@/types/concert'

interface ConcertCardProps {
  concert: Concert
}

export function ConcertCard({ concert }: ConcertCardProps) {
  const [showAllOpeners, setShowAllOpeners] = useState(false)

  const displayedOpeners = showAllOpeners ? concert.openers : concert.openers.slice(0, 3)
  const hiddenOpenersCount = concert.openers.length - 3

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
      {/* Artist image header (if available) */}
      {concert.headlinerImage && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={concert.headlinerImage}
            alt={concert.headliner}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
        </div>
      )}

      <div className="p-6">
        {/* Header with artist name and genre */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-display uppercase text-white mb-2 leading-tight">
              {concert.headliner}
            </h3>
            <span className="inline-block px-2 py-1 text-xs font-mono uppercase bg-purple-500/20 text-purple-300 rounded">
              {concert.genre}
            </span>
          </div>
        </div>

        {/* Date and venue info */}
        <div className="space-y-2 text-sm text-gray-400">
          <p className="font-mono font-semibold text-gray-300">
            {new Date(concert.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="flex items-center gap-2">
            <span>🏟️</span>
            <span>{concert.venue}</span>
          </p>
          <p className="flex items-center gap-2">
            <span>📍</span>
            <span>{concert.cityState}</span>
          </p>

          {/* Openers section */}
          {concert.openers.length > 0 && (
            <div className="pt-3 mt-3 border-t border-gray-800">
              <p className="text-xs font-mono uppercase text-gray-500 mb-2 flex items-center gap-2">
                <span>🎵</span>
                <span>Also on the bill:</span>
              </p>
              <div className="space-y-1">
                {displayedOpeners.map((opener, index) => (
                  <p key={index} className="text-gray-300">
                    • {opener}
                  </p>
                ))}
              </div>

              {/* Show more/less button for many openers */}
              {concert.openers.length > 3 && (
                <button
                  onClick={() => setShowAllOpeners(!showAllOpeners)}
                  className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                >
                  {showAllOpeners ? (
                    <>
                      <span>Show less</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>+ {hiddenOpenersCount} more</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Reference link */}
          {concert.reference && (
            <div className="pt-3 mt-3 border-t border-gray-800">
              <a
                href={concert.reference}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <span>View details</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
