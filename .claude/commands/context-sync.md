# /context-sync — Update Context Files

Synchronize `.claude/context.md` and `.claude/config.json` with current project state. Pulls latest commits, updates stats, and refreshes metadata.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--dry-run` | No | false | Preview changes without writing |
| `--commits-only` | No | false | Only update recent commits section |
| `--stats-only` | No | false | Only update data stats |

**Examples:**
```
/context-sync                # Full sync
/context-sync --dry-run      # Preview all changes
/context-sync --commits-only # Just refresh commit list
```

---

## What Gets Updated

### CLAUDE.md

| Section | Source | Update Logic |
|---------|--------|--------------|
| Version + stats line | `package.json`, `concerts.json` | `v{VERSION} \| {CONCERTS} concerts, {ARTISTS} artists, {VENUES} venues` |

### context.md

| Section | Source | Update Logic |
|---------|--------|--------------|
| Version line | `package.json` | Read `version` field |
| Last Sync date | Current date | Today's date |
| Data stats | `concerts.json` | Count concerts, artists, venues |
| Recent Commits | `git log` | Last 10 commits |
| Last updated footer | Current date | Today's date |

### config.json

| Field | Source | Update Logic |
|-------|--------|--------------|
| `version.current` | `package.json` | Read `version` field |
| `status.lastContextSync` | Current date | Today's date |
| `status.lastCommit` | `git log` | Most recent commit message + hash |

---

## Workflow

### Step 1: Gather Current State

**Run these commands:**

```bash
# Get version from package.json
VERSION=$(cat package.json | jq -r '.version')

# Get concert count
CONCERTS=$(cat public/data/concerts.json | jq '.concerts | length')

# Get unique headliners
HEADLINERS=$(cat public/data/concerts.json | jq '[.concerts[].headliner] | unique | length')

# Get total artists (headliners + openers)
TOTAL_ARTISTS=$(cat public/data/concerts.json | jq '[.concerts[].headliner, .concerts[].openers[]] | unique | length')

# Get venue count
VENUES=$(cat public/data/concerts.json | jq '[.concerts[].venue] | unique | length')

# Get year range
FIRST_YEAR=$(cat public/data/concerts.json | jq '[.concerts[].year] | min')
LAST_YEAR=$(cat public/data/concerts.json | jq '[.concerts[].year] | max')

# Get last 10 commits
COMMITS=$(git log -10 --pretty=format:'- `%h` - %s')

# Get most recent commit
LAST_COMMIT=$(git log -1 --pretty=format:'%s (%h)')
```

---

### Step 2: Detect Changes

Compare gathered values against current files:

```
📊 Current State vs Files
═══════════════════════════

Version:
  package.json:  {VERSION}
  context.md:    {CONTEXT_VERSION}
  config.json:   {CONFIG_VERSION}
  
Data Stats:
  Concerts:      {CONCERTS} (context.md shows: {OLD_CONCERTS})
  Headliners:    {HEADLINERS} (context.md shows: {OLD_HEADLINERS})
  Total Artists: {TOTAL_ARTISTS} (context.md shows: {OLD_ARTISTS})
  Venues:        {VENUES} (context.md shows: {OLD_VENUES})
  Years:         {FIRST_YEAR}-{LAST_YEAR}

Last Sync:
  config.json:   {LAST_SYNC}
  Today:         {TODAY}

Commits:
  Last in context.md: {LAST_RECORDED_COMMIT}
  Actual last:        {LAST_COMMIT}
```

**🔵 CHECKPOINT: Show detected changes**

> **Changes detected:**
> - Version: 1.9.0 → 1.10.0
> - Concerts: 178 → 182 (+4)
> - Last sync: 2026-01-05 → 2026-01-06
> - 3 new commits since last sync
>
> Apply these updates? (yes / no)

---

### Step 3: Update context.md

**Version line (line ~5):**
```markdown
**Version:** v{VERSION} (Production)
```

**Last Sync line (line ~6):**
```markdown
**Last Sync:** {YYYY-MM-DD}
```

**Data stats (line ~42):**
```markdown
**Data:** {CONCERTS} concerts ({FIRST_YEAR}-{LAST_YEAR}), {TOTAL_ARTISTS} artists ({HEADLINERS} headliners), {VENUES} venues
```

**Recent Commits section (line ~152-165):**
```markdown
## Recent Commits (Last 10)

- `{HASH1}` - {MESSAGE1}
- `{HASH2}` - {MESSAGE2}
...
```

**Footer (last line):**
```markdown
*Last updated: {YYYY-MM-DD} by Claude Code*
```

---

### Step 4: Update config.json

**Update these fields:**

```json
{
  "version": {
    "current": "{VERSION}"
  },
  "status": {
    "lastContextSync": "{YYYY-MM-DD}",
    "lastCommit": "{COMMIT_MESSAGE} ({HASH})"
  }
}
```

---

### Step 5: Preview & Confirm

**If `--dry-run`:**

```
📝 Dry Run Summary
═══════════════════

CLAUDE.md changes:
  - Line 6: Version + stats → v{VERSION} | {CONCERTS} concerts, {ARTISTS} artists, {VENUES} venues

context.md changes:
  - Line 5: Version → v{VERSION}
  - Line 6: Last Sync → {DATE}
  - Line 42: Data stats updated
  - Lines 152-165: Recent commits refreshed
  - Footer: Updated timestamp

config.json changes:
  - version.current → {VERSION}
  - status.lastContextSync → {DATE}
  - status.lastCommit → {COMMIT}

🏁 Dry run complete. No files modified.
```

**If normal run:**

Write changes, then confirm:

```
✅ Context files synchronized!

Updated:
  - CLAUDE.md
  - .claude/context.md
  - .claude/config.json

Summary:
  - Version: v{VERSION}
  - Concerts: {CONCERTS}
  - Artists: {TOTAL_ARTISTS} ({HEADLINERS} headliners)
  - Venues: {VENUES}
  - Last commit: {LAST_COMMIT}
```

---

## Partial Sync Options

### `--commits-only`

Only updates:
- Recent Commits section in `context.md`
- `status.lastCommit` in `config.json`

Useful after a flurry of commits without data changes.

### `--stats-only`

Only updates:
- Data stats line in `context.md`

Useful after data refresh without version bump.

---

## When to Run

**Run `/context-sync` after:**
- Data refresh (`npm run build-data`)
- Multiple commits during development
- Before starting a new feature (ensures fresh context)
- After a release (if you forgot during `/release`)

**Don't need to run:**
- After `/release` (it updates context.md automatically)
- For single-file changes that don't affect stats

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "concerts.json not found" | Data not built | Run `npm run build-data` first |
| "package.json parse error" | Invalid JSON | Fix package.json |
| "git log failed" | Not a git repo | Initialize git or check directory |
| "context.md structure changed" | Unexpected format | Manual update or reset to template |

---

## Related

- `/release` — Full release workflow (includes context update)
- `CLAUDE.md` — Project instructions for Claude Code
- `.claude/context.md` — Project context file
- `.claude/config.json` — Project configuration
