# Phase 0 — Decisions

Exit-criteria answers for [`global-social-syndication.md`](../global-social-syndication.md)
§ "Phase 0 exit criteria". Issue [#328](https://github.com/mmorper/concerts/issues/328),
epic [#323](https://github.com/mmorper/concerts/issues/323).

**Canvas:** https://claude.ai/code/artifact/1194ef41-e45e-489b-a57b-8efe275a8445 —
26 artboards across six pages. Every decision below is visible there; this file
is the durable record, because annotations live in an artifact and Phase 1 reads
the repo.

Everything here was decided by drawing it with real archive data and looking at
the render, not by argument. Where a render overturned a reasoned position, that
is noted — those are the load-bearing entries.

---

## 1. Per-channel media format

| Format | Channels | Layout |
|---|---|---|
| **1080×1350 (4:5)** | Instagram | **Full bleed — the photograph fills the card, type over its lower third** |
| **1200×630 (1.91:1)** | Bluesky, Mastodon, X | 630×630 square image left, 570px type column right |

> **REVISED 2026-08-27 by the owner.** The 4:5 layout was originally a media BAND of
> 1080×820 with type entirely below it — the arrangement in `Main.dc.html`. That band is
> **landscape, 1.32:1**, and it was chosen when an image was something to slot into a
> reserved area.
>
> Crop boxes (#342, #411) changed what an image is. The owner now authors a **4:5 rectangle
> per asset** saying *this is the photograph*. A portrait rectangle cannot fill a landscape
> band: derived from the box's centre it slices horizontally through the middle, and on a
> standing performer the middle is the torso. Rendered against the real corpus it decapitated
> all four test acts — Human League, Moyet, Byrne, Howard Jones — while the full-bleed
> layout, whose card IS 4:5, honoured every box exactly.
>
> `LadderFullBleed.dc.html` is therefore the Instagram layout. `Main.dc.html` is kept, as
> `WideStacked.dc.html` is, because the failure is instructive: it is what a layout designed
> before crops looks like once crops exist.
>
> **The tradeoff, named:** type now sits over the photograph rather than on a clean ground.
> The scrim carries it on the four acts tested, but a bright or busy frame will fight it in a
> way the band never did. If that becomes a real problem the answer is to redesign the band
> as PORTRAIT, not to go back to slicing crops.

**Two render targets from day one, and two layouts — not one layout scaled.**

The 4:5 band does not port to 1.91:1. Scaled proportionally it becomes a
1200×340 letterbox, which is a 3.5:1 slice that **decapitates the subject**.
Every tier-2 source is square, so a 700×700 press shot in that band is a 2:1
strip across someone's eyes. This was invisible in the arithmetic and obvious in
the render (`WideStacked.dc.html` documents the failure; it is kept deliberately).

The wide card is the one format where a square image is the natural fit rather
than a compromise, and the only place tier 2 is **downscaled** (700 → 630) rather
than upscaled.

**In-image vs in-caption:** the image carries the credit line, the hook, the meta
stack, the provenance byline and the mark. The caption carries the full sentence
pair, the link and the tags. See §6 and §7.

---

## 2. Text budgets (measured, not estimated)

| Field | Budget | Actual, on the corpus post |
|---|---|---|
| `hook` | ≤ 120 chars | 53 |
| `beats[]` (carousel) | ≤ 120 chars each | 53 / 58 / 109 / 96 / 62 |
| Caption core | — | 166 |
| Caption, Bluesky (300) | fits | 217 |
| Caption, Mastodon (500) | fits | 267 |
| Caption, X (280) | fits | 166 |
| Caption, Instagram (2200) | fits | 415 |

The tightest channel does **not** force a shorter hook. All counts are computed
live in `Carousel.dc.html` and `Captions.dc.html` rather than typed in, so they
cannot drift from the strings they describe.

---

## 3. Payload fields those budgets imply

**Both `hook` and `beats`.** `hook: string` always; `beats: string[]` optional,
3–5 entries, consumed only by carousel-capable adapters (Instagram). Confirmed by
`Carousel.dc.html` — the five-beat arc holds and the longest beat is 109.

**Names become structured fields, not prose the generator is trusted to include.**
Artist, song, venue, city and date are rendered as furniture off the record, each
on its own line. This reverses a Wave 2 decision to withhold artist names for an
open loop: withheld names are unfindable by search, give a scrolling fan no reason
to stop, and on Instagram — where captions carry no clickable link — tease a
reveal the reader has no way to reach. **Withhold the interpretation; never the
identification.**

**`tags` must be suppressible per channel** (§7), and the detector tags must never
publish.

---

## 4. Visual language

**Inherits the site's design system.** Playfair Display + Source Sans 3; category
accents lifted from `scripts/liner-notes/og-image.ts` verbatim — cultural
`#7c3aed`, personal `#0ea5e9`, deep-cut `#059669`. Grounds are ink `#14111f` and
paper `#f2ece1`.

The category **label** was dropped in favour of the artist name; the coloured rule
still encodes it, and is now decorative rather than a legend. Deliberate.

> **Open:** the paper-vs-ink ground currently keys off tier 3, which distributes
> well across the nine grid posts **by luck**. It needs a real rule before it
> ships.

---

## 5. Imagery rubric

Decided by the owner 2026-08-21, before this canvas: never bare type; personal >
sourced > derived. Not re-litigated. What the mocks added:

**One band size for every tier.** An earlier cut of this wave scaled the well by
tier, so a generic press shot got less room. The nine-up grid killed it — the
small-well tiles read as broken (a stranded square over an empty field) rather
than as hierarchy. **Tier decides which image is fetched and nothing else.**

**Tier 3 is authored at the frame.** Derived artwork has no source file and
therefore no ceiling; it is generated to whatever size we ask for. An earlier cut
drew it in a 936×936 viewBox and rendered it at 780, discarding 17% of the
linework for nothing. Same for the material stub.

**Measured cost per tier at 1080×820:**

| Tier | Source | Cost |
|---|---|---|
| 1 · personal | 3000px+ | none |
| 2 · album cover | Cover Art Archive `front-1200` | none — **once the pipeline stops requesting `front-500`** |
| 2 · artist shot | TheAudioDB 700×700 | 1.54× upscale, 19% cropped. Invisible at feed scale (~400px delivered); soft at 100%. The only real cost in the system. |
| 3 · derived | generated | none |

---

## 6. Provenance: where the different-night disclosure lives

**In-image**, bottom-left of the media band, as one field with two states:

- `Mike Morper · 31 July 2026`
- `Mike Morper · July 2026, not the 1987 night`

A card gets screenshotted and re-shared without its caption, so a claim about
whose photograph this is — and which night — has to travel with the picture.

**Tier 2 and tier 3 carry no byline at all.** That is what finally makes the
rubric visible: personal imagery visibly outranks a press shot instead of being
indistinguishable from it. Full per-source policy in [`PROVENANCE.md`](./PROVENANCE.md).

---

## 7. Tags — four different answers

Tags do opposite things per channel, so a single house rule would be wrong on
three of four. Rendered with live counts in `Captions.dc.html`.

| Channel | Rule | Why |
|---|---|---|
| **Mastodon** | 4–5, CamelCase | Needs them most: no recommendation algorithm, full-text search is opt-in per user. CamelCase (`#NileRodgers`) is a firm accessibility norm — screen readers parse the word boundaries. |
| **Instagram** | 3–5, in the caption | The 30-tag block is obsolete; keyword search carries much of discovery. "Hashtags in the first comment" is folklore, not mechanism. |
| **Bluesky** | 1–2, inline | Real (clickable facets, followable feeds) but stacking reads as spam. They ride as facets on byte offsets — same machinery the link needs. |
| **X** | none | Discouraged by the platform, and they eat the tightest budget. |

**Tags come from entities** the record already knows — artist, venue, city,
decade. Generated, not authored.

**The detector tags must never ship.** `liner-notes.json` carries `#full-circle`
and `#cover`. That is internal taxonomy: meaningless to a reader and an instant
tell that a machine wrote the post. The adapter suppresses them.

> ⚠️ Platform guidance on tags churns. The X and Instagram positions in
> particular are worth re-checking before Phase 3 implements them.

---

## 8. Rendering technology

**Headless-browser screenshot (Playwright or Puppeteer). Not hand-built SVG.**

The mocks decided this by construction. Every artboard uses flexbox, CSS grid,
`text-wrap: pretty`, Google Fonts, `object-fit: cover` and layered gradients.
None of that survives a port to hand-built SVG through sharp — line breaking
alone becomes our problem, and the spec anticipated exactly that.

`scripts/render-mocks.mjs` already renders these files to 1:1 PNGs through
headless Chrome, expanding `sc-for`/`sc-if` and running each artboard's
`renderVals()`. **The mock is the prototype**, which is what §"Rendering
technology decision" asked for.

**Cost to name honestly:** this puts a browser in the GitHub Actions stage.
`og-image.ts`'s existing sharp path stays valid for the solid-colour fallback,
and Satori remains a middle option if the browser proves too heavy — but it does
not support the full CSS these layouts use.

**The harness earned its keep.** It caught three things reasoning missed: the
124px true-scale strip falling 358px off two artboards, a duplicated ticket after
a bad edit, and the tier-1 photograph leaking onto all five carousel panes.

---

## 9. Which media ladder levels are worth building

| Level | Verdict |
|---|---|
| **L0** — 4:5 + 1.91:1 renders | **Build.** Both formats designed and stress-tested. |
| **L1** — per-platform tuning | **Build**, folded into L0: the two layouts already differ per format rather than being one card scaled. |
| **L2** — Instagram carousels | **Build.** The five-beat arc holds; budgets measured. |
| **L3** — photography and 9:16 video | **Not decided here.** Stills are in from day one (tier 1). Video is untested and remains gated on #338 supply and #100's go/no-go. |

---

## 10. On This Day card architecture

**Date-forward.** A masthead carries the date with a rule under it; the liner-note
cards lead with a sentence. That masthead is what separates the two streams at a
glance in a feed.

**Structural finding:** a multi-show date has no single subject, so no tier-1 or
tier-2 image can be routed to it. **Busy dates fall to tier 3 by construction.**
On the four-show card (`06-04`) the year spine *is* the artwork rather than
decoration over it.

---

## 11. Does the nine-up grid read as robotic?

**Not with authored hooks. Emphatically yes without them — and the cause is copy,
not layout.**

**28 of the 57 published headlines follow one of five detector templates.**
"Caught Once, Never Again" alone accounts for 9. Grid A shows three of them
adjacent, verbatim, exactly as they would publish.

No amount of art direction fixes that grid. This is the measured number behind
the spec's "authored, never derived" rule, which until now was a principle.

Second, smaller version of the same problem: five of the nine grid posts are at
the Pacific Amphitheatre. Venue repetition is real too.

**At 124px — true phone profile-grid scale — the artist name is the only legible
text on a tile.** The hook is noise at that size. That is the single clearest
argument for naming.

---

## Still open, deliberately

| Item | Status |
|---|---|
| #338 personal-media inventory | Not run. Sizes tier 1; runs in parallel, gates nothing here. |
| Paper-vs-ink ground rule | Keyed to tier 3 by luck. Needs a real rule. |
| Song-absent meta layout | Most posts have no track, so the meta stack goes 3 lines to 2. Unmocked. |
| Tier 1 vs tier 2 at a glance | Solved by the byline (§6). Worth re-checking once real tier-2 imagery is in the frame rather than a placeholder. |
| L3 video | Phase 4, gated on #100. |

---

**Version:** 1.0.0 · **Date:** 2026-08-21 · **Status:** Phase 0 creative closed
