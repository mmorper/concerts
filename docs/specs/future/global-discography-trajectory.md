# Discography Trajectory

**Status:** Planned
**Target Version:** v5.4.0
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** None (all source data already shipped in v3.5.0)
**Epic:** [#266](https://github.com/mmorper/concerts/issues/266)

| Spec section | Issue |
| --- | --- |
| Part 1 · §2a.1 — normalizers | [#268](https://github.com/mmorper/concerts/issues/268) |
| Part 2 — hygiene (prerequisite) | [#269](https://github.com/mmorper/concerts/issues/269) |
| Part 3 · Part 7 — `album-eras.json` | [#270](https://github.com/mmorper/concerts/issues/270) |
| Part 4 — MCP | [#271](https://github.com/mmorper/concerts/issues/271) |
| Part 5 — liner notes detectors | [#272](https://github.com/mmorper/concerts/issues/272) |
| §5d — Cover Art Archive images | [#273](https://github.com/mmorper/concerts/issues/273) |
| Parts 6–7 · Phase 4 — voice, deep links, docs | [#274](https://github.com/mmorper/concerts/issues/274) |
| Discovered, out of scope — iTunes artist bug | [#275](https://github.com/mmorper/concerts/issues/275) |

---

## Executive Summary

The archive answers *"what happened."* 184 shows, 257 artists, 79 venues, 40 years, all cross-linked. This feature makes it answer *"what did it mean at the time."*

`discography.json` has been sitting unused since v3.5.0 — 11,359 releases across 260 artists, with release dates and Cover Art Archive covers. On its own it is a commodity: MusicBrainz, Wikipedia and Spotify all have better discographies. The only thing here nobody else has is what happens when it is **joined against 40 years of attendance**.

That join produces **career position** — where an artist stood in their arc on the night they were seen, and, critically, **what had not happened yet**.

**The problem this solves:** every one of the 55 published liner notes posts is narrated by someone who already knows how the story ended. `artist-longevity`, `venue-loyalty`, `drought-comeback` are all *pattern* stories told from now, looking back at a shape. There is no data in the archive today that lets the narrator be **wrong about the future** — and dramatic irony is the oldest engine in narrative nonfiction.

Concretely: Depeche Mode at the Rose Bowl, June 18 1988. *Violator* was 20 months away. Ten more studio albums were still to come. Three of the five Depeche Mode songs still in the top-tracks data come from a record that did not exist that night. Same event, same archive, completely different thing to read.

**How it fits the product:** one derived data file (`album-eras.json`), three consumers — the MCP server, the liner notes pipeline, and (later) an Artist Scene surface. This is the same one-pipeline-many-surfaces shape used for `url-health.ts`, and it is deliberately **not** a discography browser.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Discography Trajectory feature for Morperhaus Concerts.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth
- Ask clarifying questions if anything is ambiguous or needs decision
- Read files proactively to understand existing patterns before writing code

**Feature Overview:**
- Build a shared album-title normalizer that reconciles iTunes album names
  ("Violator (Deluxe)") with MusicBrainz release-group titles ("Violator")
- Derive a new public/data/album-eras.json joining discography.json against
  concerts.json — career position per concert, including what was still ahead
- Fix discography artist-resolution drift (10 headliners currently unmatched,
  1 headliner resolved to the wrong MusicBrainz artist) — PREREQUISITE
- Add a get_career_position MCP tool, enrich two existing MCP tools inline,
  and add an optional cycleBucket filter to search_concerts
- Ship one new liner-notes detector (album-trajectory), unblock one stubbed
  detector (discography-crossref), and repair one existing detector
  (album-context)
- Point the existing SuggestedImage type:"album" path at Cover Art Archive

**Key References:**
- Full Design Spec: docs/specs/future/global-discography-trajectory.md
- Liner notes pipeline: docs/LINER_NOTES_PIPELINE.md
- Liner notes voice: .claude/skills/liner-notes-voice/SKILL.md
- Data pipeline: docs/DATA_PIPELINE.md (Step 8: Discography Enrichment)
- Data schema: .claude/skills/data-schema/SKILL.md
- Deep link grammar: docs/DEEP_LINKING.md
- MCP data registry: workers/mcp-server/src/data.ts
- MCP tool patterns: workers/mcp-server/src/tools.ts

**Implementation Approach:**
- Window 1: Album-title + artist-key normalizers, hygiene fix, album-eras.json
- Window 2: MCP server (new tool + two enriched tools + data registry)
- Window 3: Liner notes (2 new detectors, 2 repairs, scoring, voice rules)
- Window 4: Tests, docs, ROADMAP reconciliation

**Design Philosophy:**
Turn a concert archive into a set of stories where the narrator does not know
the ending. Ship the join, not the catalogue.

**Key Design Details:**
- Normalizer must FAIL CLOSED — an unmatched title is correct behavior
- Forward-looking claims relative to the show date are permanent facts;
  claims about the present are perishable and are out of scope
- album-eras.json carries album IDENTITY (mbid, slug, cover) not just dates,
  so a future discography deep link is a rendering change, not a migration

**Files to Create:**
- scripts/utils/album-title.ts (~120 LOC)
- scripts/utils/artist-key.ts (~60 LOC)
- scripts/derive-album-eras.ts (~260 LOC)
- test/album-title.test.ts (~140 LOC)
- test/artist-key.test.ts (~70 LOC)
- workers/mcp-server/src/career.ts (~180 LOC)

**Files to Modify:**
- scripts/enrich-discography.ts, scripts/build-data.ts, package.json
- public/data/artist-aliases.json (3 new sameAct entries)
- workers/mcp-server/src/{data,tools,types}.ts
- scripts/liner-notes/{analyze,score,curate,image-refs,types}.ts
- scripts/liner-notes/pipeline.ts
- .claude/skills/liner-notes-voice/SKILL.md
- docs/{DATA_PIPELINE,LINER_NOTES_PIPELINE,DEEP_LINKING,ROADMAP}.md

Let's start with Window 1. Should I begin with the album-title normalizer,
since everything downstream depends on its match rate?
```

---

## Design Philosophy

**Conceptual model:** discography is not content. The **join** is the content.

An artist's release list is a commodity available everywhere. What is unique to this archive is the intersection of that list with 184 specific nights — and specifically the *asymmetry* of that intersection. On any given night, some of the artist's catalogue existed and some did not. The part that did not exist yet is the story.

**Three principles that govern every decision below:**

1. **Ship the join, not the catalogue.** No tool, scene, or post enumerates an artist's discography. `discography.json` stays out of the MCP data registry, as [`data.ts:56-57`](../../workers/mcp-server/src/data.ts) already decided. Only the derived file is exposed.

2. **Fail closed.** A title that does not match is left unmatched. See §"Why the matcher must not try harder" — the residual failures are contaminated data, and a more aggressive matcher would manufacture confident falsehoods from them.

3. **Permanent facts only.** Statements about the future *relative to the show date* are true forever: *"Violator was 20 months away"* will never stop being correct. Statements about the present decay: *"they never made another record"* is true until it isn't. Liner notes are permalinked and RSS-syndicated. Only the first kind ships.

---

## Part 1 — Album Title Normalization

This is the enabling work. Everything downstream is gated on it.

### The problem

`artists-top-tracks.json` (iTunes) and `discography.json` (MusicBrainz) name the same album differently:

| iTunes | MusicBrainz |
| --- | --- |
| `Violator (Deluxe)` | `Violator` |
| `Speak and Spell (Deluxe)` | `Speak & Spell` |
| `Garbage (20th Anniversary Edition) [2015 Remaster]` | `Garbage` |
| `Echo & the Bunnymen (Bonus Tracks Edition) [2004 Remaster]` | `Echo & the Bunnymen` |
| `Honky Château (Bonus Track Version)` | `Honky Château` |
| `Songs From the Big Chair (Super Deluxe Edition)` | `Songs From the Big Chair` |

866 distinct album names appear in the top-tracks corpus; 183 carry a parenthetical or bracketed qualifier. A naive lowercase comparison matches 58.1% of eligible names.

### The normalizer

Create **`scripts/utils/album-title.ts`**. This module is shared — it serves this feature *and* the future setlist-song→album attribution work, which is the main reason it is a standalone util rather than a private helper.

```ts
/**
 * Album title normalization.
 *
 * Reconciles iTunes album names (artists-top-tracks.json) with MusicBrainz
 * release-group titles (discography.json). Shared with any future
 * song → album attribution work; keep it free of caller-specific logic.
 *
 * Design constraint: FAIL CLOSED. Returning null is a valid, common, and
 * correct outcome. See docs/specs/future/global-discography-trajectory.md
 * §"Why the matcher must not try harder".
 */

/** Qualifier words that mark a parenthetical as an edition marker, not part of the title. */
const EDITION_RE = new RegExp(
  '\\b(' + [
    'deluxe', 'expanded', 'remaster(?:ed)?', 're-?master(?:ed)?', 'anniversary',
    'edition', 'bonus\\s+track(?:s)?', 'bonus', 'special', "collector'?s?",
    'collectors', 'reissue', 'version', 'explicit', 'clean', 'mono', 'stereo',
    'remix(?:es|ed)?', 'extended', 'legacy', 'definitive', 'complete', 'super',
    'platinum', 'gold', 'digital', 'japanese', 'international', 'us', 'uk',
    '\\d{4}\\s+remaster', '\\d+(?:st|nd|rd|th)',
  ].join('|') + ')\\b',
  'i',
);

const FEAT_RE = /\s*[\(\[]\s*(feat|featuring|with)\.?\s[^\)\]]*[\)\]]/gi;
const TRAILING_KIND_RE = /\s*[-–—]\s*(single|ep|maxi[- ]single)\s*$/i;

/** Unicode folding: diacritics, curly quotes, en/em dashes. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-');
}

/**
 * Strip ONLY parentheticals whose contents look like an edition marker.
 *
 * Blanket-stripping every parenthetical is wrong: "(What's the Story) Morning
 * Glory?" and "Duran Duran (The Wedding Album)" carry title-bearing groups.
 * Loops up to 4x because titles stack qualifiers:
 * "Hello Nasty (Deluxe Version) [Remastered]".
 */
export function stripQualifiers(title: string): string {
  let out = fold(title).replace(FEAT_RE, '');
  for (let i = 0; i < 4; i++) {
    const next = out.replace(/\s*[\(\[]([^\)\]]*)[\)\]]\s*$/, (m, inner: string) =>
      EDITION_RE.test(inner) ? ' ' : m,
    );
    if (next === out) break;
    out = next;
  }
  // Hyphen form: "Rio - Deluxe Edition", "Faith - 2010 Remaster"
  out = out.replace(/\s*[-–—]\s*[^-–—]*$/, (m) => (EDITION_RE.test(m) ? '' : m));
  return out.trim();
}

/** Canonical comparison key. Applied to BOTH sides of every comparison. */
export function normalizeAlbumTitle(title: string): string {
  if (!title) return '';
  return stripQualifiers(title)
    .replace(TRAILING_KIND_RE, '')
    .toLowerCase()
    .replace(/'/g, '')          // "what's" -> "whats", not "what s"
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*\+\s*/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function dropLeadingArticle(s: string): string {
  return s.replace(/^(the|a|an)\s+/, '');
}

/** iTunes marks non-album releases with a trailing " - Single" / " - EP". */
export function isSingleOrEp(title: string): boolean {
  return TRAILING_KIND_RE.test(fold(title));
}
```

### The tiered matcher

Also in `album-title.ts`. Tiers are attempted in order and **stop at the first hit**:

| Tier | Rule | Rationale |
| --- | --- | --- |
| 1 · `exact` | Normalized keys are equal | 751 of 753 matches |
| 2 · `article` | Equal after dropping a leading `the`/`a`/`an` | iTunes and MB disagree on leading articles |

**A third `prefix` tier was implemented, measured, and removed** — see §"Why the matcher must not try harder".

Singles and EPs are excluded before matching (`isSingleOrEp`). The matcher returns `{ album, tier }` so the tier can be recorded in the output and audited later.

### Measured impact

Run against live data (`public/data/` as of 2026-08-07), 1,285 total track album names:

| | Names | % of eligible |
| --- | --- | --- |
| Artist has no discography entry | 160 | — (excluded from denominator) |
| Single/EP, correctly excluded | 101 | — (excluded from denominator) |
| **Eligible for matching** | **1,024** | **100%** |
| Matched — lowercase exact (baseline) | 595 | 58.1% |
| **Matched — normalizer + tiered matcher** | **753** | **73.5%** |
| Unmatched — compilations / greatest hits / live | 60 | 5.9% (correct miss — no studio release-group exists) |
| Unmatched — residual | 211 | 20.6% (see below) |

**Net: +158 matched names, +15.4 percentage points.** Downstream, artists with an identifiable defining album rise from **106 → 129 (+22%)**.

**Acceptance criterion: ≥ 73% of eligible names must match, with zero regressions in the fixture set.**

> **Why 73% and not 74%.** An earlier draft of this spec set the bar at 74.8%, measured with a `prefix` tier that was subsequently removed during implementation after inspection showed most of its matches were wrong (see below). The bar was lowered to match reality rather than the tier being retained to hit a number.

### Why the matcher must not try harder

The residual 198 are **not** a normalization problem. Sampling them shows the dominant cause is *artist* mis-resolution upstream in the iTunes enrichment:

```
abc            :: Nursery Rhymes
abc            :: Start Singing with Barney
bad-religion   :: channel ORANGE          <- Frank Ocean
common-sense   :: Schmilco                <- Wilco
chris-shiflett :: The Colour And The Shape <- Foo Fighters
```

A fuzzier matcher (token-set similarity, edit distance) would start binding `channel ORANGE` to *something* in Bad Religion's 100-release list and emit a confident, fabricated claim into a first-person post. **The correct behavior on contaminated input is to produce nothing.**

This is worth stating explicitly because it will look like an obvious improvement to a future implementer: do not add a Levenshtein tier. If match rate needs to rise, fix the source data.

### The prefix tier: implemented, measured, removed

The original design included a guarded `prefix` tier (both keys ≥ 6 chars, shorter ≥ 60% of longer). Implementation measured it against live data: **13 of 766 matches, 1.7%** — and inspection showed the majority were wrong, in the most dangerous direction available:

```
"Replicas (1998 Remaster)"   ->  "Replicas Live"     studio album -> LIVE album
"The Bronx (I)/(III)/(IV)"   ->  "The Bronx"         3 distinct albums collapsed into 1
"Peter Gabriel 1: Car"       ->  "Peter Gabriel"     first four are all self-titled
"Under the Influences"       ->  "Under the Influences, Volume 1"
```

Self-titled and numbered releases make substring similarity **actively misleading** rather than merely imprecise, and every one of those errors would have become a confident sentence in a first-person liner note. 1.3 percentage points of match rate is not worth a fabricated memory.

The tier is gone and the negative cases are locked into `test/utils/album-title.test.ts` so it cannot quietly return.

> **Discovered issue — out of scope, file separately.** iTunes top-track *artist* resolution is wrong for at least ABC, Bad Religion, Common Sense, and Chris Shiflett. This is a pre-existing `scripts/enrich-top-tracks.ts` bug that this feature merely makes visible. Open a GitHub issue referencing this section; do **not** fix it inside this feature.

---

## Part 2 — Data Hygiene (PREREQUISITE)

**This is a prerequisite, not a cleanup task, and it must land before any consumer is wired up.**

In an MCP tool response a bad join is a shrug. In a permalinked, RSS-syndicated, first-person liner note it is a fabricated memory published under the archive owner's byline. That difference is what promotes this from "should do" to "blocking."

### 2a. Artist key drift — 10 headliners with no discography entry

These headliners appear in `concerts.json` but resolve to no `discography.json` record. **Diagnosed: this is not missing data.** In every case except one the discography record exists — the *keys* disagree, because `discography.json` is keyed off the `artists-metadata.json` display name while lookups arrive as `concerts.json`'s `headlinerNormalized`:

| Concert key | Display name | Discography key | Defect |
| --- | --- | --- | --- |
| `echo-and-the-bunnymen` | Echo & The Bunnymen | `echo-the-bunnymen` | `&` dropped, not folded to `and` |
| `run-dmc` | Run-D.M.C. | `run-d-m-c` | periods expanded to separators |
| `tone-loc` | Tone-Lōc | `tone-l-c` | **diacritic deleted instead of folded** |
| `beach-boys` | The Beach Boys | `the-beach-boys` | leading article |
| `the-art-of-noise` | Art of Noise | `art-of-noise` | leading article |
| `peter-hook-and-the-light` | Peter Hook & The Light | `peter-hook-the-light` | `&` dropped |
| `yaz` | Yaz | `yazoo` | US/UK release name — **editorial** |
| `the-english-beat` | The English Beat | `the-beat` | US/UK release name — **editorial** |
| `brian-setzer-68-comeback-special` | Brian Setzer '68 Comeback Special | `brian-setzer` | billing — **already in `artist-aliases.json`** |
| `brian-setzer-and-the-nashvillians` | Brian Setzer and the Nashvillians | `brian-setzer` | billing — **already in `artist-aliases.json`** |

Additionally `omd` exists as a key with **0 albums**, while the real discography sits under `orchestral-manoeuvres-in-the-dark`.

**Measured:** a stronger matching-only fold (diacritic folding, `&`→`and`, period elision, article-insensitivity) resolves **6 of 10 mechanically**. The 4 residuals require human knowledge, and 2 of those are already modelled in `artist-aliases.json`.

**Resolution — three parts, in order:**

1. **Create `scripts/utils/artist-key.ts`** — a matching-only fold, deliberately mirroring `album-title.ts` in both shape and philosophy. Build an index of `foldArtistName(record.artistName) → discographyKey` and look up `foldArtistName(concert.headliner)`. Normalize **both sides**; never compare a stored slug against a folded one.

   > ⚠️ **Do NOT modify `src/utils/normalize.ts`.** It generates the canonical slugs that appear in published deep links, the RSS feed, indexed URLs, and every liner note's persisted `deepLinks` array. Changing it silently breaks live URLs. The stored slug stays exactly as it is; only *comparison* gets smarter. This is the same "normalize both sides, mutate neither" discipline `album-title.ts` follows.

2. **Add a `discographyKeys` relation to `artist-aliases.json`** — Yaz→Yazoo, The English Beat→The Beat, OMD→Orchestral Manoeuvres in the Dark.

   > **Corrected during implementation.** This spec originally said to add these as `sameAct` entries. That is wrong, and `test/pipeline/liner-notes-artist-aliases.test.ts` catches it: an existing invariant asserts **every `sameAct` billing appears on a real bill**. `sameAct` means *marquees this act played under* — nobody ever saw a "Yazoo" or "The Beat" marquee in this archive. Putting them there would have overloaded the relation exactly the way §3 warns against overloading an override map.
   >
   > `discographyKeys` is a separate, purpose-named relation in the same hand-maintained file: *where this act's discography is filed*, which is a different question from *what the poster said*. Source of truth is `data/artist-aliases.json`, published via `scripts/sync-artist-aliases.ts`.

   The two Setzer billings still resolve through `sameAct` for free.

3. **No new override file.** An earlier draft of this spec proposed `public/data/discography-overrides.json`. The diagnosis above retires that idea: 6 cases are a normalizer defect, 5 are act-identity questions `artist-aliases.json` was built for, and the sole remaining item (§2b) is an enrichment input rather than a lookup concern. A general-purpose override map would have absorbed all three classes and hidden the actual bug.

### 2b. Wrong-artist MBID — `the-go-go-s`

`the-go-go-s` is bound to an MBID with a **single** release: *Swim With The Go-Go's* (1964) — an unrelated 1960s act. This produced the worst outlier in analysis, a fictitious 47-year gap, on a marquee artist.

**Resolution:** a narrow `MBID_CORRECTIONS` constant inside `enrich-discography.ts` (currently one entry), then re-run `enrich:discography --force` for that artist. This is an *enrichment input* — which MusicBrainz artist to fetch — not a lookup concern, so it belongs next to the fetch rather than in a data file.

### 2c. Coverage floor validation

19 artists have ≤ 2 releases; several have 0. Add a check to `scripts/validate-concerts.ts`:

- **WARN** when a *headliner* has < 3 releases in `discography.json` (probable mis-resolution)
- **FAIL** when a headliner resolves to no discography entry via `artist-key.ts` **and** no `artist-aliases.json` entry

This makes the drift in §2a self-reporting rather than something rediscovered in a year.

### 2d. Known truncation

`enrich-discography.ts` caps at 100 releases per artist. Singles are 34% of the corpus (3,887 of 11,359), so the cap can in principle push older studio albums out of range for prolific artists. Spot-checked as currently safe — The Beach Boys retain studio albums from 1962 through 2012 — but the derivation must **sort studio albums by release date and not assume the array is complete**. Record `truncated: true` on any artist at exactly 100 releases so downstream consumers can suppress "first album" / "last album" claims for them.

---

## Part 3 — The Derived File: `album-eras.json`

### Design rationale: vector, not scalar

An earlier draft of this design was backward-looking — nearest preceding album, days since release. A scalar. That is sufficient for *"what were they touring?"* and insufficient for everything interesting.

Career trajectory requires each concert to know its position **along** the whole arc, including what came after. That is a vector, and retrofitting it later would mean regenerating published posts.

### Identity fields and why they ship now

`mbid`, `albumSlug` and `coverUrl` are carried even though **nothing renders an album deep link in v5.4.0**. The reason is structural, not speculative:

Published liner notes are frozen into `liner-notes.json` at generation time — prose, `image`, `audio`, and `deepLinks` all persist as written. If album identity is absent when a post is generated, back-filling links in a later release requires either regenerating posts (new prose, new slugs, broken permalinks) or string-matching album names out of finished prose. Both are bad. Carrying three fields now makes the future discography surface a **rendering change instead of a migration**.

"Ten albums still to come" is a list of ten future deep-link targets and ten covers. Persist their identity.

### Schema

**Location:** `public/data/album-eras.json`

```jsonc
{
  "version": "1.0.0",
  "generatedAt": "2026-08-07T00:00:00.000Z",
  "concerts": {
    "concert-42": {
      "concertId": "concert-42",
      "artistKey": "depeche-mode",       // post-alias-resolution discography key
      "date": "1988-06-18",

      // ---- Backward-looking: the album cycle in progress ----
      "currentAlbum": {
        "mbid": "…", "title": "Music for the Masses",
        "releaseDate": "1987-09-28", "coverAvailable": true
      },
      "daysSinceRelease": 264,
      "cycleBucket": "fresh",            // fresh <90d | current <1y | mature <3y | deep <10y | catalog 10y+

      // ---- Forward-looking: the trajectory payload ----
      // albumsBefore doubles as the slice index into artists[].studioAlbums:
      //   albumsAhead === artists[artistKey].studioAlbums.slice(albumsBefore)
      "albumsBefore": 6,
      "albumsAfter": 9,

      // ---- Career position ----
      "careerYear": 8.2,                 // years since debut studio album at show date
      "careerPercentile": 0.33,          // position across the artist's full release span
      "isDebutEra": false,               // within 24 months of the debut album

      // ---- Defining album (see §"The defining-album signal") ----
      "definingAlbum": {
        "mbid": "…", "title": "Violator", "releaseDate": "1990-02-05",
        "coverAvailable": true,
        "topTrackCount": 3, "topTrackTotal": 5, "matchTier": "exact"
      },
      "definingAlbumAhead": true,
      "definingAlbumMonthsAway": 20
    }
  },
  "artists": {
    "depeche-mode": {
      "artistKey": "depeche-mode",
      "displayName": "Depeche Mode",
      "studioAlbumCount": 15,
      // The artist's whole spine, stored ONCE. A concert's "still to come" is a
      // slice of this, not a copy — see albumsBefore above.
      "studioAlbums": [ { "mbid": "…", "title": "Speak & Spell", "releaseDate": "1981-10-05", "coverAvailable": true } ],
      "debutAlbum": { "mbid": "…", "title": "Speak & Spell", "releaseDate": "1981-10-05", "coverAvailable": true },
      "latestAlbum": { "mbid": "…", "title": "Memento Mori", "releaseDate": "2023-03-24", "coverAvailable": true },
      "definingAlbum": { "mbid": "…", "title": "Violator", "topTrackCount": 3, "topTrackTotal": 5 },
      "truncated": false,
      "erasSeen": [                      // distinct album cycles across all shows — feeds discography-crossref
        { "albumSlug": "some-great-reward", "title": "Some Great Reward", "showCount": 1, "dates": ["1985-03-31"] }
      ]
    }
  },
  "stats": {
    "concertsWithEra": 161,
    "medianDaysSinceRelease": 372,
    "matchRate": 0.748,
    "artistsWithDefiningAlbum": 129
  }
}
```

### Derivation rules

**"Studio album"** = `primaryType === "Album"` **and** `secondaryTypes` empty. This deliberately excludes live albums, compilations, soundtracks and remix collections — 1,832 compilations and 1,381 live albums would otherwise wreck every era calculation.

**`currentAlbum`** = latest studio album with `releaseDate <= concert.date`. Undefined when the show predates the artist's debut (4 concerts).

**`definingAlbum`** = the studio album carrying a **plurality of the artist's iTunes top tracks**, requiring **≥ 2 tracks** on the same album. Never assert this when `topTrackCount < 2`.

**`careerPercentile`** = `(concertDate − debutDate) / (latestRelease − debutDate)`, clamped to `[0,1]`.

**`erasSeen`** is only populated for artists with ≥ 2 shows and ≥ 2 studio albums.

### The defining-album signal

MusicBrainz has no notion of which album matters. iTunes top tracks supply an implicit one: **which album do an artist's most-streamed songs cluster on?** For Depeche Mode, 3 of 5 top tracks are *Violator*.

This is a proxy for **enduring popularity**, not critical canon — and that framing is not a hedge, it is the better story. *"The record most of what I still play came from"* is a grounded statement about the listener. *"Their masterpiece"* is a critical judgment the corpus cannot support. See §Part 6 for the voice rule that enforces this.

Always persist `topTrackCount`/`topTrackTotal` so prose can **cite the evidence rather than assert the conclusion**.

### Size budget

**Hard budget: 400 KB**, enforced by the derivation script (exits non-zero over budget). Actual: **302 KB**.

> **Corrected during implementation.** The spec originally said 250 KB, chosen without checking precedent. The MCP already lazy-loads `venues-metadata.json` (963 KB), `setlists-cache.json` (831 KB) and `artists-top-tracks.json` (746 KB) — the original figure was ~4x stricter than anything shipping.
>
> The budget was raised on that evidence, **not** to accommodate bloat. Every redundancy the tighter budget exposed stayed removed, taking the file from 534 KB → 302 KB: derived cover URLs (−130 KB), derived album slugs, per-concert album copies replaced by a normalized per-artist spine, and pretty-printing (this file is machine-read, never hand-edited).

### Pipeline integration

New script **`scripts/derive-album-eras.ts`**, wired into `scripts/build-data.ts` as **Step 9.5** — after discography enrichment (Step 8) and top-tracks enrichment, before liner notes generation. Add `npm run derive:album-eras` with `--dry-run` support, following the `enrich-discography.ts` conventions (backup via `scripts/utils/backup.ts`, summary stats to stdout).

Add `--skip-album-eras` to the `build-data.ts` flag set for parity with `--skip-discography`.

---

## Part 4 — MCP Server Outcomes

### Expected outcomes

A connector user can ask **where in an artist's arc a show sat**, and receives a grounded answer instead of a date and a venue.

| Question | Today | After |
| --- | --- | --- |
| *"Where were The Cure in their career when he saw them?"* | Date + venue + setlist | 14.6 years past *4:13 Dream*; a deep-catalog night, not a promotional one |
| *"Did he ever catch a band before they broke?"* | Not answerable | No Doubt at Disneyland, March 1988 — *Tragic Kingdom* 7½ years out, 8 albums to come |
| *"What was Depeche Mode touring at the Rose Bowl?"* | Not answerable | *Music for the Masses*, 264 days old — and *Violator* still 20 months away |

### 4a. New tool: `get_career_position`

```ts
server.registerTool(
  "get_career_position",
  {
    title: "Career position",
    description: DESC.careerPosition,
    inputSchema: {
      artist: z.string(),
      date: z.string().optional(),      // omit -> most recent show for that artist
    },
  },
  instrument(env, "get_career_position", async (args) => { /* … */ }),
);
```

**Response shape** — prose, following the existing house style in `tools.ts` (`artistHistory`, `concertSetlist`). Not JSON.

```
Depeche Mode — The Rose Bowl, June 18 1988

They were 264 days into the Music for the Masses cycle, eight years past
Speak & Spell, with five studio albums behind them.

Violator was still 20 months away. Ten more studio albums would follow.

Open on the site: [Depeche Mode](…) · [The Rose Bowl](…)
```

Rules:
- Omit the trajectory paragraph entirely when `albumsAfter === 0` — do **not** write "and nothing came after," which is a perishable claim (§Part 6).
- Suppress "first album" / "last album" phrasing when `artists[key].truncated` is true.
- Preserve the existing "Open on the site" link footer — `linkFooter()` in `tools.ts`.

### 4b. Enrich two existing tools inline

The best MCP work here is invisible: existing answers get better with no new tool names and no new token cost.

- **`get_concert_setlist`** — add one era line beneath the header: `Touring Music for the Masses (released 264 days earlier).`
- **`get_artist_history`** — when the artist has ≥ 2 eras, add a single line naming them: `Seen across 5 album cycles: Some Great Reward, Music for the Masses, Violator, Playing the Angel, Memento Mori.`

Both are **one line each**. If the data is missing, emit nothing — never a placeholder.

### 4c. Cycle-bucket filter on `search_concerts`

An **optional parameter on the existing tool**, not a fourth tool. This is the search question the derived file makes newly answerable, and it costs one enum:

```ts
inputSchema: {
  // …existing params unchanged…
  cycleBucket: z.enum(["fresh", "current", "mature", "deep", "catalog"]).optional(),
}
```

| Bucket | Definition | Supply |
| --- | --- | --- |
| `fresh` | < 90 days since the album | 25 |
| `current` | 90 days – 1 year | 52 |
| `mature` | 1 – 3 years | 51 |
| `deep` | 3 – 10 years | 22 |
| `catalog` | 10 years+ | 11 |

Answers *"which shows did I catch on a brand-new record?"* and its opposite. Rules:

- The parameter is **additive** — it composes with existing filters (artist, venue, year) rather than replacing them.
- Concerts with no era data are excluded when the filter is present, and the response says so plainly (`"23 shows have no album-cycle data and were not considered."`) — never a silent drop.
- When `album-eras.json` is unavailable, the parameter is ignored and the tool behaves exactly as today.

### 4d. Data registry

In `workers/mcp-server/src/data.ts`:

- Add `album-eras.json` to **`LAZY_FILES`** with a `getAlbumEras()` helper following the existing `cachedJsonFetch` pattern.
- **Do not** add `discography.json`. Update the `SKIP` comment at line 56 to record *why* — the raw file remains inappropriate for a text MCP; the derived join is what ships.
- Add the `AlbumEras` interface to `types.ts`.

`get_concert_setlist` is a hot path — confirm the added lazy fetch is covered by the existing `prefetchLazyFiles` background warm so first-call latency does not regress.

---

## Part 5 — Liner Notes Outcomes

### Expected outcomes

Readers get posts with genuine narrative tension — the narrator in the seat does not know what the reader knows.

> *I sat in the Rose Bowl in June 1988 watching a band that hadn't yet made the record I'd play most. Violator was 20 months away, and ten more albums after that. Three of the five Depeche Mode songs I still reach for come from an album that didn't exist that night. I thought I was seeing the peak. I was seeing the runway.*

### 5a. NEW detector — `album-trajectory` (Cultural)

**What it finds:** shows where the artist's defining album had not been released yet.

**Trigger:** `definingAlbumAhead === true` and `definingAlbumMonthsAway >= 3` and `topTrackCount >= 2`.

**Supply on current data: 8 findings.**

| Months out | Show | Defining album | Still to come |
| --- | --- | --- | --- |
| 209 | Ziggy Marley, Mesa Amphitheatre, 1988-09-19 | *Love Is My Religion* | 9 albums |
| 91 | No Doubt, Disneyland, 1988-03-04 | *Tragic Kingdom* | 8 albums |
| 58 | Depeche Mode, Irvine Meadows, 1985-03-31 | *Violator* | 12 albums |
| 39 | Brian Setzer Orchestra, Hard Rock Cafe, 1995-03-26 | *The Dirty Boogie* (5/5) | 10 albums |
| 20 | Depeche Mode, The Rose Bowl, 1988-06-18 | *Violator* | 10 albums |
| 8 | Stryper, Knott's Berry Farm, 1985-05-17 | *To Hell With the Devil* | 16 albums |
| 5 | Jesus Jones, Hollywood Palladium, 1990-08-09 | *Doubt* | 5 albums |
| 4 | Bat Fangs, The Anthem, 2017-10-08 | *Bat Fangs* | 2 albums |

**Data points:** artist, venue, city, date; `definingAlbumTitle`, `definingAlbumReleaseDate`, `monthsAway`, `topTrackCount`, `topTrackTotal`, `albumsAfter`, `currentAlbumTitle`.

**`concertDate`:** set — each finding is about one night, so posts carry a `?show=` setlist deep link.

**`suggestedImage`:** `{ type: "album", artistNormalized, albumName: definingAlbumTitle }` — the record that didn't exist yet is the right image.

**Scoring:** `span` from `monthsAway` (2 pts > 6mo, 4 pts > 12mo, 7 pts > 36mo, 10 pts > 60mo). `surpriseFactor` = **10** — this is the highest-tension finding the pipeline can produce.

**Auto-tags:** `#album-trajectory`, `#before-the-breakthrough`.

### 5b. UNBLOCK stubbed detector — `discography-crossref` (Cultural)

> **The documented blocker is stale.** `LINER_NOTES_PIPELINE.md` §"Planned Detectors (Tier 2)" says this is deferred because it *"requires structured album release date data (album → release year) per artist, which isn't currently in `artists-metadata.json`."* That data shipped in **v3.5.0** — into `discography.json` rather than `artists-metadata.json` — and the deferral note was never updated. It has been unblocked for two minor versions.

**What it finds:** artists seen across 2+ distinct album cycles. Reads `artists[key].erasSeen`.

**Supply: 28 artists** (10 with ≥ 3 eras, 5 with ≥ 4).

| Eras / shows | Artist | Cycles |
| --- | --- | --- |
| 6 / 6 | Howard Jones | Dream Into Action, Cross That Line, Revolution of the Heart, Ordinary Heroes, … |
| 5 / 5 | Depeche Mode | Some Great Reward, Music for the Masses, Violator, Playing the Angel, … |
| 4 / 4 | Tears For Fears | Songs From the Big Chair, Elemental, Everybody Loves a Happy Ending, The Tipping Point |
| 4 / 4 | Brian Setzer Orchestra | The BSO, The Dirty Boogie, Boogie Woogie Christmas, Rockin' Rudolph |
| 3 / 8 | Social Distortion | Social Distortion, Sex Love and Rock 'n' Roll, Hard Times and Nursery Rhymes |

**The angle is the comedy of timing, not the fact of longevity** — otherwise this collides with `artist-longevity`. Headline pattern: *"Six Shows, Six Records"*, not *"Howard Jones: 40 Years."*

**Scoring:** `span` from era count (4 pts ≥ 2, 7 pts ≥ 3, 10 pts ≥ 4). `surpriseFactor` = 7.

**Auto-tags:** `#discography-crossref`, `#album-eras`.

### 5c. REPAIR existing detector — `album-context`

**Keep the 31 hardcoded `LANDMARK_ALBUMS`.** The corpus supplies dates and covers; it cannot supply *"trip-hop's founding document."* Those `significance` strings are editorial and stay hand-written.

What is repaired is the **weak fallback**. When no same-artist match exists, [`analyze.ts:1210`](../../scripts/liner-notes/analyze.ts) grabs the chronologically closest concert, and the generator visibly strains to justify it — from a published post:

> *"…across town, Kanye was putting finishing touches on an album that would blend hip-hop with string arrangements in ways that echoed Garbage's own genre-blending DNA…"*

**Measured, and it is worse than it looks.** Across the 31 landmark albums at the current 42-day window, the detector produces **17 findings — of which 0 are same-artist.** The `byArtist` preference branch at [`analyze.ts:1207`](../../scripts/liner-notes/analyze.ts) has never once fired. Every album-context post ever published is a cross-artist coincidence, which is exactly why the prose strains.

| Window | Same-artist | Cross-artist | Total |
| --- | --- | --- | --- |
| 42 days (current) | 0 | 17 | 17 |
| **21 days (proposed)** | 0 | **11** | **11** |
| 14 days | 0 | 9 | 9 |

**Changes:**

1. When `album-eras` shows the *concert's own artist* released a studio album within `ALBUM_WINDOW_DAYS`, emit that as a finding with `isSameArtist: true`. This is where the detector finally gets real supply: **25 shows sit under 90 days of a new record** (Stryper 2 days, Snarky Puppy 3, Depeche Mode 4, Black Keys 8).
2. Tighten the cross-artist fallback to `daysApart <= 21`. This costs 6 of 17 findings — **and that trade is clearly correct**, because the detector simultaneously gains 25 same-artist findings from a genuinely stronger join. Net supply roughly doubles while the weakest third of the old supply is retired.
3. Split `surpriseFactor`: **9** for `isSameArtist`, **5** for cross-artist (down from 6). Selection publishes each detector's highest-scoring finding, so this guarantees a real same-artist join outranks a coincidence whenever both are available — the window bar removes the worst, the score demotes the rest.
4. Fix the `slugify(album.artist)` comparison at line 1208 to resolve through the alias map, consistent with `full-circle` and `guest-bridge` (#227).

### 5d. REPAIR image resolution — Cover Art Archive

`SuggestedImage.type: "album"` already exists in [`types.ts:41`](../../scripts/liner-notes/types.ts) and resolves in [`curate.ts:354`](../../scripts/liner-notes/curate.ts) — but only from **iTunes top-track art**, which is why published posts carry covers labeled *"Garbage (20th Anniversary Edition) [2015 Remaster]"*. A wired socket with nothing good plugged into it.

**Change `getAlbumArt()` in `image-refs.ts` to a fallback chain:**

1. `album-eras` cover for the named album where `coverAvailable === true` (Cover Art Archive, 500px) ← **new, preferred**
2. iTunes top-track `albumArt` matched via `normalizeAlbumTitle` ← existing, now normalization-aware
3. Any iTunes `albumArt` for the artist ← existing fallback

This improves posts already being written, independent of the new detectors. It is the cheapest win in the feature.

### 5e. Detector NOT to build — "never released another album"

The mirror image of `album-trajectory` returns 5 findings (The Tubes, The Roots, Blondie, Brian Setzer Orchestra, The Human League). **Do not implement it.**

The Roots and Blondie are active bands. *"Nothing since Pollinator"* is true today and becomes a permanent falsehood the moment they release a record — frozen into a permalinked, syndicated post. This is the §"Permanent facts only" principle in its sharpest form, and it is recorded here so it is not rediscovered as a good idea in six months.

### 5f. Concentration risk — ship ONE new detector first

Published posts already skew hard: **Howard Jones 4, Tears For Fears 3, Brian Setzer Orchestra 3, Social Distortion 3** of 55. Those are precisely the top of the `discography-crossref` supply list. Two new detectors would deepen the same well and fight rotation.

**Ship `album-trajectory` first** — 8 findings, and its supply (Ziggy Marley, No Doubt, Stryper, Jesus Jones, Bat Fangs) barely overlaps the over-covered set. Hold `discography-crossref` for a subsequent run and observe rotation behavior before enabling it.

This ordering is deliberate and inverts the safer engineering choice: `discography-crossref` has 3.5× the supply and is the simpler build. The feed's constraint is **distinctiveness, not volume** — eight excellent posts beat twenty-eight competent ones.

**Enablement is scheduled into v5.5** (see [`global-setlist-album-attribution.md`](global-setlist-album-attribution.md)). The reason is decision quality, not diversification: v5.5 adds two further detectors, so enabling `discography-crossref` alongside them means making **one** rotation judgement with the full detector pool visible, instead of two judgements on partial information. Ship it disabled here, run at least two publication cycles of `album-trajectory`, then enable during the v5.5 rollout.

Be honest about what v5.5 does and does not fix: `road-tested` will draw on a different artist set (fresh-cycle shows), but `most-witnessed-album` favours repeat artists and therefore lands back on Social Distortion and Depeche Mode. If concentration is still biting at that point, the correct lever is a **per-artist cap in selection** (`curate.ts`), not indefinitely withholding detectors. That change is explicitly out of scope for both releases and should be raised on its own merits.

### 5g. Pipeline plumbing

[`pipeline.ts:112`](../../scripts/liner-notes/pipeline.ts) already passes a source bag into `analyze()`. Add one key:

```ts
const { findings, stats } = analyze(concerts, today, {
  venuesMetadata, artistsMetadata, setlists, aliases,
  albumEras,   // <- new
});
```

Load it in the same `readFileSync` block as the other sources, and **degrade gracefully** — if `album-eras.json` is absent, the three discography detectors return `[]` and every existing detector behaves exactly as before.

### 5h. Scoring

In `score.ts`:
- Add `computeSpan` cases for `album-trajectory` and `discography-crossref` (thresholds in §5a/§5b).
- Add `surpriseFactor` constants: `album-trajectory` = 10, `discography-crossref` = 7.
- Add **+1 `dataRichness`** when a finding resolves a Cover Art Archive image, mirroring the `hasSongJoin` precedent (#229) — findings that will render with a real album cover should outrank ones that fall back to a press photo.

---

## Part 6 — Voice Rules

Update `.claude/skills/liner-notes-voice/SKILL.md`. The prose rules and the schema now depend on each other, so these ship together.

### 6a. Tier promotion — release dates become Tier 1

The skill currently lists **"Specific dates not in the dataset"** as Tier 3, with *"released March 19, 1990"* as the banned example. Once `album-eras.json` ships, that date **is** in the dataset. Move album release dates and album titles from Tier 3 to **Tier 1** — *for albums present in the derived file only*.

### 6b. New Tier 1 form — the defining-album citation

Add explicitly, because it is a shape the tiers do not currently cover:

```
✅ "Three of the five Depeche Mode songs I still reach for come from an
    album that didn't exist that night"
   (Tier 1 — grounded in topTrackCount/topTrackTotal; a statement about MY
    listening, not a chart position or a critical verdict)

❌ "Violator was their masterpiece"
   (Critical judgment — the corpus cannot support it)

❌ "Violator was their best-selling record"
   (Tier 3 — sales figures, unchanged)
```

### 6c. New banned category — perishable claims

Add to the Anti-Patterns table:

| Banned | Why |
| --- | --- |
| "they never made another record" | Perishable — true until it isn't, and posts are permanent |
| "their last album" | Same, unless phrased against a stated horizon |
| "the peak of their career" | Unfalsifiable and unsupported by the data |

Add to the Validation Checklist: **"No claim that could become false without the post changing."**

### 6d. Generator prompt

In `generate.ts`, the ALLOWED-WITH-CARE block currently permits *"major album release years for well-known artists"* framed as approximate memory. When a finding carries `album-eras` data, those dates are now **exact and sourced** — instruct the generator to state them plainly rather than hedging with *"around the time."* Hedging on data we actually have reads as vagueness, not humility.

---

## Part 7 — Deep Links: Forward Compatibility

**Nothing in v5.4.0 renders a discography deep link.** This section exists so that when one is added, no data migration is required.

### Work to do now

1. **Reserve the grammar.** Document in `docs/DEEP_LINKING.md` (bump to v1.3) as *reserved, not yet emitted*:
   ```
   /?scene=artists&artist=depeche-mode&album=violator
   ```
   `albumSlug` in `album-eras.json` is generated to satisfy this grammar. Add the pattern to `src/utils/deepLinks.ts` as a builder with a doc comment marking it unused, so a future implementer does not hand-build the URL — per the CLAUDE.md convention that deep links are never hand-built.

2. **Persist identity in findings.** `album-trajectory` and `discography-crossref` findings must carry `mbid` and `albumSlug` in `dataPoints` for every album they name — including each entry of `albumsAhead`. These are inert in v5.4.0 and are the entire reason a future release is a rendering change.

3. **Do not emit album entries in `deepLinks[]` yet.** A link to a route that does not exist is a broken link. `buildDeepLinks` stays untouched.

### Explicitly deferred

- Album deep-link rendering in liner note posts
- Any Artist Scene discography surface
- Album-level routing in `src/utils/deepLinks.ts` beyond the unused builder

### A note on the parked spec

[`docs/specs/future/artists-discography.md`](artists-discography.md) proposes an album-cover grid in the Artist Scene gatefold (#5). **It remains parked, and it is not the surface this data argues for.** A cover grid is a Wikipedia discography with better typography. The scene worth building is an **album-era timeline** — the artist's releases as a spine, concerts as marks along it, legible at a glance as "caught them fresh" versus "caught the catalogue" — and unlike a grid, it reads at archive scale, not just per-artist. Capture this in the spec's Future Enhancements rather than acting on it now.

---

## Testing Strategy

### Unit tests — `test/album-title.test.ts` (new)

Fixture-driven, using real strings from the corpus. Must cover:

- [ ] `Violator (Deluxe)` → `violator`
- [ ] `Speak and Spell (Deluxe)` matches MB `Speak & Spell`
- [ ] `Garbage (20th Anniversary Edition) [2015 Remaster]` → `garbage` (stacked qualifiers)
- [ ] `Echo & the Bunnymen (Bonus Tracks Edition) [2004 Remaster]` → `echo and the bunnymen`
- [ ] `Honky Château (Bonus Track Version)` → `honky chateau` (diacritic folding)
- [ ] `(What's the Story) Morning Glory?` — leading title-bearing paren **preserved**
- [ ] `Duran Duran (The Wedding Album)` — title-bearing paren **preserved**
- [ ] `Abc (Alphabet Song) - Single` → `isSingleOrEp === true`
- [ ] **Negative:** `channel ORANGE` returns `null` against Bad Religion's discography (fail-closed)
- [ ] **Negative:** prefix tier rejects a 5-char key (below the 6-char floor)
- [ ] **Negative:** prefix tier rejects a shorter/longer ratio below 0.60

### Unit tests — `test/artist-key.test.ts` (new)

Every case below is a real drift instance from §2a and must resolve:

- [ ] `Echo & The Bunnymen` → matches discography key `echo-the-bunnymen` (`&` folding)
- [ ] `Run-D.M.C.` → `run-d-m-c` (period elision)
- [ ] `Tone-Lōc` → `tone-l-c` (diacritic **folding**, not deletion)
- [ ] `The Beach Boys` ↔ `beach-boys` (article-insensitive, both directions)
- [ ] `Peter Hook & The Light` → `peter-hook-the-light`
- [ ] `Art of Noise` ↔ `the-art-of-noise`
- [ ] **Invariant:** `foldArtistName` is never used to produce a stored slug — assert `normalize.ts` output is untouched for all 257 artists

### Derivation tests

- [ ] Match rate on live data ≥ **74%** of eligible names
- [ ] `album-eras.json` ≤ **400 KB**
- [ ] Every headliner resolves to a discography entry via `artist-key.ts` or an alias (0 unresolved)
- [ ] `the-go-go-s` resolves to the correct MusicBrainz artist
- [ ] Concerts predating an artist's debut emit no `currentAlbum` and do not crash
- [ ] `albumsBefore` is a valid slice index into `artists[].studioAlbums`

### MCP tests — extend `workers/mcp-server/src/tools.test.ts`

- [ ] `get_career_position` with artist + date returns the Rose Bowl trajectory
- [ ] `get_career_position` with artist only defaults to the most recent show
- [ ] Unknown artist returns the existing resolution-failure message, not an error
- [ ] Missing `album-eras.json` → `dataUnavailableResult()`, no crash
- [ ] `albumsAfter === 0` omits the trajectory paragraph
- [ ] `truncated: true` suppresses first/last-album phrasing
- [ ] `get_concert_setlist` and `get_artist_history` are byte-identical to today when era data is absent (snapshot)
- [ ] `search_concerts` with `cycleBucket: "fresh"` returns 25 shows and names the count excluded for missing era data
- [ ] `search_concerts` ignores `cycleBucket` (rather than erroring) when era data is absent

### Liner notes tests

- [ ] `--analyze-only` yields exactly **8** `album-trajectory` findings on current data
- [ ] `--analyze-only` yields **28** `discography-crossref` findings
- [ ] Missing `album-eras.json` → all three discography detectors return `[]`; every other detector's output is unchanged (snapshot)
- [ ] `album-context` cross-artist findings beyond 21 days are dropped
- [ ] Generated `album-trajectory` prose passes the full voice checklist, including the new perishable-claims rule

### Known test data

| Fact | Value |
| --- | --- |
| Depeche Mode, The Rose Bowl | 1988-06-18; *Violator* 20 months out; 10 albums after |
| No Doubt, Disneyland | 1988-03-04; *Tragic Kingdom* 91 months out; 8 albums after |
| Stryper, Knott's Berry Farm | 1985-05-17; 2 days after *Soldiers Under Command* |
| Median days since release | 372 across 161 datable shows |
| Cycle buckets | fresh 25 · current 52 · mature 51 · deep 22 · catalog 11 |
| Baseline → normalized match | 58.1% → 74.8% of 1,024 eligible names |

---

## Implementation Plan

### Phase 1 — Foundation (Window 1)

**Create:** `scripts/utils/album-title.ts`, `scripts/utils/artist-key.ts`, `scripts/derive-album-eras.ts`, `test/album-title.test.ts`, `test/artist-key.test.ts`

**Modify:** `scripts/build-data.ts`, `scripts/validate-concerts.ts`, `scripts/enrich-discography.ts`, `public/data/artist-aliases.json`, `package.json`, `docs/DATA_PIPELINE.md`

**Tasks:**
1. Build and unit-test the normalizer + tiered matcher against the fixture set
2. Build `artist-key.ts` (resolves 6/10 drift cases); add 3 `sameAct` alias entries (Yaz/Yazoo, English Beat/The Beat, OMD); correct the `the-go-go-s` MBID; re-run `enrich:discography --force` for corrected artists
3. Add discography coverage validation (WARN < 3 releases, FAIL on unresolved headliner)
4. Implement `derive-album-eras.ts`; wire as build-data Step 9.5 with `--skip-album-eras`
5. Generate and commit `album-eras.json`

**Acceptance:**
- [ ] Match rate ≥ 74% of eligible names, reported in derivation stdout
- [ ] 0 unresolved headliners; `the-go-go-s` correct
- [ ] `album-eras.json` ≤ 400 KB, schema-valid
- [ ] `npm run validate` passes

### Phase 2 — MCP Server (Window 2)

**Create:** `workers/mcp-server/src/career.ts`

**Modify:** `workers/mcp-server/src/{data,tools,types}.ts`, `tools.test.ts`, `prompts/query.md`, `scripts/gen-mcp-landing.ts`

**Tasks:**
1. Add `album-eras.json` to `LAZY_FILES` + `getAlbumEras()`; update the SKIP comment rationale
2. Implement `careerPosition()` prose formatter in `career.ts`
3. Register `get_career_position` with `instrument()` telemetry, matching house patterns
4. Add the one-line enrichments to `get_concert_setlist` and `get_artist_history`
5. Add the optional `cycleBucket` parameter to `search_concerts` (§4c)
6. Refresh the MCP landing page copy

**Acceptance:**
- [ ] All MCP tests pass, including absent-data and snapshot cases
- [ ] Enriched tools byte-identical when era data is missing
- [ ] Cold-start latency for `get_concert_setlist` shows no regression
- [ ] `cycleBucket` composes with existing `search_concerts` filters and reports excluded shows

### Phase 3 — Liner Notes (Window 3)

**Modify:** `scripts/liner-notes/{analyze,score,curate,image-refs,types,pipeline}.ts`, `.claude/skills/liner-notes-voice/SKILL.md`, `scripts/liner-notes/generate.ts`, `docs/LINER_NOTES_PIPELINE.md`

**Tasks:**
1. Thread `albumEras` through `pipeline.ts` → `analyze()`
2. Implement `album-trajectory`; add scoring
3. Implement `discography-crossref` — **leave disabled in the dispatcher**, per §5f
4. Repair `album-context` (same-artist supply, 21-day fallback bar, alias-aware matching)
5. Repoint `getAlbumArt()` at Cover Art Archive with the normalization-aware fallback chain
6. Apply the voice rule changes (§6a–6d)
7. Run `--analyze-only` and `--dry-run`; review generated prose against the checklist

**Acceptance:**
- [ ] 8 `album-trajectory` findings; 28 `discography-crossref` findings when enabled
- [ ] Cover Art Archive images resolve on album-subject posts
- [ ] Generated prose contains no perishable claims and no critical judgments
- [ ] Pipeline runs clean with `album-eras.json` deleted

### Phase 4 — Documentation & Reconciliation (Window 4)

**Tasks:**
1. `LINER_NOTES_PIPELINE.md` — move `discography-crossref` to Tier 1, **correct the stale deferral rationale**, document `album-trajectory`, record the "never released another album" rejection
2. `DEEP_LINKING.md` → v1.3 with the reserved album grammar
3. `ROADMAP.md` — add this feature to Short-Term; mark #5 (Artist Discography UI Panel) as **superseded** with a pointer here; update #68's `discography-crossref` entry
4. `DATA_PIPELINE.md` — document Step 9.5 and `derive:album-eras`
5. File the iTunes artist mis-resolution issue (§Part 1) as a **separate** GitHub issue
6. `.claude/context.md` — record current state

**Acceptance:**
- [ ] `npm run validate` and both CI suites (root + workers) green
- [ ] No documentation claims `discography-crossref` is blocked
- [ ] The out-of-scope top-tracks bug is filed, not silently absorbed

---

## Future Enhancements

1. **Setlist song → album attribution — PROMOTED TO v5.5.** No longer a vague future item: architecture resolved and specced in [`global-setlist-album-attribution.md`](global-setlist-album-attribution.md). `album-title.ts` from this release is the matcher it consumes, which is the hard dependency ordering between the two releases.
2. **"Road-tested before release" detector — v5.5.** setlist.fm formally tracks live debuts and unreleased-song performances, and touring songs before the record exists is standard practice. Once attribution carries a release date this detects itself: an attributed song whose album `releaseDate > concert.date` **is** the finding — *"I heard that song before its album existed."* The exact inverse of `album-trajectory`, and it falls out of the join at no additional API cost.
3. **Personal gap / bust-out detector — deferred, dependency stated.** [Phish.net](https://phish.net/setlist/gap-chart/) has run the definitive precedent for two decades: "gap" = shows since a song was last played, "bust-out" = a revival after hundreds of shows. The personal variant — *"they hadn't played that song in 15 years, and I was in the room"* — requires **artist-wide** setlist history, not just the 187 shows attended. That is a different and larger data acquisition than v5.5 (which only needs track listings for albums already held), so it stays deferred with its dependency named rather than rediscovered later.
4. **Album-era timeline surface** in the Artist Scene — releases as a spine, concerts as marks. See §Part 7. Supersedes the cover-grid proposal in #5.
5. **Album deep links** — activate the reserved grammar; a rendering change once (4) exists.
6. **`temporal-pattern` detector** (#68) — unrelated to this work but the last remaining Tier 2 blocker after this ships.
7. **Per-concert SEO enrichment** — the meta-injector currently has thin per-concert description material. *"Four days after Memento Mori"* is exactly the unique copy it lacks.

---

## Resolved Decisions

All four review questions were resolved on 2026-08-07. Recorded here with rationale so the reasoning survives the decision.

1. **`discography-crossref` enablement — DEFERRED TO v5.5.** Ships disabled in v5.4. Enable during the v5.5 rollout after ≥ 2 publication cycles of `album-trajectory`, so one rotation judgement is made with the full detector pool visible rather than two on partial information. See §5f. *(Decided in light of v5.5 being committed.)*

2. **Override file placement — NO OVERRIDE FILE.** The proposal was retired after diagnosis. 6 of 10 drift cases are a normalizer defect (fixed by `artist-key.ts`, matching-only), 5 are act-identity questions `artist-aliases.json` already models, and the last is an enrichment input (§2b). A general-purpose override map would have absorbed all three classes and concealed the real bug. See §2a. *(Architect's call.)*

3. **`album-context` fallback bar — TIGHTEN TO 21 DAYS**, plus a same-artist/cross-artist surprise split. Measurement settled it: the detector currently yields 17 findings of which **0 are same-artist** — the preference branch has never fired. Tightening costs 6 weak findings while the discography join adds 25 strong ones. See §5c. *(Architect's call.)*

4. **Cycle-bucket search — IN SCOPE for v5.4**, as an optional parameter on `search_concerts` rather than a fourth tool. One enum, additive, degrades to current behaviour without era data. See §4c. *(Approved.)*

---

## Revision History

- **2026-08-07:** Initial specification created
- **2026-08-07 (v1.1):** All four review questions resolved (see §Resolved Decisions).
  §2a rewritten after diagnosis — the override-file proposal was retired in favour of
  `artist-key.ts` plus 3 `artist-aliases.json` entries. §5c gained measured evidence
  (0 same-artist findings today). §4c added (`cycleBucket` on `search_concerts`).
  Future Enhancements updated with competitive-research findings and the v5.5 promotion.
- **2026-08-07 (v1.2):** Traceability table added; issues #266, #268–#275 created.
- **2026-08-07 (v1.3):** Window 1 implemented (#268–#270). Four spec corrections recorded
  in place: prefix match tier removed (§Part 1), `discographyKeys` relation replaces the
  `sameAct` proposal (§2a), derived fields removed from the schema and album storage
  normalized (§Part 3), size budget re-set on evidence (§Part 3).
- **Version:** 1.3.0
- **Author:** Lead architect (via Claude Code)
- **Status:** Planned
