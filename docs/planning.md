# Concert History Timeline App - Final Implementation Plan

## Project Overview
Build an interactive Jamstack SPA that replaces the current Google Looker Studio dashboard with a rich chronological timeline experience showcasing your personal concert history (100-500 shows) spanning decades.

## Current State Analysis
- **Existing Site**: Simple iframe embedding Google Looker Studio dashboard
- **File**: [index.html](index.html) - Basic HTML wrapper around Looker embed
- **Data Source**: Google Sheet with rich data including headliners, up to 15 openers per show, genres, venues, who attended, and reference links

## Google Sheet Data Structure
Your sheet contains these columns:
- **Core**: Date, Headliner, Genre_Headliner, Opener, Venue, City/State, Who, Reference
- **Parsed**: City, State, _Full Date, Month, Day, Year, Day of Week
- **Openers**: Opener_ through Opener_15 (up to 15 opening acts per show!)
- **Who**: Tracks whether it was "Both", "Matt", or your wife who attended

## Key Requirements & Decisions

### Primary Focus
- **Timeline/chronological storytelling** as main navigation
- **Integrated map** alongside timeline (not separate view)
- **Read-only** visualization (no editing features)
- **100-500 concerts** dataset size

### Technical Stack
- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **Maps**: React Leaflet with OpenStreetMap tiles (free)
- **State**: Zustand for filters
- **Animations**: Framer Motion
- **Deployment**: Cloudflare Pages with GitHub auto-deploy

### Data Strategy
- **Google Sheets API** script for periodic imports during vibe code sessions
- **Build-time enrichment** with free APIs (TheAudioDB, Last.fm)
- **Static JSON** files committed to repo
- **Zero runtime API costs** (all data pre-fetched and cached)

### Future Consideration
- ConcertArchives.org integration (maybe v2, not v1)

## Detailed Architecture

### Project Structure
```
concerts/
├── index.html                         # Replace current file
├── public/
│   └── data/
│       ├── concerts.json              # Enriched concert data
│       └── artists-metadata.json      # Cached artist images/bios
├── scripts/
│   ├── build-data.ts                  # Orchestrator script
│   ├── fetch-google-sheet.ts          # Pull from Google Sheets API
│   ├── enrich-artists.ts              # Fetch artist metadata
│   ├── geocode-cities.ts              # Map cities to coordinates
│   └── utils/
│       ├── google-sheets-client.ts    # OAuth wrapper
│       ├── theaudiodb-client.ts       # TheAudioDB API
│       ├── lastfm-client.ts           # Last.fm API fallback
│       └── rate-limiter.ts            # Respect API limits
├── src/
│   ├── App.tsx                        # Main app component
│   ├── main.tsx                       # Entry point
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx             # Site header with logo/stats
│   │   │   └── MainLayout.tsx         # Split timeline/map container
│   │   ├── timeline/
│   │   │   ├── TimelineContainer.tsx  # Timeline orchestrator
│   │   │   ├── ConcertCard.tsx        # Individual concert card
│   │   │   ├── YearMarker.tsx         # Year section dividers
│   │   │   └── DecadeHeader.tsx       # Decade section headers
│   │   ├── map/
│   │   │   ├── MapContainer.tsx       # Leaflet map wrapper
│   │   │   └── ConcertMarker.tsx      # Custom map markers
│   │   ├── filters/
│   │   │   ├── FilterBar.tsx          # Main filter container
│   │   │   ├── ArtistFilter.tsx       # Multi-select artist filter
│   │   │   ├── GenreFilter.tsx        # Genre filter (NEW!)
│   │   │   ├── VenueFilter.tsx        # Venue filter
│   │   │   ├── CityFilter.tsx         # City filter
│   │   │   ├── WhoFilter.tsx          # Filter by attendee (NEW!)
│   │   │   ├── YearRangeSlider.tsx    # Year range slider
│   │   │   └── SearchBar.tsx          # Text search
│   │   └── stats/
│   │       └── StatsOverview.tsx      # Summary cards
│   ├── hooks/
│   │   ├── useConcertData.ts          # Load & filter data
│   │   ├── useMapSync.ts              # Sync map with timeline
│   │   └── useFilters.ts              # Filter state hook
│   ├── store/
│   │   └── useFilterStore.ts          # Zustand store
│   ├── types/
│   │   ├── concert.ts                 # Concert types
│   │   └── artist.ts                  # Artist metadata types
│   └── utils/
│       ├── city-coordinates.ts        # Static city->coords mapping
│       └── date-helpers.ts            # Date formatting utilities
├── .env.example                        # API keys template
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

### Data Schema

#### concerts.json
```typescript
interface Concert {
  id: string;                      // Generated UUID
  date: string;                    // ISO 8601: "2023-06-15"
  headliner: string;               // "Radiohead"
  headlinerNormalized: string;     // "radiohead" (for API matching)
  genre: string;                   // From Genre_Headliner column
  openers: string[];               // Array of openers (filtered nulls)
  venue: string;                   // "Red Rocks Amphitheatre"
  city: string;                    // "Morrison"
  state: string;                   // "CO"
  cityState: string;               // "Morrison, CO"
  who: string;                     // "Both" | "Matt" | Wife's name
  reference?: string;              // URL to ConcertArchives.org or similar

