# Scripts Directory

This directory contains all data pipeline, build, and utility scripts for the Morperhaus Concert Archives project.

---

## Quick Reference

### Data Pipeline Scripts (Run Regularly)

| Script | Command | Purpose | When to Run |
|--------|---------|---------|-------------|
| **build-data.ts** | `npm run build-data` | **Main orchestrator** - runs all data refresh steps | Adding concerts, monthly refresh |
| fetch-google-sheet.ts | `npm run fetch-sheet` | Fetch concert data from Google Sheets | Standalone fetch (rare) |
| enrich-artists.ts | `npm run enrich` | Enrich artist metadata (TheAudioDB/Last.fm) | Standalone enrichment (rare) |
| enrich-venues.ts | `npm run enrich-venues` | Enrich venue metadata (Google Places API) | Monthly, or when adding new venues |
| enrich-spotify-metadata.ts | `npm run enrich-spotify` | Enrich Spotify album art + tracks | When Spotify credentials available |
| prefetch-setlists.ts | `npm run prefetch:setlists` | Pre-fetch setlists from setlist.fm | Standalone setlist refresh |
| validate-concerts.ts | `npm run validate-data` | Validate concert data quality | After fetching data |
| diff-concerts.ts | `npm run diff-data` | Compare before/after data changes | Before committing |

### Build Scripts (Automatic)

| Script | Command | Purpose | When It Runs |
|--------|---------|---------|--------------|
| generate-version.ts | `npm run build` | Generate version.json with git metadata | Every production build |
| update-meta-tags.ts | `npm run update:meta` | Update index.html meta descriptions with current stats | Before each release |
| generate-og-simple.ts | `npm run og:generate` | Generate Open Graph social media image | After updating meta tags |
| preview-og-crops.ts | `npm run og:preview` | Preview OG image crop regions | Testing OG image generation |

### Utility Scripts (One-Time or Maintenance)

| Script | Command | Purpose | Status |
|--------|---------|---------|--------|
| convert-csv-to-json.ts | `npm run convert-csv` | Convert CSV to concerts.json | **Deprecated** - Google Sheets now used |
| geocode-venues.ts | `npm run geocode` | Geocode venue coordinates manually | One-time setup (cache exists) |
| export-venues.ts | `npm run export-venues` | Export venues to CSV for status research | One-time venue classification |
| deduplicate-artists.ts | `npm run deduplicate-artists` | Remove duplicate artists from metadata | Data cleanup (rare) |
| cleanup-backups.ts | `npm run cleanup:backups` | Clean old backup files (keeps 3 most recent) | Maintenance (monthly) |
| validate-normalization.ts | `npm run validate-normalization` | Verify artist name normalization | Testing normalization logic |
| generate-mock-spotify-metadata.ts | `npm run generate-mock-spotify` | Generate mock Spotify data (for testing) | Development only |
| review-venue-photos.ts | `npm run review-venue-photos` | Review venue photo cache entries | Debugging venue enrichment |

### Personal Media (`scripts/media/`)

| Script | Command | Purpose | When to Run |
|--------|---------|---------|-------------|
| media/prep.ts | `npm run media:prep <YYYY-MM-DD>` | Scaffold one show's inbox folders and build its `WORKSHEET.md` of Photos candidates | After a show, before culling |
| media/ingest.ts | `npm run media:ingest [date]` | Take the owner's selects out of the inbox into `public/images/shows/` + `media-index.json` | After filling the inbox folders |

**Read `.claude/skills/media-pipeline/SKILL.md` before touching anything here.** The Photos
library is the owner's irreplaceable source of record and is never modified: every read goes
through the read-only guard at `concert-photos-audit/bin/osxphotos`, never `.osxphotos-raw`.

`media:prep` reads Photos and writes only into the gitignored
`concert-photos-audit/inbox/<date>/`. It ranks candidates and never filters them, and it
asserts its own output before reporting success. Add `-- --scaffold-only` to create the
folders without reading the library.

`media:ingest` strips GPS, capture time and device id from every file, and **asserts** their
absence on the written bytes by two independent checks before keeping it — a file that fails
is deleted, not committed. It never guesses a credit: an unmatched folder or a file at the
root of a date folder is an error that names the night's bill, because a headliner default
would mis-credit photographs on the 48% of shows that have openers. Re-runs are idempotent,
keyed on the source file's SHA-256. Add `-- --dry-run` to report without writing.

The two-factor ranking model, and the reasoning behind every weight in it, lives in
`scripts/media/rank.ts`. It is pure and unit-tested in `test/pipeline/media-prep.test.ts` —
each of the project's hard-won findings is pinned there as a test.

### Test/Diagnostic Scripts (Development Only)

