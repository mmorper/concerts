# Setlist Song → Album Attribution

**Status:** Window 1 shipped ([#282](https://github.com/mmorper/concerts/pull/282)) · Windows 2–3 remain
**Target Version:** **v6.0.0** — the discography release
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** [Discography Trajectory (v5.4.0)](global-discography-trajectory.md) — **hard dependency, now SHIPPED.** Consumes `scripts/utils/album-title.ts` and `public/data/album-eras.json`, both live as of `v5.4.0`.
**Epic:** [#267](https://github.com/mmorper/concerts/issues/267)

> **Renamed from v5.5.0 (2026-08-08).** This work ships inside **v6.0.0**, together with the rest of the discography domain, tracked by the *v6.0.0 — Discography* milestone. References to "v5.5" further down are left alone deliberately: in the Drift Log and Resolved Decisions they record what was decided under that name, and rewriting history to match a later rename makes the reasoning harder to follow, not easier.
>
> **Window 1 shipped** in [#282](https://github.com/mmorper/concerts/pull/282): Tier 0 + Tier 1, `song-albums.json`, **88.2% attributed** (1,629 of 1,846 non-cover pairs). The ≥60% floor below is therefore no longer provisional — it was measured and met. Windows 2 and 3 remain.
>
> **Reconciled against v5.4.0 as shipped (2026-08-07).** This spec was drafted before its dependency existed. Every claim it makes about v5.4's surface has since been checked against the code, and the [Drift Log](#drift-log--v54-implementation) is **closed** — its items are folded into the body below and the log is retained only as the record of why. The one thing still assumed rather than measured is the **≥ 60% attribution floor**; see [Acceptance target](#acceptance-target).

| Spec section | Issue |
| --- | --- |
| Parts 1–4 — tiered resolver, `song-albums.json` | [#276](https://github.com/mmorper/concerts/issues/276) |
| Parts 5–6 — detectors, MCP enrichment, crossref enablement | [#277](https://github.com/mmorper/concerts/issues/277) |

---

## Executive Summary

v5.4.0 answers *where an artist stood in their career* on a given night. It cannot answer **what was actually played, and where those songs came from** — because nothing in the archive connects a setlist song to an album.

The archive holds **2,731 song performances** across 187 setlists, and a discography of 11,382 releases. The two have never been joined. Every question that sits between them is currently unanswerable:

- *Which album is most represented in the shows I've actually witnessed?*
- *Did I hear that song before its record existed?*
- *What share of that night was the new album versus the back catalogue?*

This spec resolves the attribution problem — **at zero incremental API cost** — and ships the two detectors it unlocks.

**The constraint that shaped the design:** no new paid services. The Apple Music API (`api.music.apple.com`) requires a $99/year Apple Developer membership and is therefore **excluded**. The **iTunes Search API** — free, keyless, and already instrumented in `scripts/enrich-top-tracks.ts` — provides the same `collectionName` data and is used instead.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement Setlist Song → Album Attribution for Morperhaus Concerts.

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

**PREREQUISITE CHECK — run this first:**
This spec depends on v5.4.0 (Discography Trajectory), which SHIPPED on
2026-08-07. scripts/utils/album-title.ts and public/data/album-eras.json both
exist — confirm, then proceed. Read the Drift Log at the end of this spec
before Window 1: it is closed and folded into the body, but it records why
several design points landed where they did.

**Feature Overview:**
- Build public/data/song-albums.json mapping artist::song -> studio album
- Tier 0: reuse album names already in artists-top-tracks.json (0 API calls)
- Tier 1: fetch MusicBrainz track listings for the studio release-groups listed
  in album-eras.json (artists[key].studioAlbums — already filtered, sorted and
  exclusion-aware), building a local song->album index (free, 1 req/sec)
- Tier 2: iTunes Search fallback for residual misses (free, keyless)
- Attribute cover songs against the ORIGINAL artist's discography
- Ship two detectors: road-tested (song played before its album existed) and
  most-witnessed-album; enable discography-crossref from v5.4
- Add album attribution to get_concert_setlist output

**Key References:**
- Full Design Spec: docs/specs/future/global-setlist-album-attribution.md
- Predecessor spec: docs/specs/future/global-discography-trajectory.md
- Album title matcher (REUSE, do not reimplement): scripts/utils/album-title.ts
- Liner notes pipeline: docs/LINER_NOTES_PIPELINE.md
- Liner notes voice: .claude/skills/liner-notes-voice/SKILL.md
- Existing iTunes client pattern: scripts/enrich-top-tracks.ts
- Existing MusicBrainz client: scripts/utils/musicbrainz-client.ts

**Implementation Approach:**
- Window 1: Tier 0 + Tier 1 resolver, song-albums.json, caching
- Window 2: Tier 2 iTunes fallback, cover-song routing, validation
- Window 3: Detectors, MCP enrichment, voice rules, docs

**Design Philosophy:**
Index per album, not per song. Attribution that cannot be made confidently is
left null — a gap is correct, a guess is a fabricated memory.

**Key Design Details:**
- NO paid APIs. Apple Music API is excluded ($99/yr). iTunes Search is free.
- MusicBrainz rate limit: 1 req/sec, User-Agent required
- Cache TTL 90 days, same pattern as discography.json
- Steady state after backfill is a handful of calls per new concert

**Files to Create:**
- scripts/resolve-song-albums.ts (~300 LOC)
- scripts/utils/song-title.ts (~80 LOC)
- test/song-albums.test.ts (~150 LOC)

**Files to Modify:**
- scripts/utils/musicbrainz-client.ts (add release-group track listing fetch)
- scripts/build-data.ts, package.json
- scripts/liner-notes/{analyze,score,types}.ts
- workers/mcp-server/src/{data,tools,types}.ts
- .claude/skills/liner-notes-voice/SKILL.md
- docs/{DATA_PIPELINE,LINER_NOTES_PIPELINE}.md

Let's start with Window 1. Should I begin by extending the MusicBrainz client
with release-group track listing fetches?
```

---

## Design Philosophy

**Index per album, not per song.**

The obvious approach — search each setlist song against an API and read back its album — was probed live and is the wrong shape. Searching MusicBrainz for Depeche Mode's *"Never Let Me Down Again"* returns **165 recordings**, and the release lists are dominated by compilations: *The Singles 86>98*, *Top of the Pops 1987*, *Formel Eins: Space Hits*, *New Wave: The Platinum Collection*. Picking the original studio album out of that requires disambiguation logic that will be wrong in ways nobody notices.

Inverting it removes the problem entirely. We already hold release-group MBIDs for every studio album in `discography.json`. Fetch **their** track listings, build a local index, and attribute setlist songs against it. Compilation noise never enters the pipeline, because only studio release-groups are ever indexed.

**Fail closed, again.** This is the same discipline v5.4 established for album titles, and it matters more here. An unattributed song is a small gap in a data file. A *wrongly* attributed song becomes a sentence in a first-person post claiming the archive owner heard something they did not.

---

## Part 1 — Sizing

Measured against `setlists-cache.json` as of 2026-08-07:

| Quantity | Value |
| --- | --- |
| Setlist entries | 371 |
| Entries with actual songs | 187 |
| Total song performances | 2,731 |
| Cover performances (routed separately) | 369 |
| **Unique `artist::song` pairs to attribute** | **1,865** |
| Distinct artists with setlist songs | 130 |

The work is bounded and one-time. Steady state after backfill is a handful of new pairs per added concert.

---

## Part 2 — Tiered Resolution

Tiers run in order; **first confident hit wins**. Every tier is free.

### Tier 0 — Reuse what is already on disk (0 API calls)

`artists-top-tracks.json` already carries `albumName` for every top track. For any setlist song matching a known top track, the album is already known. Normalize both sides with `normalizeAlbumTitle` from v5.4, then resolve to a release-group via `album-eras.json`.

This costs nothing and should be run to exhaustion before any network call.

### Tier 1 — MusicBrainz track-listing index (free, ~25 min one-time)

For each of the 130 artists with setlists, fetch track listings for their **studio release-groups only**.

**Read that list from `album-eras.json`, not `discography.json`.** `artists[key].studioAlbums` is already filtered to `primaryType: "Album"` with empty `secondaryTypes`, already sorted by release date, and already carries `{ mbid, title, releaseDate, coverAvailable }` — the exact shape this tier needs. More importantly it is **the same set the era join uses**, so the two cannot diverge.

Re-filtering `discography.json` here would reintroduce that divergence, because the predicate is not purely structural:

> `derive-album-eras.ts` holds `RELEASE_EXCLUSIONS`, a hand-maintained list of release-groups MusicBrainz mistags as studio albums (currently one 1993 Depeche Mode bootleg, *Houston Night Volume 2*). A naive `primaryType`/`secondaryTypes` filter includes it. Indexing its tracks would attribute songs to a record the era join has already decided does not exist — v5.4 would say the Rose Bowl show sat in the *Music for the Masses* cycle while v5.5 said one of its songs came off a bootleg.

`isStudioAlbum` is currently **private** to `derive-album-eras.ts`. Window 1 must **export it** (alongside the already-exported `coverArtUrl`) and use it anywhere this pipeline touches a raw `discography.json` album. One definition of "studio album", two consumers — the same rule §Part 4 applies to derived fields.

Extend `scripts/utils/musicbrainz-client.ts` with a release-group → recordings fetch. Honour the existing conventions: **1 req/sec**, `User-Agent: Morperhaus-Concerts/5.5.0 (concerts@morperhaus.org)`, 90-day cache.

Build `foldSongTitle(track) → { albumSlug, mbid, releaseDate }` per artist, then attribute setlist songs against that local index. When a song appears on more than one studio album (re-recordings, a track reused across releases), **take the earliest release date** — the question being answered is always "when did this song first exist."

### Tier 2 — iTunes Search fallback (free, keyless)

For residual misses, query the same endpoint `enrich-top-tracks.ts` already uses:

```
https://itunes.apple.com/search?term={artist}+{song}&entity=song&limit=5
```

Live probe, *"Never Let Me Down Again"*:

```
Never Let Me Down Again  ||  Music for the Masses (Deluxe Edition)  ||  1987-08-24
```

Correct album, first result, and the *original* 1987 release date despite being a Deluxe reissue. The `(Deluxe Edition)` suffix is exactly what `normalizeAlbumTitle` strips, so it resolves cleanly against our release-group. Accept a Tier 2 hit **only** when the normalized `collectionName` matches a studio release-group we already hold — never introduce an album from iTunes that our discography does not know about.

Rate limit conservatively (~20 req/min) and cache aggressively.

### Tier 3 — None. Leave it null

No fuzzy fallback, no edit distance, no "closest album." `null` is a valid and expected outcome.

---

## Part 3 — Cover Songs

369 of 2,731 performances are covers, flagged by setlist.fm's `cover` field. These must **never** be attributed against the performing artist's discography — Dropkick Murphys playing *"No Surrender"* did not put it on a Dropkick Murphys album.

Route covers against the **original** artist's discography. This takes **two hops**, and conflating them is the trap:

1. **Billing → act.** `canonicalOf(aliases, slugify(song.cover.name))` — exactly what the `full-circle` detector does (#227). This collapses marquees into one act (`the-brian-setzer-orchestra` → `brian-setzer`).
2. **Act → discography key.** `resolveArtistKey(...)` with an `aliasesOf` built from **both** `sameAct` billings and the `discographyKeys` relation, wired as `derive-album-eras.ts` does it — plus its `isUsable` guard, since a record with zero albums is a worse answer than no record at all (`omd` exists and is empty; the real catalogue is under `orchestral-manoeuvres-in-the-dark`).

> **Why hop 2 cannot be skipped.** `buildAliasMap` in `scripts/liner-notes/artist-aliases.ts` reads only `sameAct` and `sharesMember` — it **ignores `discographyKeys` entirely**, which today is consumed only by `derive-album-eras.ts` and `validate-concerts.ts`. So `canonicalOf` returns the *concert-side canonical* slug, which is deliberately not the discography key for the exact three cases the relation exists to fix — `yaz`→`yazoo`, `the-english-beat`→`the-beat`, `omd`→`orchestral-manoeuvres-in-the-dark`. Reusing `full-circle`'s resolution alone silently drops those artists to `null`.
>
> Either wire hop 2 explicitly, or teach `buildAliasMap` the relation. **Prefer wiring it explicitly:** the two relations are deliberately unmerged, and a test asserts every `sameAct` billing appeared on a real bill — a constraint `discographyKeys` cannot satisfy, because nobody ever saw a marquee that said "Yazoo."

When the original artist is not in our discography, the song is left unattributed — which is correct and common, since most covered artists were never seen live.

Songs flagged `tape` (walk-on/playback music) are excluded entirely — **including the 15 performances flagged both `tape` and `cover`.** Of 2,742 raw song entries, 2,731 carry a name (11 are segue markers), 369 are cover-flagged and 38 are tape-flagged; `tape` wins wherever they overlap.

---

## Part 4 — Output: `song-albums.json`

**Location:** `public/data/song-albums.json`

```jsonc
{
  "version": "1.0.0",
  "generatedAt": "2026-08-07T00:00:00.000Z",
  "songs": {
    "depeche-mode::never-let-me-down-again": {
      "artistKey": "depeche-mode",
      "songTitle": "Never Let Me Down Again",
      "albumSlug": "music-for-the-masses",  // kept: stable grouping key, per album-eras' erasSeen
      "albumTitle": "Music for the Masses",
      "mbid": "…",
      "releaseDate": "1987-09-28",
      "coverAvailable": true,        // NOT coverUrl — see below
      "source": "musicbrainz",       // top-tracks | musicbrainz | itunes
      "matchTier": 1,
      "isCover": false,
      "originalArtistKey": null      // populated for covers
    }
  },
  "stats": {
    "uniquePairs": 1865,
    "attributed": 0,                 // fill from the real run
    "byTier": { "0": 0, "1": 0, "2": 0 },
    "unattributed": 0,
    "coversRouted": 0
  }
}
```

**Store nothing derivable** — v5.4's hardest-won budget lesson, inherited here rather than relearned:

- **No `coverUrl`.** It is a pure function of the MBID, verified across all 11,382 covers with zero exceptions. Call the exported `coverArtUrl(mbid)` from `derive-album-eras.ts`, and only when `coverAvailable` is true — the archive 404s otherwise. Carrying the URL cost v5.4 **284 KB**, more than this file's entire budget.
- **No `albumSlug` beyond the grouping key.** It is `normalizeAlbumName(title)` from `src/utils/normalize.ts`. Keep the field only where it earns its place as a stable lookup key, exactly as `erasSeen` does in `album-eras.json`.

**Size budget: 400 KB.** The MCP fetches this over the network; keep it lazy-loaded. For calibration, `album-eras.json` ships at **306 KB** after the same discipline was applied — it began at 534 KB.

**Pipeline:** new `scripts/resolve-song-albums.ts`, wired into `build-data.ts` as **Step 9.6** (immediately after `derive-album-eras`), with `npm run resolve:song-albums`, `--dry-run`, `--force`, and a `--skip-song-albums` flag on `build-data.ts` for parity.

### Acceptance target

**≥ 60% of non-cover unique pairs attributed — PROVISIONAL. Re-derive before treating it as a gate.**

Stated as a floor rather than a goal: the corpus contains songs that never appeared on a studio album (live-only material, B-sides, unreleased songs — the last of which is itself a finding, see §5a). A 100% attribution rate would be evidence of a bug, not success.

**What changed.** 60% was estimated when `album-title.ts` was projected to match **74.8%** of album names. The shipped matcher measures **74.0% (758 of 1,024)** on live data — a prefix-match tier was built, measured at 13 of 766 matches, found to be wrong in the worst direction (*Replicas* → *Replicas Live*; The Bronx's four self-titled albums collapsed into one) and **removed**. The gap is small and neither Tier 0 nor Tier 1 depends on the removed tier, so 60% is very likely still met — but it was never derived from a real run of *this* pipeline, only from a sibling metric.

**The rule:** report the real Tier 0 + Tier 1 rate at the end of Window 1, then either confirm 60% or restate the floor with the measured number and the reason. Do not fail a build against a number nobody has measured, and do not quietly lower it either — v5.4 dropped its own bar from 74% to 73% *on evidence*, and said so.

Report the tier breakdown in stdout so the cost/benefit of Tier 2 is visible and can be dropped if it earns little.

---

## Part 5 — Liner Notes Outcomes

### 5a. NEW detector — `road-tested` (Cultural)

**What it finds:** a song heard live **before the album containing it existed**.

**Trigger:** attributed song where `album.releaseDate > concert.date`.

This is the exact inverse of v5.4's `album-trajectory` — there, the *record* was ahead; here, the *song* was. It requires no additional API work: once attribution carries a release date, the finding falls out of a date comparison. setlist.fm formally tracks live debuts and unreleased-song performances, so the practice is well-attested; this simply detects the archive owner's own instances of it.

**Data points:** artist, venue, city, date; song, album title, album release date, days before release, `songCountFromSameFutureAlbum`.

**Scoring:** `span` from days before release (2 pts ≥ 30d, 4 pts ≥ 90d, 7 pts ≥ 180d, 10 pts ≥ 365d). `surpriseFactor` = **9**.

**Auto-tags:** `#road-tested`, `#before-the-record`.

> **Voice caution.** Setlist.fm data is fan-contributed and song titles drift, so a false positive here would claim the archive owner heard something they did not. Require **≥ 14 days** before release to fire, absorbing off-by-a-few-days release-date disagreements between sources.
>
> **`careerYear` is `null`, never negative.** A `road-tested` show is by definition early, and the earliest are pre-debut. v5.4 shipped with a negative `careerYear` and a generated post rendered No Doubt's `-4` as *"four years into their existence"* when the truth was four years **before** their debut. It is now `null` for those shows, with the magnitude carried by the new `yearsBeforeDebut`. If this detector wants to say how early a show was, **read `yearsBeforeDebut` explicitly** — treating a missing `careerYear` as zero puts the same fabrication back.

### 5b. NEW detector — `most-witnessed-album` (Personal)

**What it finds:** the album the archive owner has heard the most *live songs* from, across all shows — likely different from their most-played album at home, which is the interesting part.

**Data points:** album, artist, distinct songs witnessed, total performances, shows spanned, first and last date, album's total track count where known.

**Scoring:** `span` from distinct songs witnessed (4 pts ≥ 4, 7 pts ≥ 6, 10 pts ≥ 8). `surpriseFactor` = 6.

**Auto-tags:** `#most-witnessed`, `#album-eras`.

> **Supply caution, carried forward from v5.4 §5f.** This detector favours repeat artists and will therefore land on Social Distortion, Depeche Mode and Howard Jones — already the most-covered artists in the feed. Ship it, but expect rotation pressure and evaluate against §5d before adding more.

### 5c. Album share of setlist — enrichment, not a detector

`"That night was 40% Music for the Masses"` is a good *sentence* and a weak *post*. Expose it as a data point available to existing concert-scoped detectors rather than as a detector of its own. Deliberately not a publication trigger.

### 5d. Enable `discography-crossref`

Per v5.4 §5f, `discography-crossref` ships disabled in v5.4 and is enabled here — after ≥ 2 publication cycles of `album-trajectory`, so one rotation judgement is made with the full pool of detectors visible.

**Checklist for enablement:**

- [ ] `album-trajectory` has published ≥ 2 posts
- [ ] Review artist distribution across the last 10 posts
- [ ] If the top-4 artists hold > 50% of recent posts, implement a per-artist cap in `curate.ts` **before** enabling
- [ ] Flip the dispatcher entry; run `--dry-run` and inspect selection

### 5e. Voice rules

Add to `.claude/skills/liner-notes-voice/SKILL.md`:

- Song → album attributions are **Tier 1** when present in `song-albums.json`.
- Never state or imply an album a song came from when attribution is `null`. The generator must not fill this gap from its own knowledge — this is the single most likely hallucination vector the feature introduces. **This is a sibling of the rule v5.4 already added to the generator prompt** — invented biographical specifics, "numbers you could plausibly infer" — and should cross-reference it rather than restate it, so the two cannot drift apart.
- `road-tested` prose must frame the memory as retrospective — *"I'd heard it a year before the record came out"* — never as foresight in the moment.

---

## Part 6 — MCP Outcomes

### 6a. Enrich `get_concert_setlist`

**The era line already exists.** `eraLine()` in `workers/mcp-server/src/tools.ts` emits it as of v5.4 (#271). v5.5's work here is **additive song annotations underneath it** — not a rewrite of the header. The example below shows the finished state; only the indented song block and the trailing count are new.

```
Depeche Mode — The Rose Bowl, June 18 1988
Touring Music for the Masses (released 264 days earlier).

  1. Behind the Wheel            Music for the Masses
  2. Strangelove                 Music for the Masses
  3. Never Let Me Down Again     Music for the Masses
  4. Just Can't Get Enough       Speak & Spell
  …

11 of 14 songs identified. 8 from Music for the Masses.
```

Rules:

- Unattributed songs render **with no annotation** — never "Unknown album."
- Always state the identified/total count, so a partially attributed setlist reads as partial rather than complete.
- Covers annotate with the original artist, not an album.

**Follow `eraLine`'s discipline exactly.** It returns `null` rather than a placeholder when data is missing, and a test asserts the tool's output is **byte-identical to its pre-v5.4 form** in that case. "Unattributed songs render with no annotation" is the same rule one level down and gets the same test: with `song-albums.json` absent or empty, `get_concert_setlist` must be byte-identical to its v5.4 output.

*Placement:* `careerPosition` lives in `tools.ts` section 9, not a separate `career.ts`. If v5.5 adds setlist-attribution helpers, follow that precedent — the prose helpers are private to `tools.ts`, and extracting them is not worth the churn.

### 6b. Data registry

Add `song-albums.json` to `LAZY_FILES` in `workers/mcp-server/src/data.ts` with a `getSongAlbums()` helper. It joins the five already there (`venues-metadata`, `setlists-cache`, `artists-top-tracks`, `most-played-songs`, `album-eras`). No new tool — this is inline enrichment of an existing one.

**`discography.json` stays out of the registry.** v5.4 decided this deliberately: enumerating a discography is a commodity, the join against attendance is not. v5.5 consumes `discography.json` as a *build input* only; nothing it ships changes what the MCP exposes.

---

## Testing Strategy

### Unit tests — `test/song-albums.test.ts` (new)

- [ ] Tier 0 resolves *"Enjoy the Silence"* → *Violator* with 0 network calls
- [ ] Tier 1 index prefers the **earliest** release date when a song appears on multiple studio albums
- [ ] Tier 1 **skips a `RELEASE_EXCLUSIONS` release-group** — the Depeche Mode bootleg is never indexed, so no song attributes to it
- [ ] Tier 2 rejects an iTunes `collectionName` with no matching release-group in our discography
- [ ] **Negative:** a song present only on a compilation resolves to `null`
- [ ] **Negative:** unresolvable song → `null`, never a nearest guess
- [ ] Cover song routes to the original artist's discography, never the performer's
- [ ] Cover routing survives **hop 2** — an act whose discography lives under a different key (the `discographyKeys` relation) resolves, rather than dropping to `null`
- [ ] Cover by an artist absent from our discography → `null`, no crash
- [ ] An artist whose discography record exists but holds **zero albums** is not treated as a hit (the `isUsable` guard)
- [ ] `tape` songs are excluded entirely, **including `tape` + `cover`**
- [ ] `road-tested` requires ≥ 14 days before release
- [ ] `road-tested` reads `yearsBeforeDebut` for pre-debut shows and never coerces a `null` `careerYear` to 0

### Integration

- [ ] Attribution rate meets the floor **as re-derived in Window 1** (see [Acceptance target](#acceptance-target)) — not the provisional 60% as written
- [ ] `song-albums.json` ≤ 400 KB
- [ ] Full re-run with warm cache makes **0** network calls
- [ ] Pipeline degrades cleanly when `song-albums.json` is absent — detectors return `[]`, `get_concert_setlist` **byte-identical** to v5.4 output (snapshot)
- [ ] Every studio release-group indexed by Tier 1 also appears in `album-eras.json` — the two files agree on what a studio album is, by construction

### Known test data

| Fact | Value |
| --- | --- |
| Unique pairs | 1,865 across 130 artists |
| Cover performances | 369 of 2,731 named songs (2,742 raw entries; 11 are unnamed segue markers) |
| Tape performances | 38, of which 15 are also cover-flagged |
| Setlists with songs | 187 of 371 entries |
| Studio albums excluded by hand | 1 (`RELEASE_EXCLUSIONS`, 1 of 1,146 spine albums) |
| iTunes probe | *Never Let Me Down Again* → *Music for the Masses (Deluxe Edition)*, 1987-08-24 |
| MusicBrainz probe | Same song → 165 recordings, compilation-dominated (why per-song search was rejected) |

---

## Implementation Plan

### Phase 1 — Resolver Foundation (Window 1)

**Create:** `scripts/utils/song-title.ts`, `scripts/resolve-song-albums.ts`
**Modify:** `scripts/utils/musicbrainz-client.ts`, `package.json`

**Tasks:**
1. **Verify the v5.4 prerequisite** — `album-title.ts` and `album-eras.json` must exist (they do, as of v5.4.0)
2. **Export `isStudioAlbum` from `derive-album-eras.ts`** so one predicate serves both pipelines (§Part 2, Tier 1)
3. Add release-group track-listing fetch to the MusicBrainz client (1 req/sec, cached)
4. Implement Tier 0 and Tier 1, reading studio release-groups from `album-eras.json`; emit `song-albums.json` with tier stats
5. Backfill run over all 130 artists

**Acceptance:**
- [ ] Tier 0 + Tier 1 attribution rate reported, and **the floor re-derived from it** — confirm 60% or restate with the measured number and the reason
- [ ] Warm-cache re-run makes 0 network calls
- [ ] No song attributes to a `RELEASE_EXCLUSIONS` release-group

### Phase 2 — Fallback & Covers (Window 2)

**Modify:** `scripts/resolve-song-albums.ts`, `scripts/build-data.ts`, `scripts/validate-concerts.ts`
**Create:** `test/song-albums.test.ts`

**Tasks:**
1. Implement the Tier 2 iTunes fallback with studio-release-group gating
2. Implement **two-hop** cover routing — `canonicalOf` for the act, then `resolveArtistKey` with the `discographyKeys` relation for the key (§Part 3)
3. Wire as build-data Step 9.6 with `--skip-song-albums`
4. Add validation; write the test suite

**Acceptance:**
- [ ] All negative tests pass — no guessing anywhere
- [ ] Covers never attributed to the performing artist
- [ ] An act whose discography lives under a different key still resolves
- [ ] Tier 2's marginal contribution reported, so it can be dropped if negligible

### Phase 3 — Detectors, MCP & Docs (Window 3)

**Modify:** `scripts/liner-notes/{analyze,score,types}.ts`, `workers/mcp-server/src/{data,tools,types}.ts`, voice skill, `docs/{DATA_PIPELINE,LINER_NOTES_PIPELINE}.md`

**Tasks:**
1. Implement `road-tested` and `most-witnessed-album`; add scoring
2. Work the §5d checklist and enable `discography-crossref`
3. Enrich `get_concert_setlist` with album annotations and identified counts
4. Apply voice rules; update docs; move both detectors into the Tier 1 table

**Acceptance:**
- [ ] Both detectors produce findings; prose passes the full voice checklist
- [ ] `get_concert_setlist` degrades to v5.4 output without the data file
- [ ] `npm run validate` and both CI suites green

---

## Future Enhancements

1. **Personal gap / bust-out detector.** *"They hadn't played that song in 15 years, and I was in the room."* [Phish.net](https://phish.net/setlist/gap-chart/) has run the definitive precedent for two decades. **Blocked on artist-wide setlist history** — we hold only the 187 shows attended, not every show an artist played. That is a materially larger acquisition than this spec and should not be folded in.
2. **Setlist rarity scoring** — how unusual was the set heard, relative to that tour. Same blocker as (1).
3. **Album-share visualization** in the Artist Scene, once §5c data exists.
4. **B-side / non-album track surfacing** — songs that resolve to no studio album are currently just gaps; some are deliberate deep cuts and interesting in their own right.

---

## Drift Log — v5.4 implementation

> **✅ CLOSED — reconciled 2026-08-07.** All ten items are folded into the spec body above; the body is now the source of truth and this log is history. **Do not treat these items as amendments any more** — that instruction applied only until reconciliation.
>
> Kept because the *reasoning* does not survive in the body. Item 5 explains why one predicate must be exported, item 1 why an acceptance floor is provisional, item 10 why cover routing needs two hops. A future reader who wants to change one of those decisions should read the item before doing so.
>
> **Verification:** every item was re-checked against shipped code during reconciliation, not taken on trust from the log. That found item 1's own figure to be stale (below) and surfaced item 10, which no window had logged.

### Window 1 (#268–#270) — shipped 2026-08-07

**5 items. All contract-level, because v5.5's entire dependency surface is Window 1.**

1. **`album-title.ts` has no prefix tier.** Removed after measurement (13 of 766 matches, most wrong — see v5.4 spec §Part 1). Match rate is **74.0% (758 of 1,024)**, not the 74.8% this spec's §Part 4 floor was reasoned against.
   → *Impact:* the ≥60% attribution floor was estimated from the higher figure. It is almost certainly still met — Tier 0/1 do the heavy lifting and neither depends on the prefix tier — but **re-derive the floor from a real Tier 0+1 run before treating it as an acceptance gate.**
   → *Corrected at reconciliation:* this item was logged as **73.5%** mid-implementation. The shipped matcher's header comment records **74.0% (758 of 1,024)**, which the v5.4.0 release notes confirm. Folded into §Part 4 with the corrected number. The direction of the drift is unchanged — the figure is still below the 74.8% the floor was reasoned against.

2. **`AlbumRef` no longer carries `coverUrl` or `albumSlug`.** Both were derived data. §Part 4's `song-albums.json` schema still shows `"coverUrl": "https://coverartarchive.org/…"` — **that field must be dropped**; call the exported `coverArtUrl(mbid)` from `derive-album-eras.ts` instead. Slugs come from `normalizeAlbumName(title)` in `src/utils/normalize.ts`.

3. **`album-eras.json` exposes `artists[key].studioAlbums`** — every studio release-group for an artist, normalized, sorted, already filtered to `primaryType: Album` with empty `secondaryTypes`.
   → *This simplifies Tier 1.* §Part 2 says "fetch track listings for their studio release-groups only — MBIDs already held in `discography.json`." Read that list from `album-eras.json` instead: the filtering and sorting is done, and it is the same set the era join uses, so the two cannot diverge.

4. **`artist-aliases.json` gained a `discographyKeys` relation** (separate from `sameAct`, which is marquees-only — an existing test enforces that every `sameAct` billing appeared on a real bill).
   → *Impact:* §Part 3's cover-song routing must resolve the original artist through `resolveArtistKey` with **both** relations, exactly as `derive-album-eras.ts` does. Reuse that wiring rather than re-deriving it.

5. **`RELEASE_EXCLUSIONS` exists in `derive-album-eras.ts`** — a manual list of release-groups MusicBrainz mistags as studio albums (currently one Depeche Mode bootleg).
   → *Impact:* Tier 1's track-listing fetch must **skip excluded release-groups**, or songs get attributed to a bootleg that the era join has already decided does not exist. Two sources of truth on what counts as a studio album is exactly the divergence item 3 is meant to prevent — consider exporting the predicate.

### Window 2 (#271) — shipped 2026-08-07

**1 item.** As predicted, Window 2 produced pattern drift rather than contract drift.

6. **`get_concert_setlist` already carries an era line.** §6a of this spec shows the enriched output leading with `Touring Music for the Masses (released 264 days earlier).` — that line **now exists**, emitted by `eraLine()` in `tools.ts`. v5.5's work is therefore *additive song annotations underneath it*, not a rewrite of the header.
   → Also reuse `eraLine`'s discipline: it returns `null` rather than a placeholder when data is missing, and a test asserts the tool is byte-identical to its pre-v5.4 output in that case. §6a's "unattributed songs render with no annotation" is the same rule one level down, and should be tested the same way.

   *Non-drift worth noting:* `careerPosition` lives in `tools.ts` section 9, not a `career.ts`. If v5.5 adds setlist-attribution helpers, follow that precedent — the prose helpers are private to `tools.ts` and extracting them is not worth the churn.

### Window 3 (#272–#274) — shipped 2026-08-07

**3 items.**

7. **`careerYear` is now `null` for pre-debut shows, never negative**, with a new `yearsBeforeDebut` field. Found by generating real prose: a post rendered No Doubt's `-4` as *"four years into their existence"* when the truth was four years **before** their debut.
   → *Impact:* v5.5's detectors read the same era records. Any consumer treating `careerYear` as elapsed time is now safe, but **check `yearsBeforeDebut` explicitly** if a `road-tested` post wants to say how early a show was.

8. **The generator prompt now forbids invented biographical specifics** — formation years, ages, distances, "numbers you could plausibly infer." §5e of this spec already says never to state an album when attribution is `null`; that rule now has a sibling in the prompt and should reference it rather than restating it.

9. **`getAlbumArt` prefers Cover Art Archive and matches on normalized titles.** §Part 4's `song-albums.json` carries `mbid` per song, so v5.5 gets album art for setlist songs free via `coverArtUrl(mbid)` — no new image plumbing needed.

**Confirmation of the log's premise:** Window 1 produced 5 contract-level items, Windows 2 and 3 produced 1 and 3 pattern-level ones. Weighting the sniff toward Window 1 was correct, and the ceremony reconciliation should be mechanical.

### Found at reconciliation — not logged by any window

10. **`buildAliasMap` ignores the `discographyKeys` relation.** Item 4 recorded that the relation exists and that cover routing must use it. What no window noticed is that the liner-notes alias map — `scripts/liner-notes/artist-aliases.ts`, the thing §Part 3 said to reuse — reads only `sameAct` and `sharesMember`. `discographyKeys` is consumed today by exactly two files, `derive-album-eras.ts` and `validate-concerts.ts`, neither of them in the liner-notes path.
    → *Impact:* §Part 3's original instruction — "reuse `full-circle`'s resolution" — was **insufficient, not merely underspecified**. `canonicalOf` returns the concert-side canonical slug, which is deliberately *not* the discography key for the cases the relation exists to fix. Following the instruction literally would have silently dropped Yaz and The English Beat covers to `null`, and silently is the operative word: the failure looks exactly like the common, correct outcome of "original artist not in our discography."
    → §Part 3 now specifies both hops explicitly, and the test list has a case that fails if hop 2 is missing.

**What this says about the log's premise.** The mechanical items were mechanical, as predicted. The one that was not is the one where the spec pointed at existing code and said *reuse it* — the reuse was correct in intent and wrong in reach, and only reading the referenced file showed it. **A reconciliation pass that trusts its own drift log finds nine items; one that re-checks each against the code finds ten and corrects an eleventh.**

---

## Resolved Decisions

1. **Apple Music API — EXCLUDED.** Requires a $99/year Apple Developer membership, violating the no-incremental-cost constraint. The free, keyless **iTunes Search API** already used by `enrich-top-tracks.ts` supplies the same `collectionName` data and is used instead.
2. **Per-album indexing over per-song search.** Live probe showed per-song MusicBrainz search returns 165 compilation-dominated results for a single well-known track. Indexing our own studio release-groups eliminates the disambiguation problem rather than solving it.
3. **Scoped as v5.5, not folded into v5.4.** Different risk profile — two live API enrichment passes versus pure local derivation — and v5.4 is already the largest spec in `specs/future/`. The dependency runs one way: v5.5 consumes `album-title.ts`.
4. **One predicate for "studio album", exported rather than duplicated.** Settled at reconciliation. `isStudioAlbum` is not a pure structural test — it consults a hand-maintained exclusion list — so a second implementation is a second source of truth on a question both files must answer identically. Export it from `derive-album-eras.ts`; do not re-filter `discography.json` here.
5. **`song-albums.json` carries no derived fields.** Same rule v5.4 landed on after measuring: `coverUrl` is a pure function of `mbid`, `albumSlug` of `title`. Both are computed at read time.
6. **The ≥ 60% floor is provisional until measured.** It was reasoned against a sibling metric that has since moved. Confirm or restate it from a real Tier 0+1 run at the end of Window 1 — a build must not fail against a number nobody has measured.

---

## Revision History

- **2026-08-07:** Initial specification created
- **2026-08-07:** Traceability table added; issues #267, #276–#277 created.
- **2026-08-07 (v1.1):** Drift log opened; Window 1 contract changes recorded (5 items).
- **2026-08-07 (v1.2):** Windows 2–3 drift logged. v5.4 implementation complete.
- **2026-08-07 (v1.3):** **Drift reconciliation.** All 9 logged items re-verified against shipped v5.4 code and folded into the body; a 10th found (§Part 3, cover routing needs two hops) and item 1's match rate corrected 73.5% → 74.0%. Design changes: Tier 1 reads `album-eras.json`, `isStudioAlbum` to be exported, `coverUrl` dropped from the schema, `get_concert_setlist` degradation is a byte-identical snapshot. The ≥ 60% floor is now explicitly **provisional**. Spec is no longer provisional; it is ready to implement.
- **Version:** 1.3.0
- **Author:** Lead architect (via Claude Code)
- **Status:** Planned — reconciled against v5.4.0, ready for Window 1
