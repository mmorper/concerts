# Test Scripts

Puppeteer-based automated testing for visual validation.

## Prerequisites

```bash
npm install puppeteer
```

## Available Scripts

### `test-simple.mjs`

**Purpose:** Basic page load and scroll verification. Useful for sanity checking that the app renders without errors.

**Usage:**
```bash
npm run test:sanity
# or directly:
node test/test-simple.mjs
```

**Output:**
- `/tmp/page-initial.png` - Initial page load
- `/tmp/page-scrolled.png` - After scrolling down

## Development Server

Tests require the development server to be running:

```bash
npm run dev
```

Server typically runs on `http://localhost:5179` (or next available port).

## Future Work

Comprehensive visual testing for all 5 scenes is planned for v1.1+. See `docs/specs/future/visual-testing-suite.md` for requirements.

Scenes requiring test coverage:

- Timeline (Scene1Hero) - D3.js year dots, click interactions
- Venue Network (Scene4Bands) - D3.js force simulation, node clicks
- Map (Scene3Map) - Leaflet markers, region filter buttons
- Genres (Scene5Genres) - D3.js sunburst, drill-down zoom
- Artists (ArtistScene) - Gatefold animation, flying tile, 3D book opening

## Notes

- Screenshots saved to `/tmp/` directory
- Puppeteer runs in non-headless mode for debugging
- Browser viewport: 1920×1080
