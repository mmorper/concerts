# Code Organization Skill

**Version:** 1.0.0
**Last Updated:** 2026-01-09

---

## Overview

The Morperhaus Concert Archives follows clear organizational patterns for maintainability and discoverability. The structure emphasizes separation of concerns, feature-based organization, and consistent naming conventions.

**Core Principles:**
- Feature-based component organization (scenes, changelog, filters)
- Shared utilities in dedicated directories (hooks, services, utils)
- Type definitions centralized and importable
- Build scripts separate from application code
- Documentation co-located with code when possible

---

## Project Structure

```
concerts/
├── .claude/                 # Claude Code configuration
│   ├── commands/            # Custom slash commands
│   ├── skills/              # Skill documentation
│   ├── context.md           # Project context for Claude
│   └── readme-maintenance.md
├── docs/                    # Project documentation
│   ├── DATA_PIPELINE.md
│   ├── DEEP_LINKING.md
│   └── specs/               # Feature specifications
│       ├── implemented/     # Completed features
│       └── proposed/        # Planned features
├── public/                  # Static assets
│   ├── data/                # Generated data files
│   │   ├── concerts.json
│   │   ├── artists-metadata.json
│   │   └── venues-metadata.json
│   └── images/              # Static images
├── scripts/                 # Build & data pipeline scripts
│   ├── build-data.ts        # Main data pipeline
│   ├── enrich-*.ts          # Data enrichment scripts
│   ├── validate-*.ts        # Validation scripts
│   └── generate-*.ts        # Code generation scripts
├── src/                     # Application source code
│   ├── components/          # React components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # External API clients
│   ├── store/               # Global state (Zustand)
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── constants/           # App constants
│   ├── data/                # Static app data
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── test/                    # Test files
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── CLAUDE.md                # Project overview for Claude
```

---

## Source Code Organization

### 1. Components Directory

**Pattern: Feature-based organization with scene-specific directories**

```
src/components/
├── scenes/                    # Main interactive scenes
│   ├── Scene1Hero.tsx         # Timeline scene
│   ├── Scene2Venues.tsx       # [Deprecated] Old venues scene
│   ├── Scene3Map.tsx          # Geography/map scene
│   ├── Scene4Bands.tsx        # Venues graph scene
│   ├── Scene5Genres/          # Genre treemap scene (complex)
│   │   ├── index.tsx
│   │   ├── GenreTreemap.tsx
│   │   ├── TimelineSlider.tsx
│   │   ├── useTreemapLayout.ts
│   │   └── useTimelineAnimation.ts
│   └── ArtistScene/           # Artist mosaic scene (complex)
│       ├── ArtistScene.tsx    # Main scene container
│       ├── ArtistMosaic.tsx   # Grid of artist cards
│       ├── ArtistCard.tsx     # Individual card
│       ├── ArtistGatefold.tsx # Desktop overlay
│       ├── PhoneArtistModal.tsx # Mobile full-screen
│       ├── ArtistSearchTypeahead.tsx
│       ├── useArtistData.ts   # Data fetching hook
│       └── types.ts           # Scene-specific types
├── changelog/                 # Changelog feature
│   ├── ChangelogPage.tsx
│   ├── ChangelogToast.tsx
│   ├── ChangelogRSS.tsx
│   └── constants.ts
├── TimelineHoverPreview/      # Timeline hover cards
│   ├── TimelineHoverPreview.tsx
│   ├── TimelineHoverContent.tsx
│   ├── useTimelineHover.ts
│   └── useArtistMetadata.ts
├── TimelineYearFilter/        # Year filter cards
│   ├── YearCardStack.tsx
│   └── StackedCard.tsx
├── filters/                   # Filter components (future)
├── map/                       # Map-specific components
├── timeline/                  # Timeline-specific components
│   └── TimelineContainer.tsx
└── SceneNavigation.tsx        # Scene nav dots
```

**Guidelines:**

**When to create a directory:**
- Scene has 3+ related components
- Scene has custom hooks
- Scene has its own types
- Scene has multiple sub-features

**When to keep files flat:**
- Simple scenes (1-2 components)
- Shared components
- Single-purpose utilities

