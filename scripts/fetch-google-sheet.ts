import { GoogleSheetsClient } from './utils/google-sheets-client'
import { getCityCoordinates, getDefaultCoordinates } from '../src/utils/city-coordinates'
import { normalizeArtistName } from '../src/utils/normalize.js'
import { createBackup } from './utils/backup'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

interface ProcessedConcert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  genre: string
  openers: string[]
  venue: string
  city: string
  state: string
  cityState: string
  reference?: string
  year: number
  month: number
  day: number
  dayOfWeek: string
  decade: string
  location: {
    lat: number
    lng: number
  }
}

/**
 * Load geocode cache and get venue coordinates
 */
function loadGeocodeCache(): Map<string, { lat: number; lng: number }> {
  const cachePath = join(process.cwd(), 'public', 'data', 'geocode-cache.json')
  const cache = new Map<string, { lat: number; lng: number }>()

  try {
    if (existsSync(cachePath)) {
      const cacheData = JSON.parse(readFileSync(cachePath, 'utf-8'))
      Object.entries(cacheData).forEach(([key, value]: [string, any]) => {
        cache.set(key, { lat: value.lat, lng: value.lng })
      })
    }
  } catch (error) {
    console.warn('⚠️  Could not load geocode cache:', error)
  }

  return cache
}

/**
 * Get venue coordinates from cache, fallback to city coordinates
 */
function getVenueCoordinates(
  venue: string,
  city: string,
  state: string,
  cityState: string,
  geocodeCache: Map<string, { lat: number; lng: number }>
): { lat: number; lng: number } {
  // Try venue-level geocoding first
  // Trim whitespace to handle trailing/leading spaces in data
  const cacheKey = `${venue.trim()}|${city.trim()}|${state.trim()}`.toLowerCase()
  const cached = geocodeCache.get(cacheKey)

  if (cached) {
    return cached
  }

  // Fallback to city-level coordinates
  return getCityCoordinates(cityState) || getDefaultCoordinates()
}

/**
 * Main function to fetch and process Google Sheets data
 */
