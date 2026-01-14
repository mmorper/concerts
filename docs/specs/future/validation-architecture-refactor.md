# Validation Architecture Refactor

**Status:** Planned
**Target Version:** v3.5.1 (or later)
**Priority:** Low
**Estimated Complexity:** Low
**Dependencies:** None (cleanup/refactoring task)

---

## Executive Summary

Refactor validation logic to follow single-responsibility principle by separating concert and discography validation into dedicated files, with a new orchestrator script to run all validations.

**Problem this solves:**
- `validate-concerts.ts` currently validates both concerts AND discography data, violating its implied scope
- Cannot run discography validation independently
- Harder to maintain and extend validation logic
- Inconsistent with the namespaced enrichment pattern (`enrich:discography`)

**How it enhances maintainability:**
- Clear separation of concerns (each validator validates one entity type)
- Can run targeted validations independently
- Easier to add new entity validators in the future
- Follows established pattern: `enrich:X` → `validate:X`

**How it fits into the product:**
This is a non-breaking refactor that improves code organization without changing functionality.

---

## Current Architecture (v3.5.0)

```
scripts/
├── validate-concerts.ts       # Validates concerts + discography (mixed concerns)
└── validate-artist-genres.ts  # Validates artist genre assignments

npm scripts:
├── validate-data              # Runs validate-concerts.ts
└── validate:artist-genres     # Runs validate-artist-genres.ts
```

**Problems:**
1. `validate-concerts.ts` name implies it only validates concerts, but it also validates discography
2. No way to run `npm run validate:discography` independently
3. Future validators (setlists, venues) would compound this issue

---

## Proposed Architecture (v3.5.1+)

```
scripts/
├── validate-concerts.ts         # Only validates concert data
├── validate-discography.ts      # Only validates discography data
├── validate-artist-genres.ts    # Only validates artist genres (already exists)
└── validate-all.ts              # Orchestrator that runs all validators

npm scripts:
├── validate-data                # Runs validate-all.ts (orchestrator)
├── validate:concerts            # Runs validate-concerts.ts
├── validate:discography         # Runs validate-discography.ts
└── validate:artist-genres       # Runs validate-artist-genres.ts (already exists)
```

**Benefits:**
- Each validator has a single responsibility
- Can run targeted validations: `npm run validate:discography`
- Follows namespaced pattern like `enrich:discography`
- Easy to add future validators: `validate:setlists`, `validate:venues`
- Clear ownership of validation logic

---

## Implementation Plan

### Phase 1: Extract Discography Validation

**Create:** `scripts/validate-discography.ts`

Move lines 173-258 from `validate-concerts.ts` into new file:

```typescript
/**
 * Validate discography data quality
 *
 * Checks:
 * 1. Every non-mock artist has discography entry
 * 2. No duplicate albums within artist
 * 3. Warn if artist has MBID but 0 albums
 * 4. Warn if discography is stale (>90 days)
 */
export async function validateDiscography() {
  console.log('🎵 Validating discography data...\n')

  const discographyPath = join(process.cwd(), 'public', 'data', 'discography.json')
  // ... (move existing validation logic)

  return { errors, warnings }
}
```

**Remove:** Lines 173-258 from `validate-concerts.ts`

---

### Phase 2: Create Orchestrator

**Create:** `scripts/validate-all.ts`

```typescript
/**
 * Orchestrator that runs all data validation checks
 *
 * Usage:
 *   npm run validate-data              # Run all validations
 *   npm run validate-data -- --strict  # Exit on warnings
 */
import { validateConcerts } from './validate-concerts.ts'
import { validateDiscography } from './validate-discography.ts'
import { validateArtistGenres } from './validate-artist-genres.ts'

async function validateAll() {
  console.log('🔍 Running all data validations...\n')
  console.log('=' .repeat(60))

  const results = {
    concerts: await validateConcerts(),
    discography: await validateDiscography(),
    artistGenres: await validateArtistGenres()
  }

  // Aggregate results
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0)
  const totalWarnings = Object.values(results).reduce((sum, r) => sum + r.warnings.length, 0)

  console.log('=' .repeat(60))
  console.log('OVERALL SUMMARY')
  console.log('=' .repeat(60))
  console.log(`Total errors: ${totalErrors}`)
  console.log(`Total warnings: ${totalWarnings}`)
  console.log()

  if (totalErrors > 0) {
    console.log('❌ Validation failed. Please fix errors before deploying.')
    process.exit(1)
  } else if (totalWarnings > 0) {
    console.log('✅ Validation passed with warnings.')
    console.log('   Review warnings above and update data if needed.')
  } else {
    console.log('✅ All validations passed!')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateAll()
}

export { validateAll }
```