**Naming patterns:**
- Scene containers: `Scene1Hero.tsx`, `ArtistScene.tsx`
- Feature directories: `ArtistScene/`, `changelog/`
- Index files: `index.tsx` exports main component
- Hooks: `useArtistData.ts`, `useTreemapLayout.ts`
- Types: `types.ts` co-located with feature

### 2. Hooks Directory

**Pattern: Centralized custom hooks**

```
src/hooks/
├── useConcertData.ts        # Global filter hook
├── useChangelogCheck.ts     # Changelog visibility logic
├── useTourDates.ts          # Ticketmaster API integration
├── useMapSync.ts            # Map state synchronization
├── useDebounce.ts           # Debounce utility
└── useGatefoldOrientation.ts # Responsive gatefold behavior
```

**When to create a hook:**
- Reusable stateful logic across components
- Complex side effects (API calls, subscriptions)
- Derived state calculations
- Cross-cutting concerns (auth, analytics, storage)

**Naming:**
- Prefix with `use` (React convention)
- Descriptive verb + noun: `useConcertData`, `useTourDates`
- Return value documented in JSDoc

**Example:**

```typescript
// hooks/useConcertData.ts
/**
 * Hook for filtering and aggregating concert data
 * Consumes global filter store and returns filtered results
 */
export function useConcertData(data: ConcertData | null) {
  const { searchQuery, selectedArtists } = useFilterStore()

  const filteredConcerts = useMemo(() => {
    // Filtering logic...
  }, [data, searchQuery, selectedArtists])

  return {
    concerts: data?.concerts || [],
    filteredConcerts,
    stats
  }
}
```

### 3. Services Directory

**Pattern: External API clients**

```
src/services/
├── ticketmaster.ts      # Ticketmaster API client
├── setlistfm.ts         # setlist.fm API client
└── analytics.ts         # Google Analytics wrapper
```

**Service structure:**

```typescript
// services/ticketmaster.ts
/**
 * Ticketmaster API client
 * Docs: https://developer.ticketmaster.com/
 */

// 1. Type definitions
interface TourDate {
  date: string
  venue: string
  city: string
}

// 2. Constants
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2'
const API_KEY = import.meta.env.VITE_TICKETMASTER_API_KEY

// 3. Private helper functions
function buildSearchUrl(artistName: string): string {
  // ...
}

// 4. Public API functions
export async function getTourDates(artistName: string): Promise<TourDate[]> {
  // ...
}

// 5. Export singleton if needed
export const ticketmaster = {
  getTourDates
}
```

**When to create a service:**
- External API integration
- Third-party library wrapper
- Stateless utility class
- Cross-cutting infrastructure (analytics, storage)

### 4. Store Directory

**Pattern: Zustand global state**

```
src/store/
└── useFilterStore.ts    # Global filter state (minimal usage currently)
```

**Store structure:**

```typescript
// store/useFilterStore.ts
import { create } from 'zustand'

export interface FilterState {
  // State
  searchQuery: string
  selectedArtists: string[]

  // Actions
  setSearchQuery: (query: string) => void
  toggleArtist: (artist: string) => void
  clearFilters: () => void

  // Derived getters
  getActiveFilterCount: () => number
}

export const useFilterStore = create<FilterState>((set, get) => ({
  // Initial state
  searchQuery: '',
  selectedArtists: [],

  // Actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleArtist: (artist) => set((state) => ({
    selectedArtists: state.selectedArtists.includes(artist)
      ? state.selectedArtists.filter(a => a !== artist)
      : [...state.selectedArtists, artist]
  })),
  clearFilters: () => set({ searchQuery: '', selectedArtists: [] }),

  // Derived getters
  getActiveFilterCount: () => {
    const state = get()
    return (state.searchQuery ? 1 : 0) + state.selectedArtists.length
  }
}))
```

**When to use store:**
- State needed by multiple unrelated components
- Global settings/preferences
- Cross-scene state
- State that outlives component lifecycle

**When NOT to use store:**
- Local component state
- Derived state (use useMemo)
- Temporary UI state

### 5. Types Directory

**Pattern: Centralized type definitions**

```
src/types/
└── concert.ts           # Core domain types
```

**Type organization:**

