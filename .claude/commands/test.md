# Test Command

**Purpose:** Run the comprehensive test suite for Morperhaus Concert Archives.

**Usage:** `/test [options]`

---

## Overview

This command orchestrates the complete test suite, including:
- **Data Pipeline Tests** (268 Vitest tests) - Unit/integration tests for all data processing scripts
- **Scene Visual Tests** (37 Puppeteer tests) - End-to-end tests for all 5 interactive scenes
- **Coverage Reports** - Code coverage analysis for pipeline scripts

The test suite validates data integrity, scene interactions, and ensures the application works correctly across desktop and mobile viewports.

---

## Options

- `/test` - Run all tests (pipeline + scenes)
- `/test pipeline` - Run only pipeline tests (Vitest)
- `/test scenes` - Run only scene tests (Puppeteer)
- `/test coverage` - Run pipeline tests with coverage report
- `/test quick` - Run pipeline tests only (faster, no Puppeteer)

---

## What Gets Tested

### Data Pipeline Tests (Vitest)
**Location:** `test/pipeline/`, `test/utils/`
**Runner:** `npm run test:pipeline`

Tests for all 26 data processing scripts:
- ✅ **Core Pipeline** (5 scripts): fetch, geocode, validate, backup, diff
- ✅ **Enrichment** (5 scripts): artists, venues, Spotify, discography, setlists
- ✅ **Utilities** (1 script): normalize

**Coverage:** 268 tests covering:
- Cache correctness (TTL enforcement, cache keys)
- API error handling (rate limiting, retries, fallbacks)
- Data validation (required fields, duplicates, orphans)
- File I/O safety (backups, dry-run, atomic writes)

### Scene Visual Tests (Puppeteer)
**Location:** `test/scenes/`
**Runner:** `npm run test:scenes:puppeteer`

End-to-end tests for all 5 interactive scenes:
- ✅ **Timeline Scene** (7 tests) - Year dots, hover preview, navigation, statistics
- ✅ **Venue Network Scene** (7 tests) - Force-directed graph, view modes, D3 simulation
- ✅ **Map Scene** (8 tests) - Leaflet map, venue markers, popups, zoom controls
- ✅ **Genres Scene** (8 tests) - Treemap, timeline slider, genre selection, breadcrumbs
- ✅ **Artist Scene** (7 tests) - Mosaic render, search, sorting, deep linking

**Coverage:** 37 tests validating:
- Scene rendering (initial load, D3/Leaflet initialization)
- User interactions (clicks, hovers, form inputs)
- Deep linking (URL parameters for direct navigation)
- Responsive design (mobile viewport testing)

---

## Prerequisites

### For Pipeline Tests
- No special requirements (Vitest uses Node environment)

### For Scene Tests
- **Dev server must be running** on http://localhost:5173
- Puppeteer will be installed automatically via npm
- Tests run in headless mode by default

**To start dev server:**
```bash
npm run dev
```

---

## Implementation Steps

When the user runs `/test`, Claude should:

### 0. **Load Testing Context**

```bash
# Load testing skill for infrastructure reference
Read: .claude/skills/testing/SKILL.md
```

### 1. **Check Prerequisites**
```typescript
// Check if dev server is running (for scene tests)
const serverRunning = await checkDevServer('http://localhost:5173')
if (!serverRunning && includeSceneTests) {
  console.log('⚠️  Dev server not running. Start it with: npm run dev')
  console.log('   Scene tests will be skipped.')
}
```

### 2. **Run Pipeline Tests**
```bash
npm run test:pipeline
# Or with coverage:
npm run test:coverage -- test/pipeline test/utils
```

Expected output:
```
Test Files  10 passed (10)
Tests       268 passed (268)
Duration    82.21s
```

### 3. **Run Scene Tests** (if dev server is running)
```bash
npm run test:scenes:puppeteer
```

This runs all 5 scene tests sequentially:
```bash
npm run test:timeline &&
npm run test:venues &&
npm run test:map &&
npm run test:genres &&
npm run test:artists
```

Expected output:
```
✅ Timeline: 7/7 tests passed
✅ Venue Network: 7/7 tests passed
✅ Map: 8/8 tests passed
✅ Genres: 8/8 tests passed
✅ Artists: 7/7 tests passed

📸 Screenshots saved to: /tmp/morperhaus-tests
```

### 4. **Generate Summary Report**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🧪 MORPERHAUS TEST SUITE RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pipeline Tests:     268/268 passed ✅
Scene Tests:        37/37 passed ✅
Total:              305/305 passed ✅

Coverage:           85.3% (pipeline scripts)
Duration:           ~2 minutes

