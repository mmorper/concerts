# Music Scene (Genres) — Engineering Specification

**Version:** 1.0  
**Last Updated:** December 2024  
**Component:** `src/components/scenes/Scene5Genres.tsx`  
**Status:** Ready for Implementation

---

## Overview

Replace the current broken sunburst visualization with a simplified two-state donut chart:

- **Default State:** Single-ring donut showing all genres
- **Drill-Down State:** Two-ring donut (selected genre inner, artists outer)

The current implementation is overengineered with a 3-ring partition layout, rotated labels, and complex hierarchy management. This spec simplifies to a cleaner, more readable visualization.

---

## Architecture

### State Machine

```
┌─────────────────┐
│                 │
│  DEFAULT STATE  │◄─────────────────────┐
│  (All Genres)   │                      │
│                 │                      │
└────────┬────────┘                      │
         │                               │
         │ Click Genre                   │ Click Center
         │                               │ (or Back button)
         ▼                               │
┌─────────────────┐                      │
│                 │                      │
│  DRILL-DOWN     │──────────────────────┘
│  (Genre+Artists)│
│                 │
└─────────────────┘
```

### Component State

```typescript
interface MusicSceneState {
  // Which genre is expanded (null = default view)
  expandedGenre: string | null;
  
  // Hover state for segment expansion
  hoveredSegment: string | null;
}
```

---

## Visual Specifications

### Default State (All Genres)

```
        ┌─────────────────────┐
       ╱                       ╲
      ╱    ┌───────────────┐    ╲
     │    ╱                 ╲    │
     │   │                   │   │
     │   │       175         │   │  ◄─ Center: total concerts
     │   │     concerts      │   │
     │   │                   │   │
     │    ╲                 ╱    │
      ╲    └───────────────┘    ╱
       ╲                       ╱
        └─────────────────────┘
        
        ▲                     ▲
        │                     │
   Genre segments        Single ring
   (proportional)        (no artists)
```

**Specifications:**

| Property | Value |
|----------|-------|
| Outer radius | 45% of min(width, height) |
| Inner radius | 60% of outer radius (creates donut hole) |
| Segment gap | 2px (via padAngle) |
| Background | `#ede9fe` (soft violet) |

### Drill-Down State (Genre + Artists)

```
        ┌─────────────────────┐
       ╱ ╱ ╲ ╲           ╱ ╲ ╲ ╲
      ╱ ╱   ╲ ╲    ┌────┐╱   ╲ ╲ ╲
     │ │     │ │  ╱      ╲    │ │ │
     │ │     │ │ │        │   │ │ │  ◄─ Outer: Artists (alpha sorted)
     │ │     │ │ │  New   │   │ │ │
     │ │     │ │ │  Wave  │   │ │ │  ◄─ Inner: Selected genre (full ring)
     │ │     │ │ │   46   │   │ │ │
     │ │     │ │  ╲      ╱    │ │ │
      ╲ ╲   ╱ ╱    └────┘╲   ╱ ╱ ╱
       ╲ ╲ ╱ ╱           ╲ ╱ ╱ ╱
        └─────────────────────┘
```

**Specifications:**

| Property | Value |
|----------|-------|
| Inner ring (genre) | Solid color, 25-45% of radius |
| Outer ring (artists) | Lighter shades, 50-95% of radius |
| Center content | Genre name + count |
| Back button | Visible above center |

---

## Data Processing

### Genre Aggregation

```typescript
interface GenreData {
  name: string;
  count: number;
  percentage: number;
  color: string;
  artists: ArtistData[];
}

interface ArtistData {
  name: string;
  count: number;
  color: string;  // Lighter shade of parent genre
}

function processGenreData(concerts: Concert[]): GenreData[] {
  // 1. Count concerts per genre
  const genreCounts = new Map<string, number>();
  const genreArtists = new Map<string, Map<string, number>>();
  
  concerts.forEach(concert => {
    const genre = concert.genre || 'Unknown';
    genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    
    if (!genreArtists.has(genre)) {
      genreArtists.set(genre, new Map());
    }
    const artists = genreArtists.get(genre)!;
    artists.set(concert.headliner, (artists.get(concert.headliner) || 0) + 1);
  });
  
  const total = concerts.length;
  const threshold = total * 0.03;  // 3% threshold
  
  // 2. Separate major genres from "Other"
  const majorGenres: GenreData[] = [];
  const smallGenres: GenreData[] = [];
  
  genreCounts.forEach((count, name) => {
    const data: GenreData = {
      name,
      count,
      percentage: (count / total) * 100,
      color: getGenreColor(name),
      artists: Array.from(genreArtists.get(name)!.entries())
        .map(([artist, count]) => ({ 
          name: artist, 
          count,
          color: ''  // Set below
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),  // Alpha sort
    };
    
    if (count >= threshold) {
      majorGenres.push(data);
    } else {
      smallGenres.push(data);
    }
  });
  
  // 3. Sort major genres by count (largest first)
  majorGenres.sort((a, b) => b.count - a.count);
  
  // 4. Create "Other" bucket if needed
  if (smallGenres.length > 0) {
    const otherCount = smallGenres.reduce((sum, g) => sum + g.count, 0);
    majorGenres.push({
      name: 'Other',
      count: otherCount,
      percentage: (otherCount / total) * 100,
      color: GENRE_COLORS['Other'],
      artists: [],  // "Other" drills into sub-genres, not artists
      subGenres: smallGenres,  // Special property for "Other"
    });
  }
  
  return majorGenres;
}
```

