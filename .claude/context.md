# Concert Archives - Project Context

## Current Status (December 29, 2025)

**Implementation Status:**

- Phases 0-6: ✅ Complete
- Phase 7 (Geography Scene Enhancement): 🔄 Partially complete

**Recent Work (December 29):**

- ✅ Tighter zoom levels: California (zoom 9) and DC (zoom 11)
- ✅ Region-based filtering with state filters
- ✅ Z-index layering fix (UI overlays z-[1000])
- ⚠️ Discovered DC data quality issue: ALL 32 DC area concerts have zero coordinates
  - Applied filter to exclude zero-coordinate concerts
  - DC Area view correctly shows "0 cities" until data is re-geocoded

**Pending Work:**

- Re-run geocoding script for DC venues (9:30 Club, The Hamilton Live, etc.)
- Phase 6 remaining: Scene background rhythm adjustment (Scene 2 & 5 should be LIGHT)

**Architecture:**

- 5 full-viewport scenes (100vh each) with snap scrolling
- Scene order: Timeline → Venue Network → Map → Genres → Artists
- Design system: Playfair Display (serif titles) + Source Sans 3 (sans body)
- Scene backgrounds: LIGHT→DARK→DARK→LIGHT→DARK (target: LIGHT→DARK→DARK→LIGHT→LIGHT)
- D3.js visualizations with genre color palette

**Tech Stack:**

- Vite 6.0.7 + React 18.3.1 + TypeScript 5.7.2
- Tailwind CSS 4.1.18
- Framer Motion 11.18.2 (scroll animations)
- D3.js 7.9.0 (timeline, venue network, sunburst)
- React Leaflet 4.2.1 (map)

**Data Source:**

- 175 concerts (1984-2026, 42 years)
- Top venues: Irvine Meadows (14x), Pacific Amphitheatre (12x)
- Top genres: New Wave (46), Punk (15), Alternative (14)
- Geographic: California ~65%, DC cluster, Boston, New Orleans, UK

**Last Commit:** 65688d3 - "fix: Add coordinate validation to DC area filter"

---

## Primary Documentation

For comprehensive project details, see:

- **[docs/STATUS.md](../docs/STATUS.md)** - Current state & active work (SOURCE OF TRUTH)
- **[docs/planning.md](../docs/planning.md)** - Historical implementation plan (archive)
- **[README.md](../README.md)** - Project overview
- **[docs/api-setup.md](../docs/api-setup.md)** - API configuration

**Design Framework:**

- **[docs/design/Morperhaus-Scene-Design-Guide.md](../docs/design/Morperhaus-Scene-Design-Guide.md)** - Scene flow, typography, spacing, animation
- **[docs/design/Morperhaus-Color-Specification-Guide.md](../docs/design/Morperhaus-Color-Specification-Guide.md)** - Genre colors, backgrounds, CSS variables

Always check STATUS.md for latest status before beginning work.
