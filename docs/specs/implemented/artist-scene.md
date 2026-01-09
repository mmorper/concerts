# Artist Card Gatefold Animation Spec

## Overview

Replace the current flip-and-scale card interaction in the Artist Scene with a vinyl record gatefold-inspired animation. When a user clicks an artist tile, it flies to the center of the viewport and opens like a double gatefold album cover—revealing concert history on the left panel and a Spotify player on the right panel.

**Replaces:** Current `ArtistCard.tsx` flip interaction (scale 2x + rotateY 180°)  
**Inspired by:** Physical double gatefold vinyl albums  
**Target:** Desktop-first with mobile bottom sheet fallback

---

## Visual Reference

The interaction mimics opening a vinyl gatefold album while sitting cross-legged with the album on your lap:

```
CLOSED STATE:                    OPEN STATE (bird's eye view):
┌──────────┐                     
│          │                        ╲ Left    ╱ Right
│  Album   │         →              ╲ Panel  ╱ Panel
│   Art    │                         ╲      ╱
│          │                          ╲    ╱
└──────────┘                           ╲__╱ ← Spine (lowest point)
   400×400                         
                                 Outer edges tilt TOWARD viewer (~15°)
                                 Spine is the valley/lowest point
```

---

## Animation Sequence

### Opening (Click Tile → Gatefold)

| Step | Duration | Easing | Description |
|------|----------|--------|-------------|
| 1. Dim background | 400ms | ease | Grid fades to 30% opacity with 6px blur |
| 2. Tile flies to center | 500ms | cubic-bezier(0.4, 0, 0.2, 1) | Clicked tile lifts from grid, flies to viewport center, scales from grid size to 400×400px |
| 3. Cover opens | 800ms | cubic-bezier(0.4, 0, 0.2, 1) | Album cover swings open like a book (hinged on LEFT edge), revealing right panel underneath |
| 4. V-angle settles | (concurrent with step 3) | — | Both panels tilt to final "lap" position |
| 5. Show close hint | 600ms delay | fade | "Click anywhere or press ESC to close" appears below |

### Closing (Dismiss → Return to Grid)

| Step | Duration | Easing | Description |
|------|----------|--------|-------------|
| 1. Cover closes | 800ms | cubic-bezier(0.4, 0, 0.2, 1) | Cover swings back to closed position |
| 2. Tile returns | 400ms | cubic-bezier(0.4, 0, 0.2, 1) | Tile shrinks and flies back to original grid position |
| 3. Restore background | 400ms | ease | Grid returns to full opacity, blur removed |
| 4. Show original tile | immediate | — | Original tile becomes visible again |

---

## Component Structure

### Desktop Layout (≥768px)

```
┌─────────────────────────────────────────────────────────────┐
│                     VIEWPORT (dimmed grid)                   │
│                                                              │
│         ┌────────────┬────┬────────────┐                    │
│         │            │    │            │                    │
│         │   LEFT     │ S  │   RIGHT    │                    │
│         │  PANEL     │ P  │   PANEL    │                    │
│         │            │ I  │            │                    │
│         │  (Artist   │ N  │  (Spotify  │                    │
│         │   Info)    │ E  │   Player)  │                    │
│         │            │    │            │                    │
│         │  400×400   │12px│  400×400   │                    │
│         └────────────┴────┴────────────┘                    │
│                                                              │
│              Click anywhere or press ESC to close            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Total open width:** 812px (400 + 12 + 400)  
**Panel height:** 400px  
**Spine width:** 12px

### DOM Structure

```tsx
// Simplified structure - actual implementation uses Framer Motion
<div className="gatefold-overlay">           {/* Fixed, covers viewport */}
  <div className="gatefold-wrapper">         {/* Centers content, handles translateX for centering */}
    <div className="gatefold">               {/* Flex container for panels */}
      
      {/* Right Panel - Stationary, revealed as cover opens */}
      <div className="panel-right">
        <div className="spine" />            {/* Visual spine element */}
        <SpotifyPanel artist={artist} />
      </div>
      
      {/* Cover - Opens to become left panel */}
      <div className="album-cover">          {/* transform-origin: left center */}
        <div className="cover-front">        {/* Album art, backface-visibility: hidden */}
          <ArtistPlaceholder />
        </div>
        <div className="cover-back">         {/* Artist info, rotateY(180deg) */}
          <ConcertHistoryPanel />
        </div>
      </div>
      
    </div>
  </div>
