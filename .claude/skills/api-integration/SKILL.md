# API Integration Skill

**Purpose:** Reference this skill when working with external APIs (Ticketmaster, setlist.fm, Google Maps, Spotify, TheAudioDB).

**When to use:**
- Adding new API integrations
- Debugging API issues
- Understanding rate limits and caching
- Working with API credentials

---

## Quick Reference

### API Overview

| API | Purpose | Auth | Rate Limit | Cache TTL |
|-----|---------|------|------------|-----------|
| Ticketmaster | Tour dates | API key | 5/sec, 5000/day | 24 hours |
| setlist.fm | Concert setlists | API key | 1/sec | 24 hours |
| Google Maps | Geocoding | API key | 50/sec | Permanent |
| Google Places | Venue photos | API key | 50/sec | 90 days |
| Spotify | Artist metadata | OAuth | 3/sec | 90 days |
| TheAudioDB | Artist bios | None | 2/sec | 30 days |

### Environment Variables

```bash
# Ticketmaster (client-side)
VITE_TICKETMASTER_API_KEY=your_key

# setlist.fm (build-time + dev proxy)
VITE_SETLISTFM_API_KEY=your_key

# Google (build-time scripts)
GOOGLE_MAPS_API_KEY=your_key

# Spotify (build-time scripts)
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret

# Google Sheets (build-time)
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_REFRESH_TOKEN=your_token
```

---

## Ticketmaster API

**Purpose:** Real-time tour dates for artists

**Docs:** https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/

### Service Location

```
src/services/ticketmaster.ts
```

### Usage Pattern

```typescript
import { fetchTourDates } from '@/services/ticketmaster'

const result = await fetchTourDates('Depeche Mode')
// { events: TourEvent[], count: number, cached: boolean }
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `fetchTourDates(artistName)` | Main entry point, handles caching |
| `searchArtist(artistName)` | Find attraction ID from name |
| `clearTourDatesCache()` | Clear in-memory cache |
| `getTourDatesCacheStats()` | Debug cache state |

### Caching Strategy

- **In-memory cache** with 24-hour TTL
- Cache key: lowercase, trimmed artist name
- Caches empty results to avoid repeated lookups
- Falls back to stale cache on API error

### Error Handling

```typescript
// API returns empty array on:
// - Artist not found
// - No upcoming events
// - API key missing/invalid

// Throws on:
// - Network errors
// - Rate limit exceeded (429)
```

### Artist Name Fallback

The service tries variations:
1. Exact name: "The National"
2. Without "The": "National"

---

## setlist.fm API

**Purpose:** Historical concert setlists

**Docs:** https://api.setlist.fm/docs/1.0/index.html

### Service Location

```
src/services/setlistfm.ts           # Runtime client
scripts/prefetch-setlists.ts        # Build-time fetcher
```

### Three-Tier Caching

1. **Static cache** (build-time): `public/data/setlists-cache.json`
2. **Memory cache** (runtime): In-memory Map
3. **API fallback**: Live fetch (dev only)

### Usage Pattern

```typescript
import { fetchSetlist } from '@/services/setlistfm'

const setlist = await fetchSetlist({
  artistName: 'The Cure',
  date: '2023-05-15',
  venueName: 'Hollywood Bowl',
  city: 'Los Angeles',
  concertId: 'concert-42'  // For static cache lookup
})
```

### Fuzzy Matching

The service uses fuzzy matching for:
- Venue names (handles variations like "The Roxy" vs "Roxy Theatre")
- City names (maps "Hollywood" → "Los Angeles")
- Artist names (Levenshtein distance)

Match threshold: 0.5 (50% similarity required)

### Pre-fetching

```bash
# Incremental (uses cache)
npm run prefetch:setlists

# Force refresh all
npm run prefetch:setlists -- --force-refresh
```

### Cache File Format

```json
{
  "generatedAt": "2026-01-06T...",
  "totalConcerts": 178,
  "entries": [
    {
      "concertId": "concert-1",
      "artistName": "The Cure",
      "date": "2023-05-15",
      "setlist": { ... } | null
    }
  ]
}
```

---

## Google Maps Geocoding

**Purpose:** Convert venue addresses to coordinates

**Docs:** https://developers.google.com/maps/documentation/geocoding

### Service Location

```
scripts/services/geocoding.ts
```

### Usage Pattern

```typescript
import { getVenueCoordinates, loadCache, saveCache } from './services/geocoding'

