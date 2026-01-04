# Mobile Optimization Specification

**Status:** ✅ v1.1.0 Complete (iPad) | 📋 v1.2.0+ Planned (Phone)
**Priority:** High
**Version:** v1.1.0 (iPad - Complete), v1.2.0+ (Phone - Planned)
**Last Updated:** 2026-01-04
**Completed:** 2026-01-01
**Dependencies:** None

---

## Overview

This specification details mobile-specific optimizations deferred from v1.0 release. **iPad support (v1.1.0) is now complete and deployed.** Phone support is planned for v1.2.0+.

### ✅ iPad Status - v1.1.0 Complete (iPad Pro 11" Verified)

| Scene | Landscape | Portrait | Orientation Change |
|-------|-----------|----------|-------------------|
| Timeline | ✅ Fixed | ✅ Fixed | ✅ Fixed |
| Venues | ✅ Fixed | ✅ Fixed | ✅ Fixed |
| Map | ✅ Works | ✅ Works | ✅ Works |
| Genres | ✅ Works | ✅ Works | ✅ Works |
| Artists (Gatefold) | ✅ Enhanced | ✅ Enhanced | ✅ Enhanced |
| Navigation Dots | ✅ Enhanced | ✅ Enhanced | ✅ Enhanced |

**Result:** All iPad optimizations complete. All scenes functional in both orientations with 44px touch targets.

### Release Scope

| Release | Device Targets | Orientation | Status |
|---------|---------------|-------------|--------|
| **v1.1.0** | iPad Pro 12.9", iPad Pro 11", iPad Air 10.9" | Landscape & Portrait (both functional) | ✅ **Complete** |
| **v1.2.0+** | iPhone 12-16 series, Android flagships | Portrait (primary), Landscape (functional) | 📋 Planned |

---

## v1.1.0 iPad Optimization - Implementation Summary

**Release Date:** January 1, 2026
**GitHub Release:** https://github.com/mmorper/concerts/releases/tag/v1.1.0
**Commit:** `2619946` - "feat: Implement v1.1.0 iPad optimization and version tracking"

### ✅ Completed Work

**Critical Bug Fixes:**
- ✅ Timeline portrait initial load bug - Fixed with ResizeObserver pattern
- ✅ Venues re-centering bug - Fixed force simulation center updates

**Touch Optimizations:**
- ✅ 44px minimum touch targets implemented across all scenes
- ✅ Tap-to-reveal navigation dots (first tap shows label, second navigates)
- ✅ All instruction text updated from "Click" to "Tap"
- ✅ Touch-friendly button sizing throughout

**Scene-Specific Enhancements:**
- ✅ Scene 1 (Timeline): ResizeObserver + 44px dots + enhanced modal close
- ✅ Scene 2 (Venues): ResizeObserver + force re-centering + 44px nodes
- ✅ Scene 3 (Map): ResizeObserver + invalidateSize() + 44px filter tabs
- ✅ Scene 4 (Genres): 44px Reset button + tap instructions
- ✅ Scene 5 (Artists): Orientation handler + 44px sort buttons + tap instructions
- ✅ Navigation: Tap-to-reveal with 3s auto-dismiss + scroll dismissal

**Developer Tools:**
- ✅ Build version tracking system (version.json endpoint)

**Testing:**
- ✅ Verified on iPad Pro 11" in both portrait and landscape
- ✅ All orientation changes handled smoothly
- ✅ Touch interactions feel native

### 📊 v1.1.0 Effort Actual

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| Critical bug fixes | 3-6 hours | ~4 hours | ResizeObserver pattern worked well |
| Touch refinements | 2-3 hours | ~2 hours | Straightforward implementation |
| Layout adjustments | 2-4 hours | ~2 hours | Minimal changes needed |
| **Total** | **7-13 hours** | **~8 hours** | On target |

---

## Mobile UX Quick Wins (v1.6.1-v1.8.0)

This section identifies high-impact, low-effort mobile UX improvements that can be implemented incrementally to enhance the mobile experience before the full phone support redesign in v1.2.0+.

### Quick Win Priorities

| Priority | Category | Effort Range | Target Version |
|----------|----------|--------------|----------------|
| **Critical** | Touch feedback, haptics, safe areas, share | 1-3 hours each | v1.6.1 |
| **High** | Swipe gestures, bottom sheets, pull-to-refresh | 3-6 hours each | v1.7.0 |
| **Polish** | Loading states, momentum scroll, offline | 2-4 hours each | v1.8.0 |

---

### Tier 1: Critical Mobile Polish (v1.6.1)

**Target:** Ship within 1-2 sprints | **Total Effort:** 4-12 hours

#### 1.1 Visual Touch Feedback
**Effort:** 1-2 hours | **Impact:** High | **Risk:** Low

Add `:active` states and scale animations to all interactive elements.

```css
/* Global touch feedback */
.touchable {
  transition: transform 0.1s ease;
}

.touchable:active {
  transform: scale(0.95);
  opacity: 0.8;
}

/* Apply to: artist tiles, venue nodes, timeline dots, genre segments */
```

