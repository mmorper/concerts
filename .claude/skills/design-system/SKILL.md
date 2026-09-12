# Design System Skill

**Purpose:** Reference this skill when building UI components, styling elements, or working with visual design in Morperhaus Concerts.

**When to use:**
- Creating new components
- Styling existing components
- Adding animations or interactions
- Working with colors or typography
- Building for specific scenes

---

## Quick Reference

### Scene roster — read this first

There are **six** scenes. The authoritative source is `SCENE_LABELS` / `SCENE_MAP` in
`src/components/changelog/constants.ts`.

**The component filenames do not match the scene positions.** `Scene4Bands` renders at
position 2 (Venues); `Scene5Genres` renders at position 4. `ArtistScene` and `AskScene`
carry no number. Never infer a scene's number from its filename — read `SCENE_MAP` or
the render order in `App.tsx`.

| # | Slug | Name | Component | Path |
|---|------|------|-----------|------|
| 1 | `timeline` | Timeline | `Scene1Hero` | `src/components/scenes/Scene1Hero.tsx` |
| 2 | `venues` | Venues | `Scene4Bands` | `src/components/scenes/Scene4Bands.tsx` |
| 3 | `geography` | Geography | `Scene3Map` | `src/components/scenes/Scene3Map.tsx` |
| 4 | `genres` | Genres | `Scene5Genres` | `src/components/scenes/Scene5Genres/index.tsx` |
| 5 | `artists` | Artists | `ArtistScene` | `src/components/scenes/ArtistScene/ArtistScene.tsx` |
| 6 | `ask` | Ask the Archive | `AskScene` | `src/components/ask/AskScene.tsx` |

Not mounted, despite existing in `scenes/`: `Scene2Venues.tsx` (superseded by
`Scene4Bands`) and `Scene5Genres.sunburst.tsx.bak`.

`npm run validate:docs` (#284) asserts the prose roster in README, `docs/ROADMAP.md`
and `CLAUDE.md` matches `SCENE_LABELS`.

### Scene Backgrounds

| # | Name | Background | Text |
|---|------|------------|------|
| 1 | Timeline | `#ffffff` (white) | Dark |
| 2 | Venues | Gradient `#1e1b4b → #581c87` | White |
| 3 | Geography | `#111827` (charcoal) | White |
| 4 | Genres | `#ede9fe` (soft violet) | Dark |
| 5 | Artists | `#fafaf9` (warm stone) | Dark |
| 6 | Ask the Archive | Layered violet (see below) | White |

Scene 6:
```css
background:
  radial-gradient(1100px 620px at 50% 30%, rgba(140, 122, 224, 0.26), transparent 62%),
  linear-gradient(180deg, #181334 0%, #1e1b4b 40%, #241253 78%, #2c1660 100%);
```

Rhythm: `LIGHT → DARK → DARK → LIGHT → LIGHT → DARK`.

### Typography

| Role | Font | Usage |
|------|------|-------|
| Display | Playfair Display | Titles, stat numbers, headers |
| Body | Source Sans 3 | Everything else |

### Button Patterns

**Primary Toggles (sort, filter, view mode):**
- Dark scenes: `bg-gray-800` inactive → `bg-indigo-600` active
- Light scenes: `bg-white border` inactive → `bg-violet-600` active

**Secondary Actions (reset, close):**
- Dark scenes: `bg-white/10 backdrop-blur-sm`
- Light scenes: `bg-white/80 backdrop-blur-sm`

**Inputs (search, text fields):**
- All scenes: `bg-white/10 backdrop-blur-sm border-white/20`

**Anything inside the Ask scene or Spotlight:** use the Ask register, not these.

---

## The Ask register

Scene 6 and the Spotlight overlay use a finer glass scale than the rest of the app.
This is a separate register for a conversational surface — do not substitute
`white/10`, and do not use these values on scene controls.

| Level | Fill | Border | Used by |
|-------|------|--------|---------|
| Finest | `rgba(255,255,255,0.055)` | `rgba(255,255,255,0.12)` | Exhibit card |
| Fine | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.16)` | Chips, show pills, composer |
| Mid | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.18)` | Input dock |
| Raised | `rgba(255,255,255,0.09)` | `rgba(165,180,252,0.55)` | Composer hover |
| Mobile dock | `rgba(255,255,255,0.12)` | `rgba(165,180,252,0.50)` | Dock, phone only |
| Hover ceiling | `rgba(255,255,255,0.13)` | — | Chip / pill hover |

Blur: `blur(2px)` (map caption) → `blur(8px)` (dock) → `blur(10px)` (exhibit) →
`blur(20px)` (Spotlight panel). Always with the `-webkit-` prefix.

| Surface | Spec |
|---------|------|
| Spotlight panel | `rgba(30,27,75,0.92)`, radius 18, `blur(20px)`, `0 40px 90px rgba(0,0,0,0.5)` |
| Spotlight scrim | `rgba(15,12,40,0.55)`, `blur(3px)` |
| Mobile sheet | Opaque `#1e1b4b`, full-bleed, **no** scrim blur (fully occluded — an invisible compositing cost) |

