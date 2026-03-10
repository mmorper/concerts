# Cascade Progressive Disclosure

**Status:** Planned
**Target Version:** v4.6.0
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** None (self-contained within Cascade page)

---

## Executive Summary

The Cascade page adopts a progressive disclosure animation model. On load, only Tier 0 (the seed picker) is visible — everything below is hidden until earned. Selecting an artist triggers an animated connector line that grows downward to reveal Tier 1; as each tier's connector completes, that tier fades/slides into view with its columns hydrating left to right. The same connector-then-reveal motion cascades down through each subsequent tier in sequence. The result is a page that teaches the pipeline by *performing* it, one tier at a time.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Cascade Progressive Disclosure feature for Morperhaus Concerts.

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
- Tiers start fully hidden (not dimmed) and reveal one at a time
- An animated SVG connector line grows downward between each tier boundary
- When the line completes, the destination tier fades/slides in (y: 16→0, opacity: 0→1)
- Within each tier, columns hydrate left to right with a stagger delay
- Page height expands naturally as tiers become visible
- Auto-select paths (single venue, single date) run the connector faster but still visibly

**Key References:**
- Full Design Spec: docs/specs/future/cascade-progressive-disclosure.md
- Cascade Page: src/components/cascade/CascadePage.tsx
- Connector (current stub): TierConnector component inside CascadePage.tsx (~line 316)
- Design System: .claude/skills/design-system/SKILL.md

**Implementation Approach:**
- Phase 1: State architecture — replace animStep gating with tiersVisible set
- Phase 2: AnimatedConnector component — SVG line with height animation
- Phase 3: Tier reveal wiring — each tier hidden until connector completes
- Phase 4: Left-to-right column stagger within tiers
- Phase 5: Spacing polish

**Design Philosophy:**
Every tier reveal is earned. The animation teaches the pipeline's logic — inputs → structural → geographic → artist identity → audio → performance — by playing it out in real time.

**Key Timing Values:**
- Connector line travel: 400ms ease-in-out
- Tier fade-in: 350ms easeOut (y: 16→0, opacity: 0→1)
- Column stagger delay: 120ms between columns (left → center → right)
- Pill hydration: 80ms per pill (unchanged from current)
- Auto-select fast-forward: connector travel 200ms (half speed)

**Files to Modify:**
- src/components/cascade/CascadePage.tsx — state architecture + tier render logic
- (new) src/components/cascade/AnimatedConnector.tsx — animated SVG line component

Let's start with Phase 1. Should I begin by reading CascadePage.tsx to map the current state architecture?
```

---

## Design Philosophy

Every tier reveal is earned. The user's selection — artist, then venue, then date — is the key that unlocks the cascade. The animation doesn't just look nice; it performs the logic of the pipeline. Inputs arrive. The structural transform runs. Geographic enrichment follows. Artist identity emerges. Audio data layers in. Finally, the specific night reconverges. Each connector line is a literal signal traveling down the system.

The page should feel like watching a live computation, not loading a static document.

---

## Visual Design

### Connector Line

An animated SVG line replaces the current static `↓` `TierConnector` stub.

**Specifications:**
- Width: 1px stroke
- Color: matches the destination tier's accent color (interpolated from source tier)
- Animation: `strokeDashoffset` from full length → 0 over 400ms, ease-in-out
- Height: 40px (current `TierConnector` occupies ~20px — expand to give the line room)
- Optional: faint glow (`filter: drop-shadow`) in tier accent color at 30% opacity

**Layout:**
```
[ Tier N content ]
        |            ← SVG line grows from top to bottom
        |            ← 400ms travel time
        ↓
