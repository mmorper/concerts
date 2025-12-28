import { fetchGoogleSheet } from './fetch-google-sheet'
import { enrichArtists } from './enrich-artists'

/**
 * Main data pipeline orchestrator
 * Runs all data fetching and enrichment steps in sequence
 */
async function buildData() {
  console.log('🎸 Starting Concert Data Pipeline...\n')
  console.log('=' .repeat(50))
  console.log()

  try {
    // Step 1: Fetch from Google Sheets
    console.log('Step 1/2: Fetching data from Google Sheets')
    console.log('-'.repeat(50))
    await fetchGoogleSheet()
    console.log()

    // Step 2: Enrich with artist metadata
    console.log('=' .repeat(50))
    console.log('Step 2/2: Enriching artist metadata')
    console.log('-'.repeat(50))
    await enrichArtists()
    console.log()

    console.log('=' .repeat(50))
    console.log('✨ Data pipeline complete!')
    console.log()
    console.log('📁 Output files:')
    console.log('   - public/data/concerts.json')
    console.log('   - public/data/artists-metadata.json')
    console.log()
    console.log('🚀 Ready to build: npm run build')
    console.log('👀 Or preview: npm run dev')
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
