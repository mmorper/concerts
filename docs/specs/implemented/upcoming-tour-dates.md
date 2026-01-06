# Upcoming Tour Dates - Artist Gatefold Enhancement

**Status:** Planned
**Target Version:** v1.6.0
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:**
- Artist Scene Gatefold (✅ Complete in v1.4.0)
- Setlist Liner Notes (✅ Complete in v1.5.0) - Shares panel animation pattern
**Mobile Note:** 📱 Requires mobile-specific bottom sheet layout (see [mobile-optimization.md](mobile-optimization.md))

---

## ⚠️ IMPLEMENTATION NOTE - DESIGN DECISIONS (2026-01-05)

**CRITICAL: This spec was written before v1.5.0 implementation. The following design decisions supersede the original spec:**

### ✅ Agreed Design Pattern (Badge Approach - NOT Contextual Menu)

**What Changed:**

- ❌ **NO contextual menu** with three-dot icon on each concert row
- ❌ **NO menu** with "View Setlist" and "Upcoming Shows" options
- ✅ **YES to Tour Badge** in Concert History header (below artist info)
- ✅ **YES to Eager Loading** - Check API when gatefold opens (background)
- ✅ **Keep existing setlist buttons** unchanged (inline musical note icon)

**Badge Design:**

```
┌──────────────────────────────┐
│  [Photo]  The National       │
│           Indie Rock · 4     │
│           ● ON TOUR · 12 dates │ ← Badge only appears if touring
└──────────────────────────────┘
```

- **Label:** "ON TOUR · X dates" (dynamic count)
- **No checkmark** when panel is open (keep label same)
- **Pulsing green dot** animation (2s cycle, Spotify green)
- **Only visible** when artist has upcoming dates (eager check succeeds)
- **Clickable** - Opens tour dates panel (or closes if already open - toggle)

### ✅ Animation Pattern (CRITICAL - Must Match Liner Notes EXACTLY)

**Both panels (setlist liner notes AND tour dates) use IDENTICAL animations:**

**Opening Animation:**

```css
/* Both panels positioned at: absolute top-0 right-0 */
/* Start position: translateX(-400px) - Hidden inside left panel */
/* End position: translateX(0) - Covering Spotify panel */
/* Animation: slideInFromLeft 400ms cubic-bezier(0.4, 0, 0.2, 1) */
```

**Metaphor:** Pulling liner notes/tour poster OUT of vinyl sleeve (left → right slide)

**Closing Animation:**

```css
/* Start position: translateX(0) - Visible at right panel */
/* End position: translateX(-400px) - Back into left panel */
/* Animation: slideOutToLeft 350ms cubic-bezier(0.4, 0, 0.2, 1) */
```

**Metaphor:** Sliding liner notes/tour poster BACK INTO vinyl sleeve (right → left slide)

### ✅ Panel Switching (Crossfade with 100ms Overlap)

**When user switches between setlist ↔ tour dates:**

1. Current panel starts sliding left at t=0ms (slideOutToLeft, 350ms)
2. New panel starts sliding right at t=100ms (slideInFromLeft, 400ms)
3. **Total transition: 450ms** with smooth crossfade overlap
4. **Only ONE panel visible** at any time (never coexist)

### ✅ State Management (Single activePanel)

```typescript
type ActivePanel = 'none' | 'setlist' | 'tour-dates'
const [activePanel, setActivePanel] = useState<ActivePanel>('none')
```

**Benefits:**

- Prevents race conditions
- Clear panel switching logic
- Only one panel rendered at a time
- ESC key closes active panel (priority: most recent)

### ✅ Badge Behavior

**Eager Loading Flow:**

1. User opens gatefold (flying tile → book opens)
2. **Background API check** starts (50ms after gatefold opens)
3. Check cache first (24hr TTL) or fetch from Bandsintown
4. **If dates found:** Badge fades in (200ms) with date count
5. **If no dates:** Badge never appears (silent)
6. **If error:** Badge never appears (fail silently, log to console)

**Badge Interactions:**

- **Click badge → Opens tour panel** (or closes if already open)
- **Click setlist button while tour open → Crossfade to setlist**
- **Click badge while setlist open → Crossfade to tour**
- **ESC key → Closes active panel** (tour or setlist)

### ✅ Files to Create (Updated)

**Create:**

- `src/components/scenes/ArtistScene/TourBadge.tsx` (~80 lines) - Badge component
- `src/components/scenes/ArtistScene/TourDatesPanel.tsx` (~250 lines) - Panel component
- `src/services/bandsintown.ts` (~150 lines) - API client with caching
- `src/types/tourDates.ts` (~50 lines) - TypeScript interfaces
- `src/hooks/useTourDates.ts` (~100 lines) - Eager loading hook

**Modify:**

- `src/components/scenes/ArtistScene/ArtistGatefold.tsx` - Add activePanel state
- `src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx` - Add tour badge to header
- `src/index.css` - Add tour dates panel styles (reuse liner notes animations)
- `.env` - Add VITE_BANDSINTOWN_APP_ID

**DO NOT Create:**

- ❌ ConcertContextMenu.tsx (not using contextual menu pattern)

---

## Executive Summary

Enhance the Artist Scene gatefold by integrating Bandsintown API to display upcoming tour dates for artists. When users click the **tour badge** in the Concert History Panel header, a tour dates panel slides out from the left (same animation as liner notes), covering the Spotify panel.

This feature complements the Setlist Liner Notes feature (v1.5.0) by adding forward-looking discovery to the backward-looking history. Users can see not just what they've experienced, but what opportunities exist to see the artist again.

