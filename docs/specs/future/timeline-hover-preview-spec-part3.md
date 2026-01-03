# Timeline Hover Preview — Part 3: Technical Implementation

**Continues from:** Part 1 (Visual Design), Part 2 (Interaction & Animation)

---

## Component Architecture

### File Structure

```
src/components/scenes/
├── Scene1Hero.tsx                    # MODIFY: Main scene (remove modal, add popup integration)
└── TimelineHoverPreview/
    ├── index.ts                      # Barrel export
    ├── TimelineHoverPreview.tsx      # Main popup component
    ├── TimelinePopupContent.tsx      # Inner content (image, text)
    ├── useTimelineHover.ts           # Hover state management hook
    ├── useArtistMetadata.ts          # Metadata loading hook
    ├── types.ts                      # TypeScript interfaces
    └── constants.ts                  # Timing/dimension constants
```

### Component Hierarchy

```
Scene1Hero
├── <svg> (D3 timeline - existing)
│   └── year dots with hover handlers (modified)
└── <TimelineHoverPreview>            # NEW
    └── <AnimatePresence>
        └── <TimelinePopupContent>
            ├── Image container (with parallax)
            ├── Artist + Venue text
            ├── "+ X more" text
            └── Year · count footer
```

---

## TypeScript Interfaces

### `types.ts`

```typescript
import type { Concert } from '../../../types/concert';

/**
 * Artist metadata from artists-metadata.json
 */
export interface ArtistMetadata {
  name: string;
  normalizedName?: string;
  
  // TheAudioDB fields (current)
  image?: string;
  bio?: string;
  genres?: string[];
  formed?: string;
  website?: string;
  source?: 'theaudiodb' | 'lastfm' | 'manual' | 'mock';
  fetchedAt?: string;
  
  // Spotify fields (future)
  mostPopularAlbum?: {
    name: string;
    coverArt: {
      small?: string;
      medium?: string;
      large?: string;
    };
  };
  spotifyArtistUrl?: string;
}

/**
 * Map of normalized artist name -> metadata
 */
export type ArtistMetadataMap = Record<string, ArtistMetadata>;

/**
 * Position of a year dot on the timeline
 */
export interface YearDotPosition {
  year: number;
  x: number;           // Center X coordinate
  y: number;           // Center Y coordinate (typically innerHeight / 2)
  radius: number;      // Visual radius of the dot
  index: number;       // Index in sorted year array (for above/below calc)
}

/**
 * Popup vertical position
 */
export type PopupPosition = 'above' | 'below';

/**
 * Featured concert for popup display
 */
export interface FeaturedConcert {
  concert: Concert;
  imageUrl: string;
  artistName: string;
  venueName: string;
}

/**
 * Computed popup content
 */
export interface PopupContent {
  featured: FeaturedConcert;
  additionalCount: number;  // Number of other concerts that year
  totalShows: number;       // Total concerts that year
  year: number;
}

/**
 * Hover session state
 */
export interface HoverSessionState {
  isActive: boolean;
  position: PopupPosition | null;
  activeYear: number | null;
  dotPosition: YearDotPosition | null;
  content: PopupContent | null;
}

/**
 * Parallax offset for image
 */
export interface ParallaxOffset {
  x: number;
  y: number;
}

/**
 * Props for the main hover preview component
 */
export interface TimelineHoverPreviewProps {
  concerts: Concert[];
  metadata: ArtistMetadataMap;
  yearPositions: Map<number, YearDotPosition>;
  containerRect: DOMRect | null;
  hoverState: HoverSessionState;
  onParallaxMove: (offset: ParallaxOffset) => void;
}

/**
 * Props for popup content component
 */
export interface TimelinePopupContentProps {
  content: PopupContent;
  imageUrl: string;
  parallaxOffset: ParallaxOffset;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

/**
 * Return type for useTimelineHover hook
 */
export interface UseTimelineHoverReturn {
  state: HoverSessionState;
  parallaxOffset: ParallaxOffset;
  handlers: {
    onDotEnter: (year: number, position: YearDotPosition) => void;
    onDotLeave: () => void;
    onPopupMouseMove: (e: React.MouseEvent) => void;
    onPopupMouseLeave: () => void;
  };
}
```

