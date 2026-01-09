# Cross-Scene Artist Navigation: Venues → Artists

> **Status**: Planned
> **Target Version**: v1.6.0
> **Priority**: Medium
> **Effort**: Medium
> **Dependencies**: None
> **Last Updated**: 2026-01-07

---

## Executive Summary

Add clickable artist navigation in the Venues scene force graph that navigates users to the Artists scene and auto-opens the corresponding artist's gatefold. This creates seamless cross-scene connections for exploring artist details, building on the successful Geography→Venues navigation pattern.

**Problem:** Users browsing the Venues force graph see artist nodes (headliners and openers) but have no direct way to navigate to those artists' detail views. They must manually scroll to the Artists scene and search for the artist.

**Solution:** Make all artist nodes (both headliners and openers) clickable. When clicked, the app smoothly scrolls to the Artists scene and automatically opens the selected artist's vinyl gatefold with their concert history and Spotify integration.

**Value:** This feature completes the cross-scene discovery triangle (Map→Venues, Venues→Artists, and future Artists→Map), making the app feel more connected and explorable. Users can follow their curiosity from any scene to any other, discovering the "story" of their concert history through multiple lenses.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement cross-scene navigation from the Venues scene to the Artists scene for the Morperhaus Concert Archives app.

## IMPORTANT CONTEXT WINDOW MANAGEMENT

- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation phase, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth
- Ask clarifying questions if anything is ambiguous or needs decision
- Read files proactively to understand existing patterns before writing code

## Feature Overview

- When users click artist nodes (headliners or openers) in the Venues force graph, navigate to Artists scene
- Automatically open the clicked artist's vinyl gatefold with their concert history
- Use normalized artist names as consistent keys across all scenes
- Mirror the existing Geography→Venues navigation pattern for consistency
- Simple, fast animation: scroll + open (no special spotlight effects)

## Key References

- **Full Design Spec:** docs/specs/future/venue-artist-cross-navigation.md (this file)
- **Reference Pattern:** docs/specs/implemented/venue-cross-navigation.md
- **Existing Components:** src/components/scenes/ArtistScene/ (gatefold system)
- **Normalization Utility:** src/utils/normalize.ts

## Implementation Approach (3 Phases)

### Phase 1: State Infrastructure (~30 minutes, ~50 LOC)
- Add `pendingArtistFocus` state in App.tsx
- Create `handleArtistNavigate` callback
- Pass props to Scene4Bands and ArtistScene
- **Files:** App.tsx

### Phase 2: Node IDs & Navigation (~60 minutes, ~100 LOC)
- Import normalization utility in Scene4Bands
- Update node creation to use normalized names in IDs
- Add helper to extract normalized names from node IDs
- Update click handler to detect artist nodes and trigger navigation
- **Files:** Scene4Bands.tsx, utils/normalize.ts

### Phase 3: Gatefold Handler (~30 minutes, ~40 LOC)
- Add pendingArtistFocus props to ArtistScene interface
- Create synthetic centered DOMRect helper
- Add useEffect to handle incoming artist focus
- Match by normalized name and open gatefold
- **Files:** ArtistScene.tsx

## Design Philosophy

**"Discovery through connections"** - The app is a web of interconnected views (map, venues, artists), not isolated pages. Users should be able to follow artists, venues, and locations across scenes without friction. This navigation mirrors the real-world connections: venues host artists, artists play multiple venues, both exist in geographic locations.

## Key Design Details

**Visual:**
- Artist nodes remain visually unchanged (no new hover state needed)
- Cursor changes to `pointer` on artist nodes (already handled by D3 touch targets)
- Gatefold opens from screen center (240×240px synthetic rect)

**Animation:**
- Scroll to Artists scene: ~800ms (browser smooth scroll)
- Gatefold open: ~400ms (existing animation)
- Total: ~1200ms (feels responsive, not jarring)
- No spotlight effects (user preference: keep it simple)

