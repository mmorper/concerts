# Automated Venue Photo Refresh via GitHub Actions

**Status:** Completed
**Implemented Version:** v3.8.2
**Priority:** High
**Complexity:** Low
**Dependencies:** None

---

> ## ⚠️ Amendment — 2026-08-05 (#252)
>
> **The failure model below is wrong, and the correction matters for anything
> built on top of it.** The spec as written was implemented and works; this note
> corrects its stated *premise*, not its outcome. Left in place rather than
> rewritten, since the reasoning it drove is still visible in the code.
>
> **Claimed:** Google Places photo URLs carry embedded tokens that "expire after
> approximately 10-14 days," so a weekly refresh stays ahead of them.
>
> **Observed** (all three venue-sourced liner notes, checked 2026-08-05):
>
> | published  | age  | status  |
> | ---------- | ---- | ------- |
> | 2026-01-02 | 215d | **200** |
> | 2026-07-06 | 30d  | **403** |
> | 2026-07-20 | 16d  | **200** |
>
> A 215-day-old URL was healthy while a 30-day-old one was dead. **Age does not
> predict breakage.** Resolved `lh3.googleusercontent.com` URLs are long-lived;
> they die when the underlying photo is *unpublished from the place listing*.
>
> **Consequences:**
>
> - This is a **content event, not an expiry clock.** No refresh cadence and no
>   TTL can prevent it — only detection can catch it. `photoCacheExpiry`
>   (`enrich-venues.ts`, written but never read) cannot be tuned into a fix.
> - The comment in `google-places-client.ts` calling the resolved CDN URL
>   "stable" and "permanent" is inaccurate for the same reason.
> - The weekly cadence this spec established is still correct — `enrich-venues`
>   re-resolves and force-refreshes Place Details each run, which is why venue
>   metadata self-heals. The gap was **downstream**: liner notes froze a copy of
>   the resolved URL and never revisited it.
>
> See #252 and `docs/LINER_NOTES_PIPELINE.md` → "Stage 5c: image refresh".

---

## Executive Summary

Implement a fully autonomous GitHub Actions workflow that refreshes venue photo URLs from Google Places API every 7 days. This solves the critical issue where venue images break after ~10-14 days due to Google's time-limited photo tokens.

**Problem it solves:** Google Places API (new) returns photo URLs with embedded access tokens that expire after approximately 10-14 days. Our current implementation caches these URLs for 90 days in `venues-metadata.json`, causing all venue photos to fail with 400 Bad Request errors once tokens expire.

**User experience enhancement:** Venue popups in the Geography scene will consistently display photos without manual intervention. Users browsing venue details will see images load reliably.

**Product fit:** This is infrastructure/maintenance work that enables the Geography scene to function as designed. It's a foundational requirement for reliable venue photo display, not a user-facing feature.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Automated Venue Photo Refresh workflow for Morperhaus Concerts.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth
- Ask clarifying questions if anything is ambiguous

**Feature Overview:**
- Create GitHub Actions workflow that runs every 7 days
- Automatically executes `npm run enrich-venues` to refresh venue photo URLs
- Commits updated JSON files back to repository
- Requires zero manual intervention once configured

**Key References:**
- Full Design Spec: docs/specs/future/global-venue-photo-refresh.md
- Related Issue: https://github.com/mmorper/concerts/issues/1
- Data Pipeline: docs/DATA_PIPELINE.md
- Existing Script: scripts/enrich-venues.ts
- Places Client: scripts/utils/google-places-client.ts

**Implementation Approach:**
- Window 1: Create workflow file, configure secrets, test manual trigger, verify auto-commit

**Design Philosophy:**
Set-it-and-forget-it automation. No human should ever need to manually refresh venue photos again.

**Key Technical Details:**
- Cron schedule: `0 0 */7 * *` (every 7 days at midnight UTC)
- Commits as `github-actions[bot]`
- Uses built-in `GITHUB_TOKEN` for git operations
- Requires `GOOGLE_PLACES_API_KEY` secret

**Files to Create:**
- `.github/workflows/refresh-venue-photos.yml` (~60 LOC)

**Files to Modify:**
- None (workflow operates on existing scripts)

Let's start by creating the workflow file. Should I begin by drafting the YAML configuration?
```

---

## Design Philosophy

**Invisible automation.** The system should maintain itself without user awareness. Venue photos stay fresh, commits appear in git history from the bot, and deploys happen automatically. The only visible artifact is reliability: images always load.

**Fail-safe defaults.** If the workflow fails (API quota exceeded, network issues), it should:
1. Not break the existing site
2. Log clear error messages
3. Retry on next scheduled run
4. Alert via GitHub Actions UI (no external monitoring needed initially)

---

## Technical Implementation

### Workflow Architecture

**File:** `.github/workflows/refresh-venue-photos.yml`

**Triggers:**
1. **Scheduled:** `cron: '0 0 */7 * *'` (every 7 days at midnight UTC)
2. **Manual:** `workflow_dispatch` (allows on-demand runs via GitHub UI)

**Jobs:**
- `refresh-venues` — Single job that fetches, commits, pushes

**Steps:**
1. Checkout repository
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Run enrichment script with API key
5. Configure git identity as `github-actions[bot]`
6. Stage modified files
7. Commit if changes detected
8. Push to `main` branch

### Workflow YAML Structure

```yaml
name: Refresh Venue Photos

