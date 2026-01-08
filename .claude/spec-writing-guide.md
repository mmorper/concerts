# Feature Specification Writing Guide

**Purpose:** Standards for writing feature specifications that can be implemented in fresh Claude Code sessions with no prior context.

**Last Updated:** 2026-01-06
**Version:** 1.1

---

## Core Principles

### 1. **Specifications are Implementation-Ready**

- Specs should be detailed enough for a fresh Claude Code session to implement without additional context
- Include all design decisions, constraints, and rationale
- Provide exact values (colors, dimensions, timing) not approximations
- Document the "why" not just the "what"

### 2. **Implementation Quick Start Section (REQUIRED)**

Every spec MUST include an "Implementation Quick Start" section immediately after the Executive Summary with:

#### Required Elements:

1. **Context Window Management Instructions**
   ```
   **IMPORTANT CONTEXT WINDOW MANAGEMENT:**
   - This is a fresh session with NO prior context about the project
   - You have access to the full codebase and can read any files
   - At the end of EACH implementation window, you MUST:
     1. Assess remaining context window capacity
     2. If <30% remains, STOP and ask if I want to continue in a new session
     3. Provide a handoff summary for the next session
   - Implement the spec AS WRITTEN - it's the source of truth
   - Ask clarifying questions if anything is ambiguous or needs decision
   - Read files proactively to understand existing patterns before writing code
   ```

2. **Feature Overview** (3-5 bullet points)
   - What the feature does at a high level
   - Key user interactions
   - Primary value proposition

3. **Key References**
   - Link to full design spec
   - Link to API setup guide (if applicable)
   - Link to existing related components

4. **Implementation Approach** (Multi-Window Breakdown)
   - Break into 2-4 context windows
   - Window 1: Foundation/API/Services
   - Window 2: UI Components
   - Window 3: Integration & Polish
   - Window 4: Testing & Deployment (optional)
   - List specific files to create/modify per window

5. **Design Philosophy** (1-2 sentences)
   - The metaphor or mental model
   - User experience goal

6. **Key Design Details**
   - Exact dimensions (px)
   - Animation timing (ms) and easing functions
   - Color values (hex/rgba)
   - Typography (font families, sizes, weights)
   - Z-index values
   - Any other critical visual/interaction details

7. **API/Integration Details** (if applicable)
   - Endpoint URLs
   - Authentication method
   - Request/response format
   - Caching strategy
   - Error handling approach
   - Rate limits

8. **Technical Strategy** (if complex)
   - Matching algorithms
   - State management approach
   - Performance optimizations
   - Edge case handling

9. **Current State of Related Features**
   - What's already implemented
   - What components/systems exist
   - Z-index layering scheme
   - Animation patterns in use

10. **Files to Create** (with line count estimates)
    - List each new file
    - Approximate LOC for sizing

11. **Files to Modify**
    - List existing files that need changes
    - Brief description of what changes

12. **Suggested Starting Point**
    - End with a question to guide Claude's first action
    - Example: "Let's start with Window 1: API Integration. Should I begin by creating the setlist.fm service module?"

### 3. **Prompt Location**

- **MUST** be placed immediately after Executive Summary
- **MUST** be wrapped in a code fence for easy copy/paste
- Use clear section header: "## 🚀 Implementation Quick Start"
- Include instruction: "Copy/paste this prompt when starting a NEW Claude Code session (no prior context):"

---

## Spec Structure Template

