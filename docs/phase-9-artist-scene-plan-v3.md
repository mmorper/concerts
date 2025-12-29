# Artist Scene v3: Album Mosaic

> **This spec supersedes all previous Artist Scene plans**, including the v1 treemap concept (`Band_Scene_Plan`) and the v2 hybrid treemap/grid approach (`phase-9-artist_scene_plan_v2.md`). If you encounter references to treemaps, D3 brick walls, or hybrid layouts for the Artist Scene elsewhere in project documentation, disregard them in favor of this spec.

-----

## Executive Summary

The Artist Scene will be a **responsive mosaic of album covers** representing every artist in the concert history (headliners and openers combined). Think of it as a digital record store wall—visually striking, immediately recognizable, and rewarding exploration.

Cards are **sized by how many times the artist has been seen**, creating a natural visual hierarchy where favorite artists command more real estate. Each card **flips on click** to reveal concert history and a **Spotify mini-player** with 30-second track previews.

This approach was chosen over the treemap concept because:

- Album art is more visually engaging than colored rectangles with text
- The “flip to reveal” interaction adds depth without requiring modals
- It leverages Spotify’s rich media (covers, previews) rather than just metadata
- The record store metaphor resonates with the concert-going audience

-----

## Design Philosophy

### Why Album Covers?

The original treemap concept treated artists as data points—rectangles sized by frequency, colored by genre. Functional, but clinical.

Album covers transform the same data into something visceral. When you see *Rumours* or *The Dark Side of the Moon*, you don’t think “Fleetwood Mac, seen 3 times, Rock genre.” You *feel* something. That emotional resonance is what makes a concert tracker feel like a personal artifact rather than a spreadsheet.

### Why Flip Cards?

The v2 spec proposed click-to-open modals. Modals work, but they pull you out of the mosaic—suddenly you’re looking at a dialog box instead of a wall of art.

Flip cards keep you in context. The album cover rotates to reveal the “B-side”: your history with that artist. It’s tactile, it’s skeuomorphic (vinyl records have two sides), and it maintains the spatial relationship between cards.

### Why Spotify Integration?

Two reasons:

1. **Album art quality**: Spotify’s CDN serves high-resolution, professionally curated cover art. No hunting for images, no inconsistent quality.
1. **Audio previews**: Reading “Seen Social Distortion 5 times” is informative. *Hearing* the opening riff of “Ball and Chain” is evocative. The 30-second previews turn passive browsing into active reminiscence.

-----

## Data Architecture

### Source Data

The scene aggregates from two files:

1. **`concerts.json`** — The canonical concert list (175 concerts as of this writing)
1. **`artists-metadata.json`** — Enriched artist data from build-time API calls

### Aggregation Model

At runtime, concerts are aggregated into artist summaries:

```typescript
interface ArtistCard {
  name: string;
  normalizedName: string;       // Lowercase, no punctuation (for matching)
  timesSeen: number;
  sizeClass: 'xl' | 'l' | 'm' | 's';
  primaryGenre: string;         // Most frequent genre across appearances
  concerts: {
    date: string;               // ISO date
    venue: string;
    city: string;
  }[];
  // From artists-metadata.json
  albumCover?: string;          // Spotify CDN URL
  albumName?: string;
  spotifyArtistUrl?: string;
  topTracks?: {
    name: string;
    previewUrl: string | null;  // 30-sec MP3, may be null for some tracks
    spotifyUrl: string;
  }[];
}
```

### Metadata Schema

The enrichment script populates `artists-metadata.json` with Spotify data:

```typescript
interface ArtistMetadata {
  name: string;
  normalizedName: string;
  spotifyArtistId?: string;
  spotifyArtistUrl?: string;
  mostPopularAlbum?: {
    name: string;
    spotifyAlbumId: string;
    spotifyAlbumUrl: string;
    coverArt: {
      small: string;    // 64px  — lazy load placeholder
      medium: string;   // 300px — S/M cards
      large: string;    // 640px — L/XL cards
    };
    releaseYear: number;
  };
  topTracks?: {
    name: string;
    spotifyTrackId: string;
    spotifyUrl: string;
    previewUrl: string | null;
    durationMs: number;
  }[];
}
```

-----

## Visual Design

### Size Tiers

Cards are sized based on `timesSeen`, creating visual weight for frequently-attended artists:

|Times Seen|Size Class|Dimensions |Album Art Source|
|----------|----------|-----------|----------------|
|5+        |`xl`      |200 × 200px|`large` (640px) |
|3–4       |`l`       |150 × 150px|`large` (640px) |
|2         |`m`       |120 × 120px|`medium` (300px)|
|1         |`s`       |90 × 90px  |`medium` (300px)|

