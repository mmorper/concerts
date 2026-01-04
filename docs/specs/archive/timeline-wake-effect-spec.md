# Timeline Wake Effect

**Status:** Future (v1.1+)  
**Scene:** Scene1Hero (Timeline)  
**Priority:** Medium  
**Complexity:** High  

---

## Overview

An interactive wake effect for the timeline scene where moving the cursor across year circles causes concert labels to "spray" upward (artists) and downward (venues) in sequential, chronological order. Labels follow physics-based Bezier curve arcs that curve backward (trailing the cursor), with arc curvature dynamically influenced by cursor velocity.

### Visual Metaphor

Like a boat wake: fast cursor movement creates sharp, dramatic backward curves; slow movement creates gentle, vertical arcs. Labels persist long enough to be readable before fading out.

---

## User Experience

**Interaction Pattern:**
1. User moves cursor across the timeline from left to right
2. As cursor passes over each year circle, concerts spawn sequentially (chronological order within year)
3. Artist names arc upward, venue names arc downward
4. Labels follow curved paths that trail backward
5. Labels remain visible for ~2.7 seconds before fading
6. No overlapping labels - each follows a unique arc path

**Key Behaviors:**
- **Sequential spawning:** First concert leads, others follow in order
- **Velocity-responsive:** Fast cursor = dramatic curves, slow cursor = gentle arcs
- **Constant label speed:** Once spawned, labels move at fixed rate regardless of cursor speed
- **Density scaling:** Years with more concerts spawn faster (50-150ms intervals)

---

## Technical Implementation

### Core Components

**File:** `src/components/scenes/Scene1Hero.tsx`

**New State:**
```typescript
const [mousePosition, setMousePosition] = useState({ x: -1000, y: -1000 })
const [mouseVelocity, setMouseVelocity] = useState(0)
const activeLabelsRef = useRef<WakeLabel[]>([])
const spawnCountersRef = useRef<Map<number, number>>(new Map())
const lastSpawnTimesRef = useRef<Map<number, number>>(new Map())
```

**Type Definitions:**
```typescript
interface BezierCurve {
  p0: { x: number; y: number } // Start point
  p1: { x: number; y: number } // Control point 1
  p2: { x: number; y: number } // Control point 2
  p3: { x: number; y: number } // End point
}

interface LabelState {
  element: HTMLDivElement
  curve: BezierCurve
  progress: number // 0 to 1 along curve
}

interface WakeLabel {
  yearKey: number
  concertIndex: number
  artist: LabelState
  venue: LabelState
  birthTime: number
}
```

---

## Implementation Checklist

### Phase 1: Mouse Tracking & Event Handling

- [ ] Add mouse move event listener to timeline container
- [ ] Track mouse position relative to timeline SVG
- [ ] Calculate mouse velocity (deltaX between frames)
- [ ] Handle mouse leave event (reset state)
- [ ] Store previous mouse position for velocity calculation

### Phase 2: Spawn System

- [ ] Create spawn detection (check distance from cursor to each circle)
- [ ] Implement spawn counter per year (tracks next concert index to spawn)
- [ ] Calculate spawn interval based on concert count:
  - Base: 150ms between spawns
  - Formula: `Math.max(50, 150 - (concertCount * 10))`
- [ ] Spawn concerts sequentially in chronological order
- [ ] Reset spawn counters when cursor leaves circle's wake radius (100px)

### Phase 3: Bezier Curve Path Generation

- [ ] Create `createArcPath()` function with parameters:
  - `startX`, `startY`: Circle position
  - `type`: 'artist' | 'venue'
  - `cursorVelocity`: Current mouse velocity
  - `staggerIndex`: Position in sequence
  - `totalInYear`: Total concerts in year
- [ ] Calculate vertical stagger offset:
  - Formula: `(staggerIndex - totalInYear / 2) * 55`
- [ ] Calculate horizontal stagger:
  - Applied to control points: `staggerIndex * 2-3`
- [ ] Calculate arc curvature from velocity:
  - Velocity factor: `Math.min(Math.abs(cursorVelocity) / 10, 3)`
  - Backward curve: `100 + (velocityFactor * 50)` (range: 100-250px)
- [ ] Generate 4 Bezier control points:
  - **P0:** Start at circle position `(startX, startY)`
  - **P1:** Rise/fall with horizontal offset `(startX + 30 + staggerX, startY ± height * 0.6)`
  - **P2:** Peak height with backward curve `(startX - curve * 0.4 + staggerX, startY ± height * 1.1)`
  - **P3:** Trail off backward `(startX - curve + staggerX, startY ± height * 0.5)`
- [ ] Direction: Artists use negative Y direction (-1), venues positive (+1)

### Phase 4: Label Creation & DOM Management