### Artist Color Shading

Artists inherit their parent genre's color with varied lightness:

```typescript
function getArtistColors(genreColor: string, artistCount: number): string[] {
  const hsl = hexToHSL(genreColor);
  const colors: string[] = [];
  
  // Distribute lightness from 40% to 65%
  for (let i = 0; i < artistCount; i++) {
    const lightness = 40 + (i / Math.max(artistCount - 1, 1)) * 25;
    colors.push(hslToHex(hsl.h, hsl.s, lightness));
  }
  
  return colors;
}
```

---

## D3 Implementation

### Arc Generators

```typescript
// Default state: single ring
const defaultArc = d3.arc<GenreData>()
  .innerRadius(radius * 0.6)
  .outerRadius(radius)
  .padAngle(0.02)
  .cornerRadius(4);

// Hover state: expanded outward
const hoverArc = d3.arc<GenreData>()
  .innerRadius(radius * 0.6)
  .outerRadius(radius * 1.12)  // 12% expansion
  .padAngle(0.02)
  .cornerRadius(4);

// Drill-down inner ring (selected genre)
const innerRingArc = d3.arc()
  .innerRadius(radius * 0.25)
  .outerRadius(radius * 0.45)
  .startAngle(0)
  .endAngle(2 * Math.PI);

// Drill-down outer ring (artists)
const outerRingArc = d3.arc<ArtistData>()
  .innerRadius(radius * 0.50)
  .outerRadius(radius * 0.95)
  .padAngle(0.01)
  .cornerRadius(3);
```

### Pie Layout

```typescript
const pie = d3.pie<GenreData>()
  .value(d => d.count)
  .sort(null)  // Preserve data order (already sorted by count)
  .padAngle(0.02);
```

---

## Interactions

### Hover Behavior

```typescript
// On mouseenter
function handleSegmentHover(genre: string) {
  setHoveredSegment(genre);
  
  // D3 transition: expand hovered segment
  d3.select(`[data-genre="${genre}"]`)
    .transition()
    .duration(200)
    .ease(d3.easeOut)
    .attr('d', hoverArc);
  
  // Fade non-hovered segments
  d3.selectAll('.genre-segment')
    .filter(d => d.data.name !== genre)
    .transition()
    .duration(150)
    .style('opacity', 0.6);
}

// On mouseleave
function handleSegmentLeave() {
  setHoveredSegment(null);
  
  // Restore all segments
  d3.selectAll('.genre-segment')
    .transition()
    .duration(200)
    .ease(d3.easeOut)
    .attr('d', defaultArc)
    .style('opacity', 1);
}
```

### Click Behavior

```typescript
function handleSegmentClick(genre: string) {
  if (genre === 'Other') {
    // "Other" shows sub-genres (handled separately)
    setExpandedGenre('Other');
  } else {
    setExpandedGenre(genre);
  }
}

function handleCenterClick() {
  setExpandedGenre(null);
}
```

### Drill-Down Animation

```typescript
function animateDrillDown(genre: GenreData) {
  const svg = d3.select(svgRef.current);
  
  // 1. Fade out non-selected genres (150ms)
  svg.selectAll('.genre-segment')
    .filter(d => d.data.name !== genre.name)
    .transition()
    .duration(150)
    .style('opacity', 0)
    .remove();
  
  // 2. Morph selected genre to inner ring (400ms)
  svg.select(`[data-genre="${genre.name}"]`)
    .transition()
    .duration(400)
    .ease(d3.easeInOut)
    .attrTween('d', function() {
      const current = d3.select(this).attr('d');
      return d3.interpolatePath(current, innerRingArc());
    });
  
  // 3. Fade in artist segments (300ms, delayed 200ms)
  const artistArcs = pie(genre.artists);
  
  svg.selectAll('.artist-segment')
    .data(artistArcs)
    .enter()
    .append('path')
    .attr('class', 'artist-segment')
    .attr('fill', (d, i) => genre.artistColors[i])
    .attr('d', outerRingArc)
    .style('opacity', 0)
    .transition()
    .delay(200)
    .duration(300)
    .style('opacity', 1);
  
  // 4. Update center text
  updateCenterText(genre.name, genre.count);
  
  // 5. Show back button
  showBackButton();
}
```

