# Unified Image Sourcing Strategy

> **Status:** Specification
> **Priority:** High
> **Version:** v1.5.0 (proposed)
> **Related:** [gatefold-artist-photo.md](../implemented/gatefold-artist-photo.md), [artist-scene.md](../implemented/artist-scene.md), [artists-spotify-integration.md](artists-spotify-integration.md)

## Overview

Establish a unified image sourcing strategy that prioritizes Spotify as the definitive source for both artist photos and album artwork, with TheAudioDB as the fallback. This ensures visual consistency and leverages Spotify's more complete dataset across all current and future features.

## Current State Analysis

### Existing Image Pipeline (v1.4.1)

| Image Type | Current Source | Current Priority | Used In |
|------------|---------------|------------------|---------|
| Artist Photos | TheAudioDB `strArtistThumb` | Primary | Timeline Hover, Gatefold Inside |
| Artist Photos | Last.fm artist images | Fallback | Timeline Hover, Gatefold Inside |
| Album Covers | Spotify `mostPopularAlbum.coverArt` | Fetched but unused | None (data exists, not displayed) |
| Gatefold Cover | None | N/A | Gradient + initials only |

### Current Enrichment Scripts

**Files involved:**
- [scripts/enrich-spotify-metadata.ts](../../../scripts/enrich-spotify-metadata.ts) - Fetches album covers (NOT artist images)
- [scripts/enrich-artists.ts](../../../scripts/enrich-artists.ts) - Fetches TheAudioDB + Last.fm artist photos
- [scripts/utils/theaudiodb-client.ts](../../../scripts/utils/theaudiodb-client.ts) - TheAudioDB API client
- [scripts/utils/lastfm-client.ts](../../../scripts/utils/lastfm-client.ts) - Last.fm API client

### Data Structure

**Current `artists-metadata.json`:**
```json
{
  "depeche-mode": {
    "name": "Depeche Mode",
    "image": "https://r2.theaudiodb.com/images/media/artist/thumb/...",
    "source": "theaudiodb",
    "bio": "...",
    "genres": ["Electronic", "Synth Pop"],
    "mostPopularAlbum": {
      "name": "Violator",
      "spotifyAlbumId": "...",
      "coverArt": {
        "small": "https://i.scdn.co/image/...64px",
        "medium": "https://i.scdn.co/image/...300px",
        "large": "https://i.scdn.co/image/...640px"
      }
    }
  }
}
```

**Problem:** We have album covers from Spotify but are using TheAudioDB artist photos everywhere.

---

## Proposed Image Strategy

### Image Type Definitions

#### 1. Artist Photos
**Purpose:** Show the artist's face/band members
**Use Cases:**
- Timeline Hover Preview (140px tall card with artist photo)
- Gatefold Inside Cover (100×100px square in Concert History Panel)
- Future: Artist detail modals, search results, etc.

**Source Priority:**
1. **Spotify Artist Images** (NEW - via `/v1/artists/{id}` endpoint)
2. **TheAudioDB Artist Photos** (`strArtistThumb`)
3. **Last.fm Artist Images** (existing fallback)
4. **Fallback:** Gradient + initials

#### 2. Album Artwork
**Purpose:** Show album cover art
**Use Cases:**
- Gatefold Front Cover (400×400px when closed)
- Future: Spotify Player panel, track listings, etc.

**Source Priority:**
1. **Spotify Album Covers** (most popular album - already fetched)
2. **TheAudioDB Album Art** (N/A - not available from this API)
3. **Fallback:** Gradient + initials

---

## Implementation Requirements

### Phase 1: Data Pipeline Enhancement

#### 1.1 Add Spotify Artist Images Enrichment

**New Script:** `scripts/enrich-spotify-artist-images.ts`

```typescript
/**
 * Fetch Spotify artist images (photos of the artist, not album covers)
 *
 * API Endpoint: GET https://api.spotify.com/v1/artists/{id}
 * Response includes: images array with various sizes (widest first)
 *
 * Rate Limiting: Same as existing Spotify enrichment (350ms between requests, ~3 req/sec)
 */

interface SpotifyArtistImage {
  url: string
  height: number | null
  width: number | null
}

async function enrichSpotifyArtistImages(artistName: string) {
  // 1. Search for artist by name
  const searchResults = await spotifyApi.searchArtists(artistName, { limit: 1 })

  if (!searchResults.artists.items.length) {
    return null
  }

  const artist = searchResults.artists.items[0]

  // 2. Get artist details (includes images array)
  const artistDetails = await spotifyApi.getArtist(artist.id)

  // 3. Extract images in various sizes
  const images = artistDetails.images || []

  return {
    spotifyArtistId: artist.id,
    spotifyArtistUrl: artist.external_urls.spotify,
    artistImages: {
      // Images are returned widest first, extract common sizes
      large: images[0]?.url || null,   // Typically 640px or larger
      medium: images[1]?.url || null,  // Typically 300-320px
      small: images[2]?.url || null    // Typically 64-160px
    }
  }
}
```

