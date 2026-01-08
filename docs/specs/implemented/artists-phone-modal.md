# Phone Artist Modal

**Status:** Planned  
**Target Version:** v3.2.0  
**Priority:** High  
**Estimated Complexity:** Medium (3-4 days)  
**Replaces:** `phone-gatefold-vertical.md` (deemed not viable)

---

## Executive Summary

Create a phone-specific modal experience for the Artist Scene that delivers the same content as the desktop gatefold in a mobile-native format. Rather than adapting the complex 3D gatefold animation to portrait orientation, this approach uses a standard full-screen modal with tabbed navigation—familiar, thumb-friendly, and performant.

**Problem Solved:** Phone users (viewport <768px) currently cannot access artist details. The desktop gatefold's 812px width and 3D transforms don't translate to phone viewports.

**User Experience:** A near-edge-to-edge modal with tabbed content (Concert History, Top Tracks, and conditionally Upcoming tour dates). Setlist details slide in as an overlay. Standard iOS/Android patterns ensure immediate usability.

**Why This Approach:** The previous spec attempted to rotate the gatefold metaphor 90 degrees. While conceptually elegant, the implementation complexity and interaction awkwardness on small screens made it impractical. This modal approach prioritizes usability over metaphor preservation.

---

## Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session:**

```
I need to implement the Phone Artist Modal feature for Morperhaus Concerts.

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
- Phone-specific modal for Artist Scene (viewport <768px)
- Replaces gatefold interaction entirely on phone
- Tabbed UI: Concert History, Top Tracks, conditionally Upcoming
- Setlist overlay slides from right
- Swipe-down and X to dismiss

**Key References:**
- Full Design Spec: docs/specs/future/artists-phone-modal.md
- Existing Panels: src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx
- Spotify Panel: src/components/scenes/ArtistScene/SpotifyPanel.tsx
- Liner Notes: src/components/scenes/ArtistScene/LinerNotesPanel.tsx
- Tour Dates: src/components/scenes/ArtistScene/TourDatesPanel.tsx
- Icon Library: lucide-react

**Implementation Approach:**
- Window 1: Create PhoneArtistModal component shell + viewport detection
- Window 2: Tab bar component + tab switching logic
- Window 3: Integrate existing panel content + adapt layouts
- Window 4: Setlist overlay + gestures + polish

Let's start with Window 1. Should I begin by creating the modal component and viewport hook?
```

---

## Design Philosophy

This spec prioritizes **mobile-native UX** over desktop metaphor preservation. The gatefold is a delightful desktop interaction, but forcing it onto phone creates friction. Instead, we use patterns phone users already know: full-screen modals, tab bars, and slide-in overlays.

**Design Principles:**
1. **Thumb-zone friendly** — Primary actions reachable with one hand
2. **Content parity** — Same information as desktop, different container
3. **Familiar patterns** — Standard iOS/Android modal and tab conventions
4. **Fast and smooth** — 60fps animations, no 3D transform complexity

---

## Visual Design

### Reference Mockup

![Phone Artist Modal Mockup](../../../assets/mockups/phone-artist-modal.png)

*Berlin artist modal showing Concert History tab with 5 shows, On Tour badge, and tabbed navigation.*

### Modal Structure

```
+------------------------------------------+
|  [X]                                     |  <- Dismiss button (top-left)
+------------------------------------------+
|                                          |
|  +--------+                              |
|  | Artist |  Artist Name  [link icon]   |
|  | Photo  |  Genre · X shows             |
|  +--------+                              |
|            +------------------------+    |
|            | ● ON TOUR · X DATE(S) |    |  <- Badge (conditional)
|            +------------------------+    |
|                                          |
+------------------------------------------+
|  [🕐 History]  [📅 Upcoming]  [🎵 Top]   |  <- Tab bar
|  ━━━━━━━━━━━                             |  <- Active indicator
+------------------------------------------+
|                                          |
|  Tab Content Area                        |
|                                          |
|  (Concert list, tour dates, or          |
|   Spotify tracks depending on tab)       |
|                                          |
|                                          |
|                                          |
|                                          |
+------------------------------------------+
```

### Component Specifications

#### Backdrop
- **Position:** Fixed, full viewport, behind modal
- **Background:** `rgba(0, 0, 0, 0.7)` (70% black)
- **Z-index:** Below modal, above page content
- **Animation:** Fade in (300ms, synced with modal open)
- **Interaction:** Tap to dismiss modal

#### Modal Container
- **Position:** Fixed, full viewport
- **Inset:** `12px` from edges (near edge-to-edge, not full bleed)
- **Background:** `#000000` or existing dark theme background
- **Border radius:** `16px`
- **Z-index:** Above backdrop
- **Animation:** Fade in + slide up from bottom (300ms ease-out)

