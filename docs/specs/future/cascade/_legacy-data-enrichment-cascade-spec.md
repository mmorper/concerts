# Data Enrichment Cascade — Interactive Pipeline Visualization

**Status:** Planned
**Priority:** Medium
**Estimated Complexity:** Very High
**Dependencies:** None (standalone feature, reads existing static data)

---

## Executive Summary

The Data Enrichment Cascade is an interactive visualization that tells the story of how three atomic data points — an artist name, a venue name, and a date — transform into 23,000+ interconnected data points through a 7-API enrichment pipeline. It is both a standalone infographic (shareable on LinkedIn, embeddable as an image) and a future interactive scene within the Morperhaus Concert Archives app.

The visualization uses three fluid "swim lanes" — one per atomic data point — that flow vertically through 6 tiers. Each lane swells when its atom is being actively enriched and contracts to a thin thread when dormant. The lanes connect directly to the API engine representations at each tier, showing exactly what data flows in, which service processes it, and what comes back. At Tier 5, all three lanes reconverge for the setlist lookup — the only enrichment that requires all three atoms simultaneously.

The killer interaction: users can select any artist from the archive, and the entire cascade repopulates with real data from that artist's actual concert — real venue coordinates, real genre tags, real track names, real setlist songs. The infographic becomes a live demo of the pipeline running against 42 years of concert history.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth
- Ask clarifying questions if anything is ambiguous or needs decision
- Read files proactively to understand existing patterns before writing code

**Feature Overview:**
- Interactive visualization of the data enrichment pipeline as flowing swim lanes
- Three fluid SVG lanes (date, venue, artist) that widen/narrow based on enrichment activity per tier
- 6 tiers: Atoms → Build Pipeline → Google Places → Artist Identity → Audio → Setlists
- Artist selector lets users pick any headliner; entire cascade updates with real concert data
- Clickable atoms focus/highlight that atom's lane through the full cascade
- All data comes from existing static JSON files — no live API calls

**Key References:**
- Full spec: docs/specs/future/data-enrichment-cascade.md
- Concert data: public/data/concerts.json (180 concerts, structure in src/types/concert.ts)
- Artist metadata: public/data/artists-metadata.json (images, bios, genres)
- Top tracks: public/data/artists-top-tracks.json (iTunes preview data)
- Setlist cache: public/data/setlists/ (cached setlist.fm responses)
- Scene design guide: docs/design/scene-design-guide.md
- Color spec: docs/design/color-specification.md

**Implementation Approach (Multi-Phase — see spec for details):**
- Phase 1: Static infographic page (standalone route, hardcoded Depeche Mode example)
- Phase 2: Artist selector with real data population
- Phase 3: Full interactivity (atom focus, lane animations, scroll-triggered effects)
- Phase 4: Scene integration (becomes Scene 6 in the app)

**Design Philosophy:**
The cascade is a river system. Three streams originate from a single spreadsheet row, diverge through different enrichment channels, and reconverge at the end. The width of each stream tells you where the action is. The interaction model is "follow the water."

**Key Design Details:**
- Background: var(--bg-deep) #0a0a0f (darkest, immersive)
- Lane colors: Date #64748b (slate), Venue #6366f1 (indigo), Artist #8b5cf6 (violet)
- Lane fills: SVG paths with 7-10% opacity fills, gaussian blur for soft edges
- Lane transitions: Cubic bezier curves between tiers, smooth width interpolation
- Typography: Playfair Display (tier titles), Source Sans 3 (body), JetBrains Mono (data/code)
- API service boxes: 6% opacity fill + 15% opacity border in tier color
- Tier color progression: gray → slate → indigo → violet → purple → purple-400 (brightening)
- Animation: Lane width transitions 600ms cubic-bezier(0.4, 0, 0.2, 1)
- Focus mode: Highlighted lane 18% opacity, dimmed lanes 3% opacity, dimmed tiers 12% overall opacity

**Data Requirements:**
- concerts.json: Concert records with all structural fields
- artists-metadata.json: Artist images, bios, genres, formed year, source
- artists-top-tracks.json: Top track names, preview URLs, album art, streaming links
- Setlist data: Cached setlist.fm responses (song names, encores, covers)
- Venue data: Lat/lng already in concerts.json location field

