import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GenreTreemap } from './GenreTreemap'
import { TimelineSlider } from './TimelineSlider'
import { useTimelineAnimation } from './useTimelineAnimation'
import { haptics } from '../../../utils/haptics'
import type { Concert } from '../../../types/concert'
import { analytics } from '../../../services/analytics'

// Import timeline data type
interface GenreTimelineData {
  genres: GenreData[]
  totalShowsByYear: Record<string, number>
  milestones: MilestoneYear[]
  yearRange: { start: number; end: number }
}

interface GenreData {
  name: string
  normalizedName: string
  color: string
  showsByYear: Record<number, number>
  totalShows: number
  firstYear: number
  lastYear: number
  artists: ArtistData[]
}

interface ArtistData {
  name: string
  normalizedName: string
  showCount: number
  years: number[]
  firstYear: number
  lastYear: number
}

interface MilestoneYear {
  milestone: number
  year: number
}

interface Scene5GenresProps {
  concerts: Concert[]
}

/**
 * Get cumulative show count up to a given year
 */
function getTotalShowsAtYear(
  totalShowsByYear: Record<string, number>,
  year: number
): number {
  let count = 0
  for (const [y, shows] of Object.entries(totalShowsByYear)) {
    if (parseInt(y) <= year) {
      count += shows
    }
  }
  return count
}

/**
 * Find the dominant genre at a given year
 */
function getDominantGenre(genres: GenreData[], year: number): GenreData | null {
  let maxCount = 0
  let dominant: GenreData | null = null

  for (const genre of genres) {
    let count = 0
    for (const [y, shows] of Object.entries(genre.showsByYear)) {
      if (parseInt(y) <= year) {
        count += shows
      }
    }
    if (count > maxCount) {
      maxCount = count
      dominant = genre
    }
  }

  return dominant
}

