# /seo - SEO Analysis & Optimization Report

Perform deep SEO analysis of the live production site with modern AI-agent optimization scoring.

**Version:** 1.5

## How This Command Works

This is a **Claude Code slash command**. When you run `/seo`, Claude executes `npm run seo` and interprets the results conversationally.

**Slash command (in Claude Code):**
```text
/seo
```

**Equivalent CLI (in terminal):**
```bash
npm run seo
```

## CLI Flags

When running via `npm run seo`, you can pass flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--baseline` | false | Save current results as baseline for future comparison |
| `--compare DATE` | (none) | Compare to specific baseline (YYYY-MM-DD) |
| `--url URL` | production | Override base URL (for staging) |
| `--output FORMAT` | both | Output: `cli`, `md`, `both`, `csv`, or `html` |
| `--quick` | false | Quick score check only |

**CLI Examples:**
```bash
npm run seo                              # Interactive menu mode
npm run seo -- --baseline                # Save baseline
npm run seo -- --compare 2026-01-15      # Compare to Jan 15
npm run seo -- --url https://staging.example.com
npm run seo -- --output html             # HTML report
npm run seo -- --quick                   # Just the score
```

**Note:** Use `--` before flags when running with npm.

---

## Interactive Mode Flow

When you run `/seo` with no flags, you'll see:

```
═══════════════════════════════════════════════════════════════
  SEO Analysis Tool
═══════════════════════════════════════════════════════════════

  What would you like to do?

  [1] Full analysis          Run complete SEO audit with action items
  [2] Quick score check      Just show the score (fast)
  [3] Compare progress       See what changed since last run
  [4] Export for sharing     Generate HTML or CSV report
  [5] Quit

  Your choice (1-5): _
```

### After Full Analysis

You'll see your score and a list of issues, then choose:

```
  ✅ Analysis complete: 91/100 (A Grade - Excellent)

  Found 3 issues to review:

  #1 ⚠️  10 pages share identical title (medium impact)
  #2 💡 12 pages missing canonical tag (low impact)
  #3 💡 About page missing structured data (medium impact)

  What next?
  [1] Show action items for all issues
  [2] Get detailed help for a specific issue
  [3] Save report and exit
  [4] Exit without saving
```

### Detailed Fix Instructions

Select "Get detailed help" to see step-by-step playbooks:

```
═══════════════════════════════════════════════════════════════
  FIX: 10 pages share identical title
═══════════════════════════════════════════════════════════════

  WHY IT MATTERS
  Each page needs a unique title for Google to rank it properly.

  HOW TO FIX (4 steps)

  Step 1: Open workers/meta-injector.js
  Step 2: Add scene-specific titles
  Step 3: Deploy the Worker
  Step 4: Verify with curl

  HOW TO VERIFY
  Where: Google Search Console → Indexing → Pages
  When: Check in 2-4 weeks
