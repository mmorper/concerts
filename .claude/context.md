# Morperhaus Concert Archives - Project Context

## Quick Start

**Version:** v6.1.0 (Production)
**Status:** Live at concerts.morperhaus.org
**Last Sync:** 2026-10-31

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

**6 Full-Viewport Scenes** with snap scrolling + standalone pages:

| # | Scene | Component | Tech |
|---|-------|-----------|------|
| 1 | Timeline | Scene1Hero.tsx | D3.js + Hover Preview |
| 2 | Venue Network | Scene4Bands.tsx | D3.js force |
| 3 | Geography | Scene3Map.tsx | Leaflet + Venue Photos |
| 4 | Genres | Scene5Genres.tsx | D3.js sunburst |
| 5 | Artists | ArtistScene/ | Framer Motion + Gatefold |
| 6 | Ask the Archive | components/ask/ | Chat over the MCP tools (ask-chat Worker), ⌘K spotlight |

**Standalone Pages:**

| Route | Purpose |
|-------|---------|
| `/liner-notes` | AI-written weekly stories from the archive (v4.4.0) |
| `/liner-notes/:slug` | Individual post permalink |
| `/whats-playing` | App release notes & changelog (v4.4.0) |
| `/how-it-works` | Interactive data enrichment cascade, 7 tiers (v4.6.0) |
| `/about` | Creator backstory & E-E-A-T signals |
| `/about-mcp` | The MCP connector — add the archive to Claude |
| `/dashboard` | Internal operator console (Cloudflare Access) |

**Tech Stack:** Vite 6 + React 18 + TypeScript 5 + Tailwind 4 + D3 7 + Framer Motion 11 + Leaflet

**Infrastructure:** Cloudflare Pages (hosting) + four Workers, each with its own CI and auto-deploy: `meta-injector` (dynamic OG tags), `mcp-server` (`/mcp` connector), `ask-chat` (Ask the Archive), `dashboard-refresh` (operator dashboard). GitHub Actions run the data refresh, weekly liner notes, and daily syndication / On This Day.

**Data:** 185 concerts (1984-2027), 258 artists (108 headliners), 80 venues
**SEO:** 92/100 (last analyzed: 2026-02-05)

---

## Documentation Map

