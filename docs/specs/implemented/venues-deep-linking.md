# Venue Deep Linking

**Status:** ✅ Implemented
**Implemented Version:** v3.3.0
**Completed:** 2026-01-08
**Priority:** Low
**Estimated Complexity:** Medium
**Dependencies:** None (must accommodate phone, tablet, desktop viewports)

---

## Executive Summary

Enable deep linking to specific venue nodes in the Venues scene (Scene 2), with optional artist filtering to focus on specific venue-artist relationships. This establishes a cross-scene navigation pattern that allows users to discover venue connections from any scene in the application.

**Problem it solves:** Currently, users viewing artist gatefolds (Scene 5) or exploring the map (Scene 3) see venue names in concert histories but cannot quickly navigate to see those venues' full relationship networks. This feature creates a seamless navigation path from any scene to focused venue exploration.

**UX Enhancement:** Users can click venue names throughout the app and be taken directly to the Venues scene with the target venue and its artist connections spotlighted, while all other nodes are dimmed or hidden. This creates a contextual, focused browsing experience that encourages discovery across scenes.

**Product Vision:** This deep linking pattern establishes venues as first-class navigation targets alongside artists, completing the bidirectional navigation between all major entity types (artists ↔ venues ↔ concerts).

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Venue Deep Linking feature for Morperhaus Concerts.

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
- Add URL parameter support for venue + artist targeting in Scene 2 (Venues)
- Support two modes: venue-only focus and venue+artist focus
- Make venue names clickable throughout the app (Artist gatefold, Map popups)
- Update deep linking documentation
- Ensure responsive behavior across phone, tablet, desktop

**Key References:**
- Full Design Spec: docs/specs/future/venues-deep-linking.md
- Existing Deep Linking: docs/DEEP_LINKING.md
- Scene Design Guide: docs/design/scene-design-guide.md
- Venues Scene: src/components/scenes/Scene4Bands.tsx
- Artist Gatefold: src/components/scenes/ArtistScene/
- Map Scene: src/components/scenes/Scene3Map.tsx

**Implementation Approach:**
- Window 1: URL parameter parsing & state management in Scene4Bands
- Window 2: Clickable venue links in Artist gatefold and Map popups
- Window 3: Documentation updates and cross-viewport testing

**Design Philosophy:**
Create focused, contextual navigation that spotlights relevant connections while dimming noise. The spotlight effect should feel like a guided tour, not a harsh filter.

**Key Design Details:**
- URL format: `?scene=venues&venue=irvine-meadows` (venue only)
- URL format: `?scene=venues&venue=irvine-meadows&artist=omd` (venue + artist)
- Spotlight opacity: 0.85 for focused nodes, 0.15 for dimmed nodes
- Touch targets: Minimum 44px diameter (22px radius) for mobile
- Transition duration: 600-800ms for focus animations

**Files to Create:**
- None (feature uses existing components)

**Files to Modify:**
- src/components/scenes/Scene4Bands.tsx (~50 LOC) - Add URL parameter handling
- src/components/scenes/ArtistScene/ArtistCard.tsx (~20 LOC) - Make venue names clickable
- src/components/scenes/Scene3Map.tsx (~15 LOC) - Make venue names clickable in popups
- docs/DEEP_LINKING.md (~40 LOC) - Document new URL patterns
- App.tsx (~10 LOC) - Pass venue+artist params to Scene4Bands