```

---

## Quick Reference

| Category | Weight | Key Metrics |
|----------|--------|-------------|
| Technical Foundation | 25 pts | Sitemap, robots.txt, performance hints, structured data |
| Content Quality | 30 pts | Meta tags, heading structure, AI-readability |
| Semantic Intelligence | 20 pts | Topic depth, intent matching, entity linking |
| Authority & Trust | 15 pts | E-E-A-T signals, citation-worthiness |
| User Experience | 10 pts | Navigation, accessibility, engagement hints |

**Total Score:** 100 points

---

## Workflow

### Step 1: Pre-Flight Checks

**Verify target URL:**
> 🌐 Analyzing: {URL}
>
> Checking connectivity...
> ✅ Site is reachable
> ✅ Sitemap found at /sitemap.xml

**If site unreachable:**
> ❌ Cannot reach {URL}
> - Check if site is deployed
> - Verify URL is correct
> - Check network connection

---

### Step 2: Crawl Key Pages

**Pages analyzed (12 URLs):**
1. Homepage: `/?scene=timeline`
2. Scene 1 - Timeline: `/?scene=timeline`
3. Scene 2 - Venues: `/?scene=venues`
4. Scene 3 - Geography: `/?scene=geography`
5. Scene 4 - Genres: `/?scene=genres`
6. Scene 5 - Artists: `/?scene=artists`
7. Artist deep link: `/?scene=artists&artist=depeche-mode`
8. Artist deep link: `/?scene=artists&artist=nine-inch-nails`
9. Venue deep link: `/?scene=venues&venue=hollywood-bowl`
10. Venue deep link: `/?scene=venues&venue=forum`
11. Genre deep link: `/?scene=genres&genre=industrial`
12. Region deep link: `/?scene=geography&region=losangeles`

> 📄 Crawling 12 pages...
> ✅ 12/12 fetched successfully
>
> Total HTML size: 245 KB
> Average response time: 187ms

---

### Step 3: Technical Foundation Analysis (25 points)

#### Crawlability & Indexing (10 pts)

**Checks:**
- ✅ Sitemap exists and is valid
- ✅ robots.txt properly configured
- ✅ Clean URL structure (query params only)
- ✅ No orphaned pages detected
- ✅ Canonical tags present
- ✅ Fast server response (<200ms avg)

**Score:** 10/10

#### Performance Hints (8 pts)

**Checks:**
- ✅ Images use lazy loading
- ✅ Preload/prefetch tags present
- ⚠️ No WebP format detected (using PNG/JPG)
- ✅ Minimal blocking resources
- ✅ Inline critical CSS detected

**Score:** 7/8 (−1 for missing WebP)

#### Structured Data (7 pts)

**Checks:**
- ✅ Open Graph tags present on all pages
- ⚠️ No Schema.org JSON-LD markup detected
- ✅ Social meta tags complete
- ✅ Dynamic meta tags from Worker verified
- ⚠️ Missing Event/MusicEvent schema

**Score:** 5/7 (−2 for missing Schema.org)

**Category Score:** 22/25 (88%)

---

### Step 4: Content Quality & Structure (30 points)

#### Traditional Search Bot Optimization (15 pts)

**Meta Tags:**
- ✅ All pages have unique titles
- ✅ Title length optimal (50-60 chars)
- ✅ Descriptions present (150-160 chars)
- ✅ Keywords naturally integrated
- ✅ No keyword stuffing detected

**Heading Hierarchy:**
- ✅ H1 present on all pages
- ✅ Logical H2-H6 flow
- ⚠️ Some pages have multiple H1s

**Internal Linking:**
- ✅ Cross-scene navigation present
- ✅ Deep links to artists/venues
- ✅ Breadcrumb structure clear

**Score:** 14/15 (−1 for multiple H1s)

#### AI Agent Optimization (15 pts)

**Natural Language Analysis:**
- ✅ Conversational content structure
- ✅ Clear context and definitions
- ⚠️ Limited question-based headers
- ✅ Entity relationships clear (artist → venue → date)

**Citation Worthiness:**
- ✅ Factual data (dates, venues, artists)
- ✅ Structured and consistent
- ⚠️ No source attribution (original data)
- ✅ Verifiable information

**AI Readability:**
- ✅ Clear paragraph structure
- ✅ No walls of text
- ✅ Data tables well-formatted
- ✅ Lists used effectively

**Score:** 13/15 (−2 for missing Q&A format)

**Category Score:** 27/30 (90%)

---

### Step 5: Semantic & Contextual Intelligence (20 points)

#### Topical Authority (10 pts)

**Checks:**
- ✅ Comprehensive concert coverage (178 shows)
- ✅ Deep artist metadata (247 artists)
- ✅ Venue details (77 venues)
- ✅ Related content clusters (genres, geography)
- ✅ Consistent terminology
- ⚠️ Limited contextual explanations (assumes knowledge)

**Score:** 9/10 (−1 for missing context)

#### User Intent Matching (10 pts)

**Informational queries:**
- ✅ "What concerts did I see?" → Timeline
- ✅ "Which venues?" → Venues scene
- ✅ "How many shows by artist?" → Artist gatefold

**Navigational queries:**
- ✅ Direct access to scenes via URL params
- ✅ Artist/venue deep links work
- ✅ Clear navigation between scenes

**Conversational queries (AI agents):**
- ⚠️ "How many times saw Depeche Mode?" → Would require AI parsing
- ⚠️ "Best venue for industrial music?" → Not explicitly answered
- ✅ Data structure supports inference

**Score:** 8/10 (−2 for AI query optimization)

**Category Score:** 17/20 (85%)

---

### Step 6: Authority & Trust Signals (15 points)

#### Traditional Signals (8 pts)

**Checks:**
- ⚠️ Backlinks: Unable to assess (requires external tools)
- ✅ Brand mention: Clear branding (Morperhaus)
- ✅ Domain: Established history
- ✅ HTTPS: Secure

**Score:** 6/8 (−2 for unverified backlinks)

#### AI-Era Signals (7 pts)

**E-E-A-T (Experience, Expertise, Authoritativeness, Trust):**
- ✅ Experience: Personal concert archive (authentic)
- ⚠️ Expertise: No author bio or credentials
- ✅ Authoritativeness: Original source data
- ✅ Trust: Verifiable facts, consistent data

**Citation Worthiness:**
- ✅ Structured data AI can reference
- ✅ Clear provenance (personal archive)
- ⚠️ No "About" or methodology page

**Score:** 5/7 (−2 for missing author context)

**Category Score:** 11/15 (73%)

---

### Step 7: User Experience & Engagement (10 points)

**Checks:**
- ✅ Intuitive navigation (5 clear scenes)
- ✅ Visual hierarchy (distinct scene designs)
- ✅ Responsive design (mobile-friendly)
- ⚠️ Accessibility: Some ARIA labels missing
- ✅ Interactive elements (D3.js, Leaflet)
- ✅ Fast perceived performance

**Score:** 9/10 (−1 for accessibility gaps)

**Category Score:** 9/10 (90%)

---

### Step 8: AI Agent Query Simulation

**Test queries simulated:**

1. **"How many concerts in Los Angeles?"**
   - ✅ Data structure supports answer
   - ⚠️ No explicit text stating total
   - AI must aggregate from geography scene

2. **"What's the user's favorite artist?"**
   - ✅ Can infer from concert frequency
   - ⚠️ Not explicitly stated
   - Requires AI to count and rank

3. **"Show me industrial music concerts"**
   - ✅ Genre deep link exists
   - ✅ Clear genre taxonomy
   - ✅ Direct navigation path

4. **"Which venue hosted the most shows?"**
   - ✅ Data available in venues scene
   - ⚠️ Requires AI aggregation
   - Not pre-computed or stated

**AI Readiness Score:** 7/10
- Data is structured and accessible
- Some queries require AI inference vs. direct answers
- Adding explicit aggregates would improve AI-friendliness

---

### Step 9: Generate Dashboard

```
═══════════════════════════════════════════════════════════════
                    SEO ANALYSIS DASHBOARD