```markdown
# Feature Name - Brief Descriptor

**Status:** Planned | In Progress | Complete
**Target Version:** v1.x.x
**Priority:** High | Medium | Low
**Estimated Complexity:** Low | Medium | High | Very High
**Dependencies:** [List features that must be complete first]

---

## Executive Summary

[2-3 paragraphs describing the feature at a high level]
- What problem it solves
- How it enhances the user experience
- How it fits into the overall product

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

\`\`\`
[COMPLETE IMPLEMENTATION PROMPT - See Required Elements above]
\`\`\`

---

## Design Philosophy

[The conceptual model and UX goals]

---

## Visual Design

### [Component/Feature Area 1]

**Specifications:**
- Dimensions: [exact px values]
- Colors: [hex/rgba values]
- Typography: [font-family, size, weight]
- Spacing: [padding/margin values]

**Layout:**
\`\`\`
[ASCII mockup or detailed description]
\`\`\`

### [Component/Feature Area 2]

[Repeat pattern]

---

## Interaction Design

### Animation Sequence

**[Interaction Name]:**
1. [Step 1 with timing and easing]
2. [Step 2 with timing and easing]
3. [etc.]

### Hover States

[Document all hover behaviors]

### Accessibility

[Keyboard navigation, ARIA labels, focus management]

---

## Technical Implementation

### Component Architecture

[File structure and component hierarchy]

### State Management

[State variables and their purposes]

### Data Flow

[How data moves through the system]

### API Integration (if applicable)

[Service module design, endpoints, caching]

### Performance Considerations

[Optimizations, bundle size impact]

---

## Matching Logic / Algorithms (if applicable)

[Detailed explanation of any complex logic]

---

## Testing Strategy

### Manual Testing Checklist

- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] [etc.]

### Test Data

[Known data points for testing]

---

## Implementation Plan

### Phase 1: [Name] (Window 1)

**Files to Create:**
- [file path] - [purpose]

**Files to Modify:**
- [file path] - [changes]

**Tasks:**
1. [Task 1]
2. [Task 2]

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Phase 2: [Name] (Window 2)

[Repeat pattern]

---

## Dependencies

### Required
- [Feature that must exist]

### Optional
- [Feature that enhances but isn't blocking]

---

## Future Enhancements

[Post-MVP improvements]

---

## Cost Analysis (if applicable)

[API costs, infrastructure costs]

---

## Accessibility Compliance

[WCAG requirements and how they're met]

---

## Cross-Browser Compatibility

[Browser support matrix and known issues]

---

## Success Metrics

### Quantitative Metrics
[Measurable KPIs]

### Qualitative Metrics
[User satisfaction, design goals]

---

## Documentation Updates Required

[List of docs that need updating]

---

## Related Specifications

[Links to parent/child/related specs]

---

## Questions for Review

[Open questions for stakeholder decision]

---

## Revision History

- **YYYY-MM-DD:** Initial specification created
- **Version:** 1.0.0
- **Author:** [Name/Role]
- **Status:** [Current status]
```

---

## Context Window Management Protocol

### Why It Matters

- Claude Code sessions have finite context windows (~200K tokens)
- Large features can exhaust context mid-implementation
- Continuing in a degraded state leads to:
  - Repeated context
  - Missed details
  - Implementation drift from spec

### Required Practice

**At the end of EACH implementation phase/window:**

1. **Check Context Usage**
   - Claude will report token usage
   - Calculate remaining capacity
   - If <30% remains (or <60K tokens), STOP

2. **Stopping Protocol**
   - Complete current file/component
   - Do NOT start next phase
   - Ask user: "Context window at X%. Should I continue in a new session?"

3. **Handoff Summary**
   - List files created/modified
   - State current progress in implementation plan
   - Identify next phase/window
   - Note any deviations from spec
   - Flag any blocking issues

4. **New Session Resume**
   - User creates new Claude Code session
   - User provides handoff summary
   - User references spec for full context
   - Claude reads completed files to understand state
   - Continue from next phase

### Benefits

- ✅ Fresh context for each phase
- ✅ Full access to codebase for reading
- ✅ Maintains alignment with spec
- ✅ Higher quality implementation
- ✅ Easier debugging and iteration

---

## Spec Writing Checklist

Before marking a spec as "Ready for Implementation":

- [ ] Executive Summary clearly explains the feature
- [ ] Implementation Quick Start section exists at top
- [ ] All 11 required elements in Quick Start are present
- [ ] Context window management instructions included
- [ ] Multi-window implementation plan with file lists
- [ ] Exact design values provided (no "approximately")
- [ ] API details documented (if applicable)
- [ ] Current state of codebase described
- [ ] Starting point question included
- [ ] Testing checklist provided
- [ ] Dependencies listed
- [ ] Related docs identified for updates