Let's start with Window 1. Should I begin by reading the existing deep linking implementation in App.tsx and Scene4Bands.tsx?
```

---

## Design Philosophy

**Contextual Navigation:** Users should be able to follow their curiosity without losing context. When viewing an artist's history, seeing a venue name should immediately suggest "I can explore that venue's full network." Clicking should feel like zooming into a new perspective, not navigating away.

**Progressive Disclosure:** The initial deep link shows the venue and its direct connections (artists). Adding an artist parameter further focuses the view to show only that specific relationship, creating a "tell me more about this specific pairing" interaction.

**Spotlight, Not Filter:** Dimmed nodes remain visible but de-emphasized, allowing users to see the full network topology while understanding which connections are relevant to their query. This preserves spatial context.

---

## Visual Design

### URL Patterns

**Venue-only targeting:**
```
https://concerts.morperhaus.org/?scene=venues&venue=irvine-meadows
```

**Venue + Artist targeting:**
```
https://concerts.morperhaus.org/?scene=venues&venue=irvine-meadows&artist=omd
```

### Spotlight Effect

**Specifications:**
- **Focused nodes:** Opacity 0.85 (circles), 1.0 (labels)
- **Dimmed nodes:** Opacity 0.15 (circles), 0.15 (labels)
- **Links:** Hierarchy links 0.5 → 0.075, cross-venue links 0.3 → 0.045
- **Transition:** 600ms ease-in-out

**Node Visibility Rules:**

| Scenario | Focused Nodes | Dimmed Nodes |
|----------|---------------|--------------|
| `?venue=X` | Venue X + all its artists (headliners & openers) | All other venues and their artists |
| `?venue=X&artist=Y` | Venue X + Artist Y (if connected) | All other venues and artists |

### Scene 2 Visual State

**Layout:**
```
┌────────────────────────────────────────────┐
│          The Venues                        │
│     10 most-visited venues                 │
│   [Top 10] [All Venues]                    │
│                                            │
│         ╭─────────╮                        │
│         │ Venue X │ ← Focused (opacity 1)  │
│         ╰────┬────╯                        │
│         ┌────┼────┐                        │
│      Artist1 Artist2  ← Focused            │
│                                            │
│   ○ Venue Y  ○ Venue Z  ← Dimmed (0.15)   │
│                                            │
│   Click anywhere to reset · Drag to explore│
└────────────────────────────────────────────┘
```

---

## Interaction Design

### Animation Sequence

**On page load with deep link:**

1. **Scene scroll** (100ms delay)
   - Smooth scroll to Scene 2
   - Duration: 800ms

2. **Graph layout** (immediate)
   - Force simulation initializes
   - Nodes position based on force layout

3. **Spotlight fade-in** (200ms delay)
   - Focused nodes: opacity 0 → 0.85 (circles), 0 → 1 (labels)
   - Dimmed nodes: opacity 0 → 0.15
   - Duration: 600ms

4. **Centered positioning** (if venue+artist)
   - Graph centers on venue node
   - Duration: 800ms with easing

### Click Behavior

**Venue names in Artist Gatefold:**

1. User clicks venue name in concert history
2. Page scrolls to Scene 2 (smooth, 800ms)
3. Venue node + artists spotlight with fade-in
4. Other nodes dim to 0.15 opacity

**Venue names in Map popups:**

1. User clicks "Explore Venue →" button in popup
2. Identical behavior to gatefold click

**Resetting focus:**

- Click background: Clear spotlight, restore all nodes to full opacity
- Click "Reset View" button: Same as background click
- Click different venue: Switch spotlight to new venue

### Hover/Active States

**Clickable venue links:**
- Idle: `text-indigo-300 underline`
- Hover: `text-indigo-200` + cursor pointer
- Active: `text-indigo-400` (brief flash on click)

**Focused venue nodes:**
- No additional hover effect (already spotlighted)

### Accessibility

**Keyboard Navigation:**
- Venue links: Tab-focusable with visible focus ring
- Enter/Space: Activate link to navigate to Venues scene

**ARIA Labels:**
- Venue links: `aria-label="View Irvine Meadows in venue network"`
- Reset button: `aria-label="Clear venue focus and show all venues"`

**Screen Readers:**
- Announce: "Navigating to Venues scene, focusing on [venue name]"
- After navigation: "Showing [venue name] with [N] artists"

---

## Technical Implementation

### Component Architecture

**Modified Files:**
```
src/
├── App.tsx (URL parsing)
├── components/
│   └── scenes/
│       ├── Scene4Bands.tsx (spotlight logic)
│       ├── Scene3Map.tsx (clickable venue in popup)
│       └── ArtistScene/
│           └── ArtistCard.tsx (clickable venue in history)
docs/
└── DEEP_LINKING.md (documentation update)
```

### State Management

**App.tsx state (new):**
```typescript
const [pendingVenueArtistFocus, setPendingVenueArtistFocus] = useState<{
  venue: string
  artist?: string
} | null>(null)
```

**Scene4Bands.tsx state (existing + new):**
```typescript
// Existing
const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set())

// New
const [focusedArtist, setFocusedArtist] = useState<string | null>(null)
```

### Data Flow

**Venue-only deep link:**

```typescript
// 1. App.tsx parses URL
const params = new URLSearchParams(location.search)
const venueParam = params.get('venue')
const sceneParam = params.get('scene')

if (sceneParam === 'venues' && venueParam) {
  setPendingVenueFocus(venueParam)
}

// 2. Scene4Bands receives prop
<Scene4Bands
  concerts={concerts}
  pendingVenueFocus={pendingVenueFocus}
  onVenueFocusComplete={() => setPendingVenueFocus(null)}
/>

