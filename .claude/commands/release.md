# /release - Ship a Version

Orchestrates the release workflow. References existing docs for details.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `patch` | No | - | Bump patch version (x.x.X) |
| `minor` | No | - | Bump minor version (x.X.0) |
| `major` | No | - | Bump major version (X.0.0) |
| `--dry-run` | No | false | Preview all changes, write nothing |
| `--no-push` | No | false | Commit and tag, but don't push |

**Examples:**
```
/release              # Interactive, suggests version
/release patch        # Bump patch, then interactive
/release minor --dry-run
```

## Quick Reference

| Step | What | Reference |
|------|------|-----------|
| 1 | Pre-flight checks | `.claude/version-management.md` → "Pre-Flight Checks" |
| 2 | Determine version | `.claude/version-management.md` → "Version Calculation" |
| 3 | Categorize commits | Liner notes decision (user-facing vs internal) |
| 4 | Changelog entry | `/changelog` command (if user-facing changes) |
| 5 | Update files | `.claude/readme-maintenance.md` → "Callable Checklist" |
| 6 | Preview & confirm | Review all changes |
| 7 | Validate | `npm run validate:version` |
| 8 | Git operations | Below |
| 9 | GitHub release | `gh release create` (all commits) |
| 10 | Post-release | Verification checklist |

---

## Workflow

### Step 1: Pre-Flight Checks

**Run checks from `.claude/version-management.md` → "Pre-Flight Checks"**

| Check | Failure Mode |
|-------|--------------|
| Clean working directory | ❌ Hard stop |
| On main branch | ⚠️ Warning, confirm to continue |
| Unpushed commits | ℹ️ Info, show what's included |
| Code builds successfully | ❌ Hard stop |
| File integrity | ❌ Hard stop |

**Build Check:**

```bash
npm run build
```

**If build fails:** Exit immediately. Fix TypeScript/build errors before releasing.

**If any hard stop:** Exit immediately. User must fix first.

---

### Production Safety Checklist

Before proceeding with release, verify:

- [ ] **Changes reviewed for impact** — Check if this release affects:
  - Data structures (`concerts.json`, `artists-metadata.json`, `venues-metadata.json`)
  - API integrations (Ticketmaster, setlist.fm, geocoding)
  - Analytics tracking events (GA4)
  - Build/deployment configuration
- [ ] **Breaking changes documented** — If any breaking changes exist, they must be:
  - Clearly described in changelog with migration notes
  - Highlighted in README "What's New" section
- [ ] **Rollback plan identified** — Confirm `/release-undo` can reverse this release

**Reference:** [.claude/quality-standards.md](.claude/quality-standards.md) for detailed safety guidelines.

---

### Step 2: Determine Version

**If bump type provided (`patch`/`minor`/`major`):**

Calculate per `.claude/version-management.md` → "Version Calculation":
```
Current: v1.9.0
Bump: patch
New: v1.9.1
```

> **Version: v1.9.0 → v1.9.1 (patch)**
> Continue? (yes / different version)

**If no bump type (interactive):**

1. Show commits since last tag
2. Analyze commit prefixes (feat:, fix:, feat!:)
3. Suggest bump with rationale

> **Commits since v1.9.0:** 3 commits
> - `fix: tooltip z-index`
> - `fix: mobile scroll`
> - `docs: update README`
>
> **Suggested: v1.9.1 (patch)** — All commits are fixes/docs
>
> Accept? (yes / patch / minor / major / specific version)

**🔵 CHECKPOINT: Confirm version before proceeding.**

---

### Step 3: Categorize Commits (Liner Notes Decision)

**Analyze all commits since last tag and categorize:**

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

**User-facing (triggers liner notes):**

| Prefix | Type | Include |
|--------|------|---------|
| `feat:` | New features | ✅ Yes |
| `fix:` | Bug fixes | ✅ Yes |
| `data:` | New concerts | ✅ Yes |
| `perf:` | Performance (if UX impact) | ✅ Yes |

**Internal (GitHub release only):**

| Prefix | Type | Include |
|--------|------|---------|
| `feat(internal):` | Internal features | ❌ No |
| `docs:` | Documentation | ❌ No |
| `chore:` | Tooling, deps | ❌ No |
| `refactor:` | Code restructuring | ❌ No |
| `ci:` | Build/deploy | ❌ No |
| `test:` | Test additions | ❌ No |
| `seo:` | SEO optimizations | ❌ No |
| `analytics:` | Tracking changes | ❌ No |

