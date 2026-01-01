# Google Sheets Data Integration Spec

> **Location**: `docs/specs/future/google-sheets-data-integration.md`
> **Status**: Phase 1 Implemented, Phase 2 Planned for v1.2.0
> **Target Version**: v1.2.0
> **Last Updated**: 2026-01-01

---

## Executive Summary

This specification defines the complete data integration strategy for the Morperhaus Concert Archives, using Google Sheets as the **single source of truth** for concert data. The system fetches data at build time, processes it through a multi-stage pipeline, and deploys static JSON files to the production site.

**What this delivers:**
- Reliable, build-time data fetching from Google Sheets
- Graceful error handling with cached fallbacks
- Optional automated rebuild triggers (Phase 2)
- Complete data validation and enrichment pipeline

**What this does NOT include:**
- Runtime API calls to Google Sheets (intentionally avoided for performance/security)
- Client-side data fetching
- Real-time data synchronization

---

## Data Architecture

### Single Source of Truth

**Primary Source:** Google Sheets
**Spreadsheet ID:** `GOOGLE_SHEET_ID` (stored in `.env`)
**Sheet Range:** `Sheet1!A2:Z1000` (configurable via `SHEET_RANGE`)

**Secondary Sources:**
- `docs/inspiration/sampleData.csv` - **CSV export of Google Sheet (backup only, not a data source)**
- `public/data/concerts.json` - Generated output (committed to git as cached fallback)

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     GOOGLE SHEETS                                │
│               (Single Source of Truth)                           │
│                                                                   │
│  Columns:                                                         │
│  Date | Headliner | Genre | Opener | Venue | City,State |       │
│  Who | Reference | [parsed] | Opener_1...Opener_15              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ npm run build-data
                              │ (or npm run fetch-sheet)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              FETCH & PROCESS PIPELINE                            │
│                                                                   │
│  1. fetch-google-sheet.ts                                        │
│     - OAuth 2.0 authentication                                   │
│     - Fetch rows from Google Sheets API                          │
│     - Parse date, venue, openers                                 │
│     - Geocode venues (cache-first)                               │
│     - Generate metadata (stats, date ranges)                     │
│     - Output: public/data/concerts.json                          │
│                                                                   │
│  2. enrich-artists.ts                                            │
│     - Aggregate unique artists from concerts                     │
│     - Fetch metadata from Last.fm / TheAudioDB                   │
│     - Output: public/data/artists-metadata.json                  │
│                                                                   │
│  3. enrich-spotify-metadata.ts (optional)                        │
│     - Fetch album art and top tracks from Spotify               │
│     - Update: public/data/artists-metadata.json                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ git commit & push
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRODUCTION DEPLOYMENT                          │
│                                                                   │
│  - concerts.json (static, cached)                                │
│  - artists-metadata.json (static, cached)                        │
│  - Served from Cloudflare Pages CDN                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Build-Time Integration (Current)

### Status: ✅ Implemented

Phase 1 uses manual script execution to fetch data from Google Sheets during local builds or CI/CD runs.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **Google Sheets Client** | `scripts/utils/google-sheets-client.ts` | OAuth 2.0 client wrapper for Google Sheets API |
| **Fetch Script** | `scripts/fetch-google-sheet.ts` | Main script to fetch and process sheet data |
| **Build Pipeline** | `scripts/build-data.ts` | Orchestrates fetch → enrich → output |
| **Geocoding Service** | `scripts/services/geocoding.ts` | Venue-level coordinate lookup (Google Maps API) |
| **Environment Config** | `.env` | API credentials (not committed to git) |

### Current Workflow

```bash
# Manual data refresh (run locally when concerts are added)
npm run build-data

# This runs:
# 1. tsx scripts/fetch-google-sheet.ts  (fetch from Google Sheets)
# 2. tsx scripts/enrich-artists.ts       (add artist metadata)

# Then commit the updated JSON files
git add public/data/concerts.json public/data/artists-metadata.json
git commit -m "data: Add new concerts from Google Sheets"
git push

# Cloudflare Pages auto-deploys on push to main
```

### Environment Variables Required

