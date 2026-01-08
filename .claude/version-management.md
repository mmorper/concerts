# Version Management Guide

**Purpose:** Ensure version consistency between `/liner-notes` changelog page and `version.json`

**Last Updated:** 2026-01-06

---

## How Versioning Works

### Three Version Sources

1. **Git Tags** (`git describe --tags`)
   - Source of truth for production releases
   - Format: `v1.x.x`
   - Created when tagging releases

2. **changelog.json** (`src/data/changelog.json`)
   - Powers the `/liner-notes` changelog page
   - Format: `"1.x.x"` (no 'v' prefix)
   - First entry determines displayed version

3. **package.json** (`package.json`)
   - Standard npm version field
   - Format: `"1.x.x"` (no 'v' prefix)
   - Should match git tag

### Version Display

The version shown in the **bottom-right corner of `/liner-notes`** comes from:

```tsx
// src/components/changelog/ChangelogPage.tsx:171
{releases[0].version}  // First entry in changelog.json
```

---

## Validation Tool

### Quick Check

```bash
npm run validate:version
```

This script checks:
- ✅ Git tag (latest) matches `changelog.json` (first entry)
- ✅ Git tag matches `package.json` version field
- ✅ Reports what version will display at `/liner-notes`

### Example Output

**All versions in sync:**
```
🔍 Validating version consistency...

Git tag (latest):         v1.7.6
Changelog (first entry):  1.7.6
Package.json:             1.7.6

✅ All versions are in sync!

📍 Version displayed at /liner-notes: 1.7.6
```

**Versions out of sync:**
```
🔍 Validating version consistency...

Git tag (latest):         v1.7.6
Changelog (first entry):  1.7.0
Package.json:             1.7.6

❌ Version mismatch detected!

   Git tag (1.7.6) != Changelog (1.7.0)
   → Update src/data/changelog.json to add v1.7.6 entry

⚠️  The /liner-notes page will show: 1.7.0
   Expected version: 1.7.6

Fix before deploying to production!
```

---

## Release Workflow

### Before Each Release

1. **Update `changelog.json`:**

   ```json
   {
     "releases": [
       {
         "version": "1.x.x",  // ← No 'v' prefix!
         "date": "2026-01-04",
         "title": "Feature Name",
         "description": "User-facing description",
         "route": "/?scene=artists",
         "highlights": [
           "Feature 1",
           "Feature 2"
         ]
       },
       // ... older releases
     ]
   }
   ```

2. **Update `package.json` version:**

   ```json
   {
     "version": "1.x.x"  // ← Match git tag without 'v'
   }
   ```

3. **Validate consistency:**

   ```bash
   npm run validate:version
   ```

4. **Commit and tag:**

   ```bash
   git add src/data/changelog.json package.json
   git commit -m "docs: Update changelog for v1.x.x"
   git tag v1.x.x
   git push origin main --tags
   ```

---

## Pre-Flight Checks

Run before any release. Hard stop on failures.

### Check 1: Clean Working Directory

```bash
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ STOP: Uncommitted changes detected"
  git status --short
  exit 1
fi
```

**On failure:** Commit or stash changes before releasing.

### Check 2: Branch Verification

```bash
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  WARNING: On branch '$BRANCH', not 'main'"
  read -p "Release from $BRANCH? (y/n) " -n 1 -r
fi
```

**On warning:** Confirm intentional, or switch to main.

### Check 3: Unpushed Commits

```bash
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null)
if [ -n "$UNPUSHED" ]; then
  echo "ℹ️  INFO: Unpushed commits will be included:"
  echo "$UNPUSHED"
fi
```

**On info:** Review commits, ensure all are release-ready.

### Check 4: File Integrity

```bash
# Verify required files exist and are valid JSON
node -e "require('./src/data/changelog.json')" || echo "❌ changelog.json invalid"
node -e "require('./package.json')" || echo "❌ package.json invalid"
test -f docs/ROADMAP.md || echo "❌ ROADMAP.md missing"
```

**On failure:** Fix file before proceeding.

---

## Version Calculation

### From Existing Tag

```bash
CURRENT=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')
# Returns: 1.9.0 (without 'v' prefix)
```

### Handle No Tags (First Release)

```bash
CURRENT=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//')
if [ -z "$CURRENT" ]; then
  CURRENT="0.0.0"
  echo "ℹ️  No existing tags. Starting from v0.0.0"
fi
```

### Calculate Bump

```bash
# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

# Calculate new version
case "$BUMP_TYPE" in
  major) NEW="$((MAJOR + 1)).0.0" ;;
  minor) NEW="$MAJOR.$((MINOR + 1)).0" ;;
  patch) NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
esac
```

### Pre-release Versions

For beta/rc releases, append suffix:
- `1.9.0` → `2.0.0-beta.1` (major pre-release)
- `2.0.0-beta.1` → `2.0.0-beta.2` (increment pre-release)
- `2.0.0-rc.1` → `2.0.0` (promote to stable)

**Note:** Pre-release handling is manual. Specify exact version when needed.

---

## Common Issues

### Issue: `/liner-notes` shows old version

**Cause:** `changelog.json` first entry doesn't match latest git tag

**Fix:**
1. Add new release entry to top of `changelog.json`
2. Run `npm run validate:version` to confirm
3. Commit and deploy

### Issue: Build generates wrong version.json

**Cause:** Git tags out of sync with actual release

**Fix:**
1. Verify git tag with `git describe --tags --abbrev=0`
2. Ensure `changelog.json` and `package.json` match
3. Run build process

---

## Automation

### Build-Time Generation

`public/version.json` is auto-generated during build:

```bash
# package.json
"build": "tsx scripts/generate-version.ts && tsc && vite build"
```

The script uses `git describe` to populate:
- `version`: Git tag with commit info
- `buildTime`: ISO timestamp
- `commit`: Short commit hash
- `branch`: Current branch

### Pre-Deploy Validation

Consider adding to CI/CD:

```yaml
# .github/workflows/deploy.yml
- name: Validate version consistency
  run: npm run validate:version
```

---

## Related Files

- [.claude/readme-maintenance.md](./.claude/readme-maintenance.md) - README version update workflow
- [scripts/validate-version-sync.ts](../scripts/validate-version-sync.ts) - Validation script
- [scripts/generate-version.ts](../scripts/generate-version.ts) - Build-time version generation
- [src/components/changelog/ChangelogPage.tsx](../src/components/changelog/ChangelogPage.tsx) - Version display component

---

## Quick Reference

```bash
# Check current versions
npm run validate:version

# View git tag
git describe --tags --abbrev=0

# View changelog version
cat src/data/changelog.json | jq '.releases[0].version'

# View package.json version
cat package.json | jq '.version'

# Test /liner-notes locally
npm run dev
# Navigate to http://localhost:5173/liner-notes
```

---

**Last Updated:** 2026-01-06
