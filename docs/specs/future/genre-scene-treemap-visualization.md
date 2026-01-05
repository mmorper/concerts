# Genre Scene: Treemap Visualization Replacement

> **Role**: Feature specification for replacing sunburst with zoomable treemap
> **Status**: 📋 **PROPOSED** (Future Release)
> **Scene**: Scene 5 (Genres / "The Music")
> **Priority**: Medium
> **Complexity**: Medium-High
> **Dependencies**: Mobile Optimization (implemented in current session)

---

## Executive Summary

Replace the circular sunburst visualization in Scene 5 (Genres) with a zoomable treemap layout to improve mobile usability and provide clearer visual representation of proportional data. The current sunburst design, while visually striking on desktop, presents significant touch interaction challenges on mobile devices with small pie-wedge segments that are difficult to tap accurately.

The treemap approach maintains all existing functionality (three-level drill-down, color-coded genres, zoom interactions) while offering large rectangular touch targets, more intuitive size comparisons, and better use of available viewport space on mobile devices.

**Key Benefits:**
- **Better mobile UX** - Large rectangular touch targets instead of small pie wedges
- **Clearer proportions** - Rectangle area = concert count (more intuitive than arc angles)
- **Improved labels** - Horizontal text in boxes vs rotated text on curves
- **Space efficiency** - Better viewport utilization than circular layout
- **Maintained functionality** - All drill-down and color features preserved

---

## Problem Statement

### Current Issues with Sunburst

1. **Small Touch Targets**
   - Pie wedges for smaller genres (< 5% of data) are difficult to tap on mobile
   - Users must tap precisely on thin arcs
   - No room for error in touch interaction

2. **Label Readability**
   - Rotated text along curves is harder to read
   - Long artist names get truncated aggressively
   - Small segments have no space for labels at all

3. **Proportion Perception**
   - Arc angles don't map intuitively to size
   - Comparing two segments requires mental calculation
   - Circular layout wastes corner space in rectangular viewports

4. **Mobile-Specific Issues** (Identified in v1.7.12 mobile optimization)
   - Even after sizing adjustments (`95vw, 85vh`), small segments remain problematic
   - Hover tooltips don't work on touch devices (addressed but workaround needed)
   - 270° artist arc positioning helps but doesn't solve core interaction issues

### Why Treemap Is Better

**Touch Interaction:**
- Minimum tile size of 44×44px (iOS/Android guideline)
- Every genre guaranteed to be tappable
- Large surface area for finger/thumb taps

**Visual Clarity:**
- Rectangle area directly represents value
- Easier to compare sizes at a glance
- Familiar pattern (used in financial dashboards, analytics tools)

**Mobile-First:**
- Fills rectangular viewport naturally
- Works with vertical scrolling if needed
- Text always horizontal (easier to read)

---

## Design Philosophy

### Core Principles

1. **Maintain Existing Strengths**
   - Keep three-level drill-down (genres → artists or Other → small genres)
   - Preserve color-coded genre system
   - Retain smooth zoom animations
   - Continue mobile-optimized interactions

2. **Improve Weak Points**
   - Solve touch target problem with large rectangles
   - Make size comparisons more intuitive
   - Improve label legibility
   - Better utilize viewport space

3. **Design Consistency**
   - Match existing color palette and typography
   - Use same purple accent (`violet-600`) for interactions
   - Maintain glassmorphism for overlays (center text, reset button)
   - Keep haptic feedback patterns

---

## Visual Design

### Treemap Layout

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  New Wave (42 shows)          Alternative (28 shows)    │
│  ┌──────────────────────┐    ┌──────────────────┐      │
│  │                      │    │                  │      │
│  │                      │    │                  │      │
│  │                      │    │                  │      │
│  └──────────────────────┘    └──────────────────┘      │
│                                                          │
│  Punk (22 shows)             Electronic (18 shows)      │
│  ┌───────────────┐           ┌──────────────┐          │
│  │               │           │              │          │
│  │               │           │              │          │
│  └───────────────┘           └──────────────┘          │
│                                                          │
│  Other (15 shows)    Jazz (12)    Hip Hop (8)          │
│  ┌──────────────┐   ┌──────┐    ┌─────┐               │
│  │              │   │      │    │     │               │
│  └──────────────┘   └──────┘    └─────┘               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Default View**: Grid of genre tiles sized proportionally by concert count