  // Parsed date fields
  year: number;                    // 2023
  month: number;                   // 6
  day: number;                     // 15
  dayOfWeek: string;               // "Thursday"
  decade: string;                  // "2020s"

  // Geographic data
  location: {
    lat: number;                   // 39.6653
    lng: number;                   // -105.2055
  };

  // Enriched fields
  headlinerImage?: string;         // Cached artist image URL
  headlinerBio?: string;           // Brief bio (500 chars)
  openerImages?: Record<string, string>; // { "opener1": "url" }
}
```

#### artists-metadata.json
```typescript
interface ArtistMetadata {
  [artistNormalized: string]: {
    name: string;                  // Display name
    image?: string;                // Primary image URL
    bio?: string;                  // Biography (truncated)
    genres?: string[];             // Genre tags
    formed?: string;               // Year formed
    source: 'theaudiodb' | 'lastfm' | 'manual';
    fetchedAt: string;             // ISO timestamp
  };
}
```

### Component Design

#### ConcertCard.tsx - The Heart of the UI
```tsx
interface ConcertCardProps {
  concert: Concert;
  onMapFocus: (concert: Concert) => void;
}

// Card shows:
// - Date (large, prominent)
// - Headliner name + image
// - Genre badge
// - Venue + location
// - "Also saw: Opener1, Opener2..." (collapsible if >3 openers)
// - "Who attended" badge (Both/Matt/Wife)
// - Link to reference if available
// - Click to focus map on venue location
```

**Design Approach**: Concert ticket aesthetic with:
- Perforated edge on left side
- "ADMIT ONE" style date stamp
- Bold headliner typography
- Subtle genre color coding
- Circular artist image as "stamp"
- Expandable section for openers (if many)

#### Timeline + Map Synchronization

**Desktop Layout (≥1024px)**:
```
┌─────────────────────────────────────────────────────┐
│ Header: Logo + Stats                                │
├─────────────────────────────────────────────────────┤
│ FilterBar: Search | Artists | Genres | Who | Years  │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│   Timeline (60%)     │      Map (40%)               │
│   - Scrollable       │      - Sticky/Fixed          │
│   - Concert Cards    │      - Shows visible         │
│   - Year Markers     │        concerts              │
│                      │      - Clusters markers      │
│                      │                              │
└──────────────────────┴──────────────────────────────┘
```

**Mobile Layout (<768px)**:
```
┌─────────────────────┐
│ Header + Stats      │
├─────────────────────┤
│ FilterBar (compact) │
├─────────────────────┤
│                     │
│   Timeline          │
│   (scrollable)      │
│                     │
└─────────────────────┘
│ Floating Map Button │ ← Opens full-screen map overlay
```

**Sync Strategy**:
- Use IntersectionObserver to track which concert cards are visible in timeline
- Update map to show only visible concerts
- Clicking concert card focuses map on that venue
- Clicking map marker scrolls timeline to that concert

### Filter Features

Based on your rich data, these filters make sense:

1. **Search Bar**: Free text search (artist, venue, city)
2. **Artist Filter**: Multi-select dropdown of all headliners
3. **Genre Filter**: Multi-select based on Genre_Headliner column
4. **Venue Filter**: Multi-select of all venues
5. **City/State Filter**: Multi-select of cities
6. ~~**Who Attended**: Toggle buttons~~ - **REMOVED** per user request
7. **Year Range**: Slider with min/max year from dataset
8. **Has Openers**: Toggle to show only shows with opening acts

### Data Pipeline Workflow

#### Step 1: Google Sheets API Setup
```bash
# One-time OAuth setup
npm run auth:google
# Follow prompts to authenticate and save refresh token
```

#### Step 2: Build Data
```bash
# Run during vibe code sessions
npm run build-data

