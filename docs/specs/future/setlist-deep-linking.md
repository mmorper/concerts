# Setlist Deep Linking

**Status:** Proposed — not yet scheduled
**Target Version:** next
**Priority:** Medium
**Estimated Complexity:** Medium (small per surface; the cost is breadth, not depth)
**Dependencies:** None blocking. Touches the deep-link contract in [`docs/DEEP_LINKING.md`](../../DEEP_LINKING.md) (v1.2+)

---

## Executive Summary

The archive can deep-link to an **artist** (`?scene=artists&artist=depeche-mode`) and to a **venue**,
but not to **a specific night**. The gatefold renders a setlist for one show — Nile Rodgers at Pacific
Amphitheatre on July 31, 2026 — and there is no way to send that to anyone. You can share the artist
and ask them to click the right row.

This adds one URL parameter, `show`, keyed on concert date:

```
/?scene=artists&artist=nile-rodgers&show=2026-07-31
```

The parameter is **purely additive**. Every link ever shared, every sitemap entry, and every MCP tool
response resolves exactly as it does today; `show` is ignored when absent.

The work is small in any one place and spread across **six surfaces**. That breadth is the reason this
is a spec rather than a single issue — the URL grammar is a contract that five independent codebases
read, and changing it in one place without the others produces links that resolve differently
depending on who generated them.

**The single highest-value outcome** is not the share button. It is that `get_concert_setlist` — the
MCP tool that renders a setlist for one specific night — currently links to the artist and the venue
but has no link to *the setlist it just rendered*. That gap is structural, and this closes it.

---

## Why `show={date}` and not the alternatives

### Rejected: a dedicated route (`/artist/nile-rodgers/2026-07-31`)

The app has exactly one page. [`App.tsx`](../../../src/App.tsx) routes `/` to `MainScenes`, a
scroll-snap container where all six scenes are mounted simultaneously and navigation is
`scrollTo((sceneId - 1) * windowHeight)`. A route would have to render that same container and
translate itself back into a scroll offset.

This experiment has already been run in this codebase. `/ask` exists solely as
`<Navigate to="/?scene=ask" replace />`, and the comment beside it states why: *"Ask is the final
scene, not a separate page. /ask is kept as a friendly alias that lands on that scene (preserves the
URL + shareability + SEO)."* The dedicated route was demoted to an alias.

A route would also require teaching a second URL grammar to all five consumers listed below, including
the meta-injector — the only thing that makes these links unfurl properly when pasted into Slack.

### Rejected: `tab=setlists` (the sketch previously in DEEP_LINKING.md)

`DEEP_LINKING.md` v1.1 sketched `?scene=artists&artist=foo-fighters&tab=setlists` under Future
Enhancements. **This shape cannot express the feature.** It selects a tab; it does not identify which
show. It would land on the artist with a setlists tab open — not on a specific night's setlist.
Superseded by `show={date}` in v1.2.

### Rejected: `show={concert.id}`

`concert.id` values (`concert-1` … `concert-183`) are row-order artifacts. A data re-import that
renumbers rows would silently break every link ever shared. The same objection applies to the
`?scene=timeline&concert=concert-123` sketch in v1.1's Future Enhancements, which should be
reconciled to a date-keyed form if it is ever built.

### Accepted: `show={date}`