---

## Constants

### `constants.ts`

```typescript
/**
 * Timing constants (in milliseconds)
 */
export const TIMING = {
  /** Delay before popup appears after hovering dot */
  HOVER_DELAY: 120,
  
  /** Duration popup stays visible after leaving dot */
  LINGER_DURATION: 300,
  
  /** Entry animation duration */
  ENTRY_DURATION: 200,
  
  /** Exit animation duration */
  EXIT_DURATION: 200,
  
  /** Content crossfade duration (each direction) */
  CROSSFADE_DURATION: 90,
  
  /** Frame position slide duration */
  SLIDE_DURATION: 250,
} as const;

/**
 * Dimension constants (in pixels)
 */
export const DIMENSIONS = {
  /** Popup total width */
  POPUP_WIDTH: 220,
  
  /** Image container width */
  IMAGE_WIDTH: 188,
  
  /** Image container height */
  IMAGE_HEIGHT: 140,
  
  /** Popup padding */
  POPUP_PADDING: 16,
  
  /** Gap between dot and popup */
  DOT_GAP: 12,
  
  /** Minimum distance from container edge */
  EDGE_PADDING: 16,
  
  /** Border radius for popup */
  POPUP_RADIUS: 12,
  
  /** Border radius for image container */
  IMAGE_RADIUS: 8,
  
  /** Arrow pointer size */
  ARROW_SIZE: 8,
} as const;

/**
 * Parallax constants
 */
export const PARALLAX = {
  /** Maximum pixel shift in any direction */
  MAX_SHIFT: 6,
  
  /** Image scale factor (to prevent edge exposure) */
  IMAGE_SCALE: 1.1,
} as const;

/**
 * Animation easing curves
 */
export const EASING = {
  /** Entry animation */
  ENTRY: [0, 0, 0.2, 1], // ease-out
  
  /** Exit animation */
  EXIT: [0.4, 0, 1, 1], // ease-in
  
  /** Crossfade */
  CROSSFADE: [0.4, 0, 0.6, 1], // ease-in-out
  
  /** Position slide */
  SLIDE: [0.4, 0, 0.2, 1], // smooth
} as const;

/**
 * Color constants
 */
export const COLORS = {
  POPUP_BG: '#1e1e3f',
  POPUP_BORDER: '#3730a3',
  TEXT_PRIMARY: '#ffffff',
  TEXT_SECONDARY: '#94a3b8',
  TEXT_ACCENT: '#6366f1',
  DIVIDER: 'rgba(99, 102, 241, 0.2)',
} as const;
```

---

## Core Hook: `useTimelineHover.ts`

