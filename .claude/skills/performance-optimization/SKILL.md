# Performance Optimization Skill

**Version:** 1.0.0
**Last Updated:** 2026-01-09

---

## Overview

Performance is critical for the Morperhaus Concert Archives due to:
- 178+ concerts with rich metadata
- 5 interactive D3.js visualizations
- High-resolution images (artist photos, venue photos)
- Real-time filtering and data transformations
- Complex animations and transitions

**Core Principles:**
- Optimize for perceived performance (loading states, skeleton screens)
- Lazy load non-critical resources
- Memoize expensive computations
- Minimize re-renders
- Use appropriate data structures

---

## Build Optimization

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,  // For debugging production issues
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Path aliasing
    },
  },
})
```

**Key features:**
- Fast HMR (Hot Module Replacement) in dev
- Automatic code splitting
- Tree shaking for unused code
- ES modules for optimal loading

### Bundle Analysis

```bash
# Install bundle analyzer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'

plugins: [
  react(),
  visualizer({ open: true })
]

# Build and analyze
npm run build
```

**What to look for:**
- Large dependencies (D3, Leaflet, Framer Motion)
- Duplicate code across chunks
- Unused imports

---

## Data Loading Optimization

### 1. Static Data Files

Concert data is pre-generated and served statically:

```typescript
// App.tsx - Single data fetch on mount
useEffect(() => {
  setLoading(true)
  fetch('/data/concerts.json')
    .then(res => res.json())
    .then(data => {
      setData(data)
      setLoading(false)
    })
    .catch(err => {
      console.error('Failed to load concert data:', err)
      setLoading(false)
    })
}, [])
```

**Why this works:**
- Data is generated at build time (`npm run build-data`)
- No database queries at runtime
- CDN-cacheable
- Predictable load time

**File sizes:**
- `concerts.json`: ~100KB
- `artists-metadata.json`: ~50KB
- `venues-metadata.json`: ~30KB

### 2. Data Structure Optimization

Pre-compute expensive operations during build:

```typescript
// scripts/build-data.ts
const concert = {
  id: `${date}-${normalizedArtist}`,
  headliner: artist,
  headlinerNormalized: normalizeArtistName(artist),  // Pre-normalized
  venueNormalized: normalizeVenueName(venue),        // Pre-normalized
  year: new Date(date).getFullYear(),                // Pre-computed
  // ...
}
```

**Benefits:**
- No normalization at runtime
- No date parsing at runtime
- Smaller JSON payloads

### 3. Lazy Loading Images

Artist and venue images are loaded on-demand:

```typescript
// Use native lazy loading
<img
  src={imageUrl}
  loading="lazy"  // Browser-native lazy load
  decoding="async"
  alt={artistName}
/>

// Or Intersection Observer for more control
useEffect(() => {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImage(entry.target)
          observer.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '200px' }  // Load 200px before visible
  )

  observer.observe(imgRef.current)
  return () => observer.disconnect()
}, [])
```

**When to use:**
- Artist mosaic cards (100+ images)
- Venue photos in map popups
- Gatefold artist photos

---

## React Performance Patterns

### 1. useMemo for Expensive Computations

Memoize calculations that depend on specific inputs:

```typescript
// ✅ GOOD: Memoize expensive venue statistics
const venueStats = useMemo(() => {
  const venueCounts = new Map<string, number>()
  const venueHeadliners = new Map<string, Map<string, number>>()

  concerts.forEach(concert => {
    // Complex nested computations...
  })

  return { venueCounts, venueHeadliners, venueOpeners }
}, [concerts])  // Only recompute when concerts change

// ✅ GOOD: Memoize sorting
const sortedArtists = useMemo(() => {
  return artists.sort((a, b) => b.timesSeen - a.timesSeen)
}, [artists])

