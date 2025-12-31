# Artist Scene Implementation Plan v2

## Overview

Replace the existing Scene2Venues component with an enhanced Artist Scene featuring a hybrid treemap/grid visualization of all 305 artists (headliners + openers combined). The scene emphasizes the volume of concerts attended while highlighting frequently-seen artists.

**Replaces:** `src/components/scenes/Scene2Venues.tsx`

---

## Key Decisions

| Decision | Resolution |
|----------|------------|
| Headliners vs Openers | Combined into single unified list—no distinction |
| Spotify API | Build-time enrichment via existing `scripts/enrich-artists.ts` pattern |
| Filter/Sort complexity | Simplified to single toggle (equal size vs weighted) |
| 305 artists at once | Hybrid approach: treemap for frequent artists, CSS grid for long tail |
| Threshold for treemap | Artists seen ≥3 times |
| Dark mode | Removed from scope (not a global app feature) |

---

## Data Model

### Source
- **File:** `public/data/concerts.json` (175 concerts)
- **Enrichment:** `public/data/artists-metadata.json` (extend existing pattern)

### Aggregated Artist Shape

```typescript
interface ArtistSummary {
  name: string;
  normalizedName: string;      // For API matching / deduplication
  timesSeen: number;
  genres: string[];            // All genres they've appeared in
  primaryGenre: string;        // Most frequent genre (for coloring)
  venues: string[];            // All venues
  firstSeen: string;           // ISO date
  lastSeen: string;            // ISO date
  dates: string[];             // All concert dates
  // Enriched fields (from build-time API calls)
  image?: string;              // Artist photo URL
  spotifyUrl?: string;         // Link to Spotify artist page
  topTracks?: {                // Top 3 tracks
    name: string;
    spotifyUrl: string;
  }[];
}
```

### Aggregation Logic

```typescript
// Pseudocode for useArtistData hook
function aggregateArtists(concerts: Concert[]): ArtistSummary[] {
  const artistMap = new Map<string, ArtistSummary>();

  concerts.forEach(concert => {
    // Add headliner
    addOrUpdateArtist(artistMap, concert.headliner, {
      genre: concert.genre,
      venue: concert.venue,
      date: concert.date,
    });

    // Add each opener (inherits genre from headliner)
    concert.openers.forEach(opener => {
      addOrUpdateArtist(artistMap, opener, {
        genre: concert.genre,  // Inherited
        venue: concert.venue,
        date: concert.date,
      });
    });
  });

  return Array.from(artistMap.values());
}

function addOrUpdateArtist(map, name, { genre, venue, date }) {
  const normalized = normalizeName(name);
  const existing = map.get(normalized);
  
  if (existing) {
    existing.timesSeen++;
    existing.dates.push(date);
    if (!existing.genres.includes(genre)) existing.genres.push(genre);
    if (!existing.venues.includes(venue)) existing.venues.push(venue);
    existing.lastSeen = date > existing.lastSeen ? date : existing.lastSeen;
    // Recalculate primaryGenre based on frequency
  } else {
    map.set(normalized, {
      name,
      normalizedName: normalized,
      timesSeen: 1,
      genres: [genre],
      primaryGenre: genre,
      venues: [venue],
      firstSeen: date,
      lastSeen: date,
      dates: [date],
    });
  }
}
```

### Data Segmentation

```typescript
const { frequentArtists, occasionalArtists, allArtists } = useArtistData(concerts);

// frequentArtists: timesSeen >= 3 (estimated 15-25 artists) → Treemap
// occasionalArtists: timesSeen < 3 (estimated 280+ artists) → Grid
// allArtists: full sorted list → Grid (for "All Equal" mode)
```

---

## Visual Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    The Artists                          │  ← H1
│              305 bands across 42 years                  │  ← Subtitle (encourages scroll)
│                                                         │
│            Weight by times seen  ○━━●                   │  ← Toggle
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │   STATE A: CSS Grid (All Equal)                │   │
│  │   - All 305 artists in uniform cards           │   │
│  │   - Alphabetical order                         │   │
│  │   - Lazy loaded as user scrolls                │   │
│  │                                                 │   │
│  │   — OR —                                       │   │
│  │                                                 │   │
│  │   STATE B: Hybrid (By Times Seen)              │   │
│  │   - D3 Treemap: Artists seen ≥3x               │   │
│  │   - Divider: "Seen 1-2 times"                  │   │
│  │   - CSS Grid: Remaining artists                │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### State A: All Equal (Default)

- **Visualization:** CSS Grid
- **Card size:** Uniform (approx 120px × 80px, responsive)
- **Sort order:** Alphabetical A-Z
- **Initial render:** ~30 artists (above fold)
- **Expansion:** Lazy load via Intersection Observer, batches of 50
- **Card content:** Artist name, genre badge

### State B: By Times Seen (Toggle Active)

**Top Section: D3 Treemap**
- Artists seen ≥3 times only
- Brick size proportional to `timesSeen`
- Brick color based on `primaryGenre` (uses shared genre color utility)
- Largest bricks (most seen) positioned top-left
- Text: Artist name + times seen count

