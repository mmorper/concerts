# Venue Scene Enhancement Spec

## Overview

Add a toggle control to the Venue Network scene allowing users to switch between "Top 10" (current curated view) and "All Venues" (complete 77-venue network). The enhancement preserves the existing wow-factor while rewarding exploration.

**Component:** `src/components/scenes/Scene4Bands.tsx`

---

## Visual Design

### Toggle Control

- Match Map scene tab pattern (pill buttons, centered)
- Position: Below title, above network visualization
- States: `[ Top 10 ]  [ All Venues ]`
- Default: Top 10

### Subtitle Behavior

| View | Subtitle |
|------|----------|
| Top 10 | "10 most-visited venues" |
| All Venues | "{n} concert halls and amphitheaters" |

*Note: Count should be dynamically calculated from data*

### Node Sizing in "All" View

- Venue node radius proportional to show count
- Suggested scale: `d3.scaleSqrt().domain([1, maxShows]).range([8, 45])`
- Preserves visual hierarchy — Irvine Meadows dominates, one-off venues are small but visible

### Label Visibility

| Show Count | Label Behavior |
|------------|----------------|
| 3+ shows | Always visible |
| 1-2 shows | Show on hover only |

### Opacity Treatment

- Start with uniform opacity
- If visual testing shows muddy results, consider fading 1-show venues to 0.7 opacity
- Defer to implementation judgment

---

## Interaction Model

### Top 10 View

- No changes from current behavior
- All 10 venues expanded with artist connections visible

### All Venues View

- Default state: 3-5 top venues pre-expanded (maintains UX continuity)
- Remaining venues: collapsed (blue dot only, no artist connections)
- Click any venue → expands to show headliners/openers
- Click away (background or another venue) → previously expanded venue collapses
- Only one "user-expanded" venue at a time (plus the 3-5 default expanded)

### Toggle Switching

- Top 10 → All: Morph transition (see below)
- All → Top 10: Reverse morph (extra venues animate out)

---

## Transition Animation

### Top 10 → All Venues

1. Existing 10 venue nodes stay in place (anchor points)
2. New venue nodes fade in from edges / random positions
3. D3 force simulation re-runs to settle all 77 nodes
4. Duration: ~800ms for new nodes to reach stable positions

### All Venues → Top 10

1. Non-top-10 venues fade out and drift toward edges
2. Top 10 venues remain, simulation re-stabilizes
3. Any expanded artists from removed venues fade with parent

### Fallback

If morph proves too complex, implement crossfade (fade out → fade in, 300ms each)

---

## Data Requirements

### Venue Aggregation

```typescript
interface VenueStats {
  name: string
  showCount: number
  headliners: string[]  // unique artists seen as headliner at this venue
  openers: string[]     // unique artists seen as opener at this venue
  concerts: Concert[]   // full concert records for this venue
}
```

### Computation

Compute at runtime from `concerts.json`:

1. Group concerts by venue name
2. Count shows per venue
3. Sort descending by showCount
4. Top 10 = first 10 after sort

---

## Implementation Checklist

### Phase 1: Data & State

- [ ] Create `useVenueStats()` hook to aggregate venue data
- [ ] Add `viewMode: 'top10' | 'all'` state to component
- [ ] Compute top 10 venues vs all venues lists

### Phase 2: Toggle UI

- [ ] Add toggle buttons matching Map scene pattern
- [ ] Wire toggle to viewMode state
- [ ] Update subtitle text based on viewMode

### Phase 3: All Venues Visualization

- [ ] Modify node generation to include all venues when viewMode is 'all'
- [ ] Implement show-count-based node sizing
- [ ] Implement label visibility threshold (3+ shows)
- [ ] Add hover behavior for unlabeled venues
- [ ] Set default expanded state (top 3-5 venues)

### Phase 4: Click Interactions

- [ ] Track which venues are expanded in state
- [ ] Implement click-to-expand for collapsed venues
- [ ] Implement click-away-to-collapse behavior
- [ ] Ensure smooth expand/collapse animations

### Phase 5: Transition Animation

- [ ] Implement morph transition (Top 10 → All)
- [ ] Implement reverse morph (All → Top 10)
- [ ] Test simulation re-stabilization timing
- [ ] Fallback to crossfade if needed

### Phase 6: Polish

- [ ] Performance test with all 77 venues
- [ ] Verify mobile doesn't choke (note: may disable "All" on mobile later)
- [ ] Accessibility: ensure hover labels work with keyboard focus

---

## Reference Files

| Pattern | File |
|---------|------|
| Current venue network | `src/components/scenes/Scene4Bands.tsx` |
| Toggle UI pattern | `src/components/scenes/Scene3Map.tsx` (region tabs) |
| Force simulation setup | `src/components/scenes/Scene4Bands.tsx` (existing) |
| Concert data | `public/data/concerts.json` |

---

## Mobile Consideration

When mobile-specific optimizations are implemented (future phase), consider hiding "All Venues" toggle on small screens. The dense 77-node network may not perform well or be usable on touch devices.

---

## Open Implementation Details

These can be decided during implementation:

1. **Exact threshold for "top N expanded by default"** — Start with 5, adjust if too busy
2. **Force simulation parameters** — May need tuning for 77 nodes (charge strength, collision radius)
3. **Animation easing** — Use existing app patterns or `d3.easeQuadOut`
