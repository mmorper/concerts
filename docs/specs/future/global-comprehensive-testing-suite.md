# Comprehensive Testing Suite Specification

**Status:** ✅ Complete - Windows 1-6, 8 (305 tests passing)
**Target Version:** v3.5.0
**Priority:** High
**Actual Effort:** ~35 hours (Windows 1-6, 8)
**Dependencies:** None
**Last Updated:** 2026-01-14
**Deferred:** Window 7 (Accessibility testing with axe-core)

---

## 🎯 Implementation Status

### ✅ Window 1: Test Infrastructure Setup (COMPLETE)

**Completed 2026-01-14**

**Deliverables:**
- ✅ Installed Vitest 4.0.17 + @vitest/ui + @vitest/coverage-v8 + @axe-core/puppeteer
- ✅ Created vitest.config.ts with 80% coverage thresholds (85% for core pipeline)
- ✅ Created test/setup.ts with environment mocking (prevents real API calls)
- ✅ Created test directory structure (fixtures/, pipeline/, scenes/, utils/)
- ✅ Created 8 mock fixture files (concerts, artists, geocode, API responses)
- ✅ Implemented test/utils/normalize.test.ts (37 tests, 100% coverage, all passing)
- ✅ Added 8 npm test scripts to package.json
- ✅ Updated test/test-simple.mjs to use correct port (5173)
- ✅ Wrote comprehensive test/README.md documentation

**Key Decisions:**
- Test all 26 scripts (prioritized: >85% core pipeline, >70% utilities)
- Use Puppeteer (already installed, stable, well-documented)
- Dev server port: 5173 (Vite default)
- Coverage targets: 85% core pipeline, 70% utilities, 80% overall

**Test Results:**
```
✓ test/utils/normalize.test.ts (37 tests) 3ms
Test Files  1 passed (1)
Tests       37 passed (37)
```

**Files Created:**
- vitest.config.ts
- test/setup.ts
- test/fixtures/ (8 JSON files)
- test/utils/normalize.test.ts

**Files Modified:**
- package.json (dependencies + scripts)
- test/test-simple.mjs (port update)
- test/README.md (comprehensive rewrite)

**Context Remaining:** ~51% (102K tokens)

### ✅ Window 2: Data Pipeline Core Tests (COMPLETE)

**Completed:** 2026-01-14

**Deliverables:**
- ✅ test/pipeline/backup.test.ts - 22 tests, 100% passing, full coverage
- ✅ test/pipeline/validate-concerts.test.ts - 18 tests, all passing
- ✅ test/pipeline/fetch-google-sheet.test.ts - 25 tests, all passing
- ✅ test/pipeline/geocode-venues.test.ts - 30 tests, all passing
- ✅ test/pipeline/diff-concerts.test.ts - 18 tests, all passing

**Test Results:**
```
Test Files  5 passed (5)
Tests       113 passed (113)
Duration    458ms
```

**Files Created:**
- test/pipeline/backup.test.ts
- test/pipeline/validate-concerts.test.ts
- test/pipeline/fetch-google-sheet.test.ts
- test/pipeline/geocode-venues.test.ts
- test/pipeline/diff-concerts.test.ts

**Coverage:** Core pipeline scripts now have comprehensive test coverage including:
- Backup creation and rotation
- Concert validation (required fields, duplicates, orphaned openers)
- Google Sheets data fetching and processing
- Geocoding with cache-first strategy
- Diff reporting between current and backup data

### ✅ Window 3: Enrichment Tests (COMPLETE)

**Completed:** 2026-01-14

**Deliverables:**
- ✅ test/pipeline/enrich-artists.test.ts - 12 tests, all passing
- ✅ test/pipeline/enrich-venues.test.ts - 27 tests, all passing
- ✅ test/pipeline/enrich-spotify-metadata.test.ts - 43 tests, all passing
- ✅ test/pipeline/enrich-discography.test.ts - 43 tests, all passing
- ✅ test/pipeline/prefetch-setlists.test.ts - 30 tests, all passing

**Test Results:**
```
Test Files  10 passed (10)
Tests       268 passed (268)
Duration    82.21s
```

**Coverage:**
- Artist enrichment: TheAudioDB API integration, Last.fm fallback, 30-day cache expiry, rate limiting (2 req/sec)
- Venue enrichment: Google Places API integration, venue status CSV loading, photo management (API + manual), 90-day cache expiry for active venues, null expiry for legacy venues, fallback images, rate limiting (100ms/venue)
- Spotify enrichment: Client Credentials authentication, artist search with fuzzy matching, manual overrides (spotify-overrides.json), album fetching (most popular), top tracks (limit 3), cover art URLs (3 sizes), 90-day cache expiry, rate limiting (350ms/request ~3 req/sec)
- Discography enrichment: MusicBrainz API integration, artist MBID search with Levenshtein distance (80% threshold), release group fetching (limit 100), Cover Art Archive URLs, album sorting (newest first), 90-day cache expiry, rate limiting (1 req/sec), dry-run mode, backup creation
- Setlist pre-fetching: setlist.fm API integration, fuzzy venue matching (Levenshtein distance), city name mapping (Hollywood→LA), composite cache keys (concertId:artistName), headliner + opener support, force-refresh mode, incremental updates, rate limiting (1.5s delay ~1 req/sec), 60s backoff after 429 errors, backup creation

