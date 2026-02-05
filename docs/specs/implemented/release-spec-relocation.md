# Release Command: Automatic Spec Relocation

## Overview

Enhance the `/release` command to automatically detect and relocate completed feature specs from `docs/specs/future/` to `docs/specs/implemented/` when their associated GitHub issues are closed.

**Type:** Process Enhancement
**Priority:** Medium
**Complexity:** Low-Medium
**Effort:** ~2-3 hours

---

## Problem Statement

Currently, when issues are closed during a release:
1. Specs associated with those issues remain in `docs/specs/future/`
2. Manual spec relocation is required post-release
3. Specs can become orphaned or forgotten
4. Documentation organization drifts out of sync with completion status

This creates documentation debt and requires manual housekeeping.

---

## Proposed Solution

Extend `/release` Step 10 (Close Related Issues) to:
1. Parse each closed issue for spec references
2. Check if referenced spec exists in `docs/specs/future/`
3. Prompt user to move spec to `docs/specs/implemented/`
4. Execute `git mv` if confirmed
5. Include spec moves in the release commit

---

## User Experience

### Current Flow (Step 10)

```
📋 Open GitHub Issues
═══════════════════════

[1] #25 - Create /roadmap skill
[2] #24 - Confirm site metadata updates

Which issues does this release complete? 1,2

Closing 2 issues:
  ✓ Closed #25
  ✓ Closed #24
```

### Enhanced Flow (Step 10)

```
📋 Open GitHub Issues
═══════════════════════

[1] #25 - Create /roadmap skill
[2] #24 - Confirm site metadata updates

Which issues does this release complete? 1,2

Closing 2 issues:
  ✓ Closed #25
    → Spec found: docs/specs/future/roadmap-skill.md
    Move to implemented? (yes / no / skip-all): yes
    ✓ Moved roadmap-skill.md to implemented/

  ✓ Closed #24
    → No spec reference found
```

---

## Technical Implementation

### 1. Spec Detection

**Parse issue body for spec references:**

```typescript
interface SpecReference {
  path: string
  exists: boolean
  inFuture: boolean
}

function extractSpecFromIssue(issueBody: string): SpecReference | null {
  // Pattern 1: Explicit spec line
  const specLineMatch = issueBody.match(/\*\*Spec:\*\*\s+(.+\.md)/i)

  // Pattern 2: Markdown link in spec section
  const specLinkMatch = issueBody.match(/\[docs\/specs\/future\/(.+\.md)\]/i)

  if (specLineMatch || specLinkMatch) {
    const specPath = specLineMatch?.[1] || `docs/specs/future/${specLinkMatch![1]}`

    return {
      path: specPath,
      exists: fs.existsSync(specPath),
      inFuture: specPath.includes('/future/')
    }
  }

  return null
}
```

### 2. Integration Point

**Location:** `.claude/commands/release.md` Step 10

**Before:**
```bash
gh issue close {NUMBER} --comment "Completed in v{VERSION}..."
```

**After:**
```bash
# Close issue
gh issue close {NUMBER} --comment "Completed in v{VERSION}..."

# Check for spec
SPEC=$(gh issue view {NUMBER} --json body --jq '.body' | grep -o 'docs/specs/future/[^)]*\.md' || echo "")

if [ -n "$SPEC" ] && [ -f "$SPEC" ]; then
  echo "→ Spec found: $SPEC"
  read -p "Move to implemented? (yes/no/skip-all): " RESPONSE

  if [ "$RESPONSE" = "yes" ]; then
    git mv "$SPEC" "docs/specs/implemented/$(basename $SPEC)"
    echo "✓ Moved $(basename $SPEC) to implemented/"
  fi
fi
```

### 3. Prompt Options

**User responses:**
- `yes` — Move this spec to implemented/
- `no` — Skip this spec, keep in future/
- `skip-all` — Skip all remaining spec moves for this release

**State management:**
```typescript
let skipAllSpecs = false

for (const issue of closedIssues) {
  closeIssue(issue.number)

  if (!skipAllSpecs) {
    const spec = extractSpecFromIssue(issue.body)

    if (spec && spec.exists && spec.inFuture) {
      const response = await prompt(`Move ${spec.path} to implemented?`, ['yes', 'no', 'skip-all'])

      if (response === 'yes') {
        await moveSpec(spec.path)
      } else if (response === 'skip-all') {
        skipAllSpecs = true
      }
    }
  }
}
```

### 4. Git Integration

**Spec moves should be part of release commit:**

```bash
# In Step 8: Git Operations
git add package.json CLAUDE.md .claude/context.md
git add docs/specs/implemented/*.md  # Include moved specs
git commit -m "release: v{VERSION} - {TITLE}"
```

**Alternative: Separate commit:**

```bash
# After issue closure, before final release commit
if [ ${#MOVED_SPECS[@]} -gt 0 ]; then
  git add docs/specs/implemented/*.md
  git commit -m "docs: Move completed specs to implemented (v{VERSION})"
fi
```

---

## Edge Cases

### Multiple Issues → Same Spec

**Scenario:** Issues #10, #11, #12 all reference `venue-photos.md`

