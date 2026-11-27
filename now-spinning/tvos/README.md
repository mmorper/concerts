# Morperhaus Now Spinning — the tvOS app

The TV's display for Now Spinning. It shows what the Worker sends, laid out exactly as the web
page at `/now-spinning` does, and writes no words of its own. Spec:
`docs/specs/future/global-now-spinning/global-now-spinning-spec.md` §On the TV. Installing it is
issue #701.

## Build and run (on the Mac)

```bash
brew install xcodegen                      # once
cd now-spinning/tvos
cp Secrets.example.xcconfig Secrets.xcconfig   # once: the display token and your team ID
xcodegen                                   # writes NowSpinning.xcodeproj (gitignored)
open NowSpinning.xcodeproj
```

In Xcode, choose the Apple TV as the run destination and press Run. Run `xcodegen` again after
pulling changes to `project.yml` or adding files. Never edit the generated project.

Without `Secrets.xcconfig`, or with a token the Worker refuses, the app shows the idle screen and
nothing else. The token is the Worker's `NOW_SPINNING_DISPLAY_TOKEN` (`docs/SECRETS.md`).

## Previews

`NowSpinning/Preview/Previews.swift` has one preview per state in
`test/fixtures/now-spinning-states.json`. Open it with the canvas showing (⌥⌘↩) and compare each
with its screenshot in `docs/specs/future/global-now-spinning/screens/`. Photos and album art
load from the site, so the Mac needs a network connection.

## What's where

| Path | What |
|---|---|
| `project.yml` | The project, for XcodeGen |
| `Config.xcconfig` | Build settings; includes `Secrets.xcconfig` when it exists |
| `NowSpinning/Model/Contract.swift` | The state contract, decoded forgivingly: an unknown `kind` is idle, an unknown `screen` is the song only |
| `NowSpinning/Model/Display.swift` | What's on screen: mirroring each new record, the gap fade, keeping the Apple TV awake |
| `NowSpinning/Model/Room.swift` | The WebSocket with its heartbeat (ping every 30 s), polling every 10 s while it's down, and the token |
| `NowSpinning/Views/` | The 1920×1080 stage, ported from the web page's CSS |
| `NowSpinning/Views/GlowMask.swift` | The glows' shape as a dithered image. A plain gradient that faint, over the dark stage, shows rings on the TV |
| `NowSpinning/Resources/Fonts/` | Playfair Display and Source Sans 3, with their Open Font License files |
| `NowSpinning/Resources/Assets.xcassets` | The app icon. Generated: `npm run generate:brand -- --tvos` |

CI builds the app for the tvOS Simulator on every change (`.github/workflows/now-spinning-tvos-ci.yml`).
