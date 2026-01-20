/**
 * SEO Tool v2 Type Definitions
 *
 * Core interfaces for the comprehensive SEO analysis platform.
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface SEOAnalysisConfig {
  // Target
  url: string

  // Data sources (all optional, graceful degradation)
  googleSearchConsole?: {
    enabled: boolean
    propertyUrl?: string // If different from url
    dateRange: number // Days to look back (default: 28)
  }
  googleAnalytics?: {
    enabled: boolean
    propertyId?: string // GA4 property ID
    dateRange: number // Days to look back (default: 28)
  }
  backlinks?: {
    provider: 'ahrefs' | 'semrush' | 'none'
    enabled: boolean
  }

  // Output
  output: OutputFormat[]
  baseline: boolean
  compare?: string // Date string YYYY-MM-DD

  // Caching
  cacheDir: string
  cacheTtl: number // Days (default: 7 for API responses)
}

export type OutputFormat = 'cli' | 'md' | 'html' | 'json' | 'csv' | 'sheets'

// ============================================================================
// Credential Types
// ============================================================================

export interface CredentialStore {
  version: number

  // Google OAuth (shared for GSC and GA4)
  google?: {
    clientId: string
    clientSecret: string
    refreshToken?: string
    accessToken?: string
    expiresAt?: number
  }

  // Backlink APIs (simple API keys)
  ahrefs?: {
    apiKey: string
  }
  semrush?: {
    apiKey: string
  }

  // Site-specific property mappings
  properties?: Record<
    string,
    {
      gscProperty?: string
      ga4PropertyId?: string
    }
  >
}

export interface CredentialSource {
  type: 'env' | 'file' | 'oauth'
  google: boolean
  ahrefs: boolean
  semrush: boolean
}

// ============================================================================
// Data Source Types
// ============================================================================

export interface GSCData {
  property: string
  dateRange: { start: string; end: string }
  pages: GSCPageMetrics[]
  queries: GSCQueryMetrics[]
  indexCoverage: {
    valid: number
    warning: number
    error: number
    excluded: number
  }
}

export interface GSCPageMetrics {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCQueryMetrics {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GA4Data {
  propertyId: string
  dateRange: { start: string; end: string }
  overview: {
    sessions: number
    users: number
    newUsers: number
    bounceRate: number
    avgSessionDuration: number
    pagesPerSession: number
  }
  pageMetrics: GA4PageMetrics[]
  coreWebVitals?: CoreWebVitals
  trafficSources: TrafficSource[]
}

export interface GA4PageMetrics {
  pagePath: string
  pageViews: number
  uniquePageViews: number
  avgTimeOnPage: number
  bounceRate: number
  exitRate: number
}

export interface CoreWebVitals {
  lcp: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
  fid: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
  cls: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
  inp: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
}

export interface TrafficSource {
  source: string
  medium: string
  sessions: number
  bounceRate: number
}

export interface BacklinkData {
  provider: 'ahrefs' | 'semrush'
  domain: string
  metrics: {
    domainRating?: number // Ahrefs DR (0-100)
    authorityScore?: number // SEMrush AS (0-100)
    totalBacklinks: number
    referringDomains: number
    followLinks: number
    nofollowLinks: number
  }
  topReferrers: Array<{
    domain: string
    backlinks: number
    domainRating?: number
  }>
  newBacklinks?: {
    last7Days: number
    last30Days: number
  }
  lostBacklinks?: {
    last7Days: number
    last30Days: number
  }
}

// ============================================================================
// Page Analysis Types
// ============================================================================

export interface PageAnalysis {
  url: string
  title: string | null
  titleLength: number
  description: string | null
  descriptionLength: number
  h1Count: number
  h1Text: string | null
  hasSchema: boolean
  schemaTypes: string[]
  hasOG: boolean
  hasCanonical: boolean
  canonicalUrl: string | null
  responseTime: number
  htmlSize: number
  wordCount: number
  internalLinks: number
  externalLinks: number
  images: {
    total: number
    withAlt: number
    missingAlt: number
    lazyLoaded: number
  }
}

// ============================================================================
// Insight Types
// ============================================================================

export type InsightType =
  | 'content_gap' // Good structure, no impressions
  | 'ctr_opportunity' // Good ranking, low CTR
  | 'engagement_mismatch' // Good traffic, high bounce
  | 'technical_reality' // Lab vs field performance gap
  | 'zombie_page' // Impressions but no clicks/traffic
  | 'authority_mismatch' // High backlinks, low rankings
  | 'linkworthy_content' // High engagement, few backlinks
  | 'cannibalizing_pages' // Multiple pages competing for same queries
  | 'duplicate_content' // GSC duplicate warnings

export interface CorrelationInsight {
  type: InsightType
  severity: 'critical' | 'warning' | 'opportunity'
  title: string
  description: string
  affectedPages: string[]
  dataSources: string[] // Which sources contributed to this insight
  recommendation: string
  estimatedImpact: 'high' | 'medium' | 'low'
}

// ============================================================================
// Playbook Types
// ============================================================================

export interface ActionablePlaybook {
  insight: CorrelationInsight

  diagnosis: {
    current: string // Current state (with actual values)
    expected: string // What good looks like
    gap: string // Quantified difference
  }

  fix: {
    summary: string // One-line action
    steps: string[] // Numbered steps
    codeSnippet?: string // Copy-paste code if applicable
    fileToEdit?: string // Exact file path
    toolsNeeded?: string[] // External tools required
  }

  impact: {
    metric: string // What will improve
    estimate: string // Expected improvement range
    timeframe: string // When to expect results
  }

  verification: {
    method: string // How to check
    target: string // Success threshold
    checkAfter: string // When to re-check
  }
}

// ============================================================================
// Score Types
// ============================================================================

export interface SEOScore {
  overall: number // 0-100
  technical: number // 0-25
  content: number // 0-30
  semantic: number // 0-20
  authority: number // 0-15
  ux: number // 0-10
  aiReadiness: number // 0-10 (bonus)
  confidence: number // 0-100 (based on data sources available)
}

// ============================================================================
// Report Types
// ============================================================================

export interface SEOReport {
  metadata: {
    date: string
    url: string
    pagesAnalyzed: number
    version: string
    dataSources: {
      crawl: boolean
      gsc: boolean
      ga4: boolean
      backlinks: 'ahrefs' | 'semrush' | 'none'
    }
    dateRange: { start: string; end: string }
    confidence: number
  }

  scores: SEOScore

  // Raw data from each source
  crawlData: PageAnalysis[]
  gscData?: GSCData
  ga4Data?: GA4Data
  backlinkData?: BacklinkData

  // Cross-source insights
  insights: CorrelationInsight[]

  // Playbooks for actionable fixes
  playbooks: ActionablePlaybook[]

  // Prioritized recommendations
  recommendations: Recommendation[]

  // Checks performed (for display)
  checks: Record<string, boolean | number | string>
}

export interface Recommendation {
  category: 'quick-win' | 'strategic' | 'optional'
  insight?: CorrelationInsight // Link to source insight
  title: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
  points: number
  description: string
  affectedPages?: string[]
}

// ============================================================================
// Analysis Context
// ============================================================================

export interface AnalysisContext {
  config: SEOAnalysisConfig
  crawlData: PageAnalysis[]
  gscData?: GSCData
  ga4Data?: GA4Data
  backlinkData?: BacklinkData
  siteStats: SiteStats
  avgCTR: number
  avgBounceRate: number
}

export interface SiteStats {
  concertCount: number
  artistCount: number
  venueCount: number
  cityCount: number
  firstYear: number
  yearSpan: number
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // in days
}

export interface CacheMetadata {
  domain: string
  type: 'crawl' | 'gsc' | 'ga4' | 'backlinks'
  date: string
}
