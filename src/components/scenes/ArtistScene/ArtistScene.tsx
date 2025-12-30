import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArtistMosaic } from './ArtistMosaic'
import { ArtistGatefold } from './ArtistGatefold'
import { useArtistData } from './useArtistData'
import type { Concert } from '../../../types/concert'
import type { SortOrder, ArtistCard } from './types'

interface ArtistSceneProps {
  concerts: Concert[]
}

/**
 * Main Artist Scene container
 * Album mosaic visualization with flip cards
 */
export function ArtistScene({ concerts }: ArtistSceneProps) {
  const { artistCards, isLoading } = useArtistData(concerts)
  const [sortOrder, setSortOrder] = useState<SortOrder>('alphabetical') // Default: A-Z
  const [artistCount, setArtistCount] = useState(0)
  const [openArtist, setOpenArtist] = useState<ArtistCard | null>(null)
  const [clickedTileRect, setClickedTileRect] = useState<DOMRect | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Show frequency badge only when sorted by timesSeen (Weighted)
  const showFrequencyBadge = sortOrder === 'timesSeen'

  const handleCardClick = (artist: ArtistCard, rect: DOMRect) => {
    setOpenArtist(artist)
    setClickedTileRect(rect)
  }

  const handleCloseGatefold = () => {
    setOpenArtist(null)
    setClickedTileRect(null)
  }

  if (isLoading) {
    return (
      <motion.section
        className="h-screen flex items-center justify-center bg-stone-50 snap-start snap-always"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false, margin: '-20%' }}
        transition={{ duration: 0.8 }}
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" />
          </div>
          <p className="font-sans text-lg text-gray-500">Loading artist data...</p>
        </div>
      </motion.section>
    )
  }

  const totalConcerts = concerts.length

  return (
    <motion.section
      className="h-screen flex flex-col items-center justify-center bg-stone-50 snap-start snap-always relative overflow-hidden"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
    >
      {/* Header - Centered like other scenes */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0 }}
        className="absolute top-20 left-0 right-0 z-20 text-center px-8"
      >
        <h2
          className="font-serif text-5xl md:text-7xl text-white mb-3 tracking-tight"
          style={{ textShadow: '0 2px 20px rgba(0, 0, 0, 0.3)' }}
        >
          The Artists
        </h2>
        <p
          className="font-sans text-lg md:text-xl text-white/85 mb-6"
          style={{ textShadow: '0 2px 20px rgba(0, 0, 0, 0.3)' }}
        >
          {artistCount} artists · {totalConcerts} concerts
        </p>

        {/* Control Buttons */}
        <div className="flex justify-center gap-2 flex-wrap">
          {/* A-Z Button */}
          <button
            onClick={() => setSortOrder('alphabetical')}
            className={`font-sans px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              sortOrder === 'alphabetical'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            A–Z
          </button>

          {/* Genre Button */}
          <button
            onClick={() => setSortOrder('genre')}
            className={`font-sans px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              sortOrder === 'genre'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Genre
          </button>

          {/* Weighted Button */}
          <button
            onClick={() => setSortOrder('timesSeen')}
            className={`font-sans px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              sortOrder === 'timesSeen'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Weighted
          </button>
        </div>
      </motion.div>

      {/* Gradient vignette for header legibility */}
      <div
        className="absolute inset-x-0 top-0 h-[35vh] pointer-events-none z-10"
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.7) 0%,
            rgba(0, 0, 0, 0.5) 30%,
            rgba(0, 0, 0, 0.2) 60%,
            rgba(0, 0, 0, 0) 100%
          )`
        }}
        aria-hidden="true"
      />

      {/* Mosaic Grid */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 1, delay: 0.2 }}
        className="w-full h-full z-0"
      >
        <ArtistMosaic
          artists={artistCards}
          sortOrder={sortOrder}
          showFrequencyBadge={showFrequencyBadge}
          onArtistCountUpdate={setArtistCount}
          onCardClick={handleCardClick}
          openArtistName={openArtist?.normalizedName}
        />
      </motion.div>

      {/* Footer Instructions */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute bottom-20 left-0 right-0 z-10 text-center"
      >
        <p className="font-sans text-xs text-gray-500 font-medium uppercase tracking-widest">
          Click to flip · Press ESC to close
        </p>
      </motion.div>

      {/* Spotify Attribution */}
      {artistCards.some(a => a.spotifyArtistUrl) && (
        <motion.div
          className="absolute bottom-2 right-4 z-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <a
            href="https://www.spotify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span>Data from</span>
            <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </a>
        </motion.div>
      )}

      {/* Gatefold Overlay - Rendered at scene level to escape stacking context */}
      {openArtist && (
        <ArtistGatefold
          artist={openArtist}
          onClose={handleCloseGatefold}
          clickedTileRect={clickedTileRect}
          reducedMotion={reducedMotion}
        />
      )}
    </motion.section>
  )
}
