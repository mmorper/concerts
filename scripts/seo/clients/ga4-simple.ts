/**
 * Google Analytics 4 Client (Simple)
 *
 * Uses googleapis library for GA4 Data API access.
 * Designed for graceful degradation when not configured or no data available.
 * Includes rate limiting with exponential backoff.
 *
 * NOTE: GA4 requires a numeric property ID (e.g., "123456789"), not the
 * measurement ID (G-XXXXXXXXXX). Find it at:
 * https://analytics.google.com/ → Admin → Property Settings → Property ID
 */

import { google } from 'googleapis'
import * as dotenv from 'dotenv'
import type { GA4Data, GA4PageMetrics, TrafficSource, CoreWebVitals } from '../types.js'
import { getRateLimiter, withRateLimitAndRetry } from '../rate-limiter.js'

dotenv.config()

// Rate limiter for GA4 API
const ga4Limiter = getRateLimiter('ga4')

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_DATE_RANGE = 28 // days

// ============================================================================
// Auth Setup
// ============================================================================

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID_SEO
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET_SEO
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN_SEO

  if (!clientId || !clientSecret || !refreshToken) {
    return null
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return auth
}

// ============================================================================
// GA4 Status Type
// ============================================================================

export interface GA4Status {
  configured: boolean
  hasPropertyId: boolean
  hasData: boolean
  message: string
  propertyId?: string
}

// ============================================================================
// Date Helpers
// ============================================================================

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

// ============================================================================
// Main Client
// ============================================================================

/**
 * Check if GA4 is configured (credentials available)
 */
export function isGA4Configured(): boolean {
  return getAuth() !== null
}

/**
 * Get GA4 property ID from environment
 */
export function getGA4PropertyId(): string | undefined {
  return process.env.GA4_PROPERTY_ID
}

/**
 * Fetch GA4 data with graceful degradation
 * Returns null if not configured, empty data if no results
 */
export async function fetchGA4Data(
  siteUrl: string,
  dateRangeDays: number = DEFAULT_DATE_RANGE
): Promise<{ data: GA4Data | null; status: GA4Status }> {
  const auth = getAuth()
  const propertyId = getGA4PropertyId()

  if (!auth) {
    return {
      data: null,
      status: {
        configured: false,
        hasPropertyId: false,
        hasData: false,
        message: 'GA4 not configured (missing OAuth credentials)',
      },
    }
  }

  if (!propertyId) {
    return {
      data: null,
      status: {
        configured: true,
        hasPropertyId: false,
        hasData: false,
        message: 'GA4 property ID not set (add GA4_PROPERTY_ID to .env)',
      },
    }
  }

  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth })
  const dateRange = getDateRange(dateRangeDays)

  try {
    // Fetch overview metrics with rate limiting
    const overviewResponse = await withRateLimitAndRetry(
      ga4Limiter,
      () =>
        analyticsdata.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
            metrics: [
              { name: 'sessions' },
              { name: 'totalUsers' },
              { name: 'newUsers' },
              { name: 'bounceRate' },
              { name: 'averageSessionDuration' },
              { name: 'screenPageViewsPerSession' },
            ],
          },
        }),
      (attempt, error, delay) => {
        console.log(`  GA4 overview retry ${attempt}: ${error.message} (waiting ${delay}ms)`)
      }
    )

    // GA4 API returns data in 'rows' when no dimensions are specified
    const metricValues = overviewResponse.data.rows?.[0]?.metricValues || []
    const overview = {
      sessions: parseInt(metricValues[0]?.value || '0', 10),
      users: parseInt(metricValues[1]?.value || '0', 10),
      newUsers: parseInt(metricValues[2]?.value || '0', 10),
      bounceRate: parseFloat(metricValues[3]?.value || '0'),
      avgSessionDuration: parseFloat(metricValues[4]?.value || '0'),
      pagesPerSession: parseFloat(metricValues[5]?.value || '0'),
    }

    // Fetch page-level metrics with rate limiting
    const pageResponse = await withRateLimitAndRetry(
      ga4Limiter,
      () =>
        analyticsdata.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [
              { name: 'screenPageViews' },
              { name: 'bounceRate' },
              { name: 'averageSessionDuration' },
            ],
            limit: '100',
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          },
        }),
      (attempt, error, delay) => {
        console.log(`  GA4 pages retry ${attempt}: ${error.message} (waiting ${delay}ms)`)
      }
    )

    const pageMetrics: GA4PageMetrics[] = (pageResponse.data.rows || []).map((row) => ({
      pagePath: row.dimensionValues?.[0]?.value || '',
      pageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
      uniquePageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
      avgTimeOnPage: parseFloat(row.metricValues?.[2]?.value || '0'),
      bounceRate: parseFloat(row.metricValues?.[1]?.value || '0'),
      exitRate: 0,
    }))

    // Fetch traffic sources with rate limiting
    const trafficResponse = await withRateLimitAndRetry(
      ga4Limiter,
      () =>
        analyticsdata.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [{ startDate: `${dateRangeDays}daysAgo`, endDate: 'today' }],
            dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
            metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
            limit: '20',
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          },
        }),
      (attempt, error, delay) => {
        console.log(`  GA4 traffic retry ${attempt}: ${error.message} (waiting ${delay}ms)`)
      }
    )

    const trafficSources: TrafficSource[] = (trafficResponse.data.rows || []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || '(not set)',
      medium: row.dimensionValues?.[1]?.value || '(not set)',
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      bounceRate: parseFloat(row.metricValues?.[1]?.value || '0'),
    }))

    const hasData = overview.sessions > 0

    const data: GA4Data = {
      propertyId,
      dateRange,
      overview,
      pageMetrics,
      trafficSources,
      // Core Web Vitals would require CrUX API - skip for now
    }

    return {
      data,
      status: {
        configured: true,
        hasPropertyId: true,
        hasData,
        message: hasData
          ? `GA4: ${overview.sessions} sessions, ${pageMetrics.length} pages`
          : 'GA4 configured but no data in date range',
        propertyId,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check for common errors
    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
      return {
        data: null,
        status: {
          configured: true,
          hasPropertyId: true,
          hasData: false,
          message: 'GA4 API permission denied — check property access',
          propertyId,
        },
      }
    }

    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        data: null,
        status: {
          configured: true,
          hasPropertyId: true,
          hasData: false,
          message: `GA4 property ${propertyId} not found — verify property ID`,
          propertyId,
        },
      }
    }

    return {
      data: null,
      status: {
        configured: true,
        hasPropertyId: true,
        hasData: false,
        message: `GA4 API error: ${errorMessage}`,
        propertyId,
      },
    }
  }
}

