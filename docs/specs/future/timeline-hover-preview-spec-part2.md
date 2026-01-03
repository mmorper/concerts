# Timeline Hover Preview — Part 2: Interaction & Animation

**Continues from:** Part 1 (Visual Design & Content)

---

## Interaction Model

### Core Concept: Persistent Frame with Crossfade

Rather than opening and closing separate popups for each year dot, a **single popup frame** persists throughout a hover session. As the user moves between dots, the content crossfades while the frame slides to track the active dot.

This creates a "scrubbing through time" experience — fluid exploration rather than discrete open/close actions.

### Session Definition

A "hover session" begins when the cursor enters any year dot and ends when the cursor leaves ALL dots for longer than the linger duration.

```
Session Start: cursor enters first dot
Session Active: cursor moves between dots (frame follows)
Session End: cursor leaves all dots + linger timeout expires
```

---

## Timing Parameters

### Entry Delay

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `HOVER_DELAY` | 120ms | Prevents flicker when cursor passes over dots quickly |

The popup does NOT appear immediately on hover. The cursor must remain over a dot for 120ms before the popup renders. This prevents visual noise when users are simply moving their mouse across the timeline.

```typescript
const HOVER_DELAY = 120; // ms

let hoverTimer: number | null = null;

function onDotEnter(year: number) {
  // Clear any pending timer
  if (hoverTimer) clearTimeout(hoverTimer);
  
  // Start new timer
  hoverTimer = setTimeout(() => {
    showPopup(year);
  }, HOVER_DELAY);
}

function onDotLeave() {
  // Cancel if user leaves before delay completes
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}
```

### Linger Duration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `LINGER_DURATION` | 300ms | Gives users time to read; smooth exit |

When the cursor leaves a dot, the popup remains visible for 300ms before fading out. This:
- Allows users to finish reading
- Provides a buffer for moving to adjacent dots
- Creates a gentler exit experience

```typescript
const LINGER_DURATION = 300; // ms

let lingerTimer: number | null = null;

function onDotLeave() {
  // Don't start linger if we're in crossfade to another dot
  if (isTransitioningToAnotherDot) return;
  
  lingerTimer = setTimeout(() => {
    hidePopup();
  }, LINGER_DURATION);
}

function onDotEnter(year: number) {
  // Cancel linger if entering a new dot
  if (lingerTimer) {
    clearTimeout(lingerTimer);
    lingerTimer = null;
  }
  // ... show/transition popup
}
```

### Animation Durations

| Animation | Duration | Easing |
|-----------|----------|--------|
| Entry (fade + scale) | 200ms | `ease-out` |
| Exit (fade) | 200ms | `ease-in` |
| Crossfade (content swap) | 180ms | `ease-in-out` |
| Position slide | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Parallax response | 0ms (immediate) | Linear |

---

## Popup Positioning

### Above vs Below

The popup positions itself **above or below** the dot based on the first dot hovered in a session:

```typescript
function getInitialPosition(yearIndex: number): 'above' | 'below' {
  // Odd index = above, Even index = below
  return yearIndex % 2 === 0 ? 'below' : 'above';
}
```

**Session persistence:** Once a session starts, the popup stays on that side (above OR below) for the entire session. It only recalculates when starting a new session.

This avoids the "bouncing" effect that would occur if the popup alternated sides while moving between dots.

### Vertical Offset

| Position | Offset from Dot Center |
|----------|------------------------|
| Above | `dot.cy - dotRadius - 12px - popupHeight` |
| Below | `dot.cy + dotRadius + 12px` |

The 12px gap provides breathing room between the dot and popup, plus space for the arrow pointer.

### Horizontal Centering

The popup centers horizontally on the active dot:

```typescript
const popupX = dot.cx - (POPUP_WIDTH / 2);
```

### Edge Clamping

Prevent the popup from extending beyond the timeline container:

```typescript
const EDGE_PADDING = 16; // px from container edge

function clampPopupX(idealX: number, containerWidth: number): number {
  const minX = EDGE_PADDING;
  const maxX = containerWidth - POPUP_WIDTH - EDGE_PADDING;
  return Math.max(minX, Math.min(idealX, maxX));
}
```

When clamped, the arrow pointer should still point to the dot center (offset from popup center).

---

## Entry Animation

When the popup first appears (session start):

### Animation Sequence

1. **Initial state:**
   - `opacity: 0`
   - `transform: scale(0.95) translateY(8px)` (if above dot)
   - `transform: scale(0.95) translateY(-8px)` (if below dot)

2. **Final state:**
   - `opacity: 1`
   - `transform: scale(1) translateY(0)`

3. **Timing:** 200ms ease-out

### CSS Implementation

```css
.popup-enter {
  opacity: 0;
  transform: scale(0.95) translateY(var(--entry-offset));
}

.popup-enter-active {
  opacity: 1;
  transform: scale(1) translateY(0);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

/* Above dot: slides down into place */
.popup-above {
  --entry-offset: 8px;
}

/* Below dot: slides up into place */
.popup-below {
  --entry-offset: -8px;
}
```

### Framer Motion Implementation

```tsx
<motion.div
  initial={{ 
    opacity: 0, 
    scale: 0.95, 
    y: position === 'above' ? 8 : -8 
  }}
  animate={{ 
    opacity: 1, 
    scale: 1, 
    y: 0 
  }}
  exit={{ 
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' }
  }}
  transition={{ 
    duration: 0.2, 
    ease: 'easeOut' 
  }}
>
  {/* Popup content */}
</motion.div>
```

---

## Exit Animation

When the session ends (cursor leaves all dots + linger expires):

### Animation Sequence

1. **Starting state:** Current visible state
2. **Final state:** `opacity: 0`
3. **Timing:** 200ms ease-in

The exit is simpler than entry — just a fade, no scale or position change. This feels natural (things appearing are more "eventful" than things disappearing).

---

## Crossfade Behavior

When moving between dots during an active session:

### What Changes

| Element | Behavior |
|---------|----------|
| **Image** | Crossfade to new artist |
| **Artist name** | Crossfade to new text |
| **Venue** | Crossfade to new text |
| **"+ X more"** | Crossfade (or fade out if single concert) |
| **Year · count** | Crossfade to new values |
| **Frame position** | Slides horizontally to new dot |
| **Frame vertical** | Stays fixed (above or below) |

### Crossfade Timing

```
T+0ms:     Old content starts fading out
T+90ms:    Old content fully faded (opacity: 0)
           New content starts fading in
T+180ms:   New content fully visible (opacity: 1)
```

This 180ms crossfade (90ms out + 90ms in) is fast enough to feel responsive but slow enough to register as a transition rather than a pop.

### Position Slide Timing

The frame slides to the new dot position over 250ms with a smooth easing curve:

```css
.popup-frame {
  transition: left 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

The position slide and content crossfade happen simultaneously, creating a cohesive "following" motion.

### Implementation Pattern

```tsx
// State
const [activeYear, setActiveYear] = useState<number | null>(null);
const [isTransitioning, setIsTransitioning] = useState(false);

// Content for current year
const popupContent = useMemo(() => {
  if (!activeYear) return null;
  return computePopupContent(activeYear, concerts, metadata);
}, [activeYear, concerts, metadata]);

// Render with AnimatePresence for crossfade
<div 
  className="popup-frame"
  style={{ left: getPopupX(activeYear) }}
>
  <AnimatePresence mode="wait">
    <motion.div
      key={activeYear} // Key change triggers transition
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.09 }}
    >
      <PopupContent {...popupContent} />
    </motion.div>
  </AnimatePresence>
</div>
```

---

## Parallax Effect

### Concept

As the cursor moves within the popup bounds, the artist image shifts slightly in the **opposite direction**, creating a subtle depth effect.

### Parameters

| Parameter | Value |
|-----------|-------|
| Max shift | 6px in any direction |
| Response | Immediate (no easing/delay) |
| Anchor | Image center |

### Calculation

```typescript
const PARALLAX_INTENSITY = 6; // max pixels of shift

