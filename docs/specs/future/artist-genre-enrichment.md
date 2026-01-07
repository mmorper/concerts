# Artist Genre Enrichment

**Status:** Planned
**Priority:** High
**Estimated Effort:** Medium

## Problem Statement

Currently, genre is stored per-concert in the Google Sheet source data, leading to:

1. **Data inconsistency** - Same artist can have different genres across shows (e.g., Duran Duran tagged as both "New Wave" and "New Romantic")
2. **Manual duplication** - Genre must be manually entered for every concert row
3. **Aggregation issues** - Artists with inconsistent genre tags appear in multiple genre categories or get collapsed into "Other"
4. **Maintenance burden** - Changing an artist's genre requires updating multiple rows

**Core issue:** Genre is an attribute of the artist, not the concert.

## Proposed Solution

Move genre assignment to artist metadata and enrich concerts during the build pipeline.

### Architecture

```
Google Sheet (concerts.csv)
  ├─ Remove "genre" column
  ├─ Keep: date, headliner, openers, venue, city, etc.
  └─ Source of truth for concert attendance data

data/artist-metadata.json (NEW)
  ├─ Canonical artist data including genre
  ├─ Manually curated or enriched from APIs
  └─ Source of truth for artist attributes

Build Pipeline
  ├─ Fetch concerts from Google Sheet
  ├─ Enrich each concert with artist metadata (genre, photos, etc.)
  └─ Output concerts.json with genre populated from artist data
```

## Implementation Plan

### 1. Create Artist Metadata Schema

**File:** `data/artist-metadata.json`

```json
{
  "artists": [
    {
      "name": "Duran Duran",
      "normalizedName": "duran-duran",
      "genre": "New Wave",
      "genreNormalized": "new-wave",
      "imageUrl": "https://...",
      "spotifyId": "...",
      "lastFmUrl": "...",
      "source": "manual" // or "spotify", "audiodb", etc.
    }
  ],
  "lastUpdated": "2026-01-06T12:00:00Z"
}
```

### 2. Generate Initial Artist Metadata

**New script:** `scripts/generate-artist-metadata.ts`

```bash
npm run generate-artist-metadata
```

**Logic:**
1. Read all concerts from Google Sheet
2. Extract unique headliners
3. For each artist:
   - Check if genre already exists in current concerts.json
   - Use most common genre if inconsistent
   - Merge with existing artist enrichment data (photos, etc.)
4. Output `data/artist-metadata.json`
5. Flag inconsistencies for manual review

**Output example:**
```
✅ Generated metadata for 104 headlining artists
⚠️  Inconsistent genres found:
   - Duran Duran: "New Wave" (2 shows), "New Romantic" (1 show)
   → Suggest: "New Wave"
```

### 3. Update Build Pipeline

**Modify:** `scripts/build-data.ts`

**Changes:**
1. Load `data/artist-metadata.json` at startup
2. After fetching concerts from Google Sheet, enrich each concert:
   ```typescript
   let artistMeta = artistMetadataMap.get(concert.headliner)

   // If artist not found, try to enrich from TheAudioDB/Last.fm
   if (!artistMeta) {
     console.log(`🔍 New artist detected: ${concert.headliner}`)
     artistMeta = await enrichNewArtist(concert.headliner)

     if (artistMeta) {
       // Add to metadata map and file
       artistMetadataMap.set(concert.headliner, artistMeta)
       console.log(`✅ Enriched ${concert.headliner} - genre: ${artistMeta.genre}`)
     } else {
       // API lookup failed - use fallback
       console.warn(`⚠️  Could not find ${concert.headliner} in APIs - defaulting to "Other"`)
       artistMeta = {
         name: concert.headliner,
         normalizedName: normalizeArtistName(concert.headliner),
         genre: 'Other',
         genreNormalized: 'other',
         source: 'manual',
         fetchedAt: new Date().toISOString()
       }
       artistMetadataMap.set(concert.headliner, artistMeta)
     }
   }

   concert.genre = artistMeta.genre
   concert.genreNormalized = artistMeta.genreNormalized
   ```

3. Save updated `data/artist-metadata.json` if new artists were added
4. Summary output:
   ```
   ✅ Enriched 2 new artists from APIs
   ⚠️  1 artist defaulted to "Other" (API lookup failed)
   ```

