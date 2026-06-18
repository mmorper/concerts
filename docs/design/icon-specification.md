# Icon Design Specification

**Version:** 2.0
**Date:** 2026-06-18
**Status:** Implemented

> **v2.0 — Liquid Glass.** The mark now ships as a layered [Apple Icon Composer](https://developer.apple.com/icon-composer/)
> source (`MorperhausConcerts.icon`) for iOS 26 / macOS Tahoe Liquid Glass, and the
> central hero node uses a **luminous lavender bloom** (radial `#f5f3ff → #c4b5fd → #7c3aed`)
> in place of the earlier flat-overlay glow. All raster web icons are regenerated from the
> same updated source SVGs. See [Liquid Glass App Icon](#liquid-glass-app-icon-icon-composer).

---

## Overview

Morperhaus Concert Archives uses a unified icon design system based on **network node** imagery. The design references the artist/venue connection graphs found throughout the application and aligns with the purple gradient aesthetic established in the Venues scene.

---

## Design Concept

### Core Metaphor: Network Node
- Represents the interconnected nature of concerts, artists, and venues
- Echoes the data visualization approach used in the OG image
- Asymmetric, organic clustering suggests natural relationships
- Purple gradient palette establishes brand consistency

### Design Evolution
- **Previous design:** Orange ticket stub with music note (retired)
- **Current design:** Purple network nodes with connection lines
- **Rationale:** Purple better aligns with app's visual identity; network metaphor is more distinctive and data-forward

---

## Liquid Glass App Icon (Icon Composer)

**Source file:** `docs/design/icons/MorperhausConcerts.icon/` (Apple Icon Composer package)

The canonical app-icon artifact for iOS 26 / iPadOS 26 / macOS Tahoe and later. It
recreates the network-node mark as a layered, multi-appearance Liquid Glass icon that the
system renders with dynamic specular, translucency, and shadow. Open with
`open docs/design/icons/MorperhausConcerts.icon` (Icon Composer ships with Xcode 26+).

### Structure

A `.icon` file is a package: an `icon.json` manifest plus an `Assets/` folder of layers.

| Component | Format | Role |
|-----------|--------|------|
| Base `fill` (in `icon.json`) | linear-gradient | Background `#1e1b4b → #581c87`, **not** baked into artwork |
| `Assets/connections.svg` | SVG | Network connection lines (bottom) |
| `Assets/nodes.svg` | SVG | Six peripheral nodes (middle) |
| `Assets/hero.png` | PNG | Central luminous bloom (top) |

**Format rule:** flat-fill shapes are SVG (scalable); the radial-gradient hero is **PNG**,
because Icon Composer's SVG import does not reliably support gradients. Layers carry **no
background** — the gradient lives in the manifest so Liquid Glass applies correctly.

### Authoring rules (per Apple)

- Canvas **1024×1024** (1088 for a watchOS-specific variant).
- No background colors/gradients, blurs, shadows, or specular baked into layers — apply in Icon Composer.
- Convert text to outlines; don't export the canvas mask (the system crops automatically).
- Max **4 groups**, 1–4 layers each.

A flattened reference render (no live glass) lives at
`docs/design/icons/MorperhausConcerts-preview.png`; see also `MorperhausConcerts-icon-README.md`.

---

## iOS Home Screen Icon (180×180px)

### Design: Version 2 "Dense Network"

**Source file:** `docs/design/icons/ios-icon-v2-network.svg`

**Characteristics:**
- 6-node asymmetric network with interconnections
- Central hero node rendered as a **luminous lavender bloom** (radial, bright core → violet edge)
- Multiple connection weights (primary and secondary lines)
- Organic, non-geometric layout

**Colors:**
- Background gradient: `#1e1b4b → #581c87` (Venues scene gradient)
- Hero bloom: radial `#f5f3ff → #c4b5fd → #7c3aed` (bright lavender core to violet edge)
- Primary nodes: `#6366f1` (indigo-500), `#8b5cf6` (violet-500)
- Secondary nodes: `#7c3aed` (violet-600)
- Connection lines: `#a855f7` (purple-500), `#7c3aed` (violet-600)

**Technical specs:**
- Format: PNG (exported from SVG)
- Sizes: 180×180px, 167×167px, 152×152px
- Color space: RGB
- No transparency (solid background)
- iOS applies rounded corners automatically

**Files:**
- `public/icons/apple-touch-icon-180.png`
- `public/icons/apple-touch-icon-167.png`
- `public/icons/apple-touch-icon-152.png`

---

## Favicon (32×32px)

### Design: Version 7 "Organic Web"

**Source file:** `docs/design/icons/favicon-v7-organic.svg`

**Characteristics:**
- 5-connection web radiating from off-center node
- Off-center hub (positioned at `18, 13` for asymmetry)
- Varied peripheral node sizes (2px to 4px)
- Maximum network complexity while maintaining legibility at 16×16px

**Colors:**
- Background gradient: `#2e1065 → #581c87` (darker purple variant)
- Central node: bloom radial `#f5f3ff → #c4b5fd → #7c3aed` (matches app-icon hero)
- Peripheral nodes: `#8b5cf6`, `#6366f1`, `#7c3aed` (varied purples)
- Connection lines: `#a855f7` (purple-500)

**Technical specs:**
- Format: SVG (primary), PNG (fallback), ICO (legacy)
- Sizes: 32×32px, 16×16px
- Color space: RGB
- Solid background (no transparency)

**Files:**
- `public/favicon.svg` (primary, used by modern browsers)
- `public/favicon.ico` (multi-size ICO: 32×32 + 16×16)
- `public/icons/favicon-32.png` (source for ICO generation)
- `public/icons/favicon-16.png` (source for ICO generation)

---

## Color Palette Reference

All colors from the design system ([design-system/SKILL.md](../../.claude/skills/design-system/SKILL.md)):

| Color Name | Hex | Tailwind | Usage |
|------------|-----|----------|-------|
| Deep Navy Purple | `#1e1b4b` | purple-950 | Background gradient start |
| Deep Purple | `#2e1065` | purple-950 | Darker background variant |
| Rich Purple | `#581c87` | purple-900 | Background gradient end |
| Violet 600 | `#7c3aed` | violet-600 | Secondary connections/nodes |
| Violet 500 | `#8b5cf6` | violet-500 | Peripheral nodes |
| Purple 500 | `#a855f7` | purple-500 | Primary connection lines |
| Purple 400 | `#c084fc` | purple-400 | Node glow/highlights |
| Indigo 500 | `#6366f1` | indigo-500 | Primary nodes |
| Violet 300 | `#c4b5fd` | violet-300 | Hero bloom mid-stop |
| Lavender White | `#f5f3ff` | violet-50 | Hero bloom bright core |

---

## Asset Generation

### Prerequisites
- Node.js with npm
- `sharp` package (already installed)
- `png-to-ico` package (already installed)

### Scripts

**Generate all icons from source SVGs:**
```bash
node scripts/generate-icons.js
```

**Generate favicon.ico:**
```bash
node scripts/generate-favicon-ico.js
```

### Manual Regeneration Steps

1. Edit source SVGs in `docs/design/icons/` as needed
2. Run generation scripts (above)
3. Verify output in `public/icons/` and `public/`
4. Test in browser: `npm run dev`
5. Build and verify: `npm run build`

> **Keep the two surfaces in sync.** The web raster icons (above) and the Liquid Glass
> `MorperhausConcerts.icon` share the same mark and hero treatment but are authored
> separately — the web SVGs bake in the background gradient and hero bloom, while the
> `.icon` keeps them as a manifest fill + PNG layer. When the mark changes, update both.

---

## Implementation Details

### HTML Metadata

Icons are referenced in `index.html`:

```html
<!-- Standard favicons -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />

<!-- Apple touch icons for home screen -->
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png">
<link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167.png">
<link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152.png">

<!-- Web app metadata -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Morperhaus">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```

### Browser Support

| Browser | Icon Used | Notes |
|---------|-----------|-------|
| Modern browsers | `favicon.svg` | Best quality, scalable |
| Safari iOS | `apple-touch-icon-*.png` | Size selected by device |
| Legacy browsers | `favicon.ico` | Multi-size ICO fallback |

---

## Testing Checklist

### Desktop Testing
- [ ] Verify favicon appears in browser tabs (Chrome, Firefox, Safari)
- [ ] Check favicon in bookmarks
- [ ] Test on light and dark browser themes

### iOS Testing
- [ ] Open site in Safari on iOS device
- [ ] Tap Share → Add to Home Screen
- [ ] Verify icon displays correctly (no black backgrounds)
- [ ] Test icon appearance on light wallpaper
- [ ] Test icon appearance on dark wallpaper
- [ ] Verify app title displays as "Morperhaus"
- [ ] Clear Safari cache and re-test (iOS caches aggressively)

### Production Verification
- [ ] Verify HTTPS serving
- [ ] Check MIME types are correct (`image/png`, `image/svg+xml`, `image/x-icon`)
- [ ] Confirm all assets return HTTP 200 OK
- [ ] Test deep linking with home screen icon

---

## Design Rationale

### Why Network Nodes?
1. **Data visualization forward:** Aligns with the app's core purpose (exploring concert data)
2. **Distinctive:** Unique among music apps (avoids music note clichés)
3. **Scalable:** Works at all sizes without fine detail
4. **Brand-aligned:** Matches OG image and interactive visualizations

### Why Purple?
1. **Consistency:** Matches Venues scene gradient and active button states
2. **Brand evolution:** Retiring orange ticket stub for unified palette
3. **Genre alignment:** Purple is used for Alternative/Experimental genres
4. **Concert aesthetic:** Deep jewel tones evoke concert poster design

### Why Asymmetric?
1. **Organic feel:** Natural clustering reflects real-world concert networks
2. **Visual interest:** More dynamic than geometric patterns
3. **Data authenticity:** Mirrors the actual network graphs in the app

---

## Related Documentation

- [Design System Skill](../../.claude/skills/design-system/SKILL.md) — Complete design system
- [Color Specification](color-specification.md) — Full color palette
- [Scene Design Guide](scene-design-guide.md) — Scene-specific patterns
- [GitHub Issue #28](https://github.com/mmorper/concerts/issues/28) — Original specification

---

**Last Updated:** 2026-06-18
**Designed by:** Claude Code (lead designer) + Mike Morper
**Implemented by:** Claude Code
