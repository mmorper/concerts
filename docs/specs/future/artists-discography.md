# Artist Discography Integration

**Status:** Partially Implemented (Data Pipeline Complete)
**Implemented Version:** v3.5.0 (data pipeline)
**UI Target Version:** v3.6.0+ (future)
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** None

**Implementation Notes:**
- ✅ Phase 1-3 (Data Pipeline): Completed in v3.5.0
- ⏳ UI Integration: Planned for future release (v3.6.0+)
- Data available in `public/data/discography.json` (2.5MB, 247 artists, 15k+ albums)

---

## Executive Summary

Add MusicBrainz API integration to fetch comprehensive artist discography data (albums, release dates, cover art) as part of the data enrichment workflow. This supplements existing TheAudioDB integration which provides artist imagery and metadata.

**Problem this solves:**
Users viewing an artist in the Artist Scene (Scene 5) lack context about the artist's body of work. They can see concerts they attended and hear top tracks, but have no visual reference to the artist's albums—especially albums released around the time they saw the artist live.

**How it enhances user experience:**
- Provides visual discovery: "I remember that album cover!"
- Contextualizes concerts: "I saw them right after this album came out"
- Creates completeness: Full artist profile with discography, concerts, and music
- Enables future features: Click album → play on Spotify (v3.6.0+)

**How it fits into the product:**
Discography becomes the fourth panel in the Artist Scene gatefold, alongside Concerts, Liner Notes (setlists), and the future Spotify Player. It leverages the existing normalized artist key system and follows established data pipeline patterns.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Artist Discography Integration feature for Morperhaus Concerts.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth
- Ask clarifying questions if anything is ambiguous

**Feature Overview:**
- Fetch artist discography from MusicBrainz API (free, no auth required)
- Store in new `public/data/discography.json` file keyed by normalized artist name
- Integrate into existing `npm run build-data` pipeline
- Add validation checks for data completeness
- Prepare data structure for future UI integration in Artist Scene

**Key References:**
- Full Design Spec: docs/specs/future/artists-discography.md
- Data Pipeline: docs/DATA_PIPELINE.md
- Data Schema Skill: .claude/skills/data-schema/SKILL.md
- API Integration Skill: .claude/skills/api-integration/SKILL.md
- Existing enrichment pattern: scripts/enrich-artists.ts

**Implementation Approach:**
- Window 1: Create MusicBrainz client, fetch logic, data structure
- Window 2: Pipeline integration, validation, testing
- Window 3: Error handling, documentation, final polish

**Design Philosophy:**
Follow the established enrichment pattern used for artists (TheAudioDB) and venues (Google Places). Use cache-first strategy, respect rate limits, handle failures gracefully. Keep data separate in dedicated file for clarity and maintainability.

**Key Design Details:**
- Rate limit: 1 request/second (enforced via sleep)
- Album types: All types (album, EP, live, compilation)
- Cover art size: 500px (balance between quality and file size)
- Cache TTL: 90 days (albums rarely change)
- User-Agent: `Morperhaus-Concerts/3.5.0 (concerts@morperhaus.org)`

**Files to Create:**
- `scripts/utils/musicbrainz-client.ts` (~150 LOC) - API client
- `scripts/enrich-discography.ts` (~200 LOC) - Enrichment script

**Files to Modify:**
- `scripts/build-data.ts` - Add discography step to pipeline
- `scripts/validate-concerts.ts` - Add discography validation checks
- `package.json` - Add `enrich:discography` script

