# MusicBrainz Discography Integration Spec

## Overview

Add MusicBrainz API integration to fetch comprehensive artist discography data (albums, release dates, cover art) as part of the data enrichment workflow. This supplements existing AudioDB integration which provides artist imagery and metadata.

## Use Case

When a user adds a concert to Morperhaus, we want to:

- Show the artist’s full discography with album art
- Provide context about their recent releases
- Enable discovery (“I know that album!”)
- Cache this data locally for fast access

## ⚠️ Prerequisites & Dependencies

### Existing Data Normalization Pipeline

**CRITICAL:** This spec assumes integration with the existing data normalization process. Before implementation:

- [ ] **Review existing normalization pipeline documentation**
  - Understand how artist names are currently normalized
  - Understand how enrichment data flows through the pipeline
  - Identify where AudioDB data is currently integrated
- [ ] **Architect MusicBrainz integration into pipeline**
  - Determine where MusicBrainz calls fit in the enrichment sequence
  - Define how MusicBrainz data merges with existing artist data
  - Ensure normalization rules apply to MusicBrainz artist matching
  - Handle conflicts (e.g., artist name from user input vs MusicBrainz canonical name)
- [ ] **Map data flow:**
  
  ```
  User Input → Normalization → [Spotify?] → AudioDB → MusicBrainz → Cache
  ```

**Without understanding the normalization pipeline, implementation may:**

- Duplicate data
- Break existing enrichment flow
- Create inconsistent artist matching
- Miss opportunities for data reuse

**Action Item:** Locate and review data normalization spec before proceeding with implementation.

-----

## MusicBrainz API Basics

**Base URL:** `https://musicbrainz.org/ws/2/`

**Rate Limiting:**

- 1 request per second (enforced)
- Must include User-Agent header with app name + contact

**Authentication:** None required for basic lookups

**Data License:** CC0 (public domain) - can cache indefinitely

## Required Endpoints

### 1. Search for Artist

```
GET /artist?query={artist_name}&fmt=json
```

**Purpose:** Get artist MBID from name

**Response (simplified):**

```json
{
  "artists": [
    {
      "id": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
      "name": "Radiohead",
      "disambiguation": "",
      "country": "GB",
      "life-span": {"begin": "1985"}
    }
  ]
}
```

**Matching Logic:**

- Exact name match preferred
- Fall back to fuzzy match if needed
- Check disambiguation to avoid wrong artist
- **NOTE:** Must align with existing normalization rules

### 2. Get Artist Discography

```
GET /release-group?artist={mbid}&type=album&fmt=json&limit=100
```

**Purpose:** Get all official albums for an artist

**Query Params:**

- `type=album` - studio albums (excludes singles, EPs)
- `type=album|ep` - include EPs if desired
- `limit=100` - pagination (default 25)
- `offset=0` - for pagination if >100 albums

**Response (simplified):**

```json
{
  "release-groups": [
    {
      "id": "6a09041b-0f79-3278-88d0-0c1a153e75bb",
      "title": "OK Computer",
      "first-release-date": "1997-05-21",
      "primary-type": "Album"
    },
    {
      "id": "...",
      "title": "Kid A",
      "first-release-date": "2000-10-02",
      "primary-type": "Album"
    }
  ]
}
```

### 3. Album Cover Art (Cover Art Archive)

```
GET https://coverartarchive.org/release-group/{mbid}/front-{size}.jpg
```

**Sizes:** `250`, `500`, `1200` (or omit for full resolution)

**Note:** This is a separate service but integrated with MusicBrainz. Returns actual image, not JSON.

**Fallback:** If no cover art exists, endpoint returns 404. Handle gracefully.

## Data Structure

### Cached Artist Discography

```json
{
  "mbid": "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  "cached_at": "2025-01-13T10:30:00Z",
  "albums": [
    {
      "id": "6a09041b-0f79-3278-88d0-0c1a153e75bb",
      "title": "OK Computer",
      "year": 1997,
      "release_date": "1997-05-21",
      "cover_url": "https://coverartarchive.org/release-group/6a09041b-0f79-3278-88d0-0c1a153e75bb/front-500.jpg",
      "type": "Album"
    }
  ]
}
```

### Storage Location

**Option A:** Extend existing concert data structure in `concerts.json`

```json
{
  "concerts": [
    {
      "id": "...",
      "artist": "Radiohead",
      "artist_enrichment": {
        "audiodb": { ... },
        "musicbrainz_discography": { ... }
      }
    }
  ]
}
```

**Option B:** Separate `artists.json` cache keyed by normalized artist name

```json
{
  "radiohead": {
    "name": "Radiohead",
    "audiodb": { ... },
    "musicbrainz_discography": { ... }
  }
}
```

**Recommendation:** Option B - allows reuse across multiple concerts by same artist

**NOTE:** Final storage structure depends on existing normalization pipeline architecture.

## Implementation Checklist

### Phase 0: Discovery & Architecture

- [ ] **Locate and review data normalization pipeline documentation**
- [ ] **Map current enrichment workflow (Spotify → AudioDB)**
- [ ] **Identify integration points for MusicBrainz**
- [ ] **Define data merge strategy**
  - How does MusicBrainz data layer with AudioDB data?
  - What happens when artist names differ between sources?
  - How do we handle normalized artist keys?
- [ ] **Document architecture decisions**

### Phase 1: Core Integration

- [ ] Create MusicBrainz API client module
  - [ ] Set User-Agent header: `Morperhaus-Concerts/1.0 (your-email@example.com)`
  - [ ] Implement 1-second rate limiting
  - [ ] Add retry logic for 503 errors