/**
 * Get GA4 summary for CLI display
 * Shows detailed error reasons when available
 */
export function formatGA4Summary(status: GA4Status, data: GA4Data | null): string[] {
  const lines: string[] = []

  if (!status.configured) {
    lines.push('  ⬚ Google Analytics 4: Not configured')
    lines.push('     Missing: OAuth credentials (see GSC setup)')
    return lines
  }

  if (!status.hasPropertyId) {
    lines.push('  ⬚ Google Analytics 4: Property ID not set')
    lines.push('     Add GA4_PROPERTY_ID=<numeric-id> to .env')
    lines.push('     Find it: Analytics → Admin → Property Settings')
    return lines
  }

  if (!status.hasData) {
    // Show detailed error reason with specific icon
    if (status.message.includes('permission')) {
      lines.push(`  ❌ Google Analytics 4: Permission denied`)
      lines.push('     Check that your OAuth token has analytics.readonly scope')
    } else if (status.message.includes('not found')) {
      lines.push(`  ❌ Google Analytics 4: Property not found`)
      lines.push(`     Verify GA4_PROPERTY_ID=${status.propertyId} is correct`)
    } else if (status.message.includes('API error')) {
      lines.push(`  ❌ Google Analytics 4: ${status.message}`)
    } else {
      lines.push(`  ⏳ Google Analytics 4: ${status.message}`)
    }
    return lines
  }

  if (data) {
    const { overview } = data
    const bouncePercent = (overview.bounceRate * 100).toFixed(1)
    const avgDuration = Math.round(overview.avgSessionDuration)

    lines.push(`  ✅ Google Analytics 4: ${overview.sessions} sessions`)
    lines.push(`     Users: ${overview.users} (${overview.newUsers} new)`)
    lines.push(`     Bounce: ${bouncePercent}% | Avg duration: ${avgDuration}s`)

    // Top traffic sources
    if (data.trafficSources.length > 0) {
      const topSources = data.trafficSources.slice(0, 3)
      lines.push('     Top sources:')
      topSources.forEach((s) => {
        lines.push(`       ${s.source}/${s.medium}: ${s.sessions} sessions`)
      })
    }
  }

  return lines
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
  options: { minPageViews?: number; minBounceRate?: number } = {}
): GA4PageMetrics[] {
  const { minPageViews = 50, minBounceRate = 0.7 } = options
  return pages.filter((p) => p.pageViews >= minPageViews && p.bounceRate >= minBounceRate)
}

/**
 * Get top pages by engagement (low bounce, high time on page)
 */
export function getTopEngagedPages(pages: GA4PageMetrics[], limit: number = 10): GA4PageMetrics[] {
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
