# Liner Notes Pipeline

> **Status:** v1.1 — 15 Tier 1 detectors; selection rewritten to detector rotation (#231)
> **Last Updated:** 2026-08-05
> **Original Spec:** [docs/specs/implemented/agentic-liner-notes-v3.md](specs/implemented/agentic-liner-notes-v3.md)

---

## What Is This?

The Liner Notes system is an **agentic content generation pipeline** that automatically discovers stories from the concert archive and publishes them as first-person editorial posts. It runs weekly as part of `npm run build-data`, publishing one new post per run.

Each post is:

- **Discovered deterministically** — a detector scans the concert data for a meaningful pattern
- **Scored** — a 60-point rubric ranks candidates for quality, richness, and timeliness
- **Written by AI** — Claude API generates first-person prose grounded in real data
- **Published with media** — image, optional audio preview, deep links back into the archive

Posts live at `/liner-notes` (blog feed) and `/liner-notes/:slug` (permalink). The feed is also available as an [RSS feed](https://concerts.morperhaus.org/liner-notes.xml).

---

## Running the Pipeline

### The npm script

```bash
npm run generate:liner-notes [-- --flag [value]]
```

This runs `scripts/liner-notes/index.ts` via `tsx`. It can be run standalone or as part of the full `npm run build-data` pipeline, where it executes **between** data enrichment (Steps 1–9) and SEO generation (Steps 10–11).

`ANTHROPIC_API_KEY` must be set in your environment for prose generation. The `--analyze-only` and `--dry-run` flags work without it.

---

### Flags

#### `--analyze-only`

**Stops after Stage 2 (scoring). No API calls. No files written.**

Runs analysis and scoring, then prints the top 10 findings with their scores and categories. Use this to understand what the detector pool currently contains before committing to generation.

```bash
npm run generate:liner-notes -- --analyze-only
```

Example output:

```text
Top 10 findings:
  [39/60] [personal] Howard Jones: 39 Years of Shows
  [38/60] [personal] Depeche Mode: A 40-Year Relationship
  [36/60] [personal] The Hollywood Bowl: 15 Shows Over 4 Decades
  ...
```

---

#### `--dry-run`

**Stops after Stage 3 (selection). No API calls. No files written.**

Runs analysis, scoring, and candidate selection, then prints the selected posts. Use this to preview exactly what would be published this week — with deduplication applied — before spending API budget on generation.

```bash
npm run generate:liner-notes -- --dry-run
```

---

#### `--seed`

**Runs the full pipeline but publishes up to 10 posts instead of the normal one.**

Intended for the first run when bootstrapping an empty feed. Rotation and deduplication still apply — it just fills more slots, and a per-category cap keeps one category from taking the whole seed. After seeding, switch back to normal runs.

```bash
npm run generate:liner-notes -- --seed
```

---

#### `--force`

**Bypasses both cooldowns at Stage 3.**

Normally a finding is skipped if it shares a detector + primary artist with a post from the last 6 months, or if its primary artist headlined any of the last 10 posts. `--force` waives both, so the pipeline can re-select combinations it has already published.

Publication history is still read for rotation staleness. Before #231 this flag passed an empty history, which also blanked staleness and would have collapsed rotation back into score ranking.

Use this to republish or regenerate posts for an artist that was covered recently — for example, after updating the voice rules or fixing a data issue.

```bash
npm run generate:liner-notes -- --force
```

---

#### `--date YYYY-MM-DD`

**Overrides "today" for the duration of the run.**

Affects Stage 1 (analysis) and Stage 2 (scoring). Primarily useful for testing the `calendar-anniversary` detector, which is date-sensitive. Also affects timeliness scoring for any other timely findings.

```bash
npm run generate:liner-notes -- --date 2026-06-15
```

---

### Combining flags

Flags can be combined freely. Common combinations:

```bash
# See what anniversary posts would fire on a specific date (safe, no writes)
npm run generate:liner-notes -- --date 2026-06-15 --dry-run

# Preview selection ignoring deduplication (safe, no writes)
npm run generate:liner-notes -- --force --dry-run

# Bootstrap a fresh feed ignoring any prior cooldowns
npm run generate:liner-notes -- --seed --force
```

**Note:** `--analyze-only` takes precedence over `--dry-run` — if both are passed, the pipeline stops after scoring (Stage 2), before selection.

---

### Pipeline stage map

This shows exactly which stages each flag affects:

| Stage | Default | `--analyze-only` | `--dry-run` | `--seed` | `--force` | `--date` |
| ----- | ------- | ---------------- | ----------- | -------- | --------- | -------- |
| 1. Analyze | ✓ | ✓ | ✓ | ✓ | ✓ | uses override date |
| 2. Score | ✓ | ✓ then stop | ✓ | ✓ | ✓ | uses override date |
| 3. Select | ✓ | — | ✓ then stop | up to 10 posts | waives both cooldowns | ages the rerun cooldown |
| 4. Generate prose | ✓ | — | — | ✓ | ✓ | — |
| 5. Build posts | ✓ | — | — | ✓ | ✓ | — |
| 6. Write JSON | ✓ | — | — | ✓ | ✓ | — |
| 7. RSS feed | ✓ | — | — | ✓ | ✓ | — |
| 8. OG images | ✓ | — | — | ✓ | ✓ | — |

---

## Pipeline Architecture

```text
concerts.json (source of truth)
        │
        ▼
┌─────────────────────────────────────┐
│  Stage 1: ANALYZE                   │  scripts/liner-notes/analyze.ts
│  Deterministic pattern detectors    │  → AnalysisFinding[]
│  (no API calls)                     │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  Stage 2: SCORE                     │  scripts/liner-notes/score.ts
│  60-point quality rubric            │  → ScoredFinding[]
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  Stage 3: SELECT                    │  scripts/liner-notes/curate.ts
│  Detector rotation over per-        │  → 1 post (+2 reserve)
│  detector champions + cooldowns     │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  Stage 4: GENERATE                  │  scripts/liner-notes/generate.ts
│  Claude API → first-person prose    │  → prose: string
│  (historical-moment uses web search)│
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  Stage 5: BUILD                     │  scripts/liner-notes/curate.ts
│  Resolve image, audio, deep links,  │  → LinerNotesPost[]
│  related posts                      │
└─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│  Stage 6: PUBLISH                   │  scripts/liner-notes/pipeline.ts
│  Merge into liner-notes.json        │
│  Generate RSS + OG images           │
└─────────────────────────────────────┘
```

**Output files:**

| File | Description |
| ---- | ----------- |
| `public/data/liner-notes.json` | Primary data file consumed by the React UI |
| `public/liner-notes.xml` | RSS 2.0 feed (20 most recent posts) |
| `public/og/liner-notes/{slug}.png` | Social card per post (1200×630) |

---

## Implemented Detectors (Tier 1)

All Tier 1 detectors are deterministic — no API calls. They live in `scripts/liner-notes/analyze.ts`.

Each detector produces one or more `AnalysisFinding` objects with a `category`, `temporality`, structured `dataPoints`, and optional `suggestedImage`/`suggestedTrack` hints for the build stage.

---

### 1. Artist Longevity (`artist-longevity`)

**What it finds:** Artists seen 2+ times spanning 5+ years.

**Category:** Personal | **Temporality:** Evergreen

**Data points:** First/last show, total shows, years spanned, list of venues, decades covered.

**Scoring bonus:** Time span — 30+ years earns maximum span points (10 pts).

**Example headline:** *"Howard Jones: 39 Years of Shows"*

---

### 2. Opener to Headliner (`opener-to-headliner`)

**What it finds:** Artists who appear in the opener slot at an earlier show, then headline at a later show.

**Category:** Cultural | **Temporality:** Evergreen

**Data points:** Earliest opener show, first headliner show, gap in years, show counts in each role.

**Scoring bonus:** Larger gaps score higher (20+ year gap = 7 pts).

**Example headline:** *"Squeeze: From Opener to Headliner"*

---

### 3. Venue Loyalty (`venue-loyalty`)

**What it finds:** Venues with 5+ shows, OR shows spanning 3+ decades at the same venue.

**Category:** Personal | **Temporality:** Evergreen

**Data points:** Venue name, city, total shows, decades covered, first/last show, top 5 artists seen there.

**Scoring bonus:** Each additional decade adds span points (4+ decades = max 10 pts).

**Auto-tag:** `#home-venue` if 10+ shows at the venue.

**Example headline:** *"The Hollywood Bowl: 15 Shows Over 4 Decades"*

---

### 4. Calendar Anniversary (`calendar-anniversary`)

**What it finds:** Concerts that fall within ±7 days of today's date (any year).

**Category:** Personal | **Temporality:** Timely

**Data points:** Concert date, venue, years ago, whether it's a milestone anniversary (10/15/20/25/30/35/40 years).

**Scoring bonus:** Milestone anniversaries (+5 pts); shows within ±3 days score higher timeliness (+10 pts).

**Special behavior:** Returns at most 3 per run, prioritizing milestone anniversaries, then proximity to today. The `--date` flag lets you test this detector for a specific date.

**Example headline:** *"March 8: 25 Years Since Depeche Mode"*

---

### 5. Geographic Chapter (`geographic-chapter`)

**What it finds:** Runs of 3+ consecutive concerts in the same US geographic region.

**Category:** Personal | **Temporality:** Evergreen

**Regions:** West Coast, Mountain West, Midwest, South, Northeast, Southwest, Pacific

> **`STATE_REGION` is keyed on full state names** (`"California"`), matching what `concerts.json` stores and the convention `CITY_PULSE_EVENTS` uses. It was originally keyed on postal codes (`"CA"`), which never matched a single row — every concert resolved to `"International"`, the detector collapsed the whole archive into one "chapter", and it published a post describing a California/DC archive as *"177 international concerts"* (#232). `regionOf()` now warns on an unmapped state rather than falling through silently, and a test asserts every state in `concerts.json` resolves. Non-US states are expected to reach `"International"` and are listed in `KNOWN_NON_US`.

**Data points:** Region name, show count, first/last show, span in years, distinct venues and artists, decades covered.

**Returns:** Top 3 regions by show count.

**Auto-tag:** `#two-coasts` if the archive contains both West Coast and Northeast shows.

**Example headline:** *"My West Coast Chapter: 12 Concerts Over 8 Years"*

---

### 6. Concert Streak (`concert-streak`)

**What it finds:** Windows of 30 days or less containing 3+ concerts.

**Category:** Personal | **Temporality:** Evergreen

**Data points:** Show count, total days in streak, whether any shows were back-to-back (adjacent days), genre count, full list of shows in the streak.

**Scoring bonus:** Surprise factor (+5 pts).

**Auto-tag:** `#back-to-back` if any two shows are on adjacent days.

**Window semantics:** The 30 days are measured from the *first* show in the streak, not from the previously added one. Until #233 each gap was compared to its predecessor, so runs chained transitively and produced findings like "14 Concerts in 215 Days" — a busy stretch, not a streak.

**Returns:** Top 3 by show count, then **densest first** (fewest days), then by id. Every qualifying streak on current data has exactly 3 shows, so without the density tie-break the ranking fell through to array order and the three chronologically earliest won.

**Example headline:** *"4 Concerts in 12 Days"*

---

### 7. Milestone Marker (`milestone-marker`)

**What it finds:** Specific concert numbers in the overall sequence — 1st, 25th, 50th, 75th, 100th, 150th, 175th, 200th.

**Category:** Personal | **Temporality:** Evergreen

**Data points:** Milestone number, artist, venue, city, date, year, openers present at that show, `spanYears` (years elapsed since concert #1), and a `firstShow` block naming that first night.

**Scoring note:** Lowest surprise factor of any detector (3 pts) — milestone posts are intentionally understated. Span is measured as the distance back to concert #1, which is what a milestone actually accumulates. Until #233 this case was missing from `computeSpan` and scored 0, capping every milestone at 19 against a floor of 20 — the detector had never published. Milestones inside the first decade still fall below the floor by design.

**Deep link:** Sets `concertDate`, so posts carry a `?show=` setlist link.

**Example headline:** *"Concert #100: My Centennial Show"*

---

### 8. Rare Sighting (`rare-sighting`)

**What it finds:** Artists seen exactly once in the entire archive.

**Category:** Deep-Cut | **Temporality:** Evergreen

**Data points:** Artist name, venue, city, state, date, year, openers at that show.

**Returns:** Top 25 rare artists, sorted by year descending (most recent rare sightings surface first).

**Example headline:** *"The White Stripes: Caught Once, Never Again"*

---

### 9. Historical Moment (`historical-moment`)

**What it finds:** For years with 2+ concerts, picks the concert with the most openers as a cultural time-capsule anchor.

**Category:** Deep-Cut | **Temporality:** Evergreen

**Data points:** Artist, venue, city, state, date, month, year, total concert count for that year.

**Special behavior:** This is the only Tier 1 detector that uses the Anthropic API with **web search** during prose generation. `generateProseWithWebSearch()` fetches real cultural and historical events from the era and weaves 1–2 verified details into the post. Requires `ANTHROPIC_API_KEY`.

**Returns:** Top 20 by year, most recent first.

**Example headline:** *"Weezer in 1994: What Was in the Air"*

---

### 10. Venue Ghost (`venue-ghost`)

**What it finds:** Venues that have since been demolished or closed, based on `status` in `venues-metadata.json`.

**Category:** Deep-Cut | **Temporality:** Evergreen

**Data points:** Venue name, city, show count, status (`demolished` or `closed`), closed date/year, first and last show, top 5 artists seen there.

**Scoring note:** Highest surprise factor of any venue detector (9 pts) — a room you knew is gone is inherently powerful.

**Auto-tags:** `#venue-ghost`, plus `#demolished` or `#closed` based on status.

**Returns:** Sorted by show count descending. Requires venue status data in `venues-metadata.json` — venues without a `status` field are ignored.

**Example headline:** *"The Roxy: 4 Shows Before It Was Demolished"*

---

### 11. Festival Mega-Bill (`festival-mega-bill`)

**What it finds:** Concerts with 4 or more openers — festival-scale bills in the archive.

**Category:** Cultural | **Temporality:** Evergreen

**Data points:** Headliner, full openers list, opener count, total artists, venue, city, date, year.

**Scoring note:** Surprise factor scales with bill size (10+ openers = 10 pts, 7+ = 8, 5+ = 6, else 4).

**Auto-tags:** `#festival-bill`, `#mega-bill`.

**Returns:** Top 10 by opener count.

**Example headline:** *"Lollapalooza 1991 + 8 More: 1991 Festival Bill"*

---

### 12. Drought & Comeback (`drought-comeback`)

**What it finds:** Artists seen 2+ times with a gap of 5+ years between any two consecutive shows. Surfaces the largest gap for each qualifying artist.

**Category:** Personal | **Temporality:** Evergreen

**Data points:** Artist, last show before the gap, first show after the gap, gap in years, total show count.

**Scoring note:** Surprise factor scales with gap size (≥20 years = 9, ≥15 = 7, ≥10 = 5, else 3).

**Auto-tags:** `#drought`, `#comeback`.

**Returns:** Top 15 by gap size.

**Example headline:** *"Depeche Mode: 8 Years Between Shows"*

---

### 13. City Pulse (`city-pulse`)

**What it finds:** Concerts in a city/state during a historically significant year. Matches against a hardcoded list of 7 major events.

**Category:** Cultural | **Temporality:** Evergreen

**Hardcoded events:**

| Year | Event |
| ---- | ----- |
| 1984 | 1984 Los Angeles Summer Olympics (California) |
| 1992 | LA uprising after the Rodney King verdict (California) |
| 1994 | Northridge earthquake (California) |
| 2001 | September 11 attacks (New York) |
| 2001 | September 11 / Pentagon strike (District of Columbia) |
| 2005 | Hurricane Katrina (Louisiana) |
| 2013 | Boston Marathon bombing (Massachusetts) |

**Data points:** Concert artist, venue, city, date, year, the matched historical event name, a curated context string describing the moment, count of all matching concerts that year.

**Selection:** Among matching concerts, picks the one with the most openers; breaks ties by date. The historical context string is hardcoded per event — not fetched from the web.

**Scoring note:** Surprise factor = 8 (historical context is compelling).

**Auto-tags:** `#city-pulse`, `#historical-context`.

**Example headline:** *"The Replacements in 1992: The Year of Los Angeles Uprising"*

---

### 14. Album Context (`album-context`)

**What it finds:** Concerts that fell within 42 days (6 weeks) of a landmark album release. Surfaces the intersection of your concert history and a cultural moment in recorded music.

**Category:** Cultural | **Temporality:** Evergreen

**Landmark album list:** 31 hardcoded albums, from *Purple Rain* (1984) to *Midnights* (2022). The list includes albums chosen for cultural significance (Violator, Nevermind, OK Computer, Blackstar, etc.) with a curated `significance` string for each.

**Selection:** Prefers a concert by the same artist as the album; otherwise uses the chronologically closest concert. One finding per concert/album pair.

**Data points:** Concert artist, venue, city, date, year; album name, album artist, release date, significance string; days apart, timing description (e.g. "3 days before it dropped"), `isSameArtist` flag.

**Scoring note:** Surprise factor = 9 if `isSameArtist`, 6 otherwise.

**Auto-tags:** `#album-context`, `#cultural-moment`.

**Example headline:** *"David Bowie — Days Before Blackstar Dropped"*

---

## Planned Detectors (Tier 2)

Tracked in [GitHub issue #68](https://github.com/mmorper/concerts/issues/68). These four detectors were scoped during v4.4.x but deferred — each has a specific reason it can't ship yet. They are declared in `types.ts` but have no implementation in `analyze.ts`.

---

### `genre-outlier` (Deep-Cut)

**What it will find:** Statistical anomaly in genre history — if 95% of shows are punk/rock and you have one country show, surface it.

**Why deferred:** The `genre` field is empty on all concert records. Genre data exists in `artists-metadata.json` but the AudioDB source categorizes ~60% of artists as `Rock/Pop` (a catch-all), making statistical outliers ambiguous.

**Unblock when:** Concert-level genre data is enriched, or a more granular genre taxonomy is available.

---

### `double-header` (Personal)

**What it will find:** Two concerts on the same calendar day — rare enough that each instance has a story.

**Why deferred:** Zero same-day concerts in the current 180-concert dataset. The detector logic itself is trivial and can be implemented now so it activates automatically as new data is added.

**Unblock when:** The archive grows to include a same-day pair, or implement speculatively.

---

### `discography-crossref` (Cultural)

**What it will find:** Seeing an artist multiple times across clearly different album eras. *"You caught them in three eras: Violator, Ultra, Sounds of the Universe."*

**Why deferred:** Requires structured album release date data (album → release year) per artist, which isn't currently in `artists-metadata.json`.

**Unblock when:** Album release year data is populated via MusicBrainz or Discogs API enrichment.

---

### `temporal-pattern` (Personal)

**What it will find:** Seasonal or day-of-week patterns in concert attendance. *"You go to 70% of your shows in summer. You almost never go in January."*

**Why deferred:** The insight is interesting but the prose is harder to make specific and surprising — low wow-factor relative to other detectors.

**Unblock when:** Other high-value detectors are producing posts and the bar for new content has risen.

---

> **Note for future sessions:** When implementing a Tier 2 detector, follow the pattern in `analyze.ts` — each detector is a function returning `AnalysisFinding[]`, registered in the main `analyzeAll()` dispatcher. Add a corresponding `score{DetectorName}()` case in `score.ts`. Update issue #68 when shipped, and move the detector entry above into the Tier 1 section.

---

## Scoring Rubric (60 points)

Implemented in `scripts/liner-notes/score.ts`. Findings below **20 points** are dropped before prose generation.

> **The score is not comparable across detectors.** It ranks findings *within* a detector and acts as a global floor — nothing more. `surpriseFactor` is a fixed per-detector constant and `specificity` counts however many entities a detector chose to put in its arrays, so a 28 from `historical-moment` and a 28 from `rare-sighting` do not mean the same thing. Selection relies on this: see [Selection Algorithm](#selection-algorithm).

| Dimension | Max | Description |
| --------- | --- | ----------- |
| Specificity | 15 | Named artists and venues — 3 pts each, capped at 15 |
| Span / Scale | 10 | Time span or scope of the finding — thresholds are detector-specific |
| Data Richness | 10 | Availability of enriched metadata for the primary artist |
| Surprise Factor | 10 | Subjective wow-factor of the core insight — fixed per detector |
| Timeliness Bonus | 10 | Proximity to today's date — only applies to timely findings |
| Category Balance | 5 | Underrepresented category bonus |
| **Total** | **60** | |

---

### Specificity (0–15)

`(artists.length + venues.length) × 3`, capped at 15.

A finding with 3 artists and 2 venues scores 15 (the maximum). A finding with 1 artist and 0 venues scores 3.

---

### Span / Scale (0–10)

Each detector uses a different measure of scale. The thresholds are:

| Detector | Measure | 2 pts | 4 pts | 7 pts | 10 pts |
| -------- | ------- | ----- | ----- | ----- | ------ |
| `artist-longevity` | `spanYears` | — | >10 yrs | >20 yrs | >30 yrs |
| `opener-to-headliner` | `gapYears` | — | >10 yrs | >20 yrs | >30 yrs |
| `venue-loyalty` | decade count | — | 2 decades | 3 decades | 4+ decades |
| `calendar-anniversary` | `yearsAgo` | — | >10 yrs | >20 yrs | >30 yrs |
| `geographic-chapter` | `spanYears` | — | >10 yrs | >20 yrs | >30 yrs |
| `rare-sighting` | years ago | — | >10 yrs | >20 yrs | >30 yrs |
| `historical-moment` | years ago | — | >10 yrs | >20 yrs | >30 yrs |
| `venue-ghost` | year span (first→last show) | >5 yrs | — | >10 yrs | >20 yrs |
| `festival-mega-bill` | opener count | 4+ openers | 5+ openers | 7+ openers | 10+ openers |
| `drought-comeback` | `gapYears` | 0–10 yrs | >10 yrs | >15 yrs | >20 yrs |
| `city-pulse` | years ago | — | >10 yrs | >20 yrs | >30 yrs |
| `album-context` | years ago | — | >10 yrs | >20 yrs | >30 yrs |
| `concert-streak` | — | 0 | — | — | — |
| `milestone-marker` | years since concert #1 | — | >10 yrs | >20 yrs | >30 yrs |

---

### Data Richness (0–10)

Applies to the **primary (first) artist** in the finding only.

| Condition | Points |
| --------- | ------ |
| Artist has a bio in `artists-metadata.json` | +5 |
| Artist has at least one track with a `previewUrl` in `artists-top-tracks.json` | +3 |
| Artist has 3+ concert appearances in the archive | +2 |
| **Max** | **10** |

---

### Surprise Factor (0–10)

A fixed subjective weight per detector reflecting the inherent wow-factor of that finding type. For detectors with variable data, the surprise factor scales with the finding.

| Detector | Score | Notes |
| -------- | ----- | ----- |
| `festival-mega-bill` | 4–10 | Opener count ≥10 = 10, ≥7 = 8, ≥5 = 6, else 4 |
| `opener-to-headliner` | 3–9 | Gap ≥20 yrs = 9, ≥15 = 7, ≥10 = 5, else 3 |
| `venue-ghost` | 9 | A room you knew is gone — inherently powerful |
| `rare-sighting` | 9 | Caught once — and never again |
| `album-context` | 6 or 9 | 9 if `isSameArtist`, 6 otherwise |
| `drought-comeback` | 3–9 | Gap ≥20 yrs = 9, ≥15 = 7, ≥10 = 5, else 3 |
| `calendar-anniversary` | 8 | Time-coincidence is inherently compelling |
| `city-pulse` | 8 | Historical context is compelling |
| `historical-moment` | 7 | Grounded with web search; context is specific |
| `geographic-chapter` | 6 | — |
| `concert-streak` | 5 | — |
| `venue-loyalty` | 4 | — |
| `artist-longevity` | 4 | — |
| `milestone-marker` | 3 | Intentionally understated |

---

### Timeliness Bonus (0–10)

Only applies to findings that have a `timeliness` window (currently only `calendar-anniversary`).

| Condition | Points |
| --------- | ------ |
| Within ±3 days of today | 10 |
| Within ±7 days of today | 5 |
| Beyond ±7 days | 0 |
| `isMilestone === true` (10/15/20/25/30/35/40 year anniversary) | +5, capped at 10 total |

Example: a show that is exactly 25 years ago (milestone) and 2 days away scores min(10 + 5, 10) = 10. A show that is 25 years ago but 6 days away scores min(5 + 5, 10) = 10.

---

### Category Balance (0–5)

The scorer pre-computes how many findings fall into each category across the full batch. A finding earns +5 if its category has fewer findings than the average-per-category. This nudges the selection algorithm toward diversity without requiring it.

---

## Selection Algorithm

Implemented in `scripts/liner-notes/curate.ts`. **Rewritten in #231** — selection rotates across detectors rather than ranking all findings by score.

### Why rotation

The score is a **within-detector quality rank and a global floor. It is not a cross-detector comparison.** Two of the six rubric dimensions are properties of the *detector*, not the finding:

- `surpriseFactor` is a hardcoded constant per detector — all 66 `rare-sighting` findings score 9, all 27 `historical-moment` findings score 7.
- `specificity` counts `artists.length + venues.length`, which reflects how many entities a detector chose to put in its arrays.

So ranking ~200 findings by score largely re-ranked the *detectors*, in near-identical order every week. Anything below the tallest detector in its category starved indefinitely: `historical-moment` produced 27 viable findings and published nothing across 56 posts, and `venue-ghost` was next in line. Diversifying on category — three buckets for fifteen detectors — could not fix that, because `deep-cut` alone held 107 of the findings.

### The algorithm

1. **Filter** — drop findings failing the rerun cooldown (same detector + artist within 6 months) or the primary-artist cooldown (last 10 posts).
2. **Champion** — each detector nominates its single best remaining finding. Fifteen candidates, not two hundred. This is where the score does its real work, comparing findings that are actually comparable.
3. **Pass** — a detector whose champion sits at `MIN_SCORE` sits the round out rather than publishing its weakest finding just because its turn arrived. It stays stale and returns when it has something better. This is *not* a global threshold: it never excludes a category the way the old `STANDARD_THRESHOLD = 30` did.
4. **Rank** — `staleness desc → score desc → id asc`. Staleness is the number of posts published since that detector last appeared; a detector that has never published sorts first. **The comparator is total** — it can never fall through to array order, which is what previously let a stable sort and two adjacent lines in `analyze.ts` decide publication between detectors tied at 28.
5. **Fill** — take `POSTS_PER_RUN` (1; `--seed` uses 10) plus `CANDIDATE_RESERVE` (2). The reserve is only consumed if an earlier candidate's prose fails validation, so a normal run costs **one** API call.

`STANDARD_THRESHOLD` is retired; `MIN_SCORE = 20` in `score.ts` is the single floor.

**Measured over 26 simulated weekly runs:** all 15 detectors publish, the first repeat comes at post 16, mean score is 33.5 (up from 33.0), and nothing publishes below 26.

**Deduplication:** unchanged. `--force` bypasses both cooldowns so a recently-covered artist can be regenerated — but publication history is still read for rotation staleness.

> **Note:** normal runs publish one post. Before #231, `select()` returned 2–3 and a post-prose filter in `pipeline.ts` (Stage 5b) discarded all but one — paying 2–3 Claude API calls per published post. That filter was itself a depth-1 detector cooldown ("don't repeat the previous detector"); rotation generalizes it and moves it before generation.

---

## Prose Generation

Implemented in `scripts/liner-notes/generate.ts`.

**Model:** `claude-sonnet-4-6` | **Temperature:** 0.7 | **Max tokens:** 400 (800 for `historical-moment`)

---

### System prompt

The same system prompt is used for every category and detector. It establishes voice, structure, what cultural references are permitted, and a list of banned anti-patterns. The full prompt (as it appears in the code):

```text
You write short, first-person liner notes for a personal concert archive spanning 1984 to present. You are the archive owner.

VOICE
- Always write in first person: "I saw," "I remember," "my concert history." Never "you" or "the archive owner."
- Tone: Product Marketer — warm, inviting, slightly reverent about live music. Like telling a friend about your record collection.
- Self-contained. Never reference "as mentioned above" or anything outside this post.

STRUCTURE
- 2–5 sentences. Aim for 60–150 words.
- Name specific artists, venues, and years from the data provided.
- Include at least one number (years, count, span, gap).
- End with something human: a reaction, a reflection, or a wry observation.

CATEGORY GUIDANCE
- Cultural Context: lead with the broader musical significance, bridge to "my experience of it."
- Personal Connection: lead with "I" and the personal moment, bridge to what it meant.
- Deep-Cut Correlation: lead with the surprising discovery, prove it with specific data, react to it.

CULTURAL CONTEXT RULES
You may include one cultural reference per post — but only if you are confident in it:
- ALWAYS ALLOWED: album names from the data I provide, artist formation years from the data, genres from the data.
- ALLOWED WITH CARE: major album release years for well-known artists, career milestones. Frame as approximate memory: "around the time," "they had just released," "that was the era of." Never cite specific dates or numbers not in my data.
- NEVER: chart positions, sales figures, cultural events unrelated to the artist, exact release dates not in the data, comparisons like "one of the greatest."
When in doubt, leave it out — the concert data is interesting enough on its own.

ANTI-PATTERNS
- No superlatives without data evidence ("legendary," "iconic").
- No vague gestures ("a celebrated career," "decades of influence").
- No filler ("it goes without saying," "needless to say").
- Never use the words "journey" or "tapestry."
- Every sentence must contain a specific fact.

OUTPUT
Return only the prose. No headline, no label, no preamble. Just the sentences.
```

---

### User prompt structure

Each finding gets its own API call with a user prompt assembled from the finding's data. The prompt has four sections:

```text
CATEGORY: personal
HEADLINE: Howard Jones: 39 Years of Shows
DETECTOR: artist-longevity

DATA POINTS:
{ ...finding.dataPoints as JSON ... }

ADDITIONAL CONTEXT (grounded in our data — Tier 1 only):
howard-jones: formed: 1983 | genres: Synth-pop, New Wave | albums in data: Human's Lib, Dream Into Action

INSTRUCTION:
This is a Personal Connection post. Lead with "I" and the specific personal moment.
Make it feel like a memory being surfaced for the first time, not a summary of facts.

Write the liner note prose now.
```

**Cultural context injection (`buildCulturalContextData`):** For up to 2 artists in the finding, the prompt includes any of the following that are present in the enriched data: `formed` year, `genres` array, and up to 3 unique album names from `artists-top-tracks.json`. Nothing is fabricated — if the data doesn't have it, it isn't included.

**Category instructions** (appended per-finding):

| Category | Instruction snippet |
| -------- | ------------------- |
| `cultural` | Lead with broader musical significance, bridge to your personal experience. Opening line should frame why this matters beyond your concert history. |
| `personal` | Lead with "I" and the specific personal moment. Make it feel like a memory being surfaced, not a summary of facts. |
| `deep-cut` | Lead with the surprising discovery, prove it with specific data points, then react with genuine surprise or delight. |

---

### Historical Moment: agentic web search

The `historical-moment` detector uses a different prompt and an **agentic loop** instead of a single API call.

The user prompt adds a search task before asking for prose:

```text
SEARCH TASK: Before writing, search the web for major world events and cultural happenings
in {month} {year} and in {city} during {year}. Focus on events that would resonate with a
concert-goer: music industry news, cultural moments, political events, sports, anything that
defined that moment in time. Only reference events you find in search results — do not invent
historical context.

Write the liner note prose now, weaving in 1–2 real historical details from your search.
```

The API call uses Anthropic's built-in `web_search_20250305` server-side tool (max 3 uses per call). After each `tool_use` response, the pipeline sends a continuation turn and loops until `stop_reason === "end_turn"` or 5 iterations, whichever comes first. This is why `historical-moment` uses 800 max tokens — multi-turn tool use requires headroom.

---

### Validation

After generation, prose is checked against three rules before being accepted. Failures are logged and the post is skipped (not thrown):

| Rule | Check |
| ---- | ----- |
| Word count | 40–500 words |
| First person | Must contain `" I "`, `"I "` at start, `" my "`, or `"my "` at start |
| Year mention | Must include at least one year from the finding's `years` array |

---

## Claude Code Skills

Two Claude Code skills support ongoing work on the liner notes system. They are loaded automatically by Claude Code when the task context matches.

---

### `liner-notes-voice` (`.claude/skills/liner-notes-voice/SKILL.md`)

**When it activates:** Writing or reviewing prose — editing the system prompt in `generate.ts`, reviewing AI-generated posts for voice consistency, writing test fixtures, or deciding whether a cultural reference is permitted.

**What it contains:**

- The full voice brief with do/don't examples
- Structural rules (sentence count, required number, human ending)
- Category-specific example posts for Cultural, Personal, and Deep-Cut
- The **cultural context confidence tier system** (Tier 1 / Tier 2 / Tier 3) with examples of what each permits
- A full banned-phrase list with reasons
- A pre-acceptance validation checklist
- API parameter guidance (temperature rationale)

**Cultural context tiers (summary):**

| Tier | What's allowed |
| ---- | -------------- |
| Tier 1 — Always | Artists, albums, genres, dates already in `concerts.json` or enriched data |
| Tier 2 — Approximate only | Major career milestones for well-known artists; must use hedged language ("around the time," "they had just released") |
| Tier 3 — Never | Chart positions, sales figures, unrelated cultural events, exact dates not in the data |

---

### `liner-notes-pipeline` (`.claude/skills/liner-notes-pipeline/SKILL.md`)

**When it activates:** Technical work on the pipeline — adding or modifying detectors, debugging runs, understanding the data flow, adding output formats, or integrating liner notes into the build pipeline.

**What it contains:**

- Pipeline overview diagram (`analyze → score → generate → curate → pipeline`)
- Key file reference table
- CLI flag reference
- Detector table with trigger conditions, categories, and auto-tags for all Tier 1 detectors
- Detector contract rules (what every detector must and must not do)
- Scoring rubric summary
- Deduplication rules and override behavior
- Deep link URL patterns
- **Pipeline isolation rules** — the pipeline must never break the main build; all steps are wrapped in try/catch and exit with code 0 on failure
- Output schema reference

---

Full type definitions live in `scripts/liner-notes/types.ts` (pipeline) and `src/types/liner-notes.ts` (app-facing).

### `AnalysisFinding` (pipeline internal)

```typescript
{
  id: string                    // Deterministic, e.g. "longevity-depeche-mode"
  detector: DetectorName        // See detector list above
  category: "cultural" | "personal" | "deep-cut"
  temporality: "evergreen" | "timely"
  timeliness?: { relevantDate, windowStart, windowEnd }
  headline: string              // 5–12 words
  dataPoints: Record<string, unknown>  // Detector-specific structured data
  artists: string[]             // Normalized names ("depeche-mode")
  venues: string[]              // Normalized names ("the-hollywood-bowl")
  years: number[]
  suggestedImage?: { type: "artist"|"venue"|"album", ... }
  suggestedTrack?: { artistNormalized, trackName?, albumName? }
  tags: string[]                // Auto-derived ("#artist-longevity", "#multi-decade")
  score?: number                // Populated by scorer (0–60)
  prose?: string                // Populated by generator
}
```

### `LinerNotesPost` (public, in liner-notes.json)

```typescript
{
  id: string                    // Same as AnalysisFinding.id
  slug: string                  // URL-safe permalink key
  category: PostCategory
  temporality: PostTemporality
  headline: string
  prose: string
  image: { url, alt, source: "artist"|"venue"|"album"|"placeholder", credit? }
  audio?: { trackName, artistName, albumName, previewUrl, albumArt, streamingUrl, source: "itunes" }
  artists: string[]
  venues: string[]
  years: number[]
  tags: string[]
  deepLinks: { label, url, type: "artist"|"venue"|"timeline" }[]
  relatedSlugs: string[]        // 0–2 related posts by shared artists/venues/tags
  score: number
  detector: string
  publishedAt: string           // ISO timestamp
}
```

### `LinerNotesData` (root of liner-notes.json)

```typescript
{
  generatedAt: string
  dataHash: string              // First 8 chars of SHA256 of concerts.json
  posts: LinerNotesPost[]       // Newest first
  metadata: {
    totalPosts: number
    averageScore: number
    lastPipelineRun: string
    concertsAnalyzed: number
    feedUrl: string
  }
}
```

---

## Image & Audio Resolution

### Image priority chain (`curate.ts → resolveImage`)

1. Detector's `suggestedImage` hint → artist photo, venue photo, or album art
2. Album art from primary artist's top tracks
3. Artist photo from artist metadata
4. Venue photo from venue metadata
5. Placeholder: `/images/liner-notes-placeholder.jpg`

Apple Music album art URLs are upsized from `100x100` to `600x600` automatically.

### Audio resolution (`curate.ts → resolveAudio`)

Uses `suggestedTrack.artistNormalized` if present, otherwise falls back to the primary artist. Returns the first track with a `previewUrl` from that artist's iTunes top tracks data.

---

## Frontend Components

All components live in `src/components/liner-notes/`.

| Component | Route / Role |
| --------- | ------------ |
| `LinerNotesPage.tsx` | `/liner-notes` — blog feed, category filter chips, pagination (10 per page) |
| `LinerNoteCard.tsx` | Individual post card — image, prose, mini player, deep links |
| `LinerNotePermalink.tsx` | `/liner-notes/:slug` — full post view, related posts, JSON-LD structured data |
| `LinerNoteMiniPlayer.tsx` | Inline audio player (iTunes 30s preview) |
| `CategoryFilterChips.tsx` | Pill buttons for All / Cultural / Personal / Deep-Cut |
| `PageNav.tsx` | Shared nav: Archive, Liner Notes, What's Playing, About |

**Category accent colors:**

| Category | Display Label | Accent |
| -------- | ------------- | ------ |
| `cultural` | The Scene | `#1e3a8a` (New Wave blue) |
| `personal` | I Was There | `#5b21b6` (Alternative violet) |
| `deep-cut` | Deep Cuts | `#0e7490` (Teal) |

---

## Performance & Cost

| Step | Typical Duration |
| ---- | ---------------- |
| Analysis (9 detectors, no API) | ~500 ms |
| Scoring | ~50 ms |
| Prose generation (1 post × Claude API) | ~10 seconds |
| **Full run** | **~12 seconds** |

- **API cost:** ~$0.03–0.05 per weekly run (one call; #231 removed the 2–3 generate-then-discard calls)
- **Requires:** `ANTHROPIC_API_KEY` in environment (only needed for generation; `--analyze-only` and `--dry-run` work without it)

---

## Maintenance Notes

### Adding a new Tier 1 detector

1. Add the detector name to `DetectorName` in `scripts/liner-notes/types.ts`
2. Implement `detect{Name}(concerts, metadata): AnalysisFinding[]` in `analyze.ts`
3. Register it in the `analyzeAll()` dispatcher
4. Add a `score{Name}()` case in `score.ts` returning a `ScoreBreakdown`
5. Add category voice guidance to the system prompt in `generate.ts` if needed
6. Update this doc — add a detector section above and remove it from the Tier 2 section

### Promoting a Tier 2 detector to Tier 1

Same steps as above. File a GitHub issue before starting, link it in the Tier 2 section, then remove the entry when shipped and close the issue.

### Updating prose voice rules

Edit `generate.ts → buildSystemPrompt()`. See the `liner-notes-voice` Claude Code skill (`.claude/skills/liner-notes-voice/`) for the full voice brief used during content reviews.

### Running the pipeline manually

See the [Running the Pipeline](#running-the-pipeline) section above for full flag reference and stage-by-stage behavior.

---

## Related Documentation

| Topic | File |
| ----- | ---- |
| Data pipeline (full build-data flow) | [docs/DATA_PIPELINE.md](DATA_PIPELINE.md) |
| URL deep link patterns | [docs/DEEP_LINKING.md](DEEP_LINKING.md) |
| Voice & tone guidelines | `.claude/skills/liner-notes-voice/SKILL.md` |
| Pipeline skill reference | `.claude/skills/liner-notes-pipeline/SKILL.md` |
| Original design spec | [docs/specs/implemented/agentic-liner-notes-v3.md](specs/implemented/agentic-liner-notes-v3.md) |
