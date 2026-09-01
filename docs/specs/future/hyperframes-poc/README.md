# HyperFrames Video Pilot — Start Here

**Status:** Paused 2026-04-19. The pilot was built and delivered. The green/yellow/red
decision was never made. Five issues are still open.

This folder holds the spec, the design work, and the session records for one experiment:
turning Morperhaus liner notes into short-form vertical video. One video came out of it.

Read this page before anything else in the folder. The spec is not the right entry point,
and the reason why is the most useful thing here.

---

## The spec proposed one video. We built a different one.

`morperhaus-video-pilot.md` is the original specification. It is a good document and worth
reading. But it describes a video that was rejected partway through the project.

The spec's beat sheet called for six beats: a cold open on "1990." and a venue name, an
artist photo, a timeline sweep, a pull quote, an album card, an outro. Phase 1 built exactly
that.

Mike watched it and said it **"feels like Hello World."**

That reaction is recorded in `PHASE-2-KICKOFF.md`, which reframes the whole project around
one question:

> **Does the video supplement the liner note or just recap it?**
> Phase 1 recapped. Phase 2 must supplement.

The video that shipped is a different thing. Seven frames instead of six beats. Its subject
is not Social Distortion — it is the *shape* of a catalogued life, with Social Distortion as
one thread traced through it. A persistent 182-dot ribbon spans the whole archive across
every frame. A violet cursor appears only when a frame refers to a specific date. The outro
is a generic branded asset, not a story ending.

| Spec's Beat Sheet (proposed) | What Shipped (P3-V2-TREATMENT) |
|---|---|
| 6 beats, 18–20s | 7 frames, 24.5s |
| Cold open on "1990." | Cold open on "182 concerts. 41 years." |
| Subject is the band | Subject is the archive; the band is the thread through it |
| Timeline appears in one beat | Ribbon persists across all frames, populates once |
| Outro carries the pull quote | Outro is generic and reusable across future videos |

**If you read only the spec, you will form the wrong picture of what exists.** That is why
this page exists.

---

## Reading order

For understanding what was built, and why it looks the way it does:

1. **[video/PATTERNS.md](../../../../video/PATTERNS.md)** — the reusable creative and
   technical patterns. Palette, the persistent ribbon, the milestone marker, the reveal-order
   principle, the paused-frame test. This is the highest-value document in the project. Start
   here.
2. **[video/compositions/social-distortion-thread/POSTMORTEM.md](../../../../video/compositions/social-distortion-thread/POSTMORTEM.md)**
   — where the build deviated from the treatment and why. Five deviations, each with its
   reasoning. Also the technical traps we paid for.
3. **[P3-V2-TREATMENT.md](P3-V2-TREATMENT.md)** — the director's treatment for the video that
   actually shipped. Frame-by-frame. This is the closest thing to a description of the real
   deliverable.
4. **[video/README.md](../../../../video/README.md)** — workspace layout, naming rules, render
   command.
5. **[morperhaus-video-pilot.md](morperhaus-video-pilot.md)** — the original spec. Read it
   last, as history and as process design. Its beat sheet is superseded; its thinking about
   *how to run the project* is not.

Supporting material, read as needed:

- **[hyperframes-capabilities.md](hyperframes-capabilities.md)** — what the framework could and
  couldn't do, with render metrics. Written against HyperFrames 0.4.6 (see Known Gaps).
- **[morperhaus-video-visual-language.md](morperhaus-video-visual-language.md)** — the brand
  extended into motion. First draft, never finalized.
- **[signature-element-candidates.md](signature-element-candidates.md)** — three proposals for
  a cross-video signature element. None was ever picked.
- **[PHASE-2-KICKOFF.md](PHASE-2-KICKOFF.md)** — the pivot document. Read it right after the spec
  if you want to see the moment the project changed direction.

---

## The deliverable

One video: `video/renders/20260419-social-distortion-thread.mp4` — 24.5 seconds, 1080×1920,
H.264, with an audio track. About 6 MB.

**It is gitignored.** It is not in a fresh clone. If you want to see the output, ask Mike for
the file rather than trying to rebuild the toolchain — see Known Gaps for why rebuilding is
not currently a one-liner.

---

## Status: what was settled, what wasn't

Settled:

- The pipeline works. HyperFrames renders 1080×1920 at cinematic quality. No red-light signal
  surfaced on the framework itself.
- Playfair Display and Source Sans 3 stay, despite HyperFrames' typography reference listing
  both as banned defaults. The brand-lineage argument won. Reasoning in
  `hyperframes-capabilities.md` § The Playfair Question.
- The patterns in `PATTERNS.md` are considered load-bearing for any future video.

Never decided:

