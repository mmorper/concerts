# Personal Media Audit & Curation Tool

> **Status**: Planned
> **Priority**: High — sizes #338, and blocks #339 / #340. Does **not** block #325; the
> creative exploration runs in parallel (decided 2026-08-21).
> **Effort**: Medium (standalone local tooling, no app changes)
> **Target Scene**: None — this is a local-only utility, not a site feature
> **Issue**: [#338](https://github.com/mmorper/concerts/issues/338) · Part of [#323](https://github.com/mmorper/concerts/issues/323)
> **Last Updated**: 2026-08-21

---

## Problem Statement

#338 needs one number: **how many shows have personal imagery good enough to publish.**

> **Reframed 2026-08-21.** An earlier version of this spec cast the audit as a strategic
> fork — "if it lands near 8%, personal media is a garnish; if near 30%, it becomes
> primary." **That fork is closed.** The imagery rubric is decided and does not depend on
> N: personal beats sourced beats derived, always, and derived is the floor rather than
> the workhorse. See `global-social-syndication.md` § "The imagery rubric".
>
> What the audit still decides is **sizing**, which is plenty: storage (commit vs R2),
> the ingest design in #339, the index schema in #340, and how often the tier-2 fallback
> actually has to fire. The old "maybe 20" estimate is withdrawn and must not be used as
> a planning input.

The distinction that matters is **usable**, not **exists**. Concert photography from a
phone skews blurry, dark, and full of the back of someone's head. A bad photo published
under a first-person byline is worse than no photo at all.

The obvious approach — open Photos, scroll to each of 101 concert dates, eyeball what's
there — is slow, and worse, it's *inconsistent*. The bar you apply to show 3 is not the
bar you apply to show 84. An audit whose answer depends on when in the afternoon you
looked at a given show is not an audit.

### What the archive can support

The coverage ceiling, the pre-2012 cutoff, and the detector anti-correlation that makes
the compound hit rate so much lower than the raw coverage are all measured in
[`global-social-syndication.md` § Personal Media](../global-social-syndication.md#personal-media).
Not restated here — that spec is the source of truth for the strategy; this one covers
only the tooling that turns its estimate into a count.

The numbers this tool must produce — **two, not one**:

1. **How many of the 101 eligible shows carry at least one usable still.** The headline
   coverage figure.
2. **How many carry usable 9:16-capable video.** New requirement as of 2026-08-21:
   Tier 3 channels (YouTube Shorts, TikTok) accept vertical video and nothing else, so
   personal video has its own supply question that still coverage does not answer. See
   § "Video".

A third figure falls out of the same pass and matters for storage: **total usable assets**,
not just the count of shows that have any. Twenty-four shows could mean 24 files or 72,
and commit-vs-R2 turns on the file count.

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

## Workflow, end to end

The single most important thing this spec was missing: **what the operator actually does,
start to finish.** The mock's export modal claims output is "written to
`docs/specs/.../audit.md`" and then offers only a clipboard copy — a page served over
`file://` cannot write to a repo path, so that step does not exist. This section defines
it.

```
# one-time — build the binary locally; NOT pipx. See § "Install and permissions".
#   clang … disclaim.cpp && pyinstaller osxphotos.spec  →  ./dist/osxphotos
export OSXPHOTOS_NO_VERSION_CHECK=1     # the wrapper sets this; keeps the run offline
concert-media query                     # → candidates.json   (metadata only, nothing moved)
concert-media export                    # → concert-photos-audit/  (previews + page, gitignored)
concert-media review                    # opens the review page; judge; saves as you go
                                        #     calibrate → pass one (usable) → pass two (hero)
concert-media finalize                  # → audit.md + selects.json, written into the repo
git add docs/specs/future/mocks-social-syndication/audit.md && git commit
```

### How the page gets its verdicts back to disk

**DECIDED (2026-08-21): `concert-media review` serves the page from localhost.** The page POSTs
each verdict back as it is made; progress lands on disk continuously rather than in
`localStorage`, and `finalize` reads a file that already exists. Python's stdlib
`http.server` covers this with no new dependency, and localhost is still entirely offline.
This is a better answer to the "progress survives a browser quit" requirement in Phase 3
than browser storage, which is per-origin, silently clearable, and unreadable by the CLI.

*Rejected alternative, recorded so it is not re-proposed:* keep `file://`, have the page download
`audit.md` and `selects.json` via a Blob link, and have `concert-media finalize
~/Downloads` collect them. Works, costs a manual Downloads step on every save, and leaves
mid-review progress in `localStorage` where the CLI cannot see it.

Either way, **the export modal must describe what actually happens.** Prose promising a
file write that no button performs is how an operator ends up holding a clipboard full of
markdown with nowhere to put it.

### What the page never sees

`candidates.json` stays local and gitignored, and holds everything the query found —
including GPS. **The review page is served only the allowlisted subset** (see
§ "`selects.json`"). The field allowlist is therefore a property of the pipeline rather
than a promise about browser behaviour, and no coordinate ever reaches a document that
could be saved to the repo by accident.

### README

`scripts/media-audit/README.md` ships with Phase 1 and covers: the local build and the
first-run permission checks, the five commands above, what each output file is for, how to resume an
interrupted review, the filter flags, and what to do when an iCloud download fails.
It is an acceptance criterion of Phase 1, not a follow-up.

---

## Architecture

```
concerts.json  ─┐
                ├─►  [1] build query  ─►  windows (date + geo per show)
venues coords  ─┘

Photos catalog ─►  [2] query        ─►  candidates.json   (metadata only)

                   [3] export       ─►  concert-photos-audit/  (1200px previews)

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
downward, which is precisely the error this audit exists to avoid.

Where geo *is* present, anything beyond the radius is dropped. State the cost of that
plainly rather than describing it as excluding "photos taken at home" — there is no home
coordinate anywhere in the inputs, and the rule is simply a distance test. It will also
discard the pre-show dinner, the walk-up, and a marquee shot taken from the far side of
a large lot. That is the same downward bias the paragraph above refuses, arriving through
a side door, so: **the radius is a recall/precision dial, and the distribution of
dropped-by-distance assets is reported rather than silently applied.** If it is dropping
much, widen it.

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

> **Verified against source, 2026-08-22.** `osxphotos/scoreinfo.py` defines `ScoreInfo`
> with 27 float fields, and every field named in the table above exists. The mapping is
> accurate. Scores are Photos 5+ only (Photos 4 returns `None`). Reachable as `p.score.*`
> on a `PhotoInfo`; the clean integration is
> `osxphotos query --query-function file.py::func`, which hands over a `List[PhotoInfo]`
> — no JSON parsing.
>
> **Three corrections that follow from reading it:**
>
> **1. Scores are signed, and negative is worse.** The project's own `examples/bad_photos.py`
> uses thresholds like `pleasant_lighting < -0.7`, `well_framed_subject < -0.7`,
> `intrusive_object_presence < -0.999`. Exact per-field ranges are undocumented, which is
> itself a reason to print the distribution before assuming anything. **`mock-review-page.html`
> models scores as `[0,1]`** (`width:${v*100}%`, `Math.round(v*4)`) and would render real
> values as zero-width bars — a Phase 3 fix, and a caution that the mock has never been
> viewed with realistic score data.
>
> **2. Unscored photos return `0.0` on every field, not `None`.** On `KeyError`,
> `photoinfo.py` constructs a `ScoreInfo` with all fields zeroed. So "never scored" is
> indistinguishable from "scored zero" — and on a signed scale **zero is mid-range**, so
> unscored assets sort silently into the middle of any ranking. This is the silent-failure
> mode of the whole approach.
>
> **3. Apple's model has documented bias on out-of-distribution content.** `bad_photos.py`
> warns "don't include screenshots as Photos tends to give low scores to screenshots."
> That does not prove the model misjudges concert photography, but it moves the concern
> from speculation to a known failure mode on content outside its training set.

**These are used to rank, never to gate.** Apple's model was trained on general
photography, not dark rooms with coloured lights, and may score concert work harshly
across the board. Stage 2 therefore emits the score *distribution* first; the cutoff is
chosen from what the library actually looks like rather than guessed in advance.

Output: `candidates.json`. Metadata only — no images have moved.

### Stage 3 — Export previews

Copies each surviving candidate out at **1200px wide** into `concert-photos-audit/`, one
folder per show.

1200px is deliberate: #338's sharpness gate is written as *"in focus at 1080px wide."*
The review lightbox therefore shows each image at essentially the exact size the gate is
written for — no judging a proxy and extrapolating.

Displayed at ~400px in the grid (CSS downscale, one export serves both tiers), so the
lightbox costs no second pass and opens instantly from local disk.

### Stage 4 — Review

Generates `index.html` beside the exported folders and serves it from **localhost** via
`concert-media review` (Python stdlib `http.server`; no new dependency, no outbound
network, fully offline). Each verdict POSTs back and lands on disk immediately, so the CLI
and the page share one source of truth and an interrupted review resumes exactly where it
stopped.

Served rather than opened over `file://` because a `file://` page cannot write anywhere —
which is what left the mock's export modal promising a file write that no button performs.
See § "Workflow, end to end".

See **[mock-review-page.html](mock-review-page.html)** for the interaction design.

---

## Safety & the Photos library

**Read-only, by mechanism rather than by promise — but not by the mechanism an earlier
draft of this spec claimed.** Corrected 2026-08-21 after reading the source:

`osxphotos` opens the catalog with a SQLite **read-only URI connection** —
`sqlite3.connect(f"{dbpath.as_uri()}?mode=ro", uri=True)` in `osxphotos/sqlite_utils.py`.
`mode=ro` is enforced by SQLite itself, which refuses writes at the driver level. It
copies the database to a temp location **only when the live database is locked**
(`photosdb.py`: `if sqlite_db_is_locked(...)`), taking the `-wal` and `-shm` sidecars with
it; otherwise it reads the real file in place, read-only.

The earlier claim — "copies the catalog and never holds the real database open" — was
wrong. The safety property still holds, and `mode=ro` is arguably a stronger guarantee
than a copy, but a safety claim that misdescribes its own mechanism is worth correcting
rather than leaving to be discovered.

**The version check makes a network call on every run.** `osxphotos/cli/common.py` calls
`check_version()`, which GETs the PyPI JSON API. It transmits nothing about the library —
but this spec claims the workflow is fully offline, so **set
`OSXPHOTOS_NO_VERSION_CHECK=1`** (or pass `--no-version-check`) in the wrapper to make
that true. The wrapper sets it unconditionally.

**Python 3.14 is supported.** An earlier note in this session speculated the project might
lag the interpreter; PyPI classifiers for 0.76.1 list 3.10 through 3.14 explicitly.

Honest caveats, recorded so they are not discovered later:

- The tool *does* contain commands that write to a library — `import` (adds photos) and
  `timewarp` (rewrites dates). **This workflow uses only `query` and `export`, which
  cannot modify the library.** The wrapper must never shell out to anything else.
- macOS will prompt for Photos access / Full Disk Access. **Which application it names
  is the whole question** — see § "Install and permissions" below. It must say
  *osxphotos*, not *Terminal*.
- `osxphotos` reverse-engineers an undocumented Apple schema, so the realistic failure
  mode is **version lag** after a macOS upgrade — "doesn't run yet," not "ate the
  library." Run audits before OS upgrades, not immediately after.
- Take a Time Machine snapshot before the first run. Not because a problem is expected,
  but because it makes the whole thing recoverable regardless.

---

## Install and permissions

**DECIDED 2026-08-21: build the standalone binary locally from source.**
Not `pipx install`, and not the published release artifact. Do not grant Full Disk Access
to the terminal.

### The mechanism, verified in source

Reading the Photos catalog requires Full Disk Access, and TCC attributes the request to the
*responsible process*. osxphotos ships `osxphotos/disclaim.py` to make itself responsible
rather than the shell, and `osxphotos/cli/cli.py` calls it like this:

```python
if pyinstaller() or pyapp():
    # Running from executable, run disclaimer
    disclaim()
```

`pyinstaller()` is `hasattr(sys, "_MEIPASS")` — a test of the **runtime environment, not of
who built the binary.** Three consequences, all load-bearing:

1. **Under pipx, `disclaim()` never runs.** `_MEIPASS` is absent, so FDA is granted to the
   terminal — and inherited by every process that terminal ever launches, indefinitely.
   This is the option to avoid, and the reason is mechanical rather than reputational.
2. **Any PyInstaller build disclaims, including one we build ourselves.** The binary does
   not know who compiled it.
3. **A locally built binary carries no quarantine attribute**, having never been
   downloaded — so Gatekeeper never enters the picture.

### Build

```bash
git clone https://github.com/RhetTbull/osxphotos && cd osxphotos
# rebuild the one prebuilt blob the repo ships, rather than trusting it
clang -shared -mmacosx-version-min=10.12 disclaim.cpp -o osxphotos/lib/libdisclaim_arm64.dylib
python3 -m venv /tmp/osxphotos-build && source /tmp/osxphotos-build/bin/activate
pip install pyinstaller -r requirements.txt      # throwaway venv — nothing persists
pyinstaller osxphotos.spec        # → ./dist/osxphotos
deactivate && rm -rf /tmp/osxphotos-build        # the ~50 packages leave with it
```

Pin the commit. Record it in this spec alongside the build date.

### What this buys, and what it does not

| | pipx | Published binary | **Local build** |
|---|---|---|---|
| Who receives FDA | **Terminal, and all it runs** | osxphotos | **osxphotos** |
| Trusting a prebuilt blob | No | **Yes (~168 downloads)** | **No** |
| Gatekeeper / quarantine | n/a | **Possible hard stop** | **None** |
| Build-time PyPI dependencies | ~50 | 0 | ~50 |

**Stated honestly:** building from source does not mean auditing ~50 transitive
dependencies, pyobjc included. Nobody reads those. The real gain is that the artifact we run
corresponds to public source we *could* inspect, and we are not trusting a single uploaded
file. The build-time supply-chain surface is identical to pipx; it is the *permission scope*
and the *absence of an opaque artifact* that improve.

**The trap:** "build from source" only helps if the build produces a PyInstaller bundle.
`pipx install ./osxphotos` from a local clone gives the auditability and **loses the FDA
scoping**, because `_MEIPASS` is never set. Auditability and permission scope are
independent properties and are easy to conflate.

### GATE: validate the scores before paying for the access

**Added 2026-08-21, and it takes precedence over everything above.**

The *only* reason this workflow needs Full Disk Access is Apple's aesthetic scores — they
live in the SQLite catalog and PhotoKit cannot reach them. Every other signal the audit
needs (date, GPS, dimensions, duration, burst grouping, the image data itself) is available
through **PhotoKit with Photos permission and no FDA at all**.

And this spec already doubts those scores on exactly this material: § "Stage 2" warns that
Apple's model "was trained on general photography, not dark rooms with coloured lights, and
may score concert work harshly across the board," while § "Video" notes the fields are
commonly empty for movies. Dark rooms, coloured light, long lenses, high ISO — this library
is the adversarial case for a general-purpose aesthetics model.

So **validate before building around it**:

**Step 0 — costs nothing and may end the gate before a single photo is viewed:**

0a. **Count the all-zero `ScoreInfo`s.** Unscored photos return zeros silently (see the
    corrections above). If a meaningful share of the library is unscored, the scores are
    unusable regardless of how well they discriminate on the rest.
0b. **Print per-field variance across concert photos.** If `sharply_focused_subject` has
    near-zero variance over a few hundred concert shots, the model is not discriminating
    on this material and the answer is already in.

**Two of the three possible outcomes arrive here, with no human looking at anything.**
Only if Step 0 is inconclusive do the rest:

1. Grant FDA once, under the local build.
2. Dump scores for ~200 assets across several shows.
3. Judge those assets by hand, blind to the scores.
4. Check whether the scores separate keepers from rejects.

**If they discriminate:** the design above stands and the grant is earned.
**If they do not:** drop to PhotoKit, compute sharpness (Laplacian variance), exposure
(histogram) and resolution ourselves — all of which work on pixels we already have — and
**the Full Disk Access question disappears entirely.** That is strictly safer than any
option in the table above, and it costs only the convenience of Apple having pre-computed
something we can compute.

This gate is cheap and it is the difference between an access grant that is justified and
one that is merely well-contained.

### First-run verification

1. **The permission prompt must name *osxphotos*, not *Terminal*.** The call site above says
   it will; confirm it empirically, because this is the entire reason for the chosen path.
   If it names Terminal, stop.
2. **Confirm zero outbound network.** The wrapper sets `OSXPHOTOS_NO_VERSION_CHECK=1`;
   verify nothing reaches PyPI on a run.

### Grant, run, revoke

`query` and `export` are near-one-time operations, and nothing here needs standing access.
Grant, run, then revoke in System Settings → Privacy & Security → Full Disk Access; TCC
changes take effect at next launch. Note that rebuilding changes the binary and may require
re-approval — a mild annoyance, not a defect.

### The no-FDA fallback

osxphotos also has a PhotoKit path that goes through the Photos API and needs only Photos
permission. The cost is real: Apple's aesthetic scores live in the SQLite catalog, so a
PhotoKit-only run keeps the date/GPS join and manual review but loses the best-first
ranking that makes the audit fast. Worth knowing the door exists if a check above fails.

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
concert-media --video-only --vertical-capable        # 9:16 eligible only (Tier 3 supply)
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

> **Mock does not yet match this rule.** `mock-review-page.html` binds `2` = *hero*
> alongside `1` = *usable* in pass one, which merges exactly the two questions this
> section says must stay apart. Fix in Phase 3: hero is a pass-two verdict only.
>
> Relatedly, § "Binary, never a rating scale" says everything unmarked is a no by
> default, but the mock has an explicit reject key (`0`). **Keep the explicit reject and
> amend the prose** — reject-vs-not-yet-reviewed is what progress tracking needs.

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

**The calibration pass must record where the bar landed** — "20 sampled, 6 accepted" —
into `audit.md`. Otherwise the count carries no evidence of its own standard, a re-run
months later silently applies a different one, and the consistency problem this section
opens with is solved in the moment but not on the record.

### Subject tagging rides along

#338 also wants the performer / venue / crowd / stub mix. One extra keystroke, applied
**to keepers only** — roughly twenty extra presses in total, not a second pass over
everything. Photos' own detected labels pre-fill the guess.

**Venue and marquee shots are no longer one of four equal buckets.** Tier 2 routes
imagery by the subject of the post — a venue-subject post wants a venue photo — and the
venue source in `image-refs.ts` is **65 of 67 dead** (#315). A personal marquee or
exterior shot is therefore often the *only* tier-1-or-tier-2 image a venue post can get,
which makes it worth more per frame than another performer shot of an artist whose
press photo already resolves at 100% coverage. Tag it first, and report its count
separately in `audit.md`.

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

### Orientation is a hard gate, and it only bites video

Added 2026-08-21, when YouTube Shorts and TikTok joined the channel ladder as Tier 3.
Both accept **9:16 and nothing else**, and concert video gets shot horizontally
constantly. Cropping a landscape capture to vertical is limited by its height:

| Capture | 9:16 crop yields | Verdict |
|---|---|---|
| 1080p landscape (1920×1080) | **607×1080** | ✗ fails — would need a 1.78× upscale |
| 4K landscape (3840×2160) | 1215×2160 | ✓ passes |
| Any portrait capture | native | ✓ passes |

So landscape video from the 2012–2016 era is largely unusable for Tier 3, while 2017+ 4K
landscape survives — which tracks the era table exactly. **Record orientation and capture
resolution per asset, and gate 9:16 eligibility on them.** #342 (rendition spec) consumes
both fields directly.

Stills are unaffected: a 12MP phone still cropped to 4:5 yields roughly 2419×3024,
comfortably past the 1080×1350 gate. This is a video-only problem.

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
**Shows with 9:16-capable video: 9 / 101 (9%)**   ← Tier 3 supply
**Total usable assets: 51 stills, 12 clips**      ← storage sizing (commit vs R2)
**Venue / marquee frames: 7**                     ← the scarce tier-2 substitute
**Calibration bar: 20 sampled, 6 accepted**
```

Committed to `docs/specs/future/mocks-social-syndication/audit.md`, which is where #338
asks for it — alongside the Phase 0 creative work it sizes. The tooling lives here; its
output lands there.

### Where media lives (DECIDED 2026-08-23)

| Pile | Location | Committed? |
|---|---|---|
| Source library | Photos.app on the owner's Mac | Never copied wholesale |
| **Candidates** — the cull, thousands of frames with full EXIF | **`concert-photos-audit/`** at project root | **No — gitignored** |
| **Final selects** — the images that actually appear in posts | **`public/images/shows/`** | **Yes** |
| **The mapping** | **`public/data/media-index.json`** | **Yes** |

**Why selects go in the repo rather than R2.** An earlier revision recommended R2 on the
grounds that "N is large." That conflated two different piles: the large number is
*candidates*, not *selects* — selects are bounded by the number of posts, roughly one
image each. For that size the repo wins outright:

- The build composites the card from the image. In-repo it is simply present; in R2 the
  build must authenticate and download, adding a failure mode to every build.
- Cloudflare Pages already serves `public/` from the CDN at no additional cost or setup.
- **Git is the backup.** Restoring every select is `git clone` — which is exactly the
  "restore all selects" requirement.
- The repo already ships venue imagery under `public/images/` on this pattern.

R2 remains the right answer if selects ever pass a few hundred files. `media-index.json`
addresses assets by a `url` field, so that migration costs no consumer changes.

**Metadata is stripped before commit.** Every phone photo carries GPS, capture time and
device identifiers *inside the file*, which would defeat the `selects.json` field
allowlist by another route. Stripping is an automatic pipeline step, never a habit
someone is trusted to remember. **A commit hook or a CI check should enforce it** — a
step that only runs when remembered is a step that eventually does not.

### `selects.json` — machine-readable

**Committed, with a fixed allowlist of fields** (decided 2026-08-21):

| Field | Committed? | Why |
|---|---|---|
| Photos UUID | ✅ | Library-local identifier; meaningless outside this Mac |
| Show ID / date | ✅ | Already public in `concerts.json` |
| Verdict, hero flag, subject tag | ✅ | The review's actual output; #339 needs it |
| Orientation, dimensions, duration | ✅ | Not personal; #342 consumes them |
| Normalised scores | ✅ | Derived numbers, no content |
| **Original filename** | ❌ | Often carries device and personal naming |
| **Timestamp beyond the show date** | ❌ | Show date is public; exact capture time is not |
| **GPS coordinates** | ❌ | Personal location history in a public repo |

The rule behind the list: commit what #339/#340 need to do the join, and nothing that
describes where the owner was or what device they carried. This repo is public, and the
parent spec is explicit that committing is the publishing act.

### What the numbers change

Not the rubric — that is settled regardless of N (personal > sourced > derived). What
they size:

| Number | Decides |
|---|---|
| Shows with ≥1 usable still | How often the tier-2 fallback has to fire, and therefore how much sourced imagery the feed actually carries |
| Shows with 9:16-capable video | Whether Tier 3 (Shorts, TikTok) has enough supply to be worth building at all — a legitimate "no" |
| Total usable assets | Storage: commit the stills, or go to R2 (#340) |
| Venue / marquee count | Whether venue-subject posts have any tier-1 path, given #315 |

---

## The shortcut worth considering first

A sample is still worth running first — as a cheap early read on sizing, not as a
strategic fork, since the fork is closed. **The old ±9pp claim was optimistic** and is
corrected here. Computed with the finite-population correction (N=101, n=30):

| True rate | 95% interval |
|---|---|
| 10% | 1–19%  (±9.0pp) |
| 20% | **8–32%** |
| 30% | 16–44% (±13.8pp) |

±9pp holds only near p≈0.10. The failure case is the middle: a sample landing at 20%
returns an interval containing 8% *and* 30%, so it distinguishes nothing. Reaching ±9pp
at p≈0.30 needs n≈50.

`concert-media --sample 30` is therefore a first look that may well need the full pass
behind it. `--sample 50` if the first read lands mid-range.

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
- [ ] Orientation + capture dimensions recorded per asset; 9:16 eligibility derived, not guessed
- [ ] Count of assets dropped by the distance test reported, not silently applied
- [ ] `README.md` written and followable by someone who has never run the tool
- [ ] Wrapper sets `OSXPHOTOS_NO_VERSION_CHECK=1`; verified zero outbound network on a run
- [ ] Permission prompt observed naming *osxphotos*, not *Terminal* — recorded in the README
- [ ] Binary built locally from a pinned commit; commit hash and build date recorded
- [ ] Build performed in a throwaway venv; no build dependencies persist on the machine
- [ ] All-zero `ScoreInfo` fraction measured and reported — unscored must never be treated as scored-zero
- [ ] Score scale handled as signed; no code assumes `[0,1]`
- [ ] **Score-validation gate run before Stage 2 is built** — scores shown to discriminate on this library, or the design dropped to the no-FDA PhotoKit path

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
- [ ] Progress survives a browser quit mid-show — verified by killing the browser, not by trusting `localStorage`
- [ ] Every action undoable
- [ ] `concert-media finalize` writes both files into the repo with no copy-paste step
- [ ] Export modal describes exactly what the button does, and nothing it does not

### Phase 4 — Filters & reuse

- CLI filter flags, saved named queries
- `--sample N`
- `--download-missing` for the approved shortlist, batched, failures reported

---

## Open questions

1. ~~**Where do exported previews live?**~~ **RESOLVED (revised 2026-08-23) — inside
   the project at `concert-photos-audit/`, gitignored.** An earlier revision put them
   outside the repo on the reasoning that a gitignore is a promise and a different
   directory is a mechanism. **Owner overrode this:** the corpus should stay within the
   project boundary and be agent-readable/writable. Verified safe — `tsconfig.json`
   includes only `src`, `tsconfig.scripts.json` only `scripts`/`test`, and Vite copies
   only `public/`, so a root-level folder is never typechecked, built or deployed.
2. ~~**Does `selects.json` get committed?**~~ **RESOLVED — yes, with a field
   allowlist.** See § "`selects.json` — machine-readable" for the committed/withheld
   table.
3. **Burst window of 10s** — right for concert shooting, or too aggressive? Worth
   checking against one real show before locking it in.
4. **Pre-2012 shows.** Genuinely out of reach for phone media, but scanned ticket stubs
   and film prints may exist offline. Out of scope here; worth a separate note on #325.
5. **Is 20 the right calibration sample?** Enough to see the range without becoming a
   chore in its own right — but untested.

---

## Related

- [`global-social-syndication.md`](../global-social-syndication.md) — parent spec; owns the
  strategy, the coverage ceiling, and the imagery ladder this feeds
- [`mocks-social-syndication/`](../mocks-social-syndication/) — Phase 0 creative tracks;
  `audit.md` lands there
- [#338](https://github.com/mmorper/concerts/issues/338) — Inventory audit (this spec's reason to exist)
- [#339](https://github.com/mmorper/concerts/issues/339) — Submission + ingest (sized by the output)
- [#340](https://github.com/mmorper/concerts/issues/340) — Index schema + resolution ladder
- [#325](https://github.com/mmorper/concerts/issues/325) — Track D coverage claim to be corrected
- `docs/LINER_NOTES_PIPELINE.md` — where media eventually attaches
- [osxphotos](https://github.com/RhetTbull/osxphotos) — MIT, third-party, not an Apple product

---

## Revision History

- **2026-08-21 (a):** Initial specification created
- **2026-08-23:** Storage settled. Candidate corpus moves *inside* the project at
  `concert-photos-audit/` (gitignored, agent-writable) per owner preference. Final selects
  and `media-index.json` are committed under `public/`; the R2 recommendation is withdrawn
  as over-engineering that confused the candidate count with the select count. EXIF
  stripping before commit agreed and made an enforced step. Licence and third-party-faces
  concerns explicitly dismissed by the owner.
- **2026-08-22:** Verified the score API against source. `ScoreInfo` and every mapped field
  are real; Photos 5+ only. Three corrections: scores are **signed** (negative is worse, and
  the mock wrongly assumes `[0,1]`); unscored photos return **all-zero, not None**, which is
  a silent-failure mode; Apple's model has documented bias on out-of-distribution content.
  Gate gains a Step 0 that can resolve it without human review.
- **2026-08-21 (e):** Added the score-validation gate — FDA is only justified if Apple's
  aesthetic scores actually discriminate on dark, coloured-light concert photography, which
  this spec elsewhere doubts. If they do not, the design drops to PhotoKit and needs no Full
  Disk Access at all. Build moved to a throwaway venv.
- **2026-08-21 (d):** Install path changed again, from the published binary to a **local
  PyInstaller build** — traced `disclaim()`'s call site and confirmed it is gated on the
  runtime environment (`sys._MEIPASS`), not on the builder, so a self-built binary scopes
  FDA identically while removing both the opaque artifact and any Gatekeeper step.
- **2026-08-21 (c):** osxphotos due diligence — install path moved off pipx so Full Disk
  Access is scoped to the tool rather than the terminal;
  read-only safety claim corrected against source (`mode=ro` URI, temp copy only when
  locked); version-check network call found and suppressed; Python 3.14 support confirmed.
- **2026-08-21 (b):** Realigned to the syndication decisions of the same day — audit
  reframed from strategic fork to sizing exercise; withdrawn 8% arithmetic removed from
  the `audit.md` template; second headline number added for 9:16 video supply; orientation
  gate added for Tier 3; venue/marquee tagging privileged over the other subject buckets;
  sampling precision corrected; geo-drop recall cost stated; calibration bar now recorded;
  open questions 1 and 2 resolved.

*Last updated: 2026-08-21*
