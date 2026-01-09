# Venue Photos & Metadata Integration

> **Status**: Planned for v1.3.2
> **Dependencies**: Data normalization (v1.4.0 recommended but not required)
> **Last Updated**: 2026-01-02

---

## Overview

Integrate Google Places API to fetch venue photos and details, creating a rich visual layer for venue-related features. This spec addresses both active and legacy (closed/demolished) venues with appropriate fallback strategies.

---

## Goals

1. **Visual enrichment** - Add photos to venue displays across all scenes
2. **Historical accuracy** - Handle legacy venues that no longer exist
3. **Cost efficiency** - Cache-first approach to minimize API calls
4. **Graceful degradation** - App works perfectly without venue photos

---

## The Legacy Venue Problem

### Challenge

Many concert venues from the 1980s-1990s no longer exist:
- **Irvine Meadows Amphitheatre** - Demolished in 2016
- **Universal Amphitheater** - Demolished and rebuilt as Gibson Amphitheatre (also now closed)
- **Palladium (Hollywood)** - Closed, reopened, closed again
- Many clubs have closed or changed names

### Google Places API Limitations

1. **Closed venues may not have Place IDs** - Google removes places after extended closure
2. **Historical photos may be unavailable** - User-submitted photos deleted when place closes
3. **Name changes cause lookup failures** - "Universal Amphitheater" vs "Universal Amphitheatre"

### Solution Strategy

Use a **three-tier fallback** approach:

1. **Google Places API** (primary) - For active venues with Place IDs
2. **Manual photo curation** (secondary) - For legacy venues, store photos in `/public/images/venues/`
3. **No photo** (fallback) - Gracefully handle missing photos

---

## Data Structure

### venues-metadata.json

```json
{
  "irvinemeadows": {
    "name": "Irvine Meadows",
    "normalizedName": "irvinemeadows",
    "city": "Irvine",
    "state": "California",
    "cityState": "Irvine, California",

    // Location data (from geocode-cache.json)
    "location": {
      "lat": 33.6894,
      "lng": -117.7723
    },

    // Concert references (from concerts.json)
    "concerts": [
      { "id": "concert-1", "date": "1984-04-27", "headliner": "Depeche Mode" },
      { "id": "concert-12", "date": "1988-06-15", "headliner": "The Cure" }
    ],

    // Computed stats
    "stats": {
      "totalConcerts": 2,
      "firstEvent": "1984-04-27",
      "lastEvent": "1988-06-15",
      "uniqueArtists": 2
    },

    // Venue status
    "status": "closed",  // "active" | "closed" | "demolished" | "renamed"
    "closedDate": "2016-09-25",
    "notes": "Demolished to make way for residential development",

    // Google Places data (may be null for legacy venues)
    "places": null,

    // Manual photo curation (for legacy venues)
    "manualPhotos": [
      {
        "url": "/images/venues/irvine-meadows-1.jpg",
        "width": 1200,
        "height": 800,
        "caption": "Irvine Meadows Amphitheatre, circa 1985",
        "source": "OC Register Archives",
        "license": "Fair Use"
      }
    ],

    // Unified photo URLs (Google or manual)
    "photoUrls": {
      "thumbnail": "/images/venues/irvine-meadows-1.jpg?w=400",
      "medium": "/images/venues/irvine-meadows-1.jpg?w=800",
      "large": "/images/venues/irvine-meadows-1.jpg"
    },

    "fetchedAt": "2026-01-02T12:00:00Z",
    "photoCacheExpiry": null  // Manual photos don't expire
  },

  "hollywoodbowl": {
    "name": "Hollywood Bowl",
    "normalizedName": "hollywoodbowl",
    "city": "Los Angeles",
    "state": "California",
    "cityState": "Los Angeles, California",

    "location": {
      "lat": 34.1128,
      "lng": -118.3389
    },

    "concerts": [
      { "id": "concert-134", "date": "2017-09-16", "headliner": "Depeche Mode" }
    ],

    "stats": {
      "totalConcerts": 1,
      "firstEvent": "2017-09-16",
      "lastEvent": "2017-09-16",
      "uniqueArtists": 1
    },

    "status": "active",

    // Google Places data (available for active venues)
    "places": {
      "placeId": "ChIJQ7Kcwsorw4ARjLA4Dpgg-IU",
      "photos": [
        {
          "photoReference": "places/ChIJQ7Kcwsorw4ARjLA4Dpgg-IU/photos/ATplDJY...",
          "width": 4800,
          "height": 3200,
          "attributions": ["John Doe"]
        }
      ],
      "rating": 4.7,
      "userRatingsTotal": 45678,
      "types": ["amphitheater", "point_of_interest", "establishment"],
      "website": "https://www.hollywoodbowl.com",
      "formattedAddress": "2301 N Highland Ave, Los Angeles, CA 90068"
    },

    "manualPhotos": null,

    // Photo URLs from Google Places API
    "photoUrls": {
      "thumbnail": "https://places.googleapis.com/v1/.../media?maxHeightPx=400&key=...",
      "medium": "https://places.googleapis.com/v1/.../media?maxHeightPx=800&key=...",
      "large": "https://places.googleapis.com/v1/.../media?maxHeightPx=1200&key=..."
    },

    "fetchedAt": "2026-01-02T12:00:00Z",
    "photoCacheExpiry": "2026-04-02T12:00:00Z"  // 90-day cache for API photos
  }
}
```