Let's start with Window 1. Should I begin by creating the MusicBrainz API client?
```

---

## Design Philosophy

**Conceptual Model:**
Discography data is treated as artist-level metadata, not concert-level data. One artist → one discography entry → many albums. This follows the same pattern as artist metadata from TheAudioDB and venue metadata from Google Places.

**UX Goals:**
1. **Discovery**: Visual album grid creates "aha!" moments of recognition
2. **Context**: Show albums chronologically to relate to concert dates
3. **Completeness**: Make artist profile feel comprehensive and authoritative
4. **Performance**: Static data file ensures instant loading, no runtime API calls

**Data Architecture Principles:**
- Separate concerns: `discography.json` is distinct from `artists-metadata.json`
- Normalize keys: Use same `normalizedName` key structure as existing data
- Cache aggressively: Discographies change rarely, cache for 90 days
- Fail gracefully: Missing discography doesn't break artist view

---

## Data Structure

### Discography Data File

**Location:** `public/data/discography.json`

**Structure:** Object keyed by normalized artist name

```typescript
interface DiscographyFile {
  [normalizedArtistName: string]: ArtistDiscography;
}

interface ArtistDiscography {
  // Identifiers
  artistName: string;              // "Radiohead" (display name)
  normalizedName: string;          // "radiohead" (cache key)
  mbid: string;                    // "a74b1b7f-71a5-4011-9441-d0b5e4122711"

  // Metadata
  fetchedAt: string;               // ISO timestamp
  cachedAt: string;                // ISO timestamp
  albumCount: number;              // 14

  // Albums
  albums: Album[];
}

interface Album {
  // Identifiers
  id: string;                      // MusicBrainz release-group ID
  title: string;                   // "OK Computer"

  // Dates
  releaseDate: string;             // "1997-05-21" (full date if available)
  year: number;                    // 1997 (parsed from releaseDate)

  // Metadata (for filtering in UI)
  primaryType: string;             // "Album" | "EP" | "Single" | "Broadcast" | "Other"
  secondaryTypes: string[];        // ["Live"] | ["Compilation"] | ["Soundtrack"] | []

  // Disambiguation
  disambiguation: string;          // "bonus disc", "Japanese edition", etc. (often empty)

