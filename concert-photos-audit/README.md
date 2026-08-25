# concert-photos-audit — evaluation workspace (#348)

**Nothing in this directory is production data, and nothing here may become production
data by being copied.** This is the workspace for the media audit tool and its evaluation
runs. It is gitignored in full.

## The boundary

| | Lives here | Lives in the repo |
|---|---|---|
| Candidate corpus — thousands of frames with full EXIF | ✅ `evaluation/` | ❌ never |
| Preview exports, downloaded clips, extracted frames | ✅ `evaluation/` | ❌ never |
| Test verdicts, probe output, scratch analysis | ✅ `evaluation/` | ❌ never |
| The osxphotos **binary** | ✅ `bin/.osxphotos-raw` | ❌ too large, and machine-specific |
| The read-only **guard** | ✅ `bin/osxphotos` — **and tracked in git by a named exception**, CI-tested | — |
| Probe and frame scripts | ✅ `*.py`, `*.sh` | promoted to `scripts/media/` when they stabilise |
| **Final selects (stills)** | ❌ | ✅ `public/images/shows/` |
| **Rendered clips** | ❌ | ✅ `video/renders/` — gitignored, but canonically named and indexed |
| **The mapping** | ❌ | ✅ `public/data/media-index.json` |

A select reaches the repo by being **deliberately exported, EXIF-stripped, and written to
`public/images/shows/`** by the ingest step (#339) — never by being moved out of here.
If a file arrived in this directory, it is evaluation material.

## Why the separation is mechanical, not a convention

- The whole directory is in `.gitignore`, so nothing here can be committed by accident.
- Production media paths (`public/images/shows/`, `public/data/media-index.json`) are
  written **only** by the ingest step, which reads an approved `selects.json` — it does not
  copy from this tree.
- Verdicts recorded here are *evaluation* verdicts. They inform the tool's design; they are
  not the archive's selection record.

## The guard cannot be moved

macOS grants Full Disk Access against the **wrapper's** path, not only the binary's.
Relocating `bin/osxphotos` to `scripts/media/` — same binary, same arguments, same resolved
target — made every library read **hang**: no prompt, no error, a process sitting at two
seconds of CPU forever. Measured 2026-08-24.

That is why the guard is tracked *here*, by a narrow exception, rather than moved somewhere
git already watches. If it ever has to move, expect to re-grant Full Disk Access, and expect
the failure mode to be a silent stall rather than a permission error.

## Retention

Evaluation runs are **disposable and dated**. They can be deleted wholesale without losing
anything the project depends on:

    rm -rf concert-photos-audit/evaluation/<run>

What must NOT be deleted casually:

- `bin/.osxphotos-raw` — the locally built osxphotos. Rebuilding takes ~10 minutes and
  costs a new macOS permission prompt (TCC keys on path). The **guard** beside it is
  tracked in git, so losing this directory costs a rebuild, never the safety mechanism.
- `bin/BUILD.txt` — pinned commit and SHA-256 provenance.
- The scripts at this level, if they have not yet been promoted to `scripts/media-audit/`.

Downloaded originals are the bulkiest and least precious thing here — clips run
100–200MB each. Delete them once a run's questions are answered; they re-download from
iCloud on demand.

## Contents

    bin/osxphotos         read-only guard — TRACKED (see Safety); do not move it, see below
    bin/.osxphotos-raw    locally built osxphotos, ignored (see BUILD.txt)
    probes/               one-off investigation scripts and their logs
    evaluation/           dated evaluation runs — previews, clips, frames, verdicts
    review/               per-show review runs — previews + verdicts + selects.json
    extract_frames.sh     ffmpeg frame sampling
    frame_score.py        Laplacian variance of one frame
    pick_frames.py        frame selection with an enforced minimum gap

## Safety

`bin/osxphotos` is a **read-only guard**, and it is tracked in git — by a named exception
in this directory's `.gitignore` and the repo root's — so it can be reviewed and tested — `test/pipeline/osxphotos-guard.test.ts` asserts every refusal on
every PR. It permits `query`, `export` and `info`, and refuses:

- every subcommand capable of writing — `import`, `timewarp`, `add-locations`,
  `batch-edit`, `push-exif`, `sync`, `orphans`, `repair`;
- **mutating options on the permitted subcommands** — `query --add-to-album` creates an
  album in Photos, and `export --post-command` / `--post-function` run arbitrary code.

It also closes stdin so no run can hang on an interactive prompt, and sets
`OSXPHOTOS_NO_VERSION_CHECK=1` so no run touches the network.

**The Photos library is never modified. That is enforced here, not promised.**
