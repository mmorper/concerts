# /implement — Start Work on a Spec

Initialize a Claude Code session for implementing an existing spec from `docs/specs/future/`. Loads context, creates a task plan, and provides kickoff guidance.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--spec` | No | (prompted) | Spec filename (without .md) |
| `--dry-run` | No | false | Show what would be loaded without creating todos |
| `--skip-todos` | No | false | Load context only, don't create todo list |

**Examples:**

```bash
/implement                              # Interactive spec selection
/implement --spec spotify-artist-integration
/implement --dry-run                    # Preview context loading
```

---

## Workflow

### Step 1: List Available Specs

If `--spec` not provided, list all specs in `docs/specs/future/`:

```
📋 Available Specs (docs/specs/future/)
═══════════════════════════════════════

  #  Name                              Priority   Complexity
  ─  ────────────────────────────────  ─────────  ──────────
  1  Spotify Artist Integration        High       High
  2  Genre Scene Treemap               Medium     Medium
  3  Artist Cross Navigation           Medium     Low
  4  Visual Testing Suite              Low        High
  ...

Which spec would you like to implement? (enter number)
```

**To build this list:**

1. Glob `docs/specs/future/*.md`
2. For each file, extract metadata from header:
   - `**Priority:**` value
   - `**Estimated Complexity:**` or `**Complexity:**` value
3. Sort by Priority (High → Medium → Low), then alphabetically

---

### Step 2: Load & Analyze Spec

Read the selected spec file and extract:

**Metadata (from header):**

```markdown
**Status:** Planned
**Target Version:** v1.5.0
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** [list]
```

**Implementation Plan (from body):**

Look for sections matching:

```markdown
### Phase 1: {Name}
- [ ] Task 1
- [ ] Task 2

### Phase 2: {Name}
...
```

**Files to Modify (from body):**

Look for sections like "Files to Create/Modify" or "Files to Modify" containing file paths.

---

### Step 3: Identify Relevant Skills

Scan spec content and load matching skills:

| Spec Contains Keywords | Load Skill |
|------------------------|------------|
| `color`, `animation`, `CSS`, `Tailwind`, `component`, `button`, `hover` | `.claude/skills/design-system/SKILL.md` |
| `schema`, `interface`, `concerts.json`, `metadata`, `TypeScript`, `data` | `.claude/skills/data-schema/SKILL.md` |
| `API`, `Spotify`, `Ticketmaster`, `setlist.fm`, `fetch`, `endpoint` | `.claude/skills/api-integration/SKILL.md` |

**Read each relevant skill silently** — the context will inform implementation.

---

### Step 4: Load Reference Files

From the spec, identify and read:

1. **Files listed in "Files to Modify"** — understand current state
2. **Files in "Key References"** — design guides, related specs
3. **Related implemented specs** — if spec references `../implemented/*.md`

Limit to first 5-10 most relevant files to avoid context overload.

---

### Step 5: Review & Clarify

After loading all context, review the spec against the codebase and surface any questions or suggestions before proceeding.

**Questions to surface (if any):**

- Ambiguous requirements that need clarification
- Missing edge cases or error handling details
- Unclear scope boundaries
- Dependencies or prerequisites not addressed in spec

**Suggestions to offer (if any):**

- Existing components/utilities that could be reused
- Conflicts with current codebase patterns
- Simpler alternatives based on what's already implemented
- Potential issues spotted in the approach

**If questions or suggestions exist, present them:**

```
💡 Before We Start
──────────────────

Questions:
  1. The spec mentions "album art" but doesn't specify fallback
     behavior—should we use a placeholder or hide the element?
  2. The Implementation Plan doesn't cover mobile breakpoints—
     should this match the existing responsive patterns?

Suggestions:
  • Consider reusing the existing ImageLoader component for
    lazy loading (src/components/shared/ImageLoader.tsx)
  • The data schema changes may require a data pipeline refresh—
    recommend running /data-refresh after Phase 1

Would you like to address these first, or proceed to implementation?
```

**If no questions or suggestions:** Proceed directly to Step 7 (Kickoff Guidance).

**After user responds:** Incorporate any decisions into the implementation approach, then continue.

---

### Step 6: Create Todo List

If `--skip-todos` is not set, use **TodoWrite** to create tasks from the Implementation Plan:

**Extract tasks from each phase:**

```markdown
### Phase 1: Data Pipeline
- [ ] Update scripts/enrich-spotify-metadata.ts with album selection logic
- [ ] Add fallback hierarchy
```

**Becomes:**

```json
{
  "content": "Phase 1: Update scripts/enrich-spotify-metadata.ts with album selection logic",
  "status": "pending",
  "activeForm": "Updating enrich-spotify-metadata.ts with album selection logic"
}
```

**Guidelines:**

- Prefix tasks with phase name for clarity
- Keep task descriptions concise (trim to ~80 chars if needed)
- Mark first task as `in_progress` to indicate starting point
- Limit to ~15 tasks max (summarize if spec has more)

---

### Step 7: Provide Kickoff Guidance

Present implementation readiness summary:

```
🚀 Ready to Implement: {Spec Title}
═══════════════════════════════════

Spec: docs/specs/future/{filename}.md
Target: v{VERSION}
Priority: {PRIORITY} | Complexity: {COMPLEXITY}

Context Loaded:
  ✓ Full spec ({LINE_COUNT} lines)
  ✓ {skill-name} skill
  ✓ {skill-name} skill
  ✓ {N} reference files

Implementation Phases:
  1. {Phase 1 Name} ({task_count} tasks)
  2. {Phase 2 Name} ({task_count} tasks)
  ...

Start with:
  → {first_file_path} ({reason})
  → {second_file_path} ({reason})

First task: {first_task_description}

Ready to begin? (yes / show spec summary / show tasks)
```

**If user says "yes":** Begin implementation with Phase 1, Task 1.

**If user says "show spec summary":** Output Executive Summary section from spec.

**If user says "show tasks":** List all TodoWrite tasks created.

---

### Step 8: Handle Dry Run

If `--dry-run` is set:

```
🔍 Dry Run: {Spec Title}
════════════════════════

Would load:
  • Spec: docs/specs/future/{filename}.md
  • Skills: design-system, data-schema
  • Reference files:
    - src/components/scenes/ArtistScene/ArtistCard.tsx
    - scripts/enrich-spotify-metadata.ts
    - ...

Would create {N} todo items across {M} phases.

Run without --dry-run to proceed.
```

---

## Spec Metadata Extraction

**Priority parsing:**

```
**Priority:** High       → "High"
**Priority**: Medium     → "Medium"  (colon variants)
Priority: Low            → "Low"     (no bold)
```

**Complexity parsing:**

```
**Estimated Complexity:** High  → "High"
**Complexity:** Medium          → "Medium"
Complexity: Very High           → "Very High"
```

**Default values if not found:**

- Priority: "Medium"
- Complexity: "Medium"

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "No specs found in docs/specs/future/" | Directory empty or missing | Create a spec first with `/spec` |
| "Spec '{name}' not found" | Invalid `--spec` argument | Check filename, use interactive mode |
| "No implementation plan found" | Spec missing `### Phase` sections | Add Implementation Plan to spec |
| "Spec status is 'Complete'" | Spec already implemented | Check `docs/specs/implemented/` instead |

---

## Context Window Management

This command loads significant context. To manage:

1. **Skills are read but not echoed** — they inform implementation silently
2. **Reference files are summarized** — show file paths, not full contents
3. **Spec is the source of truth** — always available for re-reading

If context runs low during implementation:

```
⚠️ Context Check: ~{N}% remaining

Recommend starting a new session. Handoff summary:
- Completed: Phase 1 tasks 1-3
- Current: Phase 1, task 4 ({description})
- Next: {next_task}
- Key files modified: {list}
```

---

## Related Commands

| Command | Relationship |
|---------|--------------|
| `/spec` | Creates specs (upstream of `/implement`) |
| `/validate` | Run before implementation to verify project state |
| `/release` | Ships completed features (downstream) |
| `/context-sync` | Update context files after major changes |

---

## Examples

### Interactive Flow

```
> /implement

📋 Available Specs (docs/specs/future/)
═══════════════════════════════════════

  #  Name                              Priority   Complexity
  ─  ────────────────────────────────  ─────────  ──────────
  1  Spotify Artist Integration        High       High
  2  Genre Scene Treemap               Medium     Medium
  3  Renamed Venue Display             Medium     Low

Which spec would you like to implement? (enter number)

> 1

🚀 Ready to Implement: Spotify Artist Integration
═════════════════════════════════════════════════

Spec: docs/specs/future/artists-spotify-integration.md
Target: v1.5.0
Priority: High | Complexity: High

Context Loaded:
  ✓ Full spec (700 lines)
  ✓ data-schema skill
  ✓ api-integration skill
  ✓ design-system skill
  ✓ 4 reference files

Implementation Phases:
  1. Data Pipeline (7 tasks)
  2. Card Front Album Art (5 tasks)
  3. Mini-Player Component (7 tasks)
  4. Integration & Polish (6 tasks)

Start with:
  → scripts/enrich-spotify-metadata.ts (Phase 1 foundation)
  → src/types/artist.ts (schema updates)

First task: Update scripts/enrich-spotify-metadata.ts with album selection logic

Ready to begin? (yes / show spec summary / show tasks)

> yes

Starting Phase 1: Data Pipeline...
```

### Direct Spec Selection

```
> /implement --spec map-renamed-venue-badges

🚀 Ready to Implement: Map Renamed Venue Badges
════════════════════════════════════════════

Spec: docs/specs/future/map-renamed-venue-badges.md
Target: v2.1.0
Priority: Medium | Complexity: Low

...
```
