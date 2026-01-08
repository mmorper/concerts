# /spec — Create a Feature Specification

Generate a new feature spec following project standards. Creates implementation-ready documentation for Claude Code sessions.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--name` | No | (prompted) | Feature name (kebab-case for filename) |
| `--dry-run` | No | false | Preview spec without creating file |

**Examples:**
```
/spec                           # Full interactive mode
/spec --name artist-search      # Pre-fill name
/spec --dry-run                 # Preview only
```

---

## Workflow

### Step 1: Gather Feature Info

Prompt for each field:

**1. Feature Name:**
> What's the feature name? (e.g., "Artist Search", "Tour Dates Panel")

**2. Target Version:**
> Target version? (e.g., 1.10.0, or "next" for TBD)

**3. Priority:**
> Priority level?
> - **High** — Core functionality, blocks other work
> - **Medium** — Important but not blocking
> - **Low** — Nice to have, opportunistic

**4. Complexity:**
> Estimated complexity?
> - **Low** — Single component, <1 day
> - **Medium** — Multiple components, 1-3 days
> - **High** — Cross-scene, API integration, 3-5 days
> - **Very High** — Major feature, 1+ weeks

**5. Brief Description:**
> Describe the feature in 2-3 sentences. What problem does it solve?

**6. Dependencies:**
> Does this depend on other features? (comma-separated, or "none")

---

### Step 2: Determine Scene Context

**7. Which scene(s)?**
> Which scene(s) does this feature affect?
> 1. Timeline (Scene 1)
> 2. Venues (Scene 2)
> 3. Geography (Scene 3)
> 4. Genres (Scene 4)
> 5. Artists (Scene 5)
> 6. Cross-scene / Global
> 7. New scene
> 
> (Enter numbers, comma-separated)

Based on selection, note relevant background colors, component patterns, and existing files to reference.

---

### Step 3: ROADMAP Placement

**8. Add to ROADMAP.md?**
> Add this to ROADMAP.md?
> - **short** — Add to Short-Term Roadmap
> - **medium** — Add to Medium-Term Roadmap
> - **no** — Don't add yet (draft/exploratory)

If yes, also ask:
> Brief tagline for ROADMAP entry? (one line)

---

### Step 4: Generate Spec

Create file at `docs/specs/future/{feature-name}.md` using template:

```markdown
# {Feature Name}

**Status:** Planned
**Target Version:** v{VERSION}
**Priority:** {PRIORITY}
**Estimated Complexity:** {COMPLEXITY}
**Dependencies:** {DEPENDENCIES}

---

## Executive Summary

{DESCRIPTION}

[Expand this section with:]
- What problem it solves
- How it enhances the user experience
- How it fits into the overall product

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the {Feature Name} feature for Morperhaus Concerts.

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
- [TODO: 3-5 bullet points describing what it does]

**Key References:**
- Full Design Spec: docs/specs/future/{feature-name}.md
- Scene Design Guide: docs/design/scene-design-guide.md
- Color Specification: docs/design/color-specification.md
- UI Patterns: docs/design/ui-component-patterns.md
{SCENE_SPECIFIC_REFS}

**Implementation Approach:**
- Window 1: [TODO: Foundation work]
- Window 2: [TODO: UI components]
- Window 3: [TODO: Integration & polish]

**Design Philosophy:**
[TODO: 1-2 sentences on UX goal]

**Key Design Details:**
[TODO: Dimensions, colors, animation timing]

**Files to Create:**
[TODO: List new files with estimated LOC]

**Files to Modify:**
[TODO: List existing files and what changes]

Let's start with Window 1. Should I begin by [TODO: first task]?
```

---

## Design Philosophy

[TODO: The conceptual model and UX goals]

---

## Visual Design

### [Component Area]

**Specifications:**
- Dimensions: [TODO]
- Colors: [TODO - reference color-specification.md]
- Typography: [TODO - reference scene-design-guide.md]
- Spacing: [TODO]

**Layout:**
```
[TODO: ASCII mockup or description]
```

---

## Interaction Design

### Animation Sequence

[TODO: Document animations with timing and easing]

### Hover/Active States

[TODO: Document interactive states]

### Accessibility

[TODO: Keyboard navigation, ARIA labels, focus management]

---

## Technical Implementation

### Component Architecture

[TODO: File structure and component hierarchy]

### State Management

[TODO: State variables and their purposes]

### Data Flow

[TODO: How data moves through the system]

### API Integration (if applicable)

[TODO: Service module design, endpoints, caching]

---

## Testing Strategy

### Manual Testing Checklist

- [ ] [TODO: Test case 1]
- [ ] [TODO: Test case 2]
- [ ] Mobile responsive
- [ ] Keyboard navigation works
- [ ] No console errors

### Test Data

[TODO: Known data points for testing]

---

## Implementation Plan

### Phase 1: Foundation (Window 1)

**Files to Create:**
- [TODO]

**Files to Modify:**
- [TODO]

**Tasks:**
1. [TODO]

**Acceptance Criteria:**
- [ ] [TODO]

### Phase 2: UI Components (Window 2)

[TODO: Repeat pattern]

### Phase 3: Integration & Polish (Window 3)

[TODO: Repeat pattern]

---

## Future Enhancements

[TODO: Post-MVP improvements]

---

## Questions for Review

- [TODO: Open questions needing decisions]

---

## Revision History

- **{TODAY'S DATE}:** Initial specification created
- **Version:** 1.0.0
- **Author:** [Your name]
- **Status:** Planned
```

