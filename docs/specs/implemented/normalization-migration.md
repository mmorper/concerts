# Data Normalization Migration

## Status: ✅ COMPLETED

**Date:** 2026-01-03
**Lead Architect:** AI Assistant
**Approved by:** mmorper

---

## Executive Summary

Successfully completed **Option B: Full Migration** to establish a single source of truth for data normalization across the entire codebase. This eliminates the root cause of the "Violent Femmes" bug and prevents similar issues in the future.

### Key Achievements

- ✅ Created shared normalization utility ([src/utils/normalize.ts](../src/utils/normalize.ts))
- ✅ Updated all 7 scripts to use shared utility
- ✅ Updated frontend to use shared utility (removed 3-variant workaround)
- ✅ Deduplicated artists-metadata.json (removed 1 duplicate)
- ✅ Created validation script to detect future regressions
- ✅ All validation checks passing
- ✅ TypeScript compilation successful
- ✅ Build successful

---

## Problem Statement

### Root Cause

Three different normalization functions existed across the codebase:

1. **Pipeline Scripts** (fetch-sheet, enrich-artists, convert-csv)
   ```typescript
   function normalizeArtistName(name: string): string {
     return name.toLowerCase()
       .replace(/[^a-z0-9]/g, '-')  // ← Hyphens
       .replace(/-+/g, '-')
       .replace(/^-|-$/g, '')
   }
   ```
   **Result:** `"Violent Femmes"` → `"violent-femmes"`

2. **Spotify Scripts** (enrich-spotify, generate-mock-spotify)
   ```typescript
   function normalizeArtistName(name: string): string {
     return name.toLowerCase()
       .replace(/[^a-z0-9]/g, '')  // ← NO hyphens
   }
   ```
   **Result:** `"Violent Femmes"` → `"violentfemmes"`

3. **Frontend Workaround** (useArtistMetadata.ts)
   ```typescript
   function normalizeArtistName(name: string): string[] {
     return [
       lowercase.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
       lowercase.replace(/[^a-z0-9-]/g, ''),
       lowercase.replace(/[^a-z0-9]/g, ''),  // ← Try all 3
     ]
   }
   ```
   **Result:** Tries 3 variations, hopes to find a match

### Impact

- **Duplicate entries** in artists-metadata.json
- **Missing images** when frontend finds wrong entry first
- **Data inconsistency** across pipeline
- **Technical debt** from workarounds

---

## Solution Architecture

### Single Source of Truth

Created **[src/utils/normalize.ts](../src/utils/normalize.ts)** with two functions:

```typescript
/**
 * Normalize artist name (WITH hyphens)
 * "Violent Femmes" → "violent-femmes"
 */
export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Normalize venue name (NO hyphens)
 * "The Coach House" → "thecoachhouse"
 */
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}
```

### Why Hyphens for Artists?

1. **More readable:** `violent-femmes` vs `violentfemmes`
2. **URL-friendly:** Already used in primary pipeline
3. **Reversible:** Can reconstruct spacing from hyphens
4. **SEO-friendly:** Better for future URL slugs
5. **Existing standard:** concerts.json already uses this format

### Migration Steps

#### Phase 1: Create Shared Utility ✅
- Created src/utils/normalize.ts
- Updated 7 scripts:
  - scripts/fetch-google-sheet.ts
  - scripts/enrich-artists.ts
  - scripts/enrich-spotify-metadata.ts
  - scripts/generate-mock-spotify-metadata.ts
  - scripts/convert-csv-to-json.ts
  - scripts/enrich-venues.ts
  - scripts/deduplicate-artists.ts (new)
- Updated 2 frontend files:
  - src/components/TimelineHoverPreview/useArtistMetadata.ts
  - src/components/scenes/Scene3Map.tsx

#### Phase 2: Data Cleanup ✅
- Created scripts/deduplicate-artists.ts
- Ran deduplication:
  - Before: 239 artist entries
  - After: 238 artist entries
  - Removed 1 duplicate ("The English Beat")
- Backup created automatically