- [ ] Create label container div (positioned absolutely)
- [ ] Create `createLabel()` function:
  - Generate div element with artist/venue class
  - Set initial position at circle coordinates
  - Apply font size: `14.4px * (1 - index/total * 0.3)`
  - Append to label container
  - Return element reference
- [ ] Color coding:
  - Artist labels: `#6366f1` (indigo)
  - Venue labels: `#ec4899` (pink)
- [ ] Font: 'Source Sans 3', weight 500

### Phase 5: Animation Loop

- [ ] Set up `requestAnimationFrame` loop
- [ ] Arc traversal speed: `0.006` per frame (~2.7 second journey)
- [ ] For each active label:
  - Increment progress along curve
  - Calculate position using cubic Bezier formula:
    ```typescript
    function getPointOnCurve(curve: BezierCurve, t: number) {
      const t2 = t * t
      const t3 = t2 * t
      const mt = 1 - t
      const mt2 = mt * mt
      const mt3 = mt2 * mt
      
      return {
        x: curve.p0.x * mt3 + 
           3 * curve.p1.x * mt2 * t + 
           3 * curve.p2.x * mt * t2 + 
           curve.p3.x * t3,
        y: curve.p0.y * mt3 + 
           3 * curve.p1.y * mt2 * t + 
           3 * curve.p2.y * mt * t2 + 
           curve.p3.y * t3
      }
    }
    ```
  - Update DOM element position
  - Apply opacity/blur based on progress
  - Remove element when progress > 1

### Phase 6: Fade & Blur Effects

- [ ] Fade in: Quick fade during first 5% of journey
  - Opacity: `progress / 0.05`
- [ ] Full visibility: 5% to 90% of journey
  - Opacity: `1.0`
- [ ] Fade out: Last 10% of journey
  - Opacity: `(1 - progress) / 0.1`
- [ ] Motion blur: Last 5% of journey
  - Blur: `(progress - 0.95) / 0.05 * 2px`

### Phase 7: Collision Prevention

- [ ] Vertical staggering: 55px spacing between labels
- [ ] Horizontal staggering: 2-3px offset per label in arc path
- [ ] Height variation: `baseHeight + abs(staggerOffset * 0.5)`
- [ ] Test with dense years (9+ concerts) to verify no overlaps

### Phase 8: Performance Optimization

- [ ] Use `useRef` for active labels array (avoid re-renders)
- [ ] Cleanup: Remove DOM elements when labels complete journey
- [ ] Reset spawn state when cursor leaves wake radius
- [ ] Consider throttling mouse move events if needed (test performance first)
- [ ] Use CSS transforms instead of left/top if performance issues arise

### Phase 9: Accessibility & Fallbacks

- [ ] Add `aria-live="polite"` region for screen readers
- [ ] Announce year when cursor enters circle (optional)
- [ ] Provide reduced-motion fallback (disable wake effect)
- [ ] Ensure keyboard navigation still works for year selection

---

## Design Specifications

### Layout
- **Wake radius:** 100px from circle center
- **Vertical stagger:** 55px between labels
- **Horizontal stagger:** 2-3px per label
- **Base arc height:** 140px ± stagger variation

### Typography
- **Font family:** 'Source Sans 3', sans-serif
- **Base size:** 14.4px
- **Weight:** 500 (medium)
- **Size variation:** First concert largest, scales down by 30% to last
- **Colors:**
  - Artists: `#6366f1` (indigo)
  - Venues: `#ec4899` (pink)

### Timing
- **Arc traversal:** 2.7 seconds (0.006 progress/frame)
- **Spawn intervals:**
  - Low density (1-3 concerts): 150ms
  - Medium density (4-7 concerts): 110-90ms  
  - High density (8+ concerts): 70-50ms
- **Fade in:** 5% of journey (~135ms)
- **Fade out:** 10% of journey (~270ms)

### Physics
- **Cursor velocity factor:** `min(abs(velocity) / 10, 3)`
- **Backward curve range:** 100-250px (velocity-dependent)
- **Arc shape:** Cubic Bezier with peak at 110% height, return to 50%

---

## Integration Points

### Existing Components
- **Scene1Hero.tsx:** Add wake effect to existing D3 timeline
- **Timeline SVG:** Use existing circle positions as spawn points
- **Concert data:** Reference `concerts` array for sequential spawning

### Data Requirements
- Access to `concerts` array with:
  - Year
  - Date (for chronological sorting within year)
  - Headliner (artist label)
  - Venue (venue label)
- Concerts must be pre-sorted by date within each year

### Style Integration
- Follow existing color palette:
  - Use indigo (`#6366f1`) for artists (matches timeline circles)
  - Use pink (`#ec4899`) for venues (matches venue scene colors)
