# Concert Archives - Current Status

**Last Updated:** 2025-12-28
**Current Phase:** Phase 5+ (Bug Fixes)
**Last Commit:** 6b187d5 - "docs: Synchronize .claude/context.md and establish planning.md as source of truth"

---

## Quick Overview

Interactive Jamstack SPA showcasing 175 concerts (1984-2026) through 5 full-viewport scrolling scenes with D3.js visualizations, Leaflet maps, and Framer Motion animations.

**Live Development:** `npm run dev`
**Build:** `npm run build`
**Repository:** https://github.com/mmorper/concerts

---

## Current Implementation Status

### ✅ Completed Phases (0-5)

All major implementation phases are complete:
- **Phase 0:** Project infrastructure (git, docs, .claude config)
- **Phase 1:** Foundation (Vite, React, TypeScript, Tailwind)
- **Phase 2:** Data pipeline (Google Sheets API, enrichment scripts)
- **Phase 3:** Core features (filters, timeline, search)
- **Phase 4:** Map integration (Leaflet, clustering, sync)
- **Phase 5:** Polish (Framer Motion, scrolling scenes, D3.js visualizations)

### 🔄 Current Work: Bug Fixes & Refinements

**Recent Fixes (December 28, 2025):**
1. ✅ Navigation dots - Fixed scroll tracking to use `.snap-y` container
2. ✅ Scene order - Reordered to Timeline→Venues→Map→Genres→Artists
3. ✅ Venue network - Redesigned as radial hierarchy (venue→headliner→opener)
4. ✅ Map z-index - Fixed header overlay layering (z-20 over z-0 map)
5. ✅ Artist list - Converted Scene2Venues to show top 20 artists

### 📋 Upcoming Phases

⚠️ **Pending: Sunburst visualization sizing**

- Awaiting user's visual mockup
- Current: `min(100vw, calc(100vh - 280px))`
- Issue: Appears too small in multi-genre view
- File: [src/components/scenes/Scene5Genres.tsx](../src/components/scenes/Scene5Genres.tsx:647-654)

**Phase 6: Design Conformance**

- Implement [Scene Design Guide](design/Morperhaus-Scene-Design-Guide.md) specifications
- Apply [Color Specification Guide](design/Morperhaus-Color-Specification-Guide.md) palette
- Update typography to Playfair Display + Source Sans 3
- Align scene backgrounds with LIGHT→DARK→DARK→LIGHT→LIGHT rhythm
- Create genre color constants (`src/constants/colors.ts`)
- Apply consistent spacing, animation timing, and "One Thing" rule

**Phase 7: Geography Scene Enhancement**

- Zoom into LA and DC tighter
- Fix DC missing from region views
- Component: [Scene3Map.tsx](../src/components/scenes/Scene3Map.tsx)

**Phase 8: Venues Scene Enhancement**

- Show top X venues by number of shows
- Add "View all venues" link/button
- Design UX style pattern (will be reused in other scenes)
- Component: [Scene2Venues.tsx](../src/components/scenes/Scene2Venues.tsx)

**Phase 9: Music Scene Enhancement**

- Mock up sunburst visualization
- Design UX improvements
- Component: [Scene5Genres.tsx](../src/components/scenes/Scene5Genres.tsx)

**Phase 10: Artists Scene Enhancement**

- Dedicated plan document [Phase 9 Artists Scene v2](phase-9-artist_scene_plan_v2.md)
- Component: [Scene2Venues.tsx](../src/components/scenes/Scene2Venues.tsx)

**Phase 11: Deployment**

- Set up Cloudflare Pages
- Connect GitHub repository
- Configure build settings
- Deploy to production

**Phase 12: Data Sources Enhancement**

- Review all Google Sheets/API integration work
- Integrate Spotify API for artist cards
- Enhance data enrichment pipeline

---

## Architecture

### 5 Full-Viewport Scenes

**Scene Flow:** Timeline → Artists → Map → Venue Network → Genres

| Scene | Component | Technology | Purpose |
|-------|-----------|------------|---------|
| **1. Timeline** | Scene1Hero.tsx | D3.js | Interactive timeline with year dots sized by concert count |
| **2. Artists** | Scene2Venues.tsx | Framer Motion | Top 20 artists in 4-column grid |
| **3. Map** | Scene3Map.tsx | Leaflet + React Leaflet | Dark monochromatic map with region filters |
| **4. Venue Network** | Scene4Bands.tsx | D3.js force simulation | Radial hierarchy: venues→headliners→openers |
| **5. Genres** | Scene5Genres.tsx | D3.js sunburst | Hierarchical genre chart with drill-down zoom |

### Tech Stack

**Core:**
- Vite 6.0.7
- React 18.3.1
- TypeScript 5.7.2
- Tailwind CSS 4.1.18

**Visualization & Animation:**
- D3.js 7.9.0 (timeline, force graph, sunburst)
- Framer Motion 11.18.2 (scroll animations, parallax)
- React Leaflet 4.2.1 (map integration)
- Leaflet 1.9.4 (mapping library)

**Data:**
- 175 concerts (1984-2026, 42 years)
- 305 unique artists
- Top venues: Irvine Meadows (14x), Pacific Amphitheatre (12x)
- Top genres: New Wave (46), Punk (15), Alternative (14)
- Geographic: California ~65%, DC cluster, Boston, New Orleans, UK

