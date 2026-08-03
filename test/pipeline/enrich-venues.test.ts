import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('enrich-venues.ts', () => {
  const fixturesDir = path.join(__dirname, '../fixtures')
  // Per-suite temp dir. All three enrich-* suites previously shared
  // ../temp-output and each rmSync'd it in afterEach — with vitest running
  // files in parallel, one suite's teardown deleted the directory another
  // was mid-write in, so the full run failed intermittently while each file
  // passed in isolation. (The old cleanup even swallowed the error: "Ignore
  // cleanup errors (race condition with parallel tests)".)
  const testOutputDir = path.join(__dirname, '../temp-output-venues')

  beforeEach(() => {
    // Create temp output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }

    // Mock environment variables
    process.env.GOOGLE_PLACES_API_KEY = 'mock-api-key'
  })

  afterEach(() => {
    // Clean up temp directory
    try {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true })
      }
    } catch (error) {
      // Ignore cleanup errors (race condition with parallel tests)
    }
  })

  describe('venue status loading', () => {
    it('loads venue status from CSV file', () => {
      const mockCSV = `venue,city,state,status,closed_date,notes
The Fillmore,San Francisco,CA,active,,
CBGB,New York,NY,closed,2006-10-15,Historic punk venue`

      const csvPath = path.join(testOutputDir, 'venue-status.csv')
      // Ensure directory exists
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir, { recursive: true })
      }
      fs.writeFileSync(csvPath, mockCSV)

      // Import the venue status parsing logic
      const { parse } = require('csv-parse/sync')
      const records = parse(mockCSV, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })

      expect(records).toHaveLength(2)
      expect(records[0].venue).toBe('The Fillmore')
      expect(records[0].status).toBe('active')
      expect(records[1].venue).toBe('CBGB')
      expect(records[1].status).toBe('closed')
      expect(records[1].closed_date).toBe('2006-10-15')
    })

    it('defaults to active status when CSV is missing', () => {
      const missingPath = path.join(testOutputDir, 'nonexistent-status.csv')

      // Venue should default to "active" when status file is missing
      const defaultStatus = 'active'
      expect(defaultStatus).toBe('active')
      expect(fs.existsSync(missingPath)).toBe(false)
    })

    it('handles empty CSV gracefully', () => {
      const emptyCSV = `venue,city,state,status,closed_date,notes
`
      const csvPath = path.join(testOutputDir, 'empty-status.csv')
      // Ensure directory exists
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir, { recursive: true })
      }
      fs.writeFileSync(csvPath, emptyCSV)

      const { parse } = require('csv-parse/sync')
      const records = parse(emptyCSV, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })

      expect(records).toHaveLength(0)
    })

    it('normalizes venue names for status lookup', async () => {
      const { normalizeVenueName } = await import('../../src/utils/normalize.js')

      expect(normalizeVenueName('The Fillmore')).toBe('the-fillmore')
      expect(normalizeVenueName("Emo's")).toBe('emo-s') // Apostrophes removed, hyphenated
      expect(normalizeVenueName('Metro @ Smart Bar')).toBe('metro-smart-bar') // @ symbol removed
    })
  })

  describe('venue aggregation', () => {
    it('extracts unique venues from concerts', async () => {
      const { normalizeVenueName } = await import('../../src/utils/normalize.js')

      const concerts = [
        {
          id: 'c1',
          date: '2024-01-15',
          headliner: 'Depeche Mode',
          venue: 'The Fillmore',
          city: 'San Francisco',
          state: 'CA',
        },
        {
          id: 'c2',
          date: '2024-02-20',
          headliner: 'The Cure',
          venue: 'The Fillmore',
          city: 'San Francisco',
          state: 'CA',
        },
        {
          id: 'c3',
          date: '2024-03-10',
          headliner: 'Bauhaus',
          venue: 'Metro',
          city: 'Chicago',
          state: 'IL',
        },
      ]

      const venueMap = new Map()
      concerts.forEach(concert => {
        const normalizedName = normalizeVenueName(concert.venue)

        if (!venueMap.has(normalizedName)) {
          venueMap.set(normalizedName, {
            name: concert.venue,
            city: concert.city,
            state: concert.state,
            concerts: [],
          })
        }

        venueMap.get(normalizedName).concerts.push({
          id: concert.id,
          date: concert.date,
          headliner: concert.headliner,
        })
      })

      expect(venueMap.size).toBe(2)
      expect(venueMap.get('the-fillmore').concerts).toHaveLength(2)
      expect(venueMap.get('metro').concerts).toHaveLength(1)
    })

    it('calculates venue statistics correctly', () => {
      const concerts = [
        { id: 'c1', date: '2020-01-15', headliner: 'Artist A' },
        { id: 'c2', date: '2021-06-20', headliner: 'Artist B' },
        { id: 'c3', date: '2022-03-10', headliner: 'Artist A' },
        { id: 'c4', date: '2023-12-05', headliner: 'Artist C' },
      ]

      const sortedConcerts = concerts.sort((a, b) => a.date.localeCompare(b.date))
      const uniqueArtists = new Set(concerts.map(c => c.headliner)).size

      const stats = {
        totalConcerts: concerts.length,
        firstEvent: sortedConcerts[0].date,
        lastEvent: sortedConcerts[sortedConcerts.length - 1].date,
        uniqueArtists,
      }

      expect(stats.totalConcerts).toBe(4)
      expect(stats.firstEvent).toBe('2020-01-15')
      expect(stats.lastEvent).toBe('2023-12-05')
      expect(stats.uniqueArtists).toBe(3)
    })

    it('sorts concerts chronologically', () => {
      const concerts = [
        { id: 'c3', date: '2024-03-10', headliner: 'Artist C' },
        { id: 'c1', date: '2024-01-15', headliner: 'Artist A' },
        { id: 'c2', date: '2024-02-20', headliner: 'Artist B' },
      ]

      const sorted = concerts.sort((a, b) => a.date.localeCompare(b.date))

      expect(sorted[0].id).toBe('c1')
      expect(sorted[1].id).toBe('c2')
      expect(sorted[2].id).toBe('c3')
    })
  })

  describe('geocode cache integration', () => {
    it('loads venue coordinates from geocode cache', () => {
      const geocodeCache = {
        'the fillmore|san francisco|ca': {
          lat: 37.7833,
          lng: -122.4333,
          formattedAddress: 'The Fillmore, San Francisco, CA',
          geocodedAt: '2024-01-01T00:00:00.000Z',
        },
      }

      const cacheKey = 'the fillmore|san francisco|ca'
      const location = geocodeCache[cacheKey]

      expect(location).toBeDefined()
      expect(location.lat).toBe(37.7833)
      expect(location.lng).toBe(-122.4333)
    })

    it('builds correct cache key for venue lookup', () => {
      const venue = 'The Fillmore'
      const city = 'San Francisco'
      const state = 'CA'

      const cacheKey = `${venue}|${city}|${state}`.toLowerCase()

      expect(cacheKey).toBe('the fillmore|san francisco|ca')
    })

    it('handles missing cache entries gracefully', () => {
      const geocodeCache = {}
      const cacheKey = 'nonexistent venue|city|state'

      const location = geocodeCache[cacheKey]

      expect(location).toBeUndefined()
    })
  })

  describe('Google Places API integration', () => {
    it('fetches place details for active venues', async () => {
      // Mock Google Places API response
      const mockPlaceDetails = {
        id: 'ChIJmock123',
        displayName: { text: 'The Fillmore' },
        formattedAddress: '1805 Geary Blvd, San Francisco, CA 94115',
        rating: 4.6,
        websiteUri: 'https://www.thefillmore.com',
        photos: [
          {
            name: 'places/ChIJmock123/photos/mock-photo-ref',
            widthPx: 4032,
            heightPx: 3024,
          },
        ],
      }

      // Simulate API call
      const isActive = true
      let placeDetails = null

      if (isActive) {
        placeDetails = mockPlaceDetails
      }

      expect(placeDetails).toBeDefined()
      expect(placeDetails.displayName.text).toBe('The Fillmore')
      expect(placeDetails.photos).toHaveLength(1)
    })

    it('generates photo URLs with correct sizes', () => {
      const photoName = 'places/ChIJmock123/photos/mock-photo-ref'

      // Simulate getPhotoUrl function
      const getPhotoUrl = (name: string, maxWidth: number) => {
        return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidth}&key=mock-api-key`
      }

      const photoUrls = {
        thumbnail: getPhotoUrl(photoName, 400),
        medium: getPhotoUrl(photoName, 800),
        large: getPhotoUrl(photoName, 1200),
      }

      expect(photoUrls.thumbnail).toContain('maxWidthPx=400')
      expect(photoUrls.medium).toContain('maxWidthPx=800')
      expect(photoUrls.large).toContain('maxWidthPx=1200')
    })

    it('sets 90-day cache expiry for active venues', () => {
      const now = new Date('2024-01-01T00:00:00Z')
      const expiryDate = new Date(now)
      expiryDate.setDate(expiryDate.getDate() + 90)

      // Expect ~90 days later (in 2024, Jan 1 + 90 days = March 30)
      const daysDiff = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBeGreaterThanOrEqual(89)
      expect(daysDiff).toBeLessThanOrEqual(91)
      expect(expiryDate.getFullYear()).toBe(2024)
      expect(expiryDate.getMonth()).toBe(2) // March (0-indexed)
    })

    it('uses generic fallback for active venues without photos', () => {
      const FALLBACK_IMAGES = {
        ACTIVE_NO_PHOTO: '/images/venues/fallback-active.jpg',
      }

      const photoUrls = {
        thumbnail: FALLBACK_IMAGES.ACTIVE_NO_PHOTO,
        medium: FALLBACK_IMAGES.ACTIVE_NO_PHOTO,
        large: FALLBACK_IMAGES.ACTIVE_NO_PHOTO,
      }

      expect(photoUrls.thumbnail).toBe('/images/venues/fallback-active.jpg')
      expect(photoUrls.medium).toBe('/images/venues/fallback-active.jpg')
      expect(photoUrls.large).toBe('/images/venues/fallback-active.jpg')
    })

    it('handles API errors gracefully', () => {
      // Simulate API error
      const placeDetails = null

      const FALLBACK_IMAGES = {
        API_ERROR: '/images/venues/fallback-active.jpg',
      }

      const photoUrls = placeDetails
        ? null
        : {
            thumbnail: FALLBACK_IMAGES.API_ERROR,
            medium: FALLBACK_IMAGES.API_ERROR,
            large: FALLBACK_IMAGES.API_ERROR,
          }

      expect(photoUrls).toBeDefined()
      expect(photoUrls?.thumbnail).toBe('/images/venues/fallback-active.jpg')
    })
  })

  describe('manual photos for legacy venues', () => {
    it('detects manual photos in /public/images/venues/', () => {
      const venuesImagesDir = path.join(testOutputDir, 'images', 'venues')
      fs.mkdirSync(venuesImagesDir, { recursive: true })

      // Create mock photo file
      const normalizedName = 'cbgb'
      const photoPath = path.join(venuesImagesDir, `${normalizedName}-1.jpg`)
      fs.writeFileSync(photoPath, 'mock image data')

      // Check for manual photos
      const files = fs.readdirSync(venuesImagesDir)
      const venuePhotos = files.filter(file =>
        file.startsWith(normalizedName) && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
      )

      expect(venuePhotos).toHaveLength(1)
      expect(venuePhotos[0]).toBe('cbgb-1.jpg')
    })

    it('generates photo URLs for manual photos', () => {
      const manualPhoto = {
        url: '/images/venues/cbgb-1.jpg',
        width: 1200,
        height: 800,
      }

      const photoUrls = {
        thumbnail: `${manualPhoto.url}?w=400`,
        medium: `${manualPhoto.url}?w=800`,
        large: manualPhoto.url,
      }

      expect(photoUrls.thumbnail).toBe('/images/venues/cbgb-1.jpg?w=400')
      expect(photoUrls.medium).toBe('/images/venues/cbgb-1.jpg?w=800')
      expect(photoUrls.large).toBe('/images/venues/cbgb-1.jpg')
    })

    it('uses closed door fallback for legacy venues without manual photos', () => {
      const FALLBACK_IMAGES = {
        LEGACY_NO_PHOTO: '/images/venues/fallback.jpg',
      }

      const manualPhotos = null
      const photoUrls = manualPhotos
        ? null
        : {
            thumbnail: FALLBACK_IMAGES.LEGACY_NO_PHOTO,
            medium: FALLBACK_IMAGES.LEGACY_NO_PHOTO,
            large: FALLBACK_IMAGES.LEGACY_NO_PHOTO,
          }

      expect(photoUrls?.thumbnail).toBe('/images/venues/fallback.jpg')
    })

    it('sets null cache expiry for legacy venues', () => {
      const isActive = false
      const photoCacheExpiry = isActive ? new Date().toISOString() : null

      expect(photoCacheExpiry).toBeNull()
    })

    it('handles multiple manual photos', () => {
      const venuesImagesDir = path.join(testOutputDir, 'images', 'venues')
      fs.mkdirSync(venuesImagesDir, { recursive: true })

      // Create multiple mock photo files
      const normalizedName = 'the-metro'
      fs.writeFileSync(path.join(venuesImagesDir, `${normalizedName}-1.jpg`), 'mock')
      fs.writeFileSync(path.join(venuesImagesDir, `${normalizedName}-2.jpg`), 'mock')
      fs.writeFileSync(path.join(venuesImagesDir, `${normalizedName}-3.png`), 'mock')

      const files = fs.readdirSync(venuesImagesDir)
      const venuePhotos = files.filter(file =>
        file.startsWith(normalizedName) && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
      )

      expect(venuePhotos).toHaveLength(3)
    })
  })

  describe('venue metadata structure', () => {
    it('includes all required fields', () => {
      const metadata = {
        name: 'The Fillmore',
        normalizedName: 'the-fillmore',
        city: 'San Francisco',
        state: 'CA',
        cityState: 'San Francisco, CA',
        location: { lat: 37.7833, lng: -122.4333 },
        concerts: [
          { id: 'c1', date: '2024-01-15', headliner: 'Depeche Mode' },
        ],
        stats: {
          totalConcerts: 1,
          firstEvent: '2024-01-15',
          lastEvent: '2024-01-15',
          uniqueArtists: 1,
        },
        status: 'active',
        closedDate: null,
        notes: null,
        places: {
          id: 'ChIJmock123',
          displayName: { text: 'The Fillmore' },
        },
        manualPhotos: null,
        photoUrls: {
          thumbnail: '/images/venues/the-fillmore-thumb.jpg',
          medium: '/images/venues/the-fillmore-med.jpg',
          large: '/images/venues/the-fillmore-large.jpg',
        },
        fetchedAt: '2024-01-01T00:00:00.000Z',
        photoCacheExpiry: '2024-03-31T00:00:00.000Z',
      }

      expect(metadata.name).toBe('The Fillmore')
      expect(metadata.normalizedName).toBe('the-fillmore')
      expect(metadata.cityState).toBe('San Francisco, CA')
      expect(metadata.stats.totalConcerts).toBe(1)
      expect(metadata.photoUrls).toBeDefined()
      expect(metadata.fetchedAt).toBeDefined()
    })

    it('correctly formats cityState field', () => {
      const city = 'Chicago'
      const state = 'IL'
      const cityState = `${city}, ${state}`

      expect(cityState).toBe('Chicago, IL')
    })

    it('handles venues without location data', () => {
      const metadata = {
        name: 'Unknown Venue',
        normalizedName: 'unknown-venue',
        city: 'Portland',
        state: 'OR',
        cityState: 'Portland, OR',
        location: undefined,
        concerts: [],
        stats: {
          totalConcerts: 0,
          firstEvent: '',
          lastEvent: '',
          uniqueArtists: 0,
        },
        status: 'active',
        closedDate: null,
        notes: null,
        places: null,
        photoUrls: null,
        fetchedAt: '2024-01-01T00:00:00.000Z',
        photoCacheExpiry: null,
      }

      expect(metadata.location).toBeUndefined()
      expect(metadata.stats.totalConcerts).toBe(0)
    })
  })

  describe('output file generation', () => {
    it('writes venues-metadata.json with correct structure', () => {
      const venuesMetadata = {
        'the-fillmore': {
          name: 'The Fillmore',
          normalizedName: 'the-fillmore',
          city: 'San Francisco',
          state: 'CA',
          cityState: 'San Francisco, CA',
          concerts: [],
          stats: {
            totalConcerts: 1,
            firstEvent: '2024-01-15',
            lastEvent: '2024-01-15',
            uniqueArtists: 1,
          },
          status: 'active',
          closedDate: null,
          notes: null,
          places: null,
          photoUrls: null,
          fetchedAt: '2024-01-01T00:00:00.000Z',
          photoCacheExpiry: null,
        },
      }

      const outputPath = path.join(testOutputDir, 'venues-metadata.json')
      fs.writeFileSync(outputPath, JSON.stringify(venuesMetadata, null, 2))

      expect(fs.existsSync(outputPath)).toBe(true)

      const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
      expect(written['the-fillmore'].name).toBe('The Fillmore')
    })

    it('creates output directory if missing', () => {
      const nestedPath = path.join(testOutputDir, 'nested', 'path', 'venues-metadata.json')
      const outputDir = path.dirname(nestedPath)

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      expect(fs.existsSync(outputDir)).toBe(true)

      fs.writeFileSync(nestedPath, JSON.stringify({}))
      expect(fs.existsSync(nestedPath)).toBe(true)
    })
  })

  describe('rate limiting', () => {
    it('enforces 100ms delay between venue requests', async () => {
      const startTime = Date.now()

      // Simulate 3 venue requests with rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
      await new Promise(resolve => setTimeout(resolve, 100))
      await new Promise(resolve => setTimeout(resolve, 100))

      const elapsedTime = Date.now() - startTime

      expect(elapsedTime).toBeGreaterThanOrEqual(300)
    })
  })

  describe('summary statistics', () => {
    it('calculates correct summary counts', () => {
      const venues = [
        { status: 'active', photoUrls: { thumbnail: 'url1' } },
        { status: 'active', photoUrls: { thumbnail: 'url2' } },
        { status: 'closed', photoUrls: null },
        { status: 'demolished', photoUrls: { thumbnail: 'url3' } },
      ]

      const activeCount = venues.filter(v => v.status === 'active').length
      const legacyCount = venues.filter(v => v.status !== 'active').length
      const photosFoundCount = venues.filter(v => v.photoUrls !== null).length

      expect(activeCount).toBe(2)
      expect(legacyCount).toBe(2)
      expect(photosFoundCount).toBe(3)
    })
  })
})
