# SEO Analysis Skill

**Purpose:** Understand and extend the `/seo` command for site-wide SEO analysis with multi-source data correlation.

**When to use:**
- Running SEO audits before releases
- Debugging search visibility issues
- Adding new insight detectors
- Integrating additional data sources (APIs)
- Understanding score breakdowns

---

## Quick Reference

### Running the Tool

```bash
# Standard analysis (CLI + Markdown report)
npm run seo

# Save as baseline for future comparison
npm run seo -- --baseline

# Compare to previous baseline
npm run seo -- --compare 2026-01-15

# Export formats
npm run seo -- --output csv    # Multi-file CSV export
npm run seo -- --output html   # Standalone HTML report
npm run seo -- --output md     # Markdown only
npm run seo -- --output both   # CLI + Markdown (default)
```

### Score Interpretation

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent — ready for competitive keywords |
| 80-89 | B | Good — minor optimizations needed |
| 70-79 | C | Fair — several issues to address |
| 60-69 | D | Poor — significant work required |
| <60 | F | Critical — foundational issues |

### Score Categories

| Category | Weight | What It Measures |
|----------|--------|------------------|
| Technical Foundation | 25 pts | Sitemap, robots.txt, response time, structured data |
| Content Quality | 30 pts | Meta tags, heading structure, AI-readability |
| Semantic Intelligence | 20 pts | Topic depth, intent matching, entity linking |
| Authority & Trust | 15 pts | E-E-A-T signals, About page, author info |
| User Experience | 10 pts | Navigation, accessibility, engagement hints |

---

## Architecture Overview

```
scripts/
├── analyze-seo.ts              # Main entry point (v1.4)
└── seo/
    ├── index.ts                # Module exports
    ├── types.ts                # TypeScript interfaces
    ├── credentials.ts          # API credential management
    ├── oauth.ts                # Google OAuth flow
    ├── cache.ts                # Response caching (TTL by source)
    ├── rate-limiter.ts         # API rate limiting
    ├── clients/
    │   ├── gsc-simple.ts       # Google Search Console
    │   ├── ga4-simple.ts       # Google Analytics 4
    │   ├── backlinks.ts        # Ahrefs/SEMrush interface
    │   └── backlinks-simple.ts # Backlink client
    ├── insights/
    │   ├── engine.ts           # Insight detection
    │   ├── playbooks.ts        # Actionable recommendations
    │   └── playbook-templates.ts # Reusable templates
    └── outputs/
        ├── csv.ts              # CSV export
        ├── html.ts             # HTML report
        └── sheets.ts           # Google Sheets (deferred)
```

---

## Data Sources

### Crawl Data (Always Available)

Local HTML analysis via fetch with Googlebot UA:
- Meta tags (title, description, canonical)
- Heading structure (H1-H6)
- Schema.org JSON-LD
- Open Graph tags
- Response time (TTFB)
- Internal/external links

### Google Search Console (Optional)

Requires: `GOOGLE_REFRESH_TOKEN_SEO` with `webmasters.readonly` scope

Provides:
- Impressions and clicks per page
- Search queries driving traffic
- Average position per query
- CTR (click-through rate)

### Google Analytics 4 (Optional)

Requires: `GOOGLE_REFRESH_TOKEN_SEO` with `analytics.readonly` scope + `GA4_PROPERTY_ID`

Provides:
- Sessions and users
- Bounce rate per page
- Average time on page
- Traffic sources

### Backlinks (Optional)

Requires: `AHREFS_API_KEY` or `SEMRUSH_API_KEY`

Provides:
- Domain Rating (DR) or Authority Score (AS)
- Referring domains count
- Top referrers list
- Backlink trends

---

## Insight Detection

### How It Works

The insight engine correlates data across sources to find issues no single tool reveals:

```typescript
// Example: CTR Opportunity
// Requires: GSC data
// Logic: High impressions + low CTR = title/description needs work
if (impressions > 100 && ctr < 0.02) {
  insights.push({
    type: 'ctr_opportunity',
    severity: 'warning',
    affectedPages: [url],
    recommendation: 'Improve title and description to increase clicks'
  })
}
```

### Current Detectors

| Detector | Data Sources | What It Finds |
|----------|--------------|---------------|
| `detectDuplicateTitles` | Crawl | Multiple pages with same title |
| `detectMissingSchema` | Crawl | Key pages without structured data |
| `detectSlowResponses` | Crawl | TTFB > 500ms |
| `detectMissingCanonicals` | Crawl | Pages without canonical tags |
| `detectContentGaps` | Crawl + GSC | Good structure, no visibility |
| `detectCTROpportunities` | Crawl + GSC | High impressions, low CTR |
| `detectCannibalization` | GSC | Multiple pages competing for same query |
| `detectEngagementMismatches` | Crawl + GA4 | High bounce + good structure |
| `detectZombiePages` | GSC + GA4 | Impressions but zero engagement |
| `detectLinkOpportunities` | Crawl + Backlinks | High-quality pages with few backlinks |

### Adding a New Detector

1. Add to `scripts/seo/insights/engine.ts`:

```typescript
function detectMyIssue(
  crawlData: PageAnalysis[],
  gscData?: GSCData
): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  // Your detection logic
  for (const page of crawlData) {
    if (/* condition */) {
      insights.push({
        type: 'my_issue_type',
        severity: 'warning', // or 'critical', 'opportunity'
        title: 'Brief issue title',
        description: 'What the issue is and why it matters',
        affectedPages: [page.url],
        dataSources: ['crawl', 'gsc'], // Which sources you used
        recommendation: 'How to fix it',
        estimatedImpact: 'medium', // 'high', 'medium', 'low'
      })
    }
  }

  return insights
}
```

