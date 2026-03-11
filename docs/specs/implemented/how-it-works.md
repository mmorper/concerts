# How It Works

**Status:** Implemented
**Formerly known as:** Cascade
**Route:** `/how-it-works` (or scene entry — see DEEP_LINKING.md)
**Replaces:** `docs/specs/future/cascade/cascade-interactive-hydration-spec.md`

---

## Concept

"How It Works" is an interactive, animated explanation of how the Morperhaus Concert Archives transforms three raw data points — an artist name, a venue name, and a concert date — into a richly enriched, interconnected archive through a multi-API data pipeline.

The page is not a navigation shortcut or a filter tool. It is a performance. The user watches the enrichment happen, tier by tier, in real time — choosing which concert's story to tell, then watching the cascade pour downward until the full archive record is assembled.

---

## Page Title & Header

**H1:** "The Data Enrichment Cascade"
**Subhead:** "How three words in a spreadsheet become a living archive of four decades of live music"
**Supertitle (mono, uppercase):** "Morperhaus Concert Archives"

---

## Auto-Demo on Load

When data loads, the page automatically pre-selects **Sting** as a featured demo — filling the artist field and resolving the artist's venues and concert — so users arrive to a live preview of the cascade ready to run. The cascade animation itself does not auto-start; the user must initiate it.

---

## Tier Structure

Seven tiers flow top to bottom (T0–T6). Each tier has a distinct title, subtitle, color palette, and visual signature.

```
T0  Seeds          [Artist]      [Venue]         [Date]
T1  Structural     [derive]      [normalize]     [parse]
T2  Geographic     ───────── [Google Places] ─────────
T3  Artist Identity ──── [TheAudioDB · Last.fm · MusicBrainz] ────
T4  Audio          ─────────── [Apple Music] ────────────
T5  Performance    ─── [setlist.fm · Ticketmaster] ─────────
T6  The Living Archive   [4 scene cards]
```

| Tier | Label | Title | Color |
|------|-------|-------|-------|
| T0 | — | Seeds (input row) | Slate `#64748b` |
| T1 | Tier 1 · Structural Enrichment | The Build Pipeline | Slate `#64748b` |
| T2 | Tier 2 · Geographic Enrichment | Every Venue, Precisely Placed | Indigo `#6366f1` |
| T3 | Tier 3 · Artist Enrichment | A Face and a Story | Violet `#8b5cf6` |
| T4 | Tier 4 · Audio Enrichment | Hear Every Artist | Purple `#a855f7` |
| T5 | Tier 5 · Performance Enrichment | Song by Song, Night by Night | Fuchsia `#c084fc` |
| T6 | Tier 6 · The Living Archive | Four Scenes. 42 Years. | Deep violet `#7c3aed` |

---

## T0 — Seeds (Input Row)

Three side-by-side columns: Artist, Venue, Date.

### Artist Column — Typeahead Input

- On idle: a styled input box with label "artist" in monospace uppercase.
- Click to activate editing mode. A ghost-text typeahead completes the artist name as you type.
- Ghost completion appears in a muted purple (`#3d2a5c`) overlaid on the typed characters.
- Confirm with Tab, ArrowRight, or Enter. Escape cancels.
- On selection: input transforms into a locked `CascadeAtom` chip showing the chosen artist name with violet glow.
- Once an artist is selected and the cascade is running, the typeahead is replaced by the locked atom.

### Venue Column — Dropdown Picker

- Appears as a "select venue…" placeholder while waiting.
- If the artist has only one venue: auto-resolves (no interaction required).
- If multiple venues: a styled dropdown appears listing only venues where that artist played, alphabetical order.
- On selection: locks in as a `CascadeAtom` chip with indigo styling.

### Date Column — Button List

- Appears as "awaiting…" placeholder while waiting for artist and venue.
- If artist × venue maps to one concert: auto-resolves (no interaction required).
- If multiple concerts: a list of dates appears as clickable buttons.
- On selection: locks in as a `CascadeAtom` chip with slate styling.

### Cascade Pending Interstitial

When the user has manually selected an artist (not using the auto-demo), after all three seeds resolve, a full-width interstitial block appears **before** the cascade begins:

> **"Watch what happens next."**
> "Artist, venue, date — the raw ingredients. The cascade will normalize them, then call seven APIs across six tiers to build everything you see on concerts.morperhaus.org."
> `[ Start the cascade → ]`

