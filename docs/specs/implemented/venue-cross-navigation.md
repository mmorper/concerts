# Cross-Scene Venue Navigation: Map → Venues

**Status:** ✅ Complete
**Version:** v1.5.1
**Completed:** 2026-01-03

## Overview

Add clickable venue links in the Map (Geography) scene popups that navigate users to The Venues scene and auto-expand the corresponding venue node. This creates a seamless cross-scene connection for exploring venue details.

**User Flow:**
1. User clicks a venue marker on the map
2. Popup appears showing venue name, city/state, and concert count
3. Venue name is now a clickable link (styled distinctly)
4. Clicking the link:
   - Closes the popup
   - Smooth scrolls to The Venues scene
   - Switches to "All Venues" view (if not already)
   - Auto-expands the venue node with its child artists
   - All other venue nodes fade back, drawing further attention on the venue node and child nodes with focus
---

## Visual Design

### Popup Before (Current)
```
┌─────────────────────────────┐
│ Irvine Meadows              │  ← Plain text
│ Irvine, California          │
│ 15 concerts                 │
└─────────────────────────────┘
```

### Popup After (New)
```
┌─────────────────────────────┐
│ Irvine Meadows →            │  ← Clickable link (indigo-400, underline on hover)
│ Irvine, California          │
│ 15 concerts                 │
└─────────────────────────────┘
```

**Link Styling:**
- Color: `#818cf8` (indigo-400) to match existing accent colors
- Underline on hover
- Cursor: pointer
- Small arrow indicator (→) after venue name to suggest navigation
- Accessible focus state with visible outline

---

## Technical Architecture

### State Communication Pattern

Since Map and Venues are sibling components, state needs to flow through App.tsx:

```
App.tsx
├── Scene4Bands (Venues) ← receives: focusVenue, onVenueFocused
├── Scene3Map ← receives: onVenueNavigate callback
```

**New Props/State:**

```typescript
// App.tsx - new state
const [pendingVenueFocus, setPendingVenueFocus] = useState<string | null>(null)

// Passed to Scene3Map
onVenueNavigate: (venueName: string) => void

// Passed to Scene4Bands
focusVenue: string | null
onVenueFocused: () => void  // callback to clear pending state after animation
```

### Implementation Flow

```
1. User clicks venue link in map popup
   ↓
2. Scene3Map calls onVenueNavigate("Irvine Meadows")
   ↓
3. App.tsx:
   - Sets pendingVenueFocus = "Irvine Meadows"
   - Scrolls to Scene 2 (Venues)
   ↓
4. Scene4Bands receives focusVenue prop
   - Switches viewMode to "all" if needed
   - Sets centeredVenue and expandedVenues
   - Calls onVenueFocused() after animation completes
   ↓
5. App.tsx clears pendingVenueFocus
```

---

## Data Flow

### Venue Name Matching

The map stores venue names in the marker data. The Venues scene uses `venue|{venueName}` as node IDs.

**Map marker key format:** `${concert.venue}|${concert.cityState}`
**Venues node ID format:** `venue|${venueName}`

Matching logic:
```typescript
// In Scene4Bands, when receiving focusVenue:
const targetVenueId = `venue|${focusVenue}`
const venueNode = nodes.find(n => n.id === targetVenueId)
```

**Edge case:** Venue names must match exactly. The map uses the raw `concert.venue` value, which should match what's stored in concerts.json and used by Scene4Bands.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `pendingVenueFocus` state, pass props to both scenes, add scroll handler |
| `src/components/scenes/Scene3Map.tsx` | Update popup HTML with clickable venue link, add event delegation for link clicks |
| `src/components/scenes/Scene4Bands.tsx` | Add `focusVenue` prop handling, auto-expand logic on mount/update |

---

## Implementation Steps

### Phase 1: State Infrastructure in App.tsx

- [ ] Add `pendingVenueFocus` state (string | null)
- [ ] Create `handleVenueNavigate(venueName: string)` function:
  ```typescript
  const handleVenueNavigate = (venueName: string) => {
    setPendingVenueFocus(venueName)
    // Scroll to Scene 2 (Venues)
    const scrollContainer = document.querySelector('.snap-y')
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: window.innerHeight, // Scene 2 is at index 1
        behavior: 'smooth',
      })
    }
  }
  ```
