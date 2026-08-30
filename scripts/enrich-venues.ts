import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'
import { normalizeVenueName } from '../src/utils/normalize.js'
import {
  getVenuePlaceDetails,
  fetchPhoto,
  fetchPhotoUri,
  loadCache as loadPlacesCache,
  saveCache as savePlacesCache,
} from './utils/google-places-client.js'
import { checkUrl } from './utils/url-health.js'

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
  /**
   * When this record was last refreshed. Since #255 a refresh also validates
   * the photo URL, so this doubles as "last confirmed to load".
   */
  fetchedAt: string
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
    /* 🔴 THE SLUG IS HYPHENATED AND THE FILENAMES ARE NOT.
       `file.startsWith('universal-amphitheater')` never matched
       `universalamphitheater-1.jpg`, so EIGHT archival photographs sat unused in the
       repo — and they are photographs of exactly the venues that can never have a Places
       photo: Irvine Meadows, Universal Amphitheater, RFK Stadium, Hollywood Park
       Racetrack, and the renamed rooms.
       Those posts fell through to the generic closed-door fallback, or to an album cover
       by whichever band sorted first.
       Both sides are now reduced to letters and digits, so the naming convention of the
       files and the shape of the slug stop having to agree. */
    const key = normalizedName.replace(/[^a-z0-9]/gi, '').toLowerCase()
    const files = fs.readdirSync(imagesDir)
    const venuePhotos = files.filter(file => {
      if (!/\.(jpg|jpeg|png)$/i.test(file)) return false
      const base = file
        .replace(/\.\w+$/, '')     // extension
        .replace(/-\d+$/, '')       // the -1, -2 ordinal
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
      return base === key
    })

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

const FALLBACK_PATHS: readonly string[] = Object.values(FALLBACK_IMAGES)

/**
 * Whether a record's photos are placeholders rather than a real venue image.
 *
 * Used to decide if a throttled run has anything worth preserving — carrying a
 * previous fallback forward is pointless, carrying a previous real photo
 * forward is the whole point (#315).
 */
function isFallbackUrls(urls: { thumbnail: string; medium: string; large: string }): boolean {
  return FALLBACK_PATHS.includes(urls.large)
}

/**
 * The venues-metadata.json this run is about to replace.
 *
 * Enrichment rebuilds the file from scratch each run, which means a bad run can
 * erase good data. Reading the previous state first lets a rate-limited venue
 * keep the photo an earlier run already validated.
 */
function loadExistingMetadata(outputPath: string): Record<string, VenueMetadata> {
  try {
    if (fs.existsSync(outputPath)) {
      return JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
    }
  } catch (error) {
    console.warn('Warning: Could not read existing venues-metadata.json:', error)
  }
  return {}
}

/** How many of a place's photos to try before giving up and falling back. */
const MAX_PHOTO_CANDIDATES = 5

/** The three sizes stored on every venue record, largest first. */
const PHOTO_HEIGHTS = { large: 1200, medium: 800, thumbnail: 400 } as const

type PhotoUrls = { thumbnail: string; medium: string; large: string }

/**
 * Outcome of trying to photograph one venue.
 *
 * The `throttled` case is the point. Before #315 this function returned
 * `PhotoUrls | null` and the caller wrote a generic fallback on null — so a
 * 429 storm was indistinguishable from "this place has no photos", and a
 * 79-venue run on 2026-08-22 silently downgraded ten venues that demonstrably
 * still had usable imagery. Rate limiting is not evidence about content.
 */
type PhotoResolution =
  | { status: 'ok'; urls: PhotoUrls }
  | { status: 'none' }
  | { status: 'throttled' }

/**
 * Derive the other two sizes from one resolved URL.
 *
 * A Places photo URL ends in a size directive — `…=s4800-h1200` — and the CDN
 * honours any smaller height on the same base. Verified on 2026-08-22 across
 * every stored venue: rewriting the suffix yields byte-identical URLs to what
 * three separate API calls return, including the clamped case where the source
 * photo is shorter than the requested height (`knots-berry-farm`, `-h982`).
 *
 * This is the other half of the 429 fix. The old code spent three photo-media
 * calls per candidate to fetch three sizes of the *same* photo — 15 calls per
 * venue before it even walked to a second candidate. One call does it.
 *
 * Returns null if the URL is not in the expected shape, so the caller can fall
 * back to asking the API per size rather than inventing a URL.
 */