```typescript
import { useState, useCallback, useRef, useMemo } from 'react';
import type { Concert } from '../../../types/concert';
import type {
  ArtistMetadataMap,
  YearDotPosition,
  HoverSessionState,
  ParallaxOffset,
  PopupContent,
  UseTimelineHoverReturn,
} from './types';
import { TIMING, PARALLAX, DIMENSIONS } from './constants';

/**
 * Normalize artist name for metadata lookup
 */
function normalizeArtistName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Get image URL for an artist (Spotify priority, AudioDB fallback)
 */
function getArtistImageUrl(
  headliner: string,
  metadata: ArtistMetadataMap
): string | null {
  const key = normalizeArtistName(headliner);
  const meta = metadata[key];
  
  if (!meta) return null;
  
  // Priority 1: Spotify album art (future)
  if (meta.mostPopularAlbum?.coverArt?.medium) {
    return meta.mostPopularAlbum.coverArt.medium;
  }
  
  // Priority 2: TheAudioDB artist photo
  if (meta.image) {
    return meta.image;
  }
  
  return null;
}

/**
 * Select a featured concert from a year (only from artists with images)
 */
function selectFeaturedConcert(
  concerts: Concert[],
  year: number,
  metadata: ArtistMetadataMap
): PopupContent | null {
  const yearConcerts = concerts.filter(c => c.year === year);
  
  if (yearConcerts.length === 0) return null;
  
  // Filter to concerts where headliner has an image
  const withImages = yearConcerts.filter(c => {
    return getArtistImageUrl(c.headliner, metadata) !== null;
  });
  
  // If no artists have images, return null (no popup)
  if (withImages.length === 0) return null;
  
  // Random selection
  const randomIndex = Math.floor(Math.random() * withImages.length);
  const featured = withImages[randomIndex];
  const imageUrl = getArtistImageUrl(featured.headliner, metadata)!;
  
  return {
    featured: {
      concert: featured,
      imageUrl,
      artistName: featured.headliner,
      venueName: featured.venue,
    },
    additionalCount: yearConcerts.length - 1,
    totalShows: yearConcerts.length,
    year,
  };
}

/**
 * Calculate parallax offset from cursor position
 */
function calculateParallax(
  cursorX: number,
  cursorY: number,
  popupRect: DOMRect | null
): ParallaxOffset {
  if (!popupRect) return { x: 0, y: 0 };
  
  const centerX = popupRect.left + popupRect.width / 2;
  const centerY = popupRect.top + popupRect.height / 2;
  
  const normalizedX = (cursorX - centerX) / (popupRect.width / 2);
  const normalizedY = (cursorY - centerY) / (popupRect.height / 2);
  
  const clampedX = Math.max(-1, Math.min(1, normalizedX));
  const clampedY = Math.max(-1, Math.min(1, normalizedY));
  
  return {
    x: -clampedX * PARALLAX.MAX_SHIFT,
    y: -clampedY * PARALLAX.MAX_SHIFT,
  };
}

/**
 * Main hook for timeline hover state management
 */
export function useTimelineHover(
  concerts: Concert[],
  metadata: ArtistMetadataMap
): UseTimelineHoverReturn {
  // Session state
  const [state, setState] = useState<HoverSessionState>({
    isActive: false,
    position: null,
    activeYear: null,
    dotPosition: null,
    content: null,
  });
  
  // Parallax state
  const [parallaxOffset, setParallaxOffset] = useState<ParallaxOffset>({ x: 0, y: 0 });
  
  // Refs for timers
  const hoverTimerRef = useRef<number | null>(null);
  const lingerTimerRef = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  
  // Reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  
  /**
   * Handle dot enter
   */
  const onDotEnter = useCallback((year: number, position: YearDotPosition) => {
    // Clear any pending linger timer
    if (lingerTimerRef.current) {
      clearTimeout(lingerTimerRef.current);
      lingerTimerRef.current = null;
    }
    
    // If already active on same year, do nothing
    if (state.isActive && state.activeYear === year) return;
    
    // If session already active (moving between dots), transition immediately
    if (state.isActive) {
      const content = selectFeaturedConcert(concerts, year, metadata);
      if (content) {
        setState(prev => ({
          ...prev,
          activeYear: year,
          dotPosition: position,
          content,
          // Keep same position (above/below) for session
        }));
      }
      return;
    }
    
    // New session: start hover delay timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    
    hoverTimerRef.current = window.setTimeout(() => {
      const content = selectFeaturedConcert(concerts, year, metadata);
      
      // Only show popup if we have content (artist with image)
      if (content) {
        const sessionPosition = position.index % 2 === 0 ? 'below' : 'above';
        
        setState({
          isActive: true,
          position: sessionPosition,
          activeYear: year,
          dotPosition: position,
          content,
        });
      }
      
      hoverTimerRef.current = null;
    }, TIMING.HOVER_DELAY);
  }, [concerts, metadata, state.isActive, state.activeYear]);
  
  /**
   * Handle dot leave
   */
  const onDotLeave = useCallback(() => {
    // Clear hover timer if pending
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    
    // If not active, nothing to do
    if (!state.isActive) return;
    
    // Start linger timer
    lingerTimerRef.current = window.setTimeout(() => {
      setState({
        isActive: false,
        position: null,
        activeYear: null,
        dotPosition: null,
        content: null,
      });
      setParallaxOffset({ x: 0, y: 0 });
      lingerTimerRef.current = null;
    }, TIMING.LINGER_DURATION);
  }, [state.isActive]);
  
  /**
   * Handle mouse move over popup (for parallax)
   */
  const onPopupMouseMove = useCallback((e: React.MouseEvent) => {
    if (prefersReducedMotion) return;
    
    const rect = popupRef.current?.getBoundingClientRect() ?? null;
    const offset = calculateParallax(e.clientX, e.clientY, rect);
    setParallaxOffset(offset);
  }, [prefersReducedMotion]);
  
  /**
   * Handle mouse leave popup
   */
  const onPopupMouseLeave = useCallback(() => {
    setParallaxOffset({ x: 0, y: 0 });
  }, []);
  
  return {
    state,
    parallaxOffset,
    handlers: {
      onDotEnter,
      onDotLeave,
      onPopupMouseMove,
      onPopupMouseLeave,
    },
  };
}
```

