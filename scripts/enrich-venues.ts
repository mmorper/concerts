import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'
import { normalizeVenueName } from '../src/utils/normalize.js'
import {
  getVenuePlaceDetails,
  getPhotoUrl,
  loadCache as loadPlacesCache,
  saveCache as savePlacesCache,
  getCacheKey,
} from './utils/google-places-client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Fallback images for venues without photos
const FALLBACK_IMAGES = {
  ACTIVE_NO_PHOTO: '/images/venues/fallback-active.jpg', // Generic venue image
  LEGACY_NO_PHOTO: '/images/venues/fallback.jpg', // Closed door image (already exists)
  API_ERROR: '/images/venues/fallback-active.jpg', // Use generic for errors
} as const

interface Concert {
  id: string
  date: string
  headliner: string
  venue: string
  city: string
  state: string
  location?: {
    lat: number
    lng: number
  }
}

interface VenueStatus {
  venue: string
  city: string
  state: string
  status: 'active' | 'closed' | 'demolished' | 'renamed'
  closed_date?: string
  notes?: string
}

interface GeocodeCache {
  [key: string]: {
    lat: number
    lng: number
    formattedAddress: string
    geocodedAt: string
  }
}

interface ManualPhoto {
  url: string
  width: number
  height: number
  caption?: string
  source?: string
  license?: string
}

interface VenueMetadata {
  name: string
  normalizedName: string
  city: string
  state: string
  cityState: string
  location?: {
    lat: number
    lng: number
  }
  concerts: Array<{
    id: string
    date: string
    headliner: string
  }>
  stats: {
    totalConcerts: number
    firstEvent: string
    lastEvent: string
    uniqueArtists: number
  }
  status: string
  closedDate?: string | null
  notes?: string | null
  places: any
  manualPhotos?: ManualPhoto[] | null
  photoUrls?: {
    thumbnail: string
    medium: string
    large: string
  } | null
  fetchedAt: string
  photoCacheExpiry?: string | null
}

/**
 * Load venue status CSV
 */
function loadVenueStatuses(csvPath: string): Map<string, VenueStatus> {
  const statusMap = new Map<string, VenueStatus>()

  if (!fs.existsSync(csvPath)) {
    console.warn(`Warning: Venue status file not found: ${csvPath}`)
    console.warn('All venues will be treated as "active"')
    return statusMap
  }

  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as VenueStatus[]

    records.forEach(record => {
      const key = normalizeVenueName(record.venue)
      statusMap.set(key, record)
    })

    console.log(`✓ Loaded ${statusMap.size} venue statuses from ${csvPath}`)
  } catch (error) {
    console.error(`Error loading venue statuses: ${error}`)
  }

  return statusMap
}

/**
 * Load geocode cache
 */
function loadGeocodeCache(): GeocodeCache {
  const cachePath = path.join(__dirname, '../public/data/geocode-cache.json')
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    }
  } catch (error) {
    console.warn('Warning: Could not load geocode cache:', error)
  }
  return {}
}

/**
 * Check for manual photos in /public/images/venues/
 */
function checkManualPhotos(normalizedName: string): ManualPhoto[] | null {
  const imagesDir = path.join(__dirname, '../public/images/venues')

  if (!fs.existsSync(imagesDir)) {
    return null
  }

  try {
    const files = fs.readdirSync(imagesDir)
    const venuePhotos = files.filter(file =>
      file.startsWith(normalizedName) && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
    )

    if (venuePhotos.length === 0) {
      return null
    }

    // For now, just return the first photo as a basic entry
    // In the future, this could be enhanced to read metadata from a JSON file
    return venuePhotos.map(file => ({
      url: `/images/venues/${file}`,
      width: 1200,
      height: 800,
      caption: undefined,
      source: undefined,
      license: undefined,
    }))
  } catch (error) {
    console.error(`Error checking manual photos for ${normalizedName}:`, error)
    return null
  }
}

/**
 * Generate fallback photo URLs
 */
function generateFallbackPhotoUrls(fallbackPath: string) {
  return {
    thumbnail: fallbackPath,
    medium: fallbackPath,
    large: fallbackPath,
  }
}

/**
 * Main enrichment function
 */
