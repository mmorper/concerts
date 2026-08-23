# Media Workflow — prep, review, ingest

**Status:** Specified, not built
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
1.  npm run media:prep 2026-06-04     scaffold folders + worksheet
2.  review in Photos.app              human, out-of-process
3.  export selects into the inbox     human, drag and drop
4.  npm run media:ingest              strip, name, index, report
5.  commit                            selects + media-index.json
```

Only steps 1 and 4 are code. Steps 2 and 3 are deliberately manual — see
§"Why video is out-of-process" in the skill.

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

**Acceptance:**
- [ ] Fails loudly on a date not in `concerts.json`
- [ ] Creates a folder per act using normalised slugs, plus `_venue/`
- [ ] Never overwrites an existing folder's contents
- [ ] Worksheet lists `original_filename` for every candidate
- [ ] Reports counts excluded at each stage
- [ ] Reads only — no library mutation (guard enforced)

---

## `media:ingest` — accept results back

Reads `concert-photos-audit/inbox/`, and for each date folder:

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

**Acceptance:**
- [ ] Wrong-date folder fails loudly
- [ ] Unknown artist folder fails with that show's lineup listed
- [ ] Root-level file reported as an error, not silently credited
- [ ] EXIF contradiction warns; folder wins
- [ ] **No committed file retains GPS, capture time or device id** — assert, do not trust
- [ ] `media-index.json` carries per-asset `artist`, `tier`, `source`
- [ ] Re-running is idempotent

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
3. **Where does an extracted frame's provenance live?** It is tier 1 `personal`, but
   knowing it came from a clip matters for the different-night disclosure. Likely a
   `derived_from` field in `media-index.json`.
4. **Does the worksheet get committed?** It contains `original_filename` and timestamps —
   personal, though not location. Leaning: keep it in the gitignored inbox.

---

## Revision History

- **2026-08-23:** Written after a 53-asset UX test. Replaces the shared-album inbox design
  in `global-social-syndication.md` §"Submission". Video review moved out-of-process at the
  owner's direction after poster-frame review was confirmed unworkable and
  `--download-missing` proved to need a separate Automation permission.
