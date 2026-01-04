# Artist Search with Typeahead

**Status:** 📋 **PROPOSED** (v1.6+)
**Scene:** Scene 6 (Artist Scene)
**Priority:** High
**Complexity:** Medium
**Dependencies:** Artist Scene (✅ Complete in v1.4.0)

---

## Executive Summary

Add an intelligent artist search field with typeahead dropdown to the Artist Scene header, enabling users to quickly find and navigate to specific artists from their collection. The search uses multi-tier fuzzy matching to surface relevant results instantly, then smoothly scrolls to the selected artist's card in the mosaic grid.

This feature transforms the Artist Scene from a purely visual browsing experience into a dual-mode interface that supports both serendipitous discovery (scrolling the mosaic) and targeted navigation (searching for known artists).

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Artist Search with Typeahead feature for the Artist Scene.

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
- Add search input field to Artist Scene header (between subtitle and sort buttons)
- As user types, show dropdown with matching artists
- Multi-tier search algorithm ranks results by relevance
- Keyboard navigation with arrow keys, Enter to select, Escape to close
- Selecting artist scrolls smoothly to their card in the grid
- Search stays active when sort order changes

**Key References:**
- Full Design Spec: docs/specs/future/artist-search-typeahead.md
- Existing Artist Scene: src/components/scenes/ArtistScene/
- MultiSelectFilter pattern: src/components/filters/MultiSelectFilter.tsx

**Implementation Approach:**
We'll implement this in 2-3 context windows:

**Window 1:** Core Search Component
- Create ArtistSearchTypeahead component
- Implement search algorithm with multi-tier scoring
- Build dropdown UI with result items
- Add debouncing (200ms)
- Test filtering logic

**Window 2:** Interactions & Integration
- Add keyboard navigation (arrows, Enter, Escape)
- Implement click-outside-to-close
- Add scroll-to-artist behavior
- Integrate into ArtistScene header
- Add data-artist attributes to mosaic cards

**Window 3:** Polish & Testing (optional)
- Add Framer Motion animations
- Implement highlight matching in results
- Test all keyboard flows
- Mobile testing and adjustments
- Cross-browser validation

Let's start with Window 1. First, let me read the existing ArtistScene and MultiSelectFilter components to understand the patterns.
```

---

## Design Philosophy

### Core Principles

1. **Instant Feedback** — Results appear as you type (200ms debounce keeps it snappy)
2. **Smart Ranking** — Exact matches first, then starts-with, then contains
3. **Zero Disruption** — Search doesn't filter the grid, it helps you navigate it
4. **Keyboard First** — Arrow keys, Enter, Escape all work intuitively
5. **Visual Consistency** — Follows established design system (glassmorphism for inputs, solid buttons for toggles)

### Why This Approach?

**Scroll-to vs Filter:**
We chose scroll-to over filtering the grid because:
- Preserves sort order integrity (user's mental model stays intact)
- Doesn't break lazy loading architecture
- Provides clear feedback (user sees card in context)
- Less disruptive to exploration flow

**Local State vs Global:**
We use local React state instead of Zustand because:
- Search is scene-specific and ephemeral
- No need to persist between scene changes
- Simpler, faster, easier to test
- Follows existing pattern (ArtistScene manages its own sortOrder)

**Independent Sort Interaction:**
Search stays active when sort changes because:
- Users may want to search, then re-sort, then select
- More flexible workflow
- Results update to match new grid order automatically

---

## Visual Design

### Input Field

```
┌──────────────────────────────────────────────────┐
│  🔍  Type to search artists...                 ✕ │  ← Glassmorphism style
└──────────────────────────────────────────────────┘
       ▼
