/**
 * Google Analytics 4 Client
 *
 * Fetches engagement metrics, page performance, and traffic sources from GA4 Data API.
 */

import { getValidAccessToken } from '../oauth.js'
import { loadCredentials, getGA4PropertyId } from '../credentials.js'
import { readCache, writeCache, hasValidCache } from '../cache.js'
import type { GA4Data, GA4PageMetrics, CoreWebVitals, TrafficSource } from '../types.js'

// ============================================================================
// Constants
// ============================================================================

const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta'
const CRUX_API_BASE = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord'
const DEFAULT_DATE_RANGE = 28 // days

// ============================================================================
// API Request Helpers
// ============================================================================

/**
 * Make an authenticated request to GA4 Data API
 */
async function ga4Request<T>(
  propertyId: string,
  endpoint: string,
  body: object
): Promise<T> {
  const accessToken = await getValidAccessToken()

  if (!accessToken) {
    throw new Error('No valid Google access token. Run /seo --setup to authenticate.')
  }

  const url = `${GA4_API_BASE}/properties/${propertyId}${endpoint}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GA4 API error (${response.status}): ${error}`)
  }

  return response.json()
}

/**
 * Make a request to Chrome UX Report API (for Core Web Vitals)
 */
async function cruxRequest(origin: string, apiKey?: string): Promise<CoreWebVitals | null> {
  // CrUX API can use API key or OAuth token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  let url = CRUX_API_BASE
  if (apiKey) {
    url += `?key=${apiKey}`
  } else {
    const accessToken = await getValidAccessToken()
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    } else {
      return null // No auth available
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        origin,
        metrics: [
          'largest_contentful_paint',
          'first_input_delay',
          'cumulative_layout_shift',
          'interaction_to_next_paint',
        ],
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return parseCruxResponse(data)
  } catch {
    return null
  }
}

interface CruxMetric {
  percentiles?: { p75: number }
  histogram?: Array<{ density: number }>
}

interface CruxResponse {
  record?: {
    metrics?: {
      largest_contentful_paint?: CruxMetric
      first_input_delay?: CruxMetric
      cumulative_layout_shift?: CruxMetric
      interaction_to_next_paint?: CruxMetric
    }
  }
}

function parseCruxResponse(data: CruxResponse): CoreWebVitals | null {
  const metrics = data.record?.metrics
  if (!metrics) return null

  const getRating = (
    value: number,
    good: number,
    poor: number
  ): 'good' | 'needs-improvement' | 'poor' => {
    if (value <= good) return 'good'
    if (value >= poor) return 'poor'
    return 'needs-improvement'
  }

  const lcp = metrics.largest_contentful_paint?.percentiles?.p75
  const fid = metrics.first_input_delay?.percentiles?.p75
  const cls = metrics.cumulative_layout_shift?.percentiles?.p75
  const inp = metrics.interaction_to_next_paint?.percentiles?.p75

  return {
    lcp: lcp
      ? { p75: lcp, rating: getRating(lcp, 2500, 4000) }
      : { p75: 0, rating: 'poor' },
    fid: fid
      ? { p75: fid, rating: getRating(fid, 100, 300) }
      : { p75: 0, rating: 'poor' },
    cls: cls
      ? { p75: cls, rating: getRating(cls, 0.1, 0.25) }
      : { p75: 0, rating: 'poor' },
    inp: inp
      ? { p75: inp, rating: getRating(inp, 200, 500) }
      : { p75: 0, rating: 'poor' },
  }
}

// ============================================================================
// GA4 API Calls
// ============================================================================

interface GA4RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>
    metricValues?: Array<{ value: string }>
  }>
  totals?: Array<{
    metricValues?: Array<{ value: string }>
  }>
}

/**
 * Fetch overview metrics (sessions, users, bounce rate, etc.)
 */
async function fetchOverviewMetrics(
  propertyId: string,
  dateRangeDays: number
): Promise<GA4Data['overview']> {
  const response = await ga4Request<GA4RunReportResponse>(propertyId, ':runReport', {
    dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViewsPerSession' },
    ],
  })

  const totals = response.totals?.[0]?.metricValues || []

  return {
    sessions: parseInt(totals[0]?.value || '0', 10),
    users: parseInt(totals[1]?.value || '0', 10),
    newUsers: parseInt(totals[2]?.value || '0', 10),
    bounceRate: parseFloat(totals[3]?.value || '0'),
    avgSessionDuration: parseFloat(totals[4]?.value || '0'),
    pagesPerSession: parseFloat(totals[5]?.value || '0'),
  }
}

/**
 * Fetch page-level metrics
 */
async function fetchPageMetrics(
  propertyId: string,
  dateRangeDays: number
): Promise<GA4PageMetrics[]> {
  const response = await ga4Request<GA4RunReportResponse>(propertyId, ':runReport', {
    dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'exits' },
    ],
    limit: 100,
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
  })

  if (!response.rows) {
    return []
  }

  return response.rows.map((row) => ({
    pagePath: row.dimensionValues?.[0]?.value || '',
    pageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
    uniquePageViews: parseInt(row.metricValues?.[0]?.value || '0', 10), // GA4 doesn't have this directly
    avgTimeOnPage: parseFloat(row.metricValues?.[2]?.value || '0'),
    bounceRate: parseFloat(row.metricValues?.[1]?.value || '0'),
    exitRate: 0, // Would need additional calculation
  }))
}

/**
 * Fetch traffic sources
 */
