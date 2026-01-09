# Concert Archives Development Roadmap

> **Purpose**: Single unified execution plan with discrete phases that can be completed within one context window
> **Last Updated**: 2026-01-02
> **Current Version**: v1.2.3

---

## Overview

This roadmap breaks down the data normalization, API integration, and feature enhancements into **discrete, executable phases**. Each phase is designed to be:

1. **Context-window sized** - Completable in one working session
2. **Fully testable** - Has clear success criteria
3. **Independently deployable** - Can ship without blocking other work
4. **Documentation complete** - Updates all relevant docs before moving to next phase

---

## Phase Timeline

```
v1.2.3 (Current) → v1.2.4 → v1.3.0 → v1.3.1 → v1.3.2 → v1.4.0
     ↓              ↓        ↓        ↓        ↓        ↓
   Stable      Flexible   Spotify  Artist   Venue    Genre
             Columns    API Integ  Stats   Photos  Derivation
```

---

## Phase 0: Current State (v1.2.3) ✅

**Status**: Complete
**Date**: 2026-01-02

### What Works
- Google Sheets OAuth 2.0 integration
- Google Maps Geocoding with cache
- TheAudioDB artist enrichment
- All 5 scenes functional
- 174 concerts, 305 artists, 77 venues

### Technical Debt
- ❌ Hardcoded column indices in `google-sheets-client.ts`
- ❌ Genre duplicated in concerts.json and manually researched
- ❌ Mock artist data mixed with real TheAudioDB data
- ❌ No venue photos
- ❌ No Spotify integration

### Files to Know
- `scripts/fetch-google-sheet.ts` - Column parsing (needs refactor)
- `public/data/concerts.json` - Has genre field (will be removed)
- `public/data/artists-metadata.json` - Mixed mock/real data (needs cleanup)

---

## Phase 1: Flexible Column Parsing (v1.2.4)

**Goal**: Make Google Sheets client resilient to column changes
**Duration**: 1 context window (~2-3 hours)
**Blocking**: Must complete before removing genre column from sheet

### Tasks

#### 1.1: Refactor Column Parser
- [ ] Read `scripts/utils/google-sheets-client.ts:62-96`
- [ ] Create header-based parser that maps column names to indices
- [ ] Make genre column optional
- [ ] Add validation for required columns (date, headliner, venue, cityState)
- [ ] Add warning logs for missing optional columns

**Key Changes:**
```typescript
// FROM: Hardcoded indices
const genre = row[2] || ''

// TO: Header-based lookup
const columns = parseHeaders(rows[0])
const genre = columns.genre !== undefined ? row[columns.genre] : null
```

#### 1.2: Update Tests
- [ ] Test with genre column present
- [ ] Test with genre column removed
- [ ] Test with columns in different order
- [ ] Test with extra columns added

#### 1.3: Update Documentation
- [ ] Update `docs/DATA_PIPELINE.md` - Add "Flexible Column Support" section
- [ ] Update `docs/specs/future/google-sheets-data-integration.md` - Note v1.2.4 changes
- [ ] Update `docs/STATUS.md` - Mark v1.2.4 complete

### Success Criteria
- ✅ Pipeline runs with genre column
- ✅ Pipeline runs without genre column (shows warning)
- ✅ Concerts.json still has genre field (backward compatible)
- ✅ All tests pass

### Files Modified
- `scripts/utils/google-sheets-client.ts`
- `docs/DATA_PIPELINE.md`
- `docs/specs/future/google-sheets-data-integration.md`
- `docs/STATUS.md`

### Deployment
- Merge to main
- Tag as `v1.2.4`
- User can now remove genre column from Google Sheet

---

## Phase 2: Remove Genre from Google Sheet (v1.2.4)

**Goal**: Stop manually researching genre data
**Duration**: 1 context window (~30 minutes)
**Prerequisite**: Phase 1 complete

### Tasks

#### 2.1: Remove Genre Column
- [ ] Open Google Sheet
- [ ] Delete "Genre_Headliner" column
- [ ] Run `npm run build-data`
- [ ] Verify concerts.json no longer has genre field

#### 2.2: Update Frontend Fallback
- [ ] Update scenes to show "Unknown" when genre missing:
  - `src/components/scenes/Scene1Hero.tsx` - Timeline (line ~50)
  - `src/components/scenes/Scene2Venues.tsx` - Top Artists (line ~30)
  - `src/components/scenes/Scene5Genres.tsx` - Genre chart (line ~40)

**Key Changes:**
```typescript
// Add fallback for missing genre
const genre = concert.genre || 'Unknown'
```