**Benefits:**
- Immediate visual confirmation that touch registered
- Makes the app feel more responsive
- Zero JavaScript required

**Implementation:**
- Add `.touchable` class to interactive elements
- Add `:active` pseudo-class styles globally
- Test on iOS and Android

---

#### 1.2 Haptic Feedback
**Effort:** 2-3 hours | **Impact:** High | **Risk:** Low

Integrate Web Vibration API for tactile feedback on key interactions.

```typescript
// utils/haptics.ts
export const haptics = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(20),
  heavy: () => navigator.vibrate?.(50),
  success: () => navigator.vibrate?.([10, 50, 10]),
  error: () => navigator.vibrate?.([50, 100, 50])
}

// Usage examples:
// - Timeline dot tap: haptics.light()
// - Artist tile tap: haptics.medium()
// - Genre segment drill-down: haptics.heavy()
// - Setlist loaded: haptics.success()
// - API error: haptics.error()
```

**Benefits:**
- Confirms touch registration even when visual feedback delayed
- Enhances perceived responsiveness
- Aligns with iOS HIG expectations

**Implementation:**
- Create `utils/haptics.ts` utility
- Add to all major interaction handlers
- Feature-detect and gracefully degrade
- Test on devices with haptic engines

**Note:** Scene 4 (Genres) haptic feedback was already identified in main spec (line 305). This consolidates that requirement.

---

#### 1.3 Safe Area Padding
**Effort:** 1-2 hours | **Impact:** Medium | **Risk:** Low

Respect iOS safe areas (notch, home indicator) and Android navigation bars.

```css
/* Add to global styles */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Scene navigation dots */
.scene-navigation {
  right: calc(16px + env(safe-area-inset-right));
  bottom: calc(24px + env(safe-area-inset-bottom));
}
```

**Benefits:**
- Prevents content from being cut off by device UI
- Professional polish
- Respects platform conventions

**Implementation:**
- Add `env()` safe area variables to layouts
- Test on iPhone 15 Pro (Dynamic Island)
- Test on Android phones with gesture navigation

---

#### 1.4 Share Concert Functionality
**Effort:** 2-3 hours | **Impact:** High | **Risk:** Low

Add Web Share API to share concert details from artist gatefold.

```typescript
// In ConcertHistoryPanel.tsx
const handleShare = async (concert: ArtistConcert) => {
  if (!navigator.share) {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(
      `${concert.headliner} at ${concert.venue} - ${concert.date}`
    )
    toast.success('Concert details copied!')
    return
  }

  await navigator.share({
    title: `${concert.headliner} Concert`,
    text: `I saw ${concert.headliner} at ${concert.venue} on ${concert.date}`,
    url: window.location.href
  })
}
```

**Benefits:**
- Native share sheet on mobile
- Users can share to Messages, WhatsApp, social media
- Low effort, high delight factor

**Implementation:**
- Add share button to concert rows in gatefold
- Feature-detect `navigator.share`
- Fallback to clipboard copy
- Add toast notification

---

### Tier 2: High-Value Interactions (v1.7.0)

**Target:** Ship within 2-4 sprints | **Total Effort:** 9-18 hours

#### 2.1 Swipe Gestures for Scene Navigation
**Effort:** 4-6 hours | **Impact:** High | **Risk:** Medium

Add horizontal swipe gestures as alternative to dot navigation.

```typescript
// Hook for swipe detection
const useSwipeNavigation = (onSwipeLeft: () => void, onSwipeRight: () => void) => {
  const [touchStart, setTouchStart] = useState(0)

  const handleTouchStart = (e: TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd
    const threshold = 75 // pixels

    if (Math.abs(diff) > threshold) {
      haptics.light()
      if (diff > 0) onSwipeLeft()
      else onSwipeRight()
    }
  }

  return { handleTouchStart, handleTouchEnd }
}
```

**Benefits:**
- Natural mobile navigation pattern
- Complements existing scroll behavior
- Reduces reliance on small touch targets

**Implementation:**
- Add swipe detection to scene container
- Coordinate with existing snap scroll
- Prevent conflicts with horizontal scrolling (timeline, map)
- Add edge swipe indicators for discoverability

---

#### 2.2 Bottom Sheet Modal System
**Effort:** 6-8 hours | **Impact:** High | **Risk:** Medium

Create reusable bottom sheet component for concert details, filters, etc.

**Note:** Phase 3 in main spec already plans bottom sheet for Artist Scene on phones (lines 521-548). This expands that to a **reusable system** for other scenes.

```typescript
// components/BottomSheet.tsx
interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  initialHeight?: '50vh' | '70vh' | '90vh'
  children: React.ReactNode
}

export function BottomSheet({ isOpen, onClose, initialHeight = '70vh', children }: BottomSheetProps) {
  const [y, setY] = useState(0)

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: window.innerHeight }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100) onClose()
      }}
      initial={{ y: '100%' }}
      animate={{ y: isOpen ? 0 : '100%' }}
      style={{ height: initialHeight }}
    >
      {/* Drag handle */}
      <div className="drag-handle" />
      {children}
    </motion.div>
  )
}
```