```typescript
// types/concert.ts

// Main domain types
export interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  venue: string
  venueNormalized: string
  city: string
  state: string
  cityState: string
  location: Location
  openers: string[]
  genre: string
  year: number
}

export interface Location {
  lat: number
  lng: number
}

// Metadata types
export interface ArtistMetadata {
  name: string
  normalizedName: string
  image?: string
  bio?: string
  genres?: string[]
  spotifyUrl?: string
}

export interface VenueMetadata {
  name: string
  normalizedName: string
  photoUrl?: string
  photoAttribution?: string
}

// Data structure types
export interface ConcertData {
  concerts: Concert[]
  metadata: {
    totalConcerts: number
    dateRange: {
      earliest: string
      latest: string
    }
  }
}
```

**When to create types here:**
- Domain models (Concert, Artist, Venue)
- Data file structures (ConcertData, Metadata)
- Shared across multiple features

**When to keep types co-located:**
- Component-specific props (in component file)
- Feature-specific types (in feature directory)
- Internal implementation details

### 6. Utils Directory

**Pattern: Pure utility functions**

```
src/utils/
├── normalize.ts         # Name normalization functions
├── haptics.ts           # Haptic feedback utilities
├── changelogStorage.ts  # localStorage wrappers
└── formatting.ts        # String/date formatting (future)
```

**Utility structure:**

```typescript
// utils/normalize.ts

/**
 * Normalize artist name for URL/ID usage
 * - Converts to lowercase
 * - Replaces special chars with hyphens
 * - Removes consecutive hyphens
 * - Strips leading/trailing hyphens
 */
export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Normalize venue name for URL/ID usage
 * Same rules as artist name normalization
 */
export function normalizeVenueName(name: string): string {
  return normalizeArtistName(name)
}
```

**Guidelines:**
- Pure functions only (no side effects)
- No external dependencies if possible
- Well-documented (JSDoc)
- Testable in isolation
- Single responsibility

### 7. Constants Directory

**Pattern: Application constants**

```
src/constants/
└── colors.ts            # Color palettes (future)
```

**When to create constants:**
- Magic numbers used in multiple places
- Configuration values
- Enum-like values
- Theme values

**Example:**

```typescript
// constants/colors.ts
export const GENRE_COLORS = {
  'alternative-rock': '#6366f1',
  'electronic': '#8b5cf6',
  'industrial': '#ec4899',
  'new-wave': '#14b8a6',
  'post-punk': '#f59e0b'
} as const

export type GenreName = keyof typeof GENRE_COLORS
```

### 8. Data Directory

**Pattern: Static application data**

```
src/data/
└── changelog.json       # Changelog entries
```

**When to put data here:**
- Static JSON data imported at build time
- Small datasets (< 100KB)
- Version-controlled data
- Application configuration

**When to use public/data:**
- Large datasets
- Dynamically fetched at runtime
- Frequently updated data

---

## Scripts Organization

**Pattern: Build, validation, and data pipeline scripts**

```
scripts/
├── build-data.ts                # Main data pipeline orchestrator
├── fetch-google-sheet.ts        # Fetch concert data from Google Sheets
├── enrich-artists.ts            # Add artist metadata
├── enrich-spotify-metadata.ts   # Spotify artist data
├── enrich-venues.ts             # Venue photos via Google Places
├── geocode-venues.ts            # Add lat/lng to venues
├── validate-concerts.ts         # Data integrity checks
├── validate-version-sync.ts     # Version consistency
├── validate-normalization.ts    # Name normalization checks
├── test-places-api.ts           # Test Google Places API
├── generate-og-simple.ts        # Generate OG images
└── cleanup-backups.ts           # Remove old backup files
```

**Script naming patterns:**
- `build-*.ts` - Main pipeline scripts
- `fetch-*.ts` - Data retrieval
- `enrich-*.ts` - Data augmentation
- `validate-*.ts` - Data validation
- `test-*.ts` - API testing
- `generate-*.ts` - Code/asset generation
- `cleanup-*.ts` - Maintenance

**Script structure:**

```typescript
#!/usr/bin/env tsx
/**
 * Script Title
 *
 * Description of what the script does.
 *
 * Usage:
 *   npm run script-name
 *   tsx scripts/script-name.ts [options]
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// 1. Constants
const INPUT_PATH = resolve(process.cwd(), 'data/input.json')
const OUTPUT_PATH = resolve(process.cwd(), 'public/data/output.json')

// 2. Helper functions
function processData(input: any): any {
  // ...
}

// 3. Main function
async function main() {
  console.log('🔄 Starting script...\n')

  try {
    // Read input
    const input = JSON.parse(readFileSync(INPUT_PATH, 'utf-8'))

    // Process
    const output = processData(input)

    // Write output
    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))

    console.log('✅ Script complete!')
  } catch (error) {
    console.error('❌ Script failed:', error)
    process.exit(1)
  }
}

// 4. Entry point
main()
```