┌──────────────────────────────────────────────────┐
│  Violent Femmes                           ×3  🎵 │  ← Result item
│  Alternative Rock                                │
├──────────────────────────────────────────────────┤
│  The Flaming Lips                         ×2  🎵 │
│  Psychedelic Rock                                │
├──────────────────────────────────────────────────┤
│  Fleet Foxes                              ×1  🎵 │
│  Indie Folk                                      │
└──────────────────────────────────────────────────┘
```

### Dimensions & Layout

**Input Field:**
| Property | Value | Rationale |
|----------|-------|-----------|
| Width | `max-w-md` (448px max) | Centered, doesn't crowd header |
| Height | 44px minimum | Touch-friendly, accessibility standard |
| Padding | `px-4 py-3 pl-11` | Room for search icon (left) and clear button (right) |
| Border Radius | `rounded-lg` (8px) | Matches button styling across app |
| Position | Centered in header | Between subtitle and sort buttons |

**Dropdown:**
| Property | Value | Rationale |
|----------|-------|-----------|
| Width | Matches input (100%) | Visual alignment |
| Max Height | 400px | Shows ~7 items (56px each), then scrolls |
| Position | Below input, 8px gap | Clear spatial relationship |
| Z-Index | 50 | Above grid (z-10), below gatefold (z-[100]) |

**Result Item:**
| Property | Value | Rationale |
|----------|-------|-----------|
| Height | 56px | Comfortable touch target |
| Padding | `px-4 py-3` | Balanced whitespace |
| Layout | Flex row with justify-between | Name/genre left, badge right |

### Color & Styling

**Input Field:**
```css
background: rgba(255, 255, 255, 0.1);  /* bg-white/10 */
backdrop-filter: blur(8px);            /* backdrop-blur-sm */
border: 1px solid rgba(255, 255, 255, 0.2);
color: white;
placeholder: rgba(255, 255, 255, 0.6);

/* Focus state */
border-color: rgb(192, 132, 252);      /* border-purple-400 */
box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.3);  /* ring-purple-500/30 */
```

**Dropdown:**
```css
background: rgb(17, 24, 39);           /* bg-gray-900 */
border: 1px solid rgb(55, 65, 81);     /* border-gray-700 */
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
```

**Result Item (Inactive):**
```css
background: transparent;
color: rgb(209, 213, 219);             /* text-gray-300 */
transition: background-color 200ms;

/* Hover */
background: rgb(31, 41, 55);           /* bg-gray-800 */
```

**Result Item (Selected/Keyboard Focus):**
```css
background: rgba(168, 85, 247, 0.2);   /* bg-purple-500/20 */
color: rgb(216, 180, 254);             /* text-purple-300 */
border-left: 2px solid rgb(168, 85, 247);  /* Accent indicator */
```

### Typography

| Element | Font Family | Size | Weight | Color |
|---------|-------------|------|--------|-------|
| Input text | Source Sans 3 | 16px | 400 | white |
| Input placeholder | Source Sans 3 | 16px | 400 | white/60 |
| Artist name | Source Sans 3 | 16px | 600 | gray-300 / purple-300 (selected) |
| Genre | Source Sans 3 | 14px | 400 | gray-400 |
| Badge | Source Sans 3 | 12px | 700 | white |
| Empty state | Source Sans 3 | 14px | 400 | gray-500 |

---

## Animation & Transitions

### Input Focus
```tsx
transition: all 200ms ease
// Border color and ring appear on focus
```

### Dropdown Open/Close
```tsx
<motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
>
```

**Why 150ms?**
- Fast enough to feel instant
- Slow enough to avoid jarring
- Matches existing dropdown patterns (MultiSelectFilter)

### Result Item Hover
```css
transition: background-color 200ms ease;
```

### Scroll-to-Artist
```javascript
cardElement.scrollIntoView({
  behavior: 'smooth',    // Animated scroll
  block: 'center'        // Card appears in viewport center
})
```

**Duration:** ~500-800ms (browser-controlled)

### Optional: Highlight Effect
After scrolling to artist, briefly highlight the card:
```css
@keyframes pulse-purple {
  0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(168, 85, 247, 0); }
}

