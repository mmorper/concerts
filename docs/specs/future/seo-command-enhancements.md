# SEO Command Enhancements

**Status:** Planned
**Target Version:** TBD
**Priority:** Medium
**Estimated Complexity:** High
**Dependencies:** `/seo` command (implemented in v3.5.0)

---

## Executive Summary

Enhance the `/seo` command with advanced analysis capabilities including AI query simulation, Core Web Vitals integration, backlink checking, accessibility scoring, and image optimization detection. These improvements will transform the command from a structural analyzer into a comprehensive SEO health monitoring system.

---

## Current State (v3.5.0)

The `/seo` command currently:
- Crawls 12 key pages and analyzes HTML structure
- Scores across 6 categories (100-point rubric)
- Checks for meta tags, Schema.org, Open Graph
- Measures response times and HTML size
- Generates markdown reports with recommendations
- Supports baseline comparison

**Limitations:**
- No actual AI query testing (scores based on structure, not behavior)
- No real-world performance metrics (Core Web Vitals)
- No external authority signals (backlinks)
- Limited accessibility analysis
- Basic image optimization checks

---

## Proposed Enhancements

### 1. AI Query Simulation

**What:** Actually test if AI assistants can answer questions about the site using live API calls.

**Implementation:**
- Integrate OpenAI API (GPT-4) for question answering
- Test 5-10 common queries:
  - "How many times has Morperhaus seen Depeche Mode?"
  - "What's the most attended venue?"
  - "Show me concerts from 2024"
  - "Which artist has the most shows?"
  - "What genres does Morperhaus listen to?"
- Compare AI answers to ground truth from data files
- Score accuracy (0-10 points for AI readiness)

**API Requirements:**
- `OPENAI_API_KEY` environment variable
- Budget: ~$0.10 per analysis run

**Benefits:**
- Validates actual AI discoverability (not just structure)
- Surfaces content gaps AI can't interpret
- Tests if llm.txt is effective

---

### 2. Core Web Vitals Integration

**What:** Measure real-world performance using Google Lighthouse CI.

**Implementation:**
- Use `@lhci/cli` or PageSpeed Insights API
- Measure Core Web Vitals:
  - **LCP** (Largest Contentful Paint) - target <2.5s
  - **FID** (First Input Delay) - target <100ms
  - **CLS** (Cumulative Layout Shift) - target <0.1
- Also capture:
  - Time to Interactive (TTI)
  - Total Blocking Time (TBT)
  - Speed Index
- Score performance category (0-25 points)

**API Requirements:**
- Option 1: Run Lighthouse locally (no API key, ~30s per page)
- Option 2: PageSpeed Insights API (free, requires API key)

**Benefits:**
- Real performance data (not just response time)
- Validates mobile experience
- Tracks performance regressions over time

---

### 3. Backlink Checking

**What:** Analyze external authority signals and domain reputation.

**Implementation:**
- Integrate backlink API:
  - Option 1: Moz Links API (paid, $500/mo)
  - Option 2: Ahrefs API (paid, $83/mo)
  - Option 3: Google Search Console API (free, limited data)
- Retrieve metrics:
  - Domain Authority (DA) / Domain Rating (DR)
  - Total backlinks
  - Referring domains
  - Top referring pages
- Score authority category (0-15 points)

**API Requirements:**
- Likely requires paid subscription
- Search Console API free but limited

**Benefits:**
- Objective authority measurement
- Identifies link-building opportunities
- Tracks referral traffic sources

---

### 4. Accessibility Scoring

**What:** Automated accessibility audit using WCAG 2.1 standards.

**Implementation:**
- Use `axe-core` or `pa11y` for automated checks
- Test for:
  - Missing alt text on images
  - Insufficient color contrast
  - Missing ARIA labels
  - Keyboard navigation support
  - Semantic HTML usage
  - Focus management
- Score UX category (0-10 points)

**Dependencies:**
- `axe-core` or `pa11y` (already have `@axe-core/puppeteer` in devDependencies)

**Benefits:**
- Ensures site is usable for all visitors
- Catches issues before manual testing
- Improves search engine rankings (accessibility is a signal)

---

### 5. Image Optimization Analysis

**What:** Comprehensive image quality and optimization checks.

**Implementation:**
- Detect image formats:
  - Identify non-WebP images (should be WebP)
  - Flag oversized images (>200 KB)
- Check alt text:
  - Missing alt attributes
  - Empty alt=""
  - Generic alt text ("image", "photo")
- Validate lazy loading:
  - Check for `loading="lazy"` attribute
  - Verify images below fold use lazy loading
- Score performance category impact

**Benefits:**
- Reduces page weight (faster loads)
- Better SEO (images in search results)
- Improved accessibility (screen readers)

---

## Implementation Plan

### Phase 1: Core Web Vitals (Highest Impact)

**Effort:** Medium (2-3 hours)

**Tasks:**
1. Add Lighthouse CI dependency
2. Create `runLighthouse()` function
3. Parse performance metrics from report
4. Integrate scores into dashboard
5. Add performance recommendations

