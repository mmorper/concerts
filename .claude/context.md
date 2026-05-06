# Morperhaus Concert Archives - Project Context

## Quick Start

**Version:** v4.6.1 (Production)
**Status:** Live at concerts.morperhaus.org
**Last Sync:** 2026-05-06

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

**Data:** 181 concerts (1984-2026), 256 artists (104 headliners + openers), 77 venues

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

**v4.6.1 Production (Latest — 2026-04-16):**

- ✅ Liner Notes selection: 10-post primary-artist cooldown prevents headliner repetition
- ✅ Liner Notes selection: recent-category deprioritization corrects "I Was There" overrepresentation
- ✅ Liner Notes selection: per-category cap (max 2/run) in standard mode
- ✅ Various UI polish: iPad portrait scroll, nav contrast, About nav position, RSS ghost posts

**Recent Releases:**

- **v4.6.1** (2026-04-16): Liner Notes Tuning & Polish — smarter artist/category variety, UI fixes
- **v4.6.0** (2026-03-10): How It Works — interactive animated cascade showing 7 enrichment tiers
- **v4.5.1** (2026-03-08): Mobile Polish — Liner Notes card layout, share button, artist modal badge
- **v4.5.0** (2026-03-08): Deep Cuts — liner notes in gatefold, year deep links, mobile bottom nav, unified toast
- **v4.4.0** (2026-03-08): Liner Notes — agentic AI-written weekly stories, blog feed, RSS, /whats-playing, Cloudflare Worker OG tags

---

## Active Work & Next Steps

### In-flight Gate (blocking MCP work)

**Morperhaus Concert Archive MCP Server** — epic [#102](https://github.com/mmorper/concerts/issues/102)

- **Status:** Window 0 Transport POC scaffolded but **not yet verified**. The 2-hour gate clock has not started — verification is the gate.
- **Branch:** `mcp/w0-transport-poc` (POC code at `workers/mcp-poc/`)
- **Spec:** [docs/specs/future/global-mcp-server.md](../docs/specs/future/global-mcp-server.md)
- **First action when next at a laptop** (do this before any other MCP work):
  1. `git checkout mcp/w0-transport-poc`
  2. `cd workers/mcp-poc && npm install && npx wrangler dev`
  3. In another terminal: `npx @modelcontextprotocol/inspector`
  4. Inspector → Streamable HTTP → `http://localhost:8787/mcp` → Connect → call `ping` → expect `"pong"`
- **On pass:** delete `workers/mcp-poc/`, close [#103](https://github.com/mmorper/concerts/issues/103), start W1 ([#104](https://github.com/mmorper/concerts/issues/104)) on a new `mcp/w1-restructure` branch.
- **On fail:** paste error in [#103](https://github.com/mmorper/concerts/issues/103); regroup before burning the cap.
- **Housekeeping (cosmetic):** delete stale local branch `claude/add-mcp-server-spec-GAzJd`; backfill `Target Version` and `Last Updated` lines in the spec header.
- **Do not start W1 / W2 work until this gate clears.**

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

- `2733e30` — fix: make How It Works scrollable on iPad portrait
- `fe73b03` — fix: remove ghost posts from liner-notes RSS, add generate:liner-notes-rss script
- `917b291` — fix: move About to last nav position across all pages
- `8ec13ab` — fix: improve nav contrast + How It Works layout
- `d00e366` — release: v4.6.0 - How It Works
- `339cb8e` — feat: cascade UX overhaul — post-build glow, centered cards, data-driven stats
- `7a19280` — fix: remove corpus scale label from T4
- `da11aeb` — feat: cascade counters — slot-machine spin + honest field counts
- `681dd5a` — release: v4.5.1 - Mobile Polish
- `c862ebb` — release: v4.5.0 - Deep Cuts

---

*Last updated: 2026-05-06 by Claude Code*
