# Venues Mobile UX

**Status:** Planned
**Target Version:** TBD (Short-Term)
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** None

---

## Executive Summary

The Venue scene (Scene 2) is currently not optimized for phone viewports. The network visualization, label management, and Reset button need adjustments to provide a better experience on small screens where touch interactions, limited screen real estate, and different viewing contexts require mobile-specific considerations.

This feature addresses mobile UX pain points in the Venues scene including:
- Label visibility logic needs refinement (focus hierarchy vs. filtered view)
- Reset button positioning and accessibility on mobile
- Haptic feedback missing from node interactions
- Network visualization density issues on small viewports
- Gesture interactions that may conflict with scrolling

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Venues Mobile UX improvements for Morperhaus Concerts.

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
- Optimize Venues scene (Scene 2) network visualization for phone viewports
- Implement clear label visibility rules (focus hierarchy vs. filtered "All Venues" view)
- Reposition Reset button for better mobile accessibility
- Add haptic feedback to all node interactions
- Adjust network visualization density and layout for small screens
- Refine gesture interactions to avoid conflicts with native scrolling

**Key References:**
- Full Design Spec: docs/specs/future/venues-mobile-ux.md
- Scene Design Guide: docs/design/scene-design-guide.md
- Color Specification: docs/design/color-specification.md
- UI Patterns: docs/design/ui-component-patterns.md
- Existing Venue Scene: src/components/scenes/Scene4Bands.tsx

**Implementation Approach:**
- Window 1: Implement label visibility logic (focus hierarchy rules), add haptic feedback to all nodes
- Window 2: Reposition Reset button for mobile accessibility, optimize network visualization density
- Window 3: Test across device sizes, refine gesture interactions, final polish

**Design Philosophy:**
Mobile users should have an equally engaging and explorable experience as desktop users, with appropriate adaptations for touch interaction and smaller viewports.

**Key Design Details:**
- Label rules: Focus hierarchy shows all related labels; "All Venues" view shows only venue labels
- Reset button: Move from top-right to bottom-center or accessible thumb zone
- Haptic feedback: 10ms vibration on all node taps
- Reduced network density for mobile viewports
- Clear visual hierarchy even with reduced screen space
- Gesture interactions that don't interfere with page scrolling

**Files to Create:**
- None (modifications only)

**Files to Modify:**
- src/components/scenes/Scene4Bands.tsx (~80-120 LOC changes)
  - Implement label visibility rules (focus hierarchy vs. filtered view)
  - Add haptic feedback to node tap handlers
  - Reposition Reset button for mobile
  - Add mobile-specific responsive breakpoints
  - Adjust node sizing scales for small viewports
  - Optimize network density for mobile

Let's start with Window 1. Should I begin by implementing the label visibility logic and adding haptic feedback?
```

---

## Design Philosophy

The Venues scene is a complex interactive visualization that thrives on exploration and discovery. On mobile, users should still feel empowered to explore the network, tap nodes, and understand venue relationships — but with interactions and layouts optimized for touch and limited screen space.

Key principles:
- **Touch-first design:** All interactive elements must meet minimum touch target size guidelines
- **Simplified when needed:** Show less information upfront on mobile, reveal progressively through interaction
- **Ergonomic controls:** Place buttons and controls where thumbs naturally rest
- **Gesture clarity:** Ensure network dragging doesn't conflict with page scrolling

---

## Visual Design

### Mobile Breakpoints

**Target viewports:**
- Small phones: 320px - 390px width
- Standard phones: 391px - 428px width
- Large phones / phablets: 429px - 767px width

### Current Desktop Layout

```
┌─────────────────────────────────────────┐
│           Scene 2: Venues               │
│                                         │
│     ┌─────────────────────┐            │
│     │    The Venues       │ (header)   │
│     │  10 most-visited    │            │
│     │  [Top 10] [All]     │ (buttons)  │
│     └─────────────────────┘            │
│                                         │
│          ○                              │
│       ○     ○                           │
│    ○    ○    ○   (network graph)       │
│       ○     ○                           │
│          ○                              │
│                                         │
│   Click to focus · Drag to explore     │
│                                         │
└─────────────────────────────────────────┘
```

### Proposed Mobile Layout

```
┌───────────────────┐
│   The Venues      │ (header - smaller)
│ 10 most-visited   │
│                   │
│   [Top 10] [All]  │ (buttons - stacked or full-width)
│                   │
│        ○          │
│     ○     ○       │
│   ○   ○   ○       │ (network - denser, less padding)
│     ○     ○       │
│        ○          │
│                   │
│ Tap · Drag        │ (shorter label)
│                   │
└───────────────────┘
```

---

## Interaction Design

### Touch Target Sizing

**Current implementation:**
- Invisible touch targets: `Math.max(getNodeSize(d), 22)` = 22px radius (44px diameter) ✅
- Buttons: `min-h-[44px]` ✅

**Status:** Touch targets currently meet guidelines. Verify real-world usability on devices.

### Reset Button Positioning

**Current (Desktop):**
- Positioned at top-right: `absolute top-32 right-8`
- Appears when `focusedNodeId` is set
- Requires reaching to top-right corner on mobile

**Proposed (Mobile):**

Move Reset button to bottom-center for better thumb accessibility on mobile:

```jsx
// Add mobile detection
const isMobile = useMemo(() => dimensions.width < 768, [dimensions.width])