# This executes:
# 1. Fetch all rows from Google Sheet
# 2. Parse and normalize data
# 3. Geocode unique cities (use static mapping)
# 4. Fetch artist images from TheAudioDB (2/sec rate limit)
# 5. Fallback to Last.fm for missing artists
# 6. Generate concerts.json and artists-metadata.json
# 7. Write to public/data/
```

#### Step 3: Commit and Deploy
```bash
git add public/data/*.json
git commit -m "Update concert data - $(date +%Y-%m-%d)"
git push origin main
# Cloudflare Pages auto-deploys
```

### API Integration Strategy

#### Artist Images - Waterfall Approach
1. **Check cache first**: Look in artists-metadata.json
2. **Try TheAudioDB**: Search by artist name, get image + bio
3. **Fallback to Last.fm**: If TheAudioDB fails
4. **Fallback to placeholder**: Generic concert icon if both fail

#### Rate Limiting
- TheAudioDB: 2 calls/second (enforce with delay)
- Last.fm: 5 calls/second
- Total enrichment time: ~100-500 artists = 1-4 minutes with delays

#### Geocoding
Create static mapping for your ~34 unique cities to avoid API calls:

```typescript
// src/utils/city-coordinates.ts
export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Morrison, CO': { lat: 39.6653, lng: -105.2055 },
  'Denver, CO': { lat: 39.7392, lng: -104.9903 },
  // ... add all 34 cities manually (one-time effort)
};
```

### Key Features to Implement

#### 1. Timeline View
- Virtual scrolling for performance (react-window)
- Year markers with concert count
- Decade headers with era styling
- Smooth scroll to year/decade
- Infinite scroll with lazy loading

#### 2. Concert Cards
- Headliner name + image (if available)
- Date formatted nicely (e.g., "Thursday, June 15, 2023")
- Venue + City, State
- Genre badge with color
- "Who attended" badge/icon
- Expandable openers section
- Link to reference (if exists)
- Hover effects and animations

#### 3. Map Integration
- OpenStreetMap tiles (free, no API key)
- Marker clustering for nearby venues
- Custom markers with concert count badges
- Sync with timeline scroll
- Click marker → scroll timeline
- Click card → center map

#### 4. Filters
- All filters update URL params (shareable links)
- Filter count badges (e.g., "Artists (3)")
- "Clear all filters" button
- Active filters shown as removable chips

#### 5. Stats Overview
- Total concerts
- Total artists
- Total venues
- Date range (earliest - latest)
- Most seen artist
- Most visited venue
- Most visited city
- Concerts per year (average)

### Creative UX Ideas

#### Concert Ticket Theme
```
┌──────────────────────────────────────┐
│ ╱╱╱ ADMIT ONE ╱╱╱                   │
│ ═════════════════════════════════════ │
│   [Artist Image]                      │
│                                       │
│   RADIOHEAD                           │
│   Alternative Rock                    │
│                                       │
│   Thursday, June 15, 2023             │
│   Red Rocks Amphitheatre              │
│   Morrison, CO                        │
│                                       │
│   Also on the bill:                   │
│   • Opener 1                          │
│   • Opener 2                          │
│                                       │
│   [Both attended] 👫                  │
└──────────────────────────────────────┘
```

#### Genre Color Coding
```typescript
const GENRE_COLORS: Record<string, string> = {
  'Rock': 'bg-red-500',
  'Alternative': 'bg-purple-500',
  'Hip Hop': 'bg-orange-500',
  'Electronic': 'bg-blue-500',
  'Country': 'bg-amber-500',
  'Jazz': 'bg-indigo-500',
  // ... map all your genres
};
```

#### Opening Acts Display
- If ≤3 openers: Show all inline
- If >3 openers: Show "Also saw: Opener1, Opener2, and 5 more..." with expand button
- Expanded view shows all with images (if enriched)

#### "Who Attended" Visuals
- Both: 👫 icon + "Both"
- Just you: Your initials or avatar
- Just wife: Her initials or avatar
- Makes it personal and tells the story

### Performance Optimizations

For 100-500 concerts:
1. **Virtual scrolling** with react-window (only render visible cards)
2. **Image lazy loading** with IntersectionObserver
3. **Map marker clustering** (react-leaflet-cluster)
4. **Memoization** of filtered concert lists
5. **WebP images** for artist photos
6. **Code splitting** by route (if adding stats page later)

### Deployment Configuration

#### Cloudflare Pages Settings
```
Build command: npm run build
Build output: dist
Root directory: /
Node version: 18

Environment Variables:
(none needed - all data is static)
```

#### GitHub Actions
**NOT NEEDED** - Cloudflare Pages automatically deploys on git push without requiring GitHub Actions. The free GitHub account limitation doesn't matter here since Cloudflare handles the build/deploy pipeline directly.

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "react-leaflet-cluster": "^2.1.0",
    "react-window": "^1.8.10",
    "zustand": "^5.0.2",
    "framer-motion": "^11.15.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/leaflet": "^1.9.14",
    "@types/react-window": "^1.8.8",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "tailwindcss": "^4.0.0",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "tsx": "^4.19.2",
    "googleapis": "^144.0.0"
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Session 1)
1. Initialize Vite + React + TypeScript project
2. Configure Tailwind CSS
3. Set up basic project structure
4. Create static concerts.json with 5-10 sample concerts (manual)
5. Build basic Timeline and ConcertCard components
6. Test rendering and styling

### Phase 2: Data Pipeline (Session 2)
1. Set up Google Sheets API OAuth
2. Create fetch-google-sheet.ts script
3. Test pulling data from your sheet
4. Create enrichment scripts (TheAudioDB, Last.fm)
5. Create city-coordinates.ts static mapping
6. Run full pipeline and generate real data files

### Phase 3: Core Features (Session 3)
1. Implement FilterBar with all filter types
2. Set up Zustand store for filter state
3. Connect filters to timeline
4. Add search functionality
5. Implement virtual scrolling
6. Add year/decade markers

### Phase 4: Map Integration (Session 4)
1. Set up React Leaflet
2. Create MapContainer component
3. Add concert markers with clustering
4. Implement map/timeline synchronization
5. Add map click → timeline scroll
6. Add card click → map focus

### Phase 5: Polish (Session 5)
1. Add animations with Framer Motion
2. Implement concert ticket design theme
3. Add stats overview header
4. Optimize images and performance
5. Mobile responsive refinements
6. Add "who attended" visuals

### Phase 6: Deployment (Session 6)
1. Set up Cloudflare Pages project
2. Connect GitHub repository
3. Configure build settings
4. Test production build locally
5. Deploy and verify
6. Set up custom domain (if desired)

## Critical Files Summary

### To Preserve & Modify
- [index.html](index.html) - **KEEP CURRENT FILE** (rename to old_index.html for backup)
- Create new Vite build that outputs to dist/index.html for Cloudflare deployment

### To Create (Priority Order)
1. `package.json` - Dependencies and scripts
2. `vite.config.ts` - Build configuration
3. `tailwind.config.js` - Styling configuration
4. `src/types/concert.ts` - TypeScript interfaces
5. `src/utils/city-coordinates.ts` - Static geocoding
6. `scripts/fetch-google-sheet.ts` - Google Sheets integration
7. `scripts/enrich-artists.ts` - Artist metadata enrichment
8. `scripts/build-data.ts` - Data pipeline orchestrator
9. `src/App.tsx` - Main app component
10. `src/components/timeline/ConcertCard.tsx` - Core UI component
11. `src/components/timeline/TimelineContainer.tsx` - Timeline view
12. `src/components/map/MapContainer.tsx` - Map integration
13. `src/store/useFilterStore.ts` - Filter state management
14. `src/hooks/useConcertData.ts` - Data loading and filtering

## Design Inspiration & Aesthetic - VISUAL EXCELLENCE

### Core Design Philosophy: "Rolling Stone Magazine Worthy"

This isn't just a data visualization - it's a **visual love letter to live music**. Think: editorial photography meets interactive storytelling meets rock poster art.

#### Visual Themes

**Primary Theme: Vintage Concert Poster + Modern Editorial**
- Large, bold typography inspired by 60s-70s rock posters
- High-quality artist photography as hero images
- Duotone/gradient overlays on images (genre-specific colors)
- Dramatic shadows and depth
- Rich, saturated colors with excellent contrast
- Typography that SCREAMS (in a good way)

**Color System**
```typescript
// Genre-based color palettes (not just badges, but entire card themes)
const GENRE_PALETTES = {
  'Rock': {
    primary: '#DC2626', // Red
    gradient: 'from-red-600 via-orange-500 to-yellow-400',
    overlay: 'bg-gradient-to-br from-red-900/80 to-black/90'
  },
  'Alternative': {
    primary: '#7C3AED', // Purple
    gradient: 'from-purple-600 via-pink-500 to-rose-400',
    overlay: 'bg-gradient-to-br from-purple-900/80 to-black/90'
  },
  'Hip Hop': {
    primary: '#EA580C', // Orange
    gradient: 'from-orange-600 via-amber-500 to-yellow-400',
    overlay: 'bg-gradient-to-br from-orange-900/80 to-black/90'
  },
  'Electronic': {
    primary: '#0EA5E9', // Blue
    gradient: 'from-blue-600 via-cyan-500 to-teal-400',
    overlay: 'bg-gradient-to-br from-blue-900/80 to-black/90'
  },
  'Country': {
    primary: '#D97706', // Amber
    gradient: 'from-amber-600 via-orange-500 to-red-400',
    overlay: 'bg-gradient-to-br from-amber-900/80 to-black/90'
  },
  // ... dynamic palette for all genres
};
```

#### Animation & Motion Design

**Scroll-Triggered Animations** (Framer Motion):
1. **Cards entering viewport**:
   - Slide up + fade in
   - Stagger effect (each card delays 50ms)
   - Slight rotation effect (1-2 degrees)
   - Scale from 0.95 to 1.0

2. **Artist images**:
   - Parallax effect on scroll
   - Subtle zoom on hover (1.0 → 1.05)
   - Duotone overlay animates in

3. **Year markers**:
   - Sticky positioning as you scroll past
   - Animate to corner with scale down
   - Blur effect on background

4. **Timeline scrubber**:
   - Draggable with spring physics
   - Visual feedback (ripple effect)
   - Smooth scroll with easing

**Micro-interactions**:
- Hover on card: Lift with shadow, subtle glow
- Click card: Quick scale down then up
- Filter applied: Chips animate in with bounce
- Map marker clicked: Pulse effect radiates out

#### Typography System

```css
/* Display - Artist Names */
font-family: 'Bebas Neue', 'Impact', sans-serif;
font-size: 3rem-4rem;
font-weight: 700;
letter-spacing: 0.05em;
text-transform: uppercase;