**Files to Modify:**
- `scripts/analyze-seo.ts` - Add Lighthouse integration
- `package.json` - Add `@lhci/cli` dependency

**Acceptance Criteria:**
- [ ] Reports include Core Web Vitals scores
- [ ] Performance category reflects actual metrics
- [ ] Recommendations mention specific improvements

---

### Phase 2: Accessibility Scoring (Medium Impact)

**Effort:** Low (1-2 hours)

**Tasks:**
1. Add axe-core accessibility checker
2. Run axe tests on each page
3. Categorize violations (critical, serious, moderate)
4. Score UX category based on violations
5. Add accessibility recommendations

**Files to Modify:**
- `scripts/analyze-seo.ts` - Add axe-core integration

**Acceptance Criteria:**
- [ ] Reports include accessibility violations count
- [ ] UX score reflects actual issues
- [ ] Recommendations list specific WCAG failures

---

### Phase 3: Image Optimization (Medium Impact)

**Effort:** Low (1 hour)

**Tasks:**
1. Parse HTML for `<img>` tags
2. Check image formats (WebP vs PNG/JPG)
3. Verify alt text presence and quality
4. Check lazy loading attributes
5. Add image recommendations

**Files to Modify:**
- `scripts/analyze-seo.ts` - Add image analysis functions

**Acceptance Criteria:**
- [ ] Reports show image optimization stats
- [ ] Performance score includes image impact
- [ ] Recommendations suggest format conversions

---

### Phase 4: AI Query Simulation (High Impact, Complex)

**Effort:** High (4-6 hours)

**Tasks:**
1. Create AI query test suite
2. Integrate OpenAI API
3. Define ground truth answers from data
4. Compare AI responses to expected answers
5. Score AI readiness based on accuracy

**Files to Modify:**
- `scripts/analyze-seo.ts` - Add AI query testing
- `.env.example` - Document OPENAI_API_KEY

**Acceptance Criteria:**
- [ ] Tests 5-10 common queries
- [ ] Measures answer accuracy (0-100%)
- [ ] AI readiness score reflects actual behavior
- [ ] Works without API key (skips if missing)

---

### Phase 5: Backlink Checking (Low Priority)

**Effort:** Medium (2-3 hours)

**Tasks:**
1. Integrate Google Search Console API (free option)
2. Retrieve backlink data
3. Calculate domain authority metrics
4. Score authority category
5. Add link-building recommendations

**Files to Modify:**
- `scripts/analyze-seo.ts` - Add backlink API integration
- `.env.example` - Document API credentials

**Acceptance Criteria:**
- [ ] Reports show backlink counts
- [ ] Authority score reflects external signals
- [ ] Works without API key (uses estimated score)

**Note:** Consider Search Console API first (free) before paid services.

---

## Technical Architecture

### Enhanced Scoring System

```typescript
interface EnhancedSEOScore {
  overall: number
  technical: number        // 25 pts (enhanced with Lighthouse)
  content: number          // 30 pts (enhanced with AI queries)
  semantic: number         // 20 pts
  authority: number        // 15 pts (enhanced with backlinks)
  ux: number               // 10 pts (enhanced with accessibility)
  aiReadiness: number      // 10 pts (actual AI behavior)
  performance: {
    lcp: number
    fid: number
    cls: number
    speedIndex: number
  }
  accessibility: {
    violations: number
    criticalCount: number
    score: number
  }
  images: {
    total: number
    webp: number
    missingAlt: number
    oversized: number
  }
}
```

### Configuration

```typescript
interface SEOConfig {
  // API keys (optional, graceful degradation)
  openaiApiKey?: string
  lighthouseEnabled: boolean
  axeCoreEnabled: boolean
  backlinkApiKey?: string

  // Performance thresholds
  lcpThreshold: number  // 2500ms
  fidThreshold: number  // 100ms
  clsThreshold: number  // 0.1

  // Image optimization thresholds
  maxImageSize: number  // 200KB
  preferredFormat: 'webp'
}
```

---

## Enhanced Dashboard Output