`date` is **globally unique across the archive** — verified against all 183 records in
`public/data/concerts.json`: zero artist+date collisions, zero same-date collisions across all
artists. It is stable, human-readable, self-describing in a pasted link, and is already half of the
key used to identify the open setlist at
[`ConcertHistoryPanel.tsx:201-202`](../../../src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx#L201-L202).

`artist` stays in the URL even though `date` alone would resolve, because it reuses the existing
`pendingArtistFocus` path unchanged and makes the link readable to a human.

**Uniqueness is a property of the current data, not an enforced invariant.** Two shows on one date is
physically possible (a festival; an early and late set). Every resolver must match on date **and**
artist where both are present, and fall back to first-match rather than erroring, so a link degrades
to the right gatefold instead of failing.

---

## The Six Surfaces

| # | Surface | File | Change |
|---|---------|------|--------|
| 1 | **Gatefold (SPA)** | `src/components/scenes/ArtistScene/`, `src/App.tsx` | Link icon in setlist panel + param parsing + three-stage restore |
| 2 | **MCP server** | `workers/mcp-server/src/tools.ts` | `showLink()` builder; use in `get_concert_setlist` |
| 3 | **Ask exhibits** | `workers/ask-chat/src/exhibits.ts` | `showDeepLink()` builder alongside artist/venue |
| 4 | **Facts / llm.txt** | `scripts/generate-facts.ts`, `public/llm{,s}.txt` | Route emission + documented grammar |
| 5 | **Liner notes** | `src/types/liner-notes.ts`, `scripts/liner-notes/curate.ts` | Widen `DeepLink.type` union |
| 6 | **SEO** | `scripts/generate-sitemap.ts`, `workers/meta-injector/worker.js` | Per-show URLs + meta (#193, #194) |

### 1. Gatefold — the origin

A link icon **in the setlist panel header**, beside the date and venue line, left of the ✕. Clicking it
copies the deep link to that setlist. Scoped to the Artist scene.

**Why the panel and not the gatefold header or the concert row:**

- **The row cannot know whether a setlist exists.** The Setlist button at
  [`ConcertHistoryPanel.tsx:237`](../../../src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx#L237)
  renders on `onSetlistClick && (...)` — that tests whether a *handler was passed*, not whether *data
  exists*. Every past concert gets one. Availability isn't resolved until `handleSetlistClick` opens the
  panel. A row-level icon would therefore point at nothing for 36% of shows (117 of 183 have setlists),
  or require plumbing availability into the row purely to gate it — which would expose the same
  pre-existing gap in the Setlist button and drag it into this feature's scope.
- **The referent is unambiguous.** Beside the artist name the icon has two plausible objects, and the
  artist *already* has a shareable URL. In the panel header, adjacent to the date and venue it links to,
  there is nothing to misread.
- **No state logic.** The panel exists only when a setlist is open, so the icon cannot occupy an invalid
  state. No hide/disable branch to write or test.
- **It joins an existing control cluster.** The panel header already carries the ✕.

Place it **left of the ✕ with clear spacing** — a destructive-adjacent control (close) and a generative
one (copy link) should not sit flush, or a mis-tap costs the user the panel they were about to share.

Bulk-copying links for many shows at once is not a journey worth optimizing for here: 64% of headliners
(69 of 107) have exactly one show, and the maximum is 8.

**Known consequence:** the affordance is only reachable after opening a setlist. That is correct — you
cannot share what you have not looked at — but it does mean the feature is invisible until a panel is
open. If discoverability proves a problem, the answer is a tooltip or first-run hint, not a second icon
elsewhere.

On load the URL must restore **three layers in sequence**: scroll to scene 5 → focus the artist
gatefold → expand that concert's setlist panel. The existing deep-link effect at
[`App.tsx:231-311`](../../../src/App.tsx#L231-L311) already does the first two via `pendingArtistFocus`
and a 100ms `setTimeout` before `scrollTo`. The setlist restore must **sequence behind** that timeout,
not race it.

`PhoneArtistModal.tsx` is a separate layout and needs the same treatment — #66 had to handle both.

Also extend `buildPagePath` / `buildPageTitle` in [`pageTracking.ts`](../../../src/utils/pageTracking.ts)
so GA4 distinguishes a setlist pageview from an artist pageview. Without this, shared-link traffic and
#36's `setlist_button_clicked` collapse into the same virtual pageview.

### 2. MCP server — the highest-value gap

[`tools.ts:751-800`](../../../workers/mcp-server/src/tools.ts#L751-L800) (`get_concert_setlist`) renders
a full setlist for one night and links only to the artist and venue. Meanwhile `LINK_NOTE`
([`tools.ts:843`](../../../workers/mcp-server/src/tools.ts#L843)) instructs the model: *"Each result ends
with an 'Open on the site' line of links — always include it."*

That promise is structurally unkeepable for the one tool where it matters most. Add:

```ts
function showLink(label: string, artistSlug: string, date: string): string {
  return `[${label}](${SITE_BASE_URL}/?scene=artists&artist=${artistSlug}&show=${date})`;
}
```

Use it in `get_concert_setlist`, and consider it for `surprise_me` (which already narrates setlist
songs as colour) and `on_this_day`.

### 3. Ask exhibits

[`exhibits.ts:151-152`](../../../workers/ask-chat/src/exhibits.ts#L151-L152) defines `artistDeepLink` and
`venueDeepLink` under a comment binding them to this document. Add `showDeepLink`. The exhibit schema
already carries concert ids ([`exhibits.ts:13`](../../../workers/ask-chat/src/exhibits.ts#L13): *"kind,
entity slugs, concert ids, deep-links, ordering"*), so the data needed is present.

### 4. Facts and llm.txt

`generate-facts.ts` emits a `route` per fact; facts about a specific night should route to it. Its test
asserts every route matches `^/\?scene=` — a constraint `show` satisfies, which is itself evidence the
param approach fits.

`public/llm.txt` and `public/llms.txt` document the URL grammar for LLM consumers and must list `show`.
Pairs naturally with open issue #30.

### 5. Liner notes — do this now, not later

[`liner-notes.ts:39`](../../../src/types/liner-notes.ts#L39) declares:

```ts
type: "artist" | "venue" | "timeline";
```

A closed union. Setlist links need a fourth member, which touches `buildDeepLinks()`
([`curate.ts:424`](../../../scripts/liner-notes/curate.ts#L424)) and both renderers
(`LinerNoteCard.tsx:158`, `LinerNotePermalink.tsx:205`).

No story needs this today. Widen it anyway, in the same pass as the URL grammar. The union is the kind
of structure that calcifies: every generator, validator, and renderer written against three members
makes the fourth more expensive. #68's deferred generators (`doubleHeader`, `temporalPattern`) are
precisely the story types that would reach for a specific night.

### 6. SEO — already filed

- **#193** — sitemap per-show URLs + `injectShowMeta` in the meta-injector
- **#194** — per-show 1200×630 OG cards, modeled on `scripts/liner-notes/og-image.ts`

**Setlist coverage: 117 of 183 concerts (64%)** have a setlist with songs on record. Measured from
`setlists-cache.json`: 369 entries → 185 with songs → 117 distinct `concertId`s (multiple entries per
concert because openers get their own setlist.fm lookup —
[`tools.ts:576`](../../../workers/mcp-server/src/tools.ts#L576)). This corroborates the ~64% figure in
`global-mcp-setlists-top-songs.md`. Sitemap emission should gate on setlist availability: 117 URLs in,
66 skipped and logged.

---

## Contract Changes — `docs/DEEP_LINKING.md` v1.2

Not optional. `exhibits.ts:150` binds the worker and the SPA to this document by name.

1. Add `show` to the Parameters table
2. New "Setlist Deep Links" section under Entity Deep Links
3. Remove the superseded `tab=setlists` sketch from Future Enhancements, with a note explaining why
4. Reconcile the `concert=concert-123` sketch to a date-keyed form

### Drift correction (found while writing this spec)

`DEEP_LINKING.md` v1.1 lists under **Future Enhancements** three things that are already shipped:

| Sketch | Reality |
|--------|---------|
| `?scene=timeline&year=2024` | **Implemented** — [`App.tsx:238`](../../../src/App.tsx#L238) parses `year` and sets `pendingYearFocus` |
| `?scene=genres&genre=…` | **Partially implemented** — meta-injector handles it ([`worker.js:126`](../../../workers/meta-injector/worker.js#L126)); the SPA does not |
| `?scene=geography&region=…` | **Partially implemented** — meta-injector handles it ([`worker.js:128`](../../../workers/meta-injector/worker.js#L128)); the SPA does not |

The `genre` and `region` cases are a genuine behavioural split worth noting on its own: **a crawler
gets tailored meta for a URL the app does not act on.** Share a genre link and the unfurl promises a
filtered view the visitor never sees. Out of scope here — flagged for its own issue.

---

## Acceptance Criteria

- [ ] `/?scene=artists&artist=nile-rodgers&show=2026-07-31` opens the gatefold with that setlist expanded
- [ ] Works in both desktop gatefold and `PhoneArtistModal`
- [ ] Link icon in the **setlist panel header** (left of the ✕) copies the URL for that setlist
- [ ] Artist-only URLs behave **identically** to today — no regression
- [ ] Unresolvable `show` degrades to the artist gatefold, no error state
- [ ] `get_concert_setlist` includes a link to the show it rendered
- [ ] `DeepLink.type` accepts a setlist member; renderers handle it
- [ ] `DEEP_LINKING.md` at v1.2 with the superseded sketch removed
- [ ] GA4 distinguishes setlist pageviews from artist pageviews

---

## Related Documentation

- [Deep Linking Guide](../../DEEP_LINKING.md) — the normative URL contract
- [MCP Setlists & Top Songs](../implemented/global-mcp-setlists-top-songs.md) — setlist data + coverage
- [Artist Scene](../implemented/artist-scene.md) — gatefold system
- [Agentic Liner Notes v3](../implemented/agentic-liner-notes-v3.md) — `DeepLink` producers