```bash
# .env file (not committed)

# Google Sheets API (OAuth 2.0)
GOOGLE_SHEET_ID=1abc123...xyz
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=http://localhost:5173
GOOGLE_REFRESH_TOKEN=1//abc123...

# Google Maps Geocoding API
GOOGLE_MAPS_API_KEY=AIza...

# Sheet Configuration
SHEET_RANGE=Sheet1!A2:Z1000

# Music APIs (optional, for enrichment)
THEAUDIODB_API_KEY=2
LASTFM_API_KEY=your_key_here
SPOTIFY_CLIENT_ID=your_id_here
SPOTIFY_CLIENT_SECRET=your_secret_here
```

**Setup Guide:** See [docs/api-setup.md](../../api-setup.md) for complete OAuth 2.0 configuration instructions.

### Google Sheets Column Mapping

The `GoogleSheetsClient` expects columns in this order:

| Index | Column Name | Example Value | Notes |
|-------|-------------|---------------|-------|
| 0 | Date | `4/27/1984` | Format: M/D/YYYY |
| 1 | Headliner | `Social Distortion` | Main artist |
| 2 | Genre_Headliner | `Punk` | Primary genre |
| 3 | Opener | `The Vandals` | Primary opener (optional) |
| 4 | Venue | `The Roxy` | Venue name |
| 5 | City, State | `West Hollywood, California` | Full city/state |
| 6 | Who | `Morper` | Attendee (unused in app) |
| 7 | Reference | `https://...` | Concert archive link (optional) |
| 8-17 | [Parsed columns] | — | Auto-generated (month, year, etc.) |
| 18-33 | Opener_1...Opener_15 | Additional openers | Up to 16 total openers |

**Important:** This structure is **stable** and should not be reordered without updating the client code.

### Data Validation

The `fetch-google-sheet.ts` script performs these validations:

| Validation | Action on Failure |
|------------|-------------------|
| Missing required env vars | Exit with error message |
| Empty sheet / no data | Log warning, return empty array |
| Invalid date format | Skip row, log error |
| Missing headliner | Skip row |
| Missing venue/city | Use default coordinates (0, 0) |
| Geocoding API failure | Fall back to city-level coordinates |

### Error Handling & Fallbacks

#### Scenario 1: Google Sheets API Unavailable

**What happens:**
1. Script exits with error code 1
2. Local build fails
3. Developer sees error message: `❌ Error fetching Google Sheets data: [details]`

**Fallback:**
- Existing `public/data/concerts.json` remains unchanged (committed to git)
- Production site continues serving cached version
- No data loss

**Recovery:**
1. Check Google Cloud Console for API status
2. Verify OAuth credentials haven't expired
3. Retry `npm run fetch-sheet`

#### Scenario 2: Rate Limiting

**Google Sheets API Limits:**
- **Read quota:** 100 requests per 100 seconds per user
- **Expected usage:** 1 request per fetch (well within limits)

**If rate-limited:**
- Script will fail with 429 error
- Wait 60 seconds and retry

#### Scenario 3: Geocoding API Failure

**What happens:**
- Venue-level geocoding fails (Google Maps API down)
- Script falls back to city-level coordinates (static mapping)
- If city not found, uses (0, 0) coordinates
- Concert still appears in app, just without accurate map marker

**Cost protection:**
- Geocoding uses cache-first strategy (`public/data/geocode-cache.json`)
- Only new venues trigger API calls (~1-5 per year)
- Free tier covers all usage ($200/month credit)

### Cached Fallback Strategy

**Cached Files (committed to git):**
```
public/data/
├── concerts.json              # Primary data file
├── artists-metadata.json      # Enriched artist data
└── geocode-cache.json         # Venue coordinates cache
```

**Why we commit these files:**
1. **Build resilience** - If Google Sheets API fails, production builds succeed
2. **Fast builds** - No API calls needed during Cloudflare Pages builds
3. **Offline development** - Developers can work without API credentials
4. **Historical record** - Git tracks all data changes over time

**Update frequency:**
- These files are updated manually (after running `npm run build-data`)
- Frequency: <10 times per year (per requirements)

---

## Phase 1 Enhancements (Recommended)

### Status: 📋 Planned

These enhancements improve Phase 1 without adding webhook automation.

### Enhancement 1.1: Pre-Build Validation

**Goal:** Catch data errors before committing to production.

**Implementation:**
```typescript
// scripts/validate-concerts.ts

interface ValidationError {
  row: number
  field: string
  message: string
}

async function validateConcerts(): Promise<ValidationError[]> {
  const errors: ValidationError[] = []

  // Check for duplicate concert IDs
  // Check for invalid date formats
  // Check for missing required fields
  // Check for orphaned openers (opener without headliner)
  // Check for venue geocoding failures

  return errors
}
```

