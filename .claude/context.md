# Concert Archives - Project Context

## Current Status (December 29, 2025)

**Implementation Status:**

- Phases 0-9b: ✅ Complete
- Phase 10: Artists Scene Enhancement (NEXT)

**Phase 9b Complete (Venue Scene Enhancement):**

- ✅ Click-to-expand interaction in "All" view - Venue dots animate to center and expand children
- ✅ Smooth physics-based animation using D3 force simulation
- ✅ Centered venue positioned at y=380 (below exclusion zone)
- ✅ Child nodes (headliners/openers) expand radially around centered venue
- ✅ All child node labels visible when venue is expanded
- ✅ Click again to collapse back to dot
- ✅ Removed fade effects - No more screen-wide dimming on node clicks
- ✅ All nodes maintain constant opacity for cleaner visual experience

**Phase 9 Complete (Venue-Level Geocoding):**

- ✅ Google Maps Geocoding API integration with cache-first approach
- ✅ 77 unique venues geocoded with accurate coordinates
- ✅ Cost optimization: $0.00 (within $200/month free tier)
- ✅ DC map adjustments: center [39.00, -77.03], zoom 10.5
- ✅ Popup z-index fix: z-index 9999 for top-most layer
- ✅ Removed jitter logic from Scene3Map.tsx (no longer needed)

**Phase 8 Complete (Map Interaction Enhancements - Desktop):**

- ✅ Interactive map exploration mode - Click-to-activate pattern preserves scene navigation
- ✅ Two-state system: Locked (default) and Active (exploration mode)
- ✅ Scene navigation buttons appear when active ("↑ The Venues" / "The Music ↓")
- ✅ Scroll wheel zoom and drag panning enabled when active
- ✅ ESC key deactivates and returns to locked state
- ✅ "Click to explore map" hint with auto-fade behavior
- ✅ Full accessibility support (aria-labels, aria-live announcements)
- ✅ California venue popups now show venue names like DC region
- ✅ Genres scene centering fix for initial load
- 🔄 Mobile device testing deferred (touch interactions already enabled in code)

**Recent Work (December 29):**

- ✅ Venue scene enhancement (Phase 9b)
  - Implemented click-to-expand interaction for venues in All view
  - Added smooth animation to center position below exclusion zone
  - Configured radial child node expansion with visible labels
  - Removed all fade effects for cleaner UX

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
- Google Maps Geocoding API (venue coordinates)

**Data Source:**

- 175 concerts (1984-2026, 42 years)
- 77 unique venues (venue-specific coordinates via Google Maps API)
- Top venues: Irvine Meadows (14x), Pacific Amphitheatre (12x), 9:30 Club (11x)
- Top genres: New Wave (46), Punk (15), Alternative (14)
- Geographic: California ~65%, DC cluster, Boston, New Orleans, UK

**Last Commit:** [pending] - "feat: Add click-to-expand interaction for venues in All view"

---

## Primary Documentation

For comprehensive project details, see:

- **[docs/STATUS.md](../docs/STATUS.md)** - Current state & active work (SOURCE OF TRUTH)
- **[docs/planning.md](../docs/planning.md)** - Historical implementation plan (archive)
- **[README.md](../README.md)** - Project overview
- **[docs/api-setup.md](../docs/api-setup.md)** - API configuration (includes Google Maps setup)
- **[docs/phase-8-Map_Interaction_Plan.md](../docs/phase-8-Map_Interaction_Plan.md)** - Phase 8 detailed implementation plan

**Design Framework:**

- **[docs/design/Morperhaus-Scene-Design-Guide.md](../docs/design/Morperhaus-Scene-Design-Guide.md)** - Scene flow, typography, spacing, animation
- **[docs/design/Morperhaus-Color-Specification-Guide.md](../docs/design/Morperhaus-Color-Specification-Guide.md)** - Genre colors, backgrounds, CSS variables

Always check STATUS.md for latest status before beginning work.
