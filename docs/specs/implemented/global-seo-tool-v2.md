# SEO Tool v2: Integrated Analytics & Backlink Support

**Status:** Complete (Phases 1-6 implemented, GSC/GA4 data collection in progress)
**Implemented Version:** v4.2.0
**Completion Date:** 2026-02-05
**Priority:** High
**Complexity:** Very High
**Dependencies:** `/seo` command (v3.5.0), GA4 tracking (v3.4.0)
**Supersedes:** `seo-command-enhancements.md` (partial overlap, this is comprehensive)

---

## Implementation Summary

**All 6 phases of the SEO Tool V2 specification have been successfully implemented:**

### ✅ Phase 1: Credential Management

- OAuth 2.0 flow with Google APIs
- Secure credential storage (`GOOGLE_REFRESH_TOKEN_SEO`)
- Multi-scope authorization (GSC, GA4, Sheets)

### ✅ Phase 2: Google Search Console Integration

- Client implementation with graceful degradation
- API connection verified
- Awaiting data collection (2-4 weeks from 2026-01-20)

### ✅ Phase 3: Google Analytics 4 Integration

- GA4 Data API client implemented
- Fixed data parsing (commit 91361c6)
- Real-time metrics display (sessions, users, bounce rate)

### ✅ Phase 4: Backlinks Integration

- Scaffolding for Ahrefs and SEMrush APIs
- Provider capability detection
- Graceful degradation with setup instructions

### ✅ Phase 4.5: Infrastructure

- Rate limiting with exponential backoff
- Differentiated cache TTLs by data source
- Comprehensive error states and feedback

### ✅ Phase 5: Insights Engine

- Crawl-only detectors active (duplicate titles, missing schema, etc.)
- Cross-source correlation detectors ready (CTR opportunities, zombie pages, etc.)
- Waiting for GSC/GA4 data to activate full correlation analysis

### ✅ Phase 6: Output Formats

- CLI dashboard with visual indicators
- Markdown reports (`--output md`)
- HTML standalone reports (`--output html`)
- Multi-file CSV export (`--output csv`)

### 🎯 Beyond-Spec Enhancements

- **Hybrid testing strategy** (commit 753dd4a): Core pages + golden paths + random sampling
- **Improved meta-injector** (commit 753dd4a): Better title formatting and HTML escaping
- **Enhanced llm.txt** (commit 753dd4a): Added 200+ lines of page structure documentation

### 📊 Current Performance

- **SEO Score:** 91/100 (with crawl-only analysis)
- **Expected Score:** 95%+ once GSC/GA4 data populates
- **Tool Versions:** `/seo` command v1.5, analyze-seo.ts v1.4

---

## Current Status (2026-01-20)

### What's Working (v1.4)

- `/seo` command scores **91/100** with crawl-only analysis
- Detects: sitemap, robots.txt, llm.txt, facts.json, RSS feed, About page
- Checks About page for Schema.org and LinkedIn (E-E-A-T signals)
- Uses Googlebot UA to verify Cloudflare Worker meta tag injection
- Outputs CLI dashboard + Markdown report
- **GSC integration with graceful degradation** (shows "awaiting data" when configured but no data)
- **GA4 integration with graceful degradation** (shows "no data in date range" when configured)
- **Backlinks integration with graceful degradation** (shows "not configured" with setup instructions)
- **Rate limiting** — Conservative limits with exponential backoff for all API clients
- **Differentiated cache TTLs** — crawl 1d, GSC 3d, GA4 1d, backlinks 14d
- **Detailed error states** — ⬚ not configured, ⏳ pending, ❌ error, ✅ active
- **Backlink provider capabilities** — Runtime feature detection for Ahrefs vs SEMrush
- **Playbook templates** — Extracted for easier customization
- **Insights engine integrated** — Crawl-only insights active, cross-source ready for data
- **CSV export** — `--output csv` generates multi-file export
- **HTML export** — `--output html` generates standalone report

### OAuth Setup COMPLETE (2026-01-20)
- **Google Cloud Project:** `476447563424` (existing, used for Sheets/Maps)
- **APIs Enabled:** Search Console API, Analytics Data API
- **OAuth Scopes:** `spreadsheets.readonly`, `webmasters.readonly`, `analytics.readonly`
- **Redirect URI:** `http://localhost:3333/oauth2callback`
- **New Env Var:** `GOOGLE_REFRESH_TOKEN_SEO` (has all 3 scopes)
- **Reauthorize Script:** `scripts/seo/reauthorize.ts`
- **GSC Property:** `sc-domain:concerts.morperhaus.org` (verified, API access confirmed)
- **GSC Data Status:** Property just added — no data yet (takes 2-4 weeks)

### V2 Scaffolding

The following files exist in `scripts/seo/`:

- `credentials.ts` — Credential storage and retrieval
- `oauth.ts` — Google OAuth flow
- `setup.ts` — Interactive setup wizard (first-time UX)
- `reauthorize.ts` — Re-auth script for expanded scopes
- `test-gsc.ts` — GSC API test script
- `cache.ts` — Caching layer with differentiated TTLs by source type
- `rate-limiter.ts` — **NEW** Rate limiting with exponential backoff
- `clients/gsc.ts` — Google Search Console client (original stub)
- `clients/gsc-simple.ts` — **ACTIVE** GSC client with graceful degradation + rate limiting
- `clients/ga4.ts` — Google Analytics 4 client (original stub)
- `clients/ga4-simple.ts` — **ACTIVE** GA4 client with graceful degradation + rate limiting
- `clients/backlinks.ts` — Backlink provider interface with capabilities detection
- `clients/backlinks-simple.ts` — **ACTIVE** Backlink client with graceful degradation
- `insights/engine.ts` — Correlation insight detection
- `insights/playbooks.ts` — Actionable playbook generation
- `insights/playbook-templates.ts` — **NEW** Extracted templates for customization
- `outputs/html.ts`, `outputs/csv.ts`, `outputs/sheets.ts` — Export formats
- `types.ts` — TypeScript interfaces for all data structures
- `index.ts` — Module exports (updated with new exports)

### What Broke (Fixed)
- v2 was prematurely swapped in as the active script
- v2 requires Google API credentials; without them, score dropped to 63/100
- **Fix:** Restored v1.1 as active, preserved v2 work as `analyze-seo-v2-wip.ts`

### Next Steps to Complete v2

1. ~~**Phase 1 (Credential Management):**~~ **DONE** — OAuth working, `GOOGLE_REFRESH_TOKEN_SEO` env var
2. ~~**Phase 2 (GSC Integration):**~~ **DONE** — `clients/gsc-simple.ts` integrated into `analyze-seo.ts`
   - API access verified ✅
   - Graceful degradation implemented ✅
   - Dashboard shows GSC status (configured/awaiting data/active) ✅
   - **Waiting for GSC data** (property added 2026-01-20, check back ~2026-02-03)
3. ~~**Phase 3 (GA4 Integration):**~~ **DONE** — `clients/ga4-simple.ts` integrated into `analyze-seo.ts`
   - Graceful degradation implemented ✅
   - Dashboard shows GA4 status (not configured/no property ID/active) ✅
   - `GA4_PROPERTY_ID` added to `.env` ✅
   - API connection verified ✅ (returns "no data in date range" — expected for new/low-traffic property)
4. ~~**Phase 4 (Backlinks):**~~ **DONE** — `clients/backlinks-simple.ts` integrated into `analyze-seo.ts`
   - Graceful degradation implemented ✅
   - Dashboard shows backlink status (not configured/API error/active) ✅
   - Supports both Ahrefs (`AHREFS_API_KEY`) and SEMrush (`SEMRUSH_API_KEY`)
   - **Provider capabilities detection** ✅ — Runtime feature detection for API differences
   - **Ready to test** — add API key to `.env` when available
5. ~~**Phase 4.5 (Infrastructure):**~~ **DONE** — Rate limiting, caching, error handling
   - Rate limiting with exponential backoff ✅ (GSC 60/min, GA4 30/min, backlinks 10/min)
   - Differentiated cache TTLs ✅ (crawl 1d, GSC 3d, GA4 1d, backlinks 14d)
   - Detailed error state icons ✅ (⬚ not configured, ⏳ pending, ❌ error, ✅ active)
   - Playbook templates extracted ✅ — Easier customization of title/description suggestions
6. ~~**Phase 5 (Insights Engine):**~~ **DONE** — Integrated into `analyze-seo.ts`
   - Crawl-only detectors: duplicate titles, missing schema, slow response, missing canonical ✅
   - Cross-source detectors ready: CTR opportunity, content gap, zombie page, etc. ✅
   - Insights logged to CLI ✅
   - **Waiting for GSC/GA4 data** to activate cross-source correlations
7. ~~**Phase 6 (Output Formats):**~~ **DONE** — CSV and HTML export
   - `--output csv` — Multi-file CSV export to `seo-reports/YYYY-MM-DD-csv/` ✅
   - `--output html` — Standalone HTML report with embedded CSS ✅
   - `--output md` — Markdown report (existing) ✅
   - `--output both` — CLI + Markdown (default) ✅
   - Sheets export deferred (requires additional OAuth scope)

### What's Next

1. **Wait for GSC data** (~2026-02-03) — Property needs 2-4 weeks to accumulate data
2. **Test cross-source insights** — Once GSC data arrives, verify correlation detection
3. **Review duplicate title insight** — The tool detected 10 pages sharing "Morperhaus Concert Archives" title

### Key Files

| File | Purpose |
|------|---------|
| `scripts/analyze-seo.ts` | Active v1.4 script (91/100 baseline + GSC + GA4 + Backlinks) |
| `scripts/seo/rate-limiter.ts` | **NEW** Rate limiting with exponential backoff |
| `scripts/seo/cache.ts` | Caching with differentiated TTLs |
| `scripts/seo/clients/gsc-simple.ts` | GSC client with graceful degradation + rate limiting |
| `scripts/seo/clients/ga4-simple.ts` | GA4 client with graceful degradation + rate limiting |
| `scripts/seo/clients/backlinks-simple.ts` | Backlinks client with graceful degradation |
| `scripts/seo/clients/backlinks.ts` | Provider interface with capabilities detection |
| `scripts/seo/insights/playbook-templates.ts` | **NEW** Extracted playbook templates |
| `scripts/seo/reauthorize.ts` | OAuth re-auth for expanded scopes |
| `scripts/seo/test-gsc.ts` | GSC API test script |
| `scripts/analyze-seo-v2-wip.ts` | v2 work-in-progress (not active) |
| `scripts/seo/` | v2 modular components |

---

## Executive Summary

Transform the `/seo` command from a structural HTML analyzer into a comprehensive SEO intelligence platform by integrating real data from Google Search Console (search performance), Google Analytics 4 (user engagement), and optional backlink APIs (Ahrefs/SEMrush). The tool will correlate data across sources to surface actionable insights that no single platform provides alone.

**Key differentiator:** Most SEO tools show data from ONE source. This tool **triangulates** across crawl data, search performance, and engagement metrics to identify mismatches and opportunities that require human judgment.

