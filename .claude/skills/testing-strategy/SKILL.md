# Testing Strategy Skill

**Version:** 2.0.0
**Last Updated:** 2026-08-12

---

## Overview

Three layers run automatically, each covering what the one below it cannot.

| Layer | What runs it | What it catches |
|-------|--------------|-----------------|
| Build-time validation | `validate:data`, `validate:version`, `validate:docs` | bad data, version drift, prose that disagrees with the archive |
| Type checking | `npm run typecheck:all` | type errors across **both** tsconfigs |
| Unit tests | `npm run test:run` — 925 tests, 54 files | logic in the pipeline, utils and liner-notes detectors |
| Scene tests | `npm run test:scenes:puppeteer` — six scenes in a real browser | render crashes and broken interactions |

**Always `typecheck:all`, never plain `typecheck`.** `tsconfig.json` is scoped to
`src`, so the plain command covers none of the pipeline, the scripts or the tests.

**`npm ci` does not work here.** `package-lock.json` is gitignored by design
(`.gitignore:3`), so every workflow uses `npm install`. This also rules out
`setup-node`'s `cache: npm`, which keys off the lock file.

---

## Testing Philosophy

### Each layer exists because the one below it let something through

This is not a philosophical preference — it is a record of what has actually
escaped.

- **v6.0.0 shipped a `useMemo` below an early return.** It passed `typecheck:all`
  and all 925 unit tests, then crashed on render. Neither suite mounts a component
  in a browser, so neither could have caught it. That is why the scene tests exist
  (#10), and the smoke test was verified against exactly that crash shape in two
  different scenes.
- **#283: stale prose shipped for ~7 months and ~40 releases.** Nothing checked
  that the README described the archive that exists. That is why `validate:docs`
  exists (#284).
- **#246: a referenced-but-undeclared variable passed CI** because the app
  typecheck does not see `scripts/`. That is why `typecheck:scripts` exists.

**The general lesson worth carrying:** a test that cannot fail is worse than no
test, because it reports success. #309 deleted two rate-limit tests that asserted
nothing. #10 found 24 scene assertions that logged `⚠ may not be implemented` and
returned a pass — three of them had been hiding real breakage for months, including
a slider test that looked for an `input[type="range"]` the component never had.
When something cannot be checked, fail or delete it; do not log a warning and pass.

### What is still not automated

- **`/release` runs no tests.** Step 1 is `npm run build` — `tsc` plus a bundle.
  Release commits are pushed straight to `main`, so they never pass through the PR
  gate where the tests actually run. #13 closes this by routing releases through a
  pull request.
- **The artist gatefold has no coverage** — the flying tile and 3D book-open
  animation are untested by choice, being the flakiest thing in the app.
- **There is no visual regression testing.** Despite the name "visual testing
  suite", nothing compares images. Screenshots were removed in #310 because there
  was no baseline and no comparator. Real visual regression would be new work.

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
- After updating changelog or package.json

Note that `validate:version` is *not* in `ci.yml` — on a PR the branch has no tag
yet, so it would fail by construction. `validate:docs` is, and does run on every PR.

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

## Scene Tests (Puppeteer)

Six scenes, rendered in a real browser. `test-smoke.mjs` is the CI gate; the
per-scene files cover interactions.

```bash
# Build, serve the build, run every scene test, tear the server down.
# Exactly what Scene CI runs — no CI-only steps.
npm run test:scenes:puppeteer

# Fast loop against a dev server you already have. Also how you avoid port 5173
# when another worktree already owns it.
npm run dev
TEST_BASE_URL=http://localhost:5173 npm run test:scenes:puppeteer
```

**Why one page load covers all six scenes:** the archive is a single scroll-snap
page. Every scene is mounted at all times and `?scene=` only scrolls to one, and
there is no error boundary between them — React unmounts the whole tree on a render
throw. So asserting that all six roots are present and laid out is a real statement
about all six.

**Writing assertions that hold up:**

- Assert on behaviour, not styling. The old sort tests checked for a
  `bg-indigo-500` class; the component moved to `bg-violet-600` and nothing
  noticed. They now assert the mosaic actually reorders.
- Assert on shape, not exact data. The timeline stats test matches
  `<n> shows across <year>–<year>` rather than `184`, so it survives a data
  refresh but still fails if the derivation produces `0`, `NaN` or nothing.
- Take fixtures from the DOM, not from memory. The deep-link test used to
  hard-code year 2020, which has no concerts, so the dot it looked for could never
  exist. It now reads a year off the rendered timeline.
- If an element has no stable hook, add a `data-testid` rather than reaching for a
  Tailwind class.

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

## CI workflows

All of these already exist. Each is path-filtered so it only runs when its own
area changes.

| Workflow | Fires on | Runs |
|----------|----------|------|
| `ci.yml` | every push to `main`, every PR | `typecheck`, `typecheck:scripts`, `test:run`, `validate:docs`, build |
| `scene-ci.yml` | `src/`, `public/data/`, `test/scenes/`, build config | builds, serves the build, renders all six scenes |
| `mcp-ci.yml` | `workers/mcp-server/` | that Worker's own typecheck + tests, then deploys |
| `ask-chat-ci.yml` | `workers/ask-chat/` | as above |
| `meta-injector-ci.yml` | `workers/meta-injector/` | as above |
| `dashboard-refresh-ci.yml` | `workers/dashboard-refresh/` | as above |

The Workers are deliberately excluded from the root suite: they are separate npm
packages with their own vitest configs, and the root config cannot parse their
`.md` imports. Adding a fifth Worker means giving it a workflow, not folding it in.

**A green CI run is not a green release.** `/release` pushes straight to `main`,
so `ci.yml` fires *after* the commit is tagged and the deploy has started — a
post-hoc alarm, not a gate. #13 is the fix.

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
