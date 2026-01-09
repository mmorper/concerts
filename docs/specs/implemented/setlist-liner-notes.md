# Setlist Liner Notes - Artist Gatefold Enhancement

**Status:** ✅ **IMPLEMENTED** (v1.5.0+)
**Completed Version:** v1.5.0
**Implementation:** Complete with setlist.fm API integration, pre-fetch caching, liner notes panel
**Dependencies:** Artist Scene Gatefold (✅ Complete in v1.4.0)
**Evidence:**
- [src/services/setlistfm.ts](../../src/services/setlistfm.ts) - setlist.fm API client
- [src/components/scenes/ArtistScene/LinerNotesPanel.tsx](../../src/components/scenes/ArtistScene/LinerNotesPanel.tsx) - Liner notes UI
- [scripts/prefetch-setlists.ts](../../scripts/prefetch-setlists.ts) - Build-time pre-fetch
- [public/data/setlists-cache.json](../../public/data/setlists-cache.json) - Cached setlist data
**Mobile Note:** 📱 Desktop implementation complete; mobile bottom sheet adaptation pending (see [../future/mobile-optimization.md](../future/mobile-optimization.md))

---

## Executive Summary

Enhance the Artist Scene gatefold by integrating setlist.fm API to display concert setlists as "liner notes" that slide over the Spotify panel. When users click a concert in the Concert History Panel (left side), a liner notes panel slides in from the right, temporarily covering the Spotify panel with the actual songs performed at that show.

This feature deepens the vinyl album metaphor - just as physical album gatefolds often contain liner notes with detailed information, our digital gatefold will reveal the actual setlists from the concerts you attended.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Setlist Liner Notes feature for the Artist Scene gatefold.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth
- Ask clarifying questions if anything is ambiguous or needs decision
- Read files proactively to understand existing patterns before writing code

**Feature Overview:**
- Enhance the Concert History Panel (left side of gatefold) with clickable three-dot icons next to each concert
- When clicked, a "liner notes" panel slides in from the right, covering the Spotify panel
- The liner notes show the actual setlist from that concert, fetched from setlist.fm API
- Users can switch between concerts smoothly (old slides out left, new slides in right)
- Users can close via X button, clicking outside, or ESC key

**Key References:**
- Full Design Spec: docs/specs/future/setlist-liner-notes.md
- API Setup Guide: docs/api-setup.md (setlist.fm section)
- Existing Components: src/components/scenes/ArtistScene/

**Implementation Approach:**
We'll implement this in 3-4 context windows:

**Window 1:** API Integration
- Create src/services/setlistfm.ts with API client
- Implement caching layer (24-hour TTL)
- Implement fuzzy matching for concerts
- Test API calls with known concerts

**Window 2:** UI Components
- Create LinerNotesPanel component (380×380px)
- Create SetlistButton (three-dot icon)
- Update ConcertHistoryPanel to show buttons
- Implement slide animations (translateX)
- Add loading/success/error/not found states

**Window 3:** Integration & Polish
- Wire API to UI in ArtistGatefold
- Implement smooth concert switching (Option A crossfade)
- Add accessibility features (focus management, ARIA)
- Add keyboard navigation (ESC, Enter, Tab)
- Polish animations and timing

**Window 4:** Testing & Deployment (optional)
- Comprehensive manual testing
- Cross-browser validation
- Performance optimization
- Production deployment

**Design Philosophy:**
"Opening the liner notes" - mimics pulling liner notes from a vinyl sleeve. The panel slides over like physical paper, revealing detailed performance information. Option A (smooth crossfade) for concert switching creates a fluid exploration experience.

**Key Design Details:**
- Liner notes: 380×380px panel (10px margin inside 400×400px)
- Animation: 400ms slide with cubic-bezier(0.4, 0, 0.2, 1)
- Background: rgba(24, 24, 24, 0.98) with subtle paper texture (optional)
- Typography: Playfair Display (artist name), Source Sans 3 (content)
- Section headers: #1DB954 (Spotify green), uppercase, tracking-wider
- Spotify panel dims to 0.3 opacity when liner notes open
- Three-dot icon: rgba(255, 255, 255, 0.3) → 0.8 on hover

**API Details:**
- Endpoint: https://api.setlist.fm/rest/1.0/search/setlists
- Authentication: x-api-key header (from VITE_SETLISTFM_API_KEY)
- Search params: artistName, date (DD-MM-YYYY format), cityName
- Response: JSON with sets[], songs[], venue info
- Caching: 24-hour TTL, in-memory Map keyed by "artist|date|venue|city"
- Error handling: Network errors, not found (empty results), rate limits (429)

**Fuzzy Matching Strategy:**
- Primary match: Artist name + Date + City (most reliable)
- Secondary: Venue name verification (filter results)
- Scoring: Venue exact match (0.5) + City match (0.3) + Artist similarity (0.2)
- Threshold: Accept if score > 0.5

**Current State:**
The Artist Scene gatefold is complete (v1.4.0) with:
- Flying tile animation (tile → center → gatefold)
- 3D book-opening effect (rotateY transforms)
- ConcertHistoryPanel (left) showing concert dates/venues in scrollable list
- SpotifyPanel (right) showing skeleton state (placeholder for v1.5.0 Spotify integration)
- ESC/click-outside close functionality
- Z-index layering (gatefold at 99998, flying tile at 99999)

**Files You'll Create:**
- src/services/setlistfm.ts (API client, ~150 lines)
- src/types/setlist.ts (TypeScript interfaces, ~60 lines)
- src/components/scenes/ArtistScene/LinerNotesPanel.tsx (~200 lines)
- src/components/scenes/ArtistScene/ConcertContextMenu.tsx (~150 lines) - Replaces SetlistButton, adds menu

**Files You'll Modify:**
- src/components/scenes/ArtistScene/ArtistGatefold.tsx (add liner notes state and menu handling)
- src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx (add contextual menu)
- src/components/scenes/ArtistScene/SpotifyPanel.tsx (add dimming prop)
- src/index.css (liner notes styles, scrollbar, menu styles)
- .env (add VITE_SETLISTFM_API_KEY)

**Note:** This spec assumes implementation alongside the Upcoming Tour Dates feature (v1.6.0). If implementing setlists alone, the ConcertContextMenu can show only the "View Setlist" option, with the "Upcoming Shows" option added later.

