# Concert Data Pipeline Documentation

> **Status:** Phase 1 Core + Enhancements Implemented (v1.2.4 - Flexible Columns)
> **Last Updated:** 2026-01-02
> **Related Spec:** [google-sheets-data-integration.md](specs/future/google-sheets-data-integration.md)

---

## Overview

This document describes the data pipeline for fetching, validating, and enriching concert data from Google Sheets.

---

## Available Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run fetch-sheet` | Fetch data from Google Sheets only | Quick data refresh without enrichment |
| `npm run fetch-sheet -- --dry-run` | Preview fetch without writing files | Test before applying changes |
| `npm run validate-data` | Validate concert data quality | After fetching, before committing |
| `npm run diff-data` | Compare data changes | See what changed since last backup |
| `npm run enrich` | Enrich artist metadata from TheAudioDB | Standalone artist enrichment |
| `npm run export-venues` | Export unique venues to CSV for classification | Manual venue status research |
| `npm run enrich-venues` | Enrich venue metadata with photos from Google Places API | Venue photo enrichment |
| `npm run build-data` | Run full pipeline (fetch + validate + enrich) | Complete data refresh |
| `npm run build-data -- --dry-run` | Preview pipeline without writing files | Test full pipeline safely |
| `npm run build-data -- --skip-validation` | Skip validation step | Faster builds when data is trusted |

---

## Quick Start

### First Time Setup

1. **Prepare your concert data:**
   - Create a Google Sheet with your concert data
   - See [../data/README.md](../data/README.md) for required format and column specifications
   - Use [../data/example-concert-data.csv](../data/example-concert-data.csv) as a template

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your Google Sheets API credentials
   ```

3. **Preview what will be fetched (safe, no writes):**
   ```bash
   npm run fetch-sheet -- --dry-run
   ```

4. **Fetch concert data (automatic backup created):**
   ```bash
   npm run fetch-sheet
   ```

5. **Validate data quality:**
   ```bash
   npm run validate-data
   ```

6. **Build the site:**
   ```bash
   npm run build
   ```

### Regular Workflow (Adding New Concerts)

1. **Update Google Sheet** with new concert data

2. **Preview changes (optional, safe):**
   ```bash
   npm run build-data -- --dry-run
   ```

3. **Fetch and validate (automatic backup created):**
   ```bash
   npm run build-data
   ```

4. **Review changes:**
   ```bash
   npm run diff-data
   ```

5. **Commit changes:**
   ```bash
   git add public/data/concerts.json
   git commit -m "data: Add concerts for [date/event]"
   git push
   ```

**Note**: As of v1.2.1, automatic backups are created before any file writes. Manual backups are optional but still recommended for peace of mind.

---

## Safety Features (v1.2.1+)

### Automatic Backups

All data pipeline scripts automatically create timestamped backups before modifying files:

**Files Protected:**
- `public/data/concerts.json` → `concerts.json.backup.YYYY-MM-DDTHH-MM-SS`
- `public/data/artists-metadata.json` → `artists-metadata.json.backup.YYYY-MM-DDTHH-MM-SS`

**Features:**
- ✅ Automatic creation before every write
- ✅ Timestamped for history tracking
- ✅ Keeps last 10 backups (configurable)
- ✅ Auto-cleanup of old backups
- ✅ No manual intervention required

**Example Output:**
```
📦 Creating backups...
✅ Created 1 backup(s)
   concerts.json → concerts.json.backup.2026-01-01T14-30-45
```

### Dry-Run Mode

Preview what changes will be made **without writing any files**:

```bash
# Preview fetch only
npm run fetch-sheet -- --dry-run

# Preview full pipeline
npm run build-data -- --dry-run
```

**What It Does:**
- Fetches data from Google Sheets
- Processes and validates all data
- Shows summary statistics
- **Does NOT write any files**
- **Does NOT create backups**

**Use Cases:**
- Test pipeline before applying changes
- Verify Google Sheets data is valid
- Check what will change without risk
- Learn how the pipeline works safely

---

## Pipeline Components

### 1. Data Fetching (`fetch-google-sheet.ts`)

**What it does:**
- Connects to Google Sheets via OAuth 2.0
- Validates required environment variables
- Fetches concert rows from specified range
- **[NEW]** Validates rows (skips invalid dates, missing headliners)
- Processes dates, venues, cities, openers
- Geocodes venue locations (cache-first)
- Generates metadata (stats, date ranges)
- Writes to `public/data/concerts.json`

**Output:**
```
============================================================
📊 FETCH SUMMARY
============================================================

✅ Successfully processed: 174 concerts
   📅 Date range: 1984-04-27 to 2026-09-16

📈 Statistics:
   - 240 unique artists
   - 76 unique venues
   - 34 unique cities

💾 Output file: /path/to/concerts.json
```

**Row Validation:**
- ❌ **Skips** rows with invalid dates (not parseable)
- ❌ **Skips** rows with missing headliners
- ⚠️ **Warns** about missing venues (but keeps row)

### 2. Data Validation (`validate-concerts.ts`)

**What it does:**
- Loads `concerts.json`
- Checks for data quality issues
- Reports errors and warnings
- Exits with code 1 if errors found

**Validation Checks:**

| Check | Type | Action |
|-------|------|--------|
| Missing required fields (date, headliner) | Error | Blocks deployment |
| Invalid date format | Error | Blocks deployment |
| Duplicate concerts (same date + headliner) | Error | Blocks deployment |
| Orphaned openers (openers without headliner) | Error | Blocks deployment |
| Missing venue or city | Warning | Review recommended |
| Unusual dates (before 1950 or > 2 years future) | Warning | Verify not a typo |
| Default coordinates (0, 0) | Warning | Geocoding failed |
| Excessive openers (>10) | Warning | Possible data entry error |

**Example Output:**
```
============================================================
VALIDATION RESULTS
============================================================

