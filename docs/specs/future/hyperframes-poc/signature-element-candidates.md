# Signature Element Candidates — Phase 1 Proposals

**Status:** Phase 1 proposals — 3 candidates. **No pick.** Phase 2 with Mike chooses.
**Date:** 2026-04-19
**Companion:** `morperhaus-video-visual-language.md`

---

## What a Signature Element Is

A visual element that appears **in every Morperhaus Concerts video**, regardless of which of the four templates (the thread / the memory / the bill / the room) produced it. Its job: **a paused frame from any video clocks as Morperhaus in a half-second.**

The site's parallel is network-node imagery — used across icons, the Venues scene, the favicon. The signature element is the video equivalent: a single visual gesture that threads through all future content.

### Criteria a good signature satisfies

1. **Identifies the brand at a glance.** Even without the wordmark visible, the paused frame reads as Morperhaus.
2. **Adapts across templates.** Works equally well for the thread (data-driven timeline), the memory (single-moment nostalgia), the bill (lineup reveal), and the room (venue-as-hub).
3. **Stays out of the content's way.** The signature is scaffolding, not content. It should not compete with the headline or the album art for attention.
4. **Traces to existing brand.** Extends something that already exists (network nodes, purple gradient, Playfair type, horizontal rules). Does not invent a new identity.
5. **Survives re-encoding.** Instagram compresses aggressively; Bluesky doesn't. Signature must read in both.

### Candidate directions the pilot spec named

The spec lists five directions as non-exhaustive seeds:

- A horizontal rule at a fixed Y-coordinate (Timeline scene + *Substance 1987* echo)
- A persistent archival metadata stamp (contact-sheet / Factory catalog number)
- A consistent color grade + film-grain layer on all photography
- An opening/closing motion-lockup (Criterion-style bookending)
- A motion reinterpretation of the network-node identity

Phase 1 took each seriously and narrowed to the three that (a) have the strongest existing-brand trace, (b) are distinct enough from one another to give Phase 2 real choices, and (c) don't require a third typeface or novel color. Candidates 3 and 5 (color grade / film grain, motion-lockup) were merged into a hybrid in Candidate C. Directions with weaker brand trace (an opening logo-reveal alone, a persistent hashtag, etc.) were rejected.

---

## Candidate A — The Meridian Rule

**One-line description:** A thin horizontal rule, always present at the same Y-coordinate, from which type hangs and across which elements pass.

### What it looks like

- A single `1px` rule in `#ffffff` at 70% opacity
- Positioned at `y = 960px` (exactly center of a 1920-tall frame) or `y = 1152px` (golden-ratio lower-center)
- Always visible during any display-type scene
- In data scenes (Beat 3 timeline sweep), the rule *becomes* the timeline axis — the sweep travels along it, dots light above it, labels drop below it
- Type in display scenes hangs FROM the rule (sits with baseline flush to the rule + 16px compensation)
- In the outro, the rule remains as the wordmark lockup appears above it

### Rationale — lineage trace

- **Saville / *Substance 1987*:** Saville's signature use of horizontal rules as structural elements on the Substance 1987 cover and Factory Records sleeves. The rule is the modernist counter-element to the neoclassical Bodoni type; it is explicitly what makes the lineage legible.
- **Swiss typographic discipline:** Rules are how the grid becomes visible without becoming decorative — Tschichold, Müller-Brockmann. The rule *is* the grid, briefly promoted to the surface.
- **Morperhaus Timeline scene:** The site's first scene is a horizontal timeline. The video's Timeline-adjacent signature is the same move, abstracted.
- **NYT iconographic tease:** The NYT uses thin rules to frame and qualify their iconographic teasers. The rule signals "editorial," not "decorative."

### Implementation sketch

