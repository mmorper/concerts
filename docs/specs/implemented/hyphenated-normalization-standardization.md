# Hyphenated Normalization Standardization

> **Role**: Architecture specification for standardizing all metadata normalization
> **Status**: ✅ **IMPLEMENTED** (v1.9.0)
> **Priority**: Medium-High
> **Complexity**: Medium
> **Type**: Breaking Change - Data Architecture
> **Dependencies**: None
> **Implemented**: 2026-01-05
> **Last Updated**: 2026-01-05

---

## Executive Summary

Standardize ALL metadata normalization functions (artists, venues, genres) to use hyphens consistently, eliminating the current inconsistency where artists use hyphens (`depeche-mode`) but venues don't (`irvinemeadows`). This improves code maintainability, URL readability, and developer experience by enforcing a single normalization pattern across all entity types.

**Key Benefits:**

- **Consistency** - Same normalization rules for all entities (artists, venues, genres)
- **Readability** - `irvine-meadows` is more readable than `irvinemeadows`
- **URL-friendly** - Hyphens are standard for URL slugs and deep links
- **Maintainability** - One normalization pattern to remember and test
- **Predictability** - Developers can infer normalized names without checking code

**Breaking Changes:**

- Venue metadata keys change: `irvinemeadows` → `irvine-meadows`
- Deep link URLs change: `?venue=irvinemeadows` → `?venue=irvine-meadows`
- All venue references must use new hyphenated format

---

## Problem Statement

### Current Inconsistency

**Artists use hyphens:**

```typescript
normalizeArtistName("Depeche Mode") // => "depeche-mode"
normalizeArtistName("Violent Femmes") // => "violent-femmes"
```

**Venues don't use hyphens:**

```typescript
normalizeVenueName("Irvine Meadows") // => "irvinemeadows"
normalizeVenueName("9:30 Club") // => "930club"
```

**Genres have no normalization:**

```typescript
// No function exists - genres not normalized
```

### Impact of Inconsistency

1. **Developer confusion:**
   - Must remember two different patterns
   - Easy to use wrong normalization for URL parameters
   - Code review requires verifying correct pattern used

2. **URL inconsistency:**
   - `?artist=depeche-mode` (with hyphens)
   - `?venue=irvinemeadows` (no hyphens)
   - Why the difference? Not intuitive

3. **Readability:**
   - `irvinemeadows` - Hard to parse word boundaries
   - `irvine-meadows` - Clear, readable, standard format

4. **Maintenance burden:**
   - Two normalization functions to maintain
   - Duplicate logic in some scripts (prefetch-setlists.ts has custom normalization)
   - Higher chance of bugs from using wrong pattern

### Historical Context

The inconsistency arose organically:

- Artists were normalized first with hyphens (intuitive for names)
- Venues were normalized later without hyphens (possibly for uniqueness)
- No technical reason for the difference
- v1.4.0 established `src/utils/normalize.ts` as single source of truth but didn't fix inconsistency

---

## Design Philosophy

### Core Principles

1. **Single Source of Truth**
   - One normalization pattern for all entities
   - Shared utility function implementation
   - Easy to test, easy to understand

2. **URL-Friendly**
   - Follow web standards (hyphens in slugs)
   - SEO-friendly format
   - Human-readable URLs

3. **Reversibility**
   - Can reconstruct original spacing from hyphens
   - `irvine-meadows` → "Irvine Meadows" (straightforward)
   - `irvinemeadows` → "Irvine Meadows" (ambiguous)

4. **Future-Proof**
   - Extensible to new entity types (genres, cities, states)
   - Same pattern works for all metadata lookups
   - No special cases

---

## Proposed Solution

### Normalization Standard

**Single pattern for all entity types:**

```typescript
function normalize(name: string): string {
  return name
    .toLowerCase()                    // Case-insensitive
    .replace(/[^a-z0-9]/g, '-')      // Replace all special chars with hyphens
    .replace(/-+/g, '-')              // Collapse multiple hyphens
    .replace(/^-|-$/g, '')            // Trim leading/trailing hyphens
}
```

