# Analytics Skill

**Purpose:** Ensure Google Analytics 4 event tracking is implemented for all user interactions and new features.

**When to use:**
- Adding new scenes or scene interactions
- Creating new UI components with user actions
- Implementing search, filters, or navigation
- Adding external links
- Building new features that involve user engagement

---

## Quick Reference

### Analytics Service Import

```typescript
import { analytics } from '@/services/analytics'
```

### Basic Event Tracking Pattern

```typescript
// In event handler
const handleClick = () => {
  // Existing functionality...

  // Add tracking call
  analytics.trackEvent('event_name', {
    param_name: value,
    another_param: anotherValue,
  })
}
```

### Event Naming Convention

- **Format:** `snake_case`
- **Pattern:** `{category}_{action}` (e.g., `venue_node_clicked`)
- **Verbs:** Past tense (clicked, viewed, changed, opened)
- **Length:** Under 40 characters

### Event Categories by Scene

| Scene | Prefix | Examples |
|-------|--------|----------|
| Global | `scene_*` | `scene_view`, `scene_nav_clicked` |
| Timeline (1) | `timeline_*` | `timeline_year_selected`, `timeline_card_clicked` |
| Venues (2) | `venue_*` | `venue_node_clicked`, `venue_expanded` |
| Map (3) | `map_*` | `map_region_changed`, `map_marker_clicked` |
| Genres (4) | `genre_*` | `genre_timeline_changed`, `genre_tile_clicked` |
| Artists (5) | `artist_*` | `artist_card_opened`, `artist_search_performed` |
| External | `external_*` | `external_link_clicked` |

---

## When to Add Tracking

### Always Track These Interactions

1. **User clicks** — Buttons, links, cards, tiles, markers, nodes
2. **State changes** — View modes, filters, sorts, tab switches
3. **Navigation** — Scene changes, deep links, cross-scene jumps
4. **Search/input** — Search queries, form submissions
5. **External actions** — Opening Spotify, Ticketmaster, setlist.fm
6. **Content views** — Modals, panels, gatefolds opening

### Don't Track These

- Hover states (too noisy)
- Scroll events within a scene (scene_view is enough)
- Typing in progress (only track final search submission)
- Automatic/passive events (e.g., timer-based animations)

---

## Implementation Patterns

### Pattern 1: Simple Click Event

```typescript
const handleButtonClick = () => {
  haptics.light() // Existing feedback
  setActiveView('newView') // Existing state update

  // Add tracking
  analytics.trackEvent('view_mode_changed', {
    new_mode: 'newView',
  })
}
```

### Pattern 2: Event with Context Parameters

```typescript
const handleArtistClick = (artist: Artist) => {
  // Existing logic...

  analytics.trackEvent('artist_card_opened', {
    artist_name: artist.name,
    device_type: window.innerWidth < 768 ? 'phone' : 'desktop',
    times_seen: artist.timesSeen,
  })
}
```

### Pattern 3: Navigation Event

```typescript
const handleSceneChange = (newScene: number) => {
  scrollToScene(newScene)

  analytics.trackEvent('scene_nav_clicked', {
    from_scene: currentScene,
    to_scene: newScene,
  })
}
```

### Pattern 4: Search/Input Event

```typescript
const handleSearchSubmit = (query: string, results: Artist[]) => {
  // Process search...

  analytics.trackEvent('artist_search_performed', {
    search_term: query,
    results_found: results.length,
    selected_artist: results[0]?.name || 'none',
  })
}
```

### Pattern 5: External Link Click

```typescript
const handleExternalLink = (url: string, linkType: string) => {
  analytics.trackEvent('external_link_clicked', {
    link_type: linkType, // 'spotify', 'ticketmaster', 'setlist'
    artist_name: currentArtist.name,
  })

  window.open(url, '_blank')
}
```

### Pattern 6: D3 Interaction (Force Graph, Map, Treemap)

```typescript
// Inside D3 selection chain
.on('click', (event, d) => {
  haptics.light()

  // Track before state changes
  analytics.trackEvent('venue_node_clicked', {
    venue_name: d.id.split('|')[0],
    node_type: d.type,
    concert_count: d.concerts?.length || 0,
  })

  // Apply focus/zoom...
})
```

---

## Parameter Best Practices

### Good Parameter Names

Use descriptive, consistent names:

```typescript
✅ artist_name, venue_name, scene_name
✅ concert_count, event_count, results_found
✅ device_type, view_mode, sort_order
✅ from_scene, to_scene
```

### Avoid These

```typescript
❌ name (ambiguous - name of what?)
❌ count (count of what?)
❌ type (type of what?)
❌ value (vague)
```

### Parameter Value Types

- **Strings:** Names, IDs, modes (lowercase, no spaces)
- **Numbers:** Counts, indices, years
- **Booleans:** Flags (e.g., `has_artist_filter: true`)

### Common Parameters

Reuse these standardized parameter names:

| Parameter | Type | Usage |
|-----------|------|-------|
| `artist_name` | string | Any artist reference |
| `venue_name` | string | Any venue reference |
| `scene_name` | string | timeline, venues, map, genres, artists |
| `scene_number` | number | 1-5 |
| `concert_count` | number | Number of concerts in filtered set |
| `device_type` | string | 'phone' or 'desktop' |
| `year` | number | Concert year selected |
| `search_term` | string | User's search query |
| `results_found` | number | Number of search results |

