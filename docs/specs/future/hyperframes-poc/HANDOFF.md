# HyperFrames Pilot — Handoff

**Paused:** 2026-04-19
**Branch:** `pilot/hyperframes-poc` (pushed to `origin`, not merged)
**Status:** Pilot built + delivered **with audio track**, awaiting pilot review (#100) decision

**Update 2026-04-19 (post-pause touch-up):** User added a 24.024s MP3 audio track; re-rendered with audio embedded. Source changes committed; MP4 stays gitignored. See final commit for details.

---

## One-glance state

| Field | Value |
|---|---|
| Deliverable | `video/renders/20260419-social-distortion-thread.mp4` (24.5s, 1080×1920, high quality, 5.77 MB) |
| Branch | `pilot/hyperframes-poc` |
| Latest commit | `6afe1e5` |
| Commits this session | `be09d6d`, `6fde82e`, `6afe1e5` |
| Renders/ hygiene | Clean — only the deliverable. Scratch goes to `/tmp/` now. |
| Workspace conventions | Established in [video/README.md](../../../../video/README.md) and committed |
| Gitignored | `video/renders/`, `session-recovery/` (large debugging transcript) |

The MP4 deliverable is **not** in git (gitignored as large binary) — regenerate with:
```bash
cd video
node scripts/render.mjs --slug social-distortion-thread
```

---

## What's done

- ✅ P3 (Social Distortion Thread) composition built + rendered at high quality
- ✅ Frame 7 rebuilt as generic, reusable outro (constellation + wordmark + CTA)
- ✅ Ribbon hoisted to root — single persistent instance, populates once in Beat 1
- ✅ Milestone marker (cursor) given semantic behavior — appears only on date-referencing scenes, slides between adjacent ones
- ✅ Beat 1 reveal order reworked (empty field → editorial text → ribbon → cursor sweep)
- ✅ Initial-load invisibility bug fixed (GSAP `fromTo` immediateRender trap)
- ✅ Workspace conventions documented in [video/README.md](../../../../video/README.md)
- ✅ Render wrapper at [video/scripts/render.mjs](../../../../video/scripts/render.mjs) enforces `YYYYMMDD-{slug}.mp4` naming
- ✅ Per-video source folder renamed `social-distortion-34-years/` → `social-distortion-thread/` (matches render slug)
- ✅ Old exploration artifacts purged — 10+ MP4s, 10 frame directories, verification PNGs, preview project
- ✅ Pattern library committed at [video/PATTERNS.md](../../../../video/PATTERNS.md)
- ✅ Pilot postmortem committed at [video/compositions/social-distortion-thread/POSTMORTEM.md](../../../../video/compositions/social-distortion-thread/POSTMORTEM.md)
- ✅ Treatment spec committed at [P3-V2-TREATMENT.md](P3-V2-TREATMENT.md)
- ✅ GH issues commented for traceability: [#89](https://github.com/mmorper/concerts/issues/89), [#98](https://github.com/mmorper/concerts/issues/98), [#99](https://github.com/mmorper/concerts/issues/99), [#100](https://github.com/mmorper/concerts/issues/100)
- ✅ Branch pushed to `origin/pilot/hyperframes-poc`

---

## Open / awaiting your decision

### Blocker: Pilot review decision ([#100](https://github.com/mmorper/concerts/issues/100))

The green/yellow/red call on whether the pilot is shippable / sets direction for Templates A/B/D. Everything downstream waits on this.

- **Green:** Approve pilot → merge `pilot/hyperframes-poc` → main. Pivot to Templates A/B/D using PATTERNS.md as foundation.
- **Yellow:** Approve with changes → iterate on specific notes before merge.
- **Red:** Back to drawing board → which parts keep, which rebuild.

### Not started

- **Templates A, B, D** ([#99](https://github.com/mmorper/concerts/issues/99)) — storyboards for the other three video templates. Blocked on [#100](https://github.com/mmorper/concerts/issues/100).
- **Signature element + wordmark finalization** ([#97](https://github.com/mmorper/concerts/issues/97)) — pilot used a working wordmark; if you want to finalize, that's a separate decision.

### Loose ends (not blockers)

- `.claude/settings.json` has uncommitted modification (pre-existing, your call)
- `docs/inspiration/*.png` deletions uncommitted (pre-existing, unrelated to pilot)
- GH issue comments use branch-relative URLs — if pilot branch is eventually deleted post-merge, those links break. Optional: swap for commit-SHA permalinks at merge time.

---

## When YOU return

1. **Watch the render:** `video/renders/20260419-social-distortion-thread.mp4` (regenerate if needed — the gitignore rule means it won't be in a fresh clone)
2. **Make the [#100](https://github.com/mmorper/concerts/issues/100) call** — green, yellow, or red
3. **Say one of:**
   - "Merge it" → I'll open a PR from `pilot/hyperframes-poc` → `main`
   - "Iterate on X" → we refine before merge
   - "Start Template A/B/D" → we spec the next video using PATTERNS.md
   - Something else

---

## When CLAUDE resumes this work (context for future session)

Read this section first if you're picking up cold.

### Read order

1. **[video/PATTERNS.md](../../../../video/PATTERNS.md)** — the reusable creative + technical patterns. This is the most important doc. Read all of it.
2. **[video/compositions/social-distortion-thread/POSTMORTEM.md](../../../../video/compositions/social-distortion-thread/POSTMORTEM.md)** — what deviated from the treatment spec and why. Shortcuts for common pitfalls.
3. **[video/README.md](../../../../video/README.md)** — workspace layout, naming, render command.
4. **This file** — current state + open decisions.
5. **[P3-V2-TREATMENT.md](P3-V2-TREATMENT.md)** — the pilot's original director's treatment. Reference for how treatment docs should look.

### Non-negotiable workflow rules

- **Branch is `pilot/hyperframes-poc`**, not main. Do NOT merge without explicit user approval of the [#100](https://github.com/mmorper/concerts/issues/100) pilot review decision.
- **Render via the wrapper**: `node scripts/render.mjs --slug {slug}` — never `npx hyperframes render` directly (produces misnamed output).
- **Renders folder is deliverables only.** No frame dumps, no verification PNGs, no iteration versions. Scratch artifacts go to `/tmp/`.
- **Determinism**: no `Math.random()`, no `Date.now()`, use `mulberry32(seed)` for any randomness.
- **`fromTo` tweens at non-zero positions need `immediateRender: true`** — otherwise elements flash visible at t=0. See PATTERNS.md § Initial-load invisibility contract.
- **Persistent elements live at root composition level**, not inside scene clips. Ribbon is the reference implementation.

### User interaction patterns observed

- Prefers tight iterative loops with short course-corrections ("sooner", "faster", "agree, go") over long clarifying exchanges.
- For reversible work (animations, compositions, renders, drafts), commit to a reasonable interpretation of ambiguous input and state the interpretation briefly so they can redirect cheaply. Don't stack multiple clarifying questions.
- For irreversible or high-cost actions, confirm first.
- Invites lead-architect stances when he says "as our {role}" — take a position with reasoning, including pushback.
- Agrees quickly and directly when the plan is clear.

### Conventions that are NOT obvious from the file tree

- Slug must match across three places: folder under `compositions/`, `--slug` arg to render.mjs, and render filename. All three are the same kebab-case string.
- Assets are flat in `video/assets/`, shared across future videos. Per-asset subfolders are an anti-pattern we deleted.
- Pattern docs live at top level of `video/` (PATTERNS.md). Per-video-specific docs live inside `compositions/{slug}/` (POSTMORTEM.md).
- Treatment docs live in `docs/specs/future/hyperframes-poc/{NAME}.md`.

### What to avoid

- Don't build a `/new-video` skill yet — deferred until video #2 exists. See the architect recommendation in the last exchange of the prior session.
- Don't update `P3-V2-TREATMENT.md` retroactively — it's the original director's intent, preserved on purpose. Deltas live in POSTMORTEM.md.
- Don't re-animate persistent elements on scene transitions. Persistence IS the signature.

---

## Key artifacts index

| What | Where |
|---|---|
| Final deliverable (MP4) | `video/renders/20260419-social-distortion-thread.mp4` (gitignored, regenerable) |
| Master composition | [video/index.html](../../../../video/index.html) |
| Render wrapper | [video/scripts/render.mjs](../../../../video/scripts/render.mjs) |
| Workspace README | [video/README.md](../../../../video/README.md) |
| Pattern library | [video/PATTERNS.md](../../../../video/PATTERNS.md) |
| Pilot postmortem | [video/compositions/social-distortion-thread/POSTMORTEM.md](../../../../video/compositions/social-distortion-thread/POSTMORTEM.md) |
| Director's treatment | [P3-V2-TREATMENT.md](P3-V2-TREATMENT.md) |
| Pilot epic | [#89](https://github.com/mmorper/concerts/issues/89) |
| P2.2 render issue | [#98](https://github.com/mmorper/concerts/issues/98) |
| P2.3 templates | [#99](https://github.com/mmorper/concerts/issues/99) |
| P2.4 review decision | [#100](https://github.com/mmorper/concerts/issues/100) |