/* Apply for 600ms on scroll-to */
animation: pulse-purple 600ms ease-out;
```

---

## Search Algorithm

### Multi-Tier Scoring System

```typescript
function searchArtists(query: string, artists: ArtistCard[]): ArtistCard[] {
  if (!query.trim()) return []

  const normalizedQuery = query.toLowerCase().trim()

  const scored = artists.map(artist => {
    const name = artist.name.toLowerCase()
    let score = 0

    // TIER 1: Exact match (highest priority)
    if (name === normalizedQuery) {
      score += 1000
    }

    // TIER 2: Starts with query (high priority)
    else if (name.startsWith(normalizedQuery)) {
      score += 100
      // Bonus: Shorter names rank higher (more relevant)
      score += (50 - name.length) * 0.5
    }

    // TIER 3: Contains query (medium priority)
    else if (name.includes(normalizedQuery)) {
      score += 50
      // Bonus: Earlier position ranks higher
      const position = name.indexOf(normalizedQuery)
      score += (50 - position) * 0.3
    }

    // TIER 4: Word boundary matching (low priority)
    else {
      const words = name.split(/\s+/)
      const matchingWords = words.filter(w => w.startsWith(normalizedQuery))
      if (matchingWords.length > 0) {
        score += 25 * matchingWords.length
      }
    }

    // BONUS: Popularity weight (tiebreaker)
    if (score > 0) {
      score += artist.timesSeen * 0.5
    }

    return { artist, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => {
      // Primary sort: Score descending
      if (b.score !== a.score) return b.score - a.score
      // Tiebreaker: Alphabetical
      return a.artist.name.localeCompare(b.artist.name)
    })
    .slice(0, 20)  // Limit to top 20 results
    .map(s => s.artist)
}
```

### Algorithm Performance

**Complexity:** O(n) where n = number of artists (~100-200)
**Typical execution time:** <2ms on modern hardware
**Debounced:** 200ms delay before execution
**Memoized:** Only recalculates when query or artist list changes

### Example Search Results

**Query:** "vio"
1. **Violent Femmes** (starts-with, score: 100 + 1.5 popularity = 101.5)
2. **Violeta Parra** (starts-with, score: 100 + 0.5 popularity = 100.5)

**Query:** "the"
1. **The National** (starts-with, score: 100 + 4.0 popularity = 104)
2. **The Flaming Lips** (starts-with, score: 100 + 2.0 popularity = 102)
3. **The xx** (starts-with, score: 100 + 0.5 popularity = 100.5)

**Query:** "radio"
1. **Radiohead** (starts-with, score: 100 + 5.0 popularity = 105)
2. **Radio Dept.** (starts-with, score: 100 + 1.0 popularity = 101)

**Query:** "fleet"
1. **Fleet Foxes** (starts-with, score: 100 + 1.0 popularity = 101)

---

## Interaction Design

### Input Behaviors

| Action | Behavior |
|--------|----------|
| Focus input | Cursor appears, ready to type |
| Type 1+ characters | Dropdown opens with results (200ms debounce) |
| Type 0 characters (empty) | Dropdown closes |
| Click X (clear button) | Clear input, close dropdown, refocus input |
| Blur input | Close dropdown after 200ms delay (allows click handling) |

### Dropdown Behaviors

| Action | Behavior |
|--------|----------|
| Hover result item | Background changes to gray-800 |
| Click result item | Select artist, scroll to card, close dropdown |
| Click outside dropdown | Close dropdown |
| Scroll within dropdown | Normal scrolling (max-height 400px) |

### Keyboard Navigation

| Key | Behavior |
|-----|----------|
| **Arrow Down** | If dropdown closed: Open and select first result<br>If dropdown open: Move selection down (wraps to top) |
| **Arrow Up** | Move selection up (wraps to bottom)<br>If at first item: Deselect (return to input) |
| **Enter** | If result selected: Navigate to artist<br>If input focused (no selection): Do nothing |
| **Escape** | Close dropdown, clear search, blur input |
| **Tab** | Close dropdown (if open), move focus to next element |

### Mobile Behaviors

| Action | Behavior |
|--------|----------|
| Tap input | Virtual keyboard appears, input focused |
| Type on virtual keyboard | Dropdown appears above keyboard |
| Viewport height < 500px | Dropdown closes (keyboard obscures it) |
| Tap result item | Select artist, scroll to card, keyboard dismisses |
| Tap outside | Close dropdown, keep keyboard (iOS pattern) |

---

## Component Structure

### File Architecture

```
src/
├── components/
│   ├── scenes/
│   │   └── ArtistScene/
│   │       ├── ArtistScene.tsx              (MODIFY: Integrate search)
│   │       ├── ArtistMosaic.tsx             (MODIFY: Add data-artist attr)
│   │       ├── ArtistSearchTypeahead.tsx    (NEW: Main search component)
│   │       └── types.ts                     (No changes needed)
│   └── filters/
│       └── MultiSelectFilter.tsx            (REFERENCE: Dropdown pattern)
└── hooks/
    └── useDebounce.ts                       (NEW: Optional utility hook)
```

### Component Hierarchy

```
ArtistScene
├── Header
│   ├── Title: "The Artists"
│   ├── Subtitle: "{count} artists · {concerts} concerts"
│   ├── ArtistSearchTypeahead ← NEW
│   │   ├── Input (search icon, clear button)
│   │   └── Dropdown (conditional)
│   │       ├── ResultItem × N
│   │       └── EmptyState (if no results)
│   └── SortButtons (A-Z, Genre, Most Seen)
└── ArtistMosaic
    └── ArtistCard × N (with data-artist attribute)
```

### ArtistSearchTypeahead Props

```typescript
interface ArtistSearchTypeaheadProps {
  artists: ArtistCard[]
  onArtistSelect: (normalizedName: string) => void
}
```

**Minimal API:**
- `artists` — Full array of artist cards (for searching)
- `onArtistSelect` — Callback when user selects an artist

**Parent handles:**
- Scrolling to the selected card
- Optional highlight effect

---

## State Management

### Local Component State

```typescript
const [searchQuery, setSearchQuery] = useState('')
const [debouncedQuery, setDebouncedQuery] = useState('')
const [isDropdownOpen, setIsDropdownOpen] = useState(false)
const [selectedIndex, setSelectedIndex] = useState(-1)

const filteredArtists = useMemo(() => {
  if (!debouncedQuery) return []
  return searchArtists(debouncedQuery, artists)
}, [debouncedQuery, artists])
```

### Refs

```typescript
const inputRef = useRef<HTMLInputElement>(null)
const dropdownRef = useRef<HTMLDivElement>(null)
const resultRefs = useRef<(HTMLButtonElement | null)[]>([])
```

**Used for:**
- `inputRef` — Focus management, clearing input
- `dropdownRef` — Click-outside detection
- `resultRefs` — Keyboard navigation scroll-into-view

### Debouncing Implementation

```typescript
// Option A: Custom hook (recommended, reusable)
const debouncedQuery = useDebounce(searchQuery, 200)

// Option B: Inline useEffect
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery)
  }, 200)
  return () => clearTimeout(timer)
}, [searchQuery])
```

### Click-Outside Detection

```typescript
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      inputRef.current &&
      !inputRef.current.contains(event.target as Node)
    ) {
      setIsDropdownOpen(false)
    }
  }

  if (isDropdownOpen) {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }
}, [isDropdownOpen])
```

---

## Integration Points

### ArtistScene.tsx Changes

**Add state and handler:**
```typescript
const handleArtistSelect = (normalizedName: string) => {
  // Find the card in the DOM
  const cardElement = document.querySelector(
    `[data-artist="${normalizedName}"]`
  ) as HTMLElement

  if (cardElement) {
    // Smooth scroll to center of viewport
    cardElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })

    // Optional: Add temporary highlight effect
    cardElement.classList.add('artist-card-highlight')
    setTimeout(() => {
      cardElement.classList.remove('artist-card-highlight')
    }, 600)
  }
}
```

**Insert search component:**
```tsx
{/* Between subtitle and sort buttons */}
<p className="font-sans text-lg md:text-xl text-white/85 mb-6">
  {artistCount} artists · {totalConcerts} concerts