function deriveSizes(largeUrl: string): PhotoUrls | null {
  const base = largeUrl.match(/^(.*)-h\d+$/)?.[1]
  if (!base) return null
  return {
    thumbnail: `${base}-h${PHOTO_HEIGHTS.thumbnail}`,
    medium: `${base}-h${PHOTO_HEIGHTS.medium}`,
    large: largeUrl,
  }
}

/**
 * Resolve the first photo whose CDN URL actually loads.
 *
 * A successful Places API response is not evidence of a usable image: the API
 * returns a photo URI for a photo that has since been unpublished, and that URI
 * 403s on fetch. Until #255 this function's predecessor fell back only when the
 * *API call* failed, so dead URLs were stored and served — `greek-theatre` and
 * `garden-amp` were both processed by a successful weekly run and left broken.
 *
 * Places typically returns ~10 photos per venue, so one unpublished photo is no
 * reason to drop the venue to a generic fallback; we walk the list.
 *
 * Only a definitive 4xx rejects a candidate. A 5xx or timeout returns "unknown"
 * and is accepted — a transient blip must not cost a venue its photo. The same
 * principle now covers the API side: a throttled candidate ends the walk and
 * reports `throttled`, because continuing would burn four more candidates
 * against a rate limit and then report a content verdict we never established.
 */
