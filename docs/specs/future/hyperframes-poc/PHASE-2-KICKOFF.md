# Phase 2 Kickoff Brief — Read First

**Written:** 2026-04-19 (end of Phase 1 session, before hand-off)
**For:** The fresh Claude Code session starting Phase 2
**Branch:** `pilot/hyperframes-poc` (already checked out on this repo)
**Epic:** [#89](https://github.com/mmorper/concerts/issues/89)

---

## The Only Thing That Matters

Mike reviewed the Phase 1 mechanical render and said it "feels like Hello World." He's right. Phase 2 exists to answer one question:

**Does the video supplement the liner note or just recap it?**

Phase 1 recapped. Phase 2 must supplement.

**Supplement = show the viewer things the prose can't.** Setlist fragments. Venue photos across decades. The 14 openers from a 2018 festival bill. An album cover stack that tells a career. Day-of-week rhythm. Geographic arc. The prose says "8 shows across 34 years." The video must earn its existence by showing what those 8 shows *looked like* and what sat around them.

**Recap = restate the prose in motion.** "1990." on black. "34 years. 8 shows." A timeline. A pull quote. An album card. That's what Phase 1 produced. Do not repeat it.

---

## What Phase 1 Actually Produced (and why most of it is still useful)

- ✅ Workspace + Hyperframes pipeline, lint/render working
- ✅ Payload builder from concerts.json — good reusable pattern
- ✅ Capability doc — accurate. Trust the render-time observations.
- ⚠️ Visual language guide — right instincts on palette/type/anti-patterns, but too minimal. The "restraint" framing needs a second half: disciplined density.
- ⚠️ Signature element candidates — Mike leans **Candidate C (Node Scaffold)** but **conditionally** on the overall design improving significantly. **Drop Candidate B (Contact-Sheet Stamp).** Catalog-number framing confused more than it helped.
- ❌ Mechanical render (`video/index.html` + `output/pilot-mechanical.mp4`) — rendering works; the composition does not. Treat as a baseline to surpass, not a starting point to iterate from.
- ✅ Morning handoff note — still accurate for the Phase 1 side.

---

## Mike's Decisions (locked)

1. **Keep Playfair Display + Source Sans 3.** Ignore Hyperframes' advisory ban. Brand lineage wins.
2. **Signature element:** leaning C (Node Scaffold), **do not lock until the composition itself is strong enough to reward attention.** If the composition is great, C wins. If the composition still feels thin, revisit.
3. **Wordmark:** current Proposal 1 (Editorial Masthead) is fine for now. Not a priority.
4. **Drop Signature Candidate B** (Contact-Sheet Stamp / catalog number). Remove from future consideration.
5. **Use MORE imagery.** Far more. "Two images in a 20-second video" was the sharpest critique. See archive inventory below.
6. **Data source for liner notes going forward:** `public/data/liner-notes.json` (or `dist/data/liner-notes.json`). The XML was a planning-time workaround. Don't reach for it again.

---

## The Phase 1 Failure Mode — Don't Repeat It

Three specific mistakes. If you do any of these, you're making Phase 1's render again.

1. **Treating the beat sheet as prescriptive.** The pilot spec's own Phase 1 note says the beats are "one hypothesis," not "the answer." Phase 2 may keep them, revise, or discard entirely. **Default: revise them significantly** — Phase 1 already rendered the beat-sheet-as-written and Mike said it's Hello World.
2. **Implementing without designing.** The spec calls for "collaborative design between the lead designer and a Hyperframes specialist." Phase 1 conflated both roles in one head and produced safe output. **Phase 2 must spawn a design subagent first.** See "Execution Approach" below.
3. **Reading minimalism as the aesthetic.** Saville/Swiss is *disciplined density*. Substance 1987 has the coral/peony imagery on the cover — it's not blank. The inspiration readme uses the words "visually overwhelming," "splayed deck of cards," "dense and most interesting." Phase 2 should feel closer to those references than to a Kinfolk magazine cover.

---

## Archive Inventory — What's Actually Available

Use this. Don't use 2 images when you have 30+.

### Artist imagery for the 2018 Huntington State Beach bill (15 acts)

| Artist | Image available |
|---|---|
| Social Distortion | ✓ `artists-metadata.json`.`Social Distortion`.image |
| Bad Religion | ✓ |
| The Offspring | ✓ |
| Pennywise | ✓ |
| Suicidal Tendencies | ✓ |
| Voodoo Glow Skulls | ✓ |
| T.S.O.L. | ✓ |
| Black Rebel Motorcycle Club | ✓ |
| Snuff | ✓ |
| Fear | ✓ |
| Mad Caddies | ✓ |
| Rancid | ✓ |
| Aaron Lee Tasjan | ✓ |
| The Interrupters | ✓ |
| Wrecks | ✗ (only missing one) |

That's **14 artist portraits** available for a single data point. One of them. Use them.

### Venue photos (Google Places) — 7 unique venues across the 8 shows

Stored at `public/data/venues-metadata.json`.`<normalizedName>`.`photoUrls`:

- `thumbnail` (4800×400-wide aspect)
- `medium` (4800×800)
- `large` (4800×1600)

All 7 SD venues have photos cached:

- Cal State Fullerton (Fullerton, CA) — 1990
- Hard Rock Hotel Las Vegas (Las Vegas, NV) — 2005
- 9:30 Club (Washington, DC) — 2010 + 2012 (same venue twice!)
- The Fillmore Silver Spring (Silver Spring, MD) — 2015
- Huntington State Beach (Huntington Beach, CA) — 2018
- House of Blues Anaheim (Anaheim, CA) — 2022
- The Belasco (Los Angeles, CA) — 2024

### Album art (iTunes top-tracks for Social Distortion)

`public/data/artists-top-tracks.json`.`social-distortion`.tracks[]:

- *Ball and Chain* (Social Distortion, 1990)
- *Born to Kill* (Born to Kill album)
- *Story of My Life* (Social Distortion, 1990) — same album as Ball and Chain
- *Ring of Fire* (Social Distortion, 1990) — same album
- *I Was Wrong* (White Light White Heat White Trash)

Two distinct albums with artwork. URL pattern `100x100bb.jpg` → swap to `1000x1000bb.jpg` for print-quality. Max this album returns is 600×600.

### Discography (Social Distortion)

`public/data/discography.json`.`social-distortion`.albums — **39 entries**. No artwork fields populated in this file; artwork would need to come from iTunes search or MusicBrainz (consider for Phase 2 if more album spines are desired).

### Setlists

`public/data/setlists-cache.json` — **no SD setlists cached**. Don't reach for setlists; they'd need live API calls from setlist.fm.

### Per-show metadata (concerts.json)

For each of the 8 Social D shows, available fields:
- `date` (YYYY-MM-DD)
- `year`, `month`, `day`, `dayOfWeek`, `decade`
- `venue`, `venueNormalized`, `city`, `state`, `cityState`
- `headliner` (Social Distortion), `openers` (array — varies 0–14)
- `genre` (Punk), `genreNormalized`
- `location.lat`, `location.lng`
- `reference` (concertarchives.org URL)

### Day-of-week pattern (mostly weeknights, one weekend)

1990-09-13 Thursday · 2005-03-23 Wednesday · 2010-10-26 Tuesday · 2012-11-06 Tuesday · 2015-08-25 Tuesday · 2018-10-28 Sunday · 2022-12-08 Thursday · 2024-12-05 Thursday

Five Tuesdays/Wednesdays/Thursdays, two Thursdays sandwiching the arc (first 1990, last 2024), one Sunday (the festival). That's a story.

### Geographic arc (two coasts)

California → Nevada → DC/MD (3 shows) → California (3 shows). A literal "went away, came home" shape on a US map.

---

## Phase 2 Execution Approach

### Step 1: Design subagent — real design, no Hyperframes

Spawn via `Agent` tool with `subagent_type: "general-purpose"`. Brief:

```
You are a short-form video designer. I have a 20-second 9:16 pilot that
the creator called "Hello World" — too minimal, too literal. Your job:
propose THREE distinct composition approaches that each lean into a
different Morperhaus interaction signature (splayed-deck, gatefold,
venue-constellation). No Hyperframes constraints yet — pure design.

For each approach:
- What story is being told (supplement, not recap)
- Which 15+ archive elements it uses (artist images, venue photos,
  album art, metadata) and where
- How it respects the Saville/Substance lineage AS DISCIPLINED
  DENSITY (not minimalism)
- 3-5 key frames with what's on screen at each

Constraints:
- Playfair Display + Source Sans 3 only
- Existing palette only (deep navy→purple gradient signature)
- 1080×1920, 20 seconds
- Must include the Meridian-Rule OR Node-Scaffold candidate as a
  signature placeholder (not both)
- Must feel like an extension of the site's interaction patterns

Brief attached:
- docs/specs/future/hyperframes-poc/morperhaus-video-pilot.md (spec)
- docs/specs/future/hyperframes-poc/morperhaus-video-visual-language.md
- docs/inspiration/hyperframes-poc/readme.md (Mike's voice)
- docs/specs/future/hyperframes-poc/PHASE-2-KICKOFF.md (this doc)
- public/data/concerts.json, artists-metadata.json, artists-top-tracks.json,
  venues-metadata.json, discography.json

Return: 3 written proposals. DO NOT write HTML.
```

### Step 2: Hyperframes-feasibility pass

For each design proposal, assess:
- Can Hyperframes render this at 1080×1920?
- What's the memory budget for the image count?
- Where do we compromise (asset count, animation density)?

Use the capability doc as the reference. If a proposal requires 30+ images cross-fading simultaneously, it may bust memory — flag and compromise.

### Step 3: Present to Mike

Three design directions + feasibility notes. One paragraph of composition text each, 3–5 frame sketches each. Ask Mike to pick one. Not a committee process — one decision.

### Step 4: Implement the picked direction

Rebuild `video/index.html` against the picked direction. Do NOT incrementally patch the Phase 1 composition. Start from the design, not the code.

### Step 5: Render, extract frames, iterate

Per-pass questions (from the spec):
- Does this look like Morperhaus?
- Does the signature hold in motion?
- Does the composition invite curiosity without begging?

When a pass answers the question yes, move on. No polish creep.

### Step 6: Signature element final pick

With a strong composition in hand, ask Mike: does C still feel right, or does A suit the composition better? Lock the signature.

### Step 7: Storyboards for Templates A, B, D

Only after the pilot composition is strong. Three key frames per template, rendered from the same composition source (parametric payload swap should be the goal).

### Step 8: Pilot review

Green/yellow/red, recorded on epic #89 + spec revision history.

---

## The Non-Negotiables (What "Done" Looks Like)

The final pilot MP4 must:

1. **Use 20+ distinct visual elements** from the archive (images or metadata-derived visuals). Phase 1 used 2. The floor is ten times that.
2. **Tell the viewer something the prose doesn't.** At least one moment of "oh — I didn't know that from reading."
3. **Feel like an extension of the site, not a recap.** A viewer who's been to Morperhaus should feel familiar patterns. A viewer who hasn't should be intrigued enough to click.
4. **Survive the paused-frame test** — any single frame should read as Morperhaus.
5. **Pass all 7 green-light criteria** in the spec.

---

## Commands to Get Started

```bash
# Confirm you're on the pilot branch
cd /Users/mmorper/projects/concerts
git status
git log --oneline pilot/hyperframes-poc | head -10

# Read Phase 1 outputs in this order
cat docs/specs/future/hyperframes-poc/PHASE-2-KICKOFF.md  # this file
cat docs/specs/future/hyperframes-poc/morperhaus-video-pilot.md  # full spec
cat docs/specs/future/hyperframes-poc/MORNING-HANDOFF.md  # Phase 1 summary
cat docs/specs/future/hyperframes-poc/hyperframes-capabilities.md  # what the framework does

# See the Phase 1 render (the "before")
open video/compositions/social-distortion-34-years/output/pilot-mechanical.mp4
# If the MP4 is missing (gitignored), re-render:
cd video
npx hyperframes render --output compositions/social-distortion-34-years/output/pilot-mechanical.mp4 --quality draft

# Check the open Phase 2 issues
gh issue list --label phase-2

# Start Step 1 (design subagent) — brief above
```

---

## One Final Note

Mike said his design guidance "was not considered whatsoever." The inspiration readme — the one at `docs/inspiration/hyperframes-poc/readme.md` with his voice on each scene's wow moment — is the authoritative source for what makes a Morperhaus thing feel like a Morperhaus thing. **Read it first. Read it slowly. Then design.** The GIFs in that folder show interactions Phase 2 should echo in motion. The readme's vocabulary — "splayed deck," "gatefold," "visually overwhelming," "scrub control" — is the vocabulary to design in.

The site's own Artist scene was Mike's pick for "the most dense and most interesting." If the final pilot render feels as dense and interesting as that scene, we're green. If it feels like Phase 1, we're red.
