# Cascade — Interactive Hydration Visualization

**Status:** Planned
**Replaces:** `_legacy-data-enrichment-cascade-spec.md`
**Route:** `/how-it-works`
**Complexity:** Very High

---

## Concept

The cascade page tells the story of how three raw data points — an artist name, a venue name, and a concert date — transform into 23,000+ interconnected data fields through a multi-API enrichment pipeline.

The core metaphor is **sand through an hourglass**: the user selects seeds one at a time, and watches the enrichment pour downward tier by tier until the full concert record is hydrated. The page is not a filter tool or a navigation shortcut — it is an explanation device and a "wow" moment. The point is watching the cascade happen.

---

## Column Layout

Three vertical columns, left to right:

| Position | Atom | Color | Rationale |
|----------|------|-------|-----------|
| Left | **Artist** | Violet `#8b5cf6` | Entry point — people think "I saw [artist] at..." |
| Center | **Venue** | Indigo `#6366f1` | Second filter — narrows by location |
| Right | **Date** | Slate `#64748b` | Last resort — often auto-resolves |

Artist is positioned left because it is the most familiar and interesting seed. Most users will start by imagining an artist. Venue narrows the selection. Date is the least interesting and often unambiguous.

---

## Tier Structure

Seven tiers flow top to bottom. Each tier row spans all three columns. Active columns fill their band; dormant columns render as a thin thread (2px vertical line, 30% opacity) to maintain visual continuity without claiming attention.

```
T0  Seeds            [Artist]      [Venue]      [Date]
T1  Build Pipeline   [active]      [active]     [active]   ← all three, local parse only
T2  Geographic       [dormant]     [ACTIVE]     [dormant]  ← venue explodes
T3  Artist Identity  [ACTIVE]      [dormant]    [dormant]  ← artist explodes
T4  Audio            [ACTIVE]      [dormant]    [dormant]  ← artist continues
T5  Performance      [══════ CONVERGENCE — all three merge ══════]
T6  Scenes           [Timeline]  [Map]  [Artists]  [Network]  ← locked until complete
```

---

## Interaction Model

### Phase 1 — Artist Selection

- An artist picklist appears at the top of the Artist column (T0).
- Populated from `public/data/concerts.json` — all unique headliners, alphabetical.
- On selection, artist seed chip locks in and **the artist column begins hydrating**.

### Phase 2 — Artist Hydration

- Tiers animate in sequentially, top to bottom: T1 → T2 (dormant) → T3 → T4.
- Each tier's content fades/slides in as a unit once the previous tier completes.
- Dormant tiers (T2 venue, T2 date) render as thin threads — they animate quickly through without pause.
- Duration: roughly 2–3 seconds total for artist column hydration.
- During hydration: API favicon pulses subtly, then resolves to static once tier is complete.

### Phase 3 — Venue Selection

- Venue column activates **only after artist column is fully hydrated**.
- If the selected artist has **one venue**: auto-resolves. Venue seed chip locks in, T2 hydrates immediately.
- If the selected artist has **multiple venues**: a filtered venue picklist appears (only venues where that artist played).
- On selection, venue column hydrates: T1 → T2.

### Phase 4 — Date Resolution

- Date column activates only after venue is hydrated.
- If artist × venue maps to **one concert**: auto-resolves. Date chip locks in, T1 hydrates.
- If artist × venue maps to **multiple concerts** (same artist, same venue, different years): a date picklist appears listing only the relevant dates.
- On selection, date column hydrates: T1.

### Phase 5 — Convergence (T5)

- Once all three columns are fully hydrated, T5 activates.
- The three column threads visually converge (CSS animation: columns narrow toward center) before T5 band expands to full width.
- Setlist content populates line by line (each song title fades in sequentially).
- Tour name, opener, and event metadata appear after setlist.

### Phase 6 — Scene Unlock (T6)

- Scene cards are **locked and dimmed** throughout Phases 1–5. Non-interactive, low opacity, visually subordinate.
- After T5 completes: brief pause (400ms), then scene cards **unlock simultaneously** — fade up to full color with a subtle upward drift.
- A label appears below the row: `↑ select a scene to trace its data`
- Scene cards are now interactive.

