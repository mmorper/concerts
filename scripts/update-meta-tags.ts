#!/usr/bin/env tsx
/**
 * Update Meta Tags Script
 *
 * Reads current stats from concerts.json and updates:
 * - index.html meta descriptions (standard, OG, Twitter)
 * - public/og-stats.json
 *
 * Run: npm run update:meta
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Concert {
  headliner: string
  openers?: string[]
  venue: string
  year: number
}

interface ConcertsData {
  concerts: Concert[]
}

async function main() {
  console.log('📝 Updating meta tags with current stats\n')

  // Read concerts data
  const dataPath = path.join(__dirname, '..', 'public', 'data', 'concerts.json')
  const concertsData: ConcertsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  // Calculate stats
  const concerts = concertsData.concerts.length
  const scenes = 5

  // Count unique artists (headliners + openers)
  const artistSet = new Set<string>()
  concertsData.concerts.forEach((concert) => {
    if (concert.headliner) artistSet.add(concert.headliner)
    concert.openers?.forEach((opener: string) => artistSet.add(opener))
  })
  const artists = artistSet.size

  // Count unique venues
  const venueSet = new Set(concertsData.concerts.map((c) => c.venue))
  const venues = venueSet.size

  // Calculate year range
  const years = concertsData.concerts.map((c) => c.year)
  const startYear = Math.min(...years)
  const endYear = Math.max(...years)
  const currentYear = new Date().getFullYear()
  const decades = Math.ceil((currentYear - startYear) / 10)

  console.log(`Current stats:`)
  console.log(`  ${concerts} concerts`)
  console.log(`  ${artists} artists`)
  console.log(`  ${venues} venues`)
  console.log(`  ${startYear}-${endYear} (${decades}+ decades)`)
  console.log(`  ${scenes} interactive scenes\n`)

  // Generate description
  const description = `A visual love letter to ${decades}+ decades of live music. ${concerts} concerts from ${startYear}-${endYear}, featuring ${artists} artists across ${venues} venues. Explored through interactive timelines, maps, and network graphs.`

  console.log(`New description:\n"${description}"\n`)

  // Update index.html
  const indexPath = path.join(__dirname, '..', 'index.html')
  let indexContent = fs.readFileSync(indexPath, 'utf-8')

  // Update standard meta description
  indexContent = indexContent.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${description}" />`
  )

  // Update OG description
  indexContent = indexContent.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${description}" />`
  )

  // Update Twitter description
  indexContent = indexContent.replace(
    /<meta property="twitter:description" content="[^"]*" \/>/,
    `<meta property="twitter:description" content="${description}" />`
  )

  fs.writeFileSync(indexPath, indexContent, 'utf-8')
  console.log('✓ Updated index.html meta tags')

  // Update og-stats.json
  const ogStatsPath = path.join(__dirname, '..', 'public', 'og-stats.json')
  const ogStats = {
    concerts,
    scenes,
    artists,
    venues
  }

  fs.writeFileSync(ogStatsPath, JSON.stringify(ogStats, null, 2) + '\n', 'utf-8')
  console.log('✓ Updated public/og-stats.json')

  console.log('\n✅ Meta tags updated successfully!')
  console.log('\nNext steps:')
  console.log('  1. Review changes: git diff index.html public/og-stats.json')
  console.log('  2. Regenerate OG image: npm run og:generate')
  console.log('  3. Commit changes as part of your release')
}

main().catch(console.error)