</p>

{/* NEW: Artist Search */}
<div className="mb-4 w-full max-w-md mx-auto pointer-events-auto">
  <ArtistSearchTypeahead
    artists={artistCards}
    onArtistSelect={handleArtistSelect}
  />
</div>

{/* Existing: Control Buttons */}
<div className="flex justify-center gap-2 flex-wrap">
  <button onClick={() => setSortOrder('alphabetical')} ...>
```

**Optional: Add highlight CSS:**
```css
@keyframes artist-card-highlight {
  0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(168, 85, 247, 0); }
}

.artist-card-highlight {
  animation: artist-card-highlight 600ms ease-out;
}
```

### ArtistMosaic.tsx Changes

**Add data attribute to card wrapper:**
```tsx
<motion.div
  key={artist.normalizedName}
  data-artist={artist.normalizedName}  // ← NEW: Enables querySelector
  layout
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}
  ...
>
```

**One line change, no other modifications needed.**

---

## Accessibility

### ARIA Attributes

**Input:**
```tsx
<input
  ref={inputRef}
  type="text"
  role="combobox"
  aria-label="Search artists"
  aria-autocomplete="list"
  aria-controls="artist-search-results"
  aria-expanded={isDropdownOpen}
  aria-activedescendant={
    selectedIndex >= 0
      ? `artist-result-${filteredArtists[selectedIndex].normalizedName}`
      : undefined
  }