#### Dismiss Button
- **Position:** Top-left, inside modal padding
- **Icon:** `X` from lucide-react
- **Size:** `24px` icon, `44px` tap target (accessibility)
- **Color:** Muted gray (`#888` or theme equivalent), white on hover/tap

#### Header Section
- **Artist Photo:** `80px × 80px`, rounded corners (`8px`)
- **Artist Name:** Playfair Display, `1.5rem`, white
- **Link Icon:** `Link` from lucide-react, `16px`, muted gray, tappable
  - Copies deep link URL to clipboard (e.g., `/?scene=artists&artist=berlin`)
  - Shows brief toast/feedback on tap
- **Subtext:** Genre · X shows, muted gray, `0.875rem`
- **On Tour Badge:** 
  - Only renders when artist has upcoming tour dates
  - Green dot (`#22c55e`) + "ON TOUR · X DATE(S)" text
  - Pill shape, border (`1px solid #22c55e`), transparent fill
  - Tappable — activates Upcoming tab

#### Tab Bar
- **Position:** Below header, sticky/fixed within modal
- **Layout:** Horizontal, evenly distributed or left-aligned
- **Tab height:** `48px` (thumb-friendly)

**Tab Definitions:**

| Tab | Label | Icon (lucide-react) | Condition |
|-----|-------|---------------------|-----------|
| Concert History | "History" | `History` | Always visible |
| Upcoming | "Upcoming" | `Calendar` | Only when tour data exists |
| Top Tracks | "Top Tracks" | Spotify logo (SVG, per TOS) | Always visible |

**Tab States:**

| State | Text Color | Icon Color | Underline |
|-------|------------|------------|-----------|
| Active | White (`#ffffff`) | White | `2px` solid white, bottom of tab |
| Inactive | Muted gray (`#888888`) | Muted gray | None |

**Transitions:**
- Tab switch: `150ms ease` for color/underline changes
- Content area: Crossfade or instant swap (no slide)

#### Tab Content Area
- **Height:** Fill remaining modal space
- **Overflow:** Scroll vertical (per-tab)
- **Padding:** `16px` horizontal, `12px` vertical

---

### Concert History Tab Content

Reuse/adapt `ConcertHistoryPanel.tsx` content:

```
+------------------------------------------+
|  17 Aug 2022    Costa Mesa, California   |
|                 Pacific Amphitheatre     |
|                              ♪ Setlist → |
+------------------------------------------+
|  01 May 2014    Hanover, Maryland        |
|                 Rams Head Center Stage   |
|                              ♪ Setlist → |
+------------------------------------------+
|  ...                                     |
+------------------------------------------+
```

**Row Layout:**
- **Date column:** Left-aligned, muted gray, fixed width (~100px)
- **Location:** City, State (primary line, white)
- **Venue:** Below location (secondary line, muted gray, smaller)
- **Setlist button:** Right-aligned, `♪ Setlist` text or icon + text
  - Icon: `Music` from lucide-react
  - Color: Green (`#22c55e`) to match Spotify/tour accent
  - Tapping opens Setlist Overlay

**Row dividers:** Subtle horizontal line (`1px`, `#333` or theme equivalent)

---

### Upcoming Tab Content

Reuse/adapt `TourDatesPanel.tsx` content. Same row layout as Concert History but for future dates.

- Only visible when artist has tour data
- Rows sorted chronologically (soonest first)
- Consider adding "Get Tickets" external link if data supports it

---

### Top Tracks Tab Content

Reuse/adapt `SpotifyPanel.tsx` content:

- Spotify logo attribution (required by TOS)
- Track list or "Coming Soon" skeleton
- Maintain existing implementation, just re-contained in tab

---

### Setlist Overlay

When user taps "Setlist" on a concert row:

```
+------------------------------------------+
|  [X]                                     |  <- Dismiss (top-right)
+------------------------------------------+
|                                          |
|  SETLIST                                 |
|  Artist Name — Venue — Date              |
|                                          |
|  1. Song Title                           |
|  2. Another Song                         |
|  3. Third Track                          |
|  ...                                     |
|                                          |
+------------------------------------------+
```

**Behavior:**
- Slides in from right (300ms ease-out)
- Overlays the tab content area; header/tabs remain visible but **ghosted** (dimmed, not tappable)
- Dismiss via:
  - X button (top-right of overlay)
  - Swipe right gesture
  - Swipe down gesture (consistent with modal dismiss)
- Background: Same as modal, or slightly lighter to create depth
- Header/tabs become interactive again only after overlay is dismissed

**Content:** Reuse `LinerNotesPanel.tsx` content/logic

---

## Interaction Design

### Opening the Modal

1. User taps artist card in grid
2. Card does NOT fly (unlike desktop gatefold)
3. Modal fades in + slides up (300ms)
4. Default tab: Concert History

### Tab Switching