**Examples:**

| Entity Type | Input | Output |
|-------------|-------|--------|
| Artist | "Depeche Mode" | `depeche-mode` |
| Artist | "Violent Femmes" | `violent-femmes` |
| Venue | "Irvine Meadows" | `irvine-meadows` ✨ NEW |
| Venue | "9:30 Club" | `9-30-club` ✨ NEW |
| Venue | "The Coach House" | `the-coach-house` ✨ NEW |
| Genre | "Alternative Rock" | `alternative-rock` ✨ NEW |
| Genre | "New Wave/Synth-pop" | `new-wave-synth-pop` ✨ NEW |

### Implementation Files

**Core normalization (`src/utils/normalize.ts`):**

```typescript
/**
 * Normalize artist name for metadata key lookups
 *
 * Rules:
 * - Convert to lowercase
 * - Replace all non-alphanumeric characters with hyphens
 * - Collapse multiple hyphens into one
 * - Remove leading/trailing hyphens
 *
 * @example
 * normalizeArtistName("Depeche Mode") // => "depeche-mode"
 * normalizeArtistName("A-ha") // => "a-ha"
 *
 * @param name - The artist name to normalize
 * @returns Normalized artist name
 */
export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Normalize venue name for metadata key lookups
 *
 * ✨ UPDATED in v1.9.0 to use hyphens (was: remove all special chars)
 *
 * Rules:
 * - Convert to lowercase
 * - Replace all non-alphanumeric characters with hyphens
 * - Collapse multiple hyphens into one
 * - Remove leading/trailing hyphens
 *
 * @example
 * normalizeVenueName("Irvine Meadows") // => "irvine-meadows"
 * normalizeVenueName("9:30 Club") // => "9-30-club"
 *
 * @param name - The venue name to normalize
 * @returns Normalized venue name
 */
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')   // ✨ CHANGED: Use hyphens (was: '')
    .replace(/-+/g, '-')           // ✨ NEW: Collapse hyphens
    .replace(/^-|-$/g, '')         // ✨ NEW: Trim hyphens
}

/**
 * Normalize genre name for metadata key lookups
 *
 * ✨ NEW in v1.9.0
 *
 * Rules:
 * - Convert to lowercase
 * - Replace all non-alphanumeric characters with hyphens
 * - Collapse multiple hyphens into one
 * - Remove leading/trailing hyphens
 *
 * @example
 * normalizeGenreName("Alternative Rock") // => "alternative-rock"
 * normalizeGenreName("New Wave/Synth-pop") // => "new-wave-synth-pop"
 *
 * @param name - The genre name to normalize
 * @returns Normalized genre name
 */
export function normalizeGenreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
```

---

## Data Model Changes

### concerts.json Schema Update

**Add pre-computed normalized fields:**

```typescript
interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string      // ✅ Existing (v1.3.0)
  venue: string
  venueNormalized: string          // ✨ NEW (v1.9.0)
  genre: string
  genreNormalized: string          // ✨ NEW (v1.9.0)
  openers: string[]
  city: string
  state: string
  // ... rest unchanged
}
```

**Why pre-compute?**

- **Performance** - No runtime normalization needed
- **Consistency** - Guaranteed to match metadata keys
- **Debugging** - Can inspect normalized values directly
- **Caching** - Enables efficient API responses

### Metadata File Key Changes

**Before (v1.8.x):**

```json
{
  "irvinemeadows": {
    "name": "Irvine Meadows",
    "normalizedName": "irvinemeadows",
    "city": "Irvine",
    "concerts": [...]
  },
  "930club": {
    "name": "9:30 Club",
    "normalizedName": "930club",
    "city": "Washington",
    "concerts": [...]
  }
}
```

**After (v1.9.0):**