### Card Front

The front of each card is pure album art—no overlays, no text, no badges. This is both an aesthetic choice and a Spotify TOS requirement (album art must remain unmodified).

```
┌────────────────────┐
│                    │
│                    │
│   [Album Cover]    │
│                    │
│                    │
└────────────────────┘
```

**Styling details:**

- Album art fills entire card (`object-fit: cover`)
- 1-2px border in genre color (using existing genre palette)
- Hover state: subtle scale (1.02) + soft shadow
- Cursor changes to pointer

### Card Back

The back reveals concert history and the Spotify player. Layout adapts to card size:

**L/XL Cards (150px+ width) — Two-column layout:**

```
┌─────────────────────────────────────┐
│  Artist Name                        │
│  Seen 5 times                       │
├─────────────────────────────────────┤
│                    │                │
│  • Mar 2019        │   advancement advancement ▶advancement │
│    Red Rocks       │   advancement ▶ Song 1 advancement │
│                    │  ▶ Song 2    │
│  • Jul 2020        │  ▶ Song 3    │
│    The Fillmore    │                │
│                    │                │
│  (scrollable)      │                │
├─────────────────────────────────────┤
│  advancement Open in Spotify               │
└─────────────────────────────────────┘
```

**S/M Cards (under 150px) — Stacked layout:**

```
┌───────────────────┐
│ Artist Name       │
│ Seen 2 times      │
├───────────────────┤
│ Mar 2019 • Venue  │
│ Jul 2020 • Venue  │
├───────────────────┤
│ ▶ advancement ▶ ▶        │
├───────────────────┤
│ advancement Open in Spotify │
└───────────────────┘
```

### Mosaic Layout

The grid uses CSS Grid with `auto-fill` to create a responsive masonry-style layout:

- Cards flow left-to-right, top-to-bottom
- Larger cards naturally claim more space
- Gap between cards: 8-12px

**Sort options:**

- **Times seen** (default) — Most-seen artists first
- **Alphabetical** — A-Z by artist name
- **Genre** — Grouped by primary genre
- **Chronological** — By first-seen date

### Toggle Control

A toggle in the scene header switches between weighted and equal sizing:

```
┌─────────────────────────────────────────────┐
│  The Artists                                │
│  305 bands · 175 concerts                   │
│                                             │
│  Size by times seen  ○━━━━━━●               │
│                      OFF    ON              │
└─────────────────────────────────────────────┘
```

- **OFF (equal size):** All cards render at M size (120px), sorted alphabetically
- **ON (weighted):** Cards sized by tier, sorted by times seen

### Placeholder Cards

For artists not found on Spotify (or with low-confidence matches):

- Background: genre color (from existing palette)
- Content: artist initials centered (e.g., “SD” for Social Distortion)
- Subtle texture or pattern to distinguish from real album art
- Card back still shows concert data; Spotify section shows “Not found on Spotify” with a search link (`https://open.spotify.com/search/{artist_name}`)

-----

## Interaction Design

### Flip Behavior

- **Trigger:** Click or tap on card
- **Animation:** 3D rotation on Y-axis (0.6s ease-out)
- **Single card open:** Clicking a new card auto-closes any previously flipped card
- **Close methods:**
  - Click the flipped card again
  - Click a different card
  - Press Escape key

```css
.card {
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.card.flipped {
  transform: rotateY(180deg);
}
.card-back {
  transform: rotateY(180deg);
  backface-visibility: hidden;
}
```

### Spotify Mini-Player

The mini-player on the card back provides 30-second previews:

- Simple controls: play/pause button, advancement dots showing current track
- Auto-advances through top 3 tracks
- Volume/mute toggle
- Uses native `<audio>` element with Spotify preview URLs

**Fallback:** If preview URLs are null (some tracks don’t have them), show track names as links to Spotify instead.

### Optional Full Playback (Stretch Goal)

For users who want more than 30-second clips:

1. “Connect Spotify” button in scene header
1. OAuth redirect flow → store access token in localStorage
1. If authenticated, swap `<audio>` for Spotify Web Playback SDK
1. Show “Connected as {username}” badge

This is Phase 6 / stretch goal—not required for MVP.

-----

## Spotify Integration

### Build-Time Enrichment

All Spotify data is fetched at build time, not runtime. This means:

- Zero API calls when users browse the scene
- Album art URLs point to Spotify’s CDN (`i.scdn.co`), which handles caching
- Data stays fresh when you run `npm run build-data`

