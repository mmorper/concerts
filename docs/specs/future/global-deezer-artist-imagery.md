# Artist Imagery Enrichment - Add Deezer Fallback

**Status:** Planned
**Target Version:** v3.9.0
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** None
**Scene(s):** Global (affects all artist imagery)

---

## Executive Summary

Enhance the artist enrichment pipeline by adding Deezer API as a third fallback source for artist imagery. This addresses gaps in coverage from TheAudioDB and Last.fm, particularly for artists like Against Me! and Dramarama that currently have no imagery.

**Problem:** Some artists return no data from TheAudioDB or Last.fm, leaving them with mock entries and no images.

**Solution:** Add Deezer API (no auth required, generous rate limits) as a third fallback after Last.fm, preserving all existing successful fetches while filling coverage gaps.

**Impact:** Improved artist imagery coverage across all scenes (Timeline, Venues, Artists, etc.) without breaking existing functionality.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Deezer Artist Imagery Fallback feature for Morperhaus Concerts.

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
- Add Deezer API as third fallback for artist imagery
- Preserve existing TheAudioDB → Last.fm hierarchy
- Only fetch for artists with mock/missing data
- Non-breaking: existing images remain untouched

**Key References:**
- Full Design Spec: docs/specs/future/global-deezer-artist-imagery.md
- Data Pipeline Guide: docs/DATA_PIPELINE.md
- Existing Enrichment: scripts/enrich-artists.ts
- TheAudioDB Client: scripts/utils/theaudiodb-client.ts
- Last.fm Client: scripts/utils/lastfm-client.ts

**Implementation Approach:**
- Window 1: Create Deezer client, integrate into enrichment flow, test with known gaps

**Design Philosophy:**
Non-breaking enhancement. Only fill gaps where TheAudioDB and Last.fm return nothing. Maintain existing rate limiting patterns and error handling.

**Key Technical Details:**
- Deezer API: No auth required
- Endpoint: https://api.deezer.com/search/artist?q={artistname}
- Rate limit: Generous (no strict documented limit)
- Response includes: picture_medium, picture_big, picture_xl
- Standard error handling: return null on failure, log to console

**Files to Create:**
- scripts/utils/deezer-client.ts (~80 LOC)

**Files to Modify:**
- scripts/enrich-artists.ts (~15 LOC addition)

Let's start. Should I begin by creating the Deezer client following the patterns in theaudiodb-client.ts and lastfm-client.ts?
```

---

## Design Philosophy

**Non-Breaking Enhancement:** This feature adds a safety net without touching existing successful fetches. The enrichment script already skips artists with valid data, so Deezer only processes artists that both TheAudioDB and Last.fm couldn't find.

**Fallback Chain Logic:**
1. **TheAudioDB** (most comprehensive, established)
2. **Last.fm** (strong coverage, different catalog)
3. **Deezer** ← NEW (fills gaps, especially indie/punk)
4. **Mock** (no data found)

**Key Principle:** Preserve existing working data. Only enrich artists where `dataSource === 'mock'` or data is >30 days old.

---

## Technical Implementation

### Component Architecture

**New File:**
```
scripts/utils/deezer-client.ts
```

**Modified File:**
```
scripts/enrich-artists.ts
```

### Deezer Client API

**Class Structure:**
```typescript
export class DeezerClient {
  private baseUrl = 'https://api.deezer.com'

  async searchArtist(artistName: string): Promise<DeezerArtist[]>
  async getArtistInfo(artistName: string): Promise<ArtistMetadata | null>
}
```

**Interface:**
```typescript
interface DeezerArtist {
  id: number
  name: string
  picture: string
  picture_small: string
  picture_medium: string
  picture_big: string
  picture_xl: string
  nb_album?: number
  nb_fan?: number
}