**Use cases:**
- Artist concert details (alternative to full gatefold on small phones)
- Map venue details
- Timeline concert details
- Genre breakdown details

**Benefits:**
- Consistent mobile UI pattern
- Doesn't obscure background
- Natural dismiss gesture

**Implementation:**
- Create reusable `BottomSheet` component
- Integrate with Framer Motion
- Add backdrop with tap-to-dismiss
- Implement swipe-down threshold
- Apply to multiple scenes progressively

---

#### 2.3 Pull-to-Refresh for Live Updates
**Effort:** 3-4 hours | **Impact:** Medium | **Risk:** Low

Add pull-to-refresh gesture for checking new concert data.

```typescript
// Hook for pull-to-refresh
const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const threshold = 80 // pixels

  // Touch handlers track pull distance
  // When released beyond threshold, trigger onRefresh()
  // Show loading indicator during refresh
}
```

**Benefits:**
- Familiar mobile pattern
- Useful for checking new setlists
- Sense of "liveness" in the app

**Implementation:**
- Add to main scene container
- Coordinate with scroll position (only at top)
- Show spinner during refresh
- Haptic feedback on threshold

---

### Tier 3: Polish & Delight (v1.8.0)

**Target:** Ship within 4-6 sprints | **Total Effort:** 6-12 hours

#### 3.1 Loading Skeletons
**Effort:** 2-3 hours | **Impact:** Medium | **Risk:** Low

Replace blank states with skeleton screens during data loading.

```typescript
// components/ArtistGridSkeleton.tsx
export function ArtistGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  )
}
```

**Benefits:**
- Perceived performance improvement
- Reduces "janky" initial load
- Modern UX expectation

**Implementation:**
- Create skeleton components for each scene
- Show while data loads or transitions
- Animate shimmer effect

---

#### 3.2 Momentum Scrolling Indicators
**Effort:** 2-3 hours | **Impact:** Low | **Risk:** Low

Add visual indicators for scrollable areas and scroll progress.

```css
/* Scroll fade hints */
.scrollable-container::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, rgba(0,0,0,0.5));
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}

.scrollable-container.has-overflow::after {
  opacity: 1;
}
```

**Benefits:**
- Signals more content below
- Aids discoverability
- Subtle UX improvement

**Implementation:**
- Detect overflow with JavaScript
- Add gradient hints
- Update on scroll
- Apply to concert lists, venue lists, etc.

---

#### 3.3 Offline Indicator
**Effort:** 2-4 hours | **Impact:** Low | **Risk:** Low

Show banner when offline, queue failed API requests.

```typescript
// Hook for online/offline detection
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Banner component
{!isOnline && (
  <div className="offline-banner">
    📡 You're offline. Some features may be unavailable.
  </div>
)}
```

**Benefits:**
- Explains why setlists won't load
- Prevents confusion
- Progressive enhancement

**Implementation:**
- Add online/offline listeners
- Show banner when offline
- Queue setlist requests to retry
- Auto-dismiss banner when back online

---

### Implementation Roadmap

**Sprint 1 (v1.6.1) - Critical Polish**
- Visual touch feedback (1-2h)
- Haptic feedback (2-3h)
- Safe area padding (1-2h)
- Share functionality (2-3h)

**Total: 6-10 hours**

---

**Sprint 2-3 (v1.7.0) - High-Value Interactions**
- Swipe gestures (4-6h)
- Bottom sheet system (6-8h)
- Pull-to-refresh (3-4h)

**Total: 13-18 hours**

---

**Sprint 4-5 (v1.8.0) - Polish & Delight**
- Loading skeletons (2-3h)
- Momentum scroll indicators (2-3h)
- Offline indicator (2-4h)

**Total: 6-10 hours**

---

**Grand Total: 25-38 hours** across 3 releases

---

### Priority Decision Matrix

| Feature | User Impact | Effort | Risk | Priority | Version |
|---------|-------------|--------|------|----------|---------|
| Visual touch feedback | 🔥 High | 🟢 Low | 🟢 Low | **Critical** | v1.6.1 |
| Haptic feedback | 🔥 High | 🟢 Low | 🟢 Low | **Critical** | v1.6.1 |
| Safe area padding | 🟡 Medium | 🟢 Low | 🟢 Low | **Critical** | v1.6.1 |
| Share concert | 🔥 High | 🟢 Low | 🟢 Low | **Critical** | v1.6.1 |
| Swipe gestures | 🔥 High | 🟡 Medium | 🟡 Medium | **High** | v1.7.0 |
| Bottom sheet system | 🔥 High | 🟡 Medium | 🟡 Medium | **High** | v1.7.0 |
| Pull-to-refresh | 🟡 Medium | 🟡 Medium | 🟢 Low | **High** | v1.7.0 |
| Loading skeletons | 🟡 Medium | 🟢 Low | 🟢 Low | **Polish** | v1.8.0 |
| Momentum indicators | 🟢 Low | 🟢 Low | 🟢 Low | **Polish** | v1.8.0 |
| Offline indicator | 🟢 Low | 🟢 Low | 🟢 Low | **Polish** | v1.8.0 |

