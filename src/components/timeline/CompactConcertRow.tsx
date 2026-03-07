import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Concert } from '@/types/concert'

interface CompactConcertRowProps {
  concert: Concert
  onMapFocus?: (concert: Concert) => void
}

export function CompactConcertRow({ concert, onMapFocus }: CompactConcertRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const date = new Date(concert.date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="border-b border-gray-900 hover:bg-gray-950/50 transition-colors">
      {/* Compact Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={() => onMapFocus?.(concert)}
        className="w-full px-4 py-2 text-left flex items-center gap-3 text-sm"
      >
        <span className="text-gray-500 font-mono text-xs w-24 shrink-0">{formattedDate}</span>
        <span className="font-semibold text-white truncate flex-1">{concert.headliner}</span>
        <span className="text-gray-400 truncate w-32 shrink-0">{concert.venue}</span>
        <span className="text-gray-500 text-xs w-16 shrink-0">{concert.cityState.split(',')[1]?.trim()}</span>
        <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded">{concert.genre}</span>
        {concert.openers.length > 0 && (
          <span className="text-gray-500 text-xs">+{concert.openers.length}</span>
        )}
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 bg-gray-950 border-t border-gray-900">
              <div className="flex gap-4">
                {/* Artist Image */}
                {concert.headlinerImage && (
                  <img
                    src={concert.headlinerImage}
                    alt={concert.headliner}
                    className="w-20 h-20 object-cover rounded"
                  />
                )}

                <div className="flex-1 space-y-2">
                  <div>
                    <h4 className="text-lg font-bold text-white">{concert.headliner}</h4>
                    <p className="text-sm text-gray-400">
                      {concert.venue} · {concert.cityState}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{concert.genre}</p>
                  </div>

                  {concert.openers.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Opening acts:</p>
                      <div className="flex flex-wrap gap-1">
                        {concert.openers.map((opener, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 bg-gray-900 text-gray-300 rounded"
                          >
                            {opener}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onMapFocus?.(concert)
                      }}
                      className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                    >
                      📍 Show on map
                    </button>
                    {concert.reference && (
                      <a
                        href={concert.reference}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                      >
                        🔗 Details
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