Let's start with Window 1: API Integration. Should I begin by creating the setlist.fm service module?
```

---

## Design Philosophy

**"Opening the liner notes"** - The interaction mimics pulling out liner notes from a vinyl record sleeve. The paper-like panel slides over the album cover (Spotify panel), revealing detailed information about a specific performance. This maintains our 400×400px gatefold footprint while adding a third layer of depth through progressive disclosure.

---

## Visual Design

### Concert History Panel Enhancement

**Current State:**
```
┌─────────────────────────────────────┐
│  19 Oct 2023  Brooklyn Steel        │
│  15 Mar 2022  Terminal 5            │
│  08 Jul 2019  Prospect Park         │
└─────────────────────────────────────┘
```

**Enhanced State (with contextual menu):**
```
┌─────────────────────────────────────┐
│  19 Oct 2023  Brooklyn Steel    ⋮  │ ← Three-dot menu icon
│  15 Mar 2022  Terminal 5        ⋮  │
│  08 Jul 2019  Prospect Park     ⋮  │ ← Appears on hover
└─────────────────────────────────────┘
```

**Visual Treatment:**
- **Icon:** Three vertical dots `⋮` (kebab menu icon)
- **Color:** `rgba(255, 255, 255, 0.3)` default, `rgba(255, 255, 255, 0.8)` on hover
- **Size:** 16×16px clickable area
- **Position:** Absolute right edge, aligned with concert row
- **Hover Effect:** Icon brightens + subtle scale (1.1×)
- **Cursor:** `cursor: pointer`

**Contextual Menu:**

When clicked, the three-dot icon opens a contextual menu with two options:

```
┌─────────────────────────────┐
│ 📋 View Setlist            │  ← Option 1: Historical setlist
│ 🎫 Upcoming Shows          │  ← Option 2: Future tour dates
└─────────────────────────────┘
```

- **Menu Width:** 220px
- **Menu Background:** `rgba(24, 24, 24, 0.98)`
- **Menu Border:** 1px solid `rgba(255, 255, 255, 0.15)`
- **Menu Shadow:** `0 4px 12px rgba(0, 0, 0, 0.5)`
- **Item Padding:** 12px horizontal, 10px vertical
- **Position:** Anchored below and to left of three-dot icon

**Menu Item States:**

**Available (clickable):**
- Text color: `#e5e5e5`
- Hover background: `rgba(255, 255, 255, 0.08)`
- Cursor: pointer

**Unavailable (disabled):**
- Text color: `rgba(255, 255, 255, 0.3)` (dimmed)
- Text changes: "No Setlist Found" / "No Upcoming Shows"
- No hover effect
- Cursor: default

This unified menu pattern makes both setlist and tour dates features discoverable from a single interaction point. See [upcoming-tour-dates.md](./upcoming-tour-dates.md) for the complementary tour dates feature specification.

### Liner Notes Panel Design

**Design Philosophy:** Authentic paper aesthetic mimicking vinyl record liner notes - warm off-white paper with subtle texture, dimensional effects, and minimized header to maximize setlist content space.

**Panel Specifications:**
- **Dimensions:** 380×380px (10px margin inside 400×400px panel)
- **Background:** Gradient `linear-gradient(135deg, #f5f5f0 0%, #e8e8e0 100%)` - Warm off-white paper
- **Paper Texture:** SVG noise filter overlay with fractal noise (3% opacity, multiply blend mode)
- **Border:** 1px solid `rgba(180, 170, 150, 0.3)` - Warm beige edge
- **Border Radius:** 4px (matches other panels)
- **Shadow:** `-10px 0 40px rgba(0, 0, 0, 0.6)` (left edge depth) + `inset -2px 0 8px rgba(0, 0, 0, 0.08)` (inner dimension)
- **Paper Curl:** Radial gradient shadow at bottom-right corner `rgba(0, 0, 0, 0.15)` suggesting lifted corner
- **Z-Index:** Above Spotify panel but below close button

**Layout:**
```
┌───────────────────────────────────┐
│  ✕                           [380×380px]
│                                   │
│  October 19, 2023 · Brooklyn Steel│ ← Compact: Date + Venue only
│  ───────────────────────────      │ ← Subtle gradient divider
│                                   │
│  SET 1                            │ ← Section header
│  1. Runaway                       │
│  2. Bloodbuzz Ohio                │
│  3. Don't Swallow the Cap         │
│  4. I Need My Girl                │
│  5. The System Only Dreams...     │
│  6. Fake Empire                   │
│  7. Mistaken for Strangers        │
│  8. Graceless                     │
│  9. This Is the Last Time         │
│  10. Mr. November                 │
│                                   │
│  ENCORE                           │
│  11. Terrible Love                │
│  12. Vanderlyle Crybaby Geeks     │
│                                   │
│  ────────────────────────         │
│  via setlist.fm     12 songs      │ ← Attribution footer
└───────────────────────────────────┘
```

**Typography (Paper Theme):**

- **Header Line:** Source Sans 3, 0.8125rem (13px), font-normal, `#6a6a60` (warm gray), tracking-wide
- **Section Headers:** Source Sans 3, 0.75rem (12px), font-bold, `#2a5a2a` (forest green - ink-like), uppercase, tracking-wider
- **Song Titles:** Source Sans 3, 0.9375rem (15px), font-normal, `#2a2a25` (dark charcoal)
- **Song Numbers:** Source Sans 3, 0.875rem (14px), font-medium, `#8a8a80` (medium gray), tabular-nums
- **Song Annotations:** Source Sans 3, 0.8125rem (13px), font-normal, `#7a7a70` (light gray) - for covers, notes
- **Attribution:** Source Sans 3, 0.6875rem (11px), font-normal, `#8a8a80` (medium gray)
- **Close Button:** `#4a4a40` (dark gray) with hover: `#1DB954` (Spotify green)

**Spacing (Optimized for Content):**

- **Top Padding:** 24px (reduced from 32px)
- **Horizontal Padding:** 28px (reduced from 32px for more content width)
- **Bottom Padding:** 28px
- **Header:** Single compact line (pt-6 px-7 pb-3) ~40px total vs ~120px in original
- **Divider Margin:** Gradient fade divider with minimal spacing
- **Content Gain:** +80px vertical space (30% more area for setlist)
- **Section Spacing:** 20px between sections
- **Song Row Spacing:** 6px between songs
- **List Scrolling:** Scrollable content area with paper-themed scrollbar

**Visual Effects:**