</div>
```

---

## Panel Content Design

### Left Panel: Concert History (Inside of Cover)

> **✅ v1.4.1 Enhancement:** Artist photos now display when available (see [gatefold-artist-photo.md](gatefold-artist-photo.md))

```
┌────────────────────────────────────────┐
│  ┌──────┐  Artist Name                 │  ← Playfair Display, 1.875rem
│  │ 📷   │  Genre · X shows             │  ← Source Sans 3, 0.9rem, #a3a3a3
│  │      │                              │  ← 100×100px artist photo (8px rounded)
│  └──────┘                              │     OR gradient + initials if no photo
│         100×100px                      │
│                                        │
│  CONCERT HISTORY                       │  ← Label: 0.7rem, #1DB954, uppercase
│  ──────────────────────────────────    │
│  15 Sep 2024    Hollywood Bowl         │
│  22 Mar 2023    The Kia Forum          │
│  18 Oct 2022    Greek Theatre          │
│  03 Aug 2018    Hollywood Bowl         │  ← Scrollable if >8 concerts
│  19 Jul 2017    The Shrine             │
│  24 Apr 2014    Coachella              │
│  12 Nov 2010    Hollywood Palladium    │
│  08 Jun 2007    The Wiltern            │
└────────────────────────────────────────┘