**Current State:**
- 5 existing scenes with snap scrolling
- Existing scene infrastructure: full-viewport sections, scroll-snap, Framer Motion
- Static JSON data files already contain all enriched data
- No existing "about the data" or "how it works" page

**Files to Create:**
- src/components/scenes/CascadeScene/ (component directory)
  - CascadeScene.tsx (~400 LOC) — Main scene component
  - CascadeLanes.tsx (~300 LOC) — SVG lane rendering
  - CascadeTier.tsx (~200 LOC) — Reusable tier component
  - ApiEngine.tsx (~150 LOC) — Input → Service → Output pattern
  - AtomSelector.tsx (~150 LOC) — Artist picker with concert selection
  - cascadeData.ts (~200 LOC) — Data loading and transformation
  - useCascadeState.ts (~100 LOC) — Zustand slice or local state
- src/components/scenes/CascadeScene/index.ts (~5 LOC)

**Files to Modify:**
- src/App.tsx — Add CascadeScene to scene array (Phase 4 only)
- src/routes.tsx or equivalent — Add /cascade route (Phase 1-3)
- public/data/ — May need a cascade-specific data bundle

Let's start with Phase 1. Should I begin by creating the CascadeScene component with the static SVG lane system?
```

---

## Design Philosophy

**The River Metaphor:**
The cascade is a river system viewed from above. Three tributaries flow from a single source (the spreadsheet row). Each tributary passes through different terrain (API services) where it picks up sediment (enriched data). At the delta (Tier 5), all three tributaries merge to form something richer than any single stream. The width of each tributary at any point tells you how much enrichment is happening there.

**Why This Works:**
- Fluid lanes communicate enrichment activity through geometry, not labels
- The API-as-engine pattern (input → service → output) mirrors how the pipeline actually works
- The artist selector transforms a static infographic into an explorable data tool
- The focus interaction lets users trace any single atom's journey in isolation
- The reconvergence at Tier 5 is both narratively and technically satisfying — setlist.fm really does need all three atoms

---

## Phased Implementation Plan

### Phase 1: Static Infographic Page

**Goal:** A standalone page at `/cascade` (or `/how-it-works`) showing the full cascade with hardcoded Depeche Mode / Rose Bowl / 2023-03-28 data. No interactivity beyond basic hover states. This is the "LinkedIn screenshot" version.

**Visual Structure:**

```
┌──────────────────────────────────────────┐
│              HEADER                       │
│    "The Data Enrichment Cascade"          │
│    "How three words in a spreadsheet..."  │
├──────────────────────────────────────────┤
│  TIER 0 — Three Atoms                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │  Date    │ │  Venue  │ │ Artist  │    │
│  │2023-3-28 │ │Kia Forum│ │Depeche  │    │
│  └─────────┘ └─────────┘ │ Mode    │    │
│                           └─────────┘    │
│  ═══ equal thirds ═══                    │
├──────────────────────────────────────────┤
│  TIER 1 — Build Pipeline                 │
│  ┌──────┐   ┌──────────┐  ┌──────────┐  │
│  │ year │   │venueNorm │  │headliner │  │
│  │month │   │ city     │  │ Norm     │  │
│  │ day  │   │ state    │  │  id      │  │
│  │dayOfW│   │cityState │  └──────────┘  │
│  │decade│   └──────────┘                 │
│  └──────┘                                │
│  ═══ equal thirds ═══                    │
├──────────────────────────────────────────┤
│  TIER 2 — Geographic                     │
│  ╌╌╌    ┌───────────────────────┐  ╌╌╌  │
│  thin   │ venue+city+state      │  thin  │
│  date   │  ↓ Google Places ↓    │ artist │
│  thread │ lat, lng, photos, id  │ thread │
│  ╌╌╌    │ × 77 venues           │  ╌╌╌  │
│         └───────────────────────┘        │
│  ═══ venue lane WIDE ═══                 │
├──────────────────────────────────────────┤
│  TIER 3 — Artist Identity                │
│  ╌╌╌  ╌╌╌  ┌───────────────────────┐    │
│  thin  thin │ headliner             │    │
│  date venue │  ↓ TheAudioDB ↓       │    │
│             │  ↓ Last.fm (fallback) │    │
│             │  ↓ MusicBrainz (IDs)  │    │
│             │ image, bio, genres,   │    │
│             │ formed, mbid          │    │
│             │ × 255 artists         │    │
│             └───────────────────────┘    │
│  ═══ artist lane WIDE ═══               │
├──────────────────────────────────────────┤
│  TIER 4 — Audio                          │
│  ╌╌╌  ╌╌╌  ┌───────────────────────┐    │
│  thin  thin │ artist                │    │
│  date venue │  ↓ iTunes/Apple Music │    │
│             │ trackName, previewUrl │    │
│             │ albumArt, streamingUrl│    │
│             │ × 255 artists, 1275tk│    │
│             └───────────────────────┘    │
│  ═══ artist lane WIDE ═══               │
├──────────────────────────────────────────┤
│  TIER 5 — Live Performance              │
│  ┌──────────────────────────────────┐    │
│  │ ALL THREE ATOMS RECONVERGE       │    │
│  │ artist + venue + date            │    │
│  │  ↓ setlist.fm    ↓ Ticketmaster  │    │
│  │ Song 1, Song 2, ... Encore       │    │
│  │ ~3,240 songs across 180 concerts │    │
│  └──────────────────────────────────┘    │
│  ═══ all lanes merge ═══                │
├──────────────────────────────────────────┤
│              FOOTER                       │
│     540 → 23,000+ = 42× enrichment      │
│     7 APIs · 5 scenes · 42 years         │
│     concerts.morperhaus.org              │
└──────────────────────────────────────────┘
```

**SVG Lane Rendering:**

The lanes are SVG `<path>` elements drawn behind the HTML content. Each lane is a filled shape whose left and right edges curve smoothly between width values at each tier boundary.

Lane width ratios per tier (normalized to total width):

| Tier | Date | Venue | Artist |
|------|------|-------|--------|
| 0 — Atoms | 1 | 1 | 1 |
| 1 — Pipeline | 1 | 1 | 1 |
| 2 — Geographic | 0.15 | 2.5 | 0.15 |
| 3 — Identity | 0.15 | 0.15 | 2.5 |
| 4 — Audio | 0.15 | 0.15 | 2.5 |
| 5 — Setlists | 1 | 1 | 1 |

Lane edges are connected between tiers using cubic bezier curves to create smooth, organic transitions. The control points should create an ease-in-out feel — the lane begins widening gradually, reaches peak width at the tier center, and narrows gradually toward the next tier.

Lane visual properties:
- Fill: atom color at 7% opacity
- Filter: Gaussian blur at 8px (softens edges)
- Center line: atom color at 15% opacity, 1px stroke
- Dormant lanes: thin thread (2px effective width) with atom color label at 40% opacity

**Tier Content Pattern:**

Tiers 2-5 follow a universal API engine pattern:

```
┌─────────────────────────┐
│      INPUT TAGS          │  ← data flowing in from previous tier
│  field: "value"          │
├─────────────────────────┤
│      ↓ query ↓           │
├─────────────────────────┤
│  ● Service Name          │  ← the API that does the work
│    Description           │
├─────────────────────────┤
│      ↓ response ↓        │
├─────────────────────────┤
│      OUTPUT TAGS         │  ← enriched data that flows down
│  newField: "newValue"    │
├─────────────────────────┤
│  × N items enriched      │  ← aggregate scale
└─────────────────────────┘
```

**Deep Link:** `/?scene=cascade` or `/cascade`

**Acceptance Criteria (Phase 1):**
- [ ] Standalone page renders at `/cascade`
- [ ] 6 tiers visible with correct content and color progression
- [ ] SVG lanes render behind content with smooth curves between tiers
- [ ] Venue lane visibly widens at Tier 2
- [ ] Artist lane visibly widens at Tiers 3-4
- [ ] All three lanes merge at Tier 5
- [ ] Dormant lanes show thin colored threads with labels
- [ ] Footer shows 540 → 23,000+ = 42× punchline
- [ ] 7 API logos displayed
- [ ] Mobile responsive (lanes hidden, stacked layout)
- [ ] Hardcoded Depeche Mode / Kia Forum / 2023-03-28 data throughout

---

### Phase 2: Artist Selector with Real Data

**Goal:** The Artist atom cell becomes a selector. When a user picks a different artist, the cascade repopulates with real data from that artist's concert. All data comes from existing static JSON files.

**Artist Selector Design:**

The Artist atom in Tier 0 gains a subtle dropdown affordance. Clicking it opens a search/select interface showing all 105 unique headliners. Selecting an artist:

1. Finds their concerts in `concerts.json`
2. If the artist has multiple concerts, shows a secondary selector for which concert (or auto-selects the most recent)
3. Populates all tiers with real data for that concert:
   - Tier 0: Updates all three atom values
   - Tier 1: Updates parsed fields, normalized values
   - Tier 2: Updates venue name, city, state, lat/lng from concert record
   - Tier 3: Updates artist image source, bio excerpt, genres, formed year from `artists-metadata.json`
   - Tier 4: Updates track names, album info from `artists-top-tracks.json`
   - Tier 5: Updates setlist from cached setlist data (if available; shows "setlist not cached" gracefully if not)

**Data Loading Strategy:**

All data is loaded at page mount from static JSON files:

```typescript
interface CascadeData {
  concerts: Concert[];
  artistMeta: ArtistMetadata;
  topTracks: ArtistTopTracks;
  // Setlists loaded on-demand from /data/setlists/{concertId}.json
}
```

The selector filters `concerts` by unique headliners, groups concerts per artist, and lets the user pick a specific show.

**Concert Selector UX:**

For artists with multiple concerts (Social Distortion has 8, Howard Jones has 6, Depeche Mode has 5):

```
┌────────────────────────────┐
│ ▼ Depeche Mode             │
├────────────────────────────┤
│ ○ Kia Forum · 2023         │
│ ● Staples Center · 2005    │  ← selected
│ ○ Dodger Stadium · 1990    │
│ ○ The Rose Bowl · 1988     │
│ ○ Irvine Meadows · 1985    │
└────────────────────────────┘
```

For artists with a single concert, selecting the artist auto-selects the concert.

**Graceful Degradation:**

Not every concert will have data at every tier:
- **Tier 3 (artist identity):** If artist not in `artists-metadata.json`, show "not yet enriched" in muted text
- **Tier 4 (audio):** If artist not in `artists-top-tracks.json`, show "no preview available"
- **Tier 5 (setlist):** If setlist not cached, show "setlist not yet retrieved" — this is actually interesting because it shows the pipeline is real and sometimes incomplete

**Animation on Selection:**

When a new artist is selected:
1. All tier content fades out (200ms)
2. New data populates
3. All tier content fades in from top to bottom with stagger (50ms per tier, 300ms duration each)
4. SVG lanes redraw to accommodate any layout changes

**Venue and Date Selectors (deferred):**

In Phase 2, only the Artist atom is selectable. The Venue and Date atoms update automatically based on the selected concert. Phase 4 may add independent venue/date selectors.

**Acceptance Criteria (Phase 2):**
- [ ] Artist atom is clickable and opens a searchable artist list
- [ ] Selecting an artist with multiple concerts shows a concert picker
- [ ] All 6 tiers update with real data from the selected concert
- [ ] Artist metadata (image, bio, genres) populates Tier 3 from static JSON
- [ ] Top tracks populate Tier 4 from static JSON
- [ ] Setlist populates Tier 5 from cached data (or shows graceful empty state)
- [ ] Selection change animates smoothly (fade out, repopulate, stagger in)
- [ ] URL updates to include selected artist: `/cascade?artist=depeche-mode`
- [ ] Direct link to `/cascade?artist=social-distortion` works on page load

---

### Phase 3: Full Interactivity

**Goal:** Atom focus mode, scroll-triggered lane animations, and polished micro-interactions.

**Atom Focus Mode:**

Clicking any atom in Tier 0 activates focus mode for that atom's lane:

1. The clicked atom glows in its color (border + box-shadow)
2. The other two atoms dim to 25% opacity
3. The focused atom's SVG lane fill increases to 18% opacity
4. The other two lanes drop to 3% opacity
5. Tiers not relevant to the focused atom dim to 12% opacity with slight grayscale
6. Tiers relevant to the focused atom stay at full opacity
7. A floating "Show All" pill appears at the bottom of the viewport
8. Clicking the same atom again (or "Show All") resets to default view

**Atom relevance map:**

| Tier | Date | Venue | Artist |
|------|------|-------|--------|
| 0 | ✓ | ✓ | ✓ |
| 1 | ✓ | ✓ | ✓ |
| 2 | | ✓ | |
| 3 | | | ✓ |
| 4 | | | ✓ |
| 5 | ✓ | ✓ | ✓ |

**Lane Width Animation on Focus (advanced):**

When an atom is focused, the grid columns animate to give the focused lane maximum width:

| Focus | Date | Venue | Artist |
|-------|------|-------|--------|
| Date focused | 3 | 0.3 | 0.3 |
| Venue focused | 0.3 | 3 | 0.3 |
| Artist focused | 0.3 | 0.3 | 3 |
| None (default) | per-tier ratios | per-tier ratios | per-tier ratios |

This means clicking "Artist" at Tier 0 causes the artist lane to swell to full width across ALL tiers — the dormant tiers now show the artist's data taking up the full viewport width while the date and venue threads thin to whispers. The SVG lanes animate accordingly.

Transition: 600ms cubic-bezier(0.4, 0, 0.2, 1) on `grid-template-columns`.

**Scroll-Triggered Effects:**

Using Intersection Observer:
- Tiers fade in as they enter the viewport (already handled by animation delays in Phase 1)
- SVG lane fills could pulse briefly when a tier enters view (subtle brightness bump on the active lane)
- The cumulative data point counter on the right edge could count up as each tier scrolls into view

**Acceptance Criteria (Phase 3):**
- [ ] Clicking an atom activates focus mode for that lane
- [ ] Focused lane visually swells, other lanes thin to threads
- [ ] Irrelevant tiers dim with grayscale
- [ ] "Show All" floating pill appears and resets on click
- [ ] Clicking the same atom toggles focus off
- [ ] Lane width animation is smooth (600ms ease)
- [ ] SVG lane shapes update on focus change
- [ ] Focus state is reflected in URL: `/cascade?artist=depeche-mode&focus=artist`
- [ ] Scroll-triggered tier entrance animations work

---

### Phase 4: Scene Integration

**Goal:** The cascade becomes Scene 6 in the main app, slotted into the scroll-snap flow after the Artists scene.

**Scene Properties:**

| Property | Value |
|----------|-------|
| **Scene Number** | 6 |
| **Title** | "The Pipeline" or "How It's Made" |
| **Emotion** | "This is how we got here" |
| **Background** | `bg-deep` / `#0a0a0f` (darkest) |
| **Position** | After Artists scene |

