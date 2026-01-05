# "What's Playing" Changelog Feature - Complete Specification

**Version:** 1.0
**Status:** Planned (for v1.4.1+)
**Created:** 2026-01-03
**Last Updated:** 2026-01-04
**Mobile Note:** 📱 Toast notifications need mobile-specific positioning and sizing (see [mobile-optimization.md](mobile-optimization.md))

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature Overview](#feature-overview)
3. [Deep Linking & Query Parameters](#deep-linking--query-parameters)
4. [User Experience](#user-experience)
5. [Technical Architecture](#technical-architecture)
6. [File Structure](#file-structure)
7. [Component Specifications](#component-specifications)
8. [Data Schema](#data-schema)
9. [localStorage Integration](#localstorage-integration)
10. [Routing Strategy](#routing-strategy)
11. [Animation Specifications](#animation-specifications)
12. [Typography & Design](#typography--design)
13. [Accessibility Requirements](#accessibility-requirements)
14. [Implementation Phases](#implementation-phases)
15. [Edge Cases & Error Handling](#edge-cases--error-handling)
16. [Testing Strategy](#testing-strategy)
17. [Maintenance Process](#maintenance-process)

---

## Initial Prompt for Implementation

**Copy-paste this prompt into a fresh Claude Code session to begin implementation:**

```
I need to implement the "What's Playing" changelog feature for the Morperhaus Concert Archives app. This is a concert-themed feature discovery system with toast notifications and deep linking.

## Project Context

This is a Jamstack SPA (Vite + React 18 + TypeScript + Tailwind 4) showcasing 175+ concerts through 5 full-viewport scrolling scenes. The app uses D3.js visualizations, Leaflet maps, and Framer Motion animations. It's live at concerts.morperhaus.org.

**Current Version:** v1.4.0
**Target Version:** v1.4.1 (this feature)
**Current Bundle:** 574KB gzipped

## Feature Requirements

Implement a changelog system that:

1. **Standalone `/changelog` route** - "What's Playing" themed page with gatefold-style feature cards
2. **Toast notification** - Bottom-center popup for returning visitors when new features are available
3. **Deep linking** - Query param routing (`/?scene=timeline`) to navigate directly to features
4. **localStorage tracking** - Persistent "last seen" timestamp and session-based dismissals

## Complete Specification

The full specification is located at:
**@docs/specs/future/whats-playing-changelog-spec.md** (57KB, 1,200+ lines)

This spec includes:
- Complete technical architecture and component specifications
- All TypeScript interfaces and constants
- Copy-paste ready code examples
- Animation specifications with Framer Motion
- Accessibility requirements (WCAG AA)
- Edge case handling and error recovery
- Complete testing checklist

## Implementation Approach

**IMPORTANT: Follow these guidelines:**

1. **Follow the spec as written** - The spec has been carefully designed for this codebase
2. **Ask questions if needed** - If something is unclear or conflicts with existing code
3. **Context window management** - This is a 4-phase implementation:
   - Phase 1: Foundation & Routing (4-5 hours)
   - Phase 2: Changelog Page (3-4 hours)
   - Phase 3: Toast Notification (3-4 hours)
   - Phase 4: Polish & Testing (2-3 hours)

4. **At the end of EACH phase:**
   - Evaluate remaining context window
   - Test what's been built so far
   - If context window is low (<30% remaining), STOP and prompt:
     "Phase N complete. Context window at X%. Ready to continue with Phase N+1?"
   - Wait for user confirmation before proceeding

5. **Use TodoWrite tool** - Track progress through each phase's tasks

## Phase 1: Foundation & Routing (Start Here)

**Goal:** Set up routing infrastructure, create types and constants, implement storage utilities

**Deliverables:**
- Install `react-router-dom` dependency
- Create directory structure (`src/data/`, `src/components/changelog/`, etc.)
- Create TypeScript type definitions (`types.ts`)
- Create constants file (`constants.ts`) with colors, layout, animations
- Create localStorage/sessionStorage utilities (`changelogStorage.ts`)
- Create initial `changelog.json` with v1.4.0 Timeline Hover Preview entry
- Update `main.tsx` and `App.tsx` with React Router structure
- Test basic routing between `/` and `/changelog`

**Key Files to Reference:**
- Spec Section 6: File Structure
- Spec Section 10: Routing Strategy
- Spec Section 9: localStorage Integration
- Spec Section 8: Data Schema

**Success Criteria:**
- `/changelog` route is accessible (shows empty page)
- Type definitions compile without errors
- Storage utilities can read/write localStorage
- No build errors

**Estimated Time:** 4-5 hours
**Estimated LOC:** ~300 lines

---

**After completing Phase 1, evaluate context window and confirm before proceeding to Phase 2.**

---

## Questions Before Starting?

If anything is unclear about:
- The project structure
- Existing patterns to follow (e.g., TimelineHoverPreview component structure)
- Design decisions in the spec
- Context window management approach

Please ask before beginning implementation.

## Ready?

Please confirm you understand:
1. The 4-phase implementation approach
2. Context window checkpoints after each phase
3. The requirement to follow the spec as written
4. Where to find the complete specification

Once confirmed, begin with Phase 1: Foundation & Routing.
```

---

## Executive Summary

The "What's Playing" changelog feature provides a concert-themed interface for discovering new features added to the Morperhaus Concert Archives. The feature includes:

- **Standalone `/changelog` route** with gatefold-style feature cards
- **Toast notification** for returning visitors when new features are available
- **Deep linking** from changelog entries to specific scenes via query parameters
- **localStorage-based tracking** of last seen features and session dismissals

**Design Philosophy:** Treat the changelog like discovering songs on a setlist—each feature is something worth experiencing, presented with the same aesthetic care as the rest of the app.

---

## Feature Overview

### Primary Components

1. **Changelog Page** (`/changelog`)
   - Full-page view with "What's Playing" branding
   - Concert poster aesthetic (black background, gold accents)
   - Gatefold-style cards for each feature
   - Deep link buttons to navigate to features

2. **Toast Notification**
   - Bottom-center positioned popup
   - Shows "X new features added!" with CTA
   - Appears after 2-second delay on homepage
   - Auto-dismisses after 10 seconds

3. **Deep Linking System**
   - Query parameter routing: `/?scene=timeline`
   - Programmatic scroll to specific scenes
   - URL sharing for direct feature access

### User Flows

**First-Time Visitor:**
1. Visits site for first time
2. No toast shown (no baseline to compare)
3. `lastSeenChangelog` timestamp set to current date
4. On next visit with new features, toast will appear

**Returning Visitor with New Features:**
1. Visits homepage after new release
2. After 2-second delay, toast slides up from bottom
3. Toast shows: "2 new features added!"
4. User clicks "See What's Playing →"
5. Navigates to `/changelog` page
6. Browses new features in gatefold cards
7. Clicks "Check it out →" on Timeline Hover Preview card
8. Navigates to `/?scene=timeline`
9. Timeline scene loads and scrolls into view

**Returning Visitor (No New Features):**
1. Visits homepage
2. No toast appears (already seen latest features)
3. Can manually navigate to `/changelog` if desired

---

## Deep Linking & Query Parameters

### Query Parameter Specification

**Base URL Structure:**
```
https://concerts.morperhaus.org/?scene={scene_name}
```

**Scene Parameter Mapping:**

| Scene Parameter | Scene Number | Scene Name | Component |
|----------------|--------------|------------|-----------|
| `timeline` | 1 | Timeline | `Scene1Hero.tsx` |
| `venues` | 2 | Venue Network | `Scene4Bands.tsx` |
| `geography` | 3 | Geography / Map | `Scene3Map.tsx` |
| `genres` | 4 | Genres / Sunburst | `Scene5Genres.tsx` |
| `artists` | 5 | Artists / Gatefold | `ArtistScene/` |

**Examples:**

```
# Navigate to Timeline scene
https://concerts.morperhaus.org/?scene=timeline

# Navigate to Geography/Map scene
https://concerts.morperhaus.org/?scene=geography

# Navigate to Artists scene
https://concerts.morperhaus.org/?scene=artists

# Invalid scene (fallback to homepage)
https://concerts.morperhaus.org/?scene=invalid
```

### Deep Link Behavior

**On Page Load with Query Parameter:**

1. Parse `?scene={name}` from URL
2. Map scene name to scene number (1-5)
3. Wait 100ms for DOM to be ready
4. Programmatically scroll to target scene
5. Use smooth scroll behavior
6. Clear query parameter from URL (optional)

**Implementation:**

```typescript
// Scene mapping constant
const SCENE_MAP: Record<string, number> = {
  'timeline': 1,
  'venues': 2,
  'geography': 3,
  'genres': 4,
  'artists': 5,
}

// Reverse mapping for generating links
const SCENE_NAMES = ['timeline', 'venues', 'geography', 'genres', 'artists']

// Get scene number from name
function getSceneNumber(sceneName: string): number | null {
  return SCENE_MAP[sceneName] || null
}

// Get scene name from number
function getSceneName(sceneNumber: number): string | null {
  return SCENE_NAMES[sceneNumber - 1] || null
}

// Generate deep link URL
function generateDeepLink(sceneNumber: number): string {
  const sceneName = getSceneName(sceneNumber)
  return sceneName ? `/?scene=${sceneName}` : '/'
}
```

**Scroll Implementation:**

```typescript
function scrollToScene(sceneId: number) {
  const scrollContainer = scrollContainerRef.current
  if (!scrollContainer) return

  const windowHeight = window.innerHeight
  scrollContainer.scrollTo({
    top: (sceneId - 1) * windowHeight,
    behavior: 'smooth',
  })
}

// On component mount
useEffect(() => {
  const params = new URLSearchParams(location.search)
  const sceneParam = params.get('scene')

  if (sceneParam && SCENE_MAP[sceneParam]) {
    const sceneId = SCENE_MAP[sceneParam]

    setTimeout(() => {
      scrollToScene(sceneId)
    }, 100) // Allow DOM to be ready
  }
}, [location.search])
```

### Deep Link Use Cases

**From Changelog Card:**
```tsx
<button onClick={() => navigate(release.route)}>
  Check it out →
</button>
// release.route = "/?scene=timeline"
```

**From Toast Notification:**
```tsx
// Clicking toast or CTA navigates to /changelog
// Then user clicks card to navigate to scene
```

**External Sharing:**
```
# Share on social media
"Check out the new timeline hover preview!
https://concerts.morperhaus.org/?scene=timeline"

# Email link
"See venue photos on the map:
https://concerts.morperhaus.org/?scene=geography"
```

### Entity-Level Deep Linking (v1.7.6+)

**Extended URL Structure:**
```
https://concerts.morperhaus.org/?scene={scene_name}&{entity_type}={normalized_name}
```

**Supported Entity Parameters:**

| Entity Type | Scenes | Description | Example |
| ----------- | ------ | ----------- | ------- |
| `artist` | Scene 5 (Artists) | Auto-scrolls to artist and opens gatefold | `?scene=artists&artist=depeche-mode` |
| `venue` | Scene 2 (Venues) | Auto-expands venue in force graph with spotlight | `?scene=venues&venue=9-30-club` |
| `venue` | Scene 3 (Geography) | Flies to venue on map and opens popup | `?scene=geography&venue=9-30-club` |

**Real Examples:**

```
# Artist gatefold with photo and concert history
https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode
https://concerts.morperhaus.org/?scene=artists&artist=social-distortion

# Venue in force-directed graph (Scene 2)
https://concerts.morperhaus.org/?scene=venues&venue=9-30-club

# Venue on map with popup (Scene 3)
https://concerts.morperhaus.org/?scene=geography&venue=9-30-club
https://concerts.morperhaus.org/?scene=geography&venue=hollywood-palladium
```

**Normalized Name Format:**

- Lowercase with hyphens
- Strip non-alphanumeric characters except hyphens
- Examples: `depeche-mode`, `9-30-club`, `hollywood-palladium`

**Implementation Details:**

```typescript
// App.tsx deep link handler
useEffect(() => {
  const params = new URLSearchParams(location.search)
  const sceneParam = params.get('scene')
  const artistParam = params.get('artist')
  const venueParam = params.get('venue')

  if (sceneParam && SCENE_MAP[sceneParam]) {
    const sceneId = SCENE_MAP[sceneParam]

    // Artist deep linking (Scene 5)
    if (artistParam && sceneId === 5) {
      setPendingArtistFocus(artistParam)
    }

    // Venue deep linking (Scene 2)
    if (venueParam && sceneId === 2) {
      setPendingVenueFocus(venueParam)
    }

    // Venue deep linking (Scene 3)
    if (venueParam && sceneId === 3) {
      setPendingMapVenueFocus(venueParam)
    }

    // Scroll to scene
    setTimeout(() => {
      scrollToScene(sceneId)
    }, 100)
  }
}, [location.search, loading])
```

**Scene-Level Handling:**

Each scene receives a `pendingEntityFocus` prop and handles the deep link:

- **ArtistScene**: Finds card element, scrolls into view, opens gatefold
- **Scene4Bands** (Venues): Expands venue node, centers graph, applies spotlight
- **Scene3Map** (Geography): Flies to marker location, opens popup

**Changelog Integration:**

All changelog routes now use entity-level deep links to showcase features:

```json
{
  "version": "1.7.6",
  "title": "Changelog Toast UX & Gatefold Refinements",
  "route": "/?scene=artists&artist=depeche-mode"
}
```

**Future Enhancements:**

```typescript
// Timeline year focus (future)
/?scene=timeline&year=2024

// Region filtering on map (future)
/?scene=geography&region=california

// Genre selection (future)
/?scene=genres&genre=alternative-rock
```

---

## User Experience

### Toast Notification UX

**Visual Design:**

```
┌─────────────────────────────────────────────────────┐
│  🎵  2 new features added!                       × │
│                                                      │
│  Check out what's new in the concert archive        │
│                                                      │
│               [See What's Playing →]                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (progress)  │
└─────────────────────────────────────────────────────┘
```

**Timing:**
- **Initial Delay:** 2 seconds after page load
- **Auto-Dismiss:** 10 seconds (with progress bar)
- **Animation Duration:** 500ms slide-up entrance

**Dismissal Methods:**
1. Click X button (top-right)
2. Click anywhere on toast
3. Click "See What's Playing →" CTA (also navigates)
4. Wait 10 seconds (auto-dismiss)
5. Press ESC key (keyboard accessibility)

**Behavior:**
- Only appears on Scene 1 (Timeline/Homepage)
- Disappears when navigating to other scenes
- Does not reappear after dismissal (session-based)
- Reappears on next session if changelog not viewed

### Changelog Page UX

**Layout Structure:**

```
┌─────────────────────────────────────────────────────┐
│  ← Back to Timeline                                  │
│                                                      │
│  🎵 What's Playing                                   │
│  The setlist of new features                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Timeline Hover Preview                       │   │
│  │                                              │   │
│  │ Hover over any year to see artist photos    │   │
│  │ with subtle parallax effects                 │   │
│  │                                              │   │
│  │ • Artist imagery on hover                   │   │
│  │ • Smart above/below positioning             │   │
│  │ • Smooth parallax mouse tracking            │   │
│  │                                              │   │
│  │              [Check it out →]                │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Venue Photos                                 │   │
│  │ ...                                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Card Interactions:**
- **Hover:** Gold border glow effect
- **Click Title/Description:** Expands card (future enhancement)
- **Click "Check it out →":** Navigates to deep link

**Responsive Behavior:**
- Desktop: 2-column grid (800px+ width)
- Tablet: 1-column (768px-799px)
- Mobile: Single column, full-width cards

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                     App.tsx                          │
│  (React Router, Main Layout)                         │
│                                                      │
│  ├── Route: /                                        │
│  │   └── MainScenes Component                       │
│  │       ├── Scene 1-5 (snap scroll)                │
│  │       └── ChangelogToast                         │
│  │           └── useChangelogCheck()                │
│  │               └── changelogStorage.ts            │
│  │                                                   │
│  └── Route: /changelog                               │
│      └── ChangelogPage                               │
│          └── ChangelogCard (multiple)                │
│              └── changelog.json data                 │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User visits homepage
   ↓
2. App loads changelog.json
   ↓
3. useChangelogCheck() hook executes
   ├─ Reads lastSeenChangelog from localStorage
   ├─ Compares with latest release date
   ├─ Checks dismissedVersions in sessionStorage
   └─ Returns { shouldShow, newFeatureCount, ... }
   ↓
4. ChangelogToast renders if shouldShow === true
   ↓
5. After 2-second delay, toast slides up
   ↓
6. User interactions:
   ├─ Dismiss: markDismissedInSession()
   ├─ Click CTA: navigate('/changelog') + markAsSeen()
   └─ Auto-dismiss: markDismissedInSession()
   ↓
7. On /changelog page:
   ├─ Render all changelog entries
   └─ Call markAsSeen() (update lastSeenChangelog)
   ↓
8. User clicks "Check it out →"
   ├─ Parse deep link route (/?scene=X)
   └─ Navigate and scroll to scene
```

### Technology Stack

**New Dependencies:**
- `react-router-dom` (v6.x) - Client-side routing

**Existing Technologies:**
- React 18
- TypeScript 5
- Framer Motion 11 (animations)
- Tailwind CSS 4 (styling)

---

## File Structure

### New Directories

```
src/
├── data/
│   └── changelog.json                    # Changelog data (NEW DIRECTORY)
│
├── components/
│   └── changelog/                        # NEW DIRECTORY
│       ├── ChangelogPage.tsx             # Main page component
│       ├── ChangelogToast.tsx            # Toast notification
│       ├── ChangelogCard.tsx             # Feature card
│       ├── constants.ts                  # Constants (colors, layout, timing)
│       ├── types.ts                      # TypeScript types
│       └── index.ts                      # Public exports
│
├── hooks/
│   └── useChangelogCheck.ts              # Toast visibility logic hook
│
└── utils/
    └── changelogStorage.ts               # localStorage/sessionStorage utils
```

### File Sizes (Estimated)

| File | Lines of Code | Description |
|------|---------------|-------------|
| `changelog.json` | 30-40 per entry | Data file (grows linearly) |
| `ChangelogPage.tsx` | 150-200 | Main page layout |
| `ChangelogToast.tsx` | 120-150 | Toast component |
| `ChangelogCard.tsx` | 100-130 | Card component |
| `useChangelogCheck.ts` | 100-120 | Hook logic |
| `changelogStorage.ts` | 80-100 | Storage utilities |
| `constants.ts` | 50-60 | Configuration |
| `types.ts` | 40-50 | TypeScript interfaces |

**Total: ~800-950 new lines of code**

---

## Component Specifications

### ChangelogPage Component

**File:** `src/components/changelog/ChangelogPage.tsx`

**Purpose:** Full-page view of all changelog entries

**Props:** None (loads data internally)

**Responsibilities:**
- Load `changelog.json` data
- Render "What's Playing" header
- Map releases to `<ChangelogCard>` components
- Update `lastSeenChangelog` on mount
- Provide "Back to Timeline" navigation

**Layout:**
- Black background (`#000000`)
- Centered content container (max-width: 1200px)
- Padding: 80px horizontal on desktop, 24px on mobile
- Grid layout for cards (responsive)

**Implementation Outline:**

```tsx
export function ChangelogPage() {
  const navigate = useNavigate()
  const [releases, setReleases] = useState<Release[]>([])

  useEffect(() => {
    // Load changelog data
    import('@/data/changelog.json').then(data => {
      setReleases(data.releases)
    })

    // Mark as seen
    setLastSeenChangelog(new Date().toISOString())
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="pt-12 pb-8">
        <button onClick={() => navigate('/')}>
          ← Back to Timeline
        </button>

        <h1 className="text-6xl font-display text-amber-400">
          🎵 What's Playing
        </h1>
        <p className="text-slate-400">
          The setlist of new features
        </p>
      </header>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {releases.map((release, index) => (
          <ChangelogCard
            key={release.version}
            release={release}
            isLatest={index === 0}
          />
        ))}
      </div>
    </div>
  )
}
```

---

### ChangelogToast Component

**File:** `src/components/changelog/ChangelogToast.tsx`

**Purpose:** Bottom toast notification for new features

**Props:**

```typescript
interface ChangelogToastProps {
  isVisible: boolean
  newFeatureCount: number
  latestRelease: Release
  onDismiss: () => void
  onNavigate: () => void
}
```

**Responsibilities:**
- Render toast with feature count
- Animate slide-up entrance/exit
- Handle auto-dismiss timer (10s)
- Handle manual dismiss (X button, ESC key)
- Navigate to `/changelog` on CTA click

**Layout:**
- Position: Fixed, bottom-center
- Width: 450px (responsive on mobile)
- Bottom offset: 80px
- z-index: 9999 (above all other elements)

**Implementation Outline:**

```tsx
export function ChangelogToast({
  isVisible,
  newFeatureCount,
  latestRelease,
  onDismiss,
  onNavigate,
}: ChangelogToastProps) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!isVisible) return

    // Auto-dismiss timer
    const dismissTimer = setTimeout(onDismiss, TOAST.AUTO_DISMISS_DURATION)

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.max(0, prev - 1))
    }, TOAST.AUTO_DISMISS_DURATION / 100)

    return () => {
      clearTimeout(dismissTimer)
      clearInterval(progressInterval)
    }
  }, [isVisible, onDismiss])

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999]"
          style={{ width: TOAST.WIDTH }}
        >
          <div className="bg-black/90 border-2 border-amber-600 rounded-xl p-6">
            {/* Content */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <span className="text-lg font-semibold">
                  {newFeatureCount} new feature{newFeatureCount !== 1 ? 's' : ''} added!
                </span>
              </div>
              <button onClick={onDismiss} className="text-slate-400 hover:text-white">
                ×
              </button>
            </div>

            <p className="text-slate-400 mb-4">
              Check out what's new in the concert archive
            </p>

            <button
              onClick={onNavigate}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg"
            >
              See What's Playing →
            </button>

            {/* Progress bar */}
            <div className="mt-4 h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-500"
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

### ChangelogCard Component

**File:** `src/components/changelog/ChangelogCard.tsx`

**Purpose:** Individual feature card with gatefold aesthetic

**Props:**

```typescript
interface ChangelogCardProps {
  release: Release
  isLatest?: boolean
}
```

**Responsibilities:**
- Render release title, description, highlights
- Provide "Check it out →" deep link button
- Hover effects (gold border glow)
- Entrance animation (staggered)

**Design:**
- Background: `#0a0a0a` (very dark gray, not pure black)
- Border: 1px solid `#334155` (slate-700), gold on hover
- Border radius: 16px
- Padding: 32px
- Box shadow: Subtle elevation

**Implementation Outline:**

```tsx
export function ChangelogCard({ release, isLatest }: ChangelogCardProps) {
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)

  const handleNavigate = () => {
    // Parse deep link route
    window.location.href = release.route
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative bg-zinc-950 rounded-2xl p-8
        border-2 transition-all duration-300
        ${isHovered ? 'border-amber-500 shadow-xl shadow-amber-500/20' : 'border-slate-700'}
      `}
    >
      {/* Latest badge */}
      {isLatest && (
        <div className="absolute top-4 right-4 bg-amber-600 text-white px-3 py-1 rounded-full text-sm">
          Latest
        </div>
      )}

      {/* Title */}
      <h3 className="text-2xl font-semibold text-white mb-3">
        {release.title}
      </h3>

      {/* Date */}
      <p className="text-slate-400 text-sm mb-4">
        {new Date(release.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </p>

      {/* Description */}
      <p className="text-slate-300 text-lg mb-6">
        {release.description}
      </p>

      {/* Highlights */}
      <ul className="space-y-2 mb-6">
        {release.highlights.map((highlight, index) => (
          <li key={index} className="flex items-start gap-2 text-slate-400">
            <span className="text-amber-500">•</span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={handleNavigate}
        className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg transition-colors"
      >
        Check it out →
      </button>
    </motion.div>
  )
}
```

---

### useChangelogCheck Hook

**File:** `src/hooks/useChangelogCheck.ts`

**Purpose:** Determine if toast should be shown and provide control functions

**Parameters:**

```typescript
function useChangelogCheck(currentScene: number): ChangelogCheckResult
```

**Return Type:**

```typescript
interface ChangelogCheckResult {
  shouldShow: boolean
  newFeatureCount: number
  latestRelease: Release | null
  newReleases: Release[]
  dismissToast: () => void
  markAsSeen: () => void
}
```

**Logic Flow:**

1. Load `changelog.json` on mount
2. Check if current scene is Scene 1 (homepage)
3. Read `lastSeenChangelog` from localStorage
4. Compare latest release date with last seen date
5. Count new releases since last seen
6. Check if latest version dismissed in session
7. Return visibility state and control functions

**Implementation Outline:**

```tsx
export function useChangelogCheck(currentScene: number): ChangelogCheckResult {
  const [state, setState] = useState<ChangelogCheckResult>({
    shouldShow: false,
    newFeatureCount: 0,
    latestRelease: null,
    newReleases: [],
    dismissToast: () => {},
    markAsSeen: () => {},
  })

  useEffect(() => {
    async function checkChangelog() {
      // Only check if on Scene 1
      if (currentScene !== 1) {
        setState(prev => ({ ...prev, shouldShow: false }))
        return
      }

      // Load changelog data
      const data = await import('@/data/changelog.json')
      const releases = data.releases

      if (!releases || releases.length === 0) return

      const latestRelease = releases[0]
      const latestDate = new Date(latestRelease.date)

      // Get last seen timestamp
      const lastSeen = getLastSeenChangelog()
      const lastSeenDate = lastSeen ? new Date(lastSeen) : null

      // Check for new features
      const newReleases = lastSeenDate
        ? releases.filter(r => new Date(r.date) > lastSeenDate)
        : []

      const hasNewFeatures = newReleases.length > 0

      // Check if dismissed in session
      const isDismissed = isDismissedInSession(latestRelease.version)

      // Create control functions
      const dismissToast = () => {
        markDismissedInSession(latestRelease.version)
        setState(prev => ({ ...prev, shouldShow: false }))
      }

      const markAsSeen = () => {
        setLastSeenChangelog(new Date().toISOString())
        setState(prev => ({ ...prev, shouldShow: false }))
      }

      setState({
        shouldShow: hasNewFeatures && !isDismissed,
        newFeatureCount: newReleases.length,
        latestRelease,
        newReleases,
        dismissToast,
        markAsSeen,
      })
    }

    checkChangelog()
  }, [currentScene])

  return state
}
```

---

## Data Schema

### changelog.json Structure

**File:** `src/data/changelog.json`

**Schema:**

```typescript
interface ChangelogData {
  releases: Release[]
}

interface Release {
  version: string      // Semantic version (e.g., "1.4.0")
  date: string         // ISO date (YYYY-MM-DD)
  title: string        // Feature name (2-5 words, title case)
  description: string  // One-liner (60-120 chars)
  route: string        // Deep link route (e.g., "/?scene=timeline")
  highlights: string[] // 2-4 bullets (3-8 words each)
}
```

**Example Data:**

```json
{
  "releases": [
    {
      "version": "1.4.0",
      "date": "2026-01-03",
      "title": "Timeline Hover Preview",
      "description": "Hover over any year to see artist photos with subtle parallax effects",
      "route": "/?scene=timeline",
      "highlights": [
        "Artist imagery on hover",
        "Smart above/below positioning",
        "Smooth parallax mouse tracking"
      ]
    },
    {
      "version": "1.3.4",
      "date": "2026-01-01",
      "title": "Venue Photos",
      "description": "Explore every venue with stunning photography from Google Places",
      "route": "/?scene=geography",
      "highlights": [
        "High-res venue photography",
        "Interactive map popups",
        "Historical venue context"
      ]
    },
    {
      "version": "1.3.3",
      "date": "2025-12-28",
      "title": "Regional Map Filtering",
      "description": "Filter the map by region to zero in on concerts near you",
      "route": "/?scene=geography",
      "highlights": [
        "Southern California filter",
        "Pacific Northwest filter",
        "One-click region selection"
      ]
    }
  ]
}
```

**Data Validation Rules:**

1. **version** - Must match semantic versioning pattern (X.Y.Z)
2. **date** - Must be valid ISO 8601 date (YYYY-MM-DD)
3. **title** - 2-5 words, title case, no emoji
4. **description** - 1-2 sentences, 60-120 characters
5. **route** - Must start with `/?scene=` or be `/`
6. **highlights** - Array of 2-4 strings, each 3-8 words

**Ordering:**

- Releases must be ordered **newest first** (descending by date)
- Latest release at index 0
- This ensures `releases[0]` is always the latest

---

## localStorage Integration

### Storage Keys

```typescript
const STORAGE_KEYS = {
  LAST_SEEN: 'morperhaus_changelog_lastSeen',
  DISMISSED_SESSION: 'morperhaus_changelog_dismissedSession',
}
```

### Data Structures

**localStorage (Persistent):**

```typescript
// Key: morperhaus_changelog_lastSeen
// Value: ISO 8601 timestamp string
"2026-01-03T14:30:00.000Z"
```

**sessionStorage (Session-only):**

```typescript
// Key: morperhaus_changelog_dismissedSession
// Value: JSON stringified array of version strings
["1.4.0", "1.3.4"]
```

### Utility Functions

**File:** `src/utils/changelogStorage.ts`

```typescript
/**
 * Get last seen changelog timestamp
 * Returns null if never seen or storage unavailable
 */
export function getLastSeenChangelog(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SEEN)
  } catch (e) {
    console.warn('localStorage unavailable:', e)
    return null
  }
}

/**
 * Set last seen changelog timestamp
 * Uses current timestamp if none provided
 */
export function setLastSeenChangelog(timestamp?: string): void {
  try {
    const ts = timestamp || new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.LAST_SEEN, ts)
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

/**
 * Check if version is dismissed in current session
 */
export function isDismissedInSession(version: string): boolean {
  try {
    const dismissed = sessionStorage.getItem(STORAGE_KEYS.DISMISSED_SESSION)
    if (!dismissed) return false

    const versions: string[] = JSON.parse(dismissed)
    return versions.includes(version)
  } catch (e) {
    console.warn('sessionStorage read failed:', e)
    return false
  }
}

/**
 * Mark version as dismissed in current session
 */
export function markDismissedInSession(version: string): void {
  try {
    const dismissed = sessionStorage.getItem(STORAGE_KEYS.DISMISSED_SESSION)
    const versions: string[] = dismissed ? JSON.parse(dismissed) : []

    if (!versions.includes(version)) {
      versions.push(version)
      sessionStorage.setItem(STORAGE_KEYS.DISMISSED_SESSION, JSON.stringify(versions))
    }
  } catch (e) {
    console.warn('sessionStorage write failed:', e)
  }
}

/**
 * Clear all dismissed versions (for testing)
 */
export function clearDismissedVersions(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.DISMISSED_SESSION)
  } catch (e) {
    console.warn('sessionStorage clear failed:', e)
  }
}
```

### Error Handling

**Private Browsing Mode:**

When localStorage is unavailable (Safari private browsing, etc.):

- Read operations return `null` (treat as new user)
- Write operations fail silently with console warning
- App continues to function (toast may show more frequently)

**Storage Quota Exceeded:**

Unlikely given small data size, but handled:

```typescript
try {
  localStorage.setItem(key, value)
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    console.error('localStorage quota exceeded')
    // Clear old changelog data if needed
  }
}
```

---

## Routing Strategy

### Adding React Router

**Installation:**

```bash
npm install react-router-dom
```

**Package Version:** `^6.20.0` (or latest 6.x)

### Route Structure

**Routes:**

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `<MainScenes>` | Main 5-scene snap scroll app |
| `/changelog` | `<ChangelogPage>` | Standalone changelog page |

### Implementation

**File:** `src/main.tsx`

```tsx
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

**File:** `src/App.tsx` (Restructured)

```tsx
import { Routes, Route, useLocation } from 'react-router-dom'
import { ChangelogPage } from './components/changelog'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainScenes />} />
      <Route path="/changelog" element={<ChangelogPage />} />
    </Routes>
  )
}

function MainScenes() {
  const location = useLocation()
  const [currentScene, setCurrentScene] = useState(1)

  // Existing 5-scene logic
  // Plus query param handling for deep linking

  return (
    <>
      {/* Existing scene structure */}
      <SceneNavigation currentScene={currentScene} onNavigate={scrollToScene} />

      {/* Changelog Toast */}
      <ChangelogToastContainer currentScene={currentScene} />
    </>
  )
}
```

### Query Parameter Handling

**Deep Link Detection:**

```tsx
function MainScenes() {
  const location = useLocation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Parse scene query param
    const params = new URLSearchParams(location.search)
    const sceneParam = params.get('scene')

    if (sceneParam && SCENE_MAP[sceneParam]) {
      const sceneId = SCENE_MAP[sceneParam]

      // Delay to ensure DOM is ready
      setTimeout(() => {
        scrollToScene(sceneId)
      }, 100)
    }
  }, [location.search])

  // ... rest of component
}
```

**Scroll to Scene Function:**

```tsx
const scrollToScene = (sceneId: number) => {
  const scrollContainer = scrollContainerRef.current
  if (!scrollContainer) return

  const windowHeight = window.innerHeight
  scrollContainer.scrollTo({
    top: (sceneId - 1) * windowHeight,
    behavior: 'smooth',
  })

  // Update current scene state
  setCurrentScene(sceneId)
}
```

---

## Animation Specifications

### Toast Animations

**Entrance (Slide Up):**

```tsx
<motion.div
  initial={{ y: 100, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: 100, opacity: 0 }}
  transition={{
    type: 'spring',
    stiffness: 100,
    damping: 20,
    duration: 0.5
  }}
>
```

- **Type:** Spring physics
- **Stiffness:** 100 (moderate bounce)
- **Damping:** 20 (smooth settle)
- **Duration:** 500ms

**Progress Bar:**

```tsx
<motion.div
  className="h-full bg-amber-500"
  initial={{ width: '100%' }}
  animate={{ width: '0%' }}
  transition={{ duration: 10, ease: 'linear' }}
/>
```

- **Duration:** 10 seconds (matches auto-dismiss)
- **Easing:** Linear (constant countdown)

### Card Animations

**Entrance (Fade + Slide):**

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: 'easeOut' }}
>
```

- **Duration:** 500ms
- **Easing:** easeOut (decelerates at end)
- **Transform:** 20px upward slide

**Staggered Children:**

```tsx
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1 // 100ms delay between cards
      }
    }
  }}
  initial="hidden"
  animate="show"
>
  {releases.map(release => (
    <motion.div variants={cardVariants}>
      <ChangelogCard release={release} />
    </motion.div>
  ))}
</motion.div>
```

**Hover Effect:**

```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  transition={{ duration: 0.2 }}
  className="border-2 border-slate-700 hover:border-amber-500"
>
```

- **Scale:** 1.02 (subtle lift)
- **Duration:** 200ms
- **Border:** Color transition via Tailwind

### Performance Optimization

**GPU Acceleration:**
- Use `transform` and `opacity` only (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left` (CPU-bound)

**Lazy Loading:**

```tsx
const ChangelogPage = lazy(() => import('./components/changelog/ChangelogPage'))

<Route
  path="/changelog"
  element={
    <Suspense fallback={<div>Loading...</div>}>
      <ChangelogPage />
    </Suspense>
  }
/>
```

---

## Typography & Design

### Font Families

**Display Font (Titles):**
- Font: Playfair Display (already loaded)
- Usage: "What's Playing" header, feature titles
- Weights: 400 (regular), 500 (medium)

**Body Font (Content):**
- Font: Source Sans 3 (already loaded)
- Usage: Descriptions, highlights, buttons
- Weights: 400 (regular), 500 (medium), 600 (semi-bold)

### Color Palette

**Concert Poster Theme:**

| Element | Color | Hex | Tailwind |
|---------|-------|-----|----------|
| Background | Pure Black | `#000000` | `bg-black` |
| Card Background | Very Dark Gray | `#0a0a0a` | `bg-zinc-950` |
| Primary Text | White | `#ffffff` | `text-white` |
| Secondary Text | Slate 400 | `#94a3b8` | `text-slate-400` |
| Accent (Gold) | Amber 600 | `#d97706` | `text-amber-600` |
| Accent Hover | Amber 500 | `#f59e0b` | `hover:bg-amber-500` |
| Border Default | Slate 700 | `#334155` | `border-slate-700` |
| Border Hover | Amber 500 | `#f59e0b` | `border-amber-500` |

**Toast Colors:**

| Element | Color | Hex |
|---------|-------|-----|
| Background | Black 90% | `rgba(0,0,0,0.90)` |
| Border | Amber 600 | `#d97706` |
| Button | Amber 600 | `#d97706` |
| Button Hover | Amber 500 | `#f59e0b` |
| Progress Bar | Amber 500 | `#f59e0b` |

### Typography Scale

**Changelog Page:**

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| "What's Playing" | 60px | 500 | 1.1 |
| Subtitle | 18px | 400 | 1.5 |
| Card Title | 24px | 600 | 1.3 |
| Card Description | 18px | 400 | 1.6 |
| Highlights | 16px | 400 | 1.5 |
| Button Text | 16px | 500 | 1 |

**Toast:**

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Main Text | 18px | 600 | 1.4 |
| Description | 15px | 400 | 1.5 |
| Button | 16px | 500 | 1 |

---

## Accessibility Requirements

### Keyboard Navigation

**Toast Interactions:**
- **Tab:** Focus on CTA button, then dismiss button
- **Enter/Space:** Activate focused button
- **Escape:** Dismiss toast

**Changelog Page:**
- **Tab:** Navigate through cards and deep link buttons
- **Enter/Space:** Activate deep link
- **Arrow Keys:** Scroll page (native browser behavior)

### Screen Reader Support

**ARIA Attributes:**

```tsx
// Toast notification
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {newFeatureCount} new features added!
</div>

// Dismiss button
<button
  aria-label="Dismiss notification"
  onClick={onDismiss}
>
  ×
</button>

// CTA button
<button
  aria-label="View new features in changelog"
  onClick={onNavigate}
>
  See What's Playing →
</button>
```

**Semantic HTML:**

```html
<main>
  <header>
    <h1>What's Playing</h1>
  </header>

  <section aria-label="Changelog entries">
    <article>
      <h2>Timeline Hover Preview</h2>
      <!-- ... -->
    </article>
  </section>
</main>
```

### Color Contrast

**WCAG AA Compliance:**

| Text | Background | Ratio | Pass |
|------|------------|-------|------|
| White (#fff) | Black (#000) | 21:1 | ✅ AAA |
| Amber 600 (#d97706) | Black (#000) | 8.2:1 | ✅ AAA |
| Slate 400 (#94a3b8) | Black (#000) | 9.8:1 | ✅ AAA |
| White (#fff) | Amber 600 (#d97706) | 2.6:1 | ⚠️ AA Large Text Only |

**Adjustments:**
- Ensure all body text uses white or slate-400 on black
- Use amber only for accents, headings, and buttons
- Button text should be white on amber (sufficient contrast)

### Focus Management

**Route Changes:**

```tsx
// When navigating to changelog page, focus header
useEffect(() => {
  headerRef.current?.focus()
}, [])

// Header element
<h1 ref={headerRef} tabIndex={-1}>
  What's Playing
</h1>
```

**Modal Behavior:**

Though toast is not a modal, it should:
- Not trap focus (user can tab away)
- Dismiss on Escape key
- Return focus to page after dismissal

---

## Implementation Phases

### Phase 1: Foundation & Routing (4-5 hours)

**Goals:**
- Set up routing infrastructure
- Create directory structure and types
- Implement storage utilities

**Tasks:**

1. **Install Dependencies**
   ```bash
   npm install react-router-dom
   ```

2. **Create Directory Structure**
   ```bash
   mkdir -p src/data
   mkdir -p src/components/changelog
   mkdir -p src/hooks
   mkdir -p src/utils
   ```

3. **Create Type Definitions** (`src/components/changelog/types.ts`)
   - Define `Release`, `ChangelogData`, `ChangelogCheckResult` interfaces
   - Export all types

4. **Create Constants** (`src/components/changelog/constants.ts`)
   - Define `TOAST`, `LAYOUT`, `COLORS`, `ANIMATION` constants
   - Define `SCENE_MAP` and `SCENE_NAMES` for deep linking

5. **Create Storage Utilities** (`src/utils/changelogStorage.ts`)
   - Implement localStorage functions
   - Implement sessionStorage functions
   - Add error handling for private browsing

6. **Create Initial Changelog Data** (`src/data/changelog.json`)
   - Add v1.4.0 Timeline Hover Preview entry
   - Validate JSON structure

7. **Update Routing** (`src/main.tsx` and `src/App.tsx`)
   - Wrap app in `<BrowserRouter>`
   - Create `<Routes>` structure
   - Extract scenes into `<MainScenes>` component
   - Test basic navigation

**Deliverables:**
- `/changelog` route accessible (empty page)
- Type definitions complete
- Storage utilities working
- Basic routing structure

---

### Phase 2: Changelog Page (3-4 hours)

**Goals:**
- Build full changelog page
- Create card components
- Implement deep linking

**Tasks:**

1. **Create ChangelogCard Component** (`src/components/changelog/ChangelogCard.tsx`)
   - Build card layout (title, description, highlights, CTA)
   - Add hover effects (border glow)
   - Implement deep link navigation
   - Test with sample data

2. **Create ChangelogPage Component** (`src/components/changelog/ChangelogPage.tsx`)
   - Build page layout (header, back button, grid)
   - Load `changelog.json` data
   - Render cards with data
   - Update `lastSeenChangelog` on mount
   - Test responsive layout

3. **Implement Deep Linking** (Update `src/App.tsx`)
   - Add query param parsing in `<MainScenes>`
   - Implement `scrollToScene()` function
   - Test all scene navigations
   - Handle invalid scene params

4. **Add Animations**
   - Entrance animations for cards
   - Stagger effect for multiple cards
   - Test animation performance

5. **Style Polish**
   - Concert poster aesthetic
   - Gold accent colors
   - Typography hierarchy
   - Mobile responsiveness

**Deliverables:**
- Fully functional `/changelog` page
- Cards render with real data
- Deep linking works from cards to scenes
- Responsive design complete

---

### Phase 3: Toast Notification (3-4 hours)

**Goals:**
- Build toast component
- Implement visibility logic
- Integrate with main app

**Tasks:**

1. **Create useChangelogCheck Hook** (`src/hooks/useChangelogCheck.ts`)
   - Load changelog data
   - Compare dates with localStorage
   - Check session dismissals
   - Calculate new feature count
   - Return visibility state and control functions

2. **Create ChangelogToast Component** (`src/components/changelog/ChangelogToast.tsx`)
   - Build toast layout
   - Add slide-up animation
   - Implement auto-dismiss timer
   - Add progress bar
   - Handle manual dismiss (X button, ESC key)
   - Handle CTA navigation

3. **Integrate Toast into App** (Update `src/App.tsx`)
   - Use `useChangelogCheck` hook in `<MainScenes>`
   - Render `<ChangelogToast>` conditionally
   - Only show on Scene 1 (homepage)
   - Add 2-second initial delay
   - Test visibility logic

4. **Test localStorage Integration**
   - Verify timestamp updates on changelog view
   - Verify timestamp updates on toast click
   - Test session-based dismissal
   - Test private browsing fallback

**Deliverables:**
- Working toast notification
- Correct visibility logic
- Proper animations and timing
- localStorage integration complete

---

### Phase 4: Polish & Testing (2-3 hours)

**Goals:**
- Handle edge cases
- Improve accessibility
- Mobile optimization
- Final polish

**Tasks:**

1. **Edge Case Testing**
   - Private browsing mode (localStorage unavailable)
   - Empty `changelog.json`
   - Invalid date formats
   - Invalid scene query params
   - First-time visitor behavior
   - Multiple new releases

2. **Accessibility Improvements**
   - Add ARIA labels
   - Test keyboard navigation
   - Verify screen reader announcements
   - Focus management on route changes
   - Color contrast validation

3. **Mobile Optimization**
   - Toast sizing on small screens (<450px)
   - Touch target sizes (≥44px)
   - Changelog page scrolling
   - Card layout on mobile
   - Test on actual devices

4. **Visual Polish**
   - Hover effects refinement
   - Animation easing tweaks
   - Typography hierarchy
   - Spacing consistency

5. **Documentation**
   - Add code comments
   - Update `.claude/context.md`
   - Update README if needed
   - Document maintenance process

**Deliverables:**
- Bulletproof error handling
- Accessibility compliant
- Mobile-optimized
- Production-ready

---

## Edge Cases & Error Handling

### Edge Case Matrix

| Scenario | Behavior | Handling |
|----------|----------|----------|
| **localStorage unavailable** | Toast shows (treat as new user) | Try/catch with console warning |
| **Empty changelog.json** | No toast, empty changelog page | Early return, render empty state |
| **Invalid date in JSON** | Skip that release | Parse with try/catch, filter nulls |
| **Invalid scene param** | Fallback to Scene 1 | Validate against SCENE_MAP |
| **First-time visitor** | No toast (set timestamp) | Check if lastSeen is null |
| **Multiple new releases** | Show count: "3 new features!" | Filter releases by date |
| **Dismiss then reload** | Toast reappears (session ends) | Use sessionStorage, not just state |
| **Navigation during toast** | Toast hides (not on Scene 1) | useEffect watches currentScene |
| **Rapid page loads** | Don't show duplicate toasts | AbortController or debounce |
| **Changelog accessed directly** | Mark as seen | Call setLastSeenChangelog() on mount |

### Error Handling Implementation

**Private Browsing:**

```typescript
function getLastSeenChangelog(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SEEN)
  } catch (e) {
    console.warn('localStorage unavailable (private browsing?):', e)
    return null // Treat as new user
  }
}
```

**Invalid Date:**

```typescript
function parseReleaseDate(dateString: string): Date | null {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      console.error('Invalid date format:', dateString)
      return null
    }
    return date
  } catch (e) {
    console.error('Date parse error:', e)
    return null
  }
}
```

**Empty Changelog:**

```typescript
if (!releases || releases.length === 0) {
  return (
    <div className="text-center py-20">
      <p className="text-slate-400">No updates yet. Check back soon!</p>
    </div>
  )
}
```

**Invalid Scene Param:**

```typescript
const sceneParam = params.get('scene')
if (sceneParam && !SCENE_MAP[sceneParam]) {
  console.warn('Invalid scene parameter:', sceneParam)
  // Fallback: scroll to Scene 1 or do nothing
}
```

---

## Testing Strategy

### Manual Testing Checklist

**Routing:**
- [ ] Navigate to `/changelog` displays page correctly
- [ ] Back button returns to main app
- [ ] Browser refresh on `/changelog` doesn't break
- [ ] History navigation works (back/forward buttons)
- [ ] URL updates correctly on navigation

**Deep Linking:**
- [ ] `/?scene=timeline` scrolls to Scene 1
- [ ] `/?scene=venues` scrolls to Scene 2
- [ ] `/?scene=geography` scrolls to Scene 3
- [ ] `/?scene=genres` scrolls to Scene 4
- [ ] `/?scene=artists` scrolls to Scene 5
- [ ] Invalid scene param doesn't crash app
- [ ] Deep link works from external URL (share link)

**Toast Behavior:**
- [ ] Toast appears on homepage after 2-second delay
- [ ] Toast shows correct feature count ("2 new features added!")
- [ ] Toast auto-dismisses after 10 seconds
- [ ] Progress bar animates correctly
- [ ] Manual dismiss (X button) works immediately
- [ ] ESC key dismisses toast
- [ ] CTA button navigates to `/changelog`
- [ ] Clicking toast body navigates to `/changelog`
- [ ] Toast doesn't reappear after dismissal (same session)
- [ ] Toast reappears on next session if changelog not viewed
- [ ] Toast hides when navigating away from Scene 1

**localStorage:**
- [ ] `lastSeenChangelog` updates when viewing `/changelog`
- [ ] `lastSeenChangelog` updates when clicking toast CTA
- [ ] Timestamp persists across page reloads
- [ ] First-time visitor doesn't see toast
- [ ] Returning visitor sees toast for new features only

**sessionStorage:**
- [ ] Dismissed versions tracked in session
- [ ] Dismissed versions cleared on browser restart
- [ ] Multiple dismissals in one session work

**Changelog Page:**
- [ ] All releases render correctly
- [ ] Cards display title, description, highlights
- [ ] Deep link buttons navigate correctly
- [ ] Hover effects work (border color change)
- [ ] Latest badge shows on first card
- [ ] "Back to Timeline" link works
- [ ] Empty state shows if no releases

**Private Browsing:**
- [ ] App doesn't crash when localStorage unavailable
- [ ] Toast defaults to showing (treats as new user)
- [ ] No console errors related to storage
- [ ] Changelog page still works

**Accessibility:**
- [ ] Keyboard navigation works for toast (Tab, Enter, ESC)
- [ ] Keyboard navigation works for changelog cards
- [ ] Screen reader announces toast content
- [ ] Focus management works on route change
- [ ] Color contrast passes WCAG AA
- [ ] All interactive elements have visible focus states

**Mobile:**
- [ ] Toast sizing appropriate on screens <450px
- [ ] Touch targets ≥44px on all buttons
- [ ] Changelog page scrolls smoothly on mobile
- [ ] Cards stack properly on mobile (single column)
- [ ] Text remains readable on small screens

**Edge Cases:**
- [ ] Empty `changelog.json` doesn't crash
- [ ] Invalid date format doesn't crash
- [ ] Malformed JSON shows error gracefully
- [ ] Network error loading changelog handled
- [ ] Multiple rapid page loads don't duplicate toasts

### Automated Testing (Future)

**Unit Tests (Vitest):**
- Storage utility functions
- Date comparison logic
- Scene mapping functions
- URL parsing utilities

**Component Tests (React Testing Library):**
- ChangelogCard rendering
- ChangelogToast interactions
- useChangelogCheck hook logic

**E2E Tests (Playwright):**
- Full user flow: homepage → toast → changelog → scene
- Deep linking from external URLs
- Mobile viewport behavior

---

## Maintenance Process

### Adding New Changelog Entries

**Before Each Release:**

1. **Create Entry** - Add new release object to `src/data/changelog.json`
2. **Follow Style Guide** - Reference `docs/design/changelog-style-guide.md`
3. **Validate Schema** - Ensure all required fields present
4. **Test Deep Link** - Verify route navigates to correct scene
5. **Update Version** - Match `package.json` version
6. **Test Toast** - Clear localStorage and verify toast appears
7. **Include in Commit** - Add changelog.json to release commit

**Entry Template:**

```json
{
  "version": "X.Y.Z",
  "date": "YYYY-MM-DD",
  "title": "Feature Name Here",
  "description": "One compelling sentence describing the user value",
  "route": "/?scene=timeline",
  "highlights": [
    "First key benefit",
    "Second key benefit",
    "Third key benefit"
  ]
}
```

**Checklist Before Publishing:**

- [ ] Version matches package.json
- [ ] Date is ISO format (YYYY-MM-DD)
- [ ] Title is 2-5 words, title case
- [ ] Description is 60-120 characters
- [ ] Route is valid scene parameter
- [ ] Highlights are 2-4 items, 3-8 words each
- [ ] No technical jargon or version numbers
- [ ] Entry is user-facing (not infrastructure change)
- [ ] Entry added at top of releases array (newest first)

### Version Alignment

**package.json + changelog.json:**

Both files should use same semantic versioning:

```json
// package.json
{
  "version": "1.4.0"
}

// changelog.json
{
  "releases": [
    {
      "version": "1.4.0",
      ...
    }
  ]
}
```

### When NOT to Add Entries

**Skip these changes:**
- Bug fixes (unless creates obvious new capability)
- Performance improvements (unless dramatically visible)
- Code refactoring or reorganization
- Dependency updates
- Build pipeline changes
- Documentation updates
- Data migrations
- Test coverage additions

**Exception:** If a "technical" change creates clear user value, write about the value, not the implementation.

❌ "Migrated to normalized artist data"
✅ "Artists now appear consistently across all scenes"

---

## Future Enhancements

**(Out of scope for initial implementation)**

1. **Changelog RSS Feed**
   - Generate RSS/Atom feed from changelog.json
   - Allow users to subscribe to updates

2. **Animated Scene Nav Badge**
   - Small amber badge on nav dots when features relate to that scene
   - Badge clears when user visits scene

3. **Changelog Search/Filter**
   - Search bar to filter by keyword
   - Filter by scene or date range

4. **"Read More" Expansion**
   - Collapsed view by default
   - Expand for full details
   - Useful when changelog grows beyond 10-15 entries

5. **GitHub Release Integration**
   - Auto-generate changelog entries from GitHub releases
   - Parse release notes and format for app

6. **Analytics Tracking**
   - Track toast impressions, dismissals, clicks
   - See which features users explore most

7. **Multi-param Deep Linking**
   ```
   /?scene=timeline#year-2024
   /?scene=geography&region=southern-california
   /?scene=artists&artist=pearl-jam
   ```

8. **Animated Feature Previews**
   - GIF or video preview of feature in action
   - Shows in changelog card on hover

---

## Dependencies

### New Dependencies

```json
{
  "dependencies": {
    "react-router-dom": "^6.20.0"
  }
}
```

**Bundle Size Impact:**
- `react-router-dom`: ~10KB gzipped
- Changelog components: ~3-4KB gzipped
- `changelog.json`: ~1-2KB per entry

**Total Added:** ~15-20KB gzipped (minimal impact on 572KB bundle)

### No Additional Dependencies

The following are already in the project:
- `framer-motion` (animations)
- `react` (v18)
- `typescript` (v5)

---

## Success Metrics

**Implementation Success:**
- [ ] `/changelog` route accessible and functional
- [ ] Toast appears for returning visitors with new features
- [ ] Deep linking works from all changelog entries
- [ ] localStorage tracking persists across sessions
- [ ] No errors in production builds
- [ ] Accessibility checklist 100% complete
- [ ] Mobile optimization complete

**User Experience Success:**
- Users discover new features through toast notifications
- Changelog page engagement (tracked via Cloudflare Analytics)
- Deep link usage (users navigate to scenes from changelog)
- Low bounce rate on changelog page
- Positive user feedback on feature discoverability

---

## Appendices

### Appendix A: Complete Scene Mapping Reference

```typescript
// Scene ID → Scene Name → Component → Description
const SCENE_REFERENCE = [
  {
    id: 1,
    name: 'timeline',
    component: 'Scene1Hero',
    title: 'Timeline',
    description: 'Chronological concert history with hover previews',
  },
  {
    id: 2,
    name: 'venues',
    component: 'Scene4Bands',
    title: 'Venue Network',
    description: 'Force-directed graph of venues and artists',
  },
  {
    id: 3,
    name: 'geography',
    component: 'Scene3Map',
    title: 'Geography',
    description: 'Interactive map with venue markers and photos',
  },
  {
    id: 4,
    name: 'genres',
    component: 'Scene5Genres',
    title: 'Genres',
    description: 'Sunburst chart of musical genre breakdown',
  },
  {
    id: 5,
    name: 'artists',
    component: 'ArtistScene',
    title: 'Artists',
    description: 'Gatefold-style artist browser',
  },
]
```

### Appendix B: Sample changelog.json (Full Example)

```json
{
  "releases": [
    {
      "version": "1.4.0",
      "date": "2026-01-03",
      "title": "Timeline Hover Preview",
      "description": "Hover over any year to see artist photos with subtle parallax effects",
      "route": "/?scene=timeline",
      "highlights": [
        "Artist imagery on hover",
        "Smart above/below positioning",
        "Smooth parallax mouse tracking"
      ]
    },
    {
      "version": "1.3.4",
      "date": "2026-01-01",
      "title": "Venue Photos",
      "description": "Explore every venue with stunning photography from Google Places",
      "route": "/?scene=geography",
      "highlights": [
        "High-res venue photography",
        "Interactive map popups",
        "Historical venue context"
      ]
    },
    {
      "version": "1.3.3",
      "date": "2025-12-28",
      "title": "Regional Map Filtering",
      "description": "Filter the map by region to zero in on concerts near you",
      "route": "/?scene=geography",
      "highlights": [
        "Southern California filter",
        "Pacific Northwest filter",
        "One-click region selection"
      ]
    },
    {
      "version": "1.2.0",
      "date": "2025-12-15",
      "title": "Genre Scene Refinement",
      "description": "Click into genres to explore every artist and their shows",
      "route": "/?scene=genres",
      "highlights": [
        "Interactive sunburst chart",
        "Drill-down navigation",
        "Artist show listings"
      ]
    },
    {
      "version": "1.1.0",
      "date": "2025-12-01",
      "title": "iPad Optimization",
      "description": "Smooth touch interactions and optimized layouts for iPad",
      "route": "/",
      "highlights": [
        "44px touch targets",
        "Portrait and landscape support",
        "Gesture-friendly navigation"
      ]
    }
  ]
}
```

### Appendix C: localStorage Schema (Complete)

```typescript
// Key: morperhaus_changelog_lastSeen
// Type: string (ISO 8601 timestamp)
// Storage: localStorage (persistent)
// Example:
"2026-01-03T14:30:00.000Z"

// Key: morperhaus_changelog_dismissedSession
// Type: string (JSON array of version strings)
// Storage: sessionStorage (session-only)
// Example:
'["1.4.0", "1.3.4"]'
```

### Appendix D: Constants Reference (Complete)

```typescript
// src/components/changelog/constants.ts

export const TOAST = {
  WIDTH: 450,
  MIN_HEIGHT: 120,
  MAX_HEIGHT: 180,
  BOTTOM_OFFSET: 80,
  Z_INDEX: 9999,

  SLIDE_DURATION: 500, // ms
  AUTO_DISMISS_DURATION: 10000, // 10s
  INITIAL_DELAY: 2000, // 2s

  BG_COLOR: 'rgba(0, 0, 0, 0.90)',
  BORDER_COLOR: '#d97706', // amber-600
  TEXT_PRIMARY: '#ffffff',
  TEXT_ACCENT: '#fbbf24', // amber-400
  BUTTON_BG: '#d97706',
  BUTTON_HOVER: '#f59e0b',
} as const

export const LAYOUT = {
  CARD_PADDING: 32,
  CARD_BORDER_RADIUS: 16,
  CARD_GAP: 32,
  MAX_WIDTH: 1200,
} as const

export const COLORS = {
  BG_PRIMARY: '#000000',
  BG_CARD: '#0a0a0a',
  TEXT_PRIMARY: '#ffffff',
  TEXT_SECONDARY: '#94a3b8',
  BORDER_DEFAULT: '#334155',
  BORDER_HOVER: '#f59e0b',
  ACCENT_PRIMARY: '#d97706',
  ACCENT_SECONDARY: '#fbbf24',
} as const

export const ANIMATION = {
  SLIDE_DURATION: 500,
  FADE_DURATION: 300,
  HOVER_DURATION: 200,
  STAGGER_DELAY: 100,
} as const

export const SCENE_MAP: Record<string, number> = {
  'timeline': 1,
  'venues': 2,
  'geography': 3,
  'genres': 4,
  'artists': 5,
}

export const SCENE_NAMES = [
  'timeline',
  'venues',
  'geography',
  'genres',
  'artists',
]
```

---

**End of Specification**

---

_This specification document serves as the complete technical blueprint for implementing the "What's Playing" changelog feature. All implementation should reference this document as the source of truth._

_Last Updated: 2026-01-03_
_Version: 1.0_
_Status: Ready for Implementation_
