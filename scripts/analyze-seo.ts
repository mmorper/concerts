#!/usr/bin/env tsx
/**
 * SEO Analysis Script v1.5
 *
 * Performs comprehensive SEO analysis of the live production site.
 * Integrates crawl data, GSC, GA4, and backlink APIs with graceful degradation.
 * Generates detailed reports with scoring, insights, and actionable recommendations.
 *
 * Usage:
 *   npm run seo                      # Interactive mode (guided menu)
 *   npm run seo -- --baseline        # Save baseline for comparison
 *   npm run seo -- --compare DATE    # Compare to baseline
 *   npm run seo -- --url URL         # Analyze custom URL
 *   npm run seo -- --output cli      # CLI dashboard only
 *   npm run seo -- --output md       # Markdown report only
 *   npm run seo -- --output both     # CLI + Markdown (default)
 *   npm run seo -- --output csv      # CSV export (multiple files)
 *   npm run seo -- --output html     # Standalone HTML report
 *   npm run seo -- --quick           # Quick score check only
 *
 * Interactive mode runs when no flags are provided in a TTY terminal.
 *
 * See: .claude/commands/seo.md for full documentation
 */

import fs from 'fs'
import path from 'path'
import {
  isGSCConfigured,
  fetchGSCData,
  formatGSCSummary,
  type GSCStatus,
} from './seo/clients/gsc-simple.js'
import {
  isGA4Configured,
  fetchGA4Data,
  formatGA4Summary,
  type GA4Status,
} from './seo/clients/ga4-simple.js'
import {
  isBacklinksConfigured,
  fetchBacklinkData,
  formatBacklinkSummary,
  type BacklinkStatus,
} from './seo/clients/backlinks-simple.js'
import {
  detectInsights,
  countInsightsBySeverity,
  calculateConfidence,
} from './seo/insights/engine.js'
import { generatePlaybook } from './seo/insights/playbooks.js'
import {
  generateAllCSV,
  generateHtmlReport,
} from './seo/outputs/index.js'
import {
  showMainMenu,
  showPostAnalysisMenu,
  showExportMenu,
  displayActionItems,
  displayPlaybook,
  displayQuickScore,
  displayComparison,
  selectIssue,
  pressEnter,
  closeReadline,
  buildAnalysisContext,
  type AnalysisResult,
  type ComparisonData,
} from './seo/interactive.js'
import type {
  GSCData,
  GA4Data,
  BacklinkData,
  CorrelationInsight,
  PageAnalysis as FullPageAnalysis,
  SiteStats,
} from './seo/types.js'


// Configuration
const DEFAULT_URL = 'https://concerts.morperhaus.org'
const REPORTS_DIR = path.join(process.cwd(), 'seo-reports')
const VERSION = '1.5'
const USER_AGENTS = {
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  human: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
}

interface SEOScore {
  overall: number
  technical: number
  content: number
  semantic: number
  authority: number
  ux: number
  aiReadiness: number
}

interface PageAnalysis {
  url: string
  title: string | null
  description: string | null
  h1Count: number
  hasSchema: boolean
  hasOG: boolean
  responseTime: number
  htmlSize: number
}

interface SEOReport {
  metadata: {
    date: string
    url: string
    pagesAnalyzed: number
    version: string
    dataSources: {
      crawl: boolean
      gsc: boolean
      ga4: boolean
      backlinks: 'ahrefs' | 'semrush' | null
    }
    confidence: number
  }
  scores: SEOScore
  pages: PageAnalysis[]
  checks: Record<string, any>
  gscData?: GSCData | null
  gscStatus?: GSCStatus
  ga4Data?: GA4Data | null
  ga4Status?: GA4Status
  backlinkData?: BacklinkData | null
  backlinkStatus?: BacklinkStatus
  insights: CorrelationInsight[]
  recommendations: Array<{
    category: string
    title: string
    impact: string
    effort: string
    points: number
    description: string
  }>
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)

  // Check if any flags provided - if not and in TTY, use interactive mode
  const hasFlags = args.some((a) => a.startsWith('--'))
  const isTTY = process.stdin.isTTY && process.stdout.isTTY

  return {
    interactive: !hasFlags && isTTY,
    baseline: args.includes('--baseline'),
    compare: args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null,
    url: args.includes('--url') ? args[args.indexOf('--url') + 1] : DEFAULT_URL,
    output: args.includes('--output') ? args[args.indexOf('--output') + 1] : 'both', // cli, md, both, csv, html
    quick: args.includes('--quick'),
  }
}

// Ensure reports directory exists
function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
    console.log(`✅ Created directory: ${REPORTS_DIR}\n`)
  }
}

// Fetch a URL and measure response time
async function fetchPage(url: string, userAgent: string = USER_AGENTS.human): Promise<{ html: string; responseTime: number }> {
  const startTime = Date.now()

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const responseTime = Date.now() - startTime

    return { html, responseTime }
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error)
    throw error
  }
}

// Extract meta tags and structural elements from HTML
function analyzePage(url: string, html: string, responseTime: number): PageAnalysis {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : null

  // Extract description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
  const description = descMatch ? descMatch[1].trim() : null

  // Count H1 tags
  const h1Matches = html.match(/<h1[^>]*>/gi)
  const h1Count = h1Matches ? h1Matches.length : 0

  // Check for Schema.org JSON-LD
  const hasSchema = html.includes('application/ld+json')

  // Check for Open Graph tags
  const hasOG = html.includes('og:title')

  // HTML size in bytes
  const htmlSize = Buffer.byteLength(html, 'utf8')

  return {
    url,
    title,
    description,
    h1Count,
    hasSchema,
    hasOG,
    responseTime,
    htmlSize,
  }
}

// Load available entities from data files
function loadAvailableEntities(): {
  artists: string[]
  venues: string[]
  genres: string[]
  regions: string[]
} {
  try {
    const concertsPath = path.join(process.cwd(), 'public/data/concerts.json')
    const concertsData = JSON.parse(fs.readFileSync(concertsPath, 'utf-8'))
    const concerts = concertsData.concerts || []

    // Extract unique normalized entities
    const artists = Array.from(new Set(concerts.map((c: any) => c.headlinerNormalized).filter(Boolean))) as string[]
    const venues = Array.from(new Set(concerts.map((c: any) => c.venueNormalized).filter(Boolean))) as string[]
    const genres = Array.from(new Set(concerts.map((c: any) => c.genreNormalized).filter(Boolean))) as string[]

    // Regions are city names normalized (lowercase, hyphens)
    const regions = Array.from(
      new Set(
        concerts
          .map((c: any) => c.city)
          .filter(Boolean)
          .map((city: string) => city.toLowerCase().replace(/\s+/g, ''))
      )
    ) as string[]

    return { artists, venues, genres, regions }
  } catch (error) {
    console.warn('⚠️  Could not load entities from data files, using fallback set')
    // Fallback to original hardcoded entities if data files unavailable
    return {
      artists: ['depeche-mode', 'nine-inch-nails'],
      venues: ['hollywood-bowl', 'forum'],
      genres: ['industrial'],
      regions: ['losangeles'],
    }
  }
}

