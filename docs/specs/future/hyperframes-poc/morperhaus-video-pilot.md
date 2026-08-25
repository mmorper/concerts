# Morperhaus Concerts Video Pilot — Social Distortion, 34 Years

**Status:** Approved — ready for Phase 1 execution
**Target Milestone:** Pilot (not a versioned release)
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** None (self-contained; depends on existing data files only)

---

## Executive Summary

This is a **pilot**, not a feature. It exists to answer a single question: **does it make sense to turn the Morperhaus liner notes into a series of short-form social videos?**

The deliverable is one rendered 9:16 vertical video adapting an existing liner note ("Social Distortion: 34 Years of Shows," published 2026-01-23) plus three supporting artifacts: a **video visual language guide** (extending the existing brand system into motion), a **Hyperframes capability doc** that catalogs what the rendering framework does well and where it falls short, and **static storyboard frames for three additional template types** so the green-light decision can evaluate consistency across the series, not just the single video.

The pilot is structured as a collaborative design process between the project's lead designer and a Hyperframes specialist. It has per-pass exit criteria (not a rigid budget), explicit success criteria, and an explicit "no" outcome — if the pilot doesn't clear the green-light bar, the video series does not get built. That possibility is built into the spec on purpose.

**Execution model:** The pilot runs in two phases. **Phase 1 is autonomous** (Claude Code overnight, no human in the loop) and produces infrastructure, reference artifacts, and a mechanical first render. **Phase 2 is interactive** (Mike + Claude Code) and produces the taste-driven final pilot. Phase 1 has firm scope boundaries because autonomous execution without stop conditions is the failure mode.

The pilot must **wow** a viewer who has never heard of Morperhaus. Technical correctness is not sufficient.

---

## 🚀 Implementation Quick Start — Phase 1 (Autonomous / Overnight)

**Copy/paste this prompt when starting a NEW Claude Code session intended to run autonomously:**

```
I am running autonomously to execute Phase 1 of the Morperhaus Concerts Video Pilot.
Mike is asleep. He will review my work in the morning.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- I have access to the full codebase and can read any files
- At the end of EACH implementation window, I MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP, write the morning handoff note, and end the session
  3. Do NOT attempt heroic recovery — leaving work cleanly incomplete is better than
     leaving work chaotically complete
- Implement the spec AS WRITTEN — it is the source of truth
- Do NOT ask clarifying questions overnight. If something is genuinely ambiguous,
  make the most conservative interpretation, document it in the handoff note, and
  continue. Defer judgment calls to Mike in the morning.
- Read files proactively to understand existing patterns before writing code

**IMPORTANT SCOPE BOUNDARIES FOR AUTONOMOUS EXECUTION:**
The spec distinguishes "Phase 1 (autonomous)" work from "Phase 2 (interactive)" work.
Overnight, I do Phase 1 only. Specifically:
- DO: set up the nested video/ workspace, build the data payload, produce the
  Hyperframes capability doc, produce a first-draft video visual language guide
  (extending the existing brand), produce 2-3 candidate signature-element proposals
  (WRITTEN proposals, not a pick), and render a mechanical first composition that
  proves the pipeline works end-to-end
- DO NOT: pick the signature element, design the final wordmark (propose only, do
  not pick), iterate on aesthetic quality past the first mechanical render, attempt
  to "wow" — that is Phase 2 work requiring human judgment
- DO NOT: make irreversible decisions. When in doubt, produce options with rationale,
  do not pick.

**IMPORTANT PILOT FRAMING:**
- This is NOT a feature. It is a pilot whose purpose is to determine whether a video
  series is worth building.
- The visual quality bar for the FINAL pilot is "wow the audience." Phase 1 does not
  need to wow — it needs to produce a working pipeline and clean reference artifacts
  that Phase 2 can build on.

**Phase 1 Deliverables:**
- video/ workspace, initialized with `npx hyperframes init` inside the concerts repo
- video/compositions/social-distortion-34-years/payload.json (data payload)
- video/compositions/social-distortion-34-years/composition.html (first pass)
- video/compositions/social-distortion-34-years/output/pilot-mechanical.mp4 (first render)
- docs/specs/future/hyperframes-poc/hyperframes-capabilities.md (reference doc)
- docs/specs/future/hyperframes-poc/morperhaus-video-visual-language.md (first draft)
- docs/specs/future/hyperframes-poc/signature-element-candidates.md (2-3 proposals, no pick)
- docs/specs/future/hyperframes-poc/MORNING-HANDOFF.md (required — see template in full spec)

**Key References:**
- Full Pilot Spec: docs/specs/future/hyperframes-poc/morperhaus-video-pilot.md
- Hyperframes repo: https://github.com/heygen-com/hyperframes
- Liner note source: https://concerts.morperhaus.org/liner-notes.xml (entry 2026-01-23)

- Mike's creative inspiration (REQUIRED READING — read before writing any design):
  - docs/inspiration/hyperframes-poc/readme.md (Mike's notes on each scene's wow
    moment, aesthetic references, creative direction)
  - docs/inspiration/hyperframes-poc/mc-timeline.gif
  - docs/inspiration/hyperframes-poc/mc-venues.gif
  - docs/inspiration/hyperframes-poc/mc-geography.gif
  - docs/inspiration/hyperframes-poc/mc-genres.gif
  - docs/inspiration/hyperframes-poc/mc-artists-gatefold-open.gif
  - docs/inspiration/hyperframes-poc/mc-artists-01.png
  - docs/inspiration/hyperframes-poc/mc-artists-02.png
  - docs/inspiration/hyperframes-poc/mc-img.png (NYT iconographic-tease reference)

- Existing brand (DO NOT reinvent — extend into motion):
  - docs/design/icon-specification.md (network node, purple gradient identity)
  - docs/design/color-specification.md (full palette, genre colors, backgrounds)
  - docs/design/scene-design-guide.md (typography, spacing, animation, scene patterns)
  - .claude/skills/design-system/ (if present — consult first)

- Data sources: public/data/concerts.json, public/data/artists-metadata.json,
  public/data/artist-top-tracks.json, public/liner-notes.xml

**Hyperframes Specialist Setup:**
After `npx hyperframes init video`, run:
  npx hyperframes skills --claude
This installs hyperframes-compose, hyperframes-captions, and GSAP skills. These
make this session the "Hyperframes specialist" for the duration.

**Starting point:**
Step 1: Read the full pilot spec end to end. Do not skim.
Step 2: Read docs/inspiration/hyperframes-poc/readme.md and view all GIFs/images
        there. This is Mike's voice on the project's feel. It is not optional context.
Step 3: Read the three existing design spec files listed above. The existing brand
        system is not a starting suggestion — it IS the brand. Videos extend it
        into motion, they do not reinvent it.
Step 4: Initialize the video/ workspace inside the concerts repo.
Step 5: Begin producing the artifacts in the order listed in "Phase 1 Execution
        Order" in the full spec.
Step 6: At every context window boundary and at the end of all work, write/update
        MORNING-HANDOFF.md.

Let me start by reading the spec and the inspiration folder.
```

