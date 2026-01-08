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

### Scene Components

| Scene | Name | Component | Path |
|-------|------|-----------|------|
| 1 | Timeline | Scene1Hero | `src/components/scenes/Scene1Hero.tsx` |
| 2 | Venues | Scene2Venues | `src/components/scenes/Scene2Venues.tsx` |
| 3 | Geography | Scene3Map | `src/components/scenes/Scene3Map.tsx` |
| 4 | Artists | Scene4Bands | `src/components/scenes/Scene4Bands.tsx` |
| 5 | Genres | Scene5Genres | `src/components/scenes/Scene5Genres.tsx` |

### Scene Backgrounds

| Scene | Name | Background | Text |
|-------|------|------------|------|
| 1 | Timeline | `#ffffff` (white) | Dark |
| 2 | Venues | Gradient `#1e1b4b → #581c87` | White |
| 3 | Geography | `#111827` (charcoal) | White |
| 4 | Genres | `#ede9fe` (soft violet) | Dark |
| 5 | Artists | `#fafaf9` (warm stone) | Dark |

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
| Blues | `#1e3a8a` | blue-800 |
| World | `#14b8a6` | teal-500 |
| Experimental | `#a855f7` | purple-500 |
| Other | `#6b7280` | gray-500 |

**TypeScript:**
```typescript
import { GENRE_COLORS, getGenreColor } from '@/constants/colors';
const color = getGenreColor('New Wave'); // '#1e40af'
```

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

---

## Z-Index Layers

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base content | 0 | Scene backgrounds |
| Floating UI | 10 | Filter panels, tooltips |
| Overlays | 20 | Modals, gatefold |
| Popups | 30 | Map popups, dropdowns |
| Toast | 40 | Notifications |
| Navigation | 50 | Fixed headers |

---

## Accessibility Requirements

- **Min touch target:** 44×44px (`min-h-[44px]`)
- **Focus visible:** Purple ring (`focus:ring-2 focus:ring-purple-500/30`)
- **Color contrast:** WCAG AA minimum
- **Keyboard nav:** All interactive elements focusable
- **ARIA labels:** On icon-only buttons

---

## Decision Tree: Which Pattern?

```
Is this a PRIMARY scene control (sort, filter, view)?
├─ YES → Use SOLID background
│   ├─ Dark scene → gray-800/indigo-600
│   └─ Light scene → white/violet-600
│
└─ NO → Is it an input or secondary action?
    ├─ Input → Use GLASSMORPHISM (white/10)
    └─ Secondary → Use GLASSMORPHISM
        ├─ Dark scene → white/10
        └─ Light scene → white/80
```

---

## Anti-Patterns

❌ **Don't add icons to buttons** without explicit approval
❌ **Don't use glassmorphism for primary controls**
❌ **Don't mix patterns** for same component type across scenes
❌ **Don't use genre colors** for UI elements (reserved for data viz)
❌ **Don't skip min-height** on interactive elements

---

## Source Files

For complete specifications, see:
- `docs/design/color-specification.md` — Full color palette
- `docs/design/scene-design-guide.md` — Scene layouts and typography
- `docs/design/ui-component-patterns.md` — Component code examples
- `docs/design/changelog-style-guide.md` — Changelog entry writing

---

**Last Updated:** 2026-01-06
