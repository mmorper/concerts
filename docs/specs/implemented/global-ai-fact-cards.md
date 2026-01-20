# AI Fact Cards for Liner Notes

**Status:** Planned
**Target Version:** v3.7.0
**Priority:** High
**Estimated Complexity:** Medium (Multiple components, 1-3 days)
**Dependencies:** None

---

## Executive Summary

Add pre-computed "fact cards" to the `/liner-notes` page that display statistics like "Most-seen artist: Depeche Mode (7 concerts)" with deep links. This addresses the AI Agent Readiness gap identified in SEO analysis (scored 6/10).

**Problem it solves:** AI agents (ChatGPT, Claude, Perplexity) can crawl the site but can't easily quote aggregate statistics - they must parse JSON and compute. Fact cards provide pre-computed, quotable answers in HTML.

**User experience:** Visitors to `/liner-notes` see a "By the Numbers" section with interesting statistics about the concert archive, each linking to explore that data point.

**Product fit:** Extends the existing changelog/liner-notes infrastructure to serve both humans (visual cards) and AI agents (quotable facts in HTML and llm.txt).

---

## Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session:**

```
I need to implement the AI Fact Cards feature for Morperhaus Concerts.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- At the end of EACH implementation window, assess remaining context
- If <30% remains, STOP and provide a handoff summary
- Implement the spec AS WRITTEN - it's the source of truth

**Feature Overview:**
- Add "By the Numbers" section to /liner-notes page with 6 fact cards
- Create generate-facts.ts script to compute statistics from concerts.json
- Facts include: top artists, top venues, total concerts, genre distribution
- Each card has deep link to explore that fact
- Update llm.txt with same facts for AI agent consumption

**Key References:**
- Full Design Spec: docs/specs/future/global-ai-fact-cards.md
- Existing Pattern: src/components/changelog/ChangelogCard.tsx
- Build Pipeline: scripts/build-data.ts
- llm.txt Template: public/llm.txt

**Implementation Approach:**
- Window 1: Data pipeline (generate-facts.ts, types, build integration)
- Window 2: UI components (FactCard.tsx, ChangelogPage.tsx updates)
- Window 3: SEO integration (llm.txt update, testing)

**Design Philosophy:**
Facts should be instantly quotable by AI agents - natural language, specific numbers, with deep links.

**Key Design Details:**
- Card dimensions: Match ChangelogCard (~300px min-width)
- Colors: amber-400 headlines, slate-400 details (match changelog)
- Category icons: Small badge top-right (microphone, map-pin, music, calendar)

**Files to Create:**
- scripts/generate-facts.ts (~150 LOC)
- src/components/changelog/FactCard.tsx (~80 LOC)
- public/data/facts.json (generated)

**Files to Modify:**
- src/components/changelog/types.ts (add Fact interface)
- src/components/changelog/ChangelogPage.tsx (add facts section)
- scripts/build-data.ts (add fact generation step)
- scripts/update-meta-tags.ts (add facts to llm.txt)

Let's start with Window 1. Should I begin by creating the Fact type interface?
```

---

## Design Philosophy

**"Quotable Facts"** - Every fact card should be directly quotable by an AI agent without transformation. If an AI asks "What's the most visited venue?", the answer should appear verbatim in the HTML.

**Natural language over data formats** - Instead of "Irvine Meadows: 16", use "Irvine Meadows: 16 shows" - complete, human-readable phrases.

**Deep links for exploration** - Every fact links to where users can explore that data point, benefiting both humans and AI agents that want to cite sources.

---

## Visual Design

### Fact Card Component

**Specifications:**

- Dimensions: `min-w-[280px]` flexible width in grid
- Background: `bg-zinc-950` (matches ChangelogCard)
- Border: `border border-slate-800`, `border-amber-500/50` on hover
- Border radius: `rounded-xl`
- Padding: `p-6`
- Shadow on hover: `shadow-lg shadow-amber-500/10`

**Layout:**

```text
┌─────────────────────────────────┐
│ [icon]                  artist  │  ← Category badge (top-right)
│                                 │
│ Depeche Mode                    │  ← Headline (text-xl, amber-400)
│ 7 concerts                      │
│                                 │
│ Most-seen artist, 1985-2024     │  ← Detail (text-sm, slate-400)
│                                 │
│ Explore all 7 shows →           │  ← CTA link (text-sm, amber-500)
└─────────────────────────────────┘
```

### Page Layout (ChangelogPage)

