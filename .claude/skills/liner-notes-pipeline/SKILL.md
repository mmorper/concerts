# Liner Notes Pipeline Skill

**Purpose:** Reference this skill when working on the agentic liner notes pipeline — pattern detectors, scorer, generator, curator, or pipeline orchestrator.

**When to use:**
- Adding or modifying pattern detectors
- Debugging pipeline runs
- Understanding the data flow from concerts.json → liner-notes.json
- Adding new output formats (RSS, OG images)
- Integrating liner notes into the build pipeline

---

## Quick Reference

### Pipeline Overview

```
concerts.json
    │
    ▼
analyze.ts          ← Deterministic pattern detectors (no AI)
    │  AnalysisFinding[]
    ▼
score.ts            ← 60-point pre-prose quality scorer
    │  ScoredFinding[] (sorted, deduplicated)
    ▼
generate.ts         ← Anthropic API → first-person prose
    │  ScoredFinding[] with prose field populated
    ▼
curate.ts           ← Image, audio, slug, deep links, related posts
    │  LinerNotesPost[]
    ▼
pipeline.ts         ← Orchestrator (CLI flags, error handling, file writes)
    │
    ├─ public/data/liner-notes.json
    ├─ public/liner-notes.xml
    └─ public/og/liner-notes/{slug}.png
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/liner-notes/types.ts` | Pipeline-internal types |
| `scripts/liner-notes/analyze.ts` | 7 Tier 1 pattern detectors |
| `scripts/liner-notes/score.ts` | 60-point pre-prose scorer |
| `scripts/liner-notes/generate.ts` | Anthropic API prose generation |
| `scripts/liner-notes/curate.ts` | Media, slugs, deep links, related posts |
| `scripts/liner-notes/pipeline.ts` | Orchestrator |
| `scripts/liner-notes/index.ts` | CLI entry point |
| `scripts/liner-notes/rss.ts` | RSS feed generator |
| `scripts/liner-notes/og-image.ts` | OG image generator |
| `src/types/liner-notes.ts` | App-facing types (liner-notes.json schema) |
| `public/data/liner-notes.json` | Output: canonical post store |
| `public/liner-notes.xml` | Output: RSS feed |

### CLI Flags

```bash
npm run generate:liner-notes                  # Normal weekly run
npm run generate:liner-notes -- --analyze-only  # Detectors only, no AI
npm run generate:liner-notes -- --dry-run       # Full run, no file writes
npm run generate:liner-notes -- --seed          # First run: generate ~10 posts
npm run generate:liner-notes -- --force         # Ignore deduplication store
npm run generate:liner-notes -- --date 2026-06-15  # Override today's date
```

---

## Pattern Detectors

### Tier 1 (Implemented — 14 detectors)

| Detector | Trigger | Category | Tags |
|----------|---------|----------|------|
| `artist-longevity` | 2+ headliner shows, span > 5 yrs | personal | `#artist-longevity`, `#multi-decade` |
| `opener-to-headliner` | Opener in one show, headliner in another | cultural | `#opener-to-headliner`, `#career-arc` |
| `venue-loyalty` | 5+ shows OR 3+ decades at same venue | personal | `#venue-loyalty`, `#home-venue` |
| `calendar-anniversary` | Concert within ±7 days of today (prior year) | personal | `#anniversary`, `#on-this-day` |
| `geographic-chapter` | 3+ consecutive shows in same US region | personal | `#geographic`, `#two-coasts` |
| `concert-streak` | 3+ concerts within 30 days | personal | `#hot-streak`, `#back-to-back` |
| `milestone-marker` | Concert #1, 25, 50, 75, 100, 150 | personal | `#milestone` |
| `rare-sighting` | Artist seen exactly once | deep-cut | `#rare-sighting` |
| `historical-moment` | Year with 2+ concerts; concert with most openers | deep-cut | `#historical-moment` |
| `venue-ghost` | Venue with status "demolished" or "closed" | deep-cut | `#venue-ghost`, `#demolished`/`#closed` |
| `festival-mega-bill` | 4+ openers on a single bill | cultural | `#festival-bill`, `#mega-bill` |
| `drought-comeback` | 5+ year gap between consecutive shows, same artist | personal | `#drought`, `#comeback` |
| `city-pulse` | Concert in city during a historically significant year (hardcoded list) | cultural | `#city-pulse`, `#historical-context` |
| `album-context` | Concert within 42 days of a landmark album release (hardcoded list) | cultural | `#album-context`, `#cultural-moment` |

