# Spotify Artist Integration Spec

> **Location**: `docs/specs/future/artists-spotify-integration.md`
> **Status**: Planned (v1.5.0+)
> **Prerequisites**: Gatefold animation (✅ implemented in [artist-scene.md](../implemented/artist-scene.md))
> **Mobile Note**: 📱 Mini-player requires mobile-specific bottom sheet layout (see [mobile-optimization.md](mobile-optimization.md))
> **Related**: [runbook-global-spotify-enrichment.md](./runbook-global-spotify-enrichment.md) (enrichment script runbook)

---

## Executive Summary

This spec defines the complete Spotify integration for the Artist Scene: album cover art on card fronts, artist metadata in the gatefold, and a 30-second preview mini-player. All data is fetched at **build time**—zero Spotify API calls at runtime.

**What this delivers:**
- Album art replaces genre-colored placeholders on artist cards
- Top tracks with 30-second previews inside the gatefold's right panel
- "Open in Spotify" deep links throughout

**What this does NOT include:**
- OAuth user authentication
- Full track playback (Web Playback SDK)
- Runtime API calls

---

## Context: Where Spotify Content Appears

The Artist Scene gatefold (already implemented) has two panels:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────────────┐ ┌─────────────────────────┐   │
│   │                         │ │                         │   │
│   │      LEFT PANEL         │ │      RIGHT PANEL        │   │
│   │   (Concert History)     │ │   (Spotify Player)      │   │
│   │                         │ │                         │   │
│   │   ✅ Implemented        │ │   ⚠️ Skeleton only      │   │
│   │                         │ │   THIS SPEC COVERS      │   │
│   │                         │ │                         │   │
│   └─────────────────────────┘ └─────────────────────────┘   │
│                         ▲                                   │
│                       spine                                 │
└─────────────────────────────────────────────────────────────┘
```

Additionally, the **card front** (in the mosaic grid) currently shows genre-colored placeholders with artist initials. This spec replaces those with actual album art.

**Reference**: See [artist-scene.md](../implemented/artist-scene.md) for gatefold animation details, panel dimensions, and CSS implementation.

---

## Data Architecture

### Source Files

| File | Purpose |
|------|---------|
| `concerts.json` | Canonical concert list (source of truth for artists) |
| `artists-metadata.json` | Enriched Spotify data (generated at build time) |
| `spotify-overrides.json` | Manual artist ID corrections for ambiguous names |

### Artist Metadata Schema

```typescript
interface ArtistMetadata {
  name: string;
  normalizedName: string;  // Lowercase, no punctuation (for matching)
  
  // Spotify identifiers
  spotifyArtistId?: string;
  spotifyArtistUrl?: string;
  
  // Album art (from most representative album)
  albumArt?: {
    albumName: string;
    albumId: string;
    albumUrl: string;
    releaseYear: number;
    images: {
      small: string;   // 64px  — lazy load placeholder
      medium: string;  // 300px — S/M cards
      large: string;   // 640px — L/XL cards, gatefold
    };
  };
  
  // Top tracks for mini-player
  topTracks?: {
    name: string;
    trackId: string;
    spotifyUrl: string;
    previewUrl: string | null;  // 30-sec MP3, may be null
    durationMs: number;
    albumName: string;
    albumArt: string;  // Small image for track row
  }[];
  
  // Enrichment metadata
  enrichedAt?: string;  // ISO timestamp
  matchConfidence?: 'high' | 'low' | 'manual';  // How we found them
}
```

### Merged Runtime Model

At runtime, concert data and metadata merge into:

```typescript
interface ArtistCard {
  // From concerts.json aggregation
  name: string;
  normalizedName: string;
  timesSeen: number;
  sizeClass: 'xl' | 'l' | 'm' | 's';
  primaryGenre: string;
  concerts: { date: string; venue: string; city: string }[];
  