---

## Metadata Loading Hook: `useArtistMetadata.ts`

```typescript
import { useState, useEffect } from 'react';
import type { ArtistMetadataMap } from './types';

/**
 * Load artist metadata from JSON file
 */
export function useArtistMetadata(): {
  metadata: ArtistMetadataMap;
  isLoading: boolean;
  error: Error | null;
} {
  const [metadata, setMetadata] = useState<ArtistMetadataMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    fetch('/data/artists-metadata.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load artist metadata');
        return res.json();
      })
      .then(data => {
        // Handle both flat and nested structures
        const artists = data.artists || data;
        setMetadata(artists);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load artist metadata:', err);
        setError(err);
        setIsLoading(false);
      });
  }, []);
  
  return { metadata, isLoading, error };
}
```

---

## Main Popup Component: `TimelineHoverPreview.tsx`

```typescript
import { useRef, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimelinePopupContent } from './TimelinePopupContent';
import { TIMING, DIMENSIONS, COLORS, EASING } from './constants';
import type { TimelineHoverPreviewProps } from './types';

export const TimelineHoverPreview = forwardRef<HTMLDivElement, TimelineHoverPreviewProps>(
  function TimelineHoverPreview(
    { hoverState, containerRect, onParallaxMove },
    ref
  ) {
    const { isActive, position, dotPosition, content } = hoverState;
    
    if (!isActive || !content || !dotPosition || !containerRect) {
      return null;
    }
    
    // Calculate popup position
    const popupX = calculatePopupX(dotPosition.x, containerRect.width);
    const popupY = calculatePopupY(dotPosition, position!);
    const arrowOffset = dotPosition.x - popupX - DIMENSIONS.POPUP_WIDTH / 2;
    
    return (
      <AnimatePresence>
        {isActive && (
          <motion.div
            ref={ref}
            className="timeline-popup-frame"
            initial={{ 
              opacity: 0, 
              scale: 0.95,
              y: position === 'above' ? 8 : -8,
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: 0,
              left: popupX,
              top: popupY,
            }}
            exit={{ 
              opacity: 0,
              transition: { duration: TIMING.EXIT_DURATION / 1000 }
            }}
            transition={{
              opacity: { duration: TIMING.ENTRY_DURATION / 1000 },
              scale: { duration: TIMING.ENTRY_DURATION / 1000 },
              y: { duration: TIMING.ENTRY_DURATION / 1000 },
              left: { duration: TIMING.SLIDE_DURATION / 1000, ease: EASING.SLIDE },
              top: { duration: TIMING.SLIDE_DURATION / 1000, ease: EASING.SLIDE },
            }}
            style={{
              position: 'absolute',
              width: DIMENSIONS.POPUP_WIDTH,
              backgroundColor: COLORS.POPUP_BG,
              border: `1px solid ${COLORS.POPUP_BORDER}`,
              borderRadius: DIMENSIONS.POPUP_RADIUS,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
              zIndex: 50,
              pointerEvents: 'auto',
            }}
          >
            {/* Arrow pointer */}
            <div
              className="popup-arrow"
              style={{
                position: 'absolute',
                [position === 'above' ? 'bottom' : 'top']: -DIMENSIONS.ARROW_SIZE,
                left: DIMENSIONS.POPUP_WIDTH / 2 + arrowOffset - DIMENSIONS.ARROW_SIZE,
                width: 0,
                height: 0,
                borderLeft: `${DIMENSIONS.ARROW_SIZE}px solid transparent`,
                borderRight: `${DIMENSIONS.ARROW_SIZE}px solid transparent`,
                [position === 'above' ? 'borderTop' : 'borderBottom']: 
                  `${DIMENSIONS.ARROW_SIZE}px solid ${COLORS.POPUP_BG}`,
              }}
            />
            
            {/* Content with crossfade */}
            <AnimatePresence mode="wait">
              <motion.div
                key={content.year}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: TIMING.CROSSFADE_DURATION / 1000 }}
              >
                <TimelinePopupContent
                  content={content}
                  onMouseMove={onParallaxMove}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

/**
 * Calculate horizontal position with edge clamping
 */
function calculatePopupX(dotX: number, containerWidth: number): number {
  const idealX = dotX - DIMENSIONS.POPUP_WIDTH / 2;
  const minX = DIMENSIONS.EDGE_PADDING;
  const maxX = containerWidth - DIMENSIONS.POPUP_WIDTH - DIMENSIONS.EDGE_PADDING;
  return Math.max(minX, Math.min(idealX, maxX));
}

/**
 * Calculate vertical position based on above/below
 */
function calculatePopupY(
  dotPosition: { y: number; radius: number },
  position: 'above' | 'below'
): number {
  const estimatedHeight = 240; // Approximate popup height
  
  if (position === 'above') {
    return dotPosition.y - dotPosition.radius - DIMENSIONS.DOT_GAP - estimatedHeight;
  } else {
    return dotPosition.y + dotPosition.radius + DIMENSIONS.DOT_GAP;
  }
}
```