Updated visual rhythm:
```
LIGHT → DARK → DARK → LIGHT → LIGHT → DARK

  1        2       3       4        5       6
  ○        ●       ●       ○        ○       ●
```

**Integration Requirements:**
- Full-viewport scene with internal scrolling (the cascade is taller than one viewport)
- Scene nav indicator shows 6th dot
- Deep link: `/?scene=cascade`
- Scroll snap: snaps to scene top, then allows internal scroll through tiers
- Keyboard navigation: arrow keys move between scenes, internal scroll handles tier navigation

**The "How Did We Get Here" Narrative:**

This scene answers a question that curious users naturally ask after exploring the 5 data-rich scenes: "Where does all this data come from?" It's the behind-the-scenes scene. The emotional arc goes from wonder ("look at all this data") to understanding ("oh, that's how it works") to appreciation ("from just three words in a spreadsheet").

**README "What's Next" Copy (Product Marketer voice):**

> **The Pipeline** — Ever wonder how three words in a spreadsheet become an interactive archive? We're building a visualization that traces each piece of data from its origin through 7 different APIs, watching it transform from a name and a date into photos, audio previews, and song-by-song setlists. Think of it as the director's commentary for your concert data.

**Acceptance Criteria (Phase 4):**
- [ ] Scene 6 appears after Artists in the scroll-snap flow
- [ ] Scene nav shows 6 dots
- [ ] Deep link `/?scene=cascade` scrolls to the scene
- [ ] Internal scroll works within the scene viewport
- [ ] Scene transitions in/out match existing Framer Motion patterns
- [ ] Artist selector defaults to a compelling example on scene entry (Depeche Mode or random)
- [ ] Keyboard navigation works (arrows for scenes, scroll for internal tiers)

