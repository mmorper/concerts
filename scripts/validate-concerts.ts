import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface ValidationError {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

interface Concert {
  id: string
  date: string
  headliner: string
  venue: string
  city: string
  state: string
  location: {
    lat: number
    lng: number
  }
  openers: string[]
}

interface ConcertData {
  concerts: Concert[]
  metadata: {
    totalConcerts: number
    dateRange: {
      earliest: string
      latest: string
    }
  }
}

/**
 * Validate concert data for common issues
 */
async function validateConcerts() {
  console.log('🔍 Validating concert data...\n')

  // Load concerts data
  const concertsPath = join(process.cwd(), 'public', 'data', 'concerts.json')
  if (!existsSync(concertsPath)) {
    console.error('❌ concerts.json not found. Run "npm run build-data" first.')
    process.exit(1)
  }

  const data: ConcertData = JSON.parse(readFileSync(concertsPath, 'utf-8'))
  const concerts = data.concerts

  console.log(`📊 Validating ${concerts.length} concerts...\n`)

  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Track for duplicate detection
  const seenConcerts = new Map<string, number>()
  const currentYear = new Date().getFullYear()

  // Validate each concert
  concerts.forEach((concert, index) => {
    const rowNum = index + 1

    // Check 1: Required fields
    if (!concert.date) {
      errors.push({
        row: rowNum,
        field: 'date',
        message: 'Missing date',
        severity: 'error',
      })
    }

    if (!concert.headliner || concert.headliner.trim() === '') {
      errors.push({
        row: rowNum,
        field: 'headliner',
        message: 'Missing headliner',
        severity: 'error',
      })
    }

    if (!concert.venue || concert.venue.trim() === '') {
      warnings.push({
        row: rowNum,
        field: 'venue',
        message: `Missing venue for "${concert.headliner}"`,
        severity: 'warning',
      })
    }

    if (!concert.city || concert.city.trim() === '') {
      warnings.push({
        row: rowNum,
        field: 'city',
        message: `Missing city for "${concert.headliner}"`,
        severity: 'warning',
      })
    }

    // Check 2: Valid date format
    if (concert.date) {
      const date = new Date(concert.date)
      if (isNaN(date.getTime())) {
        errors.push({
          row: rowNum,
          field: 'date',
          message: `Invalid date format: "${concert.date}"`,
          severity: 'error',
        })
      } else {
        // Check for unreasonable dates (typos)
        const year = date.getFullYear()
        if (year < 1950 || year > currentYear + 2) {
          warnings.push({
            row: rowNum,
            field: 'date',
            message: `Unusual date: ${concert.date} (year ${year}) - verify not a typo`,
            severity: 'warning',
          })
        }
      }
    }

    // Check 3: Duplicate concerts (same date + headliner)
    if (concert.date && concert.headliner) {
      const key = `${concert.date}|${concert.headliner.toLowerCase()}`
      if (seenConcerts.has(key)) {
        const firstOccurrence = seenConcerts.get(key)!
        errors.push({
          row: rowNum,
          field: 'duplicate',
          message: `Duplicate concert: "${concert.headliner}" on ${concert.date} (first seen at row ${firstOccurrence})`,
          severity: 'error',
        })
      } else {
        seenConcerts.set(key, rowNum)
      }
    }

    // Check 4: Geocoding failures (coordinates at 0,0)
    if (concert.location.lat === 0 && concert.location.lng === 0) {
      warnings.push({
        row: rowNum,
        field: 'location',
        message: `Default coordinates (0,0) for "${concert.venue}" in ${concert.city}, ${concert.state}`,
        severity: 'warning',
      })
    }

    // Check 5: Excessive openers (likely data entry error)
    if (concert.openers && concert.openers.length > 10) {
      warnings.push({
        row: rowNum,
        field: 'openers',
        message: `${concert.openers.length} openers for "${concert.headliner}" - verify not a data entry error`,
        severity: 'warning',
      })
    }

    // Check 6: Orphaned openers (opener without headliner)
    if (concert.openers && concert.openers.length > 0 && !concert.headliner) {
      errors.push({
        row: rowNum,
        field: 'openers',
        message: `Openers exist but no headliner specified`,
        severity: 'error',
      })
    }
  })

  // Print results
  console.log('=' .repeat(60))
  console.log('VALIDATION RESULTS')
  console.log('=' .repeat(60))
  console.log()

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All validations passed!')
    console.log(`   ${concerts.length} concerts validated successfully`)
    console.log()
    return
  }

  // Print errors
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} ERROR(S) FOUND:\n`)
    errors.forEach((error) => {
      console.log(`   Row ${error.row} [${error.field}]: ${error.message}`)
    })
    console.log()
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} WARNING(S) FOUND:\n`)
    warnings.forEach((warning) => {
      console.log(`   Row ${warning.row} [${warning.field}]: ${warning.message}`)
    })
    console.log()
  }

  // Summary
  console.log('=' .repeat(60))
  console.log('SUMMARY')
  console.log('=' .repeat(60))
  console.log(`Total concerts: ${concerts.length}`)
  console.log(`Errors: ${errors.length}`)
  console.log(`Warnings: ${warnings.length}`)
  console.log()

  if (errors.length > 0) {
    console.log('❌ Validation failed. Please fix errors before deploying.')
    process.exit(1)
  } else {
    console.log('✅ Validation passed with warnings.')
    console.log('   Review warnings above and update data if needed.')
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateConcerts()
}

export { validateConcerts }
