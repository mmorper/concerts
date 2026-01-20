# SEO Administration Guide

**Status**: Production
**Last Updated**: 2026-01-20
**Version**: v3.7.0+
**Purpose**: Single source of truth for SEO care and feeding

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Automated SEO Analysis](#automated-seo-analysis)
- [AI Fact Cards & Liner Notes](#ai-fact-cards--liner-notes)
- [What We Built](#what-we-built)
- [Automatic Maintenance](#automatic-maintenance)
- [Monthly Checklist](#monthly-checklist)
- [Quarterly Checklist](#quarterly-checklist)
- [One-Time Setup Tasks](#one-time-setup-tasks)
- [Testing & Validation](#testing--validation)
- [Monitoring Dashboards](#monitoring-dashboards)
- [Troubleshooting](#troubleshooting)
- [Architecture Overview](#architecture-overview)

---

## Quick Reference

### Key URLs

| Resource | URL |
|----------|-----|
| **Live Site** | https://concerts.morperhaus.org |
| **Sitemap** | https://concerts.morperhaus.org/sitemap.xml |
| **robots.txt** | https://concerts.morperhaus.org/robots.txt |
| **llm.txt** (AI docs) | https://concerts.morperhaus.org/llm.txt |
| **Worker** | https://concerts-meta-injector.morps.workers.dev |

### Dashboard Links

| Service | URL |
|---------|-----|
| **Google Search Console** | https://search.google.com/search-console |
| **Bing Webmaster Tools** | https://www.bing.com/webmasters |
| **Cloudflare Dashboard** | https://dash.cloudflare.com/6db8591bbcba4588ae4ef9c3839cd209 |
| **Facebook Sharing Debugger** | https://developers.facebook.com/tools/debug/ |
| **Twitter Card Validator** | https://cards-dev.twitter.com/validator |
| **LinkedIn Post Inspector** | https://www.linkedin.com/post-inspector/ |

### Validation Tools

| Tool | URL |
|------|-----|
| **Google Rich Results Test** | https://search.google.com/test/rich-results |
| **Schema.org Validator** | https://validator.schema.org/ |
| **Sitemap Validator** | https://www.xml-sitemaps.com/validate-xml-sitemap.html |

---

## Automated SEO Analysis

### `/seo` Command (v2.0)

Run comprehensive SEO analysis with optional integration of Google Search Console, Google Analytics 4, and backlink APIs (Ahrefs/SEMrush).

**Basic Usage:**

```bash
/seo                           # Standard analysis with dashboard report
/seo --baseline                # Save current state as baseline for comparison
/seo --compare 2026-01-15      # Compare against previous baseline
/seo --url https://staging.com # Analyze staging environment
```

**Data Source Modes:**

```bash
/seo --quick                   # Crawl-only mode (no API calls)
/seo --full                    # Enable all configured data sources
/seo --no-gsc                  # Skip Google Search Console
/seo --no-ga4                  # Skip Google Analytics 4
/seo --no-backlinks            # Skip backlink API
```

**Output Format Options:**

```bash
/seo --output cli              # Dashboard only (default)
/seo --output cli,md           # Dashboard + Markdown report
/seo --output html             # Standalone HTML report
/seo --output json             # Full JSON data export
/seo --output csv              # CSV files for spreadsheet import
/seo --output sheets           # Export directly to Google Sheets
/seo --output cli,md,html,json # Multiple formats
```

**Setup & Configuration:**

```bash
/seo --setup                   # Interactive credential setup wizard
/seo --cache-clear             # Clear all cached API responses
/seo --cache-clear gsc         # Clear only GSC cache
```

**What It Does:**

- Crawls 12 key pages (homepage, 5 scenes, 6 deep link examples)
- Fetches real search performance data from Google Search Console
- Fetches engagement metrics and Core Web Vitals from GA4
- Fetches backlink profile from Ahrefs or SEMrush (optional)
- Correlates data across sources to detect actionable insights
- Generates playbooks with step-by-step fixes for non-technical users
- Scores site across 6 SEO categories (100-point rubric)
- Provides confidence score based on available data sources

**Data Sources & Confidence:**

| Sources Available | Confidence |
|-------------------|------------|
| Crawl only | 60% |
| Crawl + GSC | 75% |
| Crawl + GSC + GA4 | 90% |
| Crawl + GSC + GA4 + Backlinks | 100% |

**Scoring Categories:**

1. **Technical Foundation (25 pts)** - Response time, canonical tags, Schema.org, Core Web Vitals
2. **Content Quality (30 pts)** - Titles, descriptions, H1 structure, real CTR from GSC
3. **Semantic Intelligence (20 pts)** - Word count, schema types, entity relationships
4. **Authority & Trust (15 pts)** - Domain rating, referring domains, organic traffic %
5. **User Experience (10 pts)** - Alt text, CWV ratings, engagement metrics
6. **AI Agent Readiness (10 pts)** - Schema coverage, content depth, citation-worthiness

**Correlation Insights Detected:**

| Insight Type | Data Sources | Description |
|--------------|--------------|-------------|
| CTR Opportunity | GSC | Pages ranking well but with below-average CTR |
| Engagement Mismatch | GSC + GA4 | High traffic but high bounce rate |
| Zombie Page | GSC + GA4 | Impressions but no clicks or traffic |
| Content Gap | Crawl + GSC | Well-structured pages with no search visibility |
| Authority Mismatch | GSC + Backlinks | High backlinks but poor rankings |
| Linkworthy Content | GA4 + Backlinks | High engagement but few backlinks |
| Cannibalization | GSC | Multiple pages competing for same queries |

**Output Files:**

| Format | Location |
|--------|----------|
| Markdown | `seo-reports/YYYY-MM-DD-report.md` |
| HTML | `seo-reports/YYYY-MM-DD-report.html` |
| JSON | `seo-reports/YYYY-MM-DD-report.json` |
| CSV | `seo-reports/YYYY-MM-DD-csv/` (multiple files) |
| Baseline | `seo-reports/YYYY-MM-DD-baseline.json` |

**Documentation:** See [.claude/commands/seo.md](../.claude/commands/seo.md) for complete command specification.

---

## Setting Up API Credentials

The `/seo` command works in crawl-only mode by default, but integrating real data from Google APIs dramatically improves accuracy and insight detection.

### Google OAuth Setup (GSC + GA4)

**Prerequisites:**

1. Google Cloud Console project with Search Console API and Analytics Data API enabled
2. OAuth 2.0 credentials (Client ID and Client Secret)

**Setup Steps:**

```bash
# Run the interactive setup wizard
/seo --setup

# Or set environment variables
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
```

The setup wizard will:

1. Prompt for Client ID and Client Secret
2. Open browser for OAuth consent
3. Store refresh token securely in `~/.seo-analyzer/credentials.json`
4. List available GSC properties and GA4 accounts

**Credential Storage:**

Credentials are stored outside the project directory for security:

- Location: `~/.seo-analyzer/credentials.json`
- Contains: OAuth tokens (encrypted), API keys
- Cache: `~/.seo-analyzer/cache/` (API response cache)

### Backlink API Setup (Optional)

**Ahrefs:**

```bash
export AHREFS_API_KEY="your-ahrefs-api-key"
```

**SEMrush:**

```bash
export SEMRUSH_API_KEY="your-semrush-api-key"
```

Or add to credentials file via `--setup` wizard.

### Verifying Configuration

```bash
# Check which data sources are configured
/seo --setup  # Shows credential summary without modifying
```

Output shows:

- ✅ Google OAuth: Configured (expires in X days)
- ✅ GSC Property: sc-domain:concerts.morperhaus.org
- ❌ GA4 Property: Not configured
- ✅ Backlinks: Ahrefs configured

---

## AI Fact Cards & Liner Notes

### Why Fact Cards?

The `/liner-notes` page now includes **pre-computed statistics** that AI agents can quote directly. This addresses a key gap in AI discoverability: bots could crawl the site but couldn't easily answer questions like "How many times has Morperhaus seen Depeche Mode?" because they'd need to parse JSON and compute aggregates.

**Before (v3.6.0):** AI agents had to parse `concerts.json` and compute statistics themselves.

**After (v3.7.0):** Facts are pre-computed with natural language headlines that AI agents can quote verbatim.

### What Gets Generated

The `scripts/generate-facts.ts` script computes **15 statistics** from `concerts.json`:

| Priority | Fact | Example |
| -------- | ---- | ------- |
| 1 | Top artist | "Social Distortion: 8 concerts" |
| 2 | Top venue | "Irvine Meadows: 16 shows" |
| 3 | Total concerts | "178 concerts since 1984" |
| 4 | Top genre | "New Wave: 48 shows" |
| 5 | First concert | "First show: Adam Ant (1984)" |
| 6 | Top state | "California: 118 concerts" |
| 7-8 | 2nd/3rd artists | Additional top artists |
| 9 | 2nd venue | Second most-visited venue |
| 10 | Latest concert | Most recent show |
| 11 | Busiest year | "2022: 14 shows" |
| 12 | Unique cities | "35 cities visited" |
| 13 | Unique venues | "77 unique venues" |
| 14 | Top decade | "2010s: 64 shows" |
| 15 | 2nd genre | Second most-attended genre |

### Where Facts Appear

**1. Liner Notes Page** (`/liner-notes`)

- "By the Numbers" section displays top 12 facts as clickable cards
- Each card includes: headline, human-friendly detail, deep link, CTA

**2. llm.txt** (`/llm.txt`)

- "Pre-Computed Statistics" section with categorized facts
- "Quick Facts (AI-Quotable)" section with top 6 facts in quotable format
- Deep links for each fact

**3. RSS Feed** (`/liner-notes/rss`)

- Facts summary item with `computedAt` timestamp
- Grouped by category for readable output

**4. JSON Data** (`/data/facts.json`)

- Machine-readable facts for programmatic access
- Includes `computedAt` timestamp for cache invalidation

### When Facts Update

Facts regenerate automatically during:
- `npm run build-data` (Step 10)
- `npm run generate:facts` (standalone)

The `computedAt` timestamp in `facts.json` tracks when facts were last computed.

### Design Philosophy

**"Quotable Facts"** — Every fact is designed to be directly quotable by an AI agent without transformation:

```text
User: "What's the most visited venue?"
AI: "According to Morperhaus Concert Archives, Irvine Meadows with 16 shows is the most-visited venue, visited from 1984 to 2003."
```

**Human-Friendly Details** — Facts include conversational detail text:

- "The most-seen live act, 1990–2024" (not "Most-seen artist from 1990 to 2024")
- "Where it all began — Irvine Meadows" (not "Venue: Irvine Meadows")
- "The golden era of concert-going" (not "Most active decade for concerts")

**Deep Links** — Every fact links to where users can explore that data point:

- Top artist → `/?scene=artists&artist=social-distortion`
- Busiest year → `/?scene=timeline`
- Top state → `/?scene=geography`

### Testing AI Discoverability

After deployment, test AI understanding with these queries:

1. **ChatGPT/Claude**: "How many times has Morperhaus seen Social Distortion?"
2. **Perplexity**: "What's the most visited venue in the Morperhaus concert archives?"
3. **Any AI**: "How many concerts are in the Morperhaus archive?"

**Success criteria**: AI quotes exact numbers from fact cards and cites concerts.morperhaus.org.

### Related Files

| File | Purpose |
| ---- | ------- |
| `scripts/generate-facts.ts` | Computes facts from concerts.json |
| `public/data/facts.json` | Generated facts data |
| `src/components/changelog/FactCard.tsx` | UI component for fact cards |
| `src/components/changelog/ChangelogPage.tsx` | Displays "By the Numbers" section |
| `src/components/changelog/ChangelogRSS.tsx` | Includes facts in RSS feed |
| `scripts/update-meta-tags.ts` | Adds facts to llm.txt |
| `test/pipeline/generate-facts.test.ts` | 20 tests for fact generation |

**Spec**: [docs/specs/implemented/global-ai-fact-cards.md](specs/implemented/global-ai-fact-cards.md)

---

**When to Run:**

- Monthly as part of SEO audit
- After implementing SEO improvements (use `--compare` to track progress)
- Before major releases to catch issues
- After significant content updates

**Documentation:** See [.claude/commands/seo.md](../.claude/commands/seo.md) for complete command specification.

---

## What We Built

Our SEO implementation consists of three integrated systems:

### 1. Static SEO Foundation (Phase 1)

**What**: Core SEO files that search engines and AI bots read first

**Files**:
- `public/robots.txt` - Crawler permissions and sitemap declaration
- `public/llm.txt` - AI assistant documentation (ChatGPT, Claude, Perplexity)
- `index.html` - Enhanced meta tags and Schema.org JSON-LD
- `public/og-stats.json` - Dynamic stats for OG image generation

**Auto-Updates**: Meta tags and stats update automatically during `npm run build-data`

### 2. Sitemap System (Phase 2)

**What**: XML sitemap with 410+ URLs for complete site discovery

**Coverage**:
- 1 homepage
- 5 scene pages (Timeline, Artists, Venues, Geography, Genres)
- 247+ artist deep links (`?scene=artists&artist=depeche-mode`)
- 154+ venue deep links (77 network + 77 map views)
- 2 changelog URLs

**Auto-Updates**: Sitemap regenerates during `npm run build-data`

### 3. Cloudflare Worker (Phase 3)

**What**: Edge worker that injects dynamic meta tags for bots while keeping the SPA fast for humans

**How It Works**:
1. Detects bot user agents (Googlebot, Facebook, Twitter, AI bots)
2. Parses URL parameters (`?scene=artists&artist=depeche-mode`)
3. Fetches entity metadata from production JSON files
4. Injects personalized meta tags into HTML `<head>`
5. Returns customized HTML to bot

**Bots Supported**: 20+ including Google, Bing, Facebook, Twitter, LinkedIn, ChatGPT, Claude, Perplexity

**Performance**: Zero impact on human users (bypassed immediately)

---

## Automatic Maintenance

These tasks happen automatically—no manual intervention required:

### Every Data Pipeline Run

**Command**: `npm run build-data`

**Auto-Updates**:
1. **Meta tags** in `index.html` (Step 10)
   - Concert count
   - Artist count
   - Venue count
   - Album count (from discography)
   - Date range (earliest → latest concert)
   - Last modified date

2. **Schema.org JSON-LD** in `index.html` (Step 10)
   - `numberOfEvents` (concert count)
   - `numberOfItems` (artist count)
   - `startDate` (earliest concert)
   - `endDate` (latest concert)
   - `dateModified` (current date)
   - Scene descriptions

3. **llm.txt** stats (Step 10)
   - All concert/artist/venue counts
   - Date ranges
   - Example queries

4. **og-stats.json** (Step 10)
   - Stats for OG image generation

5. **Sitemap** (Step 11)
   - All URLs regenerated from current data
   - Artist deep links (sorted by concert count)
   - Venue deep links (sorted by concert count)

**Deployment**: Cloudflare Pages auto-deploys on git push to `main`

**What You Do**: Just commit and push the updated files

```bash
git add public/sitemap.xml index.html public/llm.txt public/og-stats.json
git commit -m "chore: Update SEO files with latest concert data"
git push
```

---

## Monthly Checklist

Perform these tasks once per month to maintain optimal SEO health.

### 1. Review Search Console Metrics

**URL**: https://search.google.com/search-console

**What to Check**:
- [ ] **Total Impressions**: Should trend upward over time
- [ ] **Total Clicks**: Should increase as indexing improves
- [ ] **Average CTR**: Healthy range is 2-5% for niche content
- [ ] **Average Position**: Lower is better (aim for top 10)
- [ ] **Coverage Issues**: Should be zero errors
- [ ] **Sitemap Status**: Should show "Success" with all URLs discovered

**Red Flags**:
- Sudden drop in impressions (>20%)
- Coverage errors appearing
- Sitemap not processed in 7+ days

**Action**: Investigate coverage errors, re-submit sitemap if needed

### 2. Check Bing Webmaster Tools

**URL**: https://www.bing.com/webmasters

**What to Check**:
- [ ] **Sitemap Status**: "Successfully processed"
- [ ] **URL Inspection**: Test 3-5 key URLs
- [ ] **Crawl Errors**: Should be zero
- [ ] **SEO Reports**: Review recommendations

### 3. Verify Worker Health

**Dashboard**: https://dash.cloudflare.com/6db8591bbcba4588ae4ef9c3839cd209/workers/services/view/concerts-meta-injector/production

**What to Check**:
- [ ] **Request Count**: Should match site traffic (bots ~10-20% of total)
- [ ] **Error Rate**: Should be <0.1%
- [ ] **CPU Time**: Should average <20ms per request
- [ ] **Route Configuration**: Should show `concerts.morperhaus.org/*`

**Alerts**:
- Error rate >1%: Check worker logs with `wrangler tail`
- CPU time >50ms: Investigate metadata fetch latency

### 4. Test Bot Detection

**Test Commands**:

```bash
# Google (should return dynamic title)
curl -A "Googlebot/2.1" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" \
  | grep "<title>"
# Expected: <title>Depeche Mode - Morperhaus Concert Archives</title>

# Human (should return static title)
curl "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" \
  | grep "<title>"
# Expected: <title>Morperhaus Concert Archives</title>
```

**What to Check**:
- [ ] Bot user agent gets dynamic title
- [ ] Human user agent gets static title
- [ ] OG tags present for bot requests
- [ ] Schema.org JSON-LD present in both

### 5. Validate Social Media Previews

**Test URLs**:
- Homepage: `https://concerts.morperhaus.org/`
- Artist: `https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode`
- Venue: `https://concerts.morperhaus.org/?scene=venues&venue=9-30-club`

**Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
- [ ] OG image loads correctly
- [ ] Title and description are dynamic (for deep links)
- [ ] No warnings or errors

**Twitter Card Validator**: https://cards-dev.twitter.com/validator
- [ ] Card preview renders correctly
- [ ] Image displays properly
- [ ] Dynamic title shows (for deep links)

**LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/
- [ ] Preview renders correctly
- [ ] Dynamic meta tags display

---

## Quarterly Checklist

Perform these tasks every 3 months for deeper analysis.

### 1. Audit Indexed Pages

**Google Search**: `site:concerts.morperhaus.org`
- [ ] Count indexed pages (should be ~410+)
- [ ] Verify key artist pages are indexed
- [ ] Verify key venue pages are indexed

**Action**: If count is significantly lower, check Coverage report in Search Console

### 2. Review Top Queries

**Search Console** → Performance → Queries
- [ ] Identify top 10 queries driving traffic
- [ ] Check if artist names are ranking
- [ ] Look for unexpected queries (opportunities)

**Insight**: This reveals what people are actually searching for

### 3. Schema.org Validation

**Google Rich Results Test**: https://search.google.com/test/rich-results

**Test URLs**:
- [ ] Homepage: `https://concerts.morperhaus.org/`
- [ ] Artist deep link (test 3 different artists)
- [ ] Venue deep link (test 3 different venues)

**Expected Results**:
- "Page is eligible for rich results"
- No errors or warnings
- `CollectionPage`, `MusicEventSeries`, `WebPage` detected

### 4. Sitemap Health Check

**Sitemap Validator**: https://www.xml-sitemaps.com/validate-xml-sitemap.html

**Input**: `https://concerts.morperhaus.org/sitemap.xml`

**What to Check**:
- [ ] "Valid XML sitemap"
- [ ] URL count matches expected (~410)
- [ ] No broken URLs (all return 200)
- [ ] Last modified date is recent

### 5. AI Bot Testing

**Test AI Assistant Understanding**:

1. **ChatGPT**: Ask "How many times has Morperhaus seen Depeche Mode live?"
2. **Claude**: Ask "What's the most attended venue in the Morperhaus concert archives?"
3. **Perplexity**: Ask "Show me concerts from the Morperhaus concert archives in 2024"

**Expected**: AI should be able to answer using data from your site

**If not working**: Check if llm.txt is accessible and up-to-date

### 6. Performance Review

**Metrics to Track**:
- [ ] Organic traffic growth (Search Console)
- [ ] Top landing pages (should include deep links)
- [ ] Referral traffic from social media
- [ ] Worker request volume (Cloudflare dashboard)

**Goal**: 10-20% quarterly growth in organic impressions

---

## One-Time Setup Tasks

These should already be complete, but verify if you're setting up a new domain or environment.

### Google Search Console

**URL**: https://search.google.com/search-console

**Steps**:
1. Add property: `concerts.morperhaus.org`
2. Verify ownership (DNS TXT record or HTML file)
3. Submit sitemap: `https://concerts.morperhaus.org/sitemap.xml`
4. Set preferred domain (www vs non-www)
5. Enable email alerts for critical issues

**Status**: ✅ Should be complete (verify in dashboard)

### Bing Webmaster Tools

**URL**: https://www.bing.com/webmasters

**Steps**:
1. Add site: `concerts.morperhaus.org`
2. Verify ownership (import from Google Search Console or DNS)
3. Submit sitemap: `https://concerts.morperhaus.org/sitemap.xml`
4. Enable email alerts

**Status**: ⏸️ May not be complete—check and complete if needed

### Cloudflare Worker Route

**Dashboard**: https://dash.cloudflare.com/6db8591bbcba4588ae4ef9c3839cd209/workers/services/view/concerts-meta-injector/production

**Steps**:
1. Go to Settings → Triggers → Routes
2. Verify route exists: `concerts.morperhaus.org/*`
3. Verify zone matches your domain

**Status**: ✅ Should be complete (verify in dashboard)

---

## Testing & Validation

### Quick Bot Detection Test

**Test Googlebot**:
```bash
curl -sS -A "Googlebot/2.1" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" \
  | grep -E "<title>|og:title"
```

**Expected Output**:
```html
<title>Depeche Mode - Morperhaus Concert Archives</title>
<meta property="og:title" content="Depeche Mode - Morperhaus Concert Archives">
```

### Full Bot Test Matrix

| Bot Type | User Agent | Test URL | Expected Title |
|----------|------------|----------|----------------|
| **Google** | `Googlebot/2.1` | `/?scene=artists&artist=depeche-mode` | `Depeche Mode - Morperhaus Concert Archives` |
| **Facebook** | `facebookexternalhit/1.1` | `/?scene=venues&venue=9-30-club` | `9:30 Club - Morperhaus Concert Archives` |
| **Twitter** | `Twitterbot/1.0` | `/?scene=artists&artist=duran-duran` | `Duran Duran - Morperhaus Concert Archives` |
| **LinkedIn** | `LinkedInBot/1.0` | `/?scene=venues&venue=irvine-meadows` | `Irvine Meadows - Morperhaus Concert Archives` |
| **ChatGPT** | `ChatGPT-User` | `/?scene=artists&artist=the-cure` | `The Cure - Morperhaus Concert Archives` |
| **Claude** | `Claude-Web` | `/?scene=artists&artist=new-order` | `New Order - Morperhaus Concert Archives` |
| **Perplexity** | `PerplexityBot` | `/?scene=venues&venue=the-forum` | `The Forum - Morperhaus Concert Archives` |
| **Human** | (no -A flag) | `/?scene=artists&artist=depeche-mode` | `Morperhaus Concert Archives` (static) |

**Test Command Template**:
```bash
curl -sS -A "USER_AGENT" "URL" | grep "<title>"
```

### Schema.org Validation

**Quick Test**:
```bash
curl -sS "https://concerts.morperhaus.org/" | grep -A 50 'application/ld+json'
```

**Visual Test**: Paste site URL into https://search.google.com/test/rich-results

**What to Look For**:
- `@type: CollectionPage`
- `@type: MusicEventSeries`
- `numberOfEvents` matches concert count
- `startDate` and `endDate` are correct
- No errors or warnings

### Sitemap Validation

**Quick Test**:
```bash
curl -sS "https://concerts.morperhaus.org/sitemap.xml" | head -30
```

**Visual Test**: Paste sitemap URL into https://www.xml-sitemaps.com/validate-xml-sitemap.html

**What to Look For**:
- Valid XML structure
- ~410 URLs present
- All URLs return 200 status
- `<lastmod>` dates are recent

---

## Monitoring Dashboards

### Primary Dashboards

**1. Google Search Console**
- **URL**: https://search.google.com/search-console
- **Check**: Weekly (first month), then monthly
- **Key Metrics**: Impressions, clicks, CTR, position, coverage issues

**2. Cloudflare Workers Dashboard**
- **URL**: https://dash.cloudflare.com/6db8591bbcba4588ae4ef9c3839cd209/workers/services/view/concerts-meta-injector/production
- **Check**: Monthly
- **Key Metrics**: Requests, errors, CPU time, success rate

**3. Cloudflare Pages Analytics**
- **URL**: https://dash.cloudflare.com/6db8591bbcba4588ae4ef9c3839cd209/pages/view/concerts
- **Check**: Monthly
- **Key Metrics**: Page views, unique visitors, top pages, referrers

### Alert Thresholds

**Set up email alerts for**:
- Google Search Console: Coverage errors detected
- Cloudflare Workers: Error rate >1%
- Cloudflare Pages: Build failures

---

## Troubleshooting

### Issue: Sitemap Not Updating in Search Console

**Symptoms**: Search Console shows old sitemap or "Couldn't fetch" error

**Diagnosis**:
1. Verify sitemap is accessible: `curl https://concerts.morperhaus.org/sitemap.xml`
2. Check Cloudflare cache: Purge cache in Cloudflare dashboard
3. Verify file was committed to git and deployed

**Solution**:
```bash
# Regenerate sitemap
npm run generate:sitemap

# Verify locally
cat public/sitemap.xml | head -50

# Commit and push
git add public/sitemap.xml
git commit -m "chore: Regenerate sitemap"
git push

# Wait 5 minutes for Cloudflare Pages deployment
# Then re-submit in Search Console
```

### Issue: Dynamic Meta Tags Not Working for Bots

**Symptoms**: curl with bot user agent returns static title instead of dynamic

**Diagnosis**:
```bash
# Test bot detection
curl -A "Googlebot/2.1" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" \
  | grep "<title>"
```

**Possible Causes**:
1. Worker route not configured
2. Worker not deployed
3. Entity doesn't exist in metadata files
4. Normalized name mismatch

**Solution**:
```bash
# Check worker deployment
cd workers
npx wrangler tail

# In another terminal, trigger a request
curl -A "Googlebot/2.1" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode"

# Check logs for errors
# If entity not found, verify normalized name matches metadata
```

### Issue: Schema.org Validation Errors

**Symptoms**: Google Rich Results Test shows errors or warnings

**Diagnosis**:
1. Visit https://search.google.com/test/rich-results
2. Enter site URL
3. Review errors/warnings

**Common Errors**:
- Missing required field → Check `index.html` lines 68-146
- Invalid date format → Verify ISO 8601 format (YYYY-MM-DD)
- Incorrect `@type` → Verify Schema.org vocabulary

**Solution**:
```bash
# Regenerate meta tags
npm run update:meta

# Verify Schema.org block
cat index.html | grep -A 50 'application/ld+json'

# Commit and push
git add index.html
git commit -m "fix: Update Schema.org structured data"
git push
```

### Issue: AI Bots Not Understanding Site

**Symptoms**: ChatGPT/Claude/Perplexity can't answer questions about your concerts

**Diagnosis**:
```bash
# Check llm.txt is accessible
curl https://concerts.morperhaus.org/llm.txt | head -50
```

**Solution**:
```bash
# Regenerate llm.txt
npm run update:meta

# Verify stats are current
cat public/llm.txt | grep "concerts spanning"

# Commit and push
git add public/llm.txt
git commit -m "chore: Update llm.txt with latest stats"
git push
```

### Issue: Social Media Previews Show Wrong Content

**Symptoms**: Facebook/Twitter preview shows generic content instead of dynamic

**Diagnosis**:
1. Use Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
2. Click "Scrape Again" to clear cache

**Causes**:
- Social media platforms cache OG tags aggressively (24-48 hours)
- Worker not injecting OG tags for bot user agent

**Solution**:
```bash
# Test worker with Facebook user agent
curl -A "facebookexternalhit/1.1" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" \
  | grep "og:title"

# If OG tags missing, check worker logs
cd workers
npx wrangler tail

# Force Facebook to re-scrape
# Use "Scrape Again" button in Facebook Sharing Debugger
```

### Issue: Worker Errors Increasing

**Symptoms**: Cloudflare dashboard shows >1% error rate

**Diagnosis**:
```bash
# View real-time worker logs
cd workers
npx wrangler tail

# Trigger requests and watch for errors
curl -A "Googlebot/2.1" "https://concerts.morperhaus.org/?scene=artists&artist=test"
```

**Common Errors**:
- `Failed to fetch metadata` → Metadata file doesn't exist or is malformed
- `Timeout` → Metadata fetch taking >10s (Cloudflare limit)
- `Parse error` → JSON structure issue in metadata

**Solution**:
```bash
# Check metadata files are valid JSON
cat public/data/artists-metadata.json | jq . > /dev/null
cat public/data/venues-metadata.json | jq . > /dev/null

# If invalid, regenerate
npm run build-data

# Re-deploy worker
cd workers
npx wrangler deploy
```

---

## Architecture Overview

### How Everything Fits Together

```
User/Bot Request
       ↓
Cloudflare Worker (concerts-meta-injector)
       ↓
    Is Bot? ────No───→ Cloudflare Pages (static SPA)
       ↓ Yes                    ↓
Parse URL params          User gets fast SPA
       ↓
Fetch metadata from:
  - /data/artists-metadata.json
  - /data/venues-metadata.json
       ↓
Inject dynamic meta tags into HTML <head>
       ↓
Return personalized HTML to bot
       ↓
Bot indexes with dynamic title/description
```

### File Locations

**SEO Static Files**:
- `public/robots.txt` - Crawler permissions
- `public/llm.txt` - AI assistant docs
- `public/sitemap.xml` - All URLs for search engines
- `index.html` (lines 17-62) - Enhanced meta tags
- `index.html` (lines 68-146) - Schema.org JSON-LD
- `public/og-stats.json` - Stats for OG image generation

**Worker Files**:
- `workers/meta-injector.js` - Dynamic meta injection logic
- `workers/wrangler.toml` - Worker configuration
- `workers/README.md` - Deployment guide

**Data Pipeline Scripts**:
- `scripts/update-meta-tags.ts` - Auto-updates meta tags and stats
- `scripts/generate-sitemap.ts` - Generates sitemap from data
- `scripts/build-data.ts` - Orchestrates entire pipeline (includes Steps 10-11)

**Metadata Files** (Worker fetches these):
- `public/data/artists-metadata.json` - Artist photos, concert counts
- `public/data/venues-metadata.json` - Venue locations, concert counts
- `public/data/concerts.json` - Full concert data

### Data Flow During Build

```
npm run build-data
       ↓
  [Steps 1-9: Data fetching and enrichment]
       ↓
Step 10: npm run update:meta
       ↓
  Update index.html meta tags
  Update index.html Schema.org JSON-LD
  Update public/llm.txt stats
  Update public/og-stats.json
       ↓
Step 11: npm run generate:sitemap
       ↓
  Generate public/sitemap.xml
  Include all artists, venues, scenes
  Sort by concert count (descending)
       ↓
Commit updated files to git
       ↓
Push to GitHub
       ↓
Cloudflare Pages auto-deploys
       ↓
New content indexed by search engines
```

### Key Design Decisions

**Why Cloudflare Worker?**
- SPAs (single-page apps) serve the same HTML for all routes
- Search engines need dynamic meta tags per URL
- Worker intercepts bot requests and injects personalized meta tags
- Human users bypass worker completely (zero performance impact)

**Why Auto-Update Meta Tags?**
- Concert data changes frequently (new shows added)
- Manual updates are error-prone and forgotten
- Automated pipeline ensures SEO stays in sync with data

**Why Commit Sitemap to Git?**
- Search engines need stable, accessible sitemap
- Dynamic generation on every request is slow
- Pre-generated sitemap is fast and cacheable
- Version control tracks changes over time

**Why Both robots.txt and llm.txt?**
- `robots.txt` = Machine-readable (search engines)
- `llm.txt` = Human-readable (AI assistants)
- Different audiences, different formats

---

## Related Documentation

- **[docs/BUILD.md](BUILD.md)** - Build system and data pipeline documentation
- **[docs/specs/future/global-seo-optimization.md](specs/future/global-seo-optimization.md)** - Complete implementation spec (Phases 1-4)
- **[workers/README.md](../workers/README.md)** - Cloudflare Worker deployment guide
- **[docs/DEEP_LINKING.md](DEEP_LINKING.md)** - URL parameter patterns for scenes
- **[docs/DATA_PIPELINE.md](DATA_PIPELINE.md)** - How concert data flows through the system

---

## Version History

| Version | Date | Changes |
| ------- | ---- | ------- |
| v2.0.0 | 2026-01-20 | SEO Tool v2: GSC/GA4/Backlink integration, correlation insights, playbooks, HTML/CSV/Sheets output |
| v3.7.0 | 2026-01-20 | Added AI Fact Cards section, llm.txt Pre-Computed Statistics |
| v3.5.0 | 2026-01-19 | Initial SEO documentation (Phases 1-3 complete) |

---

**Questions or Issues?** Review the [Troubleshooting](#troubleshooting) section or check [docs/specs/future/global-seo-optimization.md](specs/future/global-seo-optimization.md) for implementation details.