- [ ] Create `handleVenueFocused()` callback to clear state
- [ ] Pass `onVenueNavigate` prop to Scene3Map
- [ ] Pass `focusVenue` and `onVenueFocused` props to Scene4Bands

### Phase 2: Map Popup Enhancement (Scene3Map.tsx)

- [ ] Update component props interface:
  ```typescript
  interface Scene3MapProps {
    concerts: Concert[]
    onVenueNavigate?: (venueName: string) => void
  }
  ```

- [ ] Modify popup HTML generation to include clickable link:
  ```typescript
  // Current:
  .bindPopup(`<strong>${data.label}</strong><br/>${data.count} concert${data.count !== 1 ? 's' : ''}`)

  // New (only for DC/California regions where venues are shown):
  const popupContent = showVenues
    ? `<a href="#" class="venue-link" data-venue="${venueName}" style="color: #818cf8; text-decoration: none; font-weight: 600;">
         ${venueName} →
       </a>
       <br/>
       <span style="font-size: 11px; color: #9ca3af;">${cityState}</span>
       <br/>
       ${data.count} concert${data.count !== 1 ? 's' : ''}`
    : `<strong>${data.label}</strong><br/>${data.count} concert${data.count !== 1 ? 's' : ''}`
  ```

- [ ] Add event delegation for venue link clicks:
  ```typescript
  // Inside the useEffect that creates markers, after map initialization:
  mapInstanceRef.current.on('popupopen', (e: L.PopupEvent) => {
    const popup = e.popup
    const container = popup.getElement()
    if (!container) return

    const venueLink = container.querySelector('.venue-link')
    if (venueLink && onVenueNavigate) {
      venueLink.addEventListener('click', (event) => {
        event.preventDefault()
        const venueName = (event.target as HTMLElement).dataset.venue
        if (venueName) {
          popup.close()
          setIsMapActive(false)  // Exit map exploration mode
          onVenueNavigate(venueName)
        }
      })
    }
  })
  ```

- [ ] Add hover styles via CSS (in index.css or inline):
  ```css
  .venue-link:hover {
    text-decoration: underline;
  }
  .venue-link:focus {
    outline: 2px solid #818cf8;
    outline-offset: 2px;
  }
  ```

### Phase 3: Venues Scene Auto-Expand (Scene4Bands.tsx)

- [ ] Update component props interface:
  ```typescript
  interface Scene4BandsProps {
    concerts: Concert[]
    focusVenue?: string | null
    onVenueFocused?: () => void
  }
  ```

- [ ] Add new state for spotlight effect:
  ```typescript
  const [spotlightVenue, setSpotlightVenue] = useState<string | null>(null)
  ```

- [ ] Modify D3 render to respect spotlight state (dim non-target nodes when spotlightVenue is set)

- [ ] Add useEffect to handle incoming focusVenue (see Phase 4 for detailed choreography)

### Phase 4: Animation Choreography

The navigation should feel theatrical and intentional—a reveal, not just a jump.

**Animation Sequence (Total: ~2300ms)**

```
Timeline:
0ms       800ms     1200ms    1500ms    2300ms
|---------|---------|---------|---------|
  Scroll    Spotlight  Pause    Expand + Fade
            Fade In            Spotlight Out
```

**Step 1: Scroll + Settle (~800ms)**
- Smooth scroll to Venues scene
- Snap scroll locks into place naturally
- No additional code needed—browser handles this

**Step 2: Spotlight Fade In (~400ms)**
- Subtle dark overlay fades in over entire scene (`bg-black/30` or similar)
- Target venue node remains at full opacity/brightness
- All other nodes dim slightly (reduce opacity to ~0.3)
- Implementation: D3 selection to dim non-target nodes + optional SVG overlay

**Step 3: Recognition Pause (~300ms)**
- Brief hold so user registers "there's the venue I clicked"
- Target venue may have subtle pulse or glow during this moment

**Step 4: Expand + Spotlight Fade Out (~800ms)**
- Venue moves to center, children expand radially (existing D3 force animation)
- Spotlight overlay fades out simultaneously
- All nodes return to normal opacity as expansion completes

**Implementation in Scene4Bands.tsx:**

