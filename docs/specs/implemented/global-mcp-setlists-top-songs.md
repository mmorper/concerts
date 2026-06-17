# MCP Setlists & Top Songs

**Status:** Implemented — shipped to production 2026-06-17 (#136, #137)
**Target Version:** next (MCP follow-on; archive currently v4.6.1)
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** MCP server (#102, active workstream); setlist + top-tracks data pipeline (already shipped)

---

## Executive Summary

The MCP server narrates concert history but has **no first-class way to ask about songs**. Both
underlying datasets already exist and ship to production — `setlists-cache.json` (setlist.fm) and
`artists-top-tracks.json` (iTunes) — but the server only *glances* at them: `surprise_me` shows two
setlist songs as colour, and `get_artist_history` shows two top tracks as a "Known for…" line. Nobody
can actually ask **"what did Garbage play the night I saw them?"** or **"what songs come up most across
the whole archive?"**

This feature exposes that song knowledge as queryable tools, in three tiers of increasing effort:

- **Tier 1 — Expose what exists:** a `get_concert_setlist` tool (by artist + date / concert id) and a
  fuller top-tracks surface in `get_artist_history`. No pipeline changes; pure narration + registration.
- **Tier 2 — Archive-wide "most played songs":** genuinely new — nothing aggregates songs across
  setlists today. Adds a `build-data` step that emits `most-played-songs.json`, plus a
  `get_archive_top_songs` tool.
- **Tier 3 — Cross-cutting analysis** (songs seen at multiple shows, tour/setlist overlap): open-ended,
  scoped here as Future Enhancements only.

The defining constraint is **not code — it's coverage**. Only ~64% of concerts have a usable setlist,
and many of the rest were looked up and came back empty. The work that matters most is **how we narrate
the gaps** so the tools feel honest rather than broken.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the MCP Setlists & Top Songs feature for Morperhaus Concerts.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and provide a handoff summary
- Implement the spec AS WRITTEN — it's the source of truth
- Ask clarifying questions if anything is ambiguous

**Feature Overview:**
- Add MCP tools that expose song-level knowledge the server already has data for
- Tier 1: get_concert_setlist tool + fuller top-tracks in get_artist_history
- Tier 2: most-played-songs.json aggregation + get_archive_top_songs tool
- Coverage is partial (~64% of shows have setlists) — graceful fallback is the core UX work

**Key References:**
- Full Spec: docs/specs/future/global-mcp-setlists-top-songs.md
- MCP tools (I/O seam + narration): workers/mcp-server/src/tools.ts
- MCP data layer (file registry, hydration): workers/mcp-server/src/data.ts
- MCP types: workers/mcp-server/src/types.ts
- Setlist build step: scripts/prefetch-setlists.ts
- Pipeline orchestrator: scripts/build-data.ts

**Build the pure narration functions first (testable, no I/O), then wire the I/O seam in
registerTools(). Match the existing seam pattern exactly. Add snapshot tests in tools.test.ts.**

Let's start with Tier 1, Window 1.
```

---

## Design Philosophy

The MCP server's architecture is a **narration / I/O seam split** (see [tools.ts](../../../workers/mcp-server/src/tools.ts)):

- **Pure narration functions** (`artistHistory`, `venueHistory`, `surpriseMe`, …) take already-loaded
  data and return a string. They are deterministic and unit-tested by snapshot in
  [tools.test.ts](../../../workers/mcp-server/src/tools.test.ts).
- **`registerTools()`** (the I/O seam, [tools.ts:699](../../../workers/mcp-server/src/tools.ts#L699))
  fetches data via the [data.ts](../../../workers/mcp-server/src/data.ts) layer, then calls a narration
  function.

Every new tool in this feature **must follow that split** — a pure `concertSetlist(...)` /
`archiveTopSongs(...)` function plus a thin registration block. This keeps the coverage/fallback logic
fully testable without network I/O.

Voice follows the existing tools: the archive speaks in first person ("I have the setlist…", "I don't
have a setlist on record for that one"). Tool descriptions read as the archive offering them
(see `DESC`, [tools.ts:627](../../../workers/mcp-server/src/tools.ts#L627)).

---

## Data Reality (read this before writing any narration)

Verified against `public/data/setlists-cache.json` on 2026-06-17:

| Metric | Value |
|--------|-------|
| Total concerts in archive | 183 |
| Distinct concertIds in setlist cache | 183 (1:1) |
| Concerts with ≥1 setlist that has songs | **117 (64%)** |
| `setlist === null` entries (lookup ran, none found) | 79 |
| Non-null entries with **empty** song lists | 105 |
| **Concerts with MULTIPLE setlist entries that have songs** | **34** |
| Artists with top-tracks | 258 |

Schema (`types.ts:95–141`): songs live at `setlist.sets.set[].song[].name`. `setlistSongs()` already
flattens this ([tools.ts:532](../../../workers/mcp-server/src/tools.ts#L532)).

### The four failure modes a setlist tool MUST handle

1. **No cache entry for the concert** → "I don't have a setlist on record for that show."
2. **`setlist === null`** (looked up, setlist.fm had nothing) → same graceful message; do **not** imply
   the show didn't happen or that data is forthcoming.
3. **Non-null but empty song list** (105 entries) → treat identically to null; never emit "the setlist
   was: (nothing)".
4. **Multiple entries for one concertId** (34 concerts — because the headliner *and* openers each get a
   setlist.fm lookup). The current `setlistSongs()` uses `.find()`
   ([tools.ts:533](../../../workers/mcp-server/src/tools.ts#L533)) and silently returns the **first**
   match, which may be an opener's set, not the headliner's. **Tier 1 must fix this:** match the entry
   whose `artistName` corresponds to the concert's headliner; fall back to the longest song list if no
   artist match; and when showing an opener's set, label it as such.

> **Coverage honesty rule:** Any tool that can miss MUST state the miss in one plain sentence and offer
> a working alternative ("…but I can tell you who opened, or pull their best-known tracks"). A tool that
> returns an empty or apologetic-but-dead-end response on 36% of inputs reads as broken.

---

## Technical Implementation

### Tier 1 — Expose existing data (no pipeline changes)

**New narration function** in `tools.ts`:

```ts
// Resolve concert by artist+date or by id, dedupe multi-entry by headliner, narrate gaps.
export function concertSetlist(
  concerts: Concert[],
  setlists: SetlistsCache | null,
  args: { artist?: string; date?: string; concertId?: string },
): string
```

Behaviour:
- Resolve the concert (reuse `resolveArtist` patterns; match on date when given).
- Pick the correct setlist entry per the **multi-entry rule** above.
- If songs exist: list them in order, with tour name when present (`setlist.tour.name`).
- If not: emit the graceful fallback + offer openers / top tracks.
- Append the standard `linkFooter(...)` so the "Open on the site" block is preserved.

**Registration** in `registerTools()` ([tools.ts:699](../../../workers/mcp-server/src/tools.ts#L699)),
mirroring `get_artist_history`:

```ts
server.registerTool(
  "get_concert_setlist",
  {
    title: "Concert setlist",
    description: DESC.setlist, // add to DESC map (~line 627)
    inputSchema: {
      artist: z.string().optional(),
      date: z.string().optional(),       // ISO-ish; resolves a specific night
      concertId: z.string().optional(),  // e.g. "concert-59"
    },
  },
  wrapTool("get_concert_setlist", async (args) => {
    const data = await getConcerts(env, bgCtx);
    if (!data) return dataUnavailableResult();
    const setlists = await getSetlistsCache(env, bgCtx);  // already a LAZY file
    return textResult(concertSetlist(data.concerts, setlists, args as any));
  }),
);
```

**Top-tracks enhancement (optional sub-task):** widen the `get_artist_history` "Known for…" line
([tools.ts:388](../../../workers/mcp-server/src/tools.ts#L388)) from 2 to ~5 tracks, or add a dedicated
section. Pure narration change; data already hydrated via `getArtistsTopTracks`.

**No data-layer changes for Tier 1** — both `setlists-cache.json` and `artists-top-tracks.json` are
already registered as `LAZY_FILES` ([data.ts:63](../../../workers/mcp-server/src/data.ts#L63)) with
getters in place.

### Tier 2 — Archive-wide most-played-songs (new data + tool)

**Pre-hydration / data flow (critical — read carefully):**

The MCP server is a Cloudflare Worker that fetches JSON from `DATA_BASE_URL`
(`https://concerts.morperhaus.org/data`) and caches via `caches.default` with a 300s TTL
([data.ts:18](../../../workers/mcp-server/src/data.ts#L18)). Files are split into two hydration tiers
([data.ts:57–67](../../../workers/mcp-server/src/data.ts#L57)):

- **`LOAD_FILES`** — eager; warmed on cold start via `prefetchLoadFiles` under `ctx.waitUntil`.
- **`LAZY_FILES`** — fetched on first tool use; warmed in the background via `prefetchLazyFiles`.

A new aggregation file is required because **nothing computes cross-setlist song frequency today**.

1. **Generate the data.** Add a step to [scripts/build-data.ts](../../../scripts/build-data.ts) (it
   already runs `prefetch-setlists`) that reads `setlists-cache.json`, dedupes per concert by headliner
   (same rule as Tier 1), counts song frequency, and writes
   `public/data/most-played-songs.json`. Expected shape:

   ```jsonc
   {
     "version": "1",
     "generatedAt": "2026-06-17T…",
     "coverage": { "concertsWithSetlist": 117, "totalConcerts": 183 },
     "songs": [ { "name": "Ring of Fire", "count": 7, "artists": ["…"] }, … ]
   }
   ```

   **Data-quality cleanup the raw counts already expose** (verified): drop empty-string song names;
   normalise case/punctuation so near-duplicates merge; decide whether a song played by *different
   artists* (e.g. "Ring of Fire" appears 7× across artists) counts once or per-artist — **surface this
   ambiguity in the narration**, don't hide it.

2. **Register the file for hydration.** Add `"most-played-songs.json"` to `LAZY_FILES`
   ([data.ts:63](../../../workers/mcp-server/src/data.ts#L63)) — it is small and only one tool needs it,
   so lazy + background-warm is correct; do **not** add it to `LOAD_FILES` (keeps cold-start payload
   lean). Add a `getMostPlayedSongs()` getter following the existing pattern
   ([data.ts:123](../../../workers/mcp-server/src/data.ts#L123)).

3. **Type it** in `types.ts` alongside `SetlistsCache` (~line 120).

4. **Narrate + register** `archiveTopSongs(...)` and a `get_archive_top_songs` tool. The narration MUST
   open with the coverage caveat ("Across the 117 of 183 shows I have setlists for, the songs that come
   up most are…") so the numbers are never mistaken for the whole archive.

### Tier 3 — Future only

Songs-seen-at-multiple-shows, tour/setlist overlap, "rarest song I've witnessed". Open-ended; specify
separately if Tier 1/2 land well.

---

## Testing Strategy

### Unit (snapshot) — add to `tools.test.ts`

- [ ] `concertSetlist` — concert WITH songs (full list + tour name)
- [ ] `concertSetlist` — `setlist === null` → graceful fallback wording
- [ ] `concertSetlist` — non-null but empty songs → same fallback (not "(nothing)")
- [ ] `concertSetlist` — concertId not in cache → graceful fallback
- [ ] `concertSetlist` — **multi-entry concert** picks the HEADLINER's set, labels openers
- [ ] `concertSetlist` — ambiguous artist → disambiguation prompt (reuse `resolveArtist`)
- [ ] `concertSetlist` — link footer present
- [ ] `archiveTopSongs` — coverage caveat present; empty-name songs excluded
- [ ] `archiveTopSongs` — `most-played-songs.json` missing → `dataUnavailableResult()` path

### Manual

- [ ] Live MCP call: `get_concert_setlist` for a known-good show (e.g. `concert-59`, has 12 songs)
- [ ] Live MCP call: a show with no setlist → reads honest, offers an alternative
- [ ] `get_archive_top_songs` numbers match a local recount of `setlists-cache.json`
- [ ] No regressions in `surprise_me` / `get_artist_history` (shared helpers untouched or improved)

### Test data (verified 2026-06-17)

- High-coverage concertIds (multi-entry): `concert-59` (12), `concert-21` (4), `concert-42` (3)
- Archive top songs head: Ring of Fire (7), Only Happy When It Rains (6), Stupid Girl (6),
  Cherry Lips (6), Push It (6), Ball and Chain (6)

---

## Implementation Plan

### Phase 1 — Tier 1 (Window 1)

**Files to Modify:**
- `workers/mcp-server/src/tools.ts` — add `concertSetlist`, fix multi-entry selection in/around
  `setlistSongs`, add `DESC.setlist`, register `get_concert_setlist`; optional top-tracks widen
- `workers/mcp-server/src/tools.test.ts` — snapshot tests above

**Acceptance Criteria:**
- [ ] `get_concert_setlist` returns ordered songs for covered shows
- [ ] All four failure modes produce honest, alternative-offering responses
- [ ] Multi-entry concerts resolve to the headliner's set
- [ ] Link footer preserved; tests pass

### Phase 2 — Tier 2 (Window 2)

**Files to Create:**
- `public/data/most-played-songs.json` (generated)

**Files to Modify:**
- `scripts/build-data.ts` — aggregation + cleanup step
- `workers/mcp-server/src/data.ts` — `LAZY_FILES` entry + `getMostPlayedSongs()`
- `workers/mcp-server/src/types.ts` — `MostPlayedSongs` type
- `workers/mcp-server/src/tools.ts` — `archiveTopSongs` + `get_archive_top_songs`
- `workers/mcp-server/src/tools.test.ts` — tests

**Acceptance Criteria:**
- [ ] `npm run build-data` regenerates `most-played-songs.json` deterministically
- [ ] Empty/duplicate song names cleaned; cross-artist counting decision documented in output
- [ ] Tool output leads with the coverage caveat
- [ ] File hydrates lazily; cold-start payload unchanged

---

## Future Enhancements

- Tier 3 cross-cutting analysis (overlap, rarest, per-decade song trends)
- Backfill setlist coverage (re-run `prefetch-setlists` with better fuzzy matching for the 79 misses)
- "Top tracks" as a standalone `get_artist_top_tracks` tool if `get_artist_history` feels crowded

---

## Questions for Review

- **Cross-artist song counting** in Tier 2: merge "Ring of Fire" across all artists into one count, or
  keep per-artist? (Affects whether the list reads as "songs *I* saw most" vs "covers/standards".)
  → Recommend: report the merged count but name the artists, so both readings are available.
- **Tier 1 input ergonomics:** is `artist + date` the primary path, with `concertId` as the power-user
  escape hatch? (The `[concert-NN]` ids already appear in other tool outputs, so the model can chain.)
- **Scope of this release:** ship Tier 1 alone first (cheap, validates the UX), then decide on Tier 2?
  → Recommended, per the iterate-fast working style.

---

## Revision History

- **2026-06-17:** Initial specification created. Coverage/fallback numbers verified against
  `setlists-cache.json`. Multi-entry-per-concert correctness issue identified.
- **Version:** 1.0.0
- **Status:** Planned
