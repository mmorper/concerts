import { TheAudioDBClient } from './utils/theaudiodb-client'
import { LastFmClient } from './utils/lastfm-client'
import { DeezerClient } from './utils/deezer-client'
import { RateLimiter } from './utils/rate-limiter'
import { normalizeArtistName } from '../src/utils/normalize.js'
import { createBackup } from './utils/backup'
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
    source: 'theaudiodb' | 'lastfm' | 'deezer' | 'manual'
    fetchedAt: string
  }
}

/**
 * Generate artist name variants to try as fallbacks
 * Examples:
 *   "Brian Setzer and the Nashvillians" → ["Brian Setzer and the Nashvillians", "Brian Setzer"]
 *   "Trombone Shorty & Orleans Avenue" → ["Trombone Shorty & Orleans Avenue", "Trombone Shorty"]
 */
function getArtistNameVariants(artistName: string): string[] {
  const variants = [artistName] // Always try original name first

  // Remove " and the [Band Name]" suffix
  const andTheMatch = artistName.match(/^(.+?)\s+and\s+the\s+.+$/i)
  if (andTheMatch) {
    variants.push(andTheMatch[1])
  }

  // Remove " & [Band Name]" suffix
  const ampersandMatch = artistName.match(/^(.+?)\s+&\s+.+$/i)
  if (ampersandMatch) {
    variants.push(ampersandMatch[1])
  }

  // Remove " with [Guest]" suffix
  const withMatch = artistName.match(/^(.+?)\s+with\s+.+$/i)
  if (withMatch) {
    variants.push(withMatch[1])
  }

  // Remove "'68 Comeback Special" or similar suffixes
  // Handles ASCII apostrophe (') and Unicode quotes (' ')
  const specialMatch = artistName.match(/^(.+?)\s+[''\u2018\u2019][0-9]{2}\s+.+$/i)
  if (specialMatch) {
    variants.push(specialMatch[1])
  }

  return [...new Set(variants)] // Remove duplicates
}

/**
 * Enrich concert data with artist metadata from free APIs
 */
