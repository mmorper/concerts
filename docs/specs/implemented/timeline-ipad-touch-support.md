# Timeline iPad Touch Support Specification

## Overview

Enhance the Timeline Year Filter card stack feature to support touch interactions on iPad and other tablet devices. This includes implementing a two-tap pattern for card selection, fixing dot click detection on touch devices, and ensuring consistent haptic feedback across all interactions.

## Current State

### What Works
- ✅ Feature enabled on viewports ≥768px (includes iPad)
- ✅ Timeline dots show hover preview on touch (touchstart/touchmove)
- ✅ Cards render and animate correctly on iPad
- ✅ Keyboard navigation and accessibility features present

### What Doesn't Work
- ❌ **Dot clicks don't expand card stack on iPad** (D3 `.on('click')` doesn't fire reliably on touch)
- ❌ **Card hover effects require mouse** (no touch handlers on cards)
- ❌ **No haptic feedback wired up** for card interactions

## User Stories

### Story 1: Browse Concerts by Year (iPad)
**As a user** viewing the Timeline scene on iPad, **I want to** tap a year dot to see all concerts from that year as stacked cards, **so that** I can quickly browse shows without a mouse.

**Acceptance Criteria:**
- Tapping a dot expands the card stack
- Tapping the same dot again collapses the stack
- Haptic feedback confirms the action

### Story 2: Focus and Select Cards (iPad)
**As a user** with cards expanded on iPad, **I want to** tap a card to preview it and tap again to navigate, **so that** I can explore options before committing to navigation.

**Acceptance Criteria:**
- First tap brings card to front with visual focus
- Second tap on same card navigates to artist scene
- Tapping a different card switches focus
- Haptic feedback confirms each interaction

## Interaction Specifications

### Timeline Dots (Touch Behavior)

#### Current Behavior
| Interaction | Result |
|------------|--------|
| Touch dot | Shows hover preview popup |
| Drag across dots | Preview updates continuously |
| Lift finger | Preview lingers for 300ms |
| Click dot (desktop) | Expands card stack |

#### New Behavior (iPad/Touch Devices ≥768px)
| Interaction | Result | Haptic |
|------------|--------|---------|
| Touch dot | Shows hover preview popup | None (existing) |
| Tap dot | Expands card stack | `medium()` |
| Tap same dot again | Collapses card stack | `light()` |
| Tap outside | Collapses card stack | `light()` |

**Implementation Note:** Add explicit `touchend` handler to dot elements on tablet-sized touch devices, as D3's `.on('click')` doesn't fire reliably on touch.

### Stacked Cards (Touch Behavior)

#### Desktop (Mouse)
| Interaction | Result |
|------------|--------|
| Hover card | Brings to front (scale 1.05×, z-index 999) |
| Click card | Navigate to artist scene |

#### iPad/Touch Devices (New)
| Interaction | Result | Haptic | Visual Feedback |
|------------|--------|---------|-----------------|
| **First tap** on card | Brings card to front (focus state) | `light()` | Scale 1.05×, elevated shadow, z-index 999 |
| **Second tap** on same card | Navigate to artist scene | `medium()` | - |
| **Tap different card** | Switches focus to new card | `light()` | Previous card returns to stack, new card comes to front |
| **Tap outside** | Dismisses card stack | `light()` | All cards collapse |

### Focus State Persistence

**Behavior:** Focused card **stays focused** until:
- User taps a different card (focus switches)
- User dismisses the card stack (tap outside, tap dot, press Escape)
- User navigates to artist scene (second tap on focused card)

**State Management:**
```typescript
interface CardFocusState {
  focusedCardIndex: number | null  // Which card is currently focused via touch
  lastTapTarget: number | null     // Track last tapped card for two-tap detection
  lastTapTime: number               // Timestamp for tap timeout
}
```

### Dismissal Methods

Users can collapse the expanded card stack via:
- ✅ Tap outside the card stack (existing `handleClickOutside`)
- ✅ Tap the year dot again (existing toggle logic)
- ✅ Press Escape key (existing keyboard handler)
- ❌ Swipe gestures (out of scope)
- ❌ Pinch gestures (out of scope)
- ❌ Dedicated close button (out of scope)