```
═══════════════════════════════════════════════════════════════
                    SEO ANALYSIS DASHBOARD
═══════════════════════════════════════════════════════════════
Site: https://concerts.morperhaus.org
Date: 2026-01-20
Pages Analyzed: 12
═══════════════════════════════════════════════════════════════

OVERALL SCORE: 86/100 🟢

Category Breakdown:
─────────────────────────────────────────────────────────────
🔧 Technical Foundation        24/25  (96%) 🟢  █████████░
📝 Content Quality             28/30  (93%) 🟢  █████████░
🧠 Semantic Intelligence       18/20  (90%) 🟢  █████████░
⭐ Authority & Trust           13/15  (87%) 🟢  █████████░
👤 User Experience             10/10 (100%) 🟢  ██████████
🤖 AI Agent Readiness           9/10  (90%) 🟢  █████████░

Performance Metrics (Core Web Vitals):
─────────────────────────────────────────────────────────────
⚡ LCP (Largest Contentful Paint)    1.8s    🟢  Target: <2.5s
👆 FID (First Input Delay)           45ms    🟢  Target: <100ms
📏 CLS (Cumulative Layout Shift)     0.05    🟢  Target: <0.1
🏃 Speed Index                        2.1s    🟢
⏱️  Time to Interactive               2.8s    🟡

Accessibility:
─────────────────────────────────────────────────────────────
✅ 0 Critical Issues
⚠️  2 Moderate Issues (missing ARIA labels)
✓  WCAG 2.1 Level AA: 94% compliant

Images:
─────────────────────────────────────────────────────────────
📷 Total Images: 24
✅ WebP Format: 18 (75%)
❌ Non-WebP: 6 (recommend conversion)
⚠️  Missing Alt Text: 2
✅ Lazy Loading: 22/24 (92%)

AI Query Accuracy:
─────────────────────────────────────────────────────────────
✅ "How many concerts?" - Correct (178 shows)
✅ "Most attended venue?" - Correct (9:30 Club)
✅ "Shows in 2024?" - Correct (4 shows listed)
⚠️  "Favorite genre?" - Partial (inferred from counts)
❌ "First concert ever?" - Incorrect (couldn't find)

Score: 8/10 (80% accuracy)

Backlinks:
─────────────────────────────────────────────────────────────
🔗 Total Backlinks: 47
🌐 Referring Domains: 12
📈 Domain Rating: 28/100
🔝 Top Referrer: music-charts-archive.com (8 links)

═══════════════════════════════════════════════════════════════
```

---

## Command Line Options

```bash
# Standard analysis with all enhancements
npm run seo

# Skip expensive checks (no Lighthouse, no AI queries)
npm run seo -- --quick

# Full analysis with all optional APIs
npm run seo -- --full

# Individual feature flags
npm run seo -- --no-lighthouse    # Skip performance tests
npm run seo -- --no-ai-queries    # Skip AI simulation
npm run seo -- --no-backlinks     # Skip backlink check

# Performance-only mode
npm run seo -- --performance-only
```

---

## Cost Considerations

| Feature | Cost | Per Run | Monthly (4x) |
|---------|------|---------|--------------|
| Lighthouse CI | Free | $0 | $0 |
| axe-core | Free | $0 | $0 |
| OpenAI API (GPT-4) | Paid | ~$0.10 | ~$0.40 |
| Google Search Console | Free | $0 | $0 |
| Moz Links API | Paid | - | $500 |
| Ahrefs API | Paid | - | $83 |

**Recommendation:** Start with free options (Lighthouse, axe-core, Search Console) and add OpenAI API ($0.10/run) for AI validation. Skip paid backlink APIs unless budget allows.

---

## Testing Strategy

### Manual Testing

**Phase 1 (Core Web Vitals):**
- [ ] Run on homepage, verify LCP/FID/CLS scores
- [ ] Compare to manual Lighthouse run
- [ ] Test with slow 3G throttling

**Phase 2 (Accessibility):**
- [ ] Verify violation counts match manual axe scan
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Check color contrast issues

**Phase 3 (Images):**
- [ ] Verify image format detection (WebP vs PNG)
- [ ] Check alt text parsing accuracy
- [ ] Test lazy loading detection

**Phase 4 (AI Queries):**
- [ ] Manually verify AI answers are correct
- [ ] Test with missing API key (graceful degradation)
- [ ] Compare to ChatGPT web interface

**Phase 5 (Backlinks):**
- [ ] Verify backlink count matches Search Console
- [ ] Test with missing API credentials

---

## Success Metrics

After implementation, the enhanced `/seo` command should:

- **Performance:** Measure real Core Web Vitals (not just response time)
- **Accuracy:** Test AI discoverability with 80%+ answer accuracy
- **Accessibility:** Catch 100% of automated WCAG violations
- **Images:** Identify all optimization opportunities
- **Authority:** Show external reputation signals

**Overall Goal:** Transform from structural analyzer → comprehensive SEO health monitor

---

## Future Enhancements (Post-MVP)

Beyond these 5 features, consider:

1. **Competitor Analysis** - Compare scores to similar sites
2. **SEO Trends** - Track score changes over time (graphs)
3. **Scheduled Monitoring** - Run weekly via cron, email reports
4. **Alerting** - Notify when score drops >10 points
5. **Mobile-Specific Testing** - Test mobile vs desktop separately
6. **International SEO** - Multi-language content analysis
7. **Local SEO** - Test location-based search visibility

---

## Questions for Review

- Should we prioritize free options (Lighthouse, axe) or invest in paid APIs (Moz, Ahrefs)?
- Is $0.10/run acceptable for OpenAI API calls?
- Should we make AI queries configurable (add your own test cases)?
- Do we want scheduled monitoring (e.g., GitHub Actions weekly run)?

---

## Related Documentation

- Current command: [.claude/commands/seo.md](../../.claude/commands/seo.md)
- SEO guide: [docs/SEO.md](../../SEO.md)
- Implementation: [scripts/analyze-seo.ts](../../../scripts/analyze-seo.ts)

---

## Revision History

- **2026-01-20:** Initial specification created
- **Version:** 1.0.0
- **Author:** Claude Sonnet 4.5
- **Status:** Planned (not yet implemented)
