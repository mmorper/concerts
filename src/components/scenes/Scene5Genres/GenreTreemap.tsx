import { useMemo, useState, useEffect } from 'react'
import { useTreemapLayout, type TreemapTile } from './useTreemapLayout'
import { haptics } from '../../../utils/haptics'

// Artist metadata from artists-metadata.json
interface ArtistMetadata {
  name: string
  normalizedName?: string
  image?: string
  bio?: string
  genres?: string[]
  formed?: string | null
  website?: string
  source?: string
  fetchedAt: string
  dataSource?: string
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

interface GenreTreemapProps {
  genres: GenreData[]
  currentYear: number
  width: number
  height: number
  view: 'genres' | 'artists'
  selectedGenre: string | null
  hoveredTile: string | null
  onTileClick: (name: string, type: 'genre' | 'artist') => void
  onTileHover: (name: string | null) => void
  onExploreArtist: (normalizedName: string) => void
}

/**
 * Get cumulative show count for a genre up to a given year
 */
function getGenreCountAtYear(
  genre: GenreData,
  year: number
): number {
  let count = 0
  for (const [y, shows] of Object.entries(genre.showsByYear)) {
    if (parseInt(y) <= year) {
      count += shows
    }
  }
  return count
}

/**
 * Calculate luminance for contrast calculation
 */
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255

  const [rL, gL, bL] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )

  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL
}

/**
 * Format year range display
 */
function formatYearRange(
  years: number[],
  currentYear: number
): string {
  const filteredYears = years.filter((y) => y <= currentYear)
  if (filteredYears.length === 0) return ''
  if (filteredYears.length <= 3) {
    return filteredYears.join('  ')
  }
  const first = filteredYears[0]
  const last = filteredYears[filteredYears.length - 1]
  return `${first} \u2192 ${last}`
}

/**
 * Minimum tile size to display (must fit at least a label)
 * Tiles smaller than this are hidden entirely
 */
const MIN_TILE_WIDTH = 40
const MIN_TILE_HEIGHT = 30

/**
 * Determine what content to show based on tile size
 */
function getTileContentVisibility(width: number, height: number) {
  const area = width * height

  // Tile too small to show anything meaningful - hide it
  const tooSmall = width < MIN_TILE_WIDTH || height < MIN_TILE_HEIGHT

  return {
    tooSmall,
    showNameOnly: !tooSmall && area < 3000,
    showNameAndCount: !tooSmall && area >= 3000 && area < 5000,
    showAll: !tooSmall && area >= 5000,
    showExplore: !tooSmall && area >= 7000 && width >= 90 && height >= 80,
  }
}

