# Morperhaus Concert Archives - Test Suite

Comprehensive testing infrastructure for data pipeline integrity, scene interactions, and design/UX quality.

**Status:** Windows 1-6 Complete (305 tests passing)
**Last Updated:** 2026-01-14
**Related Spec:** [docs/specs/future/global-comprehensive-testing-suite.md](../docs/specs/future/global-comprehensive-testing-suite.md)

---

## Two test roots

The root vitest config **excludes `workers/**`** and cannot run those tests: the
Workers are self-contained npm packages with their own `vitest.config.ts`, and
the root config has no plugin for the `.md` imports they use — collection fails
with *"Failed to parse source for import analysis"* and reports "no tests".

Before that exclusion (#206) those files surfaced as FAIL lines indistinguishable
from real failures, so 121 passing worker tests looked broken and buried the
suites that were genuinely failing.

**`npm run test:run` covers the root app only.** Use `npm run test:everything`
for full coverage, and note that CI runs the root gate (`.github/workflows/ci.yml`)
while each Worker has its own path-filtered workflow (`mcp-ci.yml`, `ask-chat-ci.yml`).

## Quick Start

```bash
# Run complete test suite (pipeline + scenes)
npm run test:all

# Run quick tests (pipeline only, no Puppeteer)
npm run test:all:quick

# Run with coverage report
npm run test:all:coverage

# Run specific test suites
npm run test:pipeline    # Data pipeline tests (268 tests)
npm run test:utils       # Utility tests (37 tests)
# Scene tests in a real browser. Builds the app, serves the build with
# `vite preview`, runs every scene test against it, then tears the server down.
# This is exactly what Scene CI runs — same command, no CI-only steps.
npm run test:scenes:puppeteer

# Faster loop: point the suite at a dev server you already have running.
# TEST_BASE_URL skips the build and the preview server entirely, and is also how
# you avoid port 5173 when a second worktree already owns it.
npm run dev
TEST_BASE_URL=http://localhost:5173 npm run test:scenes:puppeteer

# Individual scene tests (need a server — set TEST_BASE_URL or run the suite above)
npm run test:smoke       # All six scene roots render, no uncaught errors
npm run test:timeline    # Timeline scene
npm run test:venues      # Venue network scene
npm run test:map         # Map scene
npm run test:genres      # Genres scene
npm run test:artists     # Artists scene

# Cloudflare Workers — separate npm packages with their own vitest configs
npm run test:workers     # mcp-server (46) + ask-chat (75)
npm run test:everything  # root suite + workers

# Development mode
npm run test:watch       # Watch mode for Vitest tests
npm run test:ui          # Visual UI for Vitest tests
```

---

## Implementation Status

### ✅ Completed Windows

- **Window 1:** Test infrastructure setup (Vitest, fixtures, configuration)
- **Window 2:** Data pipeline core tests (backup, validate, fetch, geocode, diff)
- **Window 3:** Enrichment tests (artists, venues, Spotify, discography, setlists)
- **Window 4:** Puppeteer infrastructure (helpers, selectors, data-testid attributes)
- **Window 5:** All 5 scene tests (Timeline, Venue Network, Map, Genres, Artists)
- **Window 6:** Merged into Window 5
- **Window 8:** /test command + test runner + documentation

### 🚧 Remaining Windows

- **Window 7:** Accessibility testing with axe-core (deferred to future session)

### 📊 Current Status

- **268 pipeline tests** - All passing ✅
- **37 scene tests** - All passing ✅
- **305 total tests** - 100% success rate ✅
- **Coverage:** 85%+ for core pipeline scripts

---

## Test Infrastructure

### Framework: Vitest

- Fast, modern, Vite-native test runner
- v8 coverage provider
- Global test utilities enabled
- Node.js environment for pipeline tests

### Configuration

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Test runner config, coverage thresholds (80% lines/functions/statements, 75% branches) |
| `test/setup.ts` | Global setup, environment mocks, prevents real API calls |

### Directory Structure

```
test/
├── fixtures/              # Mock data and API responses (8 files)
├── pipeline/              # Data pipeline tests (Window 2-3)
├── scenes/                # Browser tests, driven by Puppeteer
│   └── test-smoke.mjs     # The CI gate: all six scene roots render (#10)
├── utils/                 # Utility function tests
│   ├── normalize.test.ts  ✅ 37 tests passing
│   ├── helpers.mjs        # Browser setup, navigation, waits (TEST_BASE_URL lives here)
│   └── selectors.mjs      # Shared data-testid selectors
└── setup.ts               # Global configuration
```

---

## Current Test Coverage

### Pipeline Tests (Vitest)

| Suite | Tests | Status |
|-------|-------|--------|
| `backup.test.ts` | 22 | ✅ Passing |
| `validate-concerts.test.ts` | 18 | ✅ Passing |
| `fetch-google-sheet.test.ts` | 25 | ✅ Passing |
| `geocode-venues.test.ts` | 30 | ✅ Passing |
| `diff-concerts.test.ts` | 18 | ✅ Passing |
| `enrich-artists.test.ts` | 12 | ✅ Passing |
| `enrich-venues.test.ts` | 27 | ✅ Passing |
| `enrich-spotify-metadata.test.ts` | 43 | ✅ Passing |
| `enrich-discography.test.ts` | 43 | ✅ Passing |
| `prefetch-setlists.test.ts` | 30 | ✅ Passing |
| `normalize.test.ts` | 37 | ✅ Passing |
| **Pipeline Total** | **268** | **✅** |

### Scene Tests (Puppeteer)

| Suite | Tests | Status |
|-------|-------|--------|
| `test-timeline.mjs` | 7 | ✅ Passing |
| `test-venues.mjs` (Venue Network) | 7 | ✅ Passing |
| `test-map.mjs` | 8 | ✅ Passing |
| `test-genres.mjs` | 8 | ✅ Passing |
| `test-artists.mjs` | 7 | ✅ Passing |
| **Scene Total** | **37** | **✅** |

### Overall

| Metric | Value |
|--------|-------|
| **Total Tests** | **305** |
| **Pass Rate** | **100%** |
| **Coverage** | **85%+** (pipeline) |

**Target Met:** >80% overall coverage, >85% for core pipeline scripts ✅

---

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    // Cleanup after each test
  })

  it('should do something specific', () => {
    // Arrange
    const input = 'test value'

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe('expected-value')
  })
})
```

### Mocking External APIs

```typescript
import mockResponse from '../fixtures/theaudiodb-response.json'