#### 2.3: Update Documentation
- [ ] Update `docs/DATA_PIPELINE.md` - Note genre is optional
- [ ] Update `docs/STATUS.md` - Mark genre removal complete

### Success Criteria
- ✅ Google Sheet no longer has genre column
- ✅ `npm run build-data` succeeds
- ✅ concerts.json has no genre field
- ✅ Scenes show "Unknown" for genre
- ✅ No errors in console

### Files Modified
- Google Sheet (external)
- `src/components/scenes/Scene1Hero.tsx`
- `src/components/scenes/Scene2Venues.tsx`
- `src/components/scenes/Scene5Genres.tsx`
- `docs/DATA_PIPELINE.md`
- `docs/STATUS.md`

---

## Phase 3: Spotify API Integration (v1.3.0)

**Goal**: Add Spotify as primary data source for artist metadata
**Duration**: 3-4 context windows (~2 weeks)
**Prerequisite**: Phase 2 complete

### Context Window 1: Spotify API Setup

#### 3.1: Create Spotify Developer Account
- [ ] Go to https://developer.spotify.com/dashboard
- [ ] Create new app "Concert Archives"
- [ ] Get Client ID and Client Secret
- [ ] Add to `.env`:
  ```bash
  SPOTIFY_CLIENT_ID=your_client_id
  SPOTIFY_CLIENT_SECRET=your_client_secret
  ```

#### 3.2: Implement Spotify Client
- [ ] Create `scripts/utils/spotify-client.ts`
- [ ] Implement Client Credentials flow
- [ ] Add methods:
  - `searchArtist(name: string)`
  - `getArtist(artistId: string)`
  - `getArtistTopTracks(artistId: string, market: 'US')`
  - `getArtistAlbums(artistId: string)`
- [ ] Add rate limiting (30 req/sec max)
- [ ] Add response caching (30-day TTL)

#### 3.3: Update Documentation
- [ ] Update `docs/api-setup.md` - Add Spotify API section
- [ ] Update `docs/STATUS.md` - Mark Spotify client complete

**Files Created:**
- `scripts/utils/spotify-client.ts`

**Files Modified:**
- `docs/api-setup.md`
- `docs/STATUS.md`

---

### Context Window 2: Artist Enrichment Script

#### 3.4: Create Enrichment Script
- [ ] Create `scripts/enrich-artists.ts`
- [ ] Read unique artists from concerts.json
- [ ] For each artist:
  1. Check cache (skip if < 30 days old)
  2. Search Spotify for artist
  3. Get artist details (genres, followers, images)
  4. Get top tracks (5 tracks with preview URLs)
  5. Get albums (sort by popularity, take top 5)
  6. Store in artists-metadata.json

#### 3.5: Clean Up Mock Data
- [ ] Remove all `dataSource: "mock"` entries from artists-metadata.json
- [ ] Keep TheAudioDB entries that have no Spotify match
- [ ] Merge Spotify + TheAudioDB data for artists with both

#### 3.6: Update Build Script
- [ ] Add `npm run enrich-artists` command to package.json
- [ ] Integrate into `npm run build-data` workflow:
  ```
  fetch-sheet → enrich-artists → validate-data
  ```

**Files Created:**
- `scripts/enrich-artists.ts`

**Files Modified:**
- `scripts/build-data.ts`
- `package.json`
- `public/data/artists-metadata.json`

---

### Context Window 3: Genre Mapping Implementation

#### 3.7: Create Genre Mapping Table
- [ ] Create `src/utils/genre-mapping.ts`
- [ ] Map Spotify genres to your 12 categories:
  - New Wave, Punk, Heavy Metal, Alternative, Post-Punk, Industrial
  - Ska, Rockabilly, Electronic, Indie, Goth, Other
- [ ] Implement `deriveGenre(artist: ArtistMetadata): string`
- [ ] Add fallback hierarchy:
  1. Spotify genres (via mapping)
  2. TheAudioDB genre (if no Spotify)
  3. "Unknown" (if both missing)

#### 3.8: Update Artist Scene
- [ ] Update `src/components/scenes/ArtistScene/useArtistData.ts`
- [ ] Use `deriveGenre()` instead of manual genre field
- [ ] Show Spotify album covers on card fronts
- [ ] Update gatefold to show Spotify data (right panel)

**Files Created:**
- `src/utils/genre-mapping.ts`

**Files Modified:**
- `src/components/scenes/ArtistScene/useArtistData.ts`
- `src/components/scenes/ArtistScene/ArtistCardFront.tsx`
- `src/components/scenes/ArtistScene/SpotifyPanel.tsx`