- **Paper Texture:** SVG fractal noise filter at 3% opacity creating authentic paper grain
- **Dimensional Curl:** Radial gradient shadow (20×20px) at bottom-right corner mimicking paper lift
- **Inset Shadow:** Subtle depth on left edge suggesting paper pulled from sleeve
- **Gradient Divider:** Horizontal rule with fade-in/fade-out effect
- **Scrollbar:** Olive-toned (`rgba(100, 100, 90, 0.25)`) matching paper aesthetic
- **Close Button:** 24×24px X icon, top-right 20px inset

### States and Loading

**Loading State:**
```
┌───────────────────────────────────┐
│  ✕                    [Paper BG]  │
│                                   │
│  October 19, 2023 · Brooklyn Steel│
│  ───────────────────────────      │
│                                   │
│  [Skeleton bars - olive tint]    │
│  [Skeleton bars - olive tint]    │
│  [Skeleton bars - olive tint]    │
│  [Skeleton bars - olive tint]    │
│                                   │
│  Loading setlist...               │
└───────────────────────────────────┘
```

**Not Found State:**
```
┌───────────────────────────────────┐
│  ✕                    [Paper BG]  │
│                                   │
│  October 19, 2023 · Brooklyn Steel│
│  ───────────────────────────      │
│                                   │
│                                   │
│  📋                               │
│                                   │
│  No setlist available             │
│  for this concert                 │
│                                   │
│  Setlists are community-          │
│  contributed and may not exist    │
│  for all shows.                   │
│                                   │
└───────────────────────────────────┘
```

**Error State:**
```
┌───────────────────────────────────┐
│  ✕                    [Paper BG]  │
│                                   │
│  October 19, 2023 · Brooklyn Steel│
│  ───────────────────────────      │
│                                   │
│                                   │
│  ⚠️                                │
│                                   │
│  Unable to load setlist           │
│                                   │
│  Check your connection and        │
│  try again.                       │
│                                   │
└───────────────────────────────────┘
```

---

## Interaction Design

### Animation Sequence

**Opening Liner Notes (Vinyl Sleeve Metaphor - Implemented):**

1. **User clicks setlist icon** on concert in Concert History Panel
2. **Liner Notes slides out from left** (like pulling paper from vinyl sleeve)
   - Initial position: `transform: translateX(-400px)` (over Concert History Panel - "inside the sleeve")
   - Final position: `transform: translateX(0)` (covering Spotify panel)
   - Opacity: 0.8 → 1.0 (paper becoming visible)
   - Duration: 400ms
   - Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (standard ease-out)
3. **Spotify panel dims slightly** beneath liner notes
   - Opacity: 1.0 → 0.3
   - Transition: 400ms synchronized with slide
4. **Loading state shows** while fetching from setlist.fm
   - Skeleton animation for song rows (olive-tinted)
   - "Loading setlist..." text
5. **Content appears** once loaded
   - Fade in: opacity 0 → 1 over 200ms

**Switching Between Setlists:**

When user clicks a different concert while liner notes are open:

1. **Current liner notes slides back to left** (into sleeve)
   - Transform: `translateX(0)` → `translateX(-400px)`
   - Opacity: 1.0 → 0.6
   - Duration: 350ms
   - Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
2. **New liner notes slides out from left** (immediately after)
   - Same animation as opening
   - Loading state appears immediately in new panel

**Closing Liner Notes:**

Three ways to close:

1. **Click X button** in top-right corner
2. **Click outside** liner notes panel (on Spotify panel area or overlay)
3. **ESC key** (closes liner notes first, then gatefold on second press)

Close animation:

- **Liner notes slides left** back into sleeve
  - Transform: `translateX(0)` → `translateX(-400px)`
  - Opacity: 1.0 → 0.6 (paper disappearing into sleeve)
  - Duration: 350ms
  - Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Spotify panel brightens** back to full opacity
  - Opacity: 0.3 → 1.0
  - Transition: 350ms synchronized

### Hover States

**Concert Row Hover:**
- Three-dot icon appears/brightens
- Concert row background: subtle highlight `rgba(255, 255, 255, 0.04)`
- Cursor: pointer
- Transition: 150ms

**Close Button Hover:**
- Color: `#ffffff` → `#1DB954` (Spotify green)
- Scale: 1.0 → 1.1
- Transition: 150ms

### Accessibility

**Keyboard Navigation:**
- Three-dot icons are focusable with Tab key
- Enter/Space triggers setlist panel
- ESC closes liner notes (or entire gatefold if notes already closed)
- Arrow keys can scroll within setlist panel

**Screen Readers:**
- Three-dot button: `aria-label="View setlist for {date} at {venue}"`
- Liner notes panel: `role="dialog"`, `aria-modal="false"` (not truly modal)
- Close button: `aria-label="Close setlist"`
- Loading state: `aria-live="polite"` with "Loading setlist..."
- Error state: `aria-live="assertive"` with error message

**Focus Management:**
- Focus moves to close button when liner notes opens
- Focus returns to three-dot icon when liner notes closes
- Focus trap within liner notes while open

---

## Technical Implementation

### Component Architecture

```tsx
<ArtistGatefold>
  <ConcertHistoryPanel onMenuClick={handleMenuClick}>
    <ConcertRow>
      <span>Date</span>
      <span>Venue</span>
      <ConcertContextMenu
        concert={concert}
        onSetlistClick={() => handleSetlistClick(concert)}
        onTourDatesClick={() => handleTourDatesClick(concert)}
        hasSetlist={checkSetlistAvailability(concert)}
        hasTourDates={tourDatesCount > 0}
      />
    </ConcertRow>
  </ConcertHistoryPanel>

  <SpotifyPanel dimmed={isPanelOpen} />

  {selectedConcert && showSetlist && (
    <LinerNotesPanel
      concert={selectedConcert}
      setlist={setlistData}
      isLoading={isLoadingSetlist}
      error={setlistError}
      onClose={handleClosePanel}
    />
  )}

  {selectedArtist && showTourDates && (
    <TourDatesPanel
      artistName={selectedArtist}
      tourDates={tourDatesData}
      isLoading={isLoadingTourDates}
      error={tourDatesError}
      onClose={handleClosePanel}
    />
  )}
</ArtistGatefold>
```

### State Management

**New State Variables:**

```typescript
// In ArtistGatefold.tsx
const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null)
const [setlistData, setSetlistData] = useState<Setlist | null>(null)
const [isLoadingSetlist, setIsLoadingSetlist] = useState(false)
const [setlistError, setSetlistError] = useState<string | null>(null)
```

**State Transitions:**

1. **Idle:** `selectedConcert = null`, liner notes hidden
2. **Loading:** `selectedConcert = concert`, `isLoadingSetlist = true`, show skeleton
3. **Success:** `setlistData` populated, show setlist
4. **Error:** `setlistError` set, show error message
5. **Not Found:** `setlistData = null` after load, show not found message

