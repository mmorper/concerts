# State Management Skill

**Version:** 1.0.0
**Last Updated:** 2026-01-09

---

## Overview

State management in the Morperhaus Concert Archives follows clear patterns for maintaining consistency across 5 interactive scenes, URL synchronization, and data flow.

**Core Principles:**
- URL-driven state for deep linking and shareability
- Zustand store for global filters (future use, currently minimal usage)
- React useState for local component state
- Props for parent-child communication
- URL params remain the source of truth for scene and entity focus

---

## State Architecture

### 1. URL State (Source of Truth)

URL query parameters drive navigation and entity focus:

```typescript
// App.tsx - URL parameter handling
useEffect(() => {
  const params = new URLSearchParams(location.search)
  const sceneParam = params.get('scene')      // Which scene to show
  const artistParam = params.get('artist')    // Artist to focus
  const venueParam = params.get('venue')      // Venue to focus

  // Parse and apply URL state...
}, [location.search, loading])
```

**When to use:**
- Scene navigation (`?scene=artists`)
- Entity focus (`?scene=artists&artist=depeche-mode`)
- Shareable links
- Cross-scene navigation

**URL State Mapping:**

| Parameter | Values | Controls |
|-----------|--------|----------|
| `scene` | `timeline`, `venues`, `geography`, `genres`, `artists` | Active scene scroll position |
| `artist` | Normalized artist name | Artist gatefold or venue spotlight filter |
| `venue` | Normalized venue name | Venue expansion/focus in graph or map |

### 2. App-Level State (MainScenes Component)

Top-level state manages scene coordination and pending navigation:

```typescript
// App.tsx MainScenes component
const [currentScene, setCurrentScene] = useState(1)
const [data, setData] = useState<ConcertData | null>(null)
const [loading, setLoading] = useState(true)

// Pending entity focus states (set by URL, cleared by scenes)
const [pendingVenueFocus, setPendingVenueFocus] = useState<string | null>(null)
const [pendingMapVenueFocus, setPendingMapVenueFocus] = useState<string | null>(null)
const [pendingArtistFocus, setPendingArtistFocus] = useState<string | null>(null)
const [pendingVenueArtistFocus, setPendingVenueArtistFocus] = useState<{
  venue: string
  artist?: string
} | null>(null)
```

**Pattern: Pending State for Cross-Scene Navigation**

When URL changes trigger navigation:
1. App reads URL params
2. App sets `pendingXFocus` state
3. App scrolls to target scene
4. Scene receives focus via props
5. Scene acts on the pending focus
6. Scene calls `onFocusComplete()` to clear pending state

**Why this pattern?**
- Decouples URL parsing from scene logic
- Allows scenes to be lazy/not mounted when URL changes
- Enables scenes to animate/prepare before focus
- Prevents race conditions between scroll and entity focus

### 3. Global Store (Zustand)

Shared state for filters (minimal current usage):

```typescript
// src/store/useFilterStore.ts
export const useFilterStore = create<FilterState>((set, get) => ({
  // Filter state
  searchQuery: '',
  selectedArtists: [],
  selectedGenres: [],
  selectedVenues: [],
  selectedCities: [],
  yearRange: [1995, 2024],
  hasOpenersOnly: false,

  // Actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleArtist: (artist) => set((state) => ({
    selectedArtists: state.selectedArtists.includes(artist)
      ? state.selectedArtists.filter((a) => a !== artist)
      : [...state.selectedArtists, artist]
  })),
  clearFilters: () => set({ /* reset all */ }),
  getActiveFilterCount: () => { /* compute */ }
}))
```

**When to use Zustand:**
- Cross-scene filters (when implemented)
- Global settings/preferences
- State needed by multiple unrelated components

**Current usage:**
- `useConcertData` hook consumes filter store (prepared for future filtering UI)
- Not yet exposed in UI (planned enhancement)

**When NOT to use Zustand:**
- Scene-specific state (use local useState)
- Temporary UI state (modals, tooltips, animations)
- State derived from props

### 4. Component-Level State (useState)

Local state for component-specific concerns:

```typescript
// Scene4Bands.tsx (Venues scene)
const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
const [viewMode, setViewMode] = useState<ViewMode>('top10')
const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set())
const [centeredVenue, setCenteredVenue] = useState<string | null>(null)
const [focusedArtist, setFocusedArtist] = useState<string | null>(null)

// ArtistScene.tsx
const [sortOrder, setSortOrder] = useState<SortOrder>('timesSeen')
const [openArtist, setOpenArtist] = useState<ArtistCard | null>(null)
const [clickedTileRect, setClickedTileRect] = useState<DOMRect | null>(null)
```