**Usage:**
```bash
# Validate before committing
npm run validate-data

# Or auto-validate in build-data.ts
```

### Enhancement 1.2: Detailed Logging

**Goal:** Make troubleshooting easier with structured logs.

**Add to `fetch-google-sheet.ts`:**
```typescript
console.log('📊 Fetch Summary:')
console.log(`   ✅ Successfully processed: ${validConcerts.length}`)
console.log(`   ⚠️  Skipped (invalid date): ${skippedDates.length}`)
console.log(`   ⚠️  Skipped (missing headliner): ${skippedHeadliner.length}`)
console.log(`   🗺️  Geocoded venues: ${geocodedCount}`)
console.log(`   💾 Cached venues: ${cachedCount}`)

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:')
  warnings.forEach(w => console.log(`   - ${w}`))
}
```

### Enhancement 1.3: Diff Report

**Goal:** Show what changed since last fetch.

**Implementation:**
```typescript
// scripts/diff-concerts.ts

import oldData from '../public/data/concerts.json'
import newData from '../public/data/concerts.json'

function generateDiff() {
  const added = newData.concerts.filter(
    c => !oldData.concerts.find(o => o.date === c.date && o.headliner === c.headliner)
  )

  const removed = oldData.concerts.filter(
    c => !newData.concerts.find(n => n.date === c.date && n.headliner === c.headliner)
  )

  const modified = newData.concerts.filter(c => {
    const old = oldData.concerts.find(o => o.id === c.id)
    return old && JSON.stringify(old) !== JSON.stringify(c)
  })

  console.log(`📈 Added: ${added.length}`)
  console.log(`📉 Removed: ${removed.length}`)
  console.log(`📝 Modified: ${modified.length}`)
}
```

---

## Phase 2: Webhook Automation (Future)

### Status: 📋 Planned (v1.2+)

Phase 2 adds automatic rebuilds when the Google Sheet is edited, eliminating manual `npm run build-data` execution.

### Architecture: Google Apps Script → GitHub Action → Cloudflare Pages

```
┌─────────────────────────────────────────────────────────────────┐
│                     GOOGLE SHEETS                                │
│                                                                   │
│  User edits sheet (adds new concert)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ onEdit() trigger
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               GOOGLE APPS SCRIPT                                 │
│                                                                   │
│  - Detects edit in concert data range                            │
│  - Debounces rapid edits (5-minute cooldown)                     │
│  - Sends webhook to GitHub API                                   │
│  - Payload: { ref: "main", trigger: "sheet_edit" }              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTION                                 │
│  (workflow_dispatch trigger)                                     │
│                                                                   │
│  1. Checkout repository                                          │
│  2. Install dependencies (npm ci)                                │
│  3. Run data pipeline (npm run build-data)                       │
│  4. Commit updated JSON files                                    │
│  5. Push to main branch                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ git push
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE PAGES                                │
│                                                                   │
│  - Detects push to main                                          │
│  - Runs npm run build                                            │
│  - Deploys updated site                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 2.1: Google Apps Script Webhook

**File:** `google-sheets-webhook.gs` (lives in Google Sheets Script Editor)

```javascript
// Configuration
const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')
const GITHUB_REPO = 'mmorper/concerts'
const DEBOUNCE_MINUTES = 5

// Track last trigger time to prevent spam
const CACHE_KEY = 'last_webhook_trigger'