```json
{
  "irvine-meadows": {
    "name": "Irvine Meadows",
    "normalizedName": "irvine-meadows",
    "city": "Irvine",
    "concerts": [...]
  },
  "9-30-club": {
    "name": "9:30 Club",
    "normalizedName": "9-30-club",
    "city": "Washington",
    "concerts": [...]
  }
}
```

---

## Implementation Plan

### Phase 1: Core Normalization Functions

**Files to modify:**

- `src/utils/normalize.ts`
- `src/utils/normalizeVenueName.ts` (DELETE - duplicate)

**Changes:**

1. Update `normalizeVenueName()` to use hyphens (lines 52-57)
2. Add `normalizeGenreName()` function
3. Delete duplicate file `src/utils/normalizeVenueName.ts`
4. Add comprehensive JSDoc comments with examples

**Estimated effort:** 30 minutes

---

### Phase 2: Data Model Updates

**Files to modify:**

- `src/types/concert.ts`
- `scripts/fetch-google-sheet.ts`

**Changes:**

1. Add `venueNormalized` and `genreNormalized` to Concert interface
2. Update `fetch-google-sheet.ts` to generate normalized fields
3. Import `normalizeVenueName` and `normalizeGenreName`

**Estimated effort:** 30 minutes

---

### Phase 3: Script Updates

**Files to modify:**

- `scripts/prefetch-setlists.ts`
- `scripts/validate-normalization.ts`

**Changes:**

1. **prefetch-setlists.ts:**
   - Delete custom `normalizeVenueName()` function (lines 168-174)
   - Import from shared utility instead

2. **validate-normalization.ts:**
   - Add `validateGenreNormalization()` function
   - Update main() to call genre validation

**Note:** `scripts/enrich-venues.ts` requires no changes (already uses shared utility)

**Estimated effort:** 1 hour

---

### Phase 4: Data Regeneration

**Execution order (critical):**

```bash
# 1. Regenerate concerts.json (adds new normalized fields)
npm run fetch-sheet

# 2. Regenerate venue metadata (keys change to hyphenated format)
npm run enrich-venues

# 3. Re-run artist enrichment (refresh, keys already hyphenated)
npm run enrich

# 4. Regenerate setlists cache (uses new venue normalization)
npm run prefetch:setlists

# 5. Validate everything
npm run validate-normalization
npm run validate-data
```

**Expected outcomes:**

- concerts.json: All records have `venueNormalized` and `genreNormalized`
- venues-metadata.json: Keys change from `irvinemeadows` to `irvine-meadows`
- artists-metadata.json: No change (already hyphenated)
- setlists-cache.json: No structural change (keyed by concert ID)

**Estimated effort:** 1 hour (mostly API wait time)

---

### Phase 5: Frontend Verification

**Files to verify (no changes needed):**

- `src/components/scenes/Scene3Map.tsx` - Already uses `normalizeVenueName()` correctly
- `src/components/scenes/Scene4Bands.tsx` - Uses display names, not normalized
- `src/components/TimelineHoverPreview/useArtistMetadata.ts` - Already correct

**Manual testing checklist:**

```bash
npm run dev

# Browser testing:
✅ Scene 1 (Timeline): Renders correctly
✅ Scene 2 (Venues): Force graph renders, deep link works
✅ Scene 3 (Map): Venue markers work, deep link works
✅ Scene 4 (Genres): Sunburst renders correctly
✅ Scene 5 (Artists): Gatefold works, deep link works

# Deep link testing:
✅ /?scene=venues&venue=irvine-meadows
✅ /?scene=geography&venue=9-30-club
✅ /?scene=artists&artist=depeche-mode (unchanged)
```

**Estimated effort:** 1 hour

---

### Phase 6: Documentation Updates

**Files to modify:**

- `docs/DEEP_LINKING.md`

**Changes:**