The user must click this button to begin the animation.

---

## Interaction Flow

### Phase 1 — Artist Selection

User types or selects an artist. Venue and date show "awaiting…" pending atoms. If artist has one venue, venue auto-resolves immediately and date resolution begins.

### Phase 2 — Venue Selection

Venue column activates after artist is selected. If one venue: auto-selected. If multiple: venue picker appears. User selects or auto-resolves.

### Phase 3 — Date Resolution

Date column activates after venue resolves. If one concert: auto-selected. If multiple: date list appears. User selects or auto-resolves.

### Phase 4 — Cascade Pending (manual path only)

After all three seeds are locked, the interstitial "Watch what happens next" block appears. User clicks "Start the cascade →" to begin animation.

### Phase 5 — The Cascade Runs (T1–T5)

Animated connectors and tier reveals cascade downward tier by tier, with user-controlled pacing via "continue ↓" buttons at the end of each tier.

### Phase 6 — T6 Reveals (Scene Cards)

After T5 completes, the four archive scene cards unlock with a staggered animation.

### Phase 7 — Scene Focus (Bidirectional Dimming)

User can click any scene card to highlight the tiers that feed it. All other tiers dim to ~12% opacity with a grayscale filter. A floating "Show All" pill appears to reset.

---

## Animated Connector Lines

Between each tier, an `AnimatedConnector` SVG element grows downward over 800ms, colored to match the destination tier's accent color. The connector only appears when the previous tier's animation has completed and the next tier is ready to reveal.

---

## Tier Animation Sequence

Once the cascade starts, each tier follows this pattern:

1. **Connector** — animated SVG line grows from previous tier (800ms)
2. **Tier reveal** — tier fades in with upward slide (`y: 6 → 0`, opacity: 0→1, 550ms)
3. **Loading badge** — API favicon pulses while "loading" (400ms pause)
4. **Content reveals** — photos, pills, track lists, setlist lines animate in sequentially
5. **Field counter** — slot-machine style counter increments to final field count
6. **Post-build glow** — seed atoms and the tier box glow in sequence, then fade (3 seconds total)
7. **Continue button** — "continue ↓" button appears; user clicks to proceed to next tier
8. **Tier collapse** — completed tier collapses to a `TierSummaryCard` (compact summary bar) and the next connector begins

This means the user controls the pacing: each tier waits for a click before the cascade advances.

---

## Per-Tier Detail

### T1 — The Build Pipeline (Structural Enrichment)

**Visual signature:** Code aesthetic — `<CodeTransform>` components with `fn="derive(artist)"` style labels. Dashed/code border style. No external API.

**Layout:** 3-column grid — Artist | Venue | Date, revealed left to right with 350ms stagger.

**Content per column:**
- **Artist:** `derive(artist)` → pills: `headlinerNormalized`, `concertId`, `openers`
- **Venue:** `normalize(venue)` → pills: `venueNormalized`, `city`, `state`, `cityState`
- **Date:** `parse(date)` → pills: `year`, `month`, `day`, `dayOfWeek`, `decade`

**Pills show real data** for the selected concert.

**Footer counter:** Slot-machine counting up to **19 fields per concert**

**Collapsed state:** "Tier 1 · Structural Enrichment | `</>` | 19 fields derived"

---

### T2 — Every Venue, Precisely Placed (Geographic Enrichment)

**Visual signature:** Centered card showing the Google Places API badge, then a venue photo thumbnail fading in.

**Content:**
- Google Places API badge (pulsing during load)
- Venue photo at full card width (56px tall, object-fit cover) — or 📍 emoji if no photo
- Coordinate pill: `37.9750° N · 122.5275° W` format
- Data pills: `formattedAddress`, `placeId`, `confirmedName`, `city`, `website`, `photos`

**Footer counter:** Slot-machine counting up to **28 fields returned**

**Collapsed state:** "Tier 2 · Geographic Enrichment | [google.com favicon] | [venue name]"

---

### T3 — A Face and a Story (Artist Enrichment)

**Visual signature:** Centered card with three API badges, circular artist photo (or initials avatar), genre chips, and bio.

**Content:**
- Three API badges: TheAudioDB, Last.fm, MusicBrainz (all pulsing during load)
- Artist photo (60×60 circular) — or initials avatar (`JE` style) if no photo
- Genre chips (up to 4, monospace pill style)
- Formation year: `Formed 1976`
- Bio preview (2-line truncated, 200 char max)
- Data pills: `image`, `formed`, `country`, `style`, `genres`, `listeners`, `mbid`