export function GenreTreemap({
  genres,
  currentYear,
  width,
  height,
  view,
  selectedGenre,
  hoveredTile,
  onTileClick,
  onTileHover,
  onExploreArtist,
}: GenreTreemapProps) {
  const [pressedTile, setPressedTile] = useState<string | null>(null)
  const [artistMetadata, setArtistMetadata] = useState<Record<string, ArtistMetadata>>({})

  // Load artist metadata for images
  useEffect(() => {
    if (view === 'artists') {
      fetch('/data/artists-metadata.json')
        .then((res) => res.json())
        .then((data: Record<string, ArtistMetadata>) => {
          setArtistMetadata(data)
        })
        .catch((err) => {
          console.error('Failed to load artist metadata:', err)
        })
    }
  }, [view])

  // Prepare data based on view mode
  const tileData = useMemo(() => {
    if (view === 'artists' && selectedGenre) {
      // Find the selected genre and show its artists
      const genre = genres.find((g) => g.name === selectedGenre)
      if (!genre) return []

      return genre.artists.map((artist) => ({
        id: artist.normalizedName,
        name: artist.name,
        normalizedName: artist.normalizedName,
        count: artist.showCount,
        color: genre.color,
        firstYear: artist.firstYear,
        lastYear: artist.lastYear,
        years: artist.years,
      }))
    }

    // Genre view - filter by current year
    return genres
      .map((genre) => {
        const count = getGenreCountAtYear(genre, currentYear)
        return {
          id: genre.normalizedName,
          name: genre.name,
          normalizedName: genre.normalizedName,
          count,
          color: genre.color,
          firstYear: genre.firstYear,
          lastYear: Math.min(genre.lastYear, currentYear),
          years: Object.keys(genre.showsByYear)
            .map(Number)
            .filter((y) => y <= currentYear)
            .sort((a, b) => a - b),
        }
      })
      .filter((g) => g.count > 0)
  }, [genres, currentYear, view, selectedGenre])

  // Compute layout
  const tiles = useTreemapLayout({
    data: tileData,
    width,
    height,
    padding: 4,
  })

  const handleTileClick = (tile: TreemapTile) => {
    haptics.light()
    if (view === 'artists') {
      onTileClick(tile.name, 'artist')
    } else {
      onTileClick(tile.name, 'genre')
    }
  }

  const handleExploreClick = (
    e: React.MouseEvent,
    normalizedName: string
  ) => {
    e.stopPropagation()
    haptics.medium()
    onExploreArtist(normalizedName)
  }

  if (tiles.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-500 font-sans text-sm"
        style={{ width, height }}
      >
        No concerts yet in this era
      </div>
    )
  }

  // Note: We no longer reorder tiles for hover as it causes visual "jumps"
  // when combined with CSS transforms. Tiles render in their natural order.

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      style={{ touchAction: 'none' }}
    >
      <defs>
        {tiles.map((tile) => {
          const gradientId = `gradient-${tile.id}`
          return (
            <linearGradient
              key={gradientId}
              id={gradientId}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor={tile.color}
                stopOpacity={0.95}
              />
              <stop
                offset="100%"
                stopColor={tile.color}
                stopOpacity={0.75}
              />
            </linearGradient>
          )
        })}
      </defs>

      {/* Sort tiles so hovered tile renders last (on top in SVG) */}
      {[...tiles].sort((a, b) => {
        if (a.name === hoveredTile) return 1
        if (b.name === hoveredTile) return -1
        return 0
      }).map((tile) => {
        const visibility = getTileContentVisibility(tile.width, tile.height)

        // Skip tiles that are too small to show a label
        if (visibility.tooSmall) {
          return null
        }

        const isHovered = hoveredTile === tile.name
        const isPressed = pressedTile === tile.name
        const luminance = getLuminance(tile.color)
        const textColor = luminance > 0.4 ? '#1f2937' : '#ffffff'

        // Get artist image for duotone effect (artist view only)
        const artistImage = view === 'artists'
          ? artistMetadata[tile.normalizedName]?.image
          : undefined

        // Determine if this tile should scale on hover (tiles with clipped/truncated content)
        // Scale up tiles that don't show all basic content (name + years + count)
        // In artist view, only scale if missing the explore button
        const hasHiddenContent = view === 'artists'
          ? !visibility.showExplore
          : !visibility.showAll
        const shouldScaleOnHover = hasHiddenContent && isHovered

        // Scale factor for hover effect
        const scaleFactor = shouldScaleOnHover ? 1.5 : 1

        // Dynamic font sizing based on tile dimensions (use scaled size when hovered)
        const effectiveWidth = shouldScaleOnHover ? tile.width * scaleFactor : tile.width
        const effectiveHeight = shouldScaleOnHover ? tile.height * scaleFactor : tile.height
        const nameFontSize = Math.max(
          11,
          Math.min(16, effectiveWidth / 7, effectiveHeight / 3.5)
        )
        const countFontSize = nameFontSize * 0.65
        const yearsFontSize = nameFontSize * 0.7

        // Strong text shadow for legibility (enhanced for images)
        const textShadow = artistImage
          ? '0 2px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)'
          : luminance > 0.4
            ? '0 1px 3px rgba(255,255,255,0.8), 0 0 8px rgba(255,255,255,0.4)'
            : '0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.4)'

        // For duotone effect, text is always white for better contrast
        const effectiveTextColor = artistImage ? '#ffffff' : textColor

        // When small tile is hovered, show more content (including explore button for artists)
        const effectiveVisibility = shouldScaleOnHover
          ? { ...visibility, showNameOnly: false, showNameAndCount: true, showAll: true, showExplore: true }
          : visibility

        // Calculate scaled position and size for hover effect
        // Instead of CSS transform (which causes flicker), we render at the scaled position
        const displayX = shouldScaleOnHover ? tile.x - (tile.width * (scaleFactor - 1)) / 2 : tile.x
        const displayY = shouldScaleOnHover ? tile.y - (tile.height * (scaleFactor - 1)) / 2 : tile.y
        const displayWidth = shouldScaleOnHover ? tile.width * scaleFactor : tile.width
        const displayHeight = shouldScaleOnHover ? tile.height * scaleFactor : tile.height

        return (
          <g
            key={tile.id}
            className="cursor-pointer"
            onClick={() => handleTileClick(tile)}
            onMouseEnter={() => onTileHover(tile.name)}
            onMouseLeave={() => onTileHover(null)}
            onPointerDown={() => setPressedTile(tile.name)}
            onPointerUp={() => setPressedTile(null)}
            onPointerCancel={() => setPressedTile(null)}
          >
            {/* Clip path for rounded corners on image */}
            <defs>
              <clipPath id={`clip-${tile.id}`}>
                <rect
                  x={displayX}
                  y={displayY}
                  width={displayWidth}
                  height={displayHeight}
                  rx={3}
                />
              </clipPath>
            </defs>

            {/* Tile background */}
            <rect
              x={displayX}
              y={displayY}
              width={displayWidth}
              height={displayHeight}
              rx={3}
              fill={`url(#gradient-${tile.id})`}
              stroke={isHovered ? '#ffffff' : 'rgba(255,255,255,0.4)'}
              strokeWidth={isHovered ? 2 : 1}
              style={{
                transition: 'x 0.15s ease-out, y 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out',
                filter: isHovered
                  ? 'brightness(1.15)'
                  : isPressed
                    ? 'brightness(0.95)'
                    : 'brightness(1)',
              }}
            />

            {/* Duotone artist image background (artist view only) */}
            {artistImage && (
              <g clipPath={`url(#clip-${tile.id})`}>
                {/* Artist image with grayscale + blend */}
                <image
                  href={artistImage}
                  x={displayX}
                  y={displayY}
                  width={displayWidth}
                  height={displayHeight}
                  preserveAspectRatio="xMidYMid slice"
                  style={{
                    transition: 'x 0.15s ease-out, y 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out',
                    filter: 'grayscale(100%) contrast(1.2)',
                    opacity: 0.35,
                    mixBlendMode: 'luminosity',
                  }}
                />
                {/* Color overlay for duotone effect */}
                <rect
                  x={displayX}
                  y={displayY}
                  width={displayWidth}
                  height={displayHeight}
                  fill={tile.color}
                  style={{
                    transition: 'x 0.15s ease-out, y 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out',
                    mixBlendMode: 'multiply',
                    opacity: 0.7,
                  }}
                />
                {/* Dark overlay for text legibility */}
                <rect
                  x={displayX}
                  y={displayY}
                  width={displayWidth}
                  height={displayHeight}
                  fill="black"
                  opacity={0.25}
                  style={{
                    transition: 'x 0.15s ease-out, y 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out',
                  }}
                />
              </g>
            )}

            {/* Invisible hit area at original position to prevent hover flicker */}
            <rect
              x={tile.x}
              y={tile.y}
              width={tile.width}
              height={tile.height}
              fill="transparent"
              style={{ pointerEvents: 'all' }}
            />

            {/* Tile content - centered */}
            <foreignObject
              x={displayX}
              y={displayY}
              width={displayWidth}
              height={displayHeight}
              style={{
                pointerEvents: 'none',
                transition: 'x 0.15s ease-out, y 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out',
              }}
            >
              <div
                className="w-full h-full flex flex-col items-center justify-center text-center px-2 overflow-hidden"
                style={{ color: effectiveTextColor }}
              >
                {/* Name */}
                <div
                  className="font-sans font-semibold leading-tight truncate w-full"
                  style={{
                    fontSize: `${nameFontSize}px`,
                    textShadow,
                  }}
                >
                  {tile.name}
                </div>

                {/* Year range */}
                {(effectiveVisibility.showAll || effectiveVisibility.showNameAndCount) &&
                  tile.years &&
                  tile.years.length > 0 && (
                    <div
                      className="font-mono opacity-80 truncate w-full"
                      style={{ fontSize: `${yearsFontSize}px`, textShadow }}
                    >
                      {formatYearRange(tile.years, currentYear)}
                    </div>
                  )}

                {/* Show count */}
                {(effectiveVisibility.showAll || effectiveVisibility.showNameAndCount) && (
                  <div
                    className="font-sans opacity-75"
                    style={{ fontSize: `${countFontSize}px`, textShadow }}
                  >
                    {tile.count} show{tile.count !== 1 ? 's' : ''}
                  </div>
                )}

                {/* Explore CTA (artist view only) */}
                {view === 'artists' && effectiveVisibility.showExplore && (
                  <button
                    className="mt-1.5 px-3 py-1 text-xs font-medium rounded bg-white/20 border border-white/30 hover:bg-white/30 transition-colors pointer-events-auto"
                    style={{ color: effectiveTextColor }}
                    onClick={(e) =>
                      handleExploreClick(e, tile.normalizedName)
                    }
                  >
                    explore &rarr;
                  </button>
                )}
              </div>
            </foreignObject>
          </g>
        )
      })}
    </svg>
  )
}