2. Add type to `scripts/seo/types.ts`:

```typescript
export type InsightType =
  | 'existing_types'
  | 'my_issue_type'  // Add here
```

3. Call detector in `detectInsights()`:

```typescript
export function detectInsights(...) {
  // ...existing detectors...

  if (gscData) {
    insights.push(...detectMyIssue(crawlData, gscData))
  }
}
```

---

## Rate Limiting

All API clients use exponential backoff:

```typescript
import { getRateLimiter, withRateLimitAndRetry } from './rate-limiter.js'

const limiter = getRateLimiter('gsc') // 'gsc' | 'ga4' | 'backlinks' | 'crux'

const data = await withRateLimitAndRetry(
  limiter,
  () => apiCall(),
  (attempt, error, delay) => {
    console.log(`Retry ${attempt}: ${error.message} (waiting ${delay}ms)`)
  }
)
```

### Default Limits

| API | Requests/min | Requests/day | Retry Attempts |
|-----|--------------|--------------|----------------|
| GSC | 60 | 1,000 | 3 |
| GA4 | 30 | 5,000 | 3 |
| Backlinks | 10 | 100 | 2 |
| CrUX | 10 | 100 | 2 |

---

## Caching

Responses are cached with different TTLs:

| Source | TTL | Rationale |
|--------|-----|-----------|
| Crawl | 1 day | HTML changes frequently |
| GSC | 3 days | Data has 2-3 day lag anyway |
| GA4 | 1 day | Real-time-ish data |
| Backlinks | 14 days | Changes slowly |

### Cache Management

```typescript
import { readCache, writeCache, hasValidCache, clearDomainCache } from './cache.js'

// Check if valid cache exists
if (hasValidCache(domain, 'gsc')) {
  return readCache(domain, 'gsc')
}

// Write to cache
writeCache(domain, 'gsc', data)

// Clear cache for fresh data
clearDomainCache(domain)
```

---

## Graceful Degradation

All clients return status objects that indicate configuration state:

```typescript
interface ClientStatus {
  configured: boolean    // Credentials present
  hasData: boolean       // API returned data
  message: string        // Human-readable status
}

// Example status states:
// ⬚ Not configured — Missing credentials
// ⏳ Pending — Configured but no data yet
// ❌ Error — API call failed
// ✅ Active — Data available
```

This allows the tool to provide value with any combination of data sources.

---

## Output Formats

### CLI Dashboard

Real-time progress with color-coded scores:

```
============================================================
🔍 SEO ANALYSIS: concerts.morperhaus.org
============================================================

📊 SCORES
  Technical Foundation    ████████████████████░░░░  22/25 (88%)
  Content Quality         █████████████████████████  27/30 (90%)
  ...

  OVERALL SCORE           █████████████████████████  91/100 (A)
```

### Markdown Report

Saved to `seo-reports/YYYY-MM-DD.md`:
- Executive summary
- Score breakdown
- Insights with recommendations
- Comparison to baseline (if available)

### CSV Export

Creates directory `seo-reports/YYYY-MM-DD-csv/` with:
- `summary.csv` — Overview and metadata
- `pages.csv` — Per-page analysis
- `insights.csv` — All detected insights
- `recommendations.csv` — Prioritized actions
- `scores.csv` — Category breakdown
- `gsc-pages.csv` — GSC page data (if available)
- `gsc-queries.csv` — GSC query data (if available)
- `ga4-pages.csv` — GA4 page data (if available)
- `ga4-traffic.csv` — GA4 traffic sources (if available)
- `backlinks.csv` — Backlink data (if available)

### HTML Report

Standalone `seo-reports/YYYY-MM-DD.html` with embedded CSS for sharing.

---

## Common Tasks

### Debug a Score Drop

1. Run comparison: `npm run seo -- --compare PREVIOUS_DATE`
2. Check "Changes" section in report
3. Look for new insights (especially warnings/critical)
4. Review affected pages

### Add a New Data Source

1. Create client in `scripts/seo/clients/`:
   - Follow `gsc-simple.ts` pattern
   - Use rate limiting wrapper
   - Return graceful status object

2. Add types to `scripts/seo/types.ts`

3. Export from `scripts/seo/index.ts`

4. Integrate in `scripts/analyze-seo.ts`

### Test Without API Credentials

The tool works with crawl data only:
```bash
# Remove or comment out env vars temporarily
npm run seo
```
Score will be lower but all crawl-based insights work.

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "GSC: Awaiting data" | Property recently added | Wait 2-4 weeks for data |
| "GA4: Property not found" | Wrong property ID | Use numeric ID, not G-XXXXXX |
| "Backlinks: API error 401" | Invalid API key | Verify key in provider dashboard |
| Score dropped suddenly | New insight detected issue | Check insights for new warnings |
| Cache not refreshing | TTL not expired | Use `clearDomainCache()` |

---

## Related Documentation

- **Command Reference:** `.claude/commands/seo.md`
- **V2 Implementation:** `docs/specs/implemented/global-seo-tool-v2.md`
- **Analytics Skill:** `.claude/skills/analytics/SKILL.md` (GA4 event tracking)
- **API Integration Skill:** `.claude/skills/api-integration/SKILL.md`

---

**Last Updated:** 2026-01-20
**Version:** v1.4 (Crawl + GSC + GA4 + Backlinks integrated)
