/**
 * Enrich Concert Genres
 *
 * Replaces concert-level genres with artist-level genres from metadata.
 * This runs after fetch-google-sheet to override any genres from the sheet
 * with the canonical genre from artist metadata.
 *
 * Usage:
 *   Called by build-data.ts pipeline
 *   Can also run standalone: tsx scripts/enrich-concert-genres.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ArtistMetadataManager } from './utils/artist-metadata-manager.js'
import { createBackup } from './utils/backup.js'
import * as dotenv from 'dotenv'

dotenv.config()

interface Concert {
  id: string
  headliner: string
  genre: string
  genreNormalized: string
  [key: string]: any
}

interface ConcertsFile {
  concerts: Concert[]
  generatedAt: string
}

export async function enrichConcertGenres(options: { dryRun?: boolean } = {}) {
  const { dryRun = process.argv.includes('--dry-run') } = options

  console.log(`🎵 Enriching concert genres from artist metadata...${dryRun ? ' (DRY RUN)' : ''}`)
  console.log()

  // Paths
  const concertsPath = join(process.cwd(), 'public', 'data', 'concerts.json')
  const metadataPath = join(process.cwd(), 'data', 'artist-metadata.json')

  // Load concerts
  if (!existsSync(concertsPath)) {
    console.error('❌ concerts.json not found. Run "npm run fetch-sheet" first.')
    process.exit(1)
  }

  const concertsFile: ConcertsFile = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts = concertsFile.concerts

  console.log(`📊 Loaded ${concerts.length} concerts`)
  console.log()

  // Initialize artist metadata manager
  const metadataManager = new ArtistMetadataManager(
    metadataPath,
    process.env.THEAUDIODB_API_KEY || '2', // TheAudioDB free key
    process.env.LASTFM_API_KEY
  )

  // Load metadata
  metadataManager.load()
  console.log()

  // Enrich concerts with genres
  let enriched = 0
  let newArtists = 0
  let unchanged = 0

  for (const concert of concerts) {
    const originalGenre = concert.genre
    const genreInfo = await metadataManager.getGenre(concert.headliner)

    if (genreInfo.isNew) {
      newArtists++
    }

    // Update concert genre
    concert.genre = genreInfo.genre
    concert.genreNormalized = genreInfo.genreNormalized

    if (originalGenre !== genreInfo.genre) {
      enriched++
    } else {
      unchanged++
    }
  }

  console.log()
  console.log('📈 Enrichment Summary:')
  console.log(`   Total concerts: ${concerts.length}`)
  console.log(`   Genres updated: ${enriched}`)
  console.log(`   Unchanged: ${unchanged}`)
  if (newArtists > 0) {
    console.log(`   New artists enriched: ${newArtists}`)
  }
  console.log()

  // Show metadata stats
  const stats = metadataManager.getStats()
  console.log('📊 Artist Metadata Stats:')
  console.log(`   Total artists: ${stats.total}`)
  console.log(`   With images: ${stats.withImages} (${((stats.withImages / stats.total) * 100).toFixed(1)}%)`)
  console.log(`   Sources: ${Object.entries(stats.bySources).map(([s, c]) => `${s}=${c}`).join(', ')}`)
  console.log()

  if (dryRun) {
    console.log('🔍 DRY RUN - No files written')
    console.log()
  } else {
    // Save updated concerts
    createBackup(concertsPath)
    writeFileSync(concertsPath, JSON.stringify(concertsFile, null, 2))
    console.log(`💾 Saved ${concerts.length} enriched concerts to ${concertsPath}`)

    // Save artist metadata if new artists were added
    metadataManager.save()
    console.log()
  }

  console.log('✨ Genre enrichment complete!')
  console.log()
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichConcertGenres().catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
}