  // From artists-metadata.json (may be undefined)
  spotify?: {
    artistUrl: string;
    albumArt: ArtistMetadata['albumArt'];
    topTracks: ArtistMetadata['topTracks'];
  };
}
```

---

## Album Art Selection Logic

The enrichment script must select the "most representative" album for each artist. This provides the card front image and the album name shown in the gatefold.

### Selection Algorithm

```typescript
async function selectRepresentativeAlbum(artistId: string): Promise<Album | null> {
  // 1. Fetch all albums (not singles, not compilations)
  const albums = await fetchArtistAlbums(artistId, {
    include_groups: 'album',  // Exclude singles, compilations, appears_on
    limit: 50,
    market: 'US'
  });
  
  if (albums.length > 0) {
    // 2. Sort by popularity (Spotify's score, 0-100)
    albums.sort((a, b) => b.popularity - a.popularity);
    return albums[0];
  }
  
  // 3. Fallback: Try singles/EPs if no albums
  const singles = await fetchArtistAlbums(artistId, {
    include_groups: 'single',
    limit: 20,
    market: 'US'
  });
  
  if (singles.length > 0) {
    singles.sort((a, b) => b.popularity - a.popularity);
    return singles[0];
  }
  
  // 4. Final fallback: Use artist image instead
  return null;  // Caller should fall back to artist.images[0]
}
```

### Fallback Hierarchy

| Priority | Source | When Used |
|----------|--------|-----------|
| 1 | Most popular studio album | Artist has albums |
| 2 | Most popular single/EP | No albums, but has singles |
| 3 | Artist profile image | No albums or singles |
| 4 | Genre-colored placeholder | Artist not found on Spotify |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Artist has only compilation appearances | Use `appears_on` with highest popularity |
| Cover band / tribute act not on Spotify | Falls through to placeholder; log for manual review |
| Multiple artists with same name | Use `spotify-overrides.json` for manual ID |
| Artist name returns wrong results (e.g., "Boston") | Use `spotify-overrides.json` for manual ID |

**Note**: The enrichment script should log all fallback cases for manual review:
```
⚠️ No albums found: "The Samples" → using single "Nature"
⚠️ Not found: "Local Opening Band" → using placeholder
```

---

## Card Front: Album Art Display

### Current State (Placeholder)
```
┌──────────────────┐
│                  │
│       SD         │  ← Genre-colored background
│    (initials)    │     with artist initials
│                  │
└──────────────────┘
```

### Target State (Album Art)
```
┌──────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Album cover, full bleed
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     (object-fit: cover)
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
└──────────────────┘
     1-2px genre-colored border
```

### Implementation Details

```tsx
// ArtistCard.tsx - Card front rendering

interface CardFrontProps {
  artist: ArtistCard;
  size: 'xl' | 'l' | 'm' | 's';
}