async function enrichVenues() {
  try {
    console.log('=== Venue Enrichment Script ===\n')

    // Load data
    console.log('Loading data files...')
    const concertsPath = path.join(__dirname, '../public/data/concerts.json')
    const concertsData = JSON.parse(fs.readFileSync(concertsPath, 'utf-8'))
    const concerts: Concert[] = concertsData.concerts

    const venueStatusPath = path.join(__dirname, '../data/venue-status.csv')
    const venueStatuses = loadVenueStatuses(venueStatusPath)

    const geocodeCache = loadGeocodeCache()

    console.log(`Found ${concerts.length} concerts\n`)

    // Extract unique venues with concert data
    const venueMap = new Map<
      string,
      {
        name: string
        city: string
        state: string
        concerts: Array<{ id: string; date: string; headliner: string }>
        location?: { lat: number; lng: number }
      }
    >()

    concerts.forEach(concert => {
      const normalizedName = normalizeVenueName(concert.venue)

      if (!venueMap.has(normalizedName)) {
        // Get location from geocode cache
        const cacheKey = `${concert.venue}|${concert.city}|${concert.state}`.toLowerCase()
        const location = geocodeCache[cacheKey]

        venueMap.set(normalizedName, {
          name: concert.venue,
          city: concert.city,
          state: concert.state,
          concerts: [],
          location: location ? { lat: location.lat, lng: location.lng } : undefined,
        })
      }

      const venue = venueMap.get(normalizedName)!
      venue.concerts.push({
        id: concert.id,
        date: concert.date,
        headliner: concert.headliner,
      })
    })

    console.log(`Found ${venueMap.size} unique venues\n`)

    // Load Places API cache
    loadPlacesCache()

    // Process each venue
    const venuesMetadata: Record<string, VenueMetadata> = {}
    let activeCount = 0
    let legacyCount = 0
    let photosFoundCount = 0

    for (const [normalizedName, venue] of venueMap) {
      const status = venueStatuses.get(normalizedName)
      const isActive = !status || status.status === 'active'

      console.log(`\nProcessing: ${venue.name} (${venue.city}, ${venue.state})`)
      console.log(`  Status: ${status?.status || 'active (default)'}`)

      // Compute stats
      const sortedConcerts = venue.concerts.sort((a, b) => a.date.localeCompare(b.date))
      const uniqueArtists = new Set(venue.concerts.map(c => c.headliner)).size

      // Initialize venue entry
      const metadata: VenueMetadata = {
        name: venue.name,
        normalizedName,
        city: venue.city,
        state: venue.state,
        cityState: `${venue.city}, ${venue.state}`,
        location: venue.location,
        concerts: sortedConcerts,
        stats: {
          totalConcerts: venue.concerts.length,
          firstEvent: sortedConcerts[0].date,
          lastEvent: sortedConcerts[sortedConcerts.length - 1].date,
          uniqueArtists,
        },
        status: status?.status || 'active',
        closedDate: status?.closed_date || null,
        notes: status?.notes || null,
        places: null,
        fetchedAt: new Date().toISOString(),
      }

      // Only fetch from Places API if venue is active
      if (isActive) {
        activeCount++
        console.log(`  Fetching from Google Places API...`)

        const placeDetails = await getVenuePlaceDetails(
          venue.name,
          venue.city,
          venue.state,
          venue.location?.lat,
          venue.location?.lng
        )

        if (placeDetails) {
          metadata.places = placeDetails

          // Generate photo URLs if photos available
          if (placeDetails.photos && placeDetails.photos.length > 0) {
            const photo = placeDetails.photos[0]
            metadata.photoUrls = {
              thumbnail: getPhotoUrl(photo.name, 400),
              medium: getPhotoUrl(photo.name, 800),
              large: getPhotoUrl(photo.name, 1200),
            }
            photosFoundCount++
            console.log(`  ✓ Found ${placeDetails.photos.length} photo(s)`)
          } else {
            // Active venue but no photos from API - use generic fallback
            metadata.photoUrls = generateFallbackPhotoUrls(FALLBACK_IMAGES.ACTIVE_NO_PHOTO)
            console.log(`  ⚠ No photos available from Places API (using fallback)`)
          }

          // Set cache expiry (90 days)
          const expiryDate = new Date()
          expiryDate.setDate(expiryDate.getDate() + 90)
          metadata.photoCacheExpiry = expiryDate.toISOString()
        } else {
          // API error or no Place ID found - use generic fallback
          metadata.photoUrls = generateFallbackPhotoUrls(FALLBACK_IMAGES.API_ERROR)
          console.log(`  ⚠ No Place ID found (using fallback)`)
        }

        // Rate limiting between venues
        await new Promise(resolve => setTimeout(resolve, 100))
      } else {
        legacyCount++
        console.log(`  Checking for manual photos...`)

        // Check for manual photos
        metadata.manualPhotos = checkManualPhotos(normalizedName)

        if (metadata.manualPhotos && metadata.manualPhotos.length > 0) {
          const photo = metadata.manualPhotos[0]
          metadata.photoUrls = {
            thumbnail: `${photo.url}?w=400`,
            medium: `${photo.url}?w=800`,
            large: photo.url,
          }
          photosFoundCount++
          console.log(`  ✓ Found ${metadata.manualPhotos.length} manual photo(s)`)
        } else {
          // Legacy venue with no manual photos - use "closed" fallback
          metadata.photoUrls = generateFallbackPhotoUrls(FALLBACK_IMAGES.LEGACY_NO_PHOTO)
          console.log(`  ⚠ No manual photos found (using fallback)`)
        }

        metadata.photoCacheExpiry = null // Manual photos don't expire
      }

      venuesMetadata[normalizedName] = metadata
    }

    // Save Places API cache
    savePlacesCache()

    // Write venues-metadata.json
    const outputPath = path.join(__dirname, '../public/data/venues-metadata.json')
    const outputDir = path.dirname(outputPath)

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputPath, JSON.stringify(venuesMetadata, null, 2), 'utf-8')

    // Print summary
    console.log('\n=== Enrichment Complete ===')
    console.log(`✓ Enriched ${venueMap.size} venues`)
    console.log(`  - ${activeCount} active venues`)
    console.log(`  - ${legacyCount} legacy venues`)
    console.log(`  - ${photosFoundCount} venues with photos`)
    console.log(`\nOutput: public/data/venues-metadata.json`)
    console.log(`Cache: public/data/venue-photos-cache.json`)
  } catch (error) {
    console.error('Error enriching venues:', error)
    process.exit(1)
  }
}

// Run if executed directly
enrichVenues()
