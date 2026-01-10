# Morperhaus Concert Archives

Interactive web application for exploring personal concert history (1984-present).

**Live:** https://concerts.morperhaus.org
**Version:** v3.4.1 | 178 concerts, 247 artists, 77 venues
**Stack:** Vite 6, React 18, TypeScript 5, Tailwind 4, D3.js 7, Leaflet

---

## Quick Start

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run build-data   # Refresh data pipeline
```

---

## Skill References

**Before implementing UI changes**, read:
- `.claude/skills/design-system/SKILL.md` — Colors, typography, component patterns

**Before querying or modifying data**, read:
- `.claude/skills/data-schema/SKILL.md` — Data structures, normalization, relationships

**Before working with external APIs**, read:
- `.claude/skills/api-integration/SKILL.md` — Ticketmaster, setlist.fm, geocoding patterns

**Before adding user interactions or features**, read:
- `.claude/skills/analytics/SKILL.md` — Event tracking, GA4 patterns, naming conventions

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/release` | Ship a version (changelog, git, deploy) |
| `/changelog` | Create changelog entry |
| `/release-undo` | Rollback a release |
| `/spec` | Create feature specification |
| `/implement` | Start work on a spec |
| `/context-sync` | Update context files |
| `/validate` | Run all validation checks |
| `/data-refresh` | Orchestrate data pipeline |
| `/preview` | Start dev server with context |
| `/hotfix` | Emergency patch workflow |
| `/commands` | List all project slash commands |

---

## Key Documentation

| When | Read |
|------|------|
| Adding concerts | `docs/DATA_PIPELINE.md` |
| Releasing versions | `.claude/commands/release.md` |
| URL navigation | `docs/DEEP_LINKING.md` |
| Writing changelogs | `.claude/readme-maintenance.md` (voice guidelines) |
| Current state & recent work | `.claude/context.md` |

---

## Project Structure

```
src/
├── components/scenes/     # 5 interactive scenes
├── services/              # API clients (Ticketmaster, setlist.fm)
├── hooks/                 # React hooks
├── types/                 # TypeScript interfaces
└── data/                  # Changelog data

public/data/               # Generated data files
scripts/                   # Data pipeline scripts
docs/                      # Documentation & specs
.claude/                   # Claude Code configuration
```

---

## Key Files

| Purpose | Path |
|---------|------|
| Concert data | `public/data/concerts.json` |
| Artist metadata | `public/data/artists-metadata.json` |
| Venue metadata | `public/data/venues-metadata.json` |
| Changelog | `src/data/changelog.json` |
| Types | `src/types/concert.ts` |
| Normalization | `src/utils/normalize.ts` |

---

## Conventions

- **Normalized names:** Hyphenated lowercase (`"Depeche Mode"` → `"depeche-mode"`)
- **Deep links:** `/?scene=artists&artist=depeche-mode`
- **Commit prefixes:** `feat:`, `fix:`, `docs:`, `data:`, `refactor:`
- **Version validation:** `npm run validate:version`

**Avoid:**
- Creating new docs without checking if content belongs in existing files
- Adding features or refactoring beyond what's requested
- Time estimates in plans (focus on what, not when)
- Over-engineering: prefer simple, focused solutions
