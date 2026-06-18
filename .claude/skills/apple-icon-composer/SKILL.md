---
name: apple-icon-composer
description: >
  Create Apple Icon Composer (.icon) source files for Liquid Glass app icons (iOS 26 /
  iPadOS 26 / macOS Tahoe and later). Use when the user wants to make an Apple app icon,
  a Liquid Glass icon, an Icon Composer / .icon file, convert an existing icon/logo/SVG
  into the .icon format, or generate the layered icon.json + Assets a Mac/iOS app icon
  needs. Interview-driven: asks whether to transform an existing mark or start from scratch.
---

# Apple Icon Composer Skill

**Purpose:** Produce a valid, ready-to-open `.icon` package (Apple Icon Composer format)
that renders as a Liquid Glass app icon. Encodes the `icon.json` schema, Apple's authoring
rules, and the SVG-vs-PNG gotchas so the file opens cleanly in Icon Composer and ships in Xcode.

**When to use:**
- "Make an Apple/Mac/iOS app icon" or "Liquid Glass icon" or "Icon Composer / .icon file"
- "Turn this icon / logo / SVG into the new Apple format"
- Generating or editing the layered `icon.json` + `Assets/` of a `.icon` package

**Reference implementation in this repo:** `docs/design/icons/MorperhausConcerts.icon/`
(the Concert Archives network-node mark). Mirror its structure when in doubt.

---

## Step 1 — Interview the user