**Divider**
- Subtle horizontal rule
- Label: "Seen 1-2 times" or "And 280 more..."

**Bottom Section: CSS Grid**
- Artists seen 1-2 times
- Uniform card size
- Sorted by `timesSeen` desc, then alphabetical
- Lazy loaded as user scrolls

### Card/Brick Design

```
┌─────────────────────────┐
│  ┌───┐                  │
│  │ 8 │  Social          │  ← Times seen badge (treemap only)
│  └───┘  Distortion      │  ← Artist name
│         ──────────      │
│         Punk            │  ← Genre (subtle)
└─────────────────────────┘
```

- Genre-based background color (subtle tint or left border)
- Hover: elevation shadow + slight scale
- Click: opens modal

### Color System

**Prerequisite:** Genre color palette will be extracted to shared utility before this work begins.

```typescript
// src/utils/genreColors.ts (to be created in prior work)
export const GENRE_COLORS: Record<string, string>;
export function getGenreColor(genre: string): string;
```

Reference the updated Scene5Genres sunburst colors once that work is complete.

---

## Interaction

### Toggle Behavior

| Action | Result |
|--------|--------|
| Toggle OFF → ON | Fade out grid, fade in treemap + grid hybrid |
| Toggle ON → OFF | Fade out hybrid, fade in full grid |

Transition duration: ~400ms with slight overlap (crossfade feel)

### Hover State

- Card/brick elevates (subtle shadow + scale 1.02)
- Cursor: pointer
- No tooltip (click for details)

### Click → Modal

Opens `ArtistModal` with:

1. **Artist image** (from enriched data, or placeholder)
2. **Artist name** (large)
3. **Times seen:** X shows
4. **Genres:** pill badges
5. **Venues:** list
6. **Date range:** "First: Mar 2019 · Last: Jul 2023"
7. **All dates:** expandable list
8. **Spotify link:** Button (if available)
9. **Top tracks:** List with links (if available)

**Modal behavior:**
- Focus trap when open
- Escape or click outside to close
- Animate: scale up from click position, fade in backdrop

### Lazy Loading

- Intersection Observer watches sentinel element
- When visible, load next batch of 50 artists
- Smooth fade-in animation for new cards
- Loading state: subtle skeleton cards

---

## Component Architecture

```
src/components/scenes/
├── Scene2Artists.tsx                 # Main scene container
└── Scene2Artists/
    ├── ArtistTreemap.tsx             # D3 treemap (frequent artists)
    ├── ArtistGrid.tsx                # CSS Grid (all or occasional artists)
    ├── ArtistCard.tsx                # Shared card component
    ├── ArtistModal.tsx               # Detail modal
    ├── ArtistToggle.tsx              # Toggle switch component
    └── useArtistData.ts              # Data aggregation hook
```

### Component Responsibilities

**Scene2Artists.tsx**
- Scene layout and header
- Toggle state management
- Coordinates treemap vs grid rendering
- Passes data to child components

**ArtistTreemap.tsx**
- D3 treemap layout for `frequentArtists`
- Handles resize
- Click events → opens modal (via callback)
- Uses shared genre colors

**ArtistGrid.tsx**
- CSS Grid layout
- Renders `ArtistCard` components
- Manages lazy loading (Intersection Observer)
- Handles both full list and occasional-only modes

**ArtistCard.tsx**
- Shared presentational component
- Used by both treemap (as brick content) and grid
- Props: artist data, onClick, showCount (boolean)

**ArtistModal.tsx**
- Portal-rendered modal
- Displays full artist details
- Fetches/displays enriched data
- Close handlers (escape, backdrop, button)

**useArtistData.ts**
- Aggregates concerts into artist summaries
- Segments into frequent/occasional
- Memoized for performance
- Merges enriched metadata

---

## Animation

### Initial Load
- Cards/bricks fade + slide up with staggered delay (30ms per item)
- Use Framer Motion for grid items
- D3 for treemap entrance (scale from 0)

### Toggle Transition
- Crossfade between layouts (~400ms)
- Framer Motion `AnimatePresence` for enter/exit

### Hover
- CSS transition: `transform 0.15s ease, box-shadow 0.15s ease`

### Modal
- Backdrop: fade in (200ms)
- Modal: scale from 0.95 + fade (300ms)
- Exit: reverse

### Lazy Load
- New cards: fade in + slide up (200ms, staggered)

---

## Responsive Design

### Desktop (≥1024px)
- Grid: 5-6 columns
- Treemap: full width, ~300px height
- Cards: ~140px × 90px

### Tablet (768px - 1023px)
- Grid: 4 columns
- Treemap: full width, ~250px height
- Cards: ~130px × 85px

### Mobile (<768px)
- Grid: 2-3 columns
- Treemap: full width, ~200px height (or hide treemap, show ranked list)
- Cards: ~100px × 70px
- Consider: simplified card (name only, genre on tap)

---

## Accessibility

### Keyboard Navigation
- Toggle: focusable, Space/Enter to activate
- Grid: arrow key navigation between cards (roving tabindex)
- Treemap: arrow key navigation between bricks
- Enter: open modal
- Escape: close modal