| Script | Purpose | When to Use |
|--------|---------|-------------|
| test-places-api.ts | Test Google Places API connectivity | Troubleshooting venue enrichment |
| test-setlistfm.ts | Test setlist.fm API integration | Debugging setlist fetching |

---

## Script Categories

### 🎯 Core Pipeline (Must Know)

**build-data.ts** - The main entry point for all data operations. This is the only script you need to remember for regular use.

```bash
# Full refresh (all data sources)
npm run build-data

# Quick refresh (skip expensive operations)
npm run build-data -- --skip-venues --skip-spotify

# Preview changes without writing files
npm run build-data -- --dry-run
```

See [docs/DATA_PIPELINE.md](../docs/DATA_PIPELINE.md) for complete pipeline documentation.

---

### 📥 Data Fetching & Enrichment

**Fetching:**
- `fetch-google-sheet.ts` - Primary data source (Google Sheets → concerts.json)
- `prefetch-setlists.ts` - Setlist cache generation (setlist.fm → setlists-cache.json)

**Enrichment:**
- `enrich-artists.ts` - Artist metadata (TheAudioDB/Last.fm → artists-metadata.json)
- `enrich-venues.ts` - Venue photos (Google Places → venues-metadata.json)
- `enrich-spotify-metadata.ts` - Album art + tracks (Spotify → artists-metadata.json)

**All enrichment scripts:**
- Create automatic backups before writing
- Support incremental updates (skip cached data)
- Respect API rate limits
- Can run standalone or via `build-data.ts`

---

### ✅ Data Quality & Validation

**validate-concerts.ts** - Comprehensive data validation
- Checks for duplicates, invalid dates, missing fields
- Runs automatically as part of `build-data.ts`
- Can be skipped with `--skip-validation` flag

**validate-normalization.ts** - Artist name normalization testing
- Verifies name matching logic works correctly
- Useful when debugging artist enrichment issues

**diff-concerts.ts** - Compare data changes
- Shows added, removed, and modified concerts
- Uses automatic backups for comparison
- Run before committing data changes

---

### 🏗️ Build & Deployment

**generate-version.ts** - Generates `public/version.json`

- Captures git commit hash, branch, build time
- Runs automatically during `npm run build`
- Used for production debugging (check `/version.json`)

**update-meta-tags.ts** - Updates meta descriptions with current stats

- Reads stats from `concerts.json` (concerts, artists, venues, year range)
- Updates `index.html` meta tags (description, OG, Twitter)
- Updates `public/og-stats.json`
- Run before each release: `npm run update:meta`

**generate-og-simple.ts** - Open Graph social media image

- Captures Venues scene force graph + stats overlay
- Reads stats from `concerts.json` for accuracy
- Pre-generated and committed (runs locally, not in CI)
- Run after `update:meta`: `npm run og:generate`

**preview-og-crops.ts** - OG image preview tool

- Shows different crop regions for social media
- Helps verify OG image looks good across platforms

---

### 🔧 Utilities & Maintenance

**One-Time Setup:**
- `geocode-venues.ts` - Pre-populate venue coordinate cache (already done)
- `export-venues.ts` - Export venues for manual status research (one-time classification)

**Data Cleanup:**
- `deduplicate-artists.ts` - Remove duplicate artist entries
- `cleanup-backups.ts` - Clean old backup files (keeps 3 most recent per file type)
- `convert-csv-to-json.ts` - **DEPRECATED** - CSV import (replaced by Google Sheets)

**Development:**
- `generate-mock-spotify-metadata.ts` - Create fake Spotify data for testing
- `review-venue-photos.ts` - Inspect venue photo cache

---

### 🧪 Testing & Diagnostics

**test-places-api.ts** - Google Places API connectivity test
```bash
npm run test-places-api
```
- Verifies API key works
- Tests text search + place details endpoints
- Useful when venue enrichment fails

**test-setlistfm.ts** - setlist.fm API integration test
```bash
npx tsx scripts/test-setlistfm.ts
```
- Tests fuzzy matching logic
- Verifies API connectivity
- Runs multiple test cases from real concerts

---

## Scripts to Keep vs. Remove

### ✅ Keep (Active Use)

**Essential:**
- build-data.ts
- fetch-google-sheet.ts
- enrich-artists.ts
- enrich-venues.ts
- enrich-spotify-metadata.ts
- prefetch-setlists.ts
- validate-concerts.ts
- diff-concerts.ts

**Build:**
- generate-version.ts
- update-meta-tags.ts
- generate-og-simple.ts
- preview-og-crops.ts

**Utilities:**
- geocode-venues.ts
- export-venues.ts
- deduplicate-artists.ts
- cleanup-backups.ts
- validate-normalization.ts
- review-venue-photos.ts