---

### Context Window 4: Genre Scene Updates & Testing

#### 3.9: Update Other Scenes
- [ ] Update Timeline (Scene1) to use `deriveGenre()`
- [ ] Update Top Artists (Scene2) to use `deriveGenre()`
- [ ] Update Genre Chart (Scene5) to use `deriveGenre()`

#### 3.10: End-to-End Testing
- [ ] Run full pipeline: `npm run build-data`
- [ ] Verify all 305 artists enriched
- [ ] Check genre distribution (should match previous)
- [ ] Test fallback for artists with no Spotify data
- [ ] Verify all scenes render correctly

#### 3.11: Update Documentation
- [ ] Update `docs/DATA_PIPELINE.md` - Add "Spotify Enrichment" section
- [ ] Update `docs/specs/implemented/` - Move spotify spec from future/
- [ ] Update `docs/STATUS.md` - Mark v1.3.0 complete
- [ ] Create GitHub release notes for v1.3.0

**Files Modified:**
- `src/components/scenes/Scene1Hero.tsx`
- `src/components/scenes/Scene2Venues.tsx`
- `src/components/scenes/Scene5Genres.tsx`
- `docs/DATA_PIPELINE.md`
- `docs/STATUS.md`

### Success Criteria for Phase 3
- ✅ Spotify API integration working
- ✅ 305 artists enriched with Spotify data (>90% success rate)
- ✅ Genre derived from Spotify genres
- ✅ Album covers display on Artist Scene
- ✅ All scenes show correct genres
- ✅ No mock data in artists-metadata.json

---

## Phase 4: Artist Stats & Concert References (v1.3.1)

**Goal**: Add computed statistics and concert references to artist metadata
**Duration**: 1 context window (~1 day)
**Prerequisite**: Phase 3 complete

### Tasks

#### 4.1: Create Stats Computation Script
- [ ] Create `scripts/compute-artist-stats.ts`
- [ ] For each artist in artists-metadata.json:
  - Build concert references (id, date, venue)
  - Separate headliner vs opener arrays
  - Compute stats (totalConcerts, asHeadliner, asOpener, firstSeen, lastSeen, uniqueVenues)

#### 4.2: Integrate into Pipeline
- [ ] Update `scripts/build-data.ts`:
  ```typescript
  await enrichArtists({ dryRun })
  if (!dryRun) {
    computeArtistStats(concerts, artistsMetadata)
    writeFileSync(artistsMetadataPath, JSON.stringify(artistsMetadata, null, 2))
  }
  ```

#### 4.3: Update Artist Scene
- [ ] Show stats on gatefold left panel:
  - "4 concerts (4 as headliner)"
  - "Active: 1984–2017"
  - "3 unique venues"

#### 4.4: Update Documentation
- [ ] Update `docs/specs/future/global-data-normalization-architecture.md` - Note Phase 3 complete
- [ ] Update `docs/STATUS.md` - Mark v1.3.1 complete

### Success Criteria
- ✅ artists-metadata.json has concert references and stats
- ✅ Artist Scene gatefold shows computed stats
- ✅ Stats are accurate (verified manually for 5 artists)
- ✅ File size acceptable (~45 KB additional)

### Files Created
- `scripts/compute-artist-stats.ts`

### Files Modified
- `scripts/build-data.ts`
- `src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx`
- `docs/specs/future/global-data-normalization-architecture.md`
- `docs/STATUS.md`

---

## Phase 5: Venue Photos Integration (v1.3.2)

**Goal**: Add venue photos to Geography Scene map popups
**Duration**: 4-5 context windows (~1 week)
**Prerequisite**: Phase 4 complete

### Context Window 1: Venue Classification ✅

#### 5.1: Export Venue List
- [x] Create script to extract unique venues from concerts.json
- [x] Generate `data/venues-to-classify.csv`:
  ```csv
  venue,city,state,status,closed_date,notes
  Irvine Meadows,Irvine,California,,,
  Hollywood Bowl,Los Angeles,California,,,
  ```

#### 5.2: Manual Research
- [x] Research each venue's status (active/closed/demolished/renamed)
- [x] Add closed_date for legacy venues
- [x] Add notes (e.g., "Demolished 2016 for residential development")
- [x] Save as `data/venue-status.csv`

**Completed**: 2026-01-02 (76 venues classified)

---

### Context Window 2: Google Places API Client ✅

