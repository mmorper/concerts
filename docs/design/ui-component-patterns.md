# UI Component Patterns & Design System

**Version:** 1.1
**Last Updated:** 2026-09-03
**Related:** [Scene Design Guide](./scene-design-guide.md) · [Color Specification](./color-specification.md)

---

## Overview

This document codifies the UI component patterns discovered through comprehensive
cross-scene analysis. These patterns create visual hierarchy and consistent affordance
across all interactive elements.

**Key Principle:** Different component types use different visual treatments to
communicate their purpose at a glance.

**Scene numbering:** this document previously numbered the scenes from their component
filenames, which do not match their render positions — it listed both "Venues" and
"Bands" as separate scenes and put Artists at 6. The canonical roster is
`SCENE_LABELS` in `src/components/changelog/constants.ts`; see the
[Scene Design Guide](./scene-design-guide.md#canonical-scene-roster) for the mapping and
the filename trap.

---

## Component Categorization

### Primary Toggle Controls
**Purpose:** Scene-level state changes (sort order, view mode, filter toggle)
**Visual Treatment:** **Solid backgrounds**
**Examples:** Sort buttons (A-Z, Genre, Most Seen), View mode toggles, Region tabs

### Input Fields
**Purpose:** User text entry and search
**Visual Treatment:** **Glassmorphism (semi-transparent with backdrop blur)**
**Examples:** Search input, text fields (when added)

### Secondary/Utility Actions
**Purpose:** One-off actions, resets, navigation aids
**Visual Treatment:** **Glassmorphism (semi-transparent with backdrop blur)**
**Examples:** Reset view buttons, navigation overlays, close buttons

### Conversational surfaces
**Purpose:** The Ask scene and Spotlight overlay
**Visual Treatment:** **The Ask register** — a separate, finer glass scale
**Examples:** Exhibit cards, chips, input dock, Spotlight panel

The Ask register is **not** the `white/10` glassmorphism below. It is documented in
[Scene Design Guide → The Ask register](./scene-design-guide.md#the-ask-register).
Do not use `white/10` inside the Ask surfaces, and do not use the Ask glass scale for
scene controls.

---

## Pattern Specifications

### Primary Toggle Controls (Solid Backgrounds)

**Why Solid?**
- Strong affordance ("these are important controls")
- Clear active/inactive states
- Anchor visual hierarchy
- Draw attention as primary interactions

#### Dark Scenes (2 Venues, 3 Geography, 6 Ask)

**Inactive State:**
```css
background: rgb(31, 41, 55);           /* bg-gray-800 */
color: rgb(156, 163, 175);             /* text-gray-400 */
border: none;
transition: background-color 200ms;
```

**Hover State:**
```css
background: rgb(55, 65, 81);           /* bg-gray-700 */
```

**Active State:**
```css
background: rgb(79, 70, 229);          /* bg-indigo-600 */
color: white;
```

**Implementation:**
```tsx
<button
  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
    isActive
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
  }`}
>
  Button Text
</button>
```

Scene 6 carries no primary toggles — it has exactly one control, the composer.

#### Light Scenes (1 Timeline, 4 Genres, 5 Artists)

**Inactive State:**
```css
background: white;                     /* bg-white */
color: rgb(55, 65, 81);               /* text-gray-700 */
border: 1px solid rgb(209, 213, 219); /* border-gray-300 */
transition: background-color 200ms;
```

**Hover State:**
```css
background: rgb(243, 244, 246);       /* bg-gray-100 */
```

**Active State:**
```css
background: rgb(124, 58, 237);        /* bg-violet-600 */
color: white;
border: none;
```

**Implementation:**
```tsx
<button
  className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
    isActive
      ? 'bg-violet-600 text-white'
      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
  }`}
>
  Button Text
</button>
```

**Color Choice Rationale:**
- **Indigo-600** for dark scenes (cool, tech-forward)
- **Violet-600** for light scenes (warmer, more approachable)
- Different colors prevent visual monotony across scenes
- Both are vibrant enough for clear active state indication

---

### Input Fields (Glassmorphism)

