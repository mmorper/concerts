# /data-refresh - Orchestrate Data Pipeline

Refresh concert data from Google Sheets through the complete enrichment pipeline.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--dry-run` | No | false | Preview without writing files |
| `--quick` | No | false | Skip expensive enrichments |
| `--full` | No | false | Force refresh all data (ignore cache) |
| `--skip-setlists` | No | false | Skip setlist pre-fetch |
| `--skip-venues` | No | false | Skip venue enrichment |
| `--skip-tracks` | No | false | Skip audio preview enrichment |

**Examples:**
```
/data-refresh              # Standard refresh
/data-refresh --quick      # Fast: fetch + validate only
/data-refresh --dry-run    # Preview changes
/data-refresh --full       # Force refresh everything
```

---

## Quick Reference

| Step | Script | Time | Skip Flag |
|------|--------|------|-----------|
| 1. Fetch | `npm run fetch-sheet` | ~5s | - |
| 2. Validate | `npm run validate-data` | ~2s | - |
| 3. Artists | `npm run enrich` | ~10-90s | - |
| 4. Venues | `npm run enrich-venues` | ~5-50s | `--skip-venues` |
| 5. Audio Previews | `npm run enrich:tracks` | ~20-180s | `--skip-tracks` |
| 6. Setlists | `npm run prefetch:setlists` | ~30-260s | `--skip-setlists` |

---

## Workflow

### Step 1: Pre-Flight Checks

**Check API credentials:**
```bash
# Required for all runs
GOOGLE_SHEET_ID ✓
GOOGLE_CLIENT_ID ✓
GOOGLE_CLIENT_SECRET ✓
GOOGLE_REFRESH_TOKEN ✓

# Optional (skips step if missing)
VITE_TICKETMASTER_API_KEY
VITE_SETLISTFM_API_KEY
GOOGLE_MAPS_API_KEY
```

> **Environment Check:**
> ✅ Google Sheets credentials configured
> ✅ setlist.fm API key configured
>
> Continue? (yes / configure credentials)

---

### Step 2: Fetch from Google Sheets

See `docs/DATA_PIPELINE.md` → "Data Fetching" for complete details.

```bash
npm run fetch-sheet
```

**Creates:** `public/data/concerts.json`

**Automatic backup:** `concerts.json.backup.YYYY-MM-DDTHH-MM-SS`

> 📊 Fetched {CONCERTS} concerts
> - Date range: {FIRST_DATE} to {LAST_DATE}
> - {ARTISTS} unique artists
> - {VENUES} unique venues

---

### Step 3: Validate Data

See `docs/DATA_PIPELINE.md` → "Data Validation" for complete checks.

```bash
npm run validate-data
```

**If errors found:**
> ❌ Validation failed
> - Row 45: Missing headliner
> - Row 67: Duplicate concert
>
> Fix issues in Google Sheets? (yes / continue anyway / cancel)

**If warnings only:**
> ⚠️ 2 warnings found (non-blocking)
> - Row 56: 14 openers (verify)
>
> Continuing...

---

### Step 4: Enrich Artist Metadata

See `docs/DATA_PIPELINE.md` → "Artist Enrichment" for metadata fields.

```bash
npm run enrich
```

**Source:** TheAudioDB (free, no API key)

**Updates:** `public/data/artists-metadata.json`

> 🎤 Enriching artists...
> - Cached (< 30 days): 87
> - Fetching new: 14
> - Not found: 3
>
> ✅ Artist enrichment complete

---

### Step 5: Enrich Venue Metadata

See `docs/DATA_PIPELINE.md` → "Venue Enrichment" for photo sources and workflow.

**Skip with:** `--skip-venues` or `--quick`

```bash
npm run enrich-venues
```

**Source:** Google Places API (requires `GOOGLE_MAPS_API_KEY`)

**Updates:** `public/data/venues-metadata.json`

> 📍 Enriching venues...
> - Active venues: 48 (fetching photos)
> - Legacy venues: 29 (manual photos)
>
> ✅ Venue enrichment complete

---

### Step 6: Enrich Audio Preview Data

See `docs/DATA_PIPELINE.md` → "Audio Preview Enrichment" for complete details.

**Skip with:** `--skip-tracks` or `--quick`

```bash
npm run enrich:tracks
```

**Sources:** iTunes Search API (primary), Deezer API (fallback) - no credentials required

**Creates:** `public/data/artists-top-tracks.json`

> 🎵 Enriching top tracks with audio previews...
> - Enriched: 252 artists (99.2% coverage)
>   └─ iTunes: 250 (98.8%)
>   └─ Deezer: 2 (0.8%)
> - Skipped: 2 (below 40% quality bar)
>
> ✅ Audio preview enrichment complete

---

### Step 7: Pre-fetch Setlists

See `docs/DATA_PIPELINE.md` → "Setlist Pre-fetch" for caching strategy.

**Skip with:** `--skip-setlists` or `--quick`

```bash
npm run prefetch:setlists
```

**Source:** setlist.fm API

**Updates:** `public/data/setlists-cache.json`

> 🎵 Pre-fetching setlists...
> - Used cached: 145
> - Fetched new: 27
> - Not found: 6
>
> ✅ Setlist cache updated

---

### Step 8: Summary & Context Sync

**Show summary:**
```
============================================================
✨ DATA REFRESH COMPLETE
============================================================

