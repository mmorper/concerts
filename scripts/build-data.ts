import { fetchGoogleSheet } from './fetch-google-sheet'
import { enrichArtists } from './enrich-artists'
import { validateConcerts } from './validate-concerts'

/**
 * Main data pipeline orchestrator
 * Runs all data fetching and enrichment steps in sequence
 */
async function buildData() {
  console.log('🎸 Starting Concert Data Pipeline...\n')
  console.log('=' .repeat(50))
  console.log()

  // Check if validation should be skipped
  const skipValidation = process.env.SKIP_VALIDATION === 'true' || process.argv.includes('--skip-validation')

  try {
    // Step 1: Fetch from Google Sheets
    console.log('Step 1/3: Fetching data from Google Sheets')
    console.log('-'.repeat(50))
    await fetchGoogleSheet()
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
    await enrichArtists()
    console.log()

    console.log('=' .repeat(50))
    console.log('✨ Data pipeline complete!')
    console.log('=' .repeat(50))
    console.log()
    console.log('📁 Output files:')
    console.log('   - public/data/concerts.json')
    console.log('   - public/data/artists-metadata.json')
    console.log()
    console.log('Next steps:')
    console.log('   • Review changes: npm run diff-data')
    console.log('   • Build site: npm run build')
    console.log('   • Preview: npm run dev')
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
