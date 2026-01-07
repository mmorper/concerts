# Timeline Year Filter - Stacked Cards Expansion

## Overview

Add the ability for users to filter/focus on concerts from a specific year in the Timeline scene. When a user taps a timeline dot, other dots fade and concert cards fan out from the selected position, allowing exploration of all shows from that year.

## User Story

As a user viewing the Timeline scene, I want to tap on a year's dot to see all concerts from that year displayed as stacked cards, so I can quickly browse and select a specific show to explore.

## Interaction Flow

### Desktop/Tablet (≥768px)

1. **Tap dot** → Selected dot pulses with scale animation (1.2×), year label becomes emphasized
2. **Other dots fade** → Non-selected dots reduce to 30% opacity
3. **Cards fan out** → Concert cards expand from the selected dot position as a stacked pile
4. **Hover card** → Brings hovered card to front with scale (1.05×) + elevated shadow
5. **Tap card** → Navigates to Artist scene with that artist focused
6. **Tap outside / tap dot again** → Collapse cards, restore all dots to normal state

### Mobile (<768px)

- **No change** to existing behavior
- Dots remain tap-to-preview only (existing hover card behavior)
- Stacked cards expansion is disabled on mobile due to space constraints

## Visual Specifications

### Year Label Enhancement (Focus Mode)

When a year is selected, the year display should be more prominent:

| Property | Default | Focus Mode |
|----------|---------|------------|
| Font weight | 400 | 700 (bold) |
| Scale | 1.0 | 1.1 |
| Color | slate-400 | white (#ffffff) |
| Text shadow | none | `0 0 8px rgba(255,255,255,0.3)` |

Transition: 150ms ease-out

### Dot States

| State | Opacity | Scale | Border |
|-------|---------|-------|--------|
| Default | 100% | 1.0 | 2px white/60 |
| Selected | 100% | 1.2 | 2px white |
| Faded (other dots) | 30% | 1.0 | 2px white/30 |

### Stacked Cards Layout

Cards should fan out horizontally from the dot position, with overlap based on count:

| Concert Count | Layout | Offset |
|--------------|--------|--------|
| 1 | Single card, centered | - |
| 2 | Side by side, no overlap | 0px |
| 3-5 | Fan with moderate overlap | ~25px horizontal offset |
| 6+ | Tighter overlap + count badge | ~15px horizontal offset |

#### Card Dimensions

- Width: 180px
- Height: auto (based on content)
- Border radius: 12px
- Background: Match existing TimelineHoverPreview card style

#### Card Content

Each card displays:
- Artist image (top, 100px height)
- Artist name (bold)
- Venue name
- Date (month/day)

#### Stack Appearance

- Optional: slight rotation per card (-2° to +2°) for organic "pile" feel
- Base z-index: stack position (first card lowest)
- Maximum visible stack width: ~300px (prevents overflow)

### Card Hover/Focus State

| Property | Default | Hovered |
|----------|---------|---------|
| z-index | stack position | top (999) |
| Scale | 1.0 | 1.05 |
| Shadow | `0 4px 12px rgba(0,0,0,0.3)` | `0 8px 24px rgba(0,0,0,0.5)` |
| Transition | - | 150ms ease-out |

### Card Count Badge (6+ concerts)

When a year has 6 or more concerts, show a count badge:

- Position: Top-right of stack
- Style: Pill shape, white background, slate-800 text
- Content: "N shows" (e.g., "8 shows")
- Size: 12px font, 4px 8px padding

## Animation Timing

| Animation | Duration | Easing |
|-----------|----------|--------|
| Dot pulse on select | 200ms | ease-out |
| Other dots fade | 150ms | ease-out |
| Cards fan out | 300ms | spring (stagger 50ms per card) |
| Card hover scale | 150ms | ease-out |
| Collapse all | 200ms | ease-in |

## Accessibility

- Selected dot receives focus ring
- Cards are keyboard navigable (Tab to cycle, Enter to select)
- Screen reader announces: "2017 selected, 3 concerts" when dot tapped
- Escape key dismisses expanded state

## Haptic Feedback

| Action | Pattern |
|--------|---------|
| Tap dot to expand | `haptics.medium()` |
| Hover/focus card | `haptics.light()` |
| Select card | `haptics.light()` |
| Dismiss/collapse | `haptics.light()` |

## Edge Cases

1. **Single concert year**: Show single card without stack effect
2. **Dot near edge**: Cards fan toward center to stay in viewport
3. **Many concerts (10+)**: Cap visible cards at 8, show "+N more" indicator
4. **Rapid dot switching**: Debounce 100ms to prevent jarring transitions

## Technical Notes

### State Management

```typescript
interface YearFilterState {
  selectedYear: number | null
  isExpanded: boolean
  hoveredCardIndex: number | null
}
```

### Responsive Check

```typescript
const isTabletOrLarger = window.innerWidth >= 768

// Only enable stacked cards on tablet+
const handleDotClick = (year: number) => {
  if (isTabletOrLarger) {
    setSelectedYear(year)
    setIsExpanded(true)
  }
  // Mobile: existing preview behavior continues
}
```

### Component Structure

```
Scene1Timeline/
├── TimelineDots.tsx (existing, add selection state)
├── YearCardStack.tsx (new)
│   ├── StackedCard.tsx (new)
│   └── CardCountBadge.tsx (new)
└── useYearFilter.ts (new hook)
```

## Out of Scope

- Filtering by multiple years simultaneously
- Year range selection (e.g., 2015-2020)
- Animated card sorting/reordering
- Card swipe gestures on mobile

## Success Metrics

- Users can discover all concerts from a specific year within 2 taps
- Card hover-to-focus provides clear visual feedback
- No performance degradation with 10+ cards
- Graceful degradation on mobile (no broken UI)