- [ ] Implement artist search by name
  - [ ] Handle exact vs fuzzy matching
  - [ ] Return MBID
  - [ ] **Apply existing normalization rules**
- [ ] Implement discography fetch by MBID
  - [ ] Filter by album type
  - [ ] Handle pagination if >100 albums
  - [ ] Parse release dates (handle partial dates like “1997” vs “1997-05-21”)
- [ ] Construct Cover Art Archive URLs
  - [ ] Use release-group MBID
  - [ ] Default to 500px size
  - [ ] Handle missing cover art (404 fallback)

### Phase 2: Integration with Enrichment Workflow

- [ ] **Integrate into existing normalization pipeline**
- [ ] Update enrichment job to call MusicBrainz after AudioDB
- [ ] Merge MusicBrainz data into artist cache
- [ ] Add cache invalidation strategy
  - [ ] Store `cached_at` timestamp
  - [ ] Refresh after 90 days (or manual trigger)

### Phase 3: Error Handling

- [ ] Handle rate limit errors (503)
- [ ] Handle artist not found
- [ ] Handle no albums found
- [ ] Handle missing cover art (use placeholder or hide)
- [ ] Log errors for debugging enrichment failures

### Phase 4: UI Integration

- [ ] Create/update Band scene to display discography
- [ ] Show albums in chronological order (newest first?)
- [ ] Display album art using cached URLs
- [ ] Handle click on album (expand details? link to streaming?)

## API Request Examples

### Complete Flow

```javascript
// 1. Search for artist (using normalized name from pipeline)
const searchUrl = `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(normalizedArtistName)}&fmt=json`;
const searchResponse = await fetch(searchUrl, {
  headers: {
    'User-Agent': 'Morperhaus-Concerts/1.0 (contact@example.com)'
  }
});
const { artists } = await searchResponse.json();
const mbid = artists[0].id;

// 2. Wait 1 second (rate limit)
await sleep(1000);

// 3. Get discography
const discogUrl = `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=100`;
const discogResponse = await fetch(discogUrl, {
  headers: {
    'User-Agent': 'Morperhaus-Concerts/1.0 (contact@example.com)'
  }
});
const { 'release-groups': albums } = await discogResponse.json();

// 4. Transform data
const discography = albums.map(album => ({
  id: album.id,
  title: album.title,
  year: parseInt(album['first-release-date'].split('-')[0]),
  release_date: album['first-release-date'],
  cover_url: `https://coverartarchive.org/release-group/${album.id}/front-500.jpg`,
  type: album['primary-type']
}));

// 5. Merge into existing artist cache (per normalization pipeline)
```

## Integration Considerations

### Artist Name Normalization

- **Key Question:** How are artist names currently normalized in the pipeline?
- MusicBrainz may return canonical names that differ from user input
- Example: User enters “coldplay” → MusicBrainz returns “Coldplay”
- **Must align** with existing normalization strategy

### Data Merge Strategy

- **Key Question:** How do we merge MusicBrainz data with AudioDB data?
- Both sources may provide overlapping fields (artist name, formed year)
- Need conflict resolution rules
- Example: AudioDB says formed 1996, MusicBrainz says 1985

### Cache Key Management

- **Key Question:** What cache keys are currently used for artists?
- Should MusicBrainz data be keyed by:
  - Normalized artist name?
  - MBID?
  - Same key structure as AudioDB?
- Need consistency for lookups

### Enrichment Sequence

- **Current:** User Input → Normalize → [Spotify?] → AudioDB
- **Proposed:** User Input → Normalize → [Spotify?] → AudioDB → MusicBrainz
- **Question:** Does MusicBrainz run for all artists, or only on-demand?
- **Question:** Do we skip MusicBrainz if AudioDB already has discography data?

## Considerations

### Rate Limiting

- MusicBrainz enforces 1 req/sec strictly
- For batch enrichment, this means 1 artist per 2 seconds minimum (2 requests per artist)
- Consider queuing enrichment jobs rather than blocking

### Artist Name Matching

- MusicBrainz search is fuzzy by default
- May return multiple matches
- Consider storing MBID in concert data for future lookups (skip search step)
- **Must coordinate with normalization pipeline**

### Album Types

- `Album` = studio albums
- `EP` = extended plays
- `Single` = singles (probably don’t want these)
- `Compilation` = greatest hits, etc.
- `Live` = live albums

Start with `type=album`, expand later if needed

### Cover Art Availability

- Not all releases have cover art in CAA
- Older/obscure albums may 404
- Consider showing placeholder or hiding albums without art

### Caching Strategy

- Cache indefinitely (data rarely changes)
- Refresh trigger: manual or 90-day staleness
- Consider incremental refresh (only fetch new releases since last cache)

## Testing

**Test Artists:**

- **Radiohead** - well-documented, complete discography
- **Taylor Swift** - prolific, many releases
- **Local band** - test missing data handling
- **Artist with punctuation** - test name escaping

**Test Scenarios:**

- Artist not found in MusicBrainz
- Artist with no albums
- Album with no cover art
- Rate limit hit (503 response)
- Partial date (just year vs full date)
- **Artist name normalization edge cases**
- **Data merge conflicts between sources**

## Reference

- [MusicBrainz API Documentation](https://musicbrainz.org/doc/MusicBrainz_API)
- [Cover Art Archive API](https://coverartarchive.org/)
- [MusicBrainz Search Syntax](https://musicbrainz.org/doc/MusicBrainz_API/Search)

-----

**Next Steps:**

1. Locate and review data normalization pipeline documentation
1. Review this spec with normalization architecture in mind
1. Update integration strategy based on findings
1. Create detailed implementation plan or PRD for Claude Code