---

## New Scene Checklist

When creating a new scene or major feature:

### Step 1: Identify Trackable Interactions

List all user actions:
- [ ] What can users click?
- [ ] What modes/views can they toggle?
- [ ] What filters can they apply?
- [ ] What navigation paths exist?
- [ ] Are there external links?

### Step 2: Name Your Events

Follow naming convention:
- Prefix: `{scene_name}_*` or `{category}_*`
- Action: Past tense verb
- Example: `new_scene_filter_applied`

### Step 3: Define Parameters

For each event, what context is useful?
- Entity names (artist, venue)
- Counts (results, concerts)
- Modes/states (view, filter)
- Device context (phone vs desktop)

### Step 4: Implement Tracking Calls

Add `analytics.trackEvent()` calls in event handlers.

### Step 5: Test Locally

```bash
npm run dev
```

Open console, interact with feature, verify logs:
```
[Analytics] Service initialized { enabled: false, measurementId: 'not set' }
[Analytics] your_event_name { param_name: 'value' }
```

### Step 6: Update GA4 Configuration (Post-Deploy)

After events are live:
1. Create custom dimensions for new parameters (GA4 Admin → Custom definitions)
2. Mark key events if applicable (GA4 Admin → Events)
3. Update explorations/reports to include new events

---

## Existing Events Reference

See complete list in: `docs/specs/future/google-analytics-tracking.md` (lines 1456-1487)

### Global Events

- `scene_view` — User navigates to a scene
- `scene_nav_clicked` — User clicks scene dot navigation
- `deep_link_accessed` — User arrives via URL parameter

### Scene-Specific Events

**Timeline (Scene 1):**
- `timeline_year_selected`
- `timeline_card_clicked`
- `timeline_artist_navigate`

**Venues (Scene 2):**
- `venue_view_mode_changed`
- `venue_node_clicked`
- `venue_expanded`

**Map (Scene 3):**
- `map_region_changed`
- `map_marker_clicked`
- `map_activated`
- `map_explore_venue_clicked`

**Genres (Scene 4):**
- `genre_timeline_changed`
- `genre_view_toggled`
- `genre_tile_clicked`

**Artists (Scene 5):**
- `artist_sort_changed`
- `artist_search_performed`
- `artist_card_opened`
- `artist_tab_viewed`
- `venue_clicked_from_artist`
- `tour_date_viewed`
- `external_link_clicked`

---

## Development vs Production

### Development Mode

- `analytics.enabled` is `false`
- All events logged to console with `[Analytics]` prefix
- No data sent to GA4
- Use this to verify tracking is working

### Production Mode

- `analytics.enabled` is `true` (when `VITE_GA_MEASUREMENT_ID` is set)
- Events sent to GA4 silently
- Console logs disabled
- Errors caught and logged

---

## Common Mistakes to Avoid

### ❌ Don't: Track in useEffect without dependencies

```typescript
// BAD: Fires on every render
useEffect(() => {
  analytics.trackEvent('modal_opened', { artist_name })
})
```

### ✅ Do: Track in event handlers or useEffect with proper deps

```typescript
// GOOD: Fires once when modal opens
useEffect(() => {
  if (isOpen) {
    analytics.trackEvent('modal_opened', { artist_name })
  }
}, [isOpen, artist_name])

// BETTER: Track in the handler that opens the modal
const handleOpenModal = () => {
  setIsOpen(true)
  analytics.trackEvent('modal_opened', { artist_name })
}
```

### ❌ Don't: Use generic event names

```typescript
// BAD: What was clicked?
analytics.trackEvent('button_clicked')
```

### ✅ Do: Use descriptive, namespaced names

```typescript
// GOOD: Clear what happened
analytics.trackEvent('venue_filter_applied', { region: 'northeast' })
```

### ❌ Don't: Send PII or sensitive data

```typescript
// BAD: Never track email, IP, or personal info
analytics.trackEvent('user_login', { email: user.email })
```

### ✅ Do: Track anonymous behavioral data only

```typescript
// GOOD: No personal information
analytics.trackEvent('user_login', { auth_method: 'google' })
```

---

## Testing Checklist

Before marking tracking implementation complete:

- [ ] All trackEvent calls use snake_case event names
- [ ] Event names follow `{category}_{action}` pattern
- [ ] All parameters have descriptive names
- [ ] No PII or sensitive data in parameters
- [ ] Events fire in correct handlers (not in useEffect without deps)
- [ ] Console logs show events in dev mode (`npm run dev`)
- [ ] Events appear in GA4 Realtime after deployment
- [ ] Custom dimensions created in GA4 for new parameters
- [ ] Key events marked in GA4 (if applicable)

---

## Related Documentation

- **Full Implementation Spec:** `docs/specs/future/google-analytics-tracking.md`
- **Analytics Service:** `src/services/analytics.ts`
- **GA4 Setup Guide:** Follow prompts in GA4 Admin after events are live

---

**Last Updated:** 2026-01-09
**Version:** v3.4.0+ (GA tracking implemented)