### Tier 2 (Planned — tracked in issue #68)

`genre-outlier`, `double-header`, `discography-crossref`, `temporal-pattern`

### Adding a New Detector

1. Add the detector name to `DetectorName` union in `scripts/liner-notes/types.ts`
2. Write a function `detectFoo(concerts: Concert[]): AnalysisFinding[]`
3. Call it inside `analyze()` in `analyze.ts`
4. Add it to the detector table in this skill

**Detector contract:**
- Must return `[]` (not throw) on any error
- ID must be deterministic: `"{detector-slug}-{entity-slug}"`
- Must set `artists[]`, `venues[]`, `years[]` (used for deduplication + deep links)
- `category` must be `"cultural" | "personal" | "deep-cut"`
- Only process `date <= today` (enforced by `pastConcerts()` in `analyze.ts`)

---

## Scoring Rubric (60 points)

| Dimension | Max | Notes |
|-----------|-----|-------|
| Specificity | 15 | Named artists, venues, dates |
| Span / Scale | 10 | Years covered, show count |
| Data Richness | 10 | Enriched fields available (bio, tracks, images) |
| Surprise Factor | 10 | Unexpected connections, rare patterns |
| Timeliness Bonus | 10 | Calendar anniversary proximity, recency |
| Category Balance | 5 | Underrepresented category gets bonus |

Findings below `MIN_SCORE` (20, in `score.ts`) are dropped.

**The score is not comparable across detectors** — it ranks findings *within* a detector and acts as a global floor. `surpriseFactor` is a fixed per-detector constant and `specificity` counts however many entities a detector put in its arrays, so a 28 from one detector doesn't mean what a 28 from another does.

Selection therefore **rotates across detectors** (#231): each detector nominates its best eligible finding, and the turn goes to whichever detector has gone longest without publishing, with score only breaking ties. A detector whose champion sits at the floor passes its turn. One post publishes per run; see `docs/LINER_NOTES_PIPELINE.md` for the full algorithm.

---

## Deduplication

**Rule:** Same `artistSlug` + same `detector` → skip. Re-cover allowed after 6 months.

**Store:** `public/data/liner-notes.json` is the canonical history. The pipeline reads existing posts to build the deduplication index before scoring.

**Override:** `--force` flag bypasses deduplication entirely.

---

## Deep Links

Every post **must** include at least one deep link. Deep links are the primary mechanism for driving readers back into the archive.

```typescript
interface DeepLink {
  label: string;   // "Depeche Mode"
  url: string;     // "/?scene=artists&artist=depeche-mode"
  type: "artist" | "venue" | "timeline";
}
```

**URL patterns:**
- Artist → `/?scene=artists&artist={headlinerNormalized}`
- Venue → `/?scene=venues&venue={venueNormalized}`
- Timeline year → `/?scene=timeline&year={year}`

---

## Pipeline Isolation — CRITICAL

**The liner notes pipeline must never break the main build.**

- Every step in `pipeline.ts` is wrapped in try/catch
- On any failure, log the error and `process.exit(0)` (not 1)
- `build-data.ts` runs `generate:liner-notes` as an optional step; missing `liner-notes.json` is handled gracefully by the app
- Never `throw` from the pipeline entry point

---

## Output Schema

`public/data/liner-notes.json` root shape:

```typescript
{
  generatedAt: string;   // ISO timestamp
  dataHash: string;      // MD5/SHA of concerts.json
  posts: LinerNotesPost[];  // newest first
  metadata: {
    totalPosts: number;
    totalGenerated: number;
    averageScore: number;
    lastPipelineRun: string;
    concertsAnalyzed: number;
    feedUrl: string;       // "/liner-notes.xml"
  }
}
```

Full type: `src/types/liner-notes.ts → LinerNotesData`

---

## Spec Reference

Full architectural spec: `docs/specs/future/agentic-liner-notes-v3.md`

**Last Updated:** 2026-03-08
