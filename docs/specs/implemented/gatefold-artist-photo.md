# Gatefold Artist Photo Integration

> **Status:** Specification
> **Priority:** Medium
> **Related:** [artist-scene.md](../implemented/artist-scene.md), [spotify-artist-integration.md](spotify-artist-integration.md)

## Overview

Replace the current color/letter placeholder in the gatefold's inside cover (Concert History Panel) with artist photos when available. This feature brings visual consistency with the Timeline Hover Preview implementation while maintaining the existing fallback design for artists without images.

## Visual Reference

**Current State:**
```
┌────────────────────────────────────────┐
│  ┌──────┐  Artist Name                 │
│  │  BS  │  Rockabilly · 1 show         │
│  │      │                              │
│  └──────┘                              │
│  100×100px                             │
│  (Gradient with initials)              │
│                                        │
│  CONCERT HISTORY                       │
│  ──────────────────────────────────    │
│  26 Feb 2024    The Wiltern            │
└────────────────────────────────────────┘
```

**Enhanced State:**
```
┌────────────────────────────────────────┐
│  ┌──────┐  Artist Name                 │
│  │      │  Rockabilly · 1 show         │
│  │ 📷   │                              │
│  └──────┘                              │
│  100×100px                             │
│  (Artist photo, rounded)               │
│                                        │
│  CONCERT HISTORY                       │
│  ──────────────────────────────────    │
│  26 Feb 2024    The Wiltern            │
└────────────────────────────────────────┘
```

## Design Specifications

### Image Display Properties

**Size:** 100×100px (square, unchanged from current placeholder)

**Scaling/Cropping:**
- `object-fit: cover` - Maintains aspect ratio, crops to fit square
- `object-position: center` - Centers the crop area
- Ensures faces/subjects are centered when possible

**Border Radius:** 8px
- Subtle rounding to distinguish from potential album art
- Softer aesthetic than sharp corners
- Visually distinct from the timeline hover (which uses sharp corners)

**Container:**
- Same positioning as current gradient placeholder (top-left of panel)
- Maintains existing layout and text positioning
- No change to overall panel dimensions (400×400px)

### Image Source Priority

Uses the **exact same data pipeline** as Timeline Hover Preview:

#### 1. Primary: Spotify API (Album Cover)
- Source: `/public/data/artists-metadata.json`
- Field: `mostPopularAlbum.coverArt.medium` (300px)
- Fallback within Spotify data: `.small` (64px) or `.large` (640px)

#### 2. Secondary: TheAudioDB
- Source: `/public/data/artists-metadata.json`
- Field: `image` (from strArtistThumb or strArtistLogo)

#### 3. Tertiary: Last.fm
- Source: `/public/data/artists-metadata.json`
- Field: `image` (large/extralarge size)

#### 4. Fallback: Current Design
- Color/letter gradient placeholder (unchanged)
- Genre-based color via `getGenreColor(artist.primaryGenre)`
- Two-letter initials

### Implementation Logic

```typescript
// Pseudocode
const displayImage = () => {
  const metadata = getArtistMetadata(artist.name);

  if (metadata?.image) {
    return (
      <img
        src={metadata.image}
        alt={artist.name}
        style={{
          width: '100px',
          height: '100px',
          objectFit: 'cover',
          objectPosition: 'center',
          borderRadius: '8px',
        }}
      />
    );
  }

  // Fallback to existing gradient + initials
  return <ArtistPlaceholder artist={artist} />;
};
```

## Component Changes

### File to Modify

**[ConcertHistoryPanel.tsx](../../../src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx)**

Lines 48-59 (current gradient placeholder) should be enhanced with conditional rendering:

```tsx
// Current (lines 48-59):
<div
  className="w-[100px] h-[100px] rounded-lg flex items-center justify-center text-white text-3xl font-bold mb-4"
  style={{ background: genreGradient }}
>
  {initials}
</div>

// Enhanced:
{artistImage ? (
  <img
    src={artistImage}
    alt={artist.name}
    className="w-[100px] h-[100px] rounded-lg object-cover object-center"
    style={{ objectFit: 'cover', objectPosition: 'center' }}
  />
) : (
  <div
    className="w-[100px] h-[100px] rounded-lg flex items-center justify-center text-white text-3xl font-bold"
    style={{ background: genreGradient }}
  >
    {initials}
  </div>
)}
```

### Data Hook Integration

**Use existing `useArtistMetadata` hook:**

```typescript
import { useArtistMetadata } from '../../TimelineHoverPreview/useArtistMetadata';

function ConcertHistoryPanel({ artist }: ConcertHistoryPanelProps) {
  const { getArtistImage } = useArtistMetadata();
  const artistImage = getArtistImage(artist.name);

  // ... rest of component
}
```

**Note:** The hook already exists at:
`/src/components/TimelineHoverPreview/useArtistMetadata.ts`