**Enrichment flow:**

1. For each unique artist in `concerts.json`:
1. Check `spotify-overrides.json` for manual artist ID
1. If no override, search Spotify API: `GET /v1/search?type=artist&q={name}`
1. Fetch artist’s albums: `GET /v1/artists/{id}/albums?include_groups=album`
1. Select album with highest popularity score
1. Fetch top tracks: `GET /v1/artists/{id}/top-tracks?market=US`
1. Write to `artists-metadata.json`

### Artist Matching Problem

Common band names return wrong results from Spotify search:

- “Boston” → city playlist instead of the rock band
- “Heart” → multiple artists with that name
- “America” → country results, compilations, etc.

**Solution: Manual override file**

```json
// scripts/spotify-overrides.json
{
  "boston": {
    "spotifyArtistId": "29kkCKKGXheHuoO829FxWK",
    "note": "The classic rock band, not the city playlist"
  },
  "heart": {
    "spotifyArtistId": "34jw2BbxjoYalTp8cJFCPv",
    "note": "Ann & Nancy Wilson"
  },
  "the cars": {
    "spotifyArtistId": "6DCIj8jNaNpBz8e5oKFPtp",
    "note": "Forcing exact match"
  }
}
```

**Enrichment script logic:**

```typescript
async function getSpotifyArtist(artistName: string) {
  const normalized = normalizeName(artistName);
  
  // 1. Check manual override first
  if (overrides[normalized]) {
    return fetchArtistById(overrides[normalized].spotifyArtistId);
  }
  
  // 2. Search API
  const results = await searchArtist(artistName);
  
  // 3. Confidence checks — log warnings for review
  const topResult = results[0];
  const nameMatch = fuzzyMatch(artistName, topResult.name);
  const isPopular = topResult.popularity >= 30;
  
  if (!nameMatch || !isPopular) {
    console.warn(`⚠️  Review: "${artistName}" → "${topResult.name}" (popularity: ${topResult.popularity})`);
  }
  
  return topResult;
}
```

**Workflow for handling mismatches:**

1. Run `npm run build-data`
1. Review console for `⚠️ Review:` warnings
1. For each mismatch, look up correct Spotify artist ID manually
1. Add entry to `scripts/spotify-overrides.json`
1. Re-run `npm run build-data`
1. Commit both `spotify-overrides.json` and `artists-metadata.json`

### Spotify TOS Compliance

Spotify has specific requirements for displaying their content:

1. **Album art must remain unmodified** — no cropping, overlays, or logos on top of cover art
1. **Attribution required** — Spotify logo must be visible, linking back to Spotify
1. **Link back to source** — album art and track names must link to Spotify

**Our compliance approach:**

- Album covers are displayed full-bleed, uncropped
- Spotify logo appears in scene footer and on each card back
- “Open in Spotify” link on every card back
- Track names link to their Spotify URLs

-----

## Performance

### Lazy Loading

With 305+ artists, rendering everything at once would hurt initial load time. We’ll use progressive loading:

- **Initial render:** First 100 cards
- **Subsequent batches:** 50 cards at a time
- **Trigger:** Intersection Observer watching a sentinel element near grid bottom
- **Loading state:** Skeleton cards with genre-colored shimmer effect
- **Animation:** New cards fade in with staggered delay (30ms per card, matching existing app patterns)

### Image Loading

- **Lazy load images:** Only load album art as cards enter viewport
- **Placeholder:** Low-res blur or genre color while loading
- **CDN caching:** Spotify’s CDN (`i.scdn.co`) sets aggressive cache headers; repeat visitors get instant loads

### State Management

- `activeCardId` tracks which card is currently flipped (only one at a time)
- `sortOrder` and `sizeToggle` can live in component state or Zustand if needed globally
- Aggregated artist data is memoized to prevent recalculation on re-renders

-----

## Responsive Design

|Breakpoint             |Behavior                                       |
|-----------------------|-----------------------------------------------|
|**Desktop (1200px+)**  |6-8 cards per row, all size tiers active       |
|**Tablet (768-1199px)**|4-6 cards per row, maintain size ratios        |
|**Mobile (<768px)**    |3-4 cards per row, cap max size at M (XL/L → M)|

On mobile, the flip interaction works via tap. The stacked card-back layout ensures content fits in smaller dimensions.

-----

## Accessibility

### Keyboard Navigation

- Cards are `<button>` elements (or have `role="button"`)
- Tab navigates between cards
- Enter/Space flips the focused card
- Escape closes any flipped card
- Arrow keys could optionally navigate the grid (enhancement)

