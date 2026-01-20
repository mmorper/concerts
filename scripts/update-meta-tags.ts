#!/usr/bin/env tsx
/**
 * Update Meta Tags Script
 *
 * Reads current stats from concerts.json and updates:
 * - index.html meta descriptions (standard, OG, Twitter)
 * - index.html Schema.org JSON-LD structured data
 * - public/llm.txt with current stats
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
  date: string
}

interface ConcertsData {
  concerts: Concert[]
}

interface DiscographyData {
  [artistNormalized: string]: {
    albums: any[]
  }
}

async function main() {
  console.log('📝 Updating meta tags and SEO files with current stats\n')

  // Read concerts data
  const dataPath = path.join(__dirname, '..', 'public', 'data', 'concerts.json')
  const concertsData: ConcertsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  // Read discography data for album count
  const discographyPath = path.join(__dirname, '..', 'public', 'data', 'discography.json')
  let totalAlbums = 0
  try {
    const discographyData: DiscographyData = JSON.parse(fs.readFileSync(discographyPath, 'utf-8'))
    totalAlbums = Object.values(discographyData).reduce((sum, artist) => sum + (artist.albums?.length || 0), 0)
  } catch (err) {
    console.warn('⚠️  Could not read discography.json, album count will be 0')
  }

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

  // Calculate year range and dates
  const years = concertsData.concerts.map((c) => c.year)
  const startYear = Math.min(...years)
  const endYear = Math.max(...years)
  const currentYear = new Date().getFullYear()
  const decades = Math.ceil((currentYear - startYear) / 10)

  // Find earliest and latest concert dates
  const dates = concertsData.concerts.map((c) => c.date).sort()
  const earliestDate = dates[0]
  const latestDate = dates[dates.length - 1]
  const today = new Date().toISOString().split('T')[0]

  console.log(`Current stats:`)
  console.log(`  ${concerts} concerts`)
  console.log(`  ${artists} artists`)
  console.log(`  ${venues} venues`)
  console.log(`  ${totalAlbums.toLocaleString()} albums (discography)`)
  console.log(`  ${startYear}-${endYear} (${decades}+ decades)`)
  console.log(`  ${earliestDate} to ${latestDate}`)
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

  // Update article:modified_time
  indexContent = indexContent.replace(
    /<meta property="article:modified_time" content="[^"]*" \/>/,
    `<meta property="article:modified_time" content="${today}T00:00:00Z" />`
  )

  // Update Schema.org JSON-LD structured data
  // Update description
  indexContent = indexContent.replace(
    /("description": )"A visual love letter to [^"]*"/,
    `$1"${description}"`
  )

  // Update dateModified
  indexContent = indexContent.replace(
    /("dateModified": )"[^"]*"/,
    `$1"${today}"`
  )

  // Update numberOfEvents
  indexContent = indexContent.replace(
    /("numberOfEvents": )\d+/,
    `$1${concerts}`
  )

  // Update startDate (earliest concert)
  indexContent = indexContent.replace(
    /("startDate": )"[^"]*"/,
    `$1"${earliestDate}"`
  )

  // Update endDate (latest concert)
  indexContent = indexContent.replace(
    /("endDate": )"[^"]*"/,
    `$1"${latestDate}"`
  )

  // Update numberOfItems (artist count)
  indexContent = indexContent.replace(
    /("numberOfItems": )\d+/,
    `$1${artists}`
  )

  // Update Timeline scene description
  indexContent = indexContent.replace(
    /"description": "Interactive timeline visualization of \d+ concerts"/,
    `"description": "Interactive timeline visualization of ${concerts} concerts"`
  )

  // Update Artists scene description
  indexContent = indexContent.replace(
    /"description": "\d+ artists with photos, bios, and setlists"/,
    `"description": "${artists} artists with photos, bios, and setlists"`
  )

  // Update Venues scene description
  indexContent = indexContent.replace(
    /"description": "\d+ venues with location data and concert history"/,
    `"description": "${venues} venues with location data and concert history"`
  )

  fs.writeFileSync(indexPath, indexContent, 'utf-8')
  console.log('✓ Updated index.html meta tags and Schema.org JSON-LD')

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

  // Update public/llm.txt
  const llmPath = path.join(__dirname, '..', 'public', 'llm.txt')
  let llmContent = fs.readFileSync(llmPath, 'utf-8')

  // Update overview stats (first line)
  llmContent = llmContent.replace(
    /Personal concert archive spanning \d+-\d+\. Interactive web application with \d+ concerts, \d+ artists, \d+ venues\./,
    `Personal concert archive spanning ${startYear}-${endYear}. Interactive web application with ${concerts} concerts, ${artists} artists, ${venues} venues.`
  )

  // Update album count in authoritative data section
  llmContent = llmContent.replace(
    /- Artist discographies \(via MusicBrainz API - [^)]+\)/,
    `- Artist discographies (via MusicBrainz API - ${totalAlbums.toLocaleString()}+ albums)`
  )

  // Update concert records count
  llmContent = llmContent.replace(
    /\*\*Records:\*\* \d+ concerts/,
    `**Records:** ${concerts} concerts`
  )

  // Update artist records count
  llmContent = llmContent.replace(
    /\*\*Records:\*\* \d+ artists/,
    `**Records:** ${artists} artists`
  )

  // Update venue records count
  llmContent = llmContent.replace(
    /\*\*Records:\*\* \d+ venues/,
    `**Records:** ${venues} venues`
  )

  // Update discography records count
  llmContent = llmContent.replace(
    /\*\*Records:\*\* [0-9,]+ albums across \d+ artists/,
    `**Records:** ${totalAlbums.toLocaleString()}+ albums across ${artists} artists`
  )

  // Update MusicBrainz description
  llmContent = llmContent.replace(
    /- \*\*MusicBrainz API\*\* - Artist discographies \([^)]+\)/,
    `- **MusicBrainz API** - Artist discographies (${totalAlbums.toLocaleString()}+ albums)`
  )

  // Update last updated date
  llmContent = llmContent.replace(
    /\*\*Last Updated:\*\* [0-9-]+/,
    `**Last Updated:** ${today}`
  )

  // Update total content footer
  llmContent = llmContent.replace(
    /\*\*Total Content:\*\* \d+ concerts \| \d+ artists \| \d+ venues \| [^|]+ \| \d+-\d+/,
    `**Total Content:** ${concerts} concerts | ${artists} artists | ${venues} venues | ${totalAlbums.toLocaleString()}+ albums | ${startYear}-${endYear}`
  )

  fs.writeFileSync(llmPath, llmContent, 'utf-8')
  console.log('✓ Updated public/llm.txt')

  console.log('\n✅ All meta tags and SEO files updated successfully!')
  console.log('\nNext steps:')
  console.log('  1. Review changes: git diff index.html public/llm.txt public/og-stats.json')
  console.log('  2. Regenerate OG image: npm run og:generate')
  console.log('  3. Commit changes as part of your release')
}

main().catch(console.error)