- Tap tab → content area updates, **scroll position resets to top**
- On Tour badge tap → switches to Upcoming tab (same as tapping Upcoming tab directly)
- Tab bar underline animates to new position (150ms)

### Opening Setlist

1. User taps "Setlist" on a concert row
2. Setlist overlay slides in from right (300ms)
3. Tab bar and header remain visible but ghosted (dimmed, not tappable)
4. Dismiss via X, swipe-right, or swipe-down

### Closing the Modal

**Dismiss triggers:**
- X button (top-left)
- Swipe down gesture (threshold: 100px)
- Tap on backdrop
- Hardware back button (Android)
- ESC key (if keyboard attached)

**Dismiss animation:** Slide down + fade out (250ms)

**Swipe-down behavior:** Swipe-down always closes the **topmost layer**:

- If setlist overlay is open → swipe-down closes overlay
- If only modal is showing → swipe-down closes modal
- This matches iOS sheet stacking behavior and is predictable

---

## State Management

### Modal State
```typescript
interface PhoneArtistModalState {
  isOpen: boolean;
  artist: Artist | null;
  activeTab: 'history' | 'upcoming' | 'tracks';
  setlistOverlay: {
    isOpen: boolean;
    concertId: string | null;
  };
}
```

### Tab Visibility Logic
```typescript
const showUpcomingTab = artist?.tourDates && artist.tourDates.length > 0;
const tabs = [
  { id: 'history', label: 'History', icon: 'History' },
  ...(showUpcomingTab ? [{ id: 'upcoming', label: 'Upcoming', icon: 'Calendar' }] : []),
  { id: 'tracks', label: 'Top Tracks', icon: 'spotify' },
];
```

---

## Accessibility

- **Focus trap:** When modal opens, focus trapped within modal
- **Focus on open:** Move focus to modal container or first focusable element
- **Focus on close:** Return focus to triggering artist card
- **Aria labels:**
  - Modal: `aria-modal="true"`, `role="dialog"`, `aria-labelledby` pointing to artist name
  - Tabs: `role="tablist"`, individual tabs have `role="tab"`, `aria-selected`
  - Tab panels: `role="tabpanel"`, `aria-labelledby` pointing to associated tab
- **Escape key:** Closes overlay first, then modal
- **Reduced motion:** Skip slide animations, use instant show/hide

---

## Animation Specifications

| Animation | Duration | Easing | Properties |
|-----------|----------|--------|------------|
| Backdrop fade in | 300ms | `ease-out` | `opacity: 0→1` |
| Backdrop fade out | 250ms | `ease-in` | `opacity: 1→0` |
| Modal open | 300ms | `ease-out` | `opacity: 0→1`, `translateY: 50px→0` |
| Modal close | 250ms | `ease-in` | `opacity: 1→0`, `translateY: 0→50px` |
| Tab underline | 150ms | `ease` | `translateX`, `width` |
| Tab content | instant | — | No animation (or 150ms crossfade) |
| Setlist overlay open | 300ms | `ease-out` | `translateX: 100%→0` |
| Setlist overlay close | 250ms | `ease-in` | `translateX: 0→100%` |

---

## Files to Create

