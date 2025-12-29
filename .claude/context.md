# Concert Archives - Project Context

## Current Status (December 28, 2025)

**Implementation Status:**
- Phases 0-5: ✅ Complete
- Bug Fix Session 1: 🔄 In progress

**Recent Work:**
- Fixed navigation dots scroll tracking
- Reordered scenes: Timeline → Venues → Map → Genres → Artists
- Redesigned venue network as radial hierarchy
- Fixed map z-index layering issue
- Converted Scene2 to artist list (top 20)

**Pending Work:**
- Sunburst visualization sizing (awaiting user's visual mockup)
- User will provide annotated mockup showing desired layout

**Architecture:**
- 5 full-viewport scenes (100vh each) with parallax scrolling
- NYT-inspired design: clean, minimal, contemporary sans-serif
- Scene-specific backgrounds with scroll-triggered animations
- D3.js visualizations for all data displays

**Tech Stack:**
- Vite 6.0.7 + React 18.3.1 + TypeScript 5.7.2
- Tailwind CSS 4.1.18
- Framer Motion 11.18.2 (parallax scrolling)
- D3.js 7.9.0 (visualizations)
- React Leaflet 4.2.1 (map scene)

**Data Source:**
- 175 concerts (1984-2026, 42 years)
- Top venues: Irvine Meadows (14x), Pacific Amphitheatre (12x)
- Top genres: New Wave (46), Punk (15), Alternative (14)
- Geographic: California ~65%, DC cluster, Boston, New Orleans, UK

**Last Commit:** 778467f - "wip: Sunburst sizing adjustments - awaiting visual mockup"

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