**Display categorization:**

```
📊 Commit Analysis
═══════════════════

User-facing changes:
  ✅ feat: Add artist search
  ✅ fix: Mobile scroll issue

Internal changes:
  ⚪ docs: Update README
  ⚪ chore: Bump dependencies
  ⚪ seo: Add meta tags

Liner notes: YES (2 user-facing commits)
```

**If no user-facing commits:**

```
📊 Commit Analysis
═══════════════════

User-facing changes:
  (none)

Internal changes:
  ⚪ docs: Update documentation
  ⚪ seo: Add sitemap
  ⚪ chore: Update dependencies

Liner notes: NO (internal-only release)
```

**Store the categorization for later steps.**

---

### Step 4: Changelog Entry (Conditional)

**If user-facing commits exist:**

> **Publish liner notes?** [Y/n]
>
> User-facing changes to include:
> - feat: Add artist search
> - fix: Mobile scroll issue

If confirmed, invoke `/changelog --version {VERSION}`

This handles:
- Gathering title, description, highlights, route
- Validating entry
- Writing to `src/data/changelog.json`

If `--dry-run`: Pass through to changelog command.

**If NO user-facing commits:**

> ℹ️ **Skipping liner notes** — This release contains only internal changes.
>
> GitHub release notes will include all commits for completeness.

Skip changelog entry entirely. Do not write to `src/data/changelog.json`.

---

### Step 5: Update Files

**Reference: `.claude/readme-maintenance.md` → "Version Release Checklist"**

**Voice Guidance:** See `.claude/readme-maintenance.md` → "Voice & Tone Guidelines"

- Liner notes, release notes, README "What's New" → **Product Marketer voice** (warm, benefit-focused, for concert explorers)
- Technical docs, "Running It Yourself" → **Helpful Hobbyist voice** (friendly, practical, for tinkerers—no false expertise)

Update in order:

| File | Action | Skip If |
|------|--------|---------|
| `package.json` | Set `"version": "{VERSION}"` | - |
| `index.html` + `og-stats.json` | Run `npm run update:meta` to refresh stats | - |
| `public/og-image.jpg` | Run `npm run og:generate` to regenerate with current stats | - |
| `docs/ROADMAP.md` | Move completed items (see below) | No items selected |
| `README.md` | Update "What's New" | No user-facing changes |
| `CLAUDE.md` | Update version + stats in header line | - |
| `.claude/context.md` | Update version, recent releases | - |

#### ROADMAP Updates

1. Show items from all roadmap sections:

   > **Short-Term Roadmap:**
   > 1. {ITEM_1} ({STATUS})
   > 2. {ITEM_2} ({STATUS})
   >
   > **Medium-Term Roadmap:**
   > 3. {ITEM_3} ({STATUS})
   > 4. {ITEM_4} ({STATUS})
   >
   > **Long-Term Roadmap:**
   > 5. {ITEM_5} ({STATUS})
   > 6. {ITEM_6} ({STATUS})
   >
   > Which items does this release complete? (numbers, comma-separated, or "none")

2. For each selected item:
   - Move from its current section to Recently Completed
   - Add `✅` prefix and `(v{VERSION})` suffix
   - Change status to `Completed`
   - Update spec path: `specs/future/` → `specs/implemented/`

3. If spec file exists, ask to move it:
   > Move `docs/specs/future/{name}.md` to `docs/specs/implemented/`? (yes/no)

   ```bash
   git mv docs/specs/future/{name}.md docs/specs/implemented/{name}.md
   ```

#### CLAUDE.md Updates

Update the version + stats line (line 6):
```markdown
**Version:** v{VERSION} | {CONCERTS} concerts, {ARTISTS} artists, {VENUES} venues
```

#### context.md Updates

- Line: `**Version:** v{VERSION} (Production)`
- Add to Recent Releases list (keep last 5)
- Footer: `*Last updated: {DATE} by Claude Code for v{VERSION} release*`

---

### Step 6: Preview & Confirm

**🔵 CHECKPOINT: Show all pending changes**

```
📋 Release Summary: v{VERSION}
═══════════════════════════════

📄 src/data/changelog.json
   + New entry: "{TITLE}"

📄 package.json
   - "version": "{OLD}"
   + "version": "{NEW}"

📄 docs/ROADMAP.md
   ~ Moved "{ITEM}" to Recently Completed
   ~ Updated spec path

📄 README.md
   ~ Updated "What's New" section

📄 CLAUDE.md
   ~ Updated version + stats line

📄 .claude/context.md
   ~ Updated version and recent releases

📄 docs/specs/implemented/{name}.md (moved)
```