function CardFront({ artist, size }: CardFrontProps) {
  const imageUrl = getImageUrl(artist, size);
  const genreColor = getGenreColor(artist.primaryGenre);
  
  if (imageUrl) {
    return (
      <div 
        className="card-front"
        style={{ borderColor: genreColor }}
      >
        <img
          src={imageUrl}
          alt={`${artist.name} album art`}
          loading="lazy"
          onError={(e) => {
            // Fallback to placeholder on load error
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="placeholder hidden">
          {getInitials(artist.name)}
        </div>
      </div>
    );
  }
  
  // No Spotify data: show placeholder
  return (
    <div 
      className="card-front placeholder"
      style={{ backgroundColor: genreColor }}
    >
      {getInitials(artist.name)}
    </div>
  );
}

function getImageUrl(artist: ArtistCard, size: string): string | null {
  if (!artist.spotify?.albumArt) return null;
  
  // Select appropriate resolution based on card size
  const { images } = artist.spotify.albumArt;
  return (size === 'xl' || size === 'l') ? images.large : images.medium;
}
```

### Image Size by Card Tier

| Card Size | Dimensions | Image Source | Reasoning |
|-----------|------------|--------------|-----------|
| XL | 200×200px | `large` (640px) | Crisp on retina displays |
| L | 150×150px | `large` (640px) | Crisp on retina displays |
| M | 120×120px | `medium` (300px) | Sufficient quality, smaller payload |
| S | 90×90px | `medium` (300px) | Sufficient quality, smaller payload |

### Spotify TOS Compliance

Per Spotify's Design Guidelines:

- ✅ Album art displayed full-bleed, uncropped
- ✅ No overlays, text, or logos on album art
- ✅ Genre border is *around* the image, not on it
- ✅ Links to Spotify provided in gatefold

---

## Gatefold Right Panel: Spotify Mini-Player

### Current State (Skeleton)

The right panel currently shows a "Coming Soon" skeleton:

```
┌──────────────────────────────────┐
│                                  │
│     🎵 TOP TRACKS                │
│     ────────────────────         │
│                                  │
│     ┌────┐                       │
│     │ ▶  │  (muted, 50% opacity) │
│     └────┘                       │
│                                  │
│     Spotify Integration          │
│     Coming Soon                  │
│                                  │
│     ▬▬▬▬▬▬▬▬▬▬  (skeleton bars)  │
│     ▬▬▬▬▬▬▬▬                     │
│     ▬▬▬▬▬▬▬▬▬▬▬▬                 │
│     ▬▬▬▬▬▬▬                      │
│                                  │
└──────────────────────────────────┘
```

### Target State (Live Player)

```
┌──────────────────────────────────┐
│                                  │
│  🎵 TOP TRACKS                   │
│  ────────────────────────────    │
│                                  │
│  ┌──────────────────────────┐    │
│  │                          │    │
│  │   ┌─────┐                │    │  ← Play All button
│  │   │  ▶  │                │    │     (Spotify green)
│  │   └─────┘                │    │
│  │                          │    │
│  │ 1  ┌───┐ Ball and Chain  │    │  ← Track rows
│  │    │art│ 3:45            │    │     (clickable)
│  │    └───┘                 │    │
│  │ 2  ┌───┐ Story of My... │    │
│  │    │art│ 4:12  (grayed)  │    │  ← No preview: grayed out
│  │    └───┘                 │    │
│  │ 3  ┌───┐ Reach for Sky   │    │
│  │    │art│ 3:58            │    │
│  │    └───┘                 │    │
│  │                          │    │
│  └──────────────────────────┘    │
│                                  │
│  🔗 Open in Spotify              │  ← Deep link to artist
│                                  │
└──────────────────────────────────┘
```

### Component Structure

```tsx
// SpotifyMiniPlayer.tsx

interface SpotifyMiniPlayerProps {
  tracks: ArtistMetadata['topTracks'];
  artistName: string;
  artistUrl: string;
}

export function SpotifyMiniPlayer({ 
  tracks, 
  artistName, 
  artistUrl 
}: SpotifyMiniPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // ... implementation
}
```

### Track Row States

| State | Visual Treatment | Behavior |
|-------|------------------|----------|
| **Default** | White text, visible art | Clickable, plays on click |
| **Playing** | Spotify green highlight, animated bars | Click pauses |
| **No Preview** | 50% opacity, disabled cursor | Not clickable, no play icon |
| **Loading** | Spinner replacing play icon | Not clickable during load |

### Track Without Preview URL

When `previewUrl` is `null` (Spotify doesn't provide a preview for this track):

```tsx
function TrackRow({ track, index, onPlay, isPlaying }: TrackRowProps) {
  const hasPreview = track.previewUrl !== null;
  
  return (
    <div 
      className={cn(
        "track-row",
        !hasPreview && "opacity-50 cursor-not-allowed",
        isPlaying && "bg-spotify-green/10"
      )}
      onClick={hasPreview ? () => onPlay(index) : undefined}
      role={hasPreview ? "button" : undefined}
      aria-disabled={!hasPreview}
    >
      <span className="track-number">{index + 1}</span>
      <img src={track.albumArt} alt="" className="track-art" />
      <div className="track-info">
        <span className="track-name">{track.name}</span>
        <span className="track-duration">{formatDuration(track.durationMs)}</span>
      </div>
      {hasPreview ? (
        <PlayIcon className={isPlaying ? "text-spotify-green" : ""} />
      ) : (
        <span className="text-xs text-gray-500">No preview</span>
      )}
    </div>
  );
}
```

### Audio Playback Logic

```tsx
// Core playback logic

function useAudioPlayer(tracks: Track[]) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const play = useCallback((index: number) => {
    const track = tracks[index];
    if (!track?.previewUrl || !audioRef.current) return;
    
    // If clicking same track, toggle play/pause
    if (index === currentIndex) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
    
    // New track: load and play
    audioRef.current.src = track.previewUrl;
    audioRef.current.play();
    setCurrentIndex(index);
    setIsPlaying(true);
  }, [tracks, currentIndex, isPlaying]);
  
  // Auto-advance to next playable track when preview ends
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleEnded = () => {
      // Find next track with a preview
      let nextIndex = (currentIndex ?? -1) + 1;
      while (nextIndex < tracks.length) {
        if (tracks[nextIndex].previewUrl) {
          play(nextIndex);
          return;
        }
        nextIndex++;
      }
      // No more tracks: stop
      setIsPlaying(false);
      setCurrentIndex(null);
    };
    
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentIndex, tracks, play]);
  
  return { audioRef, currentIndex, isPlaying, play };
}
```

### "Play All" Behavior

The "Play All" button starts playback from the first track that has a preview URL:

```tsx
function handlePlayAll() {
  const firstPlayableIndex = tracks.findIndex(t => t.previewUrl !== null);
  if (firstPlayableIndex >= 0) {
    play(firstPlayableIndex);
  }
}
```

### Gatefold Close Behavior

When the gatefold closes (user presses ESC or clicks outside):

```tsx
// In gatefold close handler
function handleClose() {
  // Stop any playing audio
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
  }
  // ... rest of close animation
}
```

---

## Mobile Considerations

> **Note**: Mobile implementation is handled in the [Mobile Optimization](./mobile-optimization.md) project. This section defines *what* should appear on mobile; that spec defines *how*.

### Mobile Layout (Bottom Sheet)

On viewports <768px, the gatefold is replaced with a bottom sheet. Spotify content appears below concert history:

```
┌─────────────────────────────────┐
│ ═══════════════════             │  ← Drag handle
│                                 │
│ Artist Name                     │
│ Seen 5 times • Rock             │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ CONCERT HISTORY                 │
│ • Mar 2019 — Red Rocks          │
│ • Jul 2020 — The Fillmore       │
│ • ...                           │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 🎵 TOP TRACKS                   │
│                                 │
│ ▶ Ball and Chain      3:45     │  ← Simplified row layout
│   Story of My Life    4:12     │     (no album art on mobile)
│ ▶ Reach for the Sky   3:58     │
│                                 │
│ 🔗 Open in Spotify              │
│                                 │
└─────────────────────────────────┘
```

### Mobile-Specific Adjustments

| Element | Desktop | Mobile |
|---------|---------|--------|
| Track album art | 40×40px thumbnails | Hidden (save space) |
| Track rows | Click anywhere to play | Larger touch targets (48px min height) |
| Play All button | Prominent | Smaller, but still accessible |
| Spotify link | Bottom of panel | Bottom of sheet |

---

## Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move between track rows |
| `Enter` / `Space` | Play/pause focused track |
| `Escape` | Close gatefold (stops playback) |

### ARIA Attributes

```tsx
// Mini-player container
<div
  role="region"
  aria-label={`Top tracks by ${artistName}`}