**Files Created:**
- test/pipeline/enrich-artists.test.ts
- test/pipeline/enrich-venues.test.ts
- test/pipeline/enrich-spotify-metadata.test.ts
- test/pipeline/enrich-discography.test.ts
- test/pipeline/prefetch-setlists.test.ts

**Progress:** 155 tests created (all passing), 100% complete

### ✅ Window 4: Puppeteer Infrastructure (COMPLETE)

**Completed:** 2026-01-14

**Deliverables:**
- ✅ test/utils/helpers.mjs - Comprehensive Puppeteer utilities (450+ LOC)
- ✅ test/utils/selectors.mjs - Centralized test selectors (200+ LOC)
- ✅ Scene1Hero data-testid attributes (7 attributes added)
- ✅ Scene2Venues data-testid attributes (6 attributes added)
- ✅ Scene3Map data-testid attributes (9 attributes added)
- ✅ Scene4Bands data-testid attributes (7 attributes added)
- ✅ Scene5Genres data-testid attributes (11 attributes added)
- ✅ ArtistScene data-testid attributes (7 attributes added)

**Test Utilities:**
- Browser setup: `setupBrowser()` with viewport presets
- Navigation: `navigateToScene()`, `scrollPage()`, `scrollToScene()`
- Screenshots: `takeScreenshot()` to `/tmp/morperhaus-tests/`
- Waiting: `waitForD3Settle()`, `waitForAnimation()`, `waitForElement()`
- Interaction: `clickElement()`, `hoverElement()`, `typeText()`
- Queries: `getTextContent()`, `elementExists()`, `getElementCount()`

**Selector Organization:**
All selectors defined for TIMELINE, VENUES, MAP, NETWORK, GENRES, ARTIST scenes

**Files Created:**
- test/utils/helpers.mjs
- test/utils/selectors.mjs

**Files Modified:**
- src/components/scenes/Scene1Hero.tsx (7 data-testid attributes)
- src/components/TimelineHoverPreview/TimelineHoverPreview.tsx (1 data-testid attribute)
- src/components/scenes/Scene2Venues.tsx (6 data-testid attributes)
- src/components/scenes/Scene3Map.tsx (9 data-testid attributes)
- src/components/scenes/Scene4Bands.tsx (7 data-testid attributes)
- src/components/scenes/Scene5Genres/index.tsx (11 data-testid attributes)
- src/components/scenes/ArtistScene/ArtistScene.tsx (7 data-testid attributes)

**Progress:** 100% complete - All 6 scenes now have data-testid attributes for Puppeteer testing

### ✅ Window 5: Scene Tests - All 5 Scenes (COMPLETE)

**Completed:** 2026-01-14

**Deliverables:**
- ✅ test/scenes/test-timeline.mjs - 7 tests, all passing
- ✅ test/scenes/test-venues.mjs - 7 tests, all passing (tests Scene4Bands venue network)
- ✅ test/scenes/test-map.mjs - 8 tests, all passing
- ✅ test/scenes/test-genres.mjs - 8 tests, all passing (NEW)
- ✅ test/scenes/test-artists.mjs - 7 tests, all passing (NEW)

**Test Results:**
```bash
# Timeline Scene (Scene1Hero)
✓ 7 tests passed - Initial render, year dots (39), hover preview, navigation, statistics, deep linking, mobile

# Venue Network Scene (Scene4Bands)
✓ 7 tests passed - Navigation, Top 10 render, view mode toggle, D3 force simulation (296 nodes), interactions, deep linking, mobile

# Map Scene (Scene3Map)
✓ 8 tests passed - Navigation, Leaflet loads, venue markers (77 paths), marker popup, popup content, zoom controls, deep linking, mobile

# Genres Scene (Scene5Genres)
✓ 8 tests passed - Navigation, treemap render (36 cells), timeline slider, genre selection, year navigation, breadcrumb, deep linking, mobile

# Artist Scene (ArtistScene)
✓ 7 tests passed - Navigation, mosaic render (100 cards), search, sort alphabetical, sort most seen, deep linking, mobile

Total: 37 Puppeteer scene tests, all passing
```

**Key Findings & Fixes:**
- **Scene structure mapped correctly:**
  - Scene 1: Timeline (Scene1Hero) → `?scene=timeline` ✓
  - Scene 2: Venue Network (Scene4Bands) → `?scene=venues` ✓
  - Scene 3: Map (Scene3Map) → `?scene=geography` ✓
  - Scene 4: Genres (Scene5Genres) → `?scene=genres` ✓
  - Scene 5: Artists (ArtistScene) → `?scene=artists` ✓
- **Fixed deep linking:** Map scene uses `geography` not `map` parameter
- **Fixed selector mismatch:** Map scene uses `data-testid="map-scene"` not `scene-map`
- **Map marker detection:** Leaflet renders SVG path elements (77 found), not standard marker icons
- **Rewritten test-venues.mjs:** Now tests Scene4Bands (force-directed venue network graph)