| Issue | What's open |
|---|---|
| [#100](https://github.com/mmorper/concerts/issues/100) | The green/yellow/red pilot decision. Everything downstream waits on this. |
| [#97](https://github.com/mmorper/concerts/issues/97) | Signature element pick and wordmark finalization. Three candidates exist; none chosen. |
| [#98](https://github.com/mmorper/concerts/issues/98) | Composition iteration to a final pilot render. |
| [#99](https://github.com/mmorper/concerts/issues/99) | Storyboards for Templates A, B and D. Never started. |
| [#89](https://github.com/mmorper/concerts/issues/89) | The pilot epic itself. |

So: the video exists, but nobody ever ruled on whether it clears the bar. Treat the visual
language as a strong draft, not a settled system.

---

## What's transferable

If you are reading this because you want to build something similar, the video is not the
interesting part. The process design is. Four ideas that carried their weight:

**Split the work by what kind of judgment it needs.** Phase 1 ran autonomously overnight and
produced infrastructure, reference docs, and a deliberately mechanical first render. Phase 2
was interactive and produced the taste-driven result. The rule that made this work was
*propose, do not pick* — the autonomous phase was forbidden from making aesthetic decisions
and required to leave options with rationale instead.

**Give each iteration pass one question.** No fixed iteration budget. Every pass exists to
answer something specific: "Does this read as Morperhaus at a glance?" "Does the signature
hold in motion?" When the question is answered, stop. The named failure mode is polish creep
— adding a pass because one more tweak would be nice. Another pass is not what makes
something good.

**Write the red light down before you start.** The spec has explicit green, yellow and red
criteria, and says out loud that "don't build the series" is a valid outcome. Deciding what
failure looks like while you still have no ego in the result is much easier than deciding it
afterwards.

**Separate patterns from creative choices.** From the postmortem:

> A pattern is something that repeats. A creative choice is something that doesn't.
> Don't confuse them.

Patterns go in `PATTERNS.md`. One-off choices — a specific stat layout, a specific song —
stay in the per-video treatment. This is what keeps a pattern library from silently becoming
a template that flattens every future video into the same shape.

None of these depend on HyperFrames, or on video.

---

## Known gaps

Honest list. Several of these will bite anyone trying to run the project today.

**HyperFrames has moved on.** The pilot was built against 0.4.6. The current published version
is 0.8.23. Nothing pins it — there is no `video/package.json`, so `npx hyperframes render`
pulls the latest. Every metric in the capability doc and every framework rule in `PATTERNS.md`
was written against 0.4.6. Whether `video/index.html` still renders is unverified. Pin or
upgrade-and-re-render before trusting anything here.

**The composition is not payload-driven.** The spec's stated design goal was that "v2 of the
series is a payload swap, not a rebuild." That did not land. `video/index.html` contains no
reference to `payload.json` — the data is inline and hardcoded across 1,800 lines. The
`payload.json` and `build-payload.mjs` in `compositions/social-distortion-thread/` are an
audit trail of what data the video was built from, not a runtime input. Anyone building a
second video should fix this first.

**The composition is stale against the archive.** It hardcodes "182 concerts." The archive now
holds 184.

**`video/renders/` is shared with an unrelated pipeline.** The media pipeline writes personal
concert clips there too, named `YYYY-MM-DD-{artist}-NN.mp4`. HyperFrames deliverables are
named `YYYYMMDD-{slug}.mp4`. Both conventions live in one gitignored folder and nothing else
documents the collision. Don't assume everything in that directory came from this project.

**Dead references in the docs.** Some paths named in the spec set do not exist:

- `docs/inspiration/hyperframes-poc/` is called REQUIRED READING by the spec and described as
  the most authoritative source on the project's feel. It is **not tracked in git** — it is
  ~320 MB of local-only images and video on Mike's machine. Anyone else reads a spec pointing
  at a folder they cannot see.
- `p3-v2-storyboard.html`, referenced by `P3-V2-TREATMENT.md`, was never committed.
- `HANDOFF.md`, `MORNING-HANDOFF.md` and `session-recovery/` were **deleted** on 2026-09-01.
  The first was stale and superseded by this page; the last was an 11,000-line raw debugging
  transcript that was never reference material. `PHASE-2-KICKOFF.md` and
  `morperhaus-video-pilot.md` still name them in their read-this-first lists — those are
  historical records and were left as written, so a `cat` from either will fail. Nothing of
  substance was lost; anything you need is on this page or recoverable from git history.

---

## Running it

Only if you have read Known Gaps and pinned a version.

```bash
cd video
node scripts/render.mjs --slug social-distortion-thread                  # high quality
node scripts/render.mjs --slug social-distortion-thread --quality standard   # faster
```

Use the wrapper, not `npx hyperframes render` directly — the wrapper enforces the
`YYYYMMDD-{slug}.mp4` naming. Run `npx hyperframes lint` after any change to the composition
and fix all errors before considering the work done.

Framework rules that are non-negotiable and easy to get wrong are listed in
[video/PATTERNS.md](../../../../video/PATTERNS.md) § Framework rules and
[video/CLAUDE.md](../../../../video/CLAUDE.md) § Key Rules. The one that cost us the most time:
GSAP's `fromTo()` at a non-zero timeline position does not pre-apply its "from" state, so
elements flash visible at t=0. Pass `immediateRender: true`.