---

## Data Architecture

### Static Data Files Required

| File | Purpose | Already Exists? |
|------|---------|-----------------|
| `public/data/concerts.json` | Concert records with structural fields | ✅ Yes |
| `public/data/artists-metadata.json` | Artist images, bios, genres | ✅ Yes |
| `public/data/artists-top-tracks.json` | iTunes preview data | ✅ Yes |
| `public/data/setlists/*.json` | Cached setlist.fm responses | ✅ Yes (per-concert) |

### Data Transformation for Cascade

The cascade component needs a flattened view of one concert's enrichment journey:

```typescript
interface CascadeSnapshot {
  // Tier 0 — the three atoms
  artist: string;          // "Depeche Mode"
  venue: string;           // "Kia Forum"
  date: string;            // "2023-03-28"

  // Tier 1 — structural enrichment
  concert: Concert;        // Full concert record with all parsed fields

  // Tier 2 — geographic
  geo: {
    lat: number;
    lng: number;
    // venue photos if available
  };

  // Tier 3 — artist identity
  identity: {
    image?: string;
    bio?: string;
    genres?: string[];
    formed?: string;
    source: string;
  } | null;                // null if not yet enriched

  // Tier 4 — audio
  audio: {
    tracks: TopTrack[];
    source: string;
  } | null;                // null if not yet enriched

  // Tier 5 — performance
  setlist: {
    songs: SetlistSong[];
    tour?: string;
    encore?: boolean;
    coverCount: number;
  } | null;                // null if not yet cached
}
```