/>
```

**Dropdown:**
```tsx
<ul
  id="artist-search-results"
  role="listbox"
  aria-label="Artist search results"
>
```

**Result Item:**
```tsx
<li
  id={`artist-result-${artist.normalizedName}`}
  role="option"
  aria-selected={index === selectedIndex}
>
  <button>...</button>
</li>
```

### Keyboard Support

| Key Combination | Action |
|----------------|--------|
| Tab | Move focus to search input |
| Shift + Tab | Move focus from search input to previous element |
| Arrow Down / Arrow Up | Navigate results |
| Enter | Select result |
| Escape | Close dropdown, clear search |
| Ctrl/Cmd + K | Optional: Focus search (future enhancement) |

### Screen Reader Announcements

Use `aria-live` regions to announce:
- Result count: "5 artists found"
- Selection: "Selected: Violent Femmes"
- Empty state: "No artists found"

```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {filteredArtists.length > 0
    ? `${filteredArtists.length} artists found`
    : searchQuery
      ? 'No artists found'
      : ''
  }
</div>
```

### Focus Management

**On dropdown open:**
- Input remains focused
- Arrow keys navigate results
- Visual focus indicator moves (purple background)

**On selection:**
- Close dropdown
- Return focus to input (optional: blur to return to page)

**On Escape:**
- Close dropdown
- Clear search
- Blur input (returns focus to page)

---

## Edge Cases & Error Handling

### No Results

**Display:**
```tsx
<div className="px-4 py-8 text-center text-gray-500">
  <div className="text-lg mb-2">🎸</div>
  <div className="text-sm">No artists found</div>
  <div className="text-xs text-gray-600 mt-1">
    Try a different search term
  </div>
</div>
```

### Empty Input

**Behavior:**
- Dropdown closes immediately
- No "no results" message
- Clear button hidden

### Very Long Artist Names

**Handling:**
```tsx
<div className="flex-1 min-w-0">  {/* min-w-0 enables truncation */}
  <div className="text-white font-semibold truncate">
    {artist.name}
  </div>
  <div className="text-gray-400 text-sm truncate">
    {artist.primaryGenre}
  </div>
