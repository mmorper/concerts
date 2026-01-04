# Data Refresh Pipeline Orchestration

> **Role**: Technical specification for automated data refresh workflows
> **Status**: ✅ **Phase 1 IMPLEMENTED** (v1.5.1) - Enhanced Build Pipeline Complete
> **Status**: 📋 **Phase 2-3 PLANNED** - GitHub Actions automation pending
> **Related Docs**: [setlist-liner-notes.md](./setlist-liner-notes.md), [spotify-enrichment-runbook.md](./spotify-enrichment-runbook.md)

---

## Overview

This spec addresses two interconnected needs:

1. ✅ **Setlist Pre-fetch Automation** - **IMPLEMENTED** via `build-data.ts` orchestrator
2. ✅ **Unified Data Pipeline** - **IMPLEMENTED** - Single command runs all enrichments (Google Sheets → concerts → artists → venues → setlists → Spotify)

**Current State (v1.5.1)**: The enhanced build pipeline (Option 1) is fully implemented and documented in [WORKFLOW.md](../../WORKFLOW.md) and [DATA_PIPELINE.md](../../DATA_PIPELINE.md). All data enrichment scripts now run through a single `npm run build-data` orchestrator with flexible skip flags.

---

## Current State

### Existing Data Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Manual Data Refresh Flow                  │
└─────────────────────────────────────────────────────────────┘

1. npm run build-data          ← Main orchestrator
   ├── npm run fetch-sheet      ← Fetches from Google Sheets
   ├── npm run validate-data    ← Validates concerts.json
   └── npm run enrich           ← Enriches artist metadata

2. npm run enrich-venues        ← Manual (not part of build-data)
3. npm run enrich-spotify       ← Manual (not part of build-data)
4. npm run prefetch:setlists    ← Manual (NEW - not integrated)
5. npm run build                ← Vite production build
```

### What Exists Today

#### Scripts in `package.json`:
```json
{
  "build-data": "tsx scripts/build-data.ts",
  "fetch-sheet": "tsx scripts/fetch-google-sheet.ts",
  "enrich": "tsx scripts/enrich-artists.ts",
  "enrich-spotify": "tsx scripts/enrich-spotify-metadata.ts",
  "enrich-venues": "tsx scripts/enrich-venues.ts",
  "prefetch:setlists": "tsx scripts/prefetch-setlists.ts",
  "validate-data": "tsx scripts/validate-concerts.ts"
}
```

#### Primary Orchestrator: `scripts/build-data.ts`

**What it does:**
- Runs `fetch-google-sheet.ts` - Pulls concert data from Google Sheets
- Runs `validate-concerts.ts` - Validates data integrity
- Runs `enrich-artists.ts` - Fetches artist metadata from TheAudioDB/Last.fm
- Supports `--dry-run` flag for safe testing
- Creates automatic backups with timestamps

**What it doesn't do:**
- ❌ Venue enrichment (Google Places API)
- ❌ Spotify metadata (album art, tracks)
- ❌ Setlist pre-fetching (setlist.fm API)

#### Individual Scripts

| Script | Input | Output | Dependencies | API Calls |
|--------|-------|--------|--------------|-----------|
| `fetch-google-sheet.ts` | Google Sheets | `concerts.json` | Google Sheets API | ~1 |
| `enrich-artists.ts` | `concerts.json` | `artists-metadata.json` | TheAudioDB, Last.fm | ~174 |
| `enrich-venues.ts` | `concerts.json` | `venues-metadata.json` | Google Places API | ~50-100 |
| `enrich-spotify.ts` | `artists-metadata.json` | `artists-metadata.json` | Spotify API | ~522 (174 × 3) |
| `prefetch-setlists.ts` | `concerts.json` | `setlists-cache.json` | setlist.fm API | ~174 |

### Problems with Current Approach

1. **Fragmented workflow** - No single command runs all enrichments
2. **Easy to forget steps** - User must remember the correct sequence
3. **No dependency management** - Scripts don't check if prerequisites exist
4. **Manual scheduling** - No automatic updates when source data changes
5. **Inconsistent state** - Data files can become out of sync

---

## Goals

### Primary Goals
1. **Single-command refresh** - One command to update all data
2. **Intelligent orchestration** - Skip unnecessary API calls when data hasn't changed
3. **Clear visibility** - User knows what's running and why
4. **Flexible automation** - Support both manual and automatic workflows
5. **Safe operations** - Dry-run mode, backups, rollback support

### Non-Goals
- Real-time data syncing (static site generation is sufficient)
- Complex dependency resolution (linear pipeline is fine)
- Distributed processing (all scripts run locally)

---

## Proposed Solutions

### Option 1: Enhanced Build Pipeline ✅ **IMPLEMENTED (v1.5.1)**

**Description**: Extend `build-data.ts` to orchestrate all enrichment scripts.

**Status**: ✅ **COMPLETE** - Fully implemented and in production use

**Implementation**:

```typescript
// scripts/build-data.ts (enhanced)