interface DeezerSearchResponse {
  data: DeezerArtist[]
  total: number
}
```

### Integration Pattern

**Modified enrich-artists.ts workflow (lines 85-117):**

```typescript
// Try TheAudioDB first
const audioDbInfo = await audioDb.getArtistInfo(artistName)
if (audioDbInfo && audioDbInfo.image) {
  metadata[normalized] = audioDbInfo
  console.log(`  ✅ Found on TheAudioDB`)
  enriched++
  continue
}

// Fallback to Last.fm
if (lastFm) {
  const lastFmInfo = await lastFm.getArtistInfo(artistName)
  if (lastFmInfo && lastFmInfo.image) {
    metadata[normalized] = lastFmInfo
    console.log(`  ✅ Found on Last.fm`)
    enriched++
    continue
  }
}

// NEW: Fallback to Deezer
const deezerInfo = await deezer.getArtistInfo(artistName)
if (deezerInfo && deezerInfo.image) {
  metadata[normalized] = deezerInfo
  console.log(`  ✅ Found on Deezer`)
  enriched++
  continue
}

console.log(`  ⚠️  No metadata found`)
failed++
```

### Rate Limiting

**No additional rate limiter needed:**
- Deezer has no documented strict rate limit
- Existing rate limiter (2 calls/sec for TheAudioDB) is already slower than Deezer's tolerance
- If rate limit is encountered (HTTP 429), implement exponential backoff (similar to MusicBrainz client pattern)

### Error Handling

**Pattern (consistent with existing clients):**
```typescript
try {
  const response = await fetch(url)
  if (!response.ok) {
    if (response.status === 429) {
      console.warn('  ⚠️  Rate limit hit, waiting 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      return this.getArtistInfo(artistName) // Retry once
    }
    throw new Error(`Deezer API error: ${response.status}`)
  }
  // ... process response
} catch (error) {
  console.error(`Failed to fetch artist from Deezer: ${artistName}`, error)
  return null
}
```

### Image Selection

**Priority order (from Deezer response):**
1. `picture_big` (500x500) - matches TheAudioDB/Last.fm quality
2. `picture_medium` (250x250) - fallback
3. `picture_xl` (1000x1000) - too large, avoid unless needed

### Data Format

**Return format (matches existing clients):**
```typescript
{
  name: artist.name,
  image: artist.picture_big || artist.picture_medium,
  genres: [], // Deezer doesn't provide genres in search endpoint
  source: 'deezer' as const,
  fetchedAt: new Date().toISOString(),
}
```

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Run `npm run enrich` with dry-run flag
- [ ] Verify Against Me! fetches from Deezer
- [ ] Verify Dramarama fetches from Deezer
- [ ] Verify existing TheAudioDB artists remain unchanged (check Alison Moyet)
- [ ] Verify existing Last.fm artists remain unchanged
- [ ] Test with intentionally misspelled artist name (error handling)
- [ ] Check console output shows correct source labels
- [ ] Verify artists-metadata.json structure unchanged
- [ ] Confirm backup created before write
- [ ] No console errors or warnings (except "No metadata found" for truly unknown artists)

### Test Data

**Known gaps (should fetch from Deezer):**
- Against Me! (currently mock)
- Dramarama (currently mock)

**Should remain unchanged (from TheAudioDB):**
- Alison Moyet
- Dropkick Murphys
- Duran Duran

**Edge cases:**
- Artist with special characters: "Orchestral Manoeuvres in the Dark"
- Artist with "The" prefix: "The Clash"
- Artist with punctuation: "!!!"

---

## Implementation Plan

### Phase 1: Create Deezer Client (~30 min)

**Files to Create:**
- `scripts/utils/deezer-client.ts`

**Tasks:**
1. Create DeezerClient class with searchArtist() method
2. Implement getArtistInfo() following existing client patterns
3. Add TypeScript interfaces for API responses
4. Implement error handling with retry logic
5. Add image selection logic (prefer picture_big)

**Acceptance Criteria:**
- [ ] Client matches pattern in theaudiodb-client.ts
- [ ] Returns null on error (no thrown exceptions)
- [ ] Logs informative console messages
- [ ] TypeScript types are complete and accurate

### Phase 2: Integrate into Enrichment Flow (~15 min)

**Files to Modify:**
- `scripts/enrich-artists.ts`

**Tasks:**
1. Import DeezerClient
2. Initialize deezer instance (no API key needed)
3. Add Deezer fallback block after Last.fm check
4. Update console output to show Deezer source
5. Update enrichment summary stats

**Acceptance Criteria:**
- [ ] Deezer only called if TheAudioDB and Last.fm return null
- [ ] Existing artists not re-fetched
- [ ] Console output clearly identifies source
- [ ] No breaking changes to metadata format

### Phase 3: Testing & Validation (~15 min)

**Tasks:**
1. Run enrichment script with dry-run
2. Verify Against Me! and Dramarama fetch successfully
3. Check existing artists remain unchanged
4. Review console output for clarity
5. Inspect artists-metadata.json for correct structure
6. Run actual enrichment (create backup first)

**Acceptance Criteria:**
- [ ] All test cases pass
- [ ] No regression in existing functionality
- [ ] Console output is clear and informative
- [ ] Backup created successfully
- [ ] Metadata file valid JSON

---

## API Documentation Reference

### Deezer Search API

**Endpoint:**
```
GET https://api.deezer.com/search/artist?q={artist_name}
```

**Example Request:**
```
https://api.deezer.com/search/artist?q=Against%20Me
```

**Example Response:**
```json
{
  "data": [
    {
      "id": 4695969,
      "name": "Against Me!",
      "link": "https://www.deezer.com/artist/4695969",
      "picture": "https://api.deezer.com/artist/4695969/image",
      "picture_small": "https://e-cdns-images.dzcdn.net/images/artist/...-56x56.jpg",
      "picture_medium": "https://e-cdns-images.dzcdn.net/images/artist/...-250x250.jpg",
      "picture_big": "https://e-cdns-images.dzcdn.net/images/artist/...-500x500.jpg",
      "picture_xl": "https://e-cdns-images.dzcdn.net/images/artist/...-1000x1000.jpg",
      "nb_album": 25,
      "nb_fan": 12345,
      "tracklist": "https://api.deezer.com/artist/4695969/top?limit=50",
      "type": "artist"
    }
  ],
  "total": 1,
  "next": "https://api.deezer.com/search/artist?q=Against+Me&index=25"
}
```

**Rate Limits:**
- No official documented limit
- Observed tolerance: ~50 requests/sec
- Best practice: Match existing pipeline speed (2 calls/sec)

**Error Codes:**
- `200` - Success
- `400` - Bad request (malformed query)
- `429` - Too many requests (implement retry with backoff)
- `500` - Server error (log and return null)

---

## Security & Privacy

**No API Key Required:**
- Public, free API (no authentication)
- No personal data collected
- No rate limit concerns with current usage patterns

**CORS:**
- API allows cross-origin requests
- Safe for client-side use (though we use server-side)

---

## Future Enhancements

**Post-v3.9.0 improvements:**

1. **Genre enrichment from Deezer** - Use `/artist/{id}` endpoint to fetch genres
2. **Album count display** - Surface `nb_album` in artist metadata
3. **Popularity scoring** - Use `nb_fan` for ranking/sorting
4. **Image caching** - Download and host images locally to avoid external dependency
5. **Batch API calls** - Group multiple artists in single request (if Deezer adds batch endpoint)

---

## Questions for Review

- ✅ **Fallback order confirmed:** TheAudioDB → Last.fm → Deezer → Mock
- ✅ **Non-breaking requirement:** Only enrich mock/missing data
- ⚠️ **Image hosting consideration:** Should we eventually host images locally instead of hotlinking?

---

## Revision History

- **2026-02-03:** Initial specification created
- **Version:** 1.0.0
- **Author:** Claude Code (Sonnet 4.5)
- **Status:** Planned