---

## Design Philosophy

**The video is not a recap of the liner note. It is an invitation to the archive.**

Morperhaus is a passion project about discovery. The site's core interaction pattern — across all five scenes — is: **open on something simple, reveal density when you look closer, let the click deliver the payoff.** Timeline opens with dots and yields a splayed deck of concert cards. Venues opens with chaos and invites touch. Geography opens with a map and yields a venue card that deep-links back. Genres opens with a Mondrian block-chart and yields a scrubbable timeline of how taste evolved. Artists opens with a grid and yields a vinyl gatefold opening for the first time.

That pattern is Morperhaus's interaction signature. The videos should translate it to feed-native format.

**The curiosity-by-implication principle.** The goal is not to tell viewers what they're missing. The goal is to show them something small and specific enough that they say *"huh, this is interesting — I want to click on the CTA and go learn more."* Curiosity, not persuasion. Implication, not explanation. The video earns the click by being a thing worth seeing on its own, not by begging.

**What each video must accomplish:**
- Contain a moment that rewards attention (the oh-moment of implied depth)
- Respect the archive as the reason the project exists
- Leave the viewer genuinely curious — not because a gap was pointed out, but because what they saw made them want more
- End on a CTA that's a door, not a pitch

---

## Aesthetic Lineage

The video language draws from a specific design lineage, not from short-form-video convention. Before designing anything, understand where Morperhaus sits:

**Peter Saville / Factory Records / New Order (1980s)**
The single strongest reference. Saville's album covers for New Order and Joy Division married neoclassical typography (Bodoni on *Substance 1987*, not coincidentally the direct ancestor of Playfair Display) with modernist graphic discipline. The hallmark move: *classical form set against vibrant organic or data-driven imagery*, letting tension carry the composition. Horizontal rules, asymmetric grids, color as structural element (not decoration), confidence expressed through restraint.

**Lesson for the video:** Treat the serif (Playfair) as the editorial anchor. Treat the data visualization (timeline, network, dots) as the modernist counter-element. Let them be in tension, not harmony. Color is structure, not mood.

**Swiss / International Typographic Style**
The grid discipline that underlies everything Saville did. Jan Tschichold, Josef Müller-Brockmann. Asymmetric layouts, mathematical proportion, typography as primary communication, zero ornamentation. Saville was explicit about this influence ("the cool, disciplined 'New Typography' of Tschichold").

**Lesson for the video:** The grid is not visible, but it's always there. Type aligns. Objects align. Negative space is deliberate, not leftover.