async function buildData(options: {
  dryRun?: boolean
  skipVenues?: boolean
  skipSpotify?: boolean
  skipSetlists?: boolean
}) {
  const steps = [
    { name: 'Fetch Google Sheets', fn: fetchGoogleSheet },
    { name: 'Validate concerts', fn: validateConcerts },
    { name: 'Enrich artist metadata', fn: enrichArtists },
    { name: 'Enrich venue metadata', fn: enrichVenues, skip: options.skipVenues },
    { name: 'Enrich Spotify data', fn: enrichSpotifyMetadata, skip: options.skipSpotify },
    { name: 'Pre-fetch setlists', fn: prefetchSetlists, skip: options.skipSetlists },
  ]

  for (const step of steps) {
    if (step.skip) {
      console.log(`⏭️  Skipping: ${step.name}`)
      continue
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Running: ${step.name}`)
    console.log('='.repeat(60))

    try {
      await step.fn({ dryRun: options.dryRun })
    } catch (error) {
      console.error(`❌ ${step.name} failed:`, error)
      // Continue with other steps or exit?
      process.exit(1)
    }
  }

  console.log('\n✨ All enrichment steps complete!')
}
```

**Usage**:
```bash
# Full refresh (all data sources)
npm run build-data

# Skip expensive API calls
npm run build-data -- --skip-spotify --skip-venues

# Test run (no file writes)
npm run build-data -- --dry-run

# Minimal refresh (concerts + artists only)
npm run build-data -- --skip-venues --skip-spotify --skip-setlists
```

**Pros**:
- ✅ Single command for full refresh
- ✅ Maintains existing `build-data` convention
- ✅ Backwards compatible (existing scripts still work standalone)
- ✅ Easy to skip expensive operations
- ✅ Supports dry-run mode

**Cons**:
- ❌ Sequential execution (slow for independent operations)
- ❌ No incremental caching (always runs all non-skipped steps)
- ❌ Doesn't check if data has actually changed

**Estimated Implementation Time**: 2-3 hours

---

### Option 2: Smart Incremental Pipeline

**Description**: Pipeline that detects changes and only runs necessary steps.

**Implementation**:

```typescript
// scripts/build-data-incremental.ts

import { createHash } from 'crypto'

interface PipelineState {
  lastRun: string
  checksums: {
    concerts: string
    artistsMetadata: string
    venuesMetadata: string
    setlistsCache: string
  }
}

function computeChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8')
  return createHash('sha256').update(content).digest('hex')
}

async function buildDataIncremental() {
  // Load previous state
  const stateFile = '.pipeline-state.json'
  const prevState: PipelineState = loadState(stateFile)

  // Always fetch from Google Sheets
  await fetchGoogleSheet()

  // Check if concerts.json changed
  const concertsChecksum = computeChecksum('public/data/concerts.json')
  const concertsChanged = concertsChecksum !== prevState.checksums.concerts

  if (concertsChanged) {
    console.log('📊 Concerts data changed - running full enrichment')
    await enrichArtists()
    await enrichVenues()
    await prefetchSetlists()
  } else {
    console.log('✓ Concerts data unchanged - skipping enrichment')
  }

  // Check if Spotify cache is stale (>90 days)
  const artistsMetadataPath = 'public/data/artists-metadata.json'
  const metadata = JSON.parse(fs.readFileSync(artistsMetadataPath, 'utf-8'))
  const lastSpotifyUpdate = new Date(metadata.metadata.lastUpdated)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  if (lastSpotifyUpdate < ninetyDaysAgo) {
    console.log('🎵 Spotify cache stale - refreshing')
    await enrichSpotifyMetadata()
  }

  // Save new state
  saveState(stateFile, {
    lastRun: new Date().toISOString(),
    checksums: {
      concerts: concertsChecksum,
      artistsMetadata: computeChecksum(artistsMetadataPath),
      // ... other checksums
    }
  })
}
```

**Pros**:
- ✅ Only runs necessary steps
- ✅ Faster for small changes
- ✅ Respects API rate limits
- ✅ Smart about expensive operations

**Cons**:
- ❌ More complex implementation
- ❌ State file adds another thing to manage
- ❌ Can be confusing if state gets out of sync

**Estimated Implementation Time**: 4-6 hours

---

### Option 3: Makefile-Based Pipeline

**Description**: Use `make` for dependency-driven builds.

**Implementation**:

```makefile
# Makefile

.PHONY: all clean data venues spotify setlists

# Default target
all: data venues spotify setlists

# Core data pipeline
data: public/data/concerts.json public/data/artists-metadata.json

public/data/concerts.json: scripts/fetch-google-sheet.ts
	@echo "📊 Fetching concert data..."
	npm run fetch-sheet
	npm run validate-data

public/data/artists-metadata.json: public/data/concerts.json scripts/enrich-artists.ts
	@echo "🎤 Enriching artist metadata..."
	npm run enrich

# Venue enrichment
venues: public/data/venues-metadata.json

public/data/venues-metadata.json: public/data/concerts.json scripts/enrich-venues.ts
	@echo "📍 Enriching venue data..."
	npm run enrich-venues

# Spotify enrichment (runs every 90 days)
spotify: public/data/artists-metadata.json
	@if [ "$$(find public/data/artists-metadata.json -mtime +90)" ]; then \
		echo "🎵 Refreshing Spotify data..."; \
		npm run enrich-spotify; \
	else \
		echo "✓ Spotify data fresh (< 90 days)"; \
	fi

# Setlist pre-fetch
setlists: public/data/setlists-cache.json

public/data/setlists-cache.json: public/data/concerts.json scripts/prefetch-setlists.ts
	@echo "🎸 Pre-fetching setlists..."
	npm run prefetch:setlists

# Clean build artifacts
clean:
	rm -f public/data/*.json
	rm -f .pipeline-state.json
```

**Usage**:
```bash
# Full refresh
make all

# Just concerts + artists
make data

# Just setlists
make setlists

# Clean and rebuild
make clean all
```

**Pros**:
- ✅ Industry-standard tool
- ✅ Automatic dependency tracking
- ✅ Only rebuilds what changed
- ✅ Parallel execution support (`make -j4`)
- ✅ Easy to understand dependencies

**Cons**:
- ❌ Requires `make` installed
- ❌ Less portable (Windows compatibility issues)
- ❌ Mixes shell scripting with npm scripts
- ❌ Steeper learning curve for contributors

**Estimated Implementation Time**: 3-4 hours

---

### Option 4: GitHub Actions Workflow

**Description**: Automated scheduled refreshes via CI/CD.

**Implementation**:

```yaml
# .github/workflows/data-refresh.yml

name: Data Refresh Pipeline

on:
  schedule:
    # Run weekly on Sunday at 2 AM UTC
    - cron: '0 2 * * 0'

  workflow_dispatch:
    inputs:
      skip_spotify:
        description: 'Skip Spotify enrichment'
        required: false
        type: boolean
        default: false

jobs:
  refresh-data:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Fetch Google Sheets data
        env:
          GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
          GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
          GOOGLE_REFRESH_TOKEN: ${{ secrets.GOOGLE_REFRESH_TOKEN }}
          GOOGLE_SHEET_ID: ${{ secrets.GOOGLE_SHEET_ID }}
        run: npm run fetch-sheet

      - name: Enrich artist metadata
        env:
          THEAUDIODB_API_KEY: ${{ secrets.THEAUDIODB_API_KEY }}
          LASTFM_API_KEY: ${{ secrets.LASTFM_API_KEY }}
        run: npm run enrich

      - name: Enrich venue metadata
        env:
          GOOGLE_PLACES_API_KEY: ${{ secrets.GOOGLE_PLACES_API_KEY }}
        run: npm run enrich-venues

      - name: Enrich Spotify metadata
        if: ${{ !inputs.skip_spotify }}
        env:
          SPOTIFY_CLIENT_ID: ${{ secrets.SPOTIFY_CLIENT_ID }}
          SPOTIFY_CLIENT_SECRET: ${{ secrets.SPOTIFY_CLIENT_SECRET }}
        run: npm run enrich-spotify

      - name: Pre-fetch setlists
        env:
          SETLISTFM_API_KEY: ${{ secrets.SETLISTFM_API_KEY }}
        run: npm run prefetch:setlists

      - name: Commit updated data
        run: |
          git config user.name "Data Refresh Bot"
          git config user.email "bot@morperhaus.org"
          git add public/data/*.json
          git commit -m "chore: Automated data refresh [skip ci]" || echo "No changes"
          git push

      - name: Trigger deployment
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/${{ secrets.CLOUDFLARE_DEPLOY_HOOK }}"
```

**Usage**:
```bash
# Manual trigger via GitHub UI
# Or automatic weekly refresh

# View logs at:
# https://github.com/YOUR_USERNAME/concerts/actions
```

**Pros**:
- ✅ Fully automated
- ✅ Scheduled updates (weekly/monthly)
- ✅ Manual trigger option
- ✅ No local setup needed
- ✅ Automatic deployment after refresh

**Cons**:
- ❌ Requires GitHub Actions setup
- ❌ Secrets management in GitHub
- ❌ Limited debugging compared to local runs
- ❌ Monthly free tier limits (2000 minutes)

**Estimated Implementation Time**: 2-3 hours (plus secrets configuration)

---

### Option 5: Watch Mode + Git Hook

**Description**: Auto-run refresh when source data changes.

**Implementation**:

```bash
# .git/hooks/pre-commit

#!/bin/bash

# Check if concerts data changed
if git diff --cached --name-only | grep -q "public/data/concerts.json"; then
  echo "🎸 Concerts data changed - running enrichment..."

  npm run enrich
  npm run prefetch:setlists

  # Add updated files to commit
  git add public/data/artists-metadata.json
  git add public/data/setlists-cache.json

  echo "✅ Enrichment complete"
fi

exit 0
```

```json
// package.json
{
  "scripts": {
    "watch:concerts": "nodemon --watch public/data/concerts.json --exec 'npm run enrich && npm run prefetch:setlists'"
  }
}
```

**Pros**:
- ✅ Zero-friction automation
- ✅ Always in sync
- ✅ Works locally
- ✅ Simple implementation

**Cons**:
- ❌ Slows down commits
- ❌ Not all developers may want this
- ❌ Hard to skip when needed
- ❌ Hook needs manual installation per developer

**Estimated Implementation Time**: 1-2 hours

---

## Recommendation Matrix

| Use Case | Recommended Option | Why |
|----------|-------------------|-----|
| **Development** | Option 1 (Enhanced Build) | Simple, flexible, manual control |
| **Production** | Option 4 (GitHub Actions) | Automated, scheduled, hands-off |
| **Team Environment** | Option 3 (Makefile) | Standard tool, parallel execution |
| **Solo Project** | Option 1 + Option 4 | Best of both worlds |
| **Quick Iteration** | Option 5 (Git Hook) | Auto-sync on changes |

---

## Implementation Status

### Phase 1: Enhanced Build Script ✅ **COMPLETE (v1.5.1)**

**Goal**: Single-command local refresh

**Implementation**:
1. ✅ Extended `scripts/build-data.ts` to include all enrichment steps
2. ✅ Added `--skip-*` flags for optional steps: `--skip-validation`, `--skip-venues`, `--skip-spotify`, `--skip-setlists`
3. ✅ Updated documentation in DATA_PIPELINE.md and WORKFLOW.md
4. ✅ Tested full pipeline in production

**Delivered Features**:
- ✅ `npm run build-data` runs all 6 enrichment steps (fetch, validate, artists, venues, spotify, setlists)
- ✅ Flag support: `--skip-venues`, `--skip-spotify`, `--skip-setlists`, `--skip-validation`
- ✅ Dry-run mode: `--dry-run` for safe testing
- ✅ Force refresh: `--force-refresh-setlists` for cache invalidation
- ✅ Automatic credential validation with helpful warnings
- ✅ Progress tracking with step counters
- ✅ Comprehensive error handling and troubleshooting tips
- ✅ Documentation: [DATA_PIPELINE.md](../../DATA_PIPELINE.md) Section 8

### Phase 2: Setlist Integration ✅ **COMPLETE (v1.5.1)**

**Goal**: Always run setlist pre-fetch with data refresh

**Implementation**:
1. ✅ Added `prefetchSetlists()` to build pipeline as Step 6
2. ✅ Incremental caching implemented (only fetches new concerts)
3. ✅ Comprehensive logging for cache hits vs. new fetches
4. ✅ Tested with incremental updates in production

**Delivered Features**:
- ✅ Setlist cache automatically updates when running `build-data`
- ✅ Skips cached setlists (uses existing cache by default)
- ✅ Clear logging: "Used cached: 145, Fetched new: 27, Not found: 2"
- ✅ Force refresh available via `--force-refresh-setlists` flag
- ✅ Documentation: [DATA_PIPELINE.md](../../DATA_PIPELINE.md) Section 6

### Phase 3: GitHub Actions 📋 **PLANNED (Future)**

**Goal**: Automated weekly data refresh

**Status**: Not yet implemented. Manual `npm run build-data` works well for current needs.

**When to implement**:
- When adding concerts becomes more frequent (currently ~5-10/year)
- When maintaining multiple data sources that need regular syncing
- When setlists need regular refresh to catch late additions

**Steps**:
1. Create `.github/workflows/data-refresh.yml`
2. Configure secrets in GitHub
3. Add deployment trigger
4. Test workflow with manual dispatch

**Target Deliverables**:
- Weekly automatic data refresh
- Manual trigger option
- Automatic deployment after refresh
- Notification on failure

**Reference**: Complete GitHub Actions workflow example documented in this spec (see Option 4 above).

### Phase 4: Incremental Optimization 📋 **PARTIALLY COMPLETE**

**Goal**: Only run expensive operations when necessary

**Current State**:
- ✅ **Incremental caching**: Already implemented for setlists (reuses cache)
- ✅ **API credential validation**: Skips steps when credentials missing
- ✅ **Manual skip flags**: User controls which steps run
- ⚠️ **Automatic change detection**: Not implemented (checksum-based)
- ⚠️ **Cache staleness checks**: Not implemented (automatic expiry)

**What's Working**:
- Setlist pre-fetch only fetches new concerts (not in cache)
- Spotify enrichment skips artists with recent data (<90 days via internal cache)
- Venue enrichment skips venues with recent data (<90 days via cache)
- User can manually skip expensive steps: `--skip-venues --skip-spotify`

**Future Enhancements** (if needed):
1. Add checksum-based change detection (only run enrichment if concerts.json changed)
2. Add automatic Spotify cache staleness warnings (>90 days old)
3. Add venue photo expiry detection (>90 days old)
4. Log skip reasons more explicitly

**Decision**: May not be needed. Current approach (manual skip flags + internal caching) works well for solo project with infrequent updates.

---

## Specific: Setlist Pre-fetch Automation

### When Should It Run?

**Option A: Always (Recommended for now)**
- Run with every `npm run build-data`
- Uses incremental caching (only fetches new concerts)
- ~4-5 minutes for full run, <30s for incremental

**Option B: On concerts.json change**
- Checksum-based detection
- Only runs when new concerts added
- Requires state tracking

**Option C: Scheduled (weekly)**
- GitHub Actions cron job
- Catches setlists added to setlist.fm after initial fetch
- Good for historical concerts where setlists surface later

**Option D: Pre-deployment**
- Run before `npm run build`
- Ensures production always has latest cache
- Added to build script

### Recommended Approach

**For Development**:
```bash
# Run manually when needed
npm run prefetch:setlists

# Or as part of full refresh
npm run build-data
```

**For Production** (via GitHub Actions):
```yaml
- name: Build pipeline
  run: |
    npm run build-data          # Includes setlist pre-fetch
    npm run build               # Vite production build
```

**Frequency**:
- **Initial setup**: Run once to populate cache
- **New concerts**: Run after updating concerts.json
- **Maintenance**: Run monthly to catch late-added setlists

---

## Data Refresh Best Practices

### 1. Always Run in Order

```bash
# Correct order (dependencies matter)
npm run fetch-sheet         # 1. Get latest concerts
npm run validate-data       # 2. Check data quality
npm run enrich              # 3. Artist metadata (uses concerts.json)
npm run enrich-venues       # 4. Venue metadata (uses concerts.json)
npm run prefetch:setlists   # 5. Setlist cache (uses concerts.json)
npm run enrich-spotify      # 6. Spotify data (uses artists-metadata.json)
```

### 2. Use Dry-Run for Testing

```bash
# Test without writing files
npm run build-data -- --dry-run
```

### 3. Review Diff After Refresh

```bash
npm run diff-data           # Shows what changed
```

### 4. Keep Backups

- All scripts automatically create `.backup.TIMESTAMP` files
- Keep at least 10 backups (configurable)
- Use `npm run diff-data` to review changes

### 5. Mind API Rate Limits

| Service | Rate Limit | Batch Size | Estimated Time |
|---------|-----------|------------|----------------|
| Google Sheets | 100 req/100s | 1 request | <1s |
| TheAudioDB | 2 req/sec | 174 artists | ~90s |
| Google Places | 1 req/sec | ~50 venues | ~50s |
| setlist.fm | 0.67 req/sec | 174 concerts | ~260s (4-5 min) |
| Spotify | 3 req/sec | 174 × 3 calls | ~180s (3 min) |

**Total full refresh**: ~10-12 minutes

---

## Open Questions

1. **Should venue enrichment be part of the default pipeline?**
   - Pro: Always up-to-date venue photos
   - Con: Google Places API costs money

2. **How often should Spotify data refresh?**
   - Current: 90-day cache
   - Alternative: Never (album art rarely changes)

3. **Should we notify on enrichment failures?**
   - Email alerts?
   - GitHub issue creation?
   - Slack webhook?

4. **Should setlist cache have an expiry?**
   - Current: Never expires (historical data immutable)
   - Alternative: 30-day expiry to catch corrections on setlist.fm

---

## Success Metrics

After implementation, we should measure:
- ✅ **Time to refresh** - Target <5 minutes for incremental, <15 min for full
- ✅ **API call efficiency** - % of cached vs. fetched data
- ✅ **Error rate** - % of successful enrichments
- ✅ **Developer friction** - Commands needed for full refresh (target: 1)

---

## Implementation Summary & Next Steps

### What's Been Implemented ✅

**v1.5.1 (Current State)**:
1. ✅ **Enhanced Build Pipeline** - Complete single-command orchestrator
2. ✅ **Setlist Pre-fetch Integration** - Automatic incremental caching
3. ✅ **Skip Flags** - Full control over which steps run
4. ✅ **Dry-Run Mode** - Safe preview without file writes
5. ✅ **API Validation** - Automatic credential checking
6. ✅ **Comprehensive Documentation** - User guides and troubleshooting

**Usage Today**:
```bash
# Typical workflow (add new concerts)
npm run build-data -- --skip-venues --skip-spotify

# Full refresh (monthly maintenance)
npm run build-data

# Safe testing
npm run build-data -- --dry-run
```

### Future Enhancements (Optional)

**Phase 3: GitHub Actions Automation** (Priority: Low)
- **When**: If concert additions become frequent enough to warrant automation
- **Effort**: 2-3 hours setup + secrets configuration
- **Benefit**: Hands-off weekly data refresh
- **Tradeoff**: Adds complexity, requires GitHub Actions monitoring

**Phase 4: Incremental Optimization** (Priority: Low)
- **When**: If API quota becomes a concern or builds get too slow
- **Effort**: 4-6 hours for checksum detection + state management
- **Benefit**: Faster builds, lower API usage
- **Tradeoff**: More complex mental model, state file to manage

**Current Recommendation**: ✅ **No immediate action needed**. The enhanced build pipeline (Phase 1-2) handles all requirements for a solo project with infrequent data updates (5-10 concerts/year). Consider Phase 3-4 if:
- Concert additions increase to weekly frequency
- Multiple collaborators need automated workflows
- API costs become a concern
- Monthly manual refreshes feel burdensome

---

## Appendix: Script Dependency Graph

```
concerts.json
├─→ artists-metadata.json ──→ [Spotify enrichment]
├─→ venues-metadata.json
└─→ setlists-cache.json

Google Sheets
└─→ concerts.json ──→ validate
                 ├─→ enrich-artists ──→ enrich-spotify
                 ├─→ enrich-venues
                 └─→ prefetch-setlists
```

**Key insight**: Most enrichments depend on `concerts.json`, so running them in parallel is possible (except Spotify, which needs `artists-metadata.json` first).

---

## Related Documentation

- [Setlist Liner Notes Spec](./setlist-liner-notes.md) - Feature requirements for setlist display
- [Spotify Enrichment Runbook](./spotify-enrichment-runbook.md) - How to run Spotify enrichment
- [Google Sheets Integration](./google-sheets-data-integration.md) - Primary data source
- [Data Normalization Architecture](./data-normalization-architecture.md) - Name matching logic

---

## Files Modified

**Implemented (v1.5.1)**:
- ✅ [`scripts/build-data.ts`](../../scripts/build-data.ts) - Enhanced orchestrator with 6-step pipeline
- ✅ [`scripts/prefetch-setlists.ts`](../../scripts/prefetch-setlists.ts) - Integrated into pipeline
- ✅ [`docs/DATA_PIPELINE.md`](../../DATA_PIPELINE.md) - Complete user guide (Section 8)
- ✅ [`docs/WORKFLOW.md`](../../WORKFLOW.md) - Developer workflow (Phase 6)
- ✅ [`package.json`](../../package.json) - Updated `build-data` script

**Not Created (Future phases)**:
- `.github/workflows/data-refresh.yml` - GitHub Actions automation (Phase 3)
- `scripts/build-data-incremental.ts` - Smart change detection (Phase 4, optional)
- `.pipeline-state.json` - State file for incremental builds (Phase 4, optional)

---

**Last Updated**: 2026-01-04
**Author**: Claude (with user guidance)
**Status**:
- ✅ **Phase 1-2**: IMPLEMENTED and DOCUMENTED (v1.5.1)
- 📋 **Phase 3-4**: PLANNED (optional future enhancements)