  // Cover Art
  coverUrl: string;                // Cover Art Archive URL (500px)
  coverAvailable: boolean;         // true if cover art exists (tested with HEAD request)
}
```

### Example Entry

```json
{
  "radiohead": {
    "artistName": "Radiohead",
    "normalizedName": "radiohead",
    "mbid": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
    "fetchedAt": "2026-01-14T10:30:00.000Z",
    "cachedAt": "2026-01-14T10:30:00.000Z",
    "albumCount": 12,
    "albums": [
      {
        "id": "b1392450-e666-3926-a536-22c65f834433",
        "title": "OK Computer",
        "releaseDate": "1997-05-21",
        "year": 1997,
        "primaryType": "Album",
        "secondaryTypes": [],
        "disambiguation": "",
        "coverUrl": "https://coverartarchive.org/release-group/b1392450-e666-3926-a536-22c65f834433/front-500.jpg",
        "coverAvailable": true
      },
      {
        "id": "6a09041b-0f79-3278-88d0-0c1a153e75bb",
        "title": "Kid A",
        "releaseDate": "2000-10-02",
        "year": 2000,
        "primaryType": "Album",
        "secondaryTypes": [],
        "disambiguation": "",
        "coverUrl": "https://coverartarchive.org/release-group/6a09041b-0f79-3278-88d0-0c1a153e75bb/front-500.jpg",
        "coverAvailable": true
      },
      {
        "id": "xxx-live-album-xxx",
        "title": "I Might Be Wrong: Live Recordings",
        "releaseDate": "2001-11-12",
        "year": 2001,
        "primaryType": "Album",
        "secondaryTypes": ["Live"],
        "disambiguation": "",
        "coverUrl": "https://coverartarchive.org/release-group/xxx-live-album-xxx/front-500.jpg",
        "coverAvailable": true
      },
      {
        "id": "xxx-compilation-xxx",
        "title": "The Best Of",
        "releaseDate": "2008-06-02",
        "year": 2008,
        "primaryType": "Album",
        "secondaryTypes": ["Compilation"],
        "disambiguation": "",
        "coverUrl": "https://coverartarchive.org/release-group/xxx-compilation-xxx/front-500.jpg",
        "coverAvailable": true
      }
    ]
  }
}
```

### UI Filtering Strategy

With `primaryType` and `secondaryTypes` metadata, the UI can implement sophisticated filtering:

**Filter by Primary Type:**
- Studio Albums: `primaryType === "Album" && secondaryTypes.length === 0`
- EPs: `primaryType === "EP"`
- Singles: `primaryType === "Single"`

**Filter by Secondary Type:**
- Live Albums: `secondaryTypes.includes("Live")`
- Compilations: `secondaryTypes.includes("Compilation")`
- Soundtracks: `secondaryTypes.includes("Soundtrack")`
- Remix Albums: `secondaryTypes.includes("Remix")`

**"Studio Albums Only" Filter (Most Common):**
```typescript
const studioAlbums = albums.filter(album =>
  album.primaryType === "Album" &&
  album.secondaryTypes.length === 0
);
```

**Exclude Compilations & Live:**
```typescript
const originalReleases = albums.filter(album =>
  !album.secondaryTypes.includes("Compilation") &&
  !album.secondaryTypes.includes("Live")
);
```

### MusicBrainz Type Reference

**Primary Types:**
- `Album` - Full-length album (most common)
- `EP` - Extended play (shorter than album)
- `Single` - Single release
- `Broadcast` - Radio/TV broadcast
- `Other` - Miscellaneous

**Secondary Types:**
- `Live` - Live recording
- `Compilation` - Greatest hits, best of
- `Soundtrack` - Movie/TV soundtrack
- `Spokenword` - Audiobook, comedy album
- `Interview` - Interview recording
- `Audiobook` - Audiobook
- `Remix` - Remix album
- `DJ-mix` - DJ mix album
- `Mixtape/Street` - Mixtape

**Note on Country Filtering:**
Country information is available at the **release** level (not release-group). To filter by country (e.g., "U.S. releases only"), we would need to fetch individual releases for each album, which adds significant API overhead:

- **Release-group**: One request per artist (~247 requests total)
- **Release-level**: 10-50 requests per artist (~5,000+ requests total)

**Recommendation for MVP:**
- Skip country filtering (too expensive)
- Use `primaryType` + `secondaryTypes` for filtering (sufficient for most use cases)
- Consider adding country filtering in v4.0+ if user feedback requests it

---

## Technical Implementation

### MusicBrainz API Integration

**Base URL:** `https://musicbrainz.org/ws/2/`

**Rate Limiting:**
- 1 request per second (strictly enforced by MusicBrainz)
- Use `await sleep(1000)` between requests
- No exceptions—failure to rate limit results in 503 errors

**Authentication:** None required

**Data License:** CC0 (public domain) - can cache indefinitely

### Required Endpoints

#### 1. Artist Search

```typescript
// Endpoint
GET /artist?query={artist_name}&fmt=json

// Example
GET /artist?query=Radiohead&fmt=json

// Response (simplified)
{
  "artists": [
    {
      "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
      "name": "Radiohead",
      "disambiguation": "",
      "country": "GB",
      "life-span": { "begin": "1985" }
    }
  ]
}
```

**Implementation Notes:**
- Use exact name match preferred (check `score` field if available)
- Take first result if no exact match
- Handle empty results gracefully (artist not in MusicBrainz)

#### 2. Discography Fetch

```typescript
// Endpoint
GET /release-group?artist={mbid}&limit=100&fmt=json

// Example
GET /release-group?artist=a74b1b7f-71a5-4011-9441-d0b5e4122711&limit=100&fmt=json

// Response (simplified)
{
  "release-groups": [
    {
      "id": "6a09041b-0f79-3278-88d0-0c1a153e75bb",
      "title": "OK Computer",
      "first-release-date": "1997-05-21",
      "primary-type": "Album",
      "secondary-types": []
    }
  ]
}
```