#### 1.2 Update Data Structure

**Enhanced `artists-metadata.json`:**
```json
{
  "depeche-mode": {
    "name": "Depeche Mode",

    // NEW: Spotify artist photos (priority #1)
    "spotifyArtist": {
      "id": "762310PdDnwsDxAQxzQkfX",
      "url": "https://open.spotify.com/artist/762310PdDnwsDxAQxzQkfX",
      "images": {
        "large": "https://i.scdn.co/image/...640px",
        "medium": "https://i.scdn.co/image/...320px",
        "small": "https://i.scdn.co/image/...160px"
      },
      "fetchedAt": "2026-01-04T00:00:00.000Z",
      "source": "spotify"
    },

    // EXISTING: TheAudioDB artist photos (priority #2)
    "image": "https://r2.theaudiodb.com/images/media/artist/thumb/...",
    "source": "theaudiodb",
    "bio": "...",
    "genres": ["Electronic", "Synth Pop"],

    // EXISTING: Spotify album covers (for gatefold front)
    "mostPopularAlbum": {
      "name": "Violator",
      "spotifyAlbumId": "...",
      "spotifyAlbumUrl": "...",
      "coverArt": {
        "small": "https://i.scdn.co/image/...64px",
        "medium": "https://i.scdn.co/image/...300px",
        "large": "https://i.scdn.co/image/...640px"
      },
      "releaseYear": 1990
    }
  }
}
```

#### 1.3 Modify Enrichment Pipeline

**Update `scripts/enrich-artists.ts`:**

```typescript
// NEW ORDER OF OPERATIONS:
// 1. Spotify Artist Images (NEW - highest priority for artist photos)
// 2. Spotify Album Covers (EXISTING - for album artwork)
// 3. TheAudioDB (fallback for artist photos + bio/genre data)
// 4. Last.fm (final fallback for artist photos)

async function enrichArtist(artistName: string) {
  const normalized = normalizeArtistName(artistName)
  const metadata: ArtistMetadata = { name: artistName, normalizedName: normalized }

  // Step 1: Fetch Spotify artist images (NEW)
  const spotifyArtist = await enrichSpotifyArtistImages(artistName)
  if (spotifyArtist) {
    metadata.spotifyArtist = spotifyArtist
  }

  // Step 2: Fetch Spotify album covers (EXISTING)
  const spotifyAlbum = await enrichSpotifyAlbumMetadata(artistName)
  if (spotifyAlbum) {
    metadata.mostPopularAlbum = spotifyAlbum
  }

  // Step 3: Fetch TheAudioDB data (bio, genre, fallback artist photo)
  const audioDbInfo = await audioDb.getArtistInfo(artistName)
  if (audioDbInfo) {
    metadata.image = audioDbInfo.image           // Fallback artist photo
    metadata.bio = audioDbInfo.bio
    metadata.genres = audioDbInfo.genres
    metadata.source = 'theaudiodb'
  }

  // Step 4: Fallback to Last.fm if no artist photo yet
  if (!metadata.spotifyArtist?.images?.large && !metadata.image) {
    const lastFmInfo = await lastFm.getArtistInfo(artistName)
    if (lastFmInfo?.image) {
      metadata.image = lastFmInfo.image
      metadata.source = 'lastfm'
    }
  }

  return metadata
}
```

---

### Phase 2: Frontend Hook Updates

#### 2.1 Enhance `useArtistMetadata` Hook

**File:** `src/components/TimelineHoverPreview/useArtistMetadata.ts`

```typescript
export function useArtistMetadata() {
  // ... existing state/loading logic ...

  /**
   * Get artist photo with new priority:
   * 1. Spotify artist images (NEW)
   * 2. TheAudioDB artist photo
   * 3. Last.fm artist photo
   * 4. undefined (triggers gradient fallback)
   */
  const getArtistImage = (artistName: string, size: 'small' | 'medium' | 'large' = 'medium'): string | undefined => {
    const artist = getArtistMetadata(artistName)
    if (!artist) return undefined

    // Priority 1: Spotify artist images (NEW)
    if (artist.spotifyArtist?.images?.[size]) {
      return artist.spotifyArtist.images[size]
    }

    // Priority 2: TheAudioDB or Last.fm (existing single image)
    if (artist.image) {
      return artist.image
    }

    return undefined
  }

  /**
   * Get album cover art (NEW)
   * For gatefold front cover and future Spotify player
   */
  const getAlbumCover = (artistName: string, size: 'small' | 'medium' | 'large' = 'large'): string | undefined => {
    const artist = getArtistMetadata(artistName)
    if (!artist) return undefined

    // Priority 1: Spotify album covers
    if (artist.mostPopularAlbum?.coverArt?.[size]) {
      return artist.mostPopularAlbum.coverArt[size]
    }

    return undefined
  }

  return {
    metadata,
    loading,
    error,
    getArtistMetadata,
    getArtistImage,      // Enhanced with Spotify priority
    getAlbumCover,       // NEW function
  }
}
```