**Interaction:**
- Click headliner or opener node → immediate navigation
- Replaces existing spotlight/focus behavior on artist nodes
- Venue nodes keep their expand/collapse behavior (unchanged)

## Technical Strategy

**State Management:**
- Lift `pendingArtistFocus` state to App.tsx (sibling component communication)
- Pass callback down to Scene4Bands, state down to ArtistScene
- Clear state after navigation completes (via completion callback)

**Normalized Names as Keys:**
- Concert data has `headlinerNormalized` field (e.g., "social-distortion")
- Normalize opener names on-the-fly in Scene4Bands
- Node IDs now contain normalized names: `headliner|venue|social-distortion`
- ArtistScene matches directly by normalized name (no conversion needed)
- This creates a consistent "primary key" across all scenes

**Animation Origin:**
- Geography→Venues had map marker position (real DOM element)
- Venues→Artists has no source element (force graph nodes move dynamically)
- Solution: Create synthetic centered DOMRect for natural open-from-center effect

## Current State of Related Features

**Existing Gatefold System:**
- ArtistScene has `openArtist` and `clickedTileRect` state
- `handleCardClick(artist, rect)` triggers gatefold open
- `ArtistGatefold` component handles animation and content display
- ESC key closes gatefold

**Existing Cross-Navigation:**
- Geography→Venues navigation implemented (v1.5.1)
- Uses `pendingVenueFocus` state in App.tsx
- Scroll + spotlight + expand pattern
- This feature mirrors that architecture

**Z-Index Layering:**
- Gatefold: z-50 (modal overlay, above all scenes)
- Scenes: z-0 to z-10 (stacked vertically)
- No z-index conflicts

## Files to Modify

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/App.tsx` | Add pendingArtistFocus state, handleArtistNavigate callback, pass props | ~20 |
| `src/components/scenes/Scene4Bands.tsx` | Use normalized names in node IDs, add navigation click handler | ~80 |
| `src/components/scenes/ArtistScene/ArtistScene.tsx` | Handle pendingArtistFocus, open gatefold automatically | ~40 |

**Total:** ~140 LOC added/modified

## Suggested Starting Point

Read the existing venue-cross-navigation implementation to understand the pattern, then let's start with Phase 1: State Infrastructure in App.tsx.

**Ready?** Should I begin by reviewing the existing `pendingVenueFocus` pattern in App.tsx to understand the state management approach?
```

---

## Design Philosophy

The Morperhaus Concert Archives is fundamentally about **connections**: artists connect to venues, venues connect to locations, shows connect across time. The UI should reflect these natural relationships through seamless cross-scene navigation.

**Mental Model:** "Follow the thread"
- See an artist at a venue? Click to learn more about that artist.
- See a venue on the map? Click to see all artists who played there.
- See an artist's gatefold? (Future) Click to see where they played.

**UX Goal:** Make the app feel explorable and interconnected, not like isolated data views. Every element that represents an entity (artist, venue, location) should be a potential navigation point.

---

## Visual Design

### Artist Nodes (Unchanged)

