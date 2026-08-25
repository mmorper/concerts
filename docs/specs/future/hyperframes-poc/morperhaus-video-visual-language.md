# Morperhaus Video Visual Language — Phase 1 First Draft

**Status:** Draft — Phase 1 deliverable (not final)
**Date:** 2026-04-19
**Scope:** Motion-adapted extension of the existing Morperhaus brand for the Video Series Pilot (and, if green-lit, the series).

---

## Opening Principle

This is not a new brand. This is the existing Morperhaus brand — network nodes, Playfair Display, the purple gradient — translated into 9:16 motion. Every decision below traces back to an established site pattern or the aesthetic lineage the pilot spec names (Peter Saville / Factory Records / *Substance 1987* / Swiss typography / NYT iconographic teases).

The tension to preserve in motion is the site's tension: **classical editorial form set against modernist data rhythm**. Playfair's serif as the editorial anchor; dots, timelines, rules, and counters as the modernist counter-voice. Restraint is not caution — it's how Saville's Factory work communicated confidence, and it's how Morperhaus earns a double-take in a feed.

---

## Palette

All values draw from `docs/design/color-specification.md` and `docs/design/icon-specification.md`. **No new colors are introduced for video.**

### Structural

| Token | Hex | Role in video |
|---|---|---|
| Ink | `#ffffff` | Primary type on dark backgrounds |
| Void | `#000000` | Cold opens; moments of editorial silence |
| Deep Navy Purple | `#1e1b4b` | Dark-scene base (gradient start) |
| Rich Purple | `#581c87` | Dark-scene finish (gradient end) |
| Stone | `#fafaf9` | Rare light-ground moments (echoes Scene 5: Artists) |
| Charcoal | `#111827` | Map / geography moments (echoes Scene 3) |

### Signature Gradient

```
linear-gradient(135deg, #1e1b4b 0%, #581c87 100%)
```

This is the Venues scene's gradient. It is the single strongest color identifier for Morperhaus.

**Motion caveat from Hyperframes:** avoid full-screen linear gradients on dark backgrounds — H.264 produces banding. Use **radial** variants (`radial-gradient(ellipse at center, #1e1b4b, #581c87)`) or solid fills with localized glow.

### Accent Nodes (site identity)

From the icon spec. Use for dots, pulse highlights, network-style glyphs:

| Role | Hex | Role in video |
|---|---|---|
| Primary node | `#6366f1` (Indigo-500) | Central/hero dots |
| Secondary node | `#8b5cf6` (Violet-500) | Peripheral dots |
| Connection | `#a855f7` (Purple-500) | Line strokes |
| Node glow | `#c084fc` (Purple-400) | Halo/highlight |

### Genre Accents

The full 26-color Concert Poster palette from `color-specification.md` is available when a video's narrative calls for genre color. For the Social Distortion pilot, **Punk (`#991b1b`, dried-blood red)** is the latent accent — it's not featured on-screen because the pilot spec's worked example for this post explicitly decided against foregrounding genre, but it remains the right color if a pulse or stroke needs a punk-specific tint.

### Contrast Discipline

All type must pass WCAG AA (4.5:1 for body, 3:1 for large text 24px+). Hyperframes' `validate` audit checks this automatically. If a contrast warning fires, brighten or darken **within the palette family** — do not invent a new token.

---

## Typography

Two typefaces. Only two. Matches the site exactly.

### Playfair Display — The Editorial Anchor

Kin to Bodoni. The Saville/*Substance 1987* lineage lives here. This is non-negotiable.

**Weights to load:** 400 (regular), 500 (medium), 700 (bold), 400 italic, 500 italic.

**Roles:**
- Display numerals (year callouts, stat numbers)
- Scene titles
- Artist names
- Pull quotes (italic 400/500)

**Sizes for 1080×1920 video:**

| Role | Size | Tracking | Weight |
|---|---|---|---|
| Display numeral (year as cold open) | 320px | -0.03em | 500 |
| Scene title | 140–180px | -0.02em | 500 |
| Artist name | 120–140px | -0.02em | 500 |
| Venue / place | 88–96px | -0.02em | 400 |
| Pull quote | 72–88px | -0.01em | 400 italic |

**Never use:** 400 roman at small sizes (looks flimsy in motion). Use 500+ for any display text below 80px.

### Source Sans 3 — The Structural Voice

Grid-aligned sans. Everything that is not editorial anchor speaks in this voice.

**Weights to load:** 400, 500, 600.

**Roles:**
- Stat subtitles ("34 YEARS · 8 SHOWS")
- Data labels (dates under dots, venue names under the sweep)
- UI-register text (the outro CTA URL, the platform domain)
- Contact-sheet metadata (if the signature element uses it)

**Sizes for 1080×1920 video:**

| Role | Size | Tracking | Case | Weight |
|---|---|---|---|---|
| Stat subtitle / label | 32–40px | 0.15em | UPPERCASE | 500 |
| Body | 28–36px | 0 | mixed | 400 |
| Data label (venue under dot) | 24–28px | 0.05em | mixed | 500 |
| Caption / UI register | 20–24px | 0.05em | UPPERCASE | 500 |
| Outro URL | 32–40px | 0 | lowercase | 400 |

**Never use:** below 20px for any element that must be read. Video encoding compresses fine detail.

### The Playfair Question (flagged for Phase 2)

Hyperframes' typography reference lists Playfair Display and Source Sans 3 as "banned defaults." The ban is advisory (the compiler still serves them), and the brand-lineage argument (Factory/*Substance*/Bodoni kinship) overrides the anti-monoculture argument in this case. See `hyperframes-capabilities.md § The Playfair Question`. **This draft keeps Playfair + Source Sans 3.** Phase 2 may revisit.