#### 5.3: Enable Places API
- [x] Go to Google Cloud Console
- [x] Enable "Places API (New)"
- [x] Use same API key as Geocoding API
- [x] Update `.env` (no new key needed)

#### 5.4: Implement Places Client
- [x] Create `scripts/utils/google-places-client.ts`
- [x] Implement methods:
  - `findPlace(venueName, city, state)` - Text Search
  - `getPlaceDetails(placeId)` - Get photos, rating, website
  - `getPhotoUrl(photoReference, maxHeightPx)` - Build photo URLs
- [x] Add caching (90-day TTL)
- [x] Add rate limiting (20ms delays)

**Files Created:**
- `scripts/utils/google-places-client.ts`

**Completed**: 2026-01-02

---

### Context Window 3: Venue Enrichment Script ✅

#### 5.5: Create Enrichment Script
- [x] Create `scripts/enrich-venues.ts`
- [x] Load venue-status.csv
- [x] For each venue:
  - If status = active → fetch from Places API
  - If status ≠ active → set places = null
  - Build concert references from concerts.json
  - Compute stats (totalConcerts, firstEvent, lastEvent, uniqueArtists)
  - Generate photoUrls (thumbnail, medium, large)

#### 5.6: Generate venues-metadata.json
- [x] Run `npm run enrich-venues`
- [x] Verify structure matches spec
- [x] Check active venues have photos
- [x] Check legacy venues have places = null

**Files Created:**
- `scripts/enrich-venues.ts`
- `public/data/venues-metadata.json`

**Files Modified:**
- `package.json` (add enrich-venues script)

**Completed**: 2026-01-02

---

### Context Window 4: Manual Photo Curation ✅

#### 5.7: Identify Legacy Venues Needing Photos
- [x] Filter venues where status ≠ 'active' and places = null
- [x] Prioritize by concert count (Irvine Meadows has 14 concerts!)

#### 5.8: Source Historical Photos
- [x] Search Wikipedia Commons
- [x] Search Internet Archive
- [x] Search local newspaper archives (OC Register, LA Times)
- [x] Verify licenses (public domain, CC, fair use)

#### 5.9: Add Manual Photos
- [x] Save photos to `/public/images/venues/`
- [x] Format: `{normalizedName}-{number}.jpg`
- [x] Update venues-metadata.json manualPhotos array
- [x] Generate photoUrls pointing to local files

#### 5.10: Create Fallback Images
- [x] Create fallback-active.jpg for active venues without API photos
- [x] Create fallback.jpg for legacy venues without manual photos
- [x] Implement 5-tier fallback hierarchy in enrich-venues.ts

#### 5.11: Create Photo Review Tool

- [x] Create `scripts/review-venue-photos.ts`
- [x] Add npm script `review-venue-photos`

**Completed**: 2026-01-02 (8 manual photos curated - exceeded target of top 10 venues!)

---

### Context Window 5: Frontend Integration

#### 5.10: Update Geography Scene
- [ ] Load venues-metadata.json in Scene3Map.tsx
- [ ] Update marker popups to show:
  - Venue photo at top (128px height)
  - Venue name and city/state
  - Legacy venue badge if closed/demolished
  - Concert info (headliner, date)

#### 5.11: Testing
- [ ] Test active venue with photo (Hollywood Bowl)
- [ ] Test legacy venue with manual photo (Irvine Meadows)
- [ ] Test venue with no photo (graceful fallback)
- [ ] Test on mobile (popup sizing)

#### 5.12: Update Documentation
- [ ] Update `docs/api-setup.md` - Add Places API section
- [ ] Update `docs/DATA_PIPELINE.md` - Add venue enrichment section
- [ ] Update `docs/STATUS.md` - Mark v1.3.2 complete

**Files Modified:**
- `src/components/scenes/Scene3Map.tsx`
- `docs/api-setup.md`
- `docs/DATA_PIPELINE.md`
- `docs/STATUS.md`

### Success Criteria for Phase 5
- ✅ venues-metadata.json created with 77 venues
- ✅ Active venues have photos from Places API
- ✅ Legacy venues have manual photos (top 10 venues)
- ✅ Geography Scene popups show venue photos
- ✅ API costs < $5 initial + $15/year
- ✅ Graceful fallback for missing photos

---

## Phase 6: Full Genre Derivation (v1.4.0)

**Goal**: Complete data normalization with genre derived from artists
**Duration**: 2 context windows (~2-3 days)
**Prerequisite**: Phase 5 complete

### Context Window 1: Backend Changes

