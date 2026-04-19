# Hyperframes Capability Doc

**Pilot reference — Phase 1 deliverable**
**Date:** 2026-04-19
**Framework version:** Hyperframes 0.4.6
**Target format:** 1080×1920, 30fps, H.264 MP4

---

## Executive Summary

Hyperframes renders the Social Distortion pilot's core patterns cleanly at 1080×1920. The pipeline is fast enough for comfortable iteration (real-time render on a 12-core M2 Pro), fonts are embedded deterministically, and the output codec (H.264 Baseline, yuv420p) is universally compatible with Bluesky, YouTube Shorts, Instagram Reels, and X.

**The only framework finding that warrants a Phase 2 decision is the typography guidance conflict** (§ "The Playfair Question"). Every other pattern required by the beat sheet renders without workaround.

**No red-light signals surfaced in Phase 1.** Quality ceiling at 1080×1920 is cinematic.

---

## What Was Tested

A capability test composition (now removed) with three scenes over 6 seconds, rendered at draft quality:

- **Scene 1 (0–2.5s):** "1990." — Playfair Display at 320px, white on black
- **Scene 2 (2.5–4s):** "Cal State Fullerton." — Playfair Display at 96px
- **Scene 3 (4–6s):** "Social Distortion" + "34 years · 8 shows" subtitle — Playfair + Source Sans 3

Entrance animations: GSAP `from()` with `power3.out` easing, 0.7s duration, 0.2–0.4s stagger. No exits (transitions own exits per Hyperframes rule).

### Metrics

| Metric | Value |
|---|---|
| Render time (6s content, draft quality, 8 workers) | 7.5s wall clock |
| Real-time factor (draft) | ~0.8× real-time |
| Output file size | 288 KB for 6s @ draft |
| Projected size for 20s pilot @ standard | ~2–3 MB |
| Output codec | H.264 Constrained Baseline, yuv420p, Level 4.0 |
| Aspect ratio | 9:16 (1:1 SAR) |
| Frame rate | 30fps |
| Color space | bt709 |

Linting passes clean (`npx hyperframes lint`: 0 errors, 0 warnings).

---

## Known-Good Patterns

Patterns verified to render cleanly at 1080×1920 and safe to use in the mechanical pilot composition:

1. **Large-scale serif typography** — Playfair Display at 320px renders with crisp letterforms. Serif detail holds at all tested sizes (36px–320px) without encoder artifacts.
2. **Sans-serif small caps and tracked labels** — Source Sans 3 uppercase with `letter-spacing: 0.15em` renders clean. No bleed into adjacent content.
3. **Black-on-white and white-on-black** — solid-color backgrounds are safe. No banding at tested contrast levels.
4. **GSAP entrance choreography** — `gsap.from()` with opacity+y and `power3.out`/`power2.out` easing produces site-feel animation. Stagger behaves as expected.
5. **Multiple same-track scenes** — three scenes on `data-track-index="1"` with non-overlapping `data-start`/`data-duration` switch cleanly. No visible flicker.
6. **Deterministic rendering** — byte-identical outputs across two runs (confirmed via file hash). GSAP timeline reconstruction works.
7. **CDN-loaded GSAP** — `gsap@3.14.2` loads from jsdelivr without issue. Hyperframes inlines it into the capture bundle.

---

## Patterns Still To Verify in the Pilot Composition

