# Deep Linking Guide

**Version:** 1.2 (v1.9.0+)
**Last Updated:** 2026-08-03

---

## Overview

The Morperhaus Concert Archives supports deep linking to specific scenes and entities within the application. This enables direct navigation to features, content sharing, and improved discoverability.

## URL Structure

```
https://concerts.morperhaus.org/?scene={scene}&{entity_type}={entity_name}
```

### Parameters

- **`scene`** (required): Target scene name
- **`artist`** (optional): Normalized artist name
- **`venue`** (optional): Normalized venue name
- **`show`** (optional): Concert date, `YYYY-MM-DD` — expands that night's setlist. Requires `scene=artists`; pairs with `artist`. See [Setlist Deep Links](#setlist-deep-links-scene-5)
- **`year`** (optional): Four-digit year — expands that year's card stack. Requires `scene=timeline`

---

## Scene Deep Links

Navigate directly to any of the 5 main scenes:

| Scene | Parameter | URL | Description |
| ----- | --------- | --- | ----------- |
| Timeline | `timeline` | `/?scene=timeline` | Concert timeline visualization |
| Venues | `venues` | `/?scene=venues` | Force-directed venue/artist graph |
| Geography | `geography` | `/?scene=geography` | Interactive map with venue markers |
| Genres | `genres` | `/?scene=genres` | Sunburst genre breakdown |
| Artists | `artists` | `/?scene=artists` | Artist mosaic with gatefold cards |

### Examples

```
# Timeline scene
https://concerts.morperhaus.org/?scene=timeline

# Map scene
https://concerts.morperhaus.org/?scene=geography

# Artists scene
https://concerts.morperhaus.org/?scene=artists
```

---

## Entity Deep Links

Navigate to specific entities within scenes:

### Artist Deep Links (Scene 5)

Opens the artist's gatefold card automatically:

```
https://concerts.morperhaus.org/?scene=artists&artist={normalized-name}
```

**Examples:**

```
# Depeche Mode - opens gatefold with photo, concerts, setlists
https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode

# Social Distortion
https://concerts.morperhaus.org/?scene=artists&artist=social-distortion

# Duran Duran
https://concerts.morperhaus.org/?scene=artists&artist=duran-duran
```

**Behavior:**

1. Scrolls to Artists scene (Scene 5)
2. Loads all artist cards if needed
3. Scrolls to specific artist card
4. Highlights card briefly
5. Opens gatefold with full details

### Setlist Deep Links (Scene 5)

Opens the artist's gatefold **and expands a specific night's setlist**:

```
https://concerts.morperhaus.org/?scene=artists&artist={normalized-name}&show={YYYY-MM-DD}
```

**Examples:**

```
# Nile Rodgers at Pacific Amphitheatre, July 31 2026
https://concerts.morperhaus.org/?scene=artists&artist=nile-rodgers&show=2026-07-31

# Adam Ant at Irvine Meadows, April 27 1984
https://concerts.morperhaus.org/?scene=artists&artist=adam-ant&show=1984-04-27
```

**Behavior:**

1. Scrolls to Artists scene (Scene 5)
2. Opens the artist gatefold (as an artist-only link does)
3. Expands the setlist panel for the matching concert

**The `show` parameter is purely additive.** Artist-only links behave exactly as before; `show` is
ignored when absent, and an unresolvable `show` value falls back to the artist gatefold rather than
erroring.

**Key format:** `show` is the concert `date`, which is globally unique across the archive (verified:
183 records, zero collisions). Do **not** key on `concert.id` — those values are row-order artifacts
and a data re-import that renumbers rows would break every shared link.

**Disambiguation:** uniqueness is a property of the current data, not an enforced invariant. Two shows
on one date is possible (a festival; an early and late set). Resolvers must match on date **and**
artist when both are present, then fall back to first-match.

**Consumers of this shape** — keep in sync when changing it:

| Consumer | Location |
| -------- | -------- |
| SPA param parsing | `src/App.tsx` |
| GA4 virtual pageviews | `src/utils/pageTracking.ts` |
| MCP tool responses | `workers/mcp-server/src/tools.ts` |
| Ask exhibits | `workers/ask-chat/src/exhibits.ts` |
| Sitemap | `scripts/generate-sitemap.ts` |
| Bot meta / OG cards | `workers/meta-injector/worker.js` |
| Liner notes deep links | `scripts/liner-notes/curate.ts` |

See [Setlist Deep Linking spec](./specs/future/setlist-deep-linking.md) for the full rollout.

### Venue Deep Links (Scene 2 - Graph)

Expands and spotlights the venue in the force-directed graph:

```
https://concerts.morperhaus.org/?scene=venues&venue={normalized-name}
```

**Examples:**

```
# 9:30 Club - expands with child artists in graph
https://concerts.morperhaus.org/?scene=venues&venue=9-30-club

# Hollywood Palladium
https://concerts.morperhaus.org/?scene=venues&venue=hollywood-palladium
```

**Behavior:**

1. Scrolls to Venues scene (Scene 2)
2. Locates venue node in force graph
3. Expands venue to show artist children
4. Centers graph on venue
5. Applies spotlight animation

### Venue + Artist Deep Links (Scene 2 - Advanced)

Focus on a specific artist-venue relationship with enhanced spotlight:

```
https://concerts.morperhaus.org/?scene=venues&venue={normalized-venue}&artist={normalized-artist}
```

**Examples:**

```
# 9:30 Club with Depeche Mode - spotlights both nodes
https://concerts.morperhaus.org/?scene=venues&venue=9-30-club&artist=depeche-mode

# Irvine Meadows with OMD
https://concerts.morperhaus.org/?scene=venues&venue=irvine-meadows&artist=omd
```

**Behavior:**

1. Scrolls to Venues scene (Scene 2)
2. Expands venue to show all artists
3. Centers graph on venue
4. Applies focused spotlight: only venue + specified artist visible at full opacity
5. All other nodes dimmed to 0.15 opacity

**Spotlight Rules:**

| Parameter | Focused Nodes (0.85 opacity) | Dimmed Nodes (0.15 opacity) |
|-----------|------------------------------|------------------------------|
| `venue` only | Venue + all its artists | All other venues and artists |
| `venue` + `artist` | Venue + specified artist only | All other venues and artists |

### Venue Deep Links (Scene 3 - Map)

Flies to venue marker and opens popup with photo:

```
https://concerts.morperhaus.org/?scene=geography&venue={normalized-name}
```

**Examples:**

```
# 9:30 Club - flies to DC area, opens popup
https://concerts.morperhaus.org/?scene=geography&venue=9-30-club

# Pacific Amphitheatre - flies to Orange County
https://concerts.morperhaus.org/?scene=geography&venue=pacific-amphitheatre
```

**Behavior:**

1. Scrolls to Geography scene (Scene 3)
2. Activates map interactions
3. Flies to venue location (zoom level 13)
4. Opens popup with venue photo, stats, concerts
5. Provides "Explore Venue →" button to navigate to Scene 2

---

## Normalized Name Format

Entity names are normalized for URL compatibility:

### Rules

1. Convert to lowercase
2. Replace spaces and special characters with hyphens
3. Remove consecutive hyphens
4. Strip leading/trailing hyphens

### Examples

| Display Name | Normalized Name |
| ------------ | --------------- |
| Depeche Mode | `depeche-mode` |
| 9:30 Club | `9-30-club` |
| Irvine Meadows | `irvine-meadows` |
| The English Beat | `the-english-beat` |
| Social Distortion | `social-distortion` |
| Hollywood Palladium | `hollywood-palladium` |
| Alternative Rock | `alternative-rock` |

### Implementation

**✨ Updated in v1.9.0** - All entity normalization now uses hyphens consistently.

```typescript
// Artists, venues, and genres all use the same normalization pattern
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')    // Replace special chars with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
}

function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')    // Replace special chars with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
}

function normalizeGenreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')    // Replace special chars with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
}
```

---

## Use Cases

### Cross-Scene Navigation

**From Artist Gatefold:**
- Click any venue name in the concert history to navigate to Venues scene
- Automatically focuses both the venue and the current artist
- Creates a contextual "tell me more about this relationship" experience

**From Map Popup:**
- Click "Explore Venue →" button to navigate to Venues scene
- Shows venue's full artist network in force-directed graph

### Sharing Content

Share specific discoveries with friends:

```
"Check out Depeche Mode's concert history!"
https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode

"The 9:30 Club has hosted 13 shows!"
https://concerts.morperhaus.org/?scene=venues&venue=9-30-club

"See who Depeche Mode played with at 9:30 Club!"
https://concerts.morperhaus.org/?scene=venues&venue=9-30-club&artist=depeche-mode
```

### Changelog Integration

All changelog entries use deep links to showcase features:

```json
{
  "version": "1.7.6",
  "title": "Changelog Toast UX & Gatefold Refinements",
  "route": "/?scene=artists&artist=depeche-mode"
}
```

When users click "See it live →" on a changelog card, they're taken directly to a representative example.

### Documentation & Tutorials

Link to specific features in guides:

```markdown
To view artist photos, navigate to any artist like
[Depeche Mode](/?scene=artists&artist=depeche-mode)
and open their gatefold.
```

### Social Media & Email

Create discoverable links for marketing:

```
🎵 New Feature: Artist Search!

Try it: https://concerts.morperhaus.org/?scene=artists

Find any artist instantly from 248+ acts spanning 1984-2026.
```

---

## Technical Implementation

### App.tsx Router

```typescript
// Handle deep linking via query parameters
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

    // Scroll to scene after delay
    setTimeout(() => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return

      const windowHeight = window.innerHeight
      scrollContainer.scrollTo({
        top: (sceneId - 1) * windowHeight,
        behavior: 'smooth',
      })
    }, 100)
  }
}, [location.search, loading])
```

### Scene Props

Each scene receives optional focus props:

```typescript
// Artist Scene
interface ArtistSceneProps {
  concerts: Concert[]
  pendingArtistFocus?: string | null
  onArtistFocusComplete?: () => void
}

// Venues Scene
interface Scene4BandsProps {
  concerts: Concert[]
  pendingVenueFocus?: string | null // Legacy venue-only focus
  onVenueFocusComplete?: () => void
  pendingVenueArtistFocus?: { // New venue+artist combined focus
    venue: string
    artist?: string
  } | null
  onVenueArtistFocusComplete?: () => void
}

// Geography Scene
interface Scene3MapProps {
  concerts: Concert[]
  onVenueNavigate?: (venueName: string) => void
  pendingVenueFocus?: string | null
  onVenueFocusComplete?: () => void
}
```

---

## Error Handling

### Invalid Scene

If scene parameter doesn't match any scene name, fallback to homepage:

```typescript
if (sceneParam && !SCENE_MAP[sceneParam]) {
  console.warn('Invalid scene parameter:', sceneParam)
  // Stay on homepage (Scene 1)
}
```

### Entity Not Found

If entity parameter doesn't match any existing entity, log warning and clear focus:

```typescript
if (!artist) {
  console.warn('Artist not found:', normalizedName)
  onArtistFocusComplete?.()
  return
}
```

### URL Cleanup

Query parameters remain in URL for shareability. To clear them after navigation:

```typescript
// Optional: Clean URL after successful navigation
navigate(location.pathname, { replace: true })
```

---

## Browser Compatibility

- **Modern browsers**: Full support (Chrome, Firefox, Safari, Edge)
- **URL handling**: Uses standard `URLSearchParams` API
- **Scroll behavior**: Graceful fallback for browsers without smooth scroll

---

## Future Enhancements

Planned deep linking capabilities:

```typescript
// Concert-specific links on the timeline
/?scene=timeline&show=2026-07-31
```

**Note on the key format:** an earlier draft of this section sketched
`/?scene=timeline&concert=concert-123`. Prefer the date-keyed `show` form above, for the same reason
given in [Setlist Deep Links](#setlist-deep-links-scene-5) — `concert.id` values are row-order
artifacts and a re-import that renumbers rows would break every shared link.

### Superseded

- **`/?scene=artists&artist={name}&tab=setlists`** — sketched in v1.1 as "setlist deep linking".
  Superseded by [`&show={date}`](#setlist-deep-links-scene-5) in v1.2. A `tab` selector identifies
  *which panel*, not *which show*, so it cannot express a link to one night's setlist.

### Already implemented (moved out of this section in v1.2)

These were listed as planned but already ship:

| Capability | Status |
| ---------- | ------ |
| `/?scene=timeline&year=2024` | **Implemented** — parsed in `src/App.tsx`, sets `pendingYearFocus` |
| `/?scene=genres&genre=alternative-rock` | **Bot-only** — `workers/meta-injector/worker.js` injects meta; the SPA does not act on the param |
| `/?scene=geography&region=california` | **Bot-only** — same split as `genre` |

⚠️ The two **bot-only** rows are a known behavioural gap, not a documentation error: a crawler
receives tailored meta for a URL the app itself ignores, so a shared genre or region link unfurls
promising a filtered view the visitor never sees. Tracked separately.

---

## Related Documentation

- [Setlist Deep Linking](./specs/future/setlist-deep-linking.md) - The `show` parameter, cross-surface rollout
- [Changelog System](./specs/implemented/whats-playing-changelog.md) - Toast notifications using deep links
- [Venue Cross-Navigation](./specs/implemented/venue-cross-navigation.md) - Map → Venues scene navigation
- [Artist Scene](./specs/implemented/artist-scene.md) - Gatefold card system

---

**Questions?** See the [main project documentation](./STATUS.md) or review [implementation specs](./specs/implemented/).
