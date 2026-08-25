# Morperhaus Video Patterns

Reusable creative and technical patterns extracted from the HyperFrames pilot (Social Distortion Thread, 2026-04-19).

This is the document to read *before* building the next video. It captures what we learned is reusable — the specific creative decisions that should carry forward, and the technical pitfalls we already paid for.

---

## Visual language

### Palette

Six tokens. Nothing else. No new colors.

| Token | Hex | Use |
|---|---|---|
| Ink | `#fafaf9` | Body type on dark, dim archive dots |
| Void | `#0a0a0a` | Post-midpoint / outro background |
| Navy | `#1e1b4b` | Purple radial gradient start (memory phase) |
| Purple | `#581c87` | Purple radial gradient end (memory phase) |
| Indigo | `#6366f1` | Venue nodes (primary hero dots) |
| Violet | `#c084fc` | "The thread" — subject highlight. One color, one meaning. |

**Violet is load-bearing.** It's the accent that says "this is the subject being traced" — used on SD-highlighted dots, the milestone cursor, polylines. One color, one meaning. Don't reuse for anything else.

### Typography

Two faces. Always these two.

- **Playfair Display** — display anchor (cover numerals, sentence fragments, pull quotes, wordmark)
- **Source Sans 3** — structural voice (stat subtitles, data labels, metadata, wordmark subtitle)

Size hierarchy is **intentionally extreme**: 240px primary stats vs 16px data labels. The gap between "subject" and "margin" is a readability tool, not a maximalist choice.

### Grid + safe zones

- 1080×1920 portrait, edge margins 80px
- Top safe zone: 220px (platform UI)
- Bottom safe zone: 450px (platform UI + caption bar) — *nothing critical here*
- Baseline rhythm: 12px
- Playfair display type: optical alignment trumps math — serifs get ~4–6px upward compensation

### Backdrop treatment

- **Purple phase** (beats 1–4): radial gradient `#1e1b4b → #581c87 → #0a0a0a`, with album art screened back behind (multiply blend + grayscale)
- **Charcoal phase** (beats 5+): desaturated, darker tint of the same structure
- The **shift from purple → charcoal** signals a narrative phase change (memory → map, or subject → evidence). Don't waste it on decoration.
- **No linear gradients on full-screen dark backgrounds.** H.264 bands them. Radial or localized glow only.

---

## The persistent ribbon pattern

### What it is

A single horizontal track at `y=1580`, spanning the viewer's full archive. For the concerts archive: 182 dots across 1984–2026, with decade ticks and violet-highlighted subject dots. One instance, root-level, persists across all scenes.

### When to use

Any video where the subject is part of a broader catalogued archive. It answers *"where does this fit?"* without the viewer asking.

### How it behaves

- **Populates exactly once** (in beat 1, after a 2s delay so the primary editorial stat lands first on empty field)
- **Never re-animates** on scene transitions — persistence is the signature
- **SD-highlighted dots appear violet from the start** — no per-scene brightening
- **Fades out** only for the outro (which is a generic branded asset, not part of the story)

### What NOT to do

- ❌ Per-scene ribbon instances with re-staggering dots on each scene entry
- ❌ Dimming non-subject dots scene-by-scene (eye-catching but violates "no repeated animations")
- ❌ Putting the ribbon inside a scene container — it needs to live at root to persist

### Technical notes

- Generate dots deterministically via `mulberry32(seed)` — no `Math.random()`
- Distribute 182 dots across years with baseline + deterministic spikes to feel "lived in" rather than uniform
- The line itself is a separate `.ribbon-line` div inside `.ribbon-track` so it can `scaleX` draw in without affecting dot positions

---

## The milestone marker pattern

### What it is

A violet vertical bar (3px × 42px) that indicates "this scene is referencing *this specific point in time*."

### Semantic rules

- **Appears** only on scenes that reference a specific date or show
- **Slides between positions** when adjacent scenes both reference dates (persists across the transition)
- **Fades out** before scenes that don't reference specific dates
- **Fades in** fresh when returning from a non-date-referencing scene to a date-referencing one

### Why the rules matter

Arbitrary cursor movement is noise. The marker earns its attention only when the scene *means* a specific date. A viewer who pays attention to it learns it's meaningful.

### Example application (SD Thread)

| Scene | Marker | Position |
|---|---|---|
| F1 Archive | Fast sweep through decades | 1984 → 2024 |
| F2 Thread | Hidden | — |
| F3 Venues | Hidden | — |
| F4 Doubled (Twice at 9:30) | Visible, slides | 2010 → 2012 |
| F5 Geography (persists from F4) | Visible, slides | 2012 → 1990 (transition) → 2024 (during polyline) |
| F6 Evidence | Hidden | — |
| F7 Outro | Not applicable | ribbon removed |

### Technical notes

- Marker position animated via `left: X%` where `X = ((year - START) / SPAN) * 100`
- Fade in/out is a combination of `opacity` + `scaleY` (0 → 1 from top-origin) for a "drops into place" feel
- Color matches subject violet — visually it's *part of* the thread

---

## Reveal order principle

### The rule

**Empty field → primary editorial text → ambient structure.**

In Beat 1:
1. Album backdrop alone (0–0.2s)
2. "182 concerts." mask-wipes in (0.2–0.95s)
3. Supporting text ("41 years.", "One life, cataloged.") lands (0.8–1.75s)
4. Ribbon reveals (2.0s onward)

### Why it works

The viewer's eye needs somewhere to land. If everything appears at once, nothing reads. By holding the ambient structure back, the editorial statement earns its hero moment before the data fills in around it.

### What NOT to do