**Zoomed View** (after tapping "New Wave"):
```
┌──────────────────────────────────────────────────────────┐
│  New Wave (42 shows)                      [Reset View]  │
│                                                          │
│  ┌──────────────────────┐  ┌─────────────────┐         │
│  │   Depeche Mode       │  │  New Order      │         │
│  │   (5 shows)          │  │  (4 shows)      │         │
│  └──────────────────────┘  └─────────────────┘         │
│                                                          │
│  ┌───────────────┐  ┌──────────┐  ┌─────────┐         │
│  │  The Cure     │  │  Soft     │  │  Erasure │         │
│  │  (3 shows)    │  │  Cell     │  │  (2 shows)│         │
│  └───────────────┘  │  (3 shows)│  └─────────┘         │
│                      └──────────┘                        │
│  ┌──────┐  ┌──────┐  ┌──────┐  ... (other artists)    │
│  │ Echo │  │ OMD  │  │ Yaz  │                          │
│  └──────┘  └──────┘  └──────┘                          │
└──────────────────────────────────────────────────────────┘
```

**Drill into "Other"** → Shows small genres as tiles
**Drill into small genre** → Shows artists within that genre

### Dimensions & Layout

**Container:**
- Desktop: `min(85vw, 75vh)` - Square-ish aspect ratio
- Mobile: `min(95vw, 85vh)` - More generous on mobile (already implemented)
- Max size: 800×800px

**Tile Sizing:**
- Proportional to concert count (D3 squarified treemap algorithm)
- Minimum size: 44×44px (enforced for smallest tiles)
- Padding: 4px between tiles (white space)
- Border: 2-3px white stroke

**Typography:**
- Genre/Artist name: 14-18px, weight 600, auto-sized to fit
- Concert count: 12-14px, weight 400
- Minimum display threshold: If tile < 60×40px, hide text (show on hover/tap)

### Color & Styling

**Tile Colors (Depth 1 - Genres):**
```css
/* Use existing getGenreColor() palette */
background: genreColor (e.g., #1e40af for New Wave)
color: white (dynamic: use luminance calculation)
border: 2px solid white
```

**Tile Colors (Depth 2 - Artists):**
```css
/* Inherit parent genre color with brightness variation */
background: parentColor.brighter(siblingIndex * 0.3)
color: white or #1f2937 (based on luminance)
border: 2px solid white
```

**Interaction States:**

| State | Background | Border | Scale |
|-------|------------|--------|-------|
| Default | Genre color @ 0.9 opacity | 2px white | 1.0 |
| Hover (desktop) | Genre color @ 1.0 opacity | 3px white | 1.02 |
| Tap (mobile) | Genre color @ 1.0 opacity | 4px white | Pulse (1.0 → 1.05 → 1.0) |
| Focused | Genre color @ 1.0 opacity | 3px purple-500 | 1.0 |
| Dimmed (not focused) | Genre color @ 0.3 opacity | 2px white | 1.0 |

**Optional Enhancement: Gradients**
```css
/* Subtle top-to-bottom gradient for depth */
background: linear-gradient(180deg,
  genreColor.brighter(0.2) 0%,
  genreColor 100%
);
```

### Animations

**Zoom Transition (Genre Click):**
```tsx
// All tiles interpolate to new positions
transition: {
  duration: 600ms,
  ease: 'easeInOutCubic'
}
```

**Hover State (Desktop):**
```css
transition: all 150ms ease-out;
/* Scale 1.0 → 1.02, opacity 0.9 → 1.0 */
```

