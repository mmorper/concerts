# Upcoming Tour Dates - Visual Design Mock

**Feature:** Tour dates badge + sliding panel (Option A: Eager loading)
**Date:** 2026-01-05
**Status:** Design Mock for Implementation

---

## 🎯 Design Philosophy

**"Tour Poster on the Wall"** - While liner notes slide out from the left (past concerts), tour posters slide from the right (future dates). The badge acts like spotting a fresh tour poster - it catches your eye with a subtle pulse, showing the artist is actively on the road.

---

## 📐 Component Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  The Artists                                     │
│                            251 artists · 178 concerts                            │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                            │ │
│  │  ┌──────────────────────┐ ┌──────────────────────┐                       │ │
│  │  │                      │ │                      │                       │ │
│  │  │   CONCERT HISTORY    │ │    SPOTIFY PANEL     │                       │ │
│  │  │   (Left Panel)       │ │    (Right Panel)     │                       │ │
│  │  │                      │ │                      │                       │ │
│  │  │   - Artist Photo     │ │   - Top Tracks       │                       │ │
│  │  │   - Tour Badge 🎫    │ │   - Coming Soon      │                       │ │
│  │  │   - Concert List     │ │                      │                       │ │
│  │  │                      │ │                      │                       │ │
│  │  └──────────────────────┘ └──────────────────────┘                       │ │
│  │                                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│                    Click anywhere or press ESC to close                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Mock 1: Tour Badge in Concert History Header

### State 1: Artist NOT Touring (No Badge)
```
┌──────────────────────────────────────────────┐
│                                              │
│  ┌────────┐                                  │
│  │        │   The National                 🔗│
│  │  [TN]  │   Indie Rock · 4 shows           │
│  │        │                                  │
│  └────────┘                                  │
│                                              │
│  CONCERT HISTORY                             │
│  ────────────────────────────────────────    │
│                                              │
│  15 Oct 2023    Madison Square Garden    ♪  │
│  22 Mar 2019    The Anthem               ♪  │
│  10 Sep 2017    9:30 Club                ♪  │
│  05 Jun 2014    Merriweather Post        ♪  │
│                                              │
└──────────────────────────────────────────────┘
```

### State 2: Artist IS Touring (Badge Visible + Pulsing)
```
┌──────────────────────────────────────────────┐
│                                              │
│  ┌────────┐                                  │
│  │        │   The National                 🔗│
│  │  [TN]  │   Indie Rock · 4 shows           │
│  │        │   ● ON TOUR · 12 dates    ←──┐  │ ◄── NEW!
│  └────────┘   └─────────────────────┘    │  │     Pulsing green dot
│               ▲                           │  │     Spotify green badge
│               │                           │  │     Clickable
│               │                           │  │
│               └───────────────────────────┘  │
│                   Appears on gatefold open   │
│                   (after API check)          │
│                                              │
│  CONCERT HISTORY                             │
│  ────────────────────────────────────────    │
│                                              │
│  15 Oct 2023    Madison Square Garden    ♪  │
│  22 Mar 2019    The Anthem               ♪  │
│  10 Sep 2017    9:30 Club                ♪  │
│  05 Jun 2014    Merriweather Post        ♪  │
│                                              │
└──────────────────────────────────────────────┘
```

**Visual Specs for Badge:**
```
┌─────────────────────────────┐
│ ● ON TOUR · 12 dates        │
└─────────────────────────────┘
 ▲   ▲        ▲
 │   │        └── Date count (dynamic)
 │   └─────────── Label (uppercase, tracking-wider)
 └─────────────── Pulsing dot (6px, animates opacity)

• Background: rgba(29, 185, 84, 0.15) — Spotify green tint
• Border: 1px solid rgba(29, 185, 84, 0.3)
• Border Radius: 12px (pill shape)
• Padding: 6px 12px
• Font: Source Sans 3, 0.75rem (12px), 600 weight
• Color: #1DB954 (Spotify green)
• Letter Spacing: 0.05em
• Text Transform: uppercase
• Cursor: pointer
• Transition: all 150ms ease

HOVER STATE:
• Background: rgba(29, 185, 84, 0.25) — Brighter
• Border: 1px solid rgba(29, 185, 84, 0.5) — Stronger
• Transform: scale(1.02) — Subtle grow
• Haptic: light feedback
```