```
docs/
├── ROADMAP.md             # Short/medium-term feature planning (ACTIVE)
├── DEEP_LINKING.md        # URL navigation system (scene & entity deep links)
├── LINER_NOTES_PIPELINE.md # Liner notes generation architecture & detector reference
├── SYNDICATION.md         # Social posting: kill switch, channels, schedule, retraction
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

**v6.0.0 (2026-08-10):**

- ✅ Song → album attribution across the archive — 1,716 of 1,912 unique artist·song pairs (89.7%), three tiers: top-tracks 253, MusicBrainz 1,428, iTunes 35 (#276/#282)
- ✅ Two detectors off the back of it: `road-tested` (14 findings) and `most-witnessed-album`; `get_concert_setlist` annotates every song with its album (#277)
- ✅ Liner note footers play the song the post is about, and label the fallback when they cannot (#299)
- ✅ Wrong-band audio corrected or removed for 12 artists; Re-Flex's discography was a French remixer's (#275/#300)
- ✅ One archive-stats derivation replaces six; `validate:docs` now guards the shape, not just the prose (#295)
- ✅ Dashboard can see attribution coverage; `lastBuildAt` moves when the resolver runs (#289)

**v6.1.0 Production (Latest — 2026-10-31):**

- ✅ Social syndication live — Bluesky + Mastodon drip one liner note a day plus On This Day posts; kill switch, retraction, `syndicate:preview`, per-channel health (epic #323, `docs/SYNDICATION.md`)
- ✅ Instagram adapter + R2 card host wired in, **inert until its secrets exist** (#556/#557, awaiting #334/#336)
- ✅ Personal media pipeline — `npm run media` (prep → review → ingest → crop), PhotoKit-safe, 30+ shows culled (`.claude/skills/media-pipeline/SKILL.md`)
- ✅ Automatic claim check for liner notes and social copy (#529), notes corrected after owner review (#526/#527)
- ✅ Liner notes no longer publish nothing: failures held for 8 weeks, every gate falls through to a deeper reserve, fact sheet sees every show a post names, exact date spans; empty run fails red (PR #591)
- ✅ Ask the Archive answers album questions — `get_album_info` + album-annotated setlists (#317, PR #591)
- ✅ Model move to Sonnet 5 across all surfaces (#500/#502); TypeScript 7 at the root (#523); `@anthropic-ai/sdk` 1.x (#590)

**Recent Releases:**

- **v6.1.0** (2026-10-31): The archive posts itself — Bluesky + Mastodon syndication with On This Day (#323); claim check on every note and post (#529); personal media pipeline, 129 photos + 15 clips from 44 shows; Instagram wired, inert pending credentials; liner-notes empty-run fix and Ask album questions (#317, PR #591); Sonnet 5, TypeScript 7, SDK 1.x
- **v6.0.0** (2026-08-10): Song → album attribution — `song-albums.json` at 89.7% across three tiers (#276/#282); `road-tested` + `most-witnessed-album` detectors and MCP setlist annotation (#277); liner-note footers play their subject song (#299); 12 artists' wrong-band audio fixed and Re-Flex's discography corrected (#275/#300); one archive-stats derivation (#295); dashboard attribution stage (#289)
- **v5.4.0** (2026-08-07): Discography trajectory — `album-eras.json` joins 11,359 releases against attendance; `get_career_position` MCP tool + `cycleBucket` search; `album-trajectory` detector; `album-context` repaired 17→24; voice checklist made executable (epic #266, PR #278)
- **v5.3.0** (2026-08-06): Artist billing aliases in the mosaic and MCP (#227); `full-circle` + `guest-bridge` detectors and song joins across five more (#228/#229/#230); image-rot fixes with validation at the source and orphan pruning (#252/#255/#259/#256); meta-injector auto-deploy completes Worker automation (#262)
- **v5.2.0** (2026-08-05): Liner notes selection rewritten to detector rotation — all 15 detectors publish, first repeat at post 16 (#226/#231); setlist deep links wired for the first time, 20 posts (#198/#239); geographic-chapter region mapping (#232); milestone-marker scoring + concert-streak window (#233); dangling relatedSlugs + venue image chain (#234/#235)
- **v5.1.0** (2026-08-04): Setlist deep linking (`&show=`) across six surfaces (#195); root CI gate (#116); three pipeline/SEO suites repaired (#207); share implementations consolidated (#204)
- **v5.0.0** (2026-06-20): Ask the Archive — in-app conversational client, ⌘K spotlight, MCP connector; Operator Dashboard phases 0–6 (#159)
- **v4.6.1** (2026-04-16): Liner Notes Tuning & Polish — smarter artist/category variety, UI fixes
- **v4.6.0** (2026-03-10): How It Works — interactive animated cascade showing 7 enrichment tiers
- **v4.5.1** (2026-03-08): Mobile Polish — Liner Notes card layout, share button, artist modal badge

---

## Active Work & Next Steps

### In flight — Social Syndication (v7.0.0)

**Epic** [#323](https://github.com/mmorper/concerts/issues/323) · **Spec** [global-social-syndication.md](../docs/specs/future/global-social-syndication.md) · **Operator doc** [SYNDICATION.md](../docs/SYNDICATION.md)

| Channel | State |
| --- | --- |
| Bluesky | Live — daily drip + On This Day, @-mentions for artists/venues |
| Mastodon | Live — no @-mentions yet (#454) |
| Instagram | Built and wired, inert until credentials ([#334](https://github.com/mmorper/concerts/issues/334), [#336](https://github.com/mmorper/concerts/issues/336) — manual account setup) |
| X | Unbuilt ([#335](https://github.com/mmorper/concerts/issues/335)) |
| Video (L3) | Gated on the HyperFrames pilot decision (#100) |

`public/data/syndication-health.json` is the at-a-glance state: per-channel last success, posted counts, consecutive failures. Kill switch: `/social-pause`.

### Watch — weekly liner notes

Four Mondays between 2026-09-14 and 2026-10-26 published nothing. Fixed in PR #591 (held findings in `data/liner-notes-held.json`, reserve 4, fact sheet covers referenced shows, exact spans). **Check the Monday run after it merges**: a red run now means nothing published and GitHub emails the owner. The live fact checker has not been exercised against the fix.

### Operational to-dos (owner)

- [#164](https://github.com/mmorper/concerts/issues/164) — set `NOTIFY_WEBHOOK_URL` (ntfy topic) as a GitHub Actions secret and in `workers/ask-chat` + `workers/mcp-server`. Every alert path (spend tripwires, syndication health, empty liner-note runs) is log-only until then.
- [#515](https://github.com/mmorper/concerts/issues/515) — TypeScript 7: root done (#523); the three Workers are still on 5.7.

### Paused Initiatives

**Artist Discography UI — #5** (deferred 2026-08-11)

- **Status:** Data layer shipped; the **visual design does not exist**. Deliberately unmilestoned rather than parked on a v6.5 — a version number would stand in for a decision not yet made.
- **Why it is not a scheduling accident:** #5 was opened 2026-02-03, the day after #1. Six releases have shipped past it. It is not blocked and not unimportant; nobody has cracked what it should look like.
- **The spec misleads.** [docs/specs/future/artists-discography.md](../docs/specs/future/artists-discography.md) is 899 lines and reads as ready. It is a **data** spec — MusicBrainz endpoints, cover art, client architecture. That half shipped in v5.4/v6.0. The visual question was never answered.
- **What unblocks it — not inspiration.** This data has never been on screen in any form, so designing a panel means guessing what reads well. Cheap surfaces put it on screen inside an existing visual language first: #286 (How It Works Tier 3) shipped, and #317 (Ask answers album questions) shipped in PR #591. [#22](https://github.com/mmorper/concerts/issues/22) (setlist items — "which album, press play") is the one left. Learn which framing lands, then design the panel.
- **Knock-on:** [#115](https://github.com/mmorper/concerts/issues/115) is **no longer sequenced behind #5** and goes standalone — with an `llm.txt` fix attached, since `llm.txt:127`/`:678` publish `discography.json` to agents and moving it would 404 for them. Sitemap album routes stay out until #5 lands.

To resume: decide the visual framing first — that is the whole blocker. #5's own numbers are stale (`discography.json` is 4.6 MB / 260 artists / 11,366 releases, not 2.5 MB / 247 / 15k+).


**HyperFrames video pilot — Social Distortion Thread** (shelved 2026-05-17)

- **Status:** First pilot video built, rendered, and delivered with audio. Paused awaiting pilot review decision [#100](https://github.com/mmorper/concerts/issues/100). Templates A/B/D ([#99](https://github.com/mmorper/concerts/issues/99)) not started.
- **Branch:** `pilot/hyperframes-poc` is gone; the video workspace landed on `main` in #400
- **Tag:** `pilot/social-distortion-thread-v1` at commit `09f065d` (permanent reference even if branch is ever deleted)
- **Start here if resuming:** [docs/specs/future/hyperframes-poc/README.md](../docs/specs/future/hyperframes-poc/README.md) — the folder's front door (#447). Supersedes the old `HANDOFF.md`, which was deleted as stale.
- **Pattern library (reusable for future videos):** [video/PATTERNS.md](../video/PATTERNS.md)
- **Postmortem:** [video/compositions/social-distortion-thread/POSTMORTEM.md](../video/compositions/social-distortion-thread/POSTMORTEM.md)
- **Final MP4** is gitignored (regenerable in ~37s via `cd video && node scripts/render.mjs --slug social-distortion-thread`)

To resume: read the folder README, make the [#100](https://github.com/mmorper/concerts/issues/100) green/yellow/red call, then either merge or iterate.

---

See [docs/ROADMAP.md](../docs/ROADMAP.md) for current priorities.

**Open GitHub issues (top of the queue):**

1. **#334 / #336** — Instagram credentials and account setup (manual; code is done)
2. **#164** — Alert transport (`NOTIFY_WEBHOOK_URL`)
3. **#335** — X adapter
4. **#454** — Mastodon @-mentions
5. **#22** — Audio preview on setlist items (next step toward #5)
6. **#115** — `discography.json` (4.9 MB) shipped but unused by the client — #317 confirmed Ask doesn't need it
7. **#100** — HyperFrames pilot green/yellow/red call
8. **#515** — TypeScript 7 in the Workers
9. **#69** — Genre coverage for openers
10. **#68** — Deferred liner-notes detectors

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

- `6ce1ba2` — test: compare by id, not a detector name the type does not allow
- `3e1ed6b` — chore(deps): bump @anthropic-ai/sdk in /workers/mcp-server (#587)
- `ee5f37c` — chore(deps): bump @anthropic-ai/sdk from 0.135.0 to 1.3.0 (#590)
- `15b995c` — content: update syndication ledger + health [automated]
- `d74ed71` — chore(deps-dev): bump googleapis (#589)
- `779fcc2` — chore(deps-dev): bump @cloudflare/workers-types (#586)
- `e022dae` — chore(deps): bump dotenv (#588)
- `057a18a` — chore(deps-dev): bump @cloudflare/workers-types (#585)
- `f564392` — chore(deps-dev): bump @cloudflare/workers-types (#584)
- `1f1ec4c` — chore(deps): bump agents in /workers/mcp-server in the mcp-agents group (#583)

---

*Last updated: 2026-10-31 by Claude Code for v6.1.0 release*