#### 2.2 Update Component Usage

**No changes needed for existing components** - they already use `getArtistImage()`:

- `TimelineHoverContent.tsx` - Already uses `getArtistImage()` ✅
- `ConcertHistoryPanel.tsx` - Already uses `getArtistImage()` ✅

**New usage for gatefold front cover:**

**File:** `src/components/scenes/ArtistScene/ArtistGatefold.tsx`

```typescript
import { useArtistMetadata } from '../../TimelineHoverPreview/useArtistMetadata'

export function ArtistGatefold({ artist, onClose }: ArtistGatefoldProps) {
  const { getAlbumCover } = useArtistMetadata()
  const albumCover = getAlbumCover(artist.name, 'large') // 400×400px cover

  return (
    // ...
    {/* Front of cover - show album art or gradient */}
    <div className="cover-front">
      {albumCover ? (
        <img
          src={albumCover}
          alt={`${artist.name} album cover`}
          className="w-full h-full object-cover"
        />
      ) : (
        <ArtistPlaceholder artist={artist} />
      )}
    </div>
    // ...
  )
}
```

---

## Rollout Strategy

### Step 1: Data Enrichment (Backend)
**Estimated Time:** 4-6 hours

1. Create `enrich-spotify-artist-images.ts` script
2. Update `enrich-artists.ts` to call Spotify artist endpoint
3. Run enrichment on all 174+ artists
4. Validate new data structure in `artists-metadata.json`
5. Update documentation in `DATA_PIPELINE.md`

**Deliverables:**
- New enrichment script
- Updated `artists-metadata.json` with `spotifyArtist.images` field
- ~80-120 artists expected to have Spotify images (Spotify has broader coverage than TheAudioDB)

### Step 2: Hook Enhancement (Frontend Foundation)
**Estimated Time:** 2-3 hours

1. Update `useArtistMetadata` hook with new `getAlbumCover()` function
2. Enhance `getArtistImage()` to prioritize Spotify artist images
3. Add TypeScript interfaces for new data structure
4. Write unit tests for new functions

**Deliverables:**
- Enhanced hook with Spotify priority
- Type-safe interfaces
- Backward compatible (existing components work unchanged)

### Step 3: Timeline & Gatefold Inside (Auto-Enhanced)
**Estimated Time:** 0 hours (no changes needed)

- Timeline Hover Preview automatically uses Spotify images ✅
- Gatefold Inside Cover automatically uses Spotify images ✅
- Both components already call `getArtistImage()` which now prioritizes Spotify

**Result:** Immediate visual improvement with zero code changes

### Step 4: Gatefold Front Cover (New Feature)
**Estimated Time:** 3-4 hours

1. Modify `ArtistGatefold.tsx` to use `getAlbumCover()`
2. Replace gradient front cover with album artwork when available
3. Maintain gradient + initials fallback
4. Test with artists that have/don't have album covers
5. Adjust cover styling (border radius, shadows, etc.)

**Deliverables:**
- Gatefold shows album covers on front
- Graceful fallback to gradient + initials
- Visual polish and testing

### Step 5: Documentation & Testing
**Estimated Time:** 2-3 hours

1. Update all specs with new image sourcing strategy
2. Document new data structure
3. Update `DATA_PIPELINE.md` with Spotify artist images section
4. Cross-browser testing
5. Performance validation (no additional runtime API calls)

**Deliverables:**
- Updated specifications
- Complete documentation
- Test results

---

## API Rate Limiting & Costs

### Spotify API

**Rate Limits:**
- ~180 requests per minute (3 req/sec)
- Our existing 350ms delay stays the same

**New Calls:**
1. Search for artist by name (1 call per artist)
2. Get artist details for images (1 call per artist)

**Total:** 2 additional calls per artist during enrichment

**For 174 artists:**
- 348 additional API calls
- At 350ms delay: ~2 minutes total enrichment time
- Cost: $0 (Spotify API is free)

### TheAudioDB & Last.fm

**No changes** - still used as fallbacks

---

## Expected Coverage

Based on typical API coverage rates:

| Source | Expected Coverage | Notes |
|--------|------------------|-------|
| Spotify Artist Images | 80-120 artists (46-69%) | Highest coverage, major label artists |
| Spotify Album Covers | 100-130 artists (57-75%) | Already fetched, good coverage |
| TheAudioDB | 94 artists (54%) | Current coverage, remains as fallback |
| Last.fm | 80-100 artists (46-57%) | Final fallback |
| Gradient Fallback | ~20-40 artists (11-23%) | Obscure/indie artists |

**Combined coverage:** ~95% of artists will have real imagery (Spotify or fallback sources)

---

## Migration Plan

### Backward Compatibility

✅ **Existing components continue to work** - `getArtistImage()` is enhanced, not replaced
✅ **Old metadata structure supported** - Hook checks for new fields, falls back gracefully
✅ **No breaking changes** - Timeline and Gatefold Inside work immediately with new data

### Data Migration

1. **Enrichment run:** `npm run build-data` fetches new Spotify artist images
2. **Git commit:** New `artists-metadata.json` with enhanced structure
3. **Deploy:** Frontend automatically uses new images (hook reads enhanced data)

**No user-facing migration needed** - seamless transition

---

## Testing Checklist

### Data Enrichment
- [ ] Spotify artist images endpoint returns valid data
- [ ] Images array contains multiple sizes (large, medium, small)
- [ ] Enrichment handles artists not found on Spotify gracefully
- [ ] Rate limiting prevents API throttling
- [ ] Metadata file size remains reasonable (<500KB)

### Frontend Display
- [ ] Timeline Hover shows Spotify artist images (when available)
- [ ] Timeline Hover falls back to TheAudioDB/Last.fm correctly
- [ ] Gatefold Inside shows Spotify artist images (when available)
- [ ] Gatefold Front shows Spotify album covers (when available)
- [ ] Gatefold Front falls back to gradient + initials
- [ ] Image loading is smooth (no flashing/jank)
- [ ] Object-fit: cover crops images appropriately

### Cross-Feature Consistency
- [ ] Same artist shows same photo in timeline hover and gatefold inside
- [ ] Different image types shown correctly (artist photo vs album cover)
- [ ] All fallbacks work (Spotify → TheAudioDB → Last.fm → Gradient)
- [ ] No console errors for missing images

### Performance
- [ ] No additional runtime API calls (all data pre-fetched)
- [ ] Page load time unchanged
- [ ] No memory leaks with multiple gatefold opens
- [ ] Smooth animations maintained

---

## Success Metrics

**Image Coverage:**
- Target: 90%+ artists with real imagery (vs 54% current)
- Success: Spotify + fallbacks provide imagery for 160+ of 174 artists

**Visual Quality:**
- Spotify images expected to be higher resolution than TheAudioDB
- Consistent image quality across features

**User Experience:**
- Immediate visual improvement in timeline hover and gatefold
- Album covers on gatefold front create authentic vinyl experience
- Graceful fallbacks maintain design consistency

---

## Future Enhancements

Once this unified strategy is in place:

1. **Search Results** - Show artist photos in search (reuse `getArtistImage()`)
2. **Artist Detail Modals** - Richer modals with large artist photos
3. **Spotify Player Integration** - Album covers in track listings (reuse `getAlbumCover()`)
4. **Top Artists View** - Photo grid of most-seen artists
5. **Mobile Optimization** - Responsive image sizes (already supported via size parameter)

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [gatefold-artist-photo.md](../implemented/gatefold-artist-photo.md) | v1.4.1 implementation (to be superseded) |
| [artist-scene.md](../implemented/artist-scene.md) | Gatefold design spec |
| [artists-spotify-integration.md](artists-spotify-integration.md) | Future Spotify player integration |
| [DATA_PIPELINE.md](../../DATA_PIPELINE.md) | Data enrichment documentation |
| [api-setup.md](../../api-setup.md) | Spotify API configuration |

---

## Implementation Decisions

- ✅ **Enrichment Strategy:** Full re-enrichment (Option A) - Run `npm run build-data` once for all 174 artists (~5-10 minutes)
- ✅ **Gatefold Front Styling:** Sharp corners (0px border-radius) to match vinyl aesthetic and "wall of records" background
- ✅ **Retina Support:** Yes - Use `large` size (640px) for high-DPI screens (devicePixelRatio > 1)
- ✅ **Image Storage:** Spotify CDN with URL-only storage (no local caching) - complies with TOS, relies on browser cache

---

**Implementation Estimate:** 12-16 hours total
**Risk Level:** Low (additive changes, backward compatible)
**Dependencies:** Spotify API access (already configured)
**Proposed Release:** v1.5.0

---

*Created: 2026-01-03*
*Author: Claude Code + User*
*Supersedes: gatefold-artist-photo.md image sourcing approach*