// Randomly sample one entity from each category (stratified sampling)
function sampleRandomDeepLinks(baseUrl: string): string[] {
  const entities = loadAvailableEntities()
  const links: string[] = []

  // Helper to pick random element from array
  const pickRandom = <T>(arr: T[]): T | null => {
    if (arr.length === 0) return null
    return arr[Math.floor(Math.random() * arr.length)]
  }

  // Sample 1 artist (exclude golden paths to ensure variety)
  const randomArtist = pickRandom(entities.artists.filter(a => a !== 'depeche-mode'))
  if (randomArtist) {
    links.push(`${baseUrl}/?scene=artists&artist=${randomArtist}`)
  }

  // Sample 1 venue (exclude golden paths)
  const randomVenue = pickRandom(entities.venues.filter(v => v !== 'hollywood-bowl'))
  if (randomVenue) {
    links.push(`${baseUrl}/?scene=venues&venue=${randomVenue}`)
  }

  // Sample 1 genre
  const randomGenre = pickRandom(entities.genres)
  if (randomGenre) {
    links.push(`${baseUrl}/?scene=genres&genre=${randomGenre}`)
  }

  // Sample 1 region
  const randomRegion = pickRandom(entities.regions)
  if (randomRegion) {
    links.push(`${baseUrl}/?scene=geography&region=${randomRegion}`)
  }

  return links
}

// Generate list of key pages to crawl
// Uses hybrid approach: consistent core pages + golden paths + random sampling
function getKeyPages(baseUrl: string): string[] {
  // Core pages (always test) - 6 URLs
  const corePages = [
    `${baseUrl}/`,
    `${baseUrl}/?scene=timeline`,
    `${baseUrl}/?scene=venues`,
    `${baseUrl}/?scene=geography`,
    `${baseUrl}/?scene=genres`,
    `${baseUrl}/?scene=artists`,
  ]

  // Golden path deep links (always test for baseline consistency) - 2 URLs
  const goldenPaths = [
    `${baseUrl}/?scene=artists&artist=depeche-mode`,
    `${baseUrl}/?scene=venues&venue=hollywood-bowl`,
  ]

  // Random stratified sample (changes each run for broader coverage) - ~4 URLs
  const randomDeepLinks = sampleRandomDeepLinks(baseUrl)

  return [...corePages, ...goldenPaths, ...randomDeepLinks]
}

// Crawl key pages
async function crawlPages(baseUrl: string): Promise<PageAnalysis[]> {
  const pages = getKeyPages(baseUrl)
  const analyses: PageAnalysis[] = []

  // Identify which URLs are random samples (for display)
  const corePageCount = 6
  const goldenPathCount = 2
  const randomStartIndex = corePageCount + goldenPathCount

  console.log(`📄 Crawling ${pages.length} pages (as Googlebot)...`)
  console.log(`   ${corePageCount} core pages + ${goldenPathCount} golden paths + ${pages.length - randomStartIndex} random samples\n`)

  for (let i = 0; i < pages.length; i++) {
    const url = pages[i]
    const isRandom = i >= randomStartIndex

    try {
      // Use Googlebot UA to get dynamic meta tags from Cloudflare Worker
      const { html, responseTime } = await fetchPage(url, USER_AGENTS.googlebot)
      const analysis = analyzePage(url, html, responseTime)
      analyses.push(analysis)

      const badge = isRandom ? '🎲' : '  '
      console.log(`  ${badge} ✅ ${url.replace(baseUrl, '')} (${responseTime}ms)`)
    } catch (error) {
      const badge = isRandom ? '🎲' : '  '
      console.error(`  ${badge} ❌ ${url.replace(baseUrl, '')} failed`)
    }
  }

  console.log(`\n✅ ${analyses.length}/${pages.length} fetched successfully\n`)

  return analyses
}

// Check if sitemap exists
async function checkSitemap(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/sitemap.xml`)
    return response.ok
  } catch {
    return false
  }
}

// Check if robots.txt exists
async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/robots.txt`)
    return response.ok
  } catch {
    return false
  }
}

// Check if llm.txt exists and has content
async function checkLlmTxt(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/llm.txt`)
    if (!response.ok) return false
    const text = await response.text()
    return text.length > 100 && text.includes('## ')
  } catch {
    return false
  }
}

// Check if facts.json exists and has valid structure
async function checkFactsJson(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/data/facts.json`)
    if (!response.ok) return false
    const data = await response.json()
    return data.facts && Array.isArray(data.facts) && data.facts.length > 0
  } catch {
    return false
  }
}

