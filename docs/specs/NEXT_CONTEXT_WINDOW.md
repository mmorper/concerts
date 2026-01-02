# Next Context Window: Phase 5 Context Window 5 - Frontend Integration

> **Date**: 2026-01-02
> **Target Release**: v1.3.2
> **Status**: Ready to implement

---

## Summary of Completed Work

### Phase 5 Context Windows 1-4 (COMPLETE) ✅

**What we built:**

1. **Venue Export Script** (`scripts/export-venues.ts`)
   - Extracts unique venues from concerts.json
   - Generates CSV for manual classification

2. **Google Places API Client** (`scripts/utils/google-places-client.ts`)
   - Text Search API for finding venue Place IDs
   - Place Details API for fetching photos and metadata
   - Photo URL generation (thumbnail 400px, medium 800px, large 1200px)
   - Cache-first strategy with 90-day TTL
   - Rate limiting with 20ms delays

3. **Venue Enrichment Script** (`scripts/enrich-venues.ts`)
   - Processes 76 venues (66 active, 10 legacy)
   - Fetches photos from Google Places API for active venues
   - Checks for manual photos in `/public/images/venues/` for legacy venues
   - Implements 5-tier fallback hierarchy
   - Generates `public/data/venues-metadata.json`

4. **Manual Photo Curation** (COMPLETE - user went above and beyond!)
   - Created 2 fallback images (fallback-active.jpg, fallback.jpg)
   - Curated 8 manual photos for legacy venues
   - All 76 venues classified in `data/venue-status.csv`

5. **Photo Review Tool** (`scripts/review-venue-photos.ts`)
   - Lists all venue photos with URLs
   - Shows photographer attribution
   - Identifies venues using fallback images

6. **Comprehensive Documentation**
   - Updated `docs/DATA_PIPELINE.md` with Section 5 "Venue Enrichment"
   - Updated `docs/api-setup.md` with Google Places API setup
   - Added photo quality, sources, and attribution documentation

**Results:**

- 76 venues processed
- 73 venues (96%) have real photos
- 3 venues use fallback images
- Annual API cost: ~$15/year (well within free tier)

---

## What's Next: Frontend Integration (Context Window 5)

### Goal

Display venue photos in Geography Scene map popups when users click on concert markers.

### Tasks

#### Task 1: Load venues-metadata.json

**File**: `src/components/scenes/Scene3Map.tsx`

Add state and fetch logic:

```typescript
const [venuesMetadata, setVenuesMetadata] = useState<Record<string, VenueMetadata> | null>(null)

useEffect(() => {
  fetch('/data/venues-metadata.json')
    .then(res => res.json())
    .then(data => setVenuesMetadata(data))
    .catch(err => console.error('Failed to load venue metadata:', err))
}, [])
```

#### Task 2: Update Marker Popups

**File**: `src/components/scenes/Scene3Map.tsx`

Enhance the popup rendering to show:

1. **Venue photo at top** (128px height, full width, rounded top corners)
2. **Venue name and location**
3. **Legacy venue badge** (if closed/demolished)
4. **Concert info** (headliner, date)

**Key implementation details:**

```typescript
// Get venue metadata
const normalizedVenueName = normalizeVenueName(concert.venue)
const venue = venuesMetadata?.[normalizedVenueName]

<Popup maxWidth={300} className="venue-popup">
  {/* Venue photo */}
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

#### Task 3: Create normalizeVenueName Helper

**File**: `src/utils/normalizeVenueName.ts` (create new file)

```typescript
/**
 * Normalize venue name to match keys in venues-metadata.json
 */
