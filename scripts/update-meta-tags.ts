#!/usr/bin/env tsx
/**
 * Update Meta Tags Script
 *
 * Reads current stats from concerts.json and updates:
 * - index.html meta descriptions (standard, OG, Twitter)
 * - index.html Schema.org JSON-LD structured data
 * - public/llm.txt with current stats
 * - public/og-stats.json
 * - public/sitemap.xml (via generate-sitemap.ts)
 *
 * Run: npm run update:meta
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateSitemap } from './generate-sitemap.ts'
import { SCENE_NAMES } from '../src/components/changelog/constants'
import { deriveArchiveStats } from '../src/utils/archiveStats.js'

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

interface Fact {
  id: string
  category: string
  headline: string
  detail: string
  route: string
  cta: string
  priority: number
}

interface FactsData {
  computedAt: string
  facts: Fact[]
}

async function main() {
  console.log('📝 Updating meta tags and SEO files with current stats\n')

  // Read package.json for version
  const packagePath = path.join(__dirname, '..', 'package.json')
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
  const version = packageData.version

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

  // Read facts data for llm.txt statistics section
  const factsPath = path.join(__dirname, '..', 'public', 'data', 'facts.json')
  let factsData: FactsData | null = null
  try {
    factsData = JSON.parse(fs.readFileSync(factsPath, 'utf-8'))
  } catch (err) {
    console.warn('⚠️  Could not read facts.json, facts section will be skipped')
  }

  // Calculate stats
  const concerts = concertsData.concerts.length
  // Derived from the canonical roster, not hardcoded (#283). This sat at 5 for
  // the seven months after Ask shipped as scene 6, while every other stat on
  // this line was computed from the data.
  const scenes = SCENE_NAMES.length

  // One derivation for the counts and the span (#295).
  const archive = deriveArchiveStats(concertsData.concerts)
  const artists = archive.artists
  const venues = archive.venues
  const startYear = archive.firstYear ?? new Date().getFullYear()
  const endYear = archive.lastYear ?? startYear
  const currentYear = new Date().getFullYear()
  const decades = Math.ceil((currentYear - startYear) / 10)

  // Find earliest and latest concert dates
  const dates = concertsData.concerts.map((c) => c.date).sort()
  const earliestDate = dates[0]
  const latestDate = dates[dates.length - 1]
  const today = new Date().toISOString().split('T')[0]

  console.log(`Current stats:`)
  console.log(`  Version: v${version}`)
  console.log(`  ${concerts} concerts`)
  console.log(`  ${artists} artists`)
  console.log(`  ${venues} venues`)
  console.log(`  ${totalAlbums.toLocaleString()} albums (discography)`)
  console.log(`  ${startYear}-${endYear} (${decades}+ decades)`)
  console.log(`  ${earliestDate} to ${latestDate}`)
  console.log(`  ${scenes} interactive scenes\n`)

  // Generate description
  // `totalAlbums` is already derived above for llm.txt; the discography release
  // is the largest thing the archive holds and was the one headline number the
  // social card never carried (#286).
  //
  // Kept under ~160 characters, which is roughly where search engines truncate.
  // The old string ran to 183 and adding the album count would have pushed it to
  // 202, so the trailing "Explored through interactive timelines, maps, and
  // network graphs." was dropped — it was the least distinctive clause and the
  // one being cut off anyway. Adding to this sentence means taking something out.
  const description = `A visual love letter to ${decades}+ decades of live music. ${concerts} concerts from ${startYear}-${endYear}, featuring ${artists} artists across ${venues} venues and ${totalAlbums.toLocaleString()} albums.`

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

  // Read liner notes count if available
  const linerNotesPath = path.join(__dirname, '..', 'public', 'data', 'liner-notes.json')
  let linerNotesCount = 0
  if (fs.existsSync(linerNotesPath)) {
    try {
      const linerNotesData = JSON.parse(fs.readFileSync(linerNotesPath, 'utf-8'))
      linerNotesCount = linerNotesData.metadata?.totalPosts ?? linerNotesData.posts?.length ?? 0
    } catch {
      // Not yet generated — ok
    }
  }

  const ogStats = {
    concerts,
    scenes,
    artists,
    venues,
    // Added #286. The OG image generator reads this file, so a "discography"
    // release finally has its headline number on the social card.
    albumCount: totalAlbums,
    linerNotesCount,
  }

  fs.writeFileSync(ogStatsPath, JSON.stringify(ogStats, null, 2) + '\n', 'utf-8')
  console.log('✓ Updated public/og-stats.json')

  // Update public/llm.txt
  const llmPath = path.join(__dirname, '..', 'public', 'llm.txt')
  let llmContent = fs.readFileSync(llmPath, 'utf-8')

  /**
   * Replace a stat in llm.txt, and SAY SO when the pattern does not match.
   *
   * A plain .replace() that misses is a silent no-op: the file keeps its old
   * number, the script reports success, and nothing ever flags it. That is
   * exactly what happened to the discography line, which sat at "15,000+
   * albums across 247 artists" against a real 11,382 and 257 — the pattern
   * wrote a "+" its own search could not match, so it never fired again after
   * the first run. The footer on the same page said 11,382+, so llm.txt was
   * publicly contradicting itself to the agents it exists to inform.
   *
   * Every miss is now a warning. Being loud is the point.
   */
  const llmMisses: string[] = []
  const sub = (label: string, pattern: RegExp, replacement: string) => {
    if (!pattern.test(llmContent)) {
      llmMisses.push(label)
      return
    }
    llmContent = llmContent.replace(pattern, replacement)
  }

  sub(
    'overview stats',
    /Personal concert archive spanning \d+-\d+\. Interactive web application with \d+ concerts, \d+ artists, \d+ venues\./,
    `Personal concert archive spanning ${startYear}-${endYear}. Interactive web application with ${concerts} concerts, ${artists} artists, ${venues} venues.`
  )

  sub(
    'authoritative discographies',
    /- Artist discographies \(via MusicBrainz API - [^)]+\)/,
    `- Artist discographies (via MusicBrainz API - ${totalAlbums.toLocaleString()}+ albums)`
  )

  sub('records: concerts', /\*\*Records:\*\* \d+ concerts/, `**Records:** ${concerts} concerts`)
  sub('records: artists', /\*\*Records:\*\* \d+ artists/, `**Records:** ${artists} artists`)
  sub('records: venues', /\*\*Records:\*\* \d+ venues/, `**Records:** ${venues} venues`)

  // The "+" is optional in the pattern precisely because the replacement adds
  // one. Without it this matches only a file the script has never touched.
  sub(
    'records: albums',
    /\*\*Records:\*\* [0-9,]+\+? albums across \d+ artists/,
    `**Records:** ${totalAlbums.toLocaleString()}+ albums across ${artists} artists`
  )

  sub(
    'musicbrainz description',
    /- \*\*MusicBrainz API\*\* - Artist discographies \([^)]+\)/,
    `- **MusicBrainz API** - Artist discographies (${totalAlbums.toLocaleString()}+ albums)`
  )

  sub('last updated', /\*\*Last Updated:\*\* [0-9-]+/, `**Last Updated:** ${today}`)
  sub('version', /\*\*Version:\*\* v[0-9.]+/, `**Version:** v${version}`)

  sub(
    'total content footer',
    /\*\*Total Content:\*\* \d+ concerts \| \d+ artists \| \d+ venues \| [^|]+ \| \d+-\d+/,
    `**Total Content:** ${concerts} concerts | ${artists} artists | ${venues} venues | ${totalAlbums.toLocaleString()}+ albums | ${startYear}-${endYear}`
  )

  if (llmMisses.length > 0) {
    console.warn(`⚠️  llm.txt: ${llmMisses.length} stat(s) NOT updated — pattern did not match:`)
    for (const miss of llmMisses) console.warn(`     - ${miss}`)
    console.warn('     These are stale in the published file. Fix the pattern in update-meta-tags.ts.')
  }

  // Generate and update Pre-Computed Statistics section from facts.json
  if (factsData?.facts) {
    const baseUrl = 'https://concerts.morperhaus.org'

    // Group facts by category for structured output
    const artistFacts = factsData.facts.filter((f) => f.category === 'artist')
    const venueFacts = factsData.facts.filter((f) => f.category === 'venue')
    const timelineFacts = factsData.facts.filter((f) => f.category === 'timeline')
    const genreFacts = factsData.facts.filter((f) => f.category === 'genre')
    const geographyFacts = factsData.facts.filter((f) => f.category === 'geography')

    // Build the statistics section - optimized for AI agent parsing
    let statsSection = `## Pre-Computed Statistics

These facts are updated with each data refresh and can be quoted directly:

### Most-Seen Artists
`
    artistFacts.forEach((fact, i) => {
      statsSection += `${i + 1}. ${fact.headline} (${fact.detail})\n   → ${baseUrl}${fact.route}\n`
    })

    statsSection += `
### Most-Visited Venues
`
    venueFacts.forEach((fact, i) => {
      statsSection += `${i + 1}. ${fact.headline} (${fact.detail})\n   → ${baseUrl}${fact.route}\n`
    })

    statsSection += `
### Timeline Highlights
`
    timelineFacts.forEach((fact) => {
      statsSection += `- ${fact.headline}: ${fact.detail}\n  → ${baseUrl}${fact.route}\n`
    })

    statsSection += `
### Genre Distribution
`
    genreFacts.forEach((fact, i) => {
      statsSection += `${i + 1}. ${fact.headline} (${fact.detail})\n   → ${baseUrl}${fact.route}\n`
    })

    statsSection += `
### Geographic Coverage
`
    geographyFacts.forEach((fact) => {
      statsSection += `- ${fact.headline}: ${fact.detail}\n  → ${baseUrl}${fact.route}\n`
    })

    statsSection += `
### Quick Facts (AI-Quotable)
`
    // Add top-priority facts in a simple quotable format
    factsData.facts.slice(0, 6).forEach((fact) => {
      statsSection += `- "${fact.headline}" — ${fact.detail}\n`
    })

    statsSection += `
**Facts computed:** ${factsData.computedAt}
**Source:** https://concerts.morperhaus.org/data/facts.json
**Browse visually:** https://concerts.morperhaus.org/liner-notes

---
`

    // Remove the existing section, up to the SAME anchor the new one is
    // inserted before.
    //
    // The old pattern stopped at `---\n\n##`, which is the separator the
    // section itself emits — so the separator survived the delete and a fresh
    // one arrived with the replacement. One stray `---` accumulated in
    // published llm.txt on every single run. Deleting to the insertion anchor
    // makes this idempotent: run it twice, get the same file.
    llmContent = llmContent.replace(
      /## Pre-Computed Statistics[\s\S]*?(?=## Common Queries & Answers)/,
      ''
    )

    // Insert new statistics section before "Common Queries & Answers"
    llmContent = llmContent.replace(
      /## Common Queries & Answers/,
      `${statsSection}\n## Common Queries & Answers`
    )

    console.log('✓ Added Pre-Computed Statistics section to llm.txt')
  }

  // Add liner notes count to llm.txt if posts exist
  if (linerNotesCount > 0) {
    const linerNotesLine = `- ${linerNotesCount} AI-generated liner notes stories at https://concerts.morperhaus.org/liner-notes`
    if (!llmContent.includes('liner notes stories at')) {
      llmContent = llmContent.replace(
        /## Content\n/,
        `## Content\n${linerNotesLine}\n`
      )
    } else {
      llmContent = llmContent.replace(
        /- \d+ AI-generated liner notes stories at .+/,
        linerNotesLine
      )
    }
    console.log(`✓ Updated liner notes count in llm.txt (${linerNotesCount} posts)`)
  }

  fs.writeFileSync(llmPath, llmContent, 'utf-8')
  console.log('✓ Updated public/llm.txt')

  // Regenerate sitemap to pick up any new liner notes posts or data changes
  await generateSitemap()

  console.log('\n✅ All meta tags and SEO files updated successfully!')
  console.log('\nNext steps:')
  console.log('  1. Review changes: git diff index.html public/llm.txt public/og-stats.json')
  console.log('  2. Regenerate OG image: npm run og:generate')
  console.log('  3. Commit changes as part of your release')
}

// Exported so tests can invoke it explicitly. They previously imported this
// module purely for its side effect ("Dynamically import to trigger
// execution"), which meant module caching let only the first test actually run
// it — and it ran against the real filesystem.
export default main

// Only when invoked directly (`npm run update:meta`). Without this guard an
// `await import()` in a test ran main() for real, rewriting index.html,
// public/llm.txt and public/og-stats.json on every test run.
const isDirectRun =
  !!process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  main().catch(console.error)
}