---

### Phase 3: Update npm Scripts

**Modify:** `package.json`

```json
{
  "scripts": {
    "validate-data": "tsx scripts/validate-all.ts",
    "validate:concerts": "tsx scripts/validate-concerts.ts",
    "validate:discography": "tsx scripts/validate-discography.ts",
    "validate:artist-genres": "tsx scripts/validate-artist-genres.ts"
  }
}
```

---

### Phase 4: Update validate-concerts.ts

**Modify:** `scripts/validate-concerts.ts`

1. Remove discography validation logic (lines 173-258)
2. Update function signature to return results:

```typescript
export async function validateConcerts() {
  // ... existing concert validation logic

  return { errors, warnings }
}
```

3. Update CLI output (if called directly) to remain unchanged for backwards compatibility

---

### Phase 5: Update Documentation

**Modify:** `docs/DATA_PIPELINE.md`

Update validation section to reflect new architecture:

```markdown
### Validation

The project uses modular validation scripts:

| Script | Purpose | Command |
|--------|---------|---------|
| `validate-all.ts` | Run all validations | `npm run validate-data` |
| `validate-concerts.ts` | Concert data quality | `npm run validate:concerts` |
| `validate-discography.ts` | Discography completeness | `npm run validate:discography` |
| `validate-artist-genres.ts` | Artist genre assignments | `npm run validate:artist-genres` |

**Usage:**
```bash
npm run validate-data              # Run all validators
npm run validate:discography       # Run discography checks only
```
```

---

## Testing Strategy

**Verify each validator works independently:**
```bash
npm run validate:concerts       # Should pass/fail based on concert data
npm run validate:discography    # Should pass with warnings (missing artists)
npm run validate:artist-genres  # Should validate genre assignments
```

**Verify orchestrator aggregates correctly:**
```bash
npm run validate-data           # Should run all three and aggregate results
```

**Backwards compatibility:**
- `npm run validate-data` behavior unchanged (runs all validations)
- Exit codes unchanged (1 on error, 0 on warnings or success)
- Output format similar (errors/warnings grouped by validator)

---

## Files to Create

- `scripts/validate-discography.ts` (~80 LOC)
- `scripts/validate-all.ts` (~60 LOC)

## Files to Modify

- `scripts/validate-concerts.ts` (remove lines 173-258, update return type)
- `package.json` (add 3 new scripts)
- `docs/DATA_PIPELINE.md` (update validation section)

---

## Breaking Changes

**None.** This is a non-breaking refactor:
- `npm run validate-data` continues to work as before
- Validation logic is unchanged, only relocated
- New commands are additive (`validate:concerts`, `validate:discography`)

---

## Future Enhancements

Once this architecture is in place, adding new validators is straightforward:

```typescript
// scripts/validate-setlists.ts
export async function validateSetlists() {
  // Validate setlists-cache.json
  return { errors, warnings }
}

// Add to validate-all.ts orchestrator
import { validateSetlists } from './validate-setlists.ts'
```

**Potential future validators:**
- `validate:venues` - Venue metadata completeness
- `validate:setlists` - Setlist cache freshness
- `validate:normalization` - Already exists, could be integrated
- `validate:spotify` - Spotify metadata quality

---

## Acceptance Criteria

- [ ] `npm run validate:concerts` runs only concert validation
- [ ] `npm run validate:discography` runs only discography validation
- [ ] `npm run validate-data` runs all validators and aggregates results
- [ ] All tests pass with same results as before refactor
- [ ] Exit codes unchanged (1 on error, 0 otherwise)
- [ ] Documentation updated
- [ ] No breaking changes to existing workflows

---

## Estimated Effort

- Implementation: 30-45 minutes
- Testing: 15 minutes
- Documentation: 15 minutes
- **Total: ~1 hour**

---

## Notes

This refactor was deferred during v3.5.0 implementation to ship the discography feature faster. The current mixed-concern validation works correctly, but this refactor improves long-term maintainability.

**Context from implementation:**
- Discography validation was initially added to `validate-concerts.ts` following existing pattern
- Decision made to defer architectural cleanup and ship feature first
- No functional issues with current approach, purely architectural improvement

---

## Revision History

- **2026-01-14:** Initial specification created v1.0.0
- **Version:** 1.0.0
- **Author:** Claude (Sonnet 4.5) + User collaboration
- **Status:** Planned → Ready for implementation
