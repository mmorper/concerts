# /hotfix - Emergency Patch Workflow

Streamlined workflow for urgent bug fixes. Faster than `/release` with fewer prompts.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--message` | No | - | Commit message (skips prompt) |
| `--no-push` | No | false | Commit but don't push |

**Examples:**
```
/hotfix                              # Interactive
/hotfix --message "Fix tooltip z-index"
/hotfix --no-push                    # Local only
```

---

## When to Use

| Scenario | Use `/hotfix` | Use `/release` |
|----------|---------------|----------------|
| Production bug | ✅ | |
| Typo in UI | ✅ | |
| Missing null check | ✅ | |
| New feature | | ✅ |
| Multiple changes | | ✅ |
| ROADMAP update needed | | ✅ |

**Rule of thumb:** If it's a single fix that needs to ship now, use `/hotfix`.

---

## Workflow

### Step 1: Pre-Flight Check

```bash
git status
```

**Check:**
- ✅ On main branch (or create hotfix branch)
- ✅ Has uncommitted changes to commit
- ✅ No unrelated staged files

**If not on main:**
> ⚠️ Not on main branch (currently on `feature/xyz`)
>
> Options:
> 1. Switch to main and cherry-pick changes
> 2. Push hotfix from current branch
> 3. Cancel
>
> Choose: (1 / 2 / 3)

---

### Step 2: Show Changes

```bash
git diff --stat
```

> **Changes to commit:**
> ```
> src/components/Tooltip.tsx | 2 +-
> 1 file changed, 1 insertion(+), 1 deletion(-)
> ```
>
> Commit these changes? (yes / review diff / cancel)

If "review diff":
```bash
git diff
```

---

### Step 3: Calculate Version

Auto-increment patch version:

```
Current: v{CURRENT_VERSION}
New:     v{NEW_VERSION}
```

> **Hotfix version: v{NEW_VERSION}**
> Accept? (yes / different version)

---

### Step 4: Minimal Changelog

**Prompt for description:**
> Brief description of the fix:
> _Fix tooltip z-index on Artists scene_

**Auto-generate entry:**
```json
{
  "version": "{NEW_VERSION}",
  "date": "{TODAY}",
  "type": "patch",
  "title": "Hotfix",
  "description": "{DESCRIPTION}",
  "highlights": []
}
```

---

### Step 5: Update Files

**Minimal updates (no ROADMAP, no README "What's New"):**

| File | Action |
|------|--------|
| `package.json` | Update version |
| `src/data/changelog.json` | Add minimal entry |
| `.claude/context.md` | Update version line |

---

### Step 6: Commit & Tag

```bash
git add -A
git commit -m "$(cat <<'EOF'
hotfix: v{NEW_VERSION} - {DESCRIPTION}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
git tag v{NEW_VERSION}
```

---

### Step 7: Push (unless --no-push)

```bash
git push origin main --tags
```

> 🚀 **Hotfix v{NEW_VERSION} deployed!**
>
> Verify at: https://concerts.morperhaus.org
>
> **If something's wrong:** `/release-undo --version {NEW_VERSION}`

---

## Differences from /release

| Aspect | /hotfix | /release |
|--------|---------|----------|
| Version prompt | Auto patch | Interactive |
| Changelog | Minimal | Full details |
| ROADMAP | Skipped | Updated |
| README | Skipped | Updated (minor/major) |
| Spec moves | Skipped | Prompted |
| Checkpoints | Fewer | Multiple |
| Time | ~30 seconds | ~2 minutes |

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "No changes to commit" | Nothing staged | Make changes first |
| "Working directory clean" | Already committed | Use `/release` instead |
| "Push rejected" | Remote has changes | `git pull --rebase` first |
| "Tag already exists" | Version conflict | Choose different version |

---

## Recovery

If hotfix goes wrong:
```
/release-undo --version 2.0.1
```

Then either:
- Fix the issue and `/hotfix` again
- Use full `/release` workflow for more control

---

## Related

- `/release` — Full release workflow
- `/release-undo` — Rollback releases
- `/validate` — Pre-release checks