**When to use useState:**
- UI state (expanded/collapsed, focused, sorting)
- Animation state (rects, transitions)
- Form inputs
- Temporary selections

### 5. Computed State (useMemo)

Derive state from props/other state for performance:

```typescript
// Memoize expensive computations
const sortedVenues = useMemo(() => {
  return Array.from(venueStats.venueCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([venue]) => venue)
}, [venueStats])

const filteredConcerts = useMemo(() => {
  return data.concerts.filter((concert) => {
    // Apply filters...
  })
}, [data, searchQuery, selectedArtists, /* ... */])
```

**When to use useMemo:**
- Filtering large datasets
- Sorting/grouping operations
- Complex transformations
- Any computation that depends on specific dependencies

---

## State Flow Patterns

### Pattern 1: Deep Linking Flow

**User clicks deep link** → URL changes → App parses → Scene receives focus → Scene animates

```typescript
// 1. URL: /?scene=artists&artist=depeche-mode

// 2. App.tsx detects URL change
useEffect(() => {
  const artistParam = params.get('artist') // 'depeche-mode'
  if (artistParam && sceneId === 5) {
    setPendingArtistFocus(artistParam)  // Set pending state
  }
  // Scroll to scene...
}, [location.search])

// 3. ArtistScene receives prop
<ArtistScene
  pendingArtistFocus={pendingArtistFocus}
  onArtistFocusComplete={() => setPendingArtistFocus(null)}
/>

// 4. ArtistScene.tsx handles focus
useEffect(() => {
  if (!pendingArtistFocus) return

  setTimeout(() => {
    handleArtistSelect(pendingArtistFocus)  // Find card, scroll, open
    onArtistFocusComplete?.()                // Clear pending
  }, 500) // Allow scene to mount/scroll
}, [pendingArtistFocus])
```

### Pattern 2: Cross-Scene Navigation

**Scene A triggers navigation** → App state updates → URL updates → Pattern 1 continues

```typescript
// Example: Map venue popup → "Explore Venue" button

// 1. Scene3Map.tsx - User clicks venue marker
const handleVenueClick = (venue: string) => {
  // Normalize venue name for URL
  const venueNormalized = venue.toLowerCase().replace(/[^a-z0-9]/g, '-')

  // Navigate with URL params
  navigate(`/?scene=venues&venue=${venueNormalized}`)
}

// 2. App.tsx receives new URL and applies Pattern 1
```

**Alternative: Callback-based navigation (used for some internal navigation)**

```typescript
// App.tsx provides callback
const handleVenueNavigate = (venueName: string) => {
  setPendingVenueFocus(venueName)

  // Scroll to venues scene
  scrollContainer.scrollTo({
    top: (2 - 1) * windowHeight,
    behavior: 'smooth'
  })
}

// Pass to child scene
<Scene3Map onVenueNavigate={handleVenueNavigate} />
```

### Pattern 3: Local State Updates

**User interaction** → Component setState → UI updates → Optional analytics

```typescript
// Scene4Bands.tsx - User clicks view mode button
<button
  onClick={() => {
    analytics.trackEvent('venue_view_mode_changed', {
      new_mode: 'all'
    })
    setViewMode('all')              // Local state
    setExpandedVenues(new Set())    // Reset related state
    setFocusedNodeId(null)          // Clear focus
  }}
>
  All Venues
</button>
```

### Pattern 4: Data Loading

**App mounts** → Fetch data → Loading state → Pass to scenes

```typescript
// App.tsx - Top-level data fetch
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

// Loading state UI
if (loading) return <LoadingSpinner />
if (!data) return <ErrorState />

// Pass data to all scenes
return (
  <>
    <Scene1Hero concerts={data.concerts} />
    <Scene4Bands concerts={data.concerts} />
    {/* ... */}
  </>
)
```

**Data is:**
- Fetched once on mount
- Stored in App state
- Passed as props to all scenes
- Never mutated (read-only)

---

## Scene-Specific State Patterns

### Scene 1: Timeline (Scene1Hero)

```typescript
// Props-only, no local state
interface Scene1HeroProps {
  concerts: Concert[]
  onNavigateToArtist?: (artistName: string) => void
}

// Provides callback for cross-scene navigation
<button onClick={() => onNavigateToArtist?.(artistName)}>
  View Artist
</button>
```

### Scene 2: Venues (Scene4Bands)

