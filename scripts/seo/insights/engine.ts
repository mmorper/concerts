/**
 * Correlation Insights Engine
 *
 * Detects actionable insights by correlating data from multiple sources.
 */

import type {
  PageAnalysis,
  GSCData,
  GA4Data,
  BacklinkData,
  CorrelationInsight,
  ActionablePlaybook,
  AnalysisContext,
  InsightType,
} from '../types.js'

// ============================================================================
// URL Matching Helpers
// ============================================================================

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://example.com')
    return parsed.pathname + parsed.search
  } catch {
    return url.toLowerCase()
  }
}

/**
 * Check if two URLs match (accounting for path variations)
 */
export function urlMatch(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2)
}

/**
 * Find a page in crawl data by URL
 */
export function findCrawlPage(crawlData: PageAnalysis[], url: string): PageAnalysis | undefined {
  return crawlData.find((p) => urlMatch(p.url, url))
}

// ============================================================================
// Crawl-Only Insight Detectors
// ============================================================================

/**
 * Duplicate Titles: Multiple pages with identical titles
 */
function detectDuplicateTitles(crawlData: PageAnalysis[]): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []
  const titleMap = new Map<string, string[]>()

  for (const page of crawlData) {
    if (page.title && page.title.trim()) {
      const title = page.title.trim()
      const existing = titleMap.get(title) || []
      existing.push(page.url)
      titleMap.set(title, existing)
    }
  }

  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      insights.push({
        type: 'duplicate_content',
        severity: 'warning',
        title: `${urls.length} pages share identical title`,
        description: `Title "${title.slice(0, 60)}${title.length > 60 ? '...' : ''}" is used on ${urls.length} pages. This can cause keyword cannibalization.`,
        affectedPages: urls,
        dataSources: ['crawl'],
        recommendation:
          'Give each page a unique, descriptive title. Consider if these pages should be consolidated.',
        estimatedImpact: 'medium',
      })
    }
  }

  return insights
}

/**
 * Missing Schema: Key pages without structured data
 */
function detectMissingSchema(crawlData: PageAnalysis[]): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // Key pages that should have schema
  const keyPagePatterns = [
    { pattern: /^\/?$/, type: 'homepage', schema: 'WebSite or Organization' },
    { pattern: /about/i, type: 'about page', schema: 'Person or Organization' },
  ]

  for (const page of crawlData) {
    for (const { pattern, type, schema } of keyPagePatterns) {
      const path = new URL(page.url, 'https://example.com').pathname
      if (pattern.test(path) && !page.hasSchema) {
        insights.push({
          type: 'missing_schema',
          severity: 'opportunity',
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} missing structured data`,
          description: `${page.url} is a ${type} but has no Schema.org markup. Adding ${schema} schema can improve rich snippets.`,
          affectedPages: [page.url],
          dataSources: ['crawl'],
          recommendation: `Add ${schema} schema to help search engines understand this page's purpose.`,
          estimatedImpact: 'medium',
        })
      }
    }
  }

  return insights
}

/**
 * Slow Server Response: Pages with high TTFB
 */
function detectSlowResponses(crawlData: PageAnalysis[]): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []
  const SLOW_THRESHOLD_MS = 500

  const slowPages = crawlData.filter((p) => p.responseTime > SLOW_THRESHOLD_MS)

  if (slowPages.length > 0) {
    const avgSlow = Math.round(
      slowPages.reduce((sum, p) => sum + p.responseTime, 0) / slowPages.length
    )

    insights.push({
      type: 'slow_response',
      severity: slowPages.length > 3 ? 'warning' : 'opportunity',
      title: `${slowPages.length} page${slowPages.length > 1 ? 's' : ''} with slow server response`,
      description: `${slowPages.length} pages have TTFB > ${SLOW_THRESHOLD_MS}ms (avg: ${avgSlow}ms). Slow server response hurts Core Web Vitals.`,
      affectedPages: slowPages.map((p) => p.url),
      dataSources: ['crawl'],
      recommendation:
        'Check server performance, caching, and CDN configuration. Consider edge caching for static pages.',
      estimatedImpact: 'high',
    })
  }

  return insights
}

/**
 * Missing Canonical: Pages without self-referencing canonical
 */
