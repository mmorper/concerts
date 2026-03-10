# Session Handoff — 2026-03-10

## What Was Completed

- **Progressive cascade animation overhaul** — rewrote the animation runner from three separate handlers into a single `runFullCascade` function that only starts after T0 (artist + venue + date) are all selected
- **T1 sequential column reveal** — added `t1ColStep` state (0→1→2→3) to gate derive/normalize/parse columns appearing one at a time, left-to-right with 350ms between each
- **Pill metadata pre-population bug fixed** — initialized `pillCounts` to explicit `{ t1a: 0, t1v: 0, ... }` so `visibleCount={0}` prevents pills showing on column mount
- **T0 input counter** — "180 concerts × 3 fields = 540 total inputs" now counts from 0→540 using `requestAnimationFrame` steps of 20, appears before the T1 connector fires
- **T1 field counter** — "19 fields per concert" footer counts from 1→19 at 35ms/number after all T1 pills populate; hidden until counter starts
- **Mirror-pause between T1 columns** — after artist pills (3×120ms), pause 360ms; after venue pills (4×120ms), pause 480ms; then date pills; then counter
- **Solari board flip animation** — replaced framer-motion `rotateX` (which was rendering as a slide, not a flip) with native CSS `@keyframes pillFlipIn` using `perspective(300px) rotateX(-90deg) → rotateX(0deg)` baked directly into the transform; `cubic-bezier(0, 0, 0.2, 1)` easing gives the "slap into place" feel
- **Inter-pill delay increased to 120ms** across all tiers so cards read as clearly sequential (animation is 200ms, 80ms gap between each card landing and next starting)
- **All timers use rAF for counters** — T0 and T1 counters use `requestAnimationFrame` to avoid React 18 automatic batching collapsing rapid setState calls into a single render

## Releases Shipped

(none this session — all changes uncommitted)

## In Progress / Pending

- **Tier collapse + accordion system** — the major next feature. After each tier fully animates, it auto-collapses after 1500ms into a compact "summary card." All tiers end up collapsed in a stack at the top. Clicking any collapsed tier expands it (exclusive accordion, Solari re-animation on expand). This is the solution to the viewport/scroll problem.

## Key Decisions

1. **Single `runFullCascade` runner** — replaces three old runners (`runArtistAnim`, `runVenueAnim`, `runConvergenceAnim`). Starts only after T0 is fully resolved (all three atoms selected). Synchronous chain: `handleArtistSelect → doVenueSelect → doDateSelect → runFullCascade`.

2. **CSS `@keyframes` over framer-motion for pill flip** — framer-motion's `rotateX` with `transformPerspective` didn't produce visible 3D; perspective wasn't compositing correctly through the transform chain. Native CSS `perspective()` inside the transform string works reliably. No `AnimatePresence` needed for enter-only animations.

3. **rAF for counters** — React 18 automatic batching was collapsing setState calls at 5ms/15ms intervals into single renders, making counters jump to final value instantly. `requestAnimationFrame` guarantees one state update per paint frame.

4. **`pillCounts` initialized to `{ t1a: 0, ... }` not `{}`** — `PillGrid` treats `visibleCount={undefined}` as "show default 3," which caused pills to appear on column mount before the runner incremented them. Explicit `0` initialization fixes this.

5. **Tier collapse design decisions confirmed:**
   - Auto-collapse, no "Continue" button
   - 1500ms hold after tier completes, then 400ms smooth accordion close
   - T1 collapsed state: `</>` code icon + "19 fields derived" summary chip
   - Connector lines: keep as-is for now, see what plays out
   - On re-expand: replay Solari flip animation (not just height reveal)
   - Exclusive accordion (one tier open at a time) — free expand deferred
   - Replay animation on re-expand: YES, pills should Solari-animate back in

6. **CSS animation replay bug (known, not yet fixed)** — React reuses DOM nodes with same `key` (`tag.key` = field name like `"year"`). On reset + re-select, the CSS animation won't replay because the DOM element already exists. Fix: include generation counter in key: `key={tag.key + '-' + gen}`. Not yet implemented.

