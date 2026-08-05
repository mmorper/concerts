/**
 * Test script for setlist.fm API integration
 * Run with: npx tsx scripts/test-setlistfm.ts
 */

import { fetchSetlist, getCacheStats, clearSetlistCache } from '../src/services/setlistfm'
import type { SetlistSearchParams } from '../src/types/setlist'

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

/**
 * Test cases based on actual concerts in the dataset
 */
const testCases: Array<{ name: string; params: SetlistSearchParams; expectation: string }> = [
  {
    name: 'Depeche Mode - Los Angeles 2023',
    params: {
      artistName: 'Depeche Mode',
      date: '2023-03-28',
      venueName: 'Kia Forum',
      city: 'Inglewood'
    },
    expectation: 'High probability of match (major artist, recent show)'
  },
  {
    name: 'Crowded House - Pop Rock',
    params: {
      artistName: 'Crowded House',
      date: '2023-05-09',
      venueName: 'Unknown Venue', // Will need to check actual venue from dataset
      city: 'Unknown'
    },
    expectation: 'Moderate probability (popular band)'
  },
  {
    name: 'Adam Ant - 1984 (Historical)',
    params: {
      artistName: 'Adam Ant',
      date: '1984-04-27',
      venueName: 'Irvine Meadows',
      city: 'Irvine'
    },
    expectation: 'Low probability (very old concert)'
  }
]

/**
 * Run a single test case
 */
async function runTest(testCase: typeof testCases[0]): Promise<void> {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.blue}Test:${colors.reset} ${testCase.name}`)
  console.log(`${colors.gray}Expected: ${testCase.expectation}${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)

  console.log(`\n${colors.gray}Parameters:${colors.reset}`)
  console.log(`  Artist: ${testCase.params.artistName}`)
  console.log(`  Date: ${testCase.params.date}`)
  console.log(`  Venue: ${testCase.params.venueName}`)
  console.log(`  City: ${testCase.params.city}`)

  try {
    console.log(`\n${colors.yellow}⏳ Fetching setlist...${colors.reset}`)
    const startTime = Date.now()

    const setlist = await fetchSetlist(testCase.params)
    const duration = Date.now() - startTime

    if (setlist) {
      console.log(`\n${colors.green}✓ Setlist found!${colors.reset} (${duration}ms)`)
      console.log(`\n${colors.gray}Details:${colors.reset}`)
      console.log(`  Artist: ${setlist.artist.name}`)
      console.log(`  Venue: ${setlist.venue.name}`)
      console.log(`  City: ${setlist.venue.city.name}, ${setlist.venue.city.state || setlist.venue.city.country.code}`)
      console.log(`  Date: ${setlist.eventDate}`)

      if (setlist.tour) {
        console.log(`  Tour: ${setlist.tour.name}`)
      }

      if (setlist.info) {
        console.log(`  Notes: ${setlist.info}`)
      }

      // Count total songs
      let totalSongs = 0
      if (setlist.sets && setlist.sets.set) {
        for (const set of setlist.sets.set) {
          totalSongs += set.song.length
        }
      }

      console.log(`\n${colors.gray}Setlist:${colors.reset}`)
      console.log(`  ${totalSongs} songs across ${setlist.sets.set.length} set(s)`)

      // Show first few songs from each set
      if (setlist.sets && setlist.sets.set) {
        for (const [idx, set] of setlist.sets.set.entries()) {
          const setName = set.encore ? `ENCORE ${set.encore}` : set.name || `SET ${idx + 1}`
          console.log(`\n  ${colors.cyan}${setName}:${colors.reset}`)

          const songsToShow = Math.min(5, set.song.length)
          for (let i = 0; i < songsToShow; i++) {
            const song = set.song[i]
            const coverInfo = song.cover ? ` ${colors.gray}(${song.cover.name} cover)${colors.reset}` : ''
            console.log(`    ${i + 1}. ${song.name}${coverInfo}`)
          }

          if (set.song.length > songsToShow) {
            console.log(`    ${colors.gray}... and ${set.song.length - songsToShow} more${colors.reset}`)
          }
        }
      }

      console.log(`\n  ${colors.blue}View on setlist.fm:${colors.reset} ${setlist.url}`)

    } else {
      console.log(`\n${colors.yellow}⚠ No setlist found${colors.reset} (${duration}ms)`)
      console.log(`${colors.gray}This is normal - not all concerts have setlists on setlist.fm${colors.reset}`)
    }

  } catch (error) {
    console.log(`\n${colors.red}✗ Error${colors.reset}`)

    if (typeof error === 'object' && error !== null && 'type' in error) {
      const structuredError = error as any
      console.log(`  Type: ${structuredError.type}`)
      console.log(`  Message: ${structuredError.message}`)

      if ('status' in structuredError) {
        console.log(`  Status: ${structuredError.status}`)
      }
    } else {
      console.log(`  ${error}`)
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log(`${colors.cyan}╔═══════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.cyan}║     setlist.fm API Integration Test Suite       ║${colors.reset}`)
  console.log(`${colors.cyan}╚═══════════════════════════════════════════════════╝${colors.reset}`)

  // Check API key
  const apiKey = process.env.VITE_SETLISTFM_API_KEY
  if (!apiKey || apiKey === 'your_setlistfm_api_key_here') {
    console.log(`\n${colors.red}✗ ERROR: setlist.fm API key not configured${colors.reset}`)
    console.log(`\nPlease set VITE_SETLISTFM_API_KEY in your .env file`)
    console.log(`Get your API key at: ${colors.blue}https://www.setlist.fm/settings/api${colors.reset}`)
    process.exit(1)
  }

  console.log(`\n${colors.green}✓ API key configured${colors.reset}`)
  console.log(`${colors.gray}Key: ${apiKey.substring(0, 8)}...${colors.reset}`)

  // Clear cache before testing
  clearSetlistCache()
  console.log(`\n${colors.gray}Cache cleared for fresh test${colors.reset}`)

  // Run all test cases
  for (const testCase of testCases) {
    await runTest(testCase)

    // Small delay between requests to be respectful to API
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // Show cache statistics
  const cacheStats = getCacheStats()
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`${colors.blue}Cache Statistics${colors.reset}`)
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
  console.log(`\nTotal entries: ${cacheStats.memoryCache.size}`)
  console.log(`\nCached items:`)
  for (const entry of cacheStats.memoryCache.entries) {
    const status = entry.hasData ? colors.green + '✓ Found' : colors.yellow + '○ Not Found'
    console.log(`  ${status}${colors.reset} - ${entry.key}`)
  }

  console.log(`\n${colors.green}✓ All tests completed${colors.reset}`)
  console.log(`${colors.gray}Note: Cache will persist for 24 hours or until app restart${colors.reset}`)
}

// Run tests
main().catch(error => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error)
  process.exit(1)
})
