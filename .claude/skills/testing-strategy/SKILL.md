# Testing Strategy Skill

**Version:** 1.0.0
**Last Updated:** 2026-01-09

---

## Overview

The Morperhaus Concert Archives testing strategy prioritizes **build-time validation** over runtime tests. Given the static data nature and visualization-heavy UI, the focus is on data integrity, version consistency, and manual QA.

**Core Principles:**
- Data validation at build time prevents bad data in production
- Build scripts catch errors before deployment
- Manual testing focuses on visual correctness and interactions
- External API integration tested in development
- TypeScript provides compile-time type safety

---

## Testing Philosophy

### Why This Approach?

**Static Data-Driven Application:**
- Concert data generated at build time (`npm run build-data`)
- No user input or dynamic data mutations
- Data structure guaranteed by TypeScript types
- Visual correctness requires human judgment

**Testing Pyramid (Inverted):**
```
Manual QA & Visual Testing    ← Heavy emphasis
         ↑
Build-Time Validation         ← Primary automation
         ↑
TypeScript Type Checking      ← Continuous validation
         ↑
Unit Tests                    ← Minimal (future)
```

**Trade-offs:**
- ✅ Fast iteration (no test suite slowdown)
- ✅ Focus on high-value validation (data integrity)
- ✅ Appropriate for static content app
- ❌ No automated regression testing for UI
- ❌ Requires disciplined manual testing

---

## Build-Time Validation

### 1. Data Validation Script

**Purpose:** Ensure concert data integrity before deployment

```bash
# Run validation
npm run validate-data

# Script: scripts/validate-concerts.ts
```

**Checks:**
- Required fields present (id, date, headliner, venue, city, state)
- Valid date formats (YYYY-MM-DD)
- Reasonable year range (1984-current)
- No duplicate concert IDs
- Valid coordinates (lat/lng)
- Venue normalization consistency
- Artist normalization consistency

**Example validation:**

```typescript
// scripts/validate-concerts.ts
const errors: ValidationError[] = []

// Validate required fields
concerts.forEach((concert, index) => {
  if (!concert.id || !concert.date || !concert.headliner) {
    errors.push({
      row: index + 1,
      field: 'required',
      message: 'Missing required field',
      severity: 'error'
    })
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(concert.date)) {
    errors.push({
      row: index + 1,
      field: 'date',
      message: `Invalid date format: ${concert.date}`,
      severity: 'error'
    })
  }

  // Check for future dates
  if (concert.year > currentYear) {
    warnings.push({
      row: index + 1,
      field: 'year',
      message: `Concert in future: ${concert.date}`,
      severity: 'warning'
    })
  }

  // Validate coordinates
  if (!concert.location.lat || !concert.location.lng) {
    errors.push({
      row: index + 1,
      field: 'location',
      message: 'Missing lat/lng coordinates',
      severity: 'error'
    })
  }
})

// Exit with error if validation fails
if (errors.length > 0) {
  console.error(`\n❌ Found ${errors.length} errors\n`)
  process.exit(1)
}
```

**Output:**
```
🔍 Validating concert data...
📊 Validating 178 concerts...

✅ All validations passed!
   - 178 concerts validated
   - 0 errors found
   - 3 warnings
```

### 2. Version Sync Validation

**Purpose:** Ensure changelog, package.json, and git tags match

```bash
# Run validation
npm run validate:version

# Script: scripts/validate-version-sync.ts
```

**Checks:**
- Git latest tag matches changelog.json first entry
- Git latest tag matches package.json version
- Changelog.json sorted by date (newest first)

**Example:**

```typescript
// scripts/validate-version-sync.ts
function main() {
  const gitVersion = getGitVersion()           // v3.4.1
  const changelogVersion = getChangelogVersion() // 3.4.1
  const packageVersion = getPackageVersion()    // 3.4.1

  console.log('Git tag (latest):        ', `v${gitVersion}`)
  console.log('Changelog (first entry): ', changelogVersion)
  console.log('Package.json:            ', packageVersion)

  const allMatch =
    gitVersion === changelogVersion &&
    gitVersion === packageVersion

  if (!allMatch) {
    console.log('❌ Version mismatch detected!\n')
    console.log('Fix before deploying to production!')
    process.exit(1)
  }

  console.log('✅ All versions are in sync!')
}
```

**When to run:**
- Before every release
- In CI/CD pipeline (future)
- After updating changelog or package.json

### 3. Normalization Validation

**Purpose:** Ensure consistent normalization across data files

```bash
# Run validation
npm run validate-normalization

# Script: scripts/validate-normalization.ts
```

