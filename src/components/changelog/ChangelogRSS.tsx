/**
 * ChangelogRSS Component
 *
 * Generates RSS/Atom feed for changelog entries and facts
 */

import { useEffect, useState } from 'react'
import type { Release, Fact, FactsData } from './types'

export function ChangelogRSS() {
  const [rssContent, setRssContent] = useState<string>('')

  useEffect(() => {
    // Load changelog and facts data in parallel
    Promise.all([
      import('../../data/changelog.json'),
      fetch('/data/facts.json').then((res) => res.ok ? res.json() : null),
    ])
      .then(([changelogData, factsData]) => {
        const releases: Release[] = changelogData.releases || []
        const facts = factsData as FactsData | null
        const feed = generateRSSFeed(releases, facts)
        setRssContent(feed)
      })
      .catch((err) => {
        console.error('Failed to load data for RSS:', err)
      })
  }, [])

  // Render RSS as plain text
  return (
    <pre className="whitespace-pre-wrap font-mono text-xs p-4 bg-black text-green-400">
      {rssContent || 'Loading RSS feed...'}
    </pre>
  )
}

/**
 * Generate RSS 2.0 feed XML
 */
function generateRSSFeed(releases: Release[], factsData: FactsData | null): string {
  const siteUrl = 'https://concerts.morperhaus.org'
  const feedUrl = `${siteUrl}/liner-notes/rss`
  const buildDate = new Date().toUTCString()

  // Generate release items
  const releaseItems = releases
    .map((release) => {
      const pubDate = new Date(release.date).toUTCString()
      const link = `${siteUrl}${release.route}`
      const guid = `${siteUrl}/liner-notes#${release.version}`

      const highlights = release.highlights
        .map((h) => `<li>${escapeXml(h)}</li>`)
        .join('\n        ')

      return `    <item>
      <title>${escapeXml(release.title)} - v${release.version}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>Release</category>
      <description><![CDATA[
        <p>${escapeXml(release.description)}</p>
        <ul>
        ${highlights}
        </ul>
      ]]></description>
    </item>`
    })

  // Generate facts summary item (single item with all facts)
  let factsItem = ''
  if (factsData?.facts && factsData.facts.length > 0) {
    const factsDate = new Date(factsData.computedAt).toUTCString()
    const factsGuid = `${siteUrl}/liner-notes#facts-${factsData.computedAt.split('T')[0]}`

    // Group facts by category for readable output
    const factsByCategory = factsData.facts.reduce((acc, fact) => {
      if (!acc[fact.category]) acc[fact.category] = []
      acc[fact.category].push(fact)
      return acc
    }, {} as Record<string, Fact[]>)

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
      <link>${siteUrl}/liner-notes</link>
      <guid isPermaLink="false">${factsGuid}</guid>
      <pubDate>${factsDate}</pubDate>
      <category>Statistics</category>
      <description><![CDATA[
        ${factsHtml}
        <p><a href="${siteUrl}/liner-notes">View all statistics</a></p>
      ]]></description>
    </item>`
  }

  // Combine items: facts first (if newer), then releases
  const allItems = factsItem ? [factsItem, ...releaseItems] : releaseItems

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Morperhaus Concert Archives - Liner Notes</title>
    <link>${siteUrl}/liner-notes</link>
    <description>New features, updates, and statistics for the Morperhaus Concert Archives</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />

${allItems.join('\n\n')}
  </channel>
</rss>`
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
