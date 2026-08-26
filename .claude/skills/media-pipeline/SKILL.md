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
- **🔴 Full Disk Access is scoped to the BINARY, so anything touching the library must run
  inside it.** Node reading a path under `Photos Library.photoslibrary` gets `EPERM`, even
  a path that osxphotos itself just handed over. That is the point of building the binary
  locally rather than via pipx — TCC is granted to it alone. Practical consequence: file
  work on library contents belongs in `query_window.py`, which runs under the guarded binary,
  never in the TypeScript that calls it. Measured 2026-08-24.
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

**Attribution is captured in the review page, at the moment of judgement** — that is when
the owner is looking at the photograph and actually knows. `selects.json` carries it
forward, and `media:ingest` REFUSES a file whose folder disagrees with it. A keeper with no
act named is never placed and never defaults to the headliner.

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

**`--download-missing` is the right path FOR STILLS, and it works.** Measured 2026-08-24:
1.22MB and six seconds for a 3024×4032 HEIC, `ismissing` flips to false afterwards, and no
Automation dialog blocked it. The earlier blanket objection to this flag bundled the
AppleScript permission with **video's** 15–30GB; the whole still backlog is a few hundred
MB, so the volume argument does not carry over. Video stays out-of-process for its own
reasons.

**Materialising an iCloud original is NOT a library mutation.** It writes no user data — no
metadata, no albums, no edits — and is what Photos does when you open the photograph.
Deliberate carve-out, owner-approved 2026-08-24. The rest of the invariant stands.

**🔴 ALWAYS pair `--download-missing` with `--use-photokit`.** Without it, osxphotos
launches Photos.app and drives it one asset at a time over Apple Events — **and Photos
wedges**. Measured: hung mid-batch around asset 20 of 23, stuck inside
`dispatchRawAppleEvent` at 14.6MB, never finishing its launch. Three assets silently fell
back to previews, and clearing it needed a force-quit that left `photolibraryd` degraded
until a reboot.

PhotoKit talks to the library directly. Verified: a genuinely missing asset downloaded from
iCloud **in under a second with Photos.app not running at all**, and a full 22-asset ingest
completed without ever launching it. Upstream labels the flag alpha and warns it fails
under iTerm2 (use Terminal.app) — weighed against hanging an app the owner depends on,
alpha is the better risk, and a failure degrades to previews rather than wedging anything.

**An earlier note here said `--use-photokit` "does not work — stalls with zero output."
That was wrong.** It stalled because Photos was *already* wedged from prior AppleScript
traffic, and the stall was attributed to the wrong cause. Re-tested on a healthy library,
it works every time.

**sharp cannot decode what the library actually holds.** It reports `heif.input === true`,
but the HEVC decoder is not compiled into its libvips: real iPhone HEICs fail with
"Support for this compression format has not been built in", and ProRAW DNG is unreadable.
**19 of 23 assets died this way on the pilot show.** Let osxphotos convert on export with
`--convert-to-jpeg`, which uses Apple's own codecs and fixes HEIC and DNG together. Pair it
with `--skip-original-if-edited`: if a photograph was edited in Photos, the EDIT is what
was seen in the review page and chosen.