**Files Created:**
- test/scenes/test-timeline.mjs (7 tests)
- test/scenes/test-venues.mjs (7 tests - venue network)
- test/scenes/test-map.mjs (8 tests)
- test/scenes/test-genres.mjs (8 tests - NEW)
- test/scenes/test-artists.mjs (7 tests - NEW)

**Files Modified:**
- test/utils/helpers.mjs (added delay() function, replaced waitForTimeout)
- test/utils/selectors.mjs (fixed MAP.scene selector: `map-scene` not `scene-map`)
- package.json (added 6 new npm scripts for scene tests)

**NPM Scripts Added:**
```json
"test:scenes:puppeteer": "...",  // Run all 5 scene tests
"test:timeline": "node test/scenes/test-timeline.mjs",
"test:venues": "node test/scenes/test-venues.mjs",
"test:map": "node test/scenes/test-map.mjs",
"test:genres": "node test/scenes/test-genres.mjs",
"test:artists": "node test/scenes/test-artists.mjs"
```

**Progress:** 100% complete for Window 5 - All 5 scenes have comprehensive Puppeteer tests

### ✅ Window 8: /test Command + Documentation (COMPLETE)

**Completed:** 2026-01-14

**Deliverables:**
- ✅ `.claude/commands/test.md` - Comprehensive /test command documentation
- ✅ `scripts/run-tests.ts` - Unified test runner with colored output (~350 LOC)
- ✅ `test/README.md` - Updated with all 305 tests and current status
- ✅ `package.json` - Added 3 new npm scripts (test:all, test:all:quick, test:all:coverage)