// Update Reset button positioning
{focusedNodeId && (
  <motion.button
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    onClick={() => setFocusedNodeId(null)}
    className={`absolute z-20 px-6 py-3 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-lg font-sans text-sm font-medium hover:bg-white/20 transition-all duration-200 min-h-[44px] ${
      isMobile
        ? 'bottom-24 left-1/2 -translate-x-1/2' // Center bottom on mobile
        : 'top-32 right-8' // Top right on desktop
    }`}
  >
    Reset View
  </motion.button>
)}
```

**Rationale:** Bottom-center is within natural thumb reach on phones, making it easier to reset the view without hand repositioning.

### Network Visualization Adjustments

**Current behavior:**
- All viewports use same node size scales
- Same radial force and collision detection
- Same exclusion zone dimensions

**Proposed mobile optimizations:**

1. **Smaller node size ranges on mobile:**
```typescript
const isMobile = dimensions.width < 768

const venueSizeScale = d3.scaleSqrt()
  .domain([1, Math.max(...nodes.filter(n => n.type === 'venue').map(n => n.count))])
  .range(viewMode === 'all'
    ? (isMobile ? [6, 30] : [8, 45])
    : (isMobile ? [15, 30] : [20, 40])
  )

const bandSizeScale = d3.scaleSqrt()
  .domain([1, Math.max(...nodes.filter(n => n.type !== 'venue').map(n => n.count))])
  .range(isMobile ? [5, 12] : [6, 16])
```

2. **Adjust exclusion zone for mobile header:**
```typescript
const exclusionZone = isMobile
  ? createExclusionZone(width / 2, 140, 180, 140) // Smaller zone
  : createExclusionZone(width / 2, 180, 280, 180) // Current
```

3. **Reduce collision padding on mobile:**
```typescript
.force('collision', d3.forceCollide().radius((d: any) => {
  const baseSize = getNodeSize(d)
  const touchRadius = Math.max(baseSize, 22)
  const padding = isMobile ? 10 : 15
  return touchRadius + padding
}))
```

4. **Adjust label font sizes:**
```typescript
// Venue labels
.attr('font-size', isMobile ? '10px' : '11px')