function onEdit(e) {
  // Only trigger for edits in data range (rows 2+, columns A-Z)
  const range = e.range
  const sheet = range.getSheet()

  if (sheet.getName() !== 'Sheet1') return
  if (range.getRow() < 2) return // Ignore header row

  // Check debounce
  const cache = CacheService.getScriptCache()
  const lastTrigger = cache.get(CACHE_KEY)

  if (lastTrigger) {
    const elapsed = Date.now() - parseInt(lastTrigger)
    if (elapsed < DEBOUNCE_MINUTES * 60 * 1000) {
      Logger.log(`Debounced: ${Math.round(elapsed / 1000)}s since last trigger`)
      return
    }
  }

  // Trigger GitHub Action
  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sync-data.yml/dispatches`
  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      ref: 'main',
      inputs: {
        trigger: 'sheet_edit',
        timestamp: new Date().toISOString()
      }
    })
  }

  try {
    const response = UrlFetchApp.fetch(url, options)
    Logger.log(`GitHub Action triggered: ${response.getResponseCode()}`)

    // Update debounce cache
    cache.put(CACHE_KEY, Date.now().toString(), DEBOUNCE_MINUTES * 60)
  } catch (error) {
    Logger.log(`Error triggering GitHub Action: ${error}`)
  }
}
```

**Setup:**
1. Open Google Sheet → Extensions → Apps Script
2. Paste code above
3. Create GitHub Personal Access Token with `repo` scope
4. Store token: File → Project properties → Script properties → Add `GITHUB_TOKEN`
5. Set trigger: Triggers → Add Trigger → `onEdit` → From spreadsheet → On edit

#### 2.2: GitHub Action Workflow

**File:** `.github/workflows/sync-data.yml`

```yaml
name: Sync Concert Data from Google Sheets

on:
  workflow_dispatch:
    inputs:
      trigger:
        description: 'Trigger source'
        required: false
        default: 'manual'
      timestamp:
        description: 'Trigger timestamp'
        required: false

jobs:
  sync-data:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Configure environment
        run: |
          echo "GOOGLE_SHEET_ID=${{ secrets.GOOGLE_SHEET_ID }}" >> .env
          echo "GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }}" >> .env
          echo "GOOGLE_CLIENT_SECRET=${{ secrets.GOOGLE_CLIENT_SECRET }}" >> .env
          echo "GOOGLE_REDIRECT_URI=${{ secrets.GOOGLE_REDIRECT_URI }}" >> .env
          echo "GOOGLE_REFRESH_TOKEN=${{ secrets.GOOGLE_REFRESH_TOKEN }}" >> .env
          echo "GOOGLE_MAPS_API_KEY=${{ secrets.GOOGLE_MAPS_API_KEY }}" >> .env
          echo "SHEET_RANGE=${{ secrets.SHEET_RANGE }}" >> .env

      - name: Fetch and process data
        run: npm run build-data

      - name: Check for changes
        id: git-check
        run: |
          git diff --exit-code public/data/ || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit and push changes
        if: steps.git-check.outputs.changed == 'true'
        run: |
          git config user.name "GitHub Action"
          git config user.email "action@github.com"
          git add public/data/*.json
          git commit -m "data: Auto-sync from Google Sheets

          Triggered by: ${{ github.event.inputs.trigger }}
          Timestamp: ${{ github.event.inputs.timestamp }}

          🤖 Generated with GitHub Actions"
          git push

      - name: No changes detected
        if: steps.git-check.outputs.changed != 'true'
        run: echo "No data changes detected. Skipping commit."
```

**Required GitHub Secrets:**
```
Settings → Secrets and variables → Actions → New repository secret

- GOOGLE_SHEET_ID
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI
- GOOGLE_REFRESH_TOKEN
- GOOGLE_MAPS_API_KEY
- SHEET_RANGE
```

#### 2.3: Manual Trigger (Fallback)

Users can also trigger sync manually via GitHub UI:

1. Go to `Actions` tab in GitHub repository
2. Select `Sync Concert Data from Google Sheets` workflow
3. Click `Run workflow` dropdown
4. Click `Run workflow` button

### Security Considerations

| Concern | Mitigation |
|---------|------------|
| **GitHub Token Exposure** | Store in Google Apps Script properties (encrypted at rest) |
| **API Credentials in Actions** | Use GitHub Secrets (encrypted, never logged) |
| **Webhook Spam** | 5-minute debounce prevents rapid triggers |
| **Unauthorized Edits** | OnlySheet editors can trigger (Google auth required) |
| **Failed Builds** | GitHub Action fails gracefully, no data loss (cached JSON persists) |

### Cost Analysis

| Service | Cost | Notes |
|---------|------|-------|
| Google Sheets API | $0 | Within free tier (100 req/100s) |
| Google Apps Script | $0 | Free for personal use |
| GitHub Actions | $0 | 2,000 minutes/month free (each run ~2-3 min) |
| Cloudflare Pages | $0 | 500 builds/month free |

**Expected monthly runs:** 10-20 (based on <10 updates/year)
**Total cost:** $0

---

## Alternative Approaches (Considered & Rejected)

### Alternative 1: Runtime Fetching with Cloudflare Workers

**Architecture:**
- Client requests `/api/concerts` → Worker fetches from Google Sheets → returns JSON
- Credentials stored in Cloudflare environment variables
- KV cache layer (60-minute TTL)

**Why rejected:**
- Slower page loads (API call on every visit)
- Potential rate limiting issues (100 req/100s shared across all users)
- More complex error handling
- Not needed for <10 updates/year

**When to reconsider:**
- If update frequency increases to daily/weekly
- If real-time data becomes a requirement
- If multiple users need to add concerts (not just you)

### Alternative 2: Zapier / IFTTT Integration

**Architecture:**
- Google Sheets → Zapier → Webhook → GitHub Action

**Why rejected:**
- Additional paid service ($19.99/month for webhooks)
- Less control over logic
- Google Apps Script is free and more flexible

**When to reconsider:**
- If you're already using Zapier for other workflows
- If you want a no-code solution

### Alternative 3: Scheduled GitHub Action (Nightly Pull)

**Architecture:**
- Cron schedule runs `npm run build-data` every night at 2am
- Always pulls latest data, regardless of changes

**Why rejected:**
- Wasteful (runs even when no edits)
- Doesn't align with "rarely updated" requirement
- Harder to debug (no clear trigger event)

**When to reconsider:**
- If you want guaranteed daily sync
- If debouncing becomes problematic

---

## CSV Script Deprecation Notes

The following scripts are **CSV-specific** and intended **only** for parsing `docs/inspiration/sampleData.csv` (the CSV export backup of Google Sheets). These should not be used as the primary data pipeline.

### CSV-Only Scripts

| File | Purpose | Status |
|------|---------|--------|
| `scripts/convert-csv-to-json.ts` | Parse CSV export to JSON | ⚠️ Backup only, not primary pipeline |
| `docs/inspiration/sampleData.csv` | CSV export of Google Sheet | ⚠️ Backup only, manually exported |

**When to use `convert-csv-to-json.ts`:**
- Google Sheets API is down for extended period
- You need to work offline without API credentials
- You want to test data pipeline with local CSV edits

**How to use:**
1. Export Google Sheet as CSV → save to `docs/inspiration/sampleData.csv`
2. Run `npm run convert-csv`
3. Output: `public/data/concerts.json`

**Important:** This script does NOT replace `fetch-google-sheet.ts`. It's a fallback for emergencies only.

**Deprecation plan:**
- Phase 1: Keep CSV scripts as-is (fallback safety net)
- Phase 2: After webhook automation is stable, consider removing CSV support
- Phase 3: Archive CSV scripts to `docs/specs/archive/`

---

## Implementation Checklist

### Phase 1 Enhancements (Optional)

- [ ] Create `scripts/validate-concerts.ts` with pre-commit validation
- [ ] Add detailed logging to `fetch-google-sheet.ts`
- [ ] Create `scripts/diff-concerts.ts` to show data changes
- [ ] Update `BUILD.md` to document new validation workflow
- [ ] Test validation with intentionally malformed data

### Phase 2 Webhook Automation (Future)

**Prerequisites:**
- [ ] Verify Google Sheets API credentials are stable (refresh token doesn't expire)
- [ ] Create GitHub Personal Access Token with `repo` scope
- [ ] Test GitHub Action workflow manually first

**Implementation:**
- [ ] Create `.github/workflows/sync-data.yml`
- [ ] Add all required secrets to GitHub repository settings
- [ ] Test workflow with manual trigger
- [ ] Create Google Apps Script webhook code
- [ ] Add `GITHUB_TOKEN` to Script Properties
- [ ] Configure `onEdit` trigger in Apps Script
- [ ] Test end-to-end: Edit sheet → wait 5 min → verify GitHub commit → verify CF deploy

**Validation:**
- [ ] Test debounce logic (rapid edits should only trigger once)
- [ ] Test failed build scenario (invalid data)
- [ ] Test GitHub Action failure (API down)
- [ ] Verify no secrets appear in logs
- [ ] Document troubleshooting steps in this spec

---

## Troubleshooting Guide

### Issue: Google Sheets API Returns 401 Unauthorized

**Symptoms:**
```
❌ Error fetching Google Sheets data: Request failed with status code 401
```

**Causes:**
1. Refresh token expired (rare, but possible after 6 months of inactivity)
2. OAuth consent screen was reset
3. Client ID/Secret changed in Google Cloud Console

**Solution:**
1. Re-run OAuth setup flow (see [api-setup.md](../../api-setup.md))
2. Generate new refresh token
3. Update `.env` file with new token
4. If using Phase 2, update GitHub Secrets

### Issue: Geocoding API Failures

**Symptoms:**
```
⚠️  Geocoding failed for venue "The Roxy": Request failed with status code 429
```

**Causes:**
1. Rate limiting (50 req/second)
2. Daily quota exceeded (unlikely with <10 venues/year)
3. Invalid API key

**Solution:**
1. Check Google Cloud Console → Geocoding API → Quotas
2. Verify `GOOGLE_MAPS_API_KEY` in `.env`
3. If rate-limited, wait 60 seconds and retry
4. Geocoding cache prevents repeated API calls (99% cache hit rate)

### Issue: GitHub Action Not Triggering

**Symptoms:**
- Edit Google Sheet, but no GitHub commit appears after 5 minutes

**Debugging:**
1. Open Apps Script Editor → Executions → Check for errors
2. Verify `GITHUB_TOKEN` is set in Script Properties
3. Check GitHub Action logs: Actions tab → Sync Concert Data
4. Verify webhook payload in Apps Script logs (View → Logs)

**Common fixes:**
- Regenerate GitHub token (may have expired)
- Check debounce cache (may be blocking)
- Verify repository name in Apps Script code

### Issue: Duplicate Concerts After Sync

**Symptoms:**
- Same concert appears twice in `concerts.json`

**Causes:**
- Sheet has duplicate rows
- Date format changed (script sees it as new concert)

**Solution:**
1. Manually deduplicate in Google Sheet
2. Run `npm run build-data` to regenerate JSON
3. Add validation check to Phase 1 enhancements (check for duplicates)

---

## Performance Metrics

### Current Performance (Phase 1)

| Operation | Time | API Calls | Notes |
|-----------|------|-----------|-------|
| `npm run fetch-sheet` | 5-10s | 1 | Single Google Sheets API request |
| Geocoding (all venues) | 15-20s | 77 | One-time setup, then cached |
| Geocoding (new venue) | 1-2s | 1 | Subsequent runs only geocode new venues |
| `npm run build-data` | 20-30s | 1-5 | Depends on new venues + enrichment APIs |
| Total pipeline | 25-35s | — | Acceptable for <10 runs/year |

### Expected Performance (Phase 2)

| Operation | Time | Notes |
|-----------|------|-------|
| Sheet edit → webhook trigger | <5s | Apps Script execution |
| GitHub Action start | 10-30s | Queue time varies |
| GitHub Action run | 2-3 min | Checkout + install + fetch + commit |
| Cloudflare Pages build | 1-2 min | Standard Vite build |
| **Total (edit → live)** | **4-6 min** | Fully automated |

---

## Future Enhancements (v1.3+)

### 3.1: Data Versioning

**Goal:** Track historical changes to concert data.

**Implementation:**
- Store `concerts-{version}.json` snapshots on each sync
- Add version metadata to JSON (`dataVersion`, `previousVersion`)
- Allow rollback to previous versions

### 3.2: Multi-Sheet Support

**Goal:** Support multiple Google Sheets (e.g., separate sheets for different years).

**Implementation:**
- Accept array of sheet IDs in config
- Merge data from multiple sheets
- Handle duplicate concerts across sheets

### 3.3: Incremental Updates

**Goal:** Only fetch rows that changed since last sync.

**Implementation:**
- Use Google Sheets API `changes.list()` endpoint
- Track last sync timestamp
- Only process modified rows

**Benefit:** Faster sync times (5s instead of 30s)

---

## References

- [api-setup.md](../../api-setup.md) - Complete API credential setup guide
- [BUILD.md](../../BUILD.md) - Build process and deployment
- [google-sheets-client.ts](../../../scripts/utils/google-sheets-client.ts) - OAuth client implementation
- [fetch-google-sheet.ts](../../../scripts/fetch-google-sheet.ts) - Main fetch script
- [Google Sheets API Docs](https://developers.google.com/sheets/api/reference/rest)
- [Google Apps Script Triggers](https://developers.google.com/apps-script/guides/triggers)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial specification |

---

**Prepared by:** Lead Developer
**Approved by:** Project Owner
**Status:** Ready for Phase 1 Enhancements & Phase 2 Planning