```typescript
// Complex local state for D3 graph interactions
const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
const [viewMode, setViewMode] = useState<ViewMode>('top10')
const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set())
const [centeredVenue, setCenteredVenue] = useState<string | null>(null)
const [focusedArtist, setFocusedArtist] = useState<string | null>(null) // For spotlight filter

// Receives pending focus from URL/navigation
useEffect(() => {
  if (!pendingVenueFocus) return

  const venueName = matchingConcert.venue
  setExpandedVenues(new Set([venueName]))
  setCenteredVenue(venueName)
  setFocusedNodeId(`venue|${venueName}`)

  onVenueFocusComplete?.()
}, [pendingVenueFocus])
```

### Scene 3: Map (Scene3Map)

```typescript
// Map state managed by Leaflet
// Component state for popup/focus
const [activeVenue, setActiveVenue] = useState<string | null>(null)

// Pending focus from URL
useEffect(() => {
  if (!pendingVenueFocus || !mapRef.current) return

  const venue = venues.find(v => v.normalizedName === pendingVenueFocus)
  mapRef.current.flyTo([venue.lat, venue.lng], 13)
  // Open popup...

  onVenueFocusComplete?.()
}, [pendingVenueFocus])
```

### Scene 5: Artists (ArtistScene)

```typescript
// Sort/filter UI state
const [sortOrder, setSortOrder] = useState<SortOrder>('timesSeen')
const [openArtist, setOpenArtist] = useState<ArtistCard | null>(null)

// Gatefold animation state
const [clickedTileRect, setClickedTileRect] = useState<DOMRect | null>(null)

// Pending artist focus from URL
useEffect(() => {
  if (!pendingArtistFocus) return

  setTimeout(() => {
    handleArtistSelect(pendingArtistFocus)
    onArtistFocusComplete?.()
  }, 500)
}, [pendingArtistFocus])
```

---

## State Synchronization

### Keeping URL in Sync

**When to update URL:**
- User explicitly navigates (scene nav, deep link click)
- Cross-scene navigation buttons

**When NOT to update URL:**
- Local UI interactions (expand/collapse, sort, hover)
- Temporary state changes
- Animation states

**Updating URL:**

```typescript
import { useNavigate, useLocation } from 'react-router-dom'

const navigate = useNavigate()
const location = useLocation()

// Navigate with new params
navigate(`/?scene=artists&artist=depeche-mode`)

// Update existing params
const searchParams = new URLSearchParams(location.search)
searchParams.set('artist', 'depeche-mode')
navigate(`${location.pathname}?${searchParams.toString()}`)

// Clear params
searchParams.delete('artist')
navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true })
```

### Scroll Position Sync

Scene detection from scroll:

```typescript
// App.tsx - Track current scene from scroll
useEffect(() => {
  const handleScroll = () => {
    const scrollPosition = scrollContainer.scrollTop
    const windowHeight = window.innerHeight
    const sceneIndex = Math.round(scrollPosition / windowHeight) + 1
    const newScene = Math.min(Math.max(sceneIndex, 1), 5)

    if (newScene !== currentScene) {
      setCurrentScene(newScene)
      analytics.trackEvent('scene_view', { scene_number: newScene })
    }
  }

  scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
  return () => scrollContainer.removeEventListener('scroll', handleScroll)
}, [currentScene])
```

---

## Custom Hooks for State

### useConcertData (Global Filter Hook)

Centralized filtering logic that consumes Zustand store:

```typescript
// src/hooks/useConcertData.ts
export function useConcertData(data: ConcertData | null) {
  const { searchQuery, selectedArtists, yearRange } = useFilterStore()

  const filteredConcerts = useMemo(() => {
    if (!data) return []
    return data.concerts.filter(concert => {
      // Apply all filters...
    })
  }, [data, searchQuery, selectedArtists, /* ... */])

  return { concerts: data?.concerts || [], filteredConcerts, stats }
}
```

**Usage:**
```typescript
const { filteredConcerts, stats } = useConcertData(data)
```

### useChangelogCheck (Feature State Hook)

Manages changelog toast visibility:

```typescript
// src/hooks/useChangelogCheck.ts
export function useChangelogCheck(currentScene: number) {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    // Check localStorage for seen releases
    // Only show on Scene 1
    // Return dismissal callbacks
  }, [currentScene])

  return { shouldShow, dismissToast, markAsSeen }
}
```

---

## State Persistence

### localStorage

Used for:
- Changelog "seen" tracking
- User preferences (future: theme, settings)

```typescript
// Example: Changelog toast persistence
const STORAGE_KEY = 'concerts:changelog:lastSeen'

const lastSeenVersion = localStorage.getItem(STORAGE_KEY)
const shouldShow = latestVersion > lastSeenVersion

const markAsSeen = () => {
  localStorage.setItem(STORAGE_KEY, latestVersion)
}
```