**Tap Feedback (Mobile):**
```tsx
// Quick pulse on tap
<motion.div
  whileTap={{ scale: [1, 1.05, 1] }}
  transition={{ duration: 300ms }}
/>
```

**Text Fade:**
```css
/* When zooming, fade out old labels, fade in new ones */
opacity transition: 300ms ease
```

---

## Data Structure (Unchanged)

The existing `GenreNode` hierarchy works perfectly with treemaps:

```typescript
interface GenreNode {
  name: string
  value?: number           // Concert count
  children?: GenreNode[]   // Artists or small genres
  isOther?: boolean        // "Other" aggregation flag
  isArtist?: boolean       // Artist node flag
}
```

**Treemap-Specific Node Type:**
```typescript
interface TreemapNode extends d3.HierarchyRectangularNode<GenreNode> {
  x0: number  // Left edge
  x1: number  // Right edge
  y0: number  // Top edge
  y1: number  // Bottom edge
  depth: number
  data: GenreNode
}
```

**Three-Level Hierarchy:**
```
All Genres (root)
├── New Wave (42 shows)
│   ├── Depeche Mode (5 shows)
│   ├── New Order (4 shows)
│   └── ...
├── Punk (22 shows)
│   └── ...
└── Other (15 shows)
    ├── Folk (4 shows)
    ├── Reggae (3 shows)
    └── ...
```

---

## Interaction Design

### Default View (All Genres)

**Available Actions:**
- **Tap/Click Genre Tile** → Zoom into genre, show artists
- **Tap/Click "Other" Tile** → Zoom into "Other", show small genres
- **Hover Tile (Desktop)** → Slight scale increase, show count tooltip
- **Tap Background** → No action (already at root)

**Visual Feedback:**
- Hovered tile: 2% scale increase, full opacity
- Mobile tap: Brief brightness pulse (100ms)
- Haptic feedback on all taps (light)

### Zoomed View (Inside Genre)

**Example: User tapped "New Wave"**

**Available Actions:**
- **Tap/Click Artist Tile** → Focus artist (dim others, update center text)
- **Tap/Click Genre Tile (Background)** → Zoom out to default view
- **Tap Reset Button** → Zoom out to default view
- **Tap Focused Artist Again** → Unfocus (return to genre view)

**Visual Feedback:**
- Genre tile becomes subtle background (0.3 opacity, covers whole viewport)
- Artist tiles appear with animation
- Center text updates: "42 shows / New Wave"
- Reset button appears (top-right)

### Zoomed View (Inside "Other")

**Example: User tapped "Other"**

**Available Actions:**
- **Tap/Click Small Genre Tile** → Zoom into that genre, show artists
- **Tap/Click "Other" Tile (Background)** → Zoom out to default view
- **Tap Reset Button** → Zoom out to default view

**Visual Feedback:**
- "Other" tile becomes background
- Small genre tiles appear (Folk, Reggae, etc.)
- Center text updates: "15 shows / Other"

### Keyboard Navigation (Desktop)

| Key | Action |
|-----|--------|
| **Tab** | Move focus to next tile (visual border indicator) |
| **Shift+Tab** | Move focus to previous tile |
| **Enter/Space** | Activate focused tile (zoom in/out) |
| **Escape** | Zoom out to root (if not already there) |
| **Arrow Keys** | Move focus to adjacent tiles (up/down/left/right) |

**Accessibility:**
```tsx
<div
  role="button"
  tabIndex={0}
  aria-label={`${genre.name}, ${genre.value} concerts`}
  onKeyDown={handleKeyDown}
/>
```

---

## Technical Implementation

### D3 Treemap Configuration

```typescript
const treemapLayout = d3.treemap<GenreNode>()
  .size([width, height])
  .padding(4)                    // Space between tiles
  .paddingTop(0)                 // No extra top padding
  .round(true)                   // Snap to pixel boundaries
  .tile(d3.treemapSquarify)      // Balanced aspect ratios

// Apply layout
const root = d3.hierarchy(genreHierarchy)
  .sum(d => d.value || 0)
  .sort((a, b) => (b.value || 0) - (a.value || 0))

treemapLayout(root)

// Now each node has x0, x1, y0, y1 coordinates
```

