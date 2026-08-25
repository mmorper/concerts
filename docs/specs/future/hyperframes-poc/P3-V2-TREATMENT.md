# P3 v2 — Director's Treatment

**Project:** Morperhaus Concert Archives · Hyperframes pilot video
**Template:** The Thread (liner note → video, 20 seconds, 1080×1920)
**Subject of the pilot:** Social Distortion — 8 shows, 1990–2024
**Working title:** *One thread, eight shows, two coasts.*
**Date:** 2026-04-19

---

## Thesis

**This video doesn't tell you about a liner note. It teaches you how one person's memory works — using a map.**

The pilot's job is not to summarize prose. It's to show the viewer the *shape* of a catalogued life. That shape is the deliverable. The Social Distortion thread is one example of it; the site contains hundreds more. The video earns its existence by showing something the reader only gets in fragments across 2,000 words of liner note: the geometric, literal, across-a-country-and-back shape of following one band for 34 years.

---

## What this is not

- **Not a video about Social Distortion.** They're a subject, not the story.
- **Not a promotional reel for the site.** The CTA is a door, not a pitch.
- **Not an infographic.** Data is dressed, not raw.
- **Not minimalism.** Density is the point — this is the Artists-scene density, not a Kinfolk cover.
- **Not feed-native.** We will not chase TikTok typography conventions. Morperhaus earns attention by refusing the feed's defaults.

## What this is

A 20-second editorial-documentary short. Cold open on a wide shot of someone's entire life-in-concerts. Narrow to one thread. Watch that thread resolve into geography. End on evidence — every photo, album, date that the thread contains — and a door.

---

## The viewer

A stranger scrolling a feed. They have no idea what Morperhaus is.

At 20 seconds in, they should be thinking:
1. *This is one person's personal catalog of their own concert-going.*
2. *That loop across the country is real — I can see it.*
3. *I want to see what else they've logged.*

They should **not** be thinking: "this is an ad" / "this is a data viz" / "this is a band promo."

---

## Voice (copy)

Editorial-documentary. Inherited from the liner-note voice, motion-adapted.

- **Lowercase unless grammar demands capital.** `182 concerts.` — not `182 CONCERTS`.
- **Periods are punctuation, not emphasis.** The period on `182 concerts.` tells the reader the sentence is complete, not loud.
- **Numerals, not words, for counts and years.** `8 shows`, not `eight shows` — except in pull quotes.
- **No exclamation points, no emoji, no hashtags.**
- **No "swipe up," "click here," "don't miss" — ever.** The URL is the invitation.

**Copy list (every word on screen, in order of appearance):**

1. `182 concerts.`
2. `41 years.`
3. `One life, cataloged.`
4. `Eight of them, one band.`
5. `Social Distortion · 1990 – 2024`
6. `Twice at 9:30 Club.`
7. `Away. And back.`
8. `California → Nevada → D.C. → Maryland → California`
9. (pull quote) `like checking in with an old friend who'd weathered the same storms.`
10. `morperhaus · Concerts`
11. `Full story at concerts.morperhaus.org/liner-notes`

Eleven copy moments. Every one earns its place.

---

## Tone arc

| Beat | Tone | Viewer feels |
|---|---|---|
| 1. Archive | Establishing, wide, calm | "whoa, that's a lot of shows" |
| 2. Thread | Narrowing, specific | "wait, just these eight?" |
| 3. Venues | Layered, photographic | "I can see each place" |
| 4. Doubled | Noticing, gentle | "huh, they went there twice" |
| 5. Geography | Revealing, quiet reward | "it's a loop — they went away and came home" |
| 6. Evidence | Dense, contact-sheet, climactic | "this person actually lived this" |
| 7. Outro | Resolving, door | "where do I go next?" |

Note the shape: beats 1 and 6 are the densest. Beats 2–5 are the journey. Beat 7 is the exit. This is classic editorial pacing — wide, narrow, discover, wide again, exit. It matches the site's own "simple → dense → click-payoff" rhythm that the existing scenes already use.

---

## Visual language

### Typography