async function fetchGoogleSheet(options: { dryRun?: boolean } = {}) {
  const { dryRun = process.argv.includes('--dry-run') } = options

  console.log(`🎸 Fetching concert data from Google Sheets...${dryRun ? ' (DRY RUN)' : ''}\n`)

  // Validate environment variables
  const requiredVars = [
    'GOOGLE_SHEET_ID',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'GOOGLE_REFRESH_TOKEN',
  ]

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.error(`❌ Missing required environment variable: ${varName}`)
      console.error('Please copy .env.example to .env and fill in your values')
      process.exit(1)
    }
  }

  const client = new GoogleSheetsClient({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
  })

  try {
    const sheetId = process.env.GOOGLE_SHEET_ID!
    const configuredRange = process.env.SHEET_RANGE || 'Sheet1!A2:Z1000'

    // Adjust range to include header row (row 1)
    // e.g., "Data Entry!A2:AI500" → "Data Entry!A1:AI500"
    const range = configuredRange.replace(/!A\d+:/, '!A1:')

    console.log(`📍 Fetching from: ${range}`)

    const rawData = await client.fetchConcerts(sheetId, range)
    console.log(`✅ Fetched ${rawData.length} rows from sheet\n`)

    // Validate and filter rows
    let skippedInvalidDate = 0
    let skippedMissingHeadliner = 0
    let skippedMissingVenue = 0

    const validRows = rawData.filter((row, index) => {
      // Check for missing headliner
      if (!row.headliner || row.headliner.trim() === '') {
        console.warn(`⚠️  Skipping row ${index + 2}: Missing headliner`)
        skippedMissingHeadliner++
        return false
      }

      // Check for invalid date
      if (!row.date || isNaN(Date.parse(row.date))) {
        console.warn(`⚠️  Skipping row ${index + 2}: Invalid date "${row.date}"`)
        skippedInvalidDate++
        return false
      }

      // Check for missing venue (warning only, not skipping)
      if (!row.venue || row.venue.trim() === '') {
        console.warn(`⚠️  Row ${index + 2}: Missing venue for "${row.headliner}"`)
        skippedMissingVenue++
      }

      return true
    })

    console.log(`✅ Validated: ${validRows.length} valid concerts`)
    if (skippedInvalidDate > 0) {
      console.log(`   ⚠️  Skipped ${skippedInvalidDate} row(s) with invalid dates`)
    }
    if (skippedMissingHeadliner > 0) {
      console.log(`   ⚠️  Skipped ${skippedMissingHeadliner} row(s) with missing headliners`)
    }
    if (skippedMissingVenue > 0) {
      console.log(`   ⚠️  ${skippedMissingVenue} row(s) with missing venues`)
    }
    console.log()

    // Load geocode cache for venue-level coordinates
    const geocodeCache = loadGeocodeCache()
    console.log(`📍 Loaded geocode cache with ${geocodeCache.size} venue locations\n`)

    // Process and enrich data
    const concerts: ProcessedConcert[] = validRows.map((row, index) => {
      const date = new Date(row.date)
      const [city, state] = row.cityState.split(',').map(s => s.trim())
      const coordinates = getVenueCoordinates(row.venue, city, state, row.cityState, geocodeCache)

      return {
        id: `concert-${index + 1}`,
        date: date.toISOString().split('T')[0],
        headliner: row.headliner,
        headlinerNormalized: normalizeArtistName(row.headliner),
        genre: row.genre,
        openers: row.openers,
        venue: row.venue,
        city,
        state,
        cityState: row.cityState,
        reference: row.reference,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
        decade: `${Math.floor(date.getFullYear() / 10) * 10}s`,
        location: coordinates,
      }
    })

    // Sort by date (oldest to newest)
    concerts.sort((a, b) => a.date.localeCompare(b.date))

    // Generate metadata
    const uniqueArtists = new Set(concerts.map(c => c.headliner))
    const uniqueVenues = new Set(concerts.map(c => c.venue))
    const uniqueCities = new Set(concerts.map(c => c.cityState))

    const concertData = {
      concerts,
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalConcerts: concerts.length,
        dateRange: {
          earliest: concerts[0]?.date || '', // First concert after sorting (oldest)
          latest: concerts[concerts.length - 1]?.date || '', // Last concert (newest)
        },
        uniqueArtists: uniqueArtists.size,
        uniqueVenues: uniqueVenues.size,
        uniqueCities: uniqueCities.size,
      },
    }

    // Write to file
    const outputPath = join(process.cwd(), 'public', 'data', 'concerts.json')

    if (dryRun) {
      console.log('=' .repeat(60))
      console.log('🔍 DRY RUN MODE - No files will be modified')
      console.log('=' .repeat(60))
      console.log()
      console.log(`Would write to: ${outputPath}`)
      console.log(`File size: ${JSON.stringify(concertData, null, 2).length} bytes`)
      console.log()
    } else {
      // Create backup before overwriting
      createBackup(outputPath, { maxBackups: 10, verbose: true })

      // Write new data
      writeFileSync(outputPath, JSON.stringify(concertData, null, 2))
    }

    // Print summary
    console.log('=' .repeat(60))
    console.log('📊 FETCH SUMMARY')
    console.log('=' .repeat(60))
    console.log()
    console.log(`✅ Successfully processed: ${concerts.length} concerts`)
    console.log(`   📅 Date range: ${concertData.metadata.dateRange.earliest} to ${concertData.metadata.dateRange.latest}`)
    console.log()

    if (skippedInvalidDate > 0 || skippedMissingHeadliner > 0) {
      console.log('⚠️  Rows skipped:')
      if (skippedInvalidDate > 0) {
        console.log(`   - ${skippedInvalidDate} row(s) with invalid dates`)
      }
      if (skippedMissingHeadliner > 0) {
        console.log(`   - ${skippedMissingHeadliner} row(s) with missing headliners`)
      }
      console.log()
    }

    console.log('📈 Statistics:')
    console.log(`   - ${uniqueArtists.size} unique artists`)
    console.log(`   - ${uniqueVenues.size} unique venues`)
    console.log(`   - ${uniqueCities.size} unique cities`)
    console.log()
    if (dryRun) {
      console.log('💡 To apply these changes, run without --dry-run flag')
    } else {
      console.log(`💾 Output file: ${outputPath}`)
    }
    console.log()
    console.log('=' .repeat(60))
    console.log(`✨ Data fetch complete!${dryRun ? ' (DRY RUN)' : ''}`)
    console.log('=' .repeat(60))
    console.log()
    if (!dryRun) {
      console.log('Next steps:')
      console.log('  • Validate data: npm run validate-data')
      console.log('  • Enrich artists: npm run enrich')
      console.log('  • Build site: npm run build')
    }
  } catch (error) {
    console.error('❌ Error fetching Google Sheets data:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchGoogleSheet()
}

export { fetchGoogleSheet }
