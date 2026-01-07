import { fetchGoogleSheet } from './fetch-google-sheet'
import { enrichConcertGenres } from './enrich-concert-genres'
import { enrichArtists } from './enrich-artists'
import { validateConcerts } from './validate-concerts'
import { exec as execCallback } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execCallback)

/**
 * Main data pipeline orchestrator
 * Runs all data fetching and enrichment steps in sequence
 *
 * Usage:
 *   npm run build-data                    # Full refresh (all sources)
 *   npm run build-data -- --dry-run       # Preview without writing files
 *   npm run build-data -- --skip-venues   # Skip venue enrichment
 *   npm run build-data -- --skip-spotify  # Skip Spotify enrichment
 *   npm run build-data -- --skip-setlists # Skip setlist pre-fetch
 *   npm run build-data -- --force-refresh-setlists # Re-fetch all setlists
 *
 * Available Flags:
 *   --dry-run                 Preview changes without writing files
 *   --skip-validation         Skip data validation step
 *   --skip-venues             Skip venue metadata enrichment (Google Places)
 *   --skip-spotify            Skip Spotify metadata enrichment
 *   --skip-setlists           Skip setlist pre-fetch (setlist.fm)
 *   --force-refresh-setlists  Re-fetch all setlists (ignore cache)
 */
async function buildData() {
  // Parse command-line flags
  const skipValidation = process.env.SKIP_VALIDATION === 'true' || process.argv.includes('--skip-validation')
  const dryRun = process.argv.includes('--dry-run')
  const skipVenues = process.argv.includes('--skip-venues')
  const skipSpotify = process.argv.includes('--skip-spotify')
  const skipSetlists = process.argv.includes('--skip-setlists')
  const forceRefreshSetlists = process.argv.includes('--force-refresh-setlists')

  // Count active steps for progress tracking
  const steps = [
    { name: 'Fetch Google Sheets', active: true },
    { name: 'Enrich concert genres', active: true },
    { name: 'Validate concerts', active: !skipValidation },
    { name: 'Enrich artist metadata', active: true },
    { name: 'Enrich venue metadata', active: !skipVenues },
    { name: 'Enrich Spotify data', active: !skipSpotify },
    { name: 'Pre-fetch setlists', active: !skipSetlists },
    { name: 'Aggregate genres timeline', active: true },
  ]
  const activeSteps = steps.filter(s => s.active).length

  console.log(`🎸 Starting Concert Data Pipeline...${dryRun ? ' (DRY RUN)' : ''}\n`)
  console.log('=' .repeat(60))
  console.log()

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Fetching data but NOT writing files')
    console.log('=' .repeat(60))
    console.log()
  }

  // Show what will run
  console.log('📋 Pipeline Steps:')
  steps.forEach((step, i) => {
    const icon = step.active ? '✓' : '⏭️'
    const status = step.active ? '' : ' (skipped)'
    console.log(`   ${icon} ${step.name}${status}`)
  })
  console.log()

  let currentStep = 0

  try {
    // Step 1: Fetch from Google Sheets (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Fetching data from Google Sheets`)
    console.log('-'.repeat(60))
    await fetchGoogleSheet({ dryRun })
    console.log()

    // Step 2: Enrich concert genres from artist metadata (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Enriching concert genres`)
    console.log('-'.repeat(60))
    await enrichConcertGenres({ dryRun })
    console.log()

    // Step 3: Validate data (optional)
    if (!skipValidation) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Validating concert data`)
      console.log('-'.repeat(60))
      try {
        await validateConcerts()
      } catch (error) {
        console.warn('\n⚠️  Validation found issues. Continuing with enrichment...')
        console.warn('   Run "npm run validate-data" for details')
      }
      console.log()
    } else {
      console.log('⏭️  Skipping validation (--skip-validation flag set)\n')
    }

    // Step 4: Enrich with artist metadata (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Enriching artist metadata`)
    console.log('-'.repeat(60))
    await enrichArtists({ dryRun })
    console.log()

    // Step 5: Enrich venue metadata (optional)
    if (!skipVenues) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Enriching venue metadata`)
      console.log('-'.repeat(60))

      // Run as subprocess since enrich-venues.ts is a standalone script
      await exec('npm run enrich-venues')
      console.log()
    } else {
      console.log('⏭️  Skipping venue enrichment (--skip-venues flag set)\n')
    }

    // Step 6: Enrich Spotify data (optional)
    if (!skipSpotify) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Enriching Spotify metadata`)
      console.log('-'.repeat(60))

      // Check for Spotify credentials before running
      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.warn('⚠️  Warning: Spotify credentials not configured in .env')
        console.warn('   Skipping Spotify enrichment')
        console.warn('   See docs/api-setup.md for setup instructions\n')
      } else {
        const { enrichSpotifyMetadata } = await import('./enrich-spotify-metadata.ts')
        await enrichSpotifyMetadata()
        console.log()
      }
    } else {
      console.log('⏭️  Skipping Spotify enrichment (--skip-spotify flag set)\n')
    }

    // Step 7: Pre-fetch setlists (optional)
    if (!skipSetlists) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Pre-fetching setlists`)
      console.log('-'.repeat(60))

      // Check for setlist.fm API key before running
      if (!process.env.VITE_SETLISTFM_API_KEY) {
        console.warn('⚠️  Warning: setlist.fm API key not configured in .env')
        console.warn('   Skipping setlist pre-fetch')
        console.warn('   See docs/api-setup.md for setup instructions\n')
      } else {
        const { default: prefetchSetlists } = await import('./prefetch-setlists.ts')
        await prefetchSetlists({ forceRefresh: forceRefreshSetlists })
        console.log()
      }
    } else {
      console.log('⏭️  Skipping setlist pre-fetch (--skip-setlists flag set)\n')
    }

    // Step 8: Aggregate genres timeline (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Aggregating genres timeline`)
    console.log('-'.repeat(60))
    const { aggregateGenresTimeline } = await import('./aggregate-genres-timeline.ts')
    await aggregateGenresTimeline()
    console.log()

    // Summary
    console.log('=' .repeat(60))
    console.log(`✨ Data pipeline complete!${dryRun ? ' (DRY RUN)' : ''}`)
    console.log('=' .repeat(60))
    console.log()

    if (dryRun) {
      console.log('💡 This was a dry run - no files were modified')
      console.log()
      console.log('To apply changes:')
      console.log('   • Run without --dry-run: npm run build-data')
    } else {
      console.log('📁 Output files:')
      console.log('   - public/data/concerts.json')
      console.log('   - public/data/artists-metadata.json')
      if (!skipVenues) console.log('   - public/data/venues-metadata.json')
      if (!skipSetlists) console.log('   - public/data/setlists-cache.json')
      console.log()
      console.log('📦 Automatic backups created with .backup.TIMESTAMP extension')
      console.log()
      console.log('Next steps:')
      console.log('   • Review changes: npm run diff-data')
      console.log('   • Build site: npm run build')
      console.log('   • Preview: npm run dev')
    }
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error)
    console.error('\nTo troubleshoot:')
    console.error('   • Check error message above for specific issue')
    console.error('   • Verify .env file has required API credentials')
    console.error('   • Try running individual scripts to isolate the problem')
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildData()
}

export { buildData }