**Testing:**
- test-places-api.ts
- test-setlistfm.ts

### ⚠️ Consider Archiving

**convert-csv-to-json.ts** - **DEPRECATED**
- **Purpose**: Convert CSV files to concerts.json
- **Status**: Replaced by Google Sheets integration
- **Recommendation**: Move to `scripts/archive/` or delete
- **Reason**: No longer part of workflow, kept only for historical reference

**generate-mock-spotify-metadata.ts** - **Development Only**
- **Purpose**: Generate fake Spotify data for UI testing
- **Status**: Used once during development
- **Recommendation**: Keep (useful for testing without Spotify API)
- **Reason**: May need again if Spotify API unavailable

---

## Common Workflows

### Adding New Concerts

```bash
# 1. Edit Google Sheet (add new concert rows)

# 2. Preview changes
npm run build-data -- --dry-run --skip-venues --skip-spotify

# 3. Run pipeline (includes setlist pre-fetch)
npm run build-data -- --skip-venues --skip-spotify

# 4. Review changes
npm run diff-data

# 5. Commit
git add public/data/*.json
git commit -m "data: Add 3 concerts from January 2026"
git push
```

### Monthly Full Refresh

```bash
# Refresh everything (takes ~10 minutes)
npm run build-data

# Clean up old backup files
npm run cleanup:backups

# Or specific parts only
npm run enrich-venues          # Venue photos
npm run enrich-spotify         # Album art
npm run prefetch:setlists      # Setlists
```

### Force Refresh Setlists

```bash
# Re-fetch ALL setlists (ignores cache)
npm run prefetch:setlists -- --force-refresh

# Or as part of pipeline
npm run build-data -- --force-refresh-setlists
```

### Troubleshooting API Issues

```bash
# Test Google Places API
npm run test-places-api

# Test setlist.fm API
npx tsx scripts/test-setlistfm.ts

# Review what's in venue photo cache
npm run review-venue-photos
```

---

## Script Dependencies

### Utils Subdirectory

All scripts share common utilities in `scripts/utils/`:

| Utility | Purpose |
|---------|---------|
| backup.ts | Automatic backup creation (keeps last 10) |
| google-sheets-client.ts | Google Sheets OAuth + data fetching |
| google-places-client.ts | Google Places API wrapper + caching |
| theaudiodb-client.ts | TheAudioDB API wrapper |
| lastfm-client.ts | Last.fm API wrapper |
| rate-limiter.ts | Rate limiting for API calls |

---

## Environment Variables Required

Different scripts require different API credentials:

| Script(s) | Required Variables |
|-----------|-------------------|
| fetch-google-sheet.ts | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_SHEET_ID` |
| enrich-venues.ts | `GOOGLE_PLACES_API_KEY` |
| enrich-spotify-metadata.ts | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
| prefetch-setlists.ts | `VITE_SETLISTFM_API_KEY` |
| enrich-artists.ts | `THEAUDIODB_API_KEY` (optional), `LASTFM_API_KEY` (optional) |

See [docs/api-setup.md](../docs/api-setup.md) for complete credential setup instructions.

---

## File Naming Conventions

- **Verb-noun format** - `enrich-artists.ts`, `validate-concerts.ts`
- **Purpose-clear names** - What the script does is obvious from the name
- **Test prefix** - `test-*.ts` for diagnostic/troubleshooting scripts
- **Generate prefix** - `generate-*.ts` for build-time artifact creation

---

## Adding New Scripts

When creating new scripts, follow these conventions:

1. **Add header comment** explaining purpose and usage
2. **Export main function** for use in other scripts
3. **Support dry-run mode** if the script writes files
4. **Create backups** before modifying data files
5. **Add to package.json** with clear npm script name
6. **Update this README** with script description

**Template:**
```typescript
/**
 * Brief description of what this script does
 *
 * Usage:
 *   npm run my-script
 *   npm run my-script -- --dry-run
 */

import { createBackup } from './utils/backup'

async function myScript(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options

  // Implementation...

  if (!dryRun) {
    createBackup(outputPath, { maxBackups: 10 })
    // Write file...
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run')
  myScript({ dryRun }).catch(console.error)
}

// Export for use in other scripts
export { myScript }
```

---

## See Also

- **[docs/DATA_PIPELINE.md](../docs/DATA_PIPELINE.md)** - Complete data pipeline documentation
- **[docs/WORKFLOW.md](../docs/WORKFLOW.md)** - Day-to-day workflow guide
- **[docs/api-setup.md](../docs/api-setup.md)** - API credential configuration
- **[docs/BUILD.md](../docs/BUILD.md)** - Build process and deployment

---

**Last Updated**: 2026-01-07
**Total Scripts**: 22 (19 active, 2 test, 1 deprecated)
