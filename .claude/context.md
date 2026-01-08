# Morperhaus Concert Archives - Project Context

## Quick Start

**Version:** v3.1.0 (Production)
**Status:** Live at concerts.morperhaus.org
**Last Sync:** 2026-01-07

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

**5 Full-Viewport Scenes** with snap scrolling:

| # | Scene | Component | Tech |
|---|-------|-----------|------|
| 1 | Timeline | Scene1Hero.tsx | D3.js + Hover Preview |
| 2 | Venue Network | Scene4Bands.tsx | D3.js force |
| 3 | Geography | Scene3Map.tsx | Leaflet + Venue Photos |
| 4 | Genres | Scene5Genres.tsx | D3.js sunburst |
| 5 | Artists | ArtistScene/ | Framer Motion + Gatefold |

**Tech Stack:** Vite 6 + React 18 + TypeScript 5 + Tailwind 4 + D3 7 + Framer Motion 11 + Leaflet

**Data:** 178 concerts (1984-2026), 247 artists (104 headliners), 77 venues

---

## Documentation Map

```
docs/
├── ROADMAP.md             # Short/medium-term feature planning (ACTIVE)
├── DEEP_LINKING.md        # URL navigation system (scene & entity deep links)
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
        ├── STATUS-v1.0-v1.3-historical.md
        └── planning.md
```

---

## Key Documentation Reference

These docs provide essential context for common development tasks:

| Document | Use When |
|----------|----------|
| [docs/DEEP_LINKING.md](../docs/DEEP_LINKING.md) | Creating URLs, implementing navigation, writing specs with deep links |
| [docs/DATA_PIPELINE.md](../docs/DATA_PIPELINE.md) | Working with concert data, running enrichment, understanding validation |
| [docs/BUILD.md](../docs/BUILD.md) | Deploying, regenerating OG images, understanding build pipeline |
| [docs/WORKFLOW.md](../docs/WORKFLOW.md) | Understanding full development lifecycle, data refresh workflow |
| [docs/api-setup.md](../docs/api-setup.md) | Configuring API credentials, troubleshooting auth issues |

**Deep Linking Quick Reference:**
- Scene URLs: `/?scene={timeline|venues|geography|genres|artists}`
- Artist deep link: `/?scene=artists&artist={normalized-name}`
- Venue deep link (graph): `/?scene=venues&venue={normalized-name}`
- Venue deep link (map): `/?scene=geography&venue={normalized-name}`
- Normalization: lowercase, replace special chars with hyphens, collapse multiple hyphens

---

## Current Status

**Live Site:** https://concerts.morperhaus.org

**v3.1.0 Production (Latest):**

- ✅ iPad/tablet touch support for timeline year filter
- ✅ Drag-to-focus interaction across concert cards
- ✅ Tap-to-navigate with haptic feedback
- ✅ Smart tap vs. drag detection (10px threshold)
- ✅ Proper touch event handling without bubbling conflicts

**Recent Releases:**

- **v3.1.0** (2026-01-07): iPad Touch Support for Timeline
- **v3.0.1** (2026-01-06): Genre Enrichment & Artist Metadata
- **v3.0.0** (2026-01-06): Interactive Timeline Exploration & Genre Journey
- **v2.0.0** (2026-01-05): Real-time tour dates with Ticketmaster API
- **v1.8.0** (2026-01-05): Developer experience & documentation overhaul

---

## Active Work & Next Steps

**Completed Recently:**

- ✅ Interactive timeline exploration with year filter (v3.0.0)
- ✅ Animated genre treemap with timeline slider (v3.0.0)
- ✅ Real-time tour dates with Ticketmaster API (v2.0.0)
- ✅ Documentation overhaul with example templates (v1.8.0)
- ✅ Artist search with typeahead (v1.7.0)

**Immediate Next Steps:**

See [docs/ROADMAP.md](../docs/ROADMAP.md) for current priorities.

**Short-term:**

1. **UX Polish** - Touch/click feedback, gatefold hyperlinks, venue rename badges
2. **Venue Name Change Detection** - CLI tools for managing venue status updates

**Medium-term:**

1. **Spotify Integration** - Unified image sourcing strategy
2. **Mobile Optimizations** - Continued gatefold improvements

---

## Documentation Guidelines

**Before creating new documentation:**
1. **Review existing docs first** - Check if content belongs in existing files
2. **Consolidate when possible** - Prefer editing over creating new files
3. **Use descriptive names** - File names should clearly indicate content
4. **Follow existing structure:**

   - `docs/ROADMAP.md` - Current priorities and planned features
   - `src/data/changelog.json` - Release history with highlights
   - `docs/WORKFLOW.md` - Development workflow and process
   - `docs/BUILD.md` - Build pipeline and deployment
   - `docs/DATA_PIPELINE.md` - Data fetch/validation/enrichment
   - `docs/specs/future/` - Detailed specs for planned features
   - `docs/specs/implemented/` - Completed feature implementation details

**When new docs are needed:**

- Milestone summaries belong in `docs/ROADMAP.md`
- User guides should be standalone (e.g., `DATA_PIPELINE.md`)
- Implementation details go in `docs/specs/implemented/`
- Quick references belong in the primary workflow/guide docs

**Version Release Workflow:**

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

- `2e8f695` - docs: Archive STATUS.md and create lean ROADMAP.md
- `5ec1696` - docs: Add artist normalization override allowlist to validation
- `c8b5d3a` - fix: Use venueNormalized field for deep link lookup in Scene4Bands
- `e61c1a9` - docs: Add deep links to Features section and What's new
- `4ff2528` - docs: Update What's new section and concert stats for v1.8.0
- `81445e7` - docs: Add example data templates and overhaul getting started guide (v1.8.0)
- `982d51a` - data: Add new concerts, venues, and openers with enrichment
- `b0e9f4c` - feat!: Standardize all normalization to use hyphens (v1.9.0)
- `a1b2c3d` - docs: Update deep linking guide with hyphenated venue examples
- `d4e5f6g` - feat: Add genre normalization support

---

*Last updated: 2026-01-07 by Claude Code for v3.1.0 release*