**New Order *Substance 1987***
Specifically worth studying. Neoclassical Bodoni Titling, vivid color fields (Trevor Key's dichromat coral/peony imagery), horizontal rules as structural elements, the band name/title absent from the front cover. Referenced as precedent by the LACMA curatorial team for "the balance of referencing classical form and overall attitude." This is the precedent that makes Playfair Display the right serif for Morperhaus — the lineage is real and intentional.

**Lesson for the video:** Restraint isn't caution, it's confidence. Not every frame needs to identify itself. Trust the viewer to connect the pieces.

**New York Times interactive journalism (particularly iconographic teases — see mc-img.png in the inspiration folder)**
Visual storytelling that uses simplified imagery and restrained typography to make the reader feel there's something worth clicking into. The icon-as-tease pattern specifically: a small, composed visual element that doesn't tell the whole story but signals there's one worth having. This is the visual analog of the curiosity-by-implication principle.

**Lesson for the video:** A well-chosen static element (an album cover, a date, a count, a venue name in small type) can invite more than a flashy motion sequence. Let compositions earn attention through what they choose not to show.

**What we are NOT drawing from**
- Handcrafted / stop-motion / analog-textured aesthetics (punk-poster feel). This lineage is real in 1970s–80s music design history but would fight the Saville/Swiss discipline. Fast cuts at specific moments are fair game; handcrafted texture is not.
- TikTok-native short-form conventions. Kinetic typography, punchy cuts on every beat, text that flies onto screen word-by-word, emoji, stickers, caption styles that mimic the platform's native UI.
- Motion-graphics demo aesthetics. 3D depth, lens flares, particle systems, camera moves for their own sake.

---

## Brand Continuity — Required Inputs

The video visual language is an **extension** of the existing Morperhaus brand, not a new identity. Before designing anything, read and internalize:

| Document | What to Extract for Motion |
|---|---|
| `docs/inspiration/hyperframes-poc/readme.md` + the GIFs | Mike's voice on each scene's feel and wow moment. This is the single most authoritative document for "what makes it Morperhaus." |
| `docs/design/icon-specification.md` | Network-node metaphor, purple gradient palette (`#1e1b4b → #581c87`), asymmetric organic clustering — these are motion-adaptable ideas, not just icon specs |
| `docs/design/color-specification.md` | Full palette, genre colors, scene backgrounds — the video should draw from this palette, not introduce a new one |
| `docs/design/scene-design-guide.md` | Typography (Playfair Display + Source Sans 3), entry animations (opacity+translate, 0.8s duration), stagger pattern, hover transitions |
| `.claude/skills/design-system/` (if present) | Consult before writing anything — likely the most consolidated brand reference |

**Motion-specific constraints the video language must honor:**

- **Typography pairing:** Playfair Display (editorial anchor — kin to Bodoni, carries the Saville lineage), Source Sans 3 (structural, grid-aligned body/UI). These are the only two typefaces. Playfair is non-negotiable specifically because it places Morperhaus in the Factory/*Substance* lineage; substituting a different serif would cut that tie.
- **Palette:** Draw from existing tokens. Signature color is the purple gradient (`#1e1b4b → #581c87`). Genre accents may appear for artist-specific moments.
- **Network-node motif:** The site's identity leans on network-node imagery. The video should echo this — not necessarily as literal nodes, but in the sensibility (connections, relationships, asymmetric clustering).
- **Animation timing:** The site uses `duration: 0.8s`, stagger of 0.2s, cubic-bezier easing. The video's entrance animations should feel like they could have come off the site. Fast cuts are permitted at specific transition moments (the stop-motion lesson) but default pacing is the site's pacing.
- **Restraint:** No emoji, no bouncing text, no icon-decorated buttons. The site is text-only and editorial; the video inherits that discipline.

**The signature element.** The site has network nodes as its visual identity. The video needs a parallel signature — a visual element that appears in every Morperhaus Concerts video regardless of which template it uses, so that a paused frame clocks as Morperhaus in a half-second. Phase 1 produces 2–3 written proposals. Phase 2 picks one. Candidate directions (not exhaustive — the designer may propose others):

- A horizontal rule at a specific Y-coordinate, always present, from which elements hang or across which they move — a structural echo of both the Timeline scene and Saville's use of horizontal rules on *Substance*
- A persistent archival date/metadata stamp in a fixed corner, like a photographer's contact sheet or a Factory catalog number ("FACT 200C" on *Substance*)
- A consistent color grade + film-grain layer on all photography, so images always look like they came through the same "camera"
- An opening and closing motion-lockup (the equivalent of Criterion's iconic opening, or Saville's consistent use of the Factory identifier)
- A motion reinterpretation of the network-node identity — nodes that appear, connect, and form the structural scaffolding of each frame

**Claude Code's job in Phase 1: propose, do not pick.** Pick happens in Phase 2 with Mike.

---

## Source Material

The pilot adapts this liner note, published 2026-01-23 in the Morperhaus "I WAS THERE" format:

> **Social Distortion: 34 Years of Shows**
>
> I first caught Social Distortion at Cal State Fullerton in 1990, back when Mike Ness was still carving out that distinctive sound that would define them through *White Light White Heat White Trash* and beyond. Eight shows across 34 years might not sound like devotion, but with Social D, each one felt like checking in with an old friend who'd weathered the same storms. My most recent show was just this past December at The Belasco, and hearing those same punk rock anthems that shaped my college years still hit with the same raw honesty. There's something comforting about a band that refuses to reinvent itself—they just keep getting better at being exactly who they've always been.
>
> **Featured track:** Social Distortion — "Ball and Chain" (from *Social Distortion*, 1990)
> **Concerts referenced:** 8 shows, 1990–2024
> **Key venues:** Cal State Fullerton, Hard Rock Hotel Las Vegas, The Belasco

### Why This Post Was Chosen Over Alternatives

Of the four liner note formats (single-show memory, the bill, the thread, the room), **the thread is the hardest to fake without the archive**. A human writer can write a one-night memory from any concert; they cannot casually reference "8 shows across 34 years" without doing research. The longitudinal format is therefore the best test of whether the video series has a reason to exist that generic concert content doesn't.

If the thread template can't be made to wow, the other three templates — which are closer to standard concert content — will have an even harder time justifying the series. So we test the hardest case first.

---

## Data-Use Inventory

The project contains rich metadata across concerts, artists, venues, tracks, and setlists — roughly 40 metadata elements per concert when related entities are joined.

**The full archive is available to every video.** Every data element the project has enriched — setlists, venue photos, geography, openers, bios, tour dates, genre colors, day-of-week, whatever else — is on the table for any given video. The designer's job is to pick what serves the specific story, not to choose from a pre-approved subset. If a data element surprises you by being perfect for a given moment, use it.

The principle that governs selection is: **each element on screen must pass the test, "if this weren't here, would the video be worse?"** Restraint applies per-frame, not per-toolkit.

### Worked Example — Social Distortion Pilot

The following is *one designer's thinking* about which data elements to use and which to cut for this specific post. It is not a template for future videos. Different posts will lead to different cuts.

**Data sources drawn on:**

| Source | Fields Used | Where It Appears |
|---|---|---|
| `concerts.json` | date, year, venue, headliner (filtered to 8 Social D shows) | Beat 1 (cold open), Beat 3 (timeline thread) |
| `artists-metadata.json` | image, formed year | Beat 2 (artist identity), Beat 3 (subtle attribution) |
| `artist-top-tracks.json` | track name, album name, album art | Beat 5 (artifact card) |
| `liner-notes.xml` | pull quote, deep-link URL | Beat 4 (pull quote), Beat 6 (outro) |
| Derived / computed | show count (8), span years (34), first/last venue, first/last year | Beat 2, Beat 3 |

**Data sources considered and not used for this post:**

| Source | Reasoning for This Post |
|---|---|
| `setlist.fm` setlists | Partial coverage across 8 shows (older ones likely absent) would read as uneven for a longitudinal format. Could work beautifully in a single-show Template-A video. |
| Opener imagery | Social D headlined these shows. For the "bill" template (Template B), opener imagery is the whole point. |
| Venue photos (Google Places) | The timeline strip conveys venue variety more elegantly for a thread format. A single-venue (Template D) video would lean on venue photos heavily. |
| Full bio text from artists-metadata | The liner note's narrative is doing that work already in this post. |
| `tour-dates.json` upcoming shows | Archival post. A future-looking Template F video would use this exclusively. |
| Lat/lng / map data | The story is about time, not geography. |
| Genre data | Already implied by "punk rock" in the pull quote. |
| Day of week | Not narratively relevant for a longitudinal post. |

The lesson is the reasoning pattern (ask what the specific story needs), not the specific cuts. Future videos may flip half of these.

---

## Green-Light / Yellow-Light / Red-Light Criteria

The pilot's purpose is a decision, not a shipped feature. These criteria make the decision defensible.

### 🟢 Green Light — Build the Series

All of these must be true:

1. **Retention test passes.** Unfamiliar viewers watch the full 18–20 seconds without scrolling away when it's shown in a feed-like context.
2. **Click-intent test passes.** A meaningful share of tested viewers say some version of "I'd click through to see more."
3. **Curiosity-by-implication test passes.** When viewers describe *why* they wanted to click, the reason is something they saw — not something they felt was withheld. Curiosity, not gap-pointing.
4. **Creator gut check passes.** Mike feels the video represents the project well enough to pin to a social profile.
5. **No uncanny artifacts.** The rendered output has no motion glitches, typography errors, or AI-artifact qualities that undermine the archival-feel goal.
6. **Storyboards hold up.** Static frames for Templates A, B, and D demonstrate the visual language is adaptable across formats, not a one-off aesthetic that only works for this post.
7. **Signature element works.** Whichever signature element is picked in Phase 2 holds its identity across the pilot video and the storyboards. A paused frame from any of them clocks as Morperhaus.

(The specifics of the retention and click-intent tests — test pool, sample size, how the video is shown — are Mike's to define.)

### 🟡 Yellow Light — Fix, Then Re-evaluate

- Viewers watch but don't click → visuals work, narrative hook is weak, revise the composition.
- Viewers click but leave the landing page immediately → video oversells what's on the other side.
- Viewers say they wanted to click because the video "made them feel like they were missing something" → that's begging, not curiosity. Rework the closing beats.
- Storyboards for A, B, or D feel visually inconsistent → the language guide needs another pass.
- Signature element reads inconsistently across templates → revisit signature design or pick a different candidate.

### 🔴 Red Light — Kill or Pivot

- Hyperframes rendering quality at 1080×1920 is not cinematic enough and engineering around it would change the project's nature.
- After reasonable iteration, the visual language still feels generic or derivative of the existing site rather than a natural motion extension.
- Viewers describe the video in terms that don't match Morperhaus's identity ("cute," "social-media-ish," "AI-generated"), and the gap isn't closable.

### Review Process

1. Render pilot MP4 + produce storyboards + finalize visual language guide + pick signature element.
2. Mike shows the video to unfamiliar viewers (Mike owns test-pool definition).
3. Mike watches the video in his own social feed on his own phone. Does it hold up in its native context?
4. Decision: green, yellow, or red. Documented in this spec's Revision History.

---

## Two-Phase Execution Model

This pilot has two phases with different execution models. The split exists because autonomous execution is great for infrastructure and reference artifacts but unreliable for taste calls.

### Phase 1 — Autonomous (Overnight)

**Who:** Claude Code, unsupervised.
**When:** A single overnight run (or multiple, if context windows require).
**Scope:** Infrastructure, payload, capability doc, visual language first draft, signature element proposals, mechanical first render.
**Stop conditions:**
- Phase 1 deliverables list is complete, OR
- Context window is below 30% and incomplete work is cleanly committed, OR
- A genuine blocker is hit (missing dependency, data schema mismatch, etc.) — in which case stop and document in the handoff note

**What Phase 1 does NOT do:**
- Does not iterate on aesthetic quality past the first mechanical render
- Does not pick the signature element
- Does not design the final wordmark (proposes only)
- Does not produce the final pilot MP4
- Does not attempt to "wow" — that requires human eyes

### Phase 2 — Interactive (With Mike)

**Who:** Mike + Claude Code, conversational.
**When:** After Phase 1 handoff, in daytime working sessions.
**Scope:** Pick the signature element; design the wordmark; iterate on visual language with eyes on; iterate on composition toward the final pilot render; produce storyboards for Templates A, B, D.
**Stop conditions (per-pass, not per-count):**
- Each iteration pass has a specific question it's answering. When the question is answered "yes," stop. Do not add a pass "just to tweak" — that's the polish-creep failure mode.
- Example pass questions: "Does this look like Morperhaus?" / "Does the signature hold in motion?" / "Does the composition invite curiosity without begging?" / "Does the wordmark work as an outro lockup?"
- There is no arbitrary iteration count cap. Iterate until the question is answered or until Mike decides the approach isn't working and pivots.

### Phase 1 Execution Order

Claude Code overnight produces artifacts in this order. Each is committed as it's completed so incomplete runs leave recoverable state:

1. **Set up workspace.** Nested `video/` directory inside the concerts repo. Run `npx hyperframes init video`. Install skills via `npx hyperframes skills --claude`. Commit.
2. **Read inputs** (the inspiration folder, existing brand specs). No output yet — this is input gathering. The inspiration folder is not optional; it is the authoritative source for Morperhaus's feel.
3. **Build the data payload.** Read concerts.json, filter for Social Distortion, resolve all 8 shows (dates, venues), fetch artist metadata, fetch top track, fetch pull quote from liner-notes.xml. Write `video/compositions/social-distortion-34-years/payload.json`. Commit.
4. **Produce Hyperframes capability doc.** Try motion primitives. Render small test clips. Document what works, what's rough, what the realistic ceiling is at 1080×1920. Include render time, file size, frame adapter recommendation. Write `docs/specs/future/hyperframes-poc/hyperframes-capabilities.md`. Commit.
5. **Produce first-draft video visual language guide.** Extending (not replacing) the existing brand. Cover: palette choices from existing tokens, typography system in motion, animation primitives with timing, do-not-do list, wordmark proposals (2–3 candidates, do not pick). Write `docs/specs/future/hyperframes-poc/morperhaus-video-visual-language.md`. Commit.
6. **Produce signature element candidate proposals.** 2–3 written proposals, each with: description, rationale tying to existing brand and aesthetic lineage, specific implementation sketch, pros/cons, example of how it appears across the 4 templates. Do not pick. Write `docs/specs/future/hyperframes-poc/signature-element-candidates.md`. Commit.
7. **Render mechanical first composition.** Follow the beat sheet as one hypothesized interpretation (see important note in "Pilot Composition" section below). Use only known-good patterns from the capability doc. Goal: pipeline verified end-to-end, not beautiful. Write `video/compositions/social-distortion-34-years/composition.html` and render to `output/pilot-mechanical.mp4`. Commit.
8. **Write morning handoff note.** See template below. Commit. End session.

### Morning Handoff Note — Required Template

File: `docs/specs/future/hyperframes-poc/MORNING-HANDOFF.md`. Written in plain language, not markdown theatrics. Sections:

```markdown
# Phase 1 Morning Handoff — [Date]

## What Got Done
[Bulleted list of completed deliverables with file paths]

## What Did Not Get Done (and why)
[If anything is incomplete — context window exhaustion, blocker, deliberate deferral — say so clearly]

## What Surprised Me
[Things that were harder or easier than expected. Be specific. Mike needs to know if
Hyperframes rendered captions poorly, if the composition HTML behaved unexpectedly,
if the data payload revealed anything new about the archive.]

## What I Deferred to Mike
[Every decision I declined to make, with the options I prepared for him. At minimum:
signature element pick, wordmark pick. Possibly more if I hit ambiguities.]

## What to Review First
[Ordered list of which artifacts Mike should look at first. The capability doc and
the mechanical render are the highest-signal items for go/no-go on the approach
itself. Language guide and proposals are second. Don't waste Mike's morning.]

## Open Questions
[Anything I couldn't resolve unilaterally that isn't a deferred decision. Usually zero
if the overnight run went well.]

## Commands to Run
[If Mike needs to run anything to inspect the work — `open video/compositions/.../output/pilot-mechanical.mp4`, etc.]
```

---

## Pilot Composition — Beat Sheet (One Hypothesis)

**Important framing.** The beat sheet below is *one hypothesized composition* for Phase 1 to render mechanically. It is not the spec's prescribed answer. It exists to give autonomous execution a concrete target to render, so Phase 2 has something specific to react to. Phase 2 may keep it, revise it, or discard and rebuild entirely — any of those outcomes is valid.

The beats are written prescriptively (exact timings, specific language) because autonomous execution needs specificity to produce something concrete. This should not be read as "the spec has decided." It should be read as "the spec has proposed."

### Format Specs

- **Aspect ratio:** 9:16 (vertical)
- **Resolution:** 1080 × 1920
- **Duration target:** 18–20 seconds
- **Audio:** Silent MP4. Captions burned in. Platform-native music added at post time (not a render concern).
- **Safe zones:** Respect TikTok/Instagram safe zones (top 220px for UI overlay, bottom 450px for caption/controls overlay). Critical content in the middle 1250px.

### Beat-by-Beat

**Beat 1 — Cold Open (0:00–2.5s)**
Black frame. White Playfair Display type, large.
- "**1990.**" (0.0–1.2s)
- Cut. "**Cal State Fullerton.**" (1.2–2.5s)
*Data sources: concerts.json (first Social D show: date year, venue)*

**Beat 2 — Artist Identity (2.5–4.0s)**
A single black-and-white Social Distortion archival image fills the frame. Over it: Playfair Display, smaller scale.
- "**Social Distortion**"
- Sub: "**34 years. 8 shows.**" (Source Sans, caps, tracked)
Morperhaus wordmark ghosts in at bottom-right, low opacity.
*Data sources: artists-metadata.json (image), derived (span calc, count calc)*

**Beat 3 — The Thread (4.0–11.0s)**
A horizontal timeline strip, center of frame, animates from 1990 on the left to 2024 on the right.
- As the sweep passes each of 8 concert-dates, a dot lights up.
- Above each dot, the venue name fades in briefly as the dot lights, then fades out.
- Below the strip, a ticker counter: "1 show · 2 · 3 · 4 · 5 · 6 · 7 · 8."
- The year reads 1990 → 2024 as the sweep moves.
- On arrival at 2024, the rightmost dot (The Belasco) pulses once, larger than the others.
*Data sources: concerts.json (8 rows filtered by artist), computed aggregates*

**Beat 4 — The Pull Quote (11.0–15.0s)**
Clean frame. Background fades to near-black. Big Playfair italic, center:
- "*Each one felt like checking in with an old friend*" (11.0–13.0s)
- "*who'd weathered the same storms.*" (13.0–15.0s)
*Data source: liner-notes.xml*

**Beat 5 — The Artifact (15.0–17.5s)**
Album art for *Social Distortion* (self-titled, 1990) occupies the top half. Bottom half, in the liner note's "0:30" card visual style:
- Artist: Social Distortion
- Track: "Ball and Chain"
- Album: *Social Distortion*
- Year tag: 1990
Silent. The card is the visual cue — platform music feature fills in the sound for viewers on IG/TikTok/YT Shorts.
*Data source: artist-top-tracks.json*

**Beat 6 — Outro (17.5–20.0s)**
Clean frame. Morperhaus Concerts wordmark, centered upper third. Below:
- "Full story at"
- "concerts.morperhaus.org/liner-notes"
Hold.
*Data source: site brand, deep link constructed from liner-notes.xml URL*

---

## Data Payload Shape

The video composition must be driven by a structured JSON payload, not hard-coded. This way, v2 of the series is a payload swap, not a rebuild. Design for this from day one.

```json
{
  "template": "the-thread",
  "sourceLinerNoteUrl": "https://concerts.morperhaus.org/liner-notes#social-distortion-34-years",
  "artist": {
    "name": "Social Distortion",
    "normalized": "social-distortion",
    "image": "https://.../social-distortion.jpg",
    "formedYear": 1978
  },
  "thread": {
    "firstYear": 1990,
    "lastYear": 2024,
    "spanYears": 34,
    "showCount": 8,
    "firstShow": {
      "date": "1990-XX-XX",
      "venue": "Cal State Fullerton",
      "city": "Fullerton, California"
    },
    "lastShow": {
      "date": "2024-12-XX",
      "venue": "The Belasco",
      "city": "Los Angeles, California"
    },
    "shows": [
      { "year": 1990, "date": "1990-XX-XX", "venue": "Cal State Fullerton" },
      { "year": "...", "date": "...", "venue": "..." },
      { "year": 2024, "date": "2024-12-XX", "venue": "The Belasco" }
    ]
  },
  "featuredTrack": {
    "name": "Ball and Chain",
    "album": "Social Distortion",
    "albumArt": "https://.../social-distortion-album.jpg",
    "year": 1990
  },
  "pullQuote": {
    "text": "Each one felt like checking in with an old friend who'd weathered the same storms.",
    "splitPoint": "who'd"
  },
  "outro": {
    "wordmark": "morperhaus concerts",
    "ctaUrl": "concerts.morperhaus.org/liner-notes"
  }
}
```

**Note:** The actual shows in `thread.shows` resolve from concerts.json at payload-build time. The payload builder reads concerts.json, filters where `headlinerNormalized == "social-distortion"`, sorts by date, and populates the array.

---

## Storyboards for Templates A, B, D

Static PNG frames at 1080×1920 for three frames of each template. Produced in Phase 2 (they require the Phase 2 signature-element pick to be meaningful).

**Templates to storyboard:**
- **Template A (The Memory)** — adapt "March 23: 21 Years Since Social Distortion" (Hard Rock Vegas, 2005). Three key frames: cold open, memory moment, outro.
- **Template B (The Bill)** — adapt "Social Distortion + 14 More: 2018 Festival Bill" (Huntington State Beach). Three key frames: cold open, lineup reveal, outro.
- **Template D (The Room)** — adapt "House of Blues Anaheim: 6 Shows Over 3 Decades". Three key frames: cold open, venue-as-hub, outro.

Static frames only. No animation. The point is to prove visual consistency across the series, not produce three more videos.

---

## Distribution Considerations (Informational — Not in Pilot Scope)

The pilot produces one silent MP4 and the supporting artifacts. Distribution is **manual** for this pilot and not a deliverable. But the pilot's output must be compatible with the distribution model we'd want for a series:

- **Mode A (API-posted, silent):** Bluesky + YouTube Shorts. Silent MP4 with burned-in captions works as-is.
- **Mode B (manual, music added in-app):** Instagram Reels + X. Mike posts manually, adds platform-catalog track to match the featured track visual card.

Licensing note: the Deezer/iTunes preview clips licensed for web-app playback are **not** licensed for distribution inside an MP4. Do not mux them into the video. The video is silent on purpose. Platform-native music catalogs fill in the audio at post time on IG/TikTok/YT; Bluesky and X have no licensed catalogs and run silent (acceptable — feeds autoplay muted anyway).

For the pilot specifically: **use whatever artist/album imagery is already in `artists-metadata.json` and `artist-top-tracks.json`.** Image-licensing review is deferred to a post-greenlight conversation. Not a POC concern.

---

## Current State of Related Features

- The site is a Jamstack React/Vite app. No backend, no video pipeline currently exists.
- The Hyperframes workspace lives **nested inside the concerts repo** at `video/`. One repo, one Claude Code session. Main build excludes `video/` via `.gitignore` patterns or tsconfig excludes as needed.
- The liner-notes.xml feed is live at `https://concerts.morperhaus.org/liner-notes.xml` and is the canonical source for liner note content going forward.
- `concerts.json`, `artists-metadata.json`, `artist-top-tracks.json` are the enrichment data sources, all under `public/data/`. The video workspace reads them via relative path (`../public/data/...`).
- No Morperhaus Concerts social accounts exist yet. Account creation is out of scope for the pilot.

---

## Files to Create

### In the concerts repo

- `docs/specs/future/hyperframes-poc/morperhaus-video-pilot.md` (this spec)
- `docs/specs/future/hyperframes-poc/morperhaus-video-visual-language.md` (Phase 1 deliverable — first draft)
- `docs/specs/future/hyperframes-poc/hyperframes-capabilities.md` (Phase 1 deliverable)
- `docs/specs/future/hyperframes-poc/signature-element-candidates.md` (Phase 1 deliverable — proposals only)
- `docs/specs/future/hyperframes-poc/MORNING-HANDOFF.md` (Phase 1 deliverable — end of overnight run)
- `docs/specs/future/hyperframes-poc/storyboards/` (Phase 2 deliverable — PNG files, ~9 static frames)

### In the nested video/ workspace

- `video/` (Hyperframes workspace, `npx hyperframes init`)
- `video/compositions/social-distortion-34-years/composition.html`
- `video/compositions/social-distortion-34-years/payload.json`
- `video/compositions/social-distortion-34-years/assets/` (album art, artist images)
- `video/compositions/social-distortion-34-years/output/pilot-mechanical.mp4` (Phase 1)
- `video/compositions/social-distortion-34-years/output/pilot-final.mp4` (Phase 2)

### Build system additions

- Add `video/` to relevant excludes (tsconfig, vite build, deployment) so the site build doesn't attempt to include it
- Do not add video-workspace dependencies to the root package.json

---

## Files to Modify

- `docs/ROADMAP.md` — add "Video Series" as an exploratory item pending pilot outcome
- `README.md` — no change until green-lit
- `.gitignore` — add `video/node_modules/` and `video/compositions/*/output/` (rendered MP4s can be large; keep source HTML and payloads versioned but renders ignored)

This pilot does not modify site code.

---

## Iteration Approach (Not a Budget)

No fixed iteration count. Each iteration pass exists to answer a specific question. When the question is answered, stop and move on. If three passes in a row don't answer the same question, that's a signal the approach isn't working — pivot, don't pile on passes.

**Example pass-question mapping (illustrative, not prescriptive):**

| Artifact | Question Pass 1 Answers | Question Pass 2 Answers | Question Pass 3+ Answers |
|---|---|---|---|
| Visual language | "Does it read as Morperhaus at a glance?" | "Does it hold up in motion?" | Only if a new question emerged |
| Signature element | (Proposals produced in Phase 1; pick in Phase 2, not iterated) | N/A | N/A |
| Composition | "Does the pipeline work end-to-end?" (mechanical — Phase 1) | "Does it invite curiosity without begging?" (Phase 2) | Only if specific beats need targeted fixes |
| Wordmark | "Do we have 2–3 candidates?" (Phase 1 proposals) | "Does the picked one work as an outro lockup in motion?" | Only if picked candidate fails in motion |
| Storyboards A/B/D | "Does the visual language adapt?" | Only if templates feel inconsistent | — |

**The failure mode to avoid** is polish creep — adding a pass because "one more tweak would be nice." Another pass is not what makes something wow. Editing, restraint, and knowing when to stop are what makes something wow. If you find yourself wanting to iterate without a specific question to answer, stop and ask Mike.

---

## Success Metrics

**Quantitative (green-light criteria, repeated):**
- Retention: unfamiliar viewers watch the full duration
- Click-intent: viewers express click-through intent in meaningful share
- Curiosity register: viewers describe wanting to click because of something shown, not something withheld

**Qualitative:**
- Mike's gut check: pinnable to the project's pinned post
- No uncanny-valley artifacts
- Visual language demonstrably adapts across storyboarded templates
- Signature element identifiable in a half-second across all frames
- Language guide + capability doc are useful enough to reuse for v2, not throwaway

---

## Out of Scope for the Pilot

Explicitly:
- Automation of any kind
- Multi-platform posting pipelines
- Template classification of liner notes (which type is a post?)
- The agent pipeline extension that turns new liner notes into videos
- "On This Day" calendar-driven content (Template E)
- Tour-date alert videos (Template F)
- Morperhaus Concerts social account creation
- Caption/post-copy writing strategy
- Analytics / attribution tracking
- Multi-language support
- Image-licensing review (deferred to post-greenlight)

All of the above are v2+ conversations that only happen if the pilot greenlights.

---

## Revision History

- **2026-04-18:** Initial specification created — v1.0.0
- **2026-04-18:** Revised to v1.1.0 — added two-phase execution model, integrated existing brand system, replaced rigid iteration budget with per-pass question criteria, nested video workspace, added morning handoff template, moved signature element and wordmark to explicit deliverables, deferred image licensing
- **2026-04-19:** Revised to v1.2.0 — added Aesthetic Lineage section (Saville/Substance 1987/Swiss/NYT), integrated docs/inspiration/hyperframes-poc/ as required reading, rewrote Design Philosophy around the curiosity-by-implication principle, reframed data-use inventory as "full archive available" with Social D cuts as worked example, added curiosity-register green-light criterion, reframed beat sheet as "one hypothesis" for Phase 1, cut "What the video is not" negation list and "Why This Structure Works" retrofit rationale, updated all paths to docs/specs/future/hyperframes-poc/
- **2026-04-19:** Revised to v1.2.1 — corrected inspiration asset reference (mc-artists.gif → mc-artists-gatefold-open.gif), moved spec to canonical path (docs/specs/future/hyperframes-poc/morperhaus-video-pilot.md), status updated to Approved

---

## Related Specifications

- This is the parent pilot. Future specs (if green-lit) would live at `docs/specs/future/` and cover:
  - Template A (single-show memory) — full video spec
  - Template B (the bill) — full video spec
  - Template D (the room) — full video spec
  - Agent pipeline extension — turns new liner notes into videos automatically
  - Template E ("On This Day") — calendar-driven daily content
  - Distribution pipeline — multi-platform posting