```html
<!-- Present in every scene, same Y, same opacity -->
<div class="meridian" aria-hidden="true"></div>

<style>
.meridian {
  position: absolute;
  left: 80px;
  right: 80px;
  top: 1152px; /* golden-ratio lower-center */
  height: 1px;
  background: rgba(255, 255, 255, 0.7);
  transform-origin: left center;
}

/* Display scenes: type hangs from the rule */
.s1-year {
  position: absolute;
  bottom: calc(100% - 1152px + 40px); /* sit above the rule */
  left: 80px;
}
</style>

<script>
// The rule enters on scene 1 via scale-x (0 → 1), 0.8s, power3.out
// then stays present, unchanged, for the entire composition
tl.from(".meridian", { scaleX: 0, duration: 0.8, ease: "power3.out" }, 0.2);

// On Beat 3, the rule's opacity lifts briefly as dots appear along it
tl.to(".meridian", { opacity: 1, duration: 0.3 }, 4.0);
// then settles back
tl.to(".meridian", { opacity: 0.7, duration: 0.3 }, 10.0);
</script>
```

### Pros

- **Extremely adaptable.** Becomes a timeline axis (Template A — thread), a divider between lineup columns (Template B — bill), an underline for a venue's photo (Template D — room), or a baseline for a single memorable headline (Template C — memory).
- **Reads instantly.** Even paused, the rule's position and thinness are unmistakable — no other short-form video platform uses this move with discipline.
- **Implementation-cheap.** One DOM element, one CSS block, one initial tween. No maintenance burden.
- **Does not compete with content.** A rule is scaffolding by definition. It cannot fight the headline.

### Cons

- **Subtle.** A viewer without the vocabulary for Swiss/Saville design may not notice it consciously — it works subliminally. Relies on accumulation across many videos to register as a brand pattern.
- **Risk of reading as "accidental."** If the Y-position drifts between videos or the opacity changes, the signature fails completely. Discipline required.
- **Constrains composition.** Every frame must respect the rule's position. Occasionally a beat will want a full-bleed image (Beat 2 — archival photo) that fights this.

### How it appears across the four templates

| Template | Rule role |
|---|---|
| A — The Thread (this pilot) | Becomes the timeline axis in Beat 3; sits above display type in Beats 1/2/4/6 |
| B — The Memory (single-show) | Baseline under "March 23, 2005." cold open; divider between memory-text and album-art artifact |
| C — The Bill (festival lineup) | Divider between headliner line and support acts; reads as a program separator |
| D — The Room (single venue) | Underline to the venue photo; becomes axis for "6 shows over 3 decades" timeline moment |

---

## Candidate B — The Contact-Sheet Stamp

**One-line description:** A persistent archival metadata stamp in a fixed corner of every frame — date, catalog number, and an abstracted Factory-style identifier — treating every video as a cataloged entry in the Morperhaus archive.

### What it looks like

- Bottom-left corner of every frame (or top-left, TBD), inside the critical-content safe zone at `x=80px, y=1380px`
- Three lines of Source Sans 3 at 20px, `#ffffff` at 80% opacity, `0.05em` tracking, UPPERCASE
- Line 1: `MH 001` (the catalog number — MH for Morperhaus, sequential)
- Line 2: the show date range or key date (`1990–2024` for the thread; `2005.03.23` for a memory)
- Line 3: the template code (`THREAD`, `MEMORY`, `BILL`, `ROOM`)

### Rationale — lineage trace

- **Factory Records catalog numbers:** `FAC 51` (the Haçienda), `FAC 501` (*Substance 1987*), `FAC 200C` (the Substance cassette). Saville and Factory treated every release — and the club, and the coffin of a founder — as a cataloged entry. The catalog number is an identity claim: this thing is part of a continuous archive.
- **Contact-sheet / photographer's stamp:** The practice of marking every frame with metadata — date, roll, frame number — is how archival photography signals authorship without intrusion.
- **NYT data journalism:** NYT pieces often include a small provenance stamp (byline, update date, dataset). This is the visual vocabulary.
- **Morperhaus concept:** The entire site is an archive. The signature makes that explicit.

### Implementation sketch

