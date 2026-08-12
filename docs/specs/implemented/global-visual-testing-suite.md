# Visual Testing Suite Specification

> **Status**: ✅ Implemented — #10, PR #310, 2026-08-12
> **Priority**: Medium
> **Effort**: Medium
> **Last Updated**: 2026-08-12

---

## What actually shipped, and how this spec was wrong

Read this before the requirements below. They are preserved as the original
intent, but several of their premises were false by the time anyone acted on them.

**The tests already existed.** This spec (2026-01-07) and issue #10 both said the
legacy tests had been removed and no test code existed. Scene tests were written on
**2026-01-14** — a week after this document — and all five passed. Neither the spec
nor the issue was ever updated, so the work looked like a 14–20 hour build from
scratch when the actual gap was much narrower.

**The gap was consequences, not coverage.** Nothing ran the tests: no workflow
referenced them, and `npm run test:all` probed for a dev server on 5173 and silently
skipped the scene tests when it found none. Roughly half the assertions could not
fail — they logged `⚠ may not be implemented` and returned a pass. Three of those
were hiding real rot: the genres slider test looked for an `input[type="range"]`
that has never existed (it is a pointer-driven div), the artist sort tests checked
for a `bg-indigo-500` class the component no longer uses, and the timeline deep-link
test hard-coded year 2020, which has no concerts in it.

**"Visual" was never built and is not planned.** There is no baseline image, no
diffing and no comparison anywhere in this suite — screenshots were written to a
temp directory nothing ever read. Those 49 calls were deleted rather than wired to a
comparator. What the suite actually provides is browser-rendered behaviour testing.
If image comparison is wanted later it is a new piece of work, not a finishing touch.

**Five scenes became six.** `SCENE_NAMES` now ends with `ask`, which postdates this
spec. The scene roster lives in `src/components/changelog/constants.ts` and is the
single source of truth.

**What the suite is for.** v6.0.0 shipped a `useMemo` below an early return: it
passed `typecheck:all` and all 925 unit tests and crashed on render. `test-smoke.mjs`
is the answer to precisely that — it loads the page once, asserts all six scene roots
render, and fails on any uncaught error. Verified by injecting that crash shape into
two different scenes; typecheck and the unit tests passed both times, the smoke test
failed both times.

**Deliberately not done: the gatefold.** The interaction requirements below for the
Artist Scene gatefold (flying tile, 3D book open, ESC, click-outside, reduced motion)
have no coverage. A 500ms animation feeding an 800ms animation is the flakiest thing
in the app, and it was judged better to add that deliberately than to bolt it on.
It remains genuinely untested.

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

### Structure as built

```text
test/
├── README.md
├── scenes/
│   ├── test-smoke.mjs        # The CI gate: all six scene roots, one page load
│   ├── test-timeline.mjs
│   ├── test-venues.mjs
│   ├── test-map.mjs
│   ├── test-genres.mjs
│   ├── test-artists.mjs
│   └── test-audio-preview.mjs
└── utils/
    ├── helpers.mjs           # Browser setup, navigation, waits
    └── selectors.mjs         # Shared data-testid selectors
scripts/
└── run-scene-tests.mjs       # Builds, serves, runs every test, tears down
```

`test-simple.mjs` and `test-debug-map.mjs` were deleted. The first ran
`headless: false` (so it could never run in CI) and asserted nothing; the second
was a 21-line debug scratch file.

### npm Scripts

```json
"scripts": {
  "test:scenes:puppeteer": "node scripts/run-scene-tests.mjs",
  "test:smoke": "node test/scenes/test-smoke.mjs",
  "test:timeline": "node test/scenes/test-timeline.mjs",
  "test:venues": "node test/scenes/test-venues.mjs",
  "test:map": "node test/scenes/test-map.mjs",
  "test:genres": "node test/scenes/test-genres.mjs",
  "test:artists": "node test/scenes/test-artists.mjs"
}
```

The runner is what CI invokes, so `npm run test:scenes:puppeteer` behaves
identically on a laptop and on a runner — there is no CI-only step that can drift.

### Configuration

The spec proposed a hard-coded `BASE_URL` on port 5179. It is an environment
override instead, because this repo is routinely checked out into several
worktrees at once and 5173 is often already taken by another session's server:

```javascript
// test/utils/helpers.mjs
export const CONFIG = {
  BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:5173',
  VIEWPORTS: { desktop: {...}, tablet: {...}, mobile: {...} },
  TIMEOUTS: { navigation: 30000, d3Animation: 2000, ... }
}
```

Setting `TEST_BASE_URL` also tells the runner to reuse a server you already have
running rather than building — the fast local loop.

## Acceptance Criteria

- [x] All scenes have test coverage — six, including Ask, which postdates this spec
- [x] Tests run without manual intervention — Scene CI, on any PR touching `src/`
- [x] README documents all test commands
- [x] npm scripts available for each scene
- [x] Tests pass on a clean checkout with `npm install && npm run test:scenes:puppeteer`
      (no separate `npm run dev` needed — the runner serves its own build)
- [x] Every assertion can fail — the 24 soft-passes are gone
- [ ] ~~Screenshots capture key states for visual comparison~~ — dropped. There was
      no comparator and no baseline, so the screenshots were never evidence of
      anything. See the correction at the top.
- [ ] Gatefold interaction coverage — deliberately not done, see above

## Dependencies

- puppeteer (already installed; it downloads its own Chrome on `npm install`,
  which works on `ubuntu-latest` with no extra system libraries — verified on
  the PR's own CI run)

## Notes

- Consider switching to Playwright if cross-browser coverage is ever wanted
- Percy/Chromatic would be the way to get real visual regression, if the appetite
  exists — that is a separate piece of work, not a completion of this one
- Reduced motion testing requires `prefers-reduced-motion` media query emulation
- `/release` still runs no tests at all, only `npm run build`. Scene tests gate
  pull requests, and release commits are pushed straight to `main`, so they bypass
  that gate. #13 closes this by routing releases through a PR.
