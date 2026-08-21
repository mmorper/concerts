# Personal Media Audit & Curation Tool

> **Status**: Planned
> **Priority**: High — blocks #338, which blocks #339, #340, #325
> **Effort**: Medium (standalone local tooling, no app changes)
> **Target Scene**: None — this is a local-only utility, not a site feature
> **Issue**: [#338](https://github.com/mmorper/concerts/issues/338) · Part of [#323](https://github.com/mmorper/concerts/issues/323)
> **Last Updated**: 2026-08-21

---

## Problem Statement

#338 needs one number: **how many shows have personal imagery good enough to publish.**
The working estimate is "maybe 20." Everything downstream — the ingest design in #339,
the index schema in #340, whether Track D is a garnish or a primary direction in #325 —
is sized by that answer.

The distinction that matters is **usable**, not **exists**. Concert photography from a
phone skews blurry, dark, and full of the back of someone's head. A bad photo published
under a first-person byline is worse than no photo at all.

The obvious approach — open Photos, scroll to each of 101 concert dates, eyeball what's
there — is slow, and worse, it's *inconsistent*. The bar you apply to show 3 is not the
bar you apply to show 84. An audit whose answer depends on when in the afternoon you
looked at a given show is not an audit.

### What the archive can support

Computed from `public/data/concerts.json`:

| Era | Shows | Share |
|---|---|---|
| Pre-2007 (film / no phone) | 66 | 36% |
| 2007–2011 (early phone, poor cameras) | 17 | 9% |
| 2012–2016 (usable stills) | 30 | 16% |
| 2017+ (good cameras, 4K video) | 71 | 39% |

**Hard ceiling: 101 shows (55%) could plausibly have stills; 71 (39%) could have decent
video.** Everything before 2012 is out of reach regardless of effort.

---

## Proposed Solution

A local command-line tool plus a browser-based review page. The machine narrows tens of
thousands of photos to a few hundred worth a human glance; the human makes every real
judgment call.

Built as a **reusable query tool**, not a one-off audit script. The #338 audit is its
first use — "everything, grouped by show, no filters." Later uses are things like
"find me everything from the Greek Theatre" or "video only, 2019 onward."

### Non-goals

- **Not a Photos replacement.** It reads; it never writes to the library.
- **Not automatic curation.** Scores rank candidates; they never accept or reject.
- **Not part of the site.** Nothing here ships to `concerts.morperhaus.org`. It runs on
  one Mac and emits text files that get committed.
- **Not an ingest pipeline.** Actually publishing selected media is #339/#340. This tool
  stops at "here is the list, and here are the files."

---

## Architecture

```
concerts.json  ─┐
                ├─►  [1] build query  ─►  windows (date + geo per show)
venues coords  ─┘

Photos catalog ─►  [2] query        ─►  candidates.json   (metadata only)

                   [3] export       ─►  ~/concert-audit/  (1200px previews)

                   [4] review       ─►  audit.md + selects.json
```

### Stage 1 — Build the query

Reads `public/data/concerts.json`. Each eligible show becomes a search window:

- **Time**: 17:00 on the show date → 04:00 the following morning.
  Photos stores naive *local* time, so a Los Angeles show and a DC show both fall in the
  same local window with no timezone arithmetic. This is a genuine simplification, not a
  shortcut.
- **Geo**: haversine against `concert.location.lat/lng`. Default radius 500m; 1500m for
  amphitheatres and festival grounds (configurable per venue).

Pure text in, text out. Photos is not touched at this stage.

### Stage 2 — Query the catalog

Runs the windows against the Photos library via [`osxphotos`](https://github.com/RhetTbull/osxphotos)
(MIT, third-party, not Apple).

**Matching is `date AND (geo OR no-geo)`, not `date AND geo`.** A large share of phone
photos have location services off entirely; requiring geo would silently bias the count
downward, which is precisely the error this audit exists to avoid. Where geo *is*
present it is used in the negative — photos on a show date taken at home are family
stuff, not the show.

Secondary signals captured per asset:

| Signal | Source | Use |
|---|---|---|
| Aesthetic scores | `ZCOMPUTEDASSETATTRIBUTES` via `photo.score` | Ranking |
| Detected labels | Photos ML (*Stage*, *Crowd*, *Guitar*, *Text*) | Subject pre-tagging |
| EXIF ISO / focal length | `photo.exif_info` | High ISO + long lens ≈ stage shot |
| Burst / time clustering | Timestamps within 10s | Near-duplicate collapsing |
| Duration | Movies only | The ~5s gate |

The scores map onto the #338 gates almost directly:

| #338 gate | Photos score |
|---|---|
| Sharp enough | `sharply_focused_subject` |
| Lit enough | `low_light` (inverted), `pleasant_lighting` |
| Framed enough | `well_framed_subject`, `well_chosen_subject`, `intrusive_object_presence` |
| Overall keeper | `overall`, `curation`, `promotion` |

**These are used to rank, never to gate.** Apple's model was trained on general
photography, not dark rooms with coloured lights, and may score concert work harshly
across the board. Stage 2 therefore emits the score *distribution* first; the cutoff is
chosen from what the library actually looks like rather than guessed in advance.

Output: `candidates.json`. Metadata only — no images have moved.

### Stage 3 — Export previews

Copies each surviving candidate out at **1200px wide** into `~/concert-audit/`, one
folder per show.

1200px is deliberate: #338's sharpness gate is written as *"in focus at 1080px wide."*
The review lightbox therefore shows each image at essentially the exact size the gate is
written for — no judging a proxy and extrapolating.

Displayed at ~400px in the grid (CSS downscale, one export serves both tiers), so the
lightbox costs no second pass and opens instantly from local disk.

### Stage 4 — Review

Generates `index.html` beside the exported folders. Opened via `file://` in Safari. No
server, no network, works offline.

See **[mock-review-page.html](mock-review-page.html)** for the interaction design.

---

## Safety & the Photos library

**Read-only, by mechanism rather than by promise.** `osxphotos` copies the library's
SQLite catalog to a temp location and reads the copy — it never holds the real database
open, which is exactly what prevents the classic two-processes-one-database corruption.
Originals are only ever read and copied out.

Honest caveats, recorded so they are not discovered later:

- The tool *does* contain commands that write to a library — `import` (adds photos) and
  `timewarp` (rewrites dates). **This workflow uses only `query` and `export`, which
  cannot modify the library.** The wrapper must never shell out to anything else.
- macOS will prompt for Photos access / Full Disk Access for the terminal. Expected and
  required.
- `osxphotos` reverse-engineers an undocumented Apple schema, so the realistic failure
  mode is **version lag** after a macOS upgrade — "doesn't run yet," not "ate the
  library." Run audits before OS upgrades, not immediately after.
- Take a Time Machine snapshot before the first run. Not because a problem is expected,
  but because it makes the whole thing recoverable regardless.

---

## iCloud / Optimize Mac Storage

The library in question runs **Optimize Mac Storage**, so full-resolution originals may
live only in iCloud.

This mostly does not matter. Photos keeps **local preview versions** (typically ~2048px)
of everything, which is more than enough to judge sharp / lit / framed. **Stages 1–4 run
entirely offline with zero downloads.**

Originals are needed only for assets actually selected for publication:

1. **Targeted, automatic** *(preferred)* — export with `--download-missing` against the
   approved shortlist only. 25 approved photos means 25 downloads.
2. **Targeted, manual** — select in Photos, `File → Export → Export Unmodified Original`.
3. **Everything** — `Photos → Settings → iCloud → Download Originals to this Mac`.
   Requires disk for the entire library. Not recommended for this.

iCloud fetches can be slow and occasionally time out, so downloads run in small batches
and **failures are reported explicitly, never silently skipped**.

The resolution gate (≥1080×1350 after crop) is checked against the catalog's recorded
dimensions, which are correct regardless of whether the original is local.

---

## CLI design

```
concert-media                                  # everything, grouped by show (#338 run)
concert-media --from 2017 --to 2019
concert-media --artist depeche-mode
concert-media --venue the-anthem
concert-media --video-only --min-duration 8
concert-media --decade 2010s --min-score 0.6
concert-media --subject stub                   # ticket stubs → Track C
```

Because it reads `concerts.json`, every dimension the archive knows — artist, venue,
genre, city, decade, date — is available as a filter, and results come back labelled
with the artist and venue rather than as bare filenames. Named queries are savable in a
small config file so recurring ones are not retyped.

---

## Culling methodology

The interaction design exists to enforce four rules. They are mostly about what *not* to
do.

### 1. Two decisions, two passes

*"Is this technically usable?"* and *"is this the best shot from this night?"* are
different questions, and merging them is what makes culling exhausting.

- **Pass one** — per image, fast, answers only the first. Produces the #338 count.
- **Pass two** — over survivors only, picks one hero per show. Produces what actually
  gets published.

### 2. Binary, never a rating scale

Star ratings invite endless re-litigation. One key means *usable*; everything else is a
no by default. A second key marks *hero*. No maybes.

### 3. Collapse near-duplicates before they are ever seen

The single largest time saving. Twelve frames of the same guitar solo become one tile
showing the best-scored frame with a `+11` badge. One decision instead of twelve.
Expandable when the top frame is not the right one.

### 4. Bias hard toward rejection; treat hesitation as the answer

#338's own logic: a bad photo under a first-person byline is worse than no photo. If it
needs weighing up, it is out — hesitation is itself the signal.

### Calibration

Before judging anything for real, the page shows twenty candidates sampled across the
whole set, so the bar is set against the actual range. Without this, show 3 and show 84
get judged by different standards and the resulting count means nothing.

### Subject tagging rides along

#338 also wants the performer / venue / crowd / stub mix. One extra keystroke, applied
**to keepers only** — roughly twenty extra presses in total, not a second pass over
everything. Photos' own detected labels pre-fill the guess.

---

## Video

Video is not "photos but longer." Four real differences:

1. **Scores are weaker.** Apple computes aesthetics largely against a still frame, and
   several fields are commonly empty for movies. The automatic filter is therefore much
   blunter for video — realistically duration, resolution, time and place only. Expect
   to eyeball a higher share of video candidates.
2. **A poster frame proves nothing.** The gate is *"~5 usable seconds, stable enough to
   watch"* — a playback judgment. Thumbnails cannot answer it.
3. **Hence two passes for video.** Pass one on poster frame + duration, offline and
   cheap, kills the 3-second fragments and pocket recordings. Pass two downloads only
   the survivors and plays them inline.
4. **Optimize Storage bites harder.** A minute of 4K is large, local video previews are
   low-resolution, and downloads are slow. Batch and report.

**Live Photos** get their own category. Many 2017+ stills carry a 3-second motion clip
never thought of as video — a hidden Track D pool, and often steadier than handheld
video precisely because no one was trying to film.

---

## Outputs

### `audit.md` — the #338 deliverable

```markdown
| Date | Artist | Venue | Stills | Clips | Live | Subjects |
|---|---|---|---|---|---|---|
| 2017-10-12 | Foo Fighters | The Anthem | 3 | 1 | 0 | performer, crowd |
| 2018-04-27 | Beck | The Anthem | 1 | 0 | 2 | performer |
| 2019-08-02 | The National | Wolftrap | 0 | 0 | 0 | — |

**Shows with ≥1 usable still: 24 / 101 (24%)**
**Compound liner-note hit rate: 42% × 24% ≈ 10%**
```

Committed to this directory.

### `selects.json` — machine-readable

Per-asset UUIDs, show ID, verdict, hero flag, subject tag, scores. Feeds #339 ingest and
#340 index schema without a second review pass. Not committed if it contains anything
identifying beyond UUIDs — decide at implementation.

### The number that matters

If it lands near 8%, personal media is a garnish and Track B (generative) stays the
workhorse. If it lands near 30%, Track D becomes primary and the media ladder in #325
gets rebuilt around it.

---

## The shortcut worth considering first

The deliverable is a *decision* — "8% or 30%?" — and a decision does not need a census.
A random sample of 30 of the 101 eligible shows separates those two answers comfortably
(±9pp). If the sample lands ambiguously in the middle, run the full pass.

The tool supports this directly: `concert-media --sample 30`. Worth doing before
committing to the full audit.

---

## Implementation plan

### Phase 1 — Query engine

**Create:** `scripts/media-audit/query.py`, `scripts/media-audit/README.md`

- Read `concerts.json`, build date + geo windows
- Shell out to `osxphotos query --json`
- Burst clustering, score normalisation, distribution report
- Emit `candidates.json`

**Acceptance:**
- [ ] Runs read-only; verified no writes to the library bundle
- [ ] Score distribution printed before any cutoff is applied
- [ ] Handles assets with no location without dropping them
- [ ] Reports shows with zero candidates explicitly (a real finding, not a gap)

### Phase 2 — Export & page generation

**Create:** `scripts/media-audit/export.py`, `scripts/media-audit/template.html`

- Export 1200px previews, one folder per show
- Generate `index.html` with embedded candidate data
- Poster frames for video; Live Photo detection

**Acceptance:**
- [ ] Zero network traffic when originals are in iCloud
- [ ] Export is resumable — re-running skips what exists
- [ ] Total export size reported before it starts

### Phase 3 — Review page

**Create:** the real page, from `mock-review-page.html`

- Calibration pass, grid, lightbox, burst stacks
- Keyboard model, undo, continuous save to `localStorage`
- Export to `audit.md` + `selects.json`

**Acceptance:**
- [ ] Progress survives a browser quit mid-show
- [ ] Every action undoable
- [ ] Markdown output pastes straight into #338

### Phase 4 — Filters & reuse

- CLI filter flags, saved named queries
- `--sample N`
- `--download-missing` for the approved shortlist, batched, failures reported

---

## Open questions

1. **Where do exported previews live?** `~/concert-audit/` outside the repo, or a
   gitignored path inside it? Outside is cleaner; inside makes the review page easier to
   find. *Leaning outside.*
2. **Does `selects.json` get committed?** UUIDs alone are harmless and useful to #339.
   Anything more (filenames, timestamps, coordinates) is personal data in a public repo.
   *Leaning: commit UUIDs + show IDs only.*
3. **Burst window of 10s** — right for concert shooting, or too aggressive? Worth
   checking against one real show before locking it in.
4. **Pre-2012 shows.** Genuinely out of reach for phone media, but scanned ticket stubs
   and film prints may exist offline. Out of scope here; worth a separate note on #325.
5. **Is 20 the right calibration sample?** Enough to see the range without becoming a
   chore in its own right — but untested.

---

## Related

- [#338](https://github.com/mmorper/concerts/issues/338) — Inventory audit (this spec's reason to exist)
- [#339](https://github.com/mmorper/concerts/issues/339) — Submission + ingest (sized by the output)
- [#340](https://github.com/mmorper/concerts/issues/340) — Index schema + resolution ladder
- [#325](https://github.com/mmorper/concerts/issues/325) — Track D coverage claim to be corrected
- `docs/LINER_NOTES_PIPELINE.md` — where media eventually attaches
- [osxphotos](https://github.com/RhetTbull/osxphotos) — MIT, third-party, not an Apple product

---

*Last updated: 2026-08-21*