**Why Glassmorphism?**
- Subtle, elegant treatment
- Blends with scene backgrounds
- Creates visual hierarchy (softer than solid buttons)
- Differentiates inputs from toggles

```css
background: rgba(255, 255, 255, 0.1);  /* bg-white/10 */
backdrop-filter: blur(8px);            /* backdrop-blur-sm */
border: 1px solid rgba(255, 255, 255, 0.2);
color: white;
placeholder: rgba(255, 255, 255, 0.6);
```

**Focus State:**
```css
border-color: rgb(192, 132, 252);      /* border-purple-400 */
box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.3);  /* ring-purple-500/30 */
```

**Implementation:**
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

**Note:** The treatment is identical on light and dark scenes — light scenes still use
white text on glass inputs because they appear over gradient overlays (darker
backgrounds), not directly on the light scene background.

**Note:** the Ask input dock is not this component. It uses `white/0.08` with a
`rgba(167,139,250,0.6)` focus border, 14px radius, and a 40px send button (44px on
phones, where `font-size: 16px` is mandatory to defeat iOS focus-zoom).

---

### Secondary Actions (Glassmorphism)

#### Dark Scenes

```css
background: rgba(255, 255, 255, 0.1);  /* bg-white/10 */
backdrop-filter: blur(8px);
border: 1px solid rgba(255, 255, 255, 0.2);
color: white;
```

**Hover:** `background: rgba(255, 255, 255, 0.2);`

```tsx
<button
  className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20
    rounded-lg text-white font-sans text-sm font-medium
    hover:bg-white/20 transition-all duration-200 min-h-[44px]"
>
  Reset View
</button>
```

#### Light Scenes

```css
background: rgba(255, 255, 255, 0.8);  /* bg-white/80 */
backdrop-filter: blur(8px);
border: 1px solid rgb(209, 213, 219); /* border-gray-300 */
color: rgb(17, 24, 39);               /* text-gray-900 */
```

**Hover:** `background: white;`

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

## Cross-Scene Pattern Matrix

| Scene | Component | Background | Primary Toggles | Input Fields | Secondary Actions |
|-------|-----------|------------|-----------------|--------------|-------------------|
| **1. Timeline** | `Scene1Hero` | Light (white) | N/A | N/A | N/A |
| **2. Venues** | `Scene4Bands` | Dark (gradient) | Solid gray-800/indigo-600 | N/A | Glass white/10 |
| **3. Geography** | `Scene3Map` | Dark (gray-900) | Solid gray-800/indigo-600 | N/A | Glass white/10 |
| **4. Genres** | `Scene5Genres` | Light (violet-100) | N/A | N/A | Glass white/80 |
| **5. Artists** | `ArtistScene` | Light (stone-50) | Solid white/violet-600 | Glass white/10 | N/A |
| **6. Ask the Archive** | `AskScene` | Dark (layered violet) | N/A | **Ask register** | **Ask register** |

---

## Motion

Previously undocumented. `src/components/ask/ask.css` handles
`prefers-reduced-motion` throughout; nothing else in the repo did, and any new
animation is expected to.

### Standard easing

| Use | Curve | Duration |
|-----|-------|----------|
| General | `cubic-bezier(0.4, 0, 0.2, 1)` | 200ms |
| Slide panels | `cubic-bezier(0.4, 0, 0.2, 1)` | 400ms |
| Spotlight bloom | `cubic-bezier(0.2, 0.7, 0.3, 1)` | 220ms |

### Ask-register keyframes

| Name | Spec | Applies to |
|------|------|------------|
| `ask-rise` | `0.4s ease both` — fade + 8px rise | Exhibit card entry |
| `ask-bloom` | `0.22s` bloom curve — fade + 8px rise + `scale(0.985→1)` | Spotlight panel |
| `ask-scrim-in` | `0.18s ease both` — opacity | Spotlight scrim |
| `ask-fade-in` | `0.18s ease both` — opacity | Mobile sheet, reduced-motion fallback |
| `ask-pulse` | `1.2s ease-in-out infinite`, 0.15s stagger | Loading dots |
| `ask-blink` | `1s steps(2) infinite` | Streaming cursor |

### The reduced-motion contract