### Data Flow

**Fetching Setlists:**

```typescript
const handleSetlistClick = async (concert: Concert) => {
  // If switching setlists, show loading immediately
  setSelectedConcert(concert)
  setSetlistData(null)
  setIsLoadingSetlist(true)
  setSetlistError(null)

  try {
    const setlist = await fetchSetlist({
      artistName: concert.headliner,
      date: concert.date,
      venueName: concert.venue,
      city: concert.cityState.split(',')[0].trim()
    })

    setSetlistData(setlist)
  } catch (error) {
    setSetlistError(error.message)
  } finally {
    setIsLoadingSetlist(false)
  }
}
```

### setlist.fm API Integration

**Service Module:** `src/services/setlistfm.ts`

```typescript
export interface SetlistSearchParams {
  artistName: string
  date: string // YYYY-MM-DD format
  venueName: string
  city: string
}

export interface SetlistSong {
  name: string
  cover?: {
    name: string // Original artist if it's a cover
  }
  tape?: boolean // Indicates if played from tape
  info?: string // Additional notes
}

export interface SetlistSet {
  name?: string // "Set 1", "Encore", etc.
  encore?: boolean
  songs: SetlistSong[]
}

export interface Setlist {
  artist: {
    name: string
    mbid?: string // MusicBrainz ID
  }
  venue: {
    name: string
    city: {
      name: string
      state?: string
      country: {
        code: string
        name: string
      }
    }
  }
  eventDate: string // DD-MM-YYYY format from API
  sets: SetlistSet[]
  info?: string // Show notes
  url: string // setlist.fm URL
}

/**
 * Fetch setlist from setlist.fm API
 * Uses search endpoint to find matching setlist
 */
export async function fetchSetlist(
  params: SetlistSearchParams
): Promise<Setlist | null> {
  const { artistName, date, venueName, city } = params

  // Convert date to DD-MM-YYYY format for API
  const [year, month, day] = date.split('-')
  const apiDate = `${day}-${month}-${year}`

  const url = new URL('https://api.setlist.fm/rest/1.0/search/setlists')
  url.searchParams.append('artistName', artistName)
  url.searchParams.append('date', apiDate)
  url.searchParams.append('cityName', city)

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'x-api-key': import.meta.env.VITE_SETLISTFM_API_KEY
    }
  })

  if (!response.ok) {
    throw new Error(`setlist.fm API error: ${response.status}`)
  }

  const data = await response.json()

  // Find best match (exact venue name match preferred)
  const setlists = data.setlist || []
  if (setlists.length === 0) return null

  // Try exact venue match first
  let bestMatch = setlists.find((s: any) =>
    s.venue.name.toLowerCase() === venueName.toLowerCase()
  )

  // Fall back to first result if no exact match
  if (!bestMatch && setlists.length > 0) {
    bestMatch = setlists[0]
  }

  return bestMatch || null
}
```

**Environment Variable:**

```bash
# .env
VITE_SETLISTFM_API_KEY=your_api_key_here
```

**API Key Security:**
- setlist.fm API keys are safe to expose client-side (common practice)
- Key is rate-limited per key (not per domain)
- Restrict key to your domain in setlist.fm dashboard if possible
- Monitor usage to detect abuse

### Caching Strategy

**Client-Side Cache:**

```typescript
// Simple in-memory cache with TTL
const setlistCache = new Map<string, {
  data: Setlist | null
  timestamp: number
  ttl: number
}>()

const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

function getCacheKey(params: SetlistSearchParams): string {
  return `${params.artistName}|${params.date}|${params.venueName}|${params.city}`
}

async function fetchSetlistWithCache(
  params: SetlistSearchParams
): Promise<Setlist | null> {
  const cacheKey = getCacheKey(params)
  const cached = setlistCache.get(cacheKey)

  // Return cached if still valid
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }

  // Fetch fresh data
  const data = await fetchSetlist(params)

  // Cache result (including null for not found)
  setlistCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL
  })

  return data
}
```

**Why Client-Side Only:**
- No build-time enrichment needed (setlists can change)
- Real-time data ensures accuracy
- User-initiated fetch (progressive disclosure)
- Cache prevents redundant API calls during session

### Error Handling

**Error Types:**

1. **Network Error:** Can't reach setlist.fm
   - Show: "Unable to load setlist. Check your connection."
   - Allow retry button
2. **API Error (4xx/5xx):** Server error
   - Show: "Unable to load setlist. Try again later."
3. **Not Found (empty results):** No setlist exists
   - Show: "No setlist available for this concert"
   - Explain community-contributed nature
4. **Rate Limit:** Too many requests
   - Show: "Too many requests. Please wait a moment."

**Retry Logic:**

```typescript
async function fetchWithRetry(
  fn: () => Promise<any>,
  maxRetries = 2,
  delay = 1000
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

### Performance Considerations

**Optimizations:**

1. **Lazy Load:** Only fetch when user clicks setlist button (not on gatefold open)
2. **Debouncing:** Prevent rapid switching between concerts
3. **Request Cancellation:** Cancel in-flight requests if user switches concerts
4. **Skeleton UI:** Instant feedback while loading
5. **Cache:** Avoid redundant API calls

**Bundle Size:**
- No additional dependencies (use native fetch)
- ~3KB for service module
- ~5KB for LinerNotesPanel component
- Total impact: ~8KB gzipped

---

## Matching Logic

### Challenge: Fuzzy Matching

**Problem:** Concert data and setlist.fm data may not match exactly:
- Artist name variations ("The National" vs "National")
- Venue name changes or abbreviations
- City spelling differences
- Multiple shows on same date

**Solution Strategy:**

1. **Primary Match:** Artist name + Date + City (most reliable)
2. **Secondary Match:** Venue name verification (filter results)
3. **Fallback:** Accept first result if close match

**Matching Algorithm:**

```typescript
function findBestSetlistMatch(
  searchResults: any[],
  params: SetlistSearchParams
): any | null {
  if (searchResults.length === 0) return null

  // Score each result
  const scored = searchResults.map(result => ({
    result,
    score: calculateMatchScore(result, params)
  }))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Return best match if score > threshold
  const best = scored[0]
  return best.score > 0.5 ? best.result : null
}

