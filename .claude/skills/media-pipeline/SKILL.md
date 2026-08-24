# Media Pipeline Skill

**Purpose:** Reference this skill before any work touching personal photography or video —
the Photos library audit, culling, ingest, or attaching media to a syndicated post.

**When to use:**
- Reading from the Photos library (`concert-photos-audit/bin/osxphotos`)
- Culling, ranking or scoring candidate media
- Ingesting selects into the repo
- Attaching imagery to a liner note or social post
- Any change to `#348` (audit tool), `#339` (ingest), `#340` (index), `#342` (renditions)

**Spec:** `docs/specs/future/global-media-audit-tool/global-media-audit-tool-spec.md`
carries the reasoning and evidence. This skill carries the rules in operative form.

---

## 🔴 Safety invariants — never negotiable

**The Photos library is NEVER modified.** It is the owner's irreplaceable source of record.

- Call **`concert-photos-audit/bin/osxphotos`**, never `.osxphotos-raw` directly. The
  wrapper is a read-only guard: it allows `query`, `export`, `info` and refuses every
  subcommand that can write — `import`, `timewarp`, `add-locations`, `batch-edit`,
  `push-exif`, `sync`, `orphans`. Reaching past it means the guard is working.
- **It refuses mutating OPTIONS too, not just subcommands.** Allowlisting subcommands
  alone was not enough: `osxphotos query --add-to-album ALBUM` creates an album and adds
  every matched photo to it — a library write reached through the very subcommand this
  project uses most. `export --post-command` / `--post-function` run arbitrary code and
  bypass the guard entirely. All four are refused, in both `--flag value` and
  `--flag=value` form (closed 2026-08-23, while building #378).
- **The guard is tracked in git and covered by CI**, by a named exception in two
  `.gitignore` files — it and `bin/BUILD.txt` are the only things in
  `concert-photos-audit/` that git can see. `test/pipeline/osxphotos-guard.test.ts` asserts
  every refusal on every PR. Refusals happen before the binary is consulted, so the tests
  run on a Linux runner with no osxphotos installed.
- **🔴 The guard cannot be moved.** macOS grants Full Disk Access against the **wrapper's**
  path, not only the binary's. Relocating it to `scripts/media/` — same binary, same
  arguments, same resolved target — made every library read **hang**: no prompt, no error,
  a process sitting at two seconds of CPU forever. Measured 2026-08-24, and the reason the
  guard lives in an otherwise-gitignored directory instead of somewhere tidier. If it ever
  must move, expect to re-grant Full Disk Access, and expect the failure to be a silent
  stall rather than a permission error.
- The guard also closes stdin (so no run hangs on an interactive prompt) and sets
  `OSXPHOTOS_NO_VERSION_CHECK=1` (so no run touches the network).
- **Personal media never reaches the repo un-stripped.** EXIF — GPS, capture time, device —
  is removed before anything is committed. This is a pipeline step, never a habit.
- `concert-photos-audit/` is **evaluation-only and gitignored**. Nothing there becomes
  production by being copied; a select reaches the repo only through the ingest step.

---

## The imagery rubric — DECIDED, do not re-open

1. **Never bare type.** Every post's first image carries imagery. Typography is a *layer*
   over something, never the thing itself.
2. **Imagery beats text-only.** Always.
3. **Personal beats sourced.** Always.
4. **Sourced beats derived.** Derived visualisation is a legitimate floor, not a house style.

Carousels: pane 1 obeys the rule; panes 2–N may be text-only.

| Tier | Source |
|---|---|
| 1 | Personal photography and video |
| 2 | Sourced — album covers, Google Places venue photos, artist imagery, Wikimedia — routed by the **subject of the post** |
| 3 | Derived — generative and material-metaphor artwork. The floor. |

---

## Attribution — two non-negotiable rules

**Different-night rule.** A photo from another show may be used, but the post must say so.
Implying a photo is *the* night when it is not is the fabricated-memory failure the voice
rules exist to prevent.

**Different-artist rule.** **89 of 184 shows (48%) have openers** — 187 opener credits.
Howard Jones had two; Oingo Boingo 1987 had five. **An unattributed frame silently
defaulting to the headliner is fabricated attribution on half the archive.** Per-asset
artist must reach `selects.json`, `media-index.json` and the payload.

Low-confidence matches do not publish. An asset matched only by file mtime is a guess.

---

## Findings that must not be re-derived

These were expensive to learn. Treat them as settled.

**The date window is a DATE filter, not a concert filter.** The 17:00→04:00 window catches
the whole evening. Of 66 Beck-window frames (2018-04-27), *none* were of the concert —
they were a wedding. Any supply figure derived from the window alone counts evenings.

**Ranking is TWO factors, not one.**
- *Concert-likelihood* — is this the right subject? (labels, `low_light`, GPS/`place`, hour)
- *Quality* — is it worth publishing? (Apple `overall`/`curation` + local Laplacian)

The Black Keys proved they are separate: the model scored 0.84 (correct — they *are*
concert photos) and the owner rejected all 8 (also correct — they are *bad* concert photos).

**Rank on `overall` and `curation` ONLY.** Measured face bias, concert stills:

| Field | w/ people | no people | delta |
|---|---|---|---|
| `overall` | 0.398 | 0.394 | +0.004 clean |
| `curation` | 0.500 | 0.500 | 0.000 clean |
| `interesting_subject` | 0.043 | −0.298 | **+0.341 biased** |
| `well_framed_subject` | 0.200 | 0.018 | **+0.183 biased** |

**35% of concert stills contain no detected person** — marquees, venue exteriors, stubs.
Ranking on `interesting_subject` buries them on subject matter rather than quality, and
hits hardest where the archive is most exposed (venue posts have no working tier-2
fallback while Places is unreliable — #315).

**Sharpness is computed locally.** Apple's `sharply_focused_subject` has stdev 0.035 across
551 concert stills — inert. Use Laplacian variance. `promotion` is entirely flat; drop it.

**10.5% of window assets carry an all-zero `ScoreInfo`.** Unscored is silently
indistinguishable from scored-zero, and on a signed scale zero is mid-range. **Filter
them, never rank them.**

**Scores are SIGNED**, roughly −1..+1. Any UI assuming `[0,1]` renders negatives as nothing.

**`mh-concerts` is a signal, not truth.** 412 assets are hand-tagged across 53 shows, and
41 fall outside the date window. It is the strongest single signal available — but tagging
is manual and incomplete (57 tagged of 58 window assets for one show). **Weight it; never
filter on it.**

**Burst collapsing is irrelevant.** The library has 10 bursts in 58,571 assets. Frame
extraction, however, *manufactures* near-duplicates — see below.

**Video is reviewed out-of-process.** See below.

---

## Score, never filter

Every discrimination stage **ranks**; it does not exclude. A hard cut drops the 18:00
daylight marquee shot, which is the scarcest frame in the archive.

**Report what was excluded at every stage.** The date window *looked* like it was finding
concerts for an entire session. A stage that silently discards is a stage that can be
wrong invisibly.

---

## Video — out-of-process by design

Do **not** build video review, playback or editing into this project.

**Why:** Photos.app already does playback, scrubbing, frame export and trimming better than
anything here. `--download-missing` drives Photos through AppleScript, requiring a separate
Automation permission, and clips run 100–200MB each (~15–30GB for the archive).

**The workflow:** the tool *points*, the owner reviews in Photos, exports stills or trimmed
clips by hand, and drops them into the inbox.

What the tool still owes video: identification. Per-show worksheets listing candidates with
`original_filename` (e.g. `IMG_5693.HEIC`) — directly searchable in Photos.

**Confirmed:** a poster frame cannot be judged. Do not design a video flow around thumbnails.

**Frame extraction works and is validated** — extracted frames scored an **83% keep rate**,
judged blind against real stills, the best of any category. When extracting: sample ~1
frame/second, score by Laplacian, and **enforce a minimum gap between picks** — top-N by
sharpness returns adjacent frames of the same moment.

---

## Inbox contract

```
concert-photos-audit/inbox/<YYYY-MM-DD>/
    <artist-folder>/        one per act — headliner AND every opener
    _venue/                 marquee, exterior, stub, crowd-before-doors
```

- **Date folder = the concert.** All 184 concert dates are unique, so one folder maps to
  exactly one show. A date not in `concerts.json` is an error, not a guess.
- **Every artist gets a folder, including the headliner.** No implicit default — a
  root-level file is an error the ingest flags rather than a wrong answer it produces.
- **Folder names are matched forgivingly** against *that night's lineup only* (2–6
  candidates, so ambiguity is nearly impossible): case, punctuation and a leading article
  are ignored. `"human league"`, `"Human League"`, `"the-human-league"` all resolve.
  Ambiguous or unknown fails loudly with the lineup listed.
- **`hero.*` or `01.*`** marks a hero. Otherwise naming is free and ingest assigns order.
- **An empty artist folder is a signal**, not an absence: no personal media for that act,
  fall back to tier 2.
- Optional `notes.txt` carries anything for the post — a different-night disclosure, a caption.

Ingest: folder → concert; subfolder → artist; EXIF read as a **cross-check only** (derived
files often lose `DateTimeOriginal` entirely — ffmpeg strips it); metadata stripped;
written to `public/images/shows/`; `media-index.json` updated; **what was skipped reported**.

---

## Where things live

| | |
|---|---|
| Source library | Photos.app — never copied wholesale |
| Candidate corpus, evaluation runs | `concert-photos-audit/` — **gitignored** |
| Tooling | `scripts/media/` (tracked) · the guard + `BUILD.txt` (tracked by exception) · binary, `*.py`, `*.sh` (ignored) |
| **Final selects** | **`public/images/shows/`** — committed, EXIF-stripped |
| **The mapping** | **`public/data/media-index.json`** — committed |

Selects live in the repo, not R2: the card renderer needs the file at build time,
Cloudflare already serves `public/` from the CDN, and `git clone` restores every select.
R2 only becomes correct past a few hundred files; `media-index.json` addresses by `url` so
that migration costs no consumer changes.

---

## Tooling status — read this before citing a command

**Built and working:**

| | |
|---|---|
| `concert-photos-audit/bin/osxphotos` | **read-only guard — tracked by exception, CI-tested.** The binary it wraps stays gitignored |
| `extract_frames.sh` / `frame_score.py` / `pick_frames.py` | frame sampling, Laplacian scoring, min-gap selection |
| `review_server.py` + `uxtest/index.html` | localhost stills review — verdicts persist per keystroke |
| `probes/*.py` | one-off investigation scripts |
| **`npm run media:prep <date>`** | **scaffold inbox folders + per-show worksheet — #378, shipped** |
| `scripts/media/show.ts` | date → concert, lineup, folder plan (pure, unit-tested) |
| `scripts/media/rank.ts` | the two-factor model — concert-likelihood and quality (pure, unit-tested) |
| `scripts/media/worksheet.ts` | WORKSHEET.md renderer (pure, unit-tested) |
| `scripts/media/query_window.py` | the osxphotos query function `media:prep` runs |

**Specified, NOT built** — do not instruct anyone to run these yet:

| | |
|---|---|
| `media:ingest` | inbox → `public/images/shows/` + `media-index.json` — **#379** |
| `media:gaps` | shows with no media, and the tier-2 fallback for each — **#380** |
| `media:audit` | corpus scan across all 184 concerts — **#381** |

When one ships, move it up and delete it from below.

---

## Verify output, not exit codes

A recurring failure in this work: **a command reports success while doing nothing.**
Observed repeatedly — an export hung on an interactive prompt for twenty minutes with no
error; a `--only-photos` flag silently excluded every video; a string replace that did not
match; a filter that produced an empty venue lookup and a confidently wrong conclusion.

**Every stage asserts its own output before the next stage consumes it.** Count the files.
Check the content. A two-line assertion on a pure function costs nothing and catches what
reading an exit code never will.