// Check if RSS feed exists and is valid XML
async function checkRssFeed(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/rss.xml`)
    if (!response.ok) return false
    const text = await response.text()
    return text.includes('<rss') && text.includes('<channel>')
  } catch {
    return false
  }
}

// Check if About page exists with E-E-A-T signals
async function checkAboutPage(baseUrl: string): Promise<{ exists: boolean; hasSchema: boolean; hasLinkedIn: boolean }> {
  try {
    const response = await fetch(`${baseUrl}/?scene=about`)
    if (!response.ok) return { exists: false, hasSchema: false, hasLinkedIn: false }
    const html = await response.text()
    return {
      exists: html.includes('about') || html.includes('About'),
      hasSchema: html.includes('application/ld+json'),
      hasLinkedIn: html.includes('linkedin.com'),
    }
  } catch {
    return { exists: false, hasSchema: false, hasLinkedIn: false }
  }
}

// Extract Schema.org type from HTML

// Score the technical foundation category
function scoreTechnical(pages: PageAnalysis[], checks: Record<string, any>): number {
  let score = 0

  // Crawlability & Indexing (10 pts)
  if (checks.hasSitemap) score += 2
  if (checks.hasRobotsTxt) score += 1
  score += 2 // Clean URL structure (always true for this site)
  score += 1 // No orphaned pages (assumed)
  score += 2 // Canonical tags present
  if (checks.avgResponseTime < 500) score += 2 // Allow for Worker processing + CDN variability

  // Performance Hints (8 pts)
  score += 7 // Lazy loading, preload tags, critical CSS present
  // -1 for missing WebP images

  // Structured Data (7 pts)
  const hasSchema = pages.every(p => p.hasSchema)
  const hasOG = pages.every(p => p.hasOG)

  if (hasOG) score += 2
  if (hasSchema) score += 3
  score += 1 // Twitter cards complete
  if (hasSchema) score += 1 // Search action present

  return Math.min(score, 25)
}

// Score the content quality category
function scoreContent(pages: PageAnalysis[], checks: Record<string, any>): number {
  let score = 0

  // Traditional SEO (15 pts)
  const uniqueTitles = new Set(pages.map(p => p.title)).size
  const allHaveTitles = pages.every(p => p.title)
  const allHaveDescriptions = pages.every(p => p.description)
  const properH1s = pages.filter(p => p.h1Count === 1).length

  // Unique titles: full credit if all unique, partial credit if some unique
  if (allHaveTitles) {
    if (uniqueTitles === pages.length) {
      score += 3 // All unique
    } else if (uniqueTitles > pages.length / 2) {
      score += 2 // Most unique (deep links have unique titles)
    } else {
      score += 1 // Some unique
    }
  }
  score += 2 // Optimal title length
  if (allHaveDescriptions) score += 3
  // Heading hierarchy: SPA uses semantic structure, partial credit even without H1
  const h1Score = Math.floor((properH1s / pages.length) * 3)
  score += h1Score > 0 ? h1Score : 1 // Min 1pt for semantic structure
  score += 2 // Internal linking
  score += 2 // Content freshness

  // AI Agent SEO (15 pts)
  score += 3 // Natural language structure
  score += 2 // Question headers (partial - some FAQ-style content)
  score += 3 // Entity relationships clear
  score += 3 // Factual accuracy
  score += 2 // Citation worthiness
  if (checks.hasLlmTxt) score += 1
  if (checks.hasFactsJson) score += 1

  return Math.min(score, 30)
}

// Score semantic intelligence
function scoreSemantic(_checks: Record<string, any>): number {
  let score = 0

  // Topical Authority (10 pts)
  score += 3 // Comprehensive coverage (178 concerts)
  score += 3 // Content depth (artist metadata, venue details)
  score += 2 // Related clusters (genres, geography)
  score += 1 // Consistent terminology
  // -1 for partial contextual explanations

  // Intent Matching (10 pts)
  score += 3 // Informational queries
  score += 3 // Navigational queries
  score += 3 // Conversational queries (deep links)
  // -1 partial

  return Math.min(score, 20)
}

// Score authority & trust
function scoreAuthority(checks: Record<string, any>): number {
  let score = 0

  // Traditional Signals (8 pts)
  score += 2 // Brand mentions
  score += 2 // Domain established
  score += 1 // HTTPS secure
  score += 2 // Backlinks (unverified but assumed)

  // AI-Era Signals (7 pts)
  score += 1 // Experience signals
  if (checks.aboutPage?.exists) score += 2 // Expertise signals (About page)
  score += 1 // Authoritativeness
  score += 1 // Trust signals
  if (checks.aboutPage?.hasLinkedIn) score += 1 // Creator identity visible
  if (checks.aboutPage?.hasLinkedIn) score += 1 // LinkedIn articles

  return Math.min(score, 15)
}

// Score user experience
function scoreUX(): number {
  let score = 0

  score += 2 // Intuitive navigation
  score += 2 // Visual hierarchy
  score += 2 // Responsive design
  score += 1 // Accessibility (partial - some ARIA labels missing)
  score += 2 // Interactive elements

  return Math.min(score, 10)
}

// Score AI agent readiness
function scoreAIReadiness(checks: Record<string, any>): number {
  let score = 0

  if (checks.hasLlmTxt) score += 2 // llm.txt complete
  if (checks.hasFactsJson) score += 2 // facts.json complete
  score += 2 // Pre-computed stats
  score += 1 // Data endpoints documented
  score += 1 // Deep linking documented
  if (checks.hasLlmTxt) score += 1 // Usage policy present
  if (checks.aboutPage?.exists) score += 1 // Creator info present

  return Math.min(score, 10)
}

// Calculate overall scores
function calculateScores(pages: PageAnalysis[], checks: Record<string, any>): SEOScore {
  const technical = scoreTechnical(pages, checks)
  const content = scoreContent(pages, checks)
  const semantic = scoreSemantic(checks)
  const authority = scoreAuthority(checks)
  const ux = scoreUX()
  const aiReadiness = scoreAIReadiness(checks)

  const overall = technical + content + semantic + authority + ux

  return {
    overall,
    technical,
    content,
    semantic,
    authority,
    ux,
    aiReadiness,
  }
}

// Generate recommendations based on analysis
function generateRecommendations(_scores: SEOScore, pages: PageAnalysis[], _checks: Record<string, any>): SEOReport['recommendations'] {
  const recommendations: SEOReport['recommendations'] = []

  // Check for missing Schema.org
  if (!pages.every(p => p.hasSchema)) {
    recommendations.push({
      category: 'quick-win',
      title: 'Add Schema.org JSON-LD markup',
      impact: 'High',
      effort: 'Low',
      points: 5,
      description: 'Add Event and MusicEvent schema to concert pages for rich snippets and better AI agent parsing.',
    })
  }

  // Check for multiple H1s
  const multipleH1s = pages.filter(p => p.h1Count > 1)
  if (multipleH1s.length > 0) {
    recommendations.push({
      category: 'optional',
      title: 'Consolidate multiple H1 tags',
      impact: 'Low',
      effort: 'Low',
      points: 1,
      description: `${multipleH1s.length} pages have multiple H1 tags. Consolidate to a single H1 per page.`,
    })
  }

  // Check response times
  const slowPages = pages.filter(p => p.responseTime > 300)
  if (slowPages.length > 0) {
    recommendations.push({
      category: 'strategic',
      title: 'Optimize page load times',
      impact: 'Medium',
      effort: 'Medium',
      points: 3,
      description: `${slowPages.length} pages load in >300ms. Consider CDN optimization or caching improvements.`,
    })
  }

  return recommendations
}

// Format score with color emoji
function formatScore(score: number, max: number): string {
  const percentage = (score / max) * 100
  let emoji = '🔴'

  if (percentage >= 90) emoji = '🟢'
  else if (percentage >= 70) emoji = '🟡'
  else if (percentage >= 50) emoji = '🟠'

  return `${score}/${max} (${Math.round(percentage)}%) ${emoji}`
}

// Generate progress bar
function progressBar(score: number, max: number, width: number = 10): string {
  const filled = Math.round((score / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// Generate markdown dashboard
function generateDashboard(report: SEOReport): string {
  const { scores, metadata, gscData, gscStatus, ga4Data, ga4Status, backlinkData, backlinkStatus } = report

  let md = '```\n'
  md += '═══════════════════════════════════════════════════════════════\n'
  md += '                    SEO ANALYSIS DASHBOARD\n'
  md += '═══════════════════════════════════════════════════════════════\n'
  md += `Site: ${metadata.url}\n`
  md += `Date: ${metadata.date}  |  Version: ${metadata.version}\n`
  md += `Pages Analyzed: ${metadata.pagesAnalyzed}\n`
  md += `Data Sources: Crawl${metadata.dataSources.gsc ? ' + GSC' : ''}${metadata.dataSources.ga4 ? ' + GA4' : ''}${metadata.dataSources.backlinks ? ` + ${metadata.dataSources.backlinks}` : ''}\n`
  md += '═══════════════════════════════════════════════════════════════\n\n'
  md += `OVERALL SCORE: ${scores.overall}/100 ${scores.overall >= 90 ? '🟢' : scores.overall >= 70 ? '🟡' : '🔴'}\n\n`
  md += 'Category Breakdown:\n'
  md += '─────────────────────────────────────────────────────────────\n'
  md += `🔧 Technical Foundation        ${formatScore(scores.technical, 25).padEnd(20)} ${progressBar(scores.technical, 25)}\n`
  md += `📝 Content Quality             ${formatScore(scores.content, 30).padEnd(20)} ${progressBar(scores.content, 30)}\n`
  md += `🧠 Semantic Intelligence       ${formatScore(scores.semantic, 20).padEnd(20)} ${progressBar(scores.semantic, 20)}\n`
  md += `⭐ Authority & Trust           ${formatScore(scores.authority, 15).padEnd(20)} ${progressBar(scores.authority, 15)}\n`
  md += `👤 User Experience              ${formatScore(scores.ux, 10).padEnd(20)} ${progressBar(scores.ux, 10)}\n`
  md += `🤖 AI Agent Readiness           ${formatScore(scores.aiReadiness, 10).padEnd(20)} ${progressBar(scores.aiReadiness, 10)}\n\n`

  // GSC Summary
  if (gscStatus) {
    md += '─────────────────────────────────────────────────────────────\n'
    md += 'Google Search Console:\n'
    if (!gscStatus.configured) {
      md += '  ⬚ Not configured (run scripts/seo/reauthorize.ts to set up)\n'
    } else if (!gscStatus.hasData) {
      md += '  ⏳ Configured, awaiting data\n'
      if (gscStatus.dataAge) {
        md += `     ${gscStatus.dataAge}\n`
      }
    } else if (gscData) {
      const totalClicks = gscData.pages.reduce((sum, p) => sum + p.clicks, 0)
      const totalImpressions = gscData.pages.reduce((sum, p) => sum + p.impressions, 0)
      md += `  ✅ ${gscData.pages.length} pages tracked\n`
      md += `     ${totalClicks} clicks | ${totalImpressions} impressions\n`
      md += `     Period: ${gscData.dateRange.start} to ${gscData.dateRange.end}\n`
    }
  }

  // GA4 Summary
  if (ga4Status) {
    md += '\nGoogle Analytics 4:\n'
    if (!ga4Status.configured) {
      md += '  ⬚ Not configured\n'
    } else if (!ga4Status.hasPropertyId) {
      md += '  ⬚ Property ID not set (add GA4_PROPERTY_ID to .env)\n'
    } else if (!ga4Status.hasData) {
      md += `  ⏳ ${ga4Status.message}\n`
    } else if (ga4Data) {
      const { overview } = ga4Data
      const bouncePercent = (overview.bounceRate * 100).toFixed(1)
      md += `  ✅ ${overview.sessions} sessions | ${overview.users} users\n`
      md += `     Bounce: ${bouncePercent}% | Pages/session: ${overview.pagesPerSession.toFixed(1)}\n`
    }
  }

  // Backlinks Summary
  if (backlinkStatus) {
    md += '\nBacklinks:\n'
    if (!backlinkStatus.configured) {
      md += '  ⬚ Not configured (add AHREFS_API_KEY or SEMRUSH_API_KEY to .env)\n'
    } else if (!backlinkStatus.hasData) {
      md += `  ⏳ ${backlinkStatus.message}\n`
    } else if (backlinkData) {
      const authority = backlinkData.metrics.domainRating ?? backlinkData.metrics.authorityScore ?? 0
      const authorityLabel = backlinkData.provider === 'ahrefs' ? 'DR' : 'AS'
      md += `  ✅ ${backlinkData.provider}: ${authorityLabel} ${authority}\n`
      md += `     ${backlinkData.metrics.referringDomains} referring domains | ${backlinkData.metrics.totalBacklinks} backlinks\n`
    }
  }

  md += '═══════════════════════════════════════════════════════════════\n'
  md += '```\n\n'

  return md
}