on:
  schedule:
    - cron: '0 0 */7 * *'  # Every 7 days at midnight UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  refresh-venues:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Refresh venue photos
        run: npm run enrich-venues
        env:
          GOOGLE_PLACES_API_KEY: ${{ secrets.GOOGLE_PLACES_API_KEY }}

      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/venues-metadata.json public/data/venue-photos-cache.json
          git diff --staged --quiet || git commit -m "data: refresh venue photos [automated]"
          git push
```

### Git Commit Strategy

**Commit message format:**
```
data: refresh venue photos [automated]
```

**Why this format:**
- Prefix `data:` follows project convention for data updates
- Suffix `[automated]` clearly indicates bot-generated commit
- No co-authoring needed (this isn't code written by Claude)

**Files committed:**
- `public/data/venues-metadata.json` — Updated photo URLs and metadata
- `public/data/venue-photos-cache.json` — Fresh Places API cache

**Idempotency:**
The `git diff --staged --quiet || git commit` pattern ensures:
- No commit if no changes (e.g., all venues still have valid photos)
- Commit only when files actually change
- No empty commits in git history

### Secret Management

**Required secret:**
- `GOOGLE_PLACES_API_KEY` — Must be added to repository secrets

**Setup location:**
- GitHub → Repository Settings → Secrets and variables → Actions → New repository secret

**Security:**
- Secret never appears in logs
- Only accessible within workflow via `${{ secrets.GOOGLE_PLACES_API_KEY }}`
- Not exposed to pull requests from forks

### Deployment Integration

**Existing behavior:**
Cloudflare Pages auto-deploys on every push to `main`.

**Expected flow:**
1. Workflow commits updated JSON files
2. Push to `main` triggers Cloudflare build
3. New site version deploys with fresh photo URLs
4. No manual intervention needed

**Fallback:**
If auto-deploy is disabled, user can manually trigger deploy from Cloudflare dashboard.

---

## Testing Strategy

### Manual Testing Checklist

**Before merging:**
- [ ] Workflow file passes YAML validation
- [ ] `GOOGLE_PLACES_API_KEY` secret is configured in GitHub
- [ ] Manual workflow trigger runs successfully
- [ ] Script completes without errors
- [ ] Files are committed with correct message format
- [ ] Commit appears in git history from `github-actions[bot]`
- [ ] Cloudflare deploy triggers automatically
- [ ] Venue photos load on production site

**Post-deployment monitoring:**
- [ ] First scheduled run executes after 7 days
- [ ] Subsequent runs continue on schedule
- [ ] No failed workflow runs in Actions tab
- [ ] Commit history shows regular bot commits

### Test Procedure

**Step 1: Manual trigger test**
1. Push workflow file to `main`
2. Go to Actions tab → "Refresh Venue Photos" workflow
3. Click "Run workflow" → select `main` branch
4. Wait for completion (should take ~2-3 minutes)
5. Verify success status (green checkmark)

**Step 2: Verify commit**
```bash
git pull
git log -1 --oneline
# Should show: "data: refresh venue photos [automated]"
```

**Step 3: Verify deploy**
1. Check Cloudflare Pages dashboard
2. Confirm new deployment started
3. Wait for deploy completion
4. Visit site: `https://concerts.morperhaus.org/?scene=geography&venue=pacific-amphitheatre`
5. Verify venue photo loads

**Step 4: Validate JSON structure**
```bash
# Check that photo URLs were updated
jq '.["pacific-amphitheatre"].photoUrls' public/data/venues-metadata.json

# Check that cache was updated
jq 'keys | length' public/data/venue-photos-cache.json
```

### Error Scenarios

| Scenario | Expected Behavior | Recovery |
|----------|-------------------|----------|
| API quota exceeded | Workflow fails, logs error, existing photos still work | Wait for quota reset, retry manually |
| API key invalid | Workflow fails immediately | Update secret, retry |
| Git push fails | Workflow fails, no commit made | Check branch protection rules |
| Network timeout | Workflow fails, logs timeout | Automatic retry on next schedule |
| No changes detected | Workflow succeeds, no commit | Normal (photos still valid) |

---

## Implementation Plan

### Phase 1: Workflow Creation

**Files to Create:**
- `.github/workflows/refresh-venue-photos.yml` (~60 lines)