export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}
```

Import in Scene3Map.tsx:

```typescript
import { normalizeVenueName } from '../../utils/normalizeVenueName'
```

#### Task 4: Add TypeScript Interface

**File**: `src/types/venues.ts` (create new file)

```typescript
export interface VenueMetadata {
  name: string
  normalizedName: string
  city: string
  state: string
  cityState: string
  location?: {
    lat: number
    lng: number
  }
  concerts: Array<{
    id: string
    date: string
    headliner: string
  }>
  stats: {
    totalConcerts: number
    firstEvent: string
    lastEvent: string
    uniqueArtists: number
  }
  status: string
  closedDate?: string | null
  notes?: string | null
  places?: any
  manualPhotos?: Array<{
    url: string
    width: number
    height: number
  }> | null
  photoUrls?: {
    thumbnail: string
    medium: string
    large: string
  } | null
  fetchedAt: string
  photoCacheExpiry?: string | null
}
```

#### Task 5: Testing Checklist

- [ ] Test active venue with Google Places photo (e.g., Hollywood Bowl)
- [ ] Test legacy venue with manual photo (e.g., Irvine Meadows)
- [ ] Test venue using fallback image (check review-venue-photos output)
- [ ] Test popup layout on desktop
- [ ] Test popup layout on mobile
- [ ] Verify lazy loading works (check Network tab)
- [ ] Verify no console errors
- [ ] Verify photo attribution shows in photographer name (available in venue.places.photos[0].authorAttributions)

#### Task 6: Update Documentation

- [ ] Update `docs/STATUS.md` - Mark v1.3.2 complete
- [ ] Update `docs/specs/ROADMAP.md` - Mark Context Window 5 complete
- [ ] Update `README.md` - Add venue photos feature to feature list

---

## Key Files to Reference

### Data Files (Already Generated)

- `public/data/venues-metadata.json` - 76 venues with photos (62KB)
- `public/data/venue-photos-cache.json` - API response cache (14KB)
- `data/venue-status.csv` - Manual venue classifications

### Frontend Files to Modify

- `src/components/scenes/Scene3Map.tsx` - Main integration point
- `src/utils/normalizeVenueName.ts` - NEW utility function
- `src/types/venues.ts` - NEW TypeScript interface

### Documentation Files to Update

- `docs/STATUS.md`
- `docs/specs/ROADMAP.md`
- `README.md`

---

## Expected Outcomes

### Visual Changes

Users will see:

1. **Enhanced map popups** with venue photos at the top
2. **Historical context** via "Closed" or "Demolished" badges on legacy venues
3. **Professional presentation** with 96% real venue photos

### Technical Changes

- New data file loaded: venues-metadata.json (~62KB)
- Minimal performance impact (lazy loading, cached photos)
- Graceful fallback for missing photos

### User Experience

- **Richer context** when exploring concerts geographically
- **Visual memory aids** to remember venues
- **Historical preservation** of closed/demolished venues

---

## Success Criteria

- ✅ venues-metadata.json loads without errors
- ✅ Venue photos display in map popups
- ✅ Legacy venue badges show for closed/demolished venues
- ✅ Fallback images work when photos unavailable
- ✅ No performance regressions (load time < 2 seconds)
- ✅ Mobile layout looks good (popup responsive)
- ✅ All 76 venues tested (spot check 10-15 venues)

---

## Release Notes for v1.3.2

**Title**: Venue Photos Integration

**Summary**:

Added venue photos to Geography Scene map popups using Google Places API integration. Includes historical photos for legacy venues and graceful fallbacks for missing photos.

**Features**:

- 🖼️ **Venue photos in map popups** - 73 venues (96%) now have photos
- 🏛️ **Legacy venue badges** - Visual indicators for closed/demolished venues
- 🎨 **Professional fallback images** - Generic venue images when photos unavailable
- 🔄 **Smart caching** - 90-day cache for API photos, permanent cache for manual photos
- 📸 **Photo attribution** - Photographer credits from Google Places API

**Technical Details**:

- Google Places API (New) integration
- venues-metadata.json (62KB) with 76 venues
- 5-tier fallback hierarchy
- Manual photo curation for 8 legacy venues
- Annual API cost: ~$15/year

**Files Changed**: 21 files, 25,530 lines added

---

## Cost Analysis

### One-Time Costs

- Initial API fetch: 76 venues × $0.056 = **$4.26**
- Manual research time: 2-3 hours (user)
- Manual photo curation: ~6 hours (user went above and beyond!)

### Ongoing Costs

- Photo refresh (90-day cache): 4×/year = **$11.20/year**
- New venues: ~5/year = **$0.20/year**
- **Total annual cost: ~$15/year** (within $200/month free tier)

---

## Notes for Next Session

1. **Start with Scene3Map.tsx** - This is the primary integration point
2. **Use existing concerts data** - Venue info already available in concert objects
3. **Test incrementally** - Add photo first, then badge, then styling
4. **Check mobile layout** - Popups should be responsive
5. **Verify lazy loading** - Photos should load on-demand (loading="lazy")

---

*Prepared: 2026-01-02*
*Ready for implementation*
