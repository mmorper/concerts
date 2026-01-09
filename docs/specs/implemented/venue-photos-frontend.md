# Venue Photos Frontend Integration

**Version:** v1.3.3
**Implementation Date:** 2026-01-03
**Component:** `src/components/scenes/Scene3Map.tsx`
**Status:** Complete ✅

---

## Overview

Frontend integration of venue photos into Geography Scene map popups. When users click venue markers, they see photos, legacy venue badges, and venue statistics. This completes the full venue photo system started in v1.3.2 (backend).

---

## Visual Design

### Popup Structure

```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │    [Venue Photo]        │ │  ← 120px height
│ └─────────────────────────┘ │
│ The Coach House             │  ← Venue name (14px, bold)
│ San Juan Capistrano, CA     │  ← Location (12px, gray)
│ 🏛️ Closed 2008              │  ← Legacy badge (if applicable)
│ 10 concerts                 │  ← Concert count (12px)
└──────────────┬──────────────┘
               ▼
```

### Legacy Venue Badges

- **🏛️ Closed [YEAR]** - For closed venues (still standing)
- **🔨 Demolished [YEAR]** - For demolished venues

---

## Implementation

### 1. Data Loading

venues-metadata.json (981KB) is lazy-loaded when Scene 3 component mounts:

```typescript
const [venuesMetadata, setVenuesMetadata] = useState<Record<string, VenueMetadata> | null>(null)

useEffect(() => {
  const loadVenuesMetadata = async () => {
    try {
      const response = await fetch('/data/venues-metadata.json')
      const data = await response.json()
      setVenuesMetadata(data)
    } catch (err) {
      console.warn('Failed to load venue metadata:', err)
      // Popups gracefully degrade to no-image state
    }
  }

  loadVenuesMetadata()
}, [])
```

**Performance Strategy:**
- Loaded on component mount (not app startup)
- By the time user scrolls to Scene 3, data is ready
- Failed fetch doesn't break popups (graceful degradation)

### 2. Venue Name Normalization

Created utility function to match venue names to metadata keys:

**File:** `src/utils/normalizeVenueName.ts`

```typescript
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}
```

**Examples:**
- "The Coach House" → "thecoachhouse"
- "Irvine Meadows" → "irvinemeadows"
- "21st Amendment" → "21stamendment"

### 3. Popup HTML Generation

Created `generatePopupHTML()` helper that produces enhanced popup content:

```typescript
const generatePopupHTML = (venueName: string, cityState: string, concertCount: number): string => {
  if (!venuesMetadata) {
    // Fallback to simple popup if metadata not loaded yet
    return `<strong>${venueName}<br/><span>...</span></strong><br/>${concertCount} concert${...}`
  }

  const normalizedName = normalizeVenueName(venueName)
  const venue = venuesMetadata[normalizedName]
  const thumbnailUrl = venue?.photoUrls?.thumbnail

  // Legacy badge logic
  let legacyBadge = ''
  if (venue?.status && venue.status !== 'active') {
    const icon = venue.status === 'demolished' ? '🔨' : '🏛️'
    const label = venue.status === 'demolished' ? 'Demolished' : 'Closed'
    const year = venue.closedDate ? ` ${venue.closedDate.split('-')[0]}` : ''
    legacyBadge = `<div class="venue-popup-badge">${icon} ${label}${year}</div>`
  }

  return `
    <div class="venue-popup-content">
      ${thumbnailUrl ? `
        <div class="venue-popup-image-container">
          <img
            src="${thumbnailUrl}"
            alt="${venueName}"
            class="venue-popup-image"
            loading="lazy"
            onload="this.parentElement.classList.add('loaded')"
            onerror="this.parentElement.style.display='none'"
          />
          <div class="venue-popup-skeleton"></div>
        </div>
      ` : ''}
      <div class="venue-popup-text">
        <div class="venue-popup-name">${venueName}</div>
        <div class="venue-popup-location">${cityState}</div>
        ${legacyBadge}
        <div class="venue-popup-count">${concertCount} concert${concertCount !== 1 ? 's' : ''}</div>
      </div>
    </div>
  `
}
```

### 4. Image Loading States

Three states for venue photos:

1. **Loading (Skeleton):**
   - Animated shimmer gradient (gray-700 → gray-600 → gray-700)
   - 1.5s infinite animation
   - Displayed while image loads

2. **Loaded:**
   - Fade-in transition (opacity: 0 → 1, 300ms)
   - `onload` handler adds `.loaded` class
   - Skeleton hidden

3. **Error:**
   - `onerror` handler hides image container entirely
   - Popup shows text-only version gracefully

### 5. Fallback Hierarchy

The system gracefully handles missing data:

| Condition | Behavior |
|-----------|----------|
| `venuesMetadata` not loaded | Simple text popup (venue name + count) |
| Venue not in metadata | Popup without photo section |
| `photoUrls` is null/undefined | Popup without photo section |
| Image fails to load (404) | Image container hidden, text shows |
| Image loads slowly | Skeleton displays until loaded |

---

## Styling

All styles in `src/index.css`:

```css
/* Container with shimmer skeleton */
.venue-popup-image-container {
  position: relative;
  width: 100%;
  height: 120px;
  overflow: hidden;
  background-color: #374151; /* gray-700 */
}

/* Image with fade-in */
.venue-popup-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* Loaded state */
.venue-popup-image-container.loaded .venue-popup-image {
  opacity: 1;
}

.venue-popup-image-container.loaded .venue-popup-skeleton {
  display: none;
}

/* Skeleton with shimmer animation */
.venue-popup-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    #374151 25%,
    #4b5563 50%,
    #374151 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Legacy badge styling */
.venue-popup-badge {
  display: inline-block;
  font-size: 11px;
  color: #6b7280; /* gray-600 */
  background-color: #f3f4f6; /* gray-100 */
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 6px;
}
```

---

## Photo Sources

### 1. Google Places API Photos (63 venues, 83%)

**Source:** Google Maps user contributions, business owners, Street View, professional photographers

**Quality:**
- Major venues (Hollywood Bowl, Staples Center): Professional-quality
- Smaller clubs: Casual user photos, varying quality
- Photos selected by Google's quality/popularity algorithm

**Examples:**
- Hollywood Bowl: 4800px professional venue shot
- The Coach House: 3000px user-contributed exterior

### 2. Manual Curated Photos (10 venues, 13%)

**Source:** Historical research (Wikipedia Commons, Internet Archive, newspapers)

**Legacy Venues:**
- Irvine Meadows Amphitheatre (demolished 2016)
- Universal Amphitheater (demolished 2013)
- RFK Stadium (demolished 2019)
- Nokia Center (renamed)
- And 6 others

**Storage:** `/public/images/venues/{normalizedName}-1.jpg`

### 3. Fallback Images (3 venues, 4%)

**Active venues without API photos:** `fallback-active.jpg`
- Generic concert stage/amphitheater image

**Legacy venues without manual photos:** `fallback.jpg`
- Closed door image (symbolizes venues that no longer exist)

---

## Performance

### Bundle Impact
- **venues-metadata.json:** 981KB (loaded on Scene 3 mount)
- **Code size:** +120 lines in Scene3Map.tsx, +15 lines utility
- **CSS:** +60 lines for popup styling

### Runtime Performance
- **Lazy loading:** `loading="lazy"` attribute on images
- **Fetch strategy:** Single fetch on component mount
- **Memory:** ~1MB for metadata object in memory
- **No impact on initial page load** (Scene 1-2 unaffected)

### API Costs
- **Zero runtime API calls** (all photos pre-fetched at build time)
- **Build-time costs:** ~$4.26 initial, ~$15/year ongoing (see DATA_PIPELINE.md)

---

## Known Limitations

### Z-Index Stacking Context

**Behavior:** Popups may appear behind navigation buttons in rare cases (e.g., edge markers near Las Vegas).

**Root Cause:** Map container (`z-0`) creates a stacking context that contains all Leaflet elements. Navigation buttons are at `z-[1001]` in parent context.

**Impact:**
- Low - Most venues (LA, DC clusters) are center-map and never overlap
- Users can close popup (X button) or click elsewhere if needed

**Future Enhancement:** Documented in `docs/specs/future/map-popup-z-index.md` (optional)

---

## Testing Coverage

### Manual Verification

Tested venue types:
- ✅ Active venue with Google Places photo (Hollywood Bowl)
- ✅ Legacy venue with manual photo (Irvine Meadows) + 🔨 Demolished 2016 badge
- ✅ Active venue with fallback image (Crawford Hall)
- ✅ Slow network (skeleton shimmer works)
- ✅ Failed image load (graceful degradation)
- ✅ All three region filters (All, California, DC Area)

### Build Validation
- ✅ TypeScript compilation passes
- ✅ No runtime errors in console
- ✅ Hot reload works during development

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/scenes/Scene3Map.tsx` | +60 lines: metadata fetch, popup HTML generation, dependency updates |
| `src/utils/normalizeVenueName.ts` | NEW: 15-line utility function |
| `src/index.css` | +60 lines: popup image styles, skeleton animation, badges |
| `README.md` | Updated feature descriptions and version |
| `docs/STATUS.md` | Marked v1.3.3 complete |
| `docs/NEXT_CONTEXT_WINDOW.md` | Marked frontend integration complete |

**Total:** 3 files modified, 1 new file, ~135 lines added

---

## User Experience

### Before (v1.3.2)
```
┌─────────────────────────────┐
│ The Coach House             │
│ San Juan Capistrano, CA     │
│ 10 concerts                 │
└──────────────┬──────────────┘
               ▼
```

### After (v1.3.3)
```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │  [Venue Photo w/shim]   │ │  ← NEW: 120px photo
│ └─────────────────────────┘ │
│ The Coach House             │
│ San Juan Capistrano, CA     │
│ 🏛️ Closed 2008              │  ← NEW: Legacy badge
│ 10 concerts                 │
└──────────────┬──────────────┘
               ▼
```

**Benefits:**
- Visual memory aid (recognize venues by photo)
- Historical context (closed/demolished badges)
- Professional presentation (96% real photos)
- Richer geography exploration experience

---

## Related Documentation

- [DATA_PIPELINE.md](../../DATA_PIPELINE.md) - Backend photo enrichment system
- [api-setup.md](../../api-setup.md) - Google Places API configuration
- [venue-popup-thumbnail-spec.md](../future/venue-popup-thumbnail-spec.md) - Original design spec
- [NEXT_CONTEXT_WINDOW.md](../NEXT_CONTEXT_WINDOW.md) - Implementation plan

---

*Implemented: 2026-01-03*
*Single context window implementation* ✅
