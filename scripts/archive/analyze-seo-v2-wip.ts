#!/usr/bin/env tsx
/**
 * SEO Tool v2 - Integrated Analytics & Backlink Support
 *
 * Comprehensive SEO analysis with data from:
 * - Page crawling (HTML structure, meta tags, performance)
 * - Google Search Console (search performance, index coverage)
 * - Google Analytics 4 (engagement metrics, Core Web Vitals)
 * - Backlink APIs (Ahrefs/SEMrush, optional)
 *
 * Usage:
 *   npm run seo                      # Standard analysis
 *   npm run seo -- --baseline        # Save baseline
 *   npm run seo -- --compare DATE    # Compare to baseline
 *   npm run seo -- --setup           # Configure credentials
 *   npm run seo -- --quick           # Crawl-only mode
 *   npm run seo -- --full            # All data sources
 *
 * See: docs/specs/future/global-seo-tool-v2.md
 */

import fs from 'fs'
import path from 'path'

import {
  // Types
  type SEOAnalysisConfig,
  type SEOReport,
  type PageAnalysis,
  type SEOScore,
  type Recommendation,
  type AnalysisContext,
  type OutputFormat,

  // Setup
  runSetupWizard,
  checkSetupStatus,
  promptSetupIfNeeded,
  printCredentialSummary,

  // Cache
  clearAllCache,
  clearTypeCache,
  printCacheSummary,

  // Clients
  fetchGSCData,
  fetchGA4Data,
  fetchBacklinkData,
  isGSCConfigured,
  isGA4Configured,
  isBacklinkConfigured,
  calculateAverageCTR,

  // Insights
  detectInsights,
  calculateConfidence,
  countInsightsBySeverity,

  // Playbooks
  generatePlaybooks,

  // Output Formats
  generateHtmlReport,
  generateAllCSV,
  exportToGoogleSheets,
} from './seo/index.js'

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_URL = 'https://concerts.morperhaus.org'
const REPORTS_DIR = path.join(process.cwd(), 'seo-reports')
const VERSION = '2.0.0'

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CLIOptions {
  url: string
  baseline: boolean
  compare?: string
  output: OutputFormat[]
  days: number
  setup: boolean
  quick: boolean
  full: boolean
  cacheRefresh: boolean
  clearCache: boolean
  clearCacheType?: 'gsc' | 'ga4' | 'backlinks' | 'crawl'
  noGSC: boolean
  noGA4: boolean
  noBacklinks: boolean
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2)

  const getArg = (flag: string): string | undefined => {
    const index = args.indexOf(flag)
    return index !== -1 && args[index + 1] ? args[index + 1] : undefined
  }

  const hasFlag = (flag: string): boolean => args.includes(flag)

  // Parse output formats
  const outputArg = getArg('--output')
  let output: OutputFormat[] = ['cli', 'md']
  if (outputArg) {
    output = outputArg.split(',').filter((f): f is OutputFormat =>
      ['cli', 'md', 'html', 'json', 'csv', 'sheets'].includes(f)
    )
  }

  return {
    url: getArg('--url') || DEFAULT_URL,
    baseline: hasFlag('--baseline'),
    compare: getArg('--compare'),
    output,
    days: parseInt(getArg('--days') || '28', 10),
    setup: hasFlag('--setup'),
    quick: hasFlag('--quick'),
    full: hasFlag('--full'),
    cacheRefresh: hasFlag('--cache-refresh'),
    clearCache: hasFlag('--cache-clear'),
    clearCacheType: getArg('--cache-clear') as CLIOptions['clearCacheType'],
    noGSC: hasFlag('--no-gsc'),
    noGA4: hasFlag('--no-ga4'),
    noBacklinks: hasFlag('--no-backlinks'),
  }
}

// ============================================================================
// Page Crawler (Enhanced)
// ============================================================================

async function fetchPage(
  url: string
): Promise<{ html: string; responseTime: number }> {
  const startTime = Date.now()

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()
  const responseTime = Date.now() - startTime

  return { html, responseTime }
}