>
  <audio ref={audioRef} aria-hidden="true" />
  
  {/* Track list */}
  <div role="list" aria-label="Track list">
    {tracks.map((track, i) => (
      <div
        role="listitem"
        aria-label={`${track.name}, ${formatDuration(track.durationMs)}`}
        aria-disabled={!track.previewUrl}
      >
        ...
      </div>
    ))}
  </div>
</div>

// Currently playing announcement
{isPlaying && (
  <div aria-live="polite" className="sr-only">
    Now playing: {tracks[currentIndex].name}
  </div>
)}
```

### Screen Reader Announcements

- When playback starts: "Now playing: [track name]"
- When playback ends: "Playback ended"
- For tracks without previews: "Preview not available"

---

## Spotify TOS Compliance Checklist

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Album art unmodified | Full-bleed display, no overlays | ✅ Designed |
| Attribution visible | Spotify icon in player header | ✅ Designed |
| Link to Spotify | "Open in Spotify" on every gatefold | ✅ Designed |
| Preview clips only | 30-second `previewUrl` from API | ✅ Designed |
| No audio caching | Stream directly from Spotify CDN | ✅ Designed |
| No playback without user action | Requires click to play | ✅ Designed |

---

## Implementation Checklist

### Phase 1: Data Pipeline

- [ ] Update `scripts/enrich-spotify-metadata.ts` with album selection logic
- [ ] Add fallback hierarchy (albums → singles → artist image)
- [ ] Implement low-confidence match logging
- [ ] Add `albumArt` and `topTracks` to metadata schema
- [ ] Test enrichment on subset (10 artists) before full run
- [ ] Run full enrichment, review warnings
- [ ] Update `spotify-overrides.json` for mismatches

### Phase 2: Card Front Album Art

- [ ] Update `ArtistCard.tsx` to use album art when available
- [ ] Implement lazy loading with `loading="lazy"`
- [ ] Add error fallback to placeholder
- [ ] Verify genre border doesn't overlay image
- [ ] Test all size tiers (XL, L, M, S)

### Phase 3: Mini-Player Component

- [ ] Create `SpotifyMiniPlayer.tsx` component
- [ ] Implement `useAudioPlayer` hook
- [ ] Add track row component with all states
- [ ] Implement Play All functionality
- [ ] Handle auto-advance through tracks
- [ ] Stop playback on gatefold close
- [ ] Add "Open in Spotify" deep link

### Phase 4: Integration & Polish

- [ ] Replace skeleton in gatefold right panel
- [ ] Conditionally render player vs. skeleton based on data availability
- [ ] Keyboard navigation testing
- [ ] Screen reader testing
- [ ] Reduced motion testing
- [ ] Performance audit (no layout shifts)

### Phase 5: Mobile (Deferred to Mobile Optimization)

- [ ] Document mobile requirements in [mobile-optimization.md](./mobile-optimization.md)
- [ ] Track row touch target sizing
- [ ] Bottom sheet Spotify section layout

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/scenes/ArtistScene/SpotifyMiniPlayer.tsx` | Create | New mini-player component |
| `src/components/scenes/ArtistScene/useAudioPlayer.ts` | Create | Playback hook |
| `src/components/scenes/ArtistScene/TrackRow.tsx` | Create | Individual track row component |
| `src/components/scenes/ArtistScene/ArtistCard.tsx` | Modify | Add album art support |
| `src/components/scenes/ArtistScene/ArtistCardBack.tsx` | Modify | Replace skeleton with player |
| `scripts/enrich-spotify-metadata.ts` | Modify | Add album selection logic |
| `src/types/artist.ts` | Modify | Update TypeScript interfaces |

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| What if artist has no albums? | Fall back to singles, then artist image, then placeholder |
| Track without preview URL? | Show grayed out with "No preview" text |
| Volume controls? | No—use system volume |
| Mobile layout? | Defined here, implemented in Mobile Optimization spec |
| Runtime vs. build-time API calls? | Build-time only |

---

## References

- [artist-scene.md](../implemented/artist-scene.md) — Gatefold animation (implemented)
- [runbook-global-spotify-enrichment.md](./runbook-global-spotify-enrichment.md) — Enrichment script runbook
- [mobile-optimization.md](./mobile-optimization.md) — Mobile bottom sheet implementation
- [Spotify Web API Docs](https://developer.spotify.com/documentation/web-api)
- [Spotify Design Guidelines](https://developer.spotify.com/documentation/design)