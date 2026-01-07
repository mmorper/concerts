/**
 * Aggregate Genres Timeline Data
 *
 * Pre-computes genre and artist data aggregated by year for the Genre Scene
 * treemap visualization with timeline scrubber.
 *
 * Output: public/data/genres-timeline.json
 *
 * Usage:
 *   npm run aggregate:genres
 *   npm run aggregate:genres -- --dry-run
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { normalizeArtistName, normalizeGenreName } from '../src/utils/normalize'
import { GENRE_COLORS } from '../src/constants/colors'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Paths
const CONCERTS_PATH = join(__dirname, '../public/data/concerts.json')
const OUTPUT_PATH = join(__dirname, '../public/data/genres-timeline.json')

// Types
interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  genre: string
  genreNormalized: string
  openers: string[]
  year: number
}

interface ArtistData {
  name: string
  normalizedName: string
  showCount: number
  years: number[]
  firstYear: number
  lastYear: number
}

interface GenreTimeline {
  name: string
  normalizedName: string
  color: string
  showsByYear: Record<number, number>
  totalShows: number
  firstYear: number
  lastYear: number
  artists: ArtistData[]
}

interface MilestoneYear {
  milestone: number
  year: number
}

interface GenreTimelineData {
  genres: GenreTimeline[]
  totalShowsByYear: Record<number, number>
  milestones: MilestoneYear[]
  yearRange: { start: number; end: number }
  generatedAt: string
}

// Minimum shows for a genre to appear as its own tile (otherwise collapsed to "Other")
const MIN_GENRE_SHOWS = 3

function aggregateGenresTimeline(concerts: Concert[]): GenreTimelineData {
  // Maps for accumulating data
  const genreMap = new Map<string, {
    showsByYear: Map<number, number>
    artists: Map<string, { years: Set<number> }>
  }>()

  const totalShowsByYear = new Map<number, number>()

  // Process each concert
  concerts.forEach(concert => {
    const year = concert.year
    const genre = concert.genre || 'Other'

    // Initialize genre if needed
    if (!genreMap.has(genre)) {
      genreMap.set(genre, {
        showsByYear: new Map(),
        artists: new Map(),
      })
    }

    const genreData = genreMap.get(genre)!

    // Increment year count for genre
    genreData.showsByYear.set(
      year,
      (genreData.showsByYear.get(year) || 0) + 1
    )

    // Track headliner only (openers often lack imagery data)
    if (!genreData.artists.has(concert.headliner)) {
      genreData.artists.set(concert.headliner, { years: new Set() })
    }
    genreData.artists.get(concert.headliner)!.years.add(year)

    // Track total shows by year
    totalShowsByYear.set(year, (totalShowsByYear.get(year) || 0) + 1)
  })

  // Calculate milestones
  const milestones: MilestoneYear[] = []
  const milestoneLevels = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250]
  let runningTotal = 0

  const sortedYears = [...totalShowsByYear.keys()].sort((a, b) => a - b)

  sortedYears.forEach(year => {
    const prevTotal = runningTotal
    runningTotal += totalShowsByYear.get(year)!

    milestoneLevels.forEach(m => {
      if (prevTotal < m && runningTotal >= m) {
        milestones.push({ milestone: m, year })
      }
    })
  })

  // Separate genres with enough shows vs those to collapse into "Other"
  const majorGenres: [string, typeof genreMap extends Map<string, infer V> ? V : never][] = []
  const minorGenres: [string, typeof genreMap extends Map<string, infer V> ? V : never][] = []

  for (const [name, data] of genreMap.entries()) {
    const totalShows = [...data.showsByYear.values()].reduce((a, b) => a + b, 0)
    if (totalShows >= MIN_GENRE_SHOWS && name !== 'Other') {
      majorGenres.push([name, data])
    } else {
      minorGenres.push([name, data])
    }
  }

  // Merge minor genres into "Other"
  if (minorGenres.length > 0) {
    const otherData = {
      showsByYear: new Map<number, number>(),
      artists: new Map<string, { years: Set<number> }>(),
    }

    minorGenres.forEach(([_name, data]) => {
      // Merge shows by year
      for (const [year, count] of data.showsByYear.entries()) {
        otherData.showsByYear.set(year, (otherData.showsByYear.get(year) || 0) + count)
      }
      // Merge artists
      for (const [artist, artistData] of data.artists.entries()) {
        if (!otherData.artists.has(artist)) {
          otherData.artists.set(artist, { years: new Set() })
        }
        artistData.years.forEach(y => otherData.artists.get(artist)!.years.add(y))
      }
    })

    majorGenres.push(['Other', otherData])
  }

  // Build output genres array
  const genres = majorGenres.map(([name, data]) => {
    const showsByYear = Object.fromEntries(data.showsByYear)
    const years = [...data.showsByYear.keys()].sort((a, b) => a - b)

    const artists = [...data.artists.entries()].map(([artistName, artistData]) => {
      const artistYears = [...artistData.years].sort((a, b) => a - b)
      return {
        name: artistName,
        normalizedName: normalizeArtistName(artistName),
        showCount: artistYears.length,
        years: artistYears,
        firstYear: artistYears[0],
        lastYear: artistYears[artistYears.length - 1],
      }
    }).sort((a, b) => b.showCount - a.showCount)

    return {
      name,
      normalizedName: normalizeGenreName(name),
      color: GENRE_COLORS[name] || '#64748b',
      showsByYear,
      totalShows: [...data.showsByYear.values()].reduce((a, b) => a + b, 0),
      firstYear: years[0],
      lastYear: years[years.length - 1],
      artists,
    }
  }).sort((a, b) => b.totalShows - a.totalShows)

  return {
    genres,
    totalShowsByYear: Object.fromEntries(totalShowsByYear),
    milestones,
    yearRange: {
      start: Math.min(...sortedYears),
      end: Math.max(...sortedYears),
    },
    generatedAt: new Date().toISOString(),
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`🎵 Aggregating Genres Timeline Data${dryRun ? ' (DRY RUN)' : ''}`)
  console.log('='.repeat(50))
  console.log()

  // Read concerts data
  if (!existsSync(CONCERTS_PATH)) {
    console.error('❌ Error: concerts.json not found at', CONCERTS_PATH)
    console.error('   Run "npm run build-data" first to generate concert data')
    process.exit(1)
  }

  const concertsFile = JSON.parse(readFileSync(CONCERTS_PATH, 'utf-8'))
  const concerts: Concert[] = concertsFile.concerts

  console.log(`📊 Processing ${concerts.length} concerts...`)
  console.log()

  // Aggregate the data
  const timelineData = aggregateGenresTimeline(concerts)

  // Summary
  console.log('📈 Genre Summary:')
  console.log(`   Total genres: ${timelineData.genres.length}`)
  console.log(`   Year range: ${timelineData.yearRange.start} - ${timelineData.yearRange.end}`)
  console.log(`   Milestones: ${timelineData.milestones.length}`)
  console.log()

  // Top genres
  console.log('🎸 Top Genres by Show Count:')
  timelineData.genres.slice(0, 10).forEach((genre, i) => {
    console.log(`   ${i + 1}. ${genre.name}: ${genre.totalShows} shows (${genre.artists.length} artists)`)
  })
  console.log()

  // Milestones
  console.log('🏆 Show Milestones:')
  timelineData.milestones.forEach(m => {
    console.log(`   ${m.milestone} shows reached in ${m.year}`)
  })
  console.log()

  if (dryRun) {
    console.log('🔍 DRY RUN - No files written')
    console.log()
    console.log('Output would be written to:')
    console.log(`   ${OUTPUT_PATH}`)
  } else {
    // Create backup if file exists
    if (existsSync(OUTPUT_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = OUTPUT_PATH.replace('.json', `.backup.${timestamp}.json`)
      copyFileSync(OUTPUT_PATH, backupPath)
      console.log(`📦 Backup created: ${backupPath}`)
    }

    // Write output
    writeFileSync(OUTPUT_PATH, JSON.stringify(timelineData, null, 2))
    console.log(`✅ Written to ${OUTPUT_PATH}`)
  }

  console.log()
  console.log('='.repeat(50))
  console.log('✨ Genres timeline aggregation complete!')
}

// Run if called directly
main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