async function fetchTrafficSources(
  propertyId: string,
  dateRangeDays: number
): Promise<TrafficSource[]> {
  const response = await ga4Request<GA4RunReportResponse>(propertyId, ':runReport', {
    dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
    limit: 20,
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  })

  if (!response.rows) {
    return []
  }

  return response.rows.map((row) => ({
    source: row.dimensionValues?.[0]?.value || '(not set)',
    medium: row.dimensionValues?.[1]?.value || '(not set)',
    sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
    bounceRate: parseFloat(row.metricValues?.[1]?.value || '0'),
  }))
}

// ============================================================================
// Main Client Interface
// ============================================================================

/**
 * Check if GA4 is configured
 */
export function isGA4Configured(): boolean {
  const credentials = loadCredentials()
  return !!credentials.google?.clientId
}

/**
 * Get GA4 property ID for a site
 */
export function getPropertyId(siteUrl: string): string | undefined {
  return getGA4PropertyId(siteUrl)
}

/**
 * Fetch all GA4 data for a site
 */
export async function fetchGA4Data(
  siteUrl: string,
  propertyId?: string,
  dateRangeDays: number = DEFAULT_DATE_RANGE,
  useCache: boolean = true
): Promise<GA4Data | null> {
  if (!isGA4Configured()) {
    return null
  }

  // Get property ID
  const pid = propertyId || getPropertyId(siteUrl)
  if (!pid) {
    console.log('  ⚠️  No GA4 property ID configured for this site')
    return null
  }

  const domain = new URL(siteUrl).hostname

  // Check cache first
  if (useCache && hasValidCache(domain, 'ga4')) {
    const cached = readCache<GA4Data>(domain, 'ga4')
    if (cached) {
      console.log('  📋 Using cached GA4 data')
      return cached
    }
  }

  console.log('  📈 Fetching Google Analytics 4 data...')

  try {
    // Fetch data in parallel
    const [overview, pageMetrics, trafficSources] = await Promise.all([
      fetchOverviewMetrics(pid, dateRangeDays),
      fetchPageMetrics(pid, dateRangeDays),
      fetchTrafficSources(pid, dateRangeDays),
    ])

    // Fetch Core Web Vitals from CrUX
    console.log('  ⚡ Fetching Core Web Vitals...')
    const origin = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl
    const coreWebVitals = await cruxRequest(origin)

    const data: GA4Data = {
      propertyId: pid,
      dateRange: { start: `${dateRangeDays}daysAgo`, end: 'today' },
      overview,
      pageMetrics,
      coreWebVitals: coreWebVitals || undefined,
      trafficSources,
    }

    // Cache the results
    writeCache(domain, 'ga4', data)

    console.log(`  ✅ GA4: ${overview.sessions} sessions, ${pageMetrics.length} pages`)
    if (coreWebVitals) {
      console.log(`  ✅ Core Web Vitals: LCP ${coreWebVitals.lcp.rating}, CLS ${coreWebVitals.cls.rating}`)
    } else {
      console.log('  ⚠️  Core Web Vitals unavailable (low traffic or no CrUX data)')
    }

    return data
  } catch (error) {
    console.error('  ❌ GA4 fetch failed:', error)
    return null
  }
}

// ============================================================================
// Metric Helpers
// ============================================================================

/**
 * Calculate organic traffic percentage
 */
export function calculateOrganicTrafficPercent(trafficSources: TrafficSource[]): number {
  const totalSessions = trafficSources.reduce((sum, s) => sum + s.sessions, 0)
  const organicSessions = trafficSources
    .filter((s) => s.medium === 'organic')
    .reduce((sum, s) => sum + s.sessions, 0)

  return totalSessions > 0 ? (organicSessions / totalSessions) * 100 : 0
}

/**
 * Find pages with high bounce rate
 */
export function findHighBouncePages(
  pages: GA4PageMetrics[],
  minPageViews: number = 50,
  minBounceRate: number = 0.7
): GA4PageMetrics[] {
  return pages.filter(
    (p) => p.pageViews >= minPageViews && p.bounceRate >= minBounceRate
  )
}

/**
 * Get top pages by engagement (low bounce, high time on page)
 */
export function getTopEngagedPages(
  pages: GA4PageMetrics[],
  limit: number = 10
): GA4PageMetrics[] {
  return [...pages]
    .filter((p) => p.pageViews >= 10)
    .sort((a, b) => {
      // Score: lower bounce rate + higher time on page
      const scoreA = (1 - a.bounceRate) * 0.5 + Math.min(a.avgTimeOnPage / 300, 1) * 0.5
      const scoreB = (1 - b.bounceRate) * 0.5 + Math.min(b.avgTimeOnPage / 300, 1) * 0.5
      return scoreB - scoreA
    })
    .slice(0, limit)
}

/**
 * Format Core Web Vitals for display
 */
export function formatCoreWebVitals(cwv: CoreWebVitals): string[] {
  const ratingEmoji = (rating: string) =>
    rating === 'good' ? '🟢' : rating === 'needs-improvement' ? '🟡' : '🔴'

  return [
    `LCP: ${(cwv.lcp.p75 / 1000).toFixed(2)}s ${ratingEmoji(cwv.lcp.rating)}`,
    `FID: ${cwv.fid.p75}ms ${ratingEmoji(cwv.fid.rating)}`,
    `CLS: ${cwv.cls.p75.toFixed(3)} ${ratingEmoji(cwv.cls.rating)}`,
    `INP: ${cwv.inp.p75}ms ${ratingEmoji(cwv.inp.rating)}`,
  ]
}