// ❌ BAD: Expensive computation without memoization
function Scene() {
  const venues = concerts.map(/* ... */)  // Runs every render!
  const sorted = venues.sort(/* ... */)    // Runs every render!
  // ...
}
```

**When to use useMemo:**
- Array transformations (map, filter, sort)
- Object/Map/Set construction from large datasets
- Complex calculations (statistics, aggregations)
- D3 scale computations

**When NOT to use:**
- Simple primitives or references
- Computations faster than the memoization overhead
- Values that change frequently anyway

### 2. useCallback for Event Handlers

Stabilize function references to prevent child re-renders:

```typescript
// ✅ GOOD: Stable callback reference
const handleCardClick = useCallback((artist: ArtistCard, rect: DOMRect) => {
  setOpenArtist(artist)
  setClickedTileRect(rect)
  analytics.trackEvent('artist_card_opened', { /* ... */ })
}, [])  // No dependencies = stable reference

// Pass to child
<ArtistCard onClick={handleCardClick} />

// ❌ BAD: New function every render
function Scene() {
  return (
    <ArtistCard
      onClick={(artist, rect) => {
        setOpenArtist(artist)  // New function reference each render!
      }}
    />
  )
}
```

**When to use useCallback:**
- Callbacks passed as props to child components
- Dependencies for other hooks
- Event handlers in useEffect

**When NOT to use:**
- Simple inline handlers that don't cause re-renders
- Handlers that change frequently anyway

### 3. React.memo for Component Memoization

Prevent unnecessary re-renders of pure components:

```typescript
// ✅ GOOD: Memoize expensive visualization component
export const GenreTreemap = React.memo(({
  genres,
  currentYear,
  width,
  height
}: Props) => {
  // Expensive D3 layout computations...
  const tiles = useTreemapLayout(genres, width, height)

  return (
    <svg>{/* Render tiles */}</svg>
  )
})

// Component only re-renders when props actually change
```

**When to use React.memo:**
- Complex visualization components
- Components with expensive render logic
- Components that receive stable props
- List item components

**When NOT to use:**
- Simple presentational components
- Components with frequently changing props
- Components that always re-render anyway

---

## D3.js Optimization

### 1. Efficient Updates with Enter/Update/Exit

Use D3's data join pattern for minimal DOM manipulation:

```typescript
// ✅ GOOD: Efficient data join
const node = g.selectAll('g')
  .data(nodes, (d: any) => d.id)  // Key function for stable identity
  .join(
    enter => enter.append('g')
      .attr('opacity', 0)
      .call(enter => enter.transition().duration(800)
        .attr('opacity', 1)
      ),
    update => update
      .call(update => update.transition().duration(600)
        .attr('opacity', 1)
      ),
    exit => exit.call(exit => exit.transition().duration(600)
      .attr('opacity', 0)
      .remove()
    )
  )

// ❌ BAD: Remove and re-create everything
svg.selectAll('*').remove()
nodes.forEach(node => {
  svg.append('circle')  // Expensive DOM creation
})
```

**Benefits:**
- Only updates changed elements
- Smooth transitions
- Better performance with large datasets

### 2. Throttle Force Simulation

Control simulation tick rate for better frame rates:

```typescript
// ✅ GOOD: Controlled tick updates
const simulation = d3.forceSimulation(nodes)
  .force('charge', d3.forceManyBody())
  .force('center', d3.forceCenter(width / 2, height / 2))
  .alphaDecay(0.02)  // Slow decay for smoother animation
  .velocityDecay(0.3)  // Friction

// Update positions on tick
simulation.on('tick', () => {
  // Batch DOM updates
  node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
  link.attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
})
```

### 3. Use Canvas for Large Datasets

For visualizations with 1000+ elements, consider Canvas instead of SVG:

```typescript
// Future optimization for very large datasets
const canvas = d3.select(canvasRef.current)
const context = canvas.node()?.getContext('2d')

function draw() {
  context.clearRect(0, 0, width, height)

  // Draw all nodes in one paint operation
  nodes.forEach(node => {
    context.beginPath()
    context.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    context.fillStyle = node.color
    context.fill()
  })
}