/* Headline - Venue Names */
font-family: 'Inter', system-ui;
font-size: 1.25rem;
font-weight: 600;

/* Body - Details */
font-family: 'Inter', system-ui;
font-size: 0.875rem-1rem;
font-weight: 400;

/* Accent - Dates, Tags */
font-family: 'Courier New', monospace;
font-size: 0.75rem;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.1em;
```

#### Concert Card Design - "Magazine Cover" Style

**Large Format Cards** (not tiny list items):
```
┌─────────────────────────────────────────────────┐
│ [FULL BLEED ARTIST IMAGE with gradient overlay] │
│                                                  │
│   ╱╱╱ ADMIT ONE ╱╱╱        [Genre Badge]        │
│                                                  │
│   RADIOHEAD                                      │
│   ═══════════════════                            │
│                                                  │
│   THURSDAY · JUNE 15, 2023                       │
│   Red Rocks Amphitheatre                         │
│   Morrison, Colorado                             │
│                                                  │
│   🎸 ALSO ON THE BILL                            │
│   Beach House • King Gizzard                     │
│   + 3 more                                       │
│                                                  │
│   👫 Both attended                    [View Map]  │
└─────────────────────────────────────────────────┘
```

**Card variations by genre**:
- Background gradient matches genre color palette
- Image duotone overlay in genre colors
- Border accent in genre primary color
- Subtle texture/grain overlay for vintage feel

#### Timeline Design - "The Journey"

**Not just a vertical list - a visual story**:

```
╔════════════════ 2020s ════════════════╗
║                                       ║
║  ─── 2024 (12 shows) ──────────       ║
║     [Card] [Card] [Card]              ║
║                                       ║
║  ─── 2023 (18 shows) ──────────       ║
║     [Card] [Card] [Card] [Card]       ║
║                                       ║
║  ─── 2022 (9 shows) ───────────       ║
║     [Card] [Card]                     ║
║                                       ║
╚═══════════════════════════════════════╝

