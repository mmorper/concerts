#!/usr/bin/env tsx
/**
 * Generate Sitemap Script
 *
 * Creates sitemap.xml from concert data with all deep-linkable URLs:
 * - Homepage
 * - 5 scene navigation links
 * - 247+ artist deep links
 * - 77+ venue deep links (2 scenes each)
 * - Changelog pages
 *
 * URLs sorted by concert count (most-attended first) for SEO priority.
 *
 * Run: npm run generate:sitemap
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Concert {
  headlinerNormalized: string
  venueNormalized: string
  date: string
}

interface ConcertsData {
  concerts: Concert[]
}

const SITE_URL = 'https://concerts.morperhaus.org'
const OUTPUT_PATH = path.join(process.cwd(), 'public/sitemap.xml')

async function generateSitemap() {
  console.log('🗺️  Generating sitemap.xml...\n')

  // Load data
  const concertsPath = path.join(__dirname, '..', 'public', 'data', 'concerts.json')
  const artistsPath = path.join(__dirname, '..', 'public', 'data', 'artists-metadata.json')
  const venuesPath = path.join(__dirname, '..', 'public', 'data', 'venues-metadata.json')

  const concertsData: ConcertsData = JSON.parse(fs.readFileSync(concertsPath, 'utf-8'))
  const artistsData = JSON.parse(fs.readFileSync(artistsPath, 'utf-8'))
  const venuesData = JSON.parse(fs.readFileSync(venuesPath, 'utf-8'))

  // Load liner notes posts (optional — may not exist on first run)
  const linerNotesPath = path.join(__dirname, '..', 'public', 'data', 'liner-notes.json')
  const linerNotesSlugs: string[] = []
  if (fs.existsSync(linerNotesPath)) {
    const linerNotesData = JSON.parse(fs.readFileSync(linerNotesPath, 'utf-8'))
    linerNotesSlugs.push(...(linerNotesData.posts ?? []).map((p: { slug: string }) => p.slug))
  }

  const concerts = concertsData.concerts
  const artists = Object.keys(artistsData)
  const venues = Object.keys(venuesData)

  // Use current date as lastmod (when sitemap was generated/site was updated)
  const lastmod = new Date().toISOString().split('T')[0]

  // Also get latest concert date for logging
  const dates = concerts.map((c) => c.date).sort()
  const latestConcertDate = dates[dates.length - 1]

  console.log(`Data loaded:`)
  console.log(`  ${concerts.length} concerts`)
  console.log(`  ${artists.length} artists`)
  console.log(`  ${venues.length} venues`)
  console.log(`  Latest concert: ${latestConcertDate}`)
  console.log(`  Sitemap lastmod: ${lastmod}\n`)

  // Start XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  // Homepage
  xml += generateUrlEntry('/', 1.0, 'weekly', lastmod)

  // Scene links with adjusted priorities based on update frequency
  // Timeline & Artists update frequently (0.9)
  // Venues, Map, Genres update least (0.7)
  const scenes = [
    { path: 'timeline', priority: 0.9, changefreq: 'weekly' }, // Updates frequently
    { path: 'artists', priority: 0.9, changefreq: 'weekly' }, // Updates frequently
    { path: 'venues', priority: 0.7, changefreq: 'monthly' }, // Updates least
    { path: 'geography', priority: 0.7, changefreq: 'monthly' }, // Updates least (map)
    { path: 'genres', priority: 0.7, changefreq: 'monthly' }, // Updates least
  ]

  scenes.forEach((scene) => {
    xml += generateUrlEntry(`/?scene=${scene.path}`, scene.priority, scene.changefreq, lastmod)
  })

  // Artist deep links (sorted by concert count)
  const artistConcertCounts = new Map<string, number>()
  concerts.forEach((concert) => {
    const count = artistConcertCounts.get(concert.headlinerNormalized) || 0
    artistConcertCounts.set(concert.headlinerNormalized, count + 1)
  })

  const sortedArtists = artists.sort((a, b) => {
    const countA = artistConcertCounts.get(a) || 0
    const countB = artistConcertCounts.get(b) || 0
    return countB - countA
  })

  sortedArtists.forEach((artist) => {
    xml += generateUrlEntry(`/?scene=artists&artist=${artist}`, 0.8, 'monthly')
  })

  // Venue deep links (both scenes, sorted by concert count)
  const venueConcertCounts = new Map<string, number>()
  concerts.forEach((concert) => {
    const count = venueConcertCounts.get(concert.venueNormalized) || 0
    venueConcertCounts.set(concert.venueNormalized, count + 1)
  })

  const sortedVenues = venues.sort((a, b) => {
    const countA = venueConcertCounts.get(a) || 0
    const countB = venueConcertCounts.get(b) || 0
    return countB - countA
  })

  sortedVenues.forEach((venue) => {
    // Venues scene (network graph)
    xml += generateUrlEntry(`/?scene=venues&venue=${venue}`, 0.7, 'monthly')
    // Geography scene (map)
    xml += generateUrlEntry(`/?scene=geography&venue=${venue}`, 0.6, 'monthly')
  })

  // Liner notes feed and post permalinks
  xml += generateUrlEntry('/liner-notes', 0.7, 'weekly', lastmod)
  xml += generateUrlEntry('/liner-notes.xml', 0.4, 'weekly', lastmod)
  linerNotesSlugs.forEach((slug) => {
    xml += generateUrlEntry(`/liner-notes/${slug}`, 0.8, 'weekly', lastmod)
  })

  // How It Works — interactive data pipeline explainer
  xml += generateUrlEntry('/how-it-works', 0.6, 'monthly', lastmod)

  // Ask the Archive — in-app conversational interface
  xml += generateUrlEntry('/ask', 0.7, 'monthly', lastmod)

  // MCP server — human-facing connector page (canonical, static via Pages)
  xml += generateUrlEntry('/about-mcp', 0.6, 'monthly', lastmod)

  // About page
  xml += generateUrlEntry('/about', 0.6, 'monthly')

  xml += '</urlset>'

  // Write file
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf-8')

  const totalUrls =
    1 + // homepage
    scenes.length +
    sortedArtists.length +
    sortedVenues.length * 2 + // 2 scenes per venue
    2 + linerNotesSlugs.length + // liner notes feed + permalinks
    1 + // how-it-works
    1 + // ask the archive
    1 + // about-mcp (connector page)
    1 // about page

  console.log(`✅ Sitemap generated: ${OUTPUT_PATH}`)
  console.log(`   Total URLs: ${totalUrls}`)
  console.log(`   - Homepage: 1`)
  console.log(`   - Scenes: ${scenes.length}`)
  console.log(`   - Artists: ${sortedArtists.length}`)
  console.log(`   - Venues: ${sortedVenues.length} × 2 scenes = ${sortedVenues.length * 2}`)
  console.log(`   - Liner notes: ${2 + linerNotesSlugs.length} (feed + ${linerNotesSlugs.length} posts)`)
  console.log(`   - How It Works: 1`)
  console.log(`   - Ask the Archive: 1`)
  console.log(`   - Connector (about-mcp): 1`)
  console.log(`   - About: 1`)
  console.log()
}

/**
 * Generate a single URL entry with proper XML escaping
 */
function generateUrlEntry(
  urlPath: string,
  priority: number,
  changefreq: string,
  lastmod?: string
): string {
  // XML escape special characters
  const escapedPath = urlPath
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  let entry = '  <url>\n'
  entry += `    <loc>${SITE_URL}${escapedPath}</loc>\n`
  if (lastmod) {
    entry += `    <lastmod>${lastmod}</lastmod>\n`
  }
  entry += `    <changefreq>${changefreq}</changefreq>\n`
  entry += `    <priority>${priority.toFixed(1)}</priority>\n`
  entry += '  </url>\n'
  return entry
}

// Run if called directly — and *only* then. The comment always said "if called
// directly"; the guard was missing, so `await import()` in a test ran the real
// generator and overwrote public/sitemap.xml on every test run.
// Invoked via `npm run generate:sitemap` (tsx scripts/generate-sitemap.ts);
// nothing imports this module for its side effect.
const isDirectRun =
  !!process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  generateSitemap().catch((err) => {
    console.error('❌ Sitemap generation failed:', err)
    process.exit(1)
  })
}

export { generateSitemap }