## Technical Implementation

### 1. Device Detection Strategy

Use **feature detection** (not user agent sniffing) to identify touch-capable devices:

```typescript
/**
 * Detect if device has touch capability
 */
const isTouchDevice = (): boolean => {
  return typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

/**
 * Check if device is tablet-sized or larger
 */
const isTabletOrLarger = (): boolean => {
  return typeof window !== 'undefined' && window.innerWidth >= 768
}

/**
 * Feature should be enabled on touch tablets
 */
const shouldEnableCardStack = isTabletOrLarger()
const shouldUseTouchHandlers = isTouchDevice() && isTabletOrLarger()
```

**Rationale:**
- Works across all touch tablets (iPad, Android tablets, Surface, etc.)
- Doesn't rely on fragile user agent detection
- Gracefully handles hybrid devices (touch laptops)

### 2. Fix Dot Click Detection (Scene1Hero.tsx)

**Problem:** D3's `.on('click')` doesn't fire reliably on touch devices.

**Solution:** Add explicit `touchend` handler for dots on touch tablets:

```typescript
// After existing .on('click') handler (line ~333)
.on('click', function(event: MouseEvent) {
  // Existing desktop click logic
  event.stopPropagation()
  handleYearClick(year)
  haptics.medium()
})

// Add new touch handler for iPad
if (isTouchDevice && isTabletOrLarger) {
  dotElement.on('touchend', function(event: TouchEvent) {
    // Prevent synthetic click
    event.preventDefault()
    event.stopPropagation()

    // Don't expand if user was dragging (scrubbing timeline)
    if (isTouchingRef.current && lastTouchTargetRef.current === this) {
      handleYearClick(year)
      haptics.medium()
    }
  })
}
```

**Edge Case Handling:**
- Only fire on `touchend` if user hasn't dragged away from dot
- Prevent synthetic click event to avoid double-firing
- Reuse existing `isTouchingRef` and `lastTouchTargetRef` state

### 3. Add Touch Handlers to Cards (StackedCard.tsx)

**Current handlers:**
```typescript
// lines 65-67
onMouseEnter={onHover}
onMouseLeave={onHoverEnd}
onClick={onClick}
```

**New implementation:**

```typescript
import { useState, useCallback } from 'react'
import { haptics } from '@/utils/haptics'

export function StackedCard({ /* ... */ }: StackedCardProps) {
  // Track if this card has been tapped (focused) on touch devices
  const [isTouchFocused, setIsTouchFocused] = useState(false)
  const [lastTapTime, setLastTapTime] = useState(0)

  // Detect if device supports touch
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  /**
   * Handle tap on touch devices
   * First tap: focus card
   * Second tap: navigate
   */
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isTouchDevice) return

    e.stopPropagation() // Prevent card stack dismissal

    const now = Date.now()
    const isDoubleTap = now - lastTapTime < 500 // 500ms window for "same card"

    if (!isTouchFocused || !isDoubleTap) {
      // First tap: focus this card
      setIsTouchFocused(true)
      setLastTapTime(now)
      onHover() // Bring card to front
      haptics.light()
    } else {
      // Second tap: navigate
      onClick()
      haptics.medium()
    }
  }, [isTouchDevice, isTouchFocused, lastTapTime, onHover, onClick])

  /**
   * Handle regular click on non-touch devices (desktop)
   */
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice) return // Touch devices use handleTouchEnd
    onClick()
  }, [isTouchDevice, onClick])

  /**
   * Reset focus state when card loses focus (e.g., user taps different card)
   */
  const handleHoverEnd = useCallback(() => {
    setIsTouchFocused(false)
    onHoverEnd()
  }, [onHoverEnd])

  return (
    <motion.div
      // ... existing props
      onMouseEnter={isTouchDevice ? undefined : onHover}
      onMouseLeave={isTouchDevice ? undefined : handleHoverEnd}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      // ... rest of component
    />
  )
}
```