**Query Parameters:**
- `limit=100` - Fetch up to 100 albums (handles most artists)
- `offset=N` - Use for pagination if artist has >100 albums
- No `type` filter - fetch all types (album, EP, live, compilation)

**Implementation Notes:**
- Handle partial dates: "1997" vs "1997-05-21"
- Sort albums by release date (newest first for UI)
- Filter out albums with no release date (drafts)

#### 3. Cover Art

**Cover Art Archive URL Pattern:**
```
https://coverartarchive.org/release-group/{release-group-id}/front-500.jpg
```

**Sizes Available:**
- `front-250.jpg` - Thumbnail
- `front-500.jpg` - Medium (recommended)
- `front-1200.jpg` - Large
- `front` - Original resolution

**Availability Check:**
Send HEAD request to cover URL:
- 200 → Cover exists, set `coverAvailable: true`
- 404 → No cover, set `coverAvailable: false`

**Note:** Don't fail enrichment if cover is missing. Just mark as unavailable.

### Component Architecture

#### File: `scripts/utils/musicbrainz-client.ts`

```typescript
export class MusicBrainzClient {
  private baseUrl = 'https://musicbrainz.org/ws/2/';
  private userAgent = 'Morperhaus-Concerts/3.5.0 (concerts@morperhaus.org)';
  private lastRequestTime = 0;

  /**
   * Enforce 1 request/second rate limit
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 1000) {
      await sleep(1000 - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Search for artist by name, return MBID
   */
  async searchArtist(artistName: string): Promise<string | null> {
    await this.rateLimit();
    // Implementation
  }

  /**
   * Fetch discography for artist by MBID
   */
  async getDiscography(mbid: string): Promise<Album[]> {
    await this.rateLimit();
    // Implementation
  }

  /**
   * Check if cover art exists for release group
   */
  async checkCoverArt(releaseGroupId: string): Promise<boolean> {
    // HEAD request, no rate limit needed (different domain)
  }
}
```

#### File: `scripts/enrich-discography.ts`

```typescript
/**
 * Main enrichment script
 * Follows pattern from scripts/enrich-artists.ts
 */

async function enrichDiscography() {
  // 1. Load existing discography.json (if exists)
  // 2. Load artists-metadata.json to get list of artists
  // 3. Filter artists: skip if cached <90 days, skip if mock data
  // 4. For each artist:
  //    a. Search MusicBrainz for artist MBID
  //    b. Fetch discography
  //    c. Check cover art availability (async batch)
  //    d. Build discography entry
  // 5. Create backup of discography.json
  // 6. Write updated discography.json
  // 7. Report summary stats
}
```

**Output Example:**
```
🎵 Enriching artist discographies from MusicBrainz...

Found 247 unique artists
Loaded 102 existing discography records

Fetching: Radiohead
  ✅ Found MBID: a74b1b7f-71a5-4011-9441-d0b5e4122711
  ✅ Found 9 albums
  ✅ 8/9 albums have cover art

Fetching: Depeche Mode
  ✅ Found MBID: 8538e728-ca0b-4321-b7e5-cff6565dd4c0
  ✅ Found 14 albums
  ✅ 14/14 albums have cover art

Fetching: Local Band Name
  ⚠️  Not found in MusicBrainz

📦 Backup created: discography.json.backup.2026-01-14T10-30-00

📊 Enrichment Summary:
   ✅ Enriched: 200
   ⏭️  Skipped (cached): 45
   ❌ Failed: 2

💾 Saved to: public/data/discography.json

🎉 Done!
```

---

## Pipeline Integration

### Update `scripts/build-data.ts`

Add discography enrichment as Step 6 (between Spotify and setlists):

