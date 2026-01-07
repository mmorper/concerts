/**
 * Generate Artist Metadata
 *
 * Creates data/artist-metadata.json from current concerts data.
 * Extracts unique artists, detects genre inconsistencies, and merges
 * with existing artist enrichment data (photos, etc.).
 *
 * Usage:
 *   npm run generate-artist-metadata
 *   npm run generate-artist-metadata -- --dry-run
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { normalizeArtistName, normalizeGenreName } from '../src/utils/normalize.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Paths
const CONCERTS_PATH = join(__dirname, '../public/data/concerts.json')
const EXISTING_METADATA_PATH = join(__dirname, '../public/data/artists-metadata.json')
const OUTPUT_PATH = join(__dirname, '../data/artist-metadata.json')

// Types
interface Concert {
  id: string
  headliner: string
  headlinerNormalized: string
  genre: string
  genreNormalized: string
}

interface ExistingArtistMetadata {
  [artistNormalized: string]: {
    name: string
    image?: string
    bio?: string
    genres?: string[]
    formed?: string
    source: 'theaudiodb' | 'lastfm' | 'manual' | 'mock'
    fetchedAt: string
  }
}

interface ArtistMetadata {
  name: string
  normalizedName: string
  genre: string
  genreNormalized: string
  imageUrl?: string
  spotifyId?: string
  lastFmUrl?: string
  source: 'manual' | 'theaudiodb' | 'lastfm' | 'spotify'
  fetchedAt: string
}

interface ArtistMetadataFile {
  artists: ArtistMetadata[]
  lastUpdated: string
}

interface GenreCount {
  genre: string
  count: number
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`🎤 Generating Artist Metadata${dryRun ? ' (DRY RUN)' : ''}`)
  console.log('='.repeat(60))
  console.log()

  // Step 1: Load concerts data
  if (!existsSync(CONCERTS_PATH)) {
    console.error('❌ Error: concerts.json not found at', CONCERTS_PATH)
    console.error('   Run "npm run build-data" first to generate concert data')
    process.exit(1)
  }

  const concertsFile = JSON.parse(readFileSync(CONCERTS_PATH, 'utf-8'))
  const concerts: Concert[] = concertsFile.concerts

  console.log(`📊 Loaded ${concerts.length} concerts`)
  console.log()

  // Step 2: Extract unique artists and their genres
  const artistGenres = new Map<string, Map<string, number>>()

  concerts.forEach(concert => {
    const artist = concert.headliner
    const genre = concert.genre || 'Other'

    if (!artistGenres.has(artist)) {
      artistGenres.set(artist, new Map())
    }

    const genreCounts = artistGenres.get(artist)!
    genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1)
  })

  console.log(`🎸 Found ${artistGenres.size} unique headlining artists`)
  console.log()

  // Step 3: Load existing enrichment metadata
  let existingMetadata: ExistingArtistMetadata = {}
  if (existsSync(EXISTING_METADATA_PATH)) {
    existingMetadata = JSON.parse(readFileSync(EXISTING_METADATA_PATH, 'utf-8'))
    console.log(`📦 Loaded ${Object.keys(existingMetadata).length} existing enrichment records`)
    console.log()
  }

  // Step 4: Analyze genres and build metadata
  const artistMetadataList: ArtistMetadata[] = []
  const inconsistencies: Array<{
    artist: string
    genres: GenreCount[]
    suggested: string
  }> = []

  for (const [artistName, genreCounts] of artistGenres.entries()) {
    const normalized = normalizeArtistName(artistName)
    const genresList = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)

    // Detect inconsistencies (multiple genres)
    if (genresList.length > 1) {
      inconsistencies.push({
        artist: artistName,
        genres: genresList,
        suggested: genresList[0].genre
      })
    }

    // Use most common genre
    const canonicalGenre = genresList[0].genre

    // Check existing enrichment data
    const existingData = existingMetadata[normalized]

    // Build metadata entry
    const metadata: ArtistMetadata = {
      name: artistName,
      normalizedName: normalized,
      genre: canonicalGenre,
      genreNormalized: normalizeGenreName(canonicalGenre),
      source: 'manual',
      fetchedAt: new Date().toISOString()
    }

    // Merge existing enrichment data if available
    if (existingData) {
      if (existingData.image) {
        metadata.imageUrl = existingData.image
      }
      if (existingData.source !== 'mock' && existingData.source !== 'manual') {
        metadata.source = existingData.source
      }
    }

    artistMetadataList.push(metadata)
  }

  // Sort by artist name
  artistMetadataList.sort((a, b) => a.name.localeCompare(b.name))

  // Step 5: Report inconsistencies
  if (inconsistencies.length > 0) {
    console.log('⚠️  Genre Inconsistencies Found:')
    console.log('='.repeat(60))
    inconsistencies.forEach(({ artist, genres, suggested }) => {
      console.log(`\n   ${artist}:`)
      genres.forEach(({ genre, count }) => {
        const marker = genre === suggested ? '→' : ' '
        console.log(`     ${marker} "${genre}" (${count} show${count > 1 ? 's' : ''})`)
      })
      console.log(`     Suggested: "${suggested}"`)
    })
    console.log()
    console.log('='.repeat(60))
    console.log()
  }

  // Step 6: Build output file
  const outputData: ArtistMetadataFile = {
    artists: artistMetadataList,
    lastUpdated: new Date().toISOString()
  }

  // Step 7: Summary
  console.log('📈 Summary:')
  console.log(`   Total artists: ${artistMetadataList.length}`)
  console.log(`   Inconsistencies: ${inconsistencies.length}`)

  const withImages = artistMetadataList.filter(a => a.imageUrl).length
  console.log(`   With images: ${withImages} (${((withImages / artistMetadataList.length) * 100).toFixed(1)}%)`)

  const bySources = new Map<string, number>()
  artistMetadataList.forEach(a => {
    bySources.set(a.source, (bySources.get(a.source) || 0) + 1)
  })
  console.log(`   Sources: ${Array.from(bySources.entries()).map(([s, c]) => `${s}=${c}`).join(', ')}`)
  console.log()

  if (dryRun) {
    console.log('🔍 DRY RUN - No files written')
    console.log()
    console.log('Output would be written to:')
    console.log(`   ${OUTPUT_PATH}`)
    console.log()
    console.log('Sample entries (first 3):')
    artistMetadataList.slice(0, 3).forEach(a => {
      console.log(`   - ${a.name}: ${a.genre} (${a.source})${a.imageUrl ? ' [has image]' : ''}`)
    })
  } else {
    // Create backup if file exists
    if (existsSync(OUTPUT_PATH)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = OUTPUT_PATH.replace('.json', `.backup.${timestamp}.json`)
      copyFileSync(OUTPUT_PATH, backupPath)
      console.log(`📦 Backup created: ${backupPath}`)
    }

    // Write output
    writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2))
    console.log(`✅ Written to ${OUTPUT_PATH}`)
  }

  console.log()
  console.log('='.repeat(60))
  console.log('✨ Artist metadata generation complete!')
  console.log()

  if (!dryRun && inconsistencies.length > 0) {
    console.log('💡 Next steps:')
    console.log('   1. Review inconsistencies above')
    console.log('   2. Manually edit data/artist-metadata.json to fix if needed')
    console.log('   3. Run "npm run build-data" to apply changes')
    console.log()
  }
}

// Run if called directly
main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
