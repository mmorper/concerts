import { MusicBrainzClient, Album } from './utils/musicbrainz-client'
import { normalizeArtistName } from '../src/utils/normalize.js'
import { createBackup } from './utils/backup'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

/**
 * Enrich artist discographies from MusicBrainz
 *
 * This script fetches comprehensive discography data (albums, release dates, cover art)
 * for all artists in the concert database. Data is cached for 90 days.
 *
 * Usage:
 *   npm run enrich:discography              # Enrich new/stale artists only
 *   npm run enrich:discography -- --dry-run # Preview without writing
 *   npm run enrich:discography -- --force   # Re-fetch all artists
 *
 * Output: public/data/discography.json
 */

dotenv.config()

interface ArtistMetadata {
  name: string
  normalizedName: string
  dataSource?: string
  source?: string
  fetchedAt: string
  [key: string]: any
}

interface ArtistDiscography {
  artistName: string
  normalizedName: string
  mbid: string | null
  fetchedAt: string
  cachedAt: string
  albumCount: number
  albums: Album[]
}

interface DiscographyFile {
  [normalizedArtistName: string]: ArtistDiscography
}

/**
 * Enrich artist discographies from MusicBrainz
 */
async function enrichDiscography(options: { dryRun?: boolean; force?: boolean } = {}) {
  const {
    dryRun = process.argv.includes('--dry-run'),
    force = process.argv.includes('--force')
  } = options

  console.log(`🎵 Enriching artist discographies from MusicBrainz...${dryRun ? ' (DRY RUN)' : ''}\n`)

  // Load artists metadata to get list of artists
  const artistsMetadataPath = join(process.cwd(), 'public', 'data', 'artists-metadata.json')
  if (!existsSync(artistsMetadataPath)) {
    console.error('❌ artists-metadata.json not found. Run "npm run build-data" first.')
    process.exit(1)
  }

  const artistsMetadata: Record<string, ArtistMetadata> = JSON.parse(
    readFileSync(artistsMetadataPath, 'utf-8')
  )

  // Get unique artists
  const uniqueArtists = Object.values(artistsMetadata)
  console.log(`Found ${uniqueArtists.length} unique artists\n`)

  // Load existing discography cache if available
  const discographyPath = join(process.cwd(), 'public', 'data', 'discography.json')
  let discography: DiscographyFile = {}
  if (existsSync(discographyPath)) {
    discography = JSON.parse(readFileSync(discographyPath, 'utf-8'))
    console.log(`Loaded ${Object.keys(discography).length} existing discography records\n`)
  }

  // Initialize MusicBrainz client
  const mbClient = new MusicBrainzClient()

  // Cache TTL: 90 days
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000

  let enriched = 0
  let skipped = 0
  let failed = 0

  for (const artist of uniqueArtists) {
    const normalized = normalizeArtistName(artist.name)

    // Skip mock data artists (no real metadata yet)
    const isMockData = artist.dataSource === 'mock' || artist.source === 'mock'
    if (isMockData) {
      skipped++
      continue
    }

    // Skip if already cached and not stale (unless --force)
    const existingData = discography[normalized]
    if (existingData && !force) {
      const age = Date.now() - new Date(existingData.cachedAt).getTime()
      if (age < NINETY_DAYS) {
        skipped++
        continue
      }
    }

    console.log(`Fetching: ${artist.name}`)

    try {
      // Search for artist MBID
      const mbid = await mbClient.searchArtist(artist.name)

      if (!mbid) {
        console.log(`  ⚠️  Not found in MusicBrainz`)

        // Store empty entry to avoid re-fetching
        discography[normalized] = {
          artistName: artist.name,
          normalizedName: normalized,
          mbid: null,
          albumCount: 0,
          albums: [],
          fetchedAt: new Date().toISOString(),
          cachedAt: new Date().toISOString()
        }

        failed++
        continue
      }

      console.log(`  ✅ Found MBID: ${mbid}`)

      // Fetch discography
      const albums = await mbClient.getDiscography(mbid, artist.name)

      console.log(`  ✅ Found ${albums.length} albums`)

      // Count albums with cover art
      const withCovers = albums.filter(a => a.coverAvailable).length
      console.log(`  ✅ ${withCovers}/${albums.length} albums have cover art`)

      // Store discography entry
      discography[normalized] = {
        artistName: artist.name,
        normalizedName: normalized,
        mbid,
        albumCount: albums.length,
        albums,
        fetchedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString()
      }

      enriched++
    } catch (error) {
      console.error(`  ❌ Error fetching ${artist.name}:`, error)
      failed++
    }

    console.log() // Blank line between artists
  }

  // Save discography
  if (dryRun) {
    console.log('=' .repeat(60))
    console.log('🔍 DRY RUN MODE - No files will be modified')
    console.log('=' .repeat(60))
    console.log(`\nWould write to: ${discographyPath}`)
    console.log(`File size: ${(JSON.stringify(discography, null, 2).length / 1024).toFixed(1)} KB`)
  } else {
    // Create backup before overwriting
    if (existsSync(discographyPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + 'T' +
                       new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0]
      createBackup(discographyPath, { maxBackups: 10, verbose: true })
      console.log(`📦 Backup created: discography.json.backup.${timestamp}\n`)
    }

    // Write new discography
    writeFileSync(discographyPath, JSON.stringify(discography, null, 2))
  }

  console.log(`📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched} artist discographies`)
  console.log(`   ⏭️  Skipped (cached): ${skipped} artist discographies`)
  console.log(`   ❌ Failed: ${failed} artist discographies`)

  if (dryRun) {
    console.log('\n💡 To apply these changes, run without --dry-run flag')
  } else {
    console.log(`\n💾 Saved to: ${discographyPath}`)
  }

  console.log(`\n🎉 Done!${dryRun ? ' (DRY RUN)' : ''}`)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichDiscography()
}

export { enrichDiscography }