```text
┌────────────────────────────────────────────────────────┐
│  ← Back to Timeline                                    │
│                                                        │
│  Liner Notes                                           │
│  What's new in the archives                            │
├────────────────────────────────────────────────────────┤
│                                                        │
│  BY THE NUMBERS                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Depeche  │ │ Irvine   │ │ 178      │              │
│  │ Mode: 7  │ │ Meadows  │ │ concerts │              │
│  └──────────┘ └──────────┘ └──────────┘              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ New Wave │ │ Calif.   │ │ 1984:    │              │
│  │ 48 shows │ │ 120      │ │ First    │              │
│  └──────────┘ └──────────┘ └──────────┘              │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  RELEASE HISTORY                                       │
│  [existing changelog cards...]                         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Data Structures

**Fact Interface** (`src/components/changelog/types.ts`):

```typescript
export interface Fact {
  id: string
  category: 'artist' | 'venue' | 'genre' | 'timeline' | 'geography'
  headline: string      // "Depeche Mode: 7 concerts"
  detail: string        // "Most-seen artist from 1985 to 2024"
  route: string         // "/?scene=artists&artist=depeche-mode"
  cta: string           // "Explore all 7 shows"
  priority: number      // 1 = highest, for display ordering
}

export interface FactsData {
  computedAt: string    // ISO date
  facts: Fact[]
}
```

### Fact Generation Script

**Location:** `scripts/generate-facts.ts`

**When it runs:** Part of build-data pipeline (runs during `/release`)

**Logic:**

```typescript
// 1. Load concerts.json
// 2. Compute aggregates:

// Top 3 artists by concert count
const artistCounts = groupBy(concerts, 'headlinerNormalized')
const topArtists = sortByCount(artistCounts).slice(0, 3)

// Top 3 venues by concert count
const venueCounts = groupBy(concerts, 'venueNormalized')
const topVenues = sortByCount(venueCounts).slice(0, 3)

// Total concerts
const totalConcerts = concerts.length

// First and most recent concerts
const firstConcert = sortByDate(concerts)[0]
const latestConcert = sortByDate(concerts).at(-1)

// Top genre
const genreCounts = groupBy(concerts, 'genre')
const topGenre = sortByCount(genreCounts)[0]

// Top state
const stateCounts = groupBy(concerts, 'state')
const topState = sortByCount(stateCounts)[0]

// 3. Generate Fact objects with natural language
// 4. Write to public/data/facts.json
```

**Facts computed (12-15 total, top 6 displayed):**

| Priority | Fact | Headline Example | Deep Link |
|----------|------|------------------|-----------|
| 1 | Top artist | "Depeche Mode: 7 concerts" | `/?scene=artists&artist=depeche-mode` |
| 2 | Top venue | "Irvine Meadows: 16 shows" | `/?scene=venues&venue=irvine-meadows` |
| 3 | Total concerts | "178 concerts since 1984" | `/?scene=timeline` |
| 4 | Top genre | "New Wave: 48 shows" | `/?scene=genres` |
| 5 | First concert | "First show: Adam Ant (1984)" | `/?scene=artists&artist=adam-ant` |
| 6 | Top state | "California: 120 concerts" | `/?scene=geography` |
| 7 | #2 artist | "[Name]: X concerts" | deep link |
| 8 | #3 artist | "[Name]: X concerts" | deep link |
| 9 | #2 venue | "[Name]: X shows" | deep link |
| 10 | Latest concert | "Latest: [Artist] (2026)" | deep link |
| 11 | Busiest year | "2023: 12 shows" | `/?scene=timeline` |
| 12 | Unique cities | "35 cities visited" | `/?scene=geography` |

### Component Architecture

```text
src/components/changelog/
├── ChangelogPage.tsx    # Modified: add facts section
├── ChangelogCard.tsx    # Existing (unchanged)
├── FactCard.tsx         # New: fact card component
├── types.ts             # Modified: add Fact interface
└── index.ts             # Modified: export FactCard
```

### Build Pipeline Integration

**Modify:** `scripts/build-data.ts`

Add step after genre aggregation:

```typescript
// Step 12: Generate facts for liner notes
console.log('Step 12: Generating facts...')
await runScript('generate-facts.ts')
```

### llm.txt Integration

**Modify:** `scripts/update-meta-tags.ts`

Add section to llm.txt generation:

```markdown
## Pre-Computed Statistics

These facts are updated with each data refresh:

### Most-Seen Artists
1. Depeche Mode: 7 concerts (1985-2024) → /?scene=artists&artist=depeche-mode
2. Howard Jones: 6 concerts (1985-2023) → /?scene=artists&artist=howard-jones
...

