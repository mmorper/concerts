import { TheAudioDBClient } from './utils/theaudiodb-client'
import { LastFmClient } from './utils/lastfm-client'
import { DeezerClient } from './utils/deezer-client'
import { RateLimiter } from './utils/rate-limiter'
import { normalizeArtistName } from '../src/utils/normalize.js'
import { checkUrls } from './utils/url-health.js'
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

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

type ArtistRecord = ArtistMetadata[string]

/**
 * Mock records carry no image, so they are always re-fetched. `source` predates
 * the current union and older records spell it `dataSource`, hence both reads.
 */
function isMockRecord(record: ArtistRecord | undefined): boolean {
  if (!record) return false
  const { source, dataSource } = record as { source?: string; dataSource?: string }
  return source === 'mock' || dataSource === 'mock'
}

function isFresh(record: ArtistRecord, now: number): boolean {
  return now - new Date(record.fetchedAt).getTime() < CACHE_TTL_MS
}

/**
 * Of the given records, which ones' stored image is definitively gone?
 *
 * `fetchedAt` says when we asked the API, not whether what it gave us still
 * loads — and image death is a content event with no schedule (#256), so no TTL
 * predicts it. Without this, a record enriched on day 1 whose image is
 * unpublished on day 2 serves a broken image for the remaining 29 days while the
 * weekly run walks straight past it (#264).
 *
 * Only a definitive 4xx counts. A 5xx or timeout is "unknown" and is left alone,
 * so one bad run cannot strip every artist of its image at once.
 */
export async function findDeadImages(
  entries: Array<{ key: string; url: string }>
): Promise<Set<string>> {
  if (entries.length === 0) return new Set()
  const health = await checkUrls(entries.map(e => e.url))
  return new Set(entries.filter((_, i) => health[i] === 'dead').map(e => e.key))
}

/** The `{ key, url }` pairs `findDeadImages` takes, for records that have an image. */
function imageEntries(
  metadata: ArtistMetadata,
  keys: Iterable<string>
): Array<{ key: string; url: string }> {
  const entries: Array<{ key: string; url: string }> = []
  for (const key of keys) {
    const url = metadata[key]?.image
    if (url) entries.push({ key, url })
  }
  return entries
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

  // Which cached records are we about to trust? Check their images before we do.
  //
  // This is the artist half of #255's rule — a successful API response is not
  // evidence of a usable image — which v5.3.0 applied to venues and liner notes
  // but not here (#264). A dead image demotes the record from "fresh" to "must
  // re-fetch" below.
  const now = Date.now()
  const trusted = uniqueArtists
    .map(name => normalizeArtistName(name))
    .filter(key => {
      const record = metadata[key]
      return !!record && !isMockRecord(record) && isFresh(record, now)
    })
  console.log(`Checking ${trusted.length} cached artist image(s) still load...`)
  const staleImages = await findDeadImages(imageEntries(metadata, trusted))
  if (staleImages.size > 0) {
    console.log(`  ⚠️  ${staleImages.size} cached image(s) are gone — re-fetching those artists`)
  }
  console.log()

  let enriched = 0
  let skipped = 0
  let failed = 0
  const written = new Set<string>()

  for (const artistName of uniqueArtists) {
    const normalized = normalizeArtistName(artistName)

    // Skip if already enriched, recent (within 30 days) and still serving a live
    // image. BUT always re-fetch mock data since it has no images.
    const existingData = metadata[normalized]
    if (existingData && !isMockRecord(existingData)) {
      if (isFresh(existingData, now) && !staleImages.has(normalized)) {
        skipped++
        continue
      }
    }

    console.log(
      `Fetching metadata for: ${artistName}${staleImages.has(normalized) ? ' (stored image is gone)' : ''}`
    )

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
          written.add(normalized)
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
            written.add(normalized)
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
            written.add(normalized)
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

  // Validate what we just stored, not merely that an API answered (#264).
  //
  // TheAudioDB, Last.fm and Deezer all hand back image URLs that can already be
  // 404ing, so a fresh write is no more trustworthy than a cached one. Anything
  // still definitively dead loses its `image` — the Artist scene falls back to
  // `albumCover` or its own placeholder, which beats rendering a broken image.
  const rewritten = imageEntries(metadata, written)
  const nowDead = await findDeadImages(rewritten)

  // Records whose image was already known dead and that no source could repair.
  // They are dead by the pre-pass; re-checking would only risk an "unknown" blip
  // letting a URL we know is gone survive.
  for (const key of staleImages) {
    if (!written.has(key) && metadata[key]) nowDead.add(key)
  }

  for (const key of nowDead) delete metadata[key].image
  if (nowDead.size > 0) {
    console.log(`\n🖼️  Dropped ${nowDead.size} dead image URL(s); the client will fall back:`)
    for (const key of nowDead) console.log(`   − ${key}`)
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
  console.log(`   🖼️  Dropped (dead image): ${nowDead.size}`)

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
