# Concert Archives - Current Status

**Last Updated:** 2025-12-29
**Current Phase:** Phase 8 (Venue-Level Geocoding - Complete, Pending Jitter Removal)
**Last Commit:** TBD - "feat: Implement venue-level geocoding with Google Maps API"

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
- **Phase 5:** Polish (Framer Motion, scrolling scenes, D3.js visualizations, sunburst sizing, 270° artist arc)

### 🔄 Phase 6: Design Conformance (In Progress)

**Completed Items:**

- ✅ Typography updated to Playfair Display (titles) + Source Sans 3 (body)
- ✅ Genre color constants created ([src/constants/colors.ts](../src/constants/colors.ts))
- ✅ Color palette applied throughout (using getGenreColor function)
- ✅ Scene-specific backgrounds implemented
- ✅ Consistent animation timing (Framer Motion 0.8-1.2s transitions)

**Remaining Items:**

- ⚠️ Scene background rhythm - Currently LIGHT→DARK→DARK→DARK→DARK, target is LIGHT→DARK→DARK→LIGHT→LIGHT
  - Scene 1 (Hero): ✅ LIGHT (`bg-white`)
  - Scene 2 (Artists): ❌ DARK (should be LIGHT) - `from-indigo-950 to-purple-950`
  - Scene 3 (Map): ✅ DARK (`bg-gray-900`)
  - Scene 4 (Venue Network): ✅ DARK (`from-indigo-950 to-purple-950`)
  - Scene 5 (Genres): ⚠️ Light violet (`#ede9fe`) but could be lighter for contrast
- ⚠️ Apply consistent spacing per design guide
- ⚠️ Validate "One Thing" rule per scene

**Recent Bug Fixes (December 28-29, 2025):**

