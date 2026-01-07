# Genre Scene: Treemap with Timeline Scrubber

> **Role**: Feature specification for Genre Scene visualization
> **Status**: 📋 **READY FOR IMPLEMENTATION**
> **Scene**: Scene 5 (Genres / "The Music")
> **Priority**: High
> **Complexity**: Medium-High
> **Estimated Time**: 12-16 hours

---

## Executive Summary

Replace the circular sunburst visualization in Scene 5 (Genres) with a **zoomable treemap** paired with a **draggable timeline scrubber**. The timeline allows users to travel through their concert history, watching genres grow and shrink proportionally over time—transforming static data into a narrative about musical evolution.

**Core Experience:**
1. Scene loads at 1980, auto-advances to present (~20 seconds)
2. User watches their musical taste evolve in real-time
3. After animation completes, user can drag the timeline freely
4. Tapping a genre tile drills down into artists (timeline hides)
5. "explore →" CTA deep-links to Artist Scene gatefold

**Key Benefits:**
- **Storytelling** — Transforms data into a personal narrative
- **Engagement** — Draggable timeline invites interaction
- **Mobile UX** — Large rectangular touch targets vs. small pie wedges
- **Clearer proportions** — Rectangle area = concert count (intuitive)
- **Temporal context** — See *when* your taste shifted, not just *what* you listened to

---

## Design Philosophy

### Core Principles

1. **Time as the primary dimension** — The timeline isn't a filter; it's the lens through which you view your entire history
2. **Treemap as hero, slider as control** — Visual hierarchy: treemap dominates, slider recedes
3. **Smooth morphing** — Tiles glide between positions; no jarring jumps
4. **Sensory feedback** — Haptics on decade crossings, color shifts with era
5. **Narrative moments** — Auto-play entrance creates an "unfolding story" experience

### Interaction Model

| State | Timeline | Treemap | User Action |
|-------|----------|---------|-------------|
| **Entrance** | Auto-advancing | Morphing | Watch |
| **Exploration** | Draggable | Morphing | Scrub left/right |
| **Drill-down** | Hidden | Artist tiles | Tap genre → see artists |
| **Artist focus** | Hidden | Dimmed tiles | Tap artist → "explore →" |

---

## Visual Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     The Music                                │
│              Your musical journey through time               │
│                                                              │
│                         2024                                 │
│                   174 shows · New Wave era                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │                    TREEMAP                          │    │
│  │              (720 × 480 desktop)                    │    │
│  │                                                     │    │
│  │   ┌──────────────┐  ┌──────────┐  ┌─────────┐     │    │
│  │   │  New Wave    │  │  Punk    │  │ Alt     │     │    │
│  │   │  1984→2023   │  │ 1992→21  │  │ 85→23   │     │    │
│  │   │   38 shows   │  │ 28 shows │  │ 24 shows│     │    │
│  │   └──────────────┘  └──────────┘  └─────────┘     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ← 1980                                          Today →    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ○────────────────────────────────────────────●      │    │
│  └─────────────────────────────────────────────────────┘    │
│       1980s        1990s        2000s        2010s   2020s  │
│                                                              │
│         The 2020s — A lifetime of live music.               │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Treemap Size | Slider Width | Layout Adjustments |
|------------|--------------|--------------|-------------------|
| **Desktop** (≥1024px) | 720 × 480px | 720px | Full layout as designed |
| **Tablet** (768-1023px) | 90vw × 60vw (max 600×400) | 90vw | Reduce padding, smaller fonts |
| **Mobile** (< 768px) | 95vw × 70vw (max 360×280) | 95vw | Stack vertically, thumb 20px wide, decade labels abbreviated |

**Mobile-specific adjustments:**
- Minimum tile size: 44×44px enforced (iOS/Android touch target)
- Slider thumb: Taller (48px) for easier grabbing
- Year display: 48px font (down from 72px)
- Decade labels: "80s" instead of "1980s"
- Narrative text: Hidden on smallest screens (<375px width)

### Treemap Tiles

**Tile Content Hierarchy:**
```
┌─────────────────────┐
│      Genre Name     │  ← Bold, 11-18px based on tile size
│     1984 → 2023     │  ← Monospace, years attended (to current scrub position)
│       38 shows      │  ← Regular weight, count
│                     │
│     [explore →]     │  ← Artist view only, glassmorphic button
└─────────────────────┘
```

**Year Display Rules:**
- 1-3 shows: Display all years (`1984  2001  2023`)
- 4+ shows: Bookend format (`1984 → 2023`)
- Only show years up to current timeline position

**Label Visibility Thresholds:**
| Tile Size | Visible Content |
|-----------|-----------------|
| < 44×38px | Nothing (too small) |
| ≥ 50×38px | Name only |
| ≥ 50×45px | Name + show count |
| ≥ 65×50px | Name + years + count |
| ≥ 80×70px | All + "explore →" (artist view) |

**Tile Styling:**
```css
/* Base tile */
background: linear-gradient(180deg, 
  genreColor.brighter(18%) 0%, 
  genreColor 100%
);
border-radius: 3px;
stroke: rgba(255, 255, 255, 0.4);
stroke-width: 1px;

/* Hovered tile */
stroke: #ffffff;
stroke-width: 2px;
filter: brightness(1.15);

/* Transition (smooth morphing) */
transition: x 0.25s ease-out, 
            y 0.25s ease-out, 
            width 0.25s ease-out, 
            height 0.25s ease-out;
```

### Timeline Slider

**Track:**
```css
height: 32px;
background: rgba(30, 41, 59, 0.6);  /* slate-800/60 */
border-radius: 9999px;  /* fully rounded */
border: 1px solid rgba(51, 65, 85, 0.5);  /* slate-700/50 */
box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.2);

/* When dragging */
box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.3), 
            0 0 20px ${dominantGenreColor}30;
```

**Progress Fill:**
```css
position: absolute;
top: 4px;
bottom: 4px;
left: 4px;
border-radius: 9999px;
background: linear-gradient(90deg, 
  ${dominantGenreColor}50 0%, 
  ${dominantGenreColor}30 100%
);
transition: width 0.15s ease-out;  /* disabled while dragging */
```

**Thumb Handle:**
```css
width: 16px;
height: 40px;  /* extends above/below track */
border-radius: 9999px;
background: linear-gradient(180deg, 
  ${dominantGenreColor.brighter(60%)} 0%, 
  ${dominantGenreColor} 50%, 
  ${dominantGenreColor.darker(20%)} 100%
);
border: 2px solid rgba(255, 255, 255, 0.3);
box-shadow: 0 0 10px ${dominantGenreColor}40, 
            0 2px 8px rgba(0, 0, 0, 0.3);

/* While dragging */
transform: scale(1.15);
box-shadow: 0 0 20px ${dominantGenreColor}80, 
            0 4px 12px rgba(0, 0, 0, 0.4);
```

**Thumb Wobble Animation (pre-interaction):**
```css
@keyframes wobble {
  0%, 100% { transform: translateX(-50%) translateY(-50%) translateX(0); }
  25% { transform: translateX(-50%) translateY(-50%) translateX(-4px); }
  75% { transform: translateX(-50%) translateY(-50%) translateX(4px); }
}

/* Applied until first touch */
animation: wobble 1.5s ease-in-out infinite;
```

**Decade Markers:**
- Vertical tick marks at 1980, 1990, 2000, 2010, 2020
- Height: 12px, color: `slate-600/60`
- Labels below slider: "1980s", "1990s", etc.
- Active decade highlighted in dominant genre color

**Milestone Pips:**
- Small dots (6px) at 25, 50, 75, 100, 125, 150 show milestones
- Color: `violet-400/60`
- Tooltip on hover: "50 shows"

### Background Color Bleed

The page background subtly shifts to reflect the dominant genre:

```css
background: 
  radial-gradient(
    ellipse at 50% 30%, 
    ${dominantGenreColor}20 0%, 
    transparent 50%
  ),
  linear-gradient(
    to bottom right, 
    #0f172a, 
    #1e293b, 
    #0f172a
  );
transition: background 0.7s ease;
```

### Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Scene title | 30px | 300 (light) | white |
| Subtitle | 14px | 400 | slate-400 |
| Year display | 72px (desktop), 48px (mobile) | 200 (extralight) | white |
| Show count | 14px | 400 | slate-400 |
| Era indicator | 14px | 500 | dominant genre color (brightened) |
| Tile name | 11-18px (dynamic) | 600 | auto (luminance-based) |
| Tile years | 60% of name size | 400 | auto, 75% opacity |
| Tile count | 55% of name size | 400 | auto, 70% opacity |
| Narrative | 14px | 400 | slate-400 |

---

## Interaction Design

### Entrance Animation (Auto-Play)

**Sequence:**
1. Scene loads with `currentYear = 1980`
2. After 500ms delay, begin auto-advance
3. Advance ~2-3 years per second (120ms per year)
4. Treemap morphs smoothly as genres appear/grow
5. Haptic pulse at each decade crossing
6. At 2024, animation completes
7. Thumb wobble begins, inviting interaction
8. User can grab slider at any time to take control (stops auto-play)

**Timing:**
- Total duration: ~18-20 seconds (1980→2024)
- Can be interrupted by user touch at any point
- If interrupted, resumes from that position (no restart)

### Timeline Scrubbing

**Drag Behavior:**
- Touch/click anywhere on slider track to jump to that year
- Drag thumb left/right to scrub continuously
- Year updates in real-time as user drags
- Tiles morph smoothly (0.25s transition)
- Release thumb to stop at current position

**Bounds:**
- Minimum: 1980 (or first year with data)
- Maximum: 2024 (or current year)

**Visual Feedback While Dragging:**
- Thumb scales to 115%
- Thumb glow intensifies
- Year display scales to 102%
- Slider track glows with dominant genre color

### Haptic Feedback

| Event | Pattern | Description |
|-------|---------|-------------|
| First touch on slider | `[10]` | Light tap |
| Crossing decade boundary | `[30, 20, 30]` | Double pulse |
| Reaching start (1980) | `[20]` | Medium tap |
| Reaching end (2024) | `[20]` | Medium tap |

**Implementation:**
```typescript
function triggerHaptic(style: 'light' | 'medium' | 'decade') {
  if (navigator.vibrate) {
    const patterns = {
      light: [10],
      medium: [20],
      decade: [30, 20, 30],
    };
    navigator.vibrate(patterns[style]);
  }
}
```

### Genre Drill-Down

**Trigger:** Tap/click any genre tile

**Transition:**
1. Timeline slider fades out (200ms)
2. Treemap recalculates to show artists within selected genre
3. Tiles morph to new positions (400ms)
4. Breadcrumb appears: "All Genres › New Wave"
5. Reset button appears (top-right)

**Artist View:**
- Shows all artists seen in that genre (all-time, not filtered by timeline)
- Tiles sized by show count
- Color: parent genre color with brightness variations per artist
- Large tiles show "explore →" CTA

**"explore →" CTA:**
- Appears on artist tiles ≥ 80×70px
- Styled: glassmorphic button (`bg-white/15`, `border: 1px solid white/25`)
- Action: Navigate to Artist Scene, open that artist's gatefold
- Implementation: `navigate('/artists', { state: { openArtist: artistName } })`

**Return to Overview:**
- Tap "Reset" button, or
- Tap breadcrumb "All Genres", or
- Tap background (outside tiles)
- Timeline slider fades back in

### Keyboard Navigation (Desktop)

| Key | Action |
|-----|--------|
| **←** / **→** | Move timeline ±1 year |
| **Shift + ←** / **→** | Move timeline ±10 years (decade) |
| **Home** | Jump to 1980 |
| **End** | Jump to 2024 |
| **Space** | Toggle auto-play |
| **Tab** | Focus next tile |
| **Enter** | Drill into focused genre |
| **Escape** | Return to genre overview |

---

## Data Structure

### Build-Time Aggregation

**Input:** `concerts.json` with individual concert records

**Output:** `genres-timeline.json` with pre-aggregated data

```typescript
// genres-timeline.json
interface GenreTimelineData {
  genres: GenreTimeline[];
  totalShowsByYear: Record<number, number>;
  milestones: MilestoneYear[];
  yearRange: { start: number; end: number };
}

interface GenreTimeline {
  name: string;
  normalizedName: string;
  color: string;
  showsByYear: Record<number, number>;  // { 1984: 3, 1985: 4, ... }
  totalShows: number;
  firstYear: number;
  lastYear: number;
  artists: ArtistData[];
}

interface ArtistData {
  name: string;
  normalizedName: string;
  showCount: number;
  years: number[];
  firstYear: number;
  lastYear: number;
}

interface MilestoneYear {
  milestone: number;  // 25, 50, 75, 100...
  year: number;
}
```

**Example:**
```json
{
  "genres": [
    {
      "name": "New Wave",
      "normalizedName": "new-wave",
      "color": "#1e40af",
      "showsByYear": {
        "1984": 3,
        "1985": 4,
        "1986": 3,
        "1987": 2,
        "1988": 2,
        "1989": 3,
        "2001": 2,
        "2006": 2,
        "2009": 2,
        "2013": 2,
        "2017": 3,
        "2019": 2,
        "2022": 4,
        "2023": 4
      },
      "totalShows": 38,
      "firstYear": 1984,
      "lastYear": 2023,
      "artists": [
        {
          "name": "Depeche Mode",
          "normalizedName": "depeche-mode",
          "showCount": 6,
          "years": [1984, 1988, 2001, 2009, 2017, 2023],
          "firstYear": 1984,
          "lastYear": 2023
        }
      ]
    }
  ],
  "totalShowsByYear": {
    "1980": 1,
    "1981": 2,
    "1982": 3
  },
  "milestones": [
    { "milestone": 25, "year": 1986 },
    { "milestone": 50, "year": 1993 },
    { "milestone": 100, "year": 2008 }
  ],
  "yearRange": { "start": 1980, "end": 2024 }
}
```

### Data Pipeline Script

Add to `scripts/aggregate-genres-timeline.ts`:

```typescript
import concerts from '../public/data/concerts.json';
import { GENRE_COLORS } from '../src/constants/colors';

interface Concert {
  date: string;
  headliner: string;
  genre: string;
  // ... other fields
}

function aggregateGenresTimeline(concerts: Concert[]) {
  const genreMap = new Map<string, {
    showsByYear: Map<number, number>;
    artists: Map<string, { years: Set<number> }>;
  }>();
  
  const totalShowsByYear = new Map<number, number>();
  
  // Process each concert
  concerts.forEach(concert => {
    const year = new Date(concert.date).getFullYear();
    const genre = concert.genre || 'Other';
    
    // Initialize genre if needed
    if (!genreMap.has(genre)) {
      genreMap.set(genre, {
        showsByYear: new Map(),
        artists: new Map(),
      });
    }
    
    const genreData = genreMap.get(genre)!;
    
    // Increment year count for genre
    genreData.showsByYear.set(
      year, 
      (genreData.showsByYear.get(year) || 0) + 1
    );
    
    // Track artist
    if (!genreData.artists.has(concert.headliner)) {
      genreData.artists.set(concert.headliner, { years: new Set() });
    }
    genreData.artists.get(concert.headliner)!.years.add(year);
    
    // Track total shows by year
    totalShowsByYear.set(year, (totalShowsByYear.get(year) || 0) + 1);
  });
  
  // Calculate milestones
  const milestones: { milestone: number; year: number }[] = [];
  const milestoneLevels = [25, 50, 75, 100, 125, 150, 175, 200];
  let runningTotal = 0;
  
  const sortedYears = [...totalShowsByYear.keys()].sort((a, b) => a - b);
  
  sortedYears.forEach(year => {
    const prevTotal = runningTotal;
    runningTotal += totalShowsByYear.get(year)!;
    
    milestoneLevels.forEach(m => {
      if (prevTotal < m && runningTotal >= m) {
        milestones.push({ milestone: m, year });
      }
    });
  });
  
  // Build output
  const genres = [...genreMap.entries()].map(([name, data]) => {
    const showsByYear = Object.fromEntries(data.showsByYear);
    const years = [...data.showsByYear.keys()].sort((a, b) => a - b);
    
    const artists = [...data.artists.entries()].map(([artistName, artistData]) => {
      const artistYears = [...artistData.years].sort((a, b) => a - b);
      return {
        name: artistName,
        normalizedName: normalizeArtistName(artistName),
        showCount: artistYears.length,
        years: artistYears,
        firstYear: artistYears[0],
        lastYear: artistYears[artistYears.length - 1],
      };
    }).sort((a, b) => b.showCount - a.showCount);
    
    return {
      name,
      normalizedName: normalizeGenreName(name),
      color: GENRE_COLORS[name] || '#6b7280',
      showsByYear,
      totalShows: [...data.showsByYear.values()].reduce((a, b) => a + b, 0),
      firstYear: years[0],
      lastYear: years[years.length - 1],
      artists,
    };
  }).sort((a, b) => b.totalShows - a.totalShows);
  
  return {
    genres,
    totalShowsByYear: Object.fromEntries(totalShowsByYear),
    milestones,
    yearRange: {
      start: Math.min(...sortedYears),
      end: Math.max(...sortedYears),
    },
  };
}
```

---

## Technical Implementation

### Component Architecture

```
src/components/scenes/
├── Scene5Genres/
│   ├── index.tsx                    # Main component, state management
│   ├── GenreTreemap.tsx             # SVG treemap rendering
│   ├── TimelineSlider.tsx           # Slider component
│   ├── ArtistDrillDown.tsx          # Artist view when genre selected
│   ├── useTimelineAnimation.ts      # Auto-play hook
│   ├── useTreemapLayout.ts          # D3 squarify layout hook
│   └── utils/
│       ├── squarify.ts              # Treemap algorithm
│       ├── haptics.ts               # Vibration patterns
│       └── interpolate.ts           # Smooth position transitions
```

### Core State

```typescript
interface GenreSceneState {
  // Timeline
  currentYear: number;
  isPlaying: boolean;           // Auto-play active
  isDragging: boolean;          // User dragging slider
  hasInteracted: boolean;       // User has touched slider (stops wobble)
  
  // View
  view: 'genres' | 'artists';
  selectedGenre: string | null;
  
  // UI
  hoveredTile: string | null;
  dominantGenre: string | null; // For background color
}
```

### Squarify Algorithm

```typescript
interface Tile {
  name: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function squarify(
  data: { name: string; count: number }[],
  x: number,
  y: number,
  width: number,
  height: number
): Tile[] {
  if (data.length === 0) return [];
  
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return [];
  
  const tiles: Tile[] = [];
  let remaining = [...data].sort((a, b) => b.count - a.count);
  let currentX = x;
  let currentY = y;
  let currentWidth = width;
  let currentHeight = height;

  while (remaining.length > 0) {
    const isHorizontal = currentWidth >= currentHeight;
    const side = isHorizontal ? currentHeight : currentWidth;
    
    // Find optimal row
    let row: typeof data = [];
    let rowSum = 0;
    let worstRatio = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const testRow = [...row, remaining[i]];
      const testSum = rowSum + remaining[i].count;
      const rowSize = (testSum / total) * (isHorizontal ? currentWidth : currentHeight);
      
      // Calculate worst aspect ratio in this row
      let maxRatio = 0;
      testRow.forEach(item => {
        const itemSize = (item.count / testSum) * side;
        const ratio = Math.max(rowSize / itemSize, itemSize / rowSize);
        maxRatio = Math.max(maxRatio, ratio);
      });
      
      if (maxRatio <= worstRatio || row.length === 0) {
        row = testRow;
        rowSum = testSum;
        worstRatio = maxRatio;
      } else {
        break;
      }
    }
    
    // Layout the row
    const rowSize = (rowSum / total) * (isHorizontal ? currentWidth : currentHeight);
    let offset = 0;
    
    row.forEach(item => {
      const itemSize = (item.count / rowSum) * side;
      
      if (isHorizontal) {
        tiles.push({
          ...item,
          x: currentX + offset,
          y: currentY,
          width: itemSize,
          height: rowSize,
        });
        offset += itemSize;
      } else {
        tiles.push({
          ...item,
          x: currentX,
          y: currentY + offset,
          width: rowSize,
          height: itemSize,
        });
        offset += itemSize;
      }
    });
    
    // Update remaining area
    if (isHorizontal) {
      currentY += rowSize;
      currentHeight -= rowSize;
    } else {
      currentX += rowSize;
      currentWidth -= rowSize;
    }
    
    remaining = remaining.slice(row.length);
  }
  
  return tiles;
}
```

### Auto-Play Hook

```typescript
function useTimelineAnimation(
  startYear: number,
  endYear: number,
  onYearChange: (year: number) => void,
  onComplete: () => void
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number>();
  const lastFrameTime = useRef(0);
  const currentYearRef = useRef(startYear);
  
  const play = useCallback(() => {
    setIsPlaying(true);
    lastFrameTime.current = 0;
  }, []);
  
  const pause = useCallback(() => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);
  
  const reset = useCallback(() => {
    pause();
    currentYearRef.current = startYear;
    onYearChange(startYear);
  }, [pause, startYear, onYearChange]);
  
  useEffect(() => {
    if (!isPlaying) return;
    
    const animate = (timestamp: number) => {
      if (!lastFrameTime.current) {
        lastFrameTime.current = timestamp;
      }
      
      const elapsed = timestamp - lastFrameTime.current;
      
      // Advance ~2.5 years per second (400ms per year)
      if (elapsed > 120) {
        lastFrameTime.current = timestamp;
        
        currentYearRef.current += 1;
        
        if (currentYearRef.current >= endYear) {
          currentYearRef.current = endYear;
          onYearChange(endYear);
          setIsPlaying(false);
          onComplete();
          return;
        }
        
        onYearChange(currentYearRef.current);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, endYear, onYearChange, onComplete]);
  
  return { isPlaying, play, pause, reset };
}
```

### Timeline Slider Component

```typescript
interface TimelineSliderProps {
  currentYear: number;
  startYear: number;
  endYear: number;
  dominantColor: string;
  milestones: { milestone: number; year: number }[];
  hasInteracted: boolean;
  onYearChange: (year: number) => void;
  onInteractionStart: () => void;
}

function TimelineSlider({
  currentYear,
  startYear,
  endYear,
  dominantColor,
  milestones,
  hasInteracted,
  onYearChange,
  onInteractionStart,
}: TimelineSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const prevDecade = useRef(Math.floor(currentYear / 10) * 10);
  
  const getYearFromPosition = useCallback((clientX: number) => {
    if (!sliderRef.current) return currentYear;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(startYear + percent * (endYear - startYear));
  }, [currentYear, startYear, endYear]);
  
  // Haptic on decade crossing
  useEffect(() => {
    const currentDecade = Math.floor(currentYear / 10) * 10;
    if (currentDecade !== prevDecade.current && hasInteracted) {
      triggerHaptic('decade');
      prevDecade.current = currentDecade;
    }
  }, [currentYear, hasInteracted]);
  
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    onInteractionStart();
    onYearChange(getYearFromPosition(e.clientX));
    triggerHaptic('light');
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      onYearChange(getYearFromPosition(e.clientX));
    }
  };
  
  const handlePointerUp = () => {
    setIsDragging(false);
  };
  
  const percent = ((currentYear - startYear) / (endYear - startYear)) * 100;
  
  return (
    <div className="w-full max-w-[720px]">
      {/* Edge labels */}
      <div className="flex justify-between mb-2 px-1">
        <span className="text-xs text-slate-500">← {startYear}</span>
        <span className="text-xs text-slate-500">Today →</span>
      </div>
      
      {/* Slider track */}
      <div
        ref={sliderRef}
        className="relative h-8 bg-slate-800/60 rounded-full cursor-grab active:cursor-grabbing overflow-visible border border-slate-700/50"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          boxShadow: isDragging
            ? `inset 0 1px 4px rgba(0,0,0,0.3), 0 0 20px ${dominantColor}30`
            : 'inset 0 1px 4px rgba(0,0,0,0.2)',
          touchAction: 'none',
        }}
      >
        {/* Decade markers */}
        {[1980, 1990, 2000, 2010, 2020].map(decade => {
          const decadePercent = ((decade - startYear) / (endYear - startYear)) * 100;
          return (
            <div
              key={decade}
              className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-slate-600/60"
              style={{ left: `${decadePercent}%` }}
            />
          );
        })}
        
        {/* Milestone pips */}
        {milestones.map(({ milestone, year }) => {
          const milestonePercent = ((year - startYear) / (endYear - startYear)) * 100;
          return (
            <div
              key={milestone}
              className="absolute top-1/2 w-1.5 h-1.5 rounded-full bg-violet-400/60"
              style={{
                left: `${milestonePercent}%`,
                transform: 'translate(-50%, -50%)',
              }}
              title={`${milestone} shows`}
            />
          );
        })}
        
        {/* Progress fill */}
        <div
          className="absolute top-1 bottom-1 left-1 rounded-full"
          style={{
            width: `calc(${percent}% - 4px)`,
            background: `linear-gradient(90deg, ${dominantColor}50 0%, ${dominantColor}30 100%)`,
            transition: isDragging ? 'none' : 'width 0.15s ease-out',
          }}
        />
        
        {/* Thumb */}
        <div
          className={!hasInteracted ? 'wobble' : ''}
          style={{
            position: 'absolute',
            top: '50%',
            left: `${percent}%`,
            transform: `translateX(-50%) translateY(-50%) ${isDragging ? 'scale(1.15)' : 'scale(1)'}`,
            transition: isDragging ? 'transform 0.1s' : 'left 0.15s ease-out, transform 0.2s',
          }}
        >
          <div
            className="w-4 h-10 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(180deg, 
                ${adjustBrightness(dominantColor, 60)} 0%, 
                ${dominantColor} 50%, 
                ${adjustBrightness(dominantColor, -20)} 100%
              )`,
              boxShadow: isDragging
                ? `0 0 20px ${dominantColor}80, 0 4px 12px rgba(0,0,0,0.4)`
                : `0 0 10px ${dominantColor}40, 0 2px 8px rgba(0,0,0,0.3)`,
              border: '2px solid rgba(255,255,255,0.3)',
            }}
          >
            {/* Grip lines */}
            <div className="flex flex-col gap-0.5">
              <div className="w-1.5 h-px bg-white/40 rounded" />
              <div className="w-1.5 h-px bg-white/40 rounded" />
              <div className="w-1.5 h-px bg-white/40 rounded" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Decade labels */}
      <div className="relative h-5 mt-1">
        {[1980, 1990, 2000, 2010, 2020].map(decade => {
          const decadePercent = ((decade - startYear) / (endYear - startYear)) * 100;
          const isActive = currentYear >= decade && currentYear < decade + 10;
          return (
            <span
              key={decade}
              className="absolute text-[10px] tabular-nums transition-all duration-200"
              style={{
                left: `${decadePercent}%`,
                transform: 'translateX(-50%)',
                color: isActive ? adjustBrightness(dominantColor, 50) : '#64748b',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {decade}s
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

### Smooth Tile Transitions

```typescript
// Track previous positions for interpolation
const [tilePositions, setTilePositions] = useState<Record<string, TilePosition>>({});

// When raw tiles update, smoothly transition to new positions
useEffect(() => {
  const newPositions: Record<string, TilePosition> = {};
  
  rawTiles.forEach(tile => {
    newPositions[tile.name] = {
      x: tile.x,
      y: tile.y,
      width: tile.width,
      height: tile.height,
      count: tile.count,
    };
  });
  
  setTilePositions(newPositions);
}, [rawTiles]);

// In SVG, use CSS transitions
<rect
  x={pos.x}
  y={pos.y}
  width={pos.width}
  height={pos.height}
  style={{
    transition: 'x 0.25s ease-out, y 0.25s ease-out, width 0.25s ease-out, height 0.25s ease-out',
  }}
/>
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `public/data/genres-timeline.json` | Pre-aggregated timeline data |
| `scripts/aggregate-genres-timeline.ts` | Build script for timeline data |
| `src/components/scenes/Scene5Genres/TimelineSlider.tsx` | Slider component |
| `src/components/scenes/Scene5Genres/useTimelineAnimation.ts` | Auto-play hook |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/scenes/Scene5Genres.tsx` | Replace sunburst with treemap + timeline |
| `package.json` | Add aggregation script to build process |

### Deleted Files
| File | Reason |
|------|--------|
| None | Keep sunburst as `Scene5GenresSunburst.tsx.bak` for reference |

---

## Migration Strategy

### Phase 1: Data Pipeline (2-3 hours)
- [ ] Create `aggregate-genres-timeline.ts` script
- [ ] Run script to generate `genres-timeline.json`
- [ ] Add script to `package.json` build process
- [ ] Verify data structure matches spec

### Phase 2: Core Components (4-6 hours)
- [ ] Create `TimelineSlider.tsx` with drag handling
- [ ] Create `useTimelineAnimation.ts` hook
- [ ] Implement squarify algorithm in `useTreemapLayout.ts`
- [ ] Build basic `GenreTreemap.tsx` with smooth transitions

### Phase 3: Integration (3-4 hours)
- [ ] Wire up state management in main component
- [ ] Implement entrance animation (auto-play)
- [ ] Add drill-down to artist view
- [ ] Connect "explore →" to Artist Scene navigation

### Phase 4: Polish (2-3 hours)
- [ ] Add haptic feedback
- [ ] Implement background color bleed
- [ ] Add wobble animation
- [ ] Responsive breakpoints
- [ ] Keyboard navigation

### Phase 5: Testing (1-2 hours)
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Performance profiling
- [ ] Accessibility audit

---

## Testing Checklist

### Functional Tests
- [ ] Auto-play advances from 1980 to 2024
- [ ] Auto-play can be interrupted by touch
- [ ] Dragging slider updates year and treemap
- [ ] Tiles appear/disappear at correct years
- [ ] Tile sizes are proportionally correct
- [ ] Genre tap drills into artist view
- [ ] "explore →" navigates to Artist Scene
- [ ] Reset returns to genre overview
- [ ] Timeline reappears after reset

### Timeline Interaction Tests
- [ ] Slider responds to click anywhere on track
- [ ] Drag works smoothly (no jitter)
- [ ] Thumb stays within bounds
- [ ] Year display updates in real-time
- [ ] Decade haptics fire at boundaries
- [ ] Wobble stops after first interaction

### Visual Tests
- [ ] Tiles morph smoothly (no jumping)
- [ ] Background color shifts with dominant genre
- [ ] Thumb color matches dominant genre
- [ ] Active decade is highlighted
- [ ] Milestone pips visible at correct positions
- [ ] Labels hide on small tiles
- [ ] Text color adapts to tile background

### Responsive Tests
- [ ] Desktop layout (≥1024px) renders correctly
- [ ] Tablet layout (768-1023px) adjusts properly
- [ ] Mobile layout (<768px) is usable
- [ ] Touch targets are ≥44px on mobile
- [ ] Slider is easy to grab on touch devices

### Performance Tests
- [ ] Entrance animation maintains 60fps
- [ ] Scrubbing is smooth (no lag)
- [ ] Initial render < 100ms
- [ ] No memory leaks during extended interaction

### Accessibility Tests
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] ARIA labels on interactive elements
- [ ] Screen reader announces year changes
- [ ] Reduced motion preference respected

---

## Success Metrics

| Metric | Target | Current (Sunburst) |
|--------|--------|-------------------|
| Touch target success rate | >95% | ~70% |
| Time to understand visualization | <5 seconds | ~10 seconds |
| User engagement (scrub interactions) | >3 per session | N/A |
| Animation frame rate | 60fps | 60fps |
| Initial render time | <100ms | ~80ms |

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Keep sunburst as option? | No — commit to treemap |
| Timeline in drill-down? | No — hide timeline, show all-time artist data |
| Data aggregation | Build-time (pre-compute `showsByYear`) |
| Entrance behavior | Auto-play from 1980, interruptible |
| Mobile breakpoints | Included in this spec |

---

## Future Enhancements (Out of Scope)

1. **Timeline in artist drill-down** — Scrub to see which artists you saw in different eras
2. **Decade comparison mode** — Side-by-side treemaps for 80s vs 90s vs 2000s
3. **Share moment** — Generate shareable image of treemap at specific year
4. **Sound design** — Optional audio cues for era changes
5. **"First show" markers** — Highlight first occurrence of each genre/artist

---

## Related Documentation

- [Mobile Optimization Spec](./mobile-optimization.md)
- [Artist Scene Spec](../implemented/artist-scene.md)
- [Color Specification Guide](../../design/color-specification.md)
- [Genre Colors Constants](../../src/constants/colors.ts)

---

**Last Updated**: 2025-01-06
**Author**: Claude (with user guidance)
**Status**: 📋 **READY FOR IMPLEMENTATION**