**Key Design Decisions:**
- Use 500ms window to detect "second tap on same card"
- Don't mix mouse and touch handlers (conditional based on device capability)
- Stop propagation on `touchend` to prevent dismissal during selection
- Haptics differ between focus (`light`) and navigate (`medium`)

### 4. Update YearCardStack to Reset Focus (YearCardStack.tsx)

When card stack is dismissed, reset all cards' focus state:

```typescript
// Add new prop to pass dismissal signal to cards
interface YearCardStackProps {
  // ... existing props
  isDismissing?: boolean  // Signal that stack is collapsing
}

// In YearCardStack component
useEffect(() => {
  if (isDismissing) {
    // Cards will reset their internal isTouchFocused state
    // This happens automatically via onHoverEnd when stack collapses
  }
}, [isDismissing])
```

**Alternate approach:** Track focused card index in parent (`useYearFilter`) and pass down:

```typescript
// useYearFilter.ts
interface YearFilterState {
  selectedYear: number | null
  isExpanded: boolean
  hoveredCardIndex: number | null
  focusedCardIndex: number | null  // NEW: Track touch-focused card
}

// Reset on collapse
const collapse = useCallback(() => {
  setFilterState({
    selectedYear: null,
    isExpanded: false,
    hoveredCardIndex: null,
    focusedCardIndex: null,  // Clear focus
  })
}, [])
```

**Recommendation:** Use parent state tracking for consistency with existing `hoveredCardIndex` pattern.

### 5. Haptic Feedback Integration

Wire up haptics for all touch interactions:

| Action | Location | Haptic Pattern | Trigger |
|--------|----------|----------------|---------|
| Tap dot to expand | `Scene1Hero.tsx:348` | `medium()` | ✅ Already implemented |
| Tap dot to collapse | `Scene1Hero.tsx:348` | `light()` | Need to differentiate collapse |
| Tap card (focus) | `StackedCard.tsx` | `light()` | New handler |
| Tap card (navigate) | `StackedCard.tsx` | `medium()` | New handler |
| Tap outside | `Scene1Hero.tsx` | `light()` | Need to add |
| Press Escape | `useYearFilter.ts:118` | `light()` | Need to add |

**Updated haptic logic:**

```typescript
// Scene1Hero.tsx - Differentiate expand vs collapse
handleYearClick(year)
const wasExpanded = filterState.selectedYear === year && filterState.isExpanded
haptics[wasExpanded ? 'light' : 'medium']()

// Scene1Hero.tsx - Add haptic to click outside handler
const handleClickOutside = useCallback(() => {
  if (filterState.isExpanded) {
    handleClickOutsideBase()
    haptics.light()
  }
}, [filterState.isExpanded, handleClickOutsideBase])

// useYearFilter.ts - Add haptic to Escape handler
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && filterState.isExpanded) {
    collapse()
    haptics.light()
  }
}
```

## Visual Specifications

### Focus State (Touch-Focused Card)

A card in "touch focus" state should visually match the mouse hover state:

| Property | Default | Focused (Touch/Hover) |
|----------|---------|----------------------|
| z-index | stack position | 999 (top) |
| Scale | 1.0 | 1.05 |
| Shadow | `0 10px 40px rgba(0,0,0,0.4)` | `0 12px 48px rgba(0,0,0,0.5)` |
| Transition | - | 150ms ease-out |

**No additional visual indicators needed** (per requirements - haptic + scale sufficient).

### Accessibility

#### VoiceOver Announcements

Match existing patterns in the app for consistency:

```typescript
// StackedCard.tsx - Update aria-label for focus state
aria-label={
  isTouchFocused
    ? `${concert.headliner} at ${concert.venue}, focused. Tap again to view.`
    : `View ${concert.headliner} concert at ${concert.venue}`
}

// Add aria-pressed to indicate focus state
aria-pressed={isTouchFocused}
```

#### Keyboard Navigation

Existing keyboard support ([timeline-year-filter-spec.md:112-116](../implemented/timeline-year-filter-spec.md)):
- Tab to cycle through cards ✅
- Enter to select ✅
- Escape to dismiss ✅