[ Tier N+1 label fades in ]
[ col 1 ]  [ col 2 ]  [ col 3 ]   ← stagger 120ms apart
```

### Tier Reveal

Each tier starts with `visibility: hidden` + `height: 0` (or `display: none` before unlocked).

When unlocked:
- Tier wrapper: `opacity: 0 → 1`, `y: 16 → 0`, duration 350ms, easeOut
- Columns stagger: col 1 immediately, col 2 after 120ms, col 3 after 240ms

### Spacing

Current tiers are packed. As a tier reveals:
- Animate `paddingTop` from 0 → target (14px) as the tier enters
- This makes the page breathe open rather than having pre-allocated blank space

### Initial State

On load, only the header and Tier 0 are visible. Nothing below Tier 0 renders. The hint text `"select an artist to begin the cascade ↓"` is the only invitation.

---

## Interaction Design

### Animation Sequence — Happy Path (artist with one venue, one date)

```
T=0ms     User selects artist
T=100ms   T0 atoms lock in (artist/venue/date atoms replace picker)
T=100ms   Connector T0→T1 begins growing (400ms)
T=500ms   Connector arrives. T1 fades in (350ms).
T=620ms   T1 col 1 (derive artist) appears + pills begin hydrating
T=740ms   T1 col 2 (normalize venue) appears + pills begin hydrating
T=860ms   T1 col 3 (parse date) appears + pills begin hydrating
T=1200ms  T1 footer ("19 fields") appears
T=1200ms  Connector T1→T2 begins (400ms)
T=1600ms  T2 fades in. Google Places badge + venue photo + pills hydrate.
T=2100ms  Connector T2→T3 begins (400ms)
T=2500ms  T3 fades in. Artist identity panel + pills hydrate.
T=3100ms  Connector T3→T4 begins (400ms)
T=3500ms  T4 fades in. Apple Music panel + tracks hydrate.
T=4000ms  Connector T4→T5 begins (400ms)
T=4400ms  T5 fades in. setlist.fm + Ticketmaster + setlist hydrates.
T=5500ms  Assembly bridge reveals. Complete.
```

### Animation Sequence — Multi-Venue Artist (user must pick venue)

```
T=0ms     User selects artist
T=500ms   T1 fades in. Artist column hydrates. Venue + date columns show "awaiting…"
T=900ms   Connector T1→T2 begins but PAUSES at 50% (waiting state — line stops, pulses)
           [venue picker appears in T0 alongside locked artist atom]
T=?       User selects venue
T=?+200ms Connector completes travel (200ms fast-forward)
T=?+550ms T2 fades in and hydrates normally.
           ... cascade continues
```

*Alternative simpler approach: connector doesn't appear at all until venue is selected — T2 only starts once the venue atom is locked. This avoids the "paused line" complexity.*

**Recommendation:** Use the simpler approach. Connector for T1→T2 only begins after venue is selected. The partial hydration of T1 (artist column only, venue/date columns still dormant) is the visual signal that the cascade is waiting.

### Reset Behavior

Reset clears all `tiersVisible` entries immediately. All tiers below T0 disappear instantly (no animation out — the clean slate is more satisfying than a fade-out).

### Auto-Select Fast-Forward

When an artist has only one venue (auto-selects), connector travel time is 200ms instead of 400ms. Same for single-date auto-select. The cascade is faster but still visible — the user still sees the pipeline run.

### Accessibility

- `aria-live="polite"` region announces tier names as they reveal: "Tier 1 revealed: The Build Pipeline"
- Connector animation respects `prefers-reduced-motion`: skip line animation, tiers appear immediately in sequence with a simple fade
- Reset button remains keyboard-accessible throughout

---

## Technical Implementation

### State Architecture Change

**Current:** `animStep: number` gates tiers via `opacity: 0.25` dimming. All tiers are always in the DOM.

**New:** `tiersVisible: Set<number>` — tiers not in the set are not rendered at all.

```typescript
// New state
const [tiersVisible, setTiersVisible] = useState<Set<number>>(new Set([0]))
const [connectorPhase, setConnectorPhase] = useState<number | null>(null)
// connectorPhase = the connector currently animating (e.g., 1 = T0→T1 line)

