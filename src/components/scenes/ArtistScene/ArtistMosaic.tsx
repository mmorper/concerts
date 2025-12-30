import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArtistCard } from './ArtistCard'
import { sortArtistCards } from './useArtistData'
import type { ArtistCard as ArtistCardType, SortOrder } from './types'

interface ArtistMosaicProps {
  artists: ArtistCardType[]
  sortOrder: SortOrder
  showFrequencyBadge: boolean // Show badge when Weighted sort is active
  onArtistCountUpdate?: (count: number) => void
  onCardClick: (artist: ArtistCardType, rect: DOMRect) => void
  openArtistName?: string
}

const INITIAL_LOAD = 100
const BATCH_SIZE = 50

/**
 * Responsive mosaic grid with lazy loading and gatefold overlay
 */
export function ArtistMosaic({
  artists,
  sortOrder,
  showFrequencyBadge,
  onArtistCountUpdate,
  onCardClick,
  openArtistName
}: ArtistMosaicProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Report artist count to parent
  useEffect(() => {
    onArtistCountUpdate?.(artists.length)
  }, [artists.length, onArtistCountUpdate])

  // Sort artists (all uniform size now)
  const processedArtists = useMemo(() => {
    return sortArtistCards(artists, sortOrder)
  }, [artists, sortOrder])

  // Lazy loading with Intersection Observer
  useEffect(() => {
    if (!sentinelRef.current) return
    if (visibleCount >= processedArtists.length) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + BATCH_SIZE, processedArtists.length))
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [visibleCount, processedArtists.length])

  // Reset visible count when sort changes
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD)
  }, [sortOrder])

  const visibleArtists = processedArtists.slice(0, visibleCount)
  const hasMore = visibleCount < processedArtists.length

  return (
    <>
      {/* Mosaic Grid */}
      <div
        ref={containerRef}
        className={`w-full h-full overflow-y-auto pb-32 transition-opacity duration-400 transition-filter duration-400 ${
          openArtistName ? 'opacity-30 blur-md' : 'opacity-100 blur-0'
        }`}
        style={{ transition: 'opacity 0.4s ease, filter 0.4s ease' }}
      >
        {/* Flexbox Container - Centered horizontally, NO GAPS */}
        <motion.div
          layout
          className="w-full flex flex-wrap justify-center"
          style={{
            gap: 0,
            margin: 0
          }}
        >
          <AnimatePresence mode="popLayout">
            {visibleArtists.map((artist, index) => (
              <motion.div
                key={artist.normalizedName}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(index * 0.03, 1)
                }}
                className="relative flex-shrink-0"
                style={{
                  // Hide the tile that's been clicked while gatefold is open
                  visibility: openArtistName === artist.normalizedName ? 'hidden' : 'visible'
                }}
              >
                {/* Frequency Badge (TOS-compliant: outside album art) */}
                {showFrequencyBadge && artist.timesSeen > 1 && (
                  <div className="absolute -top-2 -right-2 z-10 bg-violet-600 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                    ×{artist.timesSeen}
                  </div>
                )}
                <ArtistCard
                  artist={artist}
                  onClick={(rect) => onCardClick(artist, rect)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Loading Sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="h-20 flex items-center justify-center mt-8">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        {/* End of List Message */}
        {!hasMore && visibleArtists.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gray-400 text-sm mt-12 mb-8"
          >
            {processedArtists.length} artists loaded
          </motion.div>
        )}
      </div>
    </>
  )
}