---

### Testing Checklist

For each quick win implementation:

- [ ] Test on iOS Safari (iPhone 12-15)
- [ ] Test on Android Chrome (Pixel, Samsung)
- [ ] Test on iPad (ensure no regression)
- [ ] Test in both portrait and landscape
- [ ] Verify no performance degradation
- [ ] Ensure graceful degradation if API unsupported
- [ ] Add feature detection where needed
- [ ] Document any browser-specific quirks

---

### Target Viewports (CSS pixels)

| Device | Landscape | Portrait |
|--------|-----------|----------|
| iPad Pro 12.9" | 1366 × 1024 | 1024 × 1366 |
| iPad Pro 11" | 1194 × 834 | 834 × 1194 |
| iPad Air 10.9" | 1180 × 820 | 820 × 1180 |
| iPhone 15 Pro Max | 932 × 430 | 430 × 932 |
| iPhone 15 Pro | 852 × 393 | 393 × 852 |

---

## Critical Bug: Portrait Initial Load & Orientation Handling

### Problem Statement

Based on iPad Pro 11" testing, two specific issues were identified:

1. **Timeline Scene (Critical):** When site initially loads in portrait orientation, the Timeline scene renders at incorrect scale (zoomed in very large). However, after manually scaling down, it and all other scenes display correctly.

2. **Venues Scene (Medium):** Content does not re-center in viewport when rotating between portrait and landscape orientations.

**Good news:** All other scenes work correctly in both orientations, including the gatefold animation in portrait.

### Root Cause Analysis

**Timeline Initial Load Bug:**
- D3.js calculates SVG dimensions at component mount
- When loading in portrait, dimensions appear to be calculated incorrectly (possibly using cached/wrong viewport values)
- This is NOT a rotation bug—it's an initial render bug specific to portrait orientation

**Venues Re-center Bug:**
- Force simulation center point (`forceCenter`) is set once at mount
- No resize handler updates the center coordinates when viewport dimensions change
- Nodes remain positioned relative to original center, causing off-center layout after rotation

### Solution Architecture

**Timeline Fix:**
- Ensure D3 reads actual container dimensions at render time, not cached values
- Add a brief delay or use `ResizeObserver` to get accurate dimensions after layout settles
- May need to force re-render if initial dimensions are incorrect

**Venues Fix:**
- Add resize event handler that updates force simulation center:
  ```typescript
  useEffect(() => {
    if (!simulation) return;
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.3).restart();
  }, [width, height]);
  ```

---

## Scene-by-Scene Analysis

### Scene 1: Timeline (Scene1Hero.tsx)

**Technology:** D3.js  
**Current State:** 🔴 **Critical bug** — renders at wrong scale when initially loaded in portrait orientation. Works fine after manual scaling or when loaded in landscape first.

| Aspect | iPad Landscape | iPad Portrait (initial) | iPad Portrait (after fix) |
|--------|---------------|------------------------|---------------------------|
| **Risk** | 🟢 Low | 🔴 High | 🟢 Low |
| **Effort** | 🟢 Low | 🟡 Medium | — |

#### iPad Requirements (v1.1.0)

- [x] **Fix initial portrait load scaling bug** (Critical) ✅ Complete
  - Investigate why D3 calculates wrong dimensions when loading in portrait
  - Ensure container dimensions are read after layout settles
  - Consider using `ResizeObserver` or `requestAnimationFrame` delay
- [x] Ensure year dots resize proportionally on orientation change ✅ Complete
- [x] Test tooltip positioning at viewport edges ✅ Complete
- [x] Verify touch targets ≥44px for year dots ✅ Complete
- [x] **Drag finger across timeline for navigation** ✅ Complete (v1.6.0)
  - Implemented touch-friendly drag gesture for horizontal timeline scrolling
  - Eliminates need to precisely tap on scrollbar
  - Natural mobile interaction pattern

**Debugging approach:**
```typescript
// Add logging to identify the issue
useEffect(() => {
  console.log('Timeline mount - container dimensions:', {
    clientWidth: containerRef.current?.clientWidth,
    clientHeight: containerRef.current?.clientHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  });
}, []);
```

#### Phone Requirements (v1.2.0+)

- [ ] Consider vertical timeline orientation
- [ ] Reduce year label density for narrow viewports
- [ ] Implement swipe gestures for decade navigation
- [ ] Bottom sheet for concert details on dot tap

**Implementation Notes:**
- Timeline is already horizontally scrollable, which helps on narrower viewports
- Main concern is D3 SVG not resizing on orientation change

---

### Scene 2: Venue Network (Scene4Bands.tsx)

**Technology:** D3.js force simulation  
**Current State:** 🟡 **Re-centering bug** — content does not re-center in viewport when rotating between portrait and landscape. Otherwise functional.

