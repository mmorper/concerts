# Visual Testing Suite Specification

> **Status**: Planned
> **Priority**: Medium
> **Effort**: Medium
> **Last Updated**: 2026-01-07

---

## Overview

Implement comprehensive Puppeteer-based visual testing for all 5 scenes. Each scene has unique interactions that require dedicated test coverage.

## Background

The original test scripts were created for a legacy "flip card" Artist Scene implementation. The Artist Scene was refactored to use a "gatefold" pattern with flying tile animation and 3D book-opening effect. The legacy tests no longer validate current behavior and were removed.

## Requirements

### Scene 1: Timeline (Scene1Hero.tsx)

**Technology:** D3.js

**Test Cases:**

- [ ] Year dots render at correct positions
- [ ] Year dots sized proportionally to concert count
- [ ] Hover state shows tooltip with year/count
- [ ] Click on year dot filters (if implemented)
- [ ] Responsive behavior at different viewport widths

**Key Selectors:**

- `.year-dot` or equivalent D3-generated elements
- Tooltip container

---

### Scene 2: Venue Network (Scene4Bands.tsx)

**Technology:** D3.js force simulation

**Test Cases:**

- [ ] Force simulation settles (nodes stop moving)
- [ ] Venue nodes positioned at center
- [ ] Headliner/opener nodes orbit correctly
- [ ] Node click highlights connections
- [ ] "Top 10" / "All Venues" filter buttons work
- [ ] Node labels readable at default zoom

**Key Selectors:**

- SVG container
- Venue nodes vs artist nodes (by class or data attribute)
- Filter buttons

---

### Scene 3: Map (Scene3Map.tsx)

**Technology:** Leaflet + React Leaflet

**Test Cases:**

- [ ] Map tiles load without errors
- [ ] Venue markers render at correct positions
- [ ] Marker clustering works at zoomed-out levels
- [ ] Region filter buttons (All, California, DC Area) update view
- [ ] Marker click shows popup with venue info
- [ ] Popup displays correct concert count

**Key Selectors:**

- `.leaflet-container`
- `.leaflet-marker-icon`
- Filter buttons by text content
- `.leaflet-popup-content`

---

### Scene 4: Genres (Scene5Genres.tsx)

**Technology:** D3.js sunburst

**Test Cases:**

- [ ] Sunburst renders with correct segments
- [ ] Segment colors match genre color constants
- [ ] Click on segment zooms/drills down
- [ ] 270° artist arc displays around sunburst
- [ ] Artist names readable in arc
- [ ] Breadcrumb navigation works (if implemented)

**Key Selectors:**

- SVG container
- Path elements for sunburst segments
- Artist arc text elements

---

### Scene 5: Artists (ArtistScene)

**Technology:** React + CSS transitions

**Test Cases:**

- [ ] Mosaic grid renders with artist tiles
- [ ] Sort buttons (A-Z, Genre, Weighted) reorder tiles
- [ ] Frequency badges appear in Weighted mode only
- [ ] **Gatefold Animation:**
  - [ ] Click tile → flying tile appears at click position
  - [ ] Flying tile animates to viewport center (500ms)
  - [ ] Gatefold opens with 3D book effect (800ms)
  - [ ] Left panel shows concert history
  - [ ] Right panel shows Spotify skeleton
  - [ ] ESC key closes gatefold
  - [ ] Click outside closes gatefold
  - [ ] Flying tile returns to grid on close
- [ ] Grid dims (opacity + blur) when gatefold open
- [ ] Reduced motion: animations skipped, layout preserved

**Key Selectors:**

- Artist grid container
- Individual artist tiles
- Sort buttons
- Gatefold overlay (z-index 99998)
- Flying tile (z-index 99999)
- Close hint text

---

## Implementation Approach

### Recommended Structure

```
test/
├── README.md
├── test-simple.mjs          # Existing sanity check
├── scenes/
│   ├── test-timeline.mjs
│   ├── test-venue-network.mjs
│   ├── test-map.mjs
│   ├── test-genres.mjs
│   └── test-artists.mjs
└── utils/
    ├── helpers.mjs          # Common setup/teardown
    └── selectors.mjs        # Centralized selector constants
```

### npm Scripts

```json
"scripts": {
  "test:sanity": "node test/test-simple.mjs",
  "test:timeline": "node test/scenes/test-timeline.mjs",
  "test:venues": "node test/scenes/test-venue-network.mjs",
  "test:map": "node test/scenes/test-map.mjs",
  "test:genres": "node test/scenes/test-genres.mjs",
  "test:artists": "node test/scenes/test-artists.mjs",
  "test:all": "node test/test-simple.mjs && node test/scenes/test-timeline.mjs && ..."
}
```

### Configuration

```javascript
// test/utils/helpers.mjs
export const CONFIG = {
  BASE_URL: 'http://localhost:5179',
  VIEWPORT: { width: 1920, height: 1080 },
  ANIMATION_DELAYS: {
    scroll: 1000,
    d3Settle: 2000,      // Force simulation settle time
    gatefoldOpen: 1500,  // 500ms fly + 800ms open + buffer
    gatefoldClose: 1300  // 800ms close + 400ms return + buffer
  },
  SCREENSHOT_DIR: '/tmp/morperhaus-tests'
}
```

## Acceptance Criteria

- [ ] All 5 scenes have dedicated test files
- [ ] Tests run without manual intervention
- [ ] Screenshots capture key states for visual comparison
- [ ] README documents all test commands
- [ ] npm scripts available for each scene
- [ ] Tests pass on clean checkout with `npm install && npm run dev && npm run test:all`

## Dependencies

- puppeteer (already installed)

## Estimated Effort

- Timeline tests: 2-3 hours
- Venue Network tests: 3-4 hours
- Map tests: 2-3 hours
- Genres tests: 3-4 hours
- Artists tests: 4-6 hours (most complex due to gatefold)
- **Total: 14-20 hours**

## Notes

- Consider switching to Playwright for v1.2+ (better cross-browser support)
- Percy/Chromatic integration would enable automated visual regression in CI
- Reduced motion testing requires `prefers-reduced-motion` media query emulation
