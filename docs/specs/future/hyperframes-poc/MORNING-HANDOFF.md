# Phase 1 Morning Handoff — 2026-04-19

**Executed:** 2026-04-19, Claude Code (Sonnet 4.6) running live with Mike present (not strictly "overnight" per the spec, but following the Phase 1 autonomous model — propose, don't pick; build pipeline, don't chase wow).
**Branch:** `pilot/hyperframes-poc` (draft PR #101)
**Duration:** single session, all seven Phase 1 deliverables shipped + environment setup.

---

## What Got Done

Every Phase 1 deliverable from `morperhaus-video-pilot.md § Phase 1 Execution Order` is complete and committed.

- ✅ **#90 Workspace** — `video/` initialized via `npx hyperframes init video`. Hyperframes 0.4.6. `video/node_modules/`, `video/compositions/*/output/`, and `video/output/` added to `.gitignore`. Site `npm run build` verified unaffected.
- ✅ **#91 Payload** — `video/compositions/social-distortion-34-years/payload.json` built from `concerts.json` + `artists-metadata.json` + `artists-top-tracks.json`. All 8 Social D shows resolved, 1990–2024 span (34 years). Builder script at same dir lets v2 videos be a payload swap.
- ✅ **#92 Capability doc** — `docs/specs/future/hyperframes-poc/hyperframes-capabilities.md`. Live render-tested at 1080×1920 — pipeline is fast (~0.8× real-time at draft), output is H.264 Baseline + yuv420p (universally compatible), and serif typography holds at cinematic quality. **No red-light signals surfaced.**
- ✅ **#93 Visual language guide** — `docs/specs/future/hyperframes-poc/morperhaus-video-visual-language.md`. Extends existing brand into motion. Covers palette, typography, motion primitives, image treatment, copy voice, anti-patterns, linting checklist. Includes **3 wordmark proposals (no pick)**.
- ✅ **#94 Signature element proposals** — `docs/specs/future/hyperframes-poc/signature-element-candidates.md`. **3 candidates with pros/cons and wordmark pairings (no pick)**: Meridian Rule / Contact-Sheet Stamp / Node Scaffold.
- ✅ **#95 Mechanical composition** — `video/index.html` (the composition) + `video/compositions/social-distortion-34-years/output/pilot-mechanical.mp4` (gitignored — regenerate with the command in §Commands). All 6 beats render. 20 seconds. 1.6 MB. Playfair + Source Sans 3 render beautifully.
- ✅ **#96 This handoff note**.

All child issues closed with commit references. Epic #89's checklist is auto-updated.

---

## What Did Not Get Done (and why)

Nothing was deferred or cut for Phase 1. All seven deliverables shipped within scope.

What **intentionally** did not happen (per the autonomous-execution scope boundaries in the spec):
- No signature element pick. Three proposals, no recommendation.
- No wordmark pick. Three proposals, no recommendation.
- No aesthetic iteration on the mechanical render past first-pass. The pipeline is verified; beauty is Phase 2.
- No final pilot render (`pilot-final.mp4`). That's Phase 2 after the signature pick.
- No storyboards for Templates A / B / D. That's Phase 2 after the signature pick.

---

## What Surprised Me

Four things Mike needs to know:

### 1. Hyperframes' typography reference explicitly bans Playfair Display and Source Sans 3.

From `~/.agents/skills/hyperframes/references/typography.md`:

> Training-data defaults that every LLM reaches for. These produce monoculture across compositions. Inter, Roboto, Open Sans … **Playfair Display**, Cormorant Garamond, Bodoni Moda, EB Garamond, Cinzel, Prata, Syne

The brand spec treats Playfair as non-negotiable (the Factory/*Substance* lineage argument). **The ban is advisory — the compiler still fetched and rendered Playfair.** The rendered "1990." is unmistakably Playfair-style with high-contrast modulated serifs. Phase 1 chose to keep Playfair and documented this tension in the capability doc (§ The Playfair Question) and visual language guide (§ The Playfair Question).

My judgment: the ban is aimed at LLMs reaching for generic defaults; Morperhaus has a documented lineage reason that overrides the anti-monoculture argument. **But it's a Phase 2 call — flag it early.**

### 2. The 2026-01-23 "Social Distortion: 34 Years of Shows" liner note doesn't exist in the feed yet.

The pilot spec treats this as source material and quotes its narrative + pull quote. The file `public/liner-notes.xml` has two SD-related entries (March 23: 21 Years Since... and Social Distortion + 14 More: 2018 Festival Bill) but no "34 Years" thread post.

**What I did:** used the pull quote text directly from the pilot spec itself (treating it as authored-for-this-pilot), and constructed a plausible deep-link URL (`concerts.morperhaus.org/liner-notes/social-distortion-34-years-of-shows`). The payload tags this with `"sourceLinerNoteStatus": "pilot-hypothetical"`. If green-lit, the liner note needs to be published for real before the video goes out.

**Separate note (per Mike's mid-session message):** `dist/data/liner-notes.json` exists as a JSON-format alternative to the XML feed. For future template/agent work, the JSON path is cleaner. I kept the payload source decoupled from the feed format for this pilot; rebuilding against JSON is trivial if the 34-Years entry gets added there.

### 3. The render is unexpectedly good.

Phase 1 is supposed to produce a mechanical, not-beautiful render. Beats 4 (pull quote), 5 (album artifact), and 6 (outro) look genuinely Morperhaus on first attempt. The Meridian-Rule signature (placeholder Candidate A) is working hard to make the outro lockup feel like a real wordmark — which means it also biases Phase 2 toward picking it.

**You may want to consciously push back on that bias** when reviewing Candidate B (Contact-Sheet Stamp) and C (Node Scaffold). They may feel inferior simply because you'll have seen Candidate A in the render first.

### 4. Beat 3 has real layout bugs that Phase 2 must address.

The thread timeline sweep works, but:
- Venue labels overlap when shows are close in time (2010 and 2012 on `9:30 Club` both appear simultaneously; "Hard Rock Hotel Las Vegas" collides with "9:30 Club")
- The "X / 8 shows" counter is absolute-positioned from the scene container and lands *above* "THE THREAD" label instead of below the timeline — z-context bug
- The "1990." in Beat 1a is left-aligned rather than centered (may actually be *better* asymmetrically — worth a deliberate decision)

These are mechanical-first-render issues, not framework issues. Easy to fix in Phase 2.

---

## What I Deferred to Mike

Every decision I declined to make:

| Decision | Options prepared |
|---|---|
| **Signature element** | `signature-element-candidates.md` has 3 candidates (Meridian Rule / Contact-Sheet Stamp / Node Scaffold) with pros, cons, and per-template behaviors |
| **Wordmark** | `morperhaus-video-visual-language.md § Wordmark` has 3 proposals (Editorial Masthead / Node-and-Type / Catalog-Stamp), each paired with a specific signature candidate |
| **Playfair stays or substitutes** | `hyperframes-capabilities.md § The Playfair Question` — my default recommendation is "stays" because the brand-lineage argument overrides the anti-monoculture argument, but the decision is yours |
| **Image treatment default** | Grayscale with `contrast(1.05)` is implemented for Beat 2. `morperhaus-video-visual-language.md § Image Treatment` also proposes duotone-with-purple as an alternative. One or the other, Phase 2 decides. |
| **Transition default** | Hard cuts vs 200–300ms crossfades between beats. The mechanical render uses hard cuts. Phase 2 can test crossfades on the Beat 3 → Beat 4 boundary (density-to-quiet moment) to see if they help |
| **Render quality for the final pilot** | Capability doc recommends `high` at 30fps. Confirm in Phase 2 before the test-pool screening |
| **Whether the signature should appear on the CTA frame** | Current placeholder: Meridian Rule is present in Beat 6. Phase 2 candidate-dependent — Meridian keeps it, Stamp probably shifts, Scaffold probably integrates into the lockup |
| **Catalog-number starting value** (if Candidate B is picked) | MH 001? Or retroactively number from earlier liner-notes? |

---

## What to Review First

Ordered by signal-for-go-no-go:

1. **`video/compositions/social-distortion-34-years/output/pilot-mechanical.mp4`** — watch the 20-second mechanical render. It's the single best input for "does this pipeline produce cinematic output at 1080×1920?" Expect rough spots on Beat 3; expect Beats 4/5/6 to look very close to the aesthetic goal.
2. **`docs/specs/future/hyperframes-poc/hyperframes-capabilities.md`** — 2-minute read. Confirms no red-light signals + flags the Playfair question.
3. **`docs/specs/future/hyperframes-poc/signature-element-candidates.md`** — 10-minute read. The pairing matrix at the bottom is where the decision lives. Read the three candidates with the render fresh in your mind.
4. **`docs/specs/future/hyperframes-poc/morperhaus-video-visual-language.md`** — 15-minute read. Palette, type, motion primitives, wordmark proposals, five open questions at the end.

If you have 10 minutes: items 1–3.
If you have 30 minutes: all four.

---

## Open Questions (not deferred — I couldn't resolve without you)

1. **The spec-vs-reality on the liner note.** The 34-Years-of-Shows entry is in the pilot spec but not in the live feed. If the pilot green-lights, does the liner note need to be written and published before the video goes out, or is the video itself the inaugural moment for this post?
2. **Memory headroom for the final render.** `npx hyperframes doctor` flagged 0.1–0.5 GB free memory at test time. The 20-second mechanical render succeeded at draft quality with 8 workers. A `high`-quality final render may need `--workers 4` for safety. Confirm machine state before the final render.
3. **File-layout adaptation.** The spec names `video/compositions/social-distortion-34-years/composition.html` as the composition file. Hyperframes' convention puts it at `video/index.html` (the project root). I adapted by keeping the composition at the root and turning the `compositions/social-distortion-34-years/` folder into a source-folder for payload + assets + renders. A README.md in that folder documents the split. The spec's Files-to-Create section could be updated if the adaptation is the right call going forward.

---

## Commands to Run

### Watch the render
```bash
open video/compositions/social-distortion-34-years/output/pilot-mechanical.mp4
```

### Re-render (if the MP4 got cleaned)
```bash
cd video
npx hyperframes render \
  --output compositions/social-distortion-34-years/output/pilot-mechanical.mp4 \
  --quality draft
```

### Iterate on the composition with hot reload
```bash
cd video
npx hyperframes preview
# Opens studio at http://localhost:3002
```

### Lint after any composition change
```bash
cd video && npx hyperframes lint
```

### Regenerate the payload (e.g., if concerts.json updates)
```bash
node video/compositions/social-distortion-34-years/build-payload.mjs
```

### See all pilot issues in GitHub
```bash
gh issue list --label pilot --state all
```

### See the epic's checklist
```bash
gh issue view 89
```

---

## Git Provenance

Phase 1 produced 7 commits on `pilot/hyperframes-poc`:

1. `docs: add hyperframes video pilot spec` — canonical spec moved to `hyperframes-poc/`
2. `feat(video): initialize Hyperframes workspace for pilot` — #90
3. `feat(video): build Social Distortion data payload` — #91
4. `docs(video): hyperframes capability doc + test composition` — #92
5. `docs(video): first-draft visual language guide + wordmark proposals` — #93
6. `docs(video): signature element candidate proposals (3, no pick)` — #94
7. `feat(video): mechanical first composition — all 6 beats render` — #95

Plus this handoff commit. Branch is pushed; PR #101 is open as a draft. Closing the PR without merging (red-light) leaves `main` pristine.

---

## Environment Notes

Installed during Phase 1:
- `ffmpeg` / `ffprobe` 8.1 via Homebrew (required for Hyperframes rendering)
- `hyperframes` 0.4.6 (via npx; no project-root dependency added to package.json)
- 5 Hyperframes skills globally at `~/.agents/skills/` (gsap, hyperframes, hyperframes-cli, hyperframes-registry, website-to-hyperframes)

Pre-existing uncommitted state on `main` (settings.json mod + inspiration image deletions) was left untouched — not mine to manage.

---

## Recommendation for Phase 2 Kickoff

Start with a 30–45 minute session doing this, in order:

1. Watch the mechanical render. Form a first impression.
2. Read the three signature element candidates. Imagine each across the four templates.
3. Pick the signature + wordmark pair.
4. Call out what in the mechanical render most needs to change before the final (my list: Beat 3 venue-label collision, Beat 3 counter z-context, the Meridian opening animation which currently starts too late and races Beat 1a's type).

That session produces the inputs for #97 (signature pick), which unlocks #98 (final render) and #99 (storyboards).