loadCache()
const coords = await getVenueCoordinates('Hollywood Bowl', 'Los Angeles', 'California')
saveCache()
```

### Cache Strategy

- **Permanent cache**: `public/data/geocode-cache.json`
- Cache key: `{venue}|{city}|{state}` (lowercase)
- Never expires (venues don't move)

### Cost

- $5/1000 requests
- Free tier: $200/month = 40,000 requests
- Your usage: ~$0/month (cache handles repeat lookups)

---

## Google Places API

**Purpose:** Venue photos and metadata

**Docs:** https://developers.google.com/maps/documentation/places

### Service Location

```
scripts/enrich-venues.ts
```

### Usage

```bash
npm run enrich-venues
```

### Photo Quality

Photos are sorted by popularity/quality. The service:
1. Searches for venue by name + city
2. Gets Place ID
3. Fetches place details (photos, rating, website)
4. Generates photo URLs at multiple sizes (400px, 800px, 1200px)

### Cache Strategy

- Cache file: `public/data/venue-photos-cache.json`
- TTL: 90 days for active venues
- Legacy venues: No cache (use manual photos)

### Manual Photo Override

For historical/closed venues:
1. Place image in `/public/images/venues/{normalized-name}.jpg`
2. Re-run `npm run enrich-venues`
3. Script auto-detects and uses manual photo

---

## Spotify Web API

**Purpose:** Album art, top tracks, genre tags

**Docs:** https://developer.spotify.com/documentation/web-api

### Service Location

```
scripts/enrich-spotify-metadata.ts
```

### Authentication

Uses Client Credentials flow (no user auth needed):

```typescript
const auth = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: {
    'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'grant_type=client_credentials'
})
```

### Data Collected

| Field | Description |
|-------|-------------|
| `spotifyArtistId` | Artist ID |
| `spotifyArtistUrl` | Profile URL |
| `mostPopularAlbum` | Top album with cover art |
| `topTracks` | Top 3 tracks with preview URLs |
| `genres` | Spotify genre tags |
| `popularity` | Score 0-100 |

### Cache Strategy

- Stored in: `public/data/artists-metadata.json`
- TTL: 90 days
- Skips cached entries on re-run

---

## TheAudioDB

**Purpose:** Artist bios and photos (fallback for Spotify)

**Docs:** https://www.theaudiodb.com/api_guide.php

### Service Location

```
scripts/enrich-artists.ts
```

### Usage

```bash
npm run enrich
```

### Features

- **No API key required** (free tier)
- Rate limit: 2/sec
- Community-maintained database

### Data Collected

| Field | Description |
|-------|-------------|
| `name` | Artist name |
| `image` | Photo URL |
| `bio` | Biography (500 char max) |
| `genres` | Array of genres |
| `formed` | Formation year |
| `website` | Official site |

---

## Common Patterns

### Rate Limiting

```typescript
// Simple delay between requests
await new Promise(resolve => setTimeout(resolve, 350)) // ~3/sec
```

### Cache-First Pattern

```typescript
async function fetchWithCache(key: string): Promise<Data> {
  // Check cache
  const cached = cache.get(key)
  if (cached && !isExpired(cached)) {
    return cached.data
  }

  // Fetch fresh
  const fresh = await fetchFromAPI(key)

  // Update cache
  cache.set(key, { data: fresh, timestamp: Date.now() })

  return fresh
}
```

### Graceful Degradation

```typescript
try {
  const data = await fetchFromAPI()
  return data
} catch (error) {
  // Return stale cache if available
  if (staleCache) {
    console.warn('Using stale cache due to error')
    return staleCache
  }
  throw error
}
```

---

## Troubleshooting

### "API key missing"

Check `.env` file has the required variable:
```bash
cat .env | grep TICKETMASTER
```

### "Rate limit exceeded"

- Wait 1-5 minutes
- Check rate limit headers in response
- Increase delay between requests

### "No results found"

- Check artist name spelling
- Try variations (with/without "The")
- Search manually on the API's website

### "CORS error"

- Use Vite proxy in development (`/api/setlistfm`)
- Pre-fetch at build time for production
- Check `vite.config.ts` proxy configuration

---

## Source Files

| File | Purpose |
|------|---------|
| `src/services/ticketmaster.ts` | Ticketmaster client |
| `src/services/setlistfm.ts` | setlist.fm client |
| `scripts/services/geocoding.ts` | Geocoding service |
| `scripts/enrich-venues.ts` | Venue enrichment |
| `scripts/enrich-spotify-metadata.ts` | Spotify enrichment |
| `scripts/enrich-artists.ts` | TheAudioDB enrichment |
| `scripts/prefetch-setlists.ts` | Setlist pre-fetcher |
| `docs/api-setup.md` | Credential setup guide |

---

**Last Updated:** 2026-01-06
