/**
 * ChangelogRSS Component
 *
 * Generates RSS/Atom feed for changelog entries
 */

import { useEffect, useState } from 'react'
import type { Release } from './types'

export function ChangelogRSS() {
  const [rssContent, setRssContent] = useState<string>('')

  useEffect(() => {
    // Load changelog data and generate RSS feed
    import('../../data/changelog.json')
      .then((data) => {
        const releases: Release[] = data.releases || []
        const feed = generateRSSFeed(releases)
        setRssContent(feed)
      })
      .catch((err) => {
        console.error('Failed to load changelog for RSS:', err)
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
function generateRSSFeed(releases: Release[]): string {
  const siteUrl = 'https://concerts.morperhaus.org'
  const feedUrl = `${siteUrl}/changelog/rss`
  const buildDate = new Date().toUTCString()

  const items = releases
    .map((release) => {
      const pubDate = new Date(release.date).toUTCString()
      const link = `${siteUrl}${release.route}`
      const guid = `${siteUrl}/changelog#${release.version}`

      const highlights = release.highlights
        .map((h) => `<li>${escapeXml(h)}</li>`)
        .join('\n        ')

      return `    <item>
      <title>${escapeXml(release.title)} - v${release.version}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[
        <p>${escapeXml(release.description)}</p>
        <ul>
        ${highlights}
        </ul>
      ]]></description>
    </item>`
    })
    .join('\n\n')

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Morperhaus Concert Archives - What's Playing</title>
    <link>${siteUrl}/changelog</link>
    <description>New features and updates for the Morperhaus Concert Archives</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />

${items}
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
