# /release-undo - Rollback a Release

Dedicated rollback for when a release goes wrong. Separate from `/release` for clarity in a crisis.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--version` | No | latest tag | Specific version to undo |
| `--local-only` | No | false | Only undo local changes (not pushed yet) |

**Examples:**
```
/release-undo                    # Undo latest release
/release-undo --version 1.9.1    # Undo specific version
/release-undo --local-only       # Only local, hasn't been pushed
```

---

## Triage: What Went Wrong?

First, identify the failure point:

**Since #13, a release has more places to stop, and the early ones are free.**
`/release` now puts the release on a `release/vX.Y.Z` branch, opens a PR, waits for
CI, merges, then pushes the tag — and **the tag is what deploys**. So a release that
has not been tagged has not been published, however far along it looks.

Work out where it got to first:

```bash
gh pr list --head release/v{VERSION} --state all   # is there a PR, and was it merged?
git ls-remote --tags origin "v{VERSION}"           # was the tag pushed? (this is the deploy trigger)
```

| Symptom | Likely Cause | Jump To |
|---------|--------------|---------|
| Files changed but not committed | Aborted mid-release | [Scenario A](#scenario-a-uncommitted-changes) |
| Release PR open, CI red or unwanted | Stopped at the gate | [Scenario A2](#scenario-a2-release-pr-open-not-merged) |
| PR merged, no tag pushed | Stopped before the deploy trigger | [Scenario B2](#scenario-b2-merged-but-not-tagged) |
| Committed but not pushed | Stopped before push | [Scenario B](#scenario-b-committed-not-pushed) |
| Pushed but wrong version | Typo or wrong bump | [Scenario C](#scenario-c-wrong-version-pushed) |
| Pushed but deploy broken | Code issue | [Scenario D](#scenario-d-pushed-but-broken) |
| Tag exists but shouldn't | Premature tag | [Scenario E](#scenario-e-delete-tag-only) |

> **While the Cloudflare dashboard build is still enabled**, merging the release PR
> also deploys the site, before any tag exists. So during the transition B2 *has*
> published — treat it as Scenario D. Once the dashboard build is disabled (the last
> step of #13) B2 becomes genuinely unpublished, as described.

---

## Scenario A: Uncommitted Changes

**Situation:** Ran `/release`, files were modified, but you cancelled or it errored before commit.

**Check:**
```bash
git status
# Shows modified: changelog.json, package.json, etc.
```

**Fix:**
```bash
# Discard all release-related changes
git checkout -- src/data/changelog.json package.json docs/ROADMAP.md README.md .claude/context.md

# If spec file was moved, move it back
git mv docs/specs/implemented/{name}.md docs/specs/future/{name}.md 2>/dev/null
```

**Done.** No further action needed.

---

## Scenario A2: Release PR Open, Not Merged

**Situation:** `/release` opened the release PR and stopped — CI went red, or you
ran with `--no-merge`, or you changed your mind. Nothing has been tagged, so
**nothing has been published.** This is the cheapest place a release can fail and
it is where the #13 gate is designed to catch problems.

**Check:**
```bash
gh pr list --head release/v{VERSION} --state open
gh pr checks {PR}
```

**If you want to fix forward** (usual case — a test failed and the fix is small):
push the fix to the same branch. The checks re-run, and the release continues from
Step 8b. Nothing needs undoing.

**If you want to abandon the release:**
```bash
gh pr close {PR} --delete-branch
git checkout main   # or your worktree's branch
git branch -D release/v{VERSION}
```

Nothing reached `main`, no tag exists, no deploy ran. The version was never
published — a later release can reuse the same version number.

---

## Scenario B2: Merged But Not Tagged

**Situation:** The release PR merged, but the tag was never pushed — `/release`
errored between the two, or was interrupted.

**Check:**
```bash
git fetch origin
git log origin/main --oneline -1        # the release commit is on main
git ls-remote --tags origin "v{VERSION}"  # empty: the deploy trigger never fired
```

**Important during the transition:** while the Cloudflare dashboard build is still
enabled, merging already deployed the site. So in that state this is **not** an
unpublished release — go to [Scenario D](#scenario-d-pushed-but-broken). Once the
dashboard build is disabled (the last step of #13), the merge alone deploys nothing
and the below applies.

**To finish the release** (usual case — the merge was fine, only the tag is
missing):
```bash
git fetch origin
git tag v{VERSION} origin/main
git push origin v{VERSION}
```

That triggers `deploy.yml`, which re-checks the tag against `package.json` before
deploying.

**To back the release out instead**, revert the merge on `main`:
```bash
gh pr view {PR} --json mergeCommit --jq .mergeCommit.oid
git revert -m 1 {MERGE_COMMIT}
```
Open that revert as its own PR so it passes the same gate.

---

## Scenario B: Committed Not Pushed

**Situation:** Commit and tag created, but `git push` wasn't run (or failed).

**Check:**
```bash
git log origin/main..HEAD --oneline
# Shows your release commit

