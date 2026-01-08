# Data Schema Skill

**Purpose:** Reference this skill when working with concert data, querying entities, or modifying data structures in Morperhaus Concerts.

**When to use:**
- Querying or filtering concerts
- Working with artist metadata
- Handling venue data
- Understanding entity relationships
- Adding new data fields

---

## Core Entities

### Concert

The primary data unit. Each concert is a single show attended.

**Location:** `public/data/concerts.json` → `concerts[]`

```typescript
interface Concert {
  // Identity
  id: string;                    // "concert-1", "concert-2", etc.
  
  // Date fields
  date: string;                  // ISO date: "1984-04-27"
  year: number;                  // 1984
  month: number;                 // 4
  day: number;                   // 27
  dayOfWeek: string;             // "Friday"
  decade: string;                // "1980s"
  
  // Artist fields
  headliner: string;             // "Adam Ant"
  headlinerNormalized: string;   // "adam-ant"
  openers: string[];             // ["The Reflex", "Berlin"]
  
  // Genre
  genre: string;                 // "New Wave"
  genreNormalized: string;       // "new-wave"
  
  // Venue fields
  venue: string;                 // "Irvine Meadows"
  venueNormalized: string;       // "irvine-meadows"
  city: string;                  // "Irvine"
  state: string;                 // "California"
  cityState: string;             // "Irvine, California"
  
  // Location
  location: {
    lat: number;                 // 33.6577553
    lng: number;                 // -117.7293939
  };
  
  // Reference
  reference: string;             // URL to concert archives or empty
}
```

**Normalization pattern:** Hyphenated lowercase
- "Echo and the Bunnymen" → `"echo-and-the-bunnymen"`
- "R.E.M." → `"rem"` (periods removed)
- "AC/DC" → `"ac-dc"` (slash to hyphen)

---

### Artist Metadata

Enriched artist information from TheAudioDB (or mock data).

**Location:** `public/data/artists-metadata.json`

**Key:** Normalized artist name (e.g., `"adam-ant"`)

```typescript
// Full entry (from TheAudioDB)
interface ArtistMetadata {
  name: string;                  // "Adam Ant"
  image: string;                 // URL to artist image
  bio: string;                   // Artist biography
  genres: string[];              // ["Punk Rock", "Rock/Pop"]
  formed: string | null;         // "1977" or null
  website: string;               // "www.adam-ant.net"
  source: "theaudiodb";
  fetchedAt: string;             // ISO timestamp
}

// Mock entry (not yet enriched)
interface ArtistMetadataMock {
  name: string;
  normalizedName: string;
  fetchedAt: string;
  dataSource: "mock";
}
```

**Usage:**
```typescript
const artistKey = concert.headlinerNormalized; // "adam-ant"
const metadata = artistsMetadata[artistKey];
if (metadata?.image) {
  // Has real data
}
```

---

### Venue Metadata

Aggregated venue information with concert history.

**Location:** `public/data/venues-metadata.json`

**Key:** Normalized venue name (e.g., `"irvine-meadows"`)

```typescript
interface VenueMetadata {
  name: string;                  // "Irvine Meadows"
  normalizedName: string;        // "irvine-meadows"
  city: string;                  // "Irvine"
  state: string;                 // "California"
  cityState: string;             // "Irvine, California"
  location: {
    lat: number;
    lng: number;
  };
  concerts: {                    // All concerts at this venue
    id: string;
    date: string;
    headliner: string;
  }[];
}
```

---

## Cache Files

### Geocode Cache

Stores Google Maps Geocoding API results to avoid repeated calls.

**Location:** `public/data/geocode-cache.json`

**Key format:** `"{venue}|{city}|{state}"` (lowercase, pipe-separated)

```typescript
interface GeocodeEntry {
  lat: number;
  lng: number;
  formattedAddress: string;
  geocodedAt: string;            // ISO timestamp
}
```

**Example key:** `"irvine meadows|irvine|california"`

---

### Venue Photos Cache

Stores Google Places venue photos.

**Location:** `public/data/venue-photos-cache.json`

---

### Setlists Cache

Stores setlist.fm API results.

**Location:** `public/data/setlists-cache.json`

---

## Relationships

