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

### Artist Discography

Comprehensive album information from MusicBrainz.

**Location:** `public/data/discography.json`

**Key:** Normalized artist name (e.g., `"radiohead"`)

```typescript
interface ArtistDiscography {
  // Identity
  artistName: string;              // "Radiohead"
  normalizedName: string;          // "radiohead"
  mbid: string | null;             // MusicBrainz ID or null if not found

  // Cache metadata
  fetchedAt: string;               // ISO timestamp
  cachedAt: string;                // ISO timestamp
  albumCount: number;              // 9

  // Albums
  albums: Album[];
}

interface Album {
  // Identity
  id: string;                      // MusicBrainz release-group ID
  title: string;                   // "OK Computer"

  // Dates
  releaseDate: string;             // "1997-05-21" (full date if available)
  year: number;                    // 1997

  // Classification
  primaryType: string;             // "Album" | "EP" | "Single" | "Broadcast" | "Other"
  secondaryTypes: string[];        // ["Live"] | ["Compilation"] | ["Soundtrack"] | []
  disambiguation: string;          // "Japanese edition", "" (often empty)

  // Cover Art
  coverUrl: string;                // Cover Art Archive URL (500px)
  coverAvailable: boolean;         // true (assumed available, handle 404s in UI)
}
```

**Usage:**
```typescript
const artistKey = concert.headlinerNormalized; // "radiohead"
const discography = discographyData[artistKey];

if (discography?.albums) {
  // Filter to studio albums only
  const studioAlbums = discography.albums.filter(
    album => album.primaryType === "Album" && album.secondaryTypes.length === 0
  );

  // Filter out compilations and live albums
  const originalReleases = discography.albums.filter(
    album => !album.secondaryTypes.includes("Compilation")
          && !album.secondaryTypes.includes("Live")
  );
}
```

**Filtering Patterns:**

- Studio albums: `primaryType === "Album" && secondaryTypes.length === 0`
- Live albums: `secondaryTypes.includes("Live")`
- Compilations: `secondaryTypes.includes("Compilation")`
- EPs: `primaryType === "EP"`

**Cache TTL:** 90 days (albums rarely change)

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

### Album Eras (`album-eras.json`) ✨ v5.4

The join between the discography and 40 years of attendance — where an artist stood on a given night. Keyed by concert id and by artist key. Covers **openers as well as headliners** (238 artists); restricting it to headliners left 22.3% of song→album pairs unattributable.

`careerYear` is `null`, never negative, for a pre-debut show. The magnitude lives in `yearsBeforeDebut`. Treating a missing `careerYear` as 0 is how v5.4 shipped a post calling a pre-debut show "four years into their existence".

### Song → Album Attribution (`song-albums.json`) ✨ v6.0

Which studio album a live-performed song came off. 1,716 of 1,912 unique artist+song pairs (89.7%), across three tiers: `artists-top-tracks` (253), MusicBrainz (1,428), iTunes (35).

```json
{
  "version": "1.0.0",
  "songs": {
    "depeche-mode::just-cant-get-enough": {
      "songTitle": "Just Can't Get Enough",
      "albumTitle": "Speak & Spell",
      "mbid": "7a0e0366-...",
      "releaseDate": "1981-10-05",
      "coverAvailable": true,
      "matchTier": 0,
      "isCover": false,
      "originalArtistKey": null
    }
  }
}
```

**Reading it — three things that will bite:**

1. **Never hand-build the key.** It is `artistKey::foldedSongTitle`, where the fold strips version qualifiers, unicode punctuation and `&`→`and`. Use `songAlbumKey()` from `scripts/utils/song-title.ts`, or `lookupSongAlbum()` from `scripts/utils/song-album-lookup.ts` if you are starting from a billing name. A caller that folds differently matches **nothing**, and looks exactly like a caller that correctly found nothing.

2. **The artist key is not always the marquee slug.** `omd` is filed as `orchestral-manoeuvres-in-the-dark`; `Echo & The Bunnymen` as `echo-the-bunnymen`. `lookupSongAlbum()` handles all three resolution routes. Skipping the `discographyKeys` hop fails silently.

3. **`releaseDate` precision varies.** 1,462 full dates, 145 `YYYY-MM`, 109 bare `YYYY`. Any gap measured against it must clear the width of the date's own uncertainty — see `road-tested`'s precision rule.

**Fields deliberately NOT stored — do not re-add them.** Every one is derivable, and storing derivable data is what pushed Window 1 to 669 KB against a 400 KB budget:

| Absent field | Derive it with | Why it is not stored |
| --- | --- | --- |
| `coverUrl` | `coverArtUrl(mbid)`, exported from `derive-album-eras.ts` — **only when `coverAvailable` is true**, the archive 404s otherwise | A pure function of the MBID, verified across all 11,382 covers with zero exceptions. Carrying it cost v5.4 **284 KB**, more than this file's entire budget. |
| `albumSlug` | `normalizeAlbumName(title)` from `src/utils/normalize.ts` | Pure function of the title. Kept only in `album-eras.json`'s `erasSeen`, where it earns its place as a stable grouping key. |
| `artistKey` as a field | it is the key prefix — `artistKey::foldedSongTitle` | Already present in every key. A second copy is a second thing to keep in sync. |

`originalArtistKey` **is** stored, and is not an exception to the rule: it is the *original* act for a cover, which cannot be derived from the performing artist.

**What it does NOT say:** the album is the *earliest studio album carrying the song*, which is not always where the song first appeared. A standalone single that later reached an album attributes to that album. This file supports claims about the **album**, never about when the song came into existence.

## Relationships## Relationships

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
2. **Update `scripts/archive/convert-csv-to-json.ts`** — Add field mapping
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
- `scripts/archive/convert-csv-to-json.ts` — Data generation
- `scripts/services/` — API integration services
- `src/types/` — TypeScript interfaces

---

**Last Updated:** 2026-01-06