**Portability goal:** Any developer can fork and use this tool on their own site with minimal configuration. Credentials are handled securely with multiple storage options and graceful degradation when APIs are unavailable.

---

## Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session:**

```
I need to implement SEO Tool v2 for the /seo command.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context
- At the end of EACH implementation window, assess remaining context
- If <30% remains, STOP and provide handoff summary
- Implement the spec AS WRITTEN

**Feature Overview:**
- Google Search Console integration (impressions, clicks, CTR, position)
- Google Analytics 4 integration (engagement, bounce rate, Core Web Vitals)
- Backlink API scaffolding (Ahrefs + SEMrush, optional)
- Portable credential management (env vars, config file, OAuth)
- Correlation insights engine (cross-source analysis)
- Multiple output formats (CLI, Markdown, HTML, JSON)

**Key References:**
- Full Spec: docs/specs/future/global-seo-tool-v2.md
- Current Implementation: scripts/analyze-seo.ts
- Command Spec: .claude/commands/seo.md
- Analytics Patterns: .claude/skills/analytics/SKILL.md

**Implementation Approach:**
- Phase 1: Credential management system
- Phase 2: Google Search Console integration
- Phase 3: Google Analytics 4 integration
- Phase 4: Backlink API scaffolding
- Phase 5: Correlation insights engine
- Phase 6: Output format options

Let's start with Phase 1. Should I begin by designing the credential storage system?
```

---

## Design Philosophy

### Data Source Triangulation

The power of this tool comes from **correlation** — finding mismatches between what *should* work and what *actually* works:

| Insight Type | Data Sources | Example Finding |
|--------------|--------------|-----------------|
| **Content gaps** | GSC impressions + Crawl | "Page has great meta tags but 0 impressions → not indexed or competing poorly" |
| **CTR opportunities** | GSC CTR + Crawl titles | "Page ranks #3 but CTR is 1% vs 5% avg → title/description needs work" |
| **Engagement mismatch** | GA4 bounce + Crawl structure | "Page has good H1/content but 80% bounce → UX or intent mismatch" |
| **Technical vs. reality** | Crawl performance + GA4 CWV | "Lab says 150ms, field data says 2.3s → real-world issues" |
| **Zombie pages** | GSC + GA4 | "Page gets impressions but zero clicks AND zero direct traffic → remove or rewrite" |
| **Authority-traffic mismatch** | Backlinks + GSC | "Page has 50 referring domains but ranks #15 → on-page issues" |
| **Link-worthy content** | Backlinks + GA4 engagement | "High engagement pages with few backlinks → outreach candidates" |

### Graceful Degradation

The tool must work at every level of API access:

| Level | Available Data | Score Accuracy |
|-------|----------------|----------------|
| **No APIs** | Crawl data only | 60% (structural estimates) |
| **GSC only** | Crawl + search performance | 80% (real ranking data) |
| **GSC + GA4** | Crawl + search + engagement | 90% (full picture) |
| **All sources** | Crawl + search + engagement + authority | 95%+ (comprehensive) |

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        /seo Command Entry                            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Credential Manager                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Environment  │  │ Config File  │  │ OAuth Flow   │              │
│  │ Variables    │  │ (~/.seo-     │  │ (Interactive)│              │
│  │              │  │  analyzer)   │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         └─────────────────┼─────────────────┘                       │
│                           ▼                                         │
│                   Unified Auth Provider                             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  Page Crawler │      │ GSC Client    │      │ GA4 Client    │
│  (Existing)   │      │ (New)         │      │ (New)         │
│               │      │               │      │               │
│ • HTML parse  │      │ • Impressions │      │ • Sessions    │
│ • Meta tags   │      │ • Clicks      │      │ • Bounce rate │
│ • Response    │      │ • CTR         │      │ • Engagement  │
│   time        │      │ • Position    │      │ • Core Web    │
│ • Schema.org  │      │ • Index       │      │   Vitals      │
│               │      │   coverage    │      │               │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        │              ┌───────┴───────┐              │
        │              │               │              │
        │              ▼               ▼              │
        │      ┌─────────────┐ ┌─────────────┐       │
        │      │ Ahrefs      │ │ SEMrush     │       │
        │      │ (Optional)  │ │ (Optional)  │       │
        │      │             │ │             │       │
        │      │ • Backlinks │ │ • Backlinks │       │
        │      │ • DR score  │ │ • Authority │       │
        │      │ • Referring │ │ • Referring │       │
        │      │   domains   │ │   domains   │       │
        │      └──────┬──────┘ └──────┬──────┘       │
        │             └───────┬───────┘              │
        │                     │                      │
        └─────────────────────┼──────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Correlation Engine                                │
│                                                                     │
│  • Cross-source analysis                                            │
│  • Anomaly detection                                                │
│  • Opportunity scoring                                              │
│  • Recommendation prioritization                                    │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Report Generator                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ CLI      │  │ Markdown │  │ HTML     │  │ JSON     │            │
│  │ Dashboard│  │ Report   │  │ Report   │  │ Export   │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Interfaces

```typescript
// Core types for the SEO analyzer

interface SEOAnalysisConfig {
  // Target
  url: string

  // Data sources (all optional, graceful degradation)
  googleSearchConsole?: {
    enabled: boolean
    propertyUrl?: string  // If different from url
    dateRange: number     // Days to look back (default: 28)
  }
  googleAnalytics?: {
    enabled: boolean
    propertyId?: string   // GA4 property ID
    dateRange: number     // Days to look back (default: 28)
  }
  backlinks?: {
    provider: 'ahrefs' | 'semrush' | 'none'
    enabled: boolean
  }

  // Output
  output: ('cli' | 'md' | 'html' | 'json')[]
  baseline: boolean
  compare?: string  // Date string YYYY-MM-DD

  // Caching
  cacheDir: string
  cacheTtl: number  // Days (default: 7 for API responses)
}

interface CredentialStore {
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
}

interface GSCData {
  property: string
  dateRange: { start: string; end: string }
  pages: Array<{
    page: string
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
  queries: Array<{
    query: string
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
  indexCoverage: {
    valid: number
    warning: number
    error: number
    excluded: number
  }
}

interface GA4Data {
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
  pageMetrics: Array<{
    pagePath: string
    pageViews: number
    uniquePageViews: number
    avgTimeOnPage: number
    bounceRate: number
    exitRate: number
  }>
  coreWebVitals?: {
    lcp: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
    fid: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
    cls: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
    inp: { p75: number; rating: 'good' | 'needs-improvement' | 'poor' }
  }
  trafficSources: Array<{
    source: string
    medium: string
    sessions: number
    bounceRate: number
  }>
}

interface BacklinkData {
  provider: 'ahrefs' | 'semrush'
  domain: string
  metrics: {
    domainRating?: number      // Ahrefs DR (0-100)
    authorityScore?: number    // SEMrush AS (0-100)
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

interface CorrelationInsight {
  type:
    | 'content_gap'           // Good structure, no impressions
    | 'ctr_opportunity'       // Good ranking, low CTR
    | 'engagement_mismatch'   // Good traffic, high bounce
    | 'technical_reality'     // Lab vs field performance gap
    | 'zombie_page'           // Impressions but no clicks/traffic
    | 'authority_mismatch'    // High backlinks, low rankings
    | 'linkworthy_content'    // High engagement, few backlinks
    | 'cannibalizing_pages'   // Multiple pages competing for same queries
  severity: 'critical' | 'warning' | 'opportunity'
  title: string
  description: string
  affectedPages: string[]
  dataSources: string[]  // Which sources contributed to this insight
  recommendation: string
  estimatedImpact: 'high' | 'medium' | 'low'
}

interface SEOReport {
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
  }

  scores: {
    overall: number           // 0-100
    technical: number         // 0-25
    content: number           // 0-30
    semantic: number          // 0-20
    authority: number         // 0-15
    ux: number                // 0-10
    aiReadiness: number       // 0-10 (bonus)
    confidence: number        // 0-100 (based on data sources available)
  }

  // Raw data from each source
  crawlData: PageAnalysis[]
  gscData?: GSCData
  ga4Data?: GA4Data
  backlinkData?: BacklinkData

  // Cross-source insights
  insights: CorrelationInsight[]

  // Prioritized recommendations
  recommendations: Array<{
    category: 'quick-win' | 'strategic' | 'optional'
    insight?: CorrelationInsight  // Link to source insight
    title: string
    impact: 'high' | 'medium' | 'low'
    effort: 'low' | 'medium' | 'high'
    points: number
    description: string
    affectedPages?: string[]
  }>
}
```

---

## Credential Management System

### Storage Hierarchy

The system checks for credentials in this order:

1. **Environment Variables** (CI/automation friendly)
2. **Config File** (`~/.seo-analyzer/credentials.json`)
3. **Interactive OAuth Flow** (fallback for humans)

### Environment Variables

```bash
# Google OAuth (for GSC and GA4)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx  # Optional, can use OAuth flow

# Backlink APIs (optional)
AHREFS_API_KEY=xxx
SEMRUSH_API_KEY=xxx
```

### Config File Structure

Location: `~/.seo-analyzer/credentials.json` (NOT in project directory)

```json
{
  "version": 1,
  "google": {
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "xxx",
    "refreshToken": "xxx"
  },
  "ahrefs": {
    "apiKey": "xxx"
  },
  "semrush": {
    "apiKey": "xxx"
  },
  "properties": {
    "https://concerts.morperhaus.org": {
      "gscProperty": "sc-domain:morperhaus.org",
      "ga4PropertyId": "123456789"
    }
  }
}
```

### First-Run Setup Flow

When no credentials are found:

```
🔍 SEO ANALYZER SETUP
═══════════════════════════════════════════════════════════════

No credentials found. Let's configure your data sources.

📊 Google Search Console & Analytics
────────────────────────────────────────────────────────────────
GSC and GA4 provide the most valuable SEO insights.

Would you like to configure Google APIs?
  [1] Yes, start OAuth flow (recommended)
  [2] Yes, I have credentials to enter manually
  [3] Skip for now (use crawl-only mode)

> 1

Opening browser for Google OAuth...
Please authorize the SEO Analyzer app.

✅ Google authorization successful!

Select your Search Console property:
  [1] sc-domain:morperhaus.org
  [2] https://concerts.morperhaus.org/

> 1

Select your GA4 property:
  [1] Morperhaus Concerts (123456789)
  [2] Other property...

> 1

🔗 Backlink APIs (Optional)
────────────────────────────────────────────────────────────────
Backlink data requires a paid subscription to Ahrefs or SEMrush.

Do you have a backlink API key?
  [1] Yes, Ahrefs
  [2] Yes, SEMrush
  [3] No, skip backlinks

> 3

💾 Save Configuration
────────────────────────────────────────────────────────────────
Where should I save your credentials?

  [1] ~/.seo-analyzer/credentials.json (recommended)
  [2] Environment variables (print commands to copy)
  [3] Don't save (re-auth each time)

> 1

✅ Configuration saved to ~/.seo-analyzer/credentials.json

⚠️  Security Note:
   - This file contains sensitive credentials
   - It is stored in your home directory, NOT your project
   - Add to your global .gitignore: ~/.seo-analyzer/

Ready to analyze! Run: /seo
```