1. Update normalization examples table
2. Update implementation code samples
3. Update all deep link examples to use hyphens
4. Add migration guide section

**Estimated effort:** 30 minutes

---

### Phase 7: Version Bump & Release

**Tasks:**

1. Version bump: `npm version minor` (1.8.x → 1.9.0)
2. Create release notes highlighting breaking changes
3. Commit: `feat!: Standardize all normalization to use hyphens`
4. Tag: `v1.9.0`
5. Push: `git push origin main --tags`

**Estimated effort:** 30 minutes

---

## Migration Guide

### For End Users

**Deep links will break** - Update bookmarked URLs:

**Before (v1.8.x):**

```
https://concerts.morperhaus.org/?scene=venues&venue=irvinemeadows
https://concerts.morperhaus.org/?scene=geography&venue=930club
```

**After (v1.9.0):**

```
https://concerts.morperhaus.org/?scene=venues&venue=irvine-meadows
https://concerts.morperhaus.org/?scene=geography&venue=9-30-club
```

### For Developers

**If consuming the data API:**

1. Update venue metadata lookups to use hyphenated keys
2. Update any custom normalization functions to match new pattern
3. Regenerate any cached data that uses venue keys
4. Test all deep link integrations

**Migration script not provided** - Clean break, one-time update

---

## Cache Impact & Data Pipeline Guarantees

### Will `npm run build-data` work after this change?

**Answer: YES** - with ZERO manual intervention needed.

### Why This Works Seamlessly

**The data pipeline is self-healing:**

1. **fetch-google-sheet.ts**
   - Reads from Google Sheets (external source)
   - Generates concerts.json with NEW fields
   - Uses updated normalization functions
   - ✅ No cache dependency

2. **enrich-artists.ts**
   - Artist keys ALREADY use hyphens
   - ✅ No breaking change, cache remains valid

3. **enrich-venues.ts**
   - Regenerates venue metadata with NEW hyphenated keys
   - ✅ Automatically uses updated normalization

4. **enrich-spotify-metadata.ts**
   - Uses artist keys (unchanged)
   - ✅ No venue dependency

5. **prefetch-setlists.ts**
   - Cache keyed by concert ID (not venue name)
   - ✅ Normalization change doesn't break cache structure

### Cache Files Status

| File | Impact | Auto-regenerates? |
|------|--------|-------------------|
| `artists-metadata.json` | No change (already hyphenated) | ✅ Yes |
| `venues-metadata.json` | Keys change to hyphenated | ✅ Yes |
| `setlists-cache.json` | No structural change | ✅ Yes |

### Guarantees

After implementing all changes, running `npm run build-data` will:

1. ✅ Complete successfully with no errors
2. ✅ Regenerate all metadata with correct hyphenated keys
3. ✅ Preserve existing artist cache (keys unchanged)
4. ✅ Regenerate venue metadata with new keys
5. ✅ Maintain setlist cache (keyed by concert ID)
6. ✅ Pass all validation checks

**No manual intervention required.**

---

## Risk Mitigation

### Rollback Strategy

**Work on feature branch:**

```bash
git checkout -b feature/hyphenated-normalization
# Make changes
# Test thoroughly
git push origin feature/hyphenated-normalization
# Create PR for review
```

**Automatic backups:**

- All scripts use `createBackup()` utility
- Backups created: `*.json.backup.TIMESTAMP`
- Restore: `cp public/data/*.backup.* public/data/`

**Force refresh flags available:**

```bash
npm run build-data -- --force-refresh-setlists  # Re-fetch all setlists
npm run enrich-venues  # Always regenerates (no cache)
```

### Testing Strategy

**Automated tests:**

```typescript
// Test normalization functions
describe('normalization', () => {
  test('normalizeVenueName uses hyphens', () => {
    expect(normalizeVenueName('Irvine Meadows')).toBe('irvine-meadows')
    expect(normalizeVenueName('9:30 Club')).toBe('9-30-club')
  })

  test('normalizeGenreName uses hyphens', () => {
    expect(normalizeGenreName('Alternative Rock')).toBe('alternative-rock')
    expect(normalizeGenreName('New Wave/Synth-pop')).toBe('new-wave-synth-pop')
  })
})
```