simulation.on('tick', draw)
```

**When to use Canvas:**
- 1000+ visual elements
- Real-time animations
- Particle systems

**When to use SVG:**
- < 500 elements (our current scale)
- Need hover states, tooltips
- Need accessibility features

---

## Lazy Loading Patterns

### 1. Artist Mosaic Pagination

Load artist cards in batches as user scrolls:

```typescript
// ArtistMosaic.tsx
const INITIAL_LOAD = 100
const BATCH_SIZE = 50

const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD)

useEffect(() => {
  const observer = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + BATCH_SIZE, artists.length))
      }
    },
    { rootMargin: '200px' }  // Start loading before user reaches bottom
  )

  observer.observe(sentinelRef.current)
  return () => observer.disconnect()
}, [visibleCount, artists.length])

// Render only visible cards
const visibleArtists = artists.slice(0, visibleCount)
```

**Benefits:**
- Faster initial render
- Lower memory usage
- Better scroll performance
- Progressive enhancement

### 2. Scene-Based Code Splitting

Scenes load their components only when needed:

```typescript
// Future optimization: Dynamic imports
const Scene5Genres = lazy(() => import('./scenes/Scene5Genres'))
const ArtistScene = lazy(() => import('./scenes/ArtistScene/ArtistScene'))

<Suspense fallback={<LoadingSpinner />}>
  <Scene5Genres concerts={concerts} />
</Suspense>
```

**Note:** Not currently implemented because:
- Bundle size is reasonable (~500KB gzipped)
- All scenes visible via scroll (no route-based splits)
- Better UX to preload everything

---

## Animation Performance

### 1. Framer Motion Optimization

Use efficient animation patterns:

```typescript
// ✅ GOOD: Animate transform properties (GPU-accelerated)
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.8 }}
>

// ✅ GOOD: Use will-change for complex animations
<motion.div
  style={{ willChange: 'transform' }}
  animate={{ x: 100, y: 100 }}
/>

// ❌ BAD: Animate layout properties (triggers reflow)
<motion.div
  animate={{ width: 500, height: 300 }}  // Causes reflow
/>

// ✅ GOOD: Use layout animations for necessary layout changes
<motion.div layout>  // Smart layout animation
```

**GPU-accelerated properties:**
- `transform` (translate, scale, rotate)
- `opacity`
- `filter` (with caution)

**Avoid animating:**
- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`

### 2. Reduced Motion Support

Respect user preferences for reduced motion:

```typescript
// ArtistScene.tsx
const [reducedMotion, setReducedMotion] = useState(false)

useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  setReducedMotion(mediaQuery.matches)

  const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}, [])

// Conditionally apply animations
<motion.div
  initial={reducedMotion ? {} : { opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: reducedMotion ? 0 : 0.8 }}
>
```

**Benefits:**
- Accessibility compliance
- Better performance on low-end devices
- Respects user preferences

---

## Image Optimization

### 1. Responsive Images

Use appropriate image sizes for different viewports:

```typescript
// Future optimization: srcset for responsive images
<img
  src="/images/artist-md.jpg"
  srcSet="
    /images/artist-sm.jpg 400w,
    /images/artist-md.jpg 800w,
    /images/artist-lg.jpg 1200w
  "
  sizes="(max-width: 768px) 400px, 800px"
  loading="lazy"
  alt={artistName}
/>
```

### 2. Image Formats

Serve modern formats with fallbacks:

```html
<picture>
  <source srcset="artist.avif" type="image/avif">
  <source srcset="artist.webp" type="image/webp">
  <img src="artist.jpg" alt="Artist name">
</picture>
```

**Format comparison:**
- AVIF: Best compression, newer browser support
- WebP: Good compression, wide support
- JPEG: Universal support, larger files

### 3. Image Dimensions

Always specify width/height to prevent layout shift:

```typescript
<img
  src={imageUrl}
  width={400}
  height={400}
  style={{ aspectRatio: '1/1' }}
  loading="lazy"
  alt={artistName}
/>
```

