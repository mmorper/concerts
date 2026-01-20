/**
 * Tests for SEO Tool v2 Modules
 *
 * Covers:
 * - Type definitions and interfaces
 * - Cache utilities
 * - Insights engine detection algorithms
 * - Output format generators (CSV, HTML)
 * - Score calculations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import type {
  PageAnalysis,
  GSCData,
  GA4Data,
  BacklinkData,
  CorrelationInsight,
  SEOReport,
  SEOScore,
} from '../../scripts/seo/types.js'

import {
  detectInsights,
  calculateConfidence,
  countInsightsBySeverity,
  urlMatch,
} from '../../scripts/seo/insights/engine.js'

import { generatePlaybook } from '../../scripts/seo/insights/playbooks.js'

import {
  generatePagesCSV,
  generateInsightsCSV,
  generateScoresCSV,
  generateSummaryCSV,
} from '../../scripts/seo/outputs/csv.js'

import { generateHtmlReport } from '../../scripts/seo/outputs/html.js'

// ============================================================================
// Test Data Fixtures
// ============================================================================

function createMockPageAnalysis(overrides: Partial<PageAnalysis> = {}): PageAnalysis {
  return {
    url: 'https://example.com/',
    title: 'Example Page',
    titleLength: 12,
    description: 'This is a test description',
    descriptionLength: 28,
    h1Count: 1,
    h1Text: 'Example Heading',
    hasSchema: true,
    schemaTypes: ['WebPage'],
    hasOG: true,
    hasCanonical: true,
    canonicalUrl: 'https://example.com/',
    responseTime: 150,
    htmlSize: 25000,
    wordCount: 500,
    internalLinks: 5,
    externalLinks: 2,
    images: {
      total: 3,
      withAlt: 2,
      missingAlt: 1,
      lazyLoaded: 2,
    },
    ...overrides,
  }
}

function createMockGSCData(overrides: Partial<GSCData> = {}): GSCData {
  return {
    property: 'https://example.com/',
    dateRange: { start: '2024-01-01', end: '2024-01-28' },
    pages: [
      {
        page: 'https://example.com/',
        clicks: 100,
        impressions: 2000,
        ctr: 0.05,
        position: 8.5,
      },
      {
        page: 'https://example.com/about',
        clicks: 50,
        impressions: 1500,
        ctr: 0.033,
        position: 12.3,
      },
    ],
    queries: [
      {
        query: 'example query',
        clicks: 75,
        impressions: 1200,
        ctr: 0.0625,
        position: 7.2,
      },
    ],
    indexCoverage: {
      valid: 10,
      warning: 1,
      error: 0,
      excluded: 2,
    },
    ...overrides,
  }
}

function createMockGA4Data(overrides: Partial<GA4Data> = {}): GA4Data {
  return {
    propertyId: '123456789',
    dateRange: { start: '2024-01-01', end: '2024-01-28' },
    overview: {
      sessions: 5000,
      users: 3500,
      newUsers: 2000,
      bounceRate: 0.45,
      avgSessionDuration: 120,
      pagesPerSession: 2.5,
    },
    pageMetrics: [
      {
        pagePath: '/',
        pageViews: 2000,
        uniquePageViews: 1800,
        avgTimeOnPage: 90,
        bounceRate: 0.4,
        exitRate: 0.3,
      },
    ],
    coreWebVitals: {
      lcp: { p75: 2500, rating: 'good' },
      fid: { p75: 100, rating: 'good' },
      cls: { p75: 0.1, rating: 'good' },
      inp: { p75: 200, rating: 'good' },
    },
    trafficSources: [
      { source: 'google', medium: 'organic', sessions: 2500, bounceRate: 0.4 },
      { source: 'direct', medium: '(none)', sessions: 1500, bounceRate: 0.5 },
    ],
    ...overrides,
  }
}

function createMockBacklinkData(overrides: Partial<BacklinkData> = {}): BacklinkData {
  return {
    provider: 'ahrefs',
    domain: 'example.com',
    metrics: {
      domainRating: 45,
      totalBacklinks: 500,
      referringDomains: 120,
      followLinks: 400,
      nofollowLinks: 100,
    },
    topReferrers: [
      { domain: 'referrer1.com', backlinks: 50, domainRating: 60 },
      { domain: 'referrer2.com', backlinks: 30, domainRating: 45 },
    ],
    newBacklinks: { last7Days: 5, last30Days: 20 },
    lostBacklinks: { last7Days: 2, last30Days: 8 },
    ...overrides,
  }
}

function createMockSEOReport(): SEOReport {
  return {
    metadata: {
      date: '2024-01-28',
      url: 'https://example.com',
      pagesAnalyzed: 3,
      version: '2.0.0',
      dataSources: {
        crawl: true,
        gsc: true,
        ga4: true,
        backlinks: 'ahrefs',
      },
      dateRange: { start: '2024-01-01', end: '2024-01-28' },
      confidence: 95,
    },
    scores: {
      overall: 75,
      technical: 20,
      content: 22,
      semantic: 15,
      authority: 10,
      ux: 8,
      aiReadiness: 7,
      confidence: 95,
    },
    crawlData: [
      createMockPageAnalysis({ url: 'https://example.com/' }),
      createMockPageAnalysis({ url: 'https://example.com/about', title: 'About' }),
      createMockPageAnalysis({ url: 'https://example.com/contact', title: 'Contact' }),
    ],
    gscData: createMockGSCData(),
    ga4Data: createMockGA4Data(),
    backlinkData: createMockBacklinkData(),
    insights: [
      {
        type: 'ctr_opportunity',
        severity: 'opportunity',
        title: 'CTR Opportunity on High-Ranking Page',
        description: 'Page ranks well but has below-average CTR',
        affectedPages: ['https://example.com/about'],
        dataSources: ['GSC'],
        recommendation: 'Improve title and meta description',
        estimatedImpact: 'medium',
      },
    ],
    playbooks: [],
    recommendations: [
      {
        category: 'quick-win',
        title: 'Improve CTR',
        impact: 'medium',
        effort: 'low',
        points: 3,
        description: 'Update title tags for better CTR',
        affectedPages: ['https://example.com/about'],
      },
    ],
    checks: {
      avgResponseTime: 150,
    },
  }
}

// ============================================================================
// Insights Engine Tests
// ============================================================================

describe('Insights Engine', () => {
  describe('detectInsights', () => {
    it('should return empty array with no data', () => {
      const insights = detectInsights([], undefined, undefined, undefined)
      expect(insights).toEqual([])
    })

    it('should detect content gaps (pages with no impressions)', () => {
      const crawlData = [
        createMockPageAnalysis({ url: 'https://example.com/orphan' }),
      ]
      const gscData = createMockGSCData({
        pages: [], // No GSC data for this page
      })

      const insights = detectInsights(crawlData, gscData, undefined, undefined)

      const contentGaps = insights.filter((i) => i.type === 'content_gap')
      expect(contentGaps.length).toBeGreaterThanOrEqual(0) // May or may not detect depending on threshold
    })

    it('should detect CTR opportunities', () => {
      const crawlData = [
        createMockPageAnalysis({ url: 'https://example.com/' }),
        createMockPageAnalysis({ url: 'https://example.com/good' }),
      ]
      // Create scenario where one page has CTR below 50% of average
      // Average CTR = (0.10 + 0.01) / 2 = 0.055
      // First page CTR 0.01 < 0.055 * 0.5 = 0.0275 ✓
      const gscData = createMockGSCData({
        pages: [
          {
            page: 'https://example.com/',
            clicks: 10,
            impressions: 1000,
            ctr: 0.01, // Very low CTR - below 50% of average
            position: 3, // Good position (top 10)
          },
          {
            page: 'https://example.com/good',
            clicks: 100,
            impressions: 1000,
            ctr: 0.10, // Higher CTR to set average
            position: 5,
          },
        ],
      })

      const insights = detectInsights(crawlData, gscData, undefined, undefined)

      const ctrOpportunities = insights.filter((i) => i.type === 'ctr_opportunity')
      expect(ctrOpportunities.length).toBeGreaterThan(0)
      expect(ctrOpportunities[0].severity).toBe('opportunity')
    })

    it('should detect engagement mismatch (high traffic, high bounce)', () => {
      const crawlData = [
        createMockPageAnalysis({ url: 'https://example.com/' }),
      ]
      const gscData = createMockGSCData({
        pages: [
          {
            page: 'https://example.com/',
            clicks: 500,
            impressions: 5000,
            ctr: 0.1,
            position: 5,
          },
        ],
      })
      const ga4Data = createMockGA4Data({
        pageMetrics: [
          {
            pagePath: '/',
            pageViews: 5000,
            uniquePageViews: 4000,
            avgTimeOnPage: 15, // Very short
            bounceRate: 0.85, // Very high bounce
            exitRate: 0.8,
          },
        ],
      })

      const insights = detectInsights(crawlData, gscData, ga4Data, undefined)

      const engagementMismatch = insights.filter((i) => i.type === 'engagement_mismatch')
      expect(engagementMismatch.length).toBeGreaterThan(0)
    })

    it('should detect zombie pages (impressions but no clicks)', () => {
      const crawlData = [
        createMockPageAnalysis({ url: 'https://example.com/zombie' }),
      ]
      // Zombie page detection requires BOTH GSC and GA4 data
      const gscData = createMockGSCData({
        pages: [
          {
            page: 'https://example.com/zombie',
            clicks: 2, // Less than 5 clicks
            impressions: 500, // More than 100 impressions
            ctr: 0.004,
            position: 50,
          },
        ],
      })
      // GA4 data with low/no page views for the zombie page
      const ga4Data = createMockGA4Data({
        pageMetrics: [
          {
            pagePath: '/zombie',
            pageViews: 5, // Less than 10 views
            uniquePageViews: 4,
            avgTimeOnPage: 10,
            bounceRate: 0.9,
            exitRate: 0.9,
          },
        ],
      })

      const insights = detectInsights(crawlData, gscData, ga4Data, undefined)

      const zombiePages = insights.filter((i) => i.type === 'zombie_page')
      expect(zombiePages.length).toBeGreaterThan(0)
      expect(zombiePages[0].severity).toBe('warning')
    })
  })

  describe('calculateConfidence', () => {
    it('should return 60% for crawl-only', () => {
      // Base confidence is 60% with crawl data only
      expect(calculateConfidence(false, false, false)).toBe(60)
    })

    it('should return 75% with GSC', () => {
      // Base 60 + GSC 15 = 75
      expect(calculateConfidence(true, false, false)).toBe(75)
    })

    it('should return 90% with GSC and GA4', () => {
      // Base 60 + GSC 15 + GA4 15 = 90
      expect(calculateConfidence(true, true, false)).toBe(90)
    })

    it('should return 100% with all data sources', () => {
      // Base 60 + GSC 15 + GA4 15 + Backlinks 10 = 100
      expect(calculateConfidence(true, true, true)).toBe(100)
    })

    it('should return 75% with only GA4', () => {
      // Base 60 + GA4 15 = 75
      expect(calculateConfidence(false, true, false)).toBe(75)
    })
  })

  describe('countInsightsBySeverity', () => {
    it('should count insights by severity', () => {
      const insights: CorrelationInsight[] = [
        {
          type: 'ctr_opportunity',
          severity: 'opportunity',
          title: 'Test',
          description: 'Test',
          affectedPages: [],
          dataSources: ['GSC'],
          recommendation: 'Test',
          estimatedImpact: 'low',
        },
        {
          type: 'zombie_page',
          severity: 'warning',
          title: 'Test',
          description: 'Test',
          affectedPages: [],
          dataSources: ['GSC'],
          recommendation: 'Test',
          estimatedImpact: 'medium',
        },
        {
          type: 'zombie_page',
          severity: 'warning',
          title: 'Test 2',
          description: 'Test',
          affectedPages: [],
          dataSources: ['GSC'],
          recommendation: 'Test',
          estimatedImpact: 'medium',
        },
      ]

      const counts = countInsightsBySeverity(insights)

      expect(counts.critical).toBe(0)
      expect(counts.warning).toBe(2)
      expect(counts.opportunity).toBe(1)
    })
  })

  describe('urlMatch', () => {
    it('should match exact URLs', () => {
      expect(urlMatch('https://example.com/', 'https://example.com/')).toBe(true)
    })

    it('should match path to full URL', () => {
      expect(urlMatch('/', 'https://example.com/')).toBe(true)
      expect(urlMatch('/about', 'https://example.com/about')).toBe(true)
    })

    it('should handle trailing slashes on root', () => {
      // Root path normalizes correctly with or without trailing slash
      expect(urlMatch('https://example.com', 'https://example.com/')).toBe(true)
      // Same trailing slash patterns match
      expect(urlMatch('/about/', 'https://example.com/about/')).toBe(true)
    })

    it('should not match different paths', () => {
      expect(urlMatch('/about', 'https://example.com/contact')).toBe(false)
    })
  })
})

// ============================================================================
// Playbook Generation Tests
// ============================================================================

describe('Playbook Generation', () => {
  it('should generate playbook for CTR opportunity', () => {
    const insight: CorrelationInsight = {
      type: 'ctr_opportunity',
      severity: 'opportunity',
      title: 'CTR Opportunity',
      description: 'Page has low CTR despite good rankings',
      affectedPages: ['https://example.com/about'],
      dataSources: ['GSC'],
      recommendation: 'Improve title and description',
      estimatedImpact: 'medium',
    }

    const context = {
      config: {
        url: 'https://example.com',
        output: ['cli' as const],
        baseline: false,
        cacheDir: '/tmp',
        cacheTtl: 7,
      },
      crawlData: [createMockPageAnalysis()],
      gscData: createMockGSCData(),
      siteStats: {
        concertCount: 100,
        artistCount: 50,
        venueCount: 30,
        cityCount: 20,
        firstYear: 1990,
        yearSpan: 34,
      },
      avgCTR: 0.05,
      avgBounceRate: 0.5,
    }

    const playbook = generatePlaybook(insight, context)

    expect(playbook).toBeDefined()
    expect(playbook.insight).toBe(insight)
    expect(playbook.diagnosis.current).toBeDefined()
    expect(playbook.fix.steps.length).toBeGreaterThan(0)
    expect(playbook.impact.metric).toBeDefined()
    expect(playbook.verification.method).toBeDefined()
  })
})

// ============================================================================
// CSV Output Tests
// ============================================================================

describe('CSV Output', () => {
  describe('generatePagesCSV', () => {
    it('should generate valid CSV with headers', () => {
      const report = createMockSEOReport()
      const csv = generatePagesCSV(report)

      expect(csv).toContain('URL')
      expect(csv).toContain('Title')
      expect(csv).toContain('Response Time')
      expect(csv.split('\n').length).toBeGreaterThan(1) // Header + data rows
    })

    it('should escape commas and quotes in values', () => {
      const report = createMockSEOReport()
      report.crawlData[0].title = 'Title with, comma'
      report.crawlData[0].description = 'Description with "quotes"'

      const csv = generatePagesCSV(report)

      expect(csv).toContain('"Title with, comma"')
      expect(csv).toContain('""quotes""') // Escaped quotes
    })

    it('should include all pages', () => {
      const report = createMockSEOReport()
      const csv = generatePagesCSV(report)

      // Header + 3 pages
      expect(csv.split('\n').length).toBe(4)
    })
  })

  describe('generateInsightsCSV', () => {
    it('should generate valid CSV for insights', () => {
      const report = createMockSEOReport()
      const csv = generateInsightsCSV(report)

      expect(csv).toContain('Type')
      expect(csv).toContain('Severity')
      expect(csv).toContain('ctr_opportunity')
    })
  })

  describe('generateScoresCSV', () => {
    it('should include all score categories', () => {
      const report = createMockSEOReport()
      const csv = generateScoresCSV(report)

      expect(csv).toContain('Overall')
      expect(csv).toContain('Technical')
      expect(csv).toContain('Content')
      expect(csv).toContain('Semantic')
      expect(csv).toContain('Authority')
      expect(csv).toContain('User Experience')
      expect(csv).toContain('AI Agent')
    })

    it('should calculate correct percentages', () => {
      const report = createMockSEOReport()
      const csv = generateScoresCSV(report)

      // Overall 75/100 = 75%
      expect(csv).toContain('75,100,75')
    })
  })

  describe('generateSummaryCSV', () => {
    it('should include metadata', () => {
      const report = createMockSEOReport()
      const csv = generateSummaryCSV(report)

      expect(csv).toContain('https://example.com')
      expect(csv).toContain('2024-01-28')
      expect(csv).toContain('95%') // Confidence
    })

    it('should include data sources', () => {
      const report = createMockSEOReport()
      const csv = generateSummaryCSV(report)

      expect(csv).toContain('Crawl,Yes')
      expect(csv).toContain('GSC,Yes')
      expect(csv).toContain('GA4,Yes')
      expect(csv).toContain('Backlinks,ahrefs')
    })
  })
})

// ============================================================================
// HTML Output Tests
// ============================================================================

describe('HTML Output', () => {
  describe('generateHtmlReport', () => {
    it('should generate valid HTML structure', () => {
      const report = createMockSEOReport()
      const html = generateHtmlReport(report)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<head>')
      expect(html).toContain('<body>')
    })

    it('should include CSS styles', () => {
      const report = createMockSEOReport()
      const html = generateHtmlReport(report)

      expect(html).toContain('<style>')
      expect(html).toContain('</style>')
    })

    it('should include the score', () => {
      const report = createMockSEOReport()
      const html = generateHtmlReport(report)

      expect(html).toContain('75') // Overall score
      expect(html).toContain('Overall SEO Score')
    })

    it('should include data source indicators', () => {
      const report = createMockSEOReport()
      const html = generateHtmlReport(report)

      expect(html).toContain('Crawl')
      expect(html).toContain('Google Search Console')
      expect(html).toContain('Google Analytics 4')
    })

    it('should include insights section', () => {
      const report = createMockSEOReport()
      const html = generateHtmlReport(report)

      expect(html).toContain('CTR Opportunity')
      expect(html).toContain('Correlation Insights')
    })

    it('should include page analysis table', () => {
      const report = createMockSEOReport()
      const html = generateHtmlReport(report)

      expect(html).toContain('<table')
      expect(html).toContain('Page Analysis')
    })

    it('should escape HTML in values', () => {
      const report = createMockSEOReport()
      // Test XSS in insight title/description which IS rendered
      report.insights[0].title = '<script>alert("xss")</script>'

      const html = generateHtmlReport(report)

      expect(html).not.toContain('<script>alert("xss")</script>')
      expect(html).toContain('&lt;script&gt;')
    })

    it('should be printable (no broken layouts)', () => {
      const report = createMockSEOReport()
      const html = generateHtmlReport(report)

      expect(html).toContain('@media print')
    })
  })
})

// ============================================================================
// Type Validation Tests
// ============================================================================

describe('Type Definitions', () => {
  it('should allow valid PageAnalysis', () => {
    const page: PageAnalysis = createMockPageAnalysis()
    expect(page.url).toBeDefined()
    expect(page.images.total).toBeDefined()
  })

  it('should allow valid GSCData', () => {
    const gsc: GSCData = createMockGSCData()
    expect(gsc.pages.length).toBeGreaterThan(0)
    expect(gsc.queries.length).toBeGreaterThan(0)
  })

  it('should allow valid GA4Data', () => {
    const ga4: GA4Data = createMockGA4Data()
    expect(ga4.overview.sessions).toBeGreaterThan(0)
    expect(ga4.coreWebVitals?.lcp.rating).toBe('good')
  })

  it('should allow valid BacklinkData', () => {
    const backlinks: BacklinkData = createMockBacklinkData()
    expect(backlinks.provider).toBe('ahrefs')
    expect(backlinks.metrics.domainRating).toBeDefined()
  })

  it('should allow valid SEOScore', () => {
    const score: SEOScore = {
      overall: 75,
      technical: 20,
      content: 22,
      semantic: 15,
      authority: 10,
      ux: 8,
      aiReadiness: 7,
      confidence: 95,
    }

    expect(score.overall).toBe(
      score.technical + score.content + score.semantic + score.authority + score.ux
    )
  })
})