**Two faces. Always these two.** Playfair Display (the display anchor) and Source Sans 3 (the structural voice). The pairing sits in the Didone/Grotesk lineage — Bodoni vs. grid — that Saville used on *Substance 1987* and that Mohawk, Pentagram, NYT Magazine, and countless editorial brands use today. This is the continuation of an argument that started in the 1700s. We keep it.

**The size hierarchy is intentionally extreme.**

| Role | Typeface | Size | Why |
|---|---|---|---|
| Cover numerals (`182`, `41`) | Playfair Display 500 | 260px | Subject. Uninterrupted. Like a magazine cover. |
| Sentence fragments (`Eight of them, one band.`) | Playfair Display 500 | 72–88px | Body editorial. Reads as deliberate sentences, not captions. |
| Pull quote | Playfair Display 400 italic | 60px | Inherited voice, lowercase. |
| Stat subtitles (`One life, cataloged.`) | Source Sans 3 500 | 24px caps tracked 0.28em | Metadata register. The voice of the chart. |
| Data labels (city names, year ticks) | Source Sans 3 500 | 16–20px | Marginalia. The index to the subject. |
| Wordmark primary (`morperhaus`) | Playfair Display 500 | 88px lowercase | Publication mark. |
| Wordmark subtitle (`Concerts`) | Source Sans 3 600 | 26px caps tracked 0.34em | Subtitle of the publication. |

The gap between 260px and 16px is deliberate. Editorial design works in extreme contrasts of weight — the reader's eye should always know what is "subject" and what is "margin."

### Color

The site's palette. No additions.

| Token | Hex | Role in video |
|---|---|---|
| Deep Navy Purple | `#1e1b4b` | Phase 1–3 background (radial gradient start) |
| Rich Purple | `#581c87` | Phase 1–3 background (radial gradient end) |
| Charcoal | `#0a0a0a` | Phase 4+ background (post-map-reveal) |
| Ivory | `#fafaf9` | Dim archive dots, body type on dark |
| Indigo | `#6366f1` | Primary nodes (hero dots) |
| Violet | `#c084fc` | **Accent with one meaning: "this is Social D."** Used on the 8 threaded dots, the polyline, the `×2` stamp, the 9:30 Club pulse. One color, one meaning, one story thread. |

**The background morphs from purple radial to charcoal at the map reveal.** The shift from imagined constellation to real geography is the color's job to carry. Purple = memory. Charcoal = map.

### Composition grid (invisible)

- **Edge margins:** 80px
- **Safe zones:** top 220px, bottom 450px (platform UI) — nothing critical ever touches these
- **8-column grid:** 112px columns + 16px gutters across 1080px width
- **Baseline rhythm:** 12px (all type sits on 12px multiples)
- **Optical alignment overrides mathematical center** for Playfair display — serifs always need a few pixels of upward compensation

### The persistent ribbon (signature)

A **3px-tall** strip at **y = 1680**. Contains the full archive (182 concerts across 41 years) as a continuous dot trail. Eight of those dots glow violet from frame 1 onward and stay lit the entire 20 seconds. A single year-ticks row runs beneath it at 1984 · 1994 · 2004 · 2014 · 2024.

The ribbon is:
- **Diegetic:** it's the site's Timeline scene at 1/10 scale
- **Structural:** every beat's timing is indexed against the ribbon cursor's position
- **Narrative:** it provides context (how many shows, across what span) that the viewer otherwise has to infer
- **The signature:** it replaces the Node Scaffold Mike correctly called stupid. The ribbon is not decorative — it is the index of the piece.

**Why this works as a signature:** the Timeline scene is the first thing anyone encounters on the site. Mike describes it in the inspiration readme as "the 40-plus years of concert going in a very crisp, easy-to-understand visual." The ribbon is exactly that, at video scale. A viewer who has been to the site recognizes it instantly. A viewer who hasn't reads it as a narrative device and understands it intuitively by beat 2.

### Density strategy

Density is built in **layers**, not scattered elements. Each layer has a single job:

- **L0** — background field (purple radial / charcoal)
- **L1** — the ribbon (always on, never hero)
- **L2** — the subject (dots, photos, polyline, grid — changes per beat)
- **L3** — the type (headlines + labels that interpret L2)
- **L4** — the signature moment (the ribbon emphasizes or the map fills in)