**Tasks:**
1. Create workflow file with cron schedule and manual trigger
2. Configure checkout, Node.js setup, dependency installation
3. Add enrichment script execution with API key injection
4. Configure git identity and commit logic
5. Test YAML syntax validity

**Acceptance Criteria:**
- [ ] Workflow file exists and is valid YAML
- [ ] All required actions are pinned to stable versions
- [ ] Secret reference is correct (`${{ secrets.GOOGLE_PLACES_API_KEY }}`)
- [ ] Git commit pattern prevents empty commits

### Phase 2: Secret Configuration & Testing

**Tasks:**
1. Document secret setup in implementation notes
2. Add `GOOGLE_PLACES_API_KEY` to GitHub secrets (user action)
3. Trigger workflow manually via GitHub UI
4. Monitor workflow execution logs
5. Verify commit and push succeed
6. Confirm Cloudflare deploy triggers

**Acceptance Criteria:**
- [ ] Secret is configured correctly
- [ ] Manual workflow run succeeds
- [ ] Commit appears in git history
- [ ] Venue photos load on production

### Phase 3: Documentation

**Files to Modify:**
- `docs/DATA_PIPELINE.md` — Add section on automated refresh

**Tasks:**
1. Document workflow schedule and purpose
2. Add troubleshooting guide for failed runs
3. Note secret configuration requirement
4. Update pipeline diagram if applicable

**Acceptance Criteria:**
- [ ] Pipeline doc mentions automated refresh
- [ ] Secret setup instructions are clear
- [ ] Troubleshooting steps are actionable

---

## Monitoring & Maintenance

### How to Check Workflow Status

**GitHub UI:**
1. Go to repository → Actions tab
2. Select "Refresh Venue Photos" workflow
3. View run history (should show runs every 7 days)

**Signs of health:**
- Green checkmarks on all runs
- Commits appear every 7 days
- Venue photos load on site

**Signs of failure:**
- Red X on workflow runs
- No commits for >7 days
- 400 Bad Request errors on venue photos

### Manual Intervention Scenarios

**When to manually trigger:**
1. Photos break before scheduled run (e.g., after 10 days but before next 14-day run)
2. API quota was exceeded during scheduled run
3. Testing after secret rotation

**How to manually trigger:**
1. Go to Actions → "Refresh Venue Photos"
2. Click "Run workflow"
3. Select `main` branch
4. Click "Run workflow" button
5. Monitor execution in real-time

**When to update secret:**
- API key rotates (Google security policy change)
- Key is compromised
- Switching to different Google Cloud project

### Cost Considerations

**GitHub Actions:**
- Free tier: 2,000 minutes/month for public repos
- This workflow: ~3 minutes per run
- Monthly usage: ~13 minutes (4 runs × 3 min)
- Well within free tier

**Google Places API:**
- Text Search: $32 per 1,000 requests
- Place Details: $17 per 1,000 requests
- This workflow: ~132 requests per run (66 venues × 2 API calls)
- Monthly cost: ~$6.50 (4 runs × 132 requests × $0.049 per pair)
- Annual cost: ~$78

---

## Future Enhancements

### Phase 2 Improvements (Post-MVP)

**1. Failure notifications**
- Send GitHub notification on workflow failure
- Or integrate with Discord/Slack webhook
- Avoid email spam for transient failures

**2. Differential refresh** — ⚠️ *superseded, see the amendment at the top*
- ~~Only refresh venues with expired tokens (check `photoCacheExpiry`)~~
- Reduce API calls from 132 to ~20-30 per run
- Lower monthly cost to ~$2-3

  This rested on the same disproven premise: there is no "expired token" to
  check for, and `photoCacheExpiry` was removed in #256. If differential
  refresh is revisited, the selector has to be *observed* liveness — HEAD the
  stored URL, which is free — not an expiry timestamp.

**3. Dry-run mode**
- Add workflow input: `dry-run: true`
- Preview changes without committing
- Useful for testing secret rotation

**4. Refresh frequency optimization**
- Monitor actual token expiration patterns
- Adjust cron schedule if tokens last longer/shorter than 10 days
- Could move to 10-day schedule if 7 days is too frequent

**5. Stale photo detection**
- Check for 400 errors in production logs
- Trigger emergency refresh if failures detected
- Implement via Cloudflare Workers analytics

---

## Questions for Review

**None.** This is a straightforward infrastructure task with a well-defined solution.

**Post-implementation question:**
- After first scheduled run (7 days), review logs to confirm token refresh frequency is appropriate. Adjust cron schedule if needed.

---

## Revision History

- **2026-02-02:** Initial specification created
- **Version:** 1.0.0
- **Author:** Claude (via /spec command)
- **Status:** Planned
- **Related Issue:** [#1 - Venue photos broken](https://github.com/mmorper/concerts/issues/1)
