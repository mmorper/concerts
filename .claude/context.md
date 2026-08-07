# Morperhaus Concert Archives - Project Context

## Quick Start

**Version:** v5.3.0 (Production)
**Status:** Live at concerts.morperhaus.org
**Last Sync:** 2026-08-07

### Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run build-data   # Fetch & enrich concert data
```

### Key Files

- **Roadmap:** [docs/ROADMAP.md](../docs/ROADMAP.md) - Short/medium-term feature planning
- **Changelog:** [src/data/changelog.json](../src/data/changelog.json) - Release history
- **Main App:** [src/App.tsx](../src/App.tsx)
- **Concert Data:** [public/data/concerts.json](../public/data/concerts.json)
- **Version Management:** [.claude/version-management.md](./.claude/version-management.md)
- **Operator dashboard (internal):** [docs/DASHBOARD_OPERATIONS.md](../docs/DASHBOARD_OPERATIONS.md) — admin/ops guide for the private `/dashboard` console

---

## Architecture

**5 Full-Viewport Scenes** with snap scrolling + standalone pages:

| # | Scene | Component | Tech |
|---|-------|-----------|------|
| 1 | Timeline | Scene1Hero.tsx | D3.js + Hover Preview |
| 2 | Venue Network | Scene4Bands.tsx | D3.js force |
| 3 | Geography | Scene3Map.tsx | Leaflet + Venue Photos |
| 4 | Genres | Scene5Genres.tsx | D3.js sunburst |
| 5 | Artists | ArtistScene/ | Framer Motion + Gatefold |

**Standalone Pages:**

| Route | Purpose |
|-------|---------|
| `/liner-notes` | AI-written weekly stories from the archive (v4.4.0) |
| `/liner-notes/:slug` | Individual post permalink |
| `/whats-playing` | App release notes & changelog (v4.4.0) |
| `/how-it-works` | Interactive data enrichment cascade, 7 tiers (v4.6.0) |
| `/about` | Creator backstory & E-E-A-T signals |

**Tech Stack:** Vite 6 + React 18 + TypeScript 5 + Tailwind 4 + D3 7 + Framer Motion 11 + Leaflet

**Infrastructure:** Cloudflare Pages (hosting) + Cloudflare Worker (dynamic OG tags for `/liner-notes` and `/whats-playing`)

**Data:** 183 concerts (1984-2026), 257 artists (107 headliners + openers), 79 venues
**SEO:** 92/100 (last analyzed: 2026-02-05)

---

## Documentation Map

```
docs/
├── ROADMAP.md             # Short/medium-term feature planning (ACTIVE)
├── DEEP_LINKING.md        # URL navigation system (scene & entity deep links)
├── LINER_NOTES_PIPELINE.md # Liner notes generation architecture & detector reference
├── api-setup.md           # API configuration
├── BUILD.md               # Build pipeline & deployment
├── DATA_PIPELINE.md       # Data fetch/validation/enrichment
├── WORKFLOW.md            # Development workflow & process
├── design/                # Visual design system
│   ├── scene-design-guide.md
│   ├── color-specification.md
│   └── changelog-style-guide.md
└── specs/
    ├── implemented/       # Completed feature specs
    ├── future/            # Planned features
    └── archive/           # Superseded specs & historical docs