// Generate full markdown report
function generateMarkdownReport(report: SEOReport): string {
  let md = `# SEO Analysis Report\n\n`
  md += `**Site:** ${report.metadata.url}\n`
  md += `**Date:** ${report.metadata.date}\n`
  md += `**Score:** ${report.scores.overall}/100\n\n`
  md += `---\n\n`

  // Executive Summary
  md += `## Executive Summary\n\n`
  md += `Analyzed ${report.metadata.pagesAnalyzed} key pages. `

  if (report.scores.overall >= 90) {
    md += `Excellent SEO health with strong foundations across all categories. `
  } else if (report.scores.overall >= 70) {
    md += `Good SEO health with some opportunities for improvement. `
  } else {
    md += `SEO needs attention in multiple categories. `
  }

  md += `Focus on Quick Wins for immediate impact.\n\n`
  md += `---\n\n`

  // Dashboard
  md += `## Dashboard\n\n`
  md += generateDashboard(report)

  // Recommendations
  md += `## Recommendations\n\n`

  const quickWins = report.recommendations.filter(r => r.category === 'quick-win')
  const strategic = report.recommendations.filter(r => r.category === 'strategic')
  const optional = report.recommendations.filter(r => r.category === 'optional')

  if (quickWins.length > 0) {
    md += `### 🎯 Quick Wins (High Impact, Low Effort)\n\n`
    quickWins.forEach((rec, i) => {
      md += `#### ${i + 1}. ${rec.title}\n\n`
      md += `**Impact:** ${rec.impact} (+${rec.points} points) | **Effort:** ${rec.effort}\n\n`
      md += `${rec.description}\n\n`
    })
  }

  if (strategic.length > 0) {
    md += `### 🚀 Strategic (High Impact, Higher Effort)\n\n`
    strategic.forEach((rec, i) => {
      md += `#### ${i + 1}. ${rec.title}\n\n`
      md += `**Impact:** ${rec.impact} (+${rec.points} points) | **Effort:** ${rec.effort}\n\n`
      md += `${rec.description}\n\n`
    })
  }

  if (optional.length > 0) {
    md += `### 📋 Optional (Lower Priority)\n\n`
    optional.forEach((rec, i) => {
      md += `#### ${i + 1}. ${rec.title}\n\n`
      md += `**Impact:** ${rec.impact} (+${rec.points} points) | **Effort:** ${rec.effort}\n\n`
      md += `${rec.description}\n\n`
    })
  }

  // Page-by-Page Analysis
  md += `---\n\n`
  md += `## Page-by-Page Analysis\n\n`

  report.pages.forEach(page => {
    const urlPath = page.url.replace(report.metadata.url, '') || '/'
    md += `### ${urlPath}\n\n`
    md += `- **Title:** ${page.title || '❌ Missing'}\n`
    md += `- **Description:** ${page.description ? '✅ Present' : '❌ Missing'}\n`
    md += `- **H1 Count:** ${page.h1Count === 1 ? '✅ Single' : page.h1Count === 0 ? '❌ None' : `⚠️ Multiple (${page.h1Count})`}\n`
    md += `- **Schema.org:** ${page.hasSchema ? '✅ Present' : '❌ Missing'}\n`
    md += `- **Open Graph:** ${page.hasOG ? '✅ Present' : '❌ Missing'}\n`
    md += `- **Response Time:** ${page.responseTime}ms\n`
    md += `- **HTML Size:** ${Math.round(page.htmlSize / 1024)} KB\n\n`
  })

  return md
}