```
                    ┌─────────────────┐
                    │    Concert      │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
  │   Artist      │  │    Venue      │  │    Genre      │
  │  (headliner)  │  │               │  │               │
  └───────────────┘  └───────────────┘  └───────────────┘
          │                  │
          │                  │
          ▼                  ▼
  ┌───────────────┐  ┌───────────────┐
  │ Artist        │  │ Geocode       │
  │ Metadata      │  │ Cache         │
  └───────────────┘  └───────────────┘
```

**Join patterns:**

```typescript
// Concert → Artist Metadata
const artistMeta = artistsMetadata[concert.headlinerNormalized];

// Concert → Venue Metadata
const venueMeta = venuesMetadata[concert.venueNormalized];

// Venue → All Concerts
const venueConcerts = venuesMetadata[venueKey].concerts;

// Genre → All Concerts
const genreConcerts = concerts.filter(c => c.genreNormalized === 'new-wave');
```

---

## Common Queries

### Get all concerts for an artist
```typescript
const artistConcerts = concerts.filter(
  c => c.headlinerNormalized === 'depeche-mode' ||
       c.openers.some(o => normalize(o) === 'depeche-mode')
);
```

### Get all concerts at a venue
```typescript
const venueConcerts = concerts.filter(
  c => c.venueNormalized === 'hollywood-bowl'
);
```

### Get concerts by decade
```typescript
const eightiesConcerts = concerts.filter(c => c.decade === '1980s');
```

### Get concerts by genre
```typescript
const newWaveConcerts = concerts.filter(
  c => c.genreNormalized === 'new-wave'
);
```

### Get unique artists
```typescript
const headliners = [...new Set(concerts.map(c => c.headliner))];
const allArtists = [...new Set([
  ...concerts.map(c => c.headliner),
  ...concerts.flatMap(c => c.openers)
])];
```

### Get unique venues
```typescript
const venues = [...new Set(concerts.map(c => c.venue))];
```

---

## Normalization Rules

**Standard normalization (all entities):**
1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove special characters except hyphens
4. Collapse multiple hyphens

```typescript
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/-+/g, '-')           // Collapse hyphens
    .replace(/^-|-$/g, '');        // Trim hyphens
}
```

**Examples:**
| Original | Normalized |
|----------|------------|
| Adam Ant | `adam-ant` |
| R.E.M. | `rem` |
| Echo and the Bunnymen | `echo-and-the-bunnymen` |
| AC/DC | `ac-dc` |
| Guns N' Roses | `guns-n-roses` |
| 9:30 Club | `930-club` |

---

## Data Stats (Current)

| Metric | Count |
|--------|-------|
| Concerts | 178 |
| Headliners | 104 |
| Total Artists | 247 |
| Venues | 77 |
| Year Range | 1984-2026 |
| Genres | 20 |

---

## File Locations

```
public/data/
├── concerts.json           # Core concert data
├── artists-metadata.json   # Artist enrichment
├── venues-metadata.json    # Venue aggregations
├── geocode-cache.json      # Geocoding cache
├── venue-photos-cache.json # Venue photos
└── setlists-cache.json     # Setlist data
```

---

## Adding New Fields

When adding fields to concerts:

1. **Update source data** (Google Sheet or input)
2. **Update `scripts/convert-csv-to-json.ts`** — Add field mapping
3. **Update TypeScript types** — `src/types/concert.ts`
4. **Update this skill** — Document new field
5. **Regenerate data** — `npm run build-data`

**Normalized field convention:**
- If field has display value, add `{field}Normalized` version
- Example: `venue` + `venueNormalized`

---

## Deep Link Parameters

URL parameters use normalized values:

```
/?scene=artists&artist=depeche-mode
/?scene=geography&venue=hollywood-bowl
/?scene=genres&genre=new-wave
```

**Lookup pattern:**
```typescript
// From URL param to display value
const venue = Object.values(venuesMetadata)
  .find(v => v.normalizedName === urlParam)?.name;
```

---

## Source Files

- `public/data/concerts.json` — Primary data
- `scripts/convert-csv-to-json.ts` — Data generation
- `scripts/services/` — API integration services
- `src/types/` — TypeScript interfaces

---

**Last Updated:** 2026-01-06
