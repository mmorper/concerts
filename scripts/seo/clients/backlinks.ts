/**
 * Backlink Provider Interface
 *
 * Defines the common interface for backlink data providers (Ahrefs, SEMrush).
 */

import { loadCredentials, hasBacklinkCredentials } from '../credentials.js'
import { readCache, writeCache, hasValidCache } from '../cache.js'
import type { BacklinkData } from '../types.js'

// ============================================================================
// Provider Interface
// ============================================================================

export interface BacklinkProvider {
  name: 'ahrefs' | 'semrush'
  isConfigured(): boolean
  fetchMetrics(domain: string): Promise<BacklinkData>
}

// ============================================================================
// Ahrefs Provider
// ============================================================================

const AHREFS_API_BASE = 'https://api.ahrefs.com/v3'

export class AhrefsProvider implements BacklinkProvider {
  name = 'ahrefs' as const
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async fetchMetrics(domain: string): Promise<BacklinkData> {
    // Domain Rating
    const drResponse = await this.request('/site-explorer/domain-rating', { target: domain })

    // Backlink stats
    const statsResponse = await this.request('/site-explorer/backlinks-stats', { target: domain })

    // Top referring domains
    const refDomainsResponse = await this.request('/site-explorer/refdomains', {
      target: domain,
      limit: 20,
      order_by: 'domain_rating:desc',
    })

    // New/lost backlinks (last 30 days)
    const newBacklinks = await this.request('/site-explorer/new-backlinks', {
      target: domain,
      date_from: this.getDateDaysAgo(30),
      limit: 1,
    })

    const lostBacklinks = await this.request('/site-explorer/lost-backlinks', {
      target: domain,
      date_from: this.getDateDaysAgo(30),
      limit: 1,
    })

    return {
      provider: 'ahrefs',
      domain,
      metrics: {
        domainRating: drResponse.domain_rating || 0,
        totalBacklinks: statsResponse.backlinks || 0,
        referringDomains: statsResponse.refdomains || 0,
        followLinks: statsResponse.dofollow || 0,
        nofollowLinks: statsResponse.nofollow || 0,
      },
      topReferrers: (refDomainsResponse.refdomains || []).map((rd: any) => ({
        domain: rd.domain,
        backlinks: rd.backlinks,
        domainRating: rd.domain_rating,
      })),
      newBacklinks: {
        last7Days: 0, // Would need separate API call
        last30Days: newBacklinks.total || 0,
      },
      lostBacklinks: {
        last7Days: 0,
        last30Days: lostBacklinks.total || 0,
      },
    }
  }

  private async request(endpoint: string, params: Record<string, any>): Promise<any> {
    const url = new URL(`${AHREFS_API_BASE}${endpoint}`)

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ahrefs API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  private getDateDaysAgo(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().split('T')[0]
  }
}

// ============================================================================
// SEMrush Provider
// ============================================================================

const SEMRUSH_API_BASE = 'https://api.semrush.com'

export class SEMrushProvider implements BacklinkProvider {
  name = 'semrush' as const
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async fetchMetrics(domain: string): Promise<BacklinkData> {
    // Domain overview
    const overviewResponse = await this.request('backlinks_overview', {
      target: domain,
      target_type: 'root_domain',
    })

    // Referring domains
    const refDomainsResponse = await this.request('backlinks_refdomains', {
      target: domain,
      target_type: 'root_domain',
      display_limit: 20,
    })

    const overview = this.parseOverviewResponse(overviewResponse)
    const refDomains = this.parseRefDomainsResponse(refDomainsResponse)

    return {
      provider: 'semrush',
      domain,
      metrics: {
        authorityScore: overview.authorityScore,
        totalBacklinks: overview.totalBacklinks,
        referringDomains: overview.referringDomains,
        followLinks: overview.followLinks,
        nofollowLinks: overview.nofollowLinks,
      },
      topReferrers: refDomains,
      newBacklinks: {
        last7Days: 0, // Would need separate API call
        last30Days: 0,
      },
      lostBacklinks: {
        last7Days: 0,
        last30Days: 0,
      },
    }
  }

  private async request(type: string, params: Record<string, any>): Promise<string> {
    const url = new URL(SEMRUSH_API_BASE)
    url.searchParams.set('key', this.apiKey)
    url.searchParams.set('type', type)
    url.searchParams.set('export_columns', 'ascore,total,domains_num,follows_num,nofollows_num')

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })

    const response = await fetch(url.toString())

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SEMrush API error (${response.status}): ${error}`)
    }

    return response.text()
  }

  private parseOverviewResponse(response: string): {
    authorityScore: number
    totalBacklinks: number
    referringDomains: number
    followLinks: number
    nofollowLinks: number
  } {
    // SEMrush returns CSV format
    const lines = response.trim().split('\n')
    if (lines.length < 2) {
      return {
        authorityScore: 0,
        totalBacklinks: 0,
        referringDomains: 0,
        followLinks: 0,
        nofollowLinks: 0,
      }
    }

    const values = lines[1].split(';')
    return {
      authorityScore: parseInt(values[0] || '0', 10),
      totalBacklinks: parseInt(values[1] || '0', 10),
      referringDomains: parseInt(values[2] || '0', 10),
      followLinks: parseInt(values[3] || '0', 10),
      nofollowLinks: parseInt(values[4] || '0', 10),
    }
  }

  private parseRefDomainsResponse(response: string): Array<{
    domain: string
    backlinks: number
    domainRating?: number
  }> {
    const lines = response.trim().split('\n')
    if (lines.length < 2) return []

    // Skip header line
    return lines.slice(1).map((line) => {
      const values = line.split(';')
      return {
        domain: values[0] || '',
        backlinks: parseInt(values[1] || '0', 10),
      }
    })
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Get the configured backlink provider (if any)
 */
export function getBacklinkProvider(): BacklinkProvider | null {
  const credentials = loadCredentials()

  if (credentials.ahrefs?.apiKey) {
    return new AhrefsProvider(credentials.ahrefs.apiKey)
  }

  if (credentials.semrush?.apiKey) {
    return new SEMrushProvider(credentials.semrush.apiKey)
  }

  return null
}

/**
 * Check if backlink API is configured
 */
export function isBacklinkConfigured(): boolean {
  return hasBacklinkCredentials() !== null
}

/**
 * Get the name of the configured backlink provider
 */
export function getConfiguredProviderName(): 'ahrefs' | 'semrush' | null {
  return hasBacklinkCredentials()
}

// ============================================================================
// Main Client Interface
// ============================================================================

/**
 * Fetch backlink data for a domain
 */
export async function fetchBacklinkData(
  siteUrl: string,
  useCache: boolean = true
): Promise<BacklinkData | null> {
  const provider = getBacklinkProvider()

  if (!provider) {
    return null
  }

  const domain = new URL(siteUrl).hostname

  // Check cache first
  if (useCache && hasValidCache(domain, 'backlinks')) {
    const cached = readCache<BacklinkData>(domain, 'backlinks')
    if (cached) {
      console.log(`  📋 Using cached ${provider.name} data`)
      return cached
    }
  }

  console.log(`  🔗 Fetching ${provider.name} backlink data...`)

  try {
    const data = await provider.fetchMetrics(domain)

    // Cache the results
    writeCache(domain, 'backlinks', data)

    const authority = data.metrics.domainRating ?? data.metrics.authorityScore ?? 0
    console.log(`  ✅ Backlinks: ${data.metrics.referringDomains} domains, ${authority} DR/AS`)

    return data
  } catch (error) {
    console.error(`  ❌ ${provider.name} fetch failed:`, error)
    return null
  }
}