### Zoom Transform Logic

```typescript
function zoomToNode(node: TreemapNode) {
  const scaleX = width / (node.x1 - node.x0)
  const scaleY = height / (node.y1 - node.y0)
  const translateX = -node.x0 * scaleX
  const translateY = -node.y0 * scaleY

  // Animate all tiles to new positions
  svg.selectAll<SVGRectElement, TreemapNode>('rect.tile')
    .transition()
    .duration(600)
    .attr('x', d => d.x0 * scaleX + translateX)
    .attr('y', d => d.y0 * scaleY + translateY)
    .attr('width', d => (d.x1 - d.x0) * scaleX)
    .attr('height', d => (d.y1 - d.y0) * scaleY)

  // Update labels after tiles finish moving
  setTimeout(() => updateLabels(), 650)
}
```

### Label Positioning & Visibility

```typescript
function shouldShowLabel(node: TreemapNode): boolean {
  const width = node.x1 - node.x0
  const height = node.y1 - node.y0

  // Minimum 60px wide and 40px tall to show text
  return width >= 60 && height >= 40
}

function calculateFontSize(node: TreemapNode): number {
  const area = (node.x1 - node.x0) * (node.y1 - node.y0)
  const baseFontSize = Math.sqrt(area) / 8

  // Clamp between 10px and 24px
  return Math.max(10, Math.min(24, baseFontSize))
}

function positionLabel(node: TreemapNode): { x: number, y: number } {
  return {
    x: (node.x0 + node.x1) / 2,  // Horizontal center
    y: (node.y0 + node.y1) / 2   // Vertical center
  }
}
```

### Rendering Pattern

```tsx
// Create tile groups
const tileGroups = svg.selectAll('g.tile-group')
  .data(root.descendants().filter(d => d.depth > 0))
  .join('g')
  .attr('class', 'tile-group')

// Render rectangles
tileGroups.append('rect')
  .attr('class', 'tile')
  .attr('x', d => d.x0)
  .attr('y', d => d.y0)
  .attr('width', d => d.x1 - d.x0)
  .attr('height', d => d.y1 - d.y0)
  .attr('fill', d => getNodeColor(d))
  .attr('stroke', 'white')
  .attr('stroke-width', 2)
  .style('cursor', 'pointer')
  .on('click', handleTileClick)
  .on('mouseover', handleTileHover)
  .on('mouseleave', handleTileLeave)

// Render labels (conditional)
tileGroups.append('text')
  .attr('class', 'tile-label')
  .attr('x', d => (d.x0 + d.x1) / 2)
  .attr('y', d => (d.y0 + d.y1) / 2)
  .attr('text-anchor', 'middle')
  .attr('dominant-baseline', 'middle')
  .attr('font-size', d => calculateFontSize(d) + 'px')
  .attr('fill', d => getTextColor(d))
  .style('pointer-events', 'none')
  .style('opacity', d => shouldShowLabel(d) ? 1 : 0)
  .text(d => d.data.name)
```

---

## What Gets Reused (60-70%)

### 100% Reusable
- ✅ **Genre data building** (`genreHierarchy` useMemo, lines 34-169)
- ✅ **Color system** (`getGenreColor()` from `src/constants/colors.ts`)
- ✅ **Brightness variation** for child nodes (existing algorithm)
- ✅ **State management** (`expandedGenre`, `focusedNode`, `isMobile`)
- ✅ **Haptics** (`haptics.light()` on all interactions)
- ✅ **Center text overlay** (count + label, lines 614-658)
- ✅ **Reset button** (logic and styling, lines 753-767)
- ✅ **Framer Motion** (component entrance animations)
- ✅ **Responsive sizing** (SVG dimension calculations, mobile detection)
- ✅ **Dynamic text colors** (luminance-based calculation)