- Match existing typography:
  - Source Sans 3 font family
  - Medium weight (500)

---

## Testing Scenarios

### Interaction Tests
- [ ] Slow cursor movement creates gentle vertical arcs
- [ ] Fast cursor movement creates dramatic backward curves
- [ ] Labels spawn sequentially (first concert leads)
- [ ] Dense years (8+ concerts) spawn rapidly without overwhelming
- [ ] Sparse years (1-3 concerts) spawn at comfortable pace
- [ ] Cursor leaving circle mid-spawn resets state cleanly

### Visual Tests
- [ ] No overlapping labels in any year
- [ ] Labels remain readable throughout journey
- [ ] Smooth fade in/out transitions
- [ ] Motion blur enhances "trailing" effect
- [ ] Artists arc upward, venues arc downward
- [ ] Color coding is clear and consistent

### Performance Tests
- [ ] Animation maintains 60fps with 10+ concurrent labels
- [ ] DOM cleanup prevents memory leaks on repeated passes
- [ ] Mouse event handling doesn't block scroll
- [ ] Works smoothly on mobile devices (touch alternative needed)

### Edge Cases
- [ ] Year with only 1 concert (no stagger needed)
- [ ] Year with 15+ concerts (maximum spawn rate)
- [ ] Rapid back-and-forth cursor movement
- [ ] Cursor re-entering circle before labels finish (re-spawn)
- [ ] Multiple years triggered simultaneously

---

## Dependencies

### Libraries (Already in Project)
- **React 18.3.1:** State management, refs, effects
- **D3.js 7.9.0:** Timeline rendering, circle positions
- **TypeScript 5.7.2:** Type safety

### New Dependencies
None - pure vanilla JS animation loop with React refs

---

## Future Enhancements (Post-MVP)

1. **Click interaction:** Click label to jump to that concert in detail view
2. **Sound effects:** Subtle "spray" sound on spawn (optional)
3. **Touch support:** Gesture-based wake for mobile
4. **Customization:** User preference for wake intensity
5. **Genre colors:** Use genre-specific colors instead of artist/venue split
6. **Particles:** Add subtle particle effects at spawn point
7. **Timeline scrubbing:** Drag to scrub through wake effect

---

## Mobile Considerations (v1.1+)

**Deferred to mobile optimization phase:**
- Touch-and-drag gesture to trigger wake
- Simplified arcs for smaller screens
- Reduced concurrent label count
- Alternative visualization (bottom sheet with concert list?)

---

## References

### Existing Patterns
- **D3 Timeline:** `Scene1Hero.tsx` - circle rendering, scales
- **Genre Colors:** `src/constants/colors.ts` - color palette
- **Animation Timing:** Follow Framer Motion timing from Artist gatefold (800ms transitions)

### Prototype
- **HTML Prototype:** `/mnt/user-data/outputs/timeline-wake-effect.html`
- Reference for final physics values and Bezier calculations

---

## Implementation Notes

### Critical Details
1. **Sequential spawning is essential** - labels must spawn in chronological order, not all at once
2. **Stagger prevents overlap** - both vertical (55px) and horizontal (2-3px) offsets required
3. **Velocity calculation** - track previous mouse X to compute deltaX for arc curvature
4. **Constant speed** - once spawned, labels traverse arc at fixed rate independent of cursor

### Common Pitfalls
- ❌ Don't spawn all concerts simultaneously (causes overlap chaos)
- ❌ Don't tie label speed to cursor speed (makes labels "stick" to slow cursor)
- ❌ Don't forget to cleanup DOM elements when labels finish
- ❌ Don't use Map for active labels (causes re-render issues, use ref)

### Performance Tips
- Use `requestAnimationFrame` instead of setInterval
- Batch DOM updates in single animation frame
- Remove completed labels from array to prevent memory growth
- Consider using CSS transforms if repositioning causes jank

---

## Success Criteria

**Must Have:**
- ✅ Labels spawn sequentially in chronological order
- ✅ No overlapping labels at any point
- ✅ Arc curvature responds to cursor velocity
- ✅ Smooth 60fps animation
- ✅ Clean fade in/out transitions
- ✅ Labels readable throughout journey

**Nice to Have:**
- Motion blur enhances trailing effect
- Spawn timing feels natural for all concert counts
- Works smoothly with rapid cursor movement
- Visual clarity maintained with 10+ concurrent labels

---

## Estimated Effort

**Development:** 8-12 hours
- Mouse tracking & spawn system: 2-3 hours
- Bezier path generation: 2-3 hours
- Animation loop & DOM updates: 2-3 hours
- Collision prevention & stagger: 1-2 hours
- Testing & refinement: 1-2 hours

**Testing:** 2-3 hours
**Documentation:** 1 hour

**Total:** 11-16 hours