### OAuth Scopes Required

```typescript
const GOOGLE_SCOPES = [
  // Search Console
  'https://www.googleapis.com/auth/webmasters.readonly',

  // Analytics (GA4 Data API)
  'https://www.googleapis.com/auth/analytics.readonly',
]
```

### Security Considerations

1. **Never store credentials in project directory** — Always use `~/.seo-analyzer/`
2. **Refresh tokens only** — Don't store access tokens (short-lived)
3. **Warn on .gitignore** — Check if credentials might be committed
4. **Minimal scopes** — Read-only access only
5. **Token refresh** — Handle expired tokens gracefully

---

## Google Search Console Integration

### API Endpoints Used

```typescript
// Search Analytics API
// https://developers.google.com/webmaster-tools/v1/searchanalytics

interface GSCSearchAnalyticsRequest {
  startDate: string      // YYYY-MM-DD
  endDate: string        // YYYY-MM-DD
  dimensions: ('page' | 'query' | 'date' | 'device' | 'country')[]
  rowLimit?: number      // Default 1000, max 25000
  startRow?: number      // For pagination
}

// Index Coverage API (Inspection)
// https://developers.google.com/webmaster-tools/v1/urlInspection
```

### Data Retrieval Strategy

```typescript
async function fetchGSCData(config: SEOAnalysisConfig): Promise<GSCData> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (config.googleSearchConsole?.dateRange || 28))

  // Fetch page-level metrics
  const pageMetrics = await gscClient.searchanalytics.query({
    siteUrl: config.googleSearchConsole?.propertyUrl || config.url,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['page'],
      rowLimit: 1000,
    }
  })

  // Fetch query-level metrics
  const queryMetrics = await gscClient.searchanalytics.query({
    siteUrl: config.googleSearchConsole?.propertyUrl || config.url,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['query'],
      rowLimit: 500,
    }
  })

  // Fetch index coverage (if available)
  const indexCoverage = await fetchIndexCoverage(config)

  return {
    property: config.googleSearchConsole?.propertyUrl || config.url,
    dateRange: { start: formatDate(startDate), end: formatDate(endDate) },
    pages: mapPageMetrics(pageMetrics),
    queries: mapQueryMetrics(queryMetrics),
    indexCoverage,
  }
}
```

### Metrics Mapped to Scoring

| GSC Metric | SEO Category | Scoring Impact |
|------------|--------------|----------------|
| Total impressions | Authority (15 pts) | Visibility baseline |
| Average position | Overall multiplier | Ground truth ranking |
| CTR by page | Content (30 pts) | Title/description effectiveness |
| Index coverage valid | Technical (25 pts) | Crawlability reality |
| Index coverage errors | Technical (25 pts) | Critical issues |
| Mobile vs desktop | UX (10 pts) | Device experience gap |

---

## Google Analytics 4 Integration

### API Endpoints Used

```typescript
// GA4 Data API
// https://developers.google.com/analytics/devguides/reporting/data/v1

interface GA4RunReportRequest {
  property: string        // 'properties/123456789'
  dateRanges: Array<{
    startDate: string     // YYYY-MM-DD or 'NdaysAgo'
    endDate: string
  }>
  dimensions: Array<{ name: string }>
  metrics: Array<{ name: string }>
  limit?: number
}
```

### Data Retrieval Strategy

```typescript
async function fetchGA4Data(config: SEOAnalysisConfig): Promise<GA4Data> {
  const propertyId = config.googleAnalytics?.propertyId
  const dateRange = config.googleAnalytics?.dateRange || 28

  // Overview metrics
  const overview = await ga4Client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${dateRange}daysAgo`, endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViewsPerSession' },
    ]
  })

  // Page-level metrics
  const pageMetrics = await ga4Client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${dateRange}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'exits' },
    ],
    limit: 100,
  })

  // Core Web Vitals (from BigQuery export or CrUX API)
  const coreWebVitals = await fetchCoreWebVitals(config)

  // Traffic sources
  const trafficSources = await ga4Client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: `${dateRange}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'bounceRate' },
    ],
    limit: 20,
  })

  return {
    propertyId,
    dateRange: { start: `${dateRange}daysAgo`, end: 'today' },
    overview: mapOverview(overview),
    pageMetrics: mapPageMetrics(pageMetrics),
    coreWebVitals,
    trafficSources: mapTrafficSources(trafficSources),
  }
}
```

### Core Web Vitals Source Options

1. **CrUX API** (Chrome UX Report) — Free, 28-day rolling average
2. **GA4 + BigQuery** — Requires BigQuery export enabled
3. **PageSpeed Insights API** — Lab data (not field data)

**Recommendation:** Use CrUX API for field data, fall back to PageSpeed Insights for lab data.

### Metrics Mapped to Scoring

| GA4 Metric | SEO Category | Scoring Impact |
|------------|--------------|----------------|
| Bounce rate | UX (10 pts) | Engagement quality |
| Avg session duration | Content (30 pts) | Content resonance |
| Pages per session | Semantic (20 pts) | Internal linking effectiveness |
| New vs returning users | Authority (15 pts) | Brand loyalty signal |
| Core Web Vitals | Technical (25 pts) | Real performance data |
| Organic traffic % | Authority (15 pts) | Search dependency |

---

## Backlink API Integration

### Ahrefs API

```typescript
// Ahrefs API v3
// https://docs.ahrefs.com/docs/api-v3

interface AhrefsClient {
  // Domain metrics
  getDomainRating(domain: string): Promise<{
    domainRating: number  // 0-100
    ahrefsRank: number
  }>

  // Backlink profile
  getBacklinksStats(domain: string): Promise<{
    backlinks: number
    referringDomains: number
    followLinks: number
    nofollowLinks: number
  }>

  // Top referring domains
  getRefDomains(domain: string, limit: number): Promise<Array<{
    domain: string
    backlinks: number
    domainRating: number
    firstSeen: string
  }>>

  // New/lost backlinks
  getBacklinksNew(domain: string, days: number): Promise<number>
  getBacklinksLost(domain: string, days: number): Promise<number>
}
```

### SEMrush API

```typescript
// SEMrush API
// https://developer.semrush.com/api/

interface SEMrushClient {
  // Domain overview
  getDomainOverview(domain: string): Promise<{
    authorityScore: number  // 0-100
    organicTraffic: number
    organicKeywords: number
  }>

  // Backlink analytics
  getBacklinks(domain: string): Promise<{
    totalBacklinks: number
    referringDomains: number
    followLinks: number
    nofollowLinks: number
  }>

  // Referring domains
  getRefDomains(domain: string, limit: number): Promise<Array<{
    domain: string
    backlinks: number
    authorityScore: number
  }>>
}
```

### Scaffolding Pattern

Both APIs follow the same interface pattern with capability detection:

```typescript
interface BacklinkProviderCapabilities {
  supportsDomainRating: boolean      // Ahrefs DR
  supportsAuthorityScore: boolean    // SEMrush AS
  supportsNewLostBacklinks: boolean  // Trend data
  supportsTopReferrers: boolean
  supportsAnchorText: boolean
  maxReferrersPerRequest: number     // API limit
}

interface BacklinkProvider {
  name: 'ahrefs' | 'semrush'
  capabilities: BacklinkProviderCapabilities
  isConfigured(): boolean
  fetchMetrics(domain: string): Promise<BacklinkData>
}

// Ahrefs capabilities (varies by plan)
const AHREFS_CAPABILITIES: BacklinkProviderCapabilities = {
  supportsDomainRating: true,
  supportsAuthorityScore: false,
  supportsNewLostBacklinks: true,
  supportsTopReferrers: true,
  supportsAnchorText: true,
  maxReferrersPerRequest: 100,
}

// SEMrush capabilities
const SEMRUSH_CAPABILITIES: BacklinkProviderCapabilities = {
  supportsDomainRating: false,
  supportsAuthorityScore: true,
  supportsNewLostBacklinks: true,
  supportsTopReferrers: true,
  supportsAnchorText: true,
  maxReferrersPerRequest: 50,
}

class AhrefsProvider implements BacklinkProvider {
  name = 'ahrefs' as const

  constructor(private apiKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async fetchMetrics(domain: string): Promise<BacklinkData> {
    // Implementation
  }
}

class SEMrushProvider implements BacklinkProvider {
  name = 'semrush' as const

  constructor(private apiKey: string) {}

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async fetchMetrics(domain: string): Promise<BacklinkData> {
    // Implementation
  }
}

// Factory function
function getBacklinkProvider(config: CredentialStore): BacklinkProvider | null {
  if (config.ahrefs?.apiKey) {
    return new AhrefsProvider(config.ahrefs.apiKey)
  }
  if (config.semrush?.apiKey) {
    return new SEMrushProvider(config.semrush.apiKey)
  }
  return null
}
```

### Metrics Mapped to Scoring

| Backlink Metric | SEO Category | Scoring Impact |
|-----------------|--------------|----------------|
| Domain Rating/Authority Score | Authority (15 pts) | Primary authority signal |
| Referring domains | Authority (15 pts) | Diversity of links |
| Follow vs nofollow ratio | Authority (15 pts) | Link quality |
| New backlinks trend | Authority (15 pts) | Growth momentum |
| Lost backlinks trend | Authority (15 pts) | Warning signal |

---

## Correlation Insights Engine

### Insight Detection Algorithms

```typescript
function detectInsights(
  crawlData: PageAnalysis[],
  gscData?: GSCData,
  ga4Data?: GA4Data,
  backlinkData?: BacklinkData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // Only run correlations when we have the required data sources

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
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}
```

### Example Insight Detectors

