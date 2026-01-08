/commands — List all project slash commands

# Claude Commands

Slash commands for common workflows. Run these in Claude Code with `/{command}`.

---

## Available Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/release` | Ship a version | Wrapping up a feature or bugfix |
| `/changelog` | Create changelog entry | Drafting release notes |
| `/release-undo` | Rollback a release | Something went wrong |
| `/spec` | Create feature spec | Starting a new feature |
| `/implement` | Start work on a spec | Beginning implementation |
| `/context-sync` | Update context files | After commits or data refresh |
| `/validate` | Run all checks | Before releases, after data changes |
| `/data-refresh` | Refresh data pipeline | Adding concerts, monthly maintenance |
| `/preview` | Start dev server | Local development with context |
| `/hotfix` | Emergency patch | Urgent production fixes |

---

## Quick Start

### Ship a Feature
```
/release minor
```
Bumps version, updates changelog, ROADMAP, README, commits, tags, and pushes.

### Ship a Bugfix
```
/release patch
```
Same flow, but skips README "What's New" update.

### Create a Feature Spec
```
/spec
```
Generates implementation-ready spec in `docs/specs/future/`, optionally adds to ROADMAP.

### Start Implementing a Spec

```
/implement
```

Lists available specs, loads context (spec, skills, reference files), creates todo list from Implementation Plan.

### Sync Context Files
```
/context-sync
```
Updates context.md and config.json with latest commits, stats, and version info.

### Preview Any Command
```
/release minor --dry-run
/spec --dry-run
/context-sync --dry-run
```
Shows what would change without modifying files.

---

## Command Details

### `/release`

Full release workflow.

```
/release              # Interactive, suggests version
/release patch        # x.x.X bump
/release minor        # x.X.0 bump
/release major        # X.0.0 bump
/release --dry-run    # Preview only
/release --no-push    # Commit + tag, no push
```

**Handles:** changelog, package.json, ROADMAP, README, context.md, spec file moves, validation, git operations

**Checkpoints:** Version confirmation → Changelog details → ROADMAP items → Spec moves → Diff preview → Git operations

---

### `/changelog`

Create changelog entry without full release.

```
/changelog                    # Interactive
/changelog --version 1.9.1    # Pre-fill version
/changelog --dry-run          # Preview only
```

**Useful for:** Drafting release notes early, reviewing before committing

---

### `/release-undo`

Rollback a release that went wrong.

```
/release-undo                    # Undo latest release
/release-undo --version 1.9.1    # Undo specific version
/release-undo --local-only       # Only undo local changes
```

**Scenarios:** Uncommitted changes, committed but not pushed, wrong version, broken deploy

---

### `/spec`

Generate a feature specification.

```
/spec                      # Full interactive
/spec --name artist-search # Pre-fill name
/spec --dry-run            # Preview only
```

**Prompts for:** Feature name, version, priority, complexity, description, scene(s), ROADMAP placement

**Creates:** `docs/specs/future/{feature-name}.md` with full template

**Optionally:** Adds entry to ROADMAP.md Short-Term or Medium-Term section

---

### `/implement`

Start work on an existing spec.

```
/implement                              # Interactive spec selection
/implement --spec spotify-artist-integration
/implement --dry-run                    # Preview what would be loaded
/implement --skip-todos                 # Load context only
```

**Does:**

1. Lists specs from `docs/specs/future/` with priority/complexity
2. Loads selected spec + relevant skills (design-system, data-schema, api-integration)
3. Creates TodoWrite tasks from Implementation Plan phases
4. Shows kickoff guidance (first files to open, first task)

**Useful for:** Starting a fresh Claude session with full context for a feature

---

### `/context-sync`

Synchronize context files with project state.

```
/context-sync              # Full sync
/context-sync --dry-run    # Preview only
/context-sync --commits-only  # Just update commits
/context-sync --stats-only    # Just update data stats
```

**Updates:**
- `context.md`: Version, stats, recent commits, timestamps
- `config.json`: Version, lastContextSync, lastCommit

**Run after:** Data refresh, multiple commits, before starting new features

---

## Setup

### Directory Structure

```
.claude/
├── commands/
│   ├── README.md           # This file
│   ├── release.md          # Release workflow
│   ├── changelog.md        # Changelog entry
│   ├── release-undo.md     # Rollback
│   ├── spec.md             # Feature spec creation
│   ├── implement.md        # Start work on spec
│   └── context-sync.md     # Context file sync
├── skills/
│   ├── README.md           # Skills overview
│   ├── design-system/      # UI patterns & colors
│   └── data-schema/        # Data structures
├── context.md
├── config.json
└── ...
```

### ROADMAP Structure Contract

For `/release` and `/spec` to work with ROADMAP.md, add this comment at line 1:

```markdown
<!--
ROADMAP STRUCTURE CONTRACT (for automation)

## Recently Completed
### ✅ {Feature Name} (v{VERSION})
**Status**: Completed
**Spec**: [name.md](specs/implemented/name.md)

## Short-Term Roadmap
### {Feature Name}
**Status**: Planned | In Progress
**Spec**: [name.md](specs/future/name.md)

## Medium-Term Roadmap
### {Feature Name}
**Status**: Planned
**Spec**: [name.md](specs/future/name.md)
-->

# Roadmap
...
```

---

## Typical Workflows

### New Feature: Spec → Implement → Ship

```
# 1. Create spec
/spec

# 2. Fill in spec details (TODO sections)

# 3. Start implementation (loads context, creates tasks)
/implement

# 4. Development work (follow todo list)

# 5. Ship it
/release minor
```

### Quick Bugfix

```
# 1. Fix the bug, commit
git add . && git commit -m "fix: tooltip z-index"

# 2. Ship patch
/release patch
```

### After Data Refresh

```
# 1. Refresh data
npm run build-data

# 2. Sync context
/context-sync

# 3. If shipping as release
/release patch
```

### Oops, Wrong Version

```
# Undo the release
/release-undo --version 1.9.1

# Ship correct version
/release minor
```

---

## How Commands Reference Docs

Commands are lean orchestrators. They reference existing docs:

```
/release
  ├── version-management.md → Pre-flight, version calc
  ├── /changelog → Changelog entry
  ├── readme-maintenance.md → README updates
  └── ROADMAP.md → Item moves

/spec
  ├── spec-writing-guide.md → Template, standards
  └── ROADMAP.md → Entry placement

/implement
  ├── docs/specs/future/*.md → Spec selection & loading
  ├── .claude/skills/ → Context loading (design, data, api)
  └── TodoWrite → Task plan creation

/context-sync
  ├── context.md → Direct updates
  └── config.json → Direct updates
```

---

## Adding New Commands

Create `.claude/commands/{name}.md`:

```markdown
# /{name} — Short Description

Purpose statement.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|

## Workflow

### Step 1: ...
```

Update this README with new command.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Working directory not clean" | Uncommitted changes | `git stash` or commit |
| "Version already exists" | Duplicate in changelog | Choose different version |
| "Validation failed" | Version mismatch | Run `npm run validate:version` |
| "Spec already exists" | File in future/ or implemented/ | Choose different name |
| Command doesn't run | Not in Claude Code | These are slash commands, not shell |

---

## Related

- `.claude/skills/` — Knowledge packages (design-system, data-schema)
- `.claude/context.md` — Project context
- `.claude/config.json` — Project configuration
- `docs/ROADMAP.md` — Feature roadmap
- `docs/specs/` — Feature specifications