**Features:**
- **Unified test runner** that orchestrates pipeline + scene tests
- **Dev server check** before running Puppeteer tests (checks http://localhost:5173)
- **Colored terminal output** using ANSI codes for readability
- **Summary report** with pass/fail counts, duration, and screenshot location
- **Multiple run modes:** all tests, pipeline only, scenes only, quick, coverage
- **Exit codes** properly propagated (non-zero if any test fails)

**NPM Scripts Added:**
```json
"test:all": "tsx scripts/run-tests.ts",
"test:all:quick": "tsx scripts/run-tests.ts --quick",
"test:all:coverage": "tsx scripts/run-tests.ts --coverage"
```

**Usage Examples:**
```bash
# Run everything (requires dev server for scenes)
npm run test:all

# Quick pipeline tests only (no Puppeteer, ~1 min)
npm run test:all:quick

# With coverage report (generates HTML report)
npm run test:all:coverage
```

**Test Runner Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🧪 MORPERHAUS TEST SUITE RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pipeline Tests:     ✅ All passed
Scene Tests:
  ✓ Timeline
  ✓ Venues
  ✓ Map
  ✓ Genres
  ✓ Artists

Total:
  Tests Run:    305
  Passed:       305
  Duration:     ~2 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Documentation Updates:**
- `/test` command fully documented with:
  - Overview of test suite (268 pipeline + 37 scene = 305 total)
  - Prerequisites (dev server for scene tests)
  - Implementation steps for Claude
  - Troubleshooting guide
  - NPM scripts reference
  - Coverage targets
  - Example workflows
- `test/README.md` updated with:
  - Complete test counts per suite
  - Updated status (Windows 1-6, 8 complete)
  - Quick reference for all test commands
  - Implementation status section

**Files Created:**
- .claude/commands/test.md (~450 LOC)
- scripts/run-tests.ts (~350 LOC)

**Files Modified:**
- test/README.md (updated test counts, status, quick start)
- package.json (added 3 npm scripts)

**Key Decisions:**
- Test runner uses colored output for better UX (ANSI codes)
- Dev server check prevents confusing errors when Puppeteer tests fail
- Pipeline tests run first (faster feedback, logical ordering)
- Summary report shows per-scene breakdown for quick debugging
- Clear separation from `/validate` command (different purpose)

**Progress:** 100% complete for Window 8 - Unified test infrastructure ready

### 📋 Remaining Windows

- **Window 6:** ~~Venue Network, Genres, Artist scene tests~~ ✅ **COMPLETED** (merged into Window 5)
- **Window 7:** Accessibility testing (axe-core) - DEFERRED to future session
- **Window 8:** ✅ **COMPLETED** - /test command + test runner + documentation

---

## Executive Summary

Build a comprehensive testing infrastructure for Morperhaus Concert Archives to ensure data integrity, validate scene interactions, and maintain UX/design quality standards.

**Scope:**
1. **Data Pipeline Testing** (Priority 1): Unit and integration tests for 37 scripts, 8 external APIs, enrichment logic, caching, validation
2. **Scene Visual Testing** (Priority 2): Puppeteer-based tests for 5 interactive scenes (Timeline, Venues, Map, Genres, Artists)
3. **Testing Infrastructure**: Vitest for unit/integration, Puppeteer for visual, `/test` command for unified execution
4. **Design Compliance**: Manual screenshot review + accessibility testing (axe-core)

**Why this matters:**
- Prevents data corruption in 9-step pipeline with complex caching strategies
- Ensures scene interactions (D3 force simulations, Leaflet maps, animations) work correctly
- Validates accessibility compliance (WCAG AA)
- Provides confidence for refactoring and feature additions

---

## 🚀 Implementation Quick Start

**Window 1 is COMPLETE. To continue with Window 2, start a NEW Claude Code session and run:**

```
/implement --spec global-comprehensive-testing-suite
```

**For reference, here's the full context for a fresh session:**

```
I need to continue implementing the Comprehensive Testing Suite for Morperhaus Concerts.

**CURRENT STATUS:**
✅ Window 1 COMPLETE: Test infrastructure setup
   - Vitest installed and configured
   - Test directory structure created
   - Mock fixtures created (8 files)
   - normalize.test.ts implemented (37 tests passing)
   - npm test scripts added
   - Documentation complete (test/README.md)

🚧 Window 2 NEXT: Data Pipeline Core Tests
   - Goal: Test fetch, geocode, validate, backup, diff scripts
   - Expected: ~200 tests, >85% coverage

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Update this spec with completed work before ending session
  4. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth

**Key References:**
- Full Design Spec: docs/specs/future/global-comprehensive-testing-suite.md (check Implementation Status section)
- Test Infrastructure: vitest.config.ts, test/setup.ts (already created)
- Test README: test/README.md (comprehensive guide)
- Data Pipeline Documentation: docs/DATA_PIPELINE.md
- Design System: .claude/skills/design-system/SKILL.md
- Data Schema: .claude/skills/data-schema/SKILL.md

**Implementation Windows:**
- ✅ Window 1: Vitest infrastructure, test fixtures, normalize tests (COMPLETE)
- 🚧 Window 2: Data pipeline core tests (fetch, geocode, validate, backup, diff) (NEXT)
- Window 3: Enrichment tests (artists, venues, Spotify, discography, setlists)
- Window 4: Puppeteer infrastructure, add data-testid attributes
- Window 5: Timeline, Venues, Map scene tests
- Window 6: Venue Network, Genres, Artist scene tests
- Window 7: axe-core accessibility testing
- Window 8: /test command, final documentation

**Testing Philosophy:**
Test data integrity and user-facing behavior, not implementation details. Focus on:
1. **Data Pipeline**: Cache correctness, API error handling, backup safety
2. **Scenes**: Render correctness, interaction behavior, responsive design
3. **Accessibility**: Keyboard navigation, ARIA labels, WCAG AA compliance

**Key Design Details:**
- Test execution time target: <2 minutes for pipeline tests
- Screenshot directory: `/tmp/morperhaus-tests/`
- Coverage target: >80% for pipeline scripts (>85% for core pipeline)
- Manual screenshot review (no Percy/Chromatic)
- Dev server required for visual tests (http://localhost:5173 - Vite default)

**Files Created (Window 1):**
- ✅ vitest.config.ts (~60 LOC)
- ✅ test/setup.ts (~40 LOC)
- ✅ test/utils/normalize.test.ts (~250 LOC, 37 tests)
- ✅ test/fixtures/*.json (8 mock data files)
- ✅ test/README.md (~220 LOC)

**Files to Create (Windows 2-8):**
- test/pipeline/*.test.ts (14 files, ~200 LOC each = 2,800 LOC)
- test/scenes/*.mjs (6 files, ~300 LOC each = 1,800 LOC)
- test/utils/helpers.mjs (~150 LOC)
- test/utils/selectors.mjs (~100 LOC)
- test/utils/accessibility.mjs (~50 LOC)
- test/fixtures/*.json (9 mock data files)
- scripts/run-tests.ts (~100 LOC)
- .claude/commands/test.md (~150 LOC)
- test/README.md (~200 LOC)

**Files to Modify:**
- package.json (add 20+ test scripts)
- src/components/scenes/Scene1Hero.tsx (add data-testid attributes)
- src/components/scenes/Scene2Venues.tsx (add data-testid attributes)
- src/components/scenes/Scene3Map.tsx (add data-testid attributes)
- src/components/scenes/Scene4Bands.tsx (add data-testid attributes)
- src/components/scenes/Scene5Genres/index.tsx (add data-testid attributes)
- src/components/scenes/ArtistScene.tsx (add data-testid attributes)

Let's start with Window 1. Should I begin by setting up Vitest configuration and test infrastructure?
```

---

## Phase 1: Data Pipeline Testing (Priority)

### Goals
- Ensure data integrity across 9-step pipeline
- Validate enrichment logic for artists, venues, Spotify, discography, setlists
- Test caching strategies (TTL enforcement, cache keys, fallbacks)
- Verify API integration error handling
- Test file I/O safety (backups, dry-run, atomic writes)

### Test Categories

#### 1.1 Core Pipeline Orchestration Tests
**File**: `test/pipeline/build-data.test.ts`

Test the main orchestrator ([scripts/build-data.ts](scripts/build-data.ts)):
- ✅ Pipeline runs all 9 steps in correct order
- ✅ Skip flags work (`--skip-validation`, `--skip-venues`, `--skip-spotify`, `--skip-discography`, `--skip-setlists`)
- ✅ Dry-run mode prevents file writes
- ✅ Force-refresh flags work (`--force-refresh-setlists`)
- ✅ Missing API credentials skip optional steps gracefully
- ✅ Error in one step stops pipeline with exit code 1
- ✅ Backup creation before each file write

**Key Tests**:
```typescript
describe('build-data.ts orchestrator', () => {
  it('runs all steps in order when no flags provided')
  it('skips validation when --skip-validation flag used')
  it('skips venues when GOOGLE_PLACES_API_KEY missing')
  it('skips Spotify when credentials missing')
  it('creates backups before writing files')
  it('exits with code 1 if any step fails')
  it('does not write files in --dry-run mode')
})
```

---

#### 1.2 Data Fetching Tests
**File**: `test/pipeline/fetch-google-sheet.test.ts`

Test Google Sheets fetching ([scripts/fetch-google-sheet.ts](scripts/fetch-google-sheet.ts)):
- ✅ Parses header row correctly (flexible columns)
- ✅ Validates required columns (Date, Headliner, Venue, City/State)
- ✅ Handles separate City/State vs combined City/State columns
- ✅ Trims whitespace from all fields (cache key consistency)
- ✅ Skips rows with invalid dates
- ✅ Skips rows with missing headliners
- ✅ Warns about missing optional columns (Genre, Opener, Reference)
- ✅ Processes openers correctly (Opener, Opener_1...Opener_15)
- ✅ Geocodes venues using cache-first strategy
- ✅ Falls back to city-level coordinates when venue geocoding fails
- ✅ Generates metadata (date ranges, unique artists/venues)
- ✅ Creates backup before writing `concerts.json`

**Mock Data**: Mock Google Sheets API responses, test with various column orders

---

#### 1.3 Geocoding Tests
**File**: `test/pipeline/geocode-venues.test.ts`

Test venue geocoding ([scripts/geocode-venues.ts](scripts/geocode-venues.ts)):
- ✅ Builds cache keys correctly: `${venue}|${city}|${state}`.toLowerCase()
- ✅ Trims whitespace before building cache key
- ✅ Reuses cached coordinates (no API call)
- ✅ Geocodes new venues (makes API call)
- ✅ Rate limits to 50 req/sec (20ms delay enforced)
- ✅ Falls back to city coordinates when geocoding fails
- ✅ Handles geocoding API errors gracefully
- ✅ Saves cache to `geocode-cache.json`

---

#### 1.4 Validation Tests
**File**: `test/pipeline/validate-concerts.test.ts`

Test concert data validation ([scripts/validate-concerts.ts](scripts/validate-concerts.ts)):
- ✅ Detects missing required fields (date, headliner, venue, city)
- ✅ Detects invalid date formats
- ✅ Detects duplicate concerts (same date + headliner)
- ✅ Detects orphaned openers (openers without headliner)
- ✅ Warns about unusual dates (before 1950 or >2 years future)
- ✅ Warns about default coordinates (0, 0)
- ✅ Warns about excessive openers (>10)
- ✅ Exits with code 1 when errors found
- ✅ Exits with code 0 when only warnings

---

#### 1.5 Artist Enrichment Tests
**File**: `test/pipeline/enrich-artists.test.ts`

Test artist metadata enrichment ([scripts/enrich-artists.ts](scripts/enrich-artists.ts)):
- ✅ Fetches metadata from TheAudioDB
- ✅ Collects all fields (name, image, bio, genres, formed, website)
- ✅ Skips artists with recent data (<30 days old)
- ✅ Re-fetches mock data artists (always stale)
- ✅ Rate limits to 2 req/sec
- ✅ Handles artist not found gracefully
- ✅ Creates backup before writing `artists-metadata.json`
- ✅ Caches results with fetchedAt timestamp

---

#### 1.6 Venue Enrichment Tests
**File**: `test/pipeline/enrich-venues.test.ts`

Test venue metadata enrichment ([scripts/enrich-venues.ts](scripts/enrich-venues.ts)):
- ✅ Loads venue status from `venue-status.csv` (optional)
- ✅ Defaults to "active" status when CSV missing
- ✅ Fetches Place ID from Google Places Text Search
- ✅ Fetches place details (photos, rating, website)
- ✅ Generates photo URLs (thumbnail, medium, large)
- ✅ Sets 90-day cache expiry for active venues
- ✅ Sets null cache expiry for legacy venues (never expire)
- ✅ Detects manual photos in `/public/images/venues/`
- ✅ Manual photos override API photos
- ✅ Falls back to `/images/venues/fallback-active.jpg` for active venues without photos
- ✅ Falls back to `/images/venues/fallback.jpg` for legacy venues
- ✅ Creates backup before writing `venues-metadata.json`

---

#### 1.7 Spotify Enrichment Tests
**File**: `test/pipeline/enrich-spotify-metadata.test.ts`

Test Spotify enrichment ([scripts/enrich-spotify-metadata.ts](scripts/enrich-spotify-metadata.ts)):
- ✅ Authenticates with Client Credentials
- ✅ Searches for artist by name
- ✅ Handles ambiguous matches using `spotify-overrides.json`
- ✅ Collects all fields (spotifyArtistId, mostPopularAlbum, topTracks, genres, popularity)
- ✅ Skips artists with recent data (<90 days old)
- ✅ Rate limits to 350ms between requests
- ✅ Warns about ambiguous matches (popularity <20)
- ✅ Creates backup before writing `artists-metadata.json`

---

#### 1.8 Discography Enrichment Tests
**File**: `test/pipeline/enrich-discography.test.ts`

Test MusicBrainz discography enrichment ([scripts/enrich-discography.ts](scripts/enrich-discography.ts)):
- ✅ Searches MusicBrainz for artist by name
- ✅ Uses fuzzy matching (80% Levenshtein threshold)
- ✅ Fetches release groups for artist
- ✅ Fetches cover art from Cover Art Archive
- ✅ Filters albums (primaryType: Album, excludes singles/EPs)
- ✅ Skips artists with recent data (<90 days old)
- ✅ Rate limits to 1 req/sec (strictly enforced)
- ✅ Handles pagination warning (>100 albums)
- ✅ Skips mock data artists
- ✅ Creates backup before writing `discography.json`

---

#### 1.9 Setlist Pre-fetch Tests
**File**: `test/pipeline/prefetch-setlists.test.ts`

Test setlist.fm pre-fetch ([scripts/prefetch-setlists.ts](scripts/prefetch-setlists.ts)):
- ✅ Loads existing cache for incremental updates
- ✅ Uses fuzzy venue matching (handles name variations)
- ✅ Searches setlist.fm by artist + venue + date
- ✅ Reuses cached setlists (no API call)
- ✅ Fetches new setlists via API
- ✅ Rate limits to 1 req/sec
- ✅ Handles setlist not found gracefully
- ✅ Creates backup before writing `setlists-cache.json`
- ✅ Force-refresh re-fetches all setlists (`--force-refresh`)

---

#### 1.10 Genre Aggregation Tests
**File**: `test/pipeline/aggregate-genres-timeline.test.ts`

Test genre timeline aggregation ([scripts/aggregate-genres-timeline.ts](scripts/aggregate-genres-timeline.ts)):
- ✅ Loads `concerts.json`
- ✅ Aggregates genre counts by year
- ✅ Aggregates artist show counts by genre
- ✅ Identifies milestone years (e.g., 100 concerts)
- ✅ Generates timeline visualization data
- ✅ Maps genres to colors from constants
- ✅ Writes to `genres-timeline.json`

---

#### 1.11 Concert Genre Enrichment Tests
**File**: `test/pipeline/enrich-concert-genres.test.ts`

Test concert genre enrichment ([scripts/enrich-concert-genres.ts](scripts/enrich-concert-genres.ts)):
- ✅ Loads `concerts.json` and `artists-metadata.json`
- ✅ Replaces concert genres with canonical artist genres
- ✅ Auto-enriches new artists (fetches from TheAudioDB)
- ✅ Tracks genre changes
- ✅ Creates backup before writing `concerts.json`

---

#### 1.12 Backup System Tests
**File**: `test/pipeline/backup.test.ts`

Test backup utility ([scripts/backup.ts](scripts/backup.ts)):
- ✅ Creates timestamped backups (YYYY-MM-DDTHH-MM-SS)
- ✅ Keeps last 10 backups
- ✅ Auto-cleans old backups
- ✅ Handles missing source file gracefully
- ✅ Backup naming format consistent

---

#### 1.13 Diff Report Tests
**File**: `test/pipeline/diff-concerts.test.ts`

Test diff reporting ([scripts/diff-concerts.ts](scripts/diff-concerts.ts)):
- ✅ Compares current vs backup `concerts.json`
- ✅ Detects added concerts
- ✅ Detects removed concerts
- ✅ Detects modified concerts (field-level changes)
- ✅ Shows summary statistics
- ✅ Handles missing backup file gracefully

---

#### 1.14 Normalization Tests
**File**: `test/utils/normalize.test.ts`

Test name normalization ([src/utils/normalize.ts](src/utils/normalize.ts)):
- ✅ Normalizes artist names (lowercase, hyphenated)
- ✅ Normalizes venue names (lowercase, hyphenated)
- ✅ Handles special characters (apostrophes, ampersands, periods)
- ✅ Handles whitespace (leading, trailing, multiple spaces)
- ✅ Consistent output for same input

---

### Test Infrastructure Setup

#### Vitest Configuration
**File**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.ts',
        'dist/',
      ],
    },
    testTimeout: 30000, // 30s for API tests
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

