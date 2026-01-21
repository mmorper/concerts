/**
 * Google Search Console Client (Simple)
 *
 * Uses googleapis library for GSC API access.
 * Designed for graceful degradation when no data is available.
 * Includes rate limiting with exponential backoff.
 */

import { google } from 'googleapis'
import * as dotenv from 'dotenv'
import type { GSCData, GSCPageMetrics, GSCQueryMetrics } from '../types.js'
import { getRateLimiter, withRateLimitAndRetry } from '../rate-limiter.js'

dotenv.config()

// Rate limiter for GSC API
const gscLimiter = getRateLimiter('gsc')

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_DATE_RANGE = 28 // days
const GSC_PROPERTY = 'sc-domain:concerts.morperhaus.org'

// ============================================================================
// Auth Setup
// ============================================================================

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  // Try SEO-specific token first, fallback to general token
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN_SEO || process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    return null
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return auth
}

// ============================================================================
// Date Helpers
// ============================================================================

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
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
// GSC Status Type
// ============================================================================

export interface GSCStatus {
  configured: boolean
  hasData: boolean
  message: string
  dataAge?: string // e.g., "Property added 2026-01-20, data expected by 2026-02-03"
}

// ============================================================================
// Main Client
// ============================================================================

/**
 * Check if GSC is configured (credentials available)
 */
export function isGSCConfigured(): boolean {
  return getAuth() !== null
}

/**
 * Fetch GSC data with graceful degradation
 * Returns null if not configured, empty data if no results yet
 */
export async function fetchGSCData(
  siteUrl: string,
  dateRangeDays: number = DEFAULT_DATE_RANGE
): Promise<{ data: GSCData | null; status: GSCStatus }> {
  const auth = getAuth()

  if (!auth) {
    return {
      data: null,
      status: {
        configured: false,
        hasData: false,
        message: 'GSC not configured (missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN_SEO)',
      },
    }
  }

  const searchconsole = google.searchconsole({ version: 'v1', auth })
  const dateRange = getDateRange(dateRangeDays)

  try {
    // Fetch page-level metrics with rate limiting
    const pageResult = await withRateLimitAndRetry(
      gscLimiter,
      () =>
        searchconsole.searchanalytics.query({
          siteUrl: GSC_PROPERTY,
          requestBody: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['page'],
            rowLimit: 1000,
          },
        }),
      (attempt, error, delay) => {
        console.log(`  GSC page query retry ${attempt}: ${error.message} (waiting ${delay}ms)`)
      }
    )

    // Fetch query-level metrics with rate limiting
    const queryResult = await withRateLimitAndRetry(
      gscLimiter,
      () =>
        searchconsole.searchanalytics.query({
          siteUrl: GSC_PROPERTY,
          requestBody: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            dimensions: ['query'],
            rowLimit: 500,
          },
        }),
      (attempt, error, delay) => {
        console.log(`  GSC query retry ${attempt}: ${error.message} (waiting ${delay}ms)`)
      }
    )

    const pages: GSCPageMetrics[] = (pageResult.data.rows || []).map((row) => ({
      page: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }))

    const queries: GSCQueryMetrics[] = (queryResult.data.rows || []).map((row) => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }))

    const hasData = pages.length > 0 || queries.length > 0

    const data: GSCData = {
      property: GSC_PROPERTY,
      dateRange,
      pages,
      queries,
      indexCoverage: {
        valid: 0, // Not available via Search Analytics API
        warning: 0,
        error: 0,
        excluded: 0,
      },
    }

    return {
      data,
      status: {
        configured: true,
        hasData,
        message: hasData
          ? `GSC: ${pages.length} pages, ${queries.length} queries`
          : 'GSC configured but no data yet (property may be new)',
        dataAge: hasData ? undefined : 'Property recently added — data accumulates over 2-4 weeks',
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      data: null,
      status: {
        configured: true,
        hasData: false,
        message: `GSC API error: ${errorMessage}`,
      },
    }
  }
}

/**
 * Get GSC summary for CLI display
 * Shows detailed error reasons when available
 */
export function formatGSCSummary(status: GSCStatus, data: GSCData | null): string[] {
  const lines: string[] = []

  if (!status.configured) {
    lines.push('  ⬚ Google Search Console: Not configured')
    lines.push('     Missing: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN_SEO')
    return lines
  }

  if (!status.hasData) {
    // Show detailed error reason
    if (status.message.includes('API error')) {
      lines.push(`  ❌ Google Search Console: ${status.message}`)
    } else if (status.message.includes('no data')) {
      lines.push('  ⏳ Google Search Console: Configured, awaiting data')
      if (status.dataAge) {
        lines.push(`     ${status.dataAge}`)
      }
    } else {
      lines.push(`  ⏳ Google Search Console: ${status.message}`)
    }
    return lines
  }

  if (data) {
    const totalClicks = data.pages.reduce((sum, p) => sum + p.clicks, 0)
    const totalImpressions = data.pages.reduce((sum, p) => sum + p.impressions, 0)
    const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0'

    lines.push(`  ✅ Google Search Console: ${data.pages.length} pages tracked`)
    lines.push(`     Period: ${data.dateRange.start} to ${data.dateRange.end}`)
    lines.push(`     Clicks: ${totalClicks} | Impressions: ${totalImpressions} | CTR: ${avgCTR}%`)

    // Top 3 pages by clicks
    if (data.pages.length > 0) {
      const topPages = [...data.pages].sort((a, b) => b.clicks - a.clicks).slice(0, 3)
      lines.push('     Top pages:')
      topPages.forEach((p) => {
        const pagePath = p.page.replace('https://concerts.morperhaus.org', '') || '/'
        lines.push(`       ${pagePath}: ${p.clicks} clicks (#${p.position.toFixed(0)})`)
      })
    }
  }

  return lines
}

// ============================================================================
// Metric Helpers
// ============================================================================

/**
 * Calculate weighted average CTR
 */
export function calculateAverageCTR(pages: GSCPageMetrics[]): number {
  const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0)
  const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0)
  return totalImpressions > 0 ? totalClicks / totalImpressions : 0
}

/**
 * Calculate weighted average position
 */
export function calculateAveragePosition(pages: GSCPageMetrics[]): number {
  const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0)
  const weightedPosition = pages.reduce((sum, p) => sum + p.position * p.impressions, 0)
  return totalImpressions > 0 ? weightedPosition / totalImpressions : 0
}

/**
 * Find CTR opportunity pages (good position, low CTR)
 */
export function findCTROpportunities(
  pages: GSCPageMetrics[],
  options: { maxPosition?: number; minImpressions?: number } = {}
): GSCPageMetrics[] {
  const { maxPosition = 10, minImpressions = 50 } = options
  const avgCTR = calculateAverageCTR(pages)

  return pages.filter(
    (p) =>
      p.position <= maxPosition && p.impressions >= minImpressions && p.ctr < avgCTR * 0.5
  )
}

/**
 * Find pages with zero impressions (potential indexing issues)
 */
export function findZeroImpressionPages(
  crawledUrls: string[],
  gscPages: GSCPageMetrics[]
): string[] {
  const trackedPages = new Set(gscPages.map((p) => p.page))
  return crawledUrls.filter((url) => !trackedPages.has(url))
}