---

## Example: Good vs Bad Quick Start Prompts

### ❌ Bad (Too Vague)

```
Implement setlist integration for the artist view.
Use setlist.fm API to fetch concert setlists.
Make it look nice with smooth animations.
```

**Problems:**
- No context window guidance
- No file structure
- No design specs
- No implementation phases
- No current state context

### ✅ Good (Implementation-Ready)

```
I need to implement the Setlist Liner Notes feature for the Artist Scene gatefold.

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
[Full instructions]

**Feature Overview:**
- Enhance the Concert History Panel (left side of gatefold) with clickable three-dot icons next to each concert
- When clicked, a "liner notes" panel slides in from the right, covering the Spotify panel
- The liner notes show the actual setlist from that concert, fetched from setlist.fm API
- Users can switch between concerts smoothly (old slides out left, new slides in right)
- Users can close via X button, clicking outside, or ESC key

**Key References:**
- Full Design Spec: docs/specs/future/setlist-liner-notes.md
- API Setup Guide: docs/api-setup.md (setlist.fm section)
- Existing Components: src/components/scenes/ArtistScene/

**Implementation Approach:**
[4 detailed windows with file lists]

**Key Design Details:**
- Liner notes: 380×380px panel (10px margin inside 400×400px)
- Animation: 400ms slide with cubic-bezier(0.4, 0, 0.2, 1)
- Background: rgba(24, 24, 24, 0.98) with subtle paper texture (optional)
- Typography: Playfair Display (artist name), Source Sans 3 (content)
- Section headers: #1DB954 (Spotify green), uppercase, tracking-wider

**API Details:**
[Full endpoint, auth, caching strategy]

**Current State:**
[Existing gatefold features]

**Files You'll Create:**
[Complete list with LOC estimates]

**Files You'll Modify:**
[Complete list with change descriptions]

Let's start with Window 1: API Integration. Should I begin by creating the setlist.fm service module?
```

**Strengths:**
- ✅ Context window management upfront
- ✅ Complete technical details
- ✅ Clear phases with boundaries
- ✅ Exact design specifications
- ✅ Current state context
- ✅ File-level breakdown
- ✅ Guided starting point

---

## Spec Review Process

### Before Implementation

1. **Lead Architect Review**
   - Technical feasibility
   - Architectural alignment
   - Dependencies satisfied

2. **Design Review**
   - Visual consistency
   - UX patterns match existing
   - Accessibility considerations

3. **Implementation Prompt Test**
   - Read prompt in isolation
   - Can you implement without questions?
   - Are all decisions documented?

### During Implementation

1. **Spec is Source of Truth**
   - Implementer follows spec exactly
   - Questions/ambiguities raised immediately
   - No "creative interpretation"

2. **Spec Updates**
   - Discoveries during implementation → spec updates
   - Keep spec and implementation aligned
   - Document deviations with rationale

### After Implementation

1. **Ship the Release**
   - Run `/release minor` (or `/release patch`) in Claude Code
   - Command handles changelog, ROADMAP, spec file moves, git operations
   - See `.claude/commands/README.md` for details

2. **Mark Spec Complete**
   - Move from `/specs/future/` to `/specs/implemented/` (done by `/release` if selected)
   - Add implementation date and commit hash
   - Update status to `✅ IMPLEMENTED`

3. **Retrospective Notes**
   - What went well?
   - What should be in template for next spec?
   - Update this guide if needed

---

## Related Documents

- [.claude/context.md](context.md) - Project overview for new sessions
- [.claude/commands/README.md](commands/README.md) - Release workflow commands
- [docs/ROADMAP.md](../docs/ROADMAP.md) - Current roadmap and priorities
- [docs/planning.md](../docs/planning.md) - Historical implementation record
- [docs/specs/future/](../docs/specs/future/) - Upcoming feature specs

---

## Version History

- **2026-01-06:** Added `/release` command reference, fixed doc references
- **2026-01-02:** Initial guide created based on setlist-liner-notes.md learnings
- **Author:** Lead Architect
- **Status:** Living document - update as patterns emerge