---

## Popup Content Component: `TimelinePopupContent.tsx`

```typescript
import { useRef } from 'react';
import { DIMENSIONS, COLORS, PARALLAX } from './constants';
import type { PopupContent, ParallaxOffset } from './types';

interface Props {
  content: PopupContent;
  parallaxOffset: ParallaxOffset;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

export function TimelinePopupContent({
  content,
  parallaxOffset,
  onMouseMove,
  onMouseLeave,
}: Props) {
  const { featured, additionalCount, totalShows, year } = content;
  
  return (
    <div style={{ padding: DIMENSIONS.POPUP_PADDING }}>
      {/* Image container */}
      <div
        style={{
          width: DIMENSIONS.IMAGE_WIDTH,
          height: DIMENSIONS.IMAGE_HEIGHT,
          borderRadius: DIMENSIONS.IMAGE_RADIUS,
          overflow: 'hidden',
          marginBottom: 12,
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <img
          src={featured.imageUrl}
          alt={featured.artistName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate(${parallaxOffset.x}px, ${parallaxOffset.y}px) scale(${PARALLAX.IMAGE_SCALE})`,
            transition: 'transform 0ms linear',
          }}
          loading="eager"
          draggable={false}
        />
      </div>
      
      {/* Artist at Venue */}
      <div
        style={{
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.TEXT_PRIMARY,
          lineHeight: 1.3,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {featured.artistName} at {featured.venueName}
      </div>
      
      {/* + X more (conditional) */}
      {additionalCount > 0 && (
        <div
          style={{
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 400,
            color: COLORS.TEXT_SECONDARY,
            lineHeight: 1.4,
          }}
        >
          + {additionalCount} more
        </div>
      )}
      
      {/* Year · count footer */}
      <div
        style={{
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 500,
          color: COLORS.TEXT_ACCENT,
          lineHeight: 1.4,
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${COLORS.DIVIDER}`,
        }}
      >
        {year} · {totalShows} show{totalShows !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
```

---

## D3 Integration in Scene1Hero.tsx

### Modifications Required

The existing `Scene1Hero.tsx` needs these changes:

1. **Remove** the modal state and rendering
2. **Add** hover preview integration
3. **Modify** D3 dot event handlers
4. **Track** year dot positions for popup placement

### Key Changes

```typescript
// ADD: Imports
import { TimelineHoverPreview } from './TimelineHoverPreview';
import { useTimelineHover } from './TimelineHoverPreview/useTimelineHover';
import { useArtistMetadata } from './TimelineHoverPreview/useArtistMetadata';

// REMOVE: selectedYear state
// const [selectedYear, setSelectedYear] = useState<number | null>(null)

// ADD: Hover preview state
const { metadata } = useArtistMetadata();
const [yearPositions, setYearPositions] = useState<Map<number, YearDotPosition>>(new Map());
const containerRef = useRef<HTMLDivElement>(null);
const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

const { state: hoverState, parallaxOffset, handlers } = useTimelineHover(
  concerts,
  metadata
);

// ADD: Track container rect
useEffect(() => {
  if (!containerRef.current) return;
  const updateRect = () => {
    setContainerRect(containerRef.current!.getBoundingClientRect());
  };
  updateRect();
  window.addEventListener('resize', updateRect);
  return () => window.removeEventListener('resize', updateRect);
}, []);

// MODIFY: In D3 useEffect, track dot positions and update handlers
yearArray.forEach((year, index) => {
  // ... existing dot creation code ...
  
  // Store position for popup placement
  positions.set(year, {
    year,
    x: x + margin.left,  // Account for SVG margin
    y: innerHeight / 2 + margin.top,
    radius,
    index,
  });
  
  // MODIFY: Event handlers
  touchTarget
    .on('mouseenter', function() {
      // Existing hover animation...
      
      // NEW: Trigger popup
      handlers.onDotEnter(year, positions.get(year)!);
    })
    .on('mouseleave', function() {
      // Existing hover animation reset...
      
      // NEW: Trigger popup exit
      handlers.onDotLeave();
    });
    
  // REMOVE: Click handler
  // .on('click', () => setSelectedYear(year))
});

setYearPositions(positions);

// REMOVE: Entire modal AnimatePresence block

// ADD: Render popup
return (
  <motion.section ref={containerRef} ...>
    {/* ... existing content ... */}
    
    <TimelineHoverPreview
      concerts={concerts}
      metadata={metadata}
      yearPositions={yearPositions}
      containerRect={containerRect}
      hoverState={hoverState}
      parallaxOffset={parallaxOffset}
      onParallaxMove={handlers.onPopupMouseMove}
    />
  </motion.section>
);
```

---

## Implementation Checklist

### Phase 1: Setup & Types

- [ ] Create `src/components/scenes/TimelineHoverPreview/` directory
- [ ] Create `types.ts` with all TypeScript interfaces
- [ ] Create `constants.ts` with timing/dimension/color constants
- [ ] Create `index.ts` barrel export

### Phase 2: Hooks

- [ ] Create `useArtistMetadata.ts` hook
- [ ] Verify it loads from `/data/artists-metadata.json`
- [ ] Create `useTimelineHover.ts` hook
- [ ] Implement `normalizeArtistName()` function
- [ ] Implement `getArtistImageUrl()` with Spotify → AudioDB priority
- [ ] Implement `selectFeaturedConcert()` with image-only filtering
- [ ] Implement `calculateParallax()` function
- [ ] Implement hover delay timer logic (120ms)
- [ ] Implement linger timer logic (300ms)
- [ ] Implement session position persistence (above/below)
- [ ] Add `prefers-reduced-motion` detection

### Phase 3: Components

- [ ] Create `TimelinePopupContent.tsx`
- [ ] Implement image container with parallax transform
- [ ] Implement artist + venue text line
- [ ] Implement "+ X more" conditional text
- [ ] Implement year · count footer with divider
- [ ] Verify text truncation on long venue names

- [ ] Create `TimelineHoverPreview.tsx`
- [ ] Implement position calculation (X with edge clamping)
- [ ] Implement position calculation (Y above/below)
- [ ] Implement arrow pointer with offset for clamped positions
- [ ] Implement entry animation (fade + scale + Y translate)
- [ ] Implement exit animation (fade)
- [ ] Implement content crossfade with AnimatePresence
- [ ] Implement position slide animation

### Phase 4: Scene1Hero Integration

- [ ] Add `useArtistMetadata` hook call
- [ ] Add `useTimelineHover` hook call
- [ ] Add container ref and rect tracking
- [ ] Add `yearPositions` state
- [ ] Modify D3 useEffect to track dot positions
- [ ] Modify D3 mouseenter handler to call `onDotEnter`
- [ ] Modify D3 mouseleave handler to call `onDotLeave`
- [ ] **Remove** click handler from dots
- [ ] **Remove** `selectedYear` state
- [ ] **Remove** `selectedYearConcerts` derived state
- [ ] **Remove** modal AnimatePresence block
- [ ] Add `TimelineHoverPreview` component to render

### Phase 5: Polish & Edge Cases

- [ ] Test rapid mouse movement (hover delay prevents flicker)
- [ ] Test moving between adjacent dots (crossfade works)
- [ ] Test edge clamping on first/last dots
- [ ] Test years with no images (no popup appears)
- [ ] Test single-concert years (no "+ X more" line)
- [ ] Test reduced motion preference (simplified animations)
- [ ] Test on various viewport widths
- [ ] Verify parallax feels smooth (not jittery)

### Phase 6: Cleanup

- [ ] Remove any unused imports from Scene1Hero.tsx
- [ ] Verify TypeScript strict mode passes
- [ ] Run production build to check bundle size
- [ ] Test in production build (not just dev)

---

## Testing Considerations

### Manual Testing Checklist

| Test Case | Expected Result |
|-----------|-----------------|
| Hover dot for <120ms, leave | No popup appears |
| Hover dot for >120ms | Popup fades in with scale animation |
| Leave dot, return within 300ms | Popup stays visible |
| Leave dot for >300ms | Popup fades out |
| Move cursor between dots | Content crossfades, frame slides |
| Move cursor across timeline quickly | No popups (delay prevents) |
| Hover year with no images | No popup, dot still glows |
| Hover single-concert year | No "+ X more" line |
| Move cursor within popup | Image parallax moves |
| Popup near left edge | Clamped, arrow still points to dot |
| Popup near right edge | Clamped, arrow still points to dot |
| Enable reduced motion in OS | No parallax, simplified animations |
| Resize window while popup visible | Popup repositions correctly |

### Automated Testing (Future)

Reference `docs/specs/future/visual-testing-suite.md` for Puppeteer test requirements:

- [ ] Popup renders at correct position
- [ ] Content matches expected format
- [ ] Animations complete without errors
- [ ] No console errors during interaction

---

## Performance Notes

### Image Loading

- Images load on hover (not preloaded)
- Consider preloading adjacent year images as enhancement
- TheAudioDB images are externally hosted — verify CORS works

### Animation Performance

- Use `will-change` on animated elements
- Throttle parallax with `requestAnimationFrame`
- Keep DOM nodes minimal (single popup instance, content swaps)

### Memory

- Metadata loaded once, memoized
- Year positions computed once per resize
- Hover state is lightweight (no large objects)

---

## Summary: Part 3 Decisions

| Aspect | Decision |
|--------|----------|
| File structure | Dedicated `TimelineHoverPreview/` directory |
| State management | Custom hook with useReducer-style logic |
| Metadata loading | Separate hook, loaded once at mount |
| D3 integration | Modify existing handlers, track positions |
| Parallax throttling | requestAnimationFrame |
| Bundle impact | Minimal — mostly reuses existing dependencies |

---

## Related Specs

- `docs/specs/future/timeline-artist-display-enhancement.md` — Future modal expansion
- `docs/specs/future/mobile-optimization.md` — Touch interaction strategy
- `docs/specs/future/visual-testing-suite.md` — Automated testing

---

*Spec Version: 1.0*  
*Author: Claude (Lead Designer)*  
*Date: January 2026*