function calculateParallax(
  cursorX: number, 
  cursorY: number, 
  popupRect: DOMRect
): { x: number; y: number } {
  // Calculate cursor position relative to popup center (0 to 1 range)
  const centerX = popupRect.left + popupRect.width / 2;
  const centerY = popupRect.top + popupRect.height / 2;
  
  // Normalize to -1 to 1 range
  const normalizedX = (cursorX - centerX) / (popupRect.width / 2);
  const normalizedY = (cursorY - centerY) / (popupRect.height / 2);
  
  // Clamp to bounds
  const clampedX = Math.max(-1, Math.min(1, normalizedX));
  const clampedY = Math.max(-1, Math.min(1, normalizedY));
  
  // Invert direction (image moves opposite to cursor)
  return {
    x: -clampedX * PARALLAX_INTENSITY,
    y: -clampedY * PARALLAX_INTENSITY
  };
}
```

### Application

```tsx
const [parallax, setParallax] = useState({ x: 0, y: 0 });

function onPopupMouseMove(e: React.MouseEvent) {
  const rect = popupRef.current?.getBoundingClientRect();
  if (!rect) return;
  
  setParallax(calculateParallax(e.clientX, e.clientY, rect));
}

// In render:
<div 
  className="image-container"
  onMouseMove={onPopupMouseMove}
  onMouseLeave={() => setParallax({ x: 0, y: 0 })}
>
  <img
    src={imageUrl}
    style={{
      transform: `translate(${parallax.x}px, ${parallax.y}px) scale(1.1)`
    }}
  />
</div>
```

### Image Scaling

The image is scaled to 110% (`scale(1.1)`) so that parallax movement doesn't expose edges:

```
Container: 188px × 140px
Image actual: ~207px × 154px (scaled up)
Parallax range: ±6px
Safety margin: ~3.5px on each side ✓
```

### Reduced Motion

If `prefers-reduced-motion: reduce`, disable parallax entirely:

```typescript
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// Skip parallax calculation if reduced motion preferred
if (prefersReducedMotion) {
  return { x: 0, y: 0 };
}
```

---

## Click Behavior

### Current State (Remove)

Currently, clicking a year dot opens a modal with all concerts from that year. **This functionality will be removed** as part of this feature.

### New Behavior

Clicking a dot does nothing additional. The hover preview IS the interaction.

**Rationale:** The popup serves as a quick preview. Future iterations may add a click-to-expand into a full modal, but for this implementation, hover is the complete interaction.

### Implementation

Remove the click handler from year dots:

```typescript
// BEFORE
touchTarget.on('click', () => {
  setSelectedYear(year);
});

// AFTER
// No click handler — or optionally:
touchTarget.on('click', () => {
  // Intentionally empty — hover preview is primary interaction
  // Future: could expand to full modal view
});
```

Also remove:
- `selectedYear` state
- `selectedYearConcerts` derived state
- The entire modal `<AnimatePresence>` block

---

## State Management

### Required State

```typescript
interface TimelineHoverState {
  // Session state
  isSessionActive: boolean;
  sessionPosition: 'above' | 'below' | null;
  
  // Active dot
  activeYear: number | null;
  activeDotPosition: { x: number; y: number } | null;
  
  // Popup content (derived)
  featuredConcert: Concert | null;
  imageUrl: string | null;
  additionalCount: number;
  totalShows: number;
  
  // Animation state
  isEntering: boolean;
  isExiting: boolean;
  isTransitioning: boolean;
  
  // Parallax
  parallaxOffset: { x: number; y: number };
}
```

### Hook Structure

```typescript
function useTimelineHover(
  concerts: Concert[],
  metadata: Record<string, ArtistMetadata>,
  yearPositions: Map<number, { x: number; y: number; radius: number }>
) {
  const [state, dispatch] = useReducer(hoverReducer, initialState);
  
  const handlers = useMemo(() => ({
    onDotEnter: (year: number) => { /* ... */ },
    onDotLeave: () => { /* ... */ },
    onPopupMouseMove: (e: MouseEvent) => { /* ... */ },
    onPopupMouseLeave: () => { /* ... */ },
  }), [/* deps */]);
  
  return { state, handlers };
}
```

---

## Event Flow Diagram

```
User hovers dot (1997)
        │
        ▼
