import { fetchGoogleSheet } from './fetch-google-sheet'
import { enrichArtists } from './enrich-artists'
import { validateConcerts } from './validate-concerts'

/**
 * Main data pipeline orchestrator
 * Runs all data fetching and enrichment steps in sequence
 */
async function buildData() {
  // Check for flags
  const skipValidation = process.env.SKIP_VALIDATION === 'true' || process.argv.includes('--skip-validation')
  const dryRun = process.argv.includes('--dry-run')

  console.log(`🎸 Starting Concert Data Pipeline...${dryRun ? ' (DRY RUN)' : ''}\n`)
  console.log('=' .repeat(50))
  console.log()

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Fetching data but NOT writing files')
    console.log('=' .repeat(50))
    console.log()
  }

  try {
    // Step 1: Fetch from Google Sheets
    console.log('Step 1/3: Fetching data from Google Sheets')
    console.log('-'.repeat(50))
    await fetchGoogleSheet({ dryRun })
    console.log()

    // Step 2: Validate data (optional)
    if (!skipValidation) {
      console.log('=' .repeat(50))
      console.log('Step 2/3: Validating concert data')
      console.log('-'.repeat(50))
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

    // Step 3: Enrich with artist metadata
    console.log('=' .repeat(50))
    console.log(`Step ${skipValidation ? '2/2' : '3/3'}: Enriching artist metadata`)
    console.log('-'.repeat(50))
    await enrichArtists({ dryRun })
    console.log()

    console.log('=' .repeat(50))
    console.log(`✨ Data pipeline complete!${dryRun ? ' (DRY RUN)' : ''}`)
    console.log('=' .repeat(50))
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
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildData()
}

export { buildData }