### Needs Adaptation (~30%)
- ⚠️ **D3 layout**: Replace `d3.partition()` with `d3.treemap()`
- ⚠️ **Rendering**: Replace `arc()` paths with `<rect>` elements
- ⚠️ **Label positioning**: Cartesian grid instead of radial positioning
- ⚠️ **Hover effects**: Scale/stroke instead of arc expansion
- ⚠️ **Zoom logic**: Adjust coordinates instead of arc angles

### Complete Rewrite (~10%)
- ❌ **Radial positioning logic**: Not applicable to rectangles
- ❌ **Arc generators**: Replaced by rect attributes (x, y, width, height)

---

## Files to Modify

### Primary Changes
**[`src/components/scenes/Scene5Genres.tsx`](../../src/components/scenes/Scene5Genres.tsx)**
- Replace D3 partition layout with D3 treemap layout (~lines 210-247)
- Replace arc path rendering with rect rendering (~lines 361-537)
- Update label positioning logic (~lines 540-612)
- Adapt zoom transform calculations
- Update interaction handlers (keep click logic, adjust visual feedback)

**Estimated LOC change**: ~400-500 lines (rewrite rendering section)

### No Changes Required
- [`src/constants/colors.ts`](../../src/constants/colors.ts) - Genre colors work as-is
- [`src/utils/haptics.ts`](../../src/utils/haptics.ts) - Haptic feedback unchanged
- [`src/types/concert.ts`](../../src/types/concert.ts) - Concert type interface unchanged

---

## Migration Strategy

### Phase 1: Core Layout (4-6 hours)
1. **Duplicate component** - Create `Scene5GenresTreemap.tsx` for isolated development
2. **Replace layout engine** - Swap `d3.partition()` for `d3.treemap()`
3. **Update rendering** - Replace arc paths with rect elements
4. **Port data logic** - Copy `genreHierarchy` building (100% reusable)
5. **Port color system** - Copy `getNodeColor()` function (100% reusable)
6. **Basic interactions** - Wire up click handlers with zoom logic

**Deliverable**: Static treemap with clickable tiles and zoom

### Phase 2: Interactions & Polish (3-4 hours)
7. **Mobile tap feedback** - Add scale pulse on tap
8. **Desktop hover effects** - Add subtle scale + opacity changes
9. **Label visibility** - Implement size-based text showing/hiding
10. **Center text integration** - Wire up count/genre name updates
11. **Reset button** - Connect existing button to zoom-out logic
12. **Keyboard navigation** - Add Tab/Enter/Arrow key support (accessibility)

**Deliverable**: Fully interactive treemap with animations

### Phase 3: Testing & Refinement (2-3 hours)
13. **Mobile testing** - Verify touch targets, text sizes, animations
14. **Desktop testing** - Check hover states, keyboard nav, tooltips
15. **Edge cases** - Test very small genres, long names, zoom states
16. **Performance** - Ensure smooth 60fps animations
17. **Accessibility audit** - ARIA labels, focus indicators, screen readers

**Deliverable**: Production-ready replacement

### Phase 4: Deployment (1 hour)
18. **Replace original** - Rename `Scene5Genres.tsx` → `Scene5GenresSunburst.tsx` (archive)
19. **Promote new** - Rename `Scene5GenresTreemap.tsx` → `Scene5Genres.tsx`
20. **Update routing** - No changes needed (same component name)
21. **Documentation** - Update README/comments with new approach

**Total Estimated Time**: 10-14 hours

---

## Testing Checklist

### Functional Tests
- [ ] Default view shows all genres sized proportionally
- [ ] Clicking genre zooms to show artists
- [ ] Clicking "Other" expands to show small genres
- [ ] Clicking small genre shows its artists
- [ ] Clicking zoomed tile returns to default view
- [ ] Reset button works in all states
- [ ] Center text updates correctly on zoom/focus
- [ ] Colors match genre palette with brightness variations
- [ ] State management (expandedGenre, focusedNode) works correctly