---

### Step 5: Scene-Specific References

Based on scene selection, inject relevant references:

**Scene 1 (Timeline):**
```markdown
- Existing Timeline: src/components/scenes/Scene1Hero.tsx
- Background: Light (#ffffff)
- Accent: New Wave blue (#1e3a8a)
```

**Scene 2 (Venues):**
```markdown
- Existing Network: src/components/scenes/Scene4Bands.tsx
- Background: Dark gradient (#1e1b4b → #581c87)
- UI Pattern: Solid buttons (gray-800 inactive, indigo-600 active)
```

**Scene 3 (Geography):**
```markdown
- Existing Map: src/components/scenes/Scene3Map.tsx
- Background: Dark (#111827)
- Markers: Indigo with glow
```

**Scene 4 (Genres):**
```markdown
- Existing Sunburst: src/components/scenes/Scene5Genres.tsx
- Background: Light violet (#ede9fe)
- Uses full genre color palette
```

**Scene 5 (Artists):**
```markdown
- Existing Gatefold: src/components/scenes/ArtistScene/
- Background: Light stone (#fafaf9)
- UI Pattern: Solid buttons (white inactive, violet-600 active)
```

---

### Step 6: ROADMAP Update (if requested)

If user selected `short` or `medium`:

**Add entry to `docs/ROADMAP.md`:**

```markdown
### {Feature Name}
**Status**: Planned
**Spec**: [{feature-name}.md](specs/future/{feature-name}.md)

{TAGLINE}
```

Insert in appropriate section:
- `short` → Under `## Short-Term Roadmap`
- `medium` → Under `## Medium-Term Roadmap`

---

### Step 7: Preview & Confirm

**🔵 CHECKPOINT: Show preview**

```
📄 Spec Preview: {Feature Name}
═══════════════════════════════

Location: docs/specs/future/{feature-name}.md

Metadata:
  - Version: {VERSION}
  - Priority: {PRIORITY}
  - Complexity: {COMPLEXITY}
  - Scene(s): {SCENES}

ROADMAP: {Will/Won't} add to {section}

Preview first 50 lines of spec...
[show preview]
```

**If `--dry-run`:**
> 🏁 Dry run complete. No files created.

**If normal run:**
> Create this spec? (yes / edit / cancel)

---

### Step 8: Write Files

1. Write spec to `docs/specs/future/{feature-name}.md`
2. Update `docs/ROADMAP.md` if requested
3. Confirm:

> ✅ Spec created: `docs/specs/future/{feature-name}.md`
> 
> **Next steps:**
> - Fill in TODO sections
> - Review with stakeholders
> - When ready, start implementation with the Quick Start prompt

---

## Filename Convention

**Pattern:** `{scene}-{feature}.md`

Where `{scene}` is one of:

- `timeline` — Scene 1 (Timeline)
- `venues` — Scene 2 (Venues/Network)
- `geography` — Scene 3 (Map)
- `genres` — Scene 4 (Sunburst)
- `artists` — Scene 5 (Gatefold)
- `global` — Cross-scene or app-wide features

And `{feature}` is a 1-3 word intuitive label for the primary capability (kebab-case).

**Examples:**

- Timeline decade filter → `timeline-decade-filter.md`
- Artist search typeahead → `artists-search-typeahead.md`
- Venue photo thumbnails → `venues-photo-thumbnails.md`
- Geography heatmap → `geography-heatmap.md`
- Genre drill-down → `genres-drill-down.md`
- App-wide keyboard shortcuts → `global-keyboard-shortcuts.md`
- Cross-scene navigation → `global-cross-navigation.md`

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "Spec already exists" | File exists in `future/` or `implemented/` | Choose different name or update existing |
| "Invalid version format" | Not semver | Use format like `1.10.0` |
| "ROADMAP update failed" | Structure changed | Manual update needed |

---

## Related

- `.claude/spec-writing-guide.md` — Full spec writing standards
- `.claude/skills/design-system/` — Design tokens and patterns
- `/release` — Ships completed features