async function resolveLivePhotoUrls(
  photos: Array<{ name: string }>
): Promise<PhotoResolution> {
  for (const photo of photos.slice(0, MAX_PHOTO_CANDIDATES)) {
    const resolved = await fetchPhoto(photo.name, PHOTO_HEIGHTS.large)

    if (!resolved.ok) {
      if (resolved.reason === 'throttled') return { status: 'throttled' }
      continue // stale name or no key — try the next candidate
    }

    let urls = deriveSizes(resolved.uri)
    if (!urls) {
      // Unexpected URL shape: pay for the extra calls rather than guess.
      const [thumbnail, medium] = await Promise.all([
        fetchPhotoUri(photo.name, PHOTO_HEIGHTS.thumbnail),
        fetchPhotoUri(photo.name, PHOTO_HEIGHTS.medium),
      ])
      if (!thumbnail || !medium) continue
      urls = { thumbnail, medium, large: resolved.uri }
    }

    // All three sizes are the same photo reference with a different size
    // suffix, so one check settles all three.
    if ((await checkUrl(urls.large)) === 'dead') {
      console.log(`  ⚠ Photo resolved but does not load — trying the next one`)
      continue
    }

    return { status: 'ok', urls }
  }
  return { status: 'none' }
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
    const outputPath = path.join(__dirname, '../public/data/venues-metadata.json')
    const existingMetadata = loadExistingMetadata(outputPath)

    const venuesMetadata: Record<string, VenueMetadata> = {}
    let activeCount = 0
    let legacyCount = 0
    let photosFoundCount = 0
    let photosKeptCount = 0
    let throttledNoPriorCount = 0

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

          // Use Places API location when geocode cache has no coordinates
          if (!metadata.location && placeDetails.location) {
            metadata.location = {
              lat: placeDetails.location.latitude,
              lng: placeDetails.location.longitude,
            }
            console.log(`  📍 Location from Places API: ${metadata.location.lat}, ${metadata.location.lng}`)
          }

          // Generate photo URLs if photos available
          if (placeDetails.photos && placeDetails.photos.length > 0) {
            let resolution = await resolveLivePhotoUrls(placeDetails.photos)

            // Cached photo names may be stale — retry with a fresh API call.
            // Not worth doing when we were throttled: the retry would hit the
            // same rate limit, and the cached names were never disproved.
            if (resolution.status === 'none') {
              console.log(`  ↩ No live photo from cached names, re-fetching from API...`)
              const freshDetails = await getVenuePlaceDetails(
                venue.name, venue.city, venue.state,
                venue.location?.lat, venue.location?.lng,
                true // forceRefresh
              )
              if (freshDetails?.photos?.length) {
                metadata.places = freshDetails
                resolution = await resolveLivePhotoUrls(freshDetails.photos)
              }
            }

            if (resolution.status === 'ok') {
              metadata.photoUrls = resolution.urls
              photosFoundCount++
              console.log(`  ✓ Found ${placeDetails.photos.length} photo(s)`)
            } else if (resolution.status === 'throttled') {
              /**
               * Rate limited, which says nothing about whether this venue has a
               * photo. Keep whatever the last run stored rather than
               * overwriting it with a generic fallback (#315) — a real venue
               * photo beats a placeholder, and the next run will refresh it.
               *
               * But only if it still loads. The first cut of this kept the
               * previous URL unconditionally and quietly carried three dead
               * 403s forward, which is the #255 mistake wearing a different
               * hat: a stored URL is never evidence of a live image. One HEAD
               * settles it, and it costs no API quota.
               */
              const previous = existingMetadata[normalizedName]?.photoUrls
              const worthKeeping =
                previous && !isFallbackUrls(previous) && (await checkUrl(previous.large)) !== 'dead'

              if (worthKeeping) {
                metadata.photoUrls = previous
                metadata.fetchedAt = existingMetadata[normalizedName].fetchedAt
                photosKeptCount++
                console.log(`  ⏸ Rate limited — keeping the previous photo (still loads)`)
              } else {
                metadata.photoUrls = generateFallbackPhotoUrls(FALLBACK_IMAGES.ACTIVE_NO_PHOTO)
                throttledNoPriorCount++
                console.log(`  ⏸ Rate limited, no usable previous photo (using fallback)`)
              }
            } else {
              metadata.photoUrls = generateFallbackPhotoUrls(FALLBACK_IMAGES.ACTIVE_NO_PHOTO)
              console.log(`  ⚠ Could not resolve a live photo URI (using fallback)`)
            }
          } else {
            // Active venue but no photos from API - use generic fallback
            metadata.photoUrls = generateFallbackPhotoUrls(FALLBACK_IMAGES.ACTIVE_NO_PHOTO)
            console.log(`  ⚠ No photos available from Places API (using fallback)`)
          }

          // No photo expiry is recorded. Photo URLs do not expire on a clock —
          // they are revoked when the underlying photo is unpublished, which no
          // TTL can predict (#252). `fetchedAt` above is the useful timestamp:
          // since #255 every run validates the URL it stores, so it means "last
          // confirmed to load", which is what an expiry field was reaching for.
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
      }

      venuesMetadata[normalizedName] = metadata
    }

    // Save Places API cache
    savePlacesCache()

    // Write venues-metadata.json
    const outputDir = path.dirname(outputPath)

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputPath, JSON.stringify(venuesMetadata, null, 2), 'utf-8')

    // Patch concerts.json with any newly discovered coordinates from Places API
    let patchedConcerts = 0
    for (const concert of concerts) {
      const normalizedName = normalizeVenueName(concert.venue)
      const venueLocation = venuesMetadata[normalizedName]?.location
      if (venueLocation && concert.location) {
        if (concert.location.lat !== venueLocation.lat || concert.location.lng !== venueLocation.lng) {
          concert.location = { lat: venueLocation.lat, lng: venueLocation.lng }
          patchedConcerts++
        }
      }
    }

    if (patchedConcerts > 0) {
      fs.writeFileSync(concertsPath, JSON.stringify(concertsData, null, 2), 'utf-8')
      console.log(`\n📍 Patched ${patchedConcerts} concert${patchedConcerts > 1 ? 's' : ''} in concerts.json with corrected coordinates`)
    }

    // Print summary
    console.log('\n=== Enrichment Complete ===')
    console.log(`✓ Enriched ${venueMap.size} venues`)
    console.log(`  - ${activeCount} active venues`)
    console.log(`  - ${legacyCount} legacy venues`)
    console.log(`  - ${photosFoundCount} venues with photos`)
    if (photosKeptCount > 0) {
      console.log(`  - ${photosKeptCount} kept a previous photo (rate limited this run)`)
    }
    if (throttledNoPriorCount > 0) {
      console.log(`  - ${throttledNoPriorCount} rate limited with no usable previous photo`)
    }
    console.log(`\nOutput: public/data/venues-metadata.json`)
    console.log(`Cache: public/data/venue-photos-cache.json`)
  } catch (error) {
    console.error('Error enriching venues:', error)
    process.exit(1)
  }
}

// Run if called directly — matches the guard in enrich-artists.ts. Without it,
// merely importing this module (as a test does) runs the whole enrichment,
// hitting the Places API and rewriting venues-metadata.json.
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichVenues()
}

export { enrichVenues, resolveLivePhotoUrls }