function calculateMatchScore(result: any, params: SetlistSearchParams): number {
  let score = 0

  // Exact venue match (strongest signal)
  if (normalizeVenueName(result.venue.name) ===
      normalizeVenueName(params.venueName)) {
    score += 0.5
  }

  // City match
  if (result.venue.city.name.toLowerCase() ===
      params.city.toLowerCase()) {
    score += 0.3
  }

  // Artist name similarity (Levenshtein distance)
  const artistSimilarity = stringSimilarity(
    result.artist.name,
    params.artistName
  )
  score += artistSimilarity * 0.2

  return score
}

function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, '') // Remove leading "The"
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim()
}
```

### Data Quality Considerations

**Known Challenges:**

1. **Coverage:** Not all concerts have setlists on setlist.fm
   - Older shows (pre-2000) less likely to have data
   - Smaller artists less likely to be documented
   - Expected hit rate: ~40-60% for this dataset
2. **Accuracy:** Community-contributed data may have errors
   - Song order may be approximate
   - Some songs may be missing
   - Encore designation may vary
3. **Timing:** Setlists often added days/weeks after show
   - Recent shows may not have data yet

**User Communication:**

- Set expectations with "via setlist.fm" attribution
- Explain community-contributed nature in not found state
- Link to setlist.fm for user contributions

---

## Testing Strategy

### Manual Testing Checklist

**Interaction Testing:**
- [ ] Click three-dot icon opens liner notes smoothly
- [ ] Liner notes slides in from right (400ms)
- [ ] Spotify panel dims when liner notes open
- [ ] Close button (X) closes liner notes
- [ ] Click outside liner notes closes it
- [ ] ESC key closes liner notes (but not gatefold)
- [ ] Switching concerts transitions smoothly (old out, new in)
- [ ] Loading skeleton appears while fetching
- [ ] Setlist displays correctly when loaded
- [ ] Not found message appears when no setlist exists
- [ ] Error message appears on network failure
- [ ] Scrolling works for long setlists

**State Testing:**
- [ ] Cache prevents duplicate API calls
- [ ] Switching rapidly between concerts doesn't break
- [ ] Opening/closing multiple times works
- [ ] Gatefold close button still closes entire gatefold
- [ ] Liner notes state resets when gatefold closes

**Visual Testing:**
- [ ] Typography matches design spec
- [ ] Colors match dark theme
- [ ] Spacing matches design spec
- [ ] Animations are smooth (no jank)
- [ ] Panel shadows create depth effect
- [ ] Close button hover effect works
- [ ] Scrollbar styling looks polished

**Accessibility Testing:**
- [ ] Three-dot icons focusable with keyboard
- [ ] Enter/Space activates setlist view
- [ ] ESC closes liner notes
- [ ] Focus management works correctly
- [ ] Screen reader announces loading/error states
- [ ] Color contrast meets WCAG AA standards

**Edge Cases:**
- [ ] Very long setlists (30+ songs) scroll correctly
- [ ] Very short setlists (3 songs) don't look broken
- [ ] Setlists with special characters display correctly
- [ ] Covers/tape indicators show properly
- [ ] Multiple encores display correctly
- [ ] Empty sets (no songs) handled gracefully

### Test Data

**Known Setlists for Testing:**

1. **The National - Brooklyn Steel (2023-10-19)**
   - Should exist on setlist.fm
   - Good match likelihood
2. **Violent Femmes - Various**
   - Multiple shows likely documented
3. **Obscure/Old Shows**
   - Test not found state
   - Verify graceful handling

---

## Implementation Plan

### Phase 1: API Integration (Window 1)

**Files to Create:**
- `src/services/setlistfm.ts` - API client and caching
- `src/types/setlist.ts` - TypeScript interfaces

**Files to Modify:**
- `.env` - Add VITE_SETLISTFM_API_KEY
- `src/vite-env.d.ts` - Add env variable type

**Tasks:**
1. Set up setlist.fm API key (see [docs/api-setup.md](../../api-setup.md))
2. Implement fetchSetlist() function
3. Implement caching layer
4. Implement fuzzy matching logic
5. Write unit tests for matching algorithm
6. Test API integration with known concerts

**Acceptance Criteria:**
- [ ] API calls return setlist data
- [ ] Cache prevents duplicate requests
- [ ] Fuzzy matching finds correct setlists
- [ ] Error handling works for all failure modes

### Phase 2: UI Components (Window 2)

**Files to Create:**
- `src/components/scenes/ArtistScene/LinerNotesPanel.tsx` - Main panel component
- `src/components/scenes/ArtistScene/SetlistButton.tsx` - Three-dot button component

**Files to Modify:**
- `src/components/scenes/ArtistScene/ArtistGatefold.tsx` - Add liner notes state
- `src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx` - Add setlist buttons
- `src/index.css` - Add liner notes styles

**Tasks:**
1. Create SetlistButton component with three-dot icon
2. Update ConcertHistoryPanel to show buttons
3. Create LinerNotesPanel component structure
4. Implement loading/success/error/not found states
5. Add slide animations (translateX)
6. Add Spotify panel dimming effect
7. Implement close functionality (X button, click outside, ESC)
8. Style scrollbar for setlist content
9. Test animations and transitions

**Acceptance Criteria:**
- [ ] SetlistButton appears on concert rows
- [ ] LinerNotesPanel slides in smoothly
- [ ] All states (loading/success/error/not found) render correctly
- [ ] Animations match design spec timing
- [ ] Closing works via all three methods
- [ ] Scrolling works for long setlists

### Phase 3: Integration & Polish (Window 3)

**Files to Modify:**
- `src/components/scenes/ArtistScene/ArtistGatefold.tsx` - Connect API to UI
- `src/components/scenes/ArtistScene/SpotifyPanel.tsx` - Add dimming prop

**Tasks:**
1. Wire up API calls to LinerNotesPanel
2. Implement concert switching (Option A - smooth transition)
3. Add request cancellation for rapid switching
4. Implement accessibility features (focus management, ARIA labels)
5. Add keyboard navigation
6. Polish animations and timing
7. Test edge cases and error scenarios
8. Performance testing (API calls, animations)
9. Cross-browser testing
10. Documentation updates

**Acceptance Criteria:**
- [ ] Switching concerts transitions smoothly
- [ ] No duplicate API calls during switching
- [ ] Keyboard navigation works completely
- [ ] Screen reader support functional
- [ ] Performance is smooth (60fps animations)
- [ ] Works in Chrome, Firefox, Safari
- [ ] Documentation updated

### Phase 4: Testing & Deployment (Window 4)

**Tasks:**
1. Comprehensive manual testing (all checklist items)
2. Accessibility audit (keyboard, screen reader)
3. Performance profiling
4. Cross-browser compatibility testing
5. Mobile responsive testing (if applicable)
6. API rate limit monitoring
7. User acceptance testing
8. Production deployment
9. Monitor for errors/issues

**Acceptance Criteria:**
- [ ] All manual test cases pass
- [ ] Accessibility requirements met
- [ ] Performance benchmarks met
- [ ] No console errors
- [ ] Works on target browsers
- [ ] API usage within limits

---

## Dependencies

### Required
- **Artist Scene Gatefold** (✅ Complete in v1.4.0)
  - Provides the container and panels for liner notes integration
  - ConcertHistoryPanel component already exists
  - Animation system and state management in place

### Optional
- **Spotify Integration** (Planned v1.5.0)
  - Liner notes will dim the Spotify panel
  - If Spotify not implemented, dims skeleton state instead
  - No blocking dependency - works with or without Spotify

---

## Production Deployment Strategy

### Development vs Production API Access

**Development (Current):**
- ✅ Vite dev server proxy handles API calls
- ✅ Proxy adds API key header automatically
- ✅ No CORS issues

**Production (Requires Implementation):**
- ❌ No proxy available (static build)
- ❌ Direct browser requests blocked by CORS
- ⚠️ Needs serverless function OR build-time pre-fetch

### Option 1: Cloudflare Functions Proxy (Runtime)

**Implementation:**
Create `functions/api/setlistfm/[...path].ts`:

```typescript
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  // Build setlist.fm API URL
  const apiUrl = `https://api.setlist.fm/rest/1.0${url.pathname.replace('/api/setlistfm', '')}`
  const apiUrlWithParams = new URL(apiUrl)
  apiUrlWithParams.search = url.search

  // Proxy request with API key
  const response = await fetch(apiUrlWithParams.toString(), {
    headers: {
      'Accept': 'application/json',
      'x-api-key': env.SETLISTFM_API_KEY
    }
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
```

**Cloudflare Pages Configuration:**
- Add `SETLISTFM_API_KEY` to environment variables in dashboard
- Free tier: 500,000 requests/month (plenty for this use case)
- 10ms CPU time per request (more than enough for proxy)
- Zero cost for reasonable usage

**Pros:**
- Dynamic, always up-to-date
- Works for all concerts
- Simple implementation

**Cons:**
- Requires deployment config
- API rate limits apply at runtime

### Option 2: Build-Time Pre-Fetch + Runtime Fallback (Hybrid - Recommended)

**Implementation:**

**Step 1:** Create build script `scripts/prefetch-setlists.ts`:

```typescript
import { fetchSetlist } from '../src/services/setlistfm'
import { readFileSync, writeFileSync } from 'fs'

interface SetlistCacheEntry {
  concert: {
    artistName: string
    date: string
    venue: string
    city: string
  }
  setlist: Setlist | null
  fetchedAt: string
}

async function prefetchSetlists() {
  // Load artist cards data
  const artistCards = JSON.parse(
    readFileSync('public/data/artist-cards.json', 'utf-8')
  )

  // Load existing cache (if any)
  let cache: SetlistCacheEntry[] = []
  try {
    cache = JSON.parse(
      readFileSync('public/data/setlists-cache.json', 'utf-8')
    )
  } catch {
    // No cache yet, start fresh
  }

  const cacheMap = new Map(
    cache.map(entry => [getCacheKey(entry.concert), entry])
  )

  // Extract all concerts
  const allConcerts = artistCards.flatMap(artist =>
    artist.concerts.map(concert => ({
      artistName: artist.name,
      date: concert.date,
      venue: concert.venue,
      city: concert.city.split(',')[0].trim()
    }))
  )

  console.log(`Found ${allConcerts.length} concerts to check`)

  let fetched = 0
  let cached = 0
  let failed = 0

  // Fetch setlists for uncached concerts
  for (const concert of allConcerts) {
    const key = getCacheKey(concert)

    // Skip if already in cache (within 30 days)
    const existing = cacheMap.get(key)
    if (existing) {
      const age = Date.now() - new Date(existing.fetchedAt).getTime()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000

      if (age < thirtyDays) {
        cached++
        continue
      }
    }

    // Fetch from API
    try {
      console.log(`Fetching: ${concert.artistName} - ${concert.venue} (${concert.date})`)

      const setlist = await fetchSetlist(concert)

      cacheMap.set(key, {
        concert,
        setlist,
        fetchedAt: new Date().toISOString()
      })

      fetched++

      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`Failed: ${concert.artistName} - ${error.message}`)
      failed++
    }
  }

  // Write updated cache
  const updatedCache = Array.from(cacheMap.values())
  writeFileSync(
    'public/data/setlists-cache.json',
    JSON.stringify(updatedCache, null, 2)
  )

  console.log(`\n✅ Setlist pre-fetch complete!`)
  console.log(`   Fetched: ${fetched} new`)
  console.log(`   Cached:  ${cached} existing`)
  console.log(`   Failed:  ${failed}`)
  console.log(`   Total:   ${updatedCache.length} in cache`)
}

function getCacheKey(concert: any): string {
  return `${concert.artistName}|${concert.date}|${concert.venue}|${concert.city}`.toLowerCase()
}

prefetchSetlists().catch(console.error)
```

**Step 2:** Update `src/services/setlistfm.ts` to check cache first:

```typescript
// Try static cache first (build-time pre-fetched)
async function fetchFromCache(params: SetlistSearchParams): Promise<Setlist | null | undefined> {
  try {
    const response = await fetch('/data/setlists-cache.json')
    if (!response.ok) return undefined

    const cache: SetlistCacheEntry[] = await response.json()
    const key = getCacheKey(params)

    const entry = cache.find(e => getCacheKey(e.concert) === key)
    return entry?.setlist ?? undefined

  } catch {
    return undefined // Cache not available
  }
}

// Updated main fetch function
export async function fetchSetlist(params: SetlistSearchParams): Promise<Setlist | null> {
  // 1. Check static build-time cache
  const staticCached = await fetchFromCache(params)
  if (staticCached !== undefined) {
    return staticCached // null or Setlist
  }

  // 2. Check runtime in-memory cache
  const cacheKey = getCacheKey(params)
  const memoryCached = setlistCache.get(cacheKey)
  if (memoryCached && Date.now() - memoryCached.timestamp < memoryCached.ttl) {
    return memoryCached.data
  }

  // 3. Fetch from API (requires serverless function in production)
  const data = await fetchFromAPI(params)

  // Cache in memory for session
  setlistCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL
  })

  return data
}
```

**Step 3:** Add npm script to `package.json`:

```json
{
  "scripts": {
    "prefetch-setlists": "tsx scripts/prefetch-setlists.ts",
    "build": "npm run prefetch-setlists && tsx scripts/generate-version.ts && tsc && vite build"
  }
}
```

**Benefits:**
- ✅ Historic setlists cached at build time (immutable data)
- ✅ Zero API calls for 99% of concerts
- ✅ Instant loading (static JSON)
- ✅ Fallback to API for uncached concerts
- ✅ No rate limits for cached data

**Deployment Strategy:**
1. **Pre-production:** Run `npm run prefetch-setlists` to build initial cache
2. **Each deployment:** Re-run pre-fetch to capture new concerts
3. **Production:** Static cache served from CDN, API fallback via Cloudflare Function (if needed)

**Cache Storage:**
- File: `public/data/setlists-cache.json`
- Size estimate: ~50-100KB for 174 concerts (many will be null)
- Served as static asset from CDN

### Recommendation

**Use Hybrid Approach (Option 2):**
- Build-time pre-fetch for all historical concerts
- Cloudflare Function fallback for edge cases
- Best performance with minimal API usage

## Future Enhancements

### Phase 2 Improvements (Post-v1.5.0)

1. **Setlist Enrichment at Build Time** ✅ (See Production Deployment Strategy above)
   - Implemented as hybrid approach
   - Static cache for historical concerts
   - Runtime fallback for new data

2. **User Contributions**
   - "Add setlist" button for concerts without data
   - Deep link to setlist.fm contribution form
   - Pre-fill artist, date, venue from our data

3. **Setlist Stats**
   - Most played songs across all concerts
   - Song frequency visualization
   - Rare/unique performances highlighted

4. **Cross-Linking**
   - Click song name to filter Timeline by performances
   - "Other times you heard this song" panel
   - Artist discovery from cover songs

5. **Setlist Search**
   - Filter concerts by song name
   - "Find concerts where they played..."
   - Integration with main search bar

6. **Mobile Optimization**
   - Bottom sheet variant for mobile
   - Swipe gestures for concert switching
   - Optimized for touch navigation

---

## Cost Analysis

### setlist.fm API Costs

**Rate Limits:**
- Free tier: Unlimited requests (fair use)
- No explicit rate limit documented
- Recommend: Max 5 requests/second (self-throttle)

**Expected Usage:**
- Average setlist fetches per session: 3-5
- Typical users: 10-20 per day
- Monthly API calls: ~450-900
- **Cost: $0** (completely free API)

**Monitoring:**
- Track API errors in console
- Monitor for rate limit responses
- Log failed matches for debugging
- No billing alerts needed (free tier)

---

## Accessibility Compliance

### WCAG 2.1 Level AA Requirements

**Perceivable:**
- ✅ Color contrast: Text on backgrounds meets 4.5:1 ratio
- ✅ Text sizing: Minimum 14px body text
- ✅ Focus indicators: Visible focus rings on all interactive elements

**Operable:**
- ✅ Keyboard accessible: All functions via keyboard
- ✅ Focus order: Logical tab sequence
- ✅ ESC key: Standard close behavior
- ✅ No keyboard traps: Can escape all dialogs

**Understandable:**
- ✅ Clear labels: Descriptive button labels
- ✅ Error messages: Clear, actionable
- ✅ Consistent behavior: Matches gatefold patterns

**Robust:**
- ✅ ARIA labels: All interactive elements labeled
- ✅ Live regions: Status announcements
- ✅ Semantic HTML: Proper heading hierarchy

---

## Cross-Browser Compatibility

**Supported Browsers:**
- Chrome/Edge 90+ (primary target)
- Firefox 88+
- Safari 14+

**Known Issues:**
- None expected (standard CSS transforms and fetch API)

**Fallbacks:**
- Reduced motion: Instant transitions (no slides)
- No fetch API: Polyfill not needed (supported everywhere)

**Testing Priority:**
1. Chrome (primary)
2. Safari (macOS/iOS)
3. Firefox (secondary)
4. Edge (same as Chrome)

---

## Success Metrics

### Quantitative Metrics

**User Engagement:**
- % of gatefold opens that click setlist button (target: 30%+)
- Average setlists viewed per session (target: 2+)
- Setlist panel open duration (target: 10+ seconds)

**Technical Performance:**
- API response time (target: <1s)
- Cache hit rate (target: >50%)
- Animation frame rate (target: 60fps)
- Failed API calls (target: <5%)

**Data Quality:**
- Setlist match rate (expected: 40-60%)
- Fuzzy match accuracy (target: >80% correct)
- User-reported errors (target: <1%)

### Qualitative Metrics

**User Satisfaction:**
- Feature discovery rate (via analytics)
- User feedback/comments
- Return engagement with feature

**Design Goals:**
- ✅ Maintains vinyl metaphor authenticity
- ✅ Feels like "opening liner notes"
- ✅ Smooth, polished animations
- ✅ Progressive disclosure (doesn't overwhelm)

---

## Documentation Updates Required

### Files to Update

1. **docs/STATUS.md**
   - Add v1.5.0 roadmap entry
   - List as "Planned" feature
   - Reference this spec

2. **docs/api-setup.md**
   - Add setlist.fm API section
   - Document key acquisition process
   - Add environment variable instructions
   - Cross-reference this spec

3. **README.md**
   - Add to feature list
   - Mention setlist integration
   - Update screenshots (post-implementation)

4. **docs/design/changelog-style-guide.md** (if exists)
   - Document feature for v1.5.0 release notes

---

## Related Specifications

**Parent Features:**
- [Artist Scene Gatefold](../implemented/artist-scene.md) - Container for liner notes
- [Spotify Artist Integration](./artists-spotify-integration.md) - Panel that gets covered by liner notes

**Related Features:**
- [Timeline Artist Display Enhancement](./timeline-artist-display-enhancement.md) - Could also show setlists in modal
- [Data Normalization Architecture](./global-data-normalization-architecture.md) - Artist name matching

**Future Enhancements:**
- Setlist-based filtering and discovery features
- Build-time setlist enrichment
- User contribution flows

---

## Questions for Review

1. **Three-dot icon vs other indicators?**
   - Current: ⋮ (universal "more" pattern)
   - Alternative: Text label "Setlist" more explicit but less minimal
   - Decision: Start with three dots, A/B test if needed

2. **Cache duration: 24 hours appropriate?**
   - Setlists rarely change after initial submission
   - Could extend to 7 days or even 30 days
   - Decision: Start with 24h, extend if API costs become concern

3. **Fuzzy matching confidence threshold?**
   - Current: 50% match score minimum
   - Could be too permissive (false positives)
   - Could be too strict (miss valid matches)
   - Decision: Start at 50%, tune based on accuracy metrics

4. **Mobile implementation priority?**
   - Liner notes require significant viewport space
   - Mobile gatefold → bottom sheet (different interaction)
   - Decision: Desktop first, mobile in v1.5.1+

---

## Implementation Improvements (v1.1.0)

The following enhancements were made during implementation to improve the vinyl metaphor authenticity and maximize usability:

### 1. Animation Direction Change

**Original Spec:** Liner notes slide in from right (`translateX(100%)` → `translateX(0)`)

**Implemented:** Liner notes slide from left (`translateX(-400px)` → `translateX(0)`)

**Rationale:** Better matches the vinyl sleeve metaphor - paper visually emerges from the Concert History Panel (left side) like pulling liner notes from a record sleeve.

### 2. Authentic Paper Aesthetic

**Original Spec:** Dark background (`rgba(24, 24, 24, 0.98)`)

**Implemented:** Off-white paper gradient (`#f5f5f0` → `#e8e8e0`)