═══════════════════════════════════════════════════════════════
Site: https://concerts.morperhaus.org
Date: 2026-01-19
Pages Analyzed: 12
═══════════════════════════════════════════════════════════════

OVERALL SCORE: 86/100 🟢

Category Breakdown:
─────────────────────────────────────────────────────────────
🔧 Technical Foundation        22/25  (88%) 🟢  ████████░░
📝 Content Quality             27/30  (90%) 🟢  █████████░
🧠 Semantic Intelligence       17/20  (85%) 🟢  ████████░░
⭐ Authority & Trust           11/15  (73%) 🟡  ███████░░░
👤 User Experience              9/10  (90%) 🟢  █████████░
🤖 AI Agent Readiness           7/10  (70%) 🟡  ███████░░░

═══════════════════════════════════════════════════════════════
KEY STRENGTHS
═══════════════════════════════════════════════════════════════
✅ Excellent technical foundation (sitemap, fast responses)
✅ Clean, semantic URL structure with deep linking
✅ Rich structured data (178 concerts, 247 artists)
✅ Strong user experience and visual design
✅ Mobile-responsive and performant

═══════════════════════════════════════════════════════════════
TOP OPPORTUNITIES (Impact/Effort Matrix)
═══════════════════════════════════════════════════════════════

🎯 QUICK WINS (High Impact, Low Effort)
───────────────────────────────────────────────────────────────
1. Add Schema.org JSON-LD markup
   Impact: +5 points | Effort: 1-2 hours

2. Add "About" page with author context
   Impact: +3 points | Effort: 30 minutes

3. Convert images to WebP format
   Impact: +2 points | Effort: 1 hour

🚀 STRATEGIC (High Impact, Higher Effort)
───────────────────────────────────────────────────────────────
4. Add conversational Q&A headers
   Impact: +4 points | Effort: 2-3 hours

5. Create explicit aggregate statistics
   Impact: +3 points | Effort: 2-4 hours

📋 OPTIONAL (Lower Priority)
───────────────────────────────────────────────────────────────
6. Consolidate multiple H1 tags
   Impact: +1 point | Effort: 30 minutes

7. Add ARIA labels for accessibility
   Impact: +1 point | Effort: 1-2 hours

═══════════════════════════════════════════════════════════════
```

**Comparison to baseline (if --compare used):**
```
CHANGE SINCE 2026-01-15:
───────────────────────────────────────────────────────────────
Overall Score:      84 → 86  (+2)  ⬆️
Technical:          22 → 22  (=)   ─
Content:            25 → 27  (+2)  ⬆️
Semantic:           17 → 17  (=)   ─
Authority:          11 → 11  (=)   ─
UX:                  9 →  9  (=)   ─