function detectMissingCanonicals(crawlData: PageAnalysis[]): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  const pagesWithoutCanonical = crawlData.filter((p) => !p.hasCanonical)

  if (pagesWithoutCanonical.length > 0) {
    insights.push({
      type: 'missing_canonical',
      severity: 'opportunity',
      title: `${pagesWithoutCanonical.length} page${pagesWithoutCanonical.length > 1 ? 's' : ''} missing canonical tag`,
      description: `Pages without canonical tags may be indexed with query parameters or alternate URLs, diluting link equity.`,
      affectedPages: pagesWithoutCanonical.map((p) => p.url),
      dataSources: ['crawl'],
      recommendation:
        'Add self-referencing <link rel="canonical"> to each page, or implement via Cloudflare Worker.',
      estimatedImpact: 'low',
    })
  }

  return insights
}

// ============================================================================
// Cross-Source Insight Detectors
// ============================================================================

/**
 * Content Gap: Good structure but no search visibility
 */
function detectContentGaps(
  crawlData: PageAnalysis[],
  gscData: GSCData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  for (const page of crawlData) {
    const gscPage = gscData.pages.find((p) => urlMatch(p.page, page.url))

    // Page has good structure but no impressions
    if (
      page.title &&
      page.description &&
      page.hasSchema &&
      (!gscPage || gscPage.impressions < 10)
    ) {
      insights.push({
        type: 'content_gap',
        severity: 'warning',
        title: 'Well-structured page has no search visibility',
        description: `${page.url} has proper meta tags and schema but received only ${gscPage?.impressions || 0} impressions in the last 28 days.`,
        affectedPages: [page.url],
        dataSources: ['crawl', 'gsc'],
        recommendation:
          'Check if page is indexed. If indexed, content may not match search intent or faces strong competition.',
        estimatedImpact: 'medium',
      })
    }
  }

  return insights
}

/**
 * CTR Opportunity: Good ranking but low click-through
 */
function detectCTROpportunities(
  crawlData: PageAnalysis[],
  gscData: GSCData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // Calculate average CTR
  const avgCTR =
    gscData.pages.length > 0
      ? gscData.pages.reduce((sum, p) => sum + p.ctr, 0) / gscData.pages.length
      : 0

  for (const gscPage of gscData.pages) {
    // Good position (top 10) but CTR well below average
    if (
      gscPage.position <= 10 &&
      gscPage.impressions > 100 &&
      gscPage.ctr < avgCTR * 0.5
    ) {
      const crawlPage = findCrawlPage(crawlData, gscPage.page)

      insights.push({
        type: 'ctr_opportunity',
        severity: 'opportunity',
        title: `Page ranks #${Math.round(gscPage.position)} but has low CTR`,
        description: `${gscPage.page} has ${gscPage.impressions} impressions at position ${gscPage.position.toFixed(1)} but only ${(gscPage.ctr * 100).toFixed(1)}% CTR (avg: ${(avgCTR * 100).toFixed(1)}%).`,
        affectedPages: [gscPage.page],
        dataSources: ['gsc', 'crawl'],
        recommendation: `Improve title and meta description. Current title: "${crawlPage?.title || 'Unknown'}"`,
        estimatedImpact: 'high',
      })
    }
  }

  return insights
}

/**
 * Engagement Mismatch: Traffic but high bounce
 */
function detectEngagementMismatches(
  crawlData: PageAnalysis[],
  ga4Data: GA4Data
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  for (const ga4Page of ga4Data.pageMetrics) {
    // High traffic but very high bounce rate
    if (ga4Page.pageViews > 50 && ga4Page.bounceRate > 0.8) {
      insights.push({
        type: 'engagement_mismatch',
        severity: 'warning',
        title: 'High-traffic page has 80%+ bounce rate',
        description: `${ga4Page.pagePath} received ${ga4Page.pageViews} views but ${(ga4Page.bounceRate * 100).toFixed(0)}% of visitors left immediately.`,
        affectedPages: [ga4Page.pagePath],
        dataSources: ['ga4', 'crawl'],
        recommendation:
          'Content may not match user intent, or UX issues are causing quick exits. Check H1 alignment with search queries.',
        estimatedImpact: 'high',
      })
    }
  }

  return insights
}