```typescript
useEffect(() => {
  if (!focusVenue) return

  // Ensure we're in "all" view mode
  if (viewMode !== 'all') {
    setViewMode('all')
    return // Wait for re-render with new nodes
  }

  const venueNodeId = `venue|${focusVenue}`
  const venueExists = nodes.some(n => n.id === venueNodeId)

  if (!venueExists) {
    onVenueFocused?.()
    return
  }

  // Step 2: Spotlight effect - dim other nodes
  setSpotlightVenue(focusVenue)  // New state to trigger dimming

  // Step 3: Pause, then expand
  const expandTimer = setTimeout(() => {
    setExpandedVenues(new Set([focusVenue]))
    setCenteredVenue(focusVenue)

    // Step 4: Clear spotlight after expansion settles
    const clearTimer = setTimeout(() => {
      setSpotlightVenue(null)
      onVenueFocused?.()
    }, 800)

    return () => clearTimeout(clearTimer)
  }, 700)  // 400ms fade + 300ms pause

  return () => clearTimeout(expandTimer)
}, [focusVenue, nodes, viewMode])
```

**D3 Spotlight Rendering:**

```typescript
// In the D3 render effect, apply spotlight dimming:
const isSpotlit = spotlightVenue !== null
const isTargetVenue = (d: Node) => 
  d.type === 'venue' && d.id === `venue|${spotlightVenue}`

// Node opacity based on spotlight state
.attr('fill-opacity', (d) => {
  if (!isSpotlit) return 0.85  // Normal state
  if (isTargetVenue(d)) return 1.0  // Target venue stays bright
  return 0.25  // Everything else dims
})

// Links also dim
.attr('stroke-opacity', (d) => {
  if (!isSpotlit) return d.type === 'hierarchy' ? 0.5 : 0.3
  return 0.1  // Dim all links during spotlight
})
```

### Phase 5: Edge Cases & Polish

- [ ] **Already on Venues scene:** If user is already on Venues scene, skip scroll—start directly at spotlight phase
- [ ] **Venue not found:** If venue name doesn't match any node (data mismatch), fail gracefully—clear pending state, no visual change
- [ ] **Mobile:** Ensure link is tappable with sufficient touch target size (min 44x44px effective area)
- [ ] **"All" region popup:** In "All" region view, popups only show city names (not venues). The link feature should only appear in DC/California regions where `showVenues = true`
- [ ] **Interrupt handling:** If user scrolls away during animation, cancel pending timers and clear spotlight state
- [ ] **viewMode sync:** If viewMode is "top10" when focusVenue arrives, switch to "all" and wait for node recalculation before proceeding

---

## Accessibility

- [ ] Venue link has proper `role="link"` (implicit via `<a>` tag)
- [ ] Keyboard accessible: link is focusable and activates on Enter
- [ ] Screen reader: "Irvine Meadows, link, navigate to venue details" (test with VoiceOver/NVDA)
- [ ] Focus visible state on the link
- [ ] Announce navigation: Consider aria-live announcement when scene changes

---

## Testing Checklist

### Functional Tests
- [ ] Click venue on California map → scrolls to Venues → spotlight → expands correct venue
- [ ] Click venue on DC map → scrolls to Venues → spotlight → expands correct venue
- [ ] Link works when map is in exploration mode (isMapActive = true)
- [ ] Popup closes after clicking link
- [ ] Map exits exploration mode after navigation
- [ ] Repeated clicks on same venue work correctly
- [ ] Clicking different venue while one is expanded switches to new venue

### Animation Tests
- [ ] Spotlight dims all non-target nodes to ~0.25 opacity
- [ ] Target venue remains at full opacity during spotlight
- [ ] Links dim during spotlight phase
- [ ] Spotlight fades out smoothly as expansion begins
- [ ] Total animation feels cohesive (~2.3s from click to fully expanded)
- [ ] No jarring jumps or flickers during sequence

### Edge Cases
- [ ] Fast repeated clicks don't cause issues (timers properly cleared)
- [ ] Works when already on Venues scene (no scroll, spotlight starts immediately)
- [ ] Works when Venues is in "Top 10" view (switches to "All" first, then proceeds)
- [ ] Works after page refresh with direct scroll to Map
- [ ] Mobile tap works correctly
- [ ] Scrolling away mid-animation cancels gracefully (no stuck spotlight)

### Visual/UX Tests
- [ ] Link color matches app accent palette
- [ ] Hover state is visible
- [ ] Arrow (→) renders correctly
- [ ] Focus outline is visible for keyboard users
- [ ] Animation timing feels smooth (not jarring)

---

## Reference Files