**Checks:**
- Artist names normalized consistently
- Venue names normalized consistently
- No invalid characters in normalized names (underscores, spaces)
- No consecutive hyphens
- No leading/trailing hyphens

```typescript
function validateNormalization(original: string, normalized: string) {
  // Check for invalid characters
  if (normalized.includes('_') || normalized.includes(' ')) {
    throw new Error(`Invalid chars in: "${normalized}"`)
  }

  // Check for consecutive hyphens
  if (normalized.includes('--')) {
    console.warn(`Consecutive hyphens: "${normalized}"`)
  }

  // Check for edge hyphens
  if (normalized.startsWith('-') || normalized.endsWith('-')) {
    throw new Error(`Edge hyphens: "${normalized}"`)
  }
}
```

### 4. Artist-Genre Validation

**Purpose:** Ensure all artists have valid genre assignments

```bash
# Run validation
npm run validate:artist-genres

# Script: scripts/validate-artist-genres.ts
```

**Checks:**
- Every concert has a genre
- Genre names match expected values
- No orphaned genre references
- Genre distribution reasonable

---

## Type Checking

### TypeScript as First Line of Defense

**Compile-time validation prevents:**
- Missing required fields
- Incorrect prop types
- Invalid function signatures
- Typos in object keys

```bash
# Run type checking
npm run build

# TypeScript compiler (tsc) runs automatically
```

**Example type safety:**

```typescript
// types/concert.ts
export interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  venue: string
  venueNormalized: string
  city: string
  state: string
  cityState: string
  location: {
    lat: number
    lng: number
  }
  openers: string[]
  genre: string
  year: number
}

// Type error caught at compile time
const concert: Concert = {
  id: '2024-01-01-foo',
  date: '2024-01-01',
  // Missing required fields → TypeScript error!
}
```

**Benefits:**
- Catches errors before runtime
- Self-documenting code
- IDE autocomplete and IntelliSense
- Refactoring safety

---

## Manual Testing Workflows

### 1. Pre-Release Testing Checklist

**Data Pipeline:**
```
□ Run npm run build-data
□ Check console for warnings
□ Verify no duplicate IDs
□ Validate new concert data appears
□ Check venue/artist normalization
```

**Build Process:**
```
□ Run npm run build
□ Check for TypeScript errors
□ Check for build warnings
□ Verify dist/ output size reasonable
□ Check bundle analyzer if size concerns
```

**Version Validation:**
```
□ Run npm run validate:version
□ Ensure git tag matches changelog
□ Verify package.json version correct
□ Check changelog entry complete
```

### 2. Feature Testing Workflow

**When adding new features:**

```
1. Implement feature
2. Test in development (npm run dev)
3. Check all 5 scenes manually
4. Test deep linking scenarios
5. Test on mobile viewport (DevTools)
6. Test keyboard navigation
7. Test screen reader (VoiceOver/NVDA)
8. Build production (npm run build)
9. Test production build (npm run preview)
10. Deploy to staging if available
```

### 3. Scene-Specific Testing

**Scene 1: Timeline**
- [ ] Timeline renders all concerts
- [ ] Year labels visible
- [ ] Hover preview shows artist info
- [ ] Click navigates to artist scene
- [ ] Scroll performance smooth
- [ ] Mobile: touch interactions work

**Scene 2: Venues**
- [ ] Top 10 mode shows 10 venues
- [ ] All Venues mode shows all venues
- [ ] Click expands venue (all mode)
- [ ] Artists visible on expansion
- [ ] Deep link works (`?scene=venues&venue=...`)
- [ ] Reset button clears focus
- [ ] Mobile: touch targets adequate (44px min)

**Scene 3: Map**
- [ ] Map loads all venue markers
- [ ] Clusters work on zoom out
- [ ] Click marker opens popup
- [ ] Popup shows venue photo
- [ ] "Explore Venue" navigates to Scene 2
- [ ] Deep link flies to venue (`?scene=geography&venue=...`)
- [ ] Mobile: pinch-zoom works

**Scene 4: Genres**
- [ ] Treemap renders all genres
- [ ] Timeline slider animates years
- [ ] Click genre expands to artists
- [ ] Artist tiles show names
- [ ] Click artist navigates to Scene 5
- [ ] Mobile: touch and hold works

**Scene 5: Artists**
- [ ] Mosaic grid renders all artists
- [ ] Lazy loading batches cards (100 initial)
- [ ] Sort A-Z works
- [ ] Sort Most Seen works
- [ ] Search typeahead works
- [ ] Click card opens gatefold
- [ ] Gatefold shows all panels (photo, concerts, setlists, tour)
- [ ] Deep link opens artist (`?scene=artists&artist=...`)
- [ ] ESC closes gatefold
- [ ] Mobile: full-screen modal works