Accents: `#818cf8` (kicker, links) · `#a5b4fc` (live dot) · `rgba(167,139,250,0.6)`
(dock focus).

The chat is the Spotlight overlay, available over **any** route via ⌘K — not a page.
`/ask` redirects to `/?scene=ask`.

---

## Genre Colors

Deep jewel tones for concert poster aesthetic:

| Genre | Hex | Tailwind-ish |
|-------|-----|--------------|
| New Wave | `#1e40af` | blue-800 |
| Punk | `#991b1b` | red-800 |
| Alternative | `#5b21b6` | violet-800 |
| Ska | `#f59e0b` | amber-500 |
| Indie Rock | `#0ea5e9` | sky-500 |
| Electronic | `#06b6d4` | cyan-500 |
| Pop Rock | `#dc2626` | red-600 |
| Pop Punk | `#ec4899` | pink-500 |
| Classic Rock | `#92400e` | amber-800 |
| Jazz | `#4338ca` | indigo-700 |
| Reggae | `#16a34a` | green-600 |
| Metal | `#18181b` | zinc-900 |
| Hip Hop | `#ea580c` | orange-600 |
| R&B/Soul | `#7c3aed` | violet-600 |
| Folk/Country | `#a16207` | yellow-700 |
| Funk | `#d97706` | amber-600 |
| Blues | `#1e3a8a` | blue-900 |
| World | `#14b8a6` | teal-500 |
| Experimental | `#a855f7` | purple-500 |
| Other | `#6b7280` | gray-500 |

**TypeScript:**
```typescript
import { GENRE_COLORS, getGenreColor } from '@/constants/colors';
const color = getGenreColor('New Wave'); // '#1e40af'
```

Genre colors are reserved for data visualization. Never use them for UI chrome.

---

## Typography Scale

| Element | Font | Size | Weight | Tracking |
|---------|------|------|--------|----------|
| Scene Title | Playfair | `text-5xl md:text-7xl` | 400 | `-0.02em` |
| Stat Number | Playfair | `text-5xl md:text-6xl` | 400 | `-0.02em` |
| Section Header | Source Sans | `text-2xl` | 600 | `-0.01em` |
| Subtitle | Source Sans | `text-lg md:text-xl` | 400 | `0` |
| Body | Source Sans | `text-base` | 400 | `0` |
| Label | Source Sans | `text-sm` | 500 | `0` |
| Caption | Source Sans | `text-xs` | 500 | `0.05em` (uppercase) |

Scene 6's title is the one exception: `clamp(32px, 5vw, 52px)` at weight 500, because
it sits above a fixed 620px column.

**Usage:**
```jsx
<h1 className="font-serif text-7xl tracking-tight">The Music</h1>
<p className="font-sans text-xl text-gray-500">A diverse journey</p>
```

---

## Animation Standards

### Entry Animation
```typescript
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
transition={{ duration: 0.8 }}
```

### Stagger Delays
- Title: `delay: 0`
- Visualization: `delay: 0.2`
- Footer: `delay: 0.4`

### Hover Effects
- Duration: `200ms`
- Cards: `scale(1.02)` + shadow increase
- Buttons: Background color transition

### Standard Easing
- General: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- Slide panels: `cubic-bezier(0.4, 0, 0.2, 1)`, 400ms
- Spotlight bloom: `cubic-bezier(0.2, 0.7, 0.3, 1)`, 220ms

### Ask-register keyframes

| Name | Spec | Applies to |
|------|------|------------|
| `ask-rise` | `0.4s ease both` — fade + 8px rise | Exhibit entry |
| `ask-bloom` | `0.22s` bloom curve — fade + rise + `scale(0.985→1)` | Spotlight panel |
| `ask-scrim-in` | `0.18s ease both` | Spotlight scrim |
| `ask-fade-in` | `0.18s ease both` | Mobile sheet, reduced-motion fallback |
| `ask-pulse` | `1.2s ease-in-out infinite`, 0.15s stagger | Loading dots |
| `ask-blink` | `1s steps(2) infinite` | Streaming cursor |

### Reduced motion — required

Every animation needs a `prefers-reduced-motion: reduce` branch. `ask.css` is the
reference implementation.

| Element | Behaviour |
|---------|-----------|
| Exhibit card | `animation: none` |
| Loading dots | `animation: none; opacity: 0.5` — still reads as loading |
| Spotlight panel | Cross-fade, **not** scale (spec #142) |
| Scene composer | `transition: none` |

Two rules:

1. **Degrade to a cross-fade, not to nothing**, where the motion carries meaning.
2. **Never let a reduced-motion override clobber a functional transform.** The mobile
   sheet uses `translateY(var(--ask-vvtop))` to ride above the keyboard, and
   `ask-bloom` runs `fill: both` — applying it there would overwrite that offset.

```css
@media (prefers-reduced-motion: reduce) {
  .my-element { animation: fade-in 0.18s ease both; }
}
```

---

## Component Patterns

### Primary Toggle Button (Dark Scene)
```tsx
<button
  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
    isActive
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
  }`}
>
  {label}
