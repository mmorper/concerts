# Testing Skill

**Context:** Concert Archives Testing Infrastructure
**Loaded:** When implementing features requiring test coverage

---

## Testing Philosophy

**Test behavior, not implementation.**

- Write tests that verify *what* the code does, not *how* it does it
- Tests should survive refactoring of internal implementation
- Focus on user-facing behavior and data contracts

---

## Test Infrastructure

### Test Runners

**Vitest** (unit/integration tests)
- **Location:** `test/pipeline/`, `test/utils/`, `test/fixtures/`
- **Config:** `vitest.config.ts`
- **Run:** `npm run test` or `npm run test:unit`
- **Use for:** Data pipeline scripts, utility functions, API mocks

**Puppeteer** (E2E/visual tests)
- **Location:** `test/scenes/`
- **Run:** `npm run test:e2e` or `npm run test:scenes`
- **Use for:** UI interactions, scene rendering, navigation flows

**Combined:**
- **Run:** `npm run test:all` (runs both Vitest and Puppeteer)

---

## Test Types

### 1. Pipeline Tests (Vitest)

**When:** Modifying scripts in `scripts/` or data utilities in `src/utils/`

**Structure:**
```typescript
// test/pipeline/enrich-metadata.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { enrichMetadata } from '../../scripts/enrich-metadata';

describe('enrichMetadata', () => {
  it('should add artist metadata from API', async () => {
    const input = { artist: 'Depeche Mode', venue: 'Fox Theater' };
    const result = await enrichMetadata(input);
    expect(result.artistId).toBe('spotify:artist:...');
  });
});
```

**Key patterns:**
- Use fixtures from `test/fixtures/`
- Mock API calls with `vi.mock()`
- Test edge cases (missing data, API failures, malformed input)
- Validate data contract outputs

### 2. Scene Tests (Puppeteer)

**When:** Adding/modifying UI in `src/components/scenes/`

**Structure:**
```javascript
// test/scenes/test-artists.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { launchBrowser, closeBrowser, goto } from '../setup.js';

describe('Artist Scene', () => {
  before(async () => { await launchBrowser(); });
  after(async () => { await closeBrowser(); });

  it('should display artist grid', async () => {
    await goto('/?scene=artists');
    const artists = await page.$$('.artist-card');
    assert(artists.length > 0, 'Should render artist cards');
  });
});
```

**Key patterns:**
- Use `test/setup.ts` helpers (`launchBrowser`, `goto`, `waitForScene`)
- Test navigation flows (`/?scene=artists&artist=depeche-mode`)
- Verify DOM structure, not CSS specifics
- Test interactions (clicks, hovers, keyboard nav)

### 3. Utility Tests (Vitest)

**When:** Adding/modifying utilities in `src/utils/`

**Structure:**
```typescript
// test/utils/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeArtistName } from '../../src/utils/normalize';

describe('normalizeArtistName', () => {
  it('should convert to lowercase hyphenated format', () => {
    expect(normalizeArtistName('Depeche Mode')).toBe('depeche-mode');
  });
});
```

### 4. Integration Tests (Vitest)

**When:** Testing data flow through multiple systems

**Structure:**
```typescript
// test/pipeline/data-refresh.test.ts
describe('Data refresh pipeline', () => {
  it('should maintain referential integrity', async () => {
    await runDataPipeline();
    const concerts = loadConcerts();
    const artists = loadArtists();

    concerts.forEach(c => {
      assert(artists.find(a => a.normalizedName === c.normalizedName));
    });
  });
});
```

---

## Testing Checklist

### Before Writing Tests

- [ ] Identify what behavior needs verification (not implementation details)
- [ ] Determine test type (pipeline/scene/utility/integration)
- [ ] Check if fixtures exist in `test/fixtures/` or need creation
- [ ] Review similar tests for patterns to follow

### When Writing Tests

- [ ] Use descriptive test names (`it('should...')` format)
- [ ] Test success paths and error conditions
- [ ] Mock external dependencies (APIs, file system)
- [ ] Use fixtures for complex test data
- [ ] Avoid brittle assertions (test contracts, not internals)

### After Writing Tests

- [ ] Run tests locally (`npm run test:all`)
- [ ] Verify tests fail when code is broken (test the test)
- [ ] Check test output is readable and actionable
- [ ] Update test documentation if adding new patterns