### 4. Cross-Scene Navigation Testing

**Test all navigation paths:**

```
Timeline → Artist (click name)
Map → Venues (click "Explore Venue")
Genres → Artists (click artist tile)
Artist gatefold → Venues (click venue name)
```

**Deep linking:**
```
?scene=artists&artist=depeche-mode
?scene=venues&venue=9-30-club
?scene=venues&venue=9-30-club&artist=depeche-mode
?scene=geography&venue=hollywood-palladium
```

### 5. Responsive Testing

**Viewports to test:**
- Desktop: 1920x1080 (typical)
- Laptop: 1440x900
- Tablet: 768x1024
- Mobile: 375x667 (iPhone SE)
- Mobile: 390x844 (iPhone 12+)

**Mobile-specific checks:**
- [ ] Touch targets minimum 44x44px
- [ ] No horizontal scroll
- [ ] Gatefold becomes full-screen modal
- [ ] Scene navigation dots visible
- [ ] Performance acceptable (no janky scroll)

---

## API Integration Testing

### 1. Development Testing

**Ticketmaster API:**
```bash
# Test artist search
# services/ticketmaster.ts → searchArtist()

# Expected behaviors:
✅ API key configured → returns tour dates
❌ Missing API key → logs warning, returns null
❌ Artist not found → returns null
❌ Rate limit → returns cached dates
```

**setlist.fm API:**
```bash
# Test setlist fetch
# services/setlistfm.ts → getSetlists()

# Expected behaviors:
✅ Static cache hit → returns cached setlists
✅ API call → returns live data
❌ API error → returns empty array (graceful)
```

### 2. API Testing Scripts

```bash
# Test Ticketmaster connectivity
npm run test-ticketmaster  # (custom script)

# Test setlist.fm connectivity
npm run test-setlistfm     # scripts/test-setlistfm.ts

# Test Google Places (build-time only)
npm run test-places-api    # scripts/test-places-api.ts
```

---

## Visual Regression Testing (Future)

### Planned: Automated Screenshot Comparison

```bash
# Install Puppeteer for E2E tests
npm install --save-dev puppeteer

# Script: test/visual-regression.ts
```

**Approach:**
1. Launch headless browser
2. Navigate to each scene
3. Take screenshots
4. Compare against baseline images
5. Flag differences > threshold

**Example:**

```typescript
// test/visual-regression.ts
import puppeteer from 'puppeteer'

const scenes = [
  { name: 'timeline', url: '/?scene=timeline' },
  { name: 'venues', url: '/?scene=venues' },
  { name: 'map', url: '/?scene=geography' },
  { name: 'genres', url: '/?scene=genres' },
  { name: 'artists', url: '/?scene=artists' }
]

async function captureScenes() {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  for (const scene of scenes) {
    await page.goto(`http://localhost:5173${scene.url}`)
    await page.waitForSelector('.snap-y')
    await page.screenshot({ path: `test/screenshots/${scene.name}.png` })
  }

  await browser.close()
}
```

**Benefits:**
- Catch unintended visual changes
- Automated CI/CD integration
- Cross-browser testing

**Challenges:**
- Animation timing
- Data-driven visualizations (D3 randomness)
- External images (artist photos)

---

## Performance Testing

### 1. Lighthouse Audits

```bash
# Run Lighthouse in Chrome DevTools
# Analyze: Performance, Accessibility, Best Practices, SEO

# Target scores:
Performance: 90+
Accessibility: 95+
Best Practices: 95+
SEO: 100
```

**Key metrics:**
- First Contentful Paint (FCP) < 1.8s
- Largest Contentful Paint (LCP) < 2.5s
- Time to Interactive (TTI) < 3.8s
- Cumulative Layout Shift (CLS) < 0.1

### 2. Bundle Size Monitoring

```bash
# Check production bundle size
npm run build

# Analyze output
du -sh dist/

