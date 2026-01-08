# /changelog - Create Changelog Entry

Draft a changelog entry for `src/data/changelog.json`. Can be used standalone or as part of `/release`.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--version` | No | (prompted) | Version string, e.g., `1.9.1` |
| `--dry-run` | No | false | Output entry without writing file |

## Output

Writes new entry to top of `releases` array in `src/data/changelog.json`.

---

## Workflow

### Step 1: Gather Info

Prompt for each field:

**Version** (if not provided via `--version`):
> What version is this entry for? (e.g., 1.9.1, no 'v' prefix)

**Release type:**
> Feature or Bugfix?

**Title:**
> Short title for this release (e.g., "Artist Search", "Tooltip Fix")

**Description:**
> 1-2 sentence summary. Lead with user benefit.
>
> **Voice:** Write as a product marketer for concert explorers—warm, benefit-focused, emotionally resonant. These entries appear in `/liner-notes` for people exploring their music memories.
>
> See `.claude/readme-maintenance.md` → "Voice & Tone Guidelines" for full guidance.
>
> ✅ Good: "Click any venue marker to explore its full concert history"
> ✅ Good: "Now you can trace how your taste evolved decade by decade"
> ❌ Bad: "Implemented cross-scene navigation using Zustand store"
> ❌ Bad: "Added venue click handler with navigation"

**Highlights** (features only):
> List 2-4 user-visible improvements (one per line):

**Route:**
> Deep link for changelog card (e.g., `/?scene=artists`)
> Leave empty if not applicable.

---

### Step 2: Validate

Check existing changelog:
```bash
node -e "require('./src/data/changelog.json')" || exit 1
```

Check version doesn't already exist:
```bash
cat src/data/changelog.json | jq -e ".releases[] | select(.version == \"$VERSION\")" && echo "❌ Version already exists" && exit 1
```

---

### Step 3: Build Entry

Construct JSON:

```json
{
  "version": "{VERSION}",
  "date": "{YYYY-MM-DD}",
  "title": "{TITLE}",
  "description": "{DESCRIPTION}",
  "route": "{ROUTE}",
  "highlights": ["{HIGHLIGHT_1}", "{HIGHLIGHT_2}"]
}
```

**Rules:**
- `version`: No 'v' prefix
- `date`: Today, YYYY-MM-DD format
- `highlights`: Empty array `[]` acceptable for bugfixes

---

### Step 4: Preview

Show formatted entry:

```
📝 Changelog Entry Preview
──────────────────────────
Version:     {VERSION}
Date:        {DATE}
Title:       {TITLE}
Description: {DESCRIPTION}
Route:       {ROUTE}
Highlights:
  • {HIGHLIGHT_1}
  • {HIGHLIGHT_2}
```

> Write to changelog.json? (yes / edit / cancel)

**If `--dry-run`:** Show preview and exit.

---

### Step 5: Write

Insert at top of `releases` array in `src/data/changelog.json`.

```bash
# Validate JSON after write
node -e "require('./src/data/changelog.json')"
```

> ✅ Entry added to changelog.json

---

## Standalone Usage

Create entry without full release:
```
/changelog --version 1.9.1
```

Draft entry to review later:
```
/changelog --dry-run
```

---

## Related

- `.claude/version-management.md` → Version format rules
- `/release` → Full release workflow (calls this command)