---

## 🎬 Mock 2: Tour Dates Panel Sliding Animation

### Sequence: User Clicks "ON TOUR" Badge

**Frame 1: Initial State (Badge Clicked)**
```
┌────────────────────────────┬────────────────────────────┐
│                            │                            │
│  The National              │   🟢 TOP TRACKS            │
│  ● ON TOUR · 12 dates  ✓   │                            │
│  ────────────────           │   ▶️ Play                  │
│                            │                            │
│  15 Oct 2023  MSG      ♪   │   1. [Track]               │
│  22 Mar 2019  Anthem   ♪   │   2. [Track]               │
│                            │   3. [Track]               │
│                            │                            │
└────────────────────────────┴────────────────────────────┘
         LEFT PANEL                   RIGHT PANEL
```

**Frame 2: Tour Panel Sliding In (150ms elapsed)**
```
┌────────────────────────────┬──────────────┬─────────────┐
│                            │              │             │
│  The National              │   🟢 TOP TR  │  The Natio  │ ◄── Sliding
│  ● ON TOUR · 12 dates  ✓   │              │  On Tour    │     from right
│  ────────────────           │   ▶️ Play    │             │
│                            │              │  Loading... │
│  15 Oct 2023  MSG      ♪   │   1. [Track  │             │
│  22 Mar 2019  Anthem   ♪   │   2. [Track  │             │
│                            │              │             │
└────────────────────────────┴──────────────┴─────────────┘
         LEFT PANEL           RIGHT PANEL     TOUR PANEL
                              (dimming)       (entering)
                              opacity→0.3     translateX(100%→0)
```

**Frame 3: Tour Panel Fully Visible (400ms complete)**
```
┌────────────────────────────┬────────────────────────────┐
│                            │                         ✕  │ ◄── Close button
│  The National              │  The National              │
│  ● ON TOUR · 12 dates  ✓   │  On Tour · 12 dates        │
│  ────────────────           │  ───────────────────────   │
│                            │                            │
│  15 Oct 2023  MSG      ♪   │  UPCOMING SHOWS            │
│  22 Mar 2019  Anthem   ♪   │                            │
│                            │  ○ Mar 15, 2026            │
│                            │    Madison Square Garden   │
│                            │    New York, NY            │
│                            │    [Get Tickets →]         │
│                            │                            │
│                            │  ○ Mar 18, 2026            │
│                            │    The Anthem              │
│                            │    Washington, DC          │
│                            │    [Get Tickets →]         │
│                            │                            │
│                            │  ...                       │
│                            │                            │
│                            │  via Bandsintown           │
└────────────────────────────┴────────────────────────────┘
         LEFT PANEL                   TOUR PANEL
    (remains visible)            (covering Spotify)
```

---

## 🎨 Mock 3: Tour Dates Panel - Complete Design

### Full Panel Layout (380×380px content, 400×400px with padding)