Screenshots:        /tmp/morperhaus-tests/
```

---

## Test Execution Order

1. **Pipeline Tests First** (faster, no external dependencies)
   - Validates data processing logic
   - Ensures cache strategies work correctly
   - Tests API integration patterns

2. **Scene Tests Second** (requires dev server)
   - Validates UI rendering
   - Tests user interactions
   - Checks responsive behavior

**Rationale:** If pipeline tests fail, there's likely a data integrity issue that would cause scene tests to fail anyway. Running pipeline tests first provides faster feedback.

---

## Troubleshooting

### Pipeline Tests Failing
```bash
# Run specific test file for debugging
npm run test:pipeline -- test/pipeline/backup.test.ts

# Run with verbose output
npm run test:pipeline -- --reporter=verbose

# Run in watch mode for development
npm run test:watch
```

### Scene Tests Failing
```bash
# Check dev server is running
curl http://localhost:5173

# Run individual scene test for debugging
npm run test:timeline

# View screenshots in /tmp/morperhaus-tests/
open /tmp/morperhaus-tests/

# Run with visible browser (edit test file)
# Change: setupBrowser({ headless: true })
# To:     setupBrowser({ headless: false })
```

### Common Issues

**Issue:** Scene tests hang or timeout
- **Cause:** Dev server not running or wrong port
- **Fix:** Ensure `npm run dev` is running on port 5173

**Issue:** "ECONNREFUSED" errors in scene tests
- **Cause:** Dev server stopped mid-test
- **Fix:** Restart dev server and re-run tests

**Issue:** Pipeline tests fail with "ENOENT" errors
- **Cause:** Missing test fixtures
- **Fix:** Ensure `test/fixtures/*.json` files exist

**Issue:** Scene tests fail with "Cannot find element" errors
- **Cause:** Timing issues or missing data-testid attributes
- **Fix:** Increase delay times in test or verify component has correct data-testid

---

## NPM Scripts Reference

```json
{
  "test": "vitest",                          // Run all Vitest tests
  "test:run": "vitest run",                  // Run once and exit
  "test:watch": "vitest --watch",            // Watch mode
  "test:ui": "vitest --ui",                  // Visual UI for tests
  "test:coverage": "vitest run --coverage",  // With coverage
  "test:pipeline": "vitest run test/pipeline", // Pipeline only
  "test:scenes": "vitest run test/scenes",   // Vitest scene tests
  "test:utils": "vitest run test/utils",     // Utils only
  "test:sanity": "node test/test-simple.mjs", // Basic sanity check
  "test:scenes:puppeteer": "...",            // All Puppeteer scene tests
  "test:timeline": "node test/scenes/test-timeline.mjs",
  "test:venues": "node test/scenes/test-venues.mjs",
  "test:map": "node test/scenes/test-map.mjs",
  "test:genres": "node test/scenes/test-genres.mjs",
  "test:artists": "node test/scenes/test-artists.mjs"
}
```

---

## Coverage Targets

**Pipeline Scripts:**
- Core pipeline: >85% coverage
- Enrichment scripts: >80% coverage
- Utilities: >70% coverage
- Overall: >80% coverage

**Scene Tests:**
- All 5 scenes have Puppeteer tests
- Desktop and mobile viewports tested
- Key interactions validated

---

## CI/CD Integration (Future)

Once tests are stable, add to GitHub Actions:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:pipeline
      # Scene tests require dev server + Puppeteer
      - run: npm run build
      - run: npm run preview &
      - run: npm run test:scenes:puppeteer
```

---

## Test Philosophy

**Focus on behavior, not implementation:**
- Test data integrity and user-facing behavior
- Don't test implementation details
- Avoid brittle selectors (use data-testid)

**Test pyramid:**
- Many unit tests (fast, isolated)
- Some integration tests (data pipeline)
- Few E2E tests (critical user paths)

**Coverage is a guide, not a goal:**
- 80% coverage is good
- 100% coverage is not necessary
- Focus on critical paths first

---

## Related Commands

- `/validate` - Run data validation checks (different from /test)
- `/data-refresh` - Rebuild data pipeline (run before tests if data changed)
- `/implement` - Automatically includes testing recommendations for feature specs
- `/build` - Build production bundle

## Related Skills

- `.claude/skills/testing/SKILL.md` - Testing patterns, infrastructure, and best practices

---

## Example Workflow

```bash
# 1. Make code changes
vim src/components/scenes/Scene1Hero.tsx

# 2. Run tests
/test

# 3. If pipeline tests pass but scene tests fail:
npm run dev  # Start dev server
/test scenes  # Run only scene tests

# 4. If specific scene failing:
npm run test:timeline  # Debug specific scene

# 5. View screenshots to verify visual correctness
open /tmp/morperhaus-tests/
```

---

## Notes

- **Not to be confused with `/validate`**: The `/validate` command checks data integrity and version sync. The `/test` command runs the full automated test suite.
- **Tests are fast**: Pipeline tests run in ~1 minute, scene tests in ~1 minute, total ~2 minutes.
- **Tests are deterministic**: All tests should pass consistently. Flaky tests should be fixed immediately.
- **Screenshots are helpful**: Scene tests capture screenshots at key points for manual visual verification.