**Added:**

- SVG fractal noise texture overlay (3% opacity)
- Dimensional paper curl shadow (bottom-right corner)
- Inset shadow for depth (`inset -2px 0 8px rgba(0, 0, 0, 0.08)`)
- Warm beige border (`rgba(180, 170, 150, 0.3)`)

**Rationale:** Authentic paper aesthetic reinforces the vinyl liner notes metaphor - users should feel like they're handling physical concert memorabilia.

### 3. Header Optimization

**Original Spec:** 3-line header with artist name, venue, and city/date (~120px)

**Implemented:** Single compact line with date + venue only (~40px)

**Space Gained:** +80px vertical space (30% more area for setlist content)

**Rationale:** Artist name, venue, and city are already visible on the Concert History Panel (left side) - repeating this information wastes valuable space. The compact header provides just enough context while maximizing the setlist viewing area.

### 4. Paper-Appropriate Typography

**Updated Colors:**

- Section headers: `#1DB954` (Spotify green) → `#2a5a2a` (forest green - ink-like)
- Song titles: `#e5e5e5` (light gray) → `#2a2a25` (dark charcoal)
- Song numbers: `#737373` (medium gray) → `#8a8a80` (warm gray)
- Annotations: Updated to olive/warm gray tones for paper harmony

**Rationale:** The original bright white/green colors were designed for dark backgrounds. Paper requires darker, warmer tones that suggest printed ink on paper stock.

