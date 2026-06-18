# Liquid Glass App Icon — `MorperhausConcerts.icon`

An [Apple Icon Composer](https://developer.apple.com/icon-composer/) source file that
recreates the Concert Archives network-node mark with Liquid Glass support (iOS 26 /
macOS Tahoe and later).

## Open it

```bash
open docs/design/icons/MorperhausConcerts.icon
```

If Icon Composer isn't the default handler: launch Xcode → **Xcode > Open Developer
Tool > Icon Composer**, then open the file. (Icon Composer ships with Xcode 26+, or
download standalone from the link above.)

`MorperhausConcerts-preview.png` is a flattened render of the base composition for
quick reference — it does **not** include the live Liquid Glass material, which only
renders inside Icon Composer and on-device.

## How it's structured

A `.icon` file is a package (folder). Inside:

```
MorperhausConcerts.icon/
├── icon.json          # manifest: base fill + groups/layers + glass settings
└── Assets/
    ├── connections.svg  # network connection lines  (bottom group)
    ├── nodes.svg        # six peripheral nodes       (middle group)
    └── hero.svg         # central hero node          (top group)
```

Layers are authored on the **1024×1024** canvas Apple requires, as flat-fill SVG with
**no background** — per Apple's guidance, the background gradient is applied in
`icon.json` (`fill` → `linear-gradient`) rather than baked into the artwork, so it
stays editable and picks up Liquid Glass correctly.

### Layer stack (back → front)

| Group       | Source            | Role                                   |
|-------------|-------------------|----------------------------------------|
| Connections | `connections.svg` | 6 primary + 2 secondary link lines     |
| Nodes       | `nodes.svg`       | 6 peripheral nodes (varied sizes)      |
| Hero        | `hero.svg`        | central glowing node (concentric fills)|

Each group has glass enabled with neutral shadow + translucency. Specular is on by
default (the rim highlight you see in-app). Tune all of this live in the Appearance
inspector — nothing here is locked.

### Colors (brand palette)

- Base gradient: `#1e1b4b → #581c87` (Venues scene gradient), set as the icon `fill`
- Lines: `#a855f7` · peripheral nodes: `#6366f1` / `#8b5cf6` / `#7c3aed`
- Hero: concentric `#7c5cf0 → #a78bfa → #ede9fe` approximating the original radial glow

## Edit the source art

The SVGs are plain shapes — edit in any vector tool (or by hand) and re-import via
**Replace** on the layer, or just overwrite the file in `Assets/`. Keep them
background-free and on the 1024 canvas.

## Export

Use **File > Export** in Icon Composer for a flattened PNG (marketing/comms), or add
the `.icon` file directly to an Xcode target's **App Icon** field to ship it.