**Key Innovation:** Tour badge with eager loading automatically checks if artist is touring when gatefold opens. Badge appears with pulsing green dot and date count, inviting user to explore upcoming shows. Panel uses identical "pulling from sleeve" animation as liner notes, maintaining the vinyl metaphor.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Upcoming Tour Dates feature for the Artist Scene gatefold.

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
- Add contextual menu to Concert History Panel (three-dot icon on each concert)
- Menu shows two options: "View Setlist" (past concerts) and "Upcoming Shows" (all concerts)
- "Upcoming Shows" opens a tour dates panel showing all future dates for the artist
- Panel slides in from right, covering the Spotify panel (same pattern as liner notes)
- Fetch tour dates from Bandsintown API
- Users can click individual dates to see venue/ticket details

**Key References:**
- Full Design Spec: docs/specs/future/upcoming-tour-dates.md
- API Setup Guide: docs/api-setup.md (Bandsintown section)
- Related Spec: docs/specs/future/setlist-liner-notes.md (shares menu pattern)
- Existing Components: src/components/scenes/ArtistScene/

**Implementation Approach:**
We'll implement this in 3-4 context windows:

**Window 1:** Contextual Menu & API Integration
- Create ConcertContextMenu component (replaces SetlistButton from v1.5.0)
- Implement menu with "View Setlist" and "Upcoming Shows" options
- Create src/services/bandsintown.ts with API client
- Implement caching layer (24-hour TTL)
- Test API calls with known artists

**Window 2:** Tour Dates UI Components
- Create TourDatesPanel component (380×380px)
- Design date list layout with venue/location/ticket links
- Implement loading/success/error/no dates states
- Add slide animations (translateX, same as liner notes)
- Style scrollbar for date list

**Window 3:** Integration & Polish
- Wire API to UI in ArtistGatefold
- Implement smooth panel switching between setlists and tour dates
- Add accessibility features (focus management, ARIA)
- Add keyboard navigation (ESC, Enter, Tab)
- Handle external ticket links
- Polish animations and timing

**Window 4:** Testing & Deployment (optional)
- Comprehensive manual testing
- Test with artists who have tours vs. those who don't
- Cross-browser validation
- Performance optimization
- Production deployment

**Design Philosophy:**
"Discovering future shows" - The panel reveals upcoming opportunities to see artists you love. It complements the historical setlist view by showing what's next, not just what was. The unified menu pattern makes both features discoverable from the same interaction point.

**Key Design Details:**
- Tour dates panel: 380×380px (matches liner notes panel)
- Animation: 400ms slide with cubic-bezier(0.4, 0, 0.2, 1)
- Background: rgba(24, 24, 24, 0.98) (matches liner notes)
- Typography: Playfair Display (artist name), Source Sans 3 (content)
- Section headers: #1DB954 (Spotify green), uppercase, tracking-wider
- Contextual menu: Two options with disabled states when unavailable
- Three-dot icon: rgba(255, 255, 255, 0.3) → 0.8 on hover

**API Details:**
- Endpoint: https://rest.bandsintown.com/artists/{artist_name}/events
- Authentication: app_id query parameter (from VITE_BANDSINTOWN_APP_ID)
- No API key required, just app identifier
- Response: JSON array with date, venue, location, ticket URL
- Caching: 24-hour TTL, in-memory Map keyed by "artist_name"
- Error handling: Network errors, not found (empty results), invalid artist

**Contextual Menu Pattern:**
```
┌─────────────────────────┐
│ 📋 View Setlist        │  ← Clickable (if past concert)
│ 🎫 Upcoming Shows      │  ← Clickable (if artist has dates)
└─────────────────────────┘
```

When unavailable:
```
┌─────────────────────────┐
│ 📋 No Setlist Found    │  ← Disabled, grayed out
│ 🎫 No Upcoming Shows   │  ← Disabled, grayed out
└─────────────────────────┘
```

**Current State:**
The Artist Scene gatefold is complete (v1.4.0) with:
- Flying tile animation (tile → center → gatefold)
- 3D book-opening effect (rotateY transforms)
- ConcertHistoryPanel (left) showing concert dates/venues in scrollable list
- SpotifyPanel (right) showing skeleton state (placeholder for v1.5.0 Spotify integration)
- ESC/click-outside close functionality
- Z-index layering (gatefold at 99998, flying tile at 99999)

**Files You'll Create:**
- src/components/scenes/ArtistScene/ConcertContextMenu.tsx (~150 lines) - Replaces SetlistButton
- src/components/scenes/ArtistScene/TourDatesPanel.tsx (~250 lines)
- src/services/bandsintown.ts (API client, ~100 lines)
- src/types/tourDates.ts (TypeScript interfaces, ~50 lines)

**Files You'll Modify:**
- src/components/scenes/ArtistScene/ArtistGatefold.tsx (add tour dates state)
- src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx (add context menu)
- src/index.css (tour dates panel styles, scrollbar)
- .env (add VITE_BANDSINTOWN_APP_ID)

Let's start with Window 1: Contextual Menu & API Integration. Should I begin by creating the Bandsintown service module?
```

---

## Design Philosophy

**"Discovering what's next"** - While liner notes let you relive past performances, tour dates help you plan future ones. The interaction maintains our vinyl metaphor: you're not just reading liner notes from old albums, you're checking tour posters to see when the band is coming to town next.

The unified contextual menu creates a single discovery point for both past and future: click the three dots to see what songs they played (if available) and where they're playing next (if touring).

---

## Visual Design

### Contextual Menu Design

**Menu Structure:**

The three-dot icon (⋮) on each concert row opens a contextual menu with two options:

```
┌─────────────────────────────┐
│ 📋 View Setlist            │  ← Option 1: Historical setlist
│ 🎫 Upcoming Shows          │  ← Option 2: Future tour dates
└─────────────────────────────┘
```

**Visual Treatment:**
- **Container:** Dropdown menu, 220px wide
- **Background:** `rgba(24, 24, 24, 0.98)` (nearly opaque dark)
- **Border:** 1px solid `rgba(255, 255, 255, 0.15)`
- **Border Radius:** 8px
- **Shadow:** `0 4px 12px rgba(0, 0, 0, 0.5)`
- **Padding:** 8px vertical, 0px horizontal
- **Position:** Anchored to three-dot icon, opens below and to the left

**Menu Item States:**

**Clickable (Available):**
- **Background:** Transparent, `rgba(255, 255, 255, 0.08)` on hover
- **Text Color:** `#e5e5e5` (light gray)
- **Icon:** Full color (📋 / 🎫)
- **Cursor:** pointer
- **Padding:** 12px horizontal, 10px vertical
- **Transition:** 150ms background

