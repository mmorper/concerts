import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Generate mock Spotify metadata for all artists
 * This creates the proper schema structure that will be populated
 * with real Spotify data once API access is available
 */

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
      small: string | null   // 64px - lazy load placeholder
      medium: string | null  // 300px - S/M cards
      large: string | null   // 640px - L/XL cards
    }
    releaseYear: number
  }
  topTracks?: Array<{
    name: string
    spotifyTrackId: string
    spotifyUrl: string
    previewUrl: string | null  // 30-sec MP3, may be null
    durationMs: number
  }>
  genres?: string[]
  popularity?: number
  fetchedAt: string
  dataSource: 'spotify' | 'mock'
}

interface ArtistsMetadataFile {
  metadata: {
    lastUpdated: string
    totalArtists: number
    dataSource: 'spotify' | 'mock'
    note: string
  }
  artists: Record<string, SpotifyArtistMetadata>
}

function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function generateMockMetadata() {
  console.log('🎭 Generating mock Spotify metadata for all artists...\n')

  // Load concerts data
  const concertsPath = join(process.cwd(), 'public', 'data', 'concerts.json')
  const concertsData = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts = concertsData.concerts

  // Get unique artists (headliners + openers)
  const artistSet = new Set<string>()

  concerts.forEach((concert: any) => {
    // Add headliner
    artistSet.add(concert.headliner)

    // Add openers
    if (concert.openers && Array.isArray(concert.openers)) {
      concert.openers.forEach((opener: string) => {
        if (opener && opener.trim()) {
          artistSet.add(opener.trim())
        }
      })
    }
  })

  const uniqueArtists = Array.from(artistSet).sort()
  console.log(`Found ${uniqueArtists.length} unique artists (headliners + openers)\n`)

  // Generate mock metadata for each artist
  const artists: Record<string, SpotifyArtistMetadata> = {}

  uniqueArtists.forEach((artistName, index) => {
    const normalized = normalizeArtistName(artistName)

    artists[normalized] = {
      name: artistName,
      normalizedName: normalized,
      // Spotify fields intentionally left undefined/null for mock data
      spotifyArtistId: undefined,
      spotifyArtistUrl: undefined,
      mostPopularAlbum: undefined,
      topTracks: undefined,
      genres: undefined,
      popularity: undefined,
      fetchedAt: new Date().toISOString(),
      dataSource: 'mock'
    }

    if ((index + 1) % 50 === 0) {
      console.log(`  Generated ${index + 1}/${uniqueArtists.length} mock records...`)
    }
  })

  // Create metadata file structure
  const metadataFile: ArtistsMetadataFile = {
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalArtists: uniqueArtists.length,
      dataSource: 'mock',
      note: 'This file contains mock/placeholder data. Run enrich-spotify-metadata.ts when Spotify API access is available to populate with real album covers, track previews, and artist data.'
    },
    artists
  }

  // Save to file
  const outputPath = join(process.cwd(), 'public', 'data', 'artists-metadata.json')
  writeFileSync(outputPath, JSON.stringify(metadataFile, null, 2))

  console.log(`\n✅ Generated mock metadata for ${uniqueArtists.length} artists`)
  console.log(`💾 Saved to: ${outputPath}`)
  console.log('\n📝 Sample artists:')
  uniqueArtists.slice(0, 5).forEach(artist => {
    console.log(`   - ${artist}`)
  })
  console.log(`   ... and ${uniqueArtists.length - 5} more\n`)
  console.log('🎉 Done! The Artist Scene UI can now be built with placeholder data.')
  console.log('   Real Spotify data will be added later when API access is available.\n')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateMockMetadata()
}

export { generateMockMetadata }