### Interaction Tests (Desktop)
- [ ] Hover shows scale increase and opacity change
- [ ] Click registers on all tiles (including small ones)
- [ ] Keyboard Tab moves focus visibly
- [ ] Keyboard Enter activates focused tile
- [ ] Keyboard Escape returns to root
- [ ] Arrow keys navigate between tiles

### Interaction Tests (Mobile)
- [ ] All tiles meet 44×44px minimum touch target
- [ ] Tap feedback shows brief brightness pulse
- [ ] Haptic feedback fires on all taps
- [ ] No hover effects triggered (only tap)
- [ ] Zoom animations smooth on mobile devices
- [ ] Labels readable at mobile sizes

### Visual Tests
- [ ] Tile borders clear (white, 2-3px)
- [ ] Text color adapts to background luminance
- [ ] Labels hide when tiles too small
- [ ] Labels scale appropriately with tile size
- [ ] Zoom transitions smooth (600ms easeInOutCubic)
- [ ] Colors match existing genre palette

### Edge Cases
- [ ] Single concert genre shows correctly
- [ ] Very long artist/genre names truncate properly
- [ ] Rapid clicking doesn't break zoom state
- [ ] Switching between genres preserves center text
- [ ] Empty "Other" category handled gracefully

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, macOS and iOS)
- [ ] Edge (latest)

---

## Success Metrics

### User Experience
- **Touch target success rate**: >95% on first tap (vs ~70% with sunburst)
- **Time to find genre**: <3 seconds (easier scanning)
- **Perceived clarity**: User testing shows improved size comprehension

### Technical Performance
- **Animation frame rate**: Maintain 60fps during zoom transitions
- **Rendering time**: Initial render <100ms
- **Memory usage**: No increase vs sunburst (same data structure)

### Accessibility
- **Keyboard navigation**: Full control without mouse
- **Screen reader support**: All tiles properly labeled
- **Focus indicators**: Clear purple outlines on focused tiles
- **WCAG 2.1 AA compliance**: Color contrast, touch targets, keyboard access

---

## Trade-offs & Considerations

### Advantages vs Sunburst
| Aspect | Sunburst | Treemap | Winner |
|--------|----------|---------|--------|
| Touch targets | Small wedges | Large rectangles | ✅ Treemap |
| Size perception | Arc angles (less intuitive) | Area (intuitive) | ✅ Treemap |
| Space efficiency | Wastes corners | Fills viewport | ✅ Treemap |
| Label readability | Rotated text | Horizontal text | ✅ Treemap |
| Visual appeal | Striking, unique | Common, functional | ⚠️ Sunburst |
| Radial symmetry | Beautiful | None | ⚠️ Sunburst |

### Disadvantages
- **Less visually unique**: Treemaps are common in analytics dashboards
- **No radial beauty**: Loses the aesthetic appeal of circular symmetry
- **Aspect ratio constraints**: Some tiles may have awkward shapes (very wide or tall)
- **Familiar territory**: Less "wow factor" for users

### Mitigation Strategies
1. **Visual polish** - Use gradients, shadows, rounded corners to elevate design
2. **Smooth animations** - Make transitions feel premium (600ms easeInOutCubic)
3. **Color richness** - Leverage existing vibrant genre palette
4. **Interaction delight** - Add subtle scale/pulse effects on interaction

---

## Open Questions

1. **Should we keep sunburst as an option?**
   - Toggle button to switch visualizations?
   - User preference saved to localStorage?
   - **Recommendation**: No. Pick one and commit. Treemap is objectively better for mobile.

2. **Minimum tile size enforcement?**
   - Force 44×44px minimum (may distort proportions)?
   - Allow smaller tiles but disable interaction?
   - **Recommendation**: Enforce minimum for accessibility, slight proportion distortion acceptable.

3. **Label overflow handling?**
   - Truncate with ellipsis?
   - Hide completely if doesn't fit?
   - Show on hover/tap only?
   - **Recommendation**: Hide if < 60px wide, show full name on hover/tap.