**Disabled (Unavailable):**
- **Background:** Transparent, no hover effect
- **Text Color:** `rgba(255, 255, 255, 0.3)` (dimmed)
- **Icon:** Dimmed emoji or grayed icon
- **Cursor:** default
- **Padding:** Same as clickable
- **User feedback:** Subtle "Not available" styling

**Typography:**
- **Font:** Source Sans 3, 0.9375rem (15px)
- **Weight:** 400 (normal)
- **Line Height:** 1.4
- **Icon + Text:** Icon on left, 10px gap, text aligned left

**Example States:**

```
// Both available
┌─────────────────────────────┐
│ 📋 View Setlist            │  ← white text, clickable
│ 🎫 Upcoming Shows          │  ← white text, clickable
└─────────────────────────────┘

// Only setlist available (artist not touring)
┌─────────────────────────────┐
│ 📋 View Setlist            │  ← white text, clickable
│ 🎫 No Upcoming Shows       │  ← dimmed text, disabled
└─────────────────────────────┘

// Only tour dates available (no setlist found)
┌─────────────────────────────┐
│ 📋 No Setlist Found        │  ← dimmed text, disabled
│ 🎫 Upcoming Shows          │  ← white text, clickable
└─────────────────────────────┘

// Neither available
┌─────────────────────────────┐
│ 📋 No Setlist Found        │  ← dimmed text, disabled
│ 🎫 No Upcoming Shows       │  ← dimmed text, disabled
└─────────────────────────────┘
```

**Interaction:**
1. Click three-dot icon → menu opens with fade-in (150ms)
2. Hover over available option → background highlight
3. Click option → menu closes, appropriate panel opens
4. Click outside menu → menu closes
5. ESC key → menu closes

### Tour Dates Panel Design

**Panel Specifications:**
- **Dimensions:** 380×380px (10px margin inside 400×400px panel)
- **Background:** `rgba(24, 24, 24, 0.98)` - Matches liner notes panel
- **Border:** 1px inner border `rgba(255, 255, 255, 0.1)` for depth
- **Border Radius:** 4px (matches other panels)
- **Shadow:** `0 10px 40px rgba(0, 0, 0, 0.6)` on left edge (lifted effect)
- **Z-Index:** Above Spotify panel but below close button

**Layout:**

```
┌───────────────────────────────────┐
│  ✕                           [380×380px]
│                                   │
│  The National                     │ ← Artist name
│  On Tour                          │ ← Section header
│  ───────────────────────────      │ ← Divider
│                                   │
│  UPCOMING SHOWS                   │ ← Section header
│                                   │
│  ○  Mar 15, 2026                  │ ← Date circle icon
│      Madison Square Garden        │ ← Venue
│      New York, NY                 │ ← Location
│      [Get Tickets →]              │ ← Ticket link
│                                   │
│  ○  Mar 18, 2026                  │
│      The Anthem                   │
│      Washington, DC               │
│      [Get Tickets →]              │
│                                   │
│  ○  Mar 22, 2026                  │
│      Hollywood Bowl               │
│      Los Angeles, CA              │
│      [Get Tickets →]              │
│                                   │
│  ...                              │
│                                   │
│  via Bandsintown                  │ ← Attribution
└───────────────────────────────────┘
```

**Typography:**
- **Artist Name:** Playfair Display, 1.75rem (28px), font-medium, `#ffffff`
- **"On Tour" Label:** Source Sans 3, 1.125rem (18px), font-normal, `#1DB954` (Spotify green)
- **Section Header:** Source Sans 3, 0.75rem (12px), font-semibold, `#1DB954`, uppercase, tracking-wider
- **Date:** Source Sans 3, 0.9375rem (15px), font-semibold, `#ffffff`
- **Venue:** Source Sans 3, 0.875rem (14px), font-normal, `#e5e5e5`
- **Location:** Source Sans 3, 0.8125rem (13px), font-normal, `#a3a3a3`
- **Ticket Link:** Source Sans 3, 0.8125rem (13px), font-medium, `#1DB954`, underline on hover
- **Attribution:** Source Sans 3, 0.6875rem (11px), font-normal, `#737373`

**Spacing:**
- **Top Padding:** 32px (for close button clearance)
- **Horizontal Padding:** 32px
- **Bottom Padding:** 32px
- **Header Spacing:** 8px between artist/label lines
- **Divider Margin:** 20px top, 24px bottom
- **Date Block Spacing:** 20px between date blocks
- **Date Internal Spacing:** 4px between venue/location lines, 8px before ticket link
- **List Scrolling:** Scrollable content area, custom scrollbar styling

**Visual Effects:**
- **Date Circle Icon:** `○` in `#1DB954` (Spotify green), 8px size
- **Close Button:** 24×24px X icon, top-right 16px inset, `#ffffff` with hover: `#1DB954`
- **Ticket Link Hover:** Underline appears, color brightens to `#22c55e`

### States and Loading

**Loading State:**
```
┌───────────────────────────────────┐
│  ✕                                │
│                                   │
│  The National                     │
│  Checking tour dates...           │
│  ───────────────────────────      │
│                                   │
│  [Skeleton bars animation]        │
│  [Skeleton bars animation]        │
│  [Skeleton bars animation]        │
│                                   │
│  Loading from Bandsintown...      │
└───────────────────────────────────┘
```