async function enrichArtists(options: { dryRun?: boolean } = {}) {
  const { dryRun = process.argv.includes('--dry-run') } = options

  console.log(`🎤 Enriching concert data with artist metadata...${dryRun ? ' (DRY RUN)' : ''}\n`)

  // Load concerts data
  const concertsPath = join(process.cwd(), 'public', 'data', 'concerts.json')
  if (!existsSync(concertsPath)) {
    console.error('❌ concerts.json not found. Run "npm run fetch-sheet" first.')
    process.exit(1)
  }

  const concertsData = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts = concertsData.concerts

  // Get unique artists (headliners + openers)
  const headliners = concerts.map((c: any) => c.headliner)
  const openers = concerts.flatMap((c: any) => c.openers || [])
  const uniqueArtists = [...new Set([...headliners, ...openers])]
  console.log(`Found ${uniqueArtists.length} unique artists to enrich (headliners + openers)\n`)

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
  const deezer = new DeezerClient()

  const rateLimiter = new RateLimiter(2) // TheAudioDB: 2 calls/sec

  let enriched = 0
  let skipped = 0
  let failed = 0

  for (const artistName of uniqueArtists) {
    const normalized = normalizeArtistName(artistName)

    // Skip if already enriched and recent (within 30 days)
    // BUT always re-fetch mock data since it has no images
    const existingData = metadata[normalized] as any
    const isMockData = existingData && (existingData.source === 'mock' || existingData.dataSource === 'mock')
    if (existingData && !isMockData) {
      const age = Date.now() - new Date(existingData.fetchedAt).getTime()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      if (age < thirtyDays) {
        skipped++
        continue
      }
    }

    console.log(`Fetching metadata for: ${artistName}`)

    try {
      let found = false
      const nameVariants = getArtistNameVariants(artistName)

      // Try each API across all name variants before falling back to the next API.
      // This ensures higher-quality sources (TheAudioDB has genres/bio) are fully
      // exhausted before settling for Deezer (which has images but no genres).

      // 1. TheAudioDB — best quality (genres, bio, formed year)
      for (let i = 0; i < nameVariants.length && !found; i++) {
        const variantName = nameVariants[i]
        const isOriginalName = i === 0
        if (!isOriginalName) console.log(`  → Trying simplified name: ${variantName}`)
        await rateLimiter.wait()
        const audioDbInfo = await audioDb.getArtistInfo(variantName)
        if (audioDbInfo && audioDbInfo.image) {
          metadata[normalized] = audioDbInfo
          console.log(`  ✅ Found on TheAudioDB${isOriginalName ? '' : ' (using simplified name)'}`)
          enriched++
          found = true
        }
      }

      // 2. Last.fm — fallback with genre data
      if (!found && lastFm) {
        for (let i = 0; i < nameVariants.length && !found; i++) {
          const variantName = nameVariants[i]
          const isOriginalName = i === 0
          if (!isOriginalName) console.log(`  → Trying simplified name: ${variantName}`)
          const lastFmInfo = await lastFm.getArtistInfo(variantName)
          if (lastFmInfo && lastFmInfo.image) {
            metadata[normalized] = lastFmInfo
            console.log(`  ✅ Found on Last.fm${isOriginalName ? '' : ' (using simplified name)'}`)
            enriched++
            found = true
          }
        }
      }

      // 3. Deezer — last resort (images only, no genres)
      if (!found) {
        for (let i = 0; i < nameVariants.length && !found; i++) {
          const variantName = nameVariants[i]
          const isOriginalName = i === 0
          if (!isOriginalName) console.log(`  → Trying simplified name: ${variantName}`)
          const deezerInfo = await deezer.getArtistInfo(variantName)
          if (deezerInfo && deezerInfo.image) {
            metadata[normalized] = deezerInfo
            console.log(`  ✅ Found on Deezer${isOriginalName ? '' : ' (using simplified name)'}`)
            enriched++
            found = true
          }
        }
      }

      if (!found) {
        console.log(`  ⚠️  No metadata found (tried ${nameVariants.length} name variant${nameVariants.length > 1 ? 's' : ''})`)
        failed++
      }
    } catch (error) {
      console.error(`  ❌ Error fetching ${artistName}:`, error)
      failed++
    }
  }

  // Drop records for artists no longer in the archive.
  //
  // Records were once keyed by the *enrichment API's* display name rather than
  // ours. TheAudioDB is user-contributed and carries typos, so we inherited
  // spellings like "Gorrillaz" and "The Red Hot Chilli Peppers" as primary keys.
  // That was fixed in 2f1a94b, but the fix only wrote correct keys — it never
  // deleted the unreachable old ones, and this function writes the whole object
  // back with no delete path. Five months on, 23 of 280 records were dead weight
  // still shipping to every client (#255).
  //
  // Pruning is also the drift guard: any future key mismatch shows up here as a
  // named removal on the next run instead of accumulating silently.
  const liveKeys = new Set(uniqueArtists.map(normalizeArtistName))
  const orphans = Object.keys(metadata).filter(key => !liveKeys.has(key))
  for (const key of orphans) {
    delete metadata[key]
  }
  if (orphans.length > 0) {
    console.log(`\n🧹 Pruned ${orphans.length} record(s) with no artist in concerts.json:`)
    for (const key of orphans) console.log(`   − ${key}`)
  }

  // Save metadata
  if (dryRun) {
    console.log('\n=' .repeat(30))
    console.log('🔍 DRY RUN MODE - No files will be modified')
    console.log('=' .repeat(30))
    console.log(`\nWould write to: ${metadataPath}`)
    console.log(`File size: ${JSON.stringify(metadata, null, 2).length} bytes`)
  } else {
    // Create backup before overwriting
    createBackup(metadataPath, { maxBackups: 10, verbose: true })

    // Write new metadata
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  }

  console.log(`\n📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched}`)
  console.log(`   ⏭️  Skipped (cached): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   🧹 Pruned (orphaned): ${orphans.length}`)

  if (dryRun) {
    console.log('\n💡 To apply these changes, run without --dry-run flag')
  } else {
    console.log(`\n💾 Saved metadata to: ${metadataPath}`)
  }

  console.log(`\n🎉 Done!${dryRun ? ' (DRY RUN)' : ''}`)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichArtists()
}

export { enrichArtists }