**Behavior:**
- First closure prompts to move spec
- Subsequent closures skip (spec already moved)
- Output: `✓ Spec already in implemented/`

### Spec Already in Implemented

**Scenario:** Issue references `docs/specs/implemented/audio-previews.md`

**Behavior:**
- Detect spec is already in implemented/
- Skip prompt
- Output: `→ Spec already implemented`

### Spec Doesn't Exist

**Scenario:** Issue references non-existent spec path

**Behavior:**
- Detect spec file doesn't exist
- Skip prompt
- Output: `→ Spec file not found (may have been removed)`

### No Spec Reference

**Scenario:** Issue has no spec reference in body

**Behavior:**
- No output
- Continue to next issue

### Partial Implementation

**Scenario:** Spec describes multi-phase feature, only Phase 1 complete

**Behavior:**
- Prompt user: "Move to implemented?"
- User responds: "no" (keep in future/)
- Spec remains in future/ for continued work

---

## Acceptance Criteria

### Detection
- [ ] Parses issue body for spec references
- [ ] Supports `**Spec:** path/to/spec.md` format
- [ ] Supports `[path/to/spec.md](...)` markdown link format
- [ ] Handles both absolute and relative paths
- [ ] Validates spec file exists before prompting

### User Interaction
- [ ] Prompts per spec: "Move to implemented? (yes/no/skip-all)"
- [ ] `yes` → Moves spec to implemented/
- [ ] `no` → Skips this spec
- [ ] `skip-all` → Skips all remaining specs
- [ ] Clear visual feedback for each action

### Edge Cases
- [ ] Handles multiple issues → same spec
- [ ] Handles spec already in implemented/
- [ ] Handles spec file not found
- [ ] Handles no spec reference
- [ ] Handles invalid/malformed paths

### Git Integration
- [ ] Moved specs included in release commit
- [ ] OR moved specs in separate commit (before release commit)
- [ ] Commit message references spec moves
- [ ] Git history shows spec relocation

### Documentation
- [ ] `.claude/commands/release.md` updated with new step
- [ ] Examples added to release documentation
- [ ] Edge cases documented

---

## Testing Checklist

**Scenarios to test:**

1. **Happy path:** Issue with spec reference → Move to implemented
2. **Decline move:** Issue with spec → User says "no"
3. **Skip all:** Multiple issues with specs → User says "skip-all" on first
4. **Already moved:** Spec already in implemented/
5. **Not found:** Spec reference but file doesn't exist
6. **No reference:** Issue has no spec reference
7. **Multiple issues:** Two issues reference same spec
8. **Dry run:** `--dry-run` flag shows what would be moved

---

## Implementation Notes

### Parsing Strategy

**Robust parsing:**
```typescript
// Look for common patterns
const patterns = [
  /\*\*Spec:\*\*\s+(docs\/specs\/future\/[^\s)]+\.md)/i,
  /\[([^\]]+\.md)\]\(docs\/specs\/future\//i,
  /docs\/specs\/future\/([a-z0-9-]+\.md)/i,
]

for (const pattern of patterns) {
  const match = issueBody.match(pattern)
  if (match) {
    return normalizeSpecPath(match[1])
  }
}
```

**Path normalization:**
```typescript
function normalizeSpecPath(path: string): string {
  // Handle relative paths
  if (!path.startsWith('docs/')) {
    path = `docs/specs/future/${path}`
  }

  // Ensure .md extension
  if (!path.endsWith('.md')) {
    path += '.md'
  }

  return path
}
```

### Batch Mode (Future Enhancement)

For fully automated releases:
```bash
/release minor --auto-move-specs
```

Automatically moves all specs without prompting.

---

## Related

- **Enhancement to:** `.claude/commands/release.md` Step 10
- **Related Issue:** #26 (this enhancement)
- **Benefits:** Reduces documentation debt, improves release completeness
- **Risk:** Low (user confirmation prevents accidents)

---

## Success Metrics

**Qualitative:**
- Fewer forgotten spec moves post-release
- Documentation structure stays current
- Reduced manual housekeeping

**Quantitative:**
- Track: Specs moved automatically vs. manually
- Goal: >80% of completed specs moved during release

---

## Future Enhancements

1. **Spec status updates:** Update spec header with completion date/version
2. **Cross-linking:** Add "Implemented in: v{VERSION}" to spec front matter
3. **Reverse search:** Find issues from spec references (not just spec from issues)
4. **Batch operations:** `/release --auto-move-specs` for fully automated flow
5. **Validation:** Check spec content mentions the version number

---

## Example Output

```
📋 Closing 3 issues and checking for specs
════════════════════════════════════════════

Issue #25: Create /roadmap skill
  ✓ Closed with comment
  → Spec found: docs/specs/future/roadmap-skill.md
  Move to implemented? (yes / no / skip-all): yes
  ✓ Moved roadmap-skill.md → implemented/

Issue #24: Confirm site metadata updates
  ✓ Closed with comment
  → No spec reference found

Issue #23: Improve documentation accuracy
  ✓ Closed with comment
  → Spec already in implemented/
  ℹ️  Skipped (already implemented)

Summary:
  • 3 issues closed
  • 1 spec moved to implemented/
  • Changes staged for commit
```