**No Dates State:**
```
┌───────────────────────────────────┐
│  ✕                                │
│                                   │
│  The National                     │
│  Not currently touring            │
│  ───────────────────────────      │
│                                   │
│  🎫                                │
│                                   │
│  No upcoming shows                │
│  scheduled                        │
│                                   │
│  Check back later or follow       │
│  the artist on Bandsintown        │
│  to get notified.                 │
│                                   │
│  via Bandsintown                  │
└───────────────────────────────────┘
```

**Error State:**
```
┌───────────────────────────────────┐
│  ✕                                │
│                                   │
│  The National                     │
│  Unable to load tour dates        │
│  ───────────────────────────      │
│                                   │
│  ⚠️                                │
│                                   │
│  Unable to load tour dates        │
│                                   │
│  Check your connection and        │
│  try again later.                 │
│                                   │
└───────────────────────────────────┘
```

**Success State with Many Dates (Scrollable):**
```
┌───────────────────────────────────┐
│  ✕                                │
│                                   │
│  The National                     │
│  On Tour · 12 dates               │ ← Date count
│  ───────────────────────────      │
│                                   │
│  UPCOMING SHOWS                   │
│                                   │
│  ○  Mar 15, 2026                  │
│      Madison Square Garden        │
│      New York, NY                 │
│      [Get Tickets →]              │
│                                   │
│  [Scrollable list continues...]   │
│                                   │
│  via Bandsintown                  │
└───────────────────────────────────┘
```

---

## Interaction Design

### Animation Sequence

**Opening Tour Dates Panel:**

1. **User clicks "Upcoming Shows"** in contextual menu
2. **Menu closes** with fade-out (150ms)
3. **Tour Dates panel slides in from right**
   - Initial position: `transform: translateX(100%)` (off-screen right)
   - Final position: `transform: translateX(0)` (covering Spotify panel)
   - Duration: 400ms
   - Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (standard ease-out)
4. **Spotify panel dims slightly** beneath tour dates
   - Opacity: 1.0 → 0.3
   - Transition: 400ms synchronized with slide
5. **Loading state shows** while fetching from Bandsintown
   - Skeleton animation for date rows
   - "Loading from Bandsintown..." text
6. **Content appears** once loaded
   - Fade in: opacity 0 → 1 over 200ms

**Switching Between Panels (Setlist ↔ Tour Dates):**

When user opens tour dates while liner notes are already open (or vice versa):

1. **Current panel slides out to left**
   - Transform: `translateX(0)` → `translateX(-100%)`
   - Duration: 300ms
   - Easing: `cubic-bezier(0.4, 0, 0.6, 1)`
2. **New panel slides in from right** (simultaneously)
   - Transform: `translateX(100%)` → `translateX(0)`
   - Duration: 300ms (50ms delay after previous starts sliding out)
   - Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
3. **Crossfade effect** - old slides left as new slides right
4. **Loading state** appears immediately in new panel

**Closing Tour Dates Panel:**

Three ways to close:

1. **Click X button** in top-right corner
2. **Click outside** tour dates panel (on Spotify panel area or overlay)
3. **ESC key** (same as closing entire gatefold)

Close animation:
- **Tour dates panel slides right** off-screen
  - Transform: `translateX(0)` → `translateX(100%)`
  - Duration: 350ms
  - Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- **Spotify panel brightens** back to full opacity
  - Opacity: 0.3 → 1.0
  - Transition: 350ms synchronized

### Contextual Menu Interactions

**Opening Menu:**
- Click three-dot icon
- Menu fades in (150ms) with slight scale (0.95 → 1.0)
- Menu positioned below and to the left of icon
- Backdrop overlay appears (subtle, allows click-outside to close)

**Menu Item Hover:**
- Available items: Background `rgba(255, 255, 255, 0.08)`
- Disabled items: No hover effect
- Cursor changes to pointer on available items
- Transition: 150ms

**Selecting Menu Item:**
- Click triggers appropriate action (open setlist or tour dates)
- Menu closes immediately
- Panel opens with slide-in animation

**Closing Menu:**
- Click outside menu → fade out (100ms)
- ESC key → fade out (100ms)
- Select an option → instant close, panel opens

### Ticket Link Behavior

**External Link Handling:**
- Ticket links open in new tab (`target="_blank"`)
- Include `rel="noopener noreferrer"` for security
- Visual indicator: Arrow icon (→) or external link icon
- Hover effect: Underline appears, color brightens

**Bandsintown Integration:**
- If Bandsintown provides ticket URL, use it directly
- If no URL, link to artist's Bandsintown page
- Clicking "Get Tickets" does not close the tour dates panel
- User can view multiple dates and compare ticket options

### Accessibility

**Keyboard Navigation:**
- **Tab:** Focus three-dot icon
- **Enter/Space:** Open contextual menu
- **Arrow Keys:** Navigate menu items
- **Enter/Space:** Activate focused menu item
- **ESC:** Close menu (or panel if menu already closed)
- **Tab (in panel):** Navigate ticket links
- **Arrow Keys:** Scroll within tour dates panel

**Screen Readers:**
- Three-dot button: `aria-label="View options for {date} at {venue}"`
- Menu: `role="menu"`, `aria-label="Concert options"`
- Menu items: `role="menuitem"`, `aria-disabled="true"` when disabled
- Tour dates panel: `role="dialog"`, `aria-modal="false"`
- Close button: `aria-label="Close tour dates"`
- Loading state: `aria-live="polite"` with "Loading tour dates..."
- Error state: `aria-live="assertive"` with error message
- Ticket links: `aria-label="Get tickets for {venue} on {date}"`