### Screen Readers

- Cards have `aria-label="View {artist name} concert history"`
- Flipped state announced via `aria-expanded`
- Mini-player uses standard audio semantics

### Motion Sensitivity

- Respect `prefers-reduced-motion` media query
- If enabled: replace flip animation with crossfade
- Disable staggered load animations

### Focus Management

- When card flips, focus moves to card-back content
- When card closes, focus returns to the card front
- Visible focus indicators on all interactive elements

-----

## Component Architecture

```
src/components/scenes/ArtistScene/
├── ArtistScene.tsx           # Main scene container, header, toggle
├── ArtistMosaic.tsx          # Grid layout, lazy loading, sort logic
├── ArtistCard.tsx            # Flip card wrapper, state management
├── ArtistCardFront.tsx       # Album cover display
├── ArtistCardBack.tsx        # Metadata + player layout
├── SpotifyMiniPlayer.tsx     # Audio player component
├── ArtistPlaceholder.tsx     # Genre-colored placeholder for missing art
├── useArtistData.ts          # Aggregate concerts → artist cards
├── useSpotifyAuth.ts         # Optional OAuth hook (stretch goal)
└── artistScene.css           # Scene-specific styles (or Tailwind)
```

### Component Responsibilities

**ArtistScene.tsx**

- Scene layout and title (“The Artists”)
- Size toggle state
- Sort dropdown
- Spotify attribution footer
- Renders `<ArtistMosaic />`

**ArtistMosaic.tsx**

- CSS Grid container
- Lazy loading logic (Intersection Observer)
- Sorts artist list based on current sort order
- Renders `<ArtistCard />` for each artist
- Manages `activeCardId` state (which card is flipped)

**ArtistCard.tsx**

- Flip animation logic
- Click handler (flip self, close others)
- Escape key handler
- Renders front and back as children

**ArtistCardFront.tsx**

- Album cover image
- Genre border color
- Hover state

**ArtistCardBack.tsx**

- Responsive layout (2-col vs stacked based on size)
- Artist name, times seen
- Concert list (scrollable if many)
- Spotify mini-player
- “Open in Spotify” link

**SpotifyMiniPlayer.tsx**

- `<audio>` element with preview URL
- Play/pause button
- Track advancement dots (tracks 1, 2, 3)
- Auto-advance on track end
- Handles null preview URLs gracefully

**useArtistData.ts**

- Reads `concerts.json` and `artists-metadata.json`
- Aggregates concerts by normalized artist name
- Calculates `timesSeen` and `sizeClass`
- Merges in Spotify metadata
- Returns sorted, memoized array

-----

## Animation Specifications

### Initial Load

- Cards fade in with staggered delay (30ms between cards)
- Use Framer Motion’s `staggerChildren` or manual delay calculation
- Matches existing app patterns (see Timeline, Venues scenes)

### Toggle Change (Equal ↔ Weighted)

- Cards animate to new sizes/positions
- Use Framer Motion `layout` prop for smooth transitions
- Duration: ~400ms

### Sort Change

- Cards reorder with position animation
- Use Framer Motion `layout` + `AnimatePresence`
- Duration: ~400ms

### Card Flip

