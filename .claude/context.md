# Concert Archives - Project Context

## Current Status (December 30, 2025)

**Implementation Status:**

- Phases 0-10: ✅ Complete
- Phase 11: Deployment (NEXT)

**Phase 10 Complete (Artists Scene Gatefold Animation - Desktop):**

- ✅ Artist mosaic grid with uniform 200px cards and lazy loading
- ✅ Three sort modes: A-Z, Genre, Weighted (with frequency badges)
- ✅ Vinyl gatefold animation - Flying tile to center (500ms) + book-opening effect (800ms)
- ✅ V-angle "vinyl on lap" tilt (±15°) with spine as lowest point
- ✅ Two 400×400px panels (Concert History + Spotify skeleton) with 12px spine
- ✅ Pure CSS transitions for performance
- ✅ Dark gradient backgrounds (#181818 → #121212) for both panels
- ✅ ESC key and click-to-close functionality
- ✅ **Z-index layering fix** - Lifted gatefold to scene level to escape stacking context
  - Problem: Header buttons appearing above gatefold overlay
  - Solution: Moved gatefold rendering from ArtistMosaic to ArtistScene (outside motion.div)
  - Result: Gatefold now properly appears above all elements (z-index 99998-100000)
- 🔄 Mobile bottom sheet deferred to v1.1
- 🔄 Spotify API integration deferred to v1.1

**Recent Work (December 30):**

- ✅ Gatefold animation implementation (Phase 10)
  - Implemented flying tile with dynamic positioning
  - Created 3D book-opening effect with CSS transforms
  - Built Concert History panel with scrollable concert list
  - Built Spotify panel with "Coming Soon" skeleton state
  - Fixed critical z-index issue by restructuring component hierarchy
  - Moved gatefold state management to scene level
  - Result: Smooth vinyl album-inspired interaction with proper layering

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
- 239 unique artists
- 77 unique venues (venue-specific coordinates via Google Maps API)
- Top venues: Irvine Meadows (14x), Pacific Amphitheatre (12x), 9:30 Club (11x)
- Top genres: New Wave (46), Punk (15), Alternative (14)
- Geographic: California ~65%, DC cluster, Boston, New Orleans, UK

**Last Commit:** [Pending] - "feat: Implement vinyl gatefold animation with z-index fix"

---

## Primary Documentation

For comprehensive project details, see:

- **[docs/STATUS.md](../docs/STATUS.md)** - Current state & active work (SOURCE OF TRUTH)
- **[docs/planning.md](../docs/planning.md)** - Historical implementation plan (archive)
- **[README.md](../README.md)** - Project overview
- **[docs/api-setup.md](../docs/api-setup.md)** - API configuration (includes Google Maps setup)

**Design Framework:**

- **[docs/design/Morperhaus-Scene-Design-Guide.md](../docs/design/Morperhaus-Scene-Design-Guide.md)** - Scene flow, typography, spacing, animation
- **[docs/design/Morperhaus-Color-Specification-Guide.md](../docs/design/Morperhaus-Color-Specification-Guide.md)** - Genre colors, backgrounds, CSS variables

**Phase 10 Documentation:**

- **[docs/v1.0-phase-9-gatefold-animation-spec.md](../docs/v1.0-phase-9-gatefold-animation-spec.md)** - Gatefold animation specification
- **[docs/v1.0-phase-9-artists-gatefold-centered.html](../docs/v1.0-phase-9-artists-gatefold-centered.html)** - Working HTML prototype
- **[docs/SPOTIFY-INTEGRATION-GUIDE.md](../docs/SPOTIFY-INTEGRATION-GUIDE.md)** - Future Spotify integration guide

Always check STATUS.md for latest status before beginning work.
