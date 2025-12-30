import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

/**
 * Enrich artist metadata with Spotify data
 *
 * IMPORTANT: This script requires Spotify API access
 *
 * Setup:
 * 1. Create a Spotify Developer app at https://developer.spotify.com/dashboard
 * 2. Add to .env:
 *    SPOTIFY_CLIENT_ID=your_client_id
 *    SPOTIFY_CLIENT_SECRET=your_client_secret
 * 3. Run: npm run enrich-spotify
 *
 * The script will:
 * - Search for each artist on Spotify
 * - Fetch their most popular album + cover art
 * - Fetch top 3 tracks with 30-second preview URLs
 * - Handle ambiguous matches using spotify-overrides.json
 */

dotenv.config()

interface SpotifyArtistMetadata {
  name: string
  normalizedName: string
  spotifyArtistId?: string
  spotifyArtistUrl?: string
  mostPopularAlbum?: {
    name: string
    spotifyAlbumId: string
    spotifyAlbumUrl: string
    coverArt: {
      small: string | null
      medium: string | null
      large: string | null
    }
    releaseYear: number
  }
  topTracks?: Array<{
    name: string
    spotifyTrackId: string
    spotifyUrl: string
    previewUrl: string | null
    durationMs: number
  }>
  genres?: string[]
  popularity?: number
  fetchedAt: string
  dataSource: 'spotify' | 'mock'
}

interface SpotifyOverride {
  spotifyArtistId: string
  note: string
}

function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Get Spotify access token using Client Credentials flow
 */
async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing Spotify credentials. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env file'
    )
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

/**
 * Search for artist on Spotify
 */
async function searchSpotifyArtist(
  artistName: string,
  accessToken: string
): Promise<any | null> {
  const encodedName = encodeURIComponent(artistName)
  const url = `https://api.spotify.com/v1/search?type=artist&q=${encodedName}&limit=5`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    console.warn(`  ⚠️  Spotify search failed for "${artistName}": ${response.status}`)
    return null
  }

  const data = await response.json()
  const artists = data.artists?.items || []

  if (artists.length === 0) {
    return null
  }

  // Return top result and log warnings if confidence is low
  const topResult = artists[0]
  const nameMatch = fuzzyMatch(artistName, topResult.name)
  const isPopular = topResult.popularity >= 30

  if (!nameMatch || !isPopular) {
    console.warn(
      `  ⚠️  Review match: "${artistName}" → "${topResult.name}" (popularity: ${topResult.popularity})`
    )
  }

  return topResult
}

/**
 * Fetch artist's most popular album
 */
async function getArtistTopAlbum(artistId: string, accessToken: string): Promise<any | null> {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album&market=US&limit=20`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  const albums = data.items || []

  if (albums.length === 0) {
    return null
  }

  // Get full album details to check popularity
  const albumDetailsPromises = albums.slice(0, 10).map(async (album: any) => {
    const detailUrl = `https://api.spotify.com/v1/albums/${album.id}`
    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    return detailRes.ok ? detailRes.json() : null
  })

  const albumDetails = (await Promise.all(albumDetailsPromises)).filter(Boolean)

  // Sort by popularity and return the top one
  albumDetails.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))

  return albumDetails[0] || null
}

/**
 * Fetch artist's top tracks
 */