---

## File Naming Conventions

### Component Files

```
PascalCase + .tsx extension

✅ ArtistCard.tsx
✅ TimelineSlider.tsx
✅ SceneNavigation.tsx
❌ artistCard.tsx
❌ timeline-slider.tsx
```

### Hook Files

```
camelCase starting with "use" + .ts extension

✅ useConcertData.ts
✅ useTourDates.ts
✅ useDebounce.ts
❌ UseConcertData.ts
❌ concert-data-hook.ts
```

### Service Files

```
camelCase + .ts extension

✅ ticketmaster.ts
✅ analytics.ts
✅ setlistfm.ts
❌ Ticketmaster.ts
❌ ticketmaster-service.ts
```

### Utility Files

```
camelCase + .ts extension

✅ normalize.ts
✅ haptics.ts
✅ changelogStorage.ts
❌ Normalize.ts
❌ changelog-storage.ts
```

### Type Files

```
camelCase + .ts extension

✅ concert.ts
✅ venue.ts
✅ types.ts
❌ Concert.ts
❌ concert-types.ts
```

### Script Files

```
kebab-case + .ts extension

✅ build-data.ts
✅ validate-concerts.ts
✅ enrich-artists.ts
❌ buildData.ts
❌ BuildData.ts
```

---

## Import Organization

### Import Order

```typescript
// 1. External dependencies (React, libraries)
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'

// 2. Internal absolute imports (using @ alias)
import type { Concert } from '@/types/concert'
import { analytics } from '@/services/analytics'
import { useConcertData } from '@/hooks/useConcertData'

// 3. Relative imports (same feature)
import { ArtistCard } from './ArtistCard'
import { useArtistData } from './useArtistData'
import type { SortOrder } from './types'

// 4. Assets/styles
import './styles.css'
```

### Path Aliases

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// Usage
import { Concert } from '@/types/concert'          // Instead of: ../../../types/concert
import { analytics } from '@/services/analytics'   // Instead of: ../../services/analytics
import { useConcertData } from '@/hooks/useConcertData' // Instead of: ../hooks/useConcertData
```

**When to use alias:**
- Imports from src/ subdirectories (types, services, hooks, utils)
- Shared components across features

**When to use relative:**
- Same directory/feature
- Parent/child components
- Co-located utilities

### Import/Export Patterns

**Named exports (preferred):**

```typescript
// ✅ GOOD: Named exports
export function ArtistCard({ artist }: Props) {
  // ...
}

export function useArtistData(concerts: Concert[]) {
  // ...
}

// Import
import { ArtistCard } from './ArtistCard'
import { useArtistData } from './useArtistData'
```

**Default exports (sparingly):**

```typescript
// Use for main component in file with same name
// App.tsx
function App() {
  // ...
}

export default App

// Import
import App from './App'
```

**Barrel exports (index.ts):**

```typescript
// components/scenes/ArtistScene/index.ts
export { ArtistScene } from './ArtistScene'
export { ArtistCard } from './ArtistCard'
export { ArtistMosaic } from './ArtistMosaic'
export type { ArtistCard as ArtistCardType, SortOrder } from './types'

// Usage
import { ArtistScene, ArtistMosaic } from '@/components/scenes/ArtistScene'
```

---

## Code Organization Best Practices

### ✅ DO

**1. Co-locate related files**
```
ArtistScene/
├── ArtistScene.tsx
├── ArtistCard.tsx
├── ArtistMosaic.tsx
├── useArtistData.ts
└── types.ts
```

**2. Extract complex hooks**
```typescript
// ✅ GOOD: Complex logic in hook
function ArtistScene() {
  const { artists, loading } = useArtistData(concerts)
  return <div>{/* Simple render */}</div>
}

