# Morperhaus Concerts — Scene Design Guide

**Version:** 1.0  
**Last Updated:** December 2024  
**Related:** [Color Specification Guide](./color-specification.md)

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

### Visual Rhythm

```
LIGHT → DARK → DARK → LIGHT → LIGHT

  1        2       3       4        5
  ○        ●       ●       ○        ○
```

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

---

### Scene 4: Genres

| Property | Value |
|----------|-------|
| **Background** | `bg-light-5` / `#ede9fe` (Soft Violet) |
| **Text** | `#1f2937` (dark) / `#6b7280` (muted) |
| **Visualization** | Full Concert Poster palette (20 genre colors) |
| **Dominant Element** | Genre donut chart |
| **Mood** | Musical, vibrant, "this is who I am" |

**Why violet?** Ties back to Venues gradient. Makes warm genre colors pop through simultaneous contrast. Says "this is about music."

---

### Scene 5: Artists

| Property | Value |
|----------|-------|
| **Background** | `bg-light-3` / `#fafaf9` (Warm Stone) |
| **Text** | `#1f2937` (dark) / `#6b7280` (muted) |
| **Accents** | Genre colors as card borders/badges |
| **Dominant Element** | Artist grid |
| **Mood** | Personal, warm, "these are my people" |

---

## Typography

### Font Pairing

| Role | Font | Google Fonts |
|------|------|--------------|
| **Display** | Playfair Display | Titles, stat numbers, modal headers |
| **Body** | Source Sans 3 | Subtitles, labels, body text, UI |

**Why this pairing:** Playfair has timeless editorial quality — like a concert program or music magazine. Source Sans is crisp and readable without being generic. Together they feel sophisticated but not stuffy.

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
- Donut segments: expand outward 10-15%

---

## The "One Thing" Rule

Each scene has ONE dominant visual. If it doesn't dominate, simplify.

| Scene | Dominant Element | Attention |
|-------|------------------|-----------|
| Timeline | Year dots | 70% |
| Venues | Network graph | 80% |
| Geography | The map | 90% |
| Genres | The donut | 75% |
| Artists | The grid | 70% |

---

## Adding New Scenes

### Checklist
- [ ] What single idea does this scene communicate?
- [ ] What is the ONE dominant visual?
- [ ] Which background? (maintain light/dark rhythm)
- [ ] Typography matches other scenes?
- [ ] Entry animation consistent?

### Future Scene Ideas

| Scene | Background | Position |
|-------|------------|----------|
| Decades | `bg-dark-5` (navy) | After Timeline |
| Stats | `bg-dark-3` (near black) | Before Artists |
| Highlights | `bg-light-4` (cream) | After Geography |

---

## Quick Reference

```
SCENE           BACKGROUND       TEXT
─────────────────────────────────────────
1. Timeline     #ffffff          dark
2. Venues       gradient         white
3. Geography    #111827          white
4. Genres       #ede9fe          dark
5. Artists      #fafaf9          dark

TYPOGRAPHY                         
─────────────────────────────────────────
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
─────────────────────────────────────────
Scene:     py-20
Title→Viz: mb-12
Viz→Foot:  mt-8
```