### Phase 7 — Scene Exploration (Bidirectional Cascade)

- Clicking a scene card **ghosts out all upstream tier bands not relevant to that scene**.
- Relevant bands remain at full opacity; irrelevant bands drop to ~15% opacity.
- Clicking the same scene again resets (all bands return to full opacity).
- Clicking a different scene switches to that scene's relevance map.
- Single-select only — no stacking.

**Scene → Tier relevance map:**

| Scene | Active columns/tiers |
|-------|---------------------|
| Timeline | Date T1 (year, decade, dayOfWeek) |
| Map | Venue T1 (city, state) + Venue T2 (lat, lng, address, photos) |
| Artists | Artist T1 + Artist T3 + Artist T4 + T5 (setlist) |
| Network | Artist T1 + Venue T1 + Venue T2 |

---

## Per-Tier Visual Design

Each tier has a **signature visual element** that gives it a distinct identity — not just a uniform pill grid.

### T0 — Seeds (Input Row)

- Three seed chips, one per column, showing raw values: `Depeche Mode` | `Kia Forum` | `2023-03-28`
- Clean, minimal. Acts as the picklist row in interactive mode.
- Chip style: solid border, atom color, monospace value text.

### T1 — Build Pipeline (Parse / Normalize / Derive)

- **Signature:** `</>` code icon, dashed border. No API favicon. Emphasizes local computation — no network call.
- Fields appear as small monospace pills, cascading in one by one.
- Artist: `headlinerNormalized · concertId · openers`
- Venue: `venueNormalized · city · state · cityState`
- Date: `year · month · day · dayOfWeek · decade`
- Label: "No network — local parse"

### T2 — Geographic (Google Places)

- **Signature:** Venue photo thumbnail (from `photoUrls.thumbnail`) as the visual hero. Photo loads as the tier completes.
- Google Places favicon pulses during hydration, resolves static.
- Fields below photo: coordinate pill (`37.9750° N, 122.5275° W`), formatted address, placeId chip.
- Corpus scale: `× 77 venues` displayed as a dim counter, incrementing to final value during animation.

### T3 — Artist Identity (TheAudioDB · Last.fm · MusicBrainz)

- **Signature:** Artist photo centered and prominent (from `artists-metadata.json → imageUrl`). The portrait *is* the data.
- Three API favicons in a row below the photo.
- Genre chips in a wrap below favicons.
- `Formed: [year] · [country]` in small monospace.
- Listener count formatted: `12.4M listeners`
- Bio preview: 2 lines max, truncated with fade.
- Corpus scale: `× 255 artists`

### T4 — Audio (Apple Music)

- **Signature:** Album art thumbnail + short numbered track list.
- Apple Music favicon.
- Top 3 tracks listed: `01  Personal Jesus  4:15`
- Waveform bars (decorative, static) as background texture.
- Corpus scale: `× 255 artists · 1,275 tracks`

### T5 — Performance Convergence (setlist.fm · Ticketmaster)

- **Signature:** Numbered setlist appearing line by line during animation.
- Full-width band spanning all three columns.
- Header: `[date chip] + [venue chip] + [artist chip] = one specific night`
- Tour name badge, opener pill.
- Setlist: `01  World in My Eyes   02  Policy of Truth   03  ...`
- After setlist: Ticketmaster event URL pill, eventId chip.
- Corpus scale: `× 180 concerts`

### T6 — Scene Foundation (Locked → Unlocked)

**Locked state (during hydration):**
- 4 scene cards at ~20% opacity, grayscale filter, cursor: default.
- No tier-dot badges visible yet.

**Unlock animation (after T5 completes):**
- 400ms pause
- Cards fade from 20% → 100% opacity with `translateY(4px → 0)` over 500ms
- Staggered: Timeline → Map → Artists → Network, 80ms apart
- Label fades in: `↑ select a scene to trace its data`

**Unlocked state:**
- Each card shows name, subtitle, and tier-dot badges indicating which tiers feed it.
- Hover: subtle lift (`translateY(-2px)`), border brightens.
- Active (selected): full border color, upstream relevance highlighting active.

