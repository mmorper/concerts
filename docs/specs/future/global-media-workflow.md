# Media Workflow — prep, review, ingest

**Status:** `media:prep` (#378) · `media:review` (#389) · `media:ingest` (#379) — **all BUILT** · `gaps` (#380) specified, not built
**Priority:** High — this is how personal media actually reaches a post
**Depends on:** #348 (audit tool, partially built) · Feeds #339, #340, #342
**Rules:** `.claude/skills/media-pipeline/SKILL.md` — read that first; it is operative
**Evidence:** `global-media-audit-tool-spec.md` — reasoning and measurements

---

## Why this exists separately

The audit tool spec answers *"what media do we have?"* This answers *"how does a photograph
get from the owner's Photos library into a social post?"* — the operator loop, run every
time a show happens.

It is specified separately because it is **mostly not automation**. The decisive step is a
human reviewing in Photos.app, and the tooling exists to point at things and to accept
results back. Attempting to automate the middle is how this project would acquire a video
editor it does not want.

---

## The loop

```
1.  npm run media:prep 2026-06-04              scaffold folders + worksheet
2a. npm run media:review 2026-06-04            STILLS — judge + attribute, keyboard
2b. Photos.app                                 VIDEO  — a poster frame cannot be judged
3.  npm run media:review 2026-06-04 --finish   write selects.json
4.  export the keepers into the inbox          human, drag and drop
5.  npm run media:ingest 2026-06-04            strip, name, index, CHECK, report
6.  commit                                     selects + media-index.json
```

**⚠️ Corrected 2026-08-24.** An earlier revision of this file collapsed step 2 into
"review in Photos.app, human, out-of-process", citing §"Why video is out-of-process". That
generalised the VIDEO rationale to everything, and it is wrong. It sent the owner to
Photos to triage 58 stills by hand on a show where the review page — listed as built and
working in the skill the whole time — was the right tool.

**Stills and video are different problems.** Video needs playback. Stills need a fast
keyboard verdict with both ranking factors and the night's lineup on screen. And triaging
stills in Photos makes the attribution call **twice** — once when judging, again when
choosing a folder — which is precisely where a mis-credit enters.

---

## `media:prep <date>` — scaffold and point

**Creates:**

```
concert-photos-audit/inbox/2026-06-04/
    the-human-league/
    alison-moyet/
    soft-cell/
    _venue/
    WORKSHEET.md
```

One folder per act — **headliner included, no implicit default** — plus `_venue/` for
frames belonging to the night rather than a performer (marquee, exterior, ticket stub,
crowd before doors). Those matter disproportionately: venue-subject posts have no working
tier-2 fallback while Places is unreliable (#315).

Scaffolding is **on demand, one show at a time**. A full scaffold would be 555 folders,
which destroys the inbox's value as a signal — you could no longer glance at it and see
what is pending.

**`WORKSHEET.md` contains**, per candidate:

| Column | Why |
|---|---|
| `original_filename` (`IMG_5693.HEIC`) | **directly searchable in Photos.app** — this is the pointer |
| time | narrows the search |
| type, duration, resolution, orientation | video triage without downloading |
| 9:16 eligible | Tier 3 supply |
| frame-grab eligible | short side ≥1350 |
| `mh-concerts` tagged? | the owner's own signal |
| concert-likelihood, quality | the two ranking factors |
| contributor | whose camera |

Sorted by likelihood × quality, but **everything in the window is listed** — the worksheet
ranks, it does not filter. It also states what it *excluded* and why.

**Acceptance — all met 2026-08-23 (#378):**
- [x] Fails loudly on a date not in `concerts.json` — and names the three nearest shows
- [x] Creates a folder per act using normalised slugs, plus `_venue/`
- [x] Never overwrites an existing folder's contents — verified by re-running on a filled
      inbox; the assertion pass compares the folder listing before and after and fails if
      a single file went missing
- [x] Worksheet lists `original_filename` for every candidate
- [x] Reports counts excluded at each stage
- [x] Reads only — no library mutation (guard enforced)
- [x] Asserts its own output before reporting success

**Built as:**

| | |
|---|---|
| `scripts/media/prep.ts` | the command — scaffold, query, rank, render, assert |
| `scripts/media/show.ts` | date → concert, lineup, folder plan |
| `scripts/media/rank.ts` | the two-factor model |
| `scripts/media/worksheet.ts` | `WORKSHEET.md` renderer |
| `scripts/media/query_window.py` | osxphotos query function — the only part that reads Photos |
| `test/pipeline/media-prep.test.ts` | 35 tests; every finding above is pinned as one |

The discriminating logic is pure TypeScript so it can be unit-tested without the library.
The Python side reports facts and counts and decides nothing — it returns an empty list to
osxphotos on purpose, so no osxphotos action can ever be handed a photo by that path.

`--scaffold-only` creates the folders and the bill without reading Photos, which is what to
run when the library is unavailable.

**Two corrections found while building:**

1. **The `--query-function` separator is `::`, not the single `:`** that `osxphotos query
   --help` documents. The documented form is rejected outright.
2. **Clip duration is on `exif_info`, not `PhotoInfo`.** `p.duration` does not exist and
   reads back as nothing rather than raising, so a worksheet built on it would have shown
   an empty duration column for every clip and looked merely unpopulated.

---

## `media:review <date>` — judge the stills, and record who is in them

Exports the previews Photos already holds (never originals — 42 of 58 assets for
2026-06-04 are iCloud-only, and fetching those needs `--download-missing`, which drives
Photos over AppleScript and wants an Automation permission this project has declined
twice). Serves `review-page.html` from localhost; every verdict lands on disk as it is
made, so an interrupted review resumes where it stopped.

**Attribution is captured here**, at the moment of judgement, because that is when the
owner is looking at the photograph and actually knows which act is in it. `--finish` writes
`selects.json`: keepers only, each resolved against that night's lineup, grouped by the
folder it belongs in, with iCloud originals flagged. A keeper with no act named is listed
as unattributed and **never placed** — 89 of 184 shows have openers, so defaulting to the
headliner is fabricated attribution on half the archive.

## `media:ingest` — accept results back

Reads `concert-photos-audit/inbox/`, and for each date folder:

**Two inputs, both real.** The inbox is how DERIVED files arrive — a frame extracted from a
clip, a trimmed clip, a crop — because those have no UUID in the library and can only come
back as files. `selects.json` is how the review's DECISIONS arrive. When a show has both,
the selects are the answer key: **a file whose folder disagrees with the attribution it was
given in the review is refused, not written.** Ingest sees only a folder, so this is the
one stage that can catch a mis-credit.


1. **Folder → concert.** All 184 dates are unique, so the mapping is exact. Not in
   `concerts.json` → error, never a guess.
2. **Subfolder → artist**, matched forgivingly against *that night's lineup only*. Case,
   punctuation and a leading article ignored; 2–6 candidates so ambiguity is nearly
   impossible. Ambiguous or unknown → fail with the lineup listed.
3. **Root-level files are an error**, not a headliner default. Silent mis-crediting is the
   failure this prevents.
4. **`hero.*` / `01.*` marks a hero.** Otherwise naming is free; ingest assigns order.
5. **EXIF is a cross-check, never the source of truth.** Derived files routinely lose
   `DateTimeOriginal` — ffmpeg strips it entirely, Photos exports of edited files are
   inconsistent. Warn on contradiction; the folder always wins.
6. **Strip all metadata** — GPS, timestamps, device identifiers.
7. Write `public/images/shows/2026-06-04-soft-cell-01.jpg`, update
   `public/data/media-index.json`.
8. **Report what was taken and what was skipped.**

Optional `notes.txt` per folder carries post-facing context — a different-night disclosure,
a caption.

**Acceptance — all met 2026-08-23 (#379):**
- [x] Wrong-date folder fails loudly
- [x] Unknown artist folder fails with that show's lineup listed
- [x] Root-level file reported as an error, not silently credited
- [x] EXIF contradiction warns; folder wins
- [x] **No committed file retains GPS, capture time or device id** — asserted on the written
      bytes by two independent checks, and a file that fails is deleted rather than committed
- [x] `media-index.json` carries per-asset `artist`, `tier`, `source`
- [x] Re-running is idempotent — keyed on the source SHA-256, not the filename
- [x] Extracted frames record `derivedFrom`

**Built as:**

| | |
|---|---|
| `scripts/media/ingest.ts` | the command |
| `scripts/media/match.ts` | folder → act, forgiving, against one night's bill only |
| `scripts/media/exif.ts` | the EXIF cross-check and the leak assertion (no dependency) |
| `scripts/media/media-index.ts` | index schema, ordering, idempotency |
| `test/pipeline/media-ingest.test.ts` | 23 tests |

**Decisions taken while building:**

- **Stripping is asserted twice, by mechanisms that share no parser.** sharp drops
  EXIF/XMP/IPTC/ICC on a plain re-encode, but "the encoder says it stripped it" is the
  encoder marking its own homework. The second check scans the raw output bytes for the
  APP1 marker, XMP namespaces, the Photoshop/IPTC block and GPS tag names.
- **`.rotate()` is applied before the metadata is dropped.** Discarding the EXIF
  orientation flag without first applying it would silently turn every portrait photograph
  sideways — a leak fix that quietly corrupts the archive.
- **Idempotency is keyed on the source SHA-256.** The inbox is the owner's working space
  and filenames there are theirs to change.
- **A later `hero.*` takes over and demotes the previous hero, with a warning.** The
  alternative — keeping the first — ignores an explicit instruction the owner just gave.
- **Errors never abort the run.** Every good file is ingested, the bad ones are listed, and
  the command exits 1.
- **Video is reported as skipped.** It is a real thing the owner may have exported, and
  belongs to #342 / #349 — so it is named, not silently ignored.

**Open question 3 is answered:** provenance lives in `derivedFrom: { original, frame }`,
parsed from the name `extract_frames.sh` already gives its output
(`IMG_3081__f0042__lap31.77.jpg`) rather than from a new convention.

---

## `media:gaps` — coverage as a map

Lists concerts with no personal media, and **what the fallback would be** for each: album
art, artist imagery, venue photo, or derived. Turns culling from a backward-looking chore
into something that says where to point the camera next time.

An empty artist folder is a signal, not an absence.

---

## Day-forward capture

The shared-album inbox in the parent spec is obsolete — the tool reads the Photos library
directly. For a future show:

1. **Shoot.**
2. Add the concert to `concerts.json` (existing pipeline step).
3. `npm run media:prep <date>` — the new window is just a new row.
4. Review in Photos, drop selects in, `media:ingest`.

**The four-frame shoot list is the only lever that changes supply over time:** wide venue,
marquee, one performer frame, the stub. It front-loads the marquee, the scarcest frame.

---

## Explicitly out of scope

- **Video playback, trimming, frame export in-app.** Photos.app does it better, and
  `--download-missing` needs an Automation permission plus 15–30GB of downloads.
- **A timeline editor.** Multi-clip sequencing, transitions, titles — that is CapCut or
  Final Cut. A finished file returns as its own master.
- **Bulk scaffolding.** 555 folders is noise.
- **Auto-attribution.** Which artist is in a frame is a human judgement on 48% of shows.

---

## Open questions

1. **Does `media:prep` also need a `--since` mode** for "every show added since last run"?
   Probably, once more than one show is pending.
2. **Should `notes.txt` be structured** (front-matter) or free text? Free text until there
   is a second consumer.
3. ~~**Where does an extracted frame's provenance live?**~~ **Answered 2026-08-23:**
   `derivedFrom: { original, frame }` in `media-index.json`, recognised from the filename
   `extract_frames.sh` already produces — no new convention for the owner to remember.
4. ~~**Does the worksheet get committed?**~~ **Answered 2026-08-23: no.** It is written to
   `concert-photos-audit/inbox/<date>/WORKSHEET.md`, inside the gitignored tree, and it
   carries `original_filename` plus capture times. A re-run replaces it and keeps one
   `WORKSHEET.prev.md`, so regenerating can never destroy a hand-written annotation —
   though `notes.txt` remains the place for anything meant to last.

---

## Revision History

- **2026-08-24:** `media:review` built and shipped (#389), and the step-2 error above
  corrected. Reconciles this file with `concert-photos-audit/README.md`, which said all
  along that ingest "reads an approved `selects.json`" — both are now true, and which one
  applies is stated rather than left to be discovered.
- **2026-08-23 (later still):** `media:ingest` built and shipped (#379). Acceptance ticked
  above, open question 3 answered. Tier 1 now exists as a mechanism — but note that no
  personal photograph has been ingested yet, so the go-live gate on #323 is unchanged until
  real selects are committed.
- **2026-08-23 (later):** `media:prep` built and shipped (#378). Acceptance ticked above.
  Two osxphotos corrections recorded. A guard hole was found and closed while building it:
  subcommand allowlisting alone let `query --add-to-album` through, which writes to the
  library through the one subcommand this project uses most.
- **2026-08-23:** Written after a 53-asset UX test. Replaces the shared-album inbox design
  in `global-social-syndication.md` §"Submission". Video review moved out-of-process at the
  owner's direction after poster-frame review was confirmed unworkable and
  `--download-missing` proved to need a separate Automation permission.
