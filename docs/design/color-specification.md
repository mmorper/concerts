# Morperhaus Concerts — Color Specification Guide

**Version:** 2.2
**Last Updated:** January 2026

---

## Genre Colors

### The Concert Poster Palette

Deep jewel tones at 35-45% lightness, 65-80% saturation.

| Genre | Hex | Vibe |
|-------|-----|------|
| **New Wave** | `#1e40af` | Deep navy blue — synth, cold, 80s |
| **Punk** | `#991b1b` | Dried blood red — raw, aggressive |
| **Alternative** | `#5b21b6` | Deep violet — moody, introspective |
| **Ska** | `#f59e0b` | Bright amber — brass, sunshine |
| **Indie Rock** | `#0ea5e9` | Sky blue — melodic, expansive |
| **Electronic** | `#06b6d4` | Bright cyan — synthetic, club lights |
| **Pop Rock** | `#dc2626` | Bright red — warm, accessible |
| **Pop Punk** | `#ec4899` | Hot pink — youthful, loud |
| **Classic Rock** | `#92400e` | Dark brown leather — vintage, worn |
| **Jazz** | `#4338ca` | Rich indigo — smoky, sophisticated |
| **Reggae** | `#16a34a` | Vibrant green — roots, earth |
| **Metal** | `#18181b` | Near-black — heavy, dark |
| **Hip Hop** | `#ea580c` | Bright orange — street, bold |
| **R&B/Soul** | `#7c3aed` | Electric purple — smooth, rich |
| **Folk/Country** | `#a16207` | Golden brown — acoustic, earthy |
| **Funk** | `#d97706` | Rich gold — groove, 70s |
| **Blues** | `#1e3a8a` | Deep blue — soulful, late night |
| **World** | `#14b8a6` | Bright teal — global, oceanic |
| **Experimental** | `#a855f7` | Bright purple — weird, avant-garde |
| **Neo Mellow** | `#6ee7b7` | Soft sage green — chill, acoustic-electronic ✨ |
| **Orchestral Soundtrack** | `#881337` | Deep burgundy — cinematic, dramatic ✨ |
| **Reggae Rock** | `#14b8a6` | Teal — reggae-rock fusion ✨ |
| **Alternative Hip Hop** | `#b45309` | Dark amber — experimental rap ✨ |
| **Gulf and Western Country Rock** | `#c2410c` | Terracotta — southern rock ✨ |
| **Political Hip Hop** | `#be123c` | Bold crimson — conscious, message-driven ✨ |
| **Other** | `#6b7280` | Medium gray — neutral bucket |

✨ **Updated in v2.2** - Added 6 new genres from artist enrichment data

---

## Background System

### Light Backgrounds

| Token | Hex | Tailwind | Best For |
|-------|-----|----------|----------|
| `bg-light-1` | `#ffffff` | `bg-white` | Hero, clean starts |
| `bg-light-2` | `#f3f4f6` | `bg-gray-100` | Charts, data visualizations |
| `bg-light-3` | `#fafaf9` | `bg-stone-50` | Lists, grids, cards |
| `bg-light-4` | `#fef3c7` | `bg-amber-100` | Highlight/feature scenes |
| `bg-light-5` | `#ede9fe` | `bg-violet-100` | Music-themed scenes |

### Dark Backgrounds

| Token | Hex | Tailwind | Best For |
|-------|-----|----------|----------|
| `bg-dark-1` | `#111827` | `bg-gray-900` | Maps, geography |
| `bg-dark-2` | `#1e1b4b → #581c87` | `from-indigo-950 to-purple-950` | Networks, relationships |
| `bg-dark-3` | `#0c0a09` | `bg-stone-950` | Dramatic stats |
| `bg-dark-4` | `#1e1b4b` | `bg-indigo-950` | Music scenes (dark variant) |
| `bg-dark-5` | `#172554` | `bg-blue-950` | Timeline, historical |

### Text Colors