| Pattern | Reference |
|---------|-----------|
| Popup styling | `src/index.css` (.venue-popup styles) |
| Scroll to scene | `src/components/scenes/Scene3Map.tsx` (handleSceneNavigation function) |
| Venue expand logic | `src/components/scenes/Scene4Bands.tsx` (click handler, lines ~280-300) |
| State lifting pattern | `src/App.tsx` (concerts data flow) |
| D3 force timing | `src/components/scenes/Scene4Bands.tsx` (simulation.alpha/alphaTarget) |

---

## Resolved Questions

- [x] **All view only?** → Confirmed: Yes, always navigate to "All" view
- [x] **Animation timing:** Scroll completes first, then spotlight fades in, brief pause, then expand with spotlight fade out (~2300ms total sequence)
- [x] **Visual feedback:** Spotlight effect dims all non-target nodes, making the venue "pop" before expansion begins

---

## Design Decisions & Deviations from Spec

### 1. Button Instead of Text Link

**Original Spec:** Clickable venue name text link with arrow indicator

**Implemented:** Full-width gradient button with graph icon

**Rationale:**

- Button provides stronger call-to-action (single primary action in popup)
- Graph icon creates visual foreshadowing of the Venues scene
- Better touch target for mobile users (44px min-height)
- More prominent CTA matches importance of cross-navigation feature

### 2. Graph Icon Design

**Original Spec:** Small arrow indicator (→) after venue name

**Implemented:** Custom SVG icon showing parent-child node relationship

**Rationale:**

- Icon visually communicates destination (graph visualization scene)
- Diagonal cascade layout (parent top-left, children bottom-right) better represents force graph
- Multiple iterations to achieve proper visual weight and clarity
- Final design: parent r=3.5 at (6,5), children r=3 at (16,12) and (14,21)

### 3. Persistent Spotlight (No Auto-Clear)

**Original Spec:** Spotlight fades out after expansion settles (~800ms)

**Implemented:** Spotlight persists indefinitely until user interaction

**Rationale:**

- User explicitly requested: "I think they should stay screened back until the user takes action"
- Makes child nodes much easier to see and identify
- User-controlled interaction (click anywhere or press button to clear)
- More intentional focus on the target venue

### 4. Auto-Spotlight on All Venue Clicks

**Original Spec:** Spotlight only applied during cross-scene navigation

**Implemented:** Spotlight automatically applied whenever any venue is expanded

**Rationale:**

- User feedback: "I want this behavior... to be the default behavior. It is so much easier to see the child nodes."
- Consistent UX - spotlight + expand is always paired
- Applies to: map navigation, direct venue clicks in Venues scene, and Reset button

### 5. Integrated D3 Rendering (Not Manual DOM Manipulation)

**Original Spec:** Manual D3 selection to dim nodes after-the-fact

**Implemented:** Declarative opacity in D3 `.join()` transitions

**Rationale:**

- Original approach caused timing issues (nodes not rendered yet)
- Declarative approach integrates with D3's enter/update/exit lifecycle
- More reliable and performant
- Helper functions `getTargetOpacity()` and `getLinkOpacity()` calculate opacity per render

### 6. Simplified Animation Sequence

**Original Spec:** 4-step choreography (~2300ms total)

- Scroll (800ms) → Spotlight fade-in (400ms) → Pause (300ms) → Expand + fade-out (800ms)

**Implemented:** 2-step sequence (~1200ms total)

- Scroll (800ms) → Expand with spotlight (400ms, no fade-out)

**Rationale:**

- Simplified timing is more responsive
- Persistent spotlight eliminates need for fade-out animation
- Faster perceived performance
- Less complex state management

### 7. Event Delegation Pattern

**Original Spec:** Listen to Leaflet's `popupopen` event

**Implemented:** Direct click event delegation on map container

**Rationale:**

- Simpler implementation
- Better control over event propagation
- Works reliably with dynamically generated popup HTML
- Easier to test and maintain

### 8. Button Text Evolution

**Original Spec:** "View in Venues →"

**Implemented:** "Explore Venue →"

**Rationale:**

- Shorter and more action-oriented
- "Explore" suggests discovery (better matches use case)
- "Venue" clarifies what you're exploring (not just "Explore")
- More conversational tone

## Future Enhancements (Out of Scope)

- Reverse navigation: Click venue in Venues scene → show on map
- Deep linking: URL hash support for direct venue focus (`#venue=Irvine%20Meadows`)
- Bidirectional links from Artists scene to Venues