// Helper
const revealTier = (n: number) => setTiersVisible(prev => new Set([...prev, n]))
```

`animStep` can be retired or repurposed to drive pill counts only (its current secondary role). The `tierAnim()` helper that currently maps `animStep >= N` to opacity is replaced by conditional rendering based on `tiersVisible`.

### Component Architecture

```
CascadePage
├── Header
├── Tier0 (always visible)
├── AnimatedConnector (T0→T1) — renders when connectorPhase >= 1
├── Tier1 (renders when tiersVisible.has(1))
├── AnimatedConnector (T1→T2) — renders when connectorPhase >= 2
├── Tier2 (renders when tiersVisible.has(2))
... and so on
```

### New Component: AnimatedConnector

```typescript
// src/components/cascade/AnimatedConnector.tsx

interface AnimatedConnectorProps {
  fromTierColor: string   // source tier accent color
  toTierColor: string     // destination tier accent color
  onComplete: () => void  // called when line finishes traveling
  duration?: number       // default 400ms
  height?: number         // default 40
}
```

Internally uses an SVG with a vertical line and `strokeDashoffset` animation. On mount, starts the animation. Calls `onComplete` when it finishes.

Uses `framer-motion`'s `animate` or a simple `useEffect` + `setTimeout` to match the existing animation pattern in the codebase.

### Column Stagger

Each tier's three columns get `motion.div` wrappers with `delay`:

```typescript
// Within tier render
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: colIndex * 0.12 }}
>
  {/* column content */}