### Figure Rendering

On numeric columns (ticker counters, year sweeps, dot counts), use:

```css
font-variant-numeric: tabular-nums;
```

Without this, digit widths shift as they tween (e.g. "1" narrower than "8"), producing visible jitter.

---

## Grid & Layout (Swiss Discipline)

The grid is not visible, but it is always there. This is the Tschichold / Müller-Brockmann discipline Saville inherited.

### Safe Zones (TikTok/Instagram)

- **Top 220px:** platform UI (username, follow button) — no critical content here
- **Bottom 450px:** platform UI (like/comment/share buttons, captions) — no critical content here
- **Center 1080 × 1250px:** where all critical content lives

Align every headline, dot, and quote to this center band. Nothing important touches the top 220 or bottom 450.

### Alignment

- Display type: **optical center**, not math center — serifs need a hair of upward compensation
- Data rows: **left-align** to a consistent column (40–80px from frame edge)
- Pull quote blocks: **left-align** with a hanging quote mark — echoes how the site treats liner notes
- Outro lockup: **centered** (one of very few centered moments)

### Negative Space

Minimum 120–160px of breathing room around display type. The site uses `py-20` (80px) because it's competing with other page content. In video, each scene is the whole screen — breathing room earns more.

### The Horizontal Rule

A thin rule (`1px`, `#ffffff` at 60% opacity) at a specific Y coordinate is a candidate signature element (see `signature-element-candidates.md`). Whether or not it becomes the signature, horizontal rules are **always** structural — they anchor type to a baseline, they do not decorate.

---

## Motion Primitives

All motion extends the site's `duration: 0.8s`, stagger `0.2s`, cubic-bezier timing. These are the site's own values.

### Entrance Patterns

The single most important rule (from Hyperframes): **every element animates IN. No element appears fully-formed.** If a scene has 5 elements, it has 5 entrance tweens.

**The two entrance moves:**

| Pattern | Tween | Ease | Duration | When to use |
|---|---|---|---|---|
| `reveal-rise` | `y: 40–60 → 0`, `opacity: 0 → 1` | `power3.out` | 0.6–0.7s | Primary entrances (headlines, large text) |
| `reveal-settle` | `y: 20–30 → 0`, `opacity: 0 → 1` | `power2.out` | 0.4–0.5s | Secondary entrances (subtitles, labels) |

### Stagger Pattern

- Primary element: `t + 0.1–0.3s` (never exactly t=0 — looks mechanical)
- Secondary elements: `+0.2s` after primary
- Tertiary (if any): `+0.2s` after secondary

### Easing Variety (required)

Hyperframes: "Vary eases across entrance tweens — use at least 3 different eases per scene." For Morperhaus:

| Intent | Ease |
|---|---|
| Confident, landing on a mark | `power3.out` |
| Settling in | `power2.out` |
| A small quickening (dot lighting up, ticker advancing) | `expo.out` |
| A soft emphasis (subtitle arriving) | `back.out(1.2)` — use once per composition max |

### Hold

After entrance, display type should hold still for at least 0.8s before the next cut. Moving-while-new-type-arrives reads as anxious. Stillness reads as certainty.

### Exits — Deliberately Rare

Per Hyperframes: **no exit animations except on the final scene.** The scene transition owns the exit. The outgoing scene's content must be fully visible when the transition fires.

Transitions between scenes:
- **Default:** hard cut (inherits stop-motion influence referenced in the pilot spec)
- **Emphasis:** 200–300ms crossfade (when moving from data density to quiet)
- **Never:** slide wipes, zoom-ins, "cinematic" camera sweeps. The lineage does not support them.

### Ambient Motion (use very sparingly)

Examples of acceptable:
- A single dot subtly pulsing on the last beat (2024 — The Belasco) to telegraph "this is now"
- A horizontal rule breathing 1% scale over 3 seconds under a title

