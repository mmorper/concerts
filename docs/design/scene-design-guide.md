# Morperhaus Concerts — Scene Design Guide

**Version:** 1.1
**Last Updated:** 2026-09-03
**Related:** [Color Specification Guide](./color-specification.md) · [UI Component Patterns](./ui-component-patterns.md)

---

## Canonical scene roster

The archive has **six** scenes. The authoritative source is `SCENE_LABELS` /
`SCENE_MAP` in `src/components/changelog/constants.ts` — not this document, and not
the scene component filenames.

| # | Slug | Name | Component file |
|---|------|------|----------------|
| 1 | `timeline` | Timeline | `scenes/Scene1Hero.tsx` |
| 2 | `venues` | Venues | `scenes/Scene4Bands.tsx` |
| 3 | `geography` | Geography | `scenes/Scene3Map.tsx` |
| 4 | `genres` | Genres | `scenes/Scene5Genres/index.tsx` |
| 5 | `artists` | Artists | `scenes/ArtistScene/ArtistScene.tsx` |
| 6 | `ask` | Ask the Archive | `ask/AskScene.tsx` |

> **The component filenames do not match scene positions.** `Scene4Bands` renders at
> position **2** (Venues), `Scene5Genres` at position **4**. `ArtistScene` and `AskScene`
> carry no number at all. This mismatch is the single reason every design doc in this
> repo previously disagreed about the scene order — each one inferred the roster from
> filenames and got a different wrong answer. Read the render order in `App.tsx` or
> `SCENE_MAP`; never the filenames.
>
> Two files in `scenes/` are **not** mounted: `Scene2Venues.tsx` (superseded by
> `Scene4Bands`, still imported nowhere) and `Scene5Genres.sunburst.tsx.bak`.

