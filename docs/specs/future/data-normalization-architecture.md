# Data Normalization Architecture

> **Status**: ✅ Mostly Complete (v3.0.1)
> **Remaining**: Spotify integration (blocked on API approval)
> **Priority**: Medium (Spotify work)
> **Last Updated**: 2026-01-07

---

## Overview

Concert data is normalized across three files to eliminate redundancy and enable richer metadata. Genre is treated as an **artist-level attribute**, not a concert-level field, and is enriched during the build pipeline.

**Core Principle**: Separate event facts (concerts) from entity metadata (artists, venues).

---

## Current State (v3.0.1)

### ✅ What's Implemented

**Artist Metadata** (`data/artist-metadata.json`):

- 247 artists with canonical genre data
- Enriched from TheAudioDB API
- Source can be `theaudiodb`, `manual`, or (future) `spotify`
- Build pipeline auto-enriches concerts with artist genres

**Venue Metadata** (`public/data/venues-metadata.json`):

- 77 venues with photos from Google Places API
- Location data, ratings, status (active/closed/demolished)
- Photo caching with 90-day expiry

**Concert Data** (`public/data/concerts.json`):

- Pure event facts: date, venue, artists
- Genre field populated from artist metadata during build
- Normalized fields for deep linking (hyphen-based)

**Build Pipeline** (`scripts/build-data.ts`):

- Fetches from Google Sheets (no genre column)
- Enriches with artist metadata (genre, images, bios)
- Enriches with venue metadata (photos, location)
- Generates final concerts.json

### ❌ What's Remaining

**Spotify Integration** (blocked):

- Spotify Developer Portal not accepting new projects
- When unblocked: Spotify becomes **PRIMARY** source
- TheAudioDB becomes fallback
- See: [spotify-artist-integration.md](./spotify-artist-integration.md)

---

## Data Flow

```
Google Sheets (concerts.csv)
  ├─ No genre column (removed by user)
  ├─ Pure attendance data: date, venue, artists
  └─ Fetch via: npm run fetch-sheet
         ↓
data/artist-metadata.json
  ├─ Canonical artist data with genres
  ├─ Source: TheAudioDB (current) | Spotify (future primary)
  └─ Enrich via: npm run enrich-artists
         ↓
Build Pipeline (npm run build-data)
  ├─ 1. Fetch concerts from Google Sheets
  ├─ 2. Enrich each concert with artist genre
  ├─ 3. Enrich with venue photos/location
  └─ 4. Output: public/data/concerts.json
         ↓
Frontend Runtime
  ├─ Loads concerts.json
  ├─ Loads artists-metadata.json
  ├─ Loads venues-metadata.json
  └─ Joins data as needed for scenes
```

---

## Architecture Rationale

### Why Normalize?

**Before normalization:**

- Genre duplicated across every concert for same artist
- Manual genre research per concert row
- Inconsistent genres for same artist
- Can't update artist data independently

**After normalization:**

- Genre stored once per artist (single source of truth)
- Auto-derived from music APIs (TheAudioDB, future Spotify)
- Consistent across all concerts
- Easy to update artist metadata without touching concert data

### Why Artist-Level Genre?

Genre is fundamentally an attribute of the **artist**, not the **concert event**. A Depeche Mode show in 1984 and 2017 are both "New Wave"—the genre doesn't change per event.

**Implementation:**
```typescript
// scripts/enrich-concert-genres.ts
for (const concert of concerts) {
  const artistGenre = await metadataManager.getGenre(concert.headliner)
  concert.genre = artistGenre
  concert.genreNormalized = normalize(artistGenre)
}
```

---

## Metadata Schemas

### Artist Metadata

```json
{
  "artists": [
    {
      "name": "Depeche Mode",
      "normalizedName": "depeche-mode",
      "genre": "New Wave",
      "genreNormalized": "new-wave",
      "source": "theaudiodb",
      "imageUrl": "https://r2.theaudiodb.com/...",
      "bio": "Depeche Mode are an English electronic...",
      "fetchedAt": "2026-01-06T..."
    }
  ]
}
```

**Future Spotify fields** (when API available):
```json
{
  "spotifyId": "762310PdDnwsDxAQxzQkfX",
  "spotifyGenres": ["synthpop", "new wave", "alternative dance"],
  "topTracks": [...],
  "albums": [...]
}
```

### Venue Metadata

```json
{
  "irvine-meadows": {
    "name": "Irvine Meadows",
    "normalizedName": "irvine-meadows",
    "city": "Irvine",
    "state": "California",
    "location": { "lat": 33.69, "lng": -117.77 },
    "status": "demolished",
    "places": {
      "placeId": "ChIJX...",
      "photos": [...]
    },
    "photoUrls": {
      "thumbnail": "https://places.googleapis.com/...",
      "medium": "https://places.googleapis.com/...",
      "large": "https://places.googleapis.com/..."
    },
    "fetchedAt": "2026-01-02T..."
  }
}
```

---

## Future Work

### Spotify as Primary Source

**Status**: Blocked on API access

When Spotify API becomes available:

1. Spotify becomes **primary** source for artist metadata
2. TheAudioDB becomes **fallback** for artists not on Spotify
3. Genre mapping from Spotify's granular genres to our broad categories
4. Album art and track previews for Artist Scene gatefold

**See detailed specs:**

- Feature spec: [spotify-artist-integration.md](./spotify-artist-integration.md)
- Operations runbook: [spotify-enrichment-runbook.md](./spotify-enrichment-runbook.md)

### Computed Artist Stats (Optional)

**Not yet specced**—would enable features like:

- Concert references in metadata (`concerts.headliner[]`, `concerts.opener[]`)
- Aggregate stats (`firstSeen`, `lastSeen`, `totalConcerts`, `uniqueVenues`)
- Fast artist timeline views
- "View all concerts by this artist" feature

If pursued, should be separate spec with use cases and implementation plan.

---

## Normalization Strategy

### Field Normalization

All normalized fields use **hyphen-based** convention (v1.9.0):

```typescript
// src/utils/normalize.ts
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '-')    // Special chars → hyphen
    .replace(/[\s_]+/g, '-')      // Spaces/underscores → hyphen
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '')      // Trim leading/trailing
}

// Examples:
normalize("Depeche Mode")           // "depeche-mode"
normalize("Irvine Meadows")         // "irvine-meadows"
normalize("R&B")                    // "r-b"
normalize("9:30 Club")              // "9-30-club"
```

### Deep Linking

Normalized fields enable clean URLs:

- Artist: `/?scene=artists&artist=depeche-mode`
- Venue (graph): `/?scene=venues&venue=irvine-meadows`
- Venue (map): `/?scene=geography&venue=9-30-club`

See: [docs/DEEP_LINKING.md](../DEEP_LINKING.md)

---

## Related Documentation

- [DATA_PIPELINE.md](../DATA_PIPELINE.md) - Full build pipeline documentation
- [ROADMAP.md](../ROADMAP.md) - Spotify integration prioritization
- [spotify-artist-integration.md](./spotify-artist-integration.md) - Spotify feature spec
- [spotify-enrichment-runbook.md](./spotify-enrichment-runbook.md) - Spotify operations

---

**Last updated**: 2026-01-07 (v3.1.0)