// Mock fetch globally
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockResponse),
  })
)
```

### Using Test Fixtures

```typescript
import concertData from '../fixtures/concerts-sample.json'

describe('Concert data processing', () => {
  it('should process concerts correctly', () => {
    const concerts = concertData.concerts
    expect(concerts).toHaveLength(2)
    expect(concerts[0].headliner).toBe('Depeche Mode')
  })
})
```

---

## Testing Philosophy

### What to Test

✅ **DO test:**
- Data integrity (cache correctness, validation rules)
- User-facing behavior (scene interactions, rendering)
- API error handling and fallbacks
- Normalization consistency
- Accessibility compliance (WCAG AA)

❌ **DON'T test:**
- Implementation details
- Third-party library internals
- CSS styling (use visual tests)
- Build configuration

---

## Troubleshooting

### Tests Fail to Import Modules

**Error:** `Cannot find module '@/utils/normalize'`

**Fix:** Check `vitest.config.ts` has correct path alias

### Tests Hang or Timeout

**Error:** `Test timeout of 30000ms exceeded`

**Fix:** Increase timeout in config or specific test

### Mock Data Not Loading

**Fix:** Verify fixture path and JSON structure

---

## Next Steps (Window 2)

**Goal:** Test core data pipeline scripts

**Tasks:**
1. `test/pipeline/fetch-google-sheet.test.ts` - Google Sheets fetching, column parsing, row validation
2. `test/pipeline/geocode-venues.test.ts` - Cache-first strategy, fallbacks, rate limiting
3. `test/pipeline/validate-concerts.test.ts` - All validation rules, errors vs warnings
4. `test/pipeline/backup.test.ts` - Backup creation, auto-cleanup
5. `test/pipeline/diff-concerts.test.ts` - Diff detection, summary stats

**Estimated:** 4-6 hours, ~200 tests, >85% core pipeline coverage

---

## Related Documentation

- [Comprehensive Testing Suite Spec](../docs/specs/future/global-comprehensive-testing-suite.md)
- [Data Pipeline Documentation](../docs/DATA_PIPELINE.md)
- [Design System Skill](../.claude/skills/design-system/SKILL.md)
- [Data Schema Skill](../.claude/skills/data-schema/SKILL.md)

---

**Status:** Window 1 Complete ✅
**Next:** Window 2 - Data Pipeline Core Tests