</motion.div>
```

### Connector Sequencing in Animation Runners

The existing `runArtistAnim`, `runVenueAnim`, `runConvergenceAnim` async functions are refactored to:

1. Set `connectorPhase` → triggers `AnimatedConnector` to mount and animate
2. Wait for connector `onComplete` callback (via a promise that resolves on callback)
3. Call `revealTier(n)` → tier mounts and stagger begins
4. Run pill hydration (existing logic, unchanged)
5. Set `connectorPhase` for next boundary → repeat

### Data Flow (unchanged)

The selection → hydration data flow is not changed. Only the *visibility gating* and *connector animation* are new. `artistMeta`, `venueMeta`, `setlistSongs`, etc. all populate exactly as they do today.

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Idle state: only header + T0 visible, nothing below
- [ ] Artist select: connector T0→T1 animates, T1 reveals with column stagger
- [ ] Single-venue artist: venue auto-selects, connector T1→T2 follows immediately at 200ms
- [ ] Multi-venue artist: T1 partially hydrates (artist col only), venue picker appears in T0, connector T1→T2 waits until venue selected
- [ ] T2 reveal: Google Places badge visible, venue photo loads, pills hydrate
- [ ] T3 reveal: artist photo/initials, genre chips, bio, pills hydrate
- [ ] T4 reveal: Apple Music panel, track list hydrates
- [ ] T5 reveal: setlist.fm + Ticketmaster panels, setlist hydrates song by song
- [ ] Assembly bridge appears after T5 complete
- [ ] Reset: all tiers below T0 disappear instantly, T0 returns to picker
- [ ] `prefers-reduced-motion`: tiers appear immediately, no connector animation
- [ ] Artists with no setlist data: T5 shows "setlist not available" gracefully
- [ ] Artists with no artist photo: initials avatar shows, T3 still reveals
- [ ] Page scroll: tiers revealed below the fold are still reachable by scrolling

### Test Artists

| Artist | Venues | Notes |
|--------|--------|-------|
| Depeche Mode | Multiple | Multi-venue picker path |
| The Cure | 1 | Auto-select path, has setlist |
| Any artist with 1 venue + 1 date | — | Fully auto-cascades |
| Artist with no TheAudioDB data | — | T3 graceful fallback |

---

## Implementation Plan

### Phase 1: State Architecture

**Files to Modify:**
- `src/components/cascade/CascadePage.tsx`

**Tasks:**
1. Add `tiersVisible: Set<number>` state, initialize to `new Set([0])`
2. Add `connectorPhase: number | null` state
3. Add `revealTier(n)` helper
4. Replace all `animStep >= N` tier rendering guards with `tiersVisible.has(N)` conditional rendering
5. Strip `opacity: 0.25` dimming from tier wrappers (visibility is now binary: rendered or not)
6. Keep `isTierRelevant` / focus dimming logic intact (this is separate from the reveal gate)

**Acceptance Criteria:**
- [ ] Tiers 1–5 not present in DOM on initial load
- [ ] Manually calling `revealTier(1)` in console makes T1 appear
- [ ] Reset clears `tiersVisible` back to `{0}`
- [ ] Existing animation pill counts still work after refactor

---

### Phase 2: AnimatedConnector Component

**Files to Create:**
- `src/components/cascade/AnimatedConnector.tsx`

**Files to Modify:**
- `src/components/cascade/CascadePage.tsx` — replace `<TierConnector />` usages

**Tasks:**
1. Create `AnimatedConnector` with SVG stroke-dashoffset animation
2. Accept `fromColor`, `toColor`, `duration`, `height`, `onComplete` props
3. On mount: start animation, call `onComplete` when done
4. Respect `prefers-reduced-motion`: call `onComplete` immediately, skip animation
5. Replace all `<TierConnector />` in `CascadePage` with `<AnimatedConnector>` where `connectorPhase` matches

**Acceptance Criteria:**
- [ ] Line visibly grows downward over ~400ms
- [ ] `onComplete` fires reliably when animation ends
- [ ] Line color transitions between tier accent colors
- [ ] Reduced-motion: `onComplete` fires immediately

---

### Phase 3: Tier Reveal Wiring

**Files to Modify:**
- `src/components/cascade/CascadePage.tsx`

**Tasks:**
1. Refactor `runArtistAnim` to: set `connectorPhase(1)` → await connector complete → `revealTier(1)` → run T1 pills → set `connectorPhase(2)` → etc.
2. Implement the "connector promise" pattern: `new Promise(resolve => setConnectorCompleteCallback(resolve))`
3. Wire T2 connector to only start after venue is locked (not during venue-pending state)
4. Wrap each tier's column content in `motion.div` with stagger delay
5. Ensure T1 partial hydration (artist col only, venue/date remain dormant) works correctly during venue-pending

**Acceptance Criteria:**
- [ ] Full cascade sequence plays correctly for auto-select artist
- [ ] Multi-venue path: T1 artist col hydrates, T1→T2 connector waits for venue select
- [ ] Tier labels animate in as first element of each tier reveal
- [ ] Column stagger: 120ms apart, left to right

---

### Phase 4: Spacing Polish

**Files to Modify:**
- `src/components/cascade/CascadePage.tsx`

**Tasks:**
1. Animate `paddingTop` on tier wrappers from 0 → 14px as they enter (via `motion.div` initial/animate)
2. Increase `AnimatedConnector` height from 20px to 40px for breathing room
3. Verify page scroll works correctly as content expands

**Acceptance Criteria:**
- [ ] Page expands smoothly as tiers reveal (no layout jump)
- [ ] Connector lines have adequate vertical space
- [ ] Page is scrollable throughout cascade

---

## Future Enhancements

- **Replay button:** After completion, a subtle "replay cascade" button that resets and re-runs the full animation with the same concert pre-selected
- **Speed control:** Toggle between normal and 2× animation speed for repeat visitors
- **Connection lines between tiers:** Extend `CascadeLanes` SVG to draw faint flow lines connecting active columns across tier boundaries (post-MVP visual flourish)

---

## Questions for Review

- **Connector pause during venue-pending:** Should the T1→T2 connector show a "paused/pulsing" state while waiting for venue selection, or simply not appear until venue is locked? (Recommendation: simpler — don't appear until locked.)
- **T1 partial reveal:** When venue is pending, should T1 cols 2 and 3 show the `PendingAtom` dormant state, or not render at all? (Recommendation: show dormant state so the user understands those columns exist but are waiting.)
- **Connector color:** Single color (white/gray) or interpolated between tier accent colors? (Recommendation: interpolated, matches the existing tier color system.)

---

## Revision History

- **2026-03-10:** Initial specification created
- **Version:** 1.0.0
- **Status:** Planned