---

## Project Structure

```
concerts/
├── src/
│   ├── components/
│   │   ├── scenes/          # 5 full-viewport scenes
│   │   │   ├── Scene1Hero.tsx
│   │   │   ├── Scene2Venues.tsx
│   │   │   ├── Scene3Map.tsx
│   │   │   ├── Scene4Bands.tsx
│   │   │   └── Scene5Genres.tsx
│   │   └── SceneNavigation.tsx  # Dot navigation
│   ├── types/
│   │   └── concert.ts       # TypeScript interfaces
│   └── App.tsx              # Main app with snap scroll
├── public/data/
│   └── concerts.json        # Static concert data (175 concerts)
├── docs/
│   ├── STATUS.md           # This file (current state)
│   ├── planning.md         # Complete historical implementation plan
│   ├── api-setup.md        # API configuration guide
│   ├── phase-9-artist_scene_plan_v2.md  # Phase 9 detailed plan
│   └── design/             # Visual design framework
│       ├── Morperhaus-Scene-Design-Guide.md
│       └── Morperhaus-Color-Specification-Guide.md
└── .claude/
    ├── config.json         # Project metadata & phase tracking
    └── context.md          # Quick-start context for new sessions
```

---

## Key Features

### Scroll-Based Navigation
- Full-viewport scenes (100vh) with snap scrolling
- Framer Motion scroll-triggered animations
- Dot navigation on right side (desktop)
- Smooth scroll between scenes

### D3.js Visualizations
1. **Timeline (Scene 1):** Year dots sized by concert density
2. **Venue Network (Scene 4):** Radial force layout showing venue→artist relationships
3. **Genre Sunburst (Scene 5):** Hierarchical chart with click-to-zoom

### Leaflet Map (Scene 3)
- Dark CartoDB tile layer
- Circle markers sized by concert count
- Region filters: All, California, DC Area, Boston
- Static map (no scroll hijacking)

### Design System

**Framework Documents:**

- [Scene Design Guide](design/Morperhaus-Scene-Design-Guide.md) - Scene flow, typography, spacing, animation
- [Color Specification Guide](design/Morperhaus-Color-Specification-Guide.md) - Genre colors, backgrounds, CSS variables

**Current Implementation:**

- Typography: Inter font family (to be updated to Playfair Display + Source Sans 3)
- Scene backgrounds: Custom per scene (to be aligned with LIGHT→DARK→DARK→LIGHT→LIGHT rhythm)
- Animations: Framer Motion with 0.8-1.2s transitions

---

## Build Status

**Latest Build:** ✅ Successful
**TypeScript:** ✅ Strict mode passing
**Bundle Size:** 504.63 kB JS (gzipped: 160.04 kB), 59.30 kB CSS (gzipped: 14.10 kB)

---

## Documentation Maintenance

### Source of Truth Hierarchy

1. **`docs/STATUS.md`** (this file) - Current state, active work, pending tasks
2. **`docs/planning.md`** - Complete historical implementation plan (all phases)
3. **`.claude/context.md`** - Quick-start context synced from STATUS.md

### Context Sync Policy

`.claude/context.md` must be refreshed:
- ✅ With each commit and push (user preference)
- ✅ At start of each major phase
- ✅ After significant architectural changes
- ✅ When context drifts >5 bugs/features

**Sync Process:**
1. Read current state from `docs/STATUS.md`
2. Update `.claude/context.md` with: current phase, recent work, pending tasks, last commit
3. Keep context.md concise (<2000 tokens)

---

## Quick Reference

### Development Commands

```bash
npm run dev          # Start development server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
npm run build-data   # Fetch & enrich concert data from Google Sheets
```

### Key Files to Know

- **[src/App.tsx](../src/App.tsx)** - Main app with 5 scenes and snap scroll
- **[src/components/SceneNavigation.tsx](../src/components/SceneNavigation.tsx)** - Dot navigation
- **[public/data/concerts.json](../public/data/concerts.json)** - Concert data (175 records)
- **[docs/planning.md](planning.md)** - Full implementation history
- **[docs/api-setup.md](api-setup.md)** - Google Sheets & music API setup

### Scene Background Colors

For visual reference:
- Scene 1 (Timeline): `bg-white`
- Scene 2 (Artists): `bg-stone-50`
- Scene 3 (Map): `bg-gray-900`
- Scene 4 (Venue Network): `bg-gradient-to-br from-indigo-950 to-purple-950`
- Scene 5 (Genres): `bg-gray-100`

---

## Recent Commits

- `6b187d5` - docs: Synchronize .claude/context.md and establish planning.md as source of truth
- `778467f` - wip: Sunburst sizing adjustments - awaiting visual mockup
- `8830dd3` - Redesign to dashboard layout - above-the-fold horizontal 16:9 format
- `a7b1e63` - Phase 5: Polish - Complete

---

## Support Resources

- **GitHub Issues:** https://github.com/mmorper/concerts/issues
- **Historical Planning:** [docs/planning.md](planning.md)
- **API Setup:** [docs/api-setup.md](api-setup.md)
- **README:** [../README.md](../README.md)