This snapshot is computed from the static JSON files whenever the artist/concert selection changes.

### Aggregate Stats (Pre-computed)

These are displayed in the tier footers and punchline and should be computed once at load:

```typescript
interface CascadeAggregates {
  totalConcerts: number;      // 180
  totalArtists: number;       // 255 (headliners + openers)
  uniqueHeadliners: number;   // 105
  uniqueVenues: number;       // 77
  uniqueCities: number;       // 35
  uniqueRegions: number;      // 10
  totalOpeners: number;       // 185
  fieldsPerConcert: number;   // 19
  estimatedTotalDataPoints: number; // ~23,000
  enrichmentFactor: number;   // ~42
  apiCount: number;           // 7
}
```

---

## Visual Design Details

### Color Progression by Tier

| Tier | Label Color | Title Color | Content Accent |
|------|-------------|-------------|----------------|
| 0 | `#4b5563` | `#9ca3af` | neutral grays |
| 1 | `#64748b` | `#cbd5e1` | warm slate |
| 2 | `#6366f1` | `#e0e7ff` | indigo family |
| 3 | `#8b5cf6` | `#ede9fe` | violet family |
| 4 | `#a855f7` | `#faf5ff` | purple family |
| 5 | `#c084fc` | `#ffffff` | bright purple |

