# Scheduled Data Pipeline Refresh

> **Status:** Implemented (2026-06-16) — via **GitHub Actions**, not Claude Code scheduled tasks
> **Created:** 2026-03-07
> **Related:** `scripts/build-data.ts`, `docs/DATA_PIPELINE.md`, PR #119, issue #42
>
> **Implementation note:** Shipped as two independent GitHub Actions workflows
> (`.github/workflows/data-refresh.yml` and `liner-notes.yml`) rather than the
> Claude Code scheduled-task approach this spec proposed — the pipeline needs
> puppeteer/sharp/googleapis and a commit-to-git deploy model that fit Actions
> better. Same capability: weekly automated refresh + decoupled liner-notes
> generation, with a concert-count regression guard and failure-email alerting.
> See PR #119 / issue #120 for the activation record.

---

## Overview

Use Claude Code's scheduled task capability to automatically refresh the concert data pipeline on a recurring basis. This eliminates manual `npm run build-data` runs, keeps the site data fresh, and surfaces issues early through automated validation and reporting.

---

## Motivation

Currently, the data pipeline (`npm run build-data`) must be triggered manually. This means:

- New concerts added to the Google Sheet aren't reflected on the site until someone remembers to run the pipeline
- Artist metadata (images, genres, discography) can go stale as upstream APIs update
- Venue photos or names can change without detection
- Setlist data isn't refreshed unless explicitly requested
- SEO files (sitemap, RSS, meta tags, llm.txt) drift out of sync with actual data

A scheduled task automates this entirely, with intelligent reporting so you only need to intervene when something meaningful changes or breaks.

---

## Proposed Schedule

### Weekly Light Refresh (e.g., every Monday)

Runs the core pipeline with expensive API calls skipped:

```bash
npm run build-data -- --skip-venues --skip-discography
```

**What runs:**
1. Fetch Google Sheets (new concerts)
2. Enrich concert genres
3. Validate data
4. Enrich artist metadata (TheAudioDB, Last.fm, Deezer)
5. Enrich audio previews (iTunes, Deezer)
6. Pre-fetch setlists (setlist.fm)
7. Aggregate genres timeline
8. Generate facts
9. Update meta tags, sitemap, RSS

**Why skip venues & discography weekly:**
- Google Places API has per-request costs
- MusicBrainz discography changes infrequently (albums don't release weekly)
- Both are the slowest steps in the pipeline

### Monthly Full Refresh (e.g., 1st of each month)

Runs the complete pipeline with all enrichment:

```bash
npm run build-data
```

**What runs:** All 13 steps including venue metadata (Google Places) and discography (MusicBrainz).

---

## Post-Run Behavior

After each scheduled run, Claude should:

### 1. Diff Detection

```bash
npm run diff-data
```

Compare output files against their previous state to determine what changed.

### 2. Report Generation

Generate a summary of what changed:

```
📊 Weekly Data Refresh - 2026-03-10
════════════════════════════════════

Pipeline: ✅ Completed (all steps passed)
Duration: ~4 minutes

Changes detected:
  + 2 new concerts added (from Google Sheet)
  + 1 new artist enriched (Fontaines D.C.)
  ~ 3 setlists updated
  ~ sitemap.xml regenerated
  ~ rss.xml regenerated

No changes:
  - Artist images (all current)
  - Audio previews (all current)
  - Genre classifications (unchanged)
  - Facts/liner notes (unchanged)

Validation: ✅ All checks passed
```

### 3. Action Based on Results

| Scenario | Action |
|----------|--------|
| No changes detected | Log summary, no further action |
| Changes detected, validation passes | Create a PR with the updated data files |
| Changes detected, validation warns | Create PR with warnings noted in description |
| Pipeline fails | Create a GitHub issue with error details |
| Broken image URLs detected | Flag in PR description for manual review |

### 4. PR Creation (when changes exist)

Create a pull request with:

- **Title:** `data: Weekly refresh - {date}` or `data: Monthly full refresh - {date}`
- **Body:** The report summary above
- **Branch:** `data/refresh-{YYYY-MM-DD}`
- **Labels:** `data`, `automated`

This keeps data updates reviewable — the site owner can glance at the PR, confirm it looks right, and merge.

---

## Files Updated by Pipeline

| File | Content |
|------|---------|
| `public/data/concerts.json` | Concert records |
| `public/data/artists-metadata.json` | Artist images, genres |
| `public/data/venues-metadata.json` | Venue photos, coordinates |
| `public/data/discography.json` | Album data (monthly only) |
| `public/data/setlists-cache.json` | Cached setlists |
| `public/data/genres-timeline.json` | Genre evolution data |
| `public/data/facts.json` | Liner notes statistics |
| `public/sitemap.xml` | Search engine sitemap |
| `public/rss.xml` | RSS feed |
| `public/llm.txt` | LLM-readable stats |
| `public/og-stats.json` | OG image stats |
| `index.html` | Meta tags |

---

## Error Handling

### API Credential Issues

The pipeline already handles missing credentials gracefully (warns and skips). The scheduled task should:

- Note which enrichment steps were skipped due to missing credentials
- Include this in the report so it's visible

### Network Failures

- Retry the full pipeline once after a 60-second delay
- If the retry also fails, create a GitHub issue with the error

### Partial Failures

The pipeline continues past validation warnings. The scheduled task should:

- Capture all warnings from stdout
- Include them in the PR description
- Flag any new warnings that didn't exist in the previous run

---

## Prerequisites

- Claude Code scheduled tasks enabled
- Environment variables configured (`.env` file with API keys)
- GitHub CLI (`gh`) authenticated for PR creation
- Repository write access for the scheduled task runner

---

## Configuration

The scheduled task should be configurable via a simple settings approach:

| Setting | Default | Description |
|---------|---------|-------------|
| Weekly schedule | Monday 6:00 AM | Light refresh cadence |
| Monthly schedule | 1st of month, 6:00 AM | Full refresh cadence |
| Auto-merge | `false` | Whether to auto-merge PRs when validation passes |
| Skip steps | none | Additional steps to skip |
| Notify on no-change | `false` | Whether to report when nothing changed |

---

## Future Enhancements

- **Auto-merge safe PRs:** If validation passes and only data files changed (no schema changes), auto-merge the PR
- **Slack/email notifications:** Send a summary when new concerts are detected
- **Concert anniversary alerts:** When running, check for concerts with anniversaries this week and include in the report
- **Stale image detection:** Periodically HEAD-request artist image URLs to detect broken links
- **Venue name change detection:** Compare Google Places names against stored names during monthly runs (ties into the existing venue name change roadmap item)