```typescript
const steps = [
  { name: 'Fetch Google Sheets', skip: false },
  { name: 'Validate concerts', skip: options.skipValidation },
  { name: 'Enrich artist metadata', skip: false },
  { name: 'Enrich venue metadata', skip: options.skipVenues },
  { name: 'Enrich Spotify data', skip: options.skipSpotify },
  { name: 'Enrich discography', skip: options.skipDiscography },  // NEW
  { name: 'Pre-fetch setlists', skip: options.skipSetlists }
];
```

**Command Flag:**
```bash
npm run build-data -- --skip-discography  # Skip discography step
```

### Update `package.json`

```json
{
  "scripts": {
    "enrich:discography": "tsx scripts/enrich-discography.ts"
  }
}
```

---

## Validation Strategy

### Add Checks to `scripts/validate-concerts.ts`

```typescript
/**
 * Validate discography data quality
 */
async function validateDiscography(): Promise<ValidationResult> {
  const discography = await loadDiscography();
  const artists = await loadArtistsMetadata();

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check 1: Every artist in artists.json should have discography entry
  for (const [key, artist] of Object.entries(artists)) {
    if (artist.dataSource === 'mock') continue; // Skip mock artists

    if (!discography[key]) {
      warnings.push({
        type: 'missing-discography',
        artist: artist.name,
        message: `Artist "${artist.name}" has no discography data`
      });
    }
  }

  // Check 2: No duplicate albums within artist
  for (const [key, entry] of Object.entries(discography)) {
    const albumIds = entry.albums.map(a => a.id);
    const duplicates = findDuplicates(albumIds);

    if (duplicates.length > 0) {
      errors.push({
        type: 'duplicate-albums',
        artist: entry.artistName,
        duplicates,
        message: `Artist "${entry.artistName}" has duplicate album IDs`
      });
    }
  }

  // Check 3: Warn if artist has 0 albums
  for (const [key, entry] of Object.entries(discography)) {
    if (entry.albumCount === 0) {
      warnings.push({
        type: 'no-albums',
        artist: entry.artistName,
        message: `Artist "${entry.artistName}" has no albums (may not be in MusicBrainz)`
      });
    }
  }

  // Check 4: Warn if discography is stale (>90 days)
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  for (const [key, entry] of Object.entries(discography)) {
    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > NINETY_DAYS) {
      warnings.push({
        type: 'stale-cache',
        artist: entry.artistName,
        age: Math.floor(age / (24 * 60 * 60 * 1000)),
        message: `Discography for "${entry.artistName}" is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old`
      });
    }
  }

  return { errors, warnings };
}
```

### Validation Output Example

```
============================================================
DISCOGRAPHY VALIDATION
============================================================

⚠️  15 WARNING(S) FOUND:

   Artist "Local Ska Band": No albums (may not be in MusicBrainz)
   Artist "Opening Act Name": No discography data
   Artist "Radiohead": Discography is 95 days old (consider refresh)

✅ Validation passed with warnings.
```

---

## Error Handling

### Rate Limit Errors (503)

```typescript
try {
  const response = await fetch(url, { headers });
  if (response.status === 503) {
    console.warn('Rate limit hit, waiting 2 seconds...');
    await sleep(2000);
    return retry(url);
  }
} catch (error) {
  console.error('MusicBrainz API error:', error);
  return null; // Fail gracefully
}
```

### Artist Not Found

```typescript
const artists = await client.searchArtist('Unknown Band');
if (!artists || artists.length === 0) {
  console.warn(`Artist not found: ${artistName}`);
  // Store empty discography entry to avoid re-fetching
  return {
    artistName,
    normalizedName,
    mbid: null,
    albumCount: 0,
    albums: [],
    fetchedAt: new Date().toISOString(),
    cachedAt: new Date().toISOString()
  };
}
```

### No Albums Found

```typescript
const albums = await client.getDiscography(mbid);
if (albums.length === 0) {
  console.warn(`No albums found for: ${artistName}`);
  // Still cache the result (artist exists but no albums)
}
```

### Missing Cover Art