---

## Test File Naming

| Test Type | Location | Naming Convention |
|-----------|----------|-------------------|
| Pipeline scripts | `test/pipeline/` | `test-<script-name>.mjs` or `<script-name>.test.ts` |
| Scene components | `test/scenes/` | `test-<scene-name>.mjs` |
| Utilities | `test/utils/` | `<utility-name>.test.ts` |
| Fixtures | `test/fixtures/` | `<data-type>-fixture.json` |

---

## Mocking Patterns

### API Mocks (Vitest)

```typescript
import { vi } from 'vitest';
import * as spotifyService from '../../src/services/spotify';

vi.mock('../../src/services/spotify', () => ({
  fetchArtistMetadata: vi.fn().mockResolvedValue({
    id: 'spotify:artist:123',
    name: 'Depeche Mode'
  })
}));
```

### Fixture Data

```typescript
// test/fixtures/concerts-fixture.json
[
  {
    "date": "2024-01-15",
    "artist": "Depeche Mode",
    "normalizedName": "depeche-mode",
    "venue": "Fox Theater"
  }
]

// test/pipeline/enrich-metadata.test.ts
import concertsFixture from '../fixtures/concerts-fixture.json';
```

---

## Running and Debugging Tests

### Run Commands

```bash
npm run test              # Vitest only (fast feedback)
npm run test:unit         # Alias for npm run test
npm run test:e2e          # Puppeteer only (scenes)
npm run test:scenes       # Alias for test:e2e
npm run test:all          # Both (pre-commit check)
```

### Debugging Vitest

```bash
npm run test -- --reporter=verbose    # Detailed output
npm run test -- --run                 # Non-watch mode
npm run test -- test/pipeline/        # Specific directory
```

### Debugging Puppeteer

```javascript
// Add to test file for visual debugging
await page.screenshot({ path: 'debug.png' });
await page.evaluate(() => debugger); // Pauses execution
```

---

## When to Write Tests

| Change Type | Test Requirements |
|-------------|-------------------|
| **New data pipeline script** | ✅ Vitest tests (fixtures + edge cases) |
| **Modified existing script** | ✅ Update existing tests + add new cases |
| **New UI component** | ✅ Puppeteer tests (rendering + interactions) |
| **Modified scene logic** | ✅ Update existing scene tests |
| **New utility function** | ✅ Vitest tests (unit tests) |
| **Data schema change** | ✅ Validation tests (referential integrity) |
| **API integration** | ✅ Mocked integration tests |
| **Bug fix** | ✅ Regression test (verify fix persists) |
| **Documentation only** | ⛔ No tests needed |
| **Style/CSS changes** | ⛔ Visual verification only |

---

## Test Coverage Goals

**Not aiming for 100% coverage** - focus on critical paths:

- ✅ **Data pipeline:** High coverage (data integrity is critical)
- ✅ **Core utilities:** High coverage (reused everywhere)
- ✅ **Scene interactions:** Moderate coverage (user-facing features)
- ⛔ **Trivial getters/setters:** Skip
- ⛔ **Type definitions:** Skip (TypeScript handles this)

---

## Common Pitfalls

### ❌ Don't Test Implementation Details

```typescript
// BAD: Tests internal state
expect(component.state.isLoading).toBe(false);

// GOOD: Tests user-visible behavior
expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
```

### ❌ Don't Use Brittle Selectors

```javascript
// BAD: Breaks if class name changes
await page.waitForSelector('.artist-card-title-text');

// GOOD: Uses semantic selectors
await page.waitForSelector('[data-testid="artist-card"]');
```

### ❌ Don't Skip Error Cases

```typescript
// BAD: Only tests success
it('should fetch artist', async () => {
  const artist = await fetchArtist('valid-id');
  expect(artist.name).toBe('Depeche Mode');
});

// GOOD: Tests success and failure
it('should handle missing artist', async () => {
  await expect(fetchArtist('invalid-id')).rejects.toThrow();
});
```

---

## Resources

- **Vitest Docs:** https://vitest.dev/
- **Puppeteer Docs:** https://pptr.dev/
- **Test README:** [test/README.md](../../test/README.md)
- **Existing Tests:** Review `test/` directory for patterns

---

**Last Updated:** 2026-01-14 (v3.4.2)