```

---

## Key Documentation Reference

| Document | Use When |
|----------|----------|
| [.claude/quality-standards.md](quality-standards.md) | **Before submitting any changes** |
| [docs/DEEP_LINKING.md](../docs/DEEP_LINKING.md) | Creating URLs, implementing navigation |
| [docs/DATA_PIPELINE.md](../docs/DATA_PIPELINE.md) | Working with concert data, running enrichment |
| [docs/LINER_NOTES_PIPELINE.md](../docs/LINER_NOTES_PIPELINE.md) | Liner notes generation, detectors, schema |
| [docs/BUILD.md](../docs/BUILD.md) | Deploying, regenerating OG images |
| [docs/WORKFLOW.md](../docs/WORKFLOW.md) | Development lifecycle, data refresh workflow |
| [docs/api-setup.md](../docs/api-setup.md) | Configuring API credentials, troubleshooting auth |

**Deep Linking Quick Reference:**
- Scene URLs: `/?scene={timeline|venues|geography|genres|artists}`
- Artist deep link: `/?scene=artists&artist={normalized-name}`
- Venue deep link (graph): `/?scene=venues&venue={normalized-name}`
- Venue deep link (map): `/?scene=geography&venue={normalized-name}`
- Year deep link: `/?scene=timeline&year=YYYY`
- Normalization: lowercase, replace special chars with hyphens, collapse multiple hyphens

---

## Current Status

**Live Site:** https://concerts.morperhaus.org

**v5.3.0 Production (Latest — 2026-08-06):**

- ✅ Artist billing-alias map consumed by the Artist scene and the MCP — `sameAct` collapses billings, `sharesMember` deliberately does not (#227)
- ✅ Two setlist-native detectors, `full-circle` and `guest-bridge`; song joins added to five existing detectors (#228/#229/#230)
- ✅ Image integrity across posts, artists and venues — `image.ref` is authoritative, enrichment validates what it stores, 24 orphan records pruned (#252/#255/#259/#256)
- ✅ All four Cloudflare Workers now deploy on merge; meta-injector was the last manual one (#262)
- ✅ `scripts/` and `test/` typechecked in CI; MCP smoke test asserts real `tools/call` (#246/#223)

**Recent Releases:**

- **v5.3.0** (2026-08-06): Artist billing aliases in the mosaic and MCP (#227); `full-circle` + `guest-bridge` detectors and song joins across five more (#228/#229/#230); image-rot fixes with validation at the source and orphan pruning (#252/#255/#259/#256); meta-injector auto-deploy completes Worker automation (#262)
- **v5.2.0** (2026-08-05): Liner notes selection rewritten to detector rotation — all 15 detectors publish, first repeat at post 16 (#226/#231); setlist deep links wired for the first time, 20 posts (#198/#239); geographic-chapter region mapping (#232); milestone-marker scoring + concert-streak window (#233); dangling relatedSlugs + venue image chain (#234/#235)
- **v5.1.0** (2026-08-04): Setlist deep linking (`&show=`) across six surfaces (#195); root CI gate (#116); three pipeline/SEO suites repaired (#207); share implementations consolidated (#204)
- **v5.0.0** (2026-06-20): Ask the Archive — in-app conversational client, ⌘K spotlight, MCP connector; Operator Dashboard phases 0–6 (#159)
- **v4.6.1** (2026-04-16): Liner Notes Tuning & Polish — smarter artist/category variety, UI fixes
- **v4.6.0** (2026-03-10): How It Works — interactive animated cascade showing 7 enrichment tiers
- **v4.5.1** (2026-03-08): Mobile Polish — Liner Notes card layout, share button, artist modal badge

---

## Active Work & Next Steps

### In flight — Discography Trajectory (v5.4.0)

**Epic** [#266](https://github.com/mmorper/concerts/issues/266) · **Spec** [global-discography-trajectory.md](../docs/specs/future/global-discography-trajectory.md) (v1.3) · **Merged** [#278](https://github.com/mmorper/concerts/pull/278) → `f426575`, live in production

Joins the 11,359-release discography against 40 years of attendance to answer where an artist stood in their arc on a given night — and what hadn't happened yet. Ships the first liner-notes detector where the narrator is wrong about the future.

All three windows complete (#268–#274). Full suites green.

| Artefact | Note |
| --- | --- |
| `scripts/utils/album-title.ts` | iTunes ↔ MusicBrainz titles, 58.1% → 73.5%. **Fail-closed by design** — do not add a fuzzy tier |
| `scripts/utils/artist-key.ts` | Comparison only. **Never** wire into slug generation — published deep links depend on `normalize.ts` |
| `public/data/album-eras.json` | 302 KB, build-data Step 7.5. Stores nothing derivable |
| `get_career_position` | MCP tool; `search_concerts` gained `cycleBucket` |
| `album-trajectory` | 8 findings, `surpriseFactor` 10 |
| `discography-crossref` | Implemented, tested, **deliberately not registered** — enable in v5.5 |
| `scripts/liner-notes/voice-check.ts` | The voice checklist as code; errors drop a post from the run |

**Shipped, NOT released.** Production runs this code under the v5.3.0 label — the Workers auto-deployed on merge, but there is no version bump or changelog entry yet. `/release` still owes: version bump, changelog, meta-injector manual deploy, and the v5.5 drift reconciliation.

⚠️ **The liner-notes cron (Mondays 08:00 UTC) publishes independently of `/release`.** The first `album-trajectory` post and the first real run of the voice gate will happen on schedule whether or not a release has been cut. The gate drops posts on error rather than publishing them, so the failure mode is conservative — but it has never run outside a manual invocation.

**Follow-on:** [#267](https://github.com/mmorper/concerts/issues/267) v5.5 setlist song → album attribution (spec written, **provisional** until v5.4 ships). [#275](https://github.com/mmorper/concerts/issues/275) iTunes wrong-artist bug — fixing it raises the match rate for free.

### In-flight Gate (blocking MCP work)

**Morperhaus Concert Archive MCP Server** — epic [#102](https://github.com/mmorper/concerts/issues/102)

- **W0 ✅ cleared** (2026-05-09) — verified via `workers/mcp-poc/verify.sh` from a Codespace; `tools/call ping` returned `pong` over Streamable HTTP. Architecture decision (Cloudflare `agents/mcp` SDK) confirmed. See [#103](https://github.com/mmorper/concerts/issues/103).
- **Next gate: W1** ([#104](https://github.com/mmorper/concerts/issues/104)) — restructure live meta-injector into `workers/meta-injector/`, redeploy, live-curl verify. **Production-touching; do this from a laptop, not iPad.** Branch: `mcp/w1-restructure` (not yet created).
- **W2+W3+W4** ([#105](https://github.com/mmorper/concerts/issues/105) / [#106](https://github.com/mmorper/concerts/issues/106) / [#107](https://github.com/mmorper/concerts/issues/107)) — share branch `mcp/phase-1-server`, blocked on W1.
- **Spec:** [docs/specs/future/global-mcp-server.md](../docs/specs/future/global-mcp-server.md)
- **Cleanup outstanding:** retire the throwaway `workers/mcp-poc/` directory and the `mcp/w0-transport-poc` branch (W0 was throwaway by design — no merge needed).
- **Housekeeping (cosmetic):** delete stale local branch `claude/add-mcp-server-spec-GAzJd`; backfill `Target Version` and `Last Updated` lines in the spec header.

### Paused Initiatives

**HyperFrames video pilot — Social Distortion Thread** (shelved 2026-05-17)

- **Status:** First pilot video built, rendered, and delivered with audio. Paused awaiting pilot review decision [#100](https://github.com/mmorper/concerts/issues/100). Templates A/B/D ([#99](https://github.com/mmorper/concerts/issues/99)) not started.
- **Branch:** `pilot/hyperframes-poc` (pushed to origin, not merged)
- **Tag:** `pilot/social-distortion-thread-v1` at commit `09f065d` (permanent reference even if branch is ever deleted)
- **Handoff doc:** [docs/specs/future/hyperframes-poc/HANDOFF.md](../docs/specs/future/hyperframes-poc/HANDOFF.md) — read this first if resuming
- **Pattern library (reusable for future videos):** [video/PATTERNS.md](../video/PATTERNS.md)
- **Postmortem:** [video/compositions/social-distortion-thread/POSTMORTEM.md](../video/compositions/social-distortion-thread/POSTMORTEM.md)
- **Final MP4** is gitignored (regenerable in ~37s via `cd video && node scripts/render.mjs --slug social-distortion-thread`)

To resume: read HANDOFF.md, make the [#100](https://github.com/mmorper/concerts/issues/100) green/yellow/red call, then either merge or iterate.

---

See [docs/ROADMAP.md](../docs/ROADMAP.md) for current priorities.

**Open GitHub issues:**

1. **#88** — Make How It Works cascade thumbnails interactive (T2 venue, T3 artist, T4 album art)
2. **#69** — Improve genre coverage for opener artists (currently 62% vs 93% for headliners)
3. **#68** — Deferred liner notes generators: genreOutlier, doubleHeader, discographyCrossref, temporalPattern
4. **#30** — Enhance llm.txt with page structure & semantic hierarchy (low-effort, ~15 min)
5. **#22** — Audio preview playback on individual setlist items
6. **#5** — Artist Discography UI Panel (data pipeline complete since v3.5.0)
7. **Analytics Suite** (#37–#41) — Scene navigation, artist content, setlist/venue, user behavior, retention
8. **#8** — Renamed venue display badges on map popups
9. **#7** — Venue name change detection & CLI management
10. **#14** — Validation architecture refactor (code quality)

---

## Documentation Guidelines

**Before creating new documentation:**
1. **Review existing docs first** — Check if content belongs in existing files
2. **Consolidate when possible** — Prefer editing over creating new files
3. **Follow existing structure:**
   - `docs/ROADMAP.md` — Current priorities and planned features
   - `src/data/changelog.json` — Release history with highlights
   - `docs/WORKFLOW.md` — Development workflow and process
   - `docs/BUILD.md` — Build pipeline and deployment
   - `docs/DATA_PIPELINE.md` — Data fetch/validation/enrichment
   - `docs/specs/future/` — Detailed specs for planned features
   - `docs/specs/implemented/` — Completed feature implementation details

---

## Version Release Workflow

Use the `/release` command in Claude Code to automate the release process:

```
/release minor          # New feature
/release patch          # Bug fix
/release --dry-run      # Preview changes
```

The command handles: changelog, package.json, ROADMAP, README, context.md, spec file moves, validation, git commit/tag/push.

See `.claude/commands/README.md` for full documentation.

---

## Recent Commits (Last 10)

- `ffcada2` — docs: secret management runbook + key→store matrix (#148)
- `bd26c28` — feat(ask): exhibit schema + rendering (#140) (#147)
- `57a055a` — feat(ask-chat): chat backend — tool-grounded loop + cost/abuse gate (#139) (#146)
- `53fcae1` — docs(spec): Ask the Archive in-app conversational client (epic #138) (#144)
- `7f4bb30` — docs: context-sync + roadmap refresh (post setlists/top-songs)
- `ef8f4e3` — chore: housekeeping — gitignore video renders, file completed specs
- `ffc521d` — fix(mcp): connector icon — serve PNG, not SVG/ICO only
- `d7c09f3` — feat(mcp): setlists & top songs — get_concert_setlist + get_archive_top_songs (#145)
- `bf18ead` — feat(mcp): Ask the Archive — site presence (nav + end-of-scroll coda) (#135)
- `049804d` — fix(changelog): 'See it live' uses a real navigation, not client-side navigate

---

*Last updated: 2026-08-07 by Claude Code — v5.4.0 Discography Trajectory implementation*