# Expected sizes:
dist/index.html: ~5KB
dist/assets/*.js: ~500KB (gzipped: ~150KB)
dist/assets/*.css: ~50KB (gzipped: ~10KB)
```

### 3. Network Performance

**Manual testing:**
- Throttle network to "Fast 3G" in DevTools
- Verify loading states appear
- Confirm data loads within 5 seconds
- Check image lazy loading works

---

## Accessibility Testing

### 1. Keyboard Navigation

**Manual tests:**
```
Tab           → Moves focus to interactive elements
Shift+Tab     → Moves focus backward
Enter/Space   → Activates buttons/links
ESC           → Closes modals/gatefolds
Arrow keys    → Timeline slider navigation
```

**Focus indicators:**
- [ ] All interactive elements have visible focus
- [ ] Focus order logical (top to bottom, left to right)
- [ ] No focus traps

### 2. Screen Reader Testing

**Tools:**
- macOS: VoiceOver (Cmd+F5)
- Windows: NVDA (free)
- Browser: ChromeVox extension

**Test scenarios:**
- [ ] Scene headings announced
- [ ] Artist names announced in mosaic
- [ ] Venue names announced in graph
- [ ] Image alt text descriptive
- [ ] Button purposes clear
- [ ] Links clearly labeled

### 3. Color Contrast

```bash
# Use browser DevTools:
# Inspect element → Accessibility pane → Color contrast

# WCAG AA standards:
Normal text: 4.5:1
Large text (18pt+): 3:1
UI components: 3:1
```

---

## Error Scenario Testing

### 1. API Failures

**Simulate failures:**
```javascript
// In DevTools console
localStorage.setItem('mock-api-failure', 'true')
location.reload()
```

**Expected behaviors:**
- [ ] Tour dates unavailable → "No upcoming dates" message
- [ ] Setlists unavailable → Empty panel (no error)
- [ ] Analytics fails → Silent failure, logged to console

### 2. Missing Data

**Test scenarios:**
- Missing artist image → Placeholder shown
- Missing venue photo → Placeholder shown
- Empty openers array → No opener section
- Invalid deep link → Default scene shown
- Missing localStorage → Changelog shows

### 3. Network Conditions

**Test offline:**
```
DevTools → Network → Offline
```

**Expected:**
- [ ] Static assets load from cache
- [ ] External APIs gracefully fail
- [ ] User sees informative message

---

## Release Testing Workflow

### Pre-Release Checklist

**1. Data Validation**
```bash
npm run validate-data          # Concert data integrity
npm run validate:version       # Version consistency
npm run validate-normalization # Name normalization
```

**2. Build & Preview**
```bash
npm run build                  # Production build
npm run preview                # Test production build locally
```

**3. Manual QA**
- [ ] Test all 5 scenes
- [ ] Test deep linking
- [ ] Test mobile viewport
- [ ] Test keyboard navigation
- [ ] Test error scenarios

**4. Version Checks**
- [ ] Git tag created: `git tag v3.4.1`
- [ ] Changelog updated
- [ ] Package.json version bumped
- [ ] Version validation passes

**5. Deploy**
```bash
# Deploy to production (CDN/hosting)
npm run build
# ... copy dist/ to hosting
```

**6. Post-Deploy Smoke Test**
- [ ] Navigate to live URL
- [ ] Verify data loads
- [ ] Check changelog version matches
- [ ] Test one deep link
- [ ] Check analytics tracking (DevTools)

---

## Future Testing Enhancements

### 1. CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run validate-data
      - run: npm run validate:version
      - run: npm run build
```

### 2. Unit Tests (Vitest)

```typescript
// src/utils/normalize.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeArtistName } from './normalize'

describe('normalizeArtistName', () => {
  it('converts to lowercase', () => {
    expect(normalizeArtistName('Depeche Mode')).toBe('depeche-mode')
  })

  it('replaces spaces with hyphens', () => {
    expect(normalizeArtistName('Social Distortion')).toBe('social-distortion')
  })

  it('removes special characters', () => {
    expect(normalizeArtistName('AC/DC')).toBe('ac-dc')
  })

  it('removes consecutive hyphens', () => {
    expect(normalizeArtistName('Foo--Bar')).toBe('foo-bar')
  })
})
```

### 3. Integration Tests (Playwright)

```typescript
// tests/e2e/navigation.spec.ts
import { test, expect } from '@playwright/test'

test('navigate between scenes', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Start on Scene 1
  await expect(page.locator('h2')).toContainText('Concert Timeline')

  // Navigate to Artists
  await page.click('[aria-label="Go to Artists"]')
  await expect(page.locator('h2')).toContainText('The Artists')
})

test('deep link to artist', async ({ page }) => {
  await page.goto('http://localhost:5173/?scene=artists&artist=depeche-mode')

  // Gatefold should open
  await expect(page.locator('[data-gatefold]')).toBeVisible()
  await expect(page.locator('h3')).toContainText('Depeche Mode')
})
```

---

## Related Documentation

- [Error Handling & Logging Skill](./../error-handling-logging/SKILL.md) - Error patterns
- [Data Schema Skill](./../data-schema/SKILL.md) - Data structures
- [Performance Optimization Skill](./../performance-optimization/SKILL.md) - Performance patterns

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Puppeteer Documentation](https://pptr.dev/)