async function getArtistTopTracks(
  artistId: string,
  accessToken: string
): Promise<any[] | null> {
  const url = `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.tracks?.slice(0, 3) || []
}

/**
 * Simple fuzzy name matching
 */
function fuzzyMatch(input: string, result: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim()

  const normalizedInput = normalize(input)
  const normalizedResult = normalize(result)

  return normalizedResult.includes(normalizedInput) || normalizedInput.includes(normalizedResult)
}

/**
 * Main enrichment function
 */
async function enrichSpotifyMetadata() {
  console.log('🎵 Enriching artist metadata with Spotify data...\n')

  // Check for Spotify credentials
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('❌ Missing Spotify credentials in .env file')
    console.error('   Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET\n')
    process.exit(1)
  }

  // Load artists metadata
  const metadataPath = join(process.cwd(), 'public', 'data', 'artists-metadata.json')
  const metadataFile = JSON.parse(readFileSync(metadataPath, 'utf-8'))
  const artists = metadataFile.artists

  // Load overrides
  const overridesPath = join(process.cwd(), 'scripts', 'spotify-overrides.json')
  const overrides: Record<string, SpotifyOverride> = JSON.parse(
    readFileSync(overridesPath, 'utf-8')
  )

  // Get Spotify access token
  console.log('🔑 Authenticating with Spotify...')
  const accessToken = await getSpotifyAccessToken()
  console.log('✅ Authenticated\n')

  let enriched = 0
  let skipped = 0
  let failed = 0

  const artistNames = Object.keys(artists)
  console.log(`Processing ${artistNames.length} artists...\n`)

  for (const normalizedName of artistNames) {
    const artist = artists[normalizedName]

    // Skip if already enriched with Spotify data (within 90 days)
    if (artist.dataSource === 'spotify' && artist.fetchedAt) {
      const age = Date.now() - new Date(artist.fetchedAt).getTime()
      const ninetyDays = 90 * 24 * 60 * 60 * 1000
      if (age < ninetyDays) {
        skipped++
        continue
      }
    }

    console.log(`Fetching: ${artist.name}`)

    try {
      // Rate limiting (Spotify allows ~3 requests/sec)
      await new Promise(resolve => setTimeout(resolve, 350))

      let spotifyArtist = null

      // Check for manual override first
      if (overrides[normalizedName]) {
        console.log(`  📌 Using manual override`)
        const artistUrl = `https://api.spotify.com/v1/artists/${overrides[normalizedName].spotifyArtistId}`
        const response = await fetch(artistUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (response.ok) {
          spotifyArtist = await response.json()
        }
      } else {
        // Search Spotify
        spotifyArtist = await searchSpotifyArtist(artist.name, accessToken)
      }

      if (!spotifyArtist) {
        console.log(`  ❌ Not found on Spotify`)
        failed++
        continue
      }

      // Fetch album and tracks
      const [album, tracks] = await Promise.all([
        getArtistTopAlbum(spotifyArtist.id, accessToken),
        getArtistTopTracks(spotifyArtist.id, accessToken)
      ])

      // Update artist metadata
      artist.spotifyArtistId = spotifyArtist.id
      artist.spotifyArtistUrl = spotifyArtist.external_urls.spotify
      artist.genres = spotifyArtist.genres
      artist.popularity = spotifyArtist.popularity
      artist.dataSource = 'spotify'
      artist.fetchedAt = new Date().toISOString()

      if (album) {
        const images = album.images || []
        artist.mostPopularAlbum = {
          name: album.name,
          spotifyAlbumId: album.id,
          spotifyAlbumUrl: album.external_urls.spotify,
          coverArt: {
            small: images.find((img: any) => img.height === 64)?.url || images[2]?.url || null,
            medium: images.find((img: any) => img.height === 300)?.url || images[1]?.url || null,
            large: images.find((img: any) => img.height === 640)?.url || images[0]?.url || null
          },
          releaseYear: album.release_date ? parseInt(album.release_date.split('-')[0]) : 0
        }
      }

      if (tracks && tracks.length > 0) {
        artist.topTracks = tracks.map((track: any) => ({
          name: track.name,
          spotifyTrackId: track.id,
          spotifyUrl: track.external_urls.spotify,
          previewUrl: track.preview_url || null,
          durationMs: track.duration_ms
        }))
      }

      console.log(`  ✅ Enriched (album: ${album?.name || 'N/A'})`)
      enriched++
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`)
      failed++
    }
  }

  // Update metadata and save
  metadataFile.metadata.lastUpdated = new Date().toISOString()
  metadataFile.metadata.dataSource = 'spotify'
  metadataFile.metadata.note =
    'Artist metadata enriched with Spotify API data including album covers, track previews, and artist information.'

  writeFileSync(metadataPath, JSON.stringify(metadataFile, null, 2))

  console.log(`\n📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched}`)
  console.log(`   ⏭️  Skipped (cached): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`\n💾 Saved to: ${metadataPath}`)
  console.log('\n🎉 Done!')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichSpotifyMetadata().catch(console.error)
}

export { enrichSpotifyMetadata }