#### 6.1: Add venueNormalized Field
- [ ] Update `scripts/fetch-google-sheet.ts`
- [ ] Add normalized venue names to concerts.json:
  ```typescript
  concert.venueNormalized = normalizeVenueName(concert.venue)
  ```

#### 6.2: Update Frontend Data Loading
- [ ] Update `src/App.tsx` to load venues-metadata.json
- [ ] Pass venuesMetadata to scenes via context or props

#### 6.3: Update Documentation
- [ ] Update `docs/specs/future/global-data-normalization-architecture.md` - Mark complete
- [ ] Move to `docs/specs/implemented/global-data-normalization-architecture.md`

---

### Context Window 2: Verify All Scenes

#### 6.4: Test All Scenes
- [ ] Scene 1 (Timeline) - Genres correct?
- [ ] Scene 2 (Top Artists) - Genres correct?
- [ ] Scene 3 (Geography) - Venue photos showing?
- [ ] Scene 4 (Venue Network) - Still functional?
- [ ] Scene 5 (Genres) - Chart rendering correctly?
- [ ] Scene 6 (Artists) - Spotify data showing?

#### 6.5: Performance Testing
- [ ] Check bundle size (should be similar)
- [ ] Check load times (3 JSON files vs 1)
- [ ] Check API costs (Spotify + Places)

#### 6.6: Update Documentation
- [ ] Update `docs/STATUS.md` - Mark v1.4.0 complete
- [ ] Create GitHub release notes for v1.4.0
- [ ] Update README.md with new features

### Success Criteria for Phase 6
- ✅ concerts.json has venueNormalized field
- ✅ All scenes use derived genres
- ✅ Venue photos display in popups
- ✅ No performance regressions
- ✅ Data fully normalized

---

## Summary: Release Schedule

| Release | Focus | Context Windows | Est. Time | Key Deliverable |
|---------|-------|----------------|-----------|-----------------|
| **v1.2.4** | Flexible columns | 1-2 | 1 day | Column parser refactor |
| **v1.3.0** | Spotify integration | 3-4 | 2 weeks | Genre derivation, album covers |
| **v1.3.1** | Artist stats | 1 | 1 day | Concert references, computed stats |
| **v1.3.2** | Venue photos | 4-5 | 1 week | Places API, manual curation |
| **v1.4.0** | Normalization complete | 2 | 2-3 days | Full runtime joins |

**Total estimated time**: 3-4 weeks

---

## Context Window Guidelines

Each phase is designed to fit within a single context window session:

1. **Start with planning** - Review the phase tasks
2. **Execute systematically** - Check off tasks as you go
3. **Test thoroughly** - Verify success criteria
4. **Update docs last** - Keep STATUS.md and related specs current
5. **Commit before ending** - Don't leave work uncommitted

### What Fits in One Context Window

✅ **Good for one window:**
- Refactoring a single script
- Implementing a new API client
- Updating 2-3 scene components
- Writing or updating 1-2 documentation files

❌ **Too big for one window:**
- Implementing full Spotify integration (split into 3-4 windows)
- Venue photo curation for all 76 venues (ongoing task)
- Refactoring all 5 scenes simultaneously

---

## Dependencies Graph

```
v1.2.4 (Flexible Columns)
    ↓
v1.2.4 (Remove Genre Column)
    ↓
v1.3.0 (Spotify API)
    ↓
v1.3.1 (Artist Stats) ←──┐
    ↓                     │
v1.3.2 (Venue Photos) ────┤ (Can work in parallel)
    ↓                     │
v1.4.0 (Full Normalization)
```

**Key insight**: Venue photos (v1.3.2) can be developed in parallel with artist stats (v1.3.1) since they don't depend on each other.

---

## Risk Mitigation

### Risk: Spotify API Rate Limits
**Mitigation**:
- Use 30-day cache
- Rate limit to 20 req/sec (well below 30 req/sec limit)
- Process artists in batches of 50

### Risk: Manual Photo Curation Takes Too Long
**Mitigation**:
- Prioritize top 10 venues by concert count
- Ship v1.3.2 with partial coverage
- Continue curating post-release

### Risk: Genre Mapping Produces Wrong Categories
**Mitigation**:
- Manual override field in artists-metadata.json
- Log unmapped genres for review
- Iterate on mapping table based on feedback

---

## Next Steps

**Immediate**: Start with Phase 1 (Flexible Column Parsing) in next context window.

**How to use this roadmap**:
1. At start of each session: Review current phase
2. During session: Check off tasks, commit frequently
3. At end of session: Update STATUS.md, verify phase complete
4. Next session: Move to next phase

---

*Last updated: 2026-01-02*