// 3. Scene4Bands applies spotlight
useEffect(() => {
  if (!pendingVenueFocus) return

  const venueNodeId = `venue|${venueName}`
  setFocusedNodeId(venueNodeId)
  setExpandedVenues(new Set([venueName]))
  setCenteredVenue(venueName)
  setViewMode('all')

  onVenueFocusComplete?.()
}, [pendingVenueFocus])
```

**Venue + Artist deep link:**

```typescript
// 1. App.tsx parses both parameters
const venueParam = params.get('venue')
const artistParam = params.get('artist')

if (sceneParam === 'venues' && venueParam) {
  setPendingVenueArtistFocus({
    venue: venueParam,
    artist: artistParam || undefined
  })
}

// 2. Scene4Bands receives combined prop
<Scene4Bands
  concerts={concerts}
  pendingVenueArtistFocus={pendingVenueArtistFocus}
  onVenueFocusComplete={() => setPendingVenueArtistFocus(null)}
/>

// 3. Scene4Bands applies focused spotlight
useEffect(() => {
  if (!pendingVenueArtistFocus) return

  const { venue, artist } = pendingVenueArtistFocus
  const venueNodeId = `venue|${venue}`

  setFocusedNodeId(venueNodeId)
  setExpandedVenues(new Set([venue]))
  setCenteredVenue(venue)

  if (artist) {
    // Also highlight the specific artist node
    setFocusedArtist(artist)
  }

  setViewMode('all')
  onVenueFocusComplete?.()
}, [pendingVenueArtistFocus])
```

### URL Generation

**Artist Gatefold (ArtistCard.tsx):**

```typescript
import { useNavigate } from 'react-router-dom'
import { normalizeVenueName } from '../../utils/normalize'

const navigate = useNavigate()

const handleVenueClick = (venue: string) => {
  const normalizedVenue = normalizeVenueName(venue)
  const normalizedArtist = normalizeArtistName(artist.name)

  // Navigate with both venue and artist
  navigate(`/?scene=venues&venue=${normalizedVenue}&artist=${normalizedArtist}`)
}

// Render clickable venue
<button
  onClick={() => handleVenueClick(concert.venue)}
  className="text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
>
  {concert.venue}
</button>
```

**Map Popup (Scene3Map.tsx):**

```typescript
// In popup content
const normalizedVenue = normalizeVenueName(venue.name)