Ask these up front (batch them; don't drip one at a time). Skip any the user already answered.

1. **Source** — *"Transforming an existing icon, or starting from scratch?"*
   - **Existing:** get the file path(s) — SVG preferred, PNG ok. Read/inspect it, identify
     the distinct visual elements (background, primary shapes, accents, focal element).
   - **Scratch:** get a one-line concept + the palette/brand colors.
2. **Name** — filename without extension (e.g. `AppIcon`, or a brand name). Default `AppIcon`
   if it's going straight into Xcode.
3. **Platforms** — iOS / iPadOS / macOS / watchOS (default: shared squares, watchOS circle).
4. **Background** — solid or gradient, and the color(s). (Goes in the manifest, **not** the art.)
5. **Output location** — where to write the `.icon` package (default: alongside other design assets).

If the user prefers fast guess-and-correct over Q&A, make sensible defaults, build it, show
the preview, and invite correction.

---

## Step 2 — Decompose into layers

Liquid Glass renders **groups** back-to-front, each receiving glass/specular/translucency/shadow.

- **Max 4 groups, 1–4 layers each.** Fewer is better.
- Split by visual role and z-depth: e.g. `Connections` (back) → `Nodes` (mid) → `Hero` (front).
- The **background is NOT a layer** — it's the manifest `fill`. Strip background rect/gradient
  out of every layer's artwork.
- A typical mapping: one SVG per group, each containing the flat shapes for that role.

---

## Step 3 — Author the layer artwork (Apple's rules)

- **Canvas 1024×1024** for iPhone/iPad/Mac (1088×1088 for a watchOS-specific variant).
- **No** baked-in background colors/gradients, blurs, shadows, specular, or opacity — apply
  those in Icon Composer / the manifest so Liquid Glass controls them.
- **Convert text to outlines** (SVG doesn't preserve fonts).
- **Don't** export a canvas mask — the system crops automatically.
- **Format rule (important):** export flat-fill shapes as **SVG** (scalable). Export anything
  with a **gradient or soft glow as PNG** — Icon Composer's SVG import does *not* reliably
  support gradients. (This is why the reference hero is `hero.png`, not `.svg`.)
- Name layers meaningfully; numbering back→front helps organization.

Write each layer file into `<Name>.icon/Assets/`.

---

## Step 4 — Write `icon.json`

The manifest lives at `<Name>.icon/icon.json`. Layers reference assets by **bare filename**
(the system looks in `Assets/`). Annotated schema:

```jsonc
{
  // Optional: color space for SVG colors that lack an explicit profile.
  "color-space-for-untagged-svg-colors": "display-p3",

  // Background fill. One of:
  //   "system-light" | "system-dark"            (presets)
  //   { "solid": "<color>" }
  //   { "linear-gradient": ["<color>", "<color>"] }
  //   { "automatic-gradient": "<color>" }
  "fill": { "linear-gradient": ["srgb:0.117,0.105,0.294,1.0", "srgb:0.345,0.109,0.529,1.0"] },

  "groups": [                       // 1–4 groups, rendered bottom → top
    {
      "name": "Hero",
      "lighting": "individual",     // "individual" | "combined"
      "blend-mode": "normal",       // optional
      "specular": true,             // optional; omit or true = on, false = off
      "shadow":      { "kind": "neutral", "opacity": 0.5 },   // kind: "neutral" | "layer-color"
      "translucency":{ "enabled": true,  "value": 0.5 },
      "layers": [                   // 1–4 layers
        {
          "image-name": "hero.png", // bare filename → Assets/hero.png
          "name": "hero",
          "glass": true,            // Liquid Glass material on this layer
          "hidden": false,
          "blend-mode": "normal",   // optional
          "opacity": 1,             // optional
          "fill": "automatic",      // optional per-layer: "automatic" | {solid|linear-gradient}
          "position": { "scale": 1, "translation-in-points": [0, 0] }  // optional
        }
      ]
    }
  ],

  "supported-platforms": { "circles": ["watchOS"], "squares": "shared" }
}
```

### Color string format

`<space>:R,G,B,A` with components 0–1 (5 decimals is conventional). Spaces seen in real files:
`srgb`, `display-p3`, `extended-srgb`. Convert hex → component by dividing each channel by 255.
Example: `#1e1b4b` → `srgb:0.11765,0.10588,0.29412,1.00000`.

---

## Step 5 — Assemble the package

```
<Name>.icon/
├── icon.json
└── Assets/
    ├── layerA.svg
    ├── layerB.svg
    └── hero.png
```

Keep the package clean — **only** `icon.json` + `Assets/`. Put previews/READMEs *outside* the
`.icon` folder so Icon Composer doesn't treat them as stray assets.

---

## Step 6 — Verify

Run the bundled helper (validates `icon.json`, confirms every `image-name` exists, and renders
a flattened squircle preview so the user can eyeball composition before opening the app):

```bash
node .claude/skills/apple-icon-composer/scripts/render-preview.mjs <path-to.icon> [out.png]
```

> The preview is the **base composition only** — live Liquid Glass specular/refraction render
> only inside Icon Composer and on-device. Always tell the user this so they don't expect the
> glass in the flat PNG.

Then offer: `open <path-to.icon>` to view it with full glass in Icon Composer (ships with
Xcode 26+, or standalone from <https://developer.apple.com/icon-composer/>).

---

## Design notes (lead-designer judgment)

- **Glow/focal elements:** a centered, symmetric radial bloom (bright core → brand color edge)
  reads as "light" and lets the glass place its own specular cleanly. An offset hotspot looks
  great flat but can fight the glass's directional lighting — prefer it for marketing exports,
  not the live layer.
- **Contrast:** on a dark base, the glass refraction is subtle. If foreground shapes disappear,
  brighten them or lower group translucency rather than fighting it.
- **Don't over-decompose.** 2–3 groups usually beats 4. Each extra group is more for the device
  to compute and more for you to keep coherent across appearances.

---

## Anti-patterns

- ❌ Baking the background gradient into a layer (breaks Liquid Glass) → use manifest `fill`.
- ❌ Gradients inside an SVG layer (may import flat/broken) → export that layer as PNG.
- ❌ Designing below 1024×1024 → upscale the source first.
- ❌ A `background.svg` full-canvas layer → there is no background layer; it's `fill`.
- ❌ Leaving preview PNGs / READMEs inside the `.icon` package.
