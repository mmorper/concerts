import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface Concert {
  id: string
  date: string
  headliner: string
  venue: string
  city: string
  state: string
  openers: string[]
  genre: string
  [key: string]: any
}

interface ConcertData {
  concerts: Concert[]
  metadata: any
}

/**
 * Compare two versions of concert data and show differences
 */
async function diffConcerts() {
  console.log('🔍 Comparing concert data changes...\n')

  const concertsPath = join(process.cwd(), 'public', 'data', 'concerts.json')

  if (!existsSync(concertsPath)) {
    console.error('❌ concerts.json not found. Nothing to compare.')
    process.exit(1)
  }

  // For now, we'll compare against a backup or previous version
  // In a real scenario, you'd either:
  // 1. Compare against git history: git show HEAD:public/data/concerts.json
  // 2. Compare against a backup file: concerts.json.backup
  // 3. Store the previous state before running fetch

  const currentData: ConcertData = JSON.parse(readFileSync(concertsPath, 'utf-8'))

  // Try to load backup file (created by user before running fetch)
  const backupPath = `${concertsPath}.backup`

  if (!existsSync(backupPath)) {
    console.log('💡 No backup file found to compare against.')
    console.log(`   Create a backup before fetching: cp ${concertsPath} ${backupPath}`)
    console.log('\n📊 Current data summary:')
    console.log(`   Total concerts: ${currentData.concerts.length}`)
    console.log(`   Date range: ${currentData.metadata.dateRange.earliest} to ${currentData.metadata.dateRange.latest}`)
    console.log(`   Unique artists: ${currentData.metadata.uniqueArtists}`)
    console.log(`   Unique venues: ${currentData.metadata.uniqueVenues}`)
    return
  }

  const oldData: ConcertData = JSON.parse(readFileSync(backupPath, 'utf-8'))

  console.log('Comparing data files:')
  console.log(`  OLD: ${backupPath} (${oldData.concerts.length} concerts)`)
  console.log(`  NEW: ${concertsPath} (${currentData.concerts.length} concerts)`)
  console.log()

  // Create lookup maps for efficient comparison
  const oldMap = new Map<string, Concert>()
  oldData.concerts.forEach(concert => {
    const key = `${concert.date}|${concert.headliner.toLowerCase()}`
    oldMap.set(key, concert)
  })

  const newMap = new Map<string, Concert>()
  currentData.concerts.forEach(concert => {
    const key = `${concert.date}|${concert.headliner.toLowerCase()}`
    newMap.set(key, concert)
  })

  // Find added concerts
  const added: Concert[] = []
  newMap.forEach((concert, key) => {
    if (!oldMap.has(key)) {
      added.push(concert)
    }
  })

  // Find removed concerts
  const removed: Concert[] = []
  oldMap.forEach((concert, key) => {
    if (!newMap.has(key)) {
      removed.push(concert)
    }
  })

  // Find modified concerts
  const modified: Array<{old: Concert, new: Concert, changes: string[]}> = []
  newMap.forEach((newConcert, key) => {
    if (oldMap.has(key)) {
      const oldConcert = oldMap.get(key)!
      const changes: string[] = []

      // Compare fields
      if (oldConcert.venue !== newConcert.venue) {
        changes.push(`venue: "${oldConcert.venue}" → "${newConcert.venue}"`)
      }
      if (oldConcert.city !== newConcert.city || oldConcert.state !== newConcert.state) {
        changes.push(`location: "${oldConcert.city}, ${oldConcert.state}" → "${newConcert.city}, ${newConcert.state}"`)
      }
      if (oldConcert.genre !== newConcert.genre) {
        changes.push(`genre: "${oldConcert.genre}" → "${newConcert.genre}"`)
      }
      if (JSON.stringify(oldConcert.openers) !== JSON.stringify(newConcert.openers)) {
        const oldOpeners = oldConcert.openers.length
        const newOpeners = newConcert.openers.length
        changes.push(`openers: ${oldOpeners} → ${newOpeners}`)
      }

      if (changes.length > 0) {
        modified.push({ old: oldConcert, new: newConcert, changes })
      }
    }
  })

  // Print results
  console.log('=' .repeat(60))
  console.log('DIFF RESULTS')
  console.log('=' .repeat(60))
  console.log()

  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    console.log('✅ No changes detected.')
    console.log()
    return
  }

  // Print added concerts
  if (added.length > 0) {
    console.log(`📈 ADDED: ${added.length} concert(s)\n`)
    added
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(concert => {
        console.log(`   • ${concert.date}: ${concert.headliner} @ ${concert.venue}`)
        if (concert.openers.length > 0) {
          console.log(`     w/ ${concert.openers.slice(0, 3).join(', ')}${concert.openers.length > 3 ? '...' : ''}`)
        }
      })
    console.log()
  }

  // Print removed concerts
  if (removed.length > 0) {
    console.log(`📉 REMOVED: ${removed.length} concert(s)\n`)
    removed
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(concert => {
        console.log(`   • ${concert.date}: ${concert.headliner} @ ${concert.venue}`)
      })
    console.log()
  }

  // Print modified concerts
  if (modified.length > 0) {
    console.log(`📝 MODIFIED: ${modified.length} concert(s)\n`)
    modified.forEach(({ new: concert, changes }) => {
      console.log(`   • ${concert.date}: ${concert.headliner}`)
      changes.forEach(change => {
        console.log(`     - ${change}`)
      })
    })
    console.log()
  }

  // Summary
  console.log('=' .repeat(60))
  console.log('SUMMARY')
  console.log('=' .repeat(60))
  console.log(`Total changes: +${added.length} -${removed.length} ~${modified.length}`)
  console.log()
  console.log(`Old total: ${oldData.concerts.length} concerts`)
  console.log(`New total: ${currentData.concerts.length} concerts`)
  console.log(`Net change: ${currentData.concerts.length - oldData.concerts.length > 0 ? '+' : ''}${currentData.concerts.length - oldData.concerts.length}`)
  console.log()
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  diffConcerts()
}

export { diffConcerts }