</div>
```

### Special Characters

**Examples that should work:**
- "AC/DC" — Forward slash
- "Beyoncé" — Accented characters
- "deadmau5" — Numbers
- "!!!!" (Chk Chk Chk) — Punctuation

**Normalization:**
Search is performed on the display name (with special chars), not normalized name. This ensures "AC/DC" matches when user types "ac/dc" or "acdc".

### Rapid Typing

**Handled by debouncing:**
- Typing "violent femmes" fast only triggers 1 search (after 200ms pause)
- Previous search results don't flicker/update mid-type

### Artist Not in Viewport

**Scenario:** User searches for artist that hasn't been lazy-loaded yet.

**Solution:**
The search operates on the full `artistCards` array (all artists, not just visible ones). When user selects, `scrollIntoView()` will trigger the Intersection Observer to load more batches as needed to reach the target card.

**Why this works:**
- Lazy loading only affects rendering, not data availability
- Smooth scroll gives time for batches to load progressively
- User sees loading indicators (if needed) during scroll

---

## Performance Considerations

### Debouncing

**200ms delay prevents:**
- Excessive search executions (60 searches/sec → ~5 searches/sec)
- Unnecessary re-renders
- UI jank from rapid state updates

**Trade-off:**
- 200ms feels instant to users
- Standard industry practice (Google uses ~150-200ms)

### Memoization

```typescript
const filteredArtists = useMemo(() => {
  if (!debouncedQuery) return []
  return searchArtists(debouncedQuery, artists)
}, [debouncedQuery, artists])
```

**Prevents:**
- Re-searching on every render
- Unnecessary sorting/filtering operations

**Recalculates only when:**
- `debouncedQuery` changes (user typed and debounce completed)
- `artists` array changes (rare, only on data reload)

### Virtual Scrolling Decision

**NOT NEEDED** because:
- Max 20 results shown (limited by algorithm)
- Each result is lightweight (text only, no images)
- Modern browsers handle 20 DOM nodes trivially
- Added complexity not worth marginal benefit

**If we later support 100+ results:**
- Consider `react-window` or `@tanstack/react-virtual`
- Would reduce to ~10-15 rendered items at once

---

## Testing Checklist

### Functional Tests

- [ ] Search filters correctly by exact match
- [ ] Search filters correctly by starts-with
- [ ] Search filters correctly by contains
- [ ] Search filters correctly by word matching
- [ ] Results sorted by score (most relevant first)
- [ ] Debouncing prevents excessive filtering (verify with console.log)
- [ ] Selecting artist scrolls to correct card
- [ ] Scroll-to works with all 3 sort orders (A-Z, Genre, Most Seen)
- [ ] Clear button clears input and closes dropdown
- [ ] Search input works with special characters (AC/DC, Beyoncé)

### Keyboard Navigation Tests

- [ ] Arrow Down opens dropdown and selects first result
- [ ] Arrow Down moves selection down, wraps to top
- [ ] Arrow Up moves selection up, wraps to bottom
- [ ] Enter key selects highlighted result
- [ ] Escape key closes dropdown and clears search
- [ ] Tab key closes dropdown and moves focus
- [ ] Selected result scrolls into view in dropdown

### Interaction Tests

- [ ] Click result item selects artist
- [ ] Click outside dropdown closes it
- [ ] Hover changes result background color
- [ ] Keyboard selection shows purple background
- [ ] Focus state shows purple border/ring on input

### Edge Cases

- [ ] Empty search (no query) closes dropdown
- [ ] No results shows "No artists found" message
- [ ] Single result works correctly
- [ ] Very long artist name truncates properly
- [ ] Rapid typing only triggers search after debounce
- [ ] Searching for un-loaded artist (lazy loading) works
- [ ] Switching sort order while search active updates results

### Mobile Tests

- [ ] Touch targets are 44px minimum
- [ ] Virtual keyboard appears on tap
- [ ] Dropdown visible above keyboard (or closes if too small)
- [ ] Tap result selects artist
- [ ] Tap outside closes dropdown
- [ ] Scrolling in dropdown works smoothly

### Accessibility Tests

- [ ] Tab key navigates to search input
- [ ] Arrow keys navigate results
- [ ] Screen reader announces result count
- [ ] ARIA attributes correct (combobox, listbox, option)
- [ ] Keyboard-only navigation works completely
- [ ] Focus indicators visible and clear

### Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, macOS and iOS)
- [ ] Edge (latest)

---

## Design System Consistency

### Button vs Input Styling

**Confirmed Pattern:**
- **Primary Toggle Controls** (Sort buttons) → Solid backgrounds
  - Inactive: `bg-white border-gray-300`
  - Active: `bg-violet-600 text-white`
- **Input Fields** (Search) → Glassmorphism
  - Base: `bg-white/10 backdrop-blur-sm border-white/20`
  - Focus: `border-purple-400 ring-purple-500/30`

**Why Different?**
1. Buttons need strong affordance ("click me")
2. Inputs benefit from subtle, elegant styling
3. Creates visual hierarchy: Bold toggles vs soft inputs
4. Differentiates control types at a glance

### Color Consistency

**Artist Scene (Light Theme):**
- Background: `bg-stone-50`
- Active controls: `bg-violet-600` (NOT indigo, matches Scene 5)
- Focus/accent: Purple family (`purple-400`, `purple-500`)

**Why Violet?**
- Scenes 3-4 use `indigo-600` (dark backgrounds)
- Scenes 5-6 use `violet-600` (light backgrounds)
- Warmer tone complements light stone/lavender backgrounds

### Typography Consistency

All text uses existing app font stack:
- **Primary:** Source Sans 3 (sans-serif)
- **Headings:** Playfair Display (serif) — not used in search
- **Monospace:** Courier New — not used in search

Font sizes match established patterns:
- 16px for primary text (artist names, input)
- 14px for secondary text (genres)
- 12px for badges (times seen)

---

## Future Enhancements (Out of Scope)

### Phase 2 Additions

1. **Search History**
   - Show recent searches below input when focused (empty query)
   - localStorage persistence
   - Clear history option

2. **Keyboard Shortcut**
   - Cmd/Ctrl + K to focus search
   - Follows industry standard (VS Code, GitHub, etc.)

3. **Multi-Field Search**
   - Search artist name AND genre
   - Example: "rock" returns all rock artists
   - Requires different result display (highlight matching field)

4. **Search Analytics**
   - Track popular searches
   - Identify missing artists (lots of searches, no results)
   - Improve ranking algorithm based on user behavior

5. **Voice Search**
   - Web Speech API integration
   - Microphone button in input
   - Mobile-first feature

6. **Search Highlighting in Grid**
   - Dim non-matching cards when search active
   - Spotlight effect on matching artists
   - Would require grid filtering capability

### Not Recommended

1. **Global Search Across Scenes**
   - Architectural complexity (routing, state management)
   - Each scene has different data models
   - Better to add scene-specific searches

2. **AI-Powered Search**
   - Overkill for ~100-200 artists
   - Simple string matching is sufficient and instant
   - Would add latency and complexity

3. **Search Filters (Genre, Venue, etc.)**
   - MultiSelectFilter already exists for this use case
   - Scene is focused on artist browsing, not filtering
   - Adds UI complexity without clear benefit

---

## Label Improvement: "Weighted" → "Most Seen"

As part of this feature, we're also improving the sort button labels for clarity:

**Change:**
- Old: "Weighted"
- New: "Most Seen"

**Rationale:**
- "Weighted" is unclear to users (weighted by what?)
- "Most Seen" explicitly describes what the sort does
- Matches the "Times Seen" badge shown when active
- More accessible language

**Implementation:**
```tsx
// In ArtistScene.tsx, line ~140
<button
  onClick={() => setSortOrder('timesSeen')}
  className={...}