╔════════════════ 2010s ════════════════╗
    (different color scheme for decade)
```

**Decade sections**:
- Each decade has distinct color theme
- Large decade header with stats
- Background shifts between decades
- Era-appropriate visual styling (90s = grunge, 80s = neon, etc)

#### Map Design - "Tour Route"

**Not just dots on a map**:
- Custom concert hall/venue icons (not generic pins)
- Cluster markers show artist collage
- Lines connecting consecutive shows (tour route feel)
- Venue labels appear on hover
- Heat map overlay option (density of shows)
- Vintage map aesthetic (sepia tones optional)

**Map interactions**:
- Click venue: Timeline scrolls to first show there
- Hover: Preview card appears as tooltip
- Filter active: Map fades non-matching venues
- Draw "tour routes" connecting shows in date order

#### Header - "Magazine Masthead"

```
┌────────────────────────────────────────────────┐
│  MORPERHAUS                          [Avatar]  │
│  CONCERT ARCHIVES                              │
│  ════════════════════════════                  │
│  234 Shows · 178 Artists · 1995-2024           │
│                                                │
│  [Search concerts...] 🎸 🎤 🎹 🥁              │
└────────────────────────────────────────────────┘
```

- Bold, editorial-style header
- Live stats that update with filters
- Sticky on scroll (compresses to compact mode)
- Genre icon key

#### Filter Bar - "The Mixing Board"

Visual metaphor: Audio mixing board with sliders and knobs

```
╔═══ FILTER YOUR JOURNEY ═══╗
║                            ║
║ [Search box.............]  ║
║                            ║
║ GENRE    ARTIST    VENUE   ║
║ [####]   [####]    [###]   ║
║                            ║
║ YEARS: [====|======]       ║
║ 1995 ─────────────── 2024  ║
║                            ║
║ WHO: [Both] [You] [Wife]   ║
║                            ║
║ 🎵 234 shows match         ║
╚════════════════════════════╝
```

#### Loading States - "Tuning In..."

**Not boring spinners**:
- Vinyl record spinning
- "Loading your concert history..."
- Progress bar styled as audio waveform
- Skeleton screens with shimmer effect

#### Empty States - "No Shows Found"

**Friendly, on-brand messaging**:
- "No concerts match these filters... yet!"
- Illustration of empty venue
- Quick action: "Clear filters" or "Browse all"

#### Responsive Mobile Design

**Mobile-first, but desktop-caliber design**:
- Full-bleed hero images on cards
- Swipe gestures (left = filter, right = map)
- Bottom navigation bar (Timeline | Map | Stats | Filters)
- Sticky filter button (floating action button)
- Pull-to-refresh to see updates

### Technical Implementation for Visual Excellence

1. **Image handling**:
   - Next-gen formats (WebP, AVIF)
   - Responsive images with srcset
   - Blur-up lazy loading (LQIP technique)
   - Dominant color extraction for placeholders

2. **Performance**:
   - Virtual scrolling (render only 10-15 cards at a time)
   - CSS containment for layout optimization
   - Hardware-accelerated animations (transform, opacity only)
   - Intersection Observer for lazy effects

3. **Accessibility** (beautiful AND usable):
   - High contrast ratios (WCAG AAA where possible)
   - Focus indicators styled to match theme
   - Screen reader friendly animations (prefers-reduced-motion)
   - Keyboard navigation throughout

### "Wow Factor" Features

1. **"Decades" view toggle**: Compress timeline to see all decades at once
2. **"Tour mode"**: Animated playback through your concert history
3. **"Artist network"**: Interactive graph showing opener relationships
4. **"Concert DNA"**: Circular visualization of your music taste evolution
5. **"Share this show"**: Generate beautiful social cards for individual concerts
6. **"Random memory"**: Button that jumps to random concert
7. **"On this day"**: Shows concerts from this date in history
8. **Sound**: Optional subtle ambient venue sounds on hover

## Questions Resolved

✅ Primary focus: Timeline/chronological storytelling
✅ Data source: Google Sheet with API integration
✅ Tech stack: Vite + React
✅ Dataset size: 100-500 concerts
✅ Map integration: Yes, alongside timeline
✅ User editing: No, read-only
✅ Build tool: Vite (recommended)
✅ Data import: Google Sheets API script
✅ External APIs: Use free tiers (TheAudioDB, Last.fm)
✅ ConcertArchives.org: Maybe v2, not v1

## Success Metrics

The app will be successful if it:
1. Loads quickly (<2s initial load)
2. Smoothly handles 100-500 concert cards
3. Makes exploring your concert history engaging and fun
4. Tells the chronological story of your music journey
5. Works beautifully on mobile and desktop
6. Auto-deploys when you update the data
7. Has zero runtime API costs
8. Showcases opening acts (unique feature!)
9. Shows who attended each show (personal touch)
10. Links to reference materials when available

## User Feedback Addressed

### 1. ✅ Preserve index.html
- Current index.html will be renamed to old_index.html as backup
- New Vite app builds to dist/ directory
- Cloudflare Pages serves from dist/ after build

### 2. ✅ Removed "Who Attended" Feature
- No "Who" filter or display elements
- Simplifies the UI and data model
- Removed from all components and filters

### 3. 🎯 Cities & Venues - Future Enhancements
**Current Plan (v1)**: Filter by city/venue in sidebar
**Future Ideas (v2+)**:
- **Venue Deep-Dive Pages**: Click a venue → see all shows there, photos, history
- **City Exploration**: Heat map showing concert density by city
- **Venue Rankings**: Most visited venues with badges/achievements
- **Tour Routes**: Connect consecutive shows geographically with animated paths
- **Venue Types**: Tag venues (arena, amphitheater, club, festival) with icons
- **"Local Legends"**: Highlight venues you've been to multiple times

### 4. ✅ GitHub Actions NOT Required
- Cloudflare Pages handles build/deploy directly from git push
- No GitHub Actions needed (free account limitations irrelevant)
- Workflow: `git push origin main` → Cloudflare auto-builds → deploys

### 5. 🎨 Design Comparison - Looker vs New Site

**Current Looker Site Analysis**:
- ✅ Good: Clean data presentation, filters work
- ❌ Limited: Static dashboard, no storytelling, basic aesthetics
- ❌ Missing: Artist imagery, emotional connection, chronological flow

**New Site Design Goals**:
- **Stunning visuals**: Large artist images, bold typography, genre-based color theming
- **Engaging UX**: Scroll-triggered animations, interactive timeline, synchronized map
- **Storytelling**: Chronological journey through your music life
- **Immersive**: Concert ticket/poster aesthetic with personality

**Design Deliverables Before Coding**:
1. **Wireframes** for desktop and mobile layouts
2. **Concert card mockup** showing the ticket aesthetic
3. **Color palette** based on genre theming
4. **Typography samples** with the bold rock poster style

### 6. 🔍 Multiple Exploration Paths - "Choose Your Adventure"

**YES! Absolutely accommodating this.** The design includes:

#### Primary Navigation Modes:

**A. Timeline View (Default)**
- Chronological scroll through all concerts
- Jump to decade/year with quick navigation
- Default landing experience

**B. Genre Exploration**
- Click a genre badge → filter entire timeline
- Genre-specific color theming applied
- See your journey within that genre
- Examples: "Your Alternative Rock Journey" or "Hip Hop Shows"

**C. Artist Deep Dive**
- Click artist name → see all shows for that artist
- Timeline of your relationship with that artist
- Shows opener relationships (who opened for them)

**D. Geographic Exploration**
- Map as equal partner to timeline (not secondary)
- Click city → see all shows in that location
- Venue clustering shows your "home venues"
- State/region filtering

**E. Venue Focus**
- Filter by specific venue
- See chronological list of shows there
- "Your Red Rocks History" type views

**F. Quick Stats Dashboard** (optional page)
- Aggregate views: total genres, cities, venues
- Charts and visualizations
- "Your Music DNA" breakdown
- Top 10 lists (artists, venues, cities)

#### Filter Combinations:
Users can combine filters for complex queries like:
- "Alternative Rock shows in Colorado"
- "All shows at Red Rocks"
- "Hip Hop concerts in 2015-2020"
- "Every time I saw this artist"

#### Navigation Implementation:
```
Header with tabs/modes:
[Timeline] [Map] [Genres] [Artists] [Stats]

Or persistent filter sidebar:
┌─────────────────┐
│ Search          │
│ ─────────────── │
│ 🎸 Genre        │
│   ☐ Rock        │
│   ☐ Alternative │
│ 🎤 Artist       │
│   ☐ Radiohead   │
│ 📍 Location     │
│   ☐ Denver, CO  │
│ 🏟️ Venue        │
│   ☐ Red Rocks   │
│ 📅 Years        │
│   [====|====]   │
└─────────────────┘
```

This creates a **"data exploration tool"** not just a timeline viewer. Visitors can:
1. Land on timeline (see the story)
2. Get curious about a genre → drill in
3. Notice a pattern in cities → explore geographically
4. Find a favorite venue → see all shows there
5. Discover artist connections through openers

### 7. 🎆 Wow Factor Features - Confirmed!

All the wow factor features are designed to support this exploration:
- **"Tour mode"**: Animated playback through filtered results
- **"Concert DNA"**: Aggregate genre visualization
- **"Artist network"**: See opener relationships across your history
- **"Random memory"**: Jump to random concert (great for nostalgia)
- **Shareable views**: Share a filtered view URL with friends

## Wireframes & Mockups (To Be Created)

Before coding, we'll create visual mockups for:

### 1. Desktop Layout Wireframe
```
┌───────────────────────────────────────────────────────┐
│ MORPERHAUS CONCERT ARCHIVES              🔍 Search    │
│ 234 shows · 178 artists · 34 venues                   │
├─────────────────┬─────────────────────────────────────┤
│ FILTERS         │ TIMELINE                    MAP     │
│                 │                                     │
│ 🎸 Genres       │ ╔═══ 2020s ═══╗            [Map]   │
│ ☐ Rock (45)     │ ║             ║            Shows   │
│ ☐ Alt (89)      │ ║  2024 ────  ║            current │
│                 │ ║  [Card]     ║            filtered│
│ 🎤 Artists      │ ║  [Card]     ║            concerts│
│ [Dropdown]      │ ║             ║                     │
│                 │ ║  2023 ────  ║                     │
│ 📍 Cities       │ ║  [Card]     ║                     │
│ ☐ Denver (23)   │ ║  [Card]     ║                     │
│                 │ ║  [Card]     ║                     │
│ 🏟️ Venues       │ ╚═════════════╝                     │
│ [Dropdown]      │                                     │
│                 │ ╔═══ 2010s ═══╗                     │
│ 📅 Years        │ ║  [Cards...]  ║                     │
│ [====|======]   │ ╚═════════════╝                     │
│ 1995 ──── 2024  │                                     │
│                 │                                     │
│ 🎵 234 shows    │                                     │
│ [Clear filters] │                                     │
└─────────────────┴─────────────────────────────────────┘
```

### 2. Concert Card Mockup
(Will create visual mockup showing ticket aesthetic with actual styling)

### 3. Mobile Layout Wireframe
```
┌─────────────────┐
│ MORPERHAUS      │
│ ARCHIVES        │
│ 234 · 178 · 34  │
├─────────────────┤
│ 🔍 Search...    │
│ [Filters] 🎸    │
├─────────────────┤
│                 │
│ ═══ 2024 ═══    │
│                 │
│ [Concert Card]  │
│ [Full width]    │
│ [Image]         │
│ ARTIST NAME     │
│ Venue info      │
│                 │
│ [Concert Card]  │
│                 │
└─────────────────┘
│ [Timeline|Map]  │ ← Bottom nav
```

## Project Setup Requirements (Phase 0)

Before beginning Phase 1, we need to establish proper project infrastructure:

### Git & GitHub Setup
1. Initialize git repository: `git init`
2. Create `.gitignore` file (node_modules, dist, .env, etc.)
3. Create GitHub repository (via `gh repo create` or web interface)
4. Configure remote and push initial commit
5. Set up Cloudflare Pages connection to GitHub repo

### Documentation Structure
1. Create `/docs` directory
2. Move planning docs to `/docs/planning.md`
3. Update planning docs at end of each phase
4. Add `/docs/README.md` with project overview
5. Add `/docs/api-setup.md` for Google Sheets & music API configuration

### .claude Configuration
Create `.claude/` directory with:
- `config.json` - Project-specific settings
- `context.md` - Project context for future sessions
- `phase-tracking.md` - Track progress through implementation phases

### Context Window Management
**Current Usage**: ~80k / 200k tokens (~40% used)
**Remaining**: ~120k tokens

**Phase Completion Strategy**:
- Evaluate context before starting each phase
- If <30k tokens remaining, document progress and start fresh session
- Keep planning docs updated so context can be rebuilt

### Next Steps - Execution Order

**Phase 0: Project Infrastructure** (THIS SESSION)
- [ ] Initialize git repository
- [ ] Create directory structure (docs/, .claude/, src/, public/, scripts/)
- [ ] Create .gitignore
- [ ] Move planning doc to /docs/planning.md
- [ ] Create .claude/config.json
- [ ] Create initial README.md
- [ ] First commit: "Initial project structure"
- [ ] Create GitHub repo and push
- [ ] Backup index.html to old_index.html

**Phase 1: Foundation Setup** (NEXT SESSION if needed)
- Package.json and dependencies
- Vite configuration
- TypeScript setup
- Tailwind CSS
- Basic project structure
- Sample data file

Token budget check: ~120k available - **SUFFICIENT** for Phase 0 + Phase 1

## Context Window Strategy

Before starting each major phase, I will:
1. Check remaining token budget
2. If < 30,000 tokens: Stop, update /docs, prepare for new session
3. If sufficient: Proceed with phase
4. Document all progress in /docs/planning.md

This ensures we never run out of context mid-phase and maintains continuity.