⚠️  2 WARNING(S) FOUND:

   Row 56 [openers]: 14 openers for "The Cure" - verify not a data entry error
   Row 126 [openers]: 14 openers for "Social Distortion" - verify not a data entry error

============================================================
SUMMARY
============================================================
Total concerts: 174
Errors: 0
Warnings: 2

✅ Validation passed with warnings.
   Review warnings above and update data if needed.
```

### 3. Data Diff Report (`diff-concerts.ts`)

**What it does:**
- Compares current `concerts.json` with backup
- Shows added, removed, and modified concerts
- Helps review changes before committing

**Usage:**
```bash
# 1. Create backup before fetching
cp public/data/concerts.json public/data/concerts.json.backup

# 2. Fetch new data
npm run fetch-sheet

# 3. Compare changes
npm run diff-data
```

**Example Output:**
```
============================================================
DIFF RESULTS
============================================================

📈 ADDED: 3 concert(s)

   • 2024-03-15: The Strokes @ The Wiltern
     w/ The Voidz
   • 2024-04-20: IDLES @ Shrine Expo Hall
   • 2024-05-10: boygenius @ Greek Theatre
     w/ Torres, Lucy Dacus

📝 MODIFIED: 1 concert(s)

   • 2023-11-05: Social Distortion
     - venue: "The Roxy" → "House of Blues"
     - openers: 2 → 4

============================================================
SUMMARY
============================================================
Total changes: +3 -0 ~1

Old total: 171 concerts
New total: 174 concerts
Net change: +3
```

### 4. Artist Enrichment (`enrich-artists.ts`)

**What it does:**

- Enriches concert data with artist metadata from TheAudioDB
- Fetches artist photos, biographies, genres, and other metadata
- Caches results to avoid redundant API calls
- Rate-limited to respect API constraints

#### Data Source: TheAudioDB

- Free music metadata API (no API key required for basic tier)
- Community-maintained artist database
- API docs: <https://www.theaudiodb.com/api_guide.php>
- Rate limit: 2 calls per second (automatically enforced)

#### Metadata Fields Collected

| Field       | Description                | Example                             |
|-------------|----------------------------|-------------------------------------|
| `name`      | Artist name (normalized)   | "Depeche Mode"                      |
| `image`     | Artist photo or logo URL   | `https://theaudiodb.com/images/...` |
| `bio`       | Biography (500 char max)   | "Depeche Mode are an English..."    |
| `genres`    | Array of genres/styles     | ["Synthpop", "New Wave"]            |
| `formed`    | Formation year             | "1980"                              |
| `website`   | Official website URL       | `https://depechemode.com`           |
| `source`    | Data source identifier     | "theaudiodb"                        |
| `fetchedAt` | ISO timestamp              | "2026-01-02T03:37:26.000Z"          |

#### Caching Strategy

- Metadata is cached for 30 days
- Skips artists with recent data (< 30 days old)
- Re-fetches stale data automatically

#### Example Output

```
🎤 Enriching concert data with artist metadata...

Found 101 unique artists to enrich

Loaded 2 existing artist records

Fetching metadata for: Depeche Mode
  ✅ Found on TheAudioDB
Fetching metadata for: The Cure
  ✅ Found on TheAudioDB
Fetching metadata for: The Go Go's
  ⚠️  No metadata found

📦 Backup created: artists-metadata.json.backup.2026-01-02T03-37-26

📊 Enrichment Summary:
   ✅ Enriched: 87
   ⏭️  Skipped (cached): 0
   ❌ Failed: 14

💾 Saved metadata to: public/data/artists-metadata.json

🎉 Done!
```

#### Why Some Artists Fail

- Artist not in TheAudioDB database
- Spelling variations (e.g., "The Go Go's" vs "The Go-Go's")
- Typos in artist names
- Lesser-known or local artists

#### Current Usage

- Metadata is collected but **not actively displayed** in v1.2.1
- Data is prepared for future features:
  - Artist Scene enhancements
  - Timeline Artist Display modals (v1.3.0+)
  - Spotify Artist Integration (v1.3.0+)

#### Running Enrichment

```bash
# Standalone enrichment
npm run enrich

# Or as part of full pipeline
npm run build-data
```

### 5. Venue Enrichment (`export-venues.ts`, `enrich-venues.ts`)

**What it does:**

- Enriches concert data with venue photos and metadata from Google Places API
- Handles both active and legacy (closed/demolished) venues
- Supports manual photo curation for historical venues
- Caches results to minimize API costs

#### Data Source: Google Places API

- Google Cloud Places API (New)
- Requires API key (same key used for Geocoding API)
- API docs: <https://developers.google.com/maps/documentation/places/web-service/overview>
- Rate limit: 50 requests/second (automatically enforced)

#### Photo Quality and Sources

**Where photos come from:**