>
  Most Seen  {/* Changed from "Weighted" */}
</button>
```

**Note:** No icon added (per design team request)

---

## Implementation Timeline

### Window 1: Core Component (90-120 min)
**Tasks:**
1. Create `ArtistSearchTypeahead.tsx` with basic structure
2. Implement search algorithm with multi-tier scoring
3. Wire up to `artistCards` prop
4. Build dropdown UI with result items
5. Add debouncing (200ms)
6. Test filtering logic with various queries

**Deliverables:**
- Working search component (isolated)
- All search tiers functional (exact, starts-with, contains, word)
- Dropdown displays results correctly

### Window 2: Interactions & Integration (90-120 min)
**Tasks:**
7. Add keyboard navigation (arrows, enter, escape)
8. Implement click-outside-to-close
9. Connect to parent for artist selection
10. Add scroll-to-artist behavior in ArtistScene
11. Add `data-artist` attributes to ArtistMosaic cards
12. Test all keyboard flows

**Deliverables:**
- Full keyboard navigation working
- Scroll-to-artist functional with all sort orders
- Integrated into ArtistScene header

### Window 3: Polish & Testing (60-90 min)
**Tasks:**
13. Add Framer Motion animations (fade-in dropdown)
14. Implement highlight matching in result text (optional)
15. Add empty state and proper styling
16. Mobile testing and touch target adjustments
17. Accessibility audit (ARIA, screen reader, keyboard)
18. Cross-browser testing

**Deliverables:**
- Polished animations
- Mobile-optimized
- Accessibility compliant
- Production-ready

**Total Estimated Time:** 4-6 hours (single session or 2-3 windows)

---

## Success Metrics

### User Experience
- Users can find any artist in <5 seconds
- Zero learning curve (intuitive keyboard navigation)
- Works seamlessly on mobile and desktop

### Technical Performance
- Search executes in <2ms
- No janky scrolling or dropdown flicker
- Debouncing prevents excessive re-renders

### Design Consistency
- Matches established design system
- Glassmorphism for inputs, solid for toggles
- Purple accent color throughout

### Accessibility
- Full keyboard navigation
- Screen reader compatible
- WCAG 2.1 Level AA compliant

---

## Dependencies

### Required
- ✅ Artist Scene (v1.4.0) — Already implemented
- ✅ ArtistCard data structure with `normalizedName` field
- ✅ Framer Motion library (already in package.json)
- ✅ React hooks (useState, useEffect, useMemo, useRef)

### Optional
- 🔲 Custom `useDebounce` hook (can be inlined if preferred)

### None Needed
- ❌ No new npm packages
- ❌ No API calls
- ❌ No backend changes
- ❌ No database updates

---

## Appendix: Code Snippets

### Complete useDebounce Hook

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
```