```typescript
// Content Gap: Good structure but no search visibility
function detectContentGaps(
  crawlData: PageAnalysis[],
  gscData: GSCData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  for (const page of crawlData) {
    const gscPage = gscData.pages.find(p => urlMatch(p.page, page.url))

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
        recommendation: 'Check if page is indexed. If indexed, content may not match search intent or faces strong competition.',
        estimatedImpact: 'medium',
      })
    }
  }

  return insights
}

// CTR Opportunity: Good ranking but low click-through
function detectCTROpportunities(
  crawlData: PageAnalysis[],
  gscData: GSCData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []
  const avgCTR = gscData.pages.reduce((sum, p) => sum + p.ctr, 0) / gscData.pages.length

  for (const gscPage of gscData.pages) {
    // Good position (top 10) but CTR well below average
    if (
      gscPage.position <= 10 &&
      gscPage.impressions > 100 &&
      gscPage.ctr < avgCTR * 0.5
    ) {
      const crawlPage = crawlData.find(p => urlMatch(p.url, gscPage.page))

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

// Engagement Mismatch: Traffic but high bounce
function detectEngagementMismatches(
  crawlData: PageAnalysis[],
  ga4Data: GA4Data
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  for (const ga4Page of ga4Data.pageMetrics) {
    // High traffic but very high bounce rate
    if (
      ga4Page.pageViews > 50 &&
      ga4Page.bounceRate > 0.8
    ) {
      const crawlPage = crawlData.find(p => urlMatch(p.url, ga4Page.pagePath))

      insights.push({
        type: 'engagement_mismatch',
        severity: 'warning',
        title: 'High-traffic page has 80%+ bounce rate',
        description: `${ga4Page.pagePath} received ${ga4Page.pageViews} views but ${(ga4Page.bounceRate * 100).toFixed(0)}% of visitors left immediately.`,
        affectedPages: [ga4Page.pagePath],
        dataSources: ['ga4', 'crawl'],
        recommendation: 'Content may not match user intent, or UX issues are causing quick exits. Check H1 alignment with search queries.',
        estimatedImpact: 'high',
      })
    }
  }

  return insights
}

// Zombie Page: Impressions but no engagement
function detectZombiePages(
  gscData: GSCData,
  ga4Data: GA4Data
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  for (const gscPage of gscData.pages) {
    const ga4Page = ga4Data.pageMetrics.find(p => urlMatch(p.pagePath, gscPage.page))

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
        recommendation: 'Consider removing, consolidating, or completely rewriting this page. It\'s diluting site authority.',
        estimatedImpact: 'medium',
      })
    }
  }

  return insights
}
```

---

## Actionable Playbooks

Each insight type generates a **playbook** — a concrete, step-by-step guide that a marketer or webmaster can execute without SEO expertise.

### Playbook Structure

```typescript
interface ActionablePlaybook {
  insight: CorrelationInsight

  // What exactly is wrong
  diagnosis: {
    current: string           // Current state (with actual values)
    expected: string          // What good looks like
    gap: string               // Quantified difference
  }

  // Concrete fix
  fix: {
    summary: string           // One-line action
    steps: string[]           // Numbered steps
    codeSnippet?: string      // Copy-paste code if applicable
    fileToEdit?: string       // Exact file path
    toolsNeeded?: string[]    // External tools required
  }

  // Why this matters
  impact: {
    metric: string            // What will improve
    estimate: string          // Expected improvement range
    timeframe: string         // When to expect results
  }

  // How to confirm it worked
  verification: {
    method: string            // How to check
    target: string            // Success threshold
    checkAfter: string        // When to re-check
  }
}
```

### Playbook: CTR Opportunity

```
═══════════════════════════════════════════════════════════════════════
PLAYBOOK: Improve Click-Through Rate
═══════════════════════════════════════════════════════════════════════

DIAGNOSIS
─────────────────────────────────────────────────────────────────────────
Page:      /?scene=venues
Position:  #4.2 (good!)
CTR:       3.1% (your avg: 6.9%, industry avg for #4: 8-10%)
Gap:       Missing 50-70% of potential clicks

CURRENT META TAGS
─────────────────────────────────────────────────────────────────────────
Title:       "Venues | Morperhaus Concerts"
Description: "View concert venues"

PROBLEMS IDENTIFIED
─────────────────────────────────────────────────────────────────────────
❌ Title is generic — doesn't differentiate from other venue pages
❌ No numbers — misses curiosity trigger
❌ No value proposition — why should someone click?
❌ Description is too short — wasting SERP real estate

SUGGESTED FIX
─────────────────────────────────────────────────────────────────────────
New Title (58 chars):
  "77 Concert Venues I've Visited Since 1984 | Interactive Map"

New Description (155 chars):
  "Explore an interactive network visualization of 77 venues across
   35 cities. See which artists played where, discover venue
   connections, and find your next show."

WHY THIS WORKS
─────────────────────────────────────────────────────────────────────────
✅ "77" — Specific number creates curiosity
✅ "I've Visited" — Personal experience (E-E-A-T signal)
✅ "Since 1984" — Establishes depth/authority
✅ "Interactive Map" — Sets clear expectation, differentiates
✅ "your next show" — Adds user benefit

IMPLEMENTATION STEPS
─────────────────────────────────────────────────────────────────────────
1. Open: public/index.html (or Cloudflare Worker if using dynamic meta)

2. Find the meta tag section for the venues scene

3. Update to:

   <!-- Venues Scene Meta -->
   <meta property="og:title" content="77 Concert Venues I've Visited Since 1984 | Interactive Map">
   <meta property="og:description" content="Explore an interactive network visualization of 77 venues across 35 cities. See which artists played where, discover venue connections, and find your next show.">

4. Deploy changes

5. Request re-crawl in Google Search Console (optional, speeds up)

EXPECTED IMPACT
─────────────────────────────────────────────────────────────────────────
Metric:     Click-through rate for /?scene=venues
Current:    3.1% (≈13 clicks from 420 impressions/month)
Target:     6-8% (≈25-34 clicks/month)
Uplift:     +12-21 clicks/month (+90-160%)
Timeframe:  2-4 weeks for Google to re-crawl and measure

VERIFICATION
─────────────────────────────────────────────────────────────────────────
Check:      Google Search Console → Performance → Pages → /?scene=venues
Target:     CTR > 5% at similar position
When:       Re-run `/seo --compare 2026-01-20` in 3-4 weeks

═══════════════════════════════════════════════════════════════════════
```

### Playbook: Engagement Mismatch (High Bounce)

```
═══════════════════════════════════════════════════════════════════════
PLAYBOOK: Reduce Bounce Rate
═══════════════════════════════════════════════════════════════════════

DIAGNOSIS
─────────────────────────────────────────────────────────────────────────
Page:        /?scene=geography
Bounce Rate: 89% (site avg: 34%)
Sessions:    127/month
Problem:     113 visitors leave immediately without interacting

LIKELY CAUSES (investigate in order)
─────────────────────────────────────────────────────────────────────────
1. 🗺️  Map not loading — Check console for JS errors
2. 🎯 Intent mismatch — Users expect different content
3. 📱 Mobile issues — Map may be hard to use on phone
4. ⏱️  Slow load — Users leave before content appears
5. 🧭 No clear CTA — Users don't know what to do

INVESTIGATION STEPS
─────────────────────────────────────────────────────────────────────────
Step 1: Check for errors
  - Open: https://concerts.morperhaus.org/?scene=geography
  - Open browser DevTools (F12) → Console tab
  - Look for red errors, especially Leaflet or map-related

Step 2: Check search queries driving traffic
  - Open: Google Search Console → Performance
  - Filter by page: /?scene=geography
  - Look at "Queries" tab
  - Question: Do these queries match what the page shows?

Step 3: Test on mobile
  - Open page on your phone
  - Is the map visible? Interactive? Fast?
  - Can you tap markers easily?

Step 4: Check load time
  - Open: PageSpeed Insights
  - Enter: https://concerts.morperhaus.org/?scene=geography
  - Check mobile LCP (should be <2.5s)

COMMON FIXES
─────────────────────────────────────────────────────────────────────────
If map errors:
  → Check Leaflet initialization in Scene3Map.tsx
  → Verify tile server is responding

If intent mismatch:
  → Update meta description to accurately describe content
  → Add explanatory text above the map
  → Consider: Are users looking for directions? Event listings?

If mobile issues:
  → Increase marker touch targets (min 44x44px)
  → Add "tap a marker to explore" instruction
  → Test with touch events, not just click

If slow load:
  → Lazy load the map component
  → Reduce initial marker count
  → Use clustering for dense areas

QUICK WIN: Add orientation text
─────────────────────────────────────────────────────────────────────────
Add above the map:

  "Explore 178 concerts across 35 cities. Tap any marker to see
   which artists I've seen at that venue."

This sets expectations and gives users a clear action.

EXPECTED IMPACT
─────────────────────────────────────────────────────────────────────────
Metric:     Bounce rate for /?scene=geography
Current:    89%
Target:     50-60% (reasonable for interactive content)
Uplift:     +35-50 engaged visitors/month
Timeframe:  Immediate after fix, measurable in 1-2 weeks

VERIFICATION
─────────────────────────────────────────────────────────────────────────
Check:      GA4 → Reports → Engagement → Pages → /?scene=geography
Target:     Bounce rate < 60%
When:       Re-run `/seo` in 2 weeks

═══════════════════════════════════════════════════════════════════════
```

### Playbook: Zombie Page

```
═══════════════════════════════════════════════════════════════════════
PLAYBOOK: Handle Zombie Page
═══════════════════════════════════════════════════════════════════════

DIAGNOSIS
─────────────────────────────────────────────────────────────────────────
Page:        /?scene=genres&genre=ambient
Impressions: 847/month (people see it in search)
Clicks:      3/month (almost no one clicks)
Traffic:     2 visits/month (even direct traffic is dead)
Verdict:     This page exists in Google but provides no value

OPTIONS (choose one)
─────────────────────────────────────────────────────────────────────────

OPTION A: Improve the page (if content is valuable)
─────────────────────────────────────────────────────────────────────────
When to choose: The content is unique and worth keeping

Steps:
1. Rewrite title and description (see CTR Playbook)
2. Add more content to the page
3. Internal link to it from higher-traffic pages
4. Build 1-2 backlinks to it

Effort: High | Timeline: 2-3 months to see results

OPTION B: Consolidate into another page (recommended)
─────────────────────────────────────────────────────────────────────────
When to choose: Similar content exists elsewhere

Steps:
1. Identify the "parent" page (e.g., /?scene=genres)
2. Ensure parent page covers the content adequately
3. Add 301 redirect from zombie → parent:

   // In Cloudflare Worker or server config
   if (url.includes('genre=ambient')) {
     return Response.redirect('/?scene=genres', 301)
   }

4. Remove zombie page from sitemap.xml
5. Wait for Google to process redirect (2-4 weeks)

Effort: Low | Timeline: 2-4 weeks

OPTION C: Remove entirely
─────────────────────────────────────────────────────────────────────────
When to choose: Content has no value, no redirect target

Steps:
1. Return 410 Gone status (not 404):

   // In Cloudflare Worker
   if (url.includes('genre=ambient')) {
     return new Response('Gone', { status: 410 })
   }

2. Remove from sitemap.xml
3. Request removal in Google Search Console:
   → Removals → New Request → Remove this URL only

Effort: Low | Timeline: 1-2 weeks

EXPECTED IMPACT
─────────────────────────────────────────────────────────────────────────
Metric:     Site-wide crawl efficiency
Impact:     Google spends less budget on dead pages
Bonus:      Removes "thin content" signal from site quality

VERIFICATION
─────────────────────────────────────────────────────────────────────────
Check:      GSC → Pages → Search for the URL
Target:     Page no longer appears (if removed) or CTR > 1% (if improved)
When:       Check GSC in 4-6 weeks

═══════════════════════════════════════════════════════════════════════
```

### Playbook: Link-Worthy Content