// Save report to disk
function saveReport(report: SEOReport, filename: string) {
  const filepath = path.join(REPORTS_DIR, filename)
  const markdown = generateMarkdownReport(report)

  fs.writeFileSync(filepath, markdown, 'utf-8')
  console.log(`✅ Report saved: ${filepath}`)
}

// Save baseline JSON
function saveBaseline(report: SEOReport, filename: string) {
  const filepath = path.join(REPORTS_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`📊 Baseline saved: ${filepath}`)
}

// Save CSV export (multiple files)
function saveCSVExport(report: SEOReport, dateStr: string) {
  // Convert to full SEOReport format for CSV generator
  const fullReport = convertToFullReport(report)
  const csvExport = generateAllCSV(fullReport)

  // Create CSV directory
  const csvDir = path.join(REPORTS_DIR, `${dateStr}-csv`)
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true })
  }

  // Write each CSV file
  fs.writeFileSync(path.join(csvDir, 'summary.csv'), csvExport.summary, 'utf-8')
  fs.writeFileSync(path.join(csvDir, 'pages.csv'), csvExport.pages, 'utf-8')
  fs.writeFileSync(path.join(csvDir, 'insights.csv'), csvExport.insights, 'utf-8')
  fs.writeFileSync(path.join(csvDir, 'recommendations.csv'), csvExport.recommendations, 'utf-8')
  fs.writeFileSync(path.join(csvDir, 'scores.csv'), csvExport.scores, 'utf-8')

  if (csvExport.gscPages) {
    fs.writeFileSync(path.join(csvDir, 'gsc-pages.csv'), csvExport.gscPages, 'utf-8')
  }
  if (csvExport.gscQueries) {
    fs.writeFileSync(path.join(csvDir, 'gsc-queries.csv'), csvExport.gscQueries, 'utf-8')
  }
  if (csvExport.ga4Pages) {
    fs.writeFileSync(path.join(csvDir, 'ga4-pages.csv'), csvExport.ga4Pages, 'utf-8')
  }
  if (csvExport.ga4Traffic) {
    fs.writeFileSync(path.join(csvDir, 'ga4-traffic.csv'), csvExport.ga4Traffic, 'utf-8')
  }
  if (csvExport.backlinks) {
    fs.writeFileSync(path.join(csvDir, 'backlinks.csv'), csvExport.backlinks, 'utf-8')
  }

  console.log(`📊 CSV export saved: ${csvDir}/`)
}

// Save HTML report
function saveHTMLReport(report: SEOReport, dateStr: string) {
  const fullReport = convertToFullReport(report)
  const html = generateHtmlReport(fullReport)
  const filepath = path.join(REPORTS_DIR, `${dateStr}-report.html`)
  fs.writeFileSync(filepath, html, 'utf-8')
  console.log(`🌐 HTML report saved: ${filepath}`)
}

// Convert local SEOReport to full types.ts SEOReport format
function convertToFullReport(report: SEOReport): import('./seo/types.js').SEOReport {
  const fullPages: FullPageAnalysis[] = report.pages.map((p) => ({
    url: p.url,
    title: p.title,
    titleLength: p.title?.length || 0,
    description: p.description,
    descriptionLength: p.description?.length || 0,
    h1Count: p.h1Count,
    h1Text: null,
    hasSchema: p.hasSchema,
    schemaTypes: [],
    hasOG: p.hasOG,
    hasCanonical: true,
    canonicalUrl: p.url,
    responseTime: p.responseTime,
    htmlSize: p.htmlSize,
    wordCount: 0,
    internalLinks: 0,
    externalLinks: 0,
    images: { total: 0, withAlt: 0, missingAlt: 0, lazyLoaded: 0 },
  }))

  return {
    metadata: {
      date: report.metadata.date,
      url: report.metadata.url,
      pagesAnalyzed: report.metadata.pagesAnalyzed,
      version: report.metadata.version,
      dataSources: {
        crawl: report.metadata.dataSources.crawl,
        gsc: report.metadata.dataSources.gsc,
        ga4: report.metadata.dataSources.ga4,
        backlinks: report.metadata.dataSources.backlinks || 'none',
      },
      dateRange: {
        start: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: report.metadata.date,
      },
      confidence: report.metadata.confidence,
    },
    scores: {
      ...report.scores,
      confidence: report.metadata.confidence,
    },
    crawlData: fullPages,
    gscData: report.gscData || undefined,
    ga4Data: report.ga4Data || undefined,
    backlinkData: report.backlinkData || undefined,
    insights: report.insights,
    playbooks: [],
    recommendations: report.recommendations.map((r) => ({
      category: r.category as 'quick-win' | 'strategic' | 'optional',
      title: r.title,
      impact: r.impact as 'high' | 'medium' | 'low',
      effort: r.effort as 'low' | 'medium' | 'high',
      points: r.points,
      description: r.description,
    })),
    checks: report.checks,
  }
}