### 5. Visual Effects Enhancement

**Added:**

- Paper texture using SVG noise filter
- Corner curl shadow (radial gradient)
- Paper-themed scrollbar (olive tones)
- Gradient divider with fade effect

**Rationale:** These subtle details enhance the tactile, physical quality of the liner notes - making the digital experience feel more like handling real vinyl memorabilia.

### Implementation Philosophy Summary

The improvements maintain the spec's core functionality while elevating the vinyl metaphor through authentic material design. The result is a liner notes experience that feels genuinely like pulling paper from a record sleeve, not just a dark panel sliding over content.

---

## Revision History

- **2026-01-02:** Initial specification created
- **2026-01-04:** Design improvements implemented
  - Changed animation from right-to-left to left-to-right (vinyl sleeve metaphor)
  - Updated to authentic paper aesthetic (off-white gradient, texture, dimensional effects)
  - Minimized header to single line (date + venue only) for 30% more content space
  - Updated typography for paper theme (forest green headers, charcoal text, olive accents)
  - Added paper curl shadow effect and SVG texture overlay
  - Updated all color values and spacing specifications
- **Version:** 1.1.0 (Implemented)
- **Author:** Lead Designer & Developer
- **Status:** Implemented and Documented

---

## Appendix: API Response Examples

### Successful Setlist Response