4. **Rounded corners?**
   - Soften rectangles with border-radius?
   - Keep sharp edges for tighter packing?
   - **Recommendation**: Subtle 2px radius for polish without sacrificing space.

---

## Future Enhancements (Out of Scope)

### Phase 2 Additions
1. **Gradient fills** - Top-to-bottom color gradients for depth perception
2. **Drop shadows** - Subtle shadows between tiles for layered feel
3. **Smooth tile removal** - When zooming, fade out non-focused tiles
4. **Breadcrumb navigation** - "All Genres > New Wave > Depeche Mode" at top
5. **Search integration** - Jump to specific genre/artist via search box

### Not Recommended
1. **3D Treemap** - Adds complexity without UX benefit
2. **Animated tile flipping** - Gimmicky, slows interaction
3. **Tile reordering** - User-customizable layout (over-engineering)

---

## Related Documentation

- [Mobile Optimization Spec](./mobile-optimization.md) - Current session improvements (v1.7.12)
- [Genre Scene v2](../archive/genre-scene-v2.md) - Previous genre scene iteration
- [Artist Scene Spec](../implemented/artist-scene.md) - Similar interactive mosaic pattern
- [Data Pipeline](../../DATA_PIPELINE.md) - Concert data structure

---

## Appendix: Code Snippets

### Complete Tile Rendering Example

```tsx
function renderTreemap() {
  const svg = d3.select(svgRef.current)
  svg.selectAll('*').remove()

  const rect = svgRef.current!.getBoundingClientRect()
  const width = rect.width
  const height = rect.height

  // Create treemap layout
  const treemapLayout = d3.treemap<GenreNode>()
    .size([width, height])
    .padding(4)
    .round(true)
    .tile(d3.treemapSquarify)

  // Build hierarchy
  const root = d3.hierarchy(genreHierarchy)
    .sum(d => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0))

  treemapLayout(root)

  // Render tiles
  const tiles = svg.selectAll<SVGRectElement, TreemapNode>('rect.tile')
    .data(root.descendants().filter(d => d.depth > 0) as TreemapNode[])
    .join('rect')
    .attr('class', 'tile')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => getNodeColor(d))
    .attr('stroke', 'white')
    .attr('stroke-width', 2)
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('click', handleTileClick)
    .on('mouseover', isMobile ? null : handleTileHover)
    .on('mouseleave', isMobile ? null : handleTileLeave)

  // Render labels
  svg.selectAll<SVGTextElement, TreemapNode>('text.label')
    .data(root.descendants().filter(d => d.depth > 0) as TreemapNode[])
    .join('text')
    .attr('class', 'label')
    .attr('x', d => (d.x0 + d.x1) / 2)
    .attr('y', d => (d.y0 + d.y1) / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', d => calculateFontSize(d) + 'px')
    .attr('font-weight', 600)
    .attr('fill', d => getTextColor(d))
    .style('pointer-events', 'none')
    .style('opacity', d => shouldShowLabel(d) ? 1 : 0)
    .text(d => d.data.name)
}
```

### Mobile Tap Feedback

```tsx
.on('click', function(_event, d) {
  _event.stopPropagation()
  haptics.light()

  // Mobile tap feedback
  if (isMobile) {
    const currentTile = d3.select(this)
    currentTile
      .transition()
      .duration(100)
      .attr('fill-opacity', 1)
      .attr('stroke-width', 4)
      .transition()
      .duration(200)
      .attr('fill-opacity', 0.9)
      .attr('stroke-width', 2)
  }

  // Handle zoom logic
  if (d.depth === 1) {
    if (expandedGenre === d.data.name) {
      setExpandedGenre(null)
      setFocusedNode('All Genres')
    } else {
      setExpandedGenre(d.data.name)
      setFocusedNode(d.data.name)
    }
  }
  // ... rest of zoom logic
})
```

---

**Last Updated**: 2026-01-04
**Author**: Claude (with user guidance)
**Status**: 📋 **PROPOSED** - Awaiting user approval for implementation