#### Test Setup
**File**: `test/setup.ts`

Mock environment variables, setup/teardown hooks.

#### Mock Data Fixtures
**Directory**: `test/fixtures/`

Create mock data files:
- `concerts.json` - Sample concert data
- `artists-metadata.json` - Sample artist metadata
- `venues-metadata.json` - Sample venue metadata
- `geocode-cache.json` - Sample geocode cache
- `google-sheets-response.json` - Mock Google Sheets API response
- `theaudiodb-response.json` - Mock TheAudioDB response
- `spotify-response.json` - Mock Spotify response
- `musicbrainz-response.json` - Mock MusicBrainz response
- `setlistfm-response.json` - Mock setlist.fm response

---

### npm Scripts for Pipeline Testing

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:pipeline": "vitest --config vitest.config.ts test/pipeline",
    "test:pipeline:fetch": "vitest test/pipeline/fetch-google-sheet.test.ts",
    "test:pipeline:validate": "vitest test/pipeline/validate-concerts.test.ts",
    "test:pipeline:enrich": "vitest test/pipeline/enrich-*.test.ts",
    "test:pipeline:build": "vitest test/pipeline/build-data.test.ts"
  }
}
```

---

## Phase 2: Scene Visual Testing

### Goals
- Verify 5 interactive scenes render correctly
- Test user interactions (click, hover, drag, scroll)
- Validate responsive behavior (mobile vs desktop)
- Ensure animations complete correctly
- Test deep linking functionality
- Capture screenshots for manual design review

### Test Structure

See full specification document for complete scene test details covering:
- **2.1 Timeline Scene Tests** ([src/components/scenes/Scene1Hero.tsx](src/components/scenes/Scene1Hero.tsx))
- **2.2 Venues Scene Tests** ([src/components/scenes/Scene2Venues.tsx](src/components/scenes/Scene2Venues.tsx))
- **2.3 Map Scene Tests** ([src/components/scenes/Scene3Map.tsx](src/components/scenes/Scene3Map.tsx))
- **2.4 Bands/Venues Network Scene Tests** ([src/components/scenes/Scene4Bands.tsx](src/components/scenes/Scene4Bands.tsx))
- **2.5 Genres Scene Tests** ([src/components/scenes/Scene5Genres/index.tsx](src/components/scenes/Scene5Genres/index.tsx))
- **2.6 Artist Scene Tests** ([src/components/scenes/ArtistScene.tsx](src/components/scenes/ArtistScene.tsx))

### Visual Testing Infrastructure

#### Puppeteer Helper Utilities
**File**: `test/utils/helpers.mjs`

Provides: CONFIG constants, setupBrowser(), navigateToScene(), takeScreenshot(), waitForD3Settle(), waitForAnimation()

#### Centralized Selectors
**File**: `test/utils/selectors.mjs`

Organizes all data-testid selectors by scene.

### npm Scripts for Visual Testing

```json
{
  "scripts": {
    "test:sanity": "node test/test-simple.mjs",
    "test:scenes": "npm run test:timeline && npm run test:venues && npm run test:map && npm run test:genres && npm run test:artists",
    "test:timeline": "node test/scenes/test-timeline.mjs",
    "test:venues": "node test/scenes/test-venues.mjs",
    "test:map": "node test/scenes/test-map.mjs",
    "test:genres": "node test/scenes/test-genres.mjs",
    "test:artists": "node test/scenes/test-artists.mjs",
    "test:venue-network": "node test/scenes/test-venue-network.mjs"
  }
}
```

---

## Phase 3: Accessibility Testing

### Goals
- Validate WCAG AA compliance
- Test keyboard navigation
- Verify ARIA labels and roles
- Check color contrast
- Test focus management

### Approach

Use **axe-core** with Puppeteer for automated accessibility testing.

#### Accessibility Test Helper
**File**: `test/utils/accessibility.mjs`

Provides: runAccessibilityTests(page, sceneName) function that analyzes page with axe-core and reports violations.

---

## Phase 4: /test Command/Skill

### Goals
- Unified command for running all tests
- Separate from /validate (different purpose)
- Progress reporting
- Error handling

### Implementation

**File**: `.claude/commands/test.md`

Command that:
1. Checks dev server is running
2. Runs data pipeline tests
3. Runs scene visual tests
4. Runs accessibility tests
5. Generates summary report

### Test Command Runner Script
**File**: `scripts/run-tests.ts`

TypeScript script that orchestrates test execution with chalk-colored output.

---

## Phase 5: Documentation & Maintenance

### Test Documentation
**File**: `test/README.md`

Comprehensive guide covering:
- Overview of test suites
- Quick start instructions
- Test structure
- Writing new tests
- Coverage reports
- Troubleshooting

---

## Critical Files to Modify

### Add data-testid Attributes

Update scene components to add `data-testid` attributes for reliable selectors:

**Files to modify**:
1. [src/components/scenes/Scene1Hero.tsx](src/components/scenes/Scene1Hero.tsx) - Timeline
2. [src/components/scenes/Scene2Venues.tsx](src/components/scenes/Scene2Venues.tsx) - Venues
3. [src/components/scenes/Scene3Map.tsx](src/components/scenes/Scene3Map.tsx) - Map
4. [src/components/scenes/Scene4Bands.tsx](src/components/scenes/Scene4Bands.tsx) - Venue Network
5. [src/components/scenes/Scene5Genres/index.tsx](src/components/scenes/Scene5Genres/index.tsx) - Genres
6. [src/components/scenes/ArtistScene.tsx](src/components/scenes/ArtistScene.tsx) - Artists

**Example additions**:
```tsx
// Timeline year dots
<circle
  data-testid="year-dot"
  data-year={year}
  className="year-dot"
  {...props}