---

## Data Sources (All Static — No Live API Calls)

| Data | Source file |
|------|-------------|
| Artist list, concert lookup | `public/data/concerts.json` |
| Artist photo, bio, genres, mbid | `public/data/artists-metadata.json` |
| Venue lat/lng, address, photos | `public/data/venues-metadata.json` |
| Top tracks, album art, preview URLs | `public/data/artists-top-tracks.json` |
| Setlists | `public/data/setlists/` (cached per concert) |

The artist → venue → date graph is derived at runtime from `concerts.json`. No build step required.

---

## Artist → Venue → Date Graph

Derived from `concerts.json` at component mount:

```ts
// artist normalized name → venues where they played
Map<string, Set<string>>

// (artist, venueNormalized) → concert dates
Map<string, Date[]>
```

Selection logic:
- Artist selected → filter venues for that artist
- If 1 venue → auto-select, proceed
- If N venues → show filtered picklist
- Venue selected → filter dates for (artist, venue)
- If 1 date → auto-select, proceed
- If N dates → show date picklist

---

## Animation Timing Reference

| Event | Duration | Easing |
|-------|----------|--------|
| Tier band fade-in | 400ms | ease-out |
| Field pill cascade (per pill) | 80ms stagger | ease |
| API favicon pulse | 600ms loop | ease-in-out |
| Photo / album art fade | 500ms | ease |
| Setlist line cascade (per line) | 60ms stagger | ease |
| T5 column convergence | 600ms | ease-in-out |
| T5 band expand | 400ms | ease-out |
| Scene card unlock stagger | 80ms per card | ease-out |
| Scene relevance ghost transition | 400ms | ease |

---

## Corpus Scale Numbers

Scale numbers (e.g., `× 77 venues`) represent archive-wide pipeline stats, not per-selection counts. They appear at the bottom of each active tier band.

During animation, scale counters animate from 0 to their final value as the tier completes — a small celebration of pipeline breadth alongside the per-concert depth.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Artist seen once, one venue, one date | Full auto-resolve after artist selection. No venue or date picker. |
| Artist seen multiple times, same venue | Venue auto-resolves; date picklist appears. |
| Artist seen at multiple venues | Venue picklist (filtered). Date may auto-resolve after venue selection. |
| Artist has no setlist data | T5 shows "Setlist not available" placeholder. Other tiers unaffected. |
| Artist has no top tracks | T4 shows "No audio data" placeholder. |
| Artist has no photo | T3 shows initials avatar in place of photo. |

---

## Implementation Phases

### Phase 1 — Static Shell (current state)
Static infographic, hardcoded Depeche Mode demo. No interactivity.

### Phase 2 — Tier Visual Redesign
Implement per-tier signature visuals (photo, code aesthetic, setlist, etc.) with the new column order (Artist | Venue | Date). Still static/hardcoded.

### Phase 3 — Hydration Animation
Implement the sequential tier animation system. Still hardcoded concert, but the animation cascade plays on load.

### Phase 4 — Artist Picklist + Data Graph
Build the artist → venue → date graph from `concerts.json`. Wire up artist picklist. Auto-resolve or show venue/date pickers as needed.

### Phase 5 — Scene Unlock + Relevance Highlighting
Implement locked/unlocked scene states. Wire scene click → upstream ghosting via `useCascadeFocus` or equivalent.

---

## Key Files

| Purpose | Path |
|---------|------|
| Main page component | `src/components/cascade/CascadePage.tsx` |
| API engine sub-components | `src/components/cascade/CascadeApiEngine.tsx` |
| SVG swim lanes | `src/components/cascade/CascadeLanes.tsx` |
| Focus/dimming hook | `src/components/cascade/useCascadeFocus.ts` |
| Lane geometry hook | `src/components/cascade/useCascadeLanes.ts` |
| Types | `src/components/cascade/cascadeTypes.ts` |
| Legacy mock (reference) | `docs/specs/future/cascade/_legacy-option-a-mock.html` |