1. ✅ Navigation dots - Fixed scroll tracking to use `.snap-y` container
2. ✅ Scene order - Reordered to Timeline→Bands→Map→Genres→Artists
3. ✅ Venue network - Redesigned as radial hierarchy (venue→headliner→opener)
4. ✅ Map z-index - Fixed header overlay layering (z-20 over z-0 map)
5. ✅ Artist list - Converted Scene2 to show top 20 artists
6. ✅ Sunburst sizing - Updated to `min(85vw, 85vh)` with 800px max
7. ✅ Sunburst artist arc - Implemented 270° arc centered at left (9 o'clock) for drill-down view

### ✅ Phase 7: Geography Scene Enhancement (Complete)

**Completed Items:**

- ✅ Tighter zoom levels: California (zoom 9) and DC (zoom 11)
- ✅ Region-based filtering with state filters
- ✅ Z-index layering fix (UI overlays z-[1000])
- ✅ DC data quality issue resolved:
  - Root cause identified: CSV parser wasn't handling quoted "City, State" fields
  - Installed csv-parse library for proper CSV parsing
  - Added all DC metro area coordinates to mapping (8 cities)
  - Regenerated concerts.json with valid coordinates
  - All 32 DC area concerts now display correctly on map
  - Data quality improvements: 54→34 cities (deduplicated), 305→240 artists (deduplicated)

### 🔄 Phase 8: Venue Scene Enhancements (In Progress)

**Pending Items:**

- ⚠️ **9:30 Club parsing bug** - Venue names starting with numbers being incorrectly parsed
  - Issue: "9:30 Club" appearing as multiple nodes ("9:30Club", "30 Club", etc.) in venue network
  - Root cause: String parsing issue with venue names containing numbers/colons
  - Reference: [docs/bugs/44-930.png](bugs/44-930.png)
  - Impact: Venue network visualization shows duplicate/incorrect nodes
  - Component: [src/components/scenes/Scene4Bands.tsx](../src/components/scenes/Scene4Bands.tsx)

- ⚠️ **Map interaction improvements** - Enable zoom/pan without scroll hijacking
  - Current state: Map is completely static (no scroll, zoom, or pan)
  - Goal: Allow user to explore map without triggering scene scroll
  - Design challenge: Separate map interaction from viewport scroll behavior
  - Needs: Plan for UX implementation (modal overlay, click-to-enable, touch zones, etc.)
  - Component: [src/components/scenes/Scene3Map.tsx](../src/components/scenes/Scene3Map.tsx)

### ✅ Phase 9: Venue-Level Geocoding (Complete)

**Completed Items:**

- ✅ Google Maps Geocoding API integration with cache-first approach
- ✅ Created `scripts/services/geocoding.ts` - Core geocoding service module
- ✅ Created `scripts/geocode-venues.ts` - Manual batch geocoding script
- ✅ Integrated into `scripts/convert-csv-to-json.ts` data pipeline
- ✅ Added `dotenv` package and environment variable loading
- ✅ Documented Google Maps API setup in [docs/api-setup.md](api-setup.md)
- ✅ Created persistent cache at `public/data/geocode-cache.json`
- ✅ Geocoded 77 unique venues with accurate coordinates
- ✅ DC map adjustments: center [39.00, -77.03], zoom 10.5
- ✅ Popup z-index fix: custom pane with z-index 9999
- ✅ Cost optimization: $0.00 (within $200/month free tier)

**Technical Implementation:**

- **Geocoding Strategy**: "{venue}, {city}, {state}" format using Google Maps venue recognition
- **Fallback Chain**: Venue-specific geocoding → City-level static → Zero coordinates
- **Cache Structure**: `{venue}|{city}|{state}` as key, with lat/lng/formattedAddress/geocodedAt
- **Rate Limiting**: 20ms delay between API calls (50 requests/second limit)
- **API Usage**: Initial run 77 venues × $0.005 = $0.385 (covered by free tier)

**Files Created/Modified:**

- NEW: `scripts/services/geocoding.ts` - Core service with cache management
- NEW: `scripts/geocode-venues.ts` - Batch script for manual geocoding
- NEW: `.env` - Google Maps API key storage
- NEW: `public/data/geocode-cache.json` - Persistent coordinate cache (77 venues)
- MODIFIED: `scripts/convert-csv-to-json.ts` - Made async, integrated geocoding
- MODIFIED: `package.json` - Added dotenv dependency and "geocode" script
- MODIFIED: `docs/api-setup.md` - Added Google Maps Geocoding API section
- MODIFIED: `src/components/scenes/Scene3Map.tsx` - DC zoom/center and popup z-index

**Post-Implementation Cleanup:**

- ✅ Removed jitter logic from Scene3Map.tsx - no longer needed with venue-specific coordinates

### 📋 Upcoming Phases

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
- Consider future music API integrations (Spotify, MusicBrainz) for artist cards
- Enhance data enrichment pipeline

---

## Architecture

### 5 Full-Viewport Scenes

**Scene Flow:** Timeline → Venue Network → Map → Genres → Artists

| Scene | Component | Technology | Purpose |
|-------|-----------|------------|---------|
| **1. Timeline** | Scene1Hero.tsx | D3.js | Interactive timeline with year dots sized by concert count |
| **2. Venue Network** | Scene4Bands.tsx | D3.js force simulation | Radial hierarchy: venues→headliners→openers |
| **3. Map** | Scene3Map.tsx | Leaflet + React Leaflet | Dark monochromatic map with region filters |
| **4. Genres** | Scene5Genres.tsx | D3.js sunburst | Hierarchical genre chart with drill-down zoom, 270° artist arc |
| **5. Artists** | Scene2Venues.tsx | Framer Motion | Top 20 artists in 4-column grid |

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
3. **Genre Sunburst (Scene 5):** Hierarchical chart with click-to-zoom, 270° artist arc in drill-down view

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
**Bundle Size:** 516.97 kB JS (gzipped: 163.76 kB), 61.36 kB CSS (gzipped: 14.30 kB)

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

For visual reference (actual order):

- Scene 1 (Timeline): `bg-white` - LIGHT
- Scene 2 (Venue Network): `from-indigo-950 to-purple-950` - DARK
- Scene 3 (Map): `bg-gray-900` - DARK
- Scene 4 (Genres): `#ede9fe` (light violet) - LIGHT
- Scene 5 (Artists): `from-indigo-950 to-purple-950` - DARK (should be LIGHT)

---

## Recent Commits

- `69b1ea2` - fix: Resolve DC area coordinate geocoding issue (Phase 7 - Complete)
- `65688d3` - fix: Add coordinate validation to DC area filter
- `bd52be4` - fix: Increase z-index for map UI overlays to z-[1000]
- `04d3d66` - feat: Implement tighter zoom levels and region filtering for map
- `103d6f1` - feat: Implement 270° artist arc centered at left in sunburst drill-down

---

## Support Resources

- **GitHub Issues:** https://github.com/mmorper/concerts/issues
- **Historical Planning:** [docs/planning.md](planning.md)
- **API Setup:** [docs/api-setup.md](api-setup.md)
- **README:** [../README.md](../README.md)