function analyzePage(url: string, html: string, responseTime: number): PageAnalysis {
  // Title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : null

  // Description
  const descMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
  )
  const description = descMatch ? descMatch[1].trim() : null

  // H1
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is)
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null
  const h1Matches = html.match(/<h1[^>]*>/gi)
  const h1Count = h1Matches ? h1Matches.length : 0

  // Schema.org
  const schemaMatches = html.match(/application\/ld\+json/gi)
  const hasSchema = !!schemaMatches
  const schemaTypes: string[] = []
  if (hasSchema) {
    const schemaBlocks = html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
    for (const match of schemaBlocks) {
      try {
        const schema = JSON.parse(match[1])
        if (schema['@type']) {
          schemaTypes.push(schema['@type'])
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Open Graph
  const hasOG = html.includes('og:title')

  // Canonical
  const canonicalMatch = html.match(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
  )
  const hasCanonical = !!canonicalMatch
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null

  // Word count (rough estimate from visible text)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const wordCount = textContent.split(' ').length

  // Links
  const internalLinkMatches = html.match(/href=["'][^"']*[?&]scene=/gi)
  const externalLinkMatches = html.match(/href=["']https?:\/\/(?!concerts\.morperhaus)/gi)
  const internalLinks = internalLinkMatches ? internalLinkMatches.length : 0
  const externalLinks = externalLinkMatches ? externalLinkMatches.length : 0

  // Images
  const imgMatches = html.matchAll(/<img[^>]*>/gi)
  let totalImages = 0
  let imagesWithAlt = 0
  let lazyLoadedImages = 0

  for (const match of imgMatches) {
    totalImages++
    if (match[0].includes('alt=') && !match[0].includes('alt=""')) {
      imagesWithAlt++
    }
    if (match[0].includes('loading="lazy"') || match[0].includes('data-src')) {
      lazyLoadedImages++
    }
  }

  return {
    url,
    title,
    titleLength: title?.length || 0,
    description,
    descriptionLength: description?.length || 0,
    h1Count,
    h1Text,
    hasSchema,
    schemaTypes,
    hasOG,
    hasCanonical,
    canonicalUrl,
    responseTime,
    htmlSize: Buffer.byteLength(html, 'utf8'),
    wordCount,
    internalLinks,
    externalLinks,
    images: {
      total: totalImages,
      withAlt: imagesWithAlt,
      missingAlt: totalImages - imagesWithAlt,
      lazyLoaded: lazyLoadedImages,
    },
  }
}

function getKeyPages(baseUrl: string): string[] {
  return [
    `${baseUrl}/`,
    `${baseUrl}/?scene=timeline`,
    `${baseUrl}/?scene=venues`,
    `${baseUrl}/?scene=geography`,
    `${baseUrl}/?scene=genres`,
    `${baseUrl}/?scene=artists`,
    `${baseUrl}/?scene=artists&artist=depeche-mode`,
    `${baseUrl}/?scene=artists&artist=nine-inch-nails`,
    `${baseUrl}/?scene=venues&venue=hollywood-bowl`,
    `${baseUrl}/?scene=venues&venue=forum`,
    `${baseUrl}/?scene=genres&genre=industrial`,
    `${baseUrl}/?scene=geography&region=losangeles`,
  ]
}

async function crawlPages(baseUrl: string): Promise<PageAnalysis[]> {
  const pages = getKeyPages(baseUrl)
  const analyses: PageAnalysis[] = []

  console.log(`\n📄 Crawling ${pages.length} pages...`)

  for (const url of pages) {
    try {
      const { html, responseTime } = await fetchPage(url)
      const analysis = analyzePage(url, html, responseTime)
      analyses.push(analysis)
      console.log(`  ✅ ${url.replace(baseUrl, '') || '/'} (${responseTime}ms)`)
    } catch (error) {
      console.error(`  ❌ ${url.replace(baseUrl, '') || '/'} failed`)
    }
  }

  console.log(`\n✅ ${analyses.length}/${pages.length} pages crawled\n`)

  return analyses
}

// ============================================================================
// Scoring System
// ============================================================================

function calculateScores(
  crawlData: PageAnalysis[],
  gscData?: Awaited<ReturnType<typeof fetchGSCData>>,
  ga4Data?: Awaited<ReturnType<typeof fetchGA4Data>>,
  backlinkData?: Awaited<ReturnType<typeof fetchBacklinkData>>
): SEOScore {
  let technical = 0
  let content = 0
  let semantic = 0
  let authority = 0
  let ux = 0
  let aiReadiness = 0

  // Technical Foundation (25 pts)
  // Crawlability
  const avgResponseTime =
    crawlData.reduce((sum, p) => sum + p.responseTime, 0) / crawlData.length
  if (avgResponseTime < 200) technical += 2
  else if (avgResponseTime < 500) technical += 1

  // Canonical tags
  const hasCanonical = crawlData.filter((p) => p.hasCanonical).length
  technical += Math.min(Math.floor((hasCanonical / crawlData.length) * 3), 3)

  // Schema.org
  const hasSchema = crawlData.filter((p) => p.hasSchema).length
  technical += Math.min(Math.floor((hasSchema / crawlData.length) * 3), 3)

  // Open Graph
  const hasOG = crawlData.filter((p) => p.hasOG).length
  technical += Math.min(Math.floor((hasOG / crawlData.length) * 2), 2)

  // Images with lazy loading
  const avgLazyRatio =
    crawlData.reduce((sum, p) => {
      if (p.images.total === 0) return sum
      return sum + p.images.lazyLoaded / p.images.total
    }, 0) / crawlData.length
  if (avgLazyRatio > 0.8) technical += 2
  else if (avgLazyRatio > 0.5) technical += 1

  // Add points from real GSC data
  if (gscData) {
    // Index coverage
    const indexedPages = gscData.pages.length
    if (indexedPages >= crawlData.length) technical += 3
    else if (indexedPages >= crawlData.length * 0.7) technical += 2
    else technical += 1

    // Real performance from Core Web Vitals
    if (ga4Data?.coreWebVitals) {
      const cwv = ga4Data.coreWebVitals
      if (cwv.lcp.rating === 'good') technical += 2
      if (cwv.cls.rating === 'good') technical += 2
      if (cwv.inp.rating === 'good') technical += 2
    } else {
      // Estimate based on response time
      technical += avgResponseTime < 200 ? 4 : avgResponseTime < 500 ? 2 : 0
    }
  } else {
    technical += 8 // Estimated score without GSC
  }

  technical = Math.min(technical, 25)

  // Content Quality (30 pts)
  // Titles
  const uniqueTitles = new Set(crawlData.map((p) => p.title)).size
  if (uniqueTitles === crawlData.length) content += 3

  // Optimal title length (50-60 chars)
  const goodTitleLength = crawlData.filter(
    (p) => p.titleLength >= 50 && p.titleLength <= 60
  ).length
  content += Math.min(Math.floor((goodTitleLength / crawlData.length) * 3), 3)

  // Descriptions
  const hasDescription = crawlData.filter((p) => p.description).length
  content += Math.min(Math.floor((hasDescription / crawlData.length) * 3), 3)

  // H1 structure
  const properH1 = crawlData.filter((p) => p.h1Count === 1).length
  content += Math.min(Math.floor((properH1 / crawlData.length) * 3), 3)

  // Internal linking
  const avgInternalLinks =
    crawlData.reduce((sum, p) => sum + p.internalLinks, 0) / crawlData.length
  if (avgInternalLinks >= 5) content += 2
  else if (avgInternalLinks >= 2) content += 1

  // Content with real CTR data
  if (gscData) {
    const avgCTR = calculateAverageCTR(gscData.pages)
    if (avgCTR > 0.05) content += 5
    else if (avgCTR > 0.03) content += 3
    else content += 1
  } else {
    content += 8 // Estimated
  }

  // Engagement from GA4
  if (ga4Data) {
    if (ga4Data.overview.bounceRate < 0.4) content += 3
    else if (ga4Data.overview.bounceRate < 0.6) content += 2

    if (ga4Data.overview.avgSessionDuration > 120) content += 2
    else if (ga4Data.overview.avgSessionDuration > 60) content += 1
  } else {
    content += 5 // Estimated
  }

  content = Math.min(content, 30)

  // Semantic Intelligence (20 pts)
  // Word count (content depth)
  const avgWordCount =
    crawlData.reduce((sum, p) => sum + p.wordCount, 0) / crawlData.length
  if (avgWordCount > 1000) semantic += 3
  else if (avgWordCount > 500) semantic += 2
  else semantic += 1

  // Schema types variety
  const allSchemaTypes = new Set(crawlData.flatMap((p) => p.schemaTypes))
  semantic += Math.min(allSchemaTypes.size, 3)

  // Entity relationships (internal links)
  if (avgInternalLinks >= 5) semantic += 2

  // Estimate for topic depth
  semantic += 10

  semantic = Math.min(semantic, 20)

  // Authority & Trust (15 pts)
  if (backlinkData) {
    const dr = backlinkData.metrics.domainRating || backlinkData.metrics.authorityScore || 0
    if (dr >= 50) authority += 5
    else if (dr >= 30) authority += 3
    else authority += 1

    if (backlinkData.metrics.referringDomains >= 50) authority += 3
    else if (backlinkData.metrics.referringDomains >= 20) authority += 2
    else authority += 1

    // Link quality (follow vs nofollow)
    const followRatio =
      backlinkData.metrics.followLinks /
      (backlinkData.metrics.totalBacklinks || 1)
    if (followRatio > 0.7) authority += 2
  } else {
    authority += 8 // Estimated without backlink data
  }

  // Organic traffic percentage from GA4
  if (ga4Data) {
    const organicSessions = ga4Data.trafficSources
      .filter((s) => s.medium === 'organic')
      .reduce((sum, s) => sum + s.sessions, 0)
    const organicPct = organicSessions / ga4Data.overview.sessions
    if (organicPct > 0.5) authority += 3
    else if (organicPct > 0.3) authority += 2
  } else {
    authority += 2
  }

  authority = Math.min(authority, 15)

  // User Experience (10 pts)
  // Images with alt text
  const avgAltRatio =
    crawlData.reduce((sum, p) => {
      if (p.images.total === 0) return sum + 1
      return sum + p.images.withAlt / p.images.total
    }, 0) / crawlData.length
  if (avgAltRatio > 0.9) ux += 2

  // Mobile performance (from CWV)
  if (ga4Data?.coreWebVitals) {
    const cwv = ga4Data.coreWebVitals
    if (cwv.lcp.rating === 'good' && cwv.cls.rating === 'good') ux += 3
    else if (cwv.lcp.rating !== 'poor' && cwv.cls.rating !== 'poor') ux += 2
  } else {
    ux += 2
  }

  // Engagement metrics
  if (ga4Data) {
    if (ga4Data.overview.pagesPerSession > 3) ux += 2
    else if (ga4Data.overview.pagesPerSession > 2) ux += 1
  }

  ux += 3 // Base for responsive design (assumed)

  ux = Math.min(ux, 10)

  // AI Agent Readiness (10 pts bonus)
  // Schema.org presence
  if (hasSchema >= crawlData.length * 0.8) aiReadiness += 3
  else if (hasSchema >= crawlData.length * 0.5) aiReadiness += 2

  // Structured content
  if (avgWordCount > 500) aiReadiness += 2

  // Clear entity relationships
  if (avgInternalLinks >= 5) aiReadiness += 2

  // Citation-worthy (factual, verifiable)
  aiReadiness += 2

  aiReadiness = Math.min(aiReadiness, 10)

  // Calculate confidence based on data sources
  const confidence = calculateConfidence(!!gscData, !!ga4Data, !!backlinkData)

  return {
    overall: technical + content + semantic + authority + ux,
    technical,
    content,
    semantic,
    authority,
    ux,
    aiReadiness,
    confidence,
  }
}

// ============================================================================
// Report Generation
// ============================================================================

function generateRecommendations(
  scores: SEOScore,
  crawlData: PageAnalysis[],
  insights: ReturnType<typeof detectInsights>
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Convert insights to recommendations
  for (const insight of insights) {
    recommendations.push({
      category:
        insight.severity === 'opportunity'
          ? 'quick-win'
          : insight.estimatedImpact === 'high'
            ? 'strategic'
            : 'optional',
      insight,
      title: insight.title,
      impact: insight.estimatedImpact,
      effort: insight.estimatedImpact === 'high' ? 'medium' : 'low',
      points: insight.estimatedImpact === 'high' ? 5 : 2,
      description: insight.recommendation,
      affectedPages: insight.affectedPages,
    })
  }

  // Add crawl-based recommendations
  const noSchema = crawlData.filter((p) => !p.hasSchema)
  if (noSchema.length > 0) {
    recommendations.push({
      category: 'quick-win',
      title: 'Add Schema.org JSON-LD markup',
      impact: 'high',
      effort: 'low',
      points: 5,
      description: `${noSchema.length} pages missing structured data. Add Event/MusicEvent schema for rich snippets.`,
      affectedPages: noSchema.map((p) => p.url),
    })
  }

  const multipleH1s = crawlData.filter((p) => p.h1Count > 1)
  if (multipleH1s.length > 0) {
    recommendations.push({
      category: 'optional',
      title: 'Consolidate multiple H1 tags',
      impact: 'low',
      effort: 'low',
      points: 1,
      description: `${multipleH1s.length} pages have multiple H1s. Consolidate for cleaner heading hierarchy.`,
      affectedPages: multipleH1s.map((p) => p.url),
    })
  }

  const missingAlt = crawlData.filter((p) => p.images.missingAlt > 0)
  if (missingAlt.length > 0) {
    recommendations.push({
      category: 'optional',
      title: 'Add alt text to images',
      impact: 'low',
      effort: 'low',
      points: 1,
      description: `${missingAlt.length} pages have images without alt text. Add descriptive alt attributes for accessibility.`,
      affectedPages: missingAlt.map((p) => p.url),
    })
  }

  // Sort by category priority
  const categoryOrder = { 'quick-win': 0, strategic: 1, optional: 2 }
  return recommendations.sort(
    (a, b) => categoryOrder[a.category] - categoryOrder[b.category]
  )
}

function formatScore(score: number, max: number): string {
  const percentage = (score / max) * 100
  let emoji = '🔴'
  if (percentage >= 90) emoji = '🟢'
  else if (percentage >= 70) emoji = '🟡'
  else if (percentage >= 50) emoji = '🟠'
  return `${score}/${max} (${Math.round(percentage)}%) ${emoji}`
}

function progressBar(score: number, max: number, width: number = 10): string {
  const filled = Math.round((score / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function generateDashboard(report: SEOReport): string {
  const { scores, metadata } = report
  const insightCounts = countInsightsBySeverity(report.insights)

  let out = '```\n'
  out += '═══════════════════════════════════════════════════════════════════════\n'
  out += '                         SEO ANALYSIS DASHBOARD\n'
  out += '═══════════════════════════════════════════════════════════════════════\n'
  out += `Site: ${metadata.url}\n`
  out += `Date: ${metadata.date}\n`
  out += `Period: ${metadata.dateRange.start} to ${metadata.dateRange.end}\n`
  out += '═══════════════════════════════════════════════════════════════════════\n\n'

  out += `DATA SOURCES:          `
  out += `${metadata.dataSources.crawl ? '✅' : '⬚'} Crawl    `
  out += `${metadata.dataSources.gsc ? '✅' : '⬚'} GSC    `
  out += `${metadata.dataSources.ga4 ? '✅' : '⬚'} GA4    `
  out += `${metadata.dataSources.backlinks !== 'none' ? '✅' : '⬚'} Backlinks\n`
  out += `CONFIDENCE:            ${metadata.confidence}%\n\n`

  out += '═══════════════════════════════════════════════════════════════════════\n\n'

  out += `OVERALL SCORE: ${scores.overall}/100 ${scores.overall >= 90 ? '🟢' : scores.overall >= 70 ? '🟡' : '🔴'}\n\n`

  out += 'Category Breakdown:\n'
  out += '───────────────────────────────────────────────────────────────────────\n'
  out += `🔧 Technical Foundation        ${formatScore(scores.technical, 25).padEnd(20)} ${progressBar(scores.technical, 25)}\n`
  out += `📝 Content Quality             ${formatScore(scores.content, 30).padEnd(20)} ${progressBar(scores.content, 30)}\n`
  out += `🧠 Semantic Intelligence       ${formatScore(scores.semantic, 20).padEnd(20)} ${progressBar(scores.semantic, 20)}\n`
  out += `⭐ Authority & Trust           ${formatScore(scores.authority, 15).padEnd(20)} ${progressBar(scores.authority, 15)}\n`
  out += `👤 User Experience             ${formatScore(scores.ux, 10).padEnd(20)} ${progressBar(scores.ux, 10)}\n`
  out += `🤖 AI Agent Readiness          ${formatScore(scores.aiReadiness, 10).padEnd(20)} ${progressBar(scores.aiReadiness, 10)}\n\n`

  out += '═══════════════════════════════════════════════════════════════════════\n'
  out += 'CORRELATION INSIGHTS\n'
  out += '═══════════════════════════════════════════════════════════════════════\n\n'

  out += `🔴 CRITICAL (${insightCounts.critical})\n`
  if (insightCounts.critical === 0) out += '   None detected\n'

  out += `\n🟡 WARNING (${insightCounts.warning})\n`
  const warnings = report.insights.filter((i) => i.severity === 'warning')
  warnings.forEach((insight, i) => {
    out += `\n   ${i + 1}. ${insight.title}\n`
    out += `      ${insight.description.slice(0, 80)}...\n`
    out += `      → ${insight.recommendation.slice(0, 60)}...\n`
    out += `      Sources: ${insight.dataSources.join(' + ')} | Impact: ${insight.estimatedImpact}\n`
  })

  out += `\n🟢 OPPORTUNITIES (${insightCounts.opportunity})\n`
  const opportunities = report.insights.filter((i) => i.severity === 'opportunity')
  opportunities.slice(0, 3).forEach((insight, i) => {
    out += `\n   ${i + 1}. ${insight.title}\n`
    out += `      → ${insight.recommendation.slice(0, 60)}...\n`
  })

  out += '\n═══════════════════════════════════════════════════════════════════════\n'
  out += '```\n'

  return out
}

function generateMarkdownReport(report: SEOReport): string {
  let md = `# SEO Analysis Report\n\n`
  md += `**Site:** ${report.metadata.url}\n`
  md += `**Date:** ${report.metadata.date}\n`
  md += `**Score:** ${report.scores.overall}/100\n`
  md += `**Confidence:** ${report.metadata.confidence}%\n\n`
  md += `---\n\n`

  md += `## Dashboard\n\n`
  md += generateDashboard(report)

  md += `\n## Recommendations\n\n`

  const quickWins = report.recommendations.filter((r) => r.category === 'quick-win')
  const strategic = report.recommendations.filter((r) => r.category === 'strategic')

  if (quickWins.length > 0) {
    md += `### 🎯 Quick Wins (High Impact, Low Effort)\n\n`
    quickWins.forEach((rec, i) => {
      md += `#### ${i + 1}. ${rec.title}\n\n`
      md += `**Impact:** ${rec.impact} | **Effort:** ${rec.effort}\n\n`
      md += `${rec.description}\n\n`
    })
  }

  if (strategic.length > 0) {
    md += `### 🚀 Strategic (Higher Effort)\n\n`
    strategic.forEach((rec, i) => {
      md += `#### ${i + 1}. ${rec.title}\n\n`
      md += `**Impact:** ${rec.impact} | **Effort:** ${rec.effort}\n\n`
      md += `${rec.description}\n\n`
    })
  }

  md += `---\n\n`
  md += `## Page-by-Page Analysis\n\n`

  report.crawlData.forEach((page) => {
    const urlPath = page.url.replace(report.metadata.url, '') || '/'
    md += `### ${urlPath}\n\n`
    md += `- **Title:** ${page.title || '❌ Missing'} (${page.titleLength} chars)\n`
    md += `- **Description:** ${page.description ? '✅ Present' : '❌ Missing'} (${page.descriptionLength} chars)\n`
    md += `- **H1:** ${page.h1Count === 1 ? '✅ Single' : page.h1Count === 0 ? '❌ None' : `⚠️ Multiple (${page.h1Count})`}\n`
    md += `- **Schema.org:** ${page.hasSchema ? '✅ Present' : '❌ Missing'}\n`
    md += `- **Response Time:** ${page.responseTime}ms\n\n`
  })

  return md
}

// ============================================================================
// Baseline & Comparison
// ============================================================================

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

function saveReport(report: SEOReport, filename: string): void {
  const filepath = path.join(REPORTS_DIR, filename)
  const markdown = generateMarkdownReport(report)
  fs.writeFileSync(filepath, markdown, 'utf-8')
  console.log(`✅ Report saved: ${filepath}`)
}

function saveBaseline(report: SEOReport, filename: string): void {
  const filepath = path.join(REPORTS_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`📊 Baseline saved: ${filepath}`)
}

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

// ============================================================================
// Main Analysis Flow
// ============================================================================

async function analyzeSEO(): Promise<void> {
  const options = parseArgs()

  // Handle special commands
  if (options.setup) {
    await runSetupWizard(options.url)
    return
  }

  if (options.clearCache) {
    if (options.clearCacheType) {
      const domain = new URL(options.url).hostname
      clearTypeCache(domain, options.clearCacheType)
    } else {
      clearAllCache()
    }
    return
  }

  console.log('\n🔍 SEO ANALYSIS v2.0')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`📍 Target: ${options.url}`)
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`)
  console.log('')

  ensureReportsDir()

  // Check credentials and prompt setup if needed
  const status = checkSetupStatus()
  if (!status.hasGoogle && !options.quick) {
    console.log('ℹ️  ' + status.message)
    const proceed = await promptSetupIfNeeded()
    if (!proceed) {
      console.log('Exiting.')
      return
    }
  }

  // Crawl pages
  console.log('🌐 Starting page crawl...')
  const crawlData = await crawlPages(options.url)

  // Determine which data sources to use
  const useGSC = !options.quick && !options.noGSC && isGSCConfigured()
  const useGA4 = !options.quick && !options.noGA4 && isGA4Configured()
  const useBacklinks = (options.full || !options.noBacklinks) && isBacklinkConfigured()

  // Fetch data from APIs
  let gscData: Awaited<ReturnType<typeof fetchGSCData>> = null
  let ga4Data: Awaited<ReturnType<typeof fetchGA4Data>> = null
  let backlinkData: Awaited<ReturnType<typeof fetchBacklinkData>> = null

  if (useGSC) {
    gscData = await fetchGSCData(options.url, options.days)
  }

  if (useGA4) {
    ga4Data = await fetchGA4Data(options.url, undefined, options.days)
  }

  if (useBacklinks) {
    backlinkData = await fetchBacklinkData(options.url)
  }

  // Calculate site stats for playbooks
  const siteStats = {
    concertCount: 178,
    artistCount: 253,
    venueCount: 77,
    cityCount: 35,
    firstYear: 1984,
    yearSpan: new Date().getFullYear() - 1984,
  }

  // Create analysis context
  const avgCTR = gscData ? calculateAverageCTR(gscData.pages) : 0.05
  const avgBounceRate = ga4Data?.overview.bounceRate || 0.5

  const context: AnalysisContext = {
    config: {
      url: options.url,
      output: options.output,
      baseline: options.baseline,
      compare: options.compare,
      cacheDir: path.join(process.cwd(), '.seo-cache'),
      cacheTtl: 7,
    },
    crawlData,
    gscData: gscData || undefined,
    ga4Data: ga4Data || undefined,
    backlinkData: backlinkData || undefined,
    siteStats,
    avgCTR,
    avgBounceRate,
  }

  // Detect insights
  console.log('\n🔍 Analyzing data sources...')
  const insights = detectInsights(crawlData, gscData || undefined, ga4Data || undefined, backlinkData || undefined)
  console.log(`  ✅ Found ${insights.length} insights`)

  // Generate playbooks
  const playbooks = generatePlaybooks(insights, context)

  // Calculate scores
  console.log('\n📈 Calculating scores...')
  const scores = calculateScores(crawlData, gscData, ga4Data, backlinkData)

  // Generate recommendations
  const recommendations = generateRecommendations(scores, crawlData, insights)

  // Build report
  const dateStr = new Date().toISOString().split('T')[0]
  const report: SEOReport = {
    metadata: {
      date: dateStr,
      url: options.url,
      pagesAnalyzed: crawlData.length,
      version: VERSION,
      dataSources: {
        crawl: true,
        gsc: !!gscData,
        ga4: !!ga4Data,
        backlinks: backlinkData?.provider || 'none',
      },
      dateRange: {
        start: gscData?.dateRange.start || `${options.days} days ago`,
        end: gscData?.dateRange.end || dateStr,
      },
      confidence: scores.confidence,
    },
    scores,
    crawlData,
    gscData: gscData || undefined,
    ga4Data: ga4Data || undefined,
    backlinkData: backlinkData || undefined,
    insights,
    playbooks,
    recommendations,
    checks: {
      hasSitemap: true, // Assumed
      hasRobotsTxt: true, // Assumed
      avgResponseTime: crawlData.reduce((s, p) => s + p.responseTime, 0) / crawlData.length,
    },
  }

  // Output based on format
  if (options.output.includes('cli')) {
    console.log(generateDashboard(report))
  }

  if (options.output.includes('md')) {
    saveReport(report, `${dateStr}-report.md`)
  }

  if (options.output.includes('json')) {
    const jsonPath = path.join(REPORTS_DIR, `${dateStr}-report.json`)
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(`✅ JSON saved: ${jsonPath}`)
  }

  if (options.output.includes('html')) {
    const htmlContent = generateHtmlReport(report)
    const htmlPath = path.join(REPORTS_DIR, `${dateStr}-report.html`)
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8')
    console.log(`✅ HTML saved: ${htmlPath}`)
  }

  if (options.output.includes('csv')) {
    const csvData = generateAllCSV(report)
    const csvDir = path.join(REPORTS_DIR, `${dateStr}-csv`)
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true })
    }

    // Write each CSV file
    fs.writeFileSync(path.join(csvDir, 'summary.csv'), csvData.summary, 'utf-8')
    fs.writeFileSync(path.join(csvDir, 'pages.csv'), csvData.pages, 'utf-8')
    fs.writeFileSync(path.join(csvDir, 'insights.csv'), csvData.insights, 'utf-8')
    fs.writeFileSync(path.join(csvDir, 'recommendations.csv'), csvData.recommendations, 'utf-8')
    fs.writeFileSync(path.join(csvDir, 'scores.csv'), csvData.scores, 'utf-8')

    if (csvData.gscPages) {
      fs.writeFileSync(path.join(csvDir, 'gsc-pages.csv'), csvData.gscPages, 'utf-8')
    }
    if (csvData.gscQueries) {
      fs.writeFileSync(path.join(csvDir, 'gsc-queries.csv'), csvData.gscQueries, 'utf-8')
    }
    if (csvData.ga4Pages) {
      fs.writeFileSync(path.join(csvDir, 'ga4-pages.csv'), csvData.ga4Pages, 'utf-8')
    }
    if (csvData.ga4Traffic) {
      fs.writeFileSync(path.join(csvDir, 'ga4-traffic.csv'), csvData.ga4Traffic, 'utf-8')
    }
    if (csvData.backlinks) {
      fs.writeFileSync(path.join(csvDir, 'backlinks.csv'), csvData.backlinks, 'utf-8')
    }

    console.log(`✅ CSV files saved: ${csvDir}/`)
  }

  if (options.output.includes('sheets')) {
    const result = await exportToGoogleSheets(report)
    if (result.success) {
      console.log(`✅ Google Sheets: ${result.url}`)
    } else {
      console.error(`❌ Google Sheets export failed: ${result.error}`)
    }
  }

  if (options.baseline) {
    saveBaseline(report, `${dateStr}-baseline.json`)
  }

  if (options.compare) {
    const baseline = loadBaseline(options.compare)
    if (baseline) {
      console.log(`\n📊 Comparison to ${options.compare}:`)
      console.log(`   Overall: ${baseline.scores.overall} → ${scores.overall} (${scores.overall - baseline.scores.overall >= 0 ? '+' : ''}${scores.overall - baseline.scores.overall})`)
    }
  }

  console.log('\n🏁 Analysis complete!')
  console.log(`\nNext steps:`)
  console.log(`  1. Review report: seo-reports/${dateStr}-report.md`)
  console.log(`  2. Focus on Quick Wins (${recommendations.filter((r) => r.category === 'quick-win').length} items)`)
  console.log(`  3. Re-run with --compare ${dateStr} after improvements\n`)
}

// Run
analyzeSEO().catch((error) => {
  console.error('❌ Analysis failed:', error)
  process.exit(1)
})