**No changes needed** - keyboard navigation already works.

## Responsive Behavior

### Orientation Support

Feature works in **both portrait and landscape** orientations on iPad.

**Viewport constraints:**
- Minimum width: 768px (iPad Mini portrait)
- Card stack positioning: Existing logic handles viewport bounds ([YearCardStack.tsx:60-78](../../src/components/TimelineYearFilter/YearCardStack.tsx))

**Edge case handling:**
- Portrait orientation may be tight for wide card stacks (6+ cards)
- Existing overlap logic already tightens for many cards
- Viewport bounds checking prevents off-screen rendering

**No additional changes needed.**

### Resize Handling

Existing logic ([useYearFilter.ts:36-54](../../src/components/TimelineYearFilter/useYearFilter.ts)) handles resize:
- Collapses stack if viewport shrinks below 768px
- Maintains state if staying above breakpoint
- **Add:** Reset touch focus state on resize

```typescript
const handleResize = () => {
  const isLarge = window.innerWidth >= 768
  setIsTabletOrLarger(isLarge)

  if (!isLarge && filterState.isExpanded) {
    setFilterState(prev => ({
      ...prev,
      isExpanded: false,
      selectedYear: null,
      hoveredCardIndex: null,
      focusedCardIndex: null,  // NEW: Clear touch focus
    }))
  }
}
```

## Edge Cases & Error Handling

### 1. Rapid Tapping Multiple Cards

**Scenario:** User taps multiple cards in quick succession.

**Solution:** Use component-level state (`isTouchFocused` per card) rather than global debouncing. Each card tracks its own focus state independently.