**Footer counter:** Slot-machine counting up to **43 fields returned**

**Collapsed state:** "Tier 3 · Artist Enrichment | [theaudiodb, last.fm, musicbrainz favicons] | [artist name]"

---

### T4 — Hear Every Artist (Audio Enrichment)

**Visual signature:** Centered card with Apple Music badge, album art, and a numbered track list.

**Content:**
- Apple Music badge (pulsing during load)
- Album art thumbnail (48×48) + album name label — or 🎵 emoji if no art
- Numbered track list (up to 5 tracks, monospace format: `01  Personal Jesus`)
- "no audio data" fallback if no tracks available

**Footer counter:** Slot-machine counting up to **N tracks indexed** (actual track count)

**Collapsed state:** "Tier 4 · Audio Enrichment | [music.apple.com favicon] | N tracks"

---

### T5 — Song by Song, Night by Night (Performance Enrichment)

**Visual signature:** Full-width single column. Two service gateways side by side (setlist.fm + Ticketmaster), then a two-column numbered setlist.

**Layout:** `FlowArrow "query"` → dual service gateways → `FlowArrow "response"` → two-column pill grid → numbered setlist.

**Content:**
- **setlist.fm pills:** `tourName`, `songs` (count), `setStructure` (Set 1 + Encore), `setBreaks`
- **Ticketmaster pills:** `opener`, `tour`, `eventId`, `eventUrl`
- **Setlist:** Songs revealed line by line (80ms stagger), two-column grid, numbered monospace format

**Footer counter:** Slot-machine counting to actual data point count from setlist entry

**Collapsed state:** "Tier 5 · Performance Enrichment | [setlist.fm, ticketmaster favicons] | N songs"

---

### T6 — The Living Archive (Output)

Four scene cards in a 2×2 grid, stagger-revealed as the cascade completes (80ms apart).

| Scene Card | Name | Subtitle | Feeds From |
|------------|------|----------|-----------|
| Concert Archive | Concert Archive | `N shows across Y years` | T1 (Structural) |
| The Geography | The Geography | `N cities across the map` | T2 (Geographic) |
| The Artists | The Artists | `N artists · N concerts` | T1, T3, T4, T5 |
| The Venues | The Venues | `10 most-visited venues` | T1, T2 |

Each card includes:
- Scene name and subtitle (drawn from real corpus stats)
- Inline SVG icon — a miniature visual of the scene (timeline axis, dark map with venue markers, artist card grid, venue-artist network graph)
- Tier chips showing which tiers feed that scene (e.g., `T1`, `T3`, `T4`, `T5`)
- Click to activate scene focus / dimming

**Footer prompt (after all 4 unlock):** `↑ select a scene to trace its data`

---

## Tier Collapse / Expand

Once a user clicks "continue ↓" on a tier:
1. The tier animates out (`scaleY 1 → 0.88`, opacity fade, 380ms)
2. It is replaced by a compact `TierSummaryCard` — a single-row bar showing:
   - Tier label (monospace)
   - Optional code icon (`</>`) for T1
   - API favicons for T2–T5
   - A summary pill (field count, venue name, artist name, or track count)
   - `↕` expand toggle

Clicking a summary card re-expands the full tier (via `toggleExpand`), toggling it back to the full view.

---

## Post-Build Glow

After each tier's content finishes animating, a sequential glow effect plays:

1. Relevant seed atoms (artist, venue, date) glow in sequence — violet glow pulse on the T0 atom chips
2. The tier box receives a matching `box-shadow` glow
3. Both hold for 3 seconds, then fade

| Tier | Seeds that glow |
|------|----------------|
| T1 | artist → artist+venue → artist+venue+date |
| T2 | venue |
| T3 | artist |
| T4 | artist |
| T5 | artist + venue |
| T6 | artist + venue + date |

---

## Floating Top Bar

Once the cascade is complete (`flowPhase === 'complete'`), a persistent frosted-glass bar slides down from the top of the viewport:

```
[artist name] · [venue name] · [date]                  [↺ Try another]
```

- Backdrop blur (12px), 85% opacity dark background, purple bottom border
- "↺ Try another" button resets everything and returns to idle

---

## Footer Stats

After completion, the footer reveals:

