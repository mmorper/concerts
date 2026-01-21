/**
 * Backlink Client (Simple)
 *
 * Wrapper around backlinks.ts with graceful degradation.
 * Designed to match the pattern of gsc-simple.ts and ga4-simple.ts.
 */

import {
  isBacklinkConfigured,
  getConfiguredProviderName,
  fetchBacklinkData as fetchBacklinkDataInternal,
} from './backlinks.js'
import type { BacklinkData } from '../types.js'

// ============================================================================
// Status Type
// ============================================================================

export interface BacklinkStatus {
  configured: boolean
  provider: 'ahrefs' | 'semrush' | null
  hasData: boolean
  message: string
}

// ============================================================================
// Main Client
// ============================================================================

/**
 * Check if any backlink provider is configured
 */
export function isBacklinksConfigured(): boolean {
  return isBacklinkConfigured()
}

/**
 * Get configured provider name
 */
export function getBacklinkProvider(): 'ahrefs' | 'semrush' | null {
  return getConfiguredProviderName()
}

/**
 * Fetch backlink data with graceful degradation
 * Returns null if not configured, empty data if API fails
 */
export async function fetchBacklinkData(
  siteUrl: string
): Promise<{ data: BacklinkData | null; status: BacklinkStatus }> {
  const provider = getConfiguredProviderName()

  if (!provider) {
    return {
      data: null,
      status: {
        configured: false,
        provider: null,
        hasData: false,
        message: 'No backlink API configured (add AHREFS_API_KEY or SEMRUSH_API_KEY to .env)',
      },
    }
  }

  try {
    const data = await fetchBacklinkDataInternal(siteUrl, false) // Don't use cache for now

    if (!data) {
      return {
        data: null,
        status: {
          configured: true,
          provider,
          hasData: false,
          message: `${provider} API call failed — check API key and quota`,
        },
      }
    }

    const authority = data.metrics.domainRating ?? data.metrics.authorityScore ?? 0

    return {
      data,
      status: {
        configured: true,
        provider,
        hasData: true,
        message: `${provider}: DR/AS ${authority}, ${data.metrics.referringDomains} referring domains`,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return {
      data: null,
      status: {
        configured: true,
        provider,
        hasData: false,
        message: `${provider} API error: ${errorMessage}`,
      },
    }
  }
}

/**
 * Format backlink summary for CLI display
 * Shows detailed error reasons when available
 */
export function formatBacklinkSummary(status: BacklinkStatus, data: BacklinkData | null): string[] {
  const lines: string[] = []

  if (!status.configured) {
    lines.push('  ⬚ Backlinks: Not configured')
    lines.push('     Add AHREFS_API_KEY or SEMRUSH_API_KEY to .env')
    return lines
  }

  if (!status.hasData) {
    // Show detailed error reason with specific icon
    if (status.message.includes('API error') || status.message.includes('failed')) {
      lines.push(`  ❌ Backlinks (${status.provider}): API error`)
      if (status.message.includes('401') || status.message.includes('403')) {
        lines.push('     Check API key validity and quota')
      } else if (status.message.includes('429') || status.message.includes('rate')) {
        lines.push('     Rate limit exceeded — try again later')
      } else {
        lines.push(`     ${status.message}`)
      }
    } else {
      lines.push(`  ⏳ Backlinks (${status.provider}): ${status.message}`)
    }
    return lines
  }

  if (data) {
    const authority = data.metrics.domainRating ?? data.metrics.authorityScore ?? 0
    const authorityLabel = data.provider === 'ahrefs' ? 'DR' : 'AS'

    lines.push(`  ✅ Backlinks (${data.provider}): ${authorityLabel} ${authority}`)
    lines.push(`     Referring domains: ${data.metrics.referringDomains}`)
    lines.push(`     Total backlinks: ${data.metrics.totalBacklinks}`)
    lines.push(`     Follow/Nofollow: ${data.metrics.followLinks}/${data.metrics.nofollowLinks}`)

    // Show new/lost if available
    if (data.newBacklinks && (data.newBacklinks.last30Days > 0 || data.lostBacklinks?.last30Days)) {
      const gained = data.newBacklinks.last30Days
      const lost = data.lostBacklinks?.last30Days ?? 0
      const net = gained - lost
      const netSign = net >= 0 ? '+' : ''
      lines.push(`     Last 30d: +${gained} / -${lost} (net ${netSign}${net})`)
    }

    // Top referrers
    if (data.topReferrers.length > 0) {
      lines.push('     Top referrers:')
      data.topReferrers.slice(0, 3).forEach((ref) => {
        const dr = ref.domainRating ? ` (DR ${ref.domainRating})` : ''
        lines.push(`       ${ref.domain}${dr}: ${ref.backlinks} links`)
      })
    }
  }

  return lines
}