7. **Inline `<style>` tag in PillGrid** — `@keyframes pillFlipIn` is injected inside `PillGrid`'s render. Works but is fragile (duplicate tags on re-render). Should be moved to global CSS (`src/index.css` or cascade-specific file) eventually.

## Relevant GitHub Issues

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| #83 | Epic: Cascade — Interactive Hydration Visualization | Open | This session's entire focus. Collapse system is the next major milestone. |

## Next Steps for Next Session

1. **Implement tier collapse system** — this is the primary task. Architecture:
   - Add `collapsedTiers: Set<number>` state to `CascadePage`
   - Add `expandedTier: number | null` state for accordion
   - In `runFullCascade`: after each tier's animation completes, `await delay(1500)` then `collapseT(n)` which adds to `collapsedTiers`
   - Render: when `collapsedTiers.has(n)`, render the tier's compact summary card instead of full content
   - Summary card per tier:
     - T0: artist name + venue + date (the three atoms, horizontal)
     - T1: `</>` icon + "The Build Pipeline" + "19 fields derived" chip
     - T2: Google Places favicon + venue name + field count chip
     - T3: TheAudioDB + Last.fm + MusicBrainz favicons + artist name
     - T4: Apple Music favicon + "N tracks indexed"
     - T5: setlist.fm + Ticketmaster favicons + "N songs · N tour dates"
   - Clicking a collapsed tier: `setExpandedTier(n)` (close currently expanded), smooth height transition open, pills Solari-animate back in
   - Connector lines: leave as-is for now
   - Auto-scroll: after collapsing and before next tier reveals, `scrollIntoView` the next tier smoothly

2. **Fix CSS animation replay bug** — in `CascadeApiEngine.tsx` `PillGrid`, change `key={tag.key}` to `key={tag.key + '-' + generationKey}` where `generationKey` is passed as a prop from `CascadePage` (use `genRef.current`). This forces DOM remount on reset, replaying the flip animation.

3. **Move `@keyframes pillFlipIn` to global CSS** — cut from inline `<style>` in `PillGrid.tsx`, paste into `src/index.css`. Minor cleanup but prevents duplicate style injection.

4. **Consider adding auto-scroll** — after each tier fully animates, scroll to keep the active tier in view. Simple approach: `tierRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })` with a small top offset.

## Files to Know About

- `src/components/cascade/CascadePage.tsx` — main file, ~1200 lines. Contains all state, runner, and render. The `runFullCascade` function (line ~411) is the animation heart.
- `src/components/cascade/CascadeApiEngine.tsx` — contains `PillGrid` (the Solari flip component), `CodeTransform`, `ServiceGatewayPeer`, `FlowArrow`. The inline `<style>` for `pillFlipIn` is here.
- `src/components/cascade/AnimatedConnector.tsx` — SVG `motion.path` pathLength 0→1, `duration` prop (called with 800ms).

## State Inventory (CascadePage)

```typescript
// Selection
selectedArtistNorm, selectedArtistDisplay
selectedVenueNorm, venueMeta
selectedConcert
flowPhase: 'idle' | 'artist-hydrating' | 'venue-pending' | 'date-pending' | 'convergence' | 'complete'

// Animation gating
tiersVisible: Set<number>       // which tiers are mounted at all
connectorPhase: number          // which AnimatedConnectors are mounted (0-5)
t0InputCount: number            // 0=hidden, 1-540=counter
t1ColStep: number               // 0=none, 1=artist col, 2=+venue, 3=+date
t1FieldCount: number            // 0=hidden, 1-19=counter
t2RevealStep: number            // 0=nothing, 2=image visible
pillCounts: Record<string, number>  // t1a, t1v, t1d, t2, t3, t4, t5s, t5t
setlistLines: number
scenesUnlocked: number
loadingTier: number | null

// To be added:
collapsedTiers: Set<number>     // tiers in compact summary state
expandedTier: number | null     // which collapsed tier is currently open
```