It loads `/data/artists-metadata.json` and provides `getArtistImage(artistName)` which returns `string | undefined`.

## Data Pipeline (Already Implemented)

The artist metadata enrichment pipeline is already in place from the Timeline Hover Preview feature:

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/enrich-spotify-metadata.ts` | Fetch Spotify album art | ✅ Implemented |
| `scripts/enrich-artists.ts` | Fetch AudioDB/Last.fm images | ✅ Implemented |
| `scripts/utils/theaudiodb-client.ts` | AudioDB API client | ✅ Implemented |
| `scripts/utils/lastfm-client.ts` | Last.fm API client | ✅ Implemented |
| `public/data/artists-metadata.json` | Compiled metadata with images | ✅ Generated |

**No additional data pipeline work required.** Simply reuse the existing metadata.

## Testing Checklist

### Visual Testing

- [ ] Artist with Spotify data → Shows album cover photo (rounded 8px)
- [ ] Artist with AudioDB data only → Shows AudioDB artist image
- [ ] Artist with Last.fm data only → Shows Last.fm image
- [ ] Artist with no metadata → Shows gradient + initials (existing fallback)
- [ ] Image loads correctly at 100×100px (no distortion)
- [ ] `object-fit: cover` crops appropriately (no stretching)
- [ ] Border radius (8px) visible on all four corners
- [ ] Text positioning unchanged (name, genre, concert count)

### Functional Testing

- [ ] Gatefold opens → image loads immediately (from metadata cache)
- [ ] Multiple gatefold open/close cycles → no image flashing
- [ ] Switch between artists → correct image displayed for each
- [ ] Artists with same name but different metadata → handles correctly
- [ ] Image load failure → falls back to gradient gracefully

### Performance Testing

- [ ] No additional network requests (all data from artists-metadata.json)
- [ ] Image display < 50ms (already cached in memory)
- [ ] No memory leaks when opening/closing multiple gatefolds
- [ ] Works smoothly with 300+ artists

### Cross-Feature Consistency

- [ ] Same image shown in Timeline Hover Preview
- [ ] Same image shown in Gatefold Concert History Panel
- [ ] Same fallback logic across both features
- [ ] Consistent data normalization (artist name matching)

## Accessibility

### ARIA Attributes

```tsx
<img
  src={artistImage}
  alt={`Photo of ${artist.name}`}
  role="img"
  aria-label={`Artist photo for ${artist.name}`}
/>
```

### Fallback Behavior

When image fails to load:
```tsx
<img
  src={artistImage}
  alt={`Photo of ${artist.name}`}
  onError={(e) => {
    e.currentTarget.style.display = 'none';
    // Show gradient fallback
  }}
/>
```

## Implementation Phases

### Phase 1: Core Integration ✅ Spec Complete
- [x] Define image display properties
- [x] Specify data source priority
- [x] Document component changes
- [x] Create testing checklist

### Phase 2: Development
- [ ] Import `useArtistMetadata` hook into ConcertHistoryPanel
- [ ] Add conditional rendering logic (image vs gradient)
- [ ] Apply 8px border-radius styling
- [ ] Test with sample artists (with/without images)

### Phase 3: Visual Polish
- [ ] Verify image cropping looks good across artist types
- [ ] Ensure rounded corners render correctly on all browsers
- [ ] Check color contrast with background gradient
- [ ] Test dark mode compatibility (if applicable)

### Phase 4: Testing & Deployment
- [ ] Run full testing checklist
- [ ] Visual regression testing (screenshot comparison)
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Production deployment

## Success Criteria

- ✅ Artist photos display in gatefold when metadata available
- ✅ Fallback to gradient + initials when no image available
- ✅ Consistent with Timeline Hover Preview implementation
- ✅ No performance degradation
- ✅ Visually polished with 8px rounded corners
- ✅ Zero additional data pipeline work required

## Related Features

| Feature | Relationship | Status |
|---------|--------------|--------|
| Timeline Hover Preview | Uses same metadata pipeline | ✅ Implemented (v1.4.0) |
| Artist Scene Gatefold | Target component for enhancement | ✅ Implemented |
| Spotify Artist Integration | Future album art on gatefold front | 📋 Planned |
| Data Enrichment Pipeline | Provides artist metadata | ✅ Implemented |

## Open Questions

- [ ] Should we add a subtle loading skeleton while image loads? (Probably not needed since metadata is pre-loaded)
- [ ] Should we add hover effects on the image (e.g., slight zoom)? (Probably not, keeps it simple)
- [ ] Should mobile view use different border-radius? (Keep consistent at 8px)

---

**Implementation Estimate:** 2-3 hours
**Risk Level:** Low (reuses existing infrastructure)
**Dependencies:** None (all prerequisites implemented in v1.4.0)

---

*Created: 2026-01-03*
*Author: Claude Code + User (brainstorming session)*
*Related Release: v1.5.0 (proposed)*
