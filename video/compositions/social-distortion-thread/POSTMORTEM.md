# Social Distortion Thread — Build Postmortem

**Video:** `20260419-social-distortion-thread.mp4`
**Spec:** [docs/specs/future/hyperframes-poc/P3-V2-TREATMENT.md](../../../docs/specs/future/hyperframes-poc/P3-V2-TREATMENT.md)
**Date:** 2026-04-19

This doc captures where the built video landed vs. what the treatment originally called for. The treatment stays as the original director's intent; this captures what we learned by building and what patterns we extracted.

---

## Deviations from spec (and why)

### 1. Frame 7 outro — story-specific → generic brand asset

**Spec called for:** Wordmark + CTA with "ribbon still lit" and the pull quote ("like checking in with an old friend who'd weathered the same storms").

**Built:** Generic constellation backdrop (Venue-scene DNA at 0.22 opacity) + wordmark + CTA. No ribbon. No pull quote. Favicon-seeded node cluster as subconscious brand signature.

**Why:** Frame 7 should be a *reusable outro* across future Morperhaus videos, not SD-specific. The pull quote is beautiful but locks the outro to this one story. A generic asset preserves the brand resolution while making the asset portable.

**Consequence:** The pull quote is now unused. It could land in beat 6 or in the per-video treatment for video #2's equivalent beat, but it's no longer part of the template.

See: [Generic outro pattern](../../PATTERNS.md#generic-outro-pattern) in the patterns library.

---

### 2. Ribbon architecture — per-scene → root-level persistent

**Spec implied:** Ribbon continuous across beats but didn't specify architecturally. Initial build had one ribbon instance per scene (6 total).

**Built:** Single ribbon at root composition level, populated once in Beat 1 at t=2.0s, never re-animated. Fades out only at t=21.8s for the outro.

**Why:** Per-scene instances re-staggered dots and ticks on every scene entry, which undermined the "persistent signature" the ribbon is there to create. Hoisting to root + populate-once matches the spec's narrative intent more faithfully than the original implementation did.

See: [Persistent ribbon pattern](../../PATTERNS.md#the-persistent-ribbon-pattern).

---

### 3. Cursor — decorative → semantically-gated milestone marker

**Spec didn't explicitly specify** cursor behavior. Initial build had per-scene cursor positions (hardcoded year per beat), which read as noise.

**Built:** Cursor hidden by default. Appears *only* on scenes that reference specific dates:

- F1: fast decade sweep (1984 → 2024), at tail of ribbon populate
- F4: appears at 2010, slides to 2012 ("Twice at 9:30 Club")
- F5: persists from F4 (both reference dates), slides 2012 → 1990 across transition, then 1990 → 2024 during polyline draw
- F2, F3, F6: hidden (no specific date references)

**Why:** The cursor earns attention when it *means* a specific date. Arbitrary cursor position is meaningless and distracting. The persistence rule (slides between adjacent date-referencing scenes) reinforces narrative continuity.

See: [Milestone marker pattern](../../PATTERNS.md#the-milestone-marker-pattern).

---

### 4. Reveal order in Beat 1 — parallel bloom → sequenced statement

**Original build:** Ribbon dots populated from t=0 simultaneously with primary stat mask-wipe — everything animated in as a parallel bloom.

**Built:** Primary editorial text lands first on empty field (0.2–1.75s). Ribbon reveals at 2.0s. Cursor sweep 2.3–2.58s.

**Why:** Parallel bloom makes the viewer's eye hunt for what to read. Holding the ambient structure back lets "182 concerts." claim its hero moment.

See: [Reveal order principle](../../PATTERNS.md#reveal-order-principle).

---

### 5. Small ribbon label — kept → dropped

**Spec:** Not specified.

**Built initially:** 16px label above the ribbon reading "182 concerts · 1984—2026".

**Built finally:** Label dropped. The primary 240px "182 concerts." already says this.

**Why:** Redundant with the primary stat. Removing it gives the ribbon a cleaner silhouette and avoids duplicating the editorial statement.

---

## Technical issues surfaced

### The `fromTo` immediateRender trap

GSAP's `tl.fromTo()` at non-zero timeline positions doesn't pre-apply the "from" state — so at t=0 before the timeline plays, elements are at CSS default (often fully visible). Caused "182 concerts." to flash visible at t=0.

**Fix:** Add `immediateRender: true` to every `fromTo` tween, or use `tl.set(..., 0)` to force hidden state.

Documented in [PATTERNS.md § Initial-load invisibility contract](../../PATTERNS.md#initial-load-invisibility-contract) so the next video doesn't re-discover this.

### Overlapping tweens on same element

Animating both opacity and transform on the same element in overlapping time windows triggers linter warnings about overlap. Resolved by wrapping the transform target in a sibling element so opacity and transform live on different nodes.

---

## Workflow observations (for process refinement)

1. **Motion mock before master integration saved time.** Building Frame 7 as a standalone 2.5s project, iterating to lock the motion, then transplanting into master was faster than editing the master and re-rendering the full 24.5s each time.

2. **Renders folder hygiene matters.** Verification screenshots and iteration artifacts accumulated in `renders/` and made the deliverable hard to find. Now convention: only `YYYYMMDD-{slug}.mp4` files in `renders/`, throwaway artifacts in `/tmp/`.

3. **Naming convention (`YYYYMMDD-{slug}.mp4`) via wrapper script.** HyperFrames' default filename is timestamped but verbose. Wrapper at `scripts/render.mjs` enforces our convention automatically.

4. **Pattern docs emerged naturally at the end of the build.** Wrote [PATTERNS.md](../../PATTERNS.md) and this postmortem once the dust settled. Both capture what's reusable for video #2.

---

## What's NOT in the patterns library (for good reason)

Things that stay per-video, not elevated to pattern:

- **Specific copy** (the 11 copy moments in the treatment — these are writing, not pattern)
- **Specific assets** (artist photo, album art, venue photos — per subject)
- **Specific beat counts** (7 beats at 3–4.5s each worked here; next video might need 5 beats or 10)
- **Specific storyboard** (the Frame 1–7 sequence is this video's story; the next video tells its own)

A pattern is something that repeats. A creative choice is something that doesn't. Don't confuse them.