#### Phase 3: Validation ✅
- Created scripts/validate-normalization.ts
- Added npm scripts:
  - `npm run deduplicate-artists`
  - `npm run validate-normalization`
- All validation checks passing

---

## Files Changed

### New Files
- `src/utils/normalize.ts` - Shared normalization utility
- `scripts/deduplicate-artists.ts` - Deduplication tool
- `scripts/validate-normalization.ts` - Validation tool
- `docs/NORMALIZATION_MIGRATION.md` - This document

### Modified Files
- `scripts/fetch-google-sheet.ts`
- `scripts/enrich-artists.ts`
- `scripts/enrich-spotify-metadata.ts`
- `scripts/generate-mock-spotify-metadata.ts`
- `scripts/convert-csv-to-json.ts`
- `scripts/enrich-venues.ts`
- `src/components/TimelineHoverPreview/useArtistMetadata.ts`
- `src/components/scenes/Scene3Map.tsx`
- `package.json` (added new npm scripts)

---

## Validation Results

### Before Migration
```
⚠️  Multiple normalization functions
⚠️  Duplicate artist entries
⚠️  Frontend workaround with 3 variants
```

### After Migration
```
✅ All validation checks passed
✅ TypeScript compilation successful
✅ Build successful
✅ 1 duplicate removed
✅ Frontend using single normalization
✅ All scripts using shared utility
```

### Test Commands

```bash
# Validate normalization consistency
npm run validate-normalization

# Deduplicate artists (if needed)
npm run deduplicate-artists

# Type check
npx tsc --noEmit

# Build
npm run build
```

---

## Maintenance

### Preventing Future Regressions

1. **Single Source of Truth**
   - All scripts MUST import from `src/utils/normalize.ts`
   - DO NOT create local normalization functions

2. **CI/CD Integration**
   - Add `npm run validate-normalization` to CI pipeline
   - Fails build if inconsistencies detected

3. **Code Review Checklist**
   - ✅ No new normalization functions
   - ✅ Imports from shared utility
   - ✅ Validation passes locally

### Future Improvements

If normalization logic needs to change:

1. Update ONLY `src/utils/normalize.ts`
2. Run `npm run deduplicate-artists`
3. Run `npm run validate-normalization`
4. Regenerate data:
   ```bash
   npm run fetch-sheet
   npm run enrich
   npm run enrich-spotify
   ```

---

## Known Issues

### Resolved
- ✅ Violent Femmes missing image → Fixed
- ✅ The English Beat duplicate entries → Removed
- ✅ Frontend 3-variant workaround → Removed

### None
No outstanding issues related to normalization.

---

## Rollback Plan

If issues arise:

1. Backups exist at:
   ```
   public/data/artists-metadata.json.backup.*
   ```

2. Revert commits:
   ```bash
   git revert <commit-hash>
   ```

3. Restore from backup:
   ```bash
   cp public/data/artists-metadata.json.backup.2026-01-03T04-05-54 \\
      public/data/artists-metadata.json
   ```

---

## Success Metrics

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Normalization functions | 3 | 1 | ✅ |
| Artist duplicates | 1 | 0 | ✅ |
| Frontend variants tried | 3 | 1 | ✅ |
| Validation checks | N/A | All passing | ✅ |
| TypeScript errors | 0 | 0 | ✅ |
| Build status | Passing | Passing | ✅ |

---

## Conclusion

The migration successfully established a **single source of truth** for data normalization across the entire codebase. This architectural improvement:

1. **Eliminates bugs** like the Violent Femmes issue
2. **Prevents regressions** through automated validation
3. **Simplifies maintenance** with centralized logic
4. **Improves code quality** by removing workarounds

The codebase is now in a **production-ready state** with consistent, validated, and maintainable data normalization.

---

## References

- Architecture Discussion: See Cloudflare deployment conversation (2026-01-02)
- Original Bug Report: "Violent Femmes" missing image in Timeline Hover Preview
- Validation Script: [scripts/validate-normalization.ts](../scripts/validate-normalization.ts)
- Shared Utility: [src/utils/normalize.ts](../src/utils/normalize.ts)