| Aspect | iPad Landscape | iPad Portrait | Orientation Change |
|--------|---------------|---------------|-------------------|
| **Risk** | 🟢 Low | 🟢 Low | 🟡 Medium |
| **Effort** | 🟢 Low | 🟢 Low | 🟢 Low |

#### iPad Requirements (v1.1.0)

- [ ] **Fix re-centering on orientation change** (Medium priority)
  - Add resize handler to update force simulation center
  - Recalculate radial positions on resize:
  ```typescript
  useEffect(() => {
    if (!simulation) return;
    const centerX = width / 2;
    const centerY = height / 2;
    
    simulation.force('center', d3.forceCenter(centerX, centerY));
    
    // Update radial force center if used
    const radialForce = simulation.force('radial');
    if (radialForce) {
      radialForce.x(centerX).y(centerY);
    }
    
    simulation.alpha(0.3).restart();
  }, [width, height, simulation]);
  ```
- [ ] Adjust node collision radius for touch (increase by 1.5×)
- [ ] Ensure expanded venue children don't overflow viewport
- [ ] Add touch-friendly close button for expanded venues
- [ ] Network graph expansion and improved node interactions

#### Phone Requirements (v1.2.0+)

- [ ] Reduce to Top 5 venues (vs Top 10) for legibility
- [ ] Implement list-based alternative view
- [ ] Consider replacing force graph with simple venue cards
- [ ] Bottom sheet for venue details

**Implementation Notes:**
- Force simulation requires explicit restart after dimension changes
- Node positions are absolute, so center force must be updated
- Touch targets for nodes should be ≥44px

---

### Scene 3: Map (Scene3Map.tsx)

**Technology:** Leaflet + React Leaflet  
**Current State:** ✅ **Working correctly** on iPad in both orientations. Touch interactions already enabled in code (`touchZoom`, `dragging`).

| Aspect | iPad Landscape | iPad Portrait | Orientation Change |
|--------|---------------|---------------|-------------------|
| **Risk** | 🟢 Low | 🟢 Low | 🟢 Low |
| **Effort** | 🟢 Low | 🟢 Low | 🟢 Low |

#### iPad Requirements (v1.1.0)

- [ ] Verify `map.invalidateSize()` is called on container resize (may already work)
  ```typescript
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [width, height]);
  ```
- [ ] Verify popup doesn't overflow viewport edges
- [ ] Ensure region filter tabs are touch-friendly (≥44px height)
- [ ] Test pinch-to-zoom behavior on actual devices
- [ ] Enhanced pinch-zoom and pan interactions for larger touch surface
- [ ] May need pinch gesture indicators for discoverability
- [ ] Adjust hint prominence for no-hover state ("Tap to explore" vs "Click to explore")

#### Phone Requirements (v1.2.0+)

- [ ] Stack region filters vertically or use dropdown
- [ ] Increase marker sizes for touch accuracy
- [ ] Consider full-screen map modal vs inline

**Implementation Notes:**
- Leaflet is inherently mobile-friendly with touch support
- Touch zoom and dragging already enabled in code when map is active
- Main fix is calling `invalidateSize()` on container resize
- This is the lowest-effort scene to fix
- Reference: [Map Interaction Spec](../implemented/map-interaction.md) - Phase 4 Mobile Support section

---

### Scene 4: Genres (Scene5Genres.tsx)

**Technology:** D3.js sunburst chart  
**Current State:** ✅ **Working correctly** on iPad in both orientations. Uses `min(85vw, 85vh)` for viewport-relative sizing.

| Aspect | iPad Landscape | iPad Portrait | Orientation Change |
|--------|---------------|---------------|-------------------|
| **Risk** | 🟢 Low | 🟢 Low | 🟢 Low |
| **Effort** | 🟢 Low | 🟢 Low | 🟢 Low |

#### iPad Requirements (v1.1.0)

- [ ] Verify sunburst re-renders correctly on orientation change (may already work due to viewport units)
- [ ] Verify drill-down zoom works with touch
- [ ] Ensure 270° artist arc remains visible in portrait
- [ ] Sunburst chart scaling and touch interaction refinements

#### Phone Requirements (v1.2.0+)

- [ ] Increase minimum segment angle for touch targets
- [ ] Consider showing fewer genres by default
- [ ] Larger center text for readability
- [ ] Haptic feedback on segment tap (if supported)

**Implementation Notes:**
- Already uses viewport-relative sizing, which is good
- D3 partition layout needs recalculation on resize
- Touch interactions are just click events, should work

---

### Scene 5: Artists (ArtistScene/)

**Technology:** React + Framer Motion (grid), CSS 3D transforms (gatefold)  
**Current State:** 200px tiles, 812px gatefold overlay. **Gatefold confirmed working on iPad Pro 11" portrait.**

| Aspect | iPad Landscape | iPad Portrait | Phone |
|--------|---------------|---------------|-------|
| **Risk** | 🟢 Low | 🟢 Low | 🔴 High |
| **Effort** | 🟢 Low | 🟢 Low | 🔴 High |

