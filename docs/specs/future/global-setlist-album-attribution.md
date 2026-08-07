# Setlist Song → Album Attribution

**Status:** Planned
**Target Version:** v5.5.0
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** [Discography Trajectory (v5.4.0)](global-discography-trajectory.md) — **hard dependency**, consumes `scripts/utils/album-title.ts` and `album-eras.json`
**Epic:** [#267](https://github.com/mmorper/concerts/issues/267)

| Spec section | Issue |
| --- | --- |
| Parts 1–4 — tiered resolver, `song-albums.json` | [#276](https://github.com/mmorper/concerts/issues/276) |
| Parts 5–6 — detectors, MCP enrichment, crossref enablement | [#277](https://github.com/mmorper/concerts/issues/277) |

---

## Executive Summary

v5.4.0 answers *where an artist stood in their career* on a given night. It cannot answer **what was actually played, and where those songs came from** — because nothing in the archive connects a setlist song to an album.

The archive holds **2,731 song performances** across 187 setlists, and a discography of 11,359 releases. The two have never been joined. Every question that sits between them is currently unanswerable:

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
This spec depends on v5.4.0 (Discography Trajectory) being shipped. Verify that
scripts/utils/album-title.ts and public/data/album-eras.json both exist before
starting. If they do not, STOP — implement
docs/specs/future/global-discography-trajectory.md first.

**Feature Overview:**
- Build public/data/song-albums.json mapping artist::song -> studio album
- Tier 0: reuse album names already in artists-top-tracks.json (0 API calls)
- Tier 1: fetch MusicBrainz track listings for studio release-groups we already
  hold MBIDs for, building a local song->album index (free, 1 req/sec)
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

For each of the 130 artists with setlists, fetch track listings for their **studio release-groups only** (`primaryType === "Album"`, empty `secondaryTypes`) — MBIDs already held in `discography.json`.

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

Route covers against the **original** artist's discography. The `full-circle` detector already resolves original-artist identity and is alias-aware (#227); reuse that resolution rather than rebuilding it. When the original artist is not in our discography, the song is left unattributed — which is correct and common, since most covered artists were never seen live.

Songs flagged `tape` (walk-on/playback music) are excluded entirely.

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
      "albumSlug": "music-for-the-masses",
      "albumTitle": "Music for the Masses",
      "mbid": "…",
      "releaseDate": "1987-09-28",
      "coverUrl": "https://coverartarchive.org/release-group/…/front-500.jpg",
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

**Size budget: 400 KB.** The MCP fetches this over the network; keep it lazy-loaded.

**Pipeline:** new `scripts/resolve-song-albums.ts`, wired into `build-data.ts` as **Step 9.6** (immediately after `derive-album-eras`), with `npm run resolve:song-albums`, `--dry-run`, `--force`, and a `--skip-song-albums` flag on `build-data.ts` for parity.

### Acceptance target

**≥ 60% of non-cover unique pairs attributed.** Deliberately modest, and stated as a floor rather than a goal: the corpus contains songs that never appeared on a studio album (live-only material, B-sides, unreleased songs — the last of which is itself a finding, see §5a). A 100% attribution rate would be evidence of a bug, not success.

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
- Never state or imply an album a song came from when attribution is `null`. The generator must not fill this gap from its own knowledge — this is the single most likely hallucination vector the feature introduces.
- `road-tested` prose must frame the memory as retrospective — *"I'd heard it a year before the record came out"* — never as foresight in the moment.

---

## Part 6 — MCP Outcomes

### 6a. Enrich `get_concert_setlist`

Annotate songs with their album inline, and lead with the era summary v5.4 already added:

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

### 6b. Data registry

Add `song-albums.json` to `LAZY_FILES` in `workers/mcp-server/src/data.ts` with a `getSongAlbums()` helper. No new tool — this is inline enrichment of an existing one.

---

## Testing Strategy

### Unit tests — `test/song-albums.test.ts` (new)

- [ ] Tier 0 resolves *"Enjoy the Silence"* → *Violator* with 0 network calls
- [ ] Tier 1 index prefers the **earliest** release date when a song appears on multiple studio albums
- [ ] Tier 2 rejects an iTunes `collectionName` with no matching release-group in our discography
- [ ] **Negative:** a song present only on a compilation resolves to `null`
- [ ] **Negative:** unresolvable song → `null`, never a nearest guess
- [ ] Cover song routes to the original artist's discography, never the performer's
- [ ] Cover by an artist absent from our discography → `null`, no crash
- [ ] `tape` songs are excluded entirely
- [ ] `road-tested` requires ≥ 14 days before release

### Integration

- [ ] ≥ 60% of non-cover unique pairs attributed
- [ ] `song-albums.json` ≤ 400 KB
- [ ] Full re-run with warm cache makes **0** network calls
- [ ] Pipeline degrades cleanly when `song-albums.json` is absent — detectors return `[]`, `get_concert_setlist` reverts to v5.4 output (snapshot)

### Known test data

| Fact | Value |
| --- | --- |
| Unique pairs | 1,865 across 130 artists |
| Cover performances | 369 of 2,731 |
| Setlists with songs | 187 of 371 entries |
| iTunes probe | *Never Let Me Down Again* → *Music for the Masses (Deluxe Edition)*, 1987-08-24 |
| MusicBrainz probe | Same song → 165 recordings, compilation-dominated (why per-song search was rejected) |

---

## Implementation Plan

### Phase 1 — Resolver Foundation (Window 1)

**Create:** `scripts/utils/song-title.ts`, `scripts/resolve-song-albums.ts`
**Modify:** `scripts/utils/musicbrainz-client.ts`, `package.json`

**Tasks:**
1. **Verify the v5.4 prerequisite** — `album-title.ts` and `album-eras.json` must exist
2. Add release-group track-listing fetch to the MusicBrainz client (1 req/sec, cached)
3. Implement Tier 0 and Tier 1; emit `song-albums.json` with tier stats
4. Backfill run over all 130 artists

**Acceptance:**
- [ ] Tier 0 + Tier 1 attribution rate reported; ≥ 60% floor met or gap explained by tier
- [ ] Warm-cache re-run makes 0 network calls

### Phase 2 — Fallback & Covers (Window 2)

**Modify:** `scripts/resolve-song-albums.ts`, `scripts/build-data.ts`, `scripts/validate-concerts.ts`
**Create:** `test/song-albums.test.ts`

**Tasks:**
1. Implement the Tier 2 iTunes fallback with studio-release-group gating
2. Implement cover routing via the `full-circle` original-artist resolution
3. Wire as build-data Step 9.6 with `--skip-song-albums`
4. Add validation; write the test suite

**Acceptance:**
- [ ] All negative tests pass — no guessing anywhere
- [ ] Covers never attributed to the performing artist
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

> **How to use this.** Appended as v5.4 windows land, so contract changes are captured while the reasoning is fresh rather than reconstructed archaeologically. A **full reconciliation pass happens at v5.4 ceremony** — this log makes that pass mechanical. Until then, treat every item below as amending the spec text above.

### Window 1 (#268–#270) — shipped 2026-08-07

**5 items. All contract-level, because v5.5's entire dependency surface is Window 1.**

1. **`album-title.ts` has no prefix tier.** Removed after measurement (13 of 766 matches, most wrong — see v5.4 spec §Part 1). Match rate is **73.5%**, not the 74.8% this spec's §Part 4 floor was reasoned against.
   → *Impact:* the ≥60% attribution floor was estimated from the higher figure. It is almost certainly still met — Tier 0/1 do the heavy lifting and neither depends on the prefix tier — but **re-derive the floor from a real Tier 0+1 run before treating it as an acceptance gate.**

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

### Window 3 (#272–#274) — pending

---

## Resolved Decisions

1. **Apple Music API — EXCLUDED.** Requires a $99/year Apple Developer membership, violating the no-incremental-cost constraint. The free, keyless **iTunes Search API** already used by `enrich-top-tracks.ts` supplies the same `collectionName` data and is used instead.
2. **Per-album indexing over per-song search.** Live probe showed per-song MusicBrainz search returns 165 compilation-dominated results for a single well-known track. Indexing our own studio release-groups eliminates the disambiguation problem rather than solving it.
3. **Scoped as v5.5, not folded into v5.4.** Different risk profile — two live API enrichment passes versus pure local derivation — and v5.4 is already the largest spec in `specs/future/`. The dependency runs one way: v5.5 consumes `album-title.ts`.

---

## Revision History

- **2026-08-07:** Initial specification created
- **2026-08-07:** Traceability table added; issues #267, #276–#277 created.
- **2026-08-07 (v1.1):** Drift log opened; Window 1 contract changes recorded (5 items).
- **Version:** 1.1.0
- **Author:** Lead architect (via Claude Code)
- **Status:** Planned