```
┌──────────────────────────────────────────────┐
│  ✕                                           │ ← Close button (top-right, 16px inset)
│                                              │
│  The National                                │ ← Artist name (Playfair Display, 28px)
│  On Tour · 12 dates                          │ ← Status + count (Source Sans 3, Spotify green)
│  ──────────────────────────────────────────  │ ← Subtle divider
│                                              │
│  UPCOMING SHOWS                              │ ← Section header (12px, uppercase, green)
│                                              │
│  ○  Mar 15, 2026                             │ ← Date (15px, semibold, white)
│     Madison Square Garden                    │ ← Venue (14px, light gray)
│     New York, NY                             │ ← Location (13px, medium gray)
│     [Get Tickets →]                          │ ← Ticket link (13px, green, underline on hover)
│                                              │
│  ○  Mar 18, 2026                             │
│     The Anthem                               │
│     Washington, DC                           │
│     [Get Tickets →]                          │
│                                              │
│  ○  Mar 22, 2026                             │
│     Hollywood Bowl                           │
│     Los Angeles, CA                          │
│     [Get Tickets →]                          │
│                                              │
│  ○  Apr 02, 2026                             │
│     Red Rocks Amphitheatre                   │
│     Morrison, CO                             │
│     [Get Tickets →]                          │
│                                              │
│  ○  Apr 05, 2026                             │ ┐
│     The Fillmore                             │ │ Scrollable
│     San Francisco, CA                        │ │ area
│     [Get Tickets →]                          │ │
│                                              │ │
│  ... (7 more dates)                          │ ┘
│                                              │
│  via Bandsintown                             │ ← Attribution (11px, gray)
└──────────────────────────────────────────────┘

COLOR PALETTE:
• Background: rgba(24, 24, 24, 0.98) — Nearly opaque dark
• Border: 1px inner border rgba(255, 255, 255, 0.1)
• Shadow: 0 10px 40px rgba(0, 0, 0, 0.6) on left edge
• Artist Name: #ffffff (white)
• Status Label: #1DB954 (Spotify green)
• Section Header: #1DB954 (uppercase, tracking-wider)
• Date: #ffffff (white)
• Venue: #e5e5e5 (light gray)
• Location: #a3a3a3 (medium gray)
• Ticket Link: #1DB954 (green, → #22c55e on hover)
• Attribution: #737373 (dark gray)
• Circle Icon: #1DB954 (8px)

SPACING:
• Top Padding: 32px (close button clearance)
• Horizontal Padding: 32px
• Bottom Padding: 32px
• Header Spacing: 8px between lines
• Divider Margin: 20px top, 24px bottom
• Date Block Spacing: 20px between blocks
• Date Internal Spacing: 4px between lines, 8px before ticket link
```

---

## 🎬 Mock 4: Panel States

### Loading State
```
┌──────────────────────────────────────────────┐
│  ✕                                           │
│                                              │
│  The National                                │
│  Checking tour dates...                      │
│  ──────────────────────────────────────────  │
│                                              │
│  ████████░░░░░░░░░░░                         │ ← Skeleton bar (animated)
│  ██████░░░░░░░░░░░░░░                        │
│                                              │
│  ████████████░░░░░░░░                        │
│  ████████░░░░░░░░░░░░                        │
│                                              │
│  ██████████░░░░░░░░░░                        │
│  ████████░░░░░░░░░░░░                        │
│                                              │
│                                              │
│  Loading from Bandsintown...                 │ ← Status text
│                                              │
└──────────────────────────────────────────────┘
```

### No Dates State (Artist Not Touring)
```
┌──────────────────────────────────────────────┐
│  ✕                                           │
│                                              │
│  The National                                │
│  Not currently touring                       │ ← Gray text (not green)
│  ──────────────────────────────────────────  │
│                                              │
│              🎫                              │ ← Large ticket emoji
│                                              │
│         No upcoming shows                    │
│              scheduled                       │
│                                              │
│     Check back later or follow               │
│     the artist on Bandsintown                │
│       to get notified.                       │ ← Encouraging message
│                                              │
│                                              │
│                                              │
│  via Bandsintown                             │
└──────────────────────────────────────────────┘
```

### Error State
```
┌──────────────────────────────────────────────┐
│  ✕                                           │
│                                              │
│  The National                                │
│  Unable to load tour dates                   │ ← Red/orange text
│  ──────────────────────────────────────────  │
│                                              │
│              ⚠️                               │ ← Warning emoji
│                                              │
│      Unable to load tour dates               │
│                                              │
│      Check your connection and               │
│         try again later.                     │
│                                              │
│                                              │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🎯 Mock 5: Badge Hover States

### Default State (Not Hovered)
```
┌─────────────────────────────┐
│ ● ON TOUR · 12 dates        │  opacity: 0.15 background
└─────────────────────────────┘  opacity: 0.3 border
     ▲ Pulsing (2s cycle)
```

### Hover State
```
┌─────────────────────────────┐
│ ● ON TOUR · 12 dates        │  opacity: 0.25 background (brighter)
└─────────────────────────────┘  opacity: 0.5 border (stronger)
  ▲ Still pulsing                 scale: 1.02 (subtle grow)
  cursor: pointer
