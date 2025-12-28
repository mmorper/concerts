import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ConcertRow {
  Date: string
  Headliner: string
  Genre_Headliner: string
  Opener: string
  Venue: string
  'City, State': string
  Who: string
  Reference: string
  City: string
  State: string
  _Full_Date: string
  Month: string
  Day: string
  Year: string
  Day_of_Week: string
  [key: string]: string // For dynamic Opener_ columns
}

interface Concert {
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

// Static city coordinates mapping
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Irvine, California': { lat: 33.6846, lng: -117.8265 },
  'Costa Mesa, California': { lat: 33.6411, lng: -117.9187 },
  'Inglewood, California': { lat: 33.9617, lng: -118.3531 },
  'Los Angeles, California': { lat: 34.0522, lng: -118.2437 },
  'Tijuana, Mexico': { lat: 32.5149, lng: -117.0382 },
  'Anaheim, California': { lat: 33.8366, lng: -117.9143 },
  'Pasadena, California': { lat: 34.1478, lng: -118.1445 },
  'Mesa, Arizona': { lat: 33.4152, lng: -111.8315 },
  'Phoenix, Arizona': { lat: 33.4484, lng: -112.0740 },
  'Long Beach, California': { lat: 33.7701, lng: -118.1937 },
  'Fullerton, California': { lat: 33.8704, lng: -117.9242 },
  'San Juan Capistrano, California': { lat: 33.5017, lng: -117.6625 },
  'Carson, California': { lat: 33.8317, lng: -118.2820 },
  'Hollywood, California': { lat: 34.0928, lng: -118.3287 },
  'Newport Beach, California': { lat: 33.6189, lng: -117.9289 },
  'Santa Ana, California': { lat: 33.7455, lng: -117.8677 },
  'Boston, Massachusetts': { lat: 42.3601, lng: -71.0589 },
  'Morrison, CO': { lat: 39.6653, lng: -105.2055 },
  'Denver, CO': { lat: 39.7392, lng: -104.9903 },
  'Buena Park, California': { lat: 33.8675, lng: -118.0001 },
}

function parseCSV(csvContent: string): ConcertRow[] {
  const lines = csvContent.split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  const rows: ConcertRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(',').map(v => v.trim())
    const row: any = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    rows.push(row as ConcertRow)
  }

  return rows
}

function normalizeArtistName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-')
}

function parseDate(dateStr: string): { year: number; month: number; day: number } | null {
  // Format: M/D/YYYY
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null

  return {
    month: parseInt(parts[0]),
    day: parseInt(parts[1]),
    year: parseInt(parts[2]),
  }
}

function getDecade(year: number): string {
  const decade = Math.floor(year / 10) * 10
  return `${decade}s`
}

function convertRowToConcert(row: ConcertRow, index: number): Concert | null {
  if (!row.Headliner || !row.Date) return null

  const dateInfo = parseDate(row.Date)
  if (!dateInfo) return null

  // Parse openers from multiple columns
  const openers: string[] = []

  // Check Opener column first
  if (row.Opener && row.Opener !== '0' && row.Opener !== '') {
    openers.push(...row.Opener.split(',').map(o => o.trim()).filter(o => o))
  }

  // Check Opener_0 through Opener_15
  for (let i = 0; i <= 15; i++) {
    const openerKey = i === 0 ? 'Opener_' : `Opener_${i}`
    if (row[openerKey] && row[openerKey] !== '0' && row[openerKey] !== '') {
      openers.push(...row[openerKey].split(',').map(o => o.trim()).filter(o => o))
    }
  }

  // Remove duplicates and filter out empty/invalid entries
  const uniqueOpeners = Array.from(new Set(openers)).filter(o =>
    o && o !== '0' && o !== '#VALUE!' && o.length > 0
  )

  const cityState = row['City, State'] || `${row.City}, ${row.State}`.trim()
  const coordinates = CITY_COORDINATES[cityState] || { lat: 0, lng: 0 }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']

  const isoDate = `${dateInfo.year}-${String(dateInfo.month).padStart(2, '0')}-${String(dateInfo.day).padStart(2, '0')}`

  return {
    id: `concert-${index + 1}`,
    date: isoDate,
    headliner: row.Headliner,
    headlinerNormalized: normalizeArtistName(row.Headliner),
    genre: row.Genre_Headliner || 'Unknown',
    openers: uniqueOpeners,
    venue: row.Venue,
    city: row.City || cityState.split(',')[0].trim(),
    state: row.State || cityState.split(',')[1]?.trim() || '',
    cityState,
    reference: row.Reference && row.Reference !== '0' ? row.Reference : undefined,
    year: dateInfo.year,
    month: dateInfo.month,
    day: dateInfo.day,
    dayOfWeek: row.Day_of_Week || new Date(isoDate).toLocaleDateString('en-US', { weekday: 'long' }),
    decade: getDecade(dateInfo.year),
    location: coordinates,
  }
}

async function main() {
  try {
    // Read CSV file
    const csvPath = path.join(__dirname, '../docs/inspiration/sampleData.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')

    console.log('Parsing CSV...')
    const rows = parseCSV(csvContent)
    console.log(`Found ${rows.length} rows`)

    // Convert to concerts
    const concerts: Concert[] = []
    for (let i = 0; i < rows.length; i++) {
      const concert = convertRowToConcert(rows[i], i)
      if (concert) {
        concerts.push(concert)
      }
    }

    console.log(`Converted ${concerts.length} valid concerts`)

    // Calculate metadata
    const years = concerts.map(c => c.year)
    const uniqueArtists = new Set<string>()
    const uniqueVenues = new Set<string>()
    const uniqueCities = new Set<string>()

    concerts.forEach(c => {
      uniqueArtists.add(c.headliner)
      c.openers.forEach(o => uniqueArtists.add(o))
      uniqueVenues.add(c.venue)
      uniqueCities.add(c.cityState)
    })

    const output = {
      concerts,
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalConcerts: concerts.length,
        dateRange: {
          earliest: concerts[concerts.length - 1]?.date,
          latest: concerts[0]?.date,
        },
        uniqueArtists: uniqueArtists.size,
        uniqueVenues: uniqueVenues.size,
        uniqueCities: uniqueCities.size,
      },
    }

    // Write to JSON
    const outputPath = path.join(__dirname, '../public/data/concerts.json')
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

    console.log(`✓ Successfully wrote ${concerts.length} concerts to concerts.json`)
    console.log(`  - Date range: ${output.metadata.dateRange.earliest} to ${output.metadata.dateRange.latest}`)
    console.log(`  - Artists: ${output.metadata.uniqueArtists}`)
    console.log(`  - Venues: ${output.metadata.uniqueVenues}`)
    console.log(`  - Cities: ${output.metadata.uniqueCities}`)
  } catch (error) {
    console.error('Error converting CSV:', error)
    process.exit(1)
  }
}

main()