**Focus Management:**
- Focus moves to first menu item when menu opens
- Focus moves to close button when panel opens
- Focus returns to three-dot icon when panel closes
- Focus trap within menu while open (ESC to release)

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
const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
const [tourDatesData, setTourDatesData] = useState<TourEvent[] | null>(null)
const [isLoadingTourDates, setIsLoadingTourDates] = useState(false)
const [tourDatesError, setTourDatesError] = useState<string | null>(null)
const [showTourDates, setShowTourDates] = useState(false)
const [showSetlist, setShowSetlist] = useState(false) // Updated from v1.5.0
```

**State Transitions:**

1. **Idle:** No panel open
2. **Loading Tour Dates:** `selectedArtist` set, `isLoadingTourDates = true`
3. **Tour Dates Loaded:** `tourDatesData` populated, show dates
4. **No Tour Dates:** `tourDatesData = []` after load, show "not touring" message
5. **Error:** `tourDatesError` set, show error message
6. **Switching Panels:** Close current, open new with crossfade animation

### Data Flow

**Fetching Tour Dates:**

```typescript
const handleTourDatesClick = async (concert: Concert) => {
  const artistName = concert.headliner

  // Close any open panel first
  setShowSetlist(false)

  // Show tour dates panel immediately with loading state
  setSelectedArtist(artistName)
  setShowTourDates(true)
  setTourDatesData(null)
  setIsLoadingTourDates(true)
  setTourDatesError(null)

  try {
    const events = await fetchTourDates(artistName)
    setTourDatesData(events)
  } catch (error) {
    setTourDatesError(error.message)
  } finally {
    setIsLoadingTourDates(false)
  }
}
```

### Bandsintown API Integration

**Service Module:** `src/services/bandsintown.ts`

```typescript
export interface TourEvent {
  id: string
  datetime: string // ISO 8601 format
  venue: {
    name: string
    city: string
    region: string // State/province
    country: string
    latitude: string
    longitude: string
  }
  offers: Array<{
    type: string // "Tickets"
    url: string
    status: string // "available", "sold out", etc.
  }>
  lineup: string[] // Artist names
  url: string // Bandsintown event page
}

/**
 * Fetch upcoming tour dates for an artist from Bandsintown API
 * @param artistName - Artist name (URL-encoded)
 * @returns Array of upcoming tour events (empty if none found)
 */