┌─────────────────────┐
│ Start 120ms timer   │
└─────────────────────┘
        │
        ▼
   Timer completes?
     /        \
   Yes         No (left dot early)
    │           │
    ▼           ▼
┌──────────┐  ┌──────────┐
│ Show     │  │ Cancel   │
│ popup    │  │ timer    │
│ (entry   │  │ (no      │
│ anim)    │  │ action)  │
└──────────┘  └──────────┘
    │
    ▼
User moves to dot (1998)
        │
        ▼
┌─────────────────────┐
│ Cancel linger timer │
│ Crossfade content   │
│ Slide frame to 1998 │
└─────────────────────┘
        │
        ▼
User leaves all dots
        │
        ▼
┌─────────────────────┐
│ Start 300ms linger  │
└─────────────────────┘
        │
        ▼
   Linger completes?
     /        \
   Yes         No (entered new dot)
    │           │
    ▼           ▼
┌──────────┐  ┌──────────┐
│ Hide     │  │ Cancel   │
│ popup    │  │ linger,  │
│ (exit    │  │ continue │
│ anim)    │  │ session  │
└──────────┘  └──────────┘
```

---

## Edge Cases

### Rapid Movement

If user moves cursor across timeline very quickly:
- Hover delay (120ms) prevents any popup from appearing
- No visual noise or flicker
- User must pause on a dot to see preview

### Single Concert Year

- No "+ X more" line appears
- Layout adjusts (less total height)
- All other behavior identical

### Year with No Images

- `selectFeaturedArtist()` returns `null`
- No popup renders for that dot
- Dot retains normal hover state (scale + glow)

### First/Last Dots (Edge Clamping)

- Popup horizontally clamped to stay within container
- Arrow pointer offset adjusts to still point at dot
- No visual breaking at edges

### Session Interruption

If cursor leaves the timeline area entirely (e.g., moves to another part of the page):
- Linger timer runs normally
- Popup fades out after 300ms
- Next hover starts fresh session (may be different above/below)

---

## Performance Considerations

### Debouncing

Parallax mouse movement is high-frequency. Use `requestAnimationFrame` to throttle:

```typescript
let rafId: number | null = null;

function onMouseMove(e: MouseEvent) {
  if (rafId) return; // Skip if RAF pending
  
  rafId = requestAnimationFrame(() => {
    updateParallax(e.clientX, e.clientY);
    rafId = null;
  });
}
```

### Memoization

- Popup content calculation should be memoized by year
- Image preloading for adjacent years (optional enhancement)

### Will-Change Hint

```css
.popup-frame {
  will-change: transform, opacity;
}

.parallax-image {
  will-change: transform;
}
```

---

## Summary: Part 2 Decisions

| Aspect | Decision |
|--------|----------|
| Hover delay | 120ms before popup appears |
| Linger duration | 300ms after leaving dot |
| Entry animation | Fade + scale (0.95→1) + Y translate, 200ms |
| Exit animation | Fade only, 200ms |
| Crossfade | 180ms (90ms out + 90ms in) |
| Position slide | 250ms with smooth easing |
| Parallax intensity | ±6px shift |
| Above/below | Determined by first dot in session, persists |
| Click behavior | Removed (hover preview is complete interaction) |
| Reduced motion | Simplified animations, no parallax |

---

## Next: Part 3 — Technical Implementation

Part 3 will cover:
- Component architecture and file structure
- D3.js integration approach
- TypeScript interfaces
- Implementation checklist for Claude Code
- Testing considerations

---

*Spec Version: 1.0*  
*Author: Claude (Lead Designer)*  
*Date: January 2026*