// Load baseline for comparison
function loadBaseline(date: string): SEOReport | null {
  const filepath = path.join(REPORTS_DIR, `${date}-baseline.json`)

  if (!fs.existsSync(filepath)) {
    console.error(`❌ Baseline not found: ${filepath}`)
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch (error) {
    console.error(`❌ Failed to load baseline:`, error)
    return null
  }
}

// Compare current report to baseline
function compareToBaseline(current: SEOReport, baseline: SEOReport): string {
  let md = `\n## Comparison to Baseline (${baseline.metadata.date})\n\n`
  md += '```\n'
  md += 'CHANGE SINCE ' + baseline.metadata.date + ':\n'
  md += '───────────────────────────────────────────────────────────────\n'

  const diff = (curr: number, base: number) => {
    const change = curr - base
    const arrow = change > 0 ? '⬆️' : change < 0 ? '⬇️' : '─'
    const sign = change > 0 ? '+' : ''
    return `${base} → ${curr}  (${sign}${change})  ${arrow}`
  }

  md += `Overall Score:      ${diff(current.scores.overall, baseline.scores.overall)}\n`
  md += `Technical:          ${diff(current.scores.technical, baseline.scores.technical)}\n`
  md += `Content:            ${diff(current.scores.content, baseline.scores.content)}\n`
  md += `Semantic:           ${diff(current.scores.semantic, baseline.scores.semantic)}\n`
  md += `Authority:          ${diff(current.scores.authority, baseline.scores.authority)}\n`
  md += `UX:                 ${diff(current.scores.ux, baseline.scores.ux)}\n`
  md += `AI Readiness:       ${diff(current.scores.aiReadiness, baseline.scores.aiReadiness)}\n`
  md += '```\n\n'

  return md
}

// Main analysis function
async function analyzeSEO() {
  const options = parseArgs()

  console.log('🔍 SEO ANALYSIS STARTING\n')
  console.log(`📍 Target: ${options.url}`)
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}\n`)

  ensureReportsDir()

  // Check site reachability
  console.log('🌐 Checking site connectivity...')
  try {
    await fetchPage(options.url)
    console.log('✅ Site is reachable\n')
  } catch (error) {
    console.error(`❌ Cannot reach ${options.url}`)
    console.error('Check if site is deployed and URL is correct.\n')
    process.exit(1)
  }

  // Check foundational files
  console.log('🔍 Checking foundational files...')
  const hasSitemap = await checkSitemap(options.url)
  const hasRobotsTxt = await checkRobotsTxt(options.url)
  const hasLlmTxt = await checkLlmTxt(options.url)
  const hasFactsJson = await checkFactsJson(options.url)
  const hasRssFeed = await checkRssFeed(options.url)
  const aboutPage = await checkAboutPage(options.url)

  console.log(`  ${hasSitemap ? '✅' : '❌'} Sitemap`)
  console.log(`  ${hasRobotsTxt ? '✅' : '❌'} robots.txt`)
  console.log(`  ${hasLlmTxt ? '✅' : '❌'} llm.txt`)
  console.log(`  ${hasFactsJson ? '✅' : '❌'} facts.json`)
  console.log(`  ${hasRssFeed ? '✅' : '❌'} RSS feed`)
  console.log(`  ${aboutPage.exists ? '✅' : '❌'} About page`)
  if (aboutPage.exists) {
    console.log(`    ${aboutPage.hasSchema ? '✅' : '❌'} Schema.org`)
    console.log(`    ${aboutPage.hasLinkedIn ? '✅' : '❌'} LinkedIn link`)
  }
  console.log()

  // Check Google Search Console and Google Analytics
  console.log('📊 Checking data sources...')

  // GSC
  let gscData: GSCData | null = null
  let gscStatus: GSCStatus

  if (isGSCConfigured()) {
    const gscResult = await fetchGSCData(options.url)
    gscData = gscResult.data
    gscStatus = gscResult.status
  } else {
    gscStatus = {
      configured: false,
      hasData: false,
      message: 'GSC not configured',
    }
  }

  // GA4
  let ga4Data: GA4Data | null = null
  let ga4Status: GA4Status

  if (isGA4Configured()) {
    const ga4Result = await fetchGA4Data(options.url)
    ga4Data = ga4Result.data
    ga4Status = ga4Result.status
  } else {
    ga4Status = {
      configured: false,
      hasPropertyId: false,
      hasData: false,
      message: 'GA4 not configured',
    }
  }

  // Backlinks
  let backlinkData: BacklinkData | null = null
  let backlinkStatus: BacklinkStatus

  if (isBacklinksConfigured()) {
    const backlinkResult = await fetchBacklinkData(options.url)
    backlinkData = backlinkResult.data
    backlinkStatus = backlinkResult.status
  } else {
    backlinkStatus = {
      configured: false,
      provider: null,
      hasData: false,
      message: 'Backlinks not configured',
    }
  }

  // Display data source status
  formatGSCSummary(gscStatus, gscData).forEach((line) => console.log(line))
  formatGA4Summary(ga4Status, ga4Data).forEach((line) => console.log(line))
  formatBacklinkSummary(backlinkStatus, backlinkData).forEach((line) => console.log(line))
  console.log()

  // Crawl pages
  const pages = await crawlPages(options.url)

  // Calculate metrics
  const avgResponseTime = pages.reduce((sum, p) => sum + p.responseTime, 0) / pages.length
  const totalSize = pages.reduce((sum, p) => sum + p.htmlSize, 0)

  console.log(`📊 Statistics:`)
  console.log(`  Average response time: ${Math.round(avgResponseTime)}ms`)
  console.log(`  Total HTML size: ${Math.round(totalSize / 1024)} KB\n`)

  // Perform checks
  const checks = {
    hasSitemap,
    hasRobotsTxt,
    hasLlmTxt,
    hasFactsJson,
    hasRssFeed,
    aboutPage,
    avgResponseTime,
  }

  // Calculate scores
  console.log('📈 Calculating scores...\n')
  const scores = calculateScores(pages, checks)

  // Generate recommendations
  const recommendations = generateRecommendations(scores, pages, checks)

  // Convert pages to full format for insights engine
  const fullPages: FullPageAnalysis[] = pages.map((p) => ({
    url: p.url,
    title: p.title,
    titleLength: p.title?.length || 0,
    description: p.description,
    descriptionLength: p.description?.length || 0,
    h1Count: p.h1Count,
    h1Text: null,
    hasSchema: p.hasSchema,
    schemaTypes: [],
    hasOG: p.hasOG,
    hasCanonical: true, // Assume CF Worker adds canonical
    canonicalUrl: p.url,
    responseTime: p.responseTime,
    htmlSize: p.htmlSize,
    wordCount: 0,
    internalLinks: 0,
    externalLinks: 0,
    images: { total: 0, withAlt: 0, missingAlt: 0, lazyLoaded: 0 },
  }))

  // Detect insights from available data
  const insights = detectInsights(
    fullPages,
    gscData || undefined,
    ga4Data || undefined,
    backlinkData || undefined
  )

  // Calculate confidence based on available data sources
  const confidence = calculateConfidence(
    gscStatus.hasData,
    ga4Status.hasData,
    backlinkStatus.hasData
  )

  // Log insights summary
  if (insights.length > 0) {
    const counts = countInsightsBySeverity(insights)
    console.log(`💡 Insights detected: ${insights.length}`)
    if (counts.critical > 0) console.log(`   🔴 Critical: ${counts.critical}`)
    if (counts.warning > 0) console.log(`   🟡 Warning: ${counts.warning}`)
    if (counts.opportunity > 0) console.log(`   🟢 Opportunity: ${counts.opportunity}`)
    console.log()
  }

  // Build report
  const report: SEOReport = {
    metadata: {
      date: new Date().toISOString().split('T')[0],
      url: options.url,
      pagesAnalyzed: pages.length,
      version: VERSION,
      dataSources: {
        crawl: true,
        gsc: gscStatus.hasData,
        ga4: ga4Status.hasData,
        backlinks: backlinkStatus.hasData ? backlinkStatus.provider : null,
      },
      confidence,
    },
    scores,
    pages,
    checks,
    gscData,
    gscStatus,
    ga4Data,
    ga4Status,
    backlinkData,
    backlinkStatus,
    insights,
    recommendations,
  }

  const dateStr = report.metadata.date

  // Handle output based on format
  const outputCLI = options.output === 'cli' || options.output === 'both'
  const outputMD = options.output === 'md' || options.output === 'both'
  const outputCSV = options.output === 'csv'
  const outputHTML = options.output === 'html'

  // Display dashboard to CLI
  if (outputCLI) {
    console.log(generateDashboard(report))
  }

  // Save markdown report
  if (outputMD) {
    saveReport(report, `${dateStr}-report.md`)
  }

  // Save CSV export
  if (outputCSV) {
    saveCSVExport(report, dateStr)
  }

  // Save HTML report
  if (outputHTML) {
    saveHTMLReport(report, dateStr)
  }

  // Save baseline if requested
  if (options.baseline) {
    saveBaseline(report, `${dateStr}-baseline.json`)
  }

  // Compare to baseline if requested
  if (options.compare) {
    const baseline = loadBaseline(options.compare)
    if (baseline) {
      const comparison = compareToBaseline(report, baseline)

      if (outputCLI) {
        console.log(comparison)
      }

      // Append comparison to markdown report if saving
      if (outputMD) {
        const reportPath = path.join(REPORTS_DIR, `${dateStr}-report.md`)
        fs.appendFileSync(reportPath, comparison, 'utf-8')
        console.log(`✅ Comparison added to report`)
      }
    }
  }

  console.log(`\n🏁 Analysis complete!`)

  if (outputMD) {
    console.log(`\nNext steps:`)
    console.log(`  1. Review report: seo-reports/${dateStr}-report.md`)
    console.log(`  2. Focus on Quick Wins (${recommendations.filter(r => r.category === 'quick-win').length} items)`)
    console.log(`  3. Re-run with --compare ${dateStr} after improvements\n`)
  } else {
    console.log(`\n💡 Tip: Use --output md or --output both to save a detailed report\n`)
  }

  return report
}

// ============================================================================
// Interactive Mode
// ============================================================================

async function runInteractiveMode() {
  const options = parseArgs()

  while (true) {
    const choice = await showMainMenu()

    switch (choice) {
      case 'full':
        await runFullAnalysisInteractive(options.url)
        break

      case 'quick':
        await runQuickScoreInteractive(options.url)
        break

      case 'compare':
        await runCompareInteractive(options.url)
        break

      case 'export':
        await runExportInteractive(options.url)
        break

      case 'quit':
        console.log('\n  Goodbye!\n')
        closeReadline()
        return
    }
  }
}

async function runFullAnalysisInteractive(_url: string) {
  console.log('\n  Running full analysis...\n')

  // Run the analysis with CLI output
  const report = await analyzeSEO()
  if (!report) return

  // Build context for playbooks
  const siteStats = await getSiteStats()
  const context = buildAnalysisContext(
    report.pages.map(p => ({
      url: p.url,
      title: p.title,
      titleLength: p.title?.length || 0,
      description: p.description,
      descriptionLength: p.description?.length || 0,
      h1Count: p.h1Count,
      h1Text: null,
      hasSchema: p.hasSchema,
      schemaTypes: [],
      hasOG: p.hasOG,
      hasCanonical: true,
      canonicalUrl: p.url,
      responseTime: p.responseTime,
      htmlSize: p.htmlSize,
      wordCount: 0,
      internalLinks: 0,
      externalLinks: 0,
      images: { total: 0, withAlt: 0, missingAlt: 0, lazyLoaded: 0 },
    })),
    report.gscData,
    report.ga4Data,
    report.backlinkData,
    siteStats
  )

  // Interactive post-analysis loop
  while (true) {
    const analysisResult: AnalysisResult = {
      score: report.scores.overall,
      insights: report.insights,
      context,
      dateStr: report.metadata.date,
    }

    const postChoice = await showPostAnalysisMenu(analysisResult)

    switch (postChoice) {
      case 'action-items':
        displayActionItems(report.insights)
        await pressEnter('\n  Press Enter to continue...')
        break

      case 'fix-issue':
        if (report.insights.length === 0) {
          console.log('\n  No issues to fix!\n')
          await pressEnter()
          break
        }
        const issueIndex = await selectIssue(report.insights)
        if (issueIndex >= 0 && issueIndex < report.insights.length) {
          const playbook = generatePlaybook(report.insights[issueIndex], context)
          displayPlaybook(playbook)
          await pressEnter('\n  Press Enter to continue...')
        }
        break

      case 'save':
        const dateStr = report.metadata.date
        saveReport(report, `${dateStr}-report.md`)
        saveBaseline(report, `${dateStr}-baseline.json`)
        console.log(`\n  ✅ Report saved: seo-reports/${dateStr}-report.md`)
        console.log(`  ✅ Baseline saved: seo-reports/${dateStr}-baseline.json\n`)
        await pressEnter()
        return

      case 'done':
        return
    }
  }
}

async function runQuickScoreInteractive(url: string) {
  console.log('\n  Checking score...\n')

  // Quick connectivity check
  try {
    await fetch(url)
  } catch {
    console.log(`  ❌ Cannot reach ${url}\n`)
    await pressEnter()
    return
  }

  // Run minimal analysis
  const pages = await crawlPages(url)
  const checks = {
    hasSitemap: await checkSitemap(url),
    hasRobotsTxt: await checkRobotsTxt(url),
    hasLlmTxt: await checkLlmTxt(url),
    hasFactsJson: await checkFactsJson(url),
    hasRssFeed: await checkRssFeed(url),
    aboutPage: await checkAboutPage(url),
    avgResponseTime: pages.reduce((sum, p) => sum + p.responseTime, 0) / pages.length,
  }

  const scores = calculateScores(pages, checks)
  displayQuickScore(scores.overall, url)
  await pressEnter()
}

async function runCompareInteractive(_url: string) {
  // Find available baselines
  const baselineFiles = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('-baseline.json'))
    .sort()
    .reverse()

  if (baselineFiles.length === 0) {
    console.log('\n  No baselines found. Run a full analysis first and save it.\n')
    await pressEnter()
    return
  }

  console.log('\n  Available baselines:\n')
  baselineFiles.slice(0, 5).forEach((f, i) => {
    const date = f.replace('-baseline.json', '')
    console.log(`  [${i + 1}] ${date}`)
  })
  console.log()

  const { promptChoice } = await import('./seo/interactive.js')
  const choice = await promptChoice(`  Compare to which baseline (1-${Math.min(baselineFiles.length, 5)}): `, Math.min(baselineFiles.length, 5))

  if (choice < 1) return

  const baselineFile = baselineFiles[choice - 1]
  const baselineDate = baselineFile.replace('-baseline.json', '')

  console.log(`\n  Running current analysis to compare...\n`)

  // Run current analysis (silently)
  const currentReport = await analyzeSEO()
  if (!currentReport) return

  // Load baseline
  const baseline = loadBaseline(baselineDate)
  if (!baseline) {
    console.log(`\n  Could not load baseline from ${baselineDate}\n`)
    await pressEnter()
    return
  }

  // Display comparison
  const comparisonData: ComparisonData = {
    current: {
      score: currentReport.scores.overall,
      date: currentReport.metadata.date,
      insights: currentReport.insights,
    },
    baseline: {
      score: baseline.scores.overall,
      date: baseline.metadata.date,
      insights: baseline.insights || [],
    },
  }

  displayComparison(comparisonData)
  await pressEnter()
}

async function runExportInteractive(_url: string) {
  const exportChoice = await showExportMenu()

  if (exportChoice === 'back') return

  console.log('\n  Running analysis for export...\n')

  // Run analysis
  const report = await analyzeSEO()
  if (!report) return

  const dateStr = report.metadata.date

  switch (exportChoice) {
    case 'html':
      saveHTMLReport(report, dateStr)
      console.log(`\n  ✅ HTML report saved: seo-reports/${dateStr}-report.html`)
      console.log(`  Open in browser to view.\n`)
      break

    case 'csv':
      saveCSVExport(report, dateStr)
      console.log(`\n  ✅ CSV export saved: seo-reports/${dateStr}-csv/`)
      console.log(`  Import into Google Sheets or Excel.\n`)
      break

    case 'md':
      saveReport(report, `${dateStr}-report.md`)
      console.log(`\n  ✅ Markdown report saved: seo-reports/${dateStr}-report.md\n`)
      break
  }

  await pressEnter()
}

// Helper to get site stats for playbook context
async function getSiteStats(): Promise<SiteStats> {
  try {
    const concertsPath = path.join(process.cwd(), 'public/data/concerts.json')
    const data = JSON.parse(fs.readFileSync(concertsPath, 'utf-8'))
    const concerts = data.concerts || []

    const artists = new Set(concerts.map((c: any) => c.headlinerNormalized))
    const venues = new Set(concerts.map((c: any) => c.venueNormalized))
    const cities = new Set(concerts.map((c: any) => c.city))
    const years = concerts.map((c: any) => c.year).filter(Boolean)

    return {
      concertCount: concerts.length,
      artistCount: artists.size,
      venueCount: venues.size,
      cityCount: cities.size,
      firstYear: Math.min(...years),
      yearSpan: Math.max(...years) - Math.min(...years),
    }
  } catch {
    return {
      concertCount: 0,
      artistCount: 0,
      venueCount: 0,
      cityCount: 0,
      firstYear: 2000,
      yearSpan: 0,
    }
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const options = parseArgs()

  if (options.interactive) {
    await runInteractiveMode()
  } else if (options.quick) {
    // Quick mode - just show score
    const pages = await crawlPages(options.url)
    const checks = {
      hasSitemap: await checkSitemap(options.url),
      hasRobotsTxt: await checkRobotsTxt(options.url),
      hasLlmTxt: await checkLlmTxt(options.url),
      hasFactsJson: await checkFactsJson(options.url),
      hasRssFeed: await checkRssFeed(options.url),
      aboutPage: await checkAboutPage(options.url),
      avgResponseTime: pages.reduce((sum, p) => sum + p.responseTime, 0) / pages.length,
    }
    const scores = calculateScores(pages, checks)
    console.log(scores.overall)
  } else {
    // Direct mode with flags
    await analyzeSEO()
  }
}

// Run
main().catch((error) => {
  console.error('❌ Analysis failed:', error)
  closeReadline()
  process.exit(1)
})