📊 Statistics:
   - Concerts: 178
   - Artists: 247
   - Venues: 77
   - Setlists cached: 172

📁 Updated files:
   - public/data/concerts.json
   - public/data/artists-metadata.json
   - public/data/venues-metadata.json
   - public/data/setlists-cache.json

⏱️  Total time: 2m 34s
```

**Update context:**
> Update .claude/context.md with new stats? (yes / no)

If yes, run `/context-sync --stats-only`

**Liner notes pipeline:**

`npm run build-data` automatically runs the agentic liner notes pipeline if `ANTHROPIC_API_KEY` is set. This generates `public/data/liner-notes.json` with 2–3 new posts per run (see `scripts/liner-notes/`). If the key is absent, this step is skipped silently.

To run the liner notes pipeline separately:

```bash
npm run generate:liner-notes            # Normal run (2-3 posts)
npm run generate:liner-notes -- --seed  # Seed run (~10 posts, first-time setup)
npm run generate:liner-notes -- --dry-run  # Preview without writing
```

---

## Mode Presets

### Standard (default)
```
/data-refresh
```
- Fetches all data
- Uses cache where valid
- Runs all enrichments with configured APIs

### Quick Mode
```
/data-refresh --quick
```
- Fetch + validate only
- Skips: venues, audio previews, setlists
- ~10 seconds

### Full Refresh
```
/data-refresh --full
```
- Ignores all caches
- Re-fetches everything
- ~10 minutes

### Dry Run
```
/data-refresh --dry-run
```
- Shows what would change
- No files modified
- Safe for testing

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "Google Sheets auth failed" | Expired refresh token | See `docs/api-setup.md` |
| "Rate limit exceeded" | Too many API calls | Wait and retry |
| "Validation failed" | Bad data in sheet | Fix in Google Sheets |
| "API key missing" | Missing credentials | Configure `.env` file |

---

## When to Run

| Scenario | Command |
|----------|---------|
| Added new concerts | `/data-refresh` |
| Monthly maintenance | `/data-refresh --full` |
| Quick test | `/data-refresh --quick --dry-run` |
| Before release | `/data-refresh` then `/release` |

---

## Related

- `docs/DATA_PIPELINE.md` — Complete pipeline documentation
- `docs/api-setup.md` — API credential configuration
- `/validate` — Run validation only
- `/context-sync` — Update context files
- `scripts/liner-notes/` — Agentic liner notes pipeline (runs automatically in `build-data` when `ANTHROPIC_API_KEY` is set)
- `/liner-notes` — Agentic blog feed (generated output)
- `/whats-playing` — App changelog
