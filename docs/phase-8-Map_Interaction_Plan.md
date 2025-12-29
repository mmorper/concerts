# Map Interaction Implementation Plan

## ✅ IMPLEMENTATION STATUS: COMPLETE (Desktop)

**Completed:** 2025-12-29

**Status:** Phases 1-3 fully implemented. Phase 4 (Mobile) deferred for future device testing.

### What Was Implemented

- ✅ Click-to-activate map exploration mode
- ✅ Scroll wheel zoom and drag panning when active
- ✅ ESC key to deactivate and return to locked state
- ✅ Scroll event trapping to prevent scene navigation when map is active
- ✅ Scene navigation buttons ("↑ The Venues" / "The Music ↓") appear when active
- ✅ "Click to explore map" hint with auto-fade behavior (1s delay, 3s visible)
- ✅ Full accessibility support (aria-labels, aria-live announcements)
- ✅ Zoom bounds enforced (min: 4, max: 16)
- ✅ California and DC regions now show venue names in popups

### What's Deferred

- 🔄 Zoom buttons (UI controls) - scroll wheel zoom works well, buttons optional
- 🔄 Mobile device testing and refinements (touch already enabled in code)

---

## Overview

Enable zoom and pan interactions on the Geography scene map while preserving the sacred scene-to-scene scroll navigation. Users should be able to explore dense venue clusters (LA, DC) without accidentally triggering scene transitions.

**Pattern:** Click-to-activate with contextual scene navigation exit

**Component:** `src/components/scenes/Scene3Map.tsx`

---

## Problem Statement

- Dense venue clusters (LA basin, DC metro) have overlapping markers
- Users cannot zoom in to separate individual venue dots
- Current implementation: Map is completely static (no scroll, zoom, or pan)
- Enabling scroll zoom would hijack page scroll and break scene navigation

---

## Current State

### Leaflet Configuration (disabled interactions)
```typescript
scrollWheelZoom: false,
dragging: false,
zoomControl: false,
doubleClickZoom: false,
touchZoom: false,
```

### What Works
- Region filter buttons (All / California / DC Area)
- `flyTo` animations when switching regions
- Marker popups on click
- Scene scroll navigation via parent `.snap-y` container

---

## Interaction Model

### Two States

| State | Map Behavior | Page Scroll | Visual Indicators |
|-------|--------------|-------------|-------------------|
| **Locked** (default) | Static display, markers clickable for popups | Normal scene navigation | Subtle "Click to explore" hint |
| **Active** | Scroll zoom, drag pan, markers clickable | Trapped (no scene scroll) | Scene nav links appear top/bottom |

### State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                         LOCKED STATE                         │
│                                                             │
│  • Scroll → navigates to prev/next scene                    │
│  • Click on marker → popup (stays locked)                   │
│  • Click on map tile → TRANSITION TO ACTIVE                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (click on map, not marker)
┌─────────────────────────────────────────────────────────────┐
│                         ACTIVE STATE                         │
│                                                             │
│  • Scroll → zooms map                                       │
│  • Drag → pans map                                          │
│  • Click marker → popup (stays active)                      │
│  • ESC key → TRANSITION TO LOCKED                           │
│  • Click scene nav link → TRANSITION TO LOCKED + navigate   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Visual Design

### Locked State

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     The Geography                           │
│                  19 cities across the map                   │
│                                                             │
│                 [All] [California] [DC Area]                │
│                                                             │
│                                                             │
│                    🔵  🔵                                    │
│                 🔵    🔵  🔵                                 │
│                      🔵                                     │
│                                                             │
│                                                             │
│                                                             │
│              ┌─────────────────────────┐                    │
│              │   Click to explore map  │  ← subtle hint     │
│              └─────────────────────────┘                    │
│                                                             │
│                  174 SHOWS · 19 CITIES                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Hint styling:**
- Position: Bottom center, above stats overlay
- Appearance: `text-gray-500 text-sm` with subtle background pill
- Behavior: Fades in after 1s delay on scene entry, fades out after 3s or on first interaction
- Optional: Only show on first visit (localStorage flag)