```
═══════════════════════════════════════════════════════════════════════
PLAYBOOK: Build Backlinks to High-Value Content
═══════════════════════════════════════════════════════════════════════

DIAGNOSIS
─────────────────────────────────────────────────────────────────────────
Page:           /?scene=artists
Engagement:     High (4.2 pages/session, 3m avg time)
Backlinks:      3 referring domains
Opportunity:    Content resonates but lacks external authority

WHY THIS PAGE DESERVES LINKS
─────────────────────────────────────────────────────────────────────────
✅ High engagement proves content quality
✅ Interactive visualization is unique/shareable
✅ 253 artists with photos = comprehensive resource
✅ Concert history data is verifiable/citable

OUTREACH STRATEGY
─────────────────────────────────────────────────────────────────────────

Target Audiences:
1. Music bloggers who cover concert experiences
2. Data visualization enthusiasts (r/dataisbeautiful, Observable)
3. Local music journalists in cities with high venue counts
4. Artist fan communities (for top artists)

Outreach Template:
─────────────────────────────────────────────────────────────────────────
Subject: Interactive visualization of 40 years of concerts

Hi [Name],

I built an interactive archive of every concert I've attended since
1984 — 178 shows across 253 artists and 77 venues.

The artist scene lets you explore connections between artists,
venues, and genres through an interactive visualization:
[URL]

Thought this might interest your readers who [relevant hook for
their audience].

Would you be interested in checking it out?

[Your name]
─────────────────────────────────────────────────────────────────────────

WHERE TO SHARE (no outreach needed)
─────────────────────────────────────────────────────────────────────────
- Reddit: r/dataisbeautiful, r/Music, r/InternetIsBeautiful
- Hacker News: "Show HN" post
- Twitter/X: Tag data viz accounts, music accounts
- LinkedIn: Personal post about the project
- Product Hunt: If polished enough

CONTENT ADDITIONS THAT ATTRACT LINKS
─────────────────────────────────────────────────────────────────────────
Consider adding:
- "Embed this visualization" widget with iframe code
- Downloadable poster/infographic of top stats
- "Most-seen artists of [decade]" blog post
- API endpoint for data (attracts developer links)

EXPECTED IMPACT
─────────────────────────────────────────────────────────────────────────
Metric:     Referring domains to /?scene=artists
Current:    3 domains
Target:     10-15 domains over 3-6 months
SEO Impact: Higher domain authority, improved rankings across site

VERIFICATION
─────────────────────────────────────────────────────────────────────────
Check:      Ahrefs/SEMrush → Backlinks → Filter by target URL
            Or: GSC → Links → Top linked pages
Target:     5+ new referring domains
When:       Check monthly

═══════════════════════════════════════════════════════════════════════
```

### Playbook: Duplicate Content (GSC Warning)

```
═══════════════════════════════════════════════════════════════════════
PLAYBOOK: Fix Duplicate Content Warnings
═══════════════════════════════════════════════════════════════════════

DIAGNOSIS
─────────────────────────────────────────────────────────────────────────
Issue:      4 pages flagged "Duplicate without user-selected canonical"
Impact:     Google may index wrong version, diluting page authority
Pages:
  - /?scene=timeline (also indexed as /)
  - /?scene=artists&artist=depeche-mode (also indexed without scene param)
  - [etc.]

THE FIX: Add Canonical Tags
─────────────────────────────────────────────────────────────────────────

Step 1: Identify the "correct" URL for each duplicate set
  - Usually the one with all necessary parameters
  - Example: /?scene=artists&artist=depeche-mode (not just /depeche-mode)

Step 2: Add canonical link tag to <head>

  In public/index.html or via Cloudflare Worker:

  <link rel="canonical" href="https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode">

Step 3: For SPA with dynamic canonicals, add via JavaScript or Worker:

  // Cloudflare Worker example
  const canonicalUrl = new URL(request.url)
  canonicalUrl.search = canonicalUrl.searchParams.toString() // normalize params

  const canonicalTag = `<link rel="canonical" href="${canonicalUrl.href}">`
  html = html.replace('</head>', `${canonicalTag}</head>`)

Step 4: Update sitemap.xml to only include canonical URLs

Step 5: Request re-crawl in GSC for affected pages

IMPLEMENTATION FILE
─────────────────────────────────────────────────────────────────────────
Add to: public/index.html (line ~15, in <head>)

<!-- Dynamic canonical set by Cloudflare Worker -->
<!-- Fallback for direct access -->
<link rel="canonical" href="https://concerts.morperhaus.org/">

Or update Cloudflare Worker to inject correct canonical per-page.

EXPECTED IMPACT
─────────────────────────────────────────────────────────────────────────
Metric:     GSC Coverage warnings
Current:    4 duplicates
Target:     0 duplicates
Bonus:      Consolidated link equity improves rankings

VERIFICATION
─────────────────────────────────────────────────────────────────────────
Check:      GSC → Indexing → Pages → "Duplicate without canonical"
Target:     0 pages in this category
When:       Check GSC in 2-4 weeks after fix deployed

═══════════════════════════════════════════════════════════════════════
```

### Playbook Generation Logic

```typescript
function generatePlaybook(insight: CorrelationInsight, context: AnalysisContext): ActionablePlaybook {
  switch (insight.type) {
    case 'ctr_opportunity':
      return generateCTRPlaybook(insight, context)
    case 'engagement_mismatch':
      return generateBouncePlaybook(insight, context)
    case 'zombie_page':
      return generateZombiePlaybook(insight, context)
    case 'linkworthy_content':
      return generateOutreachPlaybook(insight, context)
    case 'content_gap':
      return generateIndexingPlaybook(insight, context)
    case 'authority_mismatch':
      return generateOnPagePlaybook(insight, context)
    case 'cannibalizing_pages':
      return generateConsolidationPlaybook(insight, context)
    default:
      return generateGenericPlaybook(insight, context)
  }
}

// CTR playbook generates suggested titles using proven patterns
function generateCTRPlaybook(insight: CorrelationInsight, context: AnalysisContext): ActionablePlaybook {
  const page = context.crawlData.find(p => urlMatch(p.url, insight.affectedPages[0]))
  const gscPage = context.gscData?.pages.find(p => urlMatch(p.page, insight.affectedPages[0]))

  // Generate title suggestions using templates
  const suggestedTitles = generateTitleSuggestions(page, context)
  const suggestedDescriptions = generateDescriptionSuggestions(page, context)

  return {
    insight,
    diagnosis: {
      current: `Title: "${page?.title}" | CTR: ${(gscPage?.ctr || 0 * 100).toFixed(1)}%`,
      expected: `CTR of ${(context.avgCTR * 100).toFixed(1)}% or higher at position #${gscPage?.position.toFixed(1)}`,
      gap: `Missing ${Math.round((context.avgCTR - (gscPage?.ctr || 0)) / context.avgCTR * 100)}% of potential clicks`
    },
    fix: {
      summary: 'Rewrite title and meta description to increase click-through rate',
      steps: [
        `Open: ${getMetaTagFile(context)}`,
        `Find meta tags for: ${insight.affectedPages[0]}`,
        `Update title to: "${suggestedTitles[0]}"`,
        `Update description to: "${suggestedDescriptions[0]}"`,
        'Deploy changes',
        '(Optional) Request re-crawl in Google Search Console'
      ],
      codeSnippet: generateMetaTagSnippet(suggestedTitles[0], suggestedDescriptions[0]),
      fileToEdit: getMetaTagFile(context)
    },
    impact: {
      metric: 'Click-through rate',
      estimate: `+${Math.round((context.avgCTR - (gscPage?.ctr || 0)) * (gscPage?.impressions || 0))} clicks/month`,
      timeframe: '2-4 weeks'
    },
    verification: {
      method: 'Google Search Console → Performance → Pages',
      target: `CTR > ${(context.avgCTR * 0.8 * 100).toFixed(1)}%`,
      checkAfter: '3-4 weeks'
    }
  }
}

// Title suggestion templates based on page type
function generateTitleSuggestions(page: PageAnalysis, context: AnalysisContext): string[] {
  const suggestions: string[] = []

  // Extract key stats from context
  const stats = context.siteStats

  if (page?.url.includes('scene=venues')) {
    suggestions.push(`${stats.venueCount} Concert Venues I've Visited Since ${stats.firstYear} | Interactive Map`)
    suggestions.push(`Explore ${stats.venueCount} Venues Across ${stats.cityCount} Cities | Concert History`)
    suggestions.push(`My Concert Venue Map: ${stats.venueCount} Venues, ${stats.concertCount} Shows`)
  } else if (page?.url.includes('scene=artists')) {
    suggestions.push(`${stats.artistCount} Artists I've Seen Live | Interactive Concert Archive`)
    suggestions.push(`Concert History: ${stats.artistCount} Artists, ${stats.concertCount} Shows Since ${stats.firstYear}`)
  } else if (page?.url.includes('scene=timeline')) {
    suggestions.push(`${stats.concertCount} Concerts Since ${stats.firstYear} | Visual Timeline`)
    suggestions.push(`My ${stats.yearSpan}-Year Concert Journey: ${stats.concertCount} Shows`)
  }
  // ... more patterns

  return suggestions
}
```

---

## Output Formats

### CLI Dashboard (Enhanced)

```
═══════════════════════════════════════════════════════════════════════
                         SEO ANALYSIS DASHBOARD
═══════════════════════════════════════════════════════════════════════
Site: https://concerts.morperhaus.org
Date: 2026-01-20
Period: 2025-12-23 to 2026-01-20 (28 days)
═══════════════════════════════════════════════════════════════════════

DATA SOURCES:          ✅ Crawl    ✅ GSC    ✅ GA4    ⬚ Backlinks
CONFIDENCE:            92% (3/4 sources)

═══════════════════════════════════════════════════════════════════════

OVERALL SCORE: 84/100 🟢

Category Breakdown:
───────────────────────────────────────────────────────────────────────
🔧 Technical Foundation        23/25  (92%) 🟢  █████████░
📝 Content Quality             26/30  (87%) 🟢  █████████░
🧠 Semantic Intelligence       17/20  (85%) 🟢  ████████░░
⭐ Authority & Trust           10/15  (67%) 🟡  ███████░░░  ← needs backlinks
👤 User Experience              8/10  (80%) 🟢  ████████░░
🤖 AI Agent Readiness           8/10  (80%) 🟢  ████████░░

═══════════════════════════════════════════════════════════════════════
SEARCH CONSOLE INSIGHTS (28 days)
═══════════════════════════════════════════════════════════════════════

📊 Search Performance:
   Total Impressions:     12,847
   Total Clicks:             892
   Average CTR:            6.9%
   Average Position:        8.2

🔝 Top Performing Pages:
   /?scene=artists         4,210 imp    312 clicks    7.4% CTR    #6.1
   /?scene=timeline        3,102 imp    198 clicks    6.4% CTR    #7.8
   /                       2,541 imp    187 clicks    7.4% CTR    #5.2

📈 Index Coverage:
   ✅ Valid:    156 pages
   ⚠️ Warning:   4 pages (duplicate without canonical)
   ❌ Error:     0 pages
   ⬚ Excluded: 12 pages (crawled, not indexed)

═══════════════════════════════════════════════════════════════════════
ANALYTICS INSIGHTS (28 days)
═══════════════════════════════════════════════════════════════════════