/**
 * Technical Reality Gap: Lab vs field performance
 */
function detectTechnicalRealityGaps(
  crawlData: PageAnalysis[],
  ga4Data: GA4Data
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  if (!ga4Data.coreWebVitals) {
    return insights
  }

  const cwv = ga4Data.coreWebVitals

  // Check if field LCP is poor but crawl response times are fast
  const avgResponseTime =
    crawlData.length > 0
      ? crawlData.reduce((sum, p) => sum + p.responseTime, 0) / crawlData.length
      : 0

  if (cwv.lcp.rating === 'poor' && avgResponseTime < 200) {
    insights.push({
      type: 'technical_reality',
      severity: 'warning',
      title: 'Fast server but slow real-world load times',
      description: `Server responds in ${Math.round(avgResponseTime)}ms but field LCP is ${(cwv.lcp.p75 / 1000).toFixed(1)}s. This suggests client-side performance issues.`,
      affectedPages: crawlData.map((p) => p.url),
      dataSources: ['crawl', 'ga4'],
      recommendation:
        'Focus on client-side optimizations: lazy loading, code splitting, image optimization, third-party script delays.',
      estimatedImpact: 'high',
    })
  }

  return insights
}

/**
 * Zombie Page: Impressions but no engagement
 */
function detectZombiePages(gscData: GSCData, ga4Data: GA4Data): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  for (const gscPage of gscData.pages) {
    const ga4Page = ga4Data.pageMetrics.find((p) => urlMatch(p.pagePath, gscPage.page))

    // Has impressions but almost no clicks AND no direct traffic
    if (
      gscPage.impressions > 100 &&
      gscPage.clicks < 5 &&
      (!ga4Page || ga4Page.pageViews < 10)
    ) {
      insights.push({
        type: 'zombie_page',
        severity: 'warning',
        title: 'Page appears in search but gets no traffic',
        description: `${gscPage.page} has ${gscPage.impressions} impressions but only ${gscPage.clicks} clicks and ${ga4Page?.pageViews || 0} total views.`,
        affectedPages: [gscPage.page],
        dataSources: ['gsc', 'ga4'],
        recommendation:
          "Consider removing, consolidating, or completely rewriting this page. It's diluting site authority.",
        estimatedImpact: 'medium',
      })
    }
  }

  return insights
}

/**
 * Authority Mismatch: High backlinks but low rankings
 */
function detectAuthorityMismatches(
  backlinkData: BacklinkData,
  gscData: GSCData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // If we have good domain rating but poor average position
  const avgPosition =
    gscData.pages.length > 0
      ? gscData.pages.reduce((sum, p) => sum + p.position * p.impressions, 0) /
        gscData.pages.reduce((sum, p) => sum + p.impressions, 0)
      : 0

  const authority = backlinkData.metrics.domainRating ?? backlinkData.metrics.authorityScore ?? 0

  if (authority > 30 && avgPosition > 15) {
    insights.push({
      type: 'authority_mismatch',
      severity: 'opportunity',
      title: 'Domain has authority but ranks poorly',
      description: `Domain rating/authority is ${authority} but average position is ${avgPosition.toFixed(1)}. On-page factors may be limiting rankings.`,
      affectedPages: gscData.pages.slice(0, 5).map((p) => p.page),
      dataSources: ['backlinks', 'gsc'],
      recommendation:
        'Focus on on-page SEO: improve content quality, update outdated pages, add internal links, optimize titles.',
      estimatedImpact: 'high',
    })
  }

  return insights
}

/**
 * Link-Worthy Content: High engagement but few backlinks
 */
function detectLinkworthyContent(
  backlinkData: BacklinkData,
  ga4Data: GA4Data
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // Find high-engagement pages
  const engagedPages = ga4Data.pageMetrics.filter(
    (p) => p.pageViews > 50 && p.bounceRate < 0.5 && p.avgTimeOnPage > 120
  )

  if (engagedPages.length > 0 && backlinkData.metrics.referringDomains < 20) {
    insights.push({
      type: 'linkworthy_content',
      severity: 'opportunity',
      title: 'High-engagement content has few backlinks',
      description: `${engagedPages.length} pages have strong engagement metrics but only ${backlinkData.metrics.referringDomains} referring domains to the site.`,
      affectedPages: engagedPages.slice(0, 5).map((p) => p.pagePath),
      dataSources: ['ga4', 'backlinks'],
      recommendation:
        'These pages are good candidates for outreach. Consider guest posting, social promotion, or creating shareable assets.',
      estimatedImpact: 'high',
    })
  }

  return insights
}