**The repo holds a right-sized MASTER, not the original.** 2048px on the long edge clears a
4:5 card at 1080×1350 and a 9:16 crop at 1080×1920, with headroom for crop safety (#352).
On the pilot show that is **41.4MB of originals → 8.4MB of masters**; projected across a
few hundred selects, ~150MB rather than ~760MB. Nothing is lost: the original never leaves
Photos, and `uuid` + `sourceWidth`/`sourceHeight` in `media-index.json` make re-deriving at
any size mechanical.

**Why stills are committed at all, when clips are not.** `syndicate.yml` and
`liner-notes.yml` run on `ubuntu-latest`, on a cron. There is no Photos library on a GitHub
runner. A still must be reachable by an unattended Linux job; a trimmed clip need not be,
because video publishing is gated and needs the owner's Mac anyway. That asymmetry is the
whole reason the two are stored differently.

**A master below the card floor is NOT committed.** 1080×1350 is the bar. A Photos preview
can be 768×1024, and shipping that means an upscaled or letterboxed post. The select still
stands; re-running once the original downloads produces a real master in its place.

**A clip never falls back to its poster frame.** A poster frame cannot be judged — that is
the finding the entire video workflow rests on — so publishing one as a photograph inverts
it. A clip that did not download is an error pointing at `media:frames`, not a still.

**🔴 A hung Photos.app stalls `--download-missing` silently** — which is why the flag above
is not optional. Driving Photos over AppleScript, a wedged Photos blocks the export forever
with no output: observed at 15+ minutes and 0.85s of CPU. **Force-quitting Photos to clear that
leaves `photolibraryd` degraded afterwards** — even plain `osxphotos query` calls slow to a
crawl until a reboot. Prefer waiting over force-quitting.

**🔴 Measure PROGRESS, never the wall clock.** A wall-clock timeout cannot tell a wedged
Photos from a macOS permission dialog sitting on an empty desk, and those need opposite
responses — killing a run because nobody was in the room to click Allow is worse than the
hang it was meant to catch. `media:ingest` watches for files actually appearing: while they
do, the fetch has as long as it needs; when they stop, it SAYS so and keeps waiting,
because the likeliest cause is a prompt only a person can answer. A hard timeout exists
only behind `--fetch-timeout <minutes>`, for an unattended run. **This applies to any stage
that waits on Photos.**

**Photos' preview is a usable fallback.** The derivative is 1536×2048 and local even for
iCloud-only assets — on the pilot show 22 of 23 cleared a 1080×1350 card and a 9:16 crop.
Record it as `quality: 'preview'` so a later pass can upgrade the file in place.
**Curation is decoupled from resolution**, so no human judgement is ever repeated.

**SUBJECT decides placement, not the act.** The review page records subject and act
independently, so a frame can be marked `venue` while an act is also selected. That
produced `folder: '_venue'` beside `artistNormalized: 'the-human-league'` on the pilot show,
and ingest placed it by the artist — **a marquee shot published as a photograph of the
headliner.** A venue, crowd or stub frame belongs to the night; its act is dropped so the
two can never disagree.

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

**Stills are reviewed IN the review page. Video is reviewed in Photos.app.** These are
different answers to different problems and must not be collapsed into one — doing so once
already sent the owner to Photos to triage 58 stills by hand. Video needs playback, which
Photos does better than anything here. Stills need a fast keyboard verdict with both
ranking factors and the night's lineup on screen, which is what `media:review` is.

Triaging stills in Photos also makes the attribution call **twice** — once when judging,
again when choosing a folder — and the second one is where a Soft Cell frame lands in
`alison-moyet/`.

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

**The workflow for VIDEO:** the tool *points* (WORKSHEET.md lists clips with searchable
`original_filename`), the owner reviews in Photos, exports stills or trimmed clips by hand,
and drops them into the inbox.

**The workflow for STILLS is different:** `media:review <date>` exports previews and serves
the review page; verdicts and attribution are captured there; `--finish` writes
`selects.json`; `media:ingest` then checks what was filed against it.

What the tool still owes video: identification. Per-show worksheets listing candidates with
`original_filename` (e.g. `IMG_5693.HEIC`) — directly searchable in Photos.

**Confirmed:** a poster frame cannot be judged. Do not design a video flow around thumbnails.

**There is NO public URL for an iCloud asset.** iCloud.com needs a session and issues
short-lived signed URLs; nothing is bookmarkable. What exists instead is better for this
purpose: **`photos://asset?identifier=<UUID>` opens Photos.app on that exact item.**
The form is a QUERY PARAMETER. `photos://asset/<UUID>` — the path form — does nothing at
all, and `open` exits 0 for both, because it only hands the URL to the registered app and
never learns whether the app understood it. Shipped broken once for exactly that reason.
The real forms are declared in the Photos binary: `photos://asset?identifier=`,
`photos://album?name=`, `photos://devices?index=`, `photos://preferences/icloud`. The review server
exposes it at `/open?uuid=…` and the page has a "Watch in Photos" button (`O`), so a clip
is one click from full playback with no download and no hunting for a filename. The server
opens it rather than the page, so the browser is never asked to hand a custom scheme to the
OS, and the UUID is regex-validated before it reaches `open`.

**Never download a clip you have not decided to mine.** 150 clips across 36 shows, ~150MB
each — fetching them all is **22.5GB**. `media:frames` downloads only clips the owner kept
in the review, extracts, and deletes the clips afterwards. For a clip, "usable" in the
review page means *worth mining for frames*, not *worth publishing*; the page says so.

**The owner marks the moment; the algorithm is the fallback.** Photos shows a readable
elapsed time on the scrubber (`00:09` / `−00:31`), so marking is just: watch in Photos,
read the number, type it into the review page. Judged against the frames `media:frames`
picked automatically, hand-marked moments were better — which is what settled it. Marks
win when present; when a clip carries none, the automatic extraction still runs, so
nothing regresses for clips nobody wants to mark.

**🔴 A CLIP IS A VIDEO. The owner's definitions, not ours:**

| marked | produced |
|---|---|
| frame timecode(s) | a still at exactly that moment, one per mark |
| in/out points | **one derived video — nothing else** |
| both | those stills and that video |
| neither | the algorithm picks frames; the fallback for a clip kept but unmarked |

This shipped wrong twice. First the trim was recorded, rendered, then ignored — on a
194-second clip marked 1:49–2:10 the sampler returned frames at 9, 55, 75, 99, 161 and 185
seconds, not one inside the window. "Fixing" that by sampling *inside* the trim was still
wrong: **a trim is a request for a video, and answering it with stills is inventing work.**
Say what will actually happen in the UI, too — a label promising frames that will not be
taken is how the two ideas got conflated.

Frame filenames carry the ORIGINAL clip's timeline, never a trim-relative one, or
provenance describes the wrong moment.

**A hand-marked frame is already a decision, and is accepted automatically.** The owner
scrubbed to that moment and chose it; asking them to re-open the review page and confirm
the frame they asked for is the frame they wanted is asking the same question twice. It
inherits the clip's verdict and attribution. **Algorithmic picks are never auto-accepted** —
nobody has looked at those, and a guess that marks itself approved is the fabricated
decision this pipeline refuses everywhere else.

**Provenance is read from the EXTRACTOR's filename, not the staged one.** A staged frame is
named `<clip-uuid>_f0_pv.jpeg` so the review page can address it by UUID, which says
nothing about where it came from; the name carrying provenance is
`<clip>__f0113__lap0.jpg`. Reading the wrong one silently produced `derivedFrom: null` and
lost the link to the clip.

**Video: one index, canonical names, never in `public/`.**

- **The site never shows video.** It only goes outbound to Shorts and TikTok, so there is
  nothing to serve from a CDN and no reason for `public/videos/` to exist.
- **Nor could it.** Two trims from one show are 247MB at full resolution, against 13MB for
  every image in the repo combined. `.git` is already 324MB and never forgets a byte.
- **Rendered to the SHORT EDGE at 1080**, aspect preserved: 134MB → 18.6MB. Both channels
  take 1080×1920 and re-encode on ingest, so uploading 4K just means they discard it.
- **Landscape is never auto-cropped to 9:16.** It loses 68% of its width, and where the
  crop sits decides whether the performer is in frame — an editorial decision the owner
  makes by hand.
- **Canonical filenames, same as stills:** `2026-06-04-alison-moyet-01.mp4`. Ordinals run
  per act AND per kind. They previously carried the clip's UUID, which was a handle
  grabbed for uniqueness rather than a name — a workflow reading both kinds should not
  have to learn two conventions.
- **Video IS in `media-index.json`**, with `kind`, `duration`, `path`, and a null `url`
  until it is uploaded somewhere a CI job can fetch. One index describes all of a show's
  media, or a workflow asking "what do I have for this night?" sees half of it.
- **`render: {uuid, in, out}` is the durable artefact, not the file.** The full-resolution
  trim is never kept: it is reproducible byte-for-byte from the recipe and the original
  still in Photos. What is kept is the channel-sized render, which is both the deliverable
  and the fallback if the library entry ever disappears.
- Cut with `libx264`, never `-c copy`: stream-copy cuts only on keyframes and would move
  the in-point by up to a couple of seconds, losing the precision just marked by hand.

**🔴 ALGORITHMIC FRAME PICKING IS DEAD. Hand-marking is the pipeline.** Settled
2026-08-25 by the owner, on the 2026-06-04 review. Do not re-open it, and do not quote the
old 83%.

The tally, with denominators:

| Run | Condition | Kept |
|---|---|---|
| 2026-08-23 uxtest | 6 auto frames, 2 clips, judged **blind** | 5 of 6 |
| 2026-06-04 review | 7 auto frames, 3 clips, judged **beside a hand-marked frame** | **0 of 7** |
| 2026-06-04 review | 1 hand-marked frame | **1 of 1** — shipped as `2026-06-04-alison-moyet-04.jpg` |

Two things this establishes:

**The comparison condition was doing the work, not the algorithm.** Judged blind, an auto
frame reads as acceptable. Put it next to the moment the owner chose from the same show and
it does not survive. The 83% was never a keep rate for *good* frames — it was a keep rate
for *unobjectionable* ones, and the review page had nothing better on it to lose to.

**Laplacian sharpness is anti-correlated with the moment.** This is the mechanism, and it is
why tuning will not rescue the approach. Motion blurs frames, so scoring by sharpness
systematically prefers the stillest stretch of a clip — and the frames worth keeping are the
ones with motion in them. The hand-marked keeper is Moyet mid-gesture, arm raised. The
algorithm cannot reach that frame; it is scored down for the exact property that makes it
worth having.

The minimum-gap rule is *not* the problem and is working as designed — the picks are not
duplicates. Measured RMSE within a clip is 0.18–0.34 against a 0.33 cross-clip control, so
they are genuinely different instants. They are just *interchangeable*: different instants
of the same uneventful stretch. Diversity was never the failure; subject was.

Consequence for the 36 shows of clips still unmined: mining is still worth doing — the
hand-marked frame is a tier-1 keeper that existed nowhere else. Mine by **watching the clip
in Photos and marking the moment** (#395/#399), never by extracting and triaging. Auto
extraction survives only as the fallback when a kept clip carries no marks, and its output
should be assumed rejected until judged.

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

**As built (#379):**

- **Stripping is asserted on the written bytes, twice.** Once via sharp's view of the
  output, once by a raw byte scan that shares no parser with the encoder — the encoder
  cannot be the only witness that it stripped something. A file that fails is **deleted,
  not committed**, and the run exits non-zero.
- **Idempotency is keyed on the SHA-256 of the source**, not on its filename. The owner is
  free to rename anything in the inbox and a re-run still recognises it.
- **Ordinals continue from the index**, so a second run adds `-04` rather than colliding.
- **A later `hero.*` wins and demotes the previous hero, loudly.** The owner's most recent
  explicit instruction is the answer, and it is never silent.
- **Video is reported as skipped, never silently dropped** — stills are this command's job;
  clips belong to #342 / #349.
- **Errors do not stop the run.** Every good file is still ingested; the bad ones are listed
  and the command exits 1, so a wrong credit cannot be mistaken for a clean run.
- Frames named by `extract_frames.sh` (`IMG_3081__f0042__lap31.77.jpg`) record
  `derivedFrom` — provenance a different-night disclosure depends on.

---

## Where things live

| | |
|---|---|
| Source library | Photos.app — never copied wholesale |
| Candidate corpus, evaluation runs | `concert-photos-audit/` — **gitignored** |
| **Rendered clips** | **`video/renders/`** — gitignored, canonical names, indexed |
| Tooling | `scripts/media/` (tracked) · the guard + `BUILD.txt` (tracked by exception) · binary, `*.py`, `*.sh` (ignored) |
| **Final selects (stills)** | **`public/images/shows/`** — committed, EXIF-stripped, 2048px masters |
| **The mapping** | **`public/data/media-index.json`** — committed, describes stills AND video |

**Stills** live in the repo, not R2: the card renderer needs the file at build time,
Cloudflare already serves `public/` from the CDN, and `git clone` restores every select.
R2 only becomes correct past a few hundred files; `media-index.json` addresses by `url` so
that migration costs no consumer changes.

**Video is the opposite case and is never committed.** It is not served, it is 10–100×
larger, and it is reproducible from its recipe. It sits in `video/renders/` with `url:
null` until a channel needs it somewhere fetchable — at which point an upload step fills
in `url` and, again, no consumer changes.

---

## Tooling status — read this before citing a command

**Built and working:**

| | |
|---|---|
| `concert-photos-audit/bin/osxphotos` | **read-only guard — tracked by exception, CI-tested.** The binary it wraps stays gitignored |
| `extract_frames.sh` / `frame_score.py` / `pick_frames.py` | frame sampling, Laplacian scoring, min-gap selection |
| **`npm run media:review <date>`** | **stills review — previews, localhost page, verdicts per keystroke — #380, shipped** |
| `scripts/media/review-page.html` | the review page — tracked, one show per run |
| `scripts/media/review_server.py` | localhost server; writes only `verdicts.json` |
| `scripts/media/selects.ts` | `selects.json` — the decision, and the cross-check on the filing |
| `probes/*.py` | one-off investigation scripts |
| **`npm run media:prep <date>`** | **scaffold inbox folders + per-show worksheet — #378, shipped** |
| `scripts/media/show.ts` | date → concert, lineup, folder plan (pure, unit-tested) |
| `scripts/media/rank.ts` | the two-factor model — concert-likelihood and quality (pure, unit-tested) |
| `scripts/media/worksheet.ts` | WORKSHEET.md renderer (pure, unit-tested) |
| `scripts/media/query_window.py` | the osxphotos query function `media:prep` runs |
| **`npm run media:ingest [date]`** | **inbox → `public/images/shows/` + `media-index.json` — #379, shipped** |
| `scripts/media/match.ts` | forgiving folder → act matching, against one night's bill only |
| `scripts/media/exif.ts` | EXIF cross-check, and the metadata-leak assertion |
| `scripts/media/media-index.ts` | `media-index.json` schema and ordering |

**Specified, NOT built** — do not instruct anyone to run these yet:

| | |
|---|---|
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