"Dense" ≠ "cluttered" because every element belongs to exactly one layer with a known job.

### Pacing

- **No number-as-subject lingers more than 1.0s.** The "1990." that sat for 2.5 seconds in the draft is the anti-pattern — the viewer's eye gets bored fast.
- **Display type lands for 0.8s before the next move.** That's the stillness that earns the density.
- **Motion density grows through the piece.** Phase 1 (archive assembling) has the most motion; phase 4 (map holding) has the least; phase 6 (evidence grid) reintroduces motion as simultaneous reveals.

---

## References (specific)

These are the works whose decisions we're inheriting. Not "inspiration" — specific formal choices.

| Reference | What we take |
|---|---|
| **Peter Saville, *Substance 1987* sleeve** | Classical type over photographic imagery · the crease through the composition · numeral as cover subject |
| **Peter Saville, *Unknown Pleasures*** | Data *as* subject, unlabeled · trust the viewer |
| **NYT Upshot "needle" election maps** | Geographic shape as narrative device · the reveal that a line *means* something |
| **NYT Magazine "What the World Eats" (2013)** | Dense grid of cultural artifacts at the climax · editorial restraint of the matte backdrop |
| **Pentagram, *Mohawk Paper* brand book** | Source Sans at metadata scale · Bodoni at display · the gap between them as hierarchy |
| **Factory Records catalog cards (FAC series)** | Voice of a numbered archive · periods as punctuation · lowercase as confidence |
| **AAA TripTik routing strips (1980s)** | The persistent bottom ribbon, literally · sequential progression across geography |
| **Criterion Collection video opens** | Editorial restraint in 15-second forms · type has time to breathe |

---

## Signature move

**The ribbon plus the color-and-geography reveal.** In combination: the ribbon tells you this is one life catalogued; the color-shift + polyline tells you one thread of that life has a physical shape. The two moves braid — the ribbon is always there while the geography reveals.

If the composition is scrubbed on the site later, the ribbon alone reads as "Morperhaus." The map + polyline alone reads as "Geography." Together, they're the pilot's thesis made visual.

---

## What this kills from the draft

- ❌ Node Scaffold in corner (stupid — Mike)
- ❌ "1990." as a persistent 2.5s hero
- ❌ Map + polyline as the climax (it's the *midpoint* reveal)
- ❌ Solo quote on a dark field as the outro
- ❌ The constellation floating above with no context for scale
- ❌ A wordmark-only resolution with nothing to read

---

## What "done" looks like

The final MP4 must:

1. **Use 35+ distinct visual elements** from the archive (Phase 1 used 2; our draft used ~22; v2 targets 40).
2. **Teach the viewer something prose doesn't:** the geographic loop. No prose can convey a shape.
3. **Feel like an extension of the site** — specifically the Timeline, Geography, and Artists scenes — for a repeat viewer.
4. **Survive the paused-frame test** — any frame at any second should read as *Morperhaus*, not generic video.
5. **Make a first-time viewer want to click through** to the site to see what else is catalogued.

Frames 1, 3, 5, and 6 are the four that must hold up paused.

---

## Storyboard

Eight hero frames, 1080×1920. Each is built as static HTML and rendered to PNG. Stage direction for animation lives in the annotations.

See `p3-v2-storyboard.html` for the visual storyboard + stage direction + design notes.

Frame index:

| # | Time | Beat | Hero element |
|---|---|---|---|
| 1 | 0.0–2.5s | Archive | 182 dots + `182 concerts. 41 years.` |
| 2 | 2.5–5.0s | Thread | 8 violet dots + `Eight of them, one band.` |
| 3 | 5.0–9.0s | Venues | 7 venue photos as dots (constellation, purple field) |
| 4 | 9.0–11.0s | Doubled | 9:30 Club pulse + `×2` stamp + ribbon emphasis |
| 5 | 11.0–14.5s | Geography | Charcoal field + map ticks + polyline + `Away. And back.` |
| 6 | 14.5–18.5s | Evidence | 3-column grid: venue photos + album + dates + pull quote (climax) |
| 7 | 18.5–20.0s | Outro | Wordmark + CTA, ribbon still lit |