👥 Engagement:
   Sessions:           1,247
   Users:                982
   Bounce Rate:        34.2% 🟢
   Avg Duration:      2m 48s
   Pages/Session:        3.2

⚡ Core Web Vitals (Field Data):
   LCP:    1.8s  🟢  (target <2.5s)
   FID:     42ms 🟢  (target <100ms)
   CLS:   0.08   🟢  (target <0.1)
   INP:    156ms 🟡  (target <200ms)

🚦 Traffic Sources:
   Organic Search:    67% (834 sessions)
   Direct:            21% (262 sessions)
   Social:             8% (100 sessions)
   Referral:           4%  (50 sessions)

═══════════════════════════════════════════════════════════════════════
CORRELATION INSIGHTS
═══════════════════════════════════════════════════════════════════════

🔴 CRITICAL (0)
   None detected

🟡 WARNING (2)

   1. CTR Opportunity
      /?scene=venues ranks #4.2 but has only 3.1% CTR (avg: 6.9%)
      → Improve title/description to increase clicks
      Sources: GSC + Crawl | Impact: High

   2. Engagement Mismatch
      /?scene=geography has 89% bounce rate despite good traffic
      → Users may not find expected content, check intent alignment
      Sources: GA4 + Crawl | Impact: Medium

🟢 OPPORTUNITIES (3)

   1. Link-Worthy Content
      /?scene=artists has high engagement but only 3 referring domains
      → Good candidate for outreach/link building
      Sources: GA4 + Backlinks | Impact: High

   [...]

═══════════════════════════════════════════════════════════════════════
RECOMMENDATIONS
═══════════════════════════════════════════════════════════════════════

🎯 QUICK WINS (Do First)
───────────────────────────────────────────────────────────────────────
1. Improve venues page title/description
   Impact: +15-30 clicks/month | Effort: 15 minutes
   Current: "Venues | Morperhaus Concerts"
   Suggested: "77 Concert Venues Visited Since 1984 | Interactive Map"

2. Fix 4 duplicate content warnings in GSC
   Impact: Cleaner index | Effort: 30 minutes
   Add canonical tags to affected pages

🚀 STRATEGIC
───────────────────────────────────────────────────────────────────────
3. Investigate geography page bounce rate
   Impact: Improved engagement | Effort: 1-2 hours
   Check if map loads properly, content matches search intent

4. Build backlinks to high-engagement pages
   Impact: Authority boost | Effort: Ongoing
   Target: artists scene, timeline scene

═══════════════════════════════════════════════════════════════════════
```

### Markdown Report

Same content as CLI but formatted for file storage, with additional sections:
- Full page-by-page breakdown
- Query analysis table
- Historical comparison (if baseline provided)
- Raw data appendix

### HTML Report

Styled version of Markdown for sharing:
- Responsive design
- Interactive charts (optional)
- Print-friendly CSS
- No external dependencies (inline styles)

### JSON Export

Full structured data for programmatic consumption:

```json
{
  "metadata": { ... },
  "scores": { ... },
  "crawlData": [ ... ],
  "gscData": { ... },
  "ga4Data": { ... },
  "backlinkData": { ... },
  "insights": [ ... ],
  "recommendations": [ ... ]
}
```

### CSV Export (Spreadsheet-Friendly)

For users who want to analyze data in Google Sheets or Excel:

```bash
/seo --output csv
```

Produces multiple CSV files, each optimized for spreadsheet analysis:

```
seo-reports/2026-01-20/
├── pages.csv           # Page-by-page metrics
├── queries.csv         # Search queries (from GSC)
├── insights.csv        # Issues and recommendations
├── summary.csv         # Overall scores
└── backlinks.csv       # Referring domains (if available)
```

**pages.csv:**

```csv
URL,Title,Title Length,Description,Desc Length,Impressions,Clicks,CTR,Position,Bounce Rate,Avg Time (sec),Sessions,Schema,OG Tags,H1 Count,Issues
/?scene=venues,"Venues | Morperhaus",19,"View venues",11,420,13,3.1%,4.2,45%,135,89,Yes,Yes,1,"Low CTR"
/?scene=artists,"Artists | Morperhaus",21,"View artists",12,1250,89,7.1%,6.8,32%,225,156,Yes,Yes,1,""
/?scene=geography,"Geography | Morperhaus",24,"Concert map",11,340,28,8.2%,5.1,89%,45,127,Yes,Yes,1,"High bounce"
```

**queries.csv:**

```csv
Query,Impressions,Clicks,CTR,Position,Top Page
concert archive,847,62,7.3%,4.2,/?scene=timeline
depeche mode concerts,312,41,13.1%,3.8,/?scene=artists&artist=depeche-mode
live music visualization,156,8,5.1%,8.4,/?scene=artists
```

**insights.csv:**

```csv
Type,Severity,Page,Issue,Current Value,Target Value,Recommendation,Impact,Effort,Playbook
CTR Opportunity,Warning,/?scene=venues,"CTR below average",3.1%,6.9%,"Rewrite title/description",High,Low,See CTR Playbook
Engagement Mismatch,Warning,/?scene=geography,"High bounce rate",89%,50%,"Check mobile UX and intent",Medium,Medium,See Bounce Playbook
Link-Worthy Content,Opportunity,/?scene=artists,"High engagement low backlinks",3 domains,15 domains,"Outreach campaign",High,High,See Outreach Playbook
```

**summary.csv:**

```csv
Metric,Value,Max,Percentage,Rating
Overall Score,84,100,84%,Good
Technical Foundation,23,25,92%,Good
Content Quality,26,30,87%,Good
Semantic Intelligence,17,20,85%,Good
Authority & Trust,10,15,67%,Needs Work
User Experience,8,10,80%,Good
AI Agent Readiness,8,10,80%,Good
Data Confidence,92%,100%,92%,High
```

**CSV Design Principles:**

1. **Headers are human-readable** — "Bounce Rate" not "bounce_rate"
2. **Percentages include % symbol** — Easier to read, Sheets handles it
3. **One insight per row** — Easy to filter and sort
4. **Links to playbooks** — Reference detailed guidance
5. **No merged cells** — Clean import into any spreadsheet tool

### Google Sheets Direct Export (Optional)

For users with Google OAuth configured, offer direct Sheets creation:

```
📊 EXPORT OPTIONS
═══════════════════════════════════════════════════════════════

Where would you like to export your data?

  [1] 💾 Save as CSV files
      Open in Excel, Google Sheets, or any spreadsheet app

  [2] 📊 Create Google Sheet (recommended)
      Opens directly in your browser, ready to share

  [3] 📁 Both CSV and Google Sheet

Enter choice: 2

Creating Google Sheet...
✓ Sheet created: "SEO Report - concerts.morperhaus.org - 2026-01-20"

Tabs created:
  • Summary — Overall scores and ratings
  • Pages — Page-by-page metrics
  • Queries — Search query performance
  • Insights — Issues and recommendations
  • Historical — Comparison to previous reports

✓ Opening in browser...

📎 Link: https://docs.google.com/spreadsheets/d/1abc123.../edit

Share this link with your team!
```

**Google Sheets Features:**

- **Conditional formatting** — Red/yellow/green for scores
- **Sparkline charts** — Trend visualization in cells
- **Data validation** — Dropdowns for filtering by severity
- **Named ranges** — Easy reference in formulas
- **Protected summary tab** — Prevent accidental edits
- **Auto-refresh capability** — Re-run analysis updates the sheet

**Implementation:**

Uses Google Sheets API (already have OAuth for GSC/GA4):

```typescript
// Additional OAuth scope needed
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

async function exportToGoogleSheets(report: SEOReport): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: oauthClient })

  // Create new spreadsheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `SEO Report - ${report.metadata.url} - ${report.metadata.date}`
      },
      sheets: [
        { properties: { title: 'Summary' } },
        { properties: { title: 'Pages' } },
        { properties: { title: 'Queries' } },
        { properties: { title: 'Insights' } },
        { properties: { title: 'Historical' } },
      ]
    }
  })

  const spreadsheetId = spreadsheet.data.spreadsheetId

  // Populate each tab with data
  await populateSummaryTab(sheets, spreadsheetId, report)
  await populatePagesTab(sheets, spreadsheetId, report)
  await populateQueriesTab(sheets, spreadsheetId, report)
  await populateInsightsTab(sheets, spreadsheetId, report)

  // Apply formatting
  await applyConditionalFormatting(sheets, spreadsheetId)

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
}
```

---

## Command Line Interface

### Updated Arguments

```bash
/seo [options]

Options:
  --url <url>           Target URL (default: from config or current project)
  --baseline            Save current results as baseline
  --compare <date>      Compare to baseline (YYYY-MM-DD)
  --days <n>            Analysis period in days (default: 28, max: 90)

  --output <formats>    Output formats: cli,md,html,json,csv,sheets (default: cli,md)

  --gsc                 Enable Google Search Console (if configured)
  --no-gsc              Disable GSC even if configured
  --ga4                 Enable Google Analytics 4 (if configured)
  --no-ga4              Disable GA4 even if configured
  --backlinks           Enable backlink analysis (if configured)
  --no-backlinks        Disable backlinks even if configured

  --quick               Crawl only, skip API calls (fastest)
  --full                Enable all configured data sources

  --setup               Run credential setup wizard
  --cache-clear         Clear cached API responses

Examples:
  /seo                          # Standard analysis with configured sources
  /seo --quick                  # Fast crawl-only mode
  /seo --full --baseline        # Full analysis, save as baseline
  /seo --compare 2026-01-01     # Compare to January baseline
  /seo --output html,json       # Export HTML and JSON only
  /seo --setup                  # Configure credentials
```

---

## User Experience for Non-Technical Users

Users of this tool may be marketers, content managers, or site owners who are not CLI-proficient. The tool must be approachable and helpful at every step.

### Design Principles

1. **No command memorization required** — Interactive prompts guide users through options
2. **Plain English over jargon** — "Your page isn't showing up in Google" not "Index coverage error"
3. **Always explain why** — Don't just show data, explain what it means
4. **Safe defaults** — Running `/seo` with no arguments should do something useful
5. **Escape hatches visible** — Always show how to get help or go back

### Interactive Mode (Default)

When run without arguments, the tool enters interactive mode:

```
🔍 SEO ANALYZER
═══════════════════════════════════════════════════════════════

Welcome! This tool will analyze your website's SEO health.

What would you like to do?

  [1] 📊 Run full analysis (recommended)
      Analyze your site with all available data sources

  [2] ⚡ Quick check
      Fast crawl-only scan (no API calls)

  [3] 📈 Compare to previous
      See what's changed since your last analysis

  [4] ⚙️  Setup & configure
      Connect Google Search Console, Analytics, etc.

  [5] ❓ Help & documentation
      Learn what this tool can do

Enter choice (1-5): _
```

### Progressive Disclosure

Don't overwhelm users with all options at once. Show complexity progressively:

**Level 1 (default):** Simple numbered choices
**Level 2 (if needed):** "Press 'a' for advanced options"
**Level 3 (power users):** Full CLI flags documented in `--help`

### Friendly Error Messages

Instead of:
```
Error: ENOENT: no such file or directory, open '/Users/.../.seo-analyzer/credentials.json'
```

Show:
```
🔧 SETUP NEEDED
═══════════════════════════════════════════════════════════════