### Result Item Component Template

```tsx
{filteredArtists.map((artist, index) => (
  <li
    key={artist.normalizedName}
    id={`artist-result-${artist.normalizedName}`}
    role="option"
    aria-selected={index === selectedIndex}
  >
    <button
      ref={el => resultRefs.current[index] = el}
      onClick={() => handleSelectArtist(artist)}
      onPointerDown={(e) => e.preventDefault()}  // Prevents input blur
      className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
        index === selectedIndex
          ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
          : 'text-gray-300 hover:bg-gray-800'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">
          {artist.name}
        </div>
        <div className="text-sm text-gray-400 truncate">
          {artist.primaryGenre}
        </div>
      </div>
      {artist.timesSeen > 1 && (
        <div className="ml-3 px-2 py-0.5 bg-violet-600 text-white text-xs font-bold rounded-full">
          ×{artist.timesSeen}
        </div>
      )}
    </button>
  </li>
))}
```

### Keyboard Navigation Handler Template

```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (!isDropdownOpen) {
        setIsDropdownOpen(true)
        setSelectedIndex(0)
      } else {
        setSelectedIndex(prev =>
          prev < filteredArtists.length - 1 ? prev + 1 : 0
        )
      }
      break

    case 'ArrowUp':
      e.preventDefault()
      if (isDropdownOpen) {
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredArtists.length - 1
        )
      }
      break

    case 'Enter':
      e.preventDefault()
      if (selectedIndex >= 0 && filteredArtists[selectedIndex]) {
        handleSelectArtist(filteredArtists[selectedIndex])
      }
      break

    case 'Escape':
      setIsDropdownOpen(false)
      setSearchQuery('')
      inputRef.current?.blur()
      break
  }
}
```

---

**End of Specification**

**Questions or Feedback:** Contact the design/engineering team before beginning implementation.