```json
{
  "type": "setlists",
  "itemsPerPage": 20,
  "page": 1,
  "total": 1,
  "setlist": [
    {
      "id": "63e8f5a9",
      "versionId": "7bb5c1d3",
      "eventDate": "19-10-2023",
      "lastUpdated": "2023-10-20T08:30:15.000+0000",
      "artist": {
        "mbid": "a7b84ffe-8dc3-4040-8e7e-9e21e5b00000",
        "name": "The National",
        "sortName": "National, The",
        "disambiguation": "",
        "url": "https://www.setlist.fm/setlists/the-national-3bd6a245.html"
      },
      "venue": {
        "id": "63d5f123",
        "name": "Brooklyn Steel",
        "city": {
          "id": "5128581",
          "name": "Brooklyn",
          "state": "New York",
          "stateCode": "NY",
          "coords": {
            "lat": 40.6781784,
            "long": -73.9441579
          },
          "country": {
            "code": "US",
            "name": "United States"
          }
        },
        "url": "https://www.setlist.fm/venue/brooklyn-steel-brooklyn-ny-usa-63d5f123.html"
      },
      "tour": {
        "name": "First Two Pages of Frankenstein Tour"
      },
      "sets": {
        "set": [
          {
            "song": [
              { "name": "Runaway" },
              { "name": "Bloodbuzz Ohio" },
              { "name": "Don't Swallow the Cap" },
              { "name": "I Need My Girl" },
              { "name": "The System Only Dreams in Total Darkness" },
              { "name": "Fake Empire" },
              { "name": "Mistaken for Strangers" },
              { "name": "Graceless" },
              { "name": "This Is the Last Time", "cover": { "name": "Keane" } },
              { "name": "Mr. November" }
            ]
          },
          {
            "encore": 1,
            "song": [
              { "name": "Terrible Love" },
              { "name": "Vanderlyle Crybaby Geeks" }
            ]
          }
        ]
      },
      "info": "Incredible show with surprise Keane cover",
      "url": "https://www.setlist.fm/setlist/the-national/2023/brooklyn-steel-brooklyn-ny-63e8f5a9.html"
    }
  ]
}
```

### Empty Response (Not Found)

```json
{
  "type": "setlists",
  "itemsPerPage": 20,
  "page": 1,
  "total": 0,
  "setlist": []
}
```

### Error Response (Rate Limited)

```json
{
  "code": 429,
  "message": "Rate limit exceeded",
  "status": "Too Many Requests"
}
```