**Integration tests:**

```bash
# Run full data pipeline
npm run build-data

# Validate all normalization
npm run validate-normalization
# Expected: ✅ ALL VALIDATION CHECKS PASSED

# Verify structure
node -e "console.log(Object.keys(require('./public/data/venues-metadata.json'))[0])"
# Expected: "9-30-club" (with hyphen)
```

**Manual QA:**

- [ ] All scenes render correctly
- [ ] Deep links work with new format
- [ ] Venue metadata lookups work
- [ ] Build succeeds
- [ ] No console errors

---

## Success Criteria

**Code quality:**

- ✅ All normalization functions use identical pattern
- ✅ Duplicate file removed
- ✅ Custom normalization eliminated
- ✅ JSDoc comments comprehensive

**Data quality:**

- ✅ concerts.json has venueNormalized, genreNormalized
- ✅ venues-metadata.json keys are hyphenated
- ✅ All validation passes

**Functionality:**

- ✅ All scenes render correctly
- ✅ Deep links work with new format
- ✅ Metadata lookups succeed
- ✅ Build completes successfully

**Documentation:**

- ✅ DEEP_LINKING.md updated
- ✅ Migration guide provided
- ✅ Release notes highlight breaking changes

---

## Related Specifications

- [Data Normalization Architecture](./global-data-normalization-architecture.md) - Established normalize.ts in v1.4.0
- [Deep Linking Support](../implemented/deep-linking.md) - URL parameter handling
- [Data Pipeline Orchestration](./data-refresh-pipeline-orchestration.md) - Build process

---

## Release Targeting

**Planned for:** v1.9.0 (next minor release)

**Rationale:**

- Breaking change (requires minor version bump)
- Not urgent (aesthetic/maintainability improvement)
- Low risk (data pipeline is self-healing)
- Good opportunity to standardize before v2.0

**Timeline estimate:** 5-6 hours total effort

---

## Critical Files Reference

**Core normalization:**

- [src/utils/normalize.ts](../../src/utils/normalize.ts) - Single source of truth

**Data pipeline:**

- [scripts/fetch-google-sheet.ts](../../scripts/fetch-google-sheet.ts) - Add normalized fields
- [scripts/enrich-venues.ts](../../scripts/enrich-venues.ts) - Regenerate with new keys
- [scripts/prefetch-setlists.ts](../../scripts/prefetch-setlists.ts) - Remove custom normalization

**Validation:**

- [scripts/validate-normalization.ts](../../scripts/validate-normalization.ts) - Add genre validation

**Types:**

- [src/types/concert.ts](../../src/types/concert.ts) - Add new fields

**Documentation:**

- [docs/DEEP_LINKING.md](../DEEP_LINKING.md) - Update examples

---

## Questions & Answers

**Q: Why not add backward compatibility?**

A: Clean break is simpler and clearer. This is a minor version bump, and the site doesn't have significant external integrations that would benefit from gradual migration.

**Q: Will this break external tools consuming the data?**

A: Potentially, yes. However:

- Data is not currently exposed via public API
- Main consumption is through the web UI (updated simultaneously)
- Breaking change is clearly documented in release notes

**Q: Why hyphens instead of removing all special characters?**

A: Hyphens are:

- Web standard for URL slugs
- SEO-friendly
- Human-readable
- Reversible (can reconstruct spacing)

**Q: Why add genreNormalized if genres aren't used for lookups yet?**

A: Future-proofing. When genre filtering/navigation is added, the normalized fields will already exist, avoiding another breaking change.

---

**Specification authored by:** Claude Sonnet 4.5
**Date:** 2026-01-05
**Version:** 1.0