I couldn't find your configuration file. This is normal for
first-time users!

To get the most out of this tool, you'll need to connect your
Google Search Console and Analytics accounts.

Would you like to set that up now?

  [1] Yes, let's configure (opens browser for Google sign-in)
  [2] Skip for now (run with limited features)
  [3] I have credentials to enter manually

Enter choice: _
```

### Progress Indicators

Long-running operations should show progress:

```
📊 ANALYZING YOUR SITE
═══════════════════════════════════════════════════════════════

Crawling pages...
  ✓ Homepage                           142ms
  ✓ /?scene=timeline                   187ms
  ✓ /?scene=venues                     156ms
  ● /?scene=geography                  [fetching...]
    /?scene=genres
    /?scene=artists
    ... and 6 more

Progress: ████████░░░░░░░░░░░░ 4/12 pages (33%)
```

### Contextual Help

At any prompt, typing `?` shows context-sensitive help:

```
Enter choice (1-5): ?

HELP: Main Menu
═══════════════════════════════════════════════════════════════

[1] Run full analysis
    This will:
    - Crawl your website's key pages
    - Check Google Search Console for rankings and clicks
    - Check Google Analytics for user engagement
    - Generate a report with recommendations

    Best for: Monthly checkups, after making changes

[2] Quick check
    This will:
    - Crawl pages only (no API calls)
    - Check for technical issues
    - Run in under 30 seconds

    Best for: Quick sanity checks, testing changes

... (more help text)

Press Enter to go back to the menu: _
```

### Report Readability

Reports should be scannable by non-experts:

**Instead of:**
```
Technical Foundation: 22/25 (88%)
```

**Show:**
```
🔧 TECHNICAL HEALTH: 88% — Good!
═══════════════════════════════════════════════════════════════

Your site's technical foundation is solid. Google can find and
crawl your pages without issues.

✅ Sitemap is working
✅ Fast page loads (avg 187ms)
✅ All pages are indexable
⚠️  4 pages have duplicate content warnings (see below)

What this means: Search engines can easily discover your content.
The duplicate content warnings are minor but worth fixing.
```

### Jargon Translation

The tool should translate SEO jargon into plain English:

| Technical Term | User-Friendly Translation |
|----------------|---------------------------|
| CTR | "Click rate" or "how often people click your link" |
| Impressions | "How many times your page appeared in search" |
| Bounce rate | "Visitors who left immediately" |
| Canonical | "The main version of this page" |
| Backlinks | "Other sites linking to you" |
| Domain authority | "How trusted your site is" |
| Index coverage | "Pages Google knows about" |
| Core Web Vitals | "Page speed and usability scores" |

### Confirmation Before Destructive Actions

Always confirm before actions that could cause problems:

```
⚠️  CONFIRM ACTION
═══════════════════════════════════════════════════════════════

You're about to clear all cached data. This means:
- Next analysis will take longer (fresh API calls)
- No data will be lost from your reports

Are you sure? (y/n): _
```

### Success Messages with Next Steps

After completing an action, always tell the user what to do next:

```
✅ ANALYSIS COMPLETE
═══════════════════════════════════════════════════════════════

Your SEO report is ready!

📄 Report saved to: seo-reports/2026-01-20-report.md
📊 Baseline saved: seo-reports/2026-01-20-baseline.json

WHAT TO DO NEXT:
─────────────────────────────────────────────────────────────────

1. Review the Quick Wins section (3 items)
   → These are easy fixes with high impact

2. Open the HTML report to share with your team:
   → open seo-reports/2026-01-20-report.html

3. After making changes, re-run to compare:
   → /seo --compare 2026-01-20

Need help understanding the report? Type: /seo --help report
```

### Keyboard Shortcuts

For users who become proficient, offer shortcuts:

```
KEYBOARD SHORTCUTS (shown at bottom of interactive screens)
─────────────────────────────────────────────────────────────────
q = quit    ? = help    ↑↓ = navigate    Enter = select
a = advanced options    r = refresh    b = back
```

### Accessibility Considerations

- **Color is not the only indicator** — Use symbols (✅ ❌ ⚠️) alongside colors
- **Screen reader friendly** — Progress messages work without visual bars
- **High contrast mode** — Dashboard works in terminals with limited colors
- **No flashing or animation** — Static output, no spinners that could cause issues

### Example: Complete First-Run Experience

```
$ /seo

🔍 SEO ANALYZER — First Time Setup
═══════════════════════════════════════════════════════════════

Welcome! I'll help you analyze your website's SEO health.

First, let me check if I can find your website...

✓ Found project: concerts.morperhaus.org

ABOUT THIS TOOL
─────────────────────────────────────────────────────────────────
This tool analyzes your website and tells you:
• How Google sees your site (Search Console data)
• How visitors interact with it (Analytics data)
• What you can do to improve rankings

The more data sources you connect, the better insights you'll get.

QUICK START OPTIONS
─────────────────────────────────────────────────────────────────

  [1] 🚀 Run basic analysis now
      Works immediately, no setup needed
      Shows: page structure, meta tags, technical issues

  [2] ⭐ Connect Google accounts first (recommended)
      Takes 2 minutes, much better insights
      Shows: real search rankings, visitor behavior, specific fixes

What would you like to do? (1 or 2): 2

CONNECTING GOOGLE ACCOUNTS
─────────────────────────────────────────────────────────────────

I'll open your browser to sign in with Google. This gives me
read-only access to:

• Search Console — see how your pages rank in Google
• Analytics — see how visitors use your site

Your data stays on your computer. I never upload it anywhere.

Ready? Press Enter to open browser, or 'q' to skip: [Enter]

Opening browser...

[Browser opens, user completes OAuth]

✓ Connected to Google!

Found these properties:
  [1] Search Console: sc-domain:morperhaus.org
  [2] Analytics: Morperhaus Concerts (GA4)

Use these? (y/n): y

✓ Configuration saved!

NOW RUNNING YOUR FIRST ANALYSIS...
═══════════════════════════════════════════════════════════════

[Analysis proceeds with friendly progress indicators]
```

---

## Caching Strategy

### Cache Structure

```
~/.seo-analyzer/cache/
├── concerts.morperhaus.org/
│   ├── crawl/
│   │   └── 2026-01-20.json       # 24-hour TTL
│   ├── gsc/
│   │   └── 2026-01-20.json       # 7-day TTL
│   ├── ga4/
│   │   └── 2026-01-20.json       # 7-day TTL
│   └── backlinks/
│       └── 2026-01-20.json       # 7-day TTL
└── another-site.com/
    └── ...