</button>
```

### Primary Toggle Button (Light Scene)
```tsx
<button
  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
    isActive
      ? 'bg-violet-600 text-white'
      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
  }`}
>
  {label}
</button>
```

### Search Input (All Scenes)
```tsx
<input
  type="text"
  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20
    rounded-lg text-white placeholder-white/60
    focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30
    transition-all duration-200"
  placeholder="Search..."
/>
```

### Secondary Button (Dark Scene)
```tsx
<button
  className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20
    rounded-lg text-white font-sans text-sm font-medium
    hover:bg-white/20 transition-all duration-200 min-h-[44px]"
>
  Reset View
</button>
```

### Secondary Button (Light Scene)
```tsx
<button
  className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-gray-300
    rounded-lg text-gray-900 font-sans text-sm font-medium
    hover:bg-white transition-all duration-200 shadow-sm min-h-[44px]"
>
  Reset View
</button>
```

---

## Spacing Standards

| Context | Value | Tailwind |
|---------|-------|----------|
| Scene padding | `py-20 px-8` | `py-20 px-8` |
| Title → Visualization | 48px | `mb-12` |
| Visualization → Footer | 32px | `mt-8` |
| Between cards | 12px | `gap-3` |
| Button padding | 24px × 12px | `px-6 py-3` |

Scene 6: `padding: 80px 20px`, centring a `min(620px, 94vw)` column.

---

## Z-Index Layers

Runs to **2100**. The 0–50 range describes scene-local chrome only.

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base content | 0 | Scene backgrounds |
| Floating UI | 10 | Filter panels, tooltips |
| Overlays | 20 | Modals, gatefold |
| Popups | 30 | Map popups, dropdowns |
| Toast (scene-local) | 40 | Notifications |
| Navigation | 50 | Fixed headers, scene rail |
| Leaflet controls | 500 | Map caption over tiles |
| Map scene chrome | 1000–1001 | Scene 3 title and region tabs |
| Ask Spotlight scrim | 2000 | Must clear map chrome or the modal is pierced |
| Turnstile challenge | 2100 | `.ts-gate`, above the Spotlight |
| Changelog toast | 9999 | `TOAST.Z_INDEX`; an absolute ceiling, not part of the scale |

Place new layers against this table rather than picking a round number.

---

## Viewport and scroll

Scenes are a `snap-y snap-mandatory` container, one viewport each, positioned at
`(sceneId - 1) * innerHeight`.

- `--app-vh` is set from `window.innerHeight` and consumed by `index.css`: iOS Safari
  leaves CSS `100vh` stale after rotation and the snap scenes then overlap.
- Re-alignment is guarded to **width** changes, so the iOS toolbar showing/hiding
  during scroll never yanks the page.
- Safari does not re-snap on resize, so it is forced.

New scenes must be one viewport tall and must not rely on bare `100vh`.

---

## Accessibility Requirements

- **Min touch target:** 44×44px (`min-h-[44px]`)
- **Focus visible:** Purple ring (`focus:ring-2 focus:ring-purple-500/30`)
- **Color contrast:** WCAG AA minimum
- **Keyboard nav:** All interactive elements focusable; ⌘K opens the Spotlight, Escape closes
- **ARIA labels:** On icon-only buttons
- **Reduced motion:** required — see Animation Standards
- **iOS inputs:** 16px minimum font-size on focusable inputs, or Safari zooms on focus

---

## Decision Tree: Which Pattern?

```
Is this inside the Ask scene or Spotlight?
├─ YES → Use the ASK REGISTER
│
└─ NO → Is this a PRIMARY scene control (sort, filter, view)?
    ├─ YES → Use SOLID background
    │   ├─ Dark scene (2, 3) → gray-800/indigo-600
    │   └─ Light scene (1, 4, 5) → white/violet-600
    │
    └─ NO → Is it an input or secondary action?
        ├─ Input → GLASSMORPHISM (white/10)
        └─ Secondary → GLASSMORPHISM
            ├─ Dark scene → white/10
            └─ Light scene → white/80
```

---

## Anti-Patterns

❌ **Don't infer scene numbers from component filenames** — they don't match
❌ **Don't add icons to buttons** without explicit approval
❌ **Don't use glassmorphism for primary controls**
❌ **Don't use `white/10` in the Ask surfaces**, or the Ask glass scale outside them
❌ **Don't mix patterns** for the same component type across scenes
❌ **Don't use genre colors** for UI elements (reserved for data viz)
❌ **Don't skip min-height** on interactive elements
❌ **Don't ship an animation** without a reduced-motion branch

---

## Source Files

For complete specifications, see:
- `src/components/changelog/constants.ts` — **canonical scene roster**, toast tokens
- `src/components/ask/ask.css` — the Ask register in source
- `docs/design/color-specification.md` — Full color palette
- `docs/design/scene-design-guide.md` — Scene layouts, typography, Ask register
- `docs/design/ui-component-patterns.md` — Component code examples, motion, z-index
- `docs/design/changelog-style-guide.md` — Changelog entry writing

---

**Last Updated:** 2026-09-03
