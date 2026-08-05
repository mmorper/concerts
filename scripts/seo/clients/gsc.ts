/**
 * Google Search Console Client
 *
 * Fetches search performance data and index coverage from GSC API.
 */

import { getValidAccessToken } from '../oauth.js'
import { loadCredentials, getGSCProperty } from '../credentials.js'
import { readCache, writeCache, hasValidCache } from '../cache.js'
import type { GSCData, GSCPageMetrics, GSCQueryMetrics } from '../types.js'

// ============================================================================
// Constants
// ============================================================================

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3'
const DEFAULT_DATE_RANGE = 28 // days

// ============================================================================
// API Request Helpers
// ============================================================================

/**
 * Make an authenticated request to GSC API
 */
async function gscRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: object
): Promise<T> {
  const accessToken = await getValidAccessToken()

  if (!accessToken) {
    throw new Error('No valid Google access token. Run /seo --setup to authenticate.')
  }

  const url = `${GSC_API_BASE}${endpoint}`
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GSC API error (${response.status}): ${error}`)
  }

  return response.json()
}

// ============================================================================
// Date Helpers
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date()
  end.setDate(end.getDate() - 3) // GSC data is 2-3 days delayed

  const start = new Date(end)
  start.setDate(start.getDate() - days)

  return {
    start: formatDate(start),
    end: formatDate(end),
  }
}

// ============================================================================
// API Calls
// ============================================================================

interface GSCSearchAnalyticsResponse {
  rows?: Array<{
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
}

/**
 * Fetch page-level search analytics
 */
async function fetchPageMetrics(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCPageMetrics[]> {
  const response = await gscRequest<GSCSearchAnalyticsResponse>(
    `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    'POST',
    {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 1000,
    }
  )

  if (!response.rows) {
    return []
  }

  return response.rows.map((row) => ({
    page: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }))
}

/**
 * Fetch query-level search analytics
 */
async function fetchQueryMetrics(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCQueryMetrics[]> {
  const response = await gscRequest<GSCSearchAnalyticsResponse>(
    `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    'POST',
    {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 500,
    }
  )

  if (!response.rows) {
    return []
  }

  return response.rows.map((row) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }))
}



/**
 * Get index coverage summary (from sites endpoint)
 */
async function fetchIndexCoverage(_siteUrl: string): Promise<{
  valid: number
  warning: number
  error: number
  excluded: number
}> {
  // Note: Full index coverage requires Search Console Reporting API
  // which has different authentication. For now, return estimates.
  // TODO: Implement proper index coverage when API access is available

  return {
    valid: 0,
    warning: 0,
    error: 0,
    excluded: 0,
  }
}

// ============================================================================
// Main Client Interface
// ============================================================================

/**
 * Check if GSC is configured
 */
export function isGSCConfigured(): boolean {
  const credentials = loadCredentials()
  return !!credentials.google?.clientId
}

/**
 * Get GSC property URL for a site
 */
export function getPropertyUrl(siteUrl: string): string {
  // Check if there's a mapped property
  const mappedProperty = getGSCProperty(siteUrl)
  if (mappedProperty) {
    return mappedProperty
  }

  // Default: use site URL as property
  // GSC accepts URLs like 'https://example.com/' or 'sc-domain:example.com'
  return siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`
}

/**
 * Fetch all GSC data for a site
 */
export async function fetchGSCData(
  siteUrl: string,
  dateRangeDays: number = DEFAULT_DATE_RANGE,
  useCache: boolean = true
): Promise<GSCData | null> {
  if (!isGSCConfigured()) {
    return null
  }

  const propertyUrl = getPropertyUrl(siteUrl)
  const domain = new URL(siteUrl).hostname

  // Check cache first
  if (useCache && hasValidCache(domain, 'gsc')) {
    const cached = readCache<GSCData>(domain, 'gsc')
    if (cached) {
      console.log('  📋 Using cached GSC data')
      return cached
    }
  }

  console.log('  📊 Fetching Google Search Console data...')

  try {
    const dateRange = getDateRange(dateRangeDays)

    // Fetch data in parallel
    const [pages, queries] = await Promise.all([
      fetchPageMetrics(propertyUrl, dateRange.start, dateRange.end),
      fetchQueryMetrics(propertyUrl, dateRange.start, dateRange.end),
    ])

    // Get index coverage (may be limited)
    const indexCoverage = await fetchIndexCoverage(propertyUrl)

    const data: GSCData = {
      property: propertyUrl,
      dateRange,
      pages,
      queries,
      indexCoverage,
    }

    // Cache the results
    writeCache(domain, 'gsc', data)

    console.log(`  ✅ GSC: ${pages.length} pages, ${queries.length} queries`)

    return data
  } catch (error) {
    console.error('  ❌ GSC fetch failed:', error)
    return null
  }
}

/**
 * List available GSC properties
 */
export async function listGSCProperties(): Promise<string[]> {
  interface GSCSitesResponse {
    siteEntry?: Array<{
      siteUrl: string
      permissionLevel: string
    }>
  }

  try {
    const response = await gscRequest<GSCSitesResponse>('/sites')

    if (!response.siteEntry) {
      return []
    }

    return response.siteEntry.map((site) => site.siteUrl)
  } catch (error) {
    console.error('Failed to list GSC properties:', error)
    return []
  }
}

// ============================================================================
// Metric Helpers
// ============================================================================

/**
 * Calculate average CTR from page metrics
 */
export function calculateAverageCTR(pages: GSCPageMetrics[]): number {
  if (pages.length === 0) return 0

  const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0)
  const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0)

  return totalImpressions > 0 ? totalClicks / totalImpressions : 0
}

/**
 * Calculate average position from page metrics
 */
export function calculateAveragePosition(pages: GSCPageMetrics[]): number {
  if (pages.length === 0) return 0

  const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0)
  const weightedPosition = pages.reduce((sum, p) => sum + p.position * p.impressions, 0)

  return totalImpressions > 0 ? weightedPosition / totalImpressions : 0
}

/**
 * Get top pages by clicks
 */
export function getTopPagesByClicks(pages: GSCPageMetrics[], limit: number = 10): GSCPageMetrics[] {
  return [...pages].sort((a, b) => b.clicks - a.clicks).slice(0, limit)
}

/**
 * Get top queries by impressions
 */
export function getTopQueriesByImpressions(queries: GSCQueryMetrics[], limit: number = 10): GSCQueryMetrics[] {
  return [...queries].sort((a, b) => b.impressions - a.impressions).slice(0, limit)
}

/**
 * Find pages with low CTR opportunities
 */
export function findCTROpportunities(
  pages: GSCPageMetrics[],
  maxPosition: number = 10,
  minImpressions: number = 100
): GSCPageMetrics[] {
  const avgCTR = calculateAverageCTR(pages)

  return pages.filter(
    (p) =>
      p.position <= maxPosition &&
      p.impressions >= minImpressions &&
      p.ctr < avgCTR * 0.5
  )
}