The force graph artist nodes don't need visual changes - they already have distinct colors:
- **Headliners:** Purple circles (#8b5cf6)
- **Openers:** Pink circles (#ec4899)
- **Cursor:** Already handled by invisible touch target circles

**Rationale:** The nodes are already visually distinct and interactive. Adding hover effects would clutter the already-dense force graph. The pointer cursor is sufficient affordance.

### Gatefold Animation

**Opening Sequence:**
1. **Origin:** Synthetic centered DOMRect (240×240px at viewport center)
2. **Flying Tile:** Animates from center to center (minimal movement, immediate fade-in)
3. **Gatefold Reveal:** Standard 800ms open animation
4. **Total Time:** ~1200ms (feels instant compared to scrolling from other scenes)

**Dimensions:**
- Synthetic rect: 240×240px (matches uniform artist card size)
- Position: `(window.innerWidth / 2 - 120, window.innerHeight / 2 - 120)`
- Gatefold: 400×400px vinyl record (existing design)

---

## Interaction Design

### User Flow

```
1. User is exploring Venues scene (force graph)
   ↓
2. User clicks headliner node (e.g., "Social Distortion")
   ↓
3. Scene smoothly scrolls down to Artists (800ms)
   ↓
4. Artists mosaic loads (if not already visible)
   ↓
5. Gatefold opens automatically from center (400ms)
   ↓
6. User sees Social Distortion's vinyl gatefold with concert history
```

### Click Behavior Matrix

| Element Clicked | Current Behavior (v1.5.1) | New Behavior (v1.6.0) |
|-----------------|---------------------------|------------------------|
| Venue node (all mode) | Expand/collapse venue, center it | ✅ Unchanged |
| Venue node (top10 mode) | Toggle spotlight focus | ✅ Unchanged |
| Headliner node | Toggle spotlight focus | ➡️ Navigate to Artists |
| Opener node | Toggle spotlight focus | ➡️ Navigate to Artists |
| Background | No action | ✅ Unchanged |

**Key Decision:** Artist navigation replaces the spotlight behavior entirely. Rationale:
- Spotlight is primarily for visual exploration
- Most users want to "learn more" when clicking an artist
- Venue expand/collapse is more critical to preserve (user explicitly requested)
- Simpler mental model: venues expand, artists navigate

### Keyboard Navigation

- **Click via keyboard:** Space or Enter on focused artist node triggers navigation
- **Gatefold close:** ESC key (already implemented)
- **Focus management:** Gatefold receives focus when opened (already implemented)

### Animation Specifications

**Scroll Animation:**
- Duration: ~800ms (browser smooth scroll, not configurable)
- Easing: Browser default (close to ease-in-out)
- Target: `top: (5 - 1) * windowHeight`

**Gatefold Open:**
- Duration: 400ms (flying tile) + 800ms (gatefold open)
- Easing: cubic-bezier(0.4, 0, 0.2, 1) (existing Framer Motion)
- Transform: Scale from 0.8 to 1.0, opacity 0 to 1
- Origin: Synthetic center rect (no source element)

**No Spotlight Effect:**
- User preference: keep navigation simple and fast
- Spotlight adds visual complexity without value for this use case
- Mosaic background already dims when gatefold opens (existing behavior)

---

## Technical Implementation

### Architecture Overview

```
App.tsx (state orchestrator)
├── pendingArtistFocus: string | null
├── handleArtistNavigate(normalizedName: string)
│   ├── setPendingArtistFocus(normalizedName)
│   └── scrollTo(Scene 5)
├── Scene4Bands (sends navigation request)
│   ├── onArtistNavigate prop
│   ├── Node IDs contain normalized names
│   └── Click handler extracts normalized name
└── ArtistScene (receives navigation request)
    ├── pendingArtistFocus prop
    ├── Finds artist by normalized name
    └── Opens gatefold with synthetic rect
```

### State Management

**New State Variables:**

```typescript
// In App.tsx
const [pendingArtistFocus, setPendingArtistFocus] = useState<string | null>(null)
```

**Callback Flow:**

```typescript
// 1. User clicks artist in Venues scene
Scene4Bands: onArtistNavigate("social-distortion")
  ↓
// 2. App.tsx receives request
handleArtistNavigate: setPendingArtistFocus("social-distortion")
handleArtistNavigate: scroll to Scene 5
  ↓
// 3. ArtistScene receives pending state
ArtistScene: useEffect([pendingArtistFocus])
  ↓
// 4. Find artist and open gatefold
ArtistScene: find artist by normalizedName
ArtistScene: setOpenArtist(artist)
ArtistScene: setClickedTileRect(centeredRect)
  ↓
// 5. Notify completion
ArtistScene: onArtistFocusComplete()
  ↓
// 6. App.tsx clears pending state
App.tsx: setPendingArtistFocus(null)
```

### Data Flow: Normalized Names

**Problem:** Venues scene uses raw artist names, Artists scene uses normalized names. How do we match?

**Solution:** Use normalized names everywhere as the "primary key".

**Concert Data Structure:**
```json
{
  "headliner": "Social Distortion",
  "headlinerNormalized": "social-distortion",
  "openers": ["Violent Femmes", "Kasabian"]
}
```

**Node ID Formats (UPDATED):**

```typescript
// Before (v1.5.1)
headliner|The Belasco|Social Distortion
opener|The Belasco|Social Distortion|Violent Femmes

// After (v1.6.0) - normalized names
headliner|The Belasco|social-distortion
opener|The Belasco|social-distortion|violent-femmes
```

**Implementation:**

```typescript
// In Scene4Bands, building nodes
const headlinerId = `headliner|${venue}|${
  concerts.find(c => c.venue === venue && c.headliner === headliner)?.headlinerNormalized
  || normalizeArtistName(headliner)
}`

const normalizedHeadliner = concerts.find(...)?.headlinerNormalized || normalizeArtistName(headliner)
const openerId = `opener|${venue}|${normalizedHeadliner}|${normalizeArtistName(opener)}`
```

**Extraction:**

```typescript
// From node ID, extract normalized name (already normalized!)
const parts = nodeId.split('|')
const normalizedName = parts[2] // headliner
const normalizedName = parts[3] // opener
```

**Matching in ArtistScene:**

```typescript
// Direct match by normalized name (no conversion needed)
const targetArtist = artistCards.find(
  card => card.normalizedName === pendingArtistFocus
)
```

### Component Changes

#### App.tsx Changes

```typescript
// 1. Add state (after line 34)
const [pendingArtistFocus, setPendingArtistFocus] = useState<string | null>(null)

// 2. Add handler (after handleVenueNavigate)
const handleArtistNavigate = (normalizedArtistName: string) => {
  setPendingArtistFocus(normalizedArtistName)

  const scrollContainer = scrollContainerRef.current
  if (!scrollContainer) return

  const windowHeight = window.innerHeight
  scrollContainer.scrollTo({
    top: (5 - 1) * windowHeight, // Scene 5 = Artists
    behavior: 'smooth',
  })
}

// 3. Update Scene4Bands props (around line 163)
<Scene4Bands
  concerts={concerts}
  pendingVenueFocus={pendingVenueFocus}
  onVenueFocusComplete={() => setPendingVenueFocus(null)}
  onArtistNavigate={handleArtistNavigate}  // NEW
/>

// 4. Update ArtistScene props (around line 179)
<ArtistScene
  concerts={concerts}
  pendingArtistFocus={pendingArtistFocus}  // NEW
  onArtistFocusComplete={() => setPendingArtistFocus(null)}  // NEW
/>
```

#### Scene4Bands.tsx Changes

```typescript
// 1. Add import
import { normalizeArtistName } from '../../utils/normalize'

// 2. Update interface
interface Scene4BandsProps {
  concerts: Concert[]
  pendingVenueFocus?: string | null
  onVenueFocusComplete?: () => void
  onArtistNavigate?: (normalizedArtistName: string) => void  // NEW
}

// 3. Update component signature
export function Scene4Bands({
  concerts,
  pendingVenueFocus,
  onVenueFocusComplete,
  onArtistNavigate  // NEW
}: Scene4BandsProps) {

// 4. Update node creation (around lines 160-184)
// Headliner nodes
const headlinerId = `headliner|${venue}|${
  concerts.find(c => c.venue === venue && c.headliner === headliner)?.headlinerNormalized
  || normalizeArtistName(headliner)
}`

// Opener nodes
const normalizedHeadliner = concerts.find(...)?.headlinerNormalized || normalizeArtistName(headliner)
const openerId = `opener|${venue}|${normalizedHeadliner}|${normalizeArtistName(opener)}`

// 5. Add helper (after line 269)
const getArtistNameFromNodeId = useCallback((nodeId: string, nodeType: 'headliner' | 'opener'): string => {
  const parts = nodeId.split('|')
  return nodeType === 'headliner' ? parts[2] || '' : parts[3] || ''
}, [])

// 6. Update click handler (replace lines 514-540)
.on('click', function(_event, d) {
  // Artist navigation
  if ((d.type === 'headliner' || d.type === 'opener') && onArtistNavigate) {
    const normalizedName = getArtistNameFromNodeId(d.id, d.type)
    if (normalizedName) {
      onArtistNavigate(normalizedName)
    }
    return
  }

  // Venue expansion (unchanged)
  if (viewMode === 'all' && d.type === 'venue') {
    // ... existing code
  }

  // Focus toggle fallback (unchanged)
  // ... existing code
})
```

#### ArtistScene.tsx Changes

```typescript
// 1. Update interface
interface ArtistSceneProps {
  concerts: Concert[]
  pendingArtistFocus?: string | null  // NEW
  onArtistFocusComplete?: () => void  // NEW
}

// 2. Update signature
export function ArtistScene({
  concerts,
  pendingArtistFocus,
  onArtistFocusComplete
}: ArtistSceneProps) {

// 3. Add helper (after line 58)
const createCenteredRect = (): DOMRect => {
  const width = 240
  const height = 240
  const left = (window.innerWidth - width) / 2
  const top = (window.innerHeight - height) / 2

  return {
    x: left,
    y: top,
    width,
    height,
    left,
    top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect
}

// 4. Add useEffect (after line 58, before isLoading check)
useEffect(() => {
  if (!pendingArtistFocus || !artistCards.length) return

  // pendingArtistFocus is already normalized - direct match
  const targetArtist = artistCards.find(
    card => card.normalizedName === pendingArtistFocus
  )

  if (!targetArtist) {
    console.warn(`Artist "${pendingArtistFocus}" not found`)
    onArtistFocusComplete?.()
    return
  }

  // Open gatefold with synthetic centered rect
  setOpenArtist(targetArtist)
  setClickedTileRect(createCenteredRect())
  onArtistFocusComplete?.()
}, [pendingArtistFocus, artistCards, onArtistFocusComplete])
```

### Performance Considerations

**Bundle Size Impact:**
- ~140 LOC added
- No new dependencies
- Reuses existing normalization utility
- **Estimated impact:** <1KB gzipped

**Runtime Performance:**
- Node ID changes require minimal CPU (string concatenation)
- Artist lookup is O(n) where n = ~172 artists (negligible)
- Normalized name caching via memoization (already exists in useArtistData)
- **Estimated impact:** <1ms per navigation

**Memory:**
- Single string state variable (pendingArtistFocus)
- **Estimated impact:** <100 bytes

---

## Edge Cases & Error Handling

### 1. Artist Not Found

**Scenario:** Normalized name doesn't match any artist in artistCards

**Cause:** Data mismatch, opener not in top artists, normalization inconsistency

**Handling:**
```typescript
if (!targetArtist) {
  console.warn(`Artist "${pendingArtistFocus}" not found in artist cards`)
  onArtistFocusComplete?.()
  return
}
```

**User Impact:** Navigation completes silently, no gatefold opens. This is acceptable because:
- Rare occurrence (opener edge case)
- User lands on Artists scene anyway (not a dead end)
- Can manually find artist in mosaic

**Future Enhancement:** Show toast notification "Artist not found in top 172"

### 2. Navigation Interrupted

**Scenario:** User scrolls away mid-animation or clicks another artist

**Handling:**
- Completion callback clears `pendingArtistFocus`
- New click overwrites pending state (last click wins)
- No stale state accumulation

**User Impact:** Smooth interruption, no stuck states

### 3. Missing Props

**Scenario:** onArtistNavigate not provided to Scene4Bands

**Handling:**
```typescript
if ((d.type === 'headliner' || d.type === 'opener') && onArtistNavigate) {
  // navigation logic
}
```

**User Impact:** Feature gracefully degrades to old spotlight behavior

### 4. Gatefold Already Open

**Scenario:** User navigates while a gatefold is already open

**Handling:**
- New artist state overwrites `openArtist`
- Previous gatefold closes instantly
- New gatefold opens

**User Impact:** Feels like switching between artists (natural behavior)

### 5. Rapid Repeated Clicks

**Scenario:** User rapidly clicks multiple artist nodes

**Handling:**
- Each click triggers navigation (scroll is idempotent)
- Last click wins (state overwrite)
- No memory leaks or timer accumulation

**User Impact:** Responsive, no lag or errors

### 6. Mobile Touch Targets

**Scenario:** Small artist nodes on mobile

**Current State:**
- Invisible touch targets are 44px minimum (WCAG AAA)
- Already implemented in Scene4Bands

**User Impact:** No changes needed, already accessible

### 7. ViewMode Sync

**Scenario:** User in "Top 10" mode clicks artist from non-top-10 venue

**Handling:**
- Navigation proceeds regardless of viewMode
- Artist matching is independent of venue display mode

**User Impact:** Works consistently across all view modes

---

## Accessibility Requirements

### Keyboard Navigation

**Current State:**
- Force graph nodes are keyboard-focusable (Tab navigation)
- Space/Enter keys trigger click events on focused nodes
- **Status:** ✅ Works automatically, no changes needed

**Testing:**
- Tab to artist node
- Press Space or Enter
- Verify navigation triggers

### Focus Management

**Gatefold Focus:**
- Gatefold already receives focus when opened (existing implementation)
- ESC key closes gatefold (existing implementation)
- **Status:** ✅ No changes needed

**Scene Transition:**
- Focus remains on scrolled-away node during transition
- Focus moves to gatefold when it opens
- **Status:** ✅ Acceptable (brief transition period)

### Screen Reader Announcements

**Current State:**
- Artist nodes have no ARIA labels (inherits from D3 SVG)
- Gatefold has proper ARIA attributes (existing)

**Recommended Enhancement (Future):**
```typescript
node.attr('aria-label', d => `${d.type}: ${artistName}, ${d.count} shows`)
node.attr('role', 'button')
```

**Status:** Not blocking for v1.6.0, add to backlog

### Color Contrast

**Current State:**
- Headliner purple: #8b5cf6
- Opener pink: #ec4899
- Background: Dark blue gradient
- **Contrast ratios:** Pass WCAG AA for large graphics

**Status:** ✅ No changes needed

---

## Testing Strategy

### Manual Testing Checklist

#### Basic Navigation
- [ ] Click headliner node in "Top 10" mode → navigates to Artists
- [ ] Click headliner node in "All Venues" mode → navigates to Artists
- [ ] Click opener node in "Top 10" mode → navigates to Artists
- [ ] Click opener node in "All Venues" mode → navigates to Artists
- [ ] Correct gatefold opens for clicked artist
- [ ] Gatefold displays correct concert history

#### Artist Matching
- [ ] Artist with spaces ("Social Distortion") → matches correctly
- [ ] Artist with punctuation ("Run-DMC") → matches correctly
- [ ] Artist with articles ("The Cure") → matches correctly
- [ ] Artist with lowercase ("duran duran") → matches correctly
- [ ] Opener artist ("Violent Femmes") → matches correctly

#### Animation Quality
- [ ] Scroll to Artists scene is smooth (~800ms)
- [ ] Gatefold opens from center position
- [ ] Gatefold animation timing feels natural (~400ms)
- [ ] Total navigation time feels responsive (<1500ms)
- [ ] No visual glitches or flickers

#### Venue Behavior Unchanged
- [ ] Click venue node in "All" mode → expands/collapses
- [ ] Click venue node in "Top 10" mode → toggles focus
- [ ] Venue spotlight behavior unchanged
- [ ] No artist navigation triggered by venue clicks

#### Edge Cases
- [ ] Rapid clicks on different artists → last click wins
- [ ] Click artist while gatefold already open → switches artists
- [ ] Scroll away during navigation → completes gracefully
- [ ] ESC key closes gatefold after navigation
- [ ] Click outside gatefold closes it (existing behavior)

#### Keyboard Navigation
- [ ] Tab to artist node → receives focus
- [ ] Press Space on focused artist node → navigates
- [ ] Press Enter on focused artist node → navigates
- [ ] Gatefold receives focus when opened
- [ ] ESC closes gatefold and returns focus

#### Mobile
- [ ] Touch artist node on mobile → navigates
- [ ] Touch targets feel responsive (44px minimum)
- [ ] Scroll animation works on mobile
- [ ] Gatefold opens correctly on mobile
- [ ] Portrait and landscape orientations both work

#### View Modes
- [ ] Works when Venues is in "Top 10" mode
- [ ] Works when Venues is in "All Venues" mode
- [ ] Works when venue is expanded
- [ ] Works when venue is collapsed
- [ ] Works after switching view modes

### Test Data

**Known Artists to Test:**
- **Headliners:** Social Distortion, Duran Duran, Nine Inch Nails, The Cure
- **Openers:** Violent Femmes, Kasabian, Foals
- **Edge Cases:** Run-DMC (hyphen), Echo and the Bunnymen (article)

**Venues to Test:**
- **High-frequency:** The Belasco, House of Blues Anaheim
- **Top 10:** Any venue in top 10 list
- **Non-Top 10:** Use "All Venues" mode

---

## Implementation Plan

### Phase 1: State Infrastructure (App.tsx)

**Estimated Time:** 30 minutes
**Estimated LOC:** ~50 lines

**Tasks:**
1. Add `pendingArtistFocus` state variable
2. Create `handleArtistNavigate` callback function
3. Add scroll logic (copy from handleVenueNavigate)
4. Update Scene4Bands props to include onArtistNavigate
5. Update ArtistScene props to include pendingArtistFocus and onArtistFocusComplete

**Files to Modify:**
- `src/App.tsx`

**Acceptance Criteria:**
- [ ] pendingArtistFocus state exists
- [ ] handleArtistNavigate scrolls to Scene 5
- [ ] Props passed to both scenes
- [ ] No TypeScript errors
- [ ] No build errors

**Testing:**
- Temporarily call handleArtistNavigate("test") on component mount
- Verify scroll to Artists scene
- Verify console logs show state updates

---

### Phase 2: Node IDs & Navigation (Scene4Bands.tsx)

**Estimated Time:** 60 minutes
**Estimated LOC:** ~100 lines

**Tasks:**
1. Import normalizeArtistName utility
2. Update Scene4BandsProps interface
3. Update component signature to accept onArtistNavigate
4. Modify headliner node ID creation (use headlinerNormalized)
5. Modify opener node ID creation (normalize on-the-fly)
6. Update cross-venue link logic (node IDs changed)
7. Add getArtistNameFromNodeId helper function
8. Update click handler to detect artist nodes
9. Add navigation call in click handler
10. Verify venue click behavior unchanged

**Files to Modify:**
- `src/components/scenes/Scene4Bands.tsx`

**Files to Reference:**
- `src/utils/normalize.ts` (existing utility)
- `src/types/concert.ts` (headlinerNormalized field)

**Acceptance Criteria:**
- [ ] Node IDs contain normalized names
- [ ] Click on headliner triggers navigation
- [ ] Click on opener triggers navigation
- [ ] Click on venue still expands/collapses
- [ ] No TypeScript errors
- [ ] No runtime errors in console

**Testing:**
- Console.log node IDs to verify normalization
- Click various artist nodes, verify onArtistNavigate called
- Click venue nodes, verify expand/collapse still works
- Check D3 force simulation stability (no layout issues)

**Critical:** Ensure cross-venue links still work after node ID format changes. The link matching logic uses `n.id.includes(band)` which should still work with normalized names.

---

### Phase 3: Gatefold Handler (ArtistScene.tsx)

**Estimated Time:** 30 minutes
**Estimated LOC:** ~40 lines

**Tasks:**
1. Update ArtistSceneProps interface
2. Update component signature to accept new props
3. Create createCenteredRect helper function
4. Add useEffect to handle pendingArtistFocus
5. Add artist lookup logic
6. Add error handling for artist not found
7. Call handleCardClick with synthetic rect
8. Call onArtistFocusComplete to clear state

**Files to Modify:**
- `src/components/scenes/ArtistScene/ArtistScene.tsx`

**Acceptance Criteria:**
- [ ] pendingArtistFocus triggers useEffect
- [ ] Artist lookup by normalizedName succeeds
- [ ] Gatefold opens with centered rect
- [ ] onArtistFocusComplete clears state
- [ ] Warning logged if artist not found
- [ ] No TypeScript errors
- [ ] No memory leaks (useEffect cleanup)

**Testing:**
- Navigate from Venues scene
- Verify gatefold opens for correct artist
- Verify gatefold animates from center
- Test with artist that doesn't exist (should warn)
- Test rapid navigation (multiple clicks)

---

### Phase 4: Polish & Testing

**Estimated Time:** 30 minutes

**Tasks:**
1. Run full manual testing checklist (above)
2. Test all edge cases
3. Verify keyboard navigation
4. Test on mobile device
5. Check bundle size impact
6. Update docs/STATUS.md with feature completion
7. Move this spec to docs/specs/implemented/

**Acceptance Criteria:**
- [ ] All manual tests pass
- [ ] No console errors or warnings
- [ ] Performance feels smooth
- [ ] Works on mobile and desktop
- [ ] Bundle size increase <1KB

---

## Dependencies

### Required
- Existing venue-cross-navigation pattern (v1.5.1)
- Existing gatefold system in ArtistScene
- Existing normalization utility (src/utils/normalize.ts)
- headlinerNormalized field in concert data

### Optional
None - feature is self-contained

---

## Future Enhancements

1. **Reverse Navigation:** Click artist in Artists scene → show all venues on map
2. **Deep Linking:** URL hash support (`#artist=social-distortion`)
3. **Artist Context Menu:** Right-click artist node for options (navigate, spotlight, etc.)
4. **Artist ARIA Labels:** Add descriptive labels for screen readers
5. **Toast Notification:** "Artist not found" message for edge cases
6. **Hover Preview:** Small artist photo tooltip on node hover (like timeline)
7. **Multi-Artist Selection:** Shift+click to compare multiple artists

---

## Related Specifications

- [venue-cross-navigation.md](../implemented/venue-cross-navigation.md) - Reference pattern
- [artist-scene.md](../implemented/artist-scene.md) - Gatefold system details
- [mobile-optimization.md](mobile-optimization.md) - Touch target sizing

---

## Success Metrics

### Quantitative
- Navigation completion rate: >95%
- Average time to artist gatefold: <1500ms
- Error rate (artist not found): <2%
- Mobile vs desktop parity: >90%

### Qualitative
- Users report app feels "more connected"
- Reduced friction in artist discovery workflow
- Consistent cross-scene navigation patterns

---

## Revision History

- **2026-01-03:** Initial specification created
- **Version:** 1.0.0
- **Author:** Lead Architect
- **Status:** 🚧 Planned