Background: linear-gradient(145deg, #181818 0%, #121212 100%)

Artist Photo Details:
- Shows artist image when available (94 artists, 54%)
- Falls back to genre-colored gradient + initials (80 artists, 46%)
- 8px border radius (distinguishes from album art)
- Center-cropped with object-fit: cover
- Data sources: Spotify → AudioDB → Last.fm (same as timeline hover)
- Implementation: ConcertHistoryPanel.tsx uses useArtistMetadata hook
```

### Right Panel: Spotify Player

#### Phase 1: "Coming Soon" Skeleton State

Until Spotify API is integrated, show a placeholder that hints at the future functionality:

```
┌────────────────────────────────────────┐
│                                        │
│  🎵 TOP TRACKS                         │  ← Spotify green label
│  ──────────────────────────────────    │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │     ┌─────┐                      │  │
│  │     │  ▶  │   Spotify            │  │  ← Muted play button
│  │     └─────┘   Integration        │  │
│  │               Coming Soon        │  │  ← #737373 text
│  │                                  │  │
│  │   ┌────┐ ▬▬▬▬▬▬▬▬▬▬▬  3:45     │  │  ← Skeleton track rows
│  │   └────┘ ▬▬▬▬▬▬▬▬▬             │  │     (3-5 tracks)
│  │   ┌────┐ ▬▬▬▬▬▬▬▬▬▬▬▬  4:12    │  │
│  │   └────┘ ▬▬▬▬▬▬▬▬               │  │
│  │   ┌────┐ ▬▬▬▬▬▬▬▬▬▬  3:58      │  │
│  │   └────┘ ▬▬▬▬▬▬                 │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘

Skeleton colors:
- Track art placeholder: Genre color at 30% opacity
- Text bars: #2a2a2a (dark gray)
- "Coming Soon" text: #737373
- Play button: #1DB954 at 50% opacity
```

#### Phase 2: Full Spotify Integration (Future)

> 📌 **Detailed Spec**: See [artists-spotify-integration.md](../future/artists-spotify-integration.md) for complete implementation requirements including:
> - Track row component states
> - Playback logic and auto-advance
> - Keyboard navigation
> - Mobile considerations

```
┌────────────────────────────────────────┐
│                                        │
│  🎵 TOP TRACKS                         │
│  ──────────────────────────────────    │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  ┌─────┐                         │  │
│  │  │  ▶  │  ← Play all button      │  │  ← #1DB954 background
│  │  └─────┘                         │  │
│  │                                  │  │
│  │  1  ┌────┐ Track Name     3:45   │  │  ← Clickable rows
│  │     │ art│ Artist Name           │  │
│  │     └────┘                       │  │
│  │  2  ┌────┐ Track Name     4:12   │  │
│  │     │ art│ Artist Name           │  │
│  │     └────┘                       │  │
│  │  3  ┌────┐ Track Name     3:58   │  │
│  │     │ art│ Artist Name           │  │
│  │     └────┘                       │  │
│  │  4  ┌────┐ Track Name     5:21   │  │
│  │     │ art│ Artist Name           │  │
│  │     └────┘                       │  │
│  │  5  ┌────┐ Track Name     4:45   │  │
│  │     │ art│ Artist Name           │  │
│  │     └────┘                       │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

---

## CSS 3D Transform Details

### Key Transform Properties

```css
/* Perspective on overlay for 3D depth */
.gatefold-overlay {
  perspective: 2000px;
}

/* Wrapper handles centering shift during open/close */
.gatefold-wrapper {
  transform-style: preserve-3d;
  /* Closed: offset right so cover appears centered */
  transform: translateX(200px);
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.gatefold-wrapper.open {
  /* Open: shift left so full gatefold is centered */
  transform: translateX(0);
}

/* Cover hinged on LEFT edge */
.album-cover {
  transform-style: preserve-3d;
  transform-origin: left center;
  transform: rotateY(0deg);
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.gatefold-wrapper.open .album-cover {
  /* -180° to flip open + 15° back for V-angle (outer edge toward viewer) */
  transform: rotateY(-165deg);
}

/* Right panel V-angle */
.panel-right {
  transform-origin: left center;
  transform: rotateY(0deg);
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.gatefold-wrapper.open .panel-right {
  /* Outer edge tilts toward viewer */
  transform: rotateY(-15deg);
}

/* Front/back face visibility */
.cover-front,
.cover-back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.cover-back {
  transform: rotateY(180deg);
}
```

### V-Angle Explanation

The "vinyl on lap" effect:
- **Left panel (cover-back):** rotateY(-165deg) = -180° flip + 15° tilt toward viewer
- **Right panel:** rotateY(-15deg) = outer edge tilts toward viewer
- **Result:** Both outer edges are raised, spine is the lowest point (valley)

---

## Flying Tile Animation

The clicked tile must animate smoothly from its grid position to the center overlay:

```tsx
function openGatefold(tile: HTMLElement) {
  const rect = tile.getBoundingClientRect();
  const initials = tile.dataset.initials;
  const color = tile.dataset.color;
  
  // 1. Hide original tile
  tile.classList.add('hidden');
  
  // 2. Create flying tile at original position
  flyingTile.style.left = `${rect.left}px`;
  flyingTile.style.top = `${rect.top}px`;
  flyingTile.style.width = `${rect.width}px`;
  flyingTile.style.height = `${rect.height}px`;
  
  // 3. Animate to center (account for wrapper offset)
  const centerX = (window.innerWidth / 2);
  const centerY = (window.innerHeight / 2) - 200;
  
  flyingTile.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
  flyingTile.style.left = `${centerX}px`;
  flyingTile.style.top = `${centerY}px`;
  flyingTile.style.width = '400px';
  flyingTile.style.height = '400px';
  
  // 4. After arrival, swap to gatefold component
  setTimeout(() => {
    flyingTile.style.display = 'none';
    showGatefold();
  }, 500);
}
```

---

## Mobile Design (Bottom Sheet)

For viewports <768px, replace the gatefold with a bottom sheet that slides up:

```
┌─────────────────────────┐
│                         │
│     (dimmed grid)       │
│                         │
├─────────────────────────┤  ← Drag handle
│  ┌─────┐ Artist Name    │
│  │ Art │ Genre · X shows│
│  └─────┘                │
├─────────────────────────┤
│  CONCERT HISTORY        │
│  15 Sep 2024  Hollywood │
│  22 Mar 2023  Kia Forum │
│  ...                    │
├─────────────────────────┤
│  🎵 TOP TRACKS          │
│  Coming Soon            │
│  ▬▬▬▬▬▬▬▬ skeleton ▬▬▬ │
└─────────────────────────┘
```

### Mobile Behavior
- Tap tile → bottom sheet slides up (no flying animation)
- Sheet height: 70vh initially, draggable to 90vh
- Swipe down or tap backdrop to close
- Content scrolls within sheet
- Artist info and Spotify stacked vertically

---

## Integration with Existing Code

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/scenes/ArtistScene/ArtistCard.tsx` | Replace flip logic with gatefold trigger |
| `src/components/scenes/ArtistScene/ArtistMosaic.tsx` | Add overlay container, manage gatefold state |
| `src/components/scenes/ArtistScene/ArtistCardBack.tsx` | Repurpose as `ConcertHistoryPanel.tsx` |

### New Files to Create

| File | Purpose |
|------|---------|
| `ArtistGatefold.tsx` | Main gatefold overlay component |
| `GatefoldCover.tsx` | The openable cover (front + back faces) |
| `ConcertHistoryPanel.tsx` | Left panel content (refactored from ArtistCardBack) |
| `SpotifyPanel.tsx` | Right panel with player UI |
| `SpotifyPanelSkeleton.tsx` | "Coming Soon" placeholder state |
| `MobileArtistSheet.tsx` | Bottom sheet for mobile |

### Existing Patterns to Follow

| Pattern | Reference File | Usage |
|---------|----------------|-------|
| Genre colors | `src/constants/colors.ts` | `getGenreColor(genre)` for tile backgrounds |
| Framer Motion | `ArtistCard.tsx`, `ArtistMosaic.tsx` | Animation variants, AnimatePresence |
| Typography | Design guide | Playfair Display (titles), Source Sans 3 (body) |
| Reduced motion | `ArtistMosaic.tsx` | `prefers-reduced-motion` media query support |
| Artist data | `useArtistData.ts` | Artist type definition, concert data structure |

---

## Spotify API Integration (Future Phase)

### Required Endpoints

1. **Search for Artist**
   ```
   GET https://api.spotify.com/v1/search?type=artist&q={artist_name}
   ```
   Returns: Artist ID, artist images, Spotify URL

2. **Get Artist's Top Tracks**
   ```
   GET https://api.spotify.com/v1/artists/{id}/top-tracks?market=US
   ```
   Returns: Top 10 tracks with names, preview URLs, album art, Spotify URLs

### Authentication

Spotify requires OAuth 2.0. Options:
- **Client Credentials Flow** (server-side): For public data, no user login needed
- **Authorization Code Flow**: If user-specific data needed in future

Recommended: Client Credentials flow via a serverless function (Cloudflare Worker or Vercel Edge Function) to keep client secret secure.

### Caching Strategy

```typescript
// Cache structure
interface SpotifyCache {
  [artistId: string]: {
    data: SpotifyArtistData;
    fetchedAt: number;
    ttl: number; // 24 hours recommended
  }
}

// On gatefold open:
1. Check cache for artist
2. If cache hit && not expired → use cached data
3. If cache miss → fetch from API → store in cache
4. Display data (or skeleton while loading)
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Artist not found on Spotify | Show "Not on Spotify" message with search link |
| API rate limited | Show skeleton, retry after delay |
| Network error | Show skeleton with "Unable to load" message |
| No preview available | Hide play button for that track |

### Fallback Link

If Spotify data unavailable:
```
https://open.spotify.com/search/{encodeURIComponent(artistName)}
```

---

## Accessibility Requirements

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open gatefold (when tile focused) |
| `Escape` | Close gatefold |
| `Tab` | Navigate within open gatefold |

### ARIA Attributes

```tsx
// Tile
<div
  role="button"
  tabIndex={0}
  aria-label={`View ${artist.name} concert history`}
  aria-haspopup="dialog"
/>

// Gatefold overlay
<div
  role="dialog"
  aria-modal="true"
  aria-label={`${artist.name} details`}
>

// Close hint
<p aria-live="polite">Click anywhere or press Escape to close</p>
```

### Focus Management

1. When gatefold opens → focus moves to gatefold container
2. Focus trapped within gatefold while open
3. When closed → focus returns to original tile

### Reduced Motion

```tsx
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// If reduced motion preferred:
// - Skip flying tile animation (instant appear)
// - Skip cover opening animation (instant open)
// - Maintain V-angle for visual clarity
```

---

## Implementation Phases

### Phase 1: Core Gatefold Animation ✅ Prototyped
- [x] Design gatefold layout (400×400 panels, 12px spine)
- [x] Implement book-opening animation with correct hinge
- [x] Implement V-angle "vinyl on lap" effect
- [x] Implement flying tile animation
- [x] Implement centering logic during open/close
- [ ] **Port prototype to React/Framer Motion**

### Phase 2: Integration with Artist Scene
- [ ] Replace `ArtistCard.tsx` click handler
- [ ] Add gatefold overlay to `ArtistMosaic.tsx`
- [ ] Wire up artist data to gatefold panels
- [ ] Implement ESC key and click-outside to close
- [ ] Test with all 300+ artists

### Phase 3: Spotify Skeleton ("Coming Soon")
- [ ] Create `SpotifyPanelSkeleton.tsx` component
- [ ] Design skeleton track rows with genre-colored placeholders
- [ ] Add "Coming Soon" messaging
- [ ] Style to match Spotify dark theme

### Phase 4: Mobile Bottom Sheet
- [ ] Create `MobileArtistSheet.tsx` component
- [ ] Implement slide-up animation
- [ ] Stack concert history + Spotify skeleton vertically
- [ ] Add drag-to-dismiss gesture
- [ ] Test on iOS Safari and Android Chrome

### Phase 5: Accessibility & Polish
- [ ] Implement focus trap
- [ ] Add ARIA attributes
- [ ] Test with screen reader
- [ ] Add reduced motion support
- [ ] Performance audit (300+ tiles)

### Phase 6: Spotify Integration (Future)
- [ ] Set up Spotify API authentication
- [ ] Create `useSpotifyArtist.ts` hook
- [ ] Implement caching layer
- [ ] Replace skeleton with live data
- [ ] Add 30-second preview playback
- [ ] Handle error states

---

## Testing Checklist

### Functional
- [ ] Click tile → gatefold opens with animation
- [ ] Cover opens like a book (hinged on left)
- [ ] V-angle visible in open state
- [ ] Click overlay → gatefold closes
- [ ] Press ESC → gatefold closes
- [ ] Tile returns to correct grid position on close
- [ ] Works with first tile in grid
- [ ] Works with last tile in grid
- [ ] Works after scrolling in grid

### Visual
- [ ] Flying tile matches clicked tile exactly (color, initials)
- [ ] No content overflow in panels
- [ ] Spine visible between panels when open
- [ ] Smooth 60fps animation on desktop
- [ ] Genre colors applied correctly to placeholders

### Responsive
- [ ] Desktop (1920×1080): Gatefold centered
- [ ] Laptop (1366×768): Gatefold fits with margin
- [ ] Tablet (768px): Gatefold or bottom sheet (breakpoint)
- [ ] Mobile (375px): Bottom sheet slides up

### Accessibility
- [ ] Keyboard-only navigation works
- [ ] Screen reader announces gatefold open/close
- [ ] Focus trapped in open gatefold
- [ ] Focus returns to tile on close
- [ ] Reduced motion skips animations

---

## Reference Files

| Resource | Location |
|----------|----------|
| HTML Prototype | `/home/claude/gatefold-final.html` (from this design session) |
| Current flip implementation | `src/components/scenes/ArtistScene/ArtistCard.tsx` |
| Artist data hook | `src/components/scenes/ArtistScene/useArtistData.ts` |
| Genre colors | `src/constants/colors.ts` |
| Type definitions | `src/components/scenes/ArtistScene/types.ts` |
| Design guide | `docs/design/scene-design-guide.md` |

---

## Open Questions

- [ ] Should the gatefold cast a shadow on the dimmed background?
- [ ] Should there be a subtle parallax effect on hover (panels respond to mouse position)?
- [x] ~~For artists with album art, should the cover-front show the actual album art instead of initials?~~ → **Yes**, see [artists-spotify-integration.md](../future/artists-spotify-integration.md#card-front-album-art-display)
- [ ] Should the spine have a subtle texture or remain flat gradient?