| Context | Primary | Muted |
|---------|---------|-------|
| On light backgrounds | `#1f2937` | `#6b7280` |
| On dark backgrounds | `#ffffff` | `#9ca3af` |

---

## CSS Variables

```css
:root {
  /* Genre Colors */
  --color-genre-new-wave: #1e3a8a;
  --color-genre-punk: #991b1b;
  --color-genre-alternative: #5b21b6;
  --color-genre-ska: #b45309;
  --color-genre-indie-rock: #1d4ed8;
  --color-genre-electronic: #0e7490;
  --color-genre-pop-rock: #c2410c;
  --color-genre-pop-punk: #be185d;
  --color-genre-classic-rock: #78350f;
  --color-genre-jazz: #312e81;
  --color-genre-reggae: #166534;
  --color-genre-metal: #1f2937;
  --color-genre-hip-hop: #9a3412;
  --color-genre-rnb-soul: #4c1d95;
  --color-genre-folk-country: #713f12;
  --color-genre-funk: #a16207;
  --color-genre-blues: #1e40af;
  --color-genre-world: #115e59;
  --color-genre-experimental: #7c3aed;
  --color-genre-other: #4b5563;

  /* Backgrounds - Light */
  --bg-light-1: #ffffff;
  --bg-light-2: #f3f4f6;
  --bg-light-3: #fafaf9;
  --bg-light-4: #fef3c7;
  --bg-light-5: #ede9fe;

  /* Backgrounds - Dark */
  --bg-dark-1: #111827;
  --bg-dark-2-start: #1e1b4b;
  --bg-dark-2-end: #581c87;
  --bg-dark-3: #0c0a09;
  --bg-dark-4: #1e1b4b;
  --bg-dark-5: #172554;

  /* Text */
  --text-on-light: #1f2937;
  --text-on-light-muted: #6b7280;
  --text-on-dark: #ffffff;
  --text-on-dark-muted: #9ca3af;
}
```

---

## TypeScript Constants

```typescript
// src/constants/colors.ts

export const GENRE_COLORS: Record<string, string> = {
  'New Wave': '#1e3a8a',
  'Punk': '#991b1b',
  'Alternative': '#5b21b6',
  'Ska': '#b45309',
  'Indie Rock': '#1d4ed8',
  'Electronic': '#0e7490',
  'Pop Rock': '#c2410c',
  'Pop Punk': '#be185d',
  'Classic Rock': '#78350f',
  'Jazz': '#312e81',
  'Reggae': '#166534',
  'Metal': '#1f2937',
  'Hip Hop': '#9a3412',
  'R&B/Soul': '#4c1d95',
  'Folk/Country': '#713f12',
  'Funk': '#a16207',
  'Blues': '#1e40af',
  'World': '#115e59',
  'Experimental': '#7c3aed',
  'Other': '#4b5563',
} as const;

export const BACKGROUNDS = {
  light1: '#ffffff',
  light2: '#f3f4f6',
  light3: '#fafaf9',
  light4: '#fef3c7',
  light5: '#ede9fe',
  dark1: '#111827',
  dark2: 'linear-gradient(135deg, #1e1b4b 0%, #581c87 100%)',
  dark3: '#0c0a09',
  dark4: '#1e1b4b',
  dark5: '#172554',
} as const;

export const DEFAULT_GENRE_COLOR = '#4b5563';

export function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] || DEFAULT_GENRE_COLOR;
}
```

---

## Color Families

**Blues & Indigos:** New Wave, Indie Rock, Blues, Jazz

**Purples & Magentas:** Alternative, R&B/Soul, Experimental, Pop Punk

**Oranges & Warm Tones:** Ska, Pop Rock, Hip Hop, Funk

**Earth & Nature:** Classic Rock, Folk/Country, Reggae, World

**Reds, Cyans & Neutrals:** Punk, Electronic, Metal, Other

---

## Adding New Genres

1. Identify which color family it belongs to
2. Find an unused hue slot within that family
3. Match saturation (65-80%) and lightness (35-45%)
4. Add to `GENRE_COLORS` constant and CSS variables
5. Update this spec