Improvements:
✅ Added meta descriptions to 3 pages
✅ Improved heading structure on artist pages
```

---

### Step 10: Write Detailed Report

**Save to:** `seo-reports/YYYY-MM-DD-report.md`

**Report includes:**
1. Executive summary
2. Full dashboard (as above)
3. Detailed findings by category
4. Page-by-page analysis
5. Impact/effort recommendations
6. AI agent simulation results
7. Actionable next steps

**If --baseline flag used:**
Also save: `seo-reports/YYYY-MM-DD-baseline.json` (raw data for comparison)

**Confirmation:**
> ✅ Report saved: seo-reports/2026-01-19-report.md
> 📊 Baseline saved: seo-reports/2026-01-19-baseline.json
>
> Next steps:
> - Review recommendations in the report
> - Focus on Quick Wins first (items 1-3)
> - Re-run `/seo --compare 2026-01-19` after improvements

---

## SEO Rubric Details

### 1. Technical Foundation (25 points)

**Crawlability & Indexing (10 pts)**
- Sitemap present and valid (2 pts)
- robots.txt configured (1 pt)
- Clean URL structure (2 pts)
- No orphaned pages (1 pt)
- Canonical tags (2 pts)
- Fast response times <200ms (2 pts)

**Performance Hints (8 pts)**
- Image lazy loading (2 pts)
- Preload/prefetch tags (2 pts)
- WebP image format (2 pts)
- Minimal blocking resources (1 pt)
- Critical CSS inline (1 pt)

**Structured Data (7 pts)**
- Open Graph tags (2 pts)
- Schema.org JSON-LD (3 pts)
- Social meta tags (1 pt)
- Rich snippets potential (1 pt)

### 2. Content Quality & Structure (30 points)

**Traditional SEO (15 pts)**
- Unique titles (3 pts)
- Optimal title length (2 pts)
- Meta descriptions (3 pts)
- Heading hierarchy (3 pts)
- Internal linking (2 pts)
- Content freshness (2 pts)

**AI Agent SEO (15 pts)**
- Natural language structure (3 pts)
- Question-based headers (3 pts)
- Entity relationships clear (3 pts)
- Factual accuracy (3 pts)
- Citation worthiness (3 pts)

### 3. Semantic Intelligence (20 points)

**Topical Authority (10 pts)**
- Comprehensive coverage (3 pts)
- Content depth (3 pts)
- Related clusters (2 pts)
- Consistent terminology (2 pts)

**Intent Matching (10 pts)**
- Informational queries (3 pts)
- Navigational queries (3 pts)
- Transactional queries (1 pt)
- Conversational queries (3 pts)

### 4. Authority & Trust (15 points)

**Traditional Signals (8 pts)**
- Quality backlinks (3 pts)
- Brand mentions (2 pts)
- Domain authority (2 pts)
- HTTPS/security (1 pt)

**AI-Era Signals (7 pts)**
- E-E-A-T present (3 pts)
- Citation worthiness (2 pts)
- Fact-check friendly (2 pts)

### 5. User Experience (10 points)

- Navigation clarity (2 pts)
- Visual hierarchy (2 pts)
- Responsive design (2 pts)
- Accessibility (2 pts)
- Engagement signals (2 pts)

### 6. AI Agent Readiness (10 points bonus)

- Conversational query support (3 pts)
- Explicit aggregates/answers (3 pts)
- Context clarity (2 pts)
- Entity linking (2 pts)

---

## Report Format (Markdown)

```markdown
# SEO Analysis Report
**Site:** {URL}
**Date:** {DATE}
**Score:** {SCORE}/100

## Executive Summary

[3-4 sentences summarizing overall SEO health and top recommendations]

## Dashboard

[Full ASCII dashboard as shown above]

## Detailed Findings

### Technical Foundation (22/25)

#### Crawlability & Indexing: 10/10 ✅
- Sitemap: ✅ Valid XML at /sitemap.xml
- robots.txt: ✅ Properly configured
- URLs: ✅ Clean query param structure
...

[Continue for all categories]

## Page-by-Page Analysis

### Homepage (/?scene=timeline)
- **Title:** Morperhaus Concert Archives | 178 Shows Since 1984
- **Description:** ✅ Present (157 chars)
- **H1:** ✅ Single, descriptive
- **Schema:** ⚠️ Missing Event markup
- **Load time:** 165ms
...