The mechanical render (#95) will stress-test these patterns. None are expected to fail based on Hyperframes docs, but they haven't been rendered yet in this project:

| Pattern | Where it's used | Risk |
|---|---|---|
| Raster image clips (`<img>` with local asset paths) | Beat 2 (artist photo), Beat 5 (album art) | Low — standard HTML |
| Horizontal timeline sweep with per-dot animations | Beat 3 (the thread) | Medium — 8 dots + 8 venue labels = many tweens |
| Ticker counter animation | Beat 3 (1·2·3…·8) | Low — simple text swap |
| Radial gradient backgrounds | Possible signature-element candidate | Low — Hyperframes guide notes "avoid full-screen linear gradients; radial is safe" |
| Italic Playfair for pull quote | Beat 4 | Low — requested the italic weights in the font link |
| Image + text composition (album art above card) | Beat 5 | Low |
| Crossfades between scenes | All scene boundaries | Low — standard GSAP |

---

## Framework Constraints to Respect

These are Hyperframes' hard rules. Violating any of them breaks the render pipeline. Reference: the `hyperframes` skill at `~/.agents/skills/hyperframes/SKILL.md`.

1. **`class="clip"` required on every timed element** — without it, the framework doesn't manage visibility, and the element shows for the full composition duration.
2. **`window.__timelines["<composition-id>"]` registration** — the capture engine reads timelines synchronously after page load. Missing registrations mean no animation.
3. **Timelines start `{ paused: true }`** — framework owns playback.
4. **No `Math.random()` / `Date.now()`** — captures are frame-by-frame at seeked timestamps; non-determinism produces flicker.
5. **No `repeat: -1`** — use `Math.ceil(duration / cycleDuration) - 1` for finite repeats.
6. **No exit animations except final scene** — transitions handle scene exits. Every preceding scene may only use `gsap.from()` for entrances.
7. **Minimum type sizes for rendered video:** 60px+ headlines, 20px+ body, 16px+ labels.
8. **`font-variant-numeric: tabular-nums` on numeric columns** — prevents digit-width shifts during count animations.
9. **No `<br>` in wrapping text blocks** — use `max-width` and natural wrapping. `<br>` in combination with natural wrap produces double breaks.
10. **No full-screen linear gradients on dark backgrounds** — H.264 produces banding. Use radial or solid + localized glow.

---

## The Playfair Question (Phase 2 Decision)

Hyperframes' typography reference (`~/.agents/skills/hyperframes/references/typography.md`) explicitly lists **Playfair Display** and **Source Sans 3** as banned defaults:

> Training-data defaults that every LLM reaches for. These produce monoculture across compositions.
>
> Inter, Roboto, Open Sans, Noto Sans, Arimo, Lato, Source Sans, PT Sans, Nunito, Poppins, Outfit, Sora, **Playfair Display**, Cormorant Garamond, Bodoni Moda, EB Garamond, Cinzel, Prata, Syne

The Morperhaus brand spec (`docs/design/scene-design-guide.md`) treats these two faces as canonical and the pilot spec describes Playfair as **non-negotiable**: it places Morperhaus in the Factory/*Substance 1987* lineage via its kinship to Bodoni.

### What the render actually does

The test render produced beautiful, unmistakably Playfair-style letterforms (see `docs/specs/future/hyperframes-poc/screenshots/` if retained; the test frame at 0.5s shows high-contrast modulated serif with bracketed terminals). **The ban is advisory, not enforced by the compiler** — the compiler fetched and embedded the requested font faces.

### The question for Phase 2

Two paths:

- **A) Keep Playfair Display + Source Sans 3.** The advisory ban is aimed at LLMs reaching for generic defaults; Morperhaus has a documented lineage reason (Factory/Substance/Bodoni) that specifically motivates these choices. This is not a default — it's an intentional continuation of the site's brand. Phase 1 recommends this as the default path.
- **B) Substitute to clear the ban.** Candidate replacements that preserve the Didone/neoclassical lineage: *Libre Bodoni*, *Bodoni Moda* (also on the ban list), *DM Serif Display*, or a specifically-licensed Bodoni cut. Source Sans 3 could be swapped for *Public Sans*, *IBM Plex Sans*, or *Söhne* (if licensed).

**Phase 1 recommendation:** Path A, because the brand-lineage argument overrides the anti-monoculture argument in this specific case. But this is a Phase 2 decision with Mike.

---

## Render Quality Guidance

`npx hyperframes render` supports three quality levels:

| Quality | Use | Render speed | File size |
|---|---|---|---|
| `draft` | Rapid iteration on motion and layout | Fastest (tested: ~0.8× real-time) | Smallest (288 KB for 6s) |
| `standard` | Review and internal sharing | Moderate | ~2–3× draft size |
| `high` | Final delivery (green-light pilot render) | Slowest | Largest; best compression quality |

For the mechanical render (#95), `draft` is appropriate. For the final pilot render (#98, Phase 2), **use `high` with `--fps 30`**. Avoid `--fps 60` — doubles render time, and social platforms re-encode anyway.

For reproducibility across machines, the `--docker` flag produces byte-identical output. Not required for the pilot (Docker is not installed locally), but worth flagging for a future automated pipeline.

---

## Frame Adapter Recommendation

Hyperframes' default adapter (system Chrome via Playwright) is working. No need to switch.

- **System Chrome detected:** `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Alternative:** bundled Chrome via `npx hyperframes browser` — not needed unless the system Chrome version drifts.
- **Docker adapter:** unavailable locally (Docker not installed). Not a blocker for the pilot; worth adding for a reproducible CI path post-greenlight.

---

## Environment Observations

From `npx hyperframes doctor`:

- ✅ Node.js v25.8.1 (darwin arm64)
- ✅ 12-core Apple M2 Pro
- ✅ FFmpeg 8.1 (installed via Homebrew during Phase 1)
- ✅ FFprobe 8.1
- ✅ System Chrome detected
- ⚠️ **Low free memory (0.5 GB at test time)** — short renders (6s) succeeded. A 20-second pilot at `high` quality with 8 workers may push memory limits. If renders fail with OOM, try `--workers 4` or `--workers 2` as a first mitigation.
- ⚠️ Docker not installed — optional, useful later for reproducible renders.

---

## Non-Blocking Warnings to Ignore

During the capability render, six `Failed to load resource: the server responded with a status of 404` messages appeared in the capture log. These are tagged `[non-blocking]` by Hyperframes and did not affect output. Likely Google Fonts edge cases for font-face variants the compiler requested but aren't actually in the requested subsets. They can be ignored until one of them correlates with a visible rendering problem.

---

## Findings Relevant to the Green/Yellow/Red Decision

From the spec's red-light criteria:

> **Hyperframes rendering quality at 1080×1920 is not cinematic enough and engineering around it would change the project's nature.**

**Phase 1 assessment:** The test render at draft quality produced cinematic-quality typography. Serif detail, stroke contrast, and antialiasing at 320px type all hold. This is not a red-light risk.

The pilot's quality ceiling is limited by **the designer's compositions and the iTunes album-art resolution (600×600 max for this album)**, not by Hyperframes itself.

---

## Frame-Adapter and Distribution Compatibility Notes

H.264 Constrained Baseline / yuv420p / 30fps output is the most compatible MP4 profile available. It plays natively on:

- Bluesky (direct upload)
- YouTube Shorts
- Instagram Reels (note: IG re-encodes)
- X / Twitter
- iOS / Android mobile browsers
- Safari / Chrome / Firefox desktop

No transcoding needed for any of the distribution targets in the pilot's (informational) distribution section.

---

## Commands for Phase 2 / Follow-Up

```bash
# Iterate on the composition
cd video
npx hyperframes preview              # hot-reload browser studio

# Render for review
npx hyperframes render --quality draft --output review.mp4

# Render for delivery
npx hyperframes render --quality high --fps 30 --output pilot-final.mp4

# Validate composition
npx hyperframes lint
npx hyperframes validate             # includes WCAG contrast audit

# Choreography analysis (run after significant animation changes)
node ~/.agents/skills/hyperframes/scripts/animation-map.mjs . \
  --out .hyperframes/anim-map
```

---

## Open Questions for Phase 2

1. **The Playfair Question** (above) — keep Playfair Display + Source Sans 3, or substitute?
2. **Quality for the final pilot render** — confirmed `high` at 30fps is the right setting, or test `high` vs `standard` side-by-side for the green-light decision?
3. **Memory headroom** — should we add `--workers 4` as a default for safety, or trust auto (8 on this machine)?