- ❌ Populate the ribbon from t=0 while the primary stat animates in
- ❌ Have the hero numeral and the structural ambient compete for initial attention

### Applies beyond Beat 1

Any scene with both a "hero statement" and "ambient structure" should let the statement land first. Not every scene needs this — but if in doubt, delay the structure.

---

## Paused-frame test

### The principle

**Any frame at any second should read as Morperhaus.** A viewer pausing at a random moment should be able to identify the brand.

### How to verify

After rendering, extract frames at 5–10 random timestamps across the video. Each should have at least two of:
- Wordmark visible (outro frames)
- Ribbon visible (beats 1–6)
- Ink-on-dark with violet accent
- Playfair display type at hero scale
- Album backdrop treatment

If a frame reads as "generic social video," something's wrong with the density or the persistence.

### Extract command

```bash
ffmpeg -i renders/{file}.mp4 -ss {seconds} -frames:v 1 /tmp/check.png
```

Keep verification frames in `/tmp/`, never in `renders/`.

---

## Initial-load invisibility contract

### The rule

**At t=0, before the timeline plays, nothing that will later animate in should be visible.**

### The trap

GSAP's `tl.from()` has `immediateRender: true` by default — it applies the "from" state at construction, so at t=0 the element is already at its hidden start state. ✅

GSAP's `tl.fromTo()` with a non-zero position has `immediateRender: false` by default — the "from" state is NOT applied until the tween starts. So at t=0, the element is at its CSS default (usually fully visible). ❌

### The fix

For every `fromTo` tween that animates an element visually appearing later:
```js
tl.fromTo(selector,
  { clipPath: "inset(0 100% 0 0)" },
  { clipPath: "inset(0 0 0 0)", duration: 0.75, immediateRender: true },  // ← explicit
  0.2
);
```

OR use `tl.set(selector, { ... }, 0)` to force the hidden state at t=0.

### How to test

Extract frame at t=0.01. Should show only the static backdrop. If any text, dots, markers are visible, the invisibility contract is broken.

---

## Generic outro pattern

### What it is

A 2.5s outro that works for *any* Morperhaus video. No story-specific content.

### Structure

- **Backdrop:** void + subtle purple radial
- **Constellation layer:** ~50 indigo/purple/pink dots in 6–7 clusters, screened back to 0.22 opacity, with hierarchy links (solid indigo) and cross-venue links (dashed pink). Uses Venue scene's exact palette and size scales.
- **Favicon DNA seed:** one large indigo venue with 5 peripheral satellites at upper-right — subconscious brand signature
- **Wordmark lockup:** "morperhaus" at 118px Playfair + rule + "Concerts" at 28px Source Sans
- **CTA:** "Full story at" + `concerts.morperhaus.org/liner-notes`
- **Edge bleed:** nodes bleed off all four sides — the archive extends beyond frame

### Animation

- Nodes stagger-populate at 18ms each with scale-pop (back.out)
- Subtle drift on inner wrapper (4px sine yoyo) — paused-frame never feels dead
- Wordmark fades in over still-populating constellation at 0.5s
- CTA lands at 1.55s, full tableau held from ~2.0s

### Reusability

The entire Frame 7 block ([index.html:1059-1084](index.html#L1059-L1084), CSS + setup IIFE + timeline tweens) is meant to be lifted verbatim into future videos. Don't regenerate — copy, and let the seeded PRNG produce the same constellation each time.

---

## "No repeated animations"

### The rule

**An element that persists across scenes should not re-animate at scene boundaries.**

State changes (color, position, size) are fine if they're semantically meaningful. But re-staggering dots, re-wiping text, re-populating ambient structure — all violate the persistence the element is there to create.

### What this rules out

- Per-scene ribbon fade-ins
- Re-entering the wordmark at each scene (wordmark only exists in the outro — fine)
- Dimming non-subject dots scene-by-scene (if doing it, do it once at F2 entry and leave it)

### What this rules in

- Cursor position slides (position is meaningful)
- Element opacity changes tied to semantic rules (marker visible only on date-referencing scenes)
- Class-state toggles (adding highlight on one element at one moment)

---

## Render + naming conventions

See [README.md](README.md) for full details.

TL;DR:
- Render via `node scripts/render.mjs --slug {kebab-slug}` — never `npx hyperframes render` directly
- Output is named `YYYYMMDD-{slug}.mp4`
- One deliverable per video in `renders/`. No frame dumps, no verification screenshots, no iteration versions.

---

## Framework rules (non-negotiable)

From HyperFrames skill, worth repeating here for quick reference:

1. **Deterministic only** — no `Math.random()`, `Date.now()`, or network fetches. Use `mulberry32(seed)` for any randomness.
2. **Synchronous timeline construction** — no `async`, `setTimeout`, or Promises when building the GSAP timeline.
3. **No `repeat: -1`** — calculate finite repeat counts from composition duration.
4. **`window.__timelines["root"] = tl`** — always register.
5. **Paused timeline** — `gsap.timeline({ paused: true })` — the player controls playback.
6. **Video always `muted playsinline`** with a separate `<audio>` element for sound.

---

## When to invent new patterns

Not every video needs to add to this document. New patterns emerge from:

- **Repetition** — if two videos solve the same problem the same way, it's a pattern. Document it.
- **Load-bearing constraints** — if the framework or the brand forces a specific solution, document it so the next person doesn't re-discover it.
- **Surprising failures** — if something that looked obvious broke, document the failure mode (e.g., the `fromTo` immediateRender trap).

One-off creative choices — a specific song choice, a specific stat layout — go in the per-video treatment doc, not here.