---

## Implementation Plan

### Phase 0: Manual Venue Classification (v1.3.2-prep)

**Goal:** Identify which venues are active vs legacy

1. Export unique venue list from concerts.json
2. Manually research each venue's status
3. Create `venue-status.csv`:
   ```csv
   venue,status,closed_date,notes
   Irvine Meadows,demolished,2016-09-25,Demolished for residential development
   Hollywood Bowl,active,,Still operating
   ```

**Timeline:** 1-2 days (76 venues × 2 min = 2.5 hours + buffer)

---

### Phase 1: Google Places Client (v1.3.2)

**Goal:** Implement Places API integration

**Files to create:**
- `scripts/utils/google-places-client.ts` - Places API wrapper
- `scripts/enrich-venues.ts` - Main venue enrichment script
- `public/data/venue-photos-cache.json` - API response cache

**Implementation:**

```typescript
// scripts/utils/google-places-client.ts
export class GooglePlacesClient {
  private apiKey: string
  private cache: Map<string, PlaceDetails>

  constructor(apiKey: string, cacheFilePath?: string) {
    this.apiKey = apiKey
    this.cache = this.loadCache(cacheFilePath)
  }

  /**
   * Search for venue by name and location
   */
  async findPlace(venueName: string, city: string, state: string): Promise<string | null> {
    const query = `${venueName}, ${city}, ${state}`
    const cacheKey = this.normalizeKey(query)

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.placeId
    }

    // Text Search API request
    const url = `https://places.googleapis.com/v1/places:searchText`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName'
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 1000  // 1km radius
          }
        }
      })
    })

    const data = await response.json()
    if (!data.places || data.places.length === 0) {
      console.warn(`No place found for: ${query}`)
      return null
    }

    const placeId = data.places[0].id
    this.cache.set(cacheKey, { placeId, query })
    return placeId
  }

  /**
   * Get place details including photos
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    const url = `https://places.googleapis.com/v1/${placeId}`
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'id,displayName,photos,rating,userRatingCount,types,websiteUri,formattedAddress'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch place details: ${placeId}`)
      return null
    }

    return await response.json()
  }

  /**
   * Get photo URL with caching
   */
  getPhotoUrl(photoReference: string, maxHeightPx: number): string {
    return `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=${maxHeightPx}&key=${this.apiKey}`
  }
}
```

**Timeline:** v1.3.2 (3-4 days)

---

### Phase 2: Venue Enrichment Script (v1.3.2)

**Goal:** Populate venues-metadata.json with API data

```typescript
// scripts/enrich-venues.ts
import { GooglePlacesClient } from './utils/google-places-client.js'
import { readFileSync, writeFileSync } from 'fs'

interface VenueStatus {
  venue: string
  status: 'active' | 'closed' | 'demolished' | 'renamed'
  closedDate?: string
  notes?: string
}