/**
 * Cannibalization: Multiple pages competing for same queries
 */
function detectCannibalization(gscData: GSCData): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // Group queries by page to find overlaps
  const queryPageMap = new Map<string, string[]>()

  // Note: This is simplified. Real cannibalization detection would need
  // query + page combined data from GSC API
  // For now, we'll look for pages with very similar positions

  const pagesByPosition = new Map<number, string[]>()
  for (const page of gscData.pages) {
    if (page.impressions > 50) {
      const roundedPos = Math.round(page.position)
      const existing = pagesByPosition.get(roundedPos) || []
      existing.push(page.page)
      pagesByPosition.set(roundedPos, existing)
    }
  }

  // Flag positions with multiple pages (potential cannibalization)
  for (const [position, pages] of pagesByPosition) {
    if (pages.length > 2 && position <= 10) {
      insights.push({
        type: 'cannibalizing_pages',
        severity: 'warning',
        title: `${pages.length} pages competing at position ${position}`,
        description: `Multiple pages are ranking at similar positions, potentially splitting clicks and authority.`,
        affectedPages: pages,
        dataSources: ['gsc'],
        recommendation:
          'Review these pages for duplicate content. Consider consolidating or adding canonicals.',
        estimatedImpact: 'medium',
      })
    }
  }

  return insights
}

// ============================================================================
// Main Engine
// ============================================================================

/**
 * Detect all insights from available data sources
 */
export function detectInsights(
  crawlData: PageAnalysis[],
  gscData?: GSCData,
  ga4Data?: GA4Data,
  backlinkData?: BacklinkData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // Crawl-only insights (always available)
  insights.push(...detectDuplicateTitles(crawlData))
  insights.push(...detectMissingSchema(crawlData))
  insights.push(...detectSlowResponses(crawlData))
  insights.push(...detectMissingCanonicals(crawlData))

  // Cross-source insights (require additional data)

  if (gscData) {
    insights.push(...detectContentGaps(crawlData, gscData))
    insights.push(...detectCTROpportunities(crawlData, gscData))
    insights.push(...detectCannibalization(gscData))
  }

  if (ga4Data) {
    insights.push(...detectEngagementMismatches(crawlData, ga4Data))

    if (ga4Data.coreWebVitals) {
      insights.push(...detectTechnicalRealityGaps(crawlData, ga4Data))
    }
  }

  if (gscData && ga4Data) {
    insights.push(...detectZombiePages(gscData, ga4Data))
  }

  if (backlinkData && gscData) {
    insights.push(...detectAuthorityMismatches(backlinkData, gscData))
  }

  if (backlinkData && ga4Data) {
    insights.push(...detectLinkworthyContent(backlinkData, ga4Data))
  }

  // Sort by severity and impact
  return insights.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, opportunity: 2 }
    const impactOrder = { high: 0, medium: 1, low: 2 }

    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (severityDiff !== 0) return severityDiff

    return impactOrder[a.estimatedImpact] - impactOrder[b.estimatedImpact]
  })
}

/**
 * Calculate data source confidence level
 */
export function calculateConfidence(
  hasGSC: boolean,
  hasGA4: boolean,
  hasBacklinks: boolean
): number {
  // Base confidence from crawl data
  let confidence = 60

  // Each data source adds confidence
  if (hasGSC) confidence += 15
  if (hasGA4) confidence += 15
  if (hasBacklinks) confidence += 10

  return Math.min(confidence, 100)
}

/**
 * Get insight count by severity
 */
export function countInsightsBySeverity(insights: CorrelationInsight[]): {
  critical: number
  warning: number
  opportunity: number
} {
  return {
    critical: insights.filter((i) => i.severity === 'critical').length,
    warning: insights.filter((i) => i.severity === 'warning').length,
    opportunity: insights.filter((i) => i.severity === 'opportunity').length,
  }
}
