#!/usr/bin/env tsx
/**
 * Generate RSS Feed Script
 *
 * Creates a static RSS 2.0 feed file from changelog and facts data.
 * Outputs to public/rss.xml for direct serving with correct content-type.
 *
 * Run: npm run generate:rss
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Release {
  version: string
  date: string
  title: string
  description: string
  route: string
  highlights: string[]
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
  facts: Fact[]
  computedAt: string
}

const SITE_URL = 'https://concerts.morperhaus.org'
const OUTPUT_PATH = path.join(process.cwd(), 'public/rss.xml')

async function generateRSS() {
  console.log('📡 Generating RSS feed...\n')

  // Load changelog
  const changelogPath = path.join(__dirname, '..', 'src', 'data', 'changelog.json')
  const changelogData = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'))
  const releases: Release[] = changelogData.releases || []

  // Load facts
  const factsPath = path.join(__dirname, '..', 'public', 'data', 'facts.json')
  let factsData: FactsData | null = null
  if (fs.existsSync(factsPath)) {
    factsData = JSON.parse(fs.readFileSync(factsPath, 'utf-8'))
  }

  console.log(`Data loaded:`)
  console.log(`  ${releases.length} releases`)
  console.log(`  ${factsData?.facts.length || 0} facts\n`)

  // Generate feed
  const feed = generateRSSFeed(releases, factsData)

  // Write file
  fs.writeFileSync(OUTPUT_PATH, feed, 'utf-8')

  console.log(`✅ RSS feed generated: ${OUTPUT_PATH}`)
  console.log(`   ${releases.length} release items`)
  if (factsData) {
    console.log(`   1 facts summary item`)
  }
  console.log()
}

function generateRSSFeed(releases: Release[], factsData: FactsData | null): string {
  const feedUrl = `${SITE_URL}/rss.xml`
  const buildDate = new Date().toUTCString()

  // Generate release items
  const releaseItems = releases.map((release) => {
    const pubDate = new Date(release.date).toUTCString()
    const link = release.route ? `${SITE_URL}${release.route}` : `${SITE_URL}/liner-notes`
    const guid = `${SITE_URL}/liner-notes#v${release.version}`

    const highlights =
      release.highlights.length > 0
        ? `<ul>${release.highlights.map((h) => `<li>${escapeXml(h)}</li>`).join('')}</ul>`
        : ''

    return `    <item>
      <title>${escapeXml(release.title)} - v${release.version}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>Release</category>
      <description><![CDATA[<p>${escapeXml(release.description)}</p>${highlights}]]></description>
    </item>`
  })

  // Generate facts summary item
  let factsItem = ''
  if (factsData?.facts && factsData.facts.length > 0) {
    const factsDate = new Date(factsData.computedAt).toUTCString()
    const factsGuid = `${SITE_URL}/liner-notes#facts-${factsData.computedAt.split('T')[0]}`

    // Group facts by category
    const factsByCategory = factsData.facts.reduce(
      (acc, fact) => {
        if (!acc[fact.category]) acc[fact.category] = []
        acc[fact.category].push(fact)
        return acc
      },
      {} as Record<string, Fact[]>
    )

    const categoryLabels: Record<string, string> = {
      artist: 'Artists',
      venue: 'Venues',
      genre: 'Genres',
      timeline: 'Timeline',
      geography: 'Geography',
    }

    let factsHtml = '<h3>Archive Statistics</h3>'
    for (const [category, facts] of Object.entries(factsByCategory)) {
      factsHtml += `<h4>${categoryLabels[category] || category}</h4><ul>`
      for (const fact of facts) {
        factsHtml += `<li><strong>${escapeXml(fact.headline)}</strong> — ${escapeXml(fact.detail)}</li>`
      }
      factsHtml += '</ul>'
    }

    factsItem = `    <item>
      <title>By the Numbers - Archive Statistics</title>
      <link>${SITE_URL}/liner-notes</link>
      <guid isPermaLink="false">${factsGuid}</guid>
      <pubDate>${factsDate}</pubDate>
      <category>Statistics</category>
      <description><![CDATA[${factsHtml}<p><a href="${SITE_URL}/liner-notes">View all statistics</a></p>]]></description>
    </item>`
  }

  // Combine items: facts first (most recent), then releases
  const allItems = factsItem ? [factsItem, ...releaseItems] : releaseItems

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Morperhaus Concert Archives - Liner Notes</title>
    <link>${SITE_URL}/liner-notes</link>
    <description>New features, updates, and statistics for the Morperhaus Concert Archives</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/og-image.jpg</url>
      <title>Morperhaus Concert Archives</title>
      <link>${SITE_URL}</link>
    </image>

${allItems.join('\n\n')}
  </channel>
</rss>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Run if called directly
generateRSS().catch((err) => {
  console.error('❌ RSS generation failed:', err)
  process.exit(1)
})

export { generateRSS }