---

## Memory Management

### 1. Clean Up Event Listeners

Always remove listeners in cleanup functions:

```typescript
// ✅ GOOD: Cleanup in useEffect
useEffect(() => {
  const handleScroll = () => {
    // Handle scroll...
  }

  scrollContainer.addEventListener('scroll', handleScroll, { passive: true })

  return () => {
    scrollContainer.removeEventListener('scroll', handleScroll)
  }
}, [])

// ❌ BAD: No cleanup
useEffect(() => {
  window.addEventListener('scroll', handleScroll)
  // Listener leaks on unmount!
}, [])
```

**Common cleanup needs:**
- Scroll listeners
- Resize observers
- Intersection observers
- D3 force simulations
- Timers/intervals

### 2. Stop D3 Simulations

Prevent background CPU usage:

```typescript
useEffect(() => {
  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody())
    .on('tick', updatePositions)

  return () => {
    simulation.stop()  // Stop simulation on unmount
  }
}, [nodes])
```

### 3. Cancel Pending Requests

Abort fetch requests when component unmounts:

```typescript
useEffect(() => {
  const controller = new AbortController()

  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setState(data))
    .catch(err => {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted')
      }
    })

  return () => {
    controller.abort()
  }
}, [])
```

---

## Rendering Optimization

### 1. Virtualization for Long Lists

Use react-window for large lists (future enhancement):

```typescript
import { FixedSizeList } from 'react-window'

function ArtistList({ artists }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={artists.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ArtistRow artist={artists[index]} />
        </div>
      )}
    </FixedSizeList>
  )
}
```

**When to use:**
- Lists with 100+ items
- Uniform item heights
- Scroll performance issues

**Current approach:**
- Intersection Observer pagination for artist mosaic (preferred for grid layouts)

### 2. Avoid Inline Functions in Render

```typescript
// ❌ BAD: New function every render
{items.map(item => (
  <Item onClick={() => handleClick(item.id)} />
))}

// ✅ GOOD: Stable function reference
const handleItemClick = useCallback((id: string) => {
  handleClick(id)
}, [])

{items.map(item => (
  <Item onClick={() => handleItemClick(item.id)} />
))}

// ✅ BETTER: Data attribute approach
{items.map(item => (
  <Item data-id={item.id} onClick={handleItemClick} />
))}
```

### 3. Key Props for Lists

Always provide stable keys:

```typescript
// ✅ GOOD: Stable unique keys
{artists.map(artist => (
  <ArtistCard key={artist.normalizedName} artist={artist} />
))}

// ❌ BAD: Index as key (unstable on sort/filter)
{artists.map((artist, index) => (
  <ArtistCard key={index} artist={artist} />
))}

// ❌ BAD: Random keys
{artists.map(artist => (
  <ArtistCard key={Math.random()} artist={artist} />
))}
```

---

## Network Optimization

### 1. HTTP/2 Server Push

Preload critical resources:

```html
<link rel="preload" href="/data/concerts.json" as="fetch" crossorigin>
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
```

### 2. Resource Hints

Help browser prioritize loading:

```html
<!-- Preconnect to external APIs -->
<link rel="preconnect" href="https://api.spotify.com">
<link rel="preconnect" href="https://api.setlist.fm">

<!-- DNS prefetch for images -->
<link rel="dns-prefetch" href="https://images.morperhaus.org">
```

### 3. Cache Strategy

Configure CDN caching headers:

```
# Static assets (immutable)
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Data files (revalidate)
/data/*.json
  Cache-Control: public, max-age=3600, must-revalidate

# HTML (no cache)
/*.html
  Cache-Control: no-cache, must-revalidate
```

---

## Monitoring Performance

### 1. Web Vitals

Track Core Web Vitals:

```typescript
// Future enhancement: web-vitals library
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

getCLS(console.log)  // Cumulative Layout Shift
getFID(console.log)  // First Input Delay
getFCP(console.log)  // First Contentful Paint
getLCP(console.log)  // Largest Contentful Paint
getTTFB(console.log) // Time to First Byte
```