// ❌ BAD: Complex logic inline
function ArtistScene() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    // 50 lines of data transformation...
  }, [concerts])
}
```

**3. Use descriptive names**
```typescript
// ✅ GOOD
const sortedArtistsByPopularity = artists.sort(...)
const handleArtistCardClick = () => { }

// ❌ BAD
const arr = artists.sort(...)
const onClick = () => { }
```

**4. Group related functionality**
```typescript
// ✅ GOOD: Related state grouped
const [openArtist, setOpenArtist] = useState<ArtistCard | null>(null)
const [clickedTileRect, setClickedTileRect] = useState<DOMRect | null>(null)

function handleCardClick(artist: ArtistCard, rect: DOMRect) {
  setOpenArtist(artist)
  setClickedTileRect(rect)
}

// ❌ BAD: State scattered throughout component
const [openArtist, setOpenArtist] = useState(null)
// ... 50 lines later
const [clickedTileRect, setClickedTileRect] = useState(null)
```

### ❌ DON'T

**1. Create deeply nested directories**
```
// ❌ BAD
components/scenes/ArtistScene/components/Card/components/Header/index.tsx

// ✅ GOOD
components/scenes/ArtistScene/ArtistCard.tsx
components/scenes/ArtistScene/ArtistCardHeader.tsx
```

**2. Mix concerns in single file**
```typescript
// ❌ BAD: Component + hook + types + utils in one file
export function ArtistScene() { }
export function useArtistData() { }
export interface ArtistCard { }
export function normalizeArtistName() { }

// ✅ GOOD: Separate files
// ArtistScene.tsx - Component
// useArtistData.ts - Hook
// types.ts - Types
// utils/normalize.ts - Utility
```

**3. Create utility dump files**
```typescript
// ❌ BAD: utils.ts with unrelated functions
export function formatDate() { }
export function normalizeArtistName() { }
export function calculateVenueDistance() { }
export function generateId() { }

// ✅ GOOD: Specific utility files
// utils/formatting.ts
// utils/normalize.ts
// utils/geo.ts
// utils/id.ts
```

---

## Documentation Organization

```
docs/
├── DATA_PIPELINE.md         # Data build process
├── DEEP_LINKING.md          # URL navigation patterns
└── specs/                   # Feature specifications
    ├── implemented/         # Completed features
    │   ├── artist-scene.md
    │   ├── venue-cross-navigation.md
    │   └── whats-playing-changelog.md
    └── proposed/            # Planned features
        └── global-filters.md
```

**Spec naming:**
- kebab-case
- Descriptive feature name
- Move from `proposed/` to `implemented/` when complete

---

## Configuration Files

**Root level (project configuration):**
```
package.json           # Dependencies, scripts
tsconfig.json          # TypeScript configuration
vite.config.ts         # Build tool configuration
tailwind.config.js     # Styling configuration
.gitignore             # Git exclusions
.env.example           # Environment variable template
CLAUDE.md              # Project overview for Claude
README.md              # Project readme (future)
```

---

## Related Documentation

- [State Management Skill](./../state-management/SKILL.md) - State patterns
- [Performance Optimization Skill](./../performance-optimization/SKILL.md) - Performance patterns
- [Testing Strategy Skill](./../testing-strategy/SKILL.md) - Testing patterns

---

## Quick Reference

### Creating a New Scene

```bash
# 1. Create scene directory
mkdir src/components/scenes/NewScene

# 2. Create main component
touch src/components/scenes/NewScene/NewScene.tsx

# 3. Create hook if needed
touch src/components/scenes/NewScene/useNewSceneData.ts

# 4. Create types if needed
touch src/components/scenes/NewScene/types.ts

# 5. Create index.ts for exports
touch src/components/scenes/NewScene/index.ts
```

### Creating a New Hook

```bash
# 1. Create hook file
touch src/hooks/useNewFeature.ts

# 2. Export hook function
export function useNewFeature() {
  // Implementation
}
```

### Creating a New Service

```bash
# 1. Create service file
touch src/services/newapi.ts

# 2. Define types, constants, functions
interface Response { }
const BASE_URL = '...'
export async function fetchData() { }
```

### Creating a New Validation Script

```bash
# 1. Create script file
touch scripts/validate-new-thing.ts

# 2. Add to package.json
"validate:new-thing": "tsx scripts/validate-new-thing.ts"

# 3. Run
npm run validate:new-thing
```