export function Scene5Genres({ concerts: _concerts }: Scene5GenresProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [timelineData, setTimelineData] = useState<GenreTimelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // State
  const [currentYear, setCurrentYear] = useState(1984)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [view, setView] = useState<'genres' | 'artists'>('genres')
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [hoveredTile, setHoveredTile] = useState<string | null>(null)

  // Dimensions for treemap
  const [dimensions, setDimensions] = useState({ width: 720, height: 480 })

  // Load timeline data
  useEffect(() => {
    fetch('/data/genres-timeline.json')
      .then((res) => res.json())
      .then((data: GenreTimelineData) => {
        setTimelineData(data)
        setCurrentYear(data.yearRange.start)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load genres timeline data:', err)
        setIsLoading(false)
      })
  }, [])

  // Track if animation was already seen in this scene session
  // Reset on component mount to ensure animation plays every time scene is visited
  const hasSeenAnimation = useRef(false)

  // Handle year change from animation or slider
  const handleYearChange = useCallback((year: number) => {
    // Track year change (only when user manually changes, not during auto-play)
    if (hasSeenAnimation.current) {
      analytics.trackEvent('genre_timeline_changed', {
        year,
      })
    }
    setCurrentYear(year)
  }, [])

  // Handle animation complete
  const handleAnimationComplete = useCallback(() => {
    hasSeenAnimation.current = true
  }, [])

  // Timeline animation hook
  const { isPlaying, play, pause } = useTimelineAnimation({
    startYear: timelineData?.yearRange.start ?? 1984,
    endYear: timelineData?.yearRange.end ?? 2024,
    onYearChange: handleYearChange,
    onComplete: handleAnimationComplete,
    msPerYear: 120,
    initialDelay: 500,
  })

  // Start animation on first view (if not seen this session)
  const hasStartedAnimation = useRef(false)
  useEffect(() => {
    if (
      timelineData &&
      !hasSeenAnimation.current &&
      !hasStartedAnimation.current &&
      !hasInteracted
    ) {
      hasStartedAnimation.current = true
      // Small delay to ensure component is mounted
      setTimeout(() => {
        play()
      }, 100)
    } else if (timelineData && hasSeenAnimation.current && !hasStartedAnimation.current) {
      // If already seen, jump to end year
      hasStartedAnimation.current = true
      setCurrentYear(timelineData.yearRange.end)
      setHasInteracted(true)
    }
  }, [timelineData, hasInteracted, play])

  // Handle user interaction - stops auto-play
  const handleInteractionStart = useCallback(() => {
    if (isPlaying) {
      pause()
    }
    setHasInteracted(true)
  }, [isPlaying, pause])

  // Handle tile click
  const handleTileClick = useCallback(
    (name: string, type: 'genre' | 'artist', concertCount?: number) => {
      // Track tile click
      analytics.trackEvent('genre_tile_clicked', {
        genre_name: name,
        concert_count: concertCount || 0,
      })

      if (type === 'genre') {
        if (selectedGenre === name) {
          // Track view toggle to genres
          analytics.trackEvent('genre_view_toggled', {
            view_mode: 'genres',
          })
          // Clicking same genre - zoom out
          setView('genres')
          setSelectedGenre(null)
        } else {
          // Track view toggle to artists
          analytics.trackEvent('genre_view_toggled', {
            view_mode: 'artists',
          })
          // Drill into genre
          setView('artists')
          setSelectedGenre(name)
        }
      }
      // Artist clicks are handled by explore button
    },
    [selectedGenre]
  )

  // Handle reset
  const handleReset = useCallback(() => {
    haptics.light()
    setView('genres')
    setSelectedGenre(null)
  }, [])

  // Handle explore artist - navigate to Artist Scene
  const handleExploreArtist = useCallback(
    (normalizedName: string) => {
      navigate(`/?scene=artists&artist=${normalizedName}`)
    },
    [navigate]
  )

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      // Responsive treemap sizing
      let treemapWidth: number
      let treemapHeight: number

      if (width < 768) {
        // Mobile
        treemapWidth = Math.min(width * 0.95, 360)
        treemapHeight = Math.min(height * 0.45, 280)
      } else if (width < 1024) {
        // Tablet
        treemapWidth = Math.min(width * 0.9, 600)
        treemapHeight = Math.min(height * 0.45, 400)
      } else {
        // Desktop
        treemapWidth = Math.min(width * 0.6, 720)
        treemapHeight = Math.min(height * 0.5, 480)
      }

      setDimensions({ width: treemapWidth, height: treemapHeight })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Computed values
  const dominantGenre = useMemo(
    () => (timelineData ? getDominantGenre(timelineData.genres, currentYear) : null),
    [timelineData, currentYear]
  )

  const totalShows = useMemo(
    () =>
      timelineData
        ? getTotalShowsAtYear(timelineData.totalShowsByYear, currentYear)
        : 0,
    [timelineData, currentYear]
  )


  if (isLoading || !timelineData) {
    return (
      <section
        className="h-screen flex items-center justify-center snap-start snap-always"
        style={{
          background:
            'linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)',
        }}
      >
        <div className="text-slate-400 font-sans">Loading...</div>
      </section>
    )
  }

  const dominantColor = dominantGenre?.color ?? '#6b7280'

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-between py-12 md:py-16 relative snap-start snap-always overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 50% 30%, ${dominantColor}20 0%, transparent 50%),
          linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)
        `,
        transition: 'background 0.7s ease',
      }}
    >
      {/* Header: Title + Year */}
      <div className="flex flex-col items-center z-20">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center px-4"
        >
          <h2 className="font-serif text-3xl md:text-5xl text-white mb-1 tracking-tight">
            The Music
          </h2>
          <p className="font-sans text-sm text-slate-400">
            Watch taste evolve decade by decade
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-center mt-3 md:mt-4"
        >
          <div
            className="font-serif text-4xl md:text-5xl text-white tabular-nums transition-transform duration-100"
            style={{
              transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {currentYear}
          </div>
          <div className="font-sans text-sm text-slate-400 mt-1">
            {totalShows} show{totalShows !== 1 ? 's' : ''}
          </div>
        </motion.div>

        {/* Breadcrumb (artist view) */}
        <AnimatePresence>
          {selectedGenre && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2"
            >
              <span className="font-sans text-sm text-slate-500">
                <button
                  onClick={handleReset}
                  className="hover:text-white transition-colors"
                >
                  All Genres
                </button>
                <span className="mx-2">&rsaquo;</span>
                <span>{selectedGenre}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset / Back button - absolute positioned */}
      <AnimatePresence>
        {view === 'artists' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={handleReset}
            className="absolute top-12 md:top-16 right-4 md:right-8 z-30 px-4 py-2 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-lg font-sans text-sm font-medium hover:bg-white/20 transition-all duration-200 min-h-[44px]"
          >
            &larr; All Genres
          </motion.button>
        )}
      </AnimatePresence>

      {/* Treemap container - centered */}
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 1, delay: 0.4 }}
        className="flex justify-center items-center z-10"
      >
        <GenreTreemap
          genres={timelineData.genres}
          currentYear={currentYear}
          width={dimensions.width}
          height={dimensions.height}
          view={view}
          selectedGenre={selectedGenre}
          hoveredTile={hoveredTile}
          onTileClick={handleTileClick}
          onTileHover={setHoveredTile}
          onExploreArtist={handleExploreArtist}
        />
      </motion.div>

      {/* Footer: Timeline slider */}
      <div className="flex flex-col items-center z-20 w-full">
        <AnimatePresence>
          {view === 'genres' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex justify-center"
            >
              <TimelineSlider
                currentYear={currentYear}
                startYear={timelineData.yearRange.start}
                endYear={timelineData.yearRange.end}
                dominantColor={dominantColor}
                milestones={timelineData.milestones}
                hasInteracted={hasInteracted}
                onYearChange={handleYearChange}
                onInteractionStart={handleInteractionStart}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instruction text */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="font-sans text-[10px] text-slate-400 uppercase tracking-widest mt-3"
        >
          {view === 'genres'
            ? isPlaying
              ? 'Playing...'
              : 'Tap a genre to explore'
            : 'Tap artist to view details'}
        </motion.p>
      </div>
    </motion.section>
  )
}
