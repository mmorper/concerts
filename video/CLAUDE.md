# HyperFrames Composition Project

> **Project conventions, directory layout, render commands, and naming rules live in [README.md](README.md).** Read it first. This file documents how AI agents work in this directory (skills, linting, framework rules).

## Skills — USE THESE FIRST

**Always invoke the relevant skill before writing or modifying compositions.** Skills encode framework-specific patterns (e.g., `window.__timelines` registration, `data-*` attribute semantics, shader-compatible CSS rules) that are NOT in generic web docs. Skipping them produces broken compositions.

| Skill               | Command            | When to use                                                                                       |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| **hyperframes**     | `/hyperframes`     | Creating or editing HTML compositions, captions, TTS, audio-reactive animation, marker highlights |
| **hyperframes-cli** | `/hyperframes-cli` | CLI commands: init, lint, preview, render, transcribe, tts                                        |
| **gsap**            | `/gsap`            | GSAP animations for HyperFrames — tweens, timelines, easing, performance                          |

> **Skills not available?** Ask the user to run `npx hyperframes skills` and restart their
> agent session, or install manually: `npx skills add heygen-com/hyperframes`.

## Commands

```bash
npx hyperframes preview          # preview in browser (studio editor)
npx hyperframes render       # render to MP4
npx hyperframes lint         # validate compositions (errors + warnings)
npx hyperframes lint --verbose  # include info-level findings
npx hyperframes lint --json     # machine-readable output for CI
npx hyperframes docs <topic> # reference docs in terminal
```

## Documentation

**For quick reference**, use the local CLI docs command (no network required):

```bash
npx hyperframes docs <topic>
```

Topics: `data-attributes`, `gsap`, `compositions`, `rendering`, `examples`, `troubleshooting`

**For full documentation**, discover pages via the machine-readable index — do NOT guess URLs:

```
https://hyperframes.heygen.com/llms.txt
```

## Project Structure

See [README.md](README.md) for the full directory layout and conventions. Key agent-relevant facts:

- `index.html` — master composition (root timeline, currently monolithic/inline)
- `compositions/{slug}/` — per-video source data (`payload.json`, `build-payload.mjs`). No sub-composition HTMLs are currently used.
- `scripts/render.mjs` — wrapper for rendering. **Use this**, not `npx hyperframes render` directly, so output naming stays consistent.
- `assets/` — shared across all videos (flat).
- `renders/` — deliverables only, named `YYYYMMDD-{slug}.mp4`. No intermediate artifacts here.

## Linting — ALWAYS RUN AFTER CHANGES

After creating or editing any `.html` composition, **always** run the linter before considering the task complete:

```bash
npx hyperframes lint
```

Fix all errors before presenting the result. Warnings are informational and usually safe to ignore.

## Key Rules

1. Every timed element needs `data-start`, `data-duration`, and `data-track-index`
2. Elements with timing **MUST** have `class="clip"` — the framework uses this for visibility control
3. Timelines must be paused and registered on `window.__timelines`:
   ```js
   window.__timelines = window.__timelines || {};
   window.__timelines["composition-id"] = gsap.timeline({ paused: true });
   ```
4. Videos use `muted` with a separate `<audio>` element for the audio track
5. Sub-compositions use `data-composition-src="compositions/file.html"` to reference other HTML files
6. Only deterministic logic — no `Date.now()`, no `Math.random()`, no network fetches