| File | Purpose | LOC Estimate |
|------|---------|--------------|
| `src/components/scenes/ArtistScene/PhoneArtistModal.tsx` | Main modal container | ~200 |
| `src/components/scenes/ArtistScene/PhoneArtistModal.css` | Modal styles (or use Tailwind) | ~150 |
| `src/components/scenes/ArtistScene/ArtistTabBar.tsx` | Reusable tab bar component | ~80 |
| `src/components/scenes/ArtistScene/SetlistOverlay.tsx` | Slide-from-right setlist view | ~100 |
| `src/hooks/useSwipeGesture.ts` | Swipe detection hook (if not existing) | ~60 |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/scenes/ArtistScene/ArtistScene.tsx` | Add viewport detection, conditionally render modal vs gatefold |
| `src/components/scenes/ArtistScene/ConcertHistoryPanel.tsx` | Export content separately for reuse, or add `isPhone` layout variant |
| `src/components/scenes/ArtistScene/SpotifyPanel.tsx` | Add `isPhone` layout variant |
| `src/components/scenes/ArtistScene/LinerNotesPanel.tsx` | Refactor for use in SetlistOverlay |
| `src/components/scenes/ArtistScene/TourDatesPanel.tsx` | Add `isPhone` layout variant |

---

## Implementation Plan

### Phase 1: Modal Shell + Viewport Detection

**Tasks:**
- [ ] Create `PhoneArtistModal.tsx` with basic open/close
- [ ] Add viewport detection hook (or reuse existing)
- [ ] Implement modal open/close animations
- [ ] Add dismiss button (X) functionality
- [ ] Add swipe-down-to-close gesture
- [ ] Wire up in `ArtistScene.tsx`: phone → modal, desktop → gatefold

**Acceptance Criteria:**
- [ ] Modal opens when tapping artist card on phone viewport
- [ ] Modal closes via X button
- [ ] Modal closes via swipe-down
- [ ] Desktop still uses gatefold (no regression)

### Phase 2: Tab Bar + Tab Switching

**Tasks:**
- [ ] Create `ArtistTabBar.tsx` component
- [ ] Implement three tabs with icons (History, Upcoming, Top Tracks)
- [ ] Conditional rendering of Upcoming tab based on tour data
- [ ] Active/inactive state styling
- [ ] Underline animation on tab switch
- [ ] Wire On Tour badge to activate Upcoming tab

**Acceptance Criteria:**
- [ ] Tab bar renders with correct icons
- [ ] Upcoming tab only shows when tour data exists
- [ ] Active tab has underline + white text/icon
- [ ] Tapping badge switches to Upcoming tab
- [ ] Tab switch animation is smooth (150ms)

### Phase 3: Panel Content Integration

**Tasks:**
- [ ] Render `ConcertHistoryPanel` content in History tab
- [ ] Render `SpotifyPanel` content in Top Tracks tab
- [ ] Render `TourDatesPanel` content in Upcoming tab
- [ ] Adapt panel layouts for phone dimensions
- [ ] Ensure scrolling works within each tab

**Acceptance Criteria:**
- [ ] All three tabs display correct content
- [ ] Concert rows show date, location, venue, setlist button
- [ ] Spotify attribution displays correctly
- [ ] Long lists scroll within tab area

### Phase 4: Setlist Overlay + Polish

**Tasks:**
- [ ] Create `SetlistOverlay.tsx` component
- [ ] Implement slide-from-right animation
- [ ] Wire "Setlist" button taps to open overlay
- [ ] Add X dismiss + swipe-right-to-close
- [ ] Ensure ESC closes overlay before modal
- [ ] Add reduced motion support
- [ ] Test on real devices (iOS Safari, Android Chrome)

**Acceptance Criteria:**
- [ ] Setlist overlay slides in from right
- [ ] Overlay displays setlist content correctly
- [ ] X and swipe-right both dismiss overlay
- [ ] ESC key priority: overlay first, then modal
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Works on iPhone SE → iPhone 15 Pro Max
- [ ] Works on Android Chrome

---

## Testing Checklist

### Functional Testing

**Modal:**
- [ ] Opens on artist card tap (phone only)
- [ ] Backdrop fades in behind modal
- [ ] Displays artist photo, name, genre, show count
- [ ] Shows On Tour badge when applicable
- [ ] Closes via X button
- [ ] Closes via swipe-down
- [ ] Closes via backdrop tap
- [ ] Closes via Android back button

**Tabs:**
- [ ] History tab shows concert list
- [ ] Upcoming tab shows tour dates (when available)
- [ ] Upcoming tab hidden when no tour data
- [ ] Top Tracks tab shows Spotify content
- [ ] On Tour badge tap activates Upcoming tab
- [ ] Tab underline animates correctly

**Setlist:**
- [ ] Opens on Setlist button tap
- [ ] Displays correct setlist for selected concert
- [ ] Closes via X button
- [ ] Closes via swipe-right
- [ ] ESC closes overlay first

### Visual Testing

- [ ] Backdrop renders at 70% opacity
- [ ] Modal has correct insets (12px from edges)
- [ ] Typography matches design (Playfair Display for name)
- [ ] Icons render correctly (lucide-react)
- [ ] Spotify logo displays per TOS
- [ ] Colors match theme (muted grays, green accents)
- [ ] Animations are smooth (60fps)

### Device Testing

- [ ] iPhone SE (375px) — smallest viewport
- [ ] iPhone 12/13/14 (390px)
- [ ] iPhone 15 Pro (393px, Dynamic Island safe area)
- [ ] iPhone 15 Pro Max (430px)
- [ ] Android (Pixel, Galaxy) via Chrome

### Accessibility Testing

- [ ] VoiceOver navigates modal correctly
- [ ] Tab roles announced properly
- [ ] Focus trapped in modal
- [ ] Escape key works

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Artist with no Spotify data | Top Tracks tab shows "Coming Soon" skeleton |
| Artist not on tour | Upcoming tab hidden, On Tour badge hidden |
| Artist with 50+ concerts | History tab scrolls, no performance issues |
| Orientation change while modal open | Modal remains open, adjusts layout |
| Viewport resize to desktop (dev tools) | Modal closes, gatefold available |

Note: Artists always have at least one concert by definition (they exist in the system because of a concert record).

---

## Revision History

- **2025-01-08:** Initial specification created (replaces phone-gatefold-vertical.md)
- **Version:** 1.0.0
- **Status:** Planned