### Active State

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                        ↑ Venues                             │  ← slides down + fades in
│                                                             │
│                     The Geography                           │
│                  19 cities across the map                   │
│                                                             │
│                 [All] [California] [DC Area]                │
│                                                             │
│                                                             │
│                    🔵  🔵                                    │
│                 🔵    🔵  🔵    (zoomed/panned)              │
│                      🔵                                     │
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│                  174 SHOWS · 19 CITIES                      │
│                                                             │
│                       Genres ↓                              │  ← slides up + fades in
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Scene nav link styling:**
- Position: Fixed to viewport top/bottom, horizontally centered
- Appearance: Semi-transparent pill (`bg-gray-900/70 backdrop-blur-sm`)
- Text: `text-gray-300 hover:text-white` with arrow indicator
- Padding: `px-4 py-2` with generous click target (`min-h-[44px]` for touch)
- Animation: Slide in from edge + fade (300ms delay after activation)

**Active state visual cue (optional):**
- Subtle vignette or border glow on map container
- Or: Dim the title/stats overlays slightly (`opacity-70`)

---

## Scene Navigation Links

### Content
| Position | Label | Action |
|----------|-------|--------|
| Top | `↑ Venues` | Exit active state + scroll to Scene 2 |
| Bottom | `Genres ↓` | Exit active state + scroll to Scene 4 |

### Behavior
1. Click triggers `setIsMapActive(false)`
2. Re-enables page scroll
3. Calls `scrollToScene(targetSceneIndex)` (reference `SceneNavigation.tsx` pattern)
4. Links fade out as scroll begins

### Arrow Styling
- Use CSS arrows or simple Unicode (`↑` / `↓`)
- Subtle animation: gentle bounce or pulse to draw attention
- Arrow on appropriate side of text (above/below or left/right of label)

---

## Keyboard Support

| Key | Action |
|-----|--------|
| `Escape` | Exit active state, return to locked |
| `+` / `=` | Zoom in (when active) — Leaflet default |
| `-` | Zoom out (when active) — Leaflet default |
| Arrow keys | Pan map (when active) — Leaflet default |

**Implementation:** Add `useEffect` with `keydown` listener when `isMapActive === true`

---

## Scroll Trapping

When map is active, prevent scroll events from bubbling to scene container:

### Option A: CSS (preferred)
```css
.map-active {
  overscroll-behavior: contain;
}
```

### Option B: JavaScript
```typescript
useEffect(() => {
  if (!isMapActive) return
  
  const handleWheel = (e: WheelEvent) => {
    e.stopPropagation()
  }
  
  const mapContainer = mapRef.current
  mapContainer?.addEventListener('wheel', handleWheel, { passive: false })
  
  return () => {
    mapContainer?.removeEventListener('wheel', handleWheel)
  }
}, [isMapActive])
```

---

## Component Structure

### State Management
```typescript
// In Scene3Map.tsx
const [isMapActive, setIsMapActive] = useState(false)
const [showHint, setShowHint] = useState(true)
```

### New Subcomponents (optional extraction)
```
src/components/scenes/
├── Scene3Map.tsx              # Main component (modify)
├── MapExploreHint.tsx         # "Click to explore" hint (new, optional)
└── MapSceneNav.tsx            # Top/bottom scene nav links (new, optional)
```

Or keep everything in `Scene3Map.tsx` if complexity is manageable.

---

## Leaflet Configuration Changes

### Dynamic interaction toggle
```typescript
useEffect(() => {
  if (!mapInstanceRef.current) return
  
  const map = mapInstanceRef.current
  
  if (isMapActive) {
    map.scrollWheelZoom.enable()
    map.dragging.enable()
    map.touchZoom.enable()
    map.doubleClickZoom.enable()
  } else {
    map.scrollWheelZoom.disable()
    map.dragging.disable()
    map.touchZoom.disable()
    map.doubleClickZoom.disable()
  }
}, [isMapActive])
```

### Click detection (map vs marker)
```typescript
useEffect(() => {
  if (!mapInstanceRef.current) return
  
  const map = mapInstanceRef.current
  
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    // Only activate if clicking map tiles, not markers
    // Markers have their own click handlers that stop propagation
    if (!isMapActive) {
      setIsMapActive(true)
      setShowHint(false)
    }
  }
  
  map.on('click', handleMapClick)
  
  return () => {
    map.off('click', handleMapClick)
  }
}, [isMapActive])
```

---

## Animation Specs

| Element | Trigger | Animation |
|---------|---------|-----------|
| Explore hint | Scene entry | Fade in after 1s, fade out after 3s (or on click) |
| Scene nav links | Map activated | Slide in from edge + fade in, 300ms delay, 400ms duration |
| Scene nav links | Map deactivated | Fade out, 200ms duration |
| Map container | Activation | Optional: subtle border glow transition |

### Framer Motion Implementation
```tsx
<AnimatePresence>
  {isMapActive && (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="scene-nav-top"
    >
      ↑ Venues
    </motion.div>
  )}
</AnimatePresence>
```

---

## Implementation Checklist

### Phase 1: Core State & Interactions (Desktop) ✅ COMPLETED

- [x] Add `isMapActive` state to `Scene3Map.tsx`
- [x] Add zoom bounds to Leaflet config (`minZoom: 4`, `maxZoom: 16`)
- [x] Implement click-to-activate on map (not markers)
- [x] Toggle Leaflet interactions based on `isMapActive`
- [x] Add ESC key listener to deactivate
- [x] Implement scroll trapping when active (JavaScript event handler)
- [x] Test that marker popups still work in both states
- [x] Test that region filter buttons work in both states

### Phase 2: Scene Navigation Links ✅ COMPLETED

- [x] Create top nav link component (`↑ The Venues`)
- [x] Create bottom nav link component (`The Music ↓`)
- [x] Position fixed to viewport with proper z-index (`z-[1001]`)
- [x] Wire click to deactivate + scroll to target scene
- [x] Reference `SceneNavigation.tsx` for scroll logic
- [x] Add enter/exit animations with Framer Motion
- [x] Style with semi-transparent pill, blur backdrop

### Phase 3: Visual Polish ✅ COMPLETED (except zoom buttons - deferred)

- [x] Add "Click to explore" hint in locked state
- [x] Implement hint auto-fade behavior (show 1s delay, hide after 3s)
- [ ] Add zoom buttons (desktop only, `hidden md:flex`) - **DEFERRED**
- [ ] Position zoom buttons bottom-right, style to match region filter buttons - **DEFERRED**
- [ ] Wire zoom buttons to `map.zoomIn()` / `map.zoomOut()` - **DEFERRED**
- [ ] Disable zoom buttons at min/max bounds - **DEFERRED**
- [x] Add subtle visual cue for active state (aria-label changes)
- [x] Ensure nav links have sufficient touch targets (44px min)
- [x] Test color contrast and legibility over various map regions

**Note:** Zoom buttons were deferred as scroll wheel zoom works well for desktop users. Can be added later if needed.

### Phase 4: Mobile Support 🔄 DEFERRED - TODO FOR FUTURE

- [ ] Test touch activation (tap on map)
- [ ] Enable `touchZoom` and touch dragging in active state *(already enabled in code)*
- [ ] Verify pinch-to-zoom works correctly
- [ ] Confirm zoom buttons are hidden on mobile *(N/A - buttons not implemented)*
- [ ] Adjust nav link sizing/positioning for mobile viewports
- [ ] Evaluate if "Tap to explore" needs more prominence (no hover state)
- [ ] Test on actual devices (iOS Safari, Android Chrome)

**Implementation Notes for Mobile:**

- Touch zoom and touch dragging are already enabled in the code when map is active
- Scene navigation buttons are already sized for touch (44px min-height)
- Need to test actual behavior on mobile devices to identify any issues
- May need to adjust hint text or prominence for mobile (no hover state)
- Consider adding pinch gesture indicators if needed