**Guidelines:**
- Prefix all keys with `concerts:`
- Handle missing localStorage gracefully (private mode)
- Validate/migrate old data structures

### URL State (No Persistence Needed)

URL params are the persistence layer for navigation:
- Shareable
- Bookmarkable
- Browser back/forward compatible
- No localStorage needed

---

## Common Patterns

### ✅ DO: Lift State When Needed

If multiple components need the same state, lift to nearest common ancestor:

```typescript
// ❌ BAD: Duplicate state in siblings
<VenueGraph focusedVenue={venueA} />
<VenueList focusedVenue={venueB} />

// ✅ GOOD: Lifted to parent
function VenueScene() {
  const [focusedVenue, setFocusedVenue] = useState(null)

  return (
    <>
      <VenueGraph focused={focusedVenue} onFocus={setFocusedVenue} />
      <VenueList focused={focusedVenue} onFocus={setFocusedVenue} />
    </>
  )
}
```

### ✅ DO: Use Callbacks for Child → Parent Communication

```typescript
// Parent provides callback
<ArtistCard
  artist={artist}
  onClick={(artist, rect) => {
    setOpenArtist(artist)
    setClickedTileRect(rect)
  }}
/>

// Child calls it
<div onClick={() => onClick?.(artist, rect)}>
```

### ✅ DO: Clear Pending State After Consumption

```typescript
useEffect(() => {
  if (!pendingArtistFocus) return

  // Handle the focus
  handleArtistSelect(pendingArtistFocus)

  // Clear it immediately
  onArtistFocusComplete?.()
}, [pendingArtistFocus])
```

### ✅ DO: Memoize Expensive Computations

```typescript
const venueStats = useMemo(() => {
  // Expensive computation...
  return { venueCounts, venueHeadliners, venueOpeners }
}, [concerts]) // Only recompute if concerts change
```

### ❌ DON'T: Duplicate State

```typescript
// ❌ BAD: URL and state out of sync
const [selectedArtist, setSelectedArtist] = useState(null)
const artistParam = params.get('artist')
// Which is the source of truth?

// ✅ GOOD: URL is the source of truth
const artistParam = params.get('artist')
// Use artistParam directly or derive state from it
```

### ❌ DON'T: Store Derived State

```typescript
// ❌ BAD: Storing derived value
const [filteredConcerts, setFilteredConcerts] = useState([])
useEffect(() => {
  setFilteredConcerts(concerts.filter(/* ... */))
}, [concerts, searchQuery])

// ✅ GOOD: Compute on demand
const filteredConcerts = useMemo(() => {
  return concerts.filter(/* ... */)
}, [concerts, searchQuery])
```

### ❌ DON'T: Overuse Global State

```typescript
// ❌ BAD: Global store for local UI state
const { tooltipOpen, setTooltipOpen } = useGlobalStore()

// ✅ GOOD: Local state for local UI
const [tooltipOpen, setTooltipOpen] = useState(false)
```

---

## Debugging State

### React DevTools

- Inspect component state/props hierarchy
- Track state changes over time
- Identify unnecessary re-renders

### Zustand DevTools

```typescript
import { devtools } from 'zustand/middleware'

export const useFilterStore = create(
  devtools<FilterState>(
    (set, get) => ({ /* ... */ }),
    { name: 'FilterStore' }
  )
)
```

### Console Logging

```typescript
// Add temporary logging for state transitions
useEffect(() => {
  console.log('Venue focus changed:', { pendingVenueFocus, focusedNodeId })
}, [pendingVenueFocus, focusedNodeId])
```

### URL Inspection

- Check URL params match expected state
- Use browser back/forward to test URL state sync
- Share URLs to test deep linking

---

## Related Documentation

- [Deep Linking Guide](../../../docs/DEEP_LINKING.md) - URL state patterns
- [Analytics Skill](./../analytics/SKILL.md) - Event tracking patterns
- [Design System Skill](./../design-system/SKILL.md) - UI component patterns

---

## Future Enhancements

Planned state management improvements:

1. **Global Filter UI**
   - Expose `useFilterStore` in UI
   - Add filter panel to scenes
   - Sync filters with URL params

2. **Undo/Redo for Graph Interactions**
   - Store interaction history in state
   - Enable keyboard shortcuts (Cmd+Z)

3. **Persisted User Preferences**
   - Theme selection
   - Default sort orders
   - Scene auto-play settings

4. **Optimistic Updates**
   - For future write operations (bookmarks, notes)
   - Update UI immediately, sync to server in background