`npm run validate:docs` (#284) asserts that README, `docs/ROADMAP.md` and `CLAUDE.md`
list the same roster as `SCENE_LABELS`. Adding a scene means adding it there first.

---

## Scene Flow

### The Emotional Arc

| Scene | Title | Emotion | Background |
|-------|-------|---------|------------|
| 1 | Timeline | "Let me tell you a story" | Light |
| 2 | Venues | "These are the places" | **Dark** |
| 3 | Geography | "Look how far we've traveled" | **Dark** |
| 4 | Genres | "This is the sound of my life" | Light |
| 5 | Artists | "These are my people" | Light |
| 6 | Ask the Archive | "Now ask it anything" | **Dark** |

### Visual Rhythm

```
LIGHT → DARK → DARK → LIGHT → LIGHT → DARK

  1        2       3       4        5       6
  ○        ●       ●       ○        ○       ●
```

The arc opens light, sinks into the two dark data scenes, returns to light for the
personal scenes, and closes dark. Scene 6 is the coda: after five scenes of being
shown the archive, you are invited to interrogate it.

---

## Scene Specifications

### Scene 1: Timeline

| Property | Value |
|----------|-------|
| **Background** | `bg-light-1` / `#ffffff` (Pure White) |
| **Text** | `#1f2937` (dark) / `#6b7280` (muted) |
| **Accent** | `#1e3a8a` (New Wave blue) |
| **Dominant Element** | Year dots on timeline |
| **Mood** | Clean, inviting, "come in" |

---

### Scene 2: Venues

| Property | Value |
|----------|-------|
| **Background** | `bg-dark-2` / gradient `#1e1b4b → #581c87` |
| **Text** | `#ffffff` (white) / `#9ca3af` (muted) |
| **Node Colors** | `#6366f1` (venue) / `#8b5cf6` (headliner) / `#ec4899` (opener) |
| **Dominant Element** | Radial network graph |
| **Mood** | Immersive, nostalgic, "I was there" |

---

### Scene 3: Geography

| Property | Value |
|----------|-------|
| **Background** | `bg-dark-1` / `#111827` (Charcoal) |
| **Text** | `#ffffff` (white) / `#9ca3af` (muted) |
| **Markers** | `#6366f1` with glow: `box-shadow: 0 0 12px rgba(99,102,241,0.4)` |
| **Dominant Element** | Full-bleed map |
| **Mood** | Expansive, "look how far we've traveled" |

Scene chrome here uses `z-[1000]`/`z-[1001]` (title, tabs) — the reason the Ask
Spotlight sits at 2000. See [Z-Index Layers](./ui-component-patterns.md#z-index-layers).

---

### Scene 4: Genres

| Property | Value |
|----------|-------|
| **Background** | `bg-light-5` / `#ede9fe` (Soft Violet) |
| **Text** | `#1f2937` (dark) / `#6b7280` (muted) |
| **Visualization** | Full Concert Poster palette (20 genre colors) |
| **Dominant Element** | Genre sunburst |
| **Mood** | Musical, vibrant, "this is who I am" |

**Why violet?** Ties back to Venues gradient. Makes warm genre colors pop through
simultaneous contrast. Says "this is about music."

---

### Scene 5: Artists

| Property | Value |
|----------|-------|
| **Background** | `bg-light-3` / `#fafaf9` (Warm Stone) |
| **Text** | `#1f2937` (dark) / `#6b7280` (muted) |
| **Accents** | Genre colors as card borders/badges |
| **Dominant Element** | Album mosaic |
| **Mood** | Personal, warm, "these are my people" |

---

### Scene 6: Ask the Archive

| Property | Value |
|----------|-------|
| **Background** | Layered — see the Ask register below |
| **Text** | `#ffffff` / `rgba(255,255,255,0.72)` (sub) |
| **Accent** | `#818cf8` (kicker, links) · `#a5b4fc` (live dot, focus) |
| **Dominant Element** | The composer — a single input-shaped invitation |
| **Mood** | Quiet, open, "now ask it anything" |

Shipped in v5.0.0 (epic #138), reworked into a scene in #142. Deep link
`/?scene=ask`; `/ask` is a friendly alias that redirects to it. The chat itself is
**not** on the scene — it is the Spotlight overlay, opened in place from the scene
composer, the nav rail, or ⌘K, and available over any route.

**Background:**

```css
background:
  radial-gradient(1100px 620px at 50% 30%, rgba(140, 122, 224, 0.26), transparent 62%),
  linear-gradient(180deg, #181334 0%, #1e1b4b 40%, #241253 78%, #2c1660 100%);
```

---

## The Ask register

Scene 6 and the Spotlight overlay use a finer glass treatment than the rest of the
app. This is deliberate and is **not** the `white/10` glassmorphism documented for
scene controls — it is a separate register for a conversational surface, and it was
previously undocumented entirely.

### Glass scale

| Level | Fill | Border | Used by |
|-------|------|--------|---------|
| Finest | `rgba(255,255,255,0.055)` | `rgba(255,255,255,0.12)` | Exhibit card |
| Fine | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.16)` | Chips, show pills, scene composer |
| Mid | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.18)` | Input dock |
| Raised | `rgba(255,255,255,0.09)` | `rgba(165,180,252,0.55)` | Composer hover |
| Mobile dock | `rgba(255,255,255,0.12)` | `rgba(165,180,252,0.50)` | Dock, phone only |
| Hover ceiling | `rgba(255,255,255,0.13)` | — | Chip / pill hover |

Blur runs `blur(2px)` (map caption) → `blur(8px)` (dock) → `blur(10px)` (exhibit) →
`blur(20px)` (Spotlight panel), always with the `-webkit-` prefix.

### Surfaces

| Surface | Spec |
|---------|------|
| Spotlight panel | `rgba(30,27,75,0.92)`, radius 18, `blur(20px)`, `0 40px 90px rgba(0,0,0,0.5)` |
| Spotlight scrim | `rgba(15,12,40,0.55)`, `blur(3px)` |
| Mobile sheet | Opaque `#1e1b4b`, full-bleed, no scrim blur (occluded — an invisible cost) |
| Exhibit card | Finest glass, radius 16, 5px genre spine, max-width 680 |

### Type in this register

Playfair Display carries the archive's voice into the overlay — the Spotlight mark
and exhibit titles are serif so the surface reads as the archive, not a generic chat
tool. Body copy is Source Sans 3 at 15px/1.6.

---

## Typography

### Font Pairing

| Role | Font | Google Fonts |
|------|------|--------------|
| **Display** | Playfair Display | Titles, stat numbers, modal headers |
| **Body** | Source Sans 3 | Subtitles, labels, body text, UI |

**Why this pairing:** Playfair has timeless editorial quality — like a concert program
or music magazine. Source Sans is crisp and readable without being generic. Together
they feel sophisticated but not stuffy.

### Type Scale

| Element | Font | Size | Weight | Tracking |
|---------|------|------|--------|----------|
| **Scene Title** | Playfair | `text-5xl md:text-7xl` | 400 | `-0.02em` |
| **Stat Number** | Playfair | `text-5xl md:text-6xl` | 400 | `-0.02em` |
| **Section Header** | Source Sans | `text-2xl` | 600 | `-0.01em` |
| **Subtitle** | Source Sans | `text-lg md:text-xl` | 400 | `0` |
| **Body** | Source Sans | `text-base` | 400 | `0` |
| **Label** | Source Sans | `text-sm` | 500 | `0` |
| **Caption** | Source Sans | `text-xs` | 500 | `0.05em` (uppercase) |

Scene 6 sets its title with `clamp(32px, 5vw, 52px)` at weight 500 rather than the
Tailwind step scale, because the composer below it is a fixed 620px column.

### Implementation

```html
<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">
```

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
      },
    },
  },
}
```

```jsx
// Usage
<h1 className="font-serif text-7xl tracking-tight">The Music</h1>
<p className="font-sans text-xl text-gray-500">A diverse sonic journey</p>
```

---

## Spacing

| Gap | Value | Use |
|-----|-------|-----|
| Scene padding | `py-20 px-8` | Breathing room |
| Title → Visualization | `mb-12` | Let it breathe |
| Visualization → Footer | `mt-8` | Comfortable close |
| Between cards | `gap-3` | Dense but distinct |

Scene 6 runs `padding: 80px 20px` and centres a `min(620px, 94vw)` column.

---

## Animation

### Entry
```typescript
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ duration: 0.8 }}
```

### Stagger
- Title: `delay: 0`
- Visualization: `delay: 0.2`
- Footer: `delay: 0.4`

### Hover
- Duration: `200ms`
- Cards: `scale(1.02)` + shadow
- Sunburst segments: expand outward 10-15%

Ask-register motion and the project's `prefers-reduced-motion` contract are
documented in [UI Component Patterns → Motion](./ui-component-patterns.md#motion).

---

## Viewport and scroll

Scenes are a `snap-y snap-mandatory` scroll container, one viewport each. Scene
offsets are absolute pixels — `(sceneId - 1) * innerHeight` — which is why rotation
needs explicit handling:

- `--app-vh` is set from `window.innerHeight` and consumed by `index.css`, because iOS
  Safari leaves CSS `100vh` stale after a rotation and the snap scenes then overlap.
- Re-alignment is guarded to **width** changes, so the iOS toolbar showing and hiding
  during normal scrolling never yanks the page.
- Chromium re-snaps on resize and self-corrects; Safari does not, so it is forced.

Any new scene must be one viewport tall and must not assume `100vh` resolves correctly.

---

## The "One Thing" Rule

Each scene has ONE dominant visual. If it doesn't dominate, simplify.

| Scene | Dominant Element | Attention |
|-------|------------------|-----------|
| Timeline | Year dots | 70% |
| Venues | Network graph | 80% |
| Geography | The map | 90% |
| Genres | The sunburst | 75% |
| Artists | The mosaic | 70% |
| Ask the Archive | The composer | 85% |

On scene 6 the suggested prompts are deliberately demoted to plain text hints rather
than buttons, so nothing competes with the composer.

---

## Adding New Scenes

### Checklist
- [ ] Added to `SCENE_LABELS` and `SCENE_MAP` in `src/components/changelog/constants.ts`?
- [ ] Prose roster updated in README, `docs/ROADMAP.md`, `CLAUDE.md` (`npm run validate:docs`)?
- [ ] What single idea does this scene communicate?
- [ ] What is the ONE dominant visual?
- [ ] Which background? (maintain light/dark rhythm)
- [ ] Typography matches other scenes?
- [ ] Entry animation consistent, and does it honour `prefers-reduced-motion`?
- [ ] One viewport tall, no bare `100vh`?
- [ ] Named for its **position**, or documented here if it can't be?

### Future Scene Ideas

| Scene | Background | Position |
|-------|------------|----------|
| Decades | `bg-dark-5` (navy) | After Timeline |
| Stats | `bg-dark-3` (near black) | Before Artists |
| Highlights | `bg-light-4` (cream) | After Geography |

Note that the arc now closes on Ask the Archive; a new scene inserted after it would
need a reason to follow the invitation to ask.

---

## Quick Reference

```
SCENE                BACKGROUND       TEXT
──────────────────────────────────────────────
1. Timeline          #ffffff          dark
2. Venues            gradient         white
3. Geography         #111827          white
4. Genres            #ede9fe          dark
5. Artists           #fafaf9          dark
6. Ask the Archive   layered violet   white

TYPOGRAPHY
──────────────────────────────────────────────
Display:  Playfair Display (titles, stats)
Body:     Source Sans 3 (everything else)

Title:    Playfair 5xl/7xl tracking-tight
Stat:     Playfair 5xl/6xl tracking-tight
Section:  Source Sans 2xl semibold
Subtitle: Source Sans lg/xl regular muted
Body:     Source Sans base regular
Label:    Source Sans sm medium
Caption:  Source Sans xs medium uppercase wide

SPACING
──────────────────────────────────────────────
Scene:     py-20
Title→Viz: mb-12
Viz→Foot:  mt-8

ASK REGISTER GLASS
──────────────────────────────────────────────
0.055 exhibit · 0.07 chips · 0.08 dock
0.09 hover · 0.12 mobile dock · 0.13 ceiling
```
