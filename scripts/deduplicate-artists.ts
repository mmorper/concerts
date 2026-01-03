import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { normalizeArtistName } from '../src/utils/normalize.js'
import { createBackup } from './utils/backup.js'

/**
 * Deduplicate artists-metadata.json
 *
 * This script fixes artists that have multiple entries due to inconsistent normalization.
 * It merges duplicate entries, prioritizing real data over mock data.
 *
 * Example issue:
 * - "violentfemmes" (mock data, no image)
 * - "violent-femmes" (TheAudioDB data, has image)
 *
 * After deduplication, only "violent-femmes" remains with the enriched data.
 */

interface ArtistMetadata {
  name: string
  normalizedName?: string
  image?: string
  bio?: string
  genres?: string[]
  formed?: string
  website?: string
  source?: 'theaudiodb' | 'lastfm' | 'manual' | 'mock' | 'spotify'
  dataSource?: 'spotify' | 'mock'
  fetchedAt: string
  spotifyArtistId?: string
  spotifyArtistUrl?: string
  mostPopularAlbum?: any
  topTracks?: any[]
  popularity?: number
}

interface DeduplicationResult {
  totalBefore: number
  totalAfter: number
  duplicatesFound: number
  duplicateGroups: Array<{
    artistName: string
    duplicateKeys: string[]
    keptKey: string
    discardedKeys: string[]
  }>
}

/**
 * Determine which metadata entry has better data quality
 */
function selectBetterMetadata(a: ArtistMetadata, b: ArtistMetadata): ArtistMetadata {
  // Priority order: theaudiodb > spotify > lastfm > manual > mock
  const sourcePriority: Record<string, number> = {
    theaudiodb: 5,
    spotify: 4,
    lastfm: 3,
    manual: 2,
    mock: 1,
  }

  const sourceA = a.source || a.dataSource || 'mock'
  const sourceB = b.source || b.dataSource || 'mock'

  const priorityA = sourcePriority[sourceA] || 0
  const priorityB = sourcePriority[sourceB] || 0

  if (priorityA !== priorityB) {
    return priorityA > priorityB ? a : b
  }

  // If same source, prefer the one with more data
  const hasImageA = !!a.image
  const hasImageB = !!b.image
  if (hasImageA !== hasImageB) {
    return hasImageA ? a : b
  }

  // If tie, use most recently fetched
  return new Date(a.fetchedAt) > new Date(b.fetchedAt) ? a : b
}

/**
 * Deduplicate artist metadata
 */
function deduplicateArtists(dryRun = false): DeduplicationResult {
  const metadataPath = join(process.cwd(), 'public', 'data', 'artists-metadata.json')

  if (!existsSync(metadataPath)) {
    console.error('❌ artists-metadata.json not found')
    process.exit(1)
  }

  // Load existing metadata
  const rawData = JSON.parse(readFileSync(metadataPath, 'utf-8'))
  const metadata: Record<string, ArtistMetadata> = rawData.artists || rawData

  const totalBefore = Object.keys(metadata).length
  console.log(`📊 Loaded ${totalBefore} artist entries\n`)

  // Group artists by their canonical normalized name
  const artistGroups = new Map<string, Array<{ key: string; data: ArtistMetadata }>>()

  for (const [key, data] of Object.entries(metadata)) {
    // Re-normalize using the CURRENT normalization function
    const canonicalName = normalizeArtistName(data.name)

    if (!artistGroups.has(canonicalName)) {
      artistGroups.set(canonicalName, [])
    }

    artistGroups.get(canonicalName)!.push({ key, data })
  }

  // Find duplicates
  const duplicateGroups: DeduplicationResult['duplicateGroups'] = []
  const deduplicatedMetadata: Record<string, ArtistMetadata> = {}

  for (const [canonicalName, entries] of artistGroups) {
    if (entries.length === 1) {
      // No duplicates - just update the key if needed
      const entry = entries[0]
      deduplicatedMetadata[canonicalName] = {
        ...entry.data,
        normalizedName: canonicalName,
      }
    } else {
      // Found duplicates!
      console.log(`🔍 Found ${entries.length} entries for "${entries[0].data.name}":`)
      entries.forEach((e) => {
        const source = e.data.source || e.data.dataSource || 'unknown'
        const hasImage = e.data.image ? '✅ image' : '❌ no image'
        console.log(`   - "${e.key}" (${source}, ${hasImage})`)
      })

      // Select the best entry
      let best = entries[0].data
      for (let i = 1; i < entries.length; i++) {
        best = selectBetterMetadata(best, entries[i].data)
      }

      const keptKey = canonicalName
      const discardedKeys = entries.map((e) => e.key).filter((k) => k !== keptKey)

      console.log(`   ✅ Keeping: "${keptKey}" (${best.source || best.dataSource})`)
      console.log(`   ❌ Removing: ${discardedKeys.join(', ')}\n`)

      duplicateGroups.push({
        artistName: entries[0].data.name,
        duplicateKeys: entries.map((e) => e.key),
        keptKey,
        discardedKeys,
      })

      deduplicatedMetadata[canonicalName] = {
        ...best,
        normalizedName: canonicalName,
      }
    }
  }

  const totalAfter = Object.keys(deduplicatedMetadata).length

  // Save deduplicated metadata
  if (dryRun) {
    console.log('\n' + '='.repeat(60))
    console.log('🔍 DRY RUN MODE - No files will be modified')
    console.log('='.repeat(60))
    console.log(`\nWould write to: ${metadataPath}`)
    console.log(`File size: ${JSON.stringify(deduplicatedMetadata, null, 2).length} bytes`)
  } else {
    // Create backup before overwriting
    createBackup(metadataPath, { maxBackups: 10, verbose: true })

    // Write deduplicated metadata
    writeFileSync(metadataPath, JSON.stringify(deduplicatedMetadata, null, 2))
    console.log(`\n💾 Saved deduplicated metadata to: ${metadataPath}`)
  }

  return {
    totalBefore,
    totalAfter,
    duplicatesFound: duplicateGroups.length,
    duplicateGroups,
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`🧹 Deduplicating artist metadata...${dryRun ? ' (DRY RUN)' : ''}\n`)

  const result = deduplicateArtists(dryRun)

  console.log('\n' + '='.repeat(60))
  console.log('📊 DEDUPLICATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`\nTotal entries before: ${result.totalBefore}`)
  console.log(`Total entries after:  ${result.totalAfter}`)
  console.log(`Duplicates removed:   ${result.totalBefore - result.totalAfter}`)
  console.log(`Artists with duplicates: ${result.duplicatesFound}`)

  if (result.duplicatesFound > 0) {
    console.log(`\n✨ Successfully deduplicated ${result.duplicatesFound} artist(s)`)
  } else {
    console.log(`\n✅ No duplicates found - data is clean!`)
  }

  if (dryRun) {
    console.log('\n💡 To apply these changes, run without --dry-run flag')
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✨ Deduplication complete!${dryRun ? ' (DRY RUN)' : ''}`)
  console.log('='.repeat(60))
}

main()