| Element | Reduced-motion behaviour |
|---------|--------------------------|
| Exhibit card | `animation: none` |
| Loading dots | `animation: none; opacity: 0.5` — still legible as a state |
| Spotlight panel | Cross-fade (`ask-fade-in`), **not** scale. Spec #142: keep the scrim's opacity fade; drop the palette's scale/translate bloom |
| Scene composer | `transition: none` |

Two rules to follow when adding motion:

1. **Degrade to a cross-fade, not to nothing**, where the animation carries meaning.
   A loading indicator that stops animating must still read as loading — hence the
   `opacity: 0.5` floor rather than `animation: none` alone.
2. **Never let a reduced-motion override clobber a functional transform.** The mobile
   sheet uses `translateY(var(--ask-vvtop))` to ride above the keyboard;
   `ask-bloom` runs `fill: both`, so applying it there would overwrite that offset.
   This is why the phone sheet uses an opacity-only intro.

---

## Z-Index Layers

The scale below runs to **2100**. The 0–50 range documented in v1.0 described only
scene-local chrome and was never the whole story; map scene chrome alone sits at
1000–1001.

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base content | 0 | Scene backgrounds |
| Floating UI | 10 | Filter panels, tooltips |
| Overlays | 20 | Modals, gatefold |
| Popups | 30 | Map popups, dropdowns |
| Toast (scene-local) | 40 | Notifications |
| Navigation | 50 | Fixed headers, scene rail |
| Leaflet controls | 500 | Map caption over tiles (`.ask-map-wrap .cap`) |
| Map scene chrome | 1000–1001 | Scene 3 title and region tabs |
| Ask Spotlight scrim | 2000 | Must clear map chrome, or the modal is pierced by it |
| Turnstile challenge | 2100 | `.ts-gate` — above everything, including the Spotlight |
| Changelog toast | 9999 | `TOAST.Z_INDEX` in `changelog/constants.ts` |

Two known inconsistencies, left as-is here because they are code comments rather than
design decisions:

- `ask.css` describes `.ts-gate` as "above the overlay (z 60)" while setting `2100`.
- The changelog toast at 9999 is not part of the scale; it is an absolute ceiling.

When adding a layer, place it against this table rather than picking a round number.

---

## Spacing Standards

| Context | Value |
|---------|-------|
| Scene padding | `py-20 px-8` |
| Title → Visualization | 48px (`mb-12`) |
| Visualization → Footer | 32px (`mt-8`) |
| Between cards | 12px (`gap-3`) |
| Button padding | 24px × 12px (`px-6 py-3`) |

---

## Accessibility Requirements

- **Min touch target:** 44×44px (`min-h-[44px]`)
- **Focus visible:** Purple ring (`focus:ring-2 focus:ring-purple-500/30`); Ask surfaces
  use `:focus-within` on the dock with a `rgba(167,139,250,0.6)` border
- **Color contrast:** WCAG AA minimum
- **Keyboard nav:** All interactive elements focusable; Spotlight opens on ⌘K and
  closes on Escape