```

### Active/Clicked State (Panel Open)
```
┌─────────────────────────────┐
│ ✓ ON TOUR · 12 dates        │  ✓ checkmark replaces dot
└─────────────────────────────┘  opacity: 0.3 background (brightest)
  No pulsing                      opacity: 0.6 border (strongest)
  Shows panel is active           cursor: pointer (still clickable to close)
```

---

## 🎬 Mock 6: Both Panels Open Scenario

### Left Panel (Setlist) + Right Panel (Tour Dates) Both Open
```
┌──────────────────┬─────────────────┬──────────────────┐
│                  │  ✕              │               ✕  │ ← Two close buttons
│                  │                 │                  │
│  The National    │  12 Oct 1999    │  The National    │
│  ● ON TOUR  ✓    │  Paradise Rock  │  On Tour · 12    │
│  ─────────       │  ─────────────  │  ─────────────   │
│                  │                 │                  │
│  15 Oct 2023 ♪✓  │  TOUR: High Vio │  UPCOMING SHOWS  │
│  22 Mar 2019 ♪   │                 │                  │
│  10 Sep 2017 ♪   │  SET 1          │  ○ Mar 15, 2026  │
│  05 Jun 2014 ♪   │  1. Song A      │    MSG           │
│                  │  2. Song B      │    [Tickets →]   │
│                  │  3. Song C      │                  │
│                  │                 │  ○ Mar 18, 2026  │
│                  │  ENCORE         │    The Anthem    │
│                  │  1. Song X      │    [Tickets →]   │
│                  │                 │                  │
│                  │  via setlist.fm │  via Bandsintown │
└──────────────────┴─────────────────┴──────────────────┘
   LEFT PANEL         LINER NOTES        TOUR PANEL
   (History)          (Center position)  (Covering Spotify)
   400px wide         400px wide          400px wide

TOTAL WIDTH: 1200px (3 panels)
BEHAVIOR:
• Both panels can be open simultaneously
• Each has independent close button
• ESC closes most recent panel first
• Clicking outside closes tour dates first (if open), then setlist
• User can toggle between views by clicking badges/buttons
```

---

## 🎨 Mock 7: Animation Timing Chart

```
USER CLICKS "ON TOUR" BADGE
│
├─ 0ms    │ Badge changes: ● → ✓
│         │ haptics.light() feedback
│         │
├─ 0ms    │ Tour panel starts sliding from right
│         │ Initial: translateX(100%) — off-screen
│         │ Target: translateX(0) — visible
│         │ Easing: cubic-bezier(0.4, 0, 0.2, 1)
│         │ Duration: 400ms
│         │
├─ 0ms    │ Spotify panel starts dimming (if no liner notes open)
│         │ Initial: opacity 1.0
│         │ Target: opacity 0.3
│         │ Duration: 400ms (synchronized with slide)
│         │
├─ 50ms   │ Loading skeleton appears in tour panel
│         │ Shows animated bars
│         │ Text: "Loading from Bandsintown..."
│         │
├─ 400ms  │ Slide animation completes
│         │ Panel fully visible
│         │
├─ 400-1000ms │ API call completes (cached or fresh)
│             │ Loading state → Success/Error/Empty state
│             │ Fade in: opacity 0 → 1 over 200ms
│             │
└─ 600ms+     │ User sees tour dates (or empty/error state)
              │ Can scroll, click ticket links
              │ ESC or ✕ to close

CLOSE ANIMATION (USER CLICKS ✕ OR ESC)
│
├─ 0ms    │ Badge changes: ✓ → ●
│         │ haptics.light() feedback
│         │
├─ 0ms    │ Tour panel slides right off-screen
│         │ Initial: translateX(0)
│         │ Target: translateX(100%)
│         │ Duration: 350ms
│         │
├─ 0ms    │ Spotify panel brightens
│         │ Initial: opacity 0.3
│         │ Target: opacity 1.0
│         │ Duration: 350ms (synchronized)
│         │
└─ 350ms  │ Tour panel removed from DOM
          │ State cleared