popup.setContent(`
  <div>
    <h3>${venue.name}</h3>
    <p>${venue.concertCount} concerts</p>
    <a href="/?scene=venues&venue=${normalizedVenue}">
      Explore Venue →
    </a>
  </div>
`)
```

---

## Testing Strategy

### Manual Testing Checklist

- [ ] **URL Parameter Parsing**
  - [ ] `?scene=venues&venue=9-30-club` focuses 9:30 Club
  - [ ] `?scene=venues&venue=9-30-club&artist=depeche-mode` focuses both
  - [ ] Invalid venue name shows warning, doesn't break graph
  - [ ] Invalid artist name shows warning, focuses venue only

- [ ] **Clickable Venue Links**
  - [ ] Venue name in Artist gatefold is clickable
  - [ ] Click navigates to Scene 2 with spotlight
  - [ ] Venue name in Map popup is clickable
  - [ ] Link styling matches design (indigo-300, underline)

- [ ] **Spotlight Effect**
  - [ ] Focused venue + artists are fully visible (opacity 0.85)
  - [ ] Dimmed nodes are barely visible (opacity 0.15)
  - [ ] Transition is smooth (600-800ms)
  - [ ] Click background resets spotlight
  - [ ] Click different venue switches spotlight

- [ ] **Responsive Behavior**
  - [ ] Phone (320px-767px): Touch targets are 44px minimum
  - [ ] Tablet (768px-1023px): Graph layout is readable
  - [ ] Desktop (1024px+): Full feature set works

- [ ] **Keyboard Navigation**
  - [ ] Tab to venue links in gatefold
  - [ ] Enter/Space activates link
  - [ ] Focus ring is visible
  - [ ] Reset button is keyboard accessible

- [ ] **Edge Cases**
  - [ ] Venue with no artists (just dot, no children)
  - [ ] Artist who played multiple venues (cross-venue links visible)
  - [ ] Very long venue/artist names (truncated properly)

- [ ] **No Console Errors**
  - [ ] No React warnings
  - [ ] No D3 errors
  - [ ] No navigation errors

### Test Data

**Known Venues for Testing:**
- `9-30-club` — 13 concerts (high activity)
- `irvine-meadows` — Multiple artists including OMD
- `hollywood-palladium` — Cross-venue artists
- `pacific-amphitheatre` — Multiple headliners + openers

**Known Artist-Venue Pairs:**
- `depeche-mode` at `9-30-club`
- `omd` at `irvine-meadows`
- `social-distortion` at `hollywood-palladium`

**Test URLs:**
```
/?scene=venues&venue=9-30-club
/?scene=venues&venue=irvine-meadows&artist=omd
/?scene=venues&venue=hollywood-palladium&artist=social-distortion
```

---

## Implementation Plan

### Phase 1: URL Parameter Handling (Window 1)

**Files to Modify:**
- `App.tsx` — Add venue+artist URL parsing
- `src/components/scenes/Scene4Bands.tsx` — Add `pendingVenueArtistFocus` prop and spotlight logic

**Tasks:**
1. Update URL parser in App.tsx to capture `venue` and `artist` params when `scene=venues`
2. Add new state for combined venue+artist focus
3. Pass new prop to Scene4Bands component
4. Implement spotlight effect in Scene4Bands for venue-only focus
5. Implement enhanced spotlight for venue+artist focus
6. Test with manual URLs in browser

**Acceptance Criteria:**
- [ ] `?scene=venues&venue=X` expands and spotlights venue X
- [ ] `?scene=venues&venue=X&artist=Y` spotlights venue X and artist Y
- [ ] Invalid venue/artist names log warnings without breaking
- [ ] Spotlight transition is smooth (600-800ms)

### Phase 2: Clickable Venue Links (Window 2)

**Files to Modify:**
- `src/components/scenes/ArtistScene/ArtistCard.tsx` — Make venue names clickable in concert history
- `src/components/scenes/Scene3Map.tsx` — Make "Explore Venue" button generate deep link

**Tasks:**
1. Import `useNavigate` and `normalizeVenueName` in ArtistCard
2. Convert venue text to clickable button with proper styling
3. Generate deep link URL with venue + artist parameters
4. Update Map popup to include venue+artist in "Explore Venue" link
5. Test navigation from Artist gatefold to Venues scene
6. Test navigation from Map popup to Venues scene

**Acceptance Criteria:**
- [ ] Venue names in gatefold are clickable and styled correctly
- [ ] Clicking venue in gatefold navigates to Venues scene with spotlight
- [ ] "Explore Venue" in Map popup generates correct deep link
- [ ] Hover states work (indigo-300 → indigo-200)
- [ ] Touch targets are minimum 44px on mobile

### Phase 3: Documentation & Testing (Window 3)

**Files to Modify:**
- `docs/DEEP_LINKING.md` — Add venue deep linking section

**Tasks:**
1. Add "Venue Deep Linking (Advanced)" section to DEEP_LINKING.md
2. Document URL patterns and parameters
3. Add examples with screenshots (or ASCII diagrams)
4. Document spotlight behavior and focus rules
5. Test all scenarios from manual testing checklist
6. Test responsive behavior across phone/tablet/desktop
7. Test keyboard navigation
8. Fix any bugs discovered during testing

**Acceptance Criteria:**
- [ ] Documentation is complete and accurate
- [ ] All manual testing checklist items pass
- [ ] No console errors or warnings
- [ ] Feature works across all viewport sizes
- [ ] Keyboard navigation is fully functional

---

## Future Enhancements

**Post-MVP improvements:**

1. **Persistent Spotlight on Navigation**
   - Keep spotlight active when user scrolls away and returns to Scene 2
   - Clear spotlight only on explicit reset or new deep link

2. **Venue History Timeline**
   - Add timeline filter to venue deep links: `?venue=X&year=2024`
   - Show only concerts from specific year when venue is focused

3. **Multi-Artist Focus**
   - Support multiple artists: `?venue=X&artist=Y&artist=Z`
   - Spotlight venue and all specified artists

4. **Share Button in Spotlight Mode**
   - Add floating "Share" button when spotlight is active
   - Copy deep link to clipboard with toast confirmation

5. **Breadcrumb Navigation**
   - Show breadcrumb when deep linked: "Artists > OMD > Irvine Meadows"
   - Click breadcrumb segments to navigate back

6. **Animated Transitions Between Spotlights**
   - Smoothly transition from one venue focus to another
   - Fade out old spotlight, fade in new spotlight (no jarring reset)

---

## Questions for Review

- Should we add a "Share this view" button when spotlight is active?
- Should deep links clear query params after navigation (clean URL) or keep them (shareable state)?
- Should we add analytics tracking for deep link usage?
- Should venue links in gatefold open in new tab (target="_blank") or same tab?
- Should we add a toast notification when navigating via deep link? ("Now showing: 9:30 Club")

---

## Revision History

- **2026-01-08:** Initial specification created
- **Version:** 1.0.0
- **Author:** Claude Code
- **Status:** Planned