### API Service Box Styling (per tier)

```
Background: tier-color at 6% opacity
Border: tier-color at 15% opacity, 1px solid
Dot: tier-color at 100%, 8px, with box-shadow glow at 40% opacity
Name: tier-color at 70% lightness
Type: tier-color at 50% lightness
Fallback services: 50% overall opacity, dashed border
```

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Tier label | JetBrains Mono | 10px | 400, tracking 0.25em |
| Tier title | Playfair Display | 26-28px | 700 |
| Tier subtitle | Source Sans 3 | 14-15px | 300 |
| Data field keys | JetBrains Mono | 8-9px | 400, tracking 0.05em |
| Data field values | JetBrains Mono | 12-13px | 400 |
| API service name | JetBrains Mono | 12-13px | 600 |
| API service type | Source Sans 3 | 10-11px | 300 |
| Stat numbers | Playfair Display | 32-36px | 700 |
| Punchline numbers | Playfair Display | 56px | 900 |

### Animation Timing

| Animation | Duration | Easing |
|-----------|----------|--------|
| Tier fade-in on load | 800ms | ease, staggered 300ms |
| Lane width change (focus) | 600ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Content fade on selection change | 200ms out, 300ms in | ease |
| Selection stagger | 50ms per tier | ease |
| Atom glow on focus | 400ms | ease |
| "Show All" pill entrance | 400ms | cubic-bezier(0.4, 0, 0.2, 1) |

---

## Deep Link Design