```
3         →       [N]       =       [M]×
inputs            data points       enrichment
```

Where:
- **3 inputs** = the three seed values
- **data points** = sum of all tier field counts (t1 + t2 + t3 + t4 + t5)
- **enrichment** = `Math.round(dataPoints / 3)`

Below that: a horizontal row of all 7 API logos (favicon + name pills): Google Places, TheAudioDB, Last.fm, MusicBrainz, Apple Music, setlist.fm, Ticketmaster.

CTA: `↺ Try another` (resets and returns to idle)

---

## Scene Focus System (Bidirectional Dimming)

Clicking any scene card or any T0 atom activates the focus system:

- All tiers **not relevant** to the selected scene/atom dim to 12% opacity + grayscale(0.5) filter
- The relevant tiers remain at full opacity
- A floating "Show All" pill appears fixed at the bottom center of the viewport
- Clicking "Show All" (or clicking the active scene again) resets all tiers to full opacity

Scene → tier relevance map:

| Scene | Active tiers |
|-------|-------------|
| Concert Archive | T1 (dates, decade, dayOfWeek) |
| The Geography | T2 (lat/lng, address, photos) |
| The Artists | T1, T3, T4, T5 |
| The Venues | T1, T2 |

---

## Reset Behavior

"↺ Try another" or any new artist selection:
- Immediately clears all state (no animation out)
- All tiers below T0 disappear instantly
- T0 returns to idle with the typeahead input
- All selections, pills, setlist, glow state, collapsed state cleared
- Generation counter increments (cancels any in-flight animation)

---

## Data Sources (All Static — No Live API Calls)

| Data | Source file |
|------|-------------|
| Artist list, concert lookup | `public/data/concerts.json` |
| Artist photo, bio, genres | `public/data/artists-metadata.json` |
| Venue lat/lng, address, photos | `public/data/venues-metadata.json` |
| Top tracks, album art | `public/data/artists-top-tracks.json` |
| Setlists, tour names | `public/data/setlists-cache.json` |

The artist → venue → date graph is derived at runtime from `concerts.json`. No build step required.

---

## Corpus Stats (Derived at Runtime)

| Stat | Derived from |
|------|-------------|
| Total shows | `concerts.length` |
| Year span | `max(year) - min(year) + 1` |
| Unique artists | All headliners + openers (deduplicated) |
| Unique cities | Unique `concert.city` values |

These power the T6 scene card subtitles.

---

## Key Files

| Purpose | Path |
|---------|------|
| Main page component | `src/components/cascade/CascadePage.tsx` |
| API engine sub-components | `src/components/cascade/CascadeApiEngine.tsx` |
| SVG background lanes | `src/components/cascade/CascadeLanes.tsx` |
| Animated SVG connector | `src/components/cascade/AnimatedConnector.tsx` |
| Atom chips (T0 locked state) | `src/components/cascade/CascadeAtom.tsx` |
| Scene focus / dimming hook | `src/components/cascade/useCascadeFocus.ts` |
| Legacy spec (reference only) | `docs/specs/future/cascade/cascade-interactive-hydration-spec.md` |

---

## What Changed from the Original Spec

The original spec (`cascade-interactive-hydration-spec.md`) described the intended design. The implemented page diverged in several significant ways:

| Spec | Implementation |
|------|---------------|
| Tiers always in DOM, gated by opacity | Tiers not rendered until connector arrives (`tiersVisible` Set) |
| No collapse behavior | Tiers collapse to compact summary cards after user clicks "continue" |
| No user-paced continue buttons | Each tier waits for user click before cascade advances |
| No pre-cascade interstitial | "Watch what happens next" block shown before cascade starts (manual path) |
| No post-build glow | Seeds and tier box glow in sequence after each tier completes |
| Static corpus scale numbers | Runtime-derived from actual loaded data |
| T6 scenes: Timeline / Map / Artists / Network | T6 scenes: Concert Archive / The Geography / The Artists / The Venues |
| No floating top bar | Persistent frosted bar shows selected concert after completion |
| No footer enrichment stats | Footer shows 3 inputs → N data points = M× enrichment equation |
| Sting auto-selected | Featured demo preloads Sting on mount |

---

## Revision History

- **Original spec:** 2026-03-10 (`cascade-interactive-hydration-spec.md`)
- **This spec:** 2026-03-10 — Updated to reflect implemented state, renamed "How It Works"