export async function fetchTourDates(
  artistName: string
): Promise<TourEvent[]> {
  const encodedArtist = encodeURIComponent(artistName)
  const appId = import.meta.env.VITE_BANDSINTOWN_APP_ID

  const url = `https://rest.bandsintown.com/artists/${encodedArtist}/events?app_id=${appId}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    }
  })

  if (!response.ok) {
    if (response.status === 404) {
      // Artist not found or no events - return empty array
      return []
    }
    throw new Error(`Bandsintown API error: ${response.status}`)
  }

  const data = await response.json()

  // API returns array directly, or empty array if no events
  return Array.isArray(data) ? data : []
}
```

**Environment Variable:**

```bash
# .env
VITE_BANDSINTOWN_APP_ID=morperhaus_concert_archives
```

**API Key vs App ID:**
- Bandsintown doesn't use traditional API keys
- Instead, it uses an "app_id" query parameter
- This is just an identifier for your app (any string works)
- Use your project name or domain as the app_id
- No registration or approval needed
- Free tier is generous and should cover all usage

### Caching Strategy

**Client-Side Cache:**

```typescript
// Simple in-memory cache with TTL
const tourDatesCache = new Map<string, {
  data: TourEvent[]
  timestamp: number
  ttl: number
}>()

const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

function getCacheKey(artistName: string): string {
  return artistName.toLowerCase().trim()
}

async function fetchTourDatesWithCache(
  artistName: string
): Promise<TourEvent[]> {
  const cacheKey = getCacheKey(artistName)
  const cached = tourDatesCache.get(cacheKey)

  // Return cached if still valid
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }

  // Fetch fresh data
  const data = await fetchTourDates(artistName)

  // Cache result (including empty array for no dates)
  tourDatesCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL
  })

  return data
}
```

**Why Client-Side Only:**
- Tour dates change frequently (tickets sell out, dates added)
- Real-time data ensures accuracy
- User-initiated fetch (progressive disclosure)
- Cache prevents redundant API calls during session
- No build-time enrichment needed

### Error Handling

**Error Types:**

1. **Network Error:** Can't reach Bandsintown
   - Show: "Unable to load tour dates. Check your connection."
   - Allow retry button (future enhancement)
2. **Artist Not Found (404):** Artist not in Bandsintown database
   - Treat as "no upcoming shows" - show empty state
3. **No Events (empty array):** Artist exists but no tour dates
   - Show: "No upcoming shows scheduled"
   - Suggest checking back later
4. **Invalid Artist Name:** Artist name too generic or misspelled
   - Show empty state with encouragement to follow on Bandsintown

**Graceful Degradation:**

```typescript
async function fetchTourDatesWithRetry(
  artistName: string,
  maxRetries = 2,
  delay = 1000
): Promise<TourEvent[]> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchTourDates(artistName)
    } catch (error) {
      if (i === maxRetries - 1) {
        // Last retry failed - return empty array instead of throwing
        console.error('Failed to fetch tour dates after retries:', error)
        return []
      }
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  return []
}
```

### Performance Considerations

**Optimizations:**

1. **Lazy Load:** Only fetch when user opens tour dates (not on gatefold open)
2. **Debouncing:** Prevent rapid switching between artists
3. **Request Cancellation:** Cancel in-flight requests if user switches artists
4. **Skeleton UI:** Instant feedback while loading
5. **Cache:** Avoid redundant API calls (24-hour TTL)

**Bundle Size:**
- No additional dependencies (use native fetch)
- ~2KB for service module
- ~5KB for TourDatesPanel component
- ~3KB for ConcertContextMenu component (replaces SetlistButton)
- Total impact: ~10KB gzipped

---

## Artist Name Matching

### Challenge: Name Variations

**Problem:** Artist names in your concert data may not exactly match Bandsintown's database:
- "The National" vs "National"
- "Foo Fighters" vs "Foo Fighters (US)"
- Special characters, accents, punctuation differences
- Band name changes over time

**Solution Strategy:**

1. **Use exact name first:** Try artist name as-is from your data
2. **Normalize and retry:** If 404, try normalized version (remove "The", trim, lowercase)
3. **Accept empty results:** If still not found, show "no upcoming shows" gracefully

**Matching Algorithm:**

```typescript
async function fetchTourDatesWithFallback(
  artistName: string
): Promise<TourEvent[]> {
  // Try exact name first
  let events = await fetchTourDates(artistName)

  if (events.length === 0) {
    // Try normalized version (remove "The", trim)
    const normalized = artistName
      .replace(/^the\s+/i, '')
      .trim()

    if (normalized !== artistName) {
      events = await fetchTourDates(normalized)
    }
  }

  return events
}
```

**User Communication:**
- Don't show error if artist not found - show "no upcoming shows"
- Bandsintown coverage is good for active touring artists
- Smaller/inactive artists may not be in database
- This is expected and not an error condition

---

## Testing Strategy

### Manual Testing Checklist

**Contextual Menu Testing:**
- [ ] Three-dot icon appears on concert rows on hover
- [ ] Menu opens on click with smooth fade-in
- [ ] Menu shows both "View Setlist" and "Upcoming Shows" options
- [ ] Available options are clickable with hover effect
- [ ] Disabled options are grayed out with no hover effect
- [ ] Menu closes on click outside
- [ ] Menu closes on ESC key
- [ ] Menu closes when option selected
- [ ] Menu positioning is correct (below and to left of icon)

**Tour Dates Panel Testing:**
- [ ] Click "Upcoming Shows" opens panel smoothly
- [ ] Panel slides in from right (400ms)
- [ ] Spotify panel dims when panel opens
- [ ] Close button (X) closes panel
- [ ] Click outside panel closes it
- [ ] ESC key closes panel (but not gatefold)
- [ ] Switching from setlist to tour dates transitions smoothly
- [ ] Switching from tour dates to setlist transitions smoothly
- [ ] Loading skeleton appears while fetching
- [ ] Tour dates display correctly when loaded
- [ ] No dates message appears when artist not touring
- [ ] Error message appears on network failure
- [ ] Scrolling works for long lists of dates

**API Integration Testing:**
- [ ] Tour dates fetch successfully for active touring artists
- [ ] Empty state shows for artists not touring
- [ ] 404 errors handled gracefully (show as "no shows")
- [ ] Cache prevents duplicate API calls
- [ ] Switching rapidly between artists doesn't break
- [ ] Ticket links open in new tab
- [ ] Ticket links have proper security attributes

**State Testing:**
- [ ] Opening/closing multiple times works
- [ ] Gatefold close button still closes entire gatefold
- [ ] Tour dates state resets when gatefold closes
- [ ] Panel state persists when switching concerts (shows different artist's tours)

**Visual Testing:**
- [ ] Typography matches design spec
- [ ] Colors match dark theme
- [ ] Spacing matches design spec
- [ ] Animations are smooth (no jank)
- [ ] Panel shadows create depth effect
- [ ] Close button hover effect works
- [ ] Scrollbar styling looks polished
- [ ] Date formatting is readable

**Accessibility Testing:**
- [ ] Three-dot icons focusable with keyboard
- [ ] Enter/Space opens menu
- [ ] Arrow keys navigate menu
- [ ] ESC closes menu/panel
- [ ] Focus management works correctly
- [ ] Screen reader announces loading/error states
- [ ] Color contrast meets WCAG AA standards
- [ ] Ticket links are keyboard accessible

**Edge Cases:**
- [ ] Very long artist names don't break layout
- [ ] Very long venue names don't break layout
- [ ] Many dates (50+) scroll correctly
- [ ] Single date doesn't look broken
- [ ] Dates with no ticket URL handled gracefully
- [ ] Special characters in artist names work
- [ ] International dates/locations display correctly

### Test Artists

**Known Touring Artists (for testing with dates):**
1. **Pearl Jam** - Consistently tours with many dates
2. **The National** - Regular touring schedule
3. **Foo Fighters** - Major tours with many venues

**Non-Touring Artists (for testing empty state):**
1. **Nirvana** - Inactive (historical band)
2. **Obscure local artists** - May not be in Bandsintown database

---

## Implementation Plan

### Phase 1: Contextual Menu & API Integration

**Files to Create:**
- `src/components/scenes/ArtistScene/ConcertContextMenu.tsx` - Menu component
- `src/services/bandsintown.ts` - API client and caching
- `src/types/tourDates.ts` - TypeScript interfaces

**Files to Modify:**
- `src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx` - Replace SetlistButton with ConcertContextMenu
- `.env` - Add VITE_BANDSINTOWN_APP_ID

**Tasks:**
1. Create Bandsintown API service with caching
2. Implement artist name normalization/fallback
3. Create ConcertContextMenu component (replaces SetlistButton from v1.5.0)
4. Update ConcertHistoryPanel to show menu icon and handle menu interactions
5. Test API integration with known touring artists
6. Test menu open/close/select interactions

**Acceptance Criteria:**
- [ ] API calls return tour dates for active artists
- [ ] Cache prevents duplicate requests
- [ ] Menu opens/closes smoothly
- [ ] Menu shows context-aware availability (enabled/disabled states)
- [ ] Error handling works for all failure modes

### Phase 2: Tour Dates UI Components

**Files to Create:**
- `src/components/scenes/ArtistScene/TourDatesPanel.tsx` - Main panel component

**Files to Modify:**
- `src/components/scenes/ArtistScene/ArtistGatefold.tsx` - Add tour dates state
- `src/index.css` - Add tour dates panel styles

**Tasks:**
1. Create TourDatesPanel component structure
2. Implement loading/success/error/no dates states
3. Design date list layout with venue/location/ticket links
4. Add slide animations (translateX, matching liner notes)
5. Add Spotify panel dimming effect
6. Implement close functionality (X button, click outside, ESC)
7. Style scrollbar for date list
8. Test animations and transitions

**Acceptance Criteria:**
- [ ] TourDatesPanel renders with correct layout
- [ ] All states (loading/success/error/no dates) display correctly
- [ ] Panel slides in from right smoothly
- [ ] Animations match design spec timing
- [ ] Closing works via all three methods
- [ ] Scrolling works for long lists
- [ ] Ticket links work correctly

### Phase 3: Integration & Polish

**Files to Modify:**
- `src/components/scenes/ArtistScene/ArtistGatefold.tsx` - Wire API to UI, handle panel switching
- `src/components/scenes/ArtistScene/SpotifyPanel.tsx` - Add dimming prop (if not already done in v1.5.0)

**Tasks:**
1. Wire up API calls to TourDatesPanel
2. Implement smooth panel switching (setlist ↔ tour dates crossfade)
3. Add request cancellation for rapid artist switching
4. Implement accessibility features (focus management, ARIA labels)
5. Add keyboard navigation
6. Handle external ticket link security (noopener, noreferrer)
7. Polish animations and timing
8. Test edge cases and error scenarios
9. Performance testing (API calls, animations)
10. Cross-browser testing

**Acceptance Criteria:**
- [ ] Switching panels transitions smoothly (crossfade)
- [ ] No duplicate API calls during switching
- [ ] Keyboard navigation works completely
- [ ] Screen reader support functional
- [ ] Ticket links secure and work correctly
- [ ] Performance is smooth (60fps animations)
- [ ] Works in Chrome, Firefox, Safari

### Phase 4: Testing & Deployment

**Tasks:**
1. Comprehensive manual testing (all checklist items)
2. Test with variety of artists (touring, non-touring, unknown)
3. Accessibility audit (keyboard, screen reader)
4. Performance profiling
5. Cross-browser compatibility testing
6. Mobile responsive testing (if applicable)
7. API usage monitoring
8. User acceptance testing
9. Production deployment
10. Monitor for errors/issues

**Acceptance Criteria:**
- [ ] All manual test cases pass
- [ ] Accessibility requirements met
- [ ] Performance benchmarks met
- [ ] No console errors
- [ ] Works on target browsers
- [ ] API usage within acceptable limits

---

## Dependencies

### Required
- **Artist Scene Gatefold** (✅ Complete in v1.4.0)
  - Provides the container and panels for tour dates integration
  - ConcertHistoryPanel component already exists
  - Animation system and state management in place

### Optional
- **Setlist Liner Notes** (Planned v1.5.0)
  - Shares contextual menu pattern
  - Can be implemented independently, but better UX if both exist
  - Tour dates feature works standalone if setlist feature not implemented

---

## API Comparison: Bandsintown vs Alternatives

### Why Bandsintown?

**Advantages:**
✅ **Free with no API key** - Just needs app identifier
✅ **Artist-focused** - Perfect for "where is this artist touring?"
✅ **Clean JSON API** - Simple, well-structured responses
✅ **Good coverage** - Strong database of touring artists
✅ **Includes ticket links** - Direct integration with ticket platforms
✅ **No rate limits published** - Generous fair-use policy

**Disadvantages:**
⚠️ May not have data for inactive/historical artists
⚠️ Coverage weaker for very small/local artists
⚠️ No filtering by region (returns all dates)

### Alternatives Considered

**Ticketmaster Discovery API:**
- ✅ Comprehensive event database (230k+ events)
- ✅ Excellent filtering options
- ❌ Complex API with many parameters
- ❌ Requires API key with rate limits (5k calls/day)
- ❌ More event-focused than artist-focused

**Songkick API:**
- ✅ Great artist focus
- ✅ Good coverage
- ❌ **No longer accepting new API applications**
- ❌ Requires partnership for access

**Decision:** Bandsintown is the clear winner for this use case - free, simple, artist-focused, and immediately accessible.

---

## Cost Analysis

### Bandsintown API Costs

**Rate Limits:**
- No explicit rate limit documented
- Fair use policy applies - be respectful
- Recommended self-imposed limit: 5 requests/second max
- The app implements 24-hour client-side caching to minimize requests

**Expected Usage:**
- Initial development/testing: ~50-100 requests
- Typical user session: 2-4 tour date fetches
- Daily usage (10 users): ~20-40 requests
- Monthly usage: ~600-1,200 requests
- **Cost: $0** (completely free, no API key required)

**Monitoring:**
- Track API errors in console
- Log failed artist lookups for debugging
- Monitor for any 429 (rate limit) responses (though unlikely)

---

## Future Enhancements

### Phase 2 Improvements (Post-v1.6.0)

1. **Ticket Price Display**
   - Parse ticket price from Bandsintown offers
   - Show price range in tour dates list
   - "Starting at $45" indicator

2. **Tour Date Filtering**
   - Filter by region (West Coast, Northeast, etc.)
   - Filter by date range (next 30 days, next 3 months, etc.)
   - Filter by venue type (festival, arena, club)

3. **Interactive Map View**
   - Show tour dates on a map
   - Click map markers to see venue details
   - Integrate with Geography scene

4. **Ticket Alerts**
   - "Notify me" button for specific dates
   - Save to local storage or external service
   - Email/SMS notifications (requires backend)

5. **Tour Statistics**
   - "X cities in Y days"
   - Tour route visualization
   - Distance traveled calculations

6. **Bandsintown Follow Integration**
   - "Follow on Bandsintown" button
   - Deep link to Bandsintown artist page
   - Encourage users to get notifications

7. **Past Tour History**
   - Show historical tour data from Bandsintown
   - Compare with your concert attendance
   - "You've seen them on the [Tour Name]" indicator

---

## Accessibility Compliance

### WCAG 2.1 Level AA Requirements

**Perceivable:**
- ✅ Color contrast: Text on backgrounds meets 4.5:1 ratio
- ✅ Text sizing: Minimum 13px body text
- ✅ Focus indicators: Visible focus rings on all interactive elements
- ✅ Alternative text: Icons have ARIA labels

**Operable:**
- ✅ Keyboard accessible: All functions via keyboard
- ✅ Focus order: Logical tab sequence
- ✅ ESC key: Standard close behavior
- ✅ No keyboard traps: Can escape all menus/dialogs
- ✅ Touch targets: Minimum 44×44px on mobile

**Understandable:**
- ✅ Clear labels: Descriptive button and link labels
- ✅ Error messages: Clear, actionable
- ✅ Consistent behavior: Matches gatefold patterns
- ✅ External links: Announced to screen readers

**Robust:**
- ✅ ARIA labels: All interactive elements labeled
- ✅ Live regions: Status announcements
- ✅ Semantic HTML: Proper heading hierarchy
- ✅ Roles: Proper menu/menuitem/dialog roles

---

## Success Metrics

### Quantitative Metrics

**User Engagement:**
- % of gatefold opens that click contextual menu (target: 40%+)
- % of menu opens that select "Upcoming Shows" (target: 50%+)
- Average tour dates viewed per session (target: 2+)
- Tour dates panel open duration (target: 15+ seconds)
- Ticket link click rate (target: 30%+)

**Technical Performance:**
- API response time (target: <1s)
- Cache hit rate (target: >60%)
- Animation frame rate (target: 60fps)
- Failed API calls (target: <5%)

**Feature Discovery:**
- % of users who discover the contextual menu (target: 70%+)
- % of users who try both setlist and tour dates options (target: 40%+)

### Qualitative Metrics

**User Satisfaction:**
- Users discover upcoming shows for artists they love
- Feature helps users plan future concert attendance
- Positive feedback on unified menu pattern

**Design Goals:**
- ✅ Maintains vinyl metaphor authenticity
- ✅ Feels like "checking tour posters"
- ✅ Smooth, polished animations
- ✅ Progressive disclosure (doesn't overwhelm)
- ✅ Complements setlist feature naturally

---

## Documentation Updates Required

### Files to Update

1. **docs/STATUS.md**
   - Add v1.6.0 roadmap entry
   - List as "Planned" feature
   - Reference this spec

2. **docs/api-setup.md**
   - Add Bandsintown API section
   - Document app_id configuration
   - Add environment variable instructions
   - Cross-reference this spec

3. **README.md**
   - Add to feature list
   - Mention tour dates integration
   - Update screenshots (post-implementation)

4. **docs/specs/future/setlist-liner-notes.md**
   - Update to reflect contextual menu pattern
   - Document shared menu component
   - Update visual designs to show menu

---

## Related Specifications

**Parent Features:**
- [Artist Scene Gatefold](../implemented/artist-scene.md) - Container for tour dates panel
- [Spotify Artist Integration](./spotify-artist-integration.md) - Panel that gets covered by tour dates

**Related Features:**
- [Setlist Liner Notes](./setlist-liner-notes.md) - Shares contextual menu pattern
- [Data Normalization Architecture](./data-normalization-architecture.md) - Artist name matching

**Future Enhancements:**
- Tour date filtering and visualization features
- Integration with Geography scene map
- Ticket price tracking and alerts

---

## Revision History

- **2026-01-03:** Initial specification created
- **Version:** 1.0.0
- **Author:** Lead Designer & Developer
- **Status:** Ready for Implementation

---

## Appendix: API Response Examples

### Successful Bandsintown Response

```json
[
  {
    "id": "103443281",
    "artist_id": "1019",
    "url": "https://www.bandsintown.com/e/103443281",
    "datetime": "2026-03-15T20:00:00",
    "venue": {
      "name": "Madison Square Garden",
      "latitude": "40.7505",
      "longitude": "-73.9934",
      "city": "New York",
      "region": "NY",
      "country": "United States"
    },
    "offers": [
      {
        "type": "Tickets",
        "url": "https://www.bandsintown.com/t/103443281",
        "status": "available"
      }
    ],
    "lineup": ["The National"],
    "description": "The National live at Madison Square Garden"
  },
  {
    "id": "103443282",
    "artist_id": "1019",
    "url": "https://www.bandsintown.com/e/103443282",
    "datetime": "2026-03-18T20:00:00",
    "venue": {
      "name": "The Anthem",
      "latitude": "38.8738",
      "longitude": "-77.0132",
      "city": "Washington",
      "region": "DC",
      "country": "United States"
    },
    "offers": [
      {
        "type": "Tickets",
        "url": "https://www.bandsintown.com/t/103443282",
        "status": "available"
      }
    ],
    "lineup": ["The National"],
    "description": "The National live at The Anthem"
  }
]
```

### Empty Response (No Tour Dates)

```json
[]
```

### Error Response (Artist Not Found)

HTTP 404 with text:
```
{warn}Not found
```

(Note: Bandsintown returns 404 for unknown artists - treat as empty array)

---

**End of Specification**

---

_This specification document serves as the complete technical blueprint for implementing the Upcoming Tour Dates feature. All implementation should reference this document as the source of truth._

_Last Updated: 2026-01-03_
_Version: 1.0.0_
_Status: Ready for Implementation_