| URL | Behavior |
|-----|----------|
| `/cascade` | Default view with Depeche Mode example |
| `/cascade?artist=social-distortion` | Opens with Social Distortion selected |
| `/cascade?artist=depeche-mode&concert=concert-171` | Specific concert selected |
| `/cascade?artist=depeche-mode&focus=artist` | Artist lane focused |
| `/cascade?artist=depeche-mode&focus=venue` | Venue lane focused |
| `/?scene=cascade` | Scene 6 in main app (Phase 4) |
| `/?scene=cascade&artist=kraftwerk` | Scene 6 with Kraftwerk selected |

---

## Testing Strategy

### Manual Testing Checklist

**Phase 1:**
- [ ] Page renders at `/cascade` without errors
- [ ] All 6 tiers display with correct content
- [ ] SVG lanes render with visible fill and smooth curves
- [ ] Lane widths change appropriately per tier
- [ ] Dormant lanes show thin threads
- [ ] Footer punchline stats are accurate
- [ ] Mobile layout stacks correctly (no SVG lanes)
- [ ] Color progression is visible (grayer at top, richer at bottom)

**Phase 2:**
- [ ] Artist selector opens and shows all 105 headliners
- [ ] Search/filter works in the selector
- [ ] Selecting an artist with 1 concert auto-populates
- [ ] Selecting an artist with N concerts shows concert picker
- [ ] All tiers update with real data
- [ ] Missing data (no cached setlist) shows graceful empty state
- [ ] URL updates on selection
- [ ] Direct link with ?artist= works on fresh page load

**Phase 3:**
- [ ] Clicking Artist atom focuses the artist lane
- [ ] Focused lane widens, others narrow
- [ ] Irrelevant tiers dim
- [ ] "Show All" pill appears and works
- [ ] Same-atom click toggles focus off
- [ ] Focus + selection work together (can focus while browsing artists)

**Phase 4:**
- [ ] Scene 6 appears in scroll-snap flow
- [ ] Scene nav shows 6 dots
- [ ] Deep link `/?scene=cascade` works
- [ ] Internal scrolling within the scene works
- [ ] Scene transitions match existing patterns

### Test Data (Known Good Concerts)

| Artist | Concert | Openers | Genre | Notes |
|--------|---------|---------|-------|-------|
| Depeche Mode | Kia Forum 2023-03-28 | Kelly Lee Owens | — | Most recent DM show |
| Depeche Mode | Rose Bowl 1988-06-18 | Thomas Dolby, Wire, OMD | — | 3 openers |
| Social Distortion | Any of 8 | Varies | — | Most-seen artist |
| Kraftwerk | Shrine 2022-07-05 | None | — | Solo act, electronic |
| X | Pacific Amphitheatre 2022-08-01 | The Blasters, Los Lobos | — | 2 openers |

---

## Future Enhancements (Post Phase 4)

- **All three atoms selectable:** Pick venue independently, date independently; cascade shows what enrichment is possible with partial inputs
- **Animated count-up:** Data point totals animate as user scrolls through tiers
- **Export as image:** Generate a static PNG/SVG of the current cascade state for social sharing
- **"Run the pipeline" mode:** Animated sequence showing data flowing through the cascade in real-time, tier by tier, with loading spinners at each API (simulated)
- **Comparison mode:** Select two concerts side by side, see how their cascades differ
- **Opener cascades:** Toggle to show opener enrichment alongside headliner

---

## Success Metrics

### Quantitative
- Page renders in <2 seconds on desktop
- All 105 headliners selectable without performance degradation
- SVG lane rendering completes in <100ms

### Qualitative
- A non-technical viewer understands the "3 words become 23,000 data points" story
- The artist selector invites exploration ("let me try another artist")
- The fluid lanes feel organic, not mechanical
- LinkedIn post using this infographic generates meaningful engagement
- Visitors to the app spend time on this scene (indicates genuine interest in "how it works")

---

## Revision History

- **2026-03-08:** Initial specification created from iterative HTML mock exploration
- **Version:** 1.0.0
- **Author:** Creative collaboration between project owner and Claude (Project advisor)
- **Status:** Ready for phased implementation
- **Related artifacts:** `data-enrichment-cascade-brief.md` (creative brief), `data-enrichment-cascade-mock.html` (interactive HTML mock with fluid lanes)
