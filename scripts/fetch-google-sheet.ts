import { GoogleSheetsClient } from './utils/google-sheets-client'
import { getCityCoordinates, getDefaultCoordinates } from '../src/utils/city-coordinates'
import { writeFileSync } from 'fs'
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
 * Normalize artist name for API lookups and matching
 */
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Main function to fetch and process Google Sheets data
 */
async function fetchGoogleSheet() {
  console.log('🎸 Fetching concert data from Google Sheets...\n')

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
    const range = process.env.SHEET_RANGE || 'Sheet1!A2:Z1000'

    const rawData = await client.fetchConcerts(sheetId, range)
    console.log(`✅ Fetched ${rawData.length} concerts from sheet\n`)

    // Process and enrich data
    const concerts: ProcessedConcert[] = rawData.map((row, index) => {
      const date = new Date(row.date)
      const [city, state] = row.cityState.split(',').map(s => s.trim())
      const coordinates = getCityCoordinates(row.cityState) || getDefaultCoordinates()

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
          earliest: concerts[0]?.date || '',
          latest: concerts[concerts.length - 1]?.date || '',
        },
        uniqueArtists: uniqueArtists.size,
        uniqueVenues: uniqueVenues.size,
        uniqueCities: uniqueCities.size,
      },
    }

    // Write to file
    const outputPath = join(process.cwd(), 'public', 'data', 'concerts.json')
    writeFileSync(outputPath, JSON.stringify(concertData, null, 2))

    console.log(`✅ Processed ${concerts.length} concerts`)
    console.log(`📊 Stats:`)
    console.log(`   - ${uniqueArtists.size} unique artists`)
    console.log(`   - ${uniqueVenues.size} unique venues`)
    console.log(`   - ${uniqueCities.size} unique cities`)
    console.log(`\n💾 Saved to: ${outputPath}`)
    console.log('\n🎉 Done! Run "npm run enrich" next to fetch artist metadata')
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