// Band labels
.attr('font-size', d => {
  const isHighlighted = (focusedNodeId && relatedNodes.has(d.id)) ||
                        (viewMode === 'all' && d.parentVenue && expandedVenues.has(d.parentVenue))
  if (isMobile) return isHighlighted ? '9px' : '8px'
  return isHighlighted ? '10px' : '9px'
})
```

### Label Visibility Rules

**New rules to implement:**

1. **When a node has focus** (via `focusedNodeId`):
   - Show labels for the focused node AND all its related nodes (parent venue, child headliners/openers)
   - Use current `relatedNodes` logic from `getRelatedNodes()`
   - This creates a "focus hierarchy" visualization

2. **In "All Venues" view** (when `viewMode === 'all'` AND no focus):
   - Show labels ONLY for venue nodes (root nodes)
   - Hide all headliner and opener labels by default
   - This prevents label clutter with 77 venues displayed

3. **In "Top 10" view** (when `viewMode === 'top10'`):
   - Current behavior is acceptable (all venues expanded with labels)
   - May need mobile-specific truncation adjustments

**Implementation approach:**

```typescript
// Label visibility logic for band nodes (headliners/openers)
node.filter(d => {
  if (d.type === 'venue') return false

  // RULE 1: Show labels for focused hierarchy
  if (focusedNodeId && relatedNodes.has(d.id)) return true

  // RULE 2: In "All Venues" mode without focus, hide all band labels
  if (viewMode === 'all' && !focusedNodeId) return false

  // RULE 3: Show labels for expanded venues in "all" mode (when focused)
  if (viewMode === 'all' && d.parentVenue && expandedVenues.has(d.parentVenue)) return true

  return false
})
```

**Label truncation (mobile-specific):**

- Venue names: 15 char limit → 12 + "..." (mobile), 20 char limit → 17 + "..." (desktop)
- Band names: 14 char limit → 11 + "..." (mobile), 18 char limit → 15 + "..." (desktop)

### Subtitle Text

**Current:**
```
"Click to focus · Drag to explore"
```

**Proposed mobile:**
```
"Tap to focus · Drag"
```

Or hide entirely on very small screens (< 375px).

---

## Accessibility

### Keyboard Navigation

Not affected by mobile changes. Current implementation has no keyboard support (network is mouse/touch-driven).

### Screen Readers

Ensure tooltips (via `<title>` elements) are still present and descriptive.

### Haptic Feedback

**Decision:** Add haptic feedback to all node tap interactions.

**Implementation:**

```typescript
// Add to node click handler
.on('click', function(_event, d) {
  // Add haptic feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(10) // Light 10ms tap
  }

  // Existing click logic...
  if (viewMode === 'all' && d.type === 'venue') {
    // ... venue expand/collapse logic
  }

  // ... focus toggle logic
})
```

**Rationale:** Haptic feedback provides tactile confirmation of node interactions, especially important on mobile where visual hover states aren't available.

---

## Technical Implementation

### Component Architecture

**File:** `src/components/scenes/Scene4Bands.tsx`

**Key changes:**
1. Add mobile detection via dimensions state (already tracked via ResizeObserver)
2. Create responsive helper functions for sizing/spacing
3. Apply mobile-specific scales and layout adjustments
4. Update button layout with responsive classes

### State Management

**Existing state:**
```typescript
const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
```

**Add mobile flag:**
```typescript
const isMobile = useMemo(() => dimensions.width < 768, [dimensions.width])
```

### Responsive Utilities

```typescript
// Helper function to get responsive values
const getResponsiveValue = <T,>(mobile: T, desktop: T): T => {
  return isMobile ? mobile : desktop
}
```

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Test on iPhone SE (375px width) - smallest common viewport
- [ ] Test on iPhone 12/13/14 (390px width) - standard size
- [ ] Test on iPhone 14 Pro Max (428px width) - large phone
- [ ] Test on Android Chrome (various sizes)
- [ ] Verify touch targets are easily tappable (no mis-taps)
- [ ] Check button layout doesn't overflow or wrap awkwardly
- [ ] Ensure network nodes don't overlap with header
- [ ] Test "All Venues" mode - verify density is manageable
- [ ] Test node focus/spotlight effect on mobile
- [ ] Verify drag interactions don't trigger page scroll
- [ ] Check label truncation works correctly
- [ ] Test landscape orientation on phones
- [ ] Verify no console errors on mobile devices
- [ ] Test cross-scene navigation from other scenes (deep links)

### Test Data

**Known venues with long names:**
- "The Greek Theatre" (normal)
- "Hollywood Palladium" (long-ish)
- Test truncation edge cases

**Test scenarios:**
- Top 10 mode with all venues visible
- All Venues mode (77 venues) - verify performance and density
- Focus on venue with many children (headliners/openers)
- Expand venue in "All" mode - check centering
- Switch between modes on mobile

---

## Implementation Plan

### Phase 1: Label Visibility & Haptic Feedback (Window 1)

**Files to Modify:**
- `src/components/scenes/Scene4Bands.tsx`

**Tasks:**
1. Add mobile detection: `isMobile` computed value based on `dimensions.width < 768`
2. Implement label visibility rules:
   - Focus hierarchy: Show focused node + related nodes
   - "All Venues" mode: Show only venue labels
3. Add haptic feedback to all node tap interactions (10ms vibration)
4. Implement responsive label truncation (mobile vs. desktop character limits)

**Acceptance Criteria:**
- [ ] Mobile detection working correctly
- [ ] Labels follow new visibility rules (focus hierarchy vs. filtered view)
- [ ] Haptic feedback fires on all node taps
- [ ] Label truncation adjusts based on viewport size
- [ ] No console errors

### Phase 2: Reset Button & Network Optimization (Window 2)

**Files to Modify:**
- `src/components/scenes/Scene4Bands.tsx`

**Tasks:**
1. Reposition Reset button for mobile (bottom-center vs. top-right)
2. Implement mobile-specific node size scales
3. Adjust exclusion zone dimensions for mobile header
4. Reduce collision padding on mobile
5. Update label font sizes for mobile viewports
6. Test network performance on mobile devices

**Acceptance Criteria:**
- [ ] Reset button positioned at bottom-center on mobile, top-right on desktop
- [ ] Network displays clearly on small viewports
- [ ] Labels are readable and don't overlap excessively
- [ ] Performance is smooth on mid-range mobile devices
- [ ] Exclusion zone prevents nodes from overlapping header

### Phase 3: Polish & Cross-Device Testing (Window 3)

**Files to Modify:**
- `src/components/scenes/Scene4Bands.tsx`

**Tasks:**
1. Update subtitle text for mobile ("Tap to focus" instead of "Click to focus")
2. Test Reset button positioning on various devices (thumb accessibility)
3. Test label visibility rules across all interaction modes
4. Verify haptic feedback on iOS and Android
5. Test network density and performance across device sizes
6. Final cross-device testing with all scenarios

**Acceptance Criteria:**
- [ ] UI text is appropriate for mobile ("Tap" not "Click")
- [ ] Reset button is easily reachable with thumb on mobile
- [ ] Label visibility rules work correctly in all modes
- [ ] Haptic feedback works on supported devices
- [ ] All test scenarios pass on target devices
- [ ] No layout overflow or awkward wrapping

---

## Future Enhancements

### Simplified "Mobile View Mode"

Consider adding a third view mode specifically for mobile:
- Show only top 5 venues (not 10) by default
- Larger nodes, more spacing
- One-tap to expand venue details (not network expansion)

### Swipe Gestures

Add swipe gestures to switch between view modes:
- Swipe left/right to toggle between Top 10 ↔ All Venues

### Performance Optimization

If performance becomes an issue with 77 venues:
- Implement virtualization or node culling for off-screen nodes
- Reduce force simulation iterations on mobile
- Use `requestIdleCallback` for non-critical updates

### Landscape Mode

Add specific layout for landscape phone orientation:
- Horizontal button layout even on mobile
- Wider exclusion zone to account for different aspect ratio

---

## Decisions Made

1. ✅ **Top 10/All Venues buttons:** No changes needed - current UX is acceptable
2. ✅ **Reset button:** Reposition to bottom-center on mobile for better thumb accessibility
3. ✅ **Label visibility:** Implement clear rules:
   - Focus hierarchy: Show focused node + all related nodes' labels
   - "All Venues" view: Show only venue labels (root nodes)
4. ✅ **Haptic feedback:** Add 10ms vibration to all node tap interactions
5. ✅ **Subtitle text:** Shorten to mobile-appropriate text
6. ⏳ **Simplified mobile mode:** Open to recommendations if implementation reveals need

---

## Revision History

- **2026-01-08:** Initial specification created
- **Version:** 1.0.0
- **Author:** Claude Code
- **Status:** Planned