- **Reduced motion:** see [Motion](#motion) — required, not optional
- **iOS inputs:** 16px minimum font-size on any focusable input, or Safari zooms

---

## Implementation Guidelines

### When to Use Solid Backgrounds

✅ Sort controls, view mode toggles, filter toggles, region tabs — any control that
changes scene-level state.

❌ Search/text inputs, reset buttons, navigation aids, temporary overlays.

### When to Use Glassmorphism

✅ Search and text inputs, reset/clear buttons, navigation overlays, close buttons,
utility controls (zoom, pan indicators).

❌ Primary sort/filter/view controls, important state toggles, anything requiring
strong affordance — and anything inside the Ask surfaces, which have their own scale.

### Color Selection Rules

**Active State Colors:**
- Dark scenes → **indigo-600** (`#4f46e5`)
- Light scenes → **violet-600** (`#7c3aed`)

**Focus/Accent Colors (scene controls):**
- Border: **purple-400** (`#c084fc`)
- Ring: **purple-500/30** (`rgba(168, 85, 247, 0.3)`)

**Ask register accents:**
- Kicker and links: `#818cf8`
- Live dot and hover borders: `#a5b4fc` / `rgba(165, 180, 252, 0.55)`
- Dock focus: `rgba(167, 139, 250, 0.6)`

**Why purple family?** Ties to the venue scene gradient (indigo → purple). Warm enough
for light scenes, cool enough for dark. Distinct from genre colors, which are reserved
for data.

---

## Anti-Patterns to Avoid

❌ **Don't mix treatments for the same component type** across scenes.

❌ **Don't use glassmorphism for primary toggles.**

❌ **Don't use solid backgrounds for search inputs.**

❌ **Don't use `white/10` inside the Ask surfaces**, or the Ask glass scale outside them.

❌ **Don't add icons to buttons without approval.** The design team has explicitly
requested text-only buttons.

❌ **Don't use genre colors for UI elements** — reserved for data visualization.

❌ **Don't ship an animation without a `prefers-reduced-motion` branch.**

❌ **Don't infer scene numbers from component filenames.** They do not match.

---

## Evolution & Future Considerations

| Component Type | Treatment | Rationale |
|----------------|-----------|-----------|
| **Tabs** | Solid backgrounds | Primary navigation = strong affordance |
| **Radio buttons** | Solid backgrounds | State selection = primary control |
| **Checkboxes** | Depends on context | Solid trigger, glass dropdown |
| **Dropdown selects** | Glassmorphism | Similar to input fields |
| **Sliders** | Custom (track + thumb) | Unique control |
| **Pagination** | Solid backgrounds | Primary navigation control |
| **Toast notifications** | Glassmorphism | Temporary overlay |
| **Modal backgrounds** | Solid dark overlay | Needs strong contrast |

### Version History

**v1.1 (2026-09-03)**
- Corrected the scene matrix: six scenes on their real render positions, with
  component filenames named explicitly because they don't match
- Added Ask the Archive and the Ask register as a distinct treatment
- Z-index scale extended from 50 to 2100 with the layers actually in use
- Added the Motion section and the `prefers-reduced-motion` contract
- Recorded the two known z-index comment inconsistencies

**v1.0 (January 2025)** — Initial documentation. Codified solid vs glassmorphism,
established color rules, added implementation examples and anti-patterns.

---

## Quick Reference

### Decision Tree

```
Is this inside the Ask scene or Spotlight?
├─ YES → Use the ASK REGISTER (see Scene Design Guide)
│
└─ NO → Is this a PRIMARY scene control (sort, filter, view mode)?
    ├─ YES → Use SOLID background
    │   ├─ Dark scene (2, 3) → gray-800 inactive, indigo-600 active
    │   └─ Light scene (1, 4, 5) → white inactive, violet-600 active
    │
    └─ NO → Input field or secondary action?
        ├─ Input field → GLASSMORPHISM white/10, white text
        └─ Secondary action → GLASSMORPHISM
            ├─ Dark scene → white/10, white text
            └─ Light scene → white/80, dark text
```

### Code Snippets Library

**Primary Toggle (Dark Scene):**
```tsx
className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
  isActive ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
}`}
```

**Primary Toggle (Light Scene):**
```tsx
className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] ${
  isActive ? 'bg-violet-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
}`}
```

**Search Input (All Scenes):**
```tsx
className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20
  rounded-lg text-white placeholder-white/60
  focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30
  transition-all duration-200"
```

**Secondary Button (Dark Scene):**
```tsx
className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20
  rounded-lg text-white font-sans text-sm font-medium
  hover:bg-white/20 transition-all duration-200 min-h-[44px]"
```

**Reduced-motion guard:**
```css
@media (prefers-reduced-motion: reduce) {
  .my-element { animation: fade-in 0.18s ease both; }  /* cross-fade, not none */
}
```

---

## Related Documentation

- [Scene Design Guide](./scene-design-guide.md) — roster, backgrounds, typography, Ask register
- [Color Specification](./color-specification.md) — genre colors, background tokens
- `src/components/changelog/constants.ts` — canonical scene roster, toast tokens
- `src/components/ask/ask.css` — the Ask register in source

---

**Last Updated:** 2026-09-03
**Maintained By:** Design Team