git tag -l "v{VERSION}"
# Shows the tag exists locally
```

**Fix:**
```bash
# Delete local tag
git tag -d v{VERSION}

# Undo commit but keep changes staged
git reset --soft HEAD~1

# Now either:
# Option 1: Discard changes entirely
git reset --hard HEAD

# Option 2: Fix and re-commit
# (edit files as needed, then re-run /release)
```

**Done.** Remote is unchanged.

---

## Scenario C: Wrong Version Pushed

**Situation:** Pushed `v1.9.1` but should have been `v1.10.0` (or similar).

**Check:**
```bash
git describe --tags --abbrev=0
# Shows: v1.9.1 (the wrong version)
```

**Fix:**
```bash
# Delete tag locally and remotely
git tag -d v{WRONG_VERSION}
git push origin :refs/tags/v{WRONG_VERSION}

# Revert the commit
git revert HEAD --no-edit
git push origin main

# Now release with correct version
/release {correct bump}
```

**Note:** This creates a revert commit in history. That's fine—it's transparent.

---

## Scenario D: Pushed But Broken

**Situation:** Release deployed but site is broken (runtime error, bad data, etc.).

**Options:**

### Option 1: Fix Forward (Preferred)

Ship a patch release with the fix:
```bash
# Fix the bug
# ...

# Release patch
/release patch
```

This is usually faster and cleaner than reverting.

### Option 2: Full Revert

If fix isn't quick:
```bash
# Revert release commit
git revert HEAD --no-edit

# Delete tag locally and remotely
git tag -d v{VERSION}
git push origin :refs/tags/v{VERSION}

# Push revert
git push origin main

# Verify deployment rolled back
```

### Option 3: Redeploy Previous Version

If your CI/CD supports it:
```bash
# Trigger deploy of previous tag
# (This is CI-specific, e.g., Vercel rollback, Netlify deploy)
```

---

## Scenario E: Delete Tag Only

**Situation:** Tag was created prematurely, but commit is fine.

**Fix:**
```bash
# Delete local tag
git tag -d v{VERSION}

# Delete remote tag (if pushed)
git push origin :refs/tags/v{VERSION}
```

**Done.** Commit remains, tag removed.

---

## Full Nuclear Option

**When:** Everything is wrong, want to start fresh.

```bash
# 1. Identify last known good state
git log --oneline -10
# Find commit hash before release

# 2. Reset to that commit (DESTRUCTIVE)
git reset --hard {GOOD_COMMIT_HASH}

# 3. Force push (DANGEROUS - rewrites history)
git push origin main --force

# 4. Delete the tag
git tag -d v{VERSION}
git push origin :refs/tags/v{VERSION}

# 5. Notify anyone else working on repo
```

**⚠️ WARNING:** Force push rewrites history. Only use if:
- You're the only contributor, OR
- You've coordinated with your team

---

## Verification Checklist

After any rollback:

- [ ] `git describe --tags --abbrev=0` shows expected version
- [ ] `npm run validate:version` passes
- [ ] `cat package.json | jq .version` matches
- [ ] `cat src/data/changelog.json | jq '.releases[0].version'` matches
- [ ] Site shows correct version at `/liner-notes`

---

## Prevention

To avoid needing this command:

1. **Use `--dry-run` first:** `/release minor --dry-run`
2. **Review diffs** at each checkpoint
3. **Use `--no-push`** to separate commit from push
4. **Validate locally** before pushing: `npm run build && npm run preview`

---

## Related

- `/release` — Normal release workflow
- `.claude/version-management.md` → Validation commands