- 3D rotation on Y-axis
- Duration: 600ms
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`

### Lazy Load Batch

- New cards fade in + slide up slightly
- Staggered delay: 30ms per card
- Duration: 200ms per card

-----

## Implementation Phases

### Phase 0: Prerequisites

- [ ] Verify Spotify Developer app credentials exist (or create one)
- [ ] Review `scripts/enrich-artists.ts` current implementation
- [ ] Confirm genre color utility location for border colors
- [ ] Check Framer Motion availability (already in project per `planning.md`)

### Phase 1: Data Enrichment

- [ ] Create `scripts/spotify-overrides.json` (empty initially)
- [ ] Add override lookup to enrichment script
- [ ] Add Spotify artist search to enrichment script
- [ ] Add album fetch + popularity sorting
- [ ] Add album cover URLs (small/medium/large) to metadata
- [ ] Add top 3 tracks with preview URLs to metadata
- [ ] Add confidence logging for fuzzy/low-popularity matches
- [ ] Run enrichment, review `⚠️ Review:` warnings
- [ ] Populate overrides for mismatched artists
- [ ] Re-run enrichment
- [ ] Commit `spotify-overrides.json` and `artists-metadata.json`

### Phase 2: Basic Mosaic

- [ ] Create `ArtistScene.tsx` shell (title, subtitle, toggle placeholder)
- [ ] Implement `useArtistData.ts` hook
- [ ] Build `ArtistMosaic.tsx` with CSS Grid
- [ ] Implement size tier logic (`timesSeen` → `sizeClass` → dimensions)
- [ ] Render `ArtistCardFront.tsx` with album covers
- [ ] Add `ArtistPlaceholder.tsx` for missing Spotify matches
- [ ] Add genre-based border colors
- [ ] Implement size toggle (equal vs weighted)
- [ ] Wire up lazy loading (Intersection Observer, 100 initial / 50 per batch)

### Phase 3: Card Flip

- [ ] Build flip animation CSS (or Framer Motion variant)
- [ ] Implement `activeCardId` state in `ArtistMosaic`
- [ ] Create `ArtistCard.tsx` with flip logic
- [ ] Build `ArtistCardBack.tsx` layout (responsive 2-col vs stacked)
- [ ] Display concert history (dates + venues)
- [ ] Add Escape key handler to close flipped card
- [ ] Ensure clicking new card closes previous

### Phase 4: Spotify Mini-Player

- [ ] Build `SpotifyMiniPlayer.tsx`
- [ ] Implement `<audio>` element with preview URL
- [ ] Add play/pause button
- [ ] Add track advancement (dots or next/prev)
- [ ] Auto-advance through top 3 tracks
- [ ] Handle null preview URLs (show track links instead)
- [ ] Add “Open in Spotify” link with logo

### Phase 5: Polish

- [ ] Add staggered load animation
- [ ] Implement sort options (times seen, alpha, genre, chronological)
- [ ] Add smooth reorder animation on sort change
- [ ] Add smooth resize animation on toggle change
- [ ] Responsive breakpoint adjustments
- [ ] Accessibility audit (keyboard nav, screen reader, focus management)
- [ ] `prefers-reduced-motion` support
- [ ] Spotify attribution in scene footer

### Phase 6: Stretch — Full Playback Auth

- [ ] Implement `useSpotifyAuth.ts` hook
- [ ] Add “Connect Spotify” button to scene header
- [ ] OAuth redirect flow
- [ ] Token storage and refresh logic
- [ ] Swap preview player for Web Playback SDK when authenticated
- [ ] “Connected as {username}” UI state

-----

## Reference Files

When implementing, consult these existing files for patterns:

|Pattern               |Reference                                                  |
|----------------------|-----------------------------------------------------------|
|Concert data structure|`public/data/concerts.json`                                |
|Existing metadata     |`public/data/artists-metadata.json`                        |
|Genre color mapping   |Genre scene / sunburst component                           |
|Lazy loading          |`ArtistGrid.tsx` in v2 plan (Intersection Observer pattern)|
|Enrichment script     |`scripts/enrich-artists.ts`                                |
|Scene structure       |`Scene4Bands.tsx`, other scene components                  |
|Animation patterns    |Framer Motion usage throughout app                         |
|Toggle UI             |Existing toggles in Venues scene                           |

-----

## Open Questions (Resolve During Implementation)

1. **Virtualization threshold:** 305 cards with lazy loading should be fine, but if performance suffers, consider `react-window` or similar. Test on lower-end devices.
1. **Preview URL availability:** Some Spotify tracks don’t have 30-second previews. Need to audit how many of our artists’ top tracks are affected. Fallback is graceful (show links instead of player).
1. **Rate limiting during enrichment:** Spotify API has rate limits. May need to add delays between requests. Check existing enrichment script for patterns.

-----

## Appendix: Key Decisions Log

|Decision          |Options Considered               |Resolution        |Rationale                                       |
|------------------|---------------------------------|------------------|------------------------------------------------|
|Visualization type|Treemap, grid, mosaic            |Mosaic            |Album art more evocative than colored rectangles|
|Detail display    |Modal, sidebar, flip             |Flip              |Keeps spatial context, tactile metaphor         |
|Album selection   |Latest, first, most popular      |Most popular      |Iconic covers people recognize                  |
|Spotify data      |Runtime API, build-time cache    |Build-time cache  |Zero runtime API calls, CDN caching             |
|Size tiers        |2, 3, 4, continuous              |4 tiers           |Enough differentiation without complexity       |
|Flip behavior     |Multiple open, single open       |Single open       |Cleaner UX, simpler state management            |
|Lazy loading      |All at once, virtualized, batched|Batched (100 + 50)|Balances performance with simplicity            |

-----

*Last updated: December 2024*
*Authored by: Claude (PM) + Human collaboration*