**If `--dry-run`:**
> 🏁 Dry run complete. No files modified.

Then **STOP**.

**If normal run:**
> Write these changes? (yes / edit / cancel)

---

### Step 7: Write & Validate

1. Write all files
2. Run validation:
   ```bash
   npm run validate:version
   npm run build
   ```

**If version validation fails:**
> ❌ Version mismatch detected. See error above.
>
> Fix manually, or run:
> ```bash
> git checkout -- src/data/changelog.json package.json docs/ROADMAP.md README.md .claude/context.md
> ```

**If build fails:**
> ❌ TypeScript or build errors detected.
>
> Fix the errors, then re-run validation:
> ```bash
> npm run build
> ```
>
> Once fixed, continue with git operations.

---

### Step 8: Git Operations

**🔵 CHECKPOINT: Confirm before git commands**

**Files to stage:**
- `src/data/changelog.json`
- `package.json`
- `index.html`
- `public/og-stats.json`
- `public/og-image.jpg`
- `docs/ROADMAP.md` (if changed)
- `README.md` (if changed)
- `CLAUDE.md`
- `.claude/context.md`
- `docs/specs/implemented/{name}.md` (if moved)

**Commands:**
```bash
git add {files}
git commit -m "release: v{VERSION} - {TITLE}"
git tag v{VERSION}
git push origin main --tags  # unless --no-push
```

> Execute git commands? (yes / commit-only / cancel)

**Options:**
- `yes` — Full commit + tag + push
- `commit-only` — Commit + tag, no push (same as `--no-push`)
- `cancel` — Changes written but not committed

**Note:** If remote has new commits, the push will be rejected. Run `git pull --rebase` and push again.

---

### Step 9: Create GitHub Release

**CHECKPOINT:** Create GitHub release

GitHub release notes include **all commits** (both user-facing and internal) for complete technical documentation.

**If user-facing changes exist (liner notes published):**

```bash
gh release create v{VERSION} \
  --title "v{VERSION} - {TITLE}" \
  --notes "$(cat <<'EOF'
## v{VERSION} - {TITLE}

{DESCRIPTION}

### Highlights

{HIGHLIGHTS_FORMATTED_AS_BULLETS}

### Try it live

- [{SCENE_NAME}]({FULL_ROUTE_URL})

### All Changes

{ALL_COMMITS_FORMATTED_AS_BULLETS}

See the [liner notes](https://concerts.morperhaus.org/liner-notes) for user-facing highlights.
EOF
)"
```

**If internal-only release (no liner notes):**

```bash
gh release create v{VERSION} \
  --title "v{VERSION} - {SHORT_SUMMARY}" \
  --notes "$(cat <<'EOF'
## v{VERSION} - {SHORT_SUMMARY}

Internal maintenance release with no user-facing changes.

### Changes

{ALL_COMMITS_FORMATTED_AS_BULLETS}
EOF
)"
```

**Formatting all commits:**

- List every commit since last tag
- Group by type if helpful (Features, Fixes, Internal)
- Include full commit messages

GitHub release created at: `https://github.com/{owner}/{repo}/releases/tag/v{VERSION}`

---

### Step 10: Post-Release

🚀 **v{VERSION} released!**

**Verify (all releases):**

- [ ] Site live at concerts.morperhaus.org
- [ ] GitHub release visible at `https://github.com/mmorper/concerts/releases`

**Verify (if liner notes published):**

- [ ] `/liner-notes` shows v{VERSION}
- [ ] Deep link works: `{ROUTE}`
- [ ] Social media preview shows current stats (test with [Twitter Card Validator](https://cards-dev.twitter.com/validator) or [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/))

**If something's wrong:** `/release-undo`

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "Working directory not clean" | Uncommitted changes | `git stash` or commit first |
| "Version already exists" | Duplicate in changelog | Choose different version |
| "Validation failed" | Version mismatch | Run `npm run validate:version`, fix discrepancy |
| "Push rejected" | Remote has new commits | `git pull --rebase`, then push |

---

## Related

- `/changelog` — Standalone changelog entry
- `/release-undo` — Rollback a release
- `.claude/version-management.md` — Version rules and validation
- `.claude/readme-maintenance.md` — README update guidelines
- `docs/BUILD.md` — Build pipeline, OG image regeneration, deployment
- `docs/WORKFLOW.md` — Complete development and deployment workflow