```

### TTL Settings

| Data Source | Default TTL | Rationale |
|-------------|-------------|-----------|
| Crawl data | 1 day | HTML changes frequently during development |
| GSC data | 3 days | Data is 2-3 days delayed anyway, balance freshness vs API calls |
| GA4 data | 1 day | Near real-time data, stale quickly |
| Backlink data | 14 days | Changes slowly, API costs money |
| Baselines | 90 days | Historical comparison data |

### Cache Commands

```bash
/seo --cache-clear              # Clear all cached data
/seo --cache-clear --gsc        # Clear only GSC cache
```

---

## Implementation Plan

### Phase 1: Credential Management System

**Effort:** Medium

**Files to Create:**
- `scripts/seo/credentials.ts` — Credential storage and retrieval
- `scripts/seo/oauth.ts` — Google OAuth flow
- `scripts/seo/setup.ts` — Interactive setup wizard

**Tasks:**
1. Implement credential storage hierarchy (env → file → OAuth)
2. Create Google OAuth flow with required scopes
3. Build interactive setup wizard
4. Add credential validation
5. Implement secure storage warnings

**Acceptance Criteria:**
- [ ] Can authenticate via environment variables
- [ ] Can authenticate via config file
- [ ] Can authenticate via OAuth flow
- [ ] Setup wizard guides user through configuration
- [ ] Warns if credentials might be committed to git

### Phase 2: Google Search Console Integration

**Effort:** Medium

**Files to Create:**
- `scripts/seo/clients/gsc.ts` — GSC API client

**Files to Modify:**
- `scripts/analyze-seo.ts` — Integrate GSC data

**Tasks:**
1. Implement GSC API client with auth
2. Fetch page-level metrics
3. Fetch query-level metrics
4. Fetch index coverage data
5. Map GSC data to scoring categories
6. Add GSC section to dashboard

**Acceptance Criteria:**
- [ ] Fetches search performance data for last 28 days
- [ ] Shows top pages by clicks and impressions
- [ ] Shows top queries
- [ ] Shows index coverage status
- [ ] Gracefully degrades when GSC unavailable

### Phase 3: Google Analytics 4 Integration

**Effort:** Medium

**Files to Create:**
- `scripts/seo/clients/ga4.ts` — GA4 Data API client
- `scripts/seo/clients/crux.ts` — Chrome UX Report API client

**Files to Modify:**
- `scripts/analyze-seo.ts` — Integrate GA4 data

**Tasks:**
1. Implement GA4 Data API client
2. Fetch overview metrics (sessions, bounce rate, etc.)
3. Fetch page-level engagement metrics
4. Integrate CrUX API for Core Web Vitals
5. Fetch traffic source breakdown
6. Map GA4 data to scoring categories
7. Add GA4 section to dashboard

**Acceptance Criteria:**
- [ ] Fetches engagement metrics for last 28 days
- [ ] Shows page-level bounce rates and time on page
- [ ] Shows real Core Web Vitals (field data)
- [ ] Shows traffic source breakdown
- [ ] Gracefully degrades when GA4 unavailable

### Phase 4: Backlink API Scaffolding

**Effort:** Medium

**Files to Create:**
- `scripts/seo/clients/backlinks.ts` — Provider interface
- `scripts/seo/clients/ahrefs.ts` — Ahrefs implementation
- `scripts/seo/clients/semrush.ts` — SEMrush implementation

**Files to Modify:**
- `scripts/analyze-seo.ts` — Integrate backlink data

**Tasks:**
1. Define BacklinkProvider interface
2. Implement Ahrefs client (API v3)
3. Implement SEMrush client
4. Create factory function for provider selection
5. Map backlink data to scoring categories
6. Add backlinks section to dashboard

**Acceptance Criteria:**
- [ ] Can fetch data from Ahrefs if configured
- [ ] Can fetch data from SEMrush if configured
- [ ] Shows domain rating/authority score
- [ ] Shows referring domains count
- [ ] Shows top referrers
- [ ] Gracefully degrades when no backlink API configured

### Phase 5: Correlation Insights Engine

**Effort:** High

**Files to Create:**
- `scripts/seo/insights/engine.ts` — Main correlation engine
- `scripts/seo/insights/detectors/*.ts` — Individual insight detectors

**Files to Modify:**
- `scripts/analyze-seo.ts` — Integrate insights

**Tasks:**
1. Implement insight detection framework
2. Build content gap detector (crawl + GSC)
3. Build CTR opportunity detector (GSC + crawl)
4. Build engagement mismatch detector (GA4 + crawl)
5. Build zombie page detector (GSC + GA4)
6. Build authority mismatch detector (backlinks + GSC)
7. Build link-worthy content detector (backlinks + GA4)
8. Implement cannibalization detector (GSC queries)
9. Add insights section to dashboard
10. Prioritize recommendations based on insights

**Acceptance Criteria:**
- [ ] Detects insights that require multiple data sources
- [ ] Prioritizes by severity and impact
- [ ] Links recommendations to source insights
- [ ] Only shows insights when required data sources available

### Phase 6: Output Format Options

**Effort:** Low-Medium

**Files to Create:**
- `scripts/seo/reporters/html.ts` — HTML report generator
- `scripts/seo/reporters/json.ts` — JSON export

**Files to Modify:**
- `scripts/seo/reporters/markdown.ts` — Enhance existing
- `scripts/seo/reporters/cli.ts` — Enhance existing
- `scripts/analyze-seo.ts` — Support multiple outputs

**Tasks:**
1. Refactor existing Markdown reporter
2. Create HTML report template (self-contained)
3. Create JSON export format
4. Support multiple output formats in single run
5. Add `--output` flag handling

**Acceptance Criteria:**
- [ ] Can output CLI dashboard
- [ ] Can output Markdown report
- [ ] Can output HTML report (single file, no external deps)
- [ ] Can output JSON export
- [ ] Can combine multiple formats in one run

---

## File Structure After Implementation

```
scripts/
├── analyze-seo.ts              # Main entry point (refactored)
└── seo/
    ├── index.ts                # Module exports
    ├── types.ts                # TypeScript interfaces
    ├── config.ts               # Configuration handling
    ├── credentials.ts          # Credential management
    ├── oauth.ts                # Google OAuth flow
    ├── setup.ts                # Interactive setup wizard
    ├── cache.ts                # Caching layer
    ├── clients/
    │   ├── crawler.ts          # Page crawler (extracted)
    │   ├── gsc.ts              # Google Search Console
    │   ├── ga4.ts              # Google Analytics 4
    │   ├── crux.ts             # Chrome UX Report
    │   ├── backlinks.ts        # Backlink provider interface
    │   ├── ahrefs.ts           # Ahrefs implementation
    │   └── semrush.ts          # SEMrush implementation
    ├── insights/
    │   ├── engine.ts           # Correlation engine
    │   └── detectors/
    │       ├── content-gap.ts
    │       ├── ctr-opportunity.ts
    │       ├── engagement-mismatch.ts
    │       ├── zombie-page.ts
    │       ├── authority-mismatch.ts
    │       ├── linkworthy-content.ts
    │       └── cannibalization.ts
    ├── scoring/
    │   ├── index.ts            # Score calculator
    │   ├── technical.ts
    │   ├── content.ts
    │   ├── semantic.ts
    │   ├── authority.ts
    │   ├── ux.ts
    │   └── ai-readiness.ts
    └── reporters/
        ├── cli.ts              # CLI dashboard
        ├── markdown.ts         # Markdown report
        ├── html.ts             # HTML report
        └── json.ts             # JSON export
```

---

## Testing Strategy

### Manual Testing Checklist

**Credential Management:**
- [ ] Can run setup wizard from scratch
- [ ] Environment variables are detected and used
- [ ] Config file is read from ~/.seo-analyzer/
- [ ] OAuth flow completes successfully
- [ ] Invalid credentials show clear error

**GSC Integration:**
- [ ] Fetches data for configured property
- [ ] Shows meaningful metrics in dashboard
- [ ] Handles no-data gracefully (new sites)
- [ ] Respects rate limits
- [ ] Caches responses appropriately

**GA4 Integration:**
- [ ] Fetches data for configured property
- [ ] Shows engagement metrics accurately
- [ ] Core Web Vitals match CrUX dashboard
- [ ] Handles missing CWV data (low traffic sites)
- [ ] Caches responses appropriately

**Backlink APIs:**
- [ ] Ahrefs client fetches correct data
- [ ] SEMrush client fetches correct data
- [ ] Provider selection works correctly
- [ ] Shows "not configured" when no API key

**Correlation Insights:**
- [ ] Content gap detection finds real issues
- [ ] CTR opportunities are actionable
- [ ] Engagement mismatches are accurate
- [ ] Insights only appear with required data sources

**Output Formats:**
- [ ] CLI dashboard renders correctly
- [ ] Markdown report is well-formatted
- [ ] HTML report is self-contained
- [ ] JSON export is valid and complete

### Test Sites

1. **concerts.morperhaus.org** — Primary test site (has GSC/GA4)
2. **New site with no data** — Test graceful degradation
3. **High-traffic site** — Test with more data volume

---

## Dependencies

### New npm Packages

```json
{
  "dependencies": {
    "googleapis": "^126.0.0",        // GSC and GA4 APIs
    "open": "^9.0.0"                 // Open browser for OAuth
  },
  "devDependencies": {
    "@types/googleapis": "^0.0.0"
  }
}
```

### API Requirements

| Service | Authentication | Free Tier | Rate Limits |
|---------|----------------|-----------|-------------|
| Google Search Console | OAuth2 | Yes | 1,200 req/min |
| Google Analytics 4 | OAuth2 | Yes | 10,000 req/day |
| Chrome UX Report | API Key | Yes | 150 req/day |
| Ahrefs | API Key | No ($99+/mo) | Varies by plan |
| SEMrush | API Key | No ($120+/mo) | Varies by plan |

### Rate Limiting Strategy

Conservative rate limiting to avoid hitting quotas:

```typescript
const RATE_LIMITS = {
  gsc: {
    requestsPerMinute: 60,      // Well under 1,200 limit
    requestsPerDay: 1000,       // Conservative daily cap
    retryAttempts: 3,
    retryDelayMs: 1000,         // Exponential backoff base
  },
  ga4: {
    requestsPerMinute: 30,      // GA4 can be strict
    requestsPerDay: 5000,       // Half of 10k limit
    retryAttempts: 3,
    retryDelayMs: 2000,
  },
  crux: {
    requestsPerMinute: 10,      // Very conservative (150/day limit)
    requestsPerDay: 100,
    retryAttempts: 2,
    retryDelayMs: 5000,
  },
  backlinks: {
    requestsPerMinute: 10,      // Paid APIs, be respectful
    requestsPerDay: 100,
    retryAttempts: 2,
    retryDelayMs: 3000,
  },
}

interface RateLimiter {
  canMakeRequest(): boolean
  recordRequest(): void
  waitForSlot(): Promise<void>
  getStats(): { remaining: number; resetsAt: Date }
}
```

**Exponential Backoff:**

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  config: { attempts: number; baseDelayMs: number }
): Promise<T> {
  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === config.attempts) throw error
      if (isRateLimitError(error)) {
        const delay = config.baseDelayMs * Math.pow(2, attempt - 1)
        console.log(`Rate limited, retrying in ${delay}ms...`)
        await sleep(delay)
      } else {
        throw error
      }
    }
  }
}
```

### Baseline Storage

Baselines are stored in the project directory for version control:

```text
seo-reports/
├── baselines/
│   ├── 2026-01-20.json       # Full analysis snapshot
│   ├── 2026-01-13.json
│   └── latest.json           # Symlink to most recent
├── reports/
│   ├── 2026-01-20.md         # Human-readable report
│   └── 2026-01-20.html       # HTML version
└── exports/
    ├── 2026-01-20-pages.csv
    ├── 2026-01-20-queries.csv
    └── 2026-01-20-insights.csv
```

**Baseline Format:**

```typescript
interface Baseline {
  version: string             // "1.4.0"
  timestamp: string           // ISO 8601
  url: string
  scores: SEOScores
  dataSources: {
    crawl: boolean
    gsc: boolean
    ga4: boolean
    backlinks: 'ahrefs' | 'semrush' | 'none'
  }
  // Compact summaries for comparison
  pageCount: number
  totalImpressions?: number
  totalClicks?: number
  avgPosition?: number
  insights: CorrelationInsight[]
}
```

### CrUX API Configuration

Core Web Vitals field data requires a separate API key (not OAuth):

```bash
# In .env
CRUX_API_KEY=AIzaSy...          # Google Cloud API key with CrUX API enabled
```

**Fallback Behavior:**

1. If `CRUX_API_KEY` set → Use CrUX API (real field data)
2. If not set → Fall back to PageSpeed Insights API (lab data)
3. If both fail → Show "Core Web Vitals: unavailable" with setup instructions

**Setup Instructions (shown when unavailable):**

```text
Core Web Vitals data requires a Google Cloud API key:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create an API key
3. Enable: Chrome UX Report API
4. Add to .env: CRUX_API_KEY=your-key-here
```

### GA4 Property ID Format

The `GA4_PROPERTY_ID` environment variable should be the **numeric property ID only**:

```bash
# Correct
GA4_PROPERTY_ID=123456789

# Wrong (don't include prefix)
GA4_PROPERTY_ID=properties/123456789
```

The client adds the `properties/` prefix automatically:

```typescript
property: `properties/${process.env.GA4_PROPERTY_ID}`
```

**Finding Your Property ID:**

1. Open Google Analytics
2. Go to Admin → Property Settings
3. Copy the "Property ID" (numeric value)

---

## Future Enhancements (v2.1+)

**Deferred from this spec:**

1. **Competitive Analysis Mode** — Compare against competitor sites
2. **CI/CD Integration** — GitHub Actions workflow, scheduled monitoring
3. **Alerting** — Notify when scores drop significantly
4. **PDF Export** — Formal report format
5. **Historical Trends** — Score graphs over time
6. **International SEO** — Multi-country/language analysis
7. **Mobile vs Desktop Split** — Separate device analysis

---

## Questions Resolved

1. **Caching duration:** 7 days for API responses, 90 days for baselines
2. **Privacy/compliance:** No PII handling, read-only access
3. **Scoring recalibration:** Yes, with real data, confidence level indicates data completeness
4. **Internationalization:** Deferred to v2.1
5. **Mobile vs Desktop:** Support via `--device` flag, deferred to v2.1

---

## Revision History

- **2026-01-20 (v1.4):** Spec refinements based on implementation review
  - Updated cache TTLs: GSC 3 days, GA4 1 day, Backlinks 14 days
  - Added rate limiting requirements with conservative defaults
  - Added backlink provider capabilities pattern
  - Defined baseline storage location: `seo-reports/baselines/YYYY-MM-DD.json`
  - Improved error state detail requirements for dashboard
  - Deferred Google Sheets export, prioritized CSV
  - Documented GA4 Property ID format (numeric, client adds `properties/` prefix)
  - Added CrUX API key as separate optional credential
  - Extracted playbook templates to dedicated file
- **2026-01-20:** Initial specification created
- **Version:** 1.4.0
- **Author:** Claude Opus 4.5
- **Status:** In Progress (Phases 1-4 complete)