/>

// Timeline preview popup
<div data-testid="timeline-hover-preview" className="preview">
  {/* ... */}
</div>

// Artist card
<div data-testid="artist-card" data-artist={normalizedName}>
  {/* ... */}
</div>
```

---

## Installation & Setup

### Install Dependencies

```bash
# Vitest for unit/integration tests
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8

# Puppeteer already installed
# npm install --save-dev puppeteer

# axe-core for accessibility testing
npm install --save-dev @axe-core/puppeteer

# Utilities
npm install --save-dev tsx chalk
```

### Create Test Directory Structure

```bash
mkdir -p test/{pipeline,scenes,utils,fixtures}
touch test/setup.ts
touch test/README.md
touch vitest.config.ts
```

---

## Success Criteria

### Phase 1: Data Pipeline Testing
- ✅ 100+ unit tests covering all 37 scripts
- ✅ Mock API responses for all 8 external APIs
- ✅ Test coverage >80% for pipeline scripts
- ✅ All tests pass on clean checkout
- ✅ Test execution time <2 minutes

### Phase 2: Scene Visual Testing
- ✅ 5 scene test files (1 per scene)
- ✅ 50+ interaction tests across all scenes
- ✅ Screenshots captured for all key states
- ✅ Responsive behavior tested (mobile, tablet, desktop)
- ✅ Deep linking tested for all scenes
- ✅ All tests pass on clean checkout

### Phase 3: Accessibility Testing
- ✅ axe-core integrated with scene tests
- ✅ WCAG AA violations reported
- ✅ Keyboard navigation tested
- ✅ Focus management tested

### Phase 4: /test Command
- ✅ Unified test runner works
- ✅ Reports comprehensive results
- ✅ Exits with correct codes
- ✅ Screenshots easily accessible

### Phase 5: Documentation
- ✅ test/README.md complete
- ✅ .claude/commands/test.md complete
- ✅ All examples work
- ✅ Troubleshooting covers common issues

---

## Implementation Roadmap

### Sprint 1: Data Pipeline Core (8-10 hours)
- Setup Vitest configuration
- Create test fixtures
- Implement tests 1.1-1.5
- **Deliverable**: Core pipeline tests passing

### Sprint 2: Data Pipeline Enrichment (8-10 hours)
- Implement tests 1.6-1.14
- Add coverage reporting
- **Deliverable**: Full pipeline test coverage

### Sprint 3: Scene Visual Core (8-10 hours)
- Setup Puppeteer utilities
- Add data-testid attributes to components
- Implement tests 2.1-2.3
- **Deliverable**: Timeline, Venues, Map tests

### Sprint 4: Scene Visual Advanced (8-10 hours)
- Implement tests 2.4-2.6
- Add accessibility testing (axe-core)
- **Deliverable**: All 5 scenes tested

### Sprint 5: Integration & Documentation (6-8 hours)
- Implement /test command
- Write documentation
- End-to-end verification
- **Deliverable**: Complete test suite

---

## Estimated Effort Breakdown

| Phase | Task | Hours |
|-------|------|-------|
| **Phase 1** | Data Pipeline Testing | 20-25 |
| **Phase 2** | Scene Visual Testing | 14-20 |
| **Phase 3** | Accessibility Testing | 3-5 |
| **Phase 4** | /test Command | 2-3 |
| **Phase 5** | Documentation | 3-5 |
| **Total** | | **42-58 hours** |

See full specification for detailed breakdown per task.

---

## Open Questions

### 1. CI/CD Integration
**Question**: Should we add GitHub Actions workflow for automated testing?

**Recommendation**: Add later (Phase 6) once tests are proven stable.

### 2. Test Data Management
**Question**: How should we manage test fixtures?

**Recommendation**: Static fixtures (committed JSON files in `test/fixtures/`)

### 3. Test Execution Environment
**Question**: Where should CI tests run?

**Recommendation**: GitHub Actions (Phase 6), local for now

---

## Maintenance & Evolution

### When to Update Tests

**Add tests when**:
- Adding new pipeline scripts
- Adding new scenes or scene features
- Changing data validation rules
- Integrating new APIs

**Update tests when**:
- Changing component structure (update selectors)
- Changing animation timings (update delays)
- Changing data schemas (update fixtures)
- Fixing bugs (add regression test)

### Test Health Monitoring

**Weekly**: Run full test suite, review failed tests, update stale screenshots
**Monthly**: Review test coverage, identify gaps, update documentation
**Per release**: Run full test suite, review accessibility warnings, update test fixtures

---

## Revision History

- **2026-01-14:** Initial specification created (v1.0.0)
- **Status:** Planned
- **Author:** Claude Sonnet 4.5 + User