**Helper function:**
```typescript
async function enrichNewArtist(artistName: string) {
  // Try TheAudioDB first
  const audioDbData = await theAudioDbClient.searchArtist(artistName)
  if (audioDbData?.genre) {
    return {
      name: artistName,
      normalizedName: normalizeArtistName(artistName),
      genre: audioDbData.genre,
      genreNormalized: normalizeGenreName(audioDbData.genre),
      imageUrl: audioDbData.image,
      source: 'theaudiodb',
      fetchedAt: new Date().toISOString()
    }
  }

  // Fallback to Last.fm
  const lastFmData = await lastFmClient.getArtistInfo(artistName)
  if (lastFmData?.tags?.[0]) {
    return {
      name: artistName,
      normalizedName: normalizeArtistName(artistName),
      genre: lastFmData.tags[0],
      genreNormalized: normalizeGenreName(lastFmData.tags[0]),
      imageUrl: lastFmData.image,
      source: 'lastfm',
      fetchedAt: new Date().toISOString()
    }
  }

  return null // Not found
}
```

### 4. Validation Script

**New script:** `scripts/validate-artist-genres.ts`

```bash
npm run validate:artist-genres
```

**Checks:**
- Every headliner in concerts has corresponding artist metadata entry
- No duplicate artist entries
- Genre values match predefined list
- All genre values have color definitions in `GENRE_COLORS`

### 5. Google Sheet Migration

**Action for user:**
1. ✅ **DELETE** the "genre" column from Google Sheet
2. Genre will now be automatically populated during build from artist metadata

**Rollback plan:**
- Keep backup of sheet with genre column
- Artist metadata generation can reconstruct from current data

### 6. Update Documentation

**Files to update:**
- `data/README.md` - Document artist metadata format
- `docs/DATA_PIPELINE.md` - Explain genre enrichment flow
- `data/example-concerts.csv` - Remove genre column from example
- `.gitignore` - Ensure `data/artist-metadata.json` is tracked (not ignored)

## Benefits

1. **Single source of truth** - Artist genre defined once
2. **Consistency** - Same artist always has same genre
3. **Easier maintenance** - Update genre in one place
4. **Better aggregation** - Genre scene shows accurate artist groupings
5. **Extensible** - Artist metadata can include other attributes (country, active years, etc.)

## Edge Cases

### New Artists
When adding a concert with a new headliner:
1. Build pipeline warns: "Artist X not in metadata"
2. Defaults to genre "Other"
3. User manually adds artist to `data/artist-metadata.json`
4. Re-run build to populate genre

### Genre Changes Over Time
Some artists genuinely changed genres (e.g., David Bowie). Options:
1. **Pragmatic:** Use their most common or iconic genre
2. **Complex:** Support genre-per-era in metadata (future enhancement)
3. **Override:** Allow per-concert genre override in sheet for special cases

**Recommendation:** Start with #1 (single genre per artist). Add #3 if needed later.

### Openers
Currently, openers don't have genres assigned. With this system:
- Openers could optionally be added to artist metadata
- Or continue to skip genre assignment for openers
- **Decide:** Should openers appear in Genre scene?

## Testing

**Test scenarios:**
1. Build with existing data (genre column present) - should migrate cleanly
2. Build without genre column - should use artist metadata
3. Add new artist not in metadata - should warn and default to "Other"
4. Artist with inconsistent historical genres - should use canonical genre from metadata

## Rollout Plan

**Phase 1: Generate baseline**
```bash
npm run generate-artist-metadata  # Creates data/artist-metadata.json
npm run validate:artist-genres    # Checks for issues
# Manual review of flagged inconsistencies
```

**Phase 2: Update pipeline**
- Modify `build-data.ts` to use artist metadata
- Test build with both Google Sheet formats (with/without genre column)

**Phase 3: Sheet migration**
- User deletes genre column from Google Sheet
- Run full build to verify

**Phase 4: Validation**
- Run `npm run aggregate:genres`
- Verify Duran Duran appears only in "New Wave"
- Check Genre scene for other improvements

## Future Enhancements

- Auto-suggest genres using Spotify/MusicBrainz APIs
- Support multiple genres per artist with primary/secondary
- Genre evolution timeline (show when artist genre changed)
- Opener genre enrichment
- Artist country/origin enrichment
- Active years (first/last concert dates)

## Related

- [Spotify Integration & Unified Image Sourcing](unified-image-sourcing-strategy.md) - Similar pattern for artist photos
- [Data Pipeline Documentation](../../DATA_PIPELINE.md) - Build process overview
- [Genre Colors](../../src/constants/colors.ts) - Genre color definitions

---

**Created:** 2026-01-06
**Author:** Claude Code
**Status:** Ready for implementation