#### Critical Constraint: Gatefold Width

The gatefold is **812px wide** (400px cover + 12px spine + 400px panel). This creates viewport constraints:

| Viewport Width | Gatefold Fits? | Recommended UX |
|----------------|----------------|----------------|
| ≥820px | ✅ Yes | Gatefold animation |
| <768px | ❌ No | Bottom sheet required |

**iPad viewport analysis (confirmed working):**
- iPad Pro 12.9" landscape (1366px): ✅ Gatefold works
- iPad Pro 11" landscape (1194px): ✅ Gatefold works
- iPad Air landscape (1180px): ✅ Gatefold works
- iPad Pro 12.9" portrait (1024px): ✅ Gatefold works
- iPad Pro 11" portrait (834px): ✅ **Gatefold works** (tested on device)
- iPad Air portrait (820px): ✅ Gatefold works (8px margin, acceptable)

#### iPad Requirements (v1.1.0)

**All iPad viewports (landscape and portrait):**
- [ ] Keep existing gatefold animation — **works on all iPad sizes including portrait**
- [ ] Add resize handler to reposition open gatefold on orientation change
- [ ] Verify flying tile animation works with touch
- [ ] Close gatefold on orientation change (prevents layout break during transition)
- [ ] Adjust tile grid columns (4 → 3 in portrait)

```typescript
// Breakpoint logic - gatefold for all iPads, bottom sheet for phones only
const useArtistDetailMode = () => {
  const { width } = useViewportResize();
  if (width >= 768) return 'gatefold';  // All iPads
  return 'bottomsheet';                  // Phones only
}
```

#### Spotify Mini-Player (Mobile Layout)

The desktop gatefold's right panel contains a Spotify mini-player. On mobile, this appears below the concert history in the bottom sheet.