### Phase 5: Edge Cases & QA ✅ PARTIALLY TESTED

- [x] Test rapid state toggling (spam clicking) - works correctly
- [x] Test interaction during `flyTo` animation (region switch) - works correctly
- [x] Verify scroll position restores correctly after exiting active state - works correctly
- [x] Test with keyboard-only navigation - ESC key works
- [x] Verify no scroll "jumpiness" when transitioning states - smooth
- [x] Test scene nav links scroll to correct scenes (Scene 2 and Scene 4) - correct
- [x] Test zoom bounds are respected (can't exceed min/max) - Leaflet enforces bounds
- [ ] Test zoom buttons disable state at bounds - **N/A (buttons not implemented)**

---

## Reference Files

| Pattern | Reference File |
|---------|----------------|
| Current map implementation | `src/components/scenes/Scene3Map.tsx` |
| Scene scroll behavior | `src/App.tsx` (`.snap-y` container) |
| Scene navigation/scrolling | `src/components/SceneNavigation.tsx` |
| Animation patterns | Existing Framer Motion usage in scene components |
| Filter button styling | Region buttons in `Scene3Map.tsx` |
| Z-index layering | Current `z-[1000]` on title/stats overlays |

---

## Accessibility

- [ ] `aria-label` on map container describing interactive state
- [ ] Announce state changes to screen readers (`aria-live` region)
- [ ] Scene nav links are focusable and keyboard-accessible
- [ ] ESC key documented (though not visually advertised)
- [ ] Touch targets meet 44x44px minimum
- [ ] Focus management: return focus appropriately when exiting active state

---

## Design Decisions

| Question | Decision |
|----------|----------|
| Hint persistence | Show every session (no localStorage) — may revisit later |
| Zoom bounds | Yes — min: 4 (continental), max: 16 (street-level context) |
| Zoom buttons | Yes on desktop, hidden on mobile (pinch-to-zoom is native) |
| Mobile prompt | Revisit in Phase 4 — start with same hint, adjust if testing shows issues |

---

## Zoom Bounds & Controls

### Zoom Limits
```typescript
const ZOOM_BOUNDS = {
  min: 4,   // Continental US (matches "All" region view)
  max: 16,  // Street-level with context (venues blocks apart distinguishable)
}
```

**Rationale:**
- Min 4: Prevents zooming out to see entire world (pointless for this dataset)
- Max 16: Allows separating venues that are blocks apart without going absurdly close

### Zoom Buttons (Desktop Only)

**Position:** Bottom-right of map container, above Leaflet attribution
**Appearance:** Match region filter button styling (`bg-gray-800`, rounded)
**Visibility:** Hidden on mobile (`hidden md:flex`)

```
┌─────┐
│  +  │
├─────┤
│  −  │
└─────┘
```

**Styling:**
- `w-8 h-8` per button
- `bg-gray-800 hover:bg-gray-700`
- `text-gray-400 hover:text-white`
- Subtle border or shadow for definition against map
- Vertical stack with small gap

**Behavior:**
- Only visible when `isMapActive === true`
- Click triggers `map.zoomIn()` / `map.zoomOut()`
- Respects zoom bounds (buttons disable at min/max)

### Leaflet Configuration
```typescript
// In map initialization
L.map(mapRef.current, {
  // ... existing config
  minZoom: ZOOM_BOUNDS.min,
  maxZoom: ZOOM_BOUNDS.max,
})
```

---

## Open Questions

- [ ] On mobile, should there be a more prominent overlay prompt since there's no hover discovery? (Revisit in Phase 4)

---

## Success Criteria

1. User can scroll through scenes normally (locked state)
2. User can click map to enable zoom/pan
3. User can zoom into LA cluster and distinguish individual venues
4. User can click markers for popups in both states
5. User can exit via ESC or scene nav links
6. Scene navigation is never "stuck" — user can always progress
7. Works on desktop (mouse) and mobile (touch)