```

---

## 🎯 Mock 8: Eager Loading Flow (Option A)

### System Behavior Timeline

```
USER OPENS GATEFOLD
│
├─ 0ms        │ Gatefold animation begins
│             │ Flying tile → Center → Book opens
│             │
├─ 800ms      │ Gatefold fully open
│             │ Concert History + Spotify panels visible
│             │
├─ 850ms      │ 🚀 EAGER TOUR CHECK BEGINS (background)
│             │ fetchTourDates(artistName)
│             │ Check cache first (24hr TTL)
│             │
├─ 850-1500ms │ API call or cache lookup
│             │ User doesn't see any loading state yet
│             │ This happens silently in background
│             │
├─ 1500ms     │ ✅ IF TOUR DATES FOUND:
│             │    Badge fades in (200ms animation)
│             │    ● ON TOUR · 12 dates
│             │    Badge pulses subtly
│             │    User can now click to open panel
│             │
│             │ ❌ IF NO TOUR DATES:
│             │    Badge doesn't appear
│             │    No visual change
│             │    Cache empty result (24hr)
│             │    User sees normal gatefold
│             │
│             │ ⚠️  IF API ERROR:
│             │    Badge doesn't appear
│             │    Fail silently (don't disrupt experience)
│             │    Log error to console
│             │    User can still use other features
│             │
└─ Done       │ Gatefold ready
              │ Badge visible if artist touring
              │ User explores naturally

CACHE STRATEGY:
• Key: `tour_dates:${artistName.toLowerCase()}`
• TTL: 24 hours (86400000ms)
• Storage: In-memory Map (session-only)
• Contents: { dates: TourEvent[], timestamp: number, count: number }
• Cache hit: Instant badge appearance (<10ms)
• Cache miss: 300-800ms API call, then cache result

BENEFITS:
✅ User sees badge immediately if relevant
✅ No extra click to "check" if touring
✅ Natural discovery (badge draws attention)
✅ Cache prevents redundant checks
✅ Fails gracefully (no error shown to user)
✅ Non-blocking (doesn't delay gatefold open)
```

---

## 🎨 Mock 9: Badge Fade-In Animation

### Badge Appearance After Eager Check

```
FRAME 1 (t=0ms) - No Badge
┌──────────────────────────────┐
│  [Photo]  The National       │
│           Indie Rock · 4     │
│           ░░░░░░░░░░░░░░░░  │ ← Empty space (no badge yet)
└──────────────────────────────┘

FRAME 2 (t=100ms) - Badge Fading In
┌──────────────────────────────┐
│  [Photo]  The National       │
│           Indie Rock · 4     │
│           ○ ON TOUR · 12 d   │ ← opacity: 0.3, scale: 0.95
└──────────────────────────────┘

FRAME 3 (t=200ms) - Badge Fully Visible
┌──────────────────────────────┐
│  [Photo]  The National       │
│           Indie Rock · 4     │
│           ● ON TOUR · 12 da  │ ← opacity: 1.0, scale: 1.0
└──────────────────────────────┘      Pulsing begins

ANIMATION CSS:
@keyframes badge-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.tour-badge-entering {
  animation: badge-enter 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 📱 Mock 10: Mobile Considerations (Future)

### Mobile Layout (< 768px width)

```
┌──────────────────────────┐
│                          │
│  ┌────┐ The National     │
│  │[TN]│ Indie · 4 shows  │
│  └────┘ ● TOUR · 12 ←─┐  │ ◄── Badge still visible
│                        │  │      Smaller text
│  CONCERT HISTORY       │  │
│  ───────────────       │  │
│                        │  │
│  15 Oct 2023    MSG    │  │
│  22 Mar 2019    Anthem │  │
│  10 Sep 2017    9:30   │  │
│                        │  │
└────────────────────────┘  │
                            │
CLICK BADGE ON MOBILE:      │
                            │
┌────────────────────────┐  │
│  ✕  The National       │ ◄┘─ Bottom sheet slides up
│  On Tour · 12 dates    │      Covers bottom 70% of screen
│  ──────────────────    │      Still shows artist header above
│                        │
│  UPCOMING SHOWS        │
│                        │
│  ○ Mar 15, 2026        │
│    MSG                 │
│    New York, NY        │
│    [Get Tickets →]     │
│                        │
│  ... (scrollable)      │
│                        │
└────────────────────────┘

NOTE: Mobile spec details in separate doc
      (see: mobile-optimization.md)
```

---

## 🎯 Implementation Checklist

### Phase 1: Badge Component
- [ ] Create `TourBadge.tsx` component
- [ ] Implement pulsing dot animation
- [ ] Add hover/active states
- [ ] Add haptic feedback on click
- [ ] Handle state changes (● / ✓)
- [ ] Position in Concert History header

### Phase 2: Eager Loading Logic
- [ ] Create `useTourDates()` hook
- [ ] Implement cache layer (24hr TTL)
- [ ] Fetch on gatefold open (background)
- [ ] Handle cache hit/miss
- [ ] Error handling (silent fail)
- [ ] Badge appearance animation

### Phase 3: Tour Dates Panel
- [ ] Create `TourDatesPanel.tsx` component
- [ ] Implement slide animation (translateX)
- [ ] Loading skeleton state
- [ ] Success state with date list
- [ ] Empty state (not touring)
- [ ] Error state
- [ ] Scrollbar styling
- [ ] Close button functionality

### Phase 4: Integration
- [ ] Wire badge click to panel open
- [ ] Spotify panel dimming
- [ ] Handle both panels open scenario
- [ ] ESC key handling (close priority)
- [ ] Click-outside handling
- [ ] Badge state sync (● ↔ ✓)
- [ ] Focus management (accessibility)

### Phase 5: Polish
- [ ] All animations at 60fps
- [ ] Smooth transitions
- [ ] Proper z-index layering
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Test with various artist names
- [ ] Test cache behavior
- [ ] Cross-browser testing

---

## 🎨 Color Reference Card

```
TOUR BADGE COLORS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● Dot Color:        #1DB954 (Spotify green)
● Text Color:       #1DB954
● Background:       rgba(29, 185, 84, 0.15) → 0.25 on hover
● Border:           rgba(29, 185, 84, 0.3) → 0.5 on hover
● Active Bg:        rgba(29, 185, 84, 0.3)
● Active Border:    rgba(29, 185, 84, 0.6)

TOUR DATES PANEL COLORS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● Background:       rgba(24, 24, 24, 0.98)
● Border:           rgba(255, 255, 255, 0.1)
● Shadow:           0 10px 40px rgba(0, 0, 0, 0.6)
● Artist Name:      #ffffff
● Status Label:     #1DB954
● Section Header:   #1DB954 (uppercase)
● Date Text:        #ffffff
● Venue Text:       #e5e5e5
● Location Text:    #a3a3a3
● Ticket Link:      #1DB954 → #22c55e (hover)
● Attribution:      #737373
● Circle Icon:      #1DB954

STATES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● Loading:         Skeleton bars rgba(29, 185, 84, 0.1)
● Empty:           Gray text #a3a3a3
● Error:           Warning text #f59e0b (amber)
```

---

## 🎬 Final Notes

### Design Intent
The tour badge creates a **"live status indicator"** feeling - like seeing a red recording light or a green "on air" sign. The pulsing dot subtly suggests activity and currency. When clicked, the tour poster sleeve slides out from the right, maintaining the vinyl metaphor while showing forward-looking information.

### Interaction Philosophy
- **Discoverability:** Badge appears automatically when relevant
- **Clarity:** Date count shows immediate value ("12 dates")
- **Efficiency:** One click from badge to full tour schedule
- **Consistency:** Mirrors setlist button pattern on opposite side
- **Delight:** Smooth animations, haptic feedback, polished states

### Technical Philosophy
- **Eager but non-blocking:** Check tours in background, don't delay gatefold
- **Cache-first:** Respect API limits, provide instant experience
- **Fail gracefully:** Never disrupt the core gatefold experience
- **Performance:** All animations 60fps, minimal re-renders
- **Accessibility:** Full keyboard navigation, screen reader support

---

**Ready for implementation!** 🚀

This mock provides complete visual specifications for the tour dates feature using the badge approach (Option A: Eager loading). All measurements, colors, animations, and states are fully specified.