```typescript
const coverAvailable = await client.checkCoverArt(album.id);
// Always include album, just mark cover as unavailable
album.coverAvailable = coverAvailable;
```

---

## Testing Strategy

### Manual Testing Checklist

**Data Enrichment:**
- [ ] Run `npm run enrich:discography` successfully
- [ ] Verify `discography.json` created in `public/data/`
- [ ] Check file size is reasonable (<5MB for 247 artists)
- [ ] Inspect JSON structure matches spec
- [ ] Verify backup created: `discography.json.backup.TIMESTAMP`

**Data Quality:**
- [ ] Check well-known artist (Radiohead, Depeche Mode) has complete discography
- [ ] Verify album covers are high-quality (500px)
- [ ] Check release dates are accurate
- [ ] Confirm albums are sorted by date (newest first)

**Pipeline Integration:**
- [ ] Run `npm run build-data` - discography step executes
- [ ] Run `npm run build-data -- --skip-discography` - step skipped
- [ ] Run `npm run validate-data` - discography validation passes

**Edge Cases:**
- [ ] Artist not in MusicBrainz (local band) - stores empty entry
- [ ] Artist with >100 albums (pagination) - all albums fetched
- [ ] Album with no cover art - `coverAvailable: false`
- [ ] Album with partial date ("1997" not "1997-05-21") - year extracted
- [ ] Rate limit hit (503) - script waits and retries

**Performance:**
- [ ] Initial enrichment of 247 artists completes in <10 minutes
- [ ] Incremental enrichment (only new artists) completes in <1 minute
- [ ] Cached artists skipped (no unnecessary API calls)

### Test Data

**Known Artists (Good Coverage):**
- **Radiohead** - 9 studio albums, complete discography
- **Depeche Mode** - 14+ studio albums, active since 1981
- **Taylor Swift** - Prolific, many albums, excellent test case
- **Nine Inch Nails** - Mix of albums, EPs, live releases

**Edge Cases:**
- **The Go-Go's** - May have spelling variations (Go-Gos, GoGos)
- **R.E.M.** - Punctuation test
- **Local unsigned band** - Not in MusicBrainz

### Validation Test

```bash
# Should pass with warnings (local bands missing)
npm run validate-data

# Output should show:
# - 247 artists checked
# - ~5-10 warnings for local/obscure bands
# - 0 errors
```

---

## Implementation Plan

### Phase 1: Core Integration (Window 1) - 2-3 hours

**Files to Create:**
- `scripts/utils/musicbrainz-client.ts` - API client with rate limiting
- `scripts/enrich-discography.ts` - Main enrichment script

**Tasks:**
1. Create MusicBrainzClient class
   - Implement rate limiting (1 req/sec)
   - Add User-Agent header
   - Add artist search method
   - Add discography fetch method
   - Add cover art check method
2. Create enrichment script
   - Load existing discography.json
   - Load artists from artists-metadata.json
   - Filter artists (skip mock, skip cached <90 days)
   - Fetch discography for each artist
   - Create backup before writing
   - Write updated discography.json
3. Test with 3-5 artists manually

**Acceptance Criteria:**
- [ ] MusicBrainz client respects 1 req/sec rate limit
- [ ] Artist search returns MBID successfully
- [ ] Discography fetch returns albums with dates
- [ ] Cover art availability detected
- [ ] Output JSON matches spec structure
- [ ] Script runs without errors for test artists

### Phase 2: Pipeline Integration (Window 2) - 1-2 hours

**Files to Modify:**
- `scripts/build-data.ts` - Add discography step
- `package.json` - Add npm script
- `scripts/validate-concerts.ts` - Add validation checks

**Tasks:**
1. Add discography step to build-data.ts
   - Add `--skip-discography` flag
   - Insert step 6 (between Spotify and setlists)
   - Handle errors gracefully