```html
<div class="archive-stamp" aria-hidden="true">
  <div>MH 001</div>
  <div>1990&ndash;2024</div>
  <div>THREAD</div>
</div>

<style>
.archive-stamp {
  position: absolute;
  left: 80px;
  bottom: 460px; /* just above the bottom-450 safe zone */
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
}
</style>

<script>
// Stamp fades in 0.3s after scene 1 begins, holds for the composition
tl.from(".archive-stamp", {
  opacity: 0,
  duration: 0.4,
  ease: "power2.out"
}, 0.6);
// Never exits. Transitions inherit it (it's in the root, not per-scene)
</script>
```

**Data discipline:** the catalog number must be deterministic. Per-video, the payload can carry `catalogNumber` (e.g., `"MH 001"` for the pilot). All future videos get an incrementing number. This becomes content for enthusiasts — "they're up to MH 042 now."

### Pros

- **Extremely distinctive.** No other concert-content video series does this. A paused frame with a catalog stamp clocks as "that morperhaus thing" from the first encounter.
- **Strong lineage legibility.** The Factory reference is unmistakable to anyone who knows the lineage, and simply reads as "archival / serious" to anyone who doesn't.
- **Amplifies the archive premise.** Every video is framed as an entry, not an impression. This matches the site's core claim.
- **Hard to execute poorly.** The stamp is text. Text renders cleanly. No motion craft required.

### Cons

- **Visual noise in the safe zone.** Adds three lines of text to every frame, even during the quietest beat (the pull quote). The stamp will be present during the Playfair italic moment — that's a compositional trade-off.
- **Requires discipline in catalog numbering.** Once you start at MH 001, you cannot restart. The numbering must persist across v2, v3, etc.
- **Risk of reading as Watermark, not Signature.** Corner metadata reads as watermark in some contexts. Must be executed with enough taste that it reads as "the New Yorker byline" and not "iStock watermark."
- **Less adaptable to templates that are visually quiet.** On a Template D room-photo full-bleed, the stamp either covers part of the photo or must shift position — inconsistency is fatal.

### How it appears across the four templates

| Template | Stamp content |
|---|---|
| A — The Thread | `MH 001 / 1990–2024 / THREAD` |
| B — The Memory | `MH 002 / 2005.03.23 / MEMORY` |
| C — The Bill | `MH 003 / 2018.10.28 / BILL` |
| D — The Room | `MH 004 / House of Blues Anaheim / ROOM` (four-line variant for venue names) |

---

## Candidate C — Node Scaffold (Motion Network-Node Signature)

**One-line description:** A small, asymmetric cluster of 5–7 network nodes (echoing the favicon and icon spec) that assembles into every frame's composition and persists as a subtle scaffolding structure.

### What it looks like

- 5–7 small dots (`4–10px` diameter), clustered asymmetrically, connected by 1–3 thin lines
- Colors from the icon spec: `#6366f1` (primary), `#8b5cf6` (secondary), `#a855f7` (lines), `#c084fc` (highlight)
- Positioned in a consistent region of every frame — **upper-right corner, inside the top-220 safe zone but compact enough to sit within ~220×220px**
- Assembles at the start of each composition: nodes fade in one at a time (staggered 0.1s), then connections draw (0.3s stroke-to-path)
- On specific beats, one node "glows" in sync with on-screen content (e.g., when Beat 3 lands on The Belasco, the rightmost node in the scaffold pulses once — telegraphing continuity between the site's network metaphor and the video's narrative)
- In data-driven scenes, the scaffold can subtly re-organize — nodes shifting position to reflect the current story beat. On quiet beats, it sits completely still.
- Final frame: the scaffold remains, now accompanied by the wordmark below

### Rationale — lineage trace

- **Morperhaus icon identity** (most direct): the iOS icon is a 6-node asymmetric network. The favicon is a 5-connection radial web. The video's signature is the same visual idiom, miniaturized and animated.
- **Venues scene:** the Venues scene is a radial network graph. The video's network scaffold is a tiny echo of that.
- **NYT iconographic tease:** a small, composed visual element in a corner that implies depth without explaining it. The tease says "there's something structured here" — which is what network nodes literally depict.
- **Data-forward identity:** the concert archive is a network (artists ↔ venues ↔ shows). The signature makes that visible.