**Behavior:**
- Tapping Card A → Card A focused
- Tapping Card B → Card A unfocused, Card B focused
- Tapping Card A again → Card A focused (not navigate, because it's "first tap")

**No debouncing needed** - iOS native tap handling prevents accidental double-taps.

### 2. Touch Focus Reset on Dismiss

**Scenario:** User focuses a card, then dismisses stack. When re-expanding same year, should card still be focused?

**Solution:** **No** - reset focus state when stack collapses ([per requirements](#summary-of-clarifications)).

```typescript
// useYearFilter.ts - collapse() already handles this
const collapse = useCallback(() => {
  setFilterState({
    selectedYear: null,
    isExpanded: false,
    hoveredCardIndex: null,
    focusedCardIndex: null,  // Reset focus
  })
}, [])
```

### 3. Touch vs Mouse on Hybrid Devices

**Scenario:** Touch laptop (e.g., Surface) supports both touch and mouse.

**Solution:** Use conditional handlers based on `isTouchDevice`:
- If touch-capable → Use touch handlers only
- If mouse-only → Use mouse handlers only

**Rationale:** Prevents double-firing and conflicting states. Touch takes priority on hybrid devices (more restrictive/intentional interaction).

### 4. Accessibility: Focus Management

**Scenario:** VoiceOver user taps card once - should it navigate immediately or require second tap?

**Solution:** VoiceOver gestures are distinct from native taps:
- VoiceOver **double-tap** = activate = second tap (navigate)
- VoiceOver **single-tap** = focus for reading = no action

**Implementation:** Native `onClick` handler works correctly with VoiceOver. No special handling needed.

### 5. Fast Network Transitions

**Scenario:** User taps card to navigate while haptic feedback is still running.

**Solution:** Navigation happens immediately, haptic feedback continues briefly (~50ms). This is acceptable and matches iOS patterns.

**No cancellation needed** ([haptics.ts:188-196](../../src/utils/haptics.ts) only supports Android vibration cancellation).

## Testing Checklist

### Manual Testing (iPad)

#### Timeline Dots
- [ ] Tap dot shows hover preview
- [ ] Tap dot expands card stack with `medium()` haptic
- [ ] Tap same dot collapses stack with `light()` haptic
- [ ] Drag across dots updates preview (no expand)
- [ ] Tap outside dismisses stack with `light()` haptic

#### Stacked Cards
- [ ] First tap on card brings it to front (scale + shadow)
- [ ] First tap triggers `light()` haptic
- [ ] Second tap on same card navigates to artist
- [ ] Second tap triggers `medium()` haptic
- [ ] Tapping different card switches focus
- [ ] Tap outside dismisses stack

#### Edge Cases
- [ ] Rotate iPad → layout adjusts, stack remains functional
- [ ] Rapidly tap multiple cards → focus switches correctly
- [ ] Dismiss stack → focus state resets
- [ ] Keyboard navigation still works (Tab, Enter, Escape)

#### Accessibility
- [ ] VoiceOver announces card focus state
- [ ] VoiceOver double-tap navigates
- [ ] Focus order follows visual stack order

### Cross-Device Testing

- [ ] iPad Pro 12.9" (1024×1366)
- [ ] iPad Air (820×1180)
- [ ] iPad Mini (768×1024)
- [ ] Android tablet (various sizes)
- [ ] Surface Pro (hybrid touch/mouse)
- [ ] Desktop with mouse (ensure no regression)

## Implementation Phases

### Phase 1: Fix Dot Click Detection
**Files:** `Scene1Hero.tsx`
- Add `touchend` handler to dots on touch tablets
- Test that tapping dot expands card stack
- Ensure no double-firing with existing touch preview logic

**Acceptance:** Tapping a dot on iPad expands the card stack.

### Phase 2: Add Card Touch Handlers
**Files:** `StackedCard.tsx`, `types.ts`
- Add `isTouchFocused` state to each card
- Implement two-tap pattern (`touchend` handler)
- Wire up haptic feedback (`light` on focus, `medium` on navigate)
- Conditionally disable mouse handlers on touch devices

**Acceptance:** First tap focuses card, second tap navigates.

### Phase 3: Update State Management
**Files:** `useYearFilter.ts`, `YearCardStack.tsx`
- Add `focusedCardIndex` to `YearFilterState`
- Reset focus state on collapse
- Reset focus state on resize below 768px

**Acceptance:** Focus state clears when stack is dismissed.

### Phase 4: Haptic Polish
**Files:** `Scene1Hero.tsx`, `useYearFilter.ts`
- Add haptics to tap-outside dismissal
- Add haptics to Escape key dismissal
- Differentiate expand (`medium`) vs collapse (`light`) haptics

**Acceptance:** All touch interactions have appropriate haptic feedback.

### Phase 5: Testing & Bug Fixes
- Manual testing on physical iPad
- Cross-device testing (Android tablet, Surface)
- Accessibility testing (VoiceOver)
- Fix any edge cases discovered

**Acceptance:** Feature works reliably on all target devices.

## Success Metrics

- [ ] Users can expand card stack via touch on iPad (100% success rate)
- [ ] Two-tap pattern is discoverable (first tap gives clear visual feedback)
- [ ] No accidental navigation (requires two intentional taps)
- [ ] Haptic feedback reinforces all interactions
- [ ] No performance degradation with 10+ cards on iPad
- [ ] VoiceOver users can navigate cards independently
- [ ] Zero regressions on desktop mouse interactions

## Out of Scope

The following are explicitly **not included** in this spec:

- ❌ Swipe gestures to dismiss or cycle through cards
- ❌ Pinch gestures to zoom or expand
- ❌ Long-press preview (considered, rejected for simplicity)
- ❌ Vertical card stacking for portrait orientation
- ❌ Custom ripple or tap animations (haptic + scale sufficient)
- ❌ Multi-year selection or range filtering
- ❌ Mobile phone support (<768px) - remains hover-preview-only

## References

- [Timeline Year Filter Spec](../implemented/timeline-year-filter-spec.md) - Original desktop feature
- [Timeline Hover Preview Spec](../implemented/timeline-hover-preview-spec-part1.md) - Touch preview behavior
- [Haptics Utility](../../src/utils/haptics.ts) - iOS haptic patterns
- [useYearFilter Hook](../../src/components/TimelineYearFilter/useYearFilter.ts) - State management
- [StackedCard Component](../../src/components/TimelineYearFilter/StackedCard.tsx) - Card implementation

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-07 | 1.0 | Initial specification |
