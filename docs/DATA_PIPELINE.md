# Concert Data Pipeline Documentation

> **Status:** Phase 1 Core + Enhancements Implemented
> **Last Updated:** 2026-01-01
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
| `npm run build-data` | Run full pipeline (fetch + validate + enrich) | Complete data refresh |
| `npm run build-data -- --dry-run` | Preview pipeline without writing files | Test full pipeline safely |
| `npm run build-data -- --skip-validation` | Skip validation step | Faster builds when data is trusted |

---

## Quick Start

### First Time Setup

1. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your Google Sheets API credentials
   ```

2. **Preview what will be fetched (safe, no writes):**
   ```bash
   npm run fetch-sheet -- --dry-run
   ```

3. **Fetch concert data (automatic backup created):**
   ```bash
   npm run fetch-sheet
   ```

4. **Validate data quality:**
   ```bash
   npm run validate-data
   ```

5. **Build the site:**
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

### 5. Build Pipeline (`build-data.ts`)

**What it does:**
- Orchestrates full pipeline
- Runs fetch → validate → enrich
- Can skip validation with `--skip-validation` flag

**Usage:**
```bash
# Full pipeline with validation
npm run build-data

# Skip validation (faster, less safe)
npm run build-data -- --skip-validation
# or
SKIP_VALIDATION=true npm run build-data
```

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