## AI Agent Query Simulation

### Test 1: "How many concerts in Los Angeles?"
- **Query type:** Informational aggregate
- **Current state:** Data available, not explicit
- **AI readiness:** 🟡 Requires inference
- **Recommendation:** Add statistics page or meta tags

[Continue for all test queries]

## Recommendations

### 🎯 Quick Wins (Do First)

#### 1. Add Schema.org JSON-LD Markup
**Impact:** High (+5 points)
**Effort:** Low (1-2 hours)

Add Event and MusicEvent schema to concert pages:
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "MusicEvent",
  "name": "Depeche Mode at Hollywood Bowl",
  "startDate": "2023-10-15",
  ...
}
\`\`\`

**Benefits:**
- Rich snippets in search results
- Better AI agent parsing
- Enhanced voice search results

#### 2. Create About Page
**Impact:** Medium (+3 points)
**Effort:** Low (30 min)

Add /about route with:
- Author bio and credentials
- Why this archive exists
- Methodology for data collection

**Benefits:**
- E-E-A-T signals for AI
- User trust building
- Context for new visitors

[Continue for all recommendations]

## Next Steps

1. **Immediate (Today):**
   - Add Schema.org markup to homepage
   - Create simple About page

2. **This Week:**
   - Convert images to WebP
   - Add Q&A format headers to scene pages

3. **This Month:**
   - Build statistics aggregation page
   - Add ARIA labels for accessibility

## Appendix

### Raw Scores
[JSON data for comparison]

### Tested URLs
[Full list of 12 URLs]
```

---

## Storage & History

### Directory Structure
```
seo-reports/
├── 2026-01-19-report.md       # Markdown report (default)
├── 2026-01-19-report.html     # Standalone HTML report (--output html)
├── 2026-01-19-csv/            # CSV export directory (--output csv)
│   ├── summary.csv
│   ├── pages.csv
│   ├── insights.csv
│   ├── recommendations.csv
│   ├── scores.csv
│   ├── gsc-pages.csv          # If GSC data available
│   ├── gsc-queries.csv
│   ├── ga4-pages.csv          # If GA4 data available
│   ├── ga4-traffic.csv
│   └── backlinks.csv          # If backlink data available
├── 2026-01-19-baseline.json   # Raw data for comparison
├── 2026-01-15-report.md
├── 2026-01-15-baseline.json
└── README.md                   # Auto-generated index
```

### Baseline JSON Format
```json
{
  "metadata": {
    "date": "2026-01-19T10:30:00Z",
    "url": "https://concerts.morperhaus.org",
    "pagesAnalyzed": 12,
    "version": "1.0"
  },
  "scores": {
    "overall": 86,
    "technical": 22,
    "content": 27,
    "semantic": 17,
    "authority": 11,
    "ux": 9,
    "aiReadiness": 7
  },
  "checks": {
    "hasSitemap": true,
    "hasRobotsTxt": true,
    "hasSchema": false,
    "avgResponseTime": 187,
    ...
  },
  "pages": [
    {
      "url": "/?scene=timeline",
      "title": "Morperhaus Concert Archives",
      "hasH1": true,
      "hasDescription": true,
      ...
    }
  ]
}
```

### .gitignore Entry
```
# SEO reports (too many to commit)
/seo-reports/*.json
/seo-reports/*.md

# Except baseline
!/seo-reports/*-baseline.json
```

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "Site unreachable" | URL not responding | Check deployment, URL spelling |
| "Sitemap not found" | Missing /sitemap.xml | Run `npm run generate:sitemap` |
| "Parse error" | Invalid HTML | Check for build errors |
| "No previous baseline" | Using --compare with no history | Run with --baseline first |

---

## When to Run

| Scenario | Command |
|----------|---------|
| After SEO improvements | `/seo --compare YYYY-MM-DD` |
| Monthly SEO audit | `/seo --baseline` |
| Before major release | `/seo` (check score) |
| Testing staging | `/seo --url https://staging.example.com` |

---

## Integration with Other Commands

**Before release:**
```bash
/seo              # Check SEO health
/validate         # Check code quality
/release          # Ship it
```

**After content updates:**
```bash
/data-refresh     # Update concert data
/seo              # Verify SEO impact
```

---

## Related

- `scripts/generate-sitemap.ts` — Sitemap generation
- `docs/SEO.md` — SEO strategy and implementation notes
- `.claude/skills/analytics/` — Event tracking (related to engagement)
- `/validate` — Code quality checks