### Most-Visited Venues
1. Irvine Meadows: 16 shows → /?scene=venues&venue=irvine-meadows
...

### Key Statistics
- Total concerts: 178 (1984-2026)
- Unique artists: 253
- Unique venues: 77
- Top genre: New Wave (48 shows)
- Top state: California (120 concerts)
```

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Facts display correctly on /liner-notes page
- [ ] All 6 fact cards render with correct data
- [ ] Deep links navigate to correct scenes
- [ ] Category badges display correct icons
- [ ] Hover states work (border glow)
- [ ] Mobile responsive (cards stack)
- [ ] llm.txt contains updated facts section
- [ ] No console errors

### AI Agent Efficacy Testing

**Before deployment (baseline):**

Ask these questions to ChatGPT, Claude, Perplexity:

1. "How many times has Morperhaus seen Depeche Mode?"
2. "What is the most visited venue in Morperhaus Concert Archives?"
3. "How many total concerts are in the Morperhaus archive?"

Record: Can AI answer? Does it cite the site? What numbers?

**After deployment (wait 2-4 weeks for re-crawl):**

Re-ask same questions. Success = AI quotes exact numbers from fact cards and cites concerts.morperhaus.org.

### Unit Tests

**File:** `scripts/__tests__/generate-facts.test.ts`

```typescript
describe('generate-facts', () => {
  it('computes top artists by concert count')
  it('computes top venues by concert count')
  it('generates valid deep link URLs')
  it('includes all required fact fields')
  it('sorts facts by priority')
})
```

---

## Implementation Plan

### Phase 1: Data Pipeline (Window 1)

**Files to Create:**

- `scripts/generate-facts.ts` (~150 LOC)

**Files to Modify:**

- `src/components/changelog/types.ts` (add Fact interface)
- `scripts/build-data.ts` (add step 12)

**Tasks:**

1. Add `Fact` and `FactsData` interfaces to types.ts
2. Create generate-facts.ts with aggregation logic
3. Integrate into build-data.ts pipeline
4. Run pipeline to generate initial facts.json
5. Verify facts.json output is correct

**Acceptance Criteria:**

- [ ] `npm run build-data` generates `public/data/facts.json`
- [ ] facts.json contains 12+ facts with all required fields
- [ ] All deep links are valid URL patterns

### Phase 2: UI Components (Window 2)

**Files to Create:**

- `src/components/changelog/FactCard.tsx` (~80 LOC)

**Files to Modify:**

- `src/components/changelog/ChangelogPage.tsx` (add facts section)
- `src/components/changelog/index.ts` (export FactCard)

**Tasks:**

1. Create FactCard component matching design spec
2. Add category icon badges (5 categories)
3. Update ChangelogPage to load facts.json
4. Add "By the Numbers" section above release cards
5. Implement responsive grid layout

**Acceptance Criteria:**

- [ ] /liner-notes shows 6 fact cards in grid
- [ ] Cards match ChangelogCard styling
- [ ] Deep links navigate correctly
- [ ] Mobile layout stacks cards properly

### Phase 3: SEO Integration & Polish (Window 3)

**Files to Modify:**

- `scripts/update-meta-tags.ts` (add facts to llm.txt)

**Files to Create:**

- `scripts/__tests__/generate-facts.test.ts` (~50 LOC)

**Tasks:**

1. Add facts section generation to update-meta-tags.ts
2. Run meta tags update to populate llm.txt
3. Write unit tests for fact generation
4. Record baseline AI agent responses (before)
5. Final visual polish and accessibility review

**Acceptance Criteria:**

- [ ] llm.txt contains "Pre-Computed Statistics" section
- [ ] Unit tests pass
- [ ] Baseline AI responses documented
- [ ] Accessibility: keyboard navigation works

---

## Future Enhancements

- **Rotating facts:** Show different 6 facts on each visit
- **Fact categories filter:** Let users filter by artist/venue/timeline facts
- **Share individual facts:** Social sharing for specific statistics
- **Trend facts:** "Most concerts in a single year: 2023 (12 shows)"
- **Cloudflare Worker:** Inject fact schema markup for /liner-notes route

---

## Questions for Review

1. **Fact refresh frequency:** Currently tied to `/release`. Should facts also update on `/data-refresh`?
2. **Fact count:** Display 6 cards (2 rows of 3). Should this be configurable or fixed?
3. **Empty state:** If no facts (shouldn't happen), show nothing or placeholder?

---

## Revision History

- **2026-01-19:** Initial specification created
- **Version:** 1.0.0
- **Author:** Claude (SEO Analysis)
- **Status:** Planned