### Screen Readers
- Toggle: `role="switch"` with `aria-checked`
- Cards: `role="button"` with `aria-label="Artist Name, seen X times, Genre"`
- Treemap: `role="img"` with `aria-label` summary, individual bricks as buttons
- Modal: `role="dialog"` with `aria-modal="true"`, focus trap
- Live region announces filter changes

### Visual
- Minimum contrast ratio 4.5:1 for text on colored backgrounds
- Focus indicators on all interactive elements
- Reduced motion: respect `prefers-reduced-motion`

---

## Build-Time Data Enrichment

### Extend Existing Pattern

Modify `scripts/enrich-artists.ts` to:

1. Generate aggregated artist list from concerts
2. For each artist, fetch from TheAudioDB / Last.fm (existing):
   - Artist image
   - Biography snippet
3. Optionally add Spotify data (new):
   - Spotify artist URL
   - Top 3 tracks

### Output

```json
// public/data/artists-metadata.json
{
  "social-distortion": {
    "name": "Social Distortion",
    "image": "https://...",
    "bio": "...",
    "spotifyUrl": "https://open.spotify.com/artist/...",
    "topTracks": [
      { "name": "Ball and Chain", "spotifyUrl": "https://..." },
      { "name": "Story of My Life", "spotifyUrl": "https://..." },
      { "name": "I Was Wrong", "spotifyUrl": "https://..." }
    ]
  },
  ...
}
```

### Fallbacks

If artist not found in APIs:
- Image: show genre-colored placeholder or initials
- Spotify link: link to search `https://open.spotify.com/search/{artist_name}`
- Top tracks: omit section

---

## Implementation Phases

### Phase 0: Prerequisites
- [ ] Verify genre color utility exists (or note dependency on sunburst work)
- [ ] Review `artists-metadata.json` structure and enrichment script
- [ ] Confirm threshold (≥3 times) with actual data distribution

### Phase 1: Data Layer
- [ ] Create `useArtistData.ts` hook
- [ ] Implement aggregation logic (headliners + openers)
- [ ] Segment into `frequentArtists` / `occasionalArtists`
- [ ] Merge with enriched metadata

### Phase 2: Grid View (Default State)
- [ ] Create `ArtistCard.tsx` component
- [ ] Create `ArtistGrid.tsx` with CSS Grid layout
- [ ] Implement lazy loading (Intersection Observer)
- [ ] Replace Scene2Venues with Scene2Artists (grid only)
- [ ] Verify alphabetical sorting

### Phase 3: Modal
- [ ] Create `ArtistModal.tsx` component
- [ ] Wire click handlers from grid
- [ ] Display all artist details
- [ ] Implement close behavior (escape, backdrop, button)
- [ ] Focus trap and accessibility

### Phase 4: Toggle & Hybrid State
- [ ] Create `ArtistToggle.tsx` component
- [ ] Add toggle state to Scene2Artists
- [ ] Create `ArtistTreemap.tsx` with D3
- [ ] Implement hybrid layout (treemap + grid)
- [ ] Add crossfade transition between states

### Phase 5: Polish
- [ ] Entry animations (staggered fade-in)
- [ ] Hover states
- [ ] Responsive adjustments
- [ ] Accessibility audit (keyboard nav, screen reader testing)
- [ ] Performance check (305 items rendering smoothly)

### Phase 6: Data Enrichment (can run parallel)
- [ ] Extend `enrich-artists.ts` for aggregated artist list
- [ ] Add Spotify data fetching (optional, if API access available)
- [ ] Run enrichment, commit updated `artists-metadata.json`
- [ ] Wire enriched data into modal display

---

## Reference Files

| Pattern | File |
|---------|------|
| Scene structure | `src/components/scenes/Scene1Hero.tsx` |
| Current artists scene | `src/components/scenes/Scene2Venues.tsx` (to be replaced) |
| D3 visualization | `src/components/scenes/Scene5Genres.tsx` |
| Framer Motion usage | `src/components/scenes/Scene3Map.tsx` |
| Concert types | `src/types/concert.ts` |
| Data enrichment | `scripts/enrich-artists.ts` |
| Genre colors | `src/utils/genreColors.ts` (to be created) |

---

## Open Items

- [ ] Run data query to confirm exact distribution of artists by times seen
- [ ] Finalize genre color palette (dependency on sunburst work)
- [ ] Decide: Should treemap bricks be clickable for modal, or just grid cards?
  - **Recommendation:** Both should open modal for consistency
- [ ] Mobile treemap: keep simplified or replace with ranked list?
  - **Recommendation:** Simplified treemap (fewer labels) on mobile

---

## Success Criteria

1. All 305 artists are accessible (via lazy load)
2. Toggle smoothly switches between equal/weighted views
3. Treemap clearly highlights most-seen artists (≥3x)
4. Modal displays rich artist information
5. Page remains performant (<100ms interaction latency)
6. Fully keyboard navigable
7. Works on mobile (responsive grid, touch-friendly)