- **Google Maps user contributions** - Photos uploaded by visitors (most common source)
- **Business owners** - Verified venue owners can upload official photos
- **Google Street View** - Exterior shots from Google's mapping data
- **Professional photographers** - Some venues have curated collections

**Photo selection:**

- The API returns photos sorted by **popularity and quality** (Google's algorithm)
- We use the **first photo** returned, which is typically the highest-rated
- Photos include full attribution metadata (`authorAttributions`) showing photographer name and profile
- Most photos are **high resolution** (3000-4800px wide) suitable for hero images
- Photo URLs are generated on-demand from Google's CDN (not stored locally)

**Quality considerations:**

- **Major venues** (Hollywood Bowl, Staples Center) typically have professional-quality photos
- **Smaller clubs** may have casual user-submitted photos with varying quality
- **Historical venues** won't have current photos, so manual curation is recommended
- You can **override any venue** with manual photos if the API result isn't suitable

**Manual override workflow:**

1. Review auto-fetched photos in your app
2. For venues needing better images, place curated photos in `/public/images/venues/{normalized-name}.jpg`
3. Re-run `npm run enrich-venues` to detect and use manual photos
4. Manual photos take precedence over API photos

**Fallback image hierarchy:**

The enrichment script automatically applies fallback images when photos aren't available:

1. **Active venue with API photos** → Use Google Places photo
2. **Active venue without API photos** → Use `/images/venues/fallback-active.jpg` (generic venue image)
3. **Active venue with API error** → Use `/images/venues/fallback-active.jpg`
4. **Legacy venue with manual photo** → Use manual photo
5. **Legacy venue without manual photo** → Use `/images/venues/fallback.jpg` (closed door image)

**Required fallback images:**

- `/public/images/venues/fallback-active.jpg` - Generic venue/concert hall image (for active venues)
- `/public/images/venues/fallback.jpg` - "Closed" door image (for legacy venues) ✓ Already created

Create `fallback-active.jpg` with a generic, professional image like:

- Empty concert stage with lighting
- Modern amphitheater exterior
- Abstract music/venue artwork
- Silhouette of crowd at concert

#### Metadata Fields Collected

| Field                | Description                     | Example                          |
| -------------------- | ------------------------------- | -------------------------------- |
| `name`               | Venue name                      | "Hollywood Bowl"                 |
| `normalizedName`     | Key for lookups                 | "hollywoodbowl"                  |
| `location`           | Coordinates (lat/lng)           | `{lat: 34.1128, lng: -118.3389}` |
| `status`             | Active/closed/demolished        | "active"                         |
| `places.placeId`     | Google Place ID                 | "ChIJQ7Kcwsorw4ARjLA4Dpgg-IU"    |
| `places.photos`      | Photo references                | Array of photo objects           |
| `places.rating`      | User rating (0-5)               | 4.7                              |
| `places.websiteUri`  | Official website                | `https://hollywoodbowl.com`      |
| `photoUrls`          | Generated photo URLs            | thumbnail/medium/large           |
| `concerts`           | Array of concerts at venue      | `[{id, date, headliner}]`        |
| `stats`              | Venue statistics                | totalConcerts, uniqueArtists     |
| `photoCacheExpiry`   | Cache expiration (90 days)      | ISO timestamp                    |

#### Workflow: Venue Photo Integration

**Step 1: Export Venues for Classification**

```bash
npm run export-venues
```

This creates `data/venues-to-classify.csv` with all unique venues:

```csv
venue,city,state,status,closed_date,notes
Irvine Meadows,Irvine,California,,,
Hollywood Bowl,Los Angeles,California,,,
```

**Step 2: Manual Research (Between Sessions)**

Research each venue's current status:
- **Active**: Still operating (will fetch from Google Places API)
- **Closed**: No longer operating but building may still exist
- **Demolished**: Building no longer exists
- **Renamed**: Operating under a different name

Save research results as `data/venue-status.csv`:
- Copy [data/example-venue-status.csv](../data/example-venue-status.csv) to `data/venue-status.csv`
- Edit with your venue classifications
- See [data/README.md](../data/README.md) for column specifications

```csv
venue,city,state,status,closed_date,notes
Irvine Meadows,Irvine,California,demolished,2016-09-25,Demolished for residential development
Hollywood Bowl,Los Angeles,California,active,,Still operating
```

**Note:** The `venue-status.csv` file is optional. If missing, all venues default to "active" status.

**Step 3: Run Venue Enrichment**

```bash
npm run enrich-venues
```

This script:
1. Loads `concerts.json` and `venue-status.csv`
2. For **active** venues:
   - Fetches Place ID from Google Places Text Search API
   - Fetches place details (photos, rating, website)
   - Generates photo URLs (thumbnail: 400px, medium: 800px, large: 1200px)
   - Sets 90-day cache expiry
3. For **legacy** venues (closed/demolished):
   - Sets `places = null`
   - Checks for manual photos in `/public/images/venues/`
   - Sets `photoCacheExpiry = null` (manual photos don't expire)
4. Saves output to `public/data/venues-metadata.json`

#### Caching Strategy

**Cache file:** `public/data/venue-photos-cache.json`

- **Active venues**: Cached for 90 days
- **Legacy venues**: Cached indefinitely (no need to re-check Places API)
- **Failed lookups**: Cached to avoid repeated failures
- **Force refresh**: `npm run enrich-venues -- --force` (not yet implemented)

#### Manual Photo Curation

For legacy venues without Google Places data:

1. **Find historical photos:**
   - Wikipedia Commons
   - Internet Archive
   - Local newspaper archives
   - Concert posters/flyers (fair use)

2. **Photo requirements:**
   - Minimum 800px wide (1200px+ recommended)
   - JPEG format (optimized for web)
   - Attribution/source documented

3. **Save photos:**
   - Directory: `/public/images/venues/`
   - Naming: `{normalizedName}-{number}.jpg`
   - Example: `irvine-meadows-1.jpg`

4. **Re-run enrichment:**
   ```bash
   npm run enrich-venues
   ```
   The script will automatically detect and include manual photos.

#### Cost Analysis

- **Pricing**:
  - Text Search: $32.00 per 1,000 requests
  - Place Details: $17.00 per 1,000 requests
  - Place Photos: $7.00 per 1,000 requests
- **Free Tier**: $200/month credit
- **Your Usage**:
  - Initial run: ~50 active venues × ($0.032 + $0.017 + $0.007) = **$2.80**
  - Photo refresh (90-day cache): 50 venues × 4/year = **$11.20/year**
  - New venues: ~2-5/year = **$0.20/year**
  - **Annual estimate: ~$15/year**

**Expected cost: $0.00** - All usage stays well within the $200/month free tier.

#### Example Output

```
=== Venue Enrichment Script ===

Loading data files...
✓ Loaded 42 venue statuses from ../data/venue-status.csv
Found 174 concerts

Found 77 unique venues

Processing: Irvine Meadows (Irvine, California)
  Status: demolished
  Checking for manual photos...
  ✓ Found 1 manual photo(s)

Processing: Hollywood Bowl (Los Angeles, California)
  Status: active
  Fetching from Google Places API...
  ✓ Found 3 photo(s)

=== Enrichment Complete ===
✓ Enriched 77 venues
  - 48 active venues
  - 29 legacy venues
  - 62 venues with photos

Output: public/data/venues-metadata.json
Cache: public/data/venue-photos-cache.json
```

#### Current Usage

- Metadata is collected but **not actively displayed** in v1.3.2
- Data is prepared for future features:
  - Geography Scene map popups (v1.3.2+)
  - Venue Network detail modals (v1.4.0+)
  - Venue filtering and search (v1.4.0+)

### 6. Setlist Pre-fetch (`prefetch-setlists.ts`)

**What it does:**
- Pre-fetches setlists from setlist.fm API at build time
- Creates static cache file for instant runtime loading
- Uses intelligent fuzzy matching for venue/location variations
- Supports incremental updates (reuses existing cache)
- Handles force refresh to update existing setlists

**Data Source**: setlist.fm API
- Free API with rate limiting (~1 request per second)
- Community-maintained setlist database
- API docs: https://api.setlist.fm/docs/1.0/index.html

**Features**:
- Three-tier caching: Static cache → Memory cache → API fallback
- Automatic backups before cache updates
- Fuzzy matching handles venue name variations
- Graceful degradation for missing setlists

**Example Output**:
```
🎵 Pre-fetching setlists for all concerts...

📊 Found 174 concerts to process

📦 Found existing cache with 174 entries
   Cache generated: 2026-01-03T23:29:47.333Z

[1/174] ✓ Social Distortion - House of Blues (cached)
[2/174] 🔍 The Cure - Hollywood Bowl...
[2/174] ✅ Found setlist with 24 songs
[3/174] ⚪ No setlist found

============================================================
✨ Pre-fetch complete!
============================================================
📊 Total concerts: 174
📦 Used cached: 145
🔍 Fetched new: 27
⚪ Not found: 2
❌ Errors: 0

💾 Cache saved to: public/data/setlists-cache.json
📦 Cache size: 502.18 KB
```

**Usage**:
```bash
# Incremental update (reuses cache)
npm run prefetch:setlists

# Force refresh (re-fetch everything)
npm run prefetch:setlists -- --force-refresh
```

**Current Usage**:
- Powers Liner Notes panel in Artist Scene gatefold
- Eliminates CORS issues in production
- Reduces API quota usage by 99%
- Instant loading for cached setlists

---

### 7. Spotify Enrichment (`enrich-spotify-metadata.ts`)

**What it does:**
- Enriches artist metadata with Spotify data
- Fetches album covers, top tracks, preview URLs
- Handles ambiguous artist matches with manual overrides
- Caches results for 90 days

**Data Source**: Spotify Web API
- Requires Client Credentials (see docs/api-setup.md)
- Rate limit: ~3 requests/second
- Free tier: Unlimited API calls

**Metadata Fields Collected**:

| Field | Description | Example |
|-------|-------------|---------|
| `spotifyArtistId` | Spotify artist ID | "1w5Kfo2jwwIPruYS2UWh56" |
| `spotifyArtistUrl` | Artist profile URL | "https://open.spotify.com/artist/..." |
| `mostPopularAlbum` | Top album with cover art | {...} |
| `topTracks` | Top 3 tracks with previews | [{...}, {...}, {...}] |
| `genres` | Spotify genre tags | ["punk rock", "ska punk"] |
| `popularity` | Popularity score (0-100) | 68 |

**Example Output**:
```
🎵 Enriching artist metadata with Spotify data...

🔑 Authenticating with Spotify...
✅ Authenticated

Processing 174 artists...

Fetching: Social Distortion
  ✅ Enriched (album: Social Distortion)

Fetching: Boston
  ⚠️  Review match: "Boston" → "Boston Playlist" (popularity: 15)
  ✅ Enriched (album: Boston)

📊 Enrichment Summary:
   ✅ Enriched: 145
   ⏭️  Skipped (cached): 25
   ❌ Failed: 4

💾 Saved to: public/data/artists-metadata.json

🎉 Done!
```

**Usage**:
```bash
# Enrich with Spotify data
npm run enrich-spotify
```

See [docs/specs/future/runbook-global-spotify-enrichment.md](specs/future/runbook-global-spotify-enrichment.md) for detailed setup instructions.

---

### 8. Discography Enrichment (`enrich-discography.ts`)

**What it does:**
- Fetches comprehensive discography data from MusicBrainz
- Collects albums, release dates, cover art URLs, and album types
- Caches results for 90 days
- Skips mock data artists (no metadata yet)

**Data Source**: MusicBrainz API + Cover Art Archive
- No authentication required (free, open data)
- Rate limit: 1 request/second (strictly enforced)
- Data License: CC0 (public domain)

**Metadata Fields Collected**:

| Field | Description | Example |
|-------|-------------|---------|
| `artistName` | Display name | "Radiohead" |
| `normalizedName` | Cache key | "radiohead" |
| `mbid` | MusicBrainz ID | "a74b1b7f-71a5-4011..." |
| `albumCount` | Number of albums | 12 |
| `albums[]` | Album details array | [...] |
| `albums[].title` | Album name | "OK Computer" |
| `albums[].releaseDate` | Full date | "1997-05-21" |
| `albums[].year` | Release year | 1997 |
| `albums[].primaryType` | Album type | "Album" \| "EP" \| "Single" |
| `albums[].secondaryTypes` | Modifiers | ["Live"] \| ["Compilation"] |
| `albums[].coverUrl` | Cover art URL (500px) | "https://coverartarchive.org/..." |
| `albums[].coverAvailable` | Has cover art | true |

**Example Output**:
```
🎵 Enriching artist discographies from MusicBrainz...

Found 247 unique artists
Loaded 102 existing discography records

Fetching: Radiohead
  ✅ Found MBID: a74b1b7f-71a5-4011-9441-d0b5e4122711
  ✅ Found 9 albums
  ✅ 9/9 albums have cover art

Fetching: Depeche Mode
  ✅ Found MBID: 8538e728-ca0b-4321-b7e5-cff6565dd4c0
  ✅ Found 14 albums
  ✅ 14/14 albums have cover art

Fetching: Local Band Name
  ⚠️  Not found in MusicBrainz

📦 Backup created: discography.json.backup.2026-01-14T10-30-00

📊 Enrichment Summary:
   ✅ Enriched: 200
   ⏭️  Skipped (cached): 45
   ❌ Failed: 2

💾 Saved to: public/data/discography.json

🎉 Done!
```

**Usage**:
```bash
# Enrich discography data
npm run enrich:discography

# Preview without writing
npm run enrich:discography -- --dry-run

# Force re-fetch all artists (ignore cache)
npm run enrich:discography -- --force
```

**Cache Strategy**:
- TTL: 90 days (albums rarely change)
- Cache file: `public/data/discography.json`
- Keyed by normalized artist name
- Stores empty entries for artists not found (avoids re-fetching)

**Features**:
- **Fuzzy matching**: Uses Levenshtein distance (80% threshold) for artist search
- **Rate limiting**: Strict 1 req/sec enforcement with automatic retry on 503 errors
- **Pagination warning**: Alerts if artist has >100 albums (shows first 100)
- **Mock data filtering**: Skips artists without real metadata

**Data Output**: `public/data/discography.json`

**Future Use Cases**:
- Artist Scene gatefold discography panel (v3.6.0+)
- Album filtering (studio, live, compilations)
- Concert-album association ("You saw them 3 months after this album dropped")
- Spotify album deep links (v3.7.0+)

See [docs/specs/future/artists-discography.md](specs/future/artists-discography.md) for complete implementation details.

---

### 9. Build Pipeline (`build-data.ts`) - Enhanced Orchestrator

**What it does:**
- Orchestrates the complete data refresh pipeline
- Runs all enrichment steps in sequence
- Supports selective execution with skip flags
- Automatic API credential validation
- Comprehensive progress tracking and error handling

**Pipeline Steps** (in order):

1. **Fetch Google Sheets** → `concerts.json` (always runs)
2. **Enrich concert genres** → Genre enrichment from artist metadata (always runs)
3. **Validate concerts** → Quality checks (optional)
4. **Enrich artist metadata** → TheAudioDB/Last.fm (always runs)
5. **Enrich venue metadata** → Google Places API (optional)
6. **Enrich Spotify data** → Album art, tracks (optional)
7. **Enrich discography** → MusicBrainz albums (optional)
8. **Pre-fetch setlists** → setlist.fm cache (optional)
9. **Aggregate genres timeline** → Genre statistics (always runs)

**Available Flags:**

| Flag | Effect | Use When |
|------|--------|----------|
| `--dry-run` | Preview without writing files | Testing changes safely |
| `--skip-validation` | Skip data quality checks | Faster builds, trusted data |
| `--skip-venues` | Skip venue enrichment | Saving API quota/cost |
| `--skip-spotify` | Skip Spotify enrichment | No Spotify credentials |
| `--skip-discography` | Skip discography enrichment | Faster builds, no MusicBrainz needed |
| `--skip-setlists` | Skip setlist pre-fetch | No setlist.fm API key |
| `--force-refresh-setlists` | Re-fetch all setlists | Updating existing setlists |

**Usage Examples:**

```bash
# Full refresh (all data sources)
npm run build-data

# Preview changes without writing files
npm run build-data -- --dry-run

# Quick refresh (skip expensive operations)
npm run build-data -- --skip-venues --skip-spotify

# Minimal refresh (concerts + artists only)
npm run build-data -- --skip-venues --skip-spotify --skip-setlists

# Update setlist cache only
npm run build-data -- --skip-venues --skip-spotify

# Force refresh all setlists (ignore cache)
npm run build-data -- --force-refresh-setlists

# Fast build for development
npm run build-data -- --skip-validation --skip-venues --skip-spotify
```

**Example Output:**

```
🎸 Starting Concert Data Pipeline...

============================================================

📋 Pipeline Steps:
   ✓ Fetch Google Sheets
   ✓ Validate concerts
   ✓ Enrich artist metadata
   ⏭️ Enrich venue metadata (skipped)
   ✓ Enrich Spotify data
   ✓ Pre-fetch setlists

============================================================
Step 1/5: Fetching data from Google Sheets
------------------------------------------------------------
[...fetch output...]

============================================================
Step 2/5: Validating concert data
------------------------------------------------------------
[...validation output...]

============================================================
Step 3/5: Enriching artist metadata
------------------------------------------------------------
[...enrichment output...]

============================================================
Step 4/5: Enriching Spotify metadata
------------------------------------------------------------
[...Spotify output...]

============================================================
Step 5/5: Pre-fetching setlists
------------------------------------------------------------
[...setlist output...]

============================================================
✨ Data pipeline complete!
============================================================

📁 Output files:
   - public/data/concerts.json
   - public/data/artists-metadata.json
   - public/data/setlists-cache.json

📦 Automatic backups created with .backup.TIMESTAMP extension

Next steps:
   • Review changes: npm run diff-data
   • Build site: npm run build
   • Preview: npm run dev
```

**API Credential Validation:**

The pipeline automatically checks for required API credentials before running optional steps. If credentials are missing, it skips the step gracefully with a warning:

```
============================================================
Step 4/5: Enriching Spotify metadata
------------------------------------------------------------
⚠️  Warning: Spotify credentials not configured in .env
   Skipping Spotify enrichment
   See docs/api-setup.md for setup instructions
```

**Error Handling:**

If any step fails, the pipeline:
1. Displays the error message
2. Shows troubleshooting tips
3. Exits with code 1 (prevents bad data)
4. Keeps previous successful output (doesn't corrupt files)

```
❌ Pipeline failed: Google Sheets API authentication failed

To troubleshoot:
   • Check error message above for specific issue
   • Verify .env file has required API credentials
   • Try running individual scripts to isolate the problem
```

**Backup Protection:**

All scripts automatically create timestamped backups before writing files:
- `concerts.json.backup.2026-01-03T14-30-45`
- `artists-metadata.json.backup.2026-01-03T14-30-45`
- `venues-metadata.json.backup.2026-01-03T14-30-45`
- `setlists-cache.json.backup.2026-01-03T14-30-45`

Keeps last 10 backups automatically. Backups are never overwritten.

---

## Complete Data Refresh Workflow

This section describes the complete workflow for refreshing all concert data from source through deployment.

### When to Run a Full Refresh

Run the complete pipeline when:
- Adding new concerts to Google Sheets
- Updating existing concert data
- Refreshing artist metadata (photos, bios)
- Updating venue information
- Fetching new setlists
- Monthly maintenance refresh

### Step-by-Step Process

**1. Update Source Data** (if needed)
```bash
# Edit your Google Sheet with new/updated concerts
# No command needed - just edit the sheet directly
```

**2. Preview Changes (recommended)**
```bash
# See what will change without writing files
npm run build-data -- --dry-run

# Review the output:
# - How many concerts will be processed?
# - Any validation warnings?
# - Which API calls will be made?
```

**3. Run Full Pipeline**
```bash
# Option A: Full refresh (all sources)
npm run build-data

# Option B: Skip expensive operations
npm run build-data -- --skip-venues --skip-spotify

# Option C: Setlists only (after adding new concerts)
npm run build-data -- --skip-venues --skip-spotify
```

**4. Review Changes**
```bash
# Compare before/after (uses automatic backups)
npm run diff-data

# Check specific files
git status
git diff public/data/concerts.json
git diff public/data/setlists-cache.json
```

**5. Test Locally**
```bash
# Start dev server
npm run dev

# Test in browser:
# - Do new concerts appear?
# - Do setlists load?
# - Any console errors?
# - Check all 5 scenes
```

**6. Commit & Deploy**
```bash
# Stage changes
git add public/data/*.json

# Commit with descriptive message
git commit -m "data: Add 5 concerts from January 2026"

# Push to GitHub (triggers automatic deployment)
git push origin main
```

**7. Verify Production**
```bash
# Wait 2-3 minutes for deployment
# Check https://concerts.morperhaus.org

# Verify:
# - New concerts visible
# - Setlists loading
# - No broken features
```

### Time Estimates

| Operation | First Run | Incremental | Notes |
|-----------|-----------|-------------|-------|
| Fetch Google Sheets | ~5s | ~5s | Always fetches all |
| Validate concerts | ~2s | ~2s | Always validates all |
| Enrich artists | ~90s | ~10s | Skips cached (<30 days) |
| Enrich venues | ~50s | ~5s | Skips cached (<90 days) |
| Enrich Spotify | ~180s | ~20s | Skips cached (<90 days) |
| Pre-fetch setlists | ~260s | ~30s | Skips existing cache |
| **Total (full)** | **~10 min** | **~1-2 min** | First time or force refresh |
| **Total (typical)** | **~2 min** | **~30s** | Adding new concerts |

### Troubleshooting Common Issues

**Issue: Pipeline fails at Google Sheets step**
```
❌ Error fetching Google Sheets data: Request failed with status code 401
```
**Fix:**
1. Check `.env` file has all Google credentials
2. Verify refresh token hasn't expired
3. See [docs/api-setup.md](api-setup.md) for re-authentication

**Issue: Validation warnings about duplicate concerts**
```
⚠️  Duplicate concert found: 2024-03-15 - Social Distortion
```
**Fix:**
1. Open Google Sheet
2. Search for duplicate date + headliner
3. Remove duplicate row
4. Re-run pipeline

**Issue: Setlist pre-fetch takes too long**
```
[45/174] 🔍 Fetching...
[Still running after 5 minutes]
```
**Fix:**
- This is normal for first run (~4-5 minutes total)
- Incremental runs only fetch new concerts (<30 seconds)
- Use `--skip-setlists` if you need a fast build

**Issue: Spotify enrichment fails with rate limit**
```
❌ Error: 429 Too Many Requests
```
**Fix:**
- Script has built-in rate limiting (350ms between requests)
- If still hitting limits, wait a few minutes and re-run
- Already enriched artists will be skipped (cached)

**Issue: Output files not updated after successful run**
```
✨ Data pipeline complete!
[But git diff shows no changes]
```
**Fix:**
- Check if you used `--dry-run` flag (prevents writes)
- Verify no errors earlier in output
- Check file timestamps: `ls -l public/data/*.json`

---

## Flexible Column Support (v1.2.4+)

### Overview

The Google Sheets parser uses **header-based column detection** instead of hardcoded column indices. This makes the pipeline resilient to column reordering and allows optional columns to be added or removed without breaking the data fetch.

### Column Requirements

**Required Columns:**

- `Date` - Concert date (any parseable date format)
- `Headliner` - Main artist name
- `Venue` - Venue name
- Location: Either `City/State` (combined) OR separate `City` and `State` columns

**Optional Columns:**

- `Genre_Headliner` or `Genre` - Music genre (empty if missing)
- `Opener` - Primary opener artist
- `Reference` - Concert reference URL
- `Opener_1` through `Opener_15` - Additional opener artists

### Column Detection

The parser automatically:

- ✅ Reads the header row to map column names to indices
- ✅ Searches for columns by multiple possible names (e.g., "City/State", "citystate")
- ✅ Handles separate City/State columns by combining them automatically
- ✅ Trims whitespace from all field values (v1.2.4)
- ✅ Warns when optional columns are missing (non-blocking)
- ❌ Errors if required columns are missing

### Example Log Output

```
📋 Parsed 35 columns from header row
   Required: Date(0), Headliner(1), Venue(4)
   Location: City(10), State(11) [separate columns]
   Optional: Genre(2), Opener(3), Reference(7)
   Found 15 Opener_N columns
```

### Benefits

1. **Flexible sheet structure** - Add, remove, or reorder columns without code changes
2. **Optional genre support** - Prepare for removing genre column when Spotify integration is ready
3. **Clear validation** - Know immediately if required columns are missing
4. **Whitespace handling** - Automatic trimming prevents cache key mismatches

---

## Geocoding Strategy

### Overview

The pipeline uses Google Maps Geocoding API to get accurate venue-specific coordinates for displaying concerts on the map. The system employs a **cache-first** strategy to minimize API calls and stay within the free tier.

### How It Works

The geocoding system uses an intelligent cache stored in `public/data/geocode-cache.json`:

1. **First run**: Geocodes all unique venues (~76 requests)
2. **Cache created**: Saves all coordinates to cache file
3. **Subsequent runs**: Uses cached coordinates (0 API calls)
4. **New venues**: Only geocodes venues not in cache

After the initial run, you'll typically make **zero API calls** during normal operation.

### Cache Key Format

Venue coordinates are cached using the format:
```
${venue}|${city}|${state}`.toLowerCase()
```

**Example:** `"universal amphitheater|los angeles|california"`

**Important:** The cache lookup is robust to whitespace - venue, city, and state are trimmed before building the key (v1.2.3+).

### Fallback Strategy

The fetch pipeline uses a multi-tier coordinate strategy:

1. **Venue-specific (preferred)**: Look up venue in geocode cache
2. **City-level (fallback)**: Use hardcoded city coordinates from `src/utils/city-coordinates.ts`
3. **Default (last resort)**: Use default coordinates if venue and city not found

This ensures every concert has valid coordinates even if geocoding hasn't run yet.

### Manual Geocoding

You can manually geocode all venues from your concerts.json file:

```bash
npm run geocode
```

**Use cases:**
- Pre-populate the cache before first fetch
- Update coordinates for all venues
- Fix incorrect geocoding results

### Cost Analysis

- **Pricing**: $5/1,000 requests ($0.005 per request)
- **Free Tier**: $200/month credit = 40,000 free requests/month
- **Your Usage**:
  - Initial run: ~76 unique venues = 76 requests = **$0.38**
  - Subsequent runs: Only new venues (0-5/month) = **$0.01/month**
  - Annual estimate: ~100 requests/year = **$0.50/year**

**Expected cost: $0.00** - All usage stays well within the $200/month free tier.

### Rate Limiting

Google Maps Geocoding API allows 50 requests/second. The geocoding script enforces a 20ms delay between requests to stay well within this limit.

---

## Data Files

### Input
- **Google Sheets** - Single source of truth (via API)
- `.env` - API credentials (not committed)

### Output (Committed to Git)
- `public/data/concerts.json` - Processed concert data + metadata
- `public/data/geocode-cache.json` - Cached venue coordinates
- `public/data/artists-metadata.json` - Artist metadata from TheAudioDB (photos, bios, genres)
- `public/data/venues-metadata.json` - Venue metadata with photos (v1.3.2+)
- `public/data/venue-photos-cache.json` - Cached Google Places API responses (v1.3.2+)

### Temporary (Not Committed)
- `public/data/concerts.json.backup` - Created manually for diff comparison

---

## Error Handling

### Missing Environment Variables
```
❌ Missing required environment variable: GOOGLE_SHEET_ID
Please copy .env.example to .env and fill in your values
```
**Fix:** Configure `.env` file with required credentials

### Google Sheets API Failure
```
❌ Error fetching Google Sheets data: Request failed with status code 401
```
**Fix:**
1. Verify OAuth credentials in `.env`
2. Check if refresh token expired (see [api-setup.md](api-setup.md))
3. Verify Google Sheets API is enabled in Google Cloud Console

### Validation Errors
```
❌ Validation failed. Please fix errors before deploying.
```
**Fix:**
1. Review error messages in validation output
2. Fix issues in Google Sheets
3. Re-run `npm run fetch-sheet`
4. Re-validate with `npm run validate-data`

---

## Best Practices

### Before Fetching Data
1. ✅ Create backup: `cp public/data/concerts.json public/data/concerts.json.backup`
2. ✅ Verify `.env` credentials are current
3. ✅ Check Google Sheet for obvious errors

### After Fetching Data
1. ✅ Run validation: `npm run validate-data`
2. ✅ Check diff report: `npm run diff-data`
3. ✅ Review changes carefully
4. ✅ Test locally: `npm run dev`
5. ✅ Commit with descriptive message

### Committing Data Changes
```bash
# Good commit messages
git commit -m "data: Add 3 concerts from March 2024"
git commit -m "data: Fix venue name for Social Distortion show"
git commit -m "data: Update geocoding for The Roxy venue"

# Avoid vague messages
git commit -m "update data"  # ❌ Too vague
git commit -m "changes"      # ❌ Not descriptive
```

---

## Troubleshooting

### Issue: Validation finds duplicate concerts
**Cause:** Same concert appears twice in Google Sheet
**Fix:**
1. Open Google Sheet
2. Search for duplicate date + headliner
3. Remove duplicate row
4. Re-run fetch

### Issue: Geocoding returns (0, 0) coordinates
**Cause:** Google Maps API couldn't find venue
**Fix:**
1. Check venue name spelling in Google Sheet
2. Try adding more specific address (street, city)
3. Manually update coordinates if needed
4. Re-run fetch to cache correct coordinates

### Issue: "No backup file found" when running diff
**Cause:** No backup file exists to compare against
**Fix:**
1. Create backup: `cp public/data/concerts.json public/data/concerts.json.backup`
2. Make changes and fetch new data
3. Run diff again

---

## Phase 1 Enhancements Summary

The following enhancements were added in 2026-01-01:

### Enhancement 1.1: Pre-Build Validation ✅
- New script: `scripts/validate-concerts.ts`
- Command: `npm run validate-data`
- Checks for duplicates, invalid dates, missing fields, data quality issues

### Enhancement 1.2: Detailed Logging ✅
- Enhanced `scripts/fetch-google-sheet.ts`
- Shows comprehensive summary with statistics
- Reports skipped rows and warnings
- Provides clear next steps

### Enhancement 1.3: Diff Report ✅
- New script: `scripts/diff-concerts.ts`
- Command: `npm run diff-data`
- Shows added, removed, and modified concerts
- Requires backup file for comparison

### Integration ✅
- Updated `scripts/build-data.ts` to run validation automatically
- Can skip validation with `--skip-validation` flag
- Added npm scripts for all new tools

---

## Related Documentation

- [api-setup.md](api-setup.md) - OAuth 2.0 configuration
- [BUILD.md](BUILD.md) - Build process and deployment
- [specs/future/google-sheets-data-integration.md](specs/future/google-sheets-data-integration.md) - Complete specification

---

## Support

For issues or questions:
1. Check this documentation first
2. Review error messages carefully
3. Verify `.env` configuration
4. Check [api-setup.md](api-setup.md) for credentials help

---

*Last updated: 2026-01-01*