Examples of banned:
- Floating particles
- Rotating elements without narrative cause
- "Beat bump" scaling synced to anticipated music (the video is silent — nothing to sync to)

---

## Image Treatment

### Artist and archival photography

- **Default:** grayscale desaturation (`filter: grayscale(100%) contrast(1.05)`) — evokes contact-sheet, archival, Saville photographic treatments
- **Optional:** duotone blend with a muted variant of the signature purple — only if the signature element is the "color grade" candidate
- **Never:** colored photography at full saturation. Mike's archive is personal; saturated pop-art color would read as generic

### Album art

- **Full color** — album art is a sacred object, presented as-is
- Set against a solid or softly-gradiated field (the purple gradient works; pure black also works)
- No drop shadows — treat as a flat card
- Minimum displayed size: 600×600px when centered on 1080-wide frame (fits Ball and Chain's 600×600 iTunes ceiling)

### Venue photos

Not used in the Social Distortion pilot composition. When used in a single-venue Template D video:
- Grayscale or duotone same as artist photography
- Full-bleed with 16–20% darkening overlay so type remains legible

---

## Copy Voice (for on-screen text)

This is inherited from the liner-notes voice (`.claude/skills/liner-notes-voice/`) with motion adjustments.

- **Editorial, not advertising.** "34 years. 8 shows." — not "34 EPIC YEARS OF SOCIAL D!"
- **Lowercase unless the grammar demands capital.** "full story at" — not "FULL STORY AT"
- **Periods are punctuation, not decoration.** Use "1990." because the sentence ends there, not for emphasis
- **Numerals, not words, for counts and years.** "8 shows," "1990," "34 years"
- **No emoji, no exclamation points, no trailing "..."**
- **The CTA is a door, not a pitch.** "Full story at concerts.morperhaus.org/liner-notes" — the URL is the invitation, no "Click here!" framing

### Pull quotes

- Always Playfair italic
- Always in curly quotes (`"…"`) or en-dash setoffs — never straight quotes
- Split long quotes across two beats on a natural grammatical seam (the pilot spec's split point "who'd" is good; "old friend / who'd weathered the same storms" reads with breath)

---

## Wordmark — Three Proposals (Phase 1, No Pick)

The wordmark is the closing lockup. It needs to read as "Morperhaus" / "Morperhaus Concerts" with confidence, be legible at 1080×1920, and survive Instagram's re-encoding.

**Guiding constraints:**
- Must use Playfair Display + Source Sans 3 (no third face)
- Must work in white-on-dark and dark-on-light (the outro may be on black; storyboards may land on stone)
- Must pair with a single geometric mark that echoes the site's network-node identity *or* exist as pure typography

### Proposal 1 — "Editorial Masthead"

```
 morperhaus
   CONCERTS
```

- `morperhaus`: Playfair Display 500, 96px, `-0.02em`, lowercase
- `CONCERTS`: Source Sans 3 500, 28px, `0.3em` tracking, UPPERCASE, below at 16px offset
- Optional: single horizontal rule (40% opacity, 1px) between the two rows, spanning the width of "morperhaus"

**Why:** Mirrors the masthead of a magazine or concert program. Lowercase Playfair has personality without shouting. The Source Sans caps act as a publication subtitle. No iconography needed — the typography does all the work. This is the most "Saville" proposal — restrained, confident, built on the discipline of the types.

**Against:** No visual mark means no small-size version. Cannot be used as a favicon or avatar.

### Proposal 2 — "Node-and-Type"

```
 ●  morperhaus
    concerts
```

- Single indigo node (`#6366f1`, 36px diameter) to the left of the type
- `morperhaus concerts` on one line: Playfair Display 500, 72px, `-0.02em`, lowercase, white
- Node sits on the baseline of the first "m" with optical compensation

**Why:** The site's identity is network nodes; the wordmark inherits exactly one node. Subtle but present — paused frame reads as "Morperhaus" even if the viewer doesn't know why.

**Against:** Risk of reading as a bullet-list glyph rather than a brand mark if execution is imprecise. The node needs a specific internal structure (perhaps a smaller inner dot in `#c084fc`) to read as intentional.

### Proposal 3 — "Catalog-Stamp"

```
 morperhaus.
 — concerts / est. 1984
```

- `morperhaus.`: Playfair Display 500, 80px, `-0.02em`, lowercase — the trailing period is important
- Second line: Source Sans 3 500, 20px, `0.05em` tracking, mixed case, with an em-dash prefix
- Optional: catalog-number-style metadata ("FACT 200C" / "MH 001") — directly echoes Factory Records' catalog aesthetic

**Why:** Most explicit Saville/Factory reference. The "— concerts / est. 1984" reads like the imprint on a record sleeve. The period on "morperhaus." gives the wordmark a grammatical finality.

**Against:** Most baroque of the three. May feel overwrought if the signature element is also metadata-heavy (contact-sheet or catalog-number signatures would double up).

### Phase 1 recommendation: none

Claude Code's job here is to propose. Mike picks in Phase 2. My bias (for the record, not a recommendation): Proposal 1 pairs best with signature-element Candidate A (horizontal rule); Proposal 2 pairs best with Candidate E (motion network nodes); Proposal 3 pairs best with Candidate B (archival date/catalog stamp).

---

## Anti-Patterns — What Not to Do

Explicit, so there's no ambiguity.

### Typographic anti-patterns
- Kinetic typography (words flying in one-at-a-time)
- Text bouncing on arrival (`ease: elastic.out`)
- Word-highlighted captions that mimic TikTok's auto-caption UI
- Mixing a third typeface
- Emoji in any frame
- ALL-CAPS Playfair (Playfair is lowercase; use Source Sans for caps)

### Color anti-patterns
- Introducing a color not in `color-specification.md`
- Full-saturation accents (use deep jewel-tone values)
- Full-screen linear gradients (banding)
- Colored drop shadows on text (pick up the site's solid-color conviction)

### Motion anti-patterns
- Camera moves (zoom, parallax, dolly)
- Rotation for its own sake
- Particle systems
- 3D transforms on type
- Exits before transitions (Hyperframes hard rule)
- Infinite repeats (Hyperframes hard rule)

### Layout anti-patterns
- Content in the top 220px or bottom 450px
- Multiple competing focal points in one frame
- Decorative horizontal rules (rules must be structural)
- Absolute-positioned content containers (Hyperframes house-style rule)

### Voice anti-patterns
- Exclamation points
- "Click here," "Swipe up," "Don't miss it"
- Hashtags on-screen
- Emoji
- TikTok-caption voice ("POV:", "when you…", "this is your sign…")

---

## The Scene-to-Video Translation

The site's interaction signature is **simple → dense → click-payoff**. Translated to feed-native motion:

| Site pattern | Video translation |
|---|---|
| Timeline opens with dots, yields splayed deck | Beat 3: timeline sweep with dots lighting up → a single dot pulses (the "payoff" is on the site) |
| Venues opens with chaos, invites touch | Candidate signature: network-node scaffolding that assembles, doesn't resolve |
| Geography opens with a map, yields a venue card | Candidate (future Template D video): map with one venue highlighted, venue-card reveal |
| Genres opens with Mondrian blocks, yields a scrubbable timeline | Candidate (future Template video): block chart dissolves into an artist portrait |
| Artists opens with a grid, yields a vinyl gatefold | Beat 5 for any artist-driven template: album-art-as-artifact moment |

Every template video inherits the same principle: **start with something simple and specific, let composition do the heavy lifting, end on a door the viewer chooses to walk through.**

---

## Linting Checklist (before declaring any composition done)

1. `npx hyperframes lint` — 0 errors, 0 warnings
2. `npx hyperframes validate` — WCAG contrast audit passes (AA)
3. Every timed element has `class="clip"` and `data-start` / `data-duration` / `data-track-index`
4. Every timeline registered on `window.__timelines`
5. Every scene has entrance animations on every element
6. No exit animations except final scene
7. No full-screen linear gradients on dark backgrounds
8. No `repeat: -1`, no `Math.random()`, no `Date.now()`
9. Type ≥ 60px for headlines, ≥ 20px for body
10. Safe zones respected (top 220 / bottom 450 clear of critical content)

---

## Open Questions for Phase 2

1. **Wordmark pick** — which of Proposals 1 / 2 / 3?
2. **Playfair stays?** — confirm the advisory-ban override is the right call
3. **Image treatment** — grayscale default, or try a duotone with the signature purple?
4. **Ambient motion** — any, or is stillness the stronger move?
5. **Hard cuts vs crossfades** — which transition is the default between scenes?

---

## References

- `docs/design/icon-specification.md` — network-node identity, full palette lineage
- `docs/design/color-specification.md` — genre palette, background tokens, CSS variables
- `docs/design/scene-design-guide.md` — scene-by-scene brand, typography pairing, animation timing
- `docs/inspiration/hyperframes-poc/readme.md` — Mike's voice on each scene's feel
- `~/.agents/skills/hyperframes/SKILL.md` — framework rules (many of which are encoded above)
- `~/.agents/skills/hyperframes/references/typography.md` — the advisory font ban
- `docs/specs/future/hyperframes-poc/hyperframes-capabilities.md` — what the framework can and can't do
- `docs/specs/future/hyperframes-poc/signature-element-candidates.md` — companion doc with signature proposals