async function enrichVenues() {
  // Load data
  const concerts = JSON.parse(readFileSync('public/data/concerts.json', 'utf-8'))
  const venueStatuses = loadVenueStatuses('data/venue-status.csv')
  const placesClient = new GooglePlacesClient(process.env.GOOGLE_MAPS_API_KEY!)

  // Get unique venues
  const venueMap = new Map<string, VenueStatus>()
  concerts.concerts.forEach(concert => {
    const key = normalizeVenueName(concert.venue)
    if (!venueMap.has(key)) {
      venueMap.set(key, {
        venue: concert.venue,
        city: concert.city,
        state: concert.state,
        location: concert.location
      })
    }
  })

  const venuesMetadata = {}

  // Process each venue
  for (const [normalizedName, venue] of venueMap) {
    const status = venueStatuses.get(normalizedName) || { status: 'active' }

    // Initialize venue entry
    venuesMetadata[normalizedName] = {
      name: venue.venue,
      normalizedName,
      city: venue.city,
      state: venue.state,
      cityState: `${venue.city}, ${venue.state}`,
      location: venue.location,
      status: status.status,
      closedDate: status.closedDate || null,
      notes: status.notes || null
    }

    // Only fetch from API if venue is active
    if (status.status === 'active') {
      console.log(`Fetching Place ID for: ${venue.venue}`)
      const placeId = await placesClient.findPlace(venue.venue, venue.city, venue.state)

      if (placeId) {
        await sleep(100)  // Rate limiting
        const placeDetails = await placesClient.getPlaceDetails(placeId)

        if (placeDetails) {
          venuesMetadata[normalizedName].places = placeDetails

          // Generate photo URLs
          if (placeDetails.photos && placeDetails.photos.length > 0) {
            const photo = placeDetails.photos[0]
            venuesMetadata[normalizedName].photoUrls = {
              thumbnail: placesClient.getPhotoUrl(photo.name, 400),
              medium: placesClient.getPhotoUrl(photo.name, 800),
              large: placesClient.getPhotoUrl(photo.name, 1200)
            }
          }

          venuesMetadata[normalizedName].photoCacheExpiry =
            new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    } else {
      // Legacy venue - check for manual photos
      venuesMetadata[normalizedName].places = null
      venuesMetadata[normalizedName].manualPhotos = checkManualPhotos(normalizedName)

      if (venuesMetadata[normalizedName].manualPhotos) {
        const photo = venuesMetadata[normalizedName].manualPhotos[0]
        venuesMetadata[normalizedName].photoUrls = {
          thumbnail: `${photo.url}?w=400`,
          medium: `${photo.url}?w=800`,
          large: photo.url
        }
      }
    }

    venuesMetadata[normalizedName].fetchedAt = new Date().toISOString()
  }

  // Write output
  writeFileSync(
    'public/data/venues-metadata.json',
    JSON.stringify(venuesMetadata, null, 2)
  )

  console.log(`✓ Enriched ${Object.keys(venuesMetadata).length} venues`)
}
```

**Timeline:** v1.3.2 (2 days)

---

### Phase 3: Manual Photo Curation (v1.3.2)

**Goal:** Add historical photos for legacy venues

**Process:**
1. Identify venues where `status !== 'active'` and `places === null`
2. Search for historical photos:
   - Wikipedia Commons
   - Internet Archive
   - Local newspaper archives
   - Fair use concert posters/flyers
3. Store in `/public/images/venues/`
4. Update `manualPhotos` field in venues-metadata.json

**Photo requirements:**
- Minimum 800px wide
- JPEG format (optimized for web)
- Attribution/source documented
- License verified (public domain, CC, fair use)

**Timeline:** v1.3.2 (ongoing, ~1 hour per venue = 20-30 hours total for legacy venues)

---

### Phase 4: Frontend Integration (v1.4.0)

**Goal:** Display venue photos in scenes

#### Phase 4a: Geography Scene Map Popups (Primary - v1.3.2)

**Priority:** HIGH - This is the primary integration point

**Why Geography Scene First:**

- Natural context (users exploring venues geographically)
- High visual impact in white popups
- Low implementation risk (doesn't affect scene navigation)
- Small thumbnail size (300-400px) loads fast
- Graceful degradation (popup works without photo)

**Implementation:**

```typescript
// src/components/scenes/Scene3Map.tsx
import { useMemo } from 'react'

// Load venues metadata
const [venuesMetadata, setVenuesMetadata] = useState<VenuesMetadataFile | null>(null)

useEffect(() => {
  fetch('/data/venues-metadata.json')
    .then(res => res.json())
    .then(data => setVenuesMetadata(data))
    .catch(err => console.error('Failed to load venue metadata:', err))
}, [])

// In marker popup rendering:
const venue = venuesMetadata?.[concert.venueNormalized]

<Popup maxWidth={300} className="venue-popup">
  {/* Venue photo at top */}
  {venue?.photoUrls?.thumbnail && (
    <img
      src={venue.photoUrls.thumbnail}
      alt={concert.venue}
      className="w-full h-32 object-cover rounded-t mb-2"
      loading="lazy"
    />
  )}

  {/* Venue info */}
  <div className="font-sans p-1">
    <h3 className="font-semibold text-base mb-1">{concert.venue}</h3>
    <p className="text-xs text-gray-500 mb-2">{concert.cityState}</p>

    {/* Legacy venue badge */}
    {venue?.status && venue.status !== 'active' && (
      <span className="inline-block mb-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
        {venue.status === 'demolished' ? 'Demolished' : 'Closed'}
        {venue.closedDate && ` ${venue.closedDate.split('-')[0]}`}
      </span>
    )}

    {/* Concert info */}
    <div className="pt-2 border-t border-gray-200">
      <p className="text-sm font-medium text-gray-900">{concert.headliner}</p>
      <p className="text-xs text-gray-600">
        {new Date(concert.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}
      </p>
    </div>
  </div>
</Popup>
```

**Visual Design:**

- Photo: Full width, 128px height (h-32), rounded top corners
- Object-fit: cover (maintains aspect ratio, crops if needed)
- Lazy loading for performance
- Seamless integration with existing popup text

**Timeline:** v1.3.2 (1 day after venues-metadata.json is populated)

#### Phase 4b: Venue Network Detail Modal (Secondary - v1.4.0)

**Priority:** MEDIUM - Enhanced detail view

**Implementation:**

```typescript
// src/components/scenes/Scene4Bands.tsx (Venue Network)
const venue = venuesMetadata?.[selectedVenue.normalized]

// Venue detail modal (triggered on venue node click when expanded)
<motion.div className="venue-detail-modal">
  {venue?.photoUrls?.large && (
    <img
      src={venue.photoUrls.large}
      alt={venue.name}
      className="w-full h-64 object-cover rounded-t"
    />
  )}

  <div className="p-6">
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-2xl font-serif">{venue.name}</h2>
        <p className="text-gray-600">{venue.cityState}</p>
      </div>
      {venue?.status !== 'active' && (
        <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
          {venue.status === 'demolished' ? 'Demolished' : 'Closed'}
          {venue.closedDate && ` ${venue.closedDate.split('-')[0]}`}
        </span>
      )}
    </div>

    {/* Venue stats */}
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div>
        <p className="text-2xl font-semibold">{venue.stats.totalConcerts}</p>
        <p className="text-sm text-gray-500">Concerts</p>
      </div>
      <div>
        <p className="text-2xl font-semibold">{venue.stats.uniqueArtists}</p>
        <p className="text-sm text-gray-500">Artists</p>
      </div>
      <div>
        <p className="text-sm text-gray-500">
          {venue.stats.firstEvent.split('-')[0]} – {venue.stats.lastEvent.split('-')[0]}
        </p>
      </div>
    </div>

    {/* Concert list */}
    <div className="space-y-2">
      {venue.concerts.map(concert => (
        <div key={concert.id} className="flex justify-between text-sm">
          <span className="font-medium">{concert.headliner}</span>
          <span className="text-gray-500">{concert.date}</span>
        </div>
      ))}
    </div>
  </div>
</motion.div>
```

**Timeline:** v1.4.0 (2 days)

---

## Summary: Phased Rollout

### v1.3.2 Release

1. ✅ Google Places API client
2. ✅ Venue enrichment script
3. ✅ venues-metadata.json populated
4. ✅ **Geography Scene map popups** (PRIMARY)
5. ⏳ Manual photo curation (ongoing)

### v1.4.0 Release

1. ✅ Venue Network detail modals (SECONDARY)
2. ✅ Multiple photos per venue (gallery)
3. ✅ Enhanced venue stats display

---

## API Cost Analysis

### Google Places API Pricing

- **Text Search**: $32.00 per 1,000 requests
- **Place Details**: $17.00 per 1,000 requests (with photos field)
- **Place Photos**: $7.00 per 1,000 requests

### Expected Usage

**Initial run (76 venues):**
- Text Search: 76 requests × $0.032 = **$2.43**
- Place Details: ~50 active venues × $0.017 = **$0.85**
- Place Photos: ~50 photos × $0.007 = **$0.35**
- **Total initial cost: $3.63**

**Incremental (new venues):**
- ~2-5 new venues per year = **$0.20/year**

**Photo refresh (90-day cache):**
- Refresh 50 active venues × 4 times/year = 200 requests
- 200 × ($0.032 + $0.017 + $0.007) = **$11.20/year**

**Annual total: ~$15/year** (well within $200/month free tier)

---

## Cache Strategy

### venue-photos-cache.json

Cache API responses to minimize costs:

```json
{
  "irvinemeadows|irvine|california": {
    "placeId": null,
    "status": "closed",
    "searchedAt": "2026-01-02T12:00:00Z",
    "notes": "Venue demolished in 2016"
  },
  "hollywoodbowl|losangeles|california": {
    "placeId": "ChIJQ7Kcwsorw4ARjLA4Dpgg-IU",
    "status": "active",
    "placeDetails": { ... },
    "fetchedAt": "2026-01-02T12:00:00Z",
    "expiresAt": "2026-04-02T12:00:00Z"
  }
}
```

**Cache invalidation:**
- Manual entries (legacy venues): Never expire
- API entries (active venues): 90-day TTL
- Force refresh: `npm run enrich-venues -- --force`

---

## Fallback Behavior

### Missing Photos

If no photo available (API failure, legacy venue, etc.):

1. **Show venue icon** - Generic amphitheater/club icon
2. **Display venue name prominently** - Typography-focused design
3. **Include venue stats** - Concert count, artists, dates
4. **No broken images** - Use CSS background with fallback color

```tsx
// Venue card with fallback
<div className="venue-card">
  {venue?.photoUrls?.medium ? (
    <img src={venue.photoUrls.medium} alt={venue.name} />
  ) : (
    <div className="venue-placeholder">
      <VenueIcon className="w-16 h-16 text-gray-400" />
    </div>
  )}
  <h3>{venue.name}</h3>
  <p>{venue.stats.totalConcerts} concerts</p>
</div>
```

---

## Testing Strategy

### Unit Tests

- Photo URL generation
- Cache key normalization
- Fallback logic

### Integration Tests

- Places API client
- Venue enrichment script
- Cache loading/saving

### Manual Testing Checklist

- [ ] Active venue photo loads correctly
- [ ] Legacy venue shows manual photo
- [ ] Missing photo shows fallback UI
- [ ] Map popup displays venue photo
- [ ] Venue modal shows full-size photo
- [ ] Photo cache respects TTL
- [ ] Rate limiting works (no 429 errors)

---

## Success Metrics

- ✅ >90% of active venues have photos
- ✅ >50% of legacy venues have curated photos
- ✅ Zero broken images in production
- ✅ API costs <$20/year
- ✅ Photo load time <2 seconds (via CDN caching)

---

## Future Enhancements

### v1.5.0+

- **Multiple photos per venue** - Gallery carousel
- **User-submitted photos** - Community contributions
- **Photo verification** - Admin panel to review/approve
- **Historical timeline** - Show venue evolution over time
- **Venue comparison** - Side-by-side venue stats

---

## Related Documentation

- [global-data-normalization-architecture.md](./global-data-normalization-architecture.md) - Parent spec
- [google-sheets-data-integration.md](./google-sheets-data-integration.md) - Data pipeline
- [DATA_PIPELINE.md](../../DATA_PIPELINE.md) - Pipeline overview
- [api-setup.md](../../api-setup.md) - API credentials setup

---

*Last updated: 2026-01-02*
