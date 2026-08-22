# Social Syndication — Phase 0 Mocks

Creative investigation for [`global-social-syndication.md`](../global-social-syndication.md). Epic [#323](https://github.com/mmorper/concerts/issues/323).

**Design canvas:** https://claude.ai/code/artifact/1194ef41-e45e-489b-a57b-8efe275a8445 ([#325](https://github.com/mmorper/concerts/issues/325))

---

## Why this directory exists before any code

The payload schema depends on creative outcomes. Whether a post is one `hook` or three-to-five carousel `beats` is a different schema, and the second isn't reachable from the first without breaking every adapter and regenerating anything already syndicated. Phase 0 produces decisions; Phase 1 is blocked until they land.

## Contents

| File | Purpose |
|---|---|
| `corpus.json` | Real-data mock corpus ([#324](https://github.com/mmorper/concerts/issues/324)) — the records every mock is built from, chosen to include the ugly cases |
| `DECISIONS.md` | Phase 0 exit-criteria answers ([#328](https://github.com/mmorper/concerts/issues/328)) — the durable record |
| `PROVENANCE.md` | Per-source, per-channel image provenance ([#327](https://github.com/mmorper/concerts/issues/327)) — a record, not a gate |
| `Main.dc.html` + `Ladder*` | Wave 3 — the media-band system across tiers 1–3, plus the full-bleed counter-case |
| `Wide*.dc.html` | Wave 3 — the 1200×630 card, two options |
| `Grid*` / `Carousel` / `Otd*` / `Stress*` / `Captions` / `ChannelSheet` / `Profile` | Wave 3 — feed scale, schema, On This Day, worst cases, copy, channels, identity |
| `TrackA` / `Generative` / `Material` / `Photographic` (+ `*Wave2`) | Waves 1–2, preserved unchanged as the record |
| `canvas.json` | Canvas layout, pages, and the per-board motivation notes |

Phase 0 creative is **closed** — see `DECISIONS.md`. Phases 1+ may now proceed against it.

## The two copies, and why both

The **canvas** is the interactive copy — pan, zoom, click into elements, push pixels directly. The **repo** is the durable, diffable, reviewable copy that outlives any hosting.

Neither alone is sufficient: a canvas isn't reviewable in a PR, and a committed HTML file isn't something you can push pixels around in. Repo precedent for committed mocks already exists — `mocks-agentic-liner-notes-v3/`, `renamed-venue-mockups.html`, `dashboard-mock.html`.

**They do not sync automatically.** Visual edits made in the canvas live in the artifact, not in these files. Re-syncing is an explicit step: read the canvas back, extract the artboards, commit.

## Regenerating the canvas

The `.dc.html` files and `canvas.json` are the source. The assembled canvas file is a build output — a couple of megabytes of editor payload — and is deliberately **not** committed; regenerate it with the `/design` skill's seeder rather than hand-editing.

## Conventions in these files

- Type is **Playfair Display** + **Source Sans 3**, and the cultural-category violet `#7c3aed` is the same token `og-image.ts` already uses. The mocks extend the existing design system rather than inventing a parallel one.
- Boards render **the same post** — the `full-circle` note about *"Notorious"* — so comparisons aren't rigged toward a favourite.
- Every value is real archive data. Track B's bars are genuine per-year show counts, 1984–2026.
- **Wave 1's Track D embedded no real photograph.** Publishing third-party imagery under a brand account is the exact risk [#327](https://github.com/mmorper/concerts/issues/327) exists to resolve, so it's drawn as a marked placeholder carrying the attribution line the design would need forever.

## Rendering the boards

`scripts/render-mocks.mjs` renders any `.dc.html` here to a 1:1 PNG through
headless Chrome, expanding `sc-for`/`sc-if` and running each board's
`renderVals()`. It reports real overflow past the artboard box, which is how
three separate clipping bugs were found that arithmetic had missed.

```bash
node scripts/render-mocks.mjs docs/specs/future/mocks-social-syndication /tmp/shots Main.dc.html
```

It is also the prototype for the production renderer — see `DECISIONS.md` §8.
