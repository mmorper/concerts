# Morperhaus Concert Archives - Project Context

## Quick Start

**Version:** v0.9.0 (Pre-production)
**Status:** Feature complete, preparing for deployment
**Last Sync:** 2025-12-31

### Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run build-data   # Fetch & enrich concert data
```

### Key Files

- **Source of Truth:** [docs/STATUS.md](../docs/STATUS.md)
- **Main App:** [src/App.tsx](../src/App.tsx)
- **Concert Data:** [public/data/concerts.json](../public/data/concerts.json)

---

## Architecture

**5 Full-Viewport Scenes** with snap scrolling:

| # | Scene | Component | Tech |
|---|-------|-----------|------|
| 1 | Timeline | Scene1Hero.tsx | D3.js |
| 2 | Venues | Scene4Bands.tsx | D3.js force |
| 3 | Geography | Scene3Map.tsx | Leaflet |
| 4 | Genres | Scene5Genres.tsx | D3.js sunburst |
| 5 | Artists | ArtistScene/ | Framer Motion |

**Tech Stack:** Vite 6 + React 18 + TypeScript 5 + Tailwind 4 + D3 7 + Framer Motion 11 + Leaflet

**Data:** 175 concerts (1984-2026), 239 artists, 77 venues

---

## Documentation Map

```
docs/
├── STATUS.md              # Current state (read this first)
├── planning.md            # Historical implementation
├── api-setup.md           # API configuration
├── design/                # Visual design system
│   ├── scene-design-guide.md
│   └── color-specification.md
└── specs/
    ├── implemented/       # v1.0 feature specs
    ├── future/            # v1.1+ roadmap
    └── archive/           # Superseded specs
```

---

## What's Next

1. **v0.9.0** - CI/CD setup (GitHub → Cloudflare Pages)
2. **v1.0.0** - Production deployment
3. **v1.1.0** - Mobile optimization, Spotify integration

---

## Recent Work

- ✅ Phase 10: Artist scene gatefold animation
- ✅ Phase 9b: Venue scene click-to-expand
- ✅ Phase 9: Venue-level geocoding
- ✅ Phase 8: Map interaction enhancements
- ✅ Documentation reorganization (v0.9.0 prep)
