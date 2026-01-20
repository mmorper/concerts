/**
 * CSV Export Generator
 *
 * Generates CSV files for spreadsheet import with multiple sheets/files.
 */

import type { SEOReport, PageAnalysis, CorrelationInsight, Recommendation } from '../types.js'

// ============================================================================
// Helpers
// ============================================================================

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const str = String(value)

  // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

function toCSVRow(values: unknown[]): string {
  return values.map(escapeCSV).join(',')
}

// ============================================================================
// Page Analysis CSV
// ============================================================================

export function generatePagesCSV(report: SEOReport): string {
  const headers = [
    'URL',
    'Path',
    'Title',
    'Title Length',
    'Description',
    'Description Length',
    'H1 Count',
    'H1 Text',
    'Has Schema',
    'Schema Types',
    'Has Open Graph',
    'Has Canonical',
    'Canonical URL',
    'Response Time (ms)',
    'HTML Size (bytes)',
    'Word Count',
    'Internal Links',
    'External Links',
    'Total Images',
    'Images with Alt',
    'Images Missing Alt',
    'Lazy Loaded Images',
  ]

  const rows = report.crawlData.map((page: PageAnalysis) => [
    page.url,
    page.url.replace(report.metadata.url, '') || '/',
    page.title || '',
    page.titleLength,
    page.description || '',
    page.descriptionLength,
    page.h1Count,
    page.h1Text || '',
    page.hasSchema ? 'Yes' : 'No',
    page.schemaTypes.join('; '),
    page.hasOG ? 'Yes' : 'No',
    page.hasCanonical ? 'Yes' : 'No',
    page.canonicalUrl || '',
    page.responseTime,
    page.htmlSize,
    page.wordCount,
    page.internalLinks,
    page.externalLinks,
    page.images.total,
    page.images.withAlt,
    page.images.missingAlt,
    page.images.lazyLoaded,
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

// ============================================================================
// Insights CSV
// ============================================================================

export function generateInsightsCSV(report: SEOReport): string {
  const headers = [
    'Type',
    'Severity',
    'Title',
    'Description',
    'Recommendation',
    'Data Sources',
    'Estimated Impact',
    'Affected Pages Count',
    'Affected Pages',
  ]

  const rows = report.insights.map((insight: CorrelationInsight) => [
    insight.type,
    insight.severity,
    insight.title,
    insight.description,
    insight.recommendation,
    insight.dataSources.join('; '),
    insight.estimatedImpact,
    insight.affectedPages.length,
    insight.affectedPages.join('; '),
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

// ============================================================================
// Recommendations CSV
// ============================================================================

export function generateRecommendationsCSV(report: SEOReport): string {
  const headers = [
    'Category',
    'Title',
    'Impact',
    'Effort',
    'Points',
    'Description',
    'Affected Pages Count',
    'Affected Pages',
  ]

  const rows = report.recommendations.map((rec: Recommendation) => [
    rec.category,
    rec.title,
    rec.impact,
    rec.effort,
    rec.points,
    rec.description,
    rec.affectedPages?.length || 0,
    rec.affectedPages?.join('; ') || '',
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

// ============================================================================
// Scores CSV
// ============================================================================

export function generateScoresCSV(report: SEOReport): string {
  const headers = ['Category', 'Score', 'Max', 'Percentage']

  const rows = [
    ['Overall', report.scores.overall, 100, Math.round((report.scores.overall / 100) * 100)],
    ['Technical Foundation', report.scores.technical, 25, Math.round((report.scores.technical / 25) * 100)],
    ['Content Quality', report.scores.content, 30, Math.round((report.scores.content / 30) * 100)],
    ['Semantic Intelligence', report.scores.semantic, 20, Math.round((report.scores.semantic / 20) * 100)],
    ['Authority & Trust', report.scores.authority, 15, Math.round((report.scores.authority / 15) * 100)],
    ['User Experience', report.scores.ux, 10, Math.round((report.scores.ux / 10) * 100)],
    ['AI Agent Readiness', report.scores.aiReadiness, 10, Math.round((report.scores.aiReadiness / 10) * 100)],
  ]

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

// ============================================================================
// GSC Data CSV
// ============================================================================

export function generateGSCPagesCSV(report: SEOReport): string {
  if (!report.gscData) {
    return 'No GSC data available'
  }

  const headers = ['Page', 'Clicks', 'Impressions', 'CTR', 'Position']

  const rows = report.gscData.pages.map((page) => [
    page.page,
    page.clicks,
    page.impressions,
    (page.ctr * 100).toFixed(2) + '%',
    page.position.toFixed(1),
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

export function generateGSCQueriesCSV(report: SEOReport): string {
  if (!report.gscData) {
    return 'No GSC data available'
  }

  const headers = ['Query', 'Clicks', 'Impressions', 'CTR', 'Position']

  const rows = report.gscData.queries.map((query) => [
    query.query,
    query.clicks,
    query.impressions,
    (query.ctr * 100).toFixed(2) + '%',
    query.position.toFixed(1),
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

// ============================================================================
// GA4 Data CSV
// ============================================================================

export function generateGA4PagesCSV(report: SEOReport): string {
  if (!report.ga4Data) {
    return 'No GA4 data available'
  }

  const headers = [
    'Page Path',
    'Page Views',
    'Unique Page Views',
    'Avg Time on Page (s)',
    'Bounce Rate',
    'Exit Rate',
  ]

  const rows = report.ga4Data.pageMetrics.map((page) => [
    page.pagePath,
    page.pageViews,
    page.uniquePageViews,
    page.avgTimeOnPage.toFixed(1),
    (page.bounceRate * 100).toFixed(1) + '%',
    (page.exitRate * 100).toFixed(1) + '%',
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

export function generateGA4TrafficCSV(report: SEOReport): string {
  if (!report.ga4Data) {
    return 'No GA4 data available'
  }

  const headers = ['Source', 'Medium', 'Sessions', 'Bounce Rate']

  const rows = report.ga4Data.trafficSources.map((source) => [
    source.source,
    source.medium,
    source.sessions,
    (source.bounceRate * 100).toFixed(1) + '%',
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

// ============================================================================
// Backlinks CSV
// ============================================================================

export function generateBacklinksCSV(report: SEOReport): string {
  if (!report.backlinkData) {
    return 'No backlink data available'
  }

  const headers = [
    'Referring Domain',
    'Backlinks',
    'Domain Rating',
  ]

  const rows = report.backlinkData.topReferrers.map((ref) => [
    ref.domain,
    ref.backlinks,
    ref.domainRating || 'N/A',
  ])

  return [toCSVRow(headers), ...rows.map(toCSVRow)].join('\n')
}

// ============================================================================
// Summary CSV (Single Overview)
// ============================================================================

export function generateSummaryCSV(report: SEOReport): string {
  const lines: string[] = []

  // Metadata
  lines.push('SEO Report Summary')
  lines.push('')
  lines.push(toCSVRow(['Site', report.metadata.url]))
  lines.push(toCSVRow(['Date', report.metadata.date]))
  lines.push(toCSVRow(['Pages Analyzed', report.metadata.pagesAnalyzed]))
  lines.push(toCSVRow(['Confidence', report.metadata.confidence + '%']))
  lines.push(toCSVRow(['Date Range', `${report.metadata.dateRange.start} to ${report.metadata.dateRange.end}`]))
  lines.push('')

  // Data Sources
  lines.push('Data Sources')
  lines.push(toCSVRow(['Crawl', report.metadata.dataSources.crawl ? 'Yes' : 'No']))
  lines.push(toCSVRow(['GSC', report.metadata.dataSources.gsc ? 'Yes' : 'No']))
  lines.push(toCSVRow(['GA4', report.metadata.dataSources.ga4 ? 'Yes' : 'No']))
  lines.push(toCSVRow(['Backlinks', report.metadata.dataSources.backlinks]))
  lines.push('')

  // Scores
  lines.push('Scores')
  lines.push(generateScoresCSV(report))
  lines.push('')

  // Insights Summary
  lines.push('Insights Summary')
  const critical = report.insights.filter((i) => i.severity === 'critical').length
  const warning = report.insights.filter((i) => i.severity === 'warning').length
  const opportunity = report.insights.filter((i) => i.severity === 'opportunity').length
  lines.push(toCSVRow(['Critical', critical]))
  lines.push(toCSVRow(['Warning', warning]))
  lines.push(toCSVRow(['Opportunity', opportunity]))
  lines.push(toCSVRow(['Total', report.insights.length]))
  lines.push('')

  // Recommendations Summary
  lines.push('Recommendations Summary')
  const quickWins = report.recommendations.filter((r) => r.category === 'quick-win').length
  const strategic = report.recommendations.filter((r) => r.category === 'strategic').length
  const optional = report.recommendations.filter((r) => r.category === 'optional').length
  lines.push(toCSVRow(['Quick Wins', quickWins]))
  lines.push(toCSVRow(['Strategic', strategic]))
  lines.push(toCSVRow(['Optional', optional]))
  lines.push(toCSVRow(['Total', report.recommendations.length]))

  return lines.join('\n')
}

// ============================================================================
// Combined Export (All sheets in one object)
// ============================================================================

export interface CSVExport {
  summary: string
  pages: string
  insights: string
  recommendations: string
  scores: string
  gscPages?: string
  gscQueries?: string
  ga4Pages?: string
  ga4Traffic?: string
  backlinks?: string
}

export function generateAllCSV(report: SEOReport): CSVExport {
  const result: CSVExport = {
    summary: generateSummaryCSV(report),
    pages: generatePagesCSV(report),
    insights: generateInsightsCSV(report),
    recommendations: generateRecommendationsCSV(report),
    scores: generateScoresCSV(report),
  }

  if (report.gscData) {
    result.gscPages = generateGSCPagesCSV(report)
    result.gscQueries = generateGSCQueriesCSV(report)
  }

  if (report.ga4Data) {
    result.ga4Pages = generateGA4PagesCSV(report)
    result.ga4Traffic = generateGA4TrafficCSV(report)
  }

  if (report.backlinkData) {
    result.backlinks = generateBacklinksCSV(report)
  }

  return result
}
