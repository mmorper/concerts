import { TheAudioDBClient } from './utils/theaudiodb-client'
import { LastFmClient } from './utils/lastfm-client'
import { RateLimiter } from './utils/rate-limiter'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

interface ArtistMetadata {
  [artistNormalized: string]: {
    name: string
    image?: string
    bio?: string
    genres?: string[]
    formed?: string
    source: 'theaudiodb' | 'lastfm' | 'manual'
    fetchedAt: string
  }
}

/**
 * Enrich concert data with artist metadata from free APIs
 */
async function enrichArtists() {
  console.log('🎤 Enriching concert data with artist metadata...\n')

  // Load concerts data
  const concertsPath = join(process.cwd(), 'public', 'data', 'concerts.json')
  if (!existsSync(concertsPath)) {
    console.error('❌ concerts.json not found. Run "npm run fetch-sheet" first.')
    process.exit(1)
  }

  const concertsData = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts = concertsData.concerts

  // Get unique artists (headliners only for now)
  const uniqueArtists = [...new Set(concerts.map((c: any) => c.headliner))]
  console.log(`Found ${uniqueArtists.length} unique artists to enrich\n`)

  // Load existing metadata if available
  const metadataPath = join(process.cwd(), 'public', 'data', 'artists-metadata.json')
  let metadata: ArtistMetadata = {}
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
    console.log(`Loaded ${Object.keys(metadata).length} existing artist records\n`)
  }

  // Initialize API clients
  const audioDb = new TheAudioDBClient(process.env.THEAUDIODB_API_KEY || '2')
  const lastFm = process.env.LASTFM_API_KEY
    ? new LastFmClient(process.env.LASTFM_API_KEY)
    : null

  const rateLimiter = new RateLimiter(2) // TheAudioDB: 2 calls/sec

  let enriched = 0
  let skipped = 0
  let failed = 0

  for (const artistName of uniqueArtists) {
    const normalized = normalizeArtistName(artistName)

    // Skip if already enriched and recent (within 30 days)
    if (metadata[normalized]) {
      const age = Date.now() - new Date(metadata[normalized].fetchedAt).getTime()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      if (age < thirtyDays) {
        skipped++
        continue
      }
    }

    console.log(`Fetching metadata for: ${artistName}`)

    try {
      // Rate limit
      await rateLimiter.wait()

      // Try TheAudioDB first
      const audioDbInfo = await audioDb.getArtistInfo(artistName)

      if (audioDbInfo && audioDbInfo.image) {
        metadata[normalized] = audioDbInfo
        console.log(`  ✅ Found on TheAudioDB`)
        enriched++
        continue
      }

      // Fallback to Last.fm
      if (lastFm) {
        const lastFmInfo = await lastFm.getArtistInfo(artistName)

        if (lastFmInfo && lastFmInfo.image) {
          metadata[normalized] = lastFmInfo
          console.log(`  ✅ Found on Last.fm`)
          enriched++
          continue
        }
      }

      console.log(`  ⚠️  No metadata found`)
      failed++
    } catch (error) {
      console.error(`  ❌ Error fetching ${artistName}:`, error)
      failed++
    }
  }

  // Save metadata
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

  console.log(`\n📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched}`)
  console.log(`   ⏭️  Skipped (cached): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`\n💾 Saved metadata to: ${metadataPath}`)
  console.log('\n🎉 Done!')
}

function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichArtists()
}

export { enrichArtists }