### Implementation sketch

```html
<svg class="node-scaffold" width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
  <!-- Lines first (rendered under nodes) -->
  <line class="link l1" x1="40" y1="40" x2="120" y2="60" stroke="#a855f7" stroke-width="1.5" opacity="0" />
  <line class="link l2" x1="120" y1="60" x2="80" y2="140" stroke="#a855f7" stroke-width="1.5" opacity="0" />
  <line class="link l3" x1="40" y1="40" x2="80" y2="140" stroke="#a855f7" stroke-width="1" opacity="0" />
  <!-- Nodes -->
  <circle class="node n1" cx="40" cy="40" r="6" fill="#6366f1" opacity="0" />
  <circle class="node n2" cx="120" cy="60" r="8" fill="#8b5cf6" opacity="0" />
  <circle class="node n3" cx="80" cy="140" r="5" fill="#6366f1" opacity="0" />
  <circle class="node n4" cx="160" cy="120" r="4" fill="#8b5cf6" opacity="0" />
  <circle class="node n5" cx="180" cy="30" r="3" fill="#c084fc" opacity="0" />
</svg>

<style>
.node-scaffold {
  position: absolute;
  top: 60px;
  right: 60px;
  width: 200px;
  height: 200px;
}
</style>

<script>
// Assembly: nodes fade in one at a time, then lines draw
tl.from(".node.n1", { opacity: 1, scale: 0, duration: 0.3, ease: "back.out(1.5)" }, 0.3);
tl.from(".node.n2", { opacity: 1, scale: 0, duration: 0.3, ease: "back.out(1.5)" }, 0.5);
tl.from(".node.n3", { opacity: 1, scale: 0, duration: 0.3, ease: "back.out(1.5)" }, 0.7);
tl.from(".node.n4", { opacity: 1, scale: 0, duration: 0.3, ease: "back.out(1.5)" }, 0.9);
tl.from(".node.n5", { opacity: 1, scale: 0, duration: 0.3, ease: "back.out(1.5)" }, 1.1);
tl.to(".link.l1", { opacity: 0.8, duration: 0.3 }, 1.3);
tl.to(".link.l2", { opacity: 0.8, duration: 0.3 }, 1.5);
tl.to(".link.l3", { opacity: 0.5, duration: 0.3 }, 1.7);

// Beat 3 echo: when the Belasco dot pulses, the scaffold's "rightmost" node also pulses
tl.to(".node.n5", { r: 5, duration: 0.2, yoyo: true, repeat: 1 }, 10.0);
</script>
```

### Pros

- **Most direct lineage** to the existing site icon and Venues scene. A viewer who's been to the site sees the echo immediately. A viewer who hasn't still reads "data-structured" at a glance.
- **Ties concept to form.** The concert archive literally is a network of artists and venues; the signature depicts that.
- **Dynamic without being busy.** Subtle node pulses at narrative moments create a sense that the scaffolding is *responding* to the content.
- **Scales across templates.** The scaffold is arrangement-agnostic — every template gets the same ~220×220px scaffold in the same corner.

### Cons

- **Most execution-intensive** of the three candidates. Asymmetric node positions, specific colors, consistent line weights — requires precision to avoid looking generic. A bad execution reads as "random dots."
- **Risk of mis-reading as loading spinner.** Small clustered dots in a corner can read as a loading state unless stylistically anchored.
- **Competes for attention in corner safe zone.** Most short-form video reserves the upper-right for a subscribe button or watermark; putting a scaffold there may confuse viewers' template-trained eyes.
- **Hardest to render at Instagram's re-encoding** — small connection lines may compress into indistinct fuzz. Needs testing at standard compression levels.

### How it appears across the four templates

| Template | Scaffold behavior |
|---|---|
| A — The Thread | Scaffold assembles in cold open; the node furthest-right pulses when Beat 3 lands on the most recent show |
| B — The Memory | Scaffold assembles with a single "main" node highlighted (the show being remembered) |
| C — The Bill | Scaffold is denser (one node per featured act), arrangement asymmetric as always |
| D — The Room | Scaffold has one central "hub" node (the venue) with all others connected to it — literalizes the venue-as-hub metaphor |

