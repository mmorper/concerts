/**
 * Validate Artist Genres
 *
 * Checks that artist metadata is consistent and valid:
 * - Every headliner in concerts has corresponding artist metadata
 * - No duplicate artist entries
 * - Genre values match predefined list
 * - All genre values have color definitions
 *
 * Usage:
 *   npm run validate:artist-genres
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { GENRE_COLORS } from '../src/constants/colors.js'

interface Concert {
  headliner: string
  genre: string
}

interface ArtistMetadata {
  name: string
  normalizedName: string
  genre: string
}

interface ArtistMetadataFile {
  artists: ArtistMetadata[]
}

async function validateArtistGenres() {
  console.log('🔍 Validating Artist Genres')
  console.log('='.repeat(60))
  console.log()

  let hasErrors = false

  // Paths
  const concertsPath = join(process.cwd(), 'public', 'data', 'concerts.json')
  const metadataPath = join(process.cwd(), 'data', 'artist-metadata.json')

  // Check 1: Files exist
  if (!existsSync(concertsPath)) {
    console.error('❌ concerts.json not found at', concertsPath)
    process.exit(1)
  }

  if (!existsSync(metadataPath)) {
    console.error('❌ artist-metadata.json not found at', metadataPath)
    console.error('   Run "npm run generate-artist-metadata" to create it')
    process.exit(1)
  }

  // Load data
  const concertsFile = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts: Concert[] = concertsFile.concerts

  const metadataFile: ArtistMetadataFile = JSON.parse(readFileSync(metadataPath, 'utf-8'))
  const artistsMetadata = metadataFile.artists

  console.log(`📊 Loaded ${concerts.length} concerts`)
  console.log(`📊 Loaded ${artistsMetadata.length} artist metadata records`)
  console.log()

  // Build maps for efficient lookup
  const metadataMap = new Map<string, ArtistMetadata>()
  artistsMetadata.forEach(artist => {
    metadataMap.set(artist.name, artist)
  })

  // Check 2: Every headliner has metadata entry
  console.log('✓ Checking: Every headliner has metadata entry...')
  const uniqueHeadliners = [...new Set(concerts.map(c => c.headliner))]
  const missingMetadata: string[] = []

  uniqueHeadliners.forEach(headliner => {
    if (!metadataMap.has(headliner)) {
      missingMetadata.push(headliner)
    }
  })

  if (missingMetadata.length > 0) {
    console.error(`  ❌ ${missingMetadata.length} artists missing metadata:`)
    missingMetadata.forEach(artist => {
      console.error(`     - ${artist}`)
    })
    hasErrors = true
  } else {
    console.log(`  ✅ All ${uniqueHeadliners.length} headliners have metadata`)
  }
  console.log()

  // Check 3: No duplicate artist entries
  console.log('✓ Checking: No duplicate artist names...')
  const artistNames = new Map<string, number>()
  artistsMetadata.forEach(artist => {
    artistNames.set(artist.name, (artistNames.get(artist.name) || 0) + 1)
  })

  const duplicates = Array.from(artistNames.entries())
    .filter(([_, count]) => count > 1)

  if (duplicates.length > 0) {
    console.error(`  ❌ ${duplicates.length} duplicate artist entries:`)
    duplicates.forEach(([name, count]) => {
      console.error(`     - ${name} (appears ${count} times)`)
    })
    hasErrors = true
  } else {
    console.log(`  ✅ No duplicates found`)
  }
  console.log()

  // Check 4: Genre values have color definitions
  console.log('✓ Checking: All genres have color definitions...')
  const uniqueGenres = [...new Set(artistsMetadata.map(a => a.genre))]
  const missingColors: string[] = []

  uniqueGenres.forEach(genre => {
    if (!GENRE_COLORS[genre]) {
      missingColors.push(genre)
    }
  })

  if (missingColors.length > 0) {
    console.error(`  ❌ ${missingColors.length} genres missing colors in GENRE_COLORS:`)
    missingColors.forEach(genre => {
      console.error(`     - "${genre}"`)
    })
    console.error()
    console.error(`  Add these to src/constants/colors.ts:`)
    missingColors.forEach(genre => {
      console.error(`    '${genre}': '#xxxxxx',  // Color description`)
    })
    hasErrors = true
  } else {
    console.log(`  ✅ All ${uniqueGenres.length} genres have colors defined`)
  }
  console.log()

  // Check 5: Concert genres match artist metadata
  console.log('✓ Checking: Concert genres match artist metadata...')
  const genreMismatches: Array<{
    headliner: string
    concertGenre: string
    metadataGenre: string
  }> = []

  concerts.forEach(concert => {
    const metadata = metadataMap.get(concert.headliner)
    if (metadata && concert.genre !== metadata.genre) {
      genreMismatches.push({
        headliner: concert.headliner,
        concertGenre: concert.genre,
        metadataGenre: metadata.genre
      })
    }
  })

  if (genreMismatches.length > 0) {
    console.error(`  ❌ ${genreMismatches.length} genre mismatches found:`)
    genreMismatches.slice(0, 5).forEach(({ headliner, concertGenre, metadataGenre }) => {
      console.error(`     - ${headliner}: concert="${concertGenre}" metadata="${metadataGenre}"`)
    })
    if (genreMismatches.length > 5) {
      console.error(`     ... and ${genreMismatches.length - 5} more`)
    }
    console.error()
    console.error(`  Run "npm run build-data" to sync concert genres with metadata`)
    hasErrors = true
  } else {
    console.log(`  ✅ All concert genres match artist metadata`)
  }
  console.log()

  // Summary
  console.log('='.repeat(60))
  if (hasErrors) {
    console.error('❌ Validation failed with errors')
    console.error()
    console.error('To fix:')
    console.error('  1. Review errors above')
    console.error('  2. Update data/artist-metadata.json or src/constants/colors.ts')
    console.error('  3. Run "npm run build-data" to regenerate concerts.json')
    console.error('  4. Run this validation again')
    process.exit(1)
  } else {
    console.log('✅ All validation checks passed!')
    console.log()
    console.log('📊 Summary:')
    console.log(`   ${uniqueHeadliners.length} artists`)
    console.log(`   ${uniqueGenres.length} unique genres`)
    console.log(`   ${concerts.length} concerts`)
  }

  console.log()
}

// Run if called directly
validateArtistGenres().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