2. Add npm script: `enrich:discography`
3. Update validation script
   - Check all artists have discography entries
   - Warn on 0 albums
   - Warn on stale cache (>90 days)
   - Check for duplicate albums
4. Test full pipeline: `npm run build-data`
5. Test validation: `npm run validate-data`

**Acceptance Criteria:**
- [ ] `npm run build-data` includes discography step
- [ ] `npm run build-data -- --skip-discography` skips step
- [ ] `npm run enrich:discography` works standalone
- [ ] Validation catches missing discographies
- [ ] Validation reports warnings appropriately
- [ ] No errors in full pipeline run

### Phase 3: Polish & Documentation (Window 3) - 1 hour

**Files to Modify:**
- `docs/DATA_PIPELINE.md` - Document discography step
- `.claude/skills/data-schema/SKILL.md` - Add discography to schema
- `README.md` - Update data stats if needed

**Tasks:**
1. Update DATA_PIPELINE.md
   - Add "Discography Enrichment" section
   - Document MusicBrainz API details
   - Add example output
   - Document flags and usage
2. Update data-schema skill
   - Add discography file location
   - Document data structure
   - Add join patterns
3. Test with full artist list (247 artists)
4. Review and fix any issues found
5. Final verification checklist

**Acceptance Criteria:**
- [ ] Documentation is complete and accurate
- [ ] All 247 artists enriched successfully
- [ ] No rate limit errors encountered
- [ ] Validation passes with expected warnings
- [ ] discography.json file size is reasonable
- [ ] Ready for code review and merge

---

## Future Enhancements

### v3.6.0: Discography UI Panel

Add visual discography panel to Artist Scene gatefold:
- Grid layout of album covers (4-5 columns)
- Chronological order (newest first)
- Hover: Show album title + year
- Click: Link to Spotify album (when Spotify integration ready)
- Fallback: Show placeholder for missing cover art

### v3.7.0: Album Filtering

Add filters to discography panel:
- Filter by type: Studio Albums | EPs | Live | Compilations
- Filter by decade: 1980s | 1990s | 2000s | etc.
- Sort: Newest First | Oldest First | Alphabetical

### v3.8.0: Concert-Album Association

Highlight albums released around concert dates:
- "You saw them 3 months after 'OK Computer' was released"
- Visual indicator on album cover
- Timeline view: albums + concerts interwoven

### v4.0.0: Streaming Integration

Deep link to album playback:
- Click album → Open in Spotify
- Embedded album player (if Spotify integration allows)
- Preview tracks from album

---

## Questions for Review

### Data Structure
- ✅ Separate `discography.json` file? (vs extending `artists-metadata.json`)
  - **Decision:** Separate file for clarity and maintainability

### Album Types
- ✅ Include all types (album, EP, live, compilation)? Or filter to studio albums only?
  - **Decision:** Include all types, allow UI to filter later

### Cover Art Validation
- ⚠️ Check cover art availability with HEAD request? (Adds 1 request per album)
  - **Trade-off:** More requests vs better UX (no broken images)
  - **Recommendation:** Skip for MVP, handle 404s in UI

### Cache Staleness
- ✅ 90-day cache TTL? Or different duration?
  - **Decision:** 90 days (albums rarely change, aligns with Spotify TTL)

### Pagination
- ⚠️ Handle artists with >100 albums? (Requires offset pagination)
  - **Recommendation:** Implement if needed (few artists exceed 100)

---

## Revision History

- **2026-01-14:** Initial specification created v1.0.0
- **Version:** 1.0.0
- **Author:** Claude (Sonnet 4.5) + User collaboration
- **Status:** Planned → Ready for implementation

---

## API Reference

- [MusicBrainz API Documentation](https://musicbrainz.org/doc/MusicBrainz_API)
- [Cover Art Archive API](https://coverartarchive.org/)
- [MusicBrainz Search Syntax](https://musicbrainz.org/doc/MusicBrainz_API/Search)
- [Rate Limiting Guidelines](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