### 2. React DevTools Profiler

Profile component render times:

1. Open React DevTools
2. Go to Profiler tab
3. Click "Start profiling"
4. Interact with app
5. Click "Stop profiling"
6. Analyze flame graphs

**Look for:**
- Components with long render times
- Unnecessary re-renders
- Cascading updates

### 3. Chrome Performance Tab

Analyze runtime performance:

1. Open DevTools → Performance tab
2. Click Record
3. Perform actions
4. Stop recording
5. Analyze timeline

**Look for:**
- Long tasks (> 50ms)
- Layout thrashing
- Memory leaks
- Script evaluation time

---

## Performance Checklist

### Build Time

- [ ] Vite production build optimized
- [ ] Unused dependencies removed
- [ ] Code splitting strategy reviewed
- [ ] Bundle size analyzed
- [ ] Source maps generated

### Data Loading

- [ ] Static data pre-generated at build time
- [ ] Data normalized and indexed
- [ ] Images lazy loaded
- [ ] External API calls optimized/cached

### React Patterns

- [ ] Expensive computations memoized with useMemo
- [ ] Event handlers stabilized with useCallback
- [ ] Pure components wrapped with React.memo
- [ ] List items have stable keys
- [ ] No inline function definitions in render

### D3 Visualizations

- [ ] Efficient enter/update/exit patterns
- [ ] Force simulations properly stopped
- [ ] Canvas considered for large datasets
- [ ] Transitions use appropriate durations

### Images

- [ ] Loading="lazy" on non-critical images
- [ ] Width/height specified (prevent CLS)
- [ ] Responsive images with srcset
- [ ] Modern formats (WebP, AVIF) served

### Animations

- [ ] Transform/opacity used over layout properties
- [ ] GPU-accelerated when possible
- [ ] Reduced motion preferences respected
- [ ] Will-change used sparingly

### Memory

- [ ] Event listeners cleaned up
- [ ] Timers/intervals cleared
- [ ] Observers disconnected
- [ ] Fetch requests aborted on unmount

---

## Common Performance Anti-Patterns

### ❌ Anti-Pattern 1: Computing in Render

```typescript
// ❌ BAD
function Scene({ concerts }) {
  const stats = concerts.reduce(/* expensive */)  // Every render!
  return <div>{stats}</div>
}

// ✅ GOOD
function Scene({ concerts }) {
  const stats = useMemo(
    () => concerts.reduce(/* expensive */),
    [concerts]
  )
  return <div>{stats}</div>
}
```

### ❌ Anti-Pattern 2: Too Many State Updates

```typescript
// ❌ BAD: Multiple setState calls
function updateData(newData) {
  setData(newData)
  setLoading(false)
  setError(null)
  setTimestamp(Date.now())
}

// ✅ GOOD: Batch state updates
function updateData(newData) {
  setState({
    data: newData,
    loading: false,
    error: null,
    timestamp: Date.now()
  })
}
```

### ❌ Anti-Pattern 3: Unnecessary Dependencies

```typescript
// ❌ BAD: Unstable object in dependency array
useEffect(() => {
  fetchData({ filter: 'active', limit: 10 })
}, [{ filter: 'active', limit: 10 }])  // New object every render!

// ✅ GOOD: Stable primitive dependencies
useEffect(() => {
  fetchData({ filter, limit })
}, [filter, limit])
```

---

## Related Documentation

- [State Management Skill](./../state-management/SKILL.md) - State patterns
- [Design System Skill](./../design-system/SKILL.md) - UI patterns
- [Data Schema Skill](./../data-schema/SKILL.md) - Data structures

---

## Resources

- [Web.dev Performance](https://web.dev/performance/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [D3 Performance Tips](https://www.d3indepth.com/performance/)
- [Vite Build Optimizations](https://vitejs.dev/guide/build.html)