---

## Comparison Matrix

| Criterion | A: Meridian Rule | B: Contact-Sheet Stamp | C: Node Scaffold |
|---|---|---|---|
| **Brand-trace strength** | Strong (Saville + Timeline scene) | Strongest (Factory catalog lineage explicit) | Strongest (icon spec direct inheritance) |
| **Identifies at a glance** | Subtle; accumulates across videos | Immediate (text is literal) | Immediate (mark is visual) |
| **Adaptability across templates** | Highest | Medium (needs discipline) | High |
| **Competes with content** | Never | Sometimes (3 lines of metadata) | Sometimes (corner always busy) |
| **Survives Instagram re-encode** | Best (1px rule compresses well) | Best (text is pixel-safe) | Weakest (thin lines at risk) |
| **Implementation complexity** | Lowest | Low | Highest |
| **Saville-lineage legibility** | High (Substance rule move) | Highest (Factory catalog lineage explicit) | Lower (more about site identity than Saville) |
| **Design-craft demands** | Position discipline | Type discipline | Composition discipline |
| **Risk mode if executed poorly** | Reads as incidental / accidental | Reads as watermark | Reads as loading-spinner / generic |
| **Wordmark pairing** | Pairs cleanly with wordmark Proposal 1 (Editorial Masthead) | Pairs cleanly with wordmark Proposal 3 (Catalog-Stamp) | Pairs cleanly with wordmark Proposal 2 (Node-and-Type) |

---

## What Phase 1 Is Not Recommending

There is no recommendation. Each candidate has a distinct center of gravity:

- **Candidate A is the most restrained and most Saville-lineage-legible.** If the pilot's greenlight hinges on a sophisticated-design reaction from initial viewers, A is strongest.
- **Candidate B is the most explicit and the most "archive claim."** If the pilot's goal is to make the "every video is part of a series" message land viscerally, B is strongest.
- **Candidate C is the most visually confident and the most site-consistent.** If the pilot's goal is to extend the site's existing identity into motion with the highest trace back to the icon family, C is strongest.

Each maps to a different wordmark proposal (see matrix above). The pair-chosen, not the individually-chosen, is the actual design call.

---

## Phase 2 Decision Process (Suggested)

1. Read all three candidate write-ups with Mike
2. Look at the mechanical render (produced in #95) — it will use a *placeholder* signature (Candidate A as the most conservative) to give Phase 2 something concrete to react to
3. For each candidate, Mike reads the pros/cons and imagines it appearing across the four templates
4. Pick the candidate + wordmark pair that produces the most "paused-frame-reads-as-Morperhaus" gut reaction
5. Update the visual language guide to reflect the picked signature (remove candidate language; describe the signature as canonical)
6. Commit the picks. Proceed to composition iteration.

**Expected Phase 2 time for this decision:** one session, 30–60 minutes. Any longer means the criteria aren't sharp enough; regroup.

---

## Open Questions for Phase 2

1. Which candidate, which wordmark?
2. If Candidate A or C: which exact Y-coordinate / corner position is canonical?
3. If Candidate B: starting catalog number (MH 001?) and whether the series numbers before this pilot (retroactive numbering of liner notes?) or after
4. Does the signature appear on the CTA frame, or does the wordmark replace it?
5. How does the signature behave on storyboarded Templates A/B/D — identical, or template-responsive?

---

## References

- `docs/design/icon-specification.md` — network-node identity source
- `docs/design/color-specification.md` — color tokens used in Candidate C
- `docs/specs/future/hyperframes-poc/morperhaus-video-visual-language.md` — wordmark proposals + anti-patterns
- `docs/specs/future/hyperframes-poc/hyperframes-capabilities.md` — what the framework can execute safely
- Pilot spec: `docs/specs/future/hyperframes-poc/morperhaus-video-pilot.md`