**Design requirements defined in**: [spotify-artist-integration.md](./spotify-artist-integration.md#mobile-considerations)

**Mobile-specific implementation**:
- [ ] Hide track album art thumbnails (save horizontal space)
- [ ] Ensure 48px minimum touch targets on track rows
- [ ] Simplify Play All button
- [ ] Test audio playback doesn't interfere with sheet drag gestures

#### Mobile Bottom Sheet (v1.2.0+ for phones only)

- [ ] Replace gatefold animation with slide-up bottom sheet on viewports <768px
- [ ] 70vh initial height, draggable to 90vh
- [ ] Swipe down or tap backdrop to close
- [ ] Concert history + Spotify panels stacked vertically
- [ ] Reference: [Artist Scene Spec](../implemented/artist-scene.md) (Mobile Design section)

#### Phone Requirements (v1.2.0+)

- [ ] Reduce tile size to 150px
- [ ] 2-column grid layout
- [ ] Simplified sort controls (dropdown vs buttons)

---

### Scene Navigation (SceneNavigation.tsx)

**Current State:** Right-side dot navigation with hover labels

| Aspect | iPad | Phone |
|--------|------|-------|
| **Risk** | 🟢 Low | 🟡 Medium |
| **Effort** | 🟢 Low | 🟡 Medium |

#### iPad Requirements (v1.1.0)

- [ ] Convert hover states to tap-to-reveal
- [ ] Increase dot size from current to ≥44px touch target
- [ ] Add visual feedback on tap (scale animation)
- [ ] Labels appear on tap, dismiss on scroll or timeout (3s)

#### Phone Requirements (v1.2.0+)

- [ ] Consider bottom pill navigation as alternative
- [ ] Or: hide dots, rely on scroll with page indicators
- [ ] Ensure dots don't overlap content in narrow viewports

---

## Implementation Plan

### ✅ Phase 1: Critical Bug Fixes (COMPLETE)

**Goal:** Fix the two identified bugs so app works correctly on iPad
**Status:** ✅ Complete (v1.1.0)

**Bug 1: Timeline Initial Portrait Load (Critical)**

**Files to modify:**
- `src/components/scenes/Scene1Hero.tsx`

**Investigation checklist:**
- [ ] Add console logging to identify what dimensions D3 receives at mount
- [ ] Check if container ref is populated before D3 initializes
- [ ] Compare `window.innerWidth/Height` vs `container.clientWidth/Height`
- [ ] Test if issue is timing-related (layout not settled at mount)

**Potential fixes (try in order):**
- [ ] Use `ResizeObserver` instead of reading dimensions once at mount
- [ ] Add `requestAnimationFrame` delay before reading dimensions
- [ ] Add resize handler that re-initializes D3 if dimensions change significantly
- [ ] Force re-render after initial mount with correct dimensions

```typescript
// Option A: ResizeObserver approach
const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

useEffect(() => {
  if (!containerRef.current) return;
  
  const observer = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    setDimensions({ width, height });
  });
  
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);

// D3 code uses dimensions.width, dimensions.height
// and re-runs when they change
```

**Estimated effort:** 2-4 hours  
**Risk:** Low-Medium (need to debug first to identify exact cause)

---

**Bug 2: Venues Re-centering (Medium)**

**Files to modify:**
- `src/components/scenes/Scene4Bands.tsx`

**Implementation checklist:**
- [ ] Add resize event listener or `ResizeObserver`
- [ ] Update force simulation center on dimension change
- [ ] Restart simulation with low alpha for smooth transition

```typescript
// Add to Scene4Bands.tsx
useEffect(() => {
  if (!simulationRef.current) return;
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  simulationRef.current
    .force('center', d3.forceCenter(centerX, centerY));
  
  // Update radial force if present
  const radialForce = simulationRef.current.force('radial');
  if (radialForce) {
    (radialForce as d3.ForceRadial<any>).x(centerX).y(centerY);
  }
  
  // Gentle restart
  simulationRef.current.alpha(0.3).restart();
}, [width, height]);
```

**Estimated effort:** 1-2 hours  
**Risk:** Low (straightforward D3 force update)

---

**Total Phase 1 effort:** 3-6 hours

---

### ✅ Phase 2: Touch Refinements (COMPLETE)

**Goal:** Ensure all interactions work well with touch
**Status:** ✅ Complete (v1.1.0)

**Implementation checklist:**

- [ ] Audit all click handlers - ensure they work with touch
- [ ] Increase touch targets to ≥44px where needed
- [ ] Add `:active` states for touch feedback
- [ ] Test pinch-to-zoom on map (already enabled in code)
- [ ] Test force graph node dragging (if applicable)
- [ ] Update SceneNavigation for tap interaction
- [ ] Adjust hint text for no-hover state where needed

**Estimated effort:** 2-3 hours  
**Risk:** Low

---

### Phase 3: Artist Scene Bottom Sheet (v1.2.0+ - Phones Only)

**Goal:** Provide alternative to gatefold for phone viewports (<768px)

**Note:** Gatefold works on all iPad viewports including portrait. Bottom sheet is only needed for phones.

**Files to create/modify:**
- `src/components/scenes/ArtistScene/ArtistBottomSheet.tsx` (new)
- `src/components/scenes/ArtistScene/ArtistScene.tsx`

**Implementation checklist:**

- [ ] Create `ArtistBottomSheet` component
  - Framer Motion for slide-up animation
  - Backdrop with tap-to-close
  - Drag handle for resize (70vh → 90vh)
  - Swipe-down to close gesture
  - Concert history panel content
  - Spotify panel content (stacked vertically)

- [ ] Add viewport width detection in ArtistScene
- [ ] Conditionally render gatefold (≥768px) vs bottom sheet (<768px)
- [ ] Close any open detail view on orientation change

**Estimated effort:** 6-8 hours  
**Risk:** Medium (new component with complex gestures)  
**Timeline:** v1.2.0+ (not needed for iPad support)

---

### ✅ Phase 4: Layout Adjustments (COMPLETE)

**Goal:** Optimize layouts for different viewport sizes
**Status:** ✅ Complete (v1.1.0)

**Implementation checklist:**

- [ ] Artist grid: 4 columns → 3 columns under 1024px width
- [ ] Tile size: Consider responsive sizing (200px → 180px → 150px)
- [ ] Scene titles: Reduce font size in portrait
- [ ] Filter controls: Ensure they don't wrap awkwardly (expanded filter options in landscape)
- [ ] Bottom gradients: Adjust height for shorter viewports
- [ ] Add iPad-specific responsive breakpoints (768px-1024px range)

**Estimated effort:** 2-4 hours  
**Risk:** Low

---

### ✅ v1.1.0 Total Effort Summary (COMPLETE)

| Phase | Estimated | Actual | Status |
|-------|-----------|--------|--------|
| Phase 1: Bug fixes (Timeline + Venues) | 3-6 hours | ~4 hours | ✅ Complete |
| Phase 2: Touch refinements | 2-3 hours | ~2 hours | ✅ Complete |
| Phase 4: Layout adjustments | 2-4 hours | ~2 hours | ✅ Complete |
| **Total** | **7-13 hours** | **~8 hours** | ✅ **Complete** |

**Note:** Phase 3 (Bottom Sheet) is deferred to v1.2.0+ for phones only.

---

## General Mobile & Tablet Testing

### Device Testing Requirements

- [ ] Test all 5 scenes on **iOS Safari** (iPad)
- [ ] Test all 5 scenes on **Android Chrome** (tablet)
- [ ] Verify snap scrolling behavior on touch devices
- [ ] Ensure touch targets meet 44px minimum throughout
- [ ] Test landscape orientation on tablets
- [ ] Address any **Safari iPad quirks** (CSS, scrolling, touch behavior differences)

### iPad Testing Matrix

| Test Case | iPad Pro 12.9" | iPad Pro 11" | iPad Air | Notes |
|-----------|----------------|--------------|----------|-------|
| Landscape initial load | | ✅ Works | | |
| Portrait initial load | | 🔴 Timeline bug | | Timeline scaled wrong |
| Landscape → Portrait rotation | | 🟡 Venues off-center | | Other scenes OK |
| Portrait → Landscape rotation | | 🟡 Venues off-center | | Other scenes OK |
| Multiple rapid rotations | | | | |
| Gatefold in landscape | | ✅ Works | | |
| Gatefold in portrait | | ✅ Works | | Confirmed working |
| Map in both orientations | | ✅ Works | | |
| Genres in both orientations | | ✅ Works | | |
| Force graph touch interaction | | | | |
| Sunburst drill-down touch | | | | |
| Scene navigation tap | | | | |
| Snap scroll between scenes | | | | |

### Recommended Testing Tools

- **Safari Responsive Design Mode** (in Safari > Develop menu)
- **Xcode Simulator** (most accurate for iPad)
- **BrowserStack** (real device cloud)
- **Physical iPad** (mandatory before release)

---

## Phone Support Research (v1.2.0+)

This section documents findings for future phone viewport support.

### High-Risk Scenes for Phone

| Scene | Challenge | Proposed Solution |
|-------|-----------|-------------------|
| Venue Network | Too many nodes, illegible | Replace with venue list + detail cards |
| Timeline | Horizontal scroll awkward on narrow screens | Vertical timeline orientation |
| Artists | Bottom sheet required | Already planned for Phase 3 |

### Phone-Specific Components Needed

1. **Vertical Timeline** - Complete redesign of Scene1
2. **Venue List View** - Alternative to force graph
3. **Compact Sunburst** - Reduced genres, larger touch targets
4. **Bottom Navigation** - Replace or supplement dot nav

### Estimated Phone Support Effort

| Scene | Effort | Notes |
|-------|--------|-------|
| Timeline | 12-16 hours | Major redesign for vertical layout |
| Venue Network | 8-12 hours | New list view component |
| Map | 2-4 hours | Minor adjustments |
| Genres | 4-6 hours | Touch target sizing |
| Artists | 6-8 hours | Bottom sheet component (new for phones) |
| Navigation | 4-6 hours | New bottom nav component |
| **Total** | **36-52 hours** | |

### Phone Testing Requirements (v1.2.0+)

- [ ] Test all 5 scenes on **iOS Safari** (iPhone)
- [ ] Test all 5 scenes on **Android Chrome** (phone)
- [ ] Verify snap scrolling behavior
- [ ] Test landscape orientation on phones

---

## Risk Summary

| Item | Risk Level | Status | Notes |
|------|------------|--------|-------|
| Timeline portrait initial load | 🟡 Medium | 🔴 Bug confirmed | Need to debug dimension calculation |
| Venues re-centering | 🟢 Low | 🔴 Bug confirmed | Straightforward force update |
| Map resize | 🟢 Low | ✅ Working | May need invalidateSize call |
| Sunburst resize | 🟢 Low | ✅ Working | Already uses viewport units |
| Gatefold on iPad | 🟢 Low | ✅ Working | Confirmed on 11" portrait |
| Touch interactions | 🟢 Low | 🟡 Needs testing | Touch events work, need UX polish |
| Safari iPad quirks | 🟡 Medium | 🟡 Unknown | Test early, address as discovered |

---

## Success Criteria

### v1.1.0 (iPad Support)

- [ ] All scenes functional on iPad devices
- [ ] Touch interactions feel native on iPad form factor
- [ ] No horizontal scroll or overflow issues
- [ ] Readable text without zooming
- [ ] Performant animations (no jank)
- [ ] iPad portrait and landscape orientations fully supported
- [ ] Responsive layouts adapt appropriately to tablet screen sizes
- [ ] Rotation between orientations preserves usability
- [ ] Gatefold works for artist details in both orientations
- [ ] No console errors related to dimensions/layout

### v1.2.0+ (Phone Support)

- [ ] All scenes functional on 390px+ width viewports
- [ ] Touch targets meet 44px minimum
- [ ] Text remains readable without zooming
- [ ] Navigation intuitive without mouse hover

---

## Appendix: Breakpoint Reference

```css
/* Tailwind-style breakpoints for reference */
/* iPad landscape and larger */
@media (min-width: 1024px) { /* Gatefold safe */ }

/* iPad portrait to iPad landscape */
@media (min-width: 768px) and (max-width: 1023px) { /* Bottom sheet zone */ }

/* Phone */
@media (max-width: 767px) { /* Major redesign needed */ }
```

```typescript
// Component breakpoint constants
export const BREAKPOINTS = {
  GATEFOLD_MIN: 768,      // Gatefold works on all iPads (confirmed on 11" portrait)
  TABLET_MIN: 768,        // iPad portrait minimum
  PHONE_MAX: 767,         // Phone maximum - bottom sheet territory
  GRID_COLUMNS: {
    large: 4,             // ≥1024px
    medium: 3,            // 768-1023px
    small: 2,             // <768px
  },
} as const;
```

---

## References

- [Scene Design Guide](../../design/scene-design-guide.md)
- [Map Interaction Spec](../implemented/map-interaction.md) - Phase 4 Mobile Support
- [Artist Scene Spec](../implemented/artist-scene.md) - Mobile Design section