---

## Labels

### Default State Labels

Labels are positioned **outside** the donut, connected by subtle leader lines for small segments:

```typescript
function renderLabels(arcs: d3.PieArcDatum<GenreData>[]) {
  const labelRadius = radius * 1.15;  // Outside the donut
  
  arcs.forEach(arc => {
    const centroid = defaultArc.centroid(arc);
    const midAngle = (arc.startAngle + arc.endAngle) / 2;
    
    // Position label
    const x = Math.cos(midAngle - Math.PI / 2) * labelRadius;
    const y = Math.sin(midAngle - Math.PI / 2) * labelRadius;
    
    // Text anchor based on position
    const textAnchor = midAngle < Math.PI ? 'start' : 'end';
    
    // Only show labels for segments > 5% (or all on desktop)
    const showLabel = arc.data.percentage > 5 || window.innerWidth > 768;
    
    if (showLabel) {
      g.append('text')
        .attr('class', 'genre-label')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', textAnchor)
        .attr('dominant-baseline', 'middle')
        .style('font-family', '"Source Sans 3", system-ui, sans-serif')
        .style('font-size', '14px')
        .style('font-weight', '500')
        .style('fill', '#1f2937')
        .text(arc.data.name);
    }
  });
}
```

### Drill-Down Labels (Artists)

For artist segments, labels appear **inside** the segment if there's room, otherwise hidden (tooltip on hover):

```typescript
function renderArtistLabels(arcs: d3.PieArcDatum<ArtistData>[]) {
  arcs.forEach(arc => {
    const angle = arc.endAngle - arc.startAngle;
    
    // Only show label if segment is large enough
    if (angle > 0.15) {  // ~8.5 degrees
      const centroid = outerRingArc.centroid(arc);
      
      g.append('text')
        .attr('class', 'artist-label')
        .attr('x', centroid[0])
        .attr('y', centroid[1])
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-family', '"Source Sans 3", system-ui, sans-serif')
        .style('font-size', '11px')
        .style('font-weight', '500')
        .style('fill', '#ffffff')
        .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
        .style('pointer-events', 'none')
        .text(truncateLabel(arc.data.name, angle));
    }
  });
}

function truncateLabel(name: string, angle: number): string {
  const maxChars = Math.floor(angle * 50);  // Rough estimate
  if (name.length <= maxChars) return name;
  return name.substring(0, maxChars - 1) + '…';
}
```

---

## Center Content

### Default State

```typescript
function renderDefaultCenter() {
  // Total count (Playfair Display)
  centerGroup.append('text')
    .attr('class', 'center-count')
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .style('font-family', '"Playfair Display", Georgia, serif')
    .style('font-size', '56px')
    .style('font-weight', '400')
    .style('fill', '#1f2937')
    .text(totalConcerts);
  
  // Label (Source Sans)
  centerGroup.append('text')
    .attr('class', 'center-label')
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .style('font-family', '"Source Sans 3", system-ui, sans-serif')
    .style('font-size', '14px')
    .style('font-weight', '400')
    .style('fill', '#6b7280')
    .text('concerts');
}
```

### Drill-Down State

```typescript
function renderDrillDownCenter(genre: GenreData) {
  // Back button
  centerGroup.append('text')
    .attr('class', 'back-button')
    .attr('y', -45)
    .attr('text-anchor', 'middle')
    .style('font-family', '"Source Sans 3", system-ui, sans-serif')
    .style('font-size', '12px')
    .style('font-weight', '500')
    .style('fill', '#6366f1')
    .style('cursor', 'pointer')
    .text('← Back')
    .on('click', handleCenterClick);
  
  // Genre name (Playfair Display)
  centerGroup.append('text')
    .attr('class', 'center-genre')
    .attr('y', 0)
    .attr('text-anchor', 'middle')
    .style('font-family', '"Playfair Display", Georgia, serif')
    .style('font-size', '28px')
    .style('font-weight', '400')
    .style('fill', '#1f2937')
    .text(genre.name);
  
  // Count
  centerGroup.append('text')
    .attr('class', 'center-count')
    .attr('y', 35)
    .attr('text-anchor', 'middle')
    .style('font-family', '"Source Sans 3", system-ui, sans-serif')
    .style('font-size', '16px')
    .style('font-weight', '400')
    .style('fill', '#6b7280')
    .text(`${genre.count} shows · ${genre.artists.length} artists`);
}
```

---

## "Other" Bucket Handling

When user clicks "Other", show sub-genres instead of artists:

```typescript
function handleOtherClick() {
  // "Other" expands to show sub-genres in outer ring
  // Each sub-genre segment is clickable to drill into its artists
  setExpandedGenre('Other');
}

function renderOtherDrillDown(otherData: GenreData) {
  // Inner ring: "Other" label
  // Outer ring: Sub-genres (sorted by count)
  
  const subGenres = otherData.subGenres.sort((a, b) => b.count - a.count);
  const subGenreArcs = pie(subGenres);
  
  // Render sub-genre segments
  subGenreArcs.forEach((arc, i) => {
    g.append('path')
      .attr('class', 'subgenre-segment')
      .attr('data-genre', arc.data.name)
      .attr('d', outerRingArc(arc))
      .attr('fill', arc.data.color)
      .style('cursor', 'pointer')
      .on('click', () => {
        // Drill into this sub-genre's artists
        setExpandedGenre(arc.data.name);
      });
  });
}
```

---

## Mobile Handling

### Responsive Sizing

```typescript
function calculateDimensions() {
  const container = containerRef.current;
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  // On mobile, constrain to 85% of viewport width
  const isMobile = width < 768;
  const maxSize = isMobile 
    ? Math.min(width * 0.85, height * 0.7)
    : Math.min(width, height) * 0.8;
  
  return {
    width: maxSize,
    height: maxSize,
    radius: maxSize / 2,
    isMobile,
  };
}
```

### Label Visibility

```typescript
function shouldShowLabel(arc: d3.PieArcDatum<GenreData>, isMobile: boolean): boolean {
  // Desktop: show all labels
  if (!isMobile) return true;
  
  // Mobile: only show labels for segments > 5%
  return arc.data.percentage > 5;
}
```

---

## Color Integration

Import from the shared color constants:

```typescript
// src/constants/colors.ts (already created per Color Specification Guide)

import { GENRE_COLORS, getGenreColor } from '@/constants/colors';

// Artist shading function
function getArtistShade(genreColor: string, index: number, total: number): string {
  const hsl = hexToHSL(genreColor);
  const lightness = 40 + (index / Math.max(total - 1, 1)) * 25;
  return hslToHex(hsl.h, hsl.s, lightness);
}
```

---

## Component Structure

```typescript
// src/components/scenes/Scene5Genres.tsx

import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { GENRE_COLORS, getGenreColor } from '@/constants/colors';
import type { Concert } from '@/types/concert';

interface Scene5GenresProps {
  concerts: Concert[];
}

export function Scene5Genres({ concerts }: Scene5GenresProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [expandedGenre, setExpandedGenre] = useState<string | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  
  // Process data
  const genreData = useMemo(() => processGenreData(concerts), [concerts]);
  
  // Find expanded genre data
  const expandedData = useMemo(() => {
    if (!expandedGenre) return null;
    if (expandedGenre === 'Other') {
      return genreData.find(g => g.name === 'Other');
    }
    // Check if it's a sub-genre within "Other"
    const other = genreData.find(g => g.name === 'Other');
    const subGenre = other?.subGenres?.find(g => g.name === expandedGenre);
    if (subGenre) return subGenre;
    // Regular genre
    return genreData.find(g => g.name === expandedGenre);
  }, [expandedGenre, genreData]);
  
  // Render effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    const { width, height, radius, isMobile } = calculateDimensions();
    
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    svg.selectAll('*').remove();
    
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);
    
    if (expandedData) {
      renderDrillDown(g, expandedData, radius, isMobile);
    } else {
      renderDefault(g, genreData, radius, isMobile);
    }
    
  }, [genreData, expandedData, hoveredSegment]);
  
  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      // Re-render on resize
      setHoveredSegment(null);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-center snap-start snap-always"
      style={{ backgroundColor: '#ede9fe' }}
    >
      {/* Title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="text-center mb-8"
      >
        <h2 
          className="text-5xl md:text-7xl text-gray-900 mb-3"
          style={{ 
            fontFamily: '"Playfair Display", Georgia, serif',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          The Music
        </h2>
        <p 
          className="text-lg md:text-xl text-gray-500"
          style={{ fontFamily: '"Source Sans 3", system-ui, sans-serif' }}
        >
          A diverse sonic journey
        </p>
      </motion.div>
      
      {/* Donut Container */}
      <motion.div
        ref={containerRef}
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="flex-1 flex items-center justify-center w-full max-w-4xl"
      >
        <svg ref={svgRef} />
      </motion.div>
      
      {/* Hint Text */}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="text-sm text-gray-400 mt-4"
        style={{ fontFamily: '"Source Sans 3", system-ui, sans-serif' }}
      >
        Click a genre to explore artists
      </motion.p>
    </motion.section>
  );
}
```

---

## Implementation Checklist

### Phase 1: Setup & Data
- [ ] Create `src/constants/colors.ts` with GENRE_COLORS from Color Specification Guide
- [ ] Add `hexToHSL` and `hslToHex` utility functions
- [ ] Add `getArtistShade` function
- [ ] Update `index.html` with Google Fonts (Playfair Display, Source Sans 3)
- [ ] Update `tailwind.config.js` with font families

### Phase 2: Basic Donut (Default State)
- [ ] Remove existing Scene5Genres.tsx implementation
- [ ] Implement `processGenreData()` function
- [ ] Implement basic donut with `d3.pie()` and `d3.arc()`
- [ ] Apply Concert Poster palette colors
- [ ] Add center content (total count)
- [ ] Add genre labels (outside donut)
- [ ] Verify 3% "Other" bucket works

### Phase 3: Hover Interactions
- [ ] Implement `handleSegmentHover()` — expand segment 12%
- [ ] Implement `handleSegmentLeave()` — restore segment
- [ ] Add opacity fade on non-hovered segments
- [ ] Test hover transitions (200ms)

### Phase 4: Drill-Down (Click Genre)
- [ ] Implement `handleSegmentClick()`
- [ ] Implement `animateDrillDown()` — morph animation
- [ ] Render inner ring (selected genre)
- [ ] Render outer ring (artists, alpha sorted)
- [ ] Update center content (genre name, counts)
- [ ] Add "← Back" button
- [ ] Implement `handleCenterClick()` — reset to default

### Phase 5: "Other" Bucket
- [ ] Handle "Other" click → show sub-genres
- [ ] Sub-genre segments clickable → drill to artists
- [ ] Back button returns to "Other" view, then to default

### Phase 6: Labels
- [ ] Genre labels outside donut (default state)
- [ ] Artist labels inside segments (drill-down, if room)
- [ ] Truncation logic for long names
- [ ] Mobile: hide labels for segments < 5%

### Phase 7: Mobile & Polish
- [ ] Responsive sizing (85% viewport width on mobile)
- [ ] Test touch interactions
- [ ] Verify animations on mobile
- [ ] Update background to `#ede9fe`
- [ ] Typography audit (Playfair/Source Sans)

### Phase 8: Testing
- [ ] Test with full 175 concert dataset
- [ ] Verify all 20 genres have correct colors
- [ ] Test drill-down for each major genre
- [ ] Test "Other" bucket flow
- [ ] Test reset (click center)
- [ ] Test window resize behavior
- [ ] Cross-browser testing

---

## Files to Modify

| File | Action |
|------|--------|
| `src/components/scenes/Scene5Genres.tsx` | **Replace entirely** |
| `src/constants/colors.ts` | **Create new** |
| `src/index.css` | Add Google Fonts import |
| `tailwind.config.js` | Add font families |
| `index.html` | Add Google Fonts preconnect |

---

## Dependencies

No new dependencies required. Uses existing:
- `d3` (already installed)
- `framer-motion` (already installed)

---

## Acceptance Criteria

1. ✅ Default view shows single-ring donut with all genres
2. ✅ Genres are colored per Concert Poster palette
3. ✅ "Other" bucket contains genres < 3%
4. ✅ Hover expands segment outward 12%
5. ✅ Click genre drills down to two-ring view (genre + artists)
6. ✅ Artists are alpha-sorted in outer ring
7. ✅ Click "Other" shows sub-genres, then artists
8. ✅ Click center (or Back button) resets to default
9. ✅ Labels are horizontal and readable
10. ✅ Typography uses Playfair Display (stats) and Source Sans 3 (labels)
11. ✅ Background is soft violet (`#ede9fe`)
12. ✅ Animations are smooth (200-400ms)
13. ✅ Works on mobile (scaled, smart label hiding)

---

## Related Documents

- [Color Specification Guide](./Morperhaus-Color-Specification-Guide.md)
- [Scene Design Guide](./Morperhaus-Scene-Design-Guide.md)
- [Band Scene Plan](./Band_Scene_Plan) — Reference for artist data handling
