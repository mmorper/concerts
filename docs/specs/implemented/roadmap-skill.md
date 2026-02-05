# Roadmap Skill: Dynamic "What's Next" Generation

**Status:** Ready to Implement
**Version:** 1.0
**Created:** 2026-02-04
**Category:** Developer Experience, Documentation

---

## Overview

Automate the generation of the README.md "What's Next" section by intelligently analyzing open GitHub issues and presenting them as a compelling, user-friendly roadmap.

### Problem Statement

The "What's Next" section in README.md is currently sparse and requires manual curation. As the project evolves with 15+ open issues across features, enhancements, and fixes, keeping this section current and engaging is time-consuming and easy to forget during releases.

**Current state (README.md lines 132-136):**
```markdown
## What's Next

A few things I'm thinking about (whenever I get around to them):

And always: more shows to add to the list.
```

**Desired state:**
A dynamically generated, thoughtfully categorized roadmap that:
- Surfaces the most important upcoming work
- Groups issues into meaningful categories (New Capabilities, Enhancements, Fixes)
- Uses engaging, user-friendly language (Product Marketer voice)
- Links to representative issues as examples
- Updates automatically as part of the release process

---

## Solution: `/roadmap` Skill

A new Claude Code slash command that fetches open GitHub issues, uses AI to categorize and summarize them, and updates the README.md "What's Next" section with compelling, outcome-focused prose.

### User Experience

**Invocation:**
```bash
/roadmap              # Full update with AI categorization
/roadmap --preview    # Show generated content without writing
```

**Output:**
```
🗺️  Analyzing open GitHub issues...

Fetched 15 open issues:
  - 3 New Capabilities
  - 8 Enhancements
  - 4 Fixes

Generated roadmap summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**New Capabilities**
Building out features that add entirely new ways to experience
the archive. The audio preview integration proved how powerful
these immersive touches can be—thinking about extending that to
setlist items ([#22](https://github.com/mmorper/concerts/issues/22))
and bringing the full discography UI to life in the Artist gatefold
([#5](https://github.com/mmorper/concerts/issues/5)).

**Enhancements**
Polishing existing features with better cross-scene navigation
([#9](https://github.com/mmorper/concerts/issues/9)), smarter venue
status badges ([#8](https://github.com/mmorper/concerts/issues/8)),
and more accurate documentation ([#23](https://github.com/mmorper/concerts/issues/23)).
The kind of improvements that make everything feel more cohesive and
discoverable.

**Fixes**
Addressing deployment workflow gaps ([#13](https://github.com/mmorper/concerts/issues/13))
and ensuring all site metadata stays current ([#24](https://github.com/mmorper/concerts/issues/24)).
Foundational work that keeps everything running smoothly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update README.md "What's Next" section? (yes / edit / cancel)
```

**If confirmed:**
- Updates README.md lines 132-139
- Preserves the closing line: "And always: more shows to add to the list."
- Shows git diff
- Ready to commit as part of release

---

## Categorization Logic

### Three Categories

**1. New Capabilities**
Major features that add entirely new functionality or user-facing experiences.

**Indicators:**
- Creates new scenes, panels, or major UI components
- Adds completely new data sources or integrations
- Enables new user workflows or interaction patterns
- Title patterns: "Add", "Implement", "Create", "Build"
- Examples: Audio preview player, new scene, discography UI, setlist playback

**2. Enhancements**
Improvements to existing features, UX polish, documentation updates, tooling improvements.

**Indicators:**
- Refines existing functionality without fundamentally changing it
- Improves documentation accuracy or completeness
- Adds convenience features or better cross-linking
- UX polish, visual refinements, better error handling
- Title patterns: "Improve", "Enhance", "Refactor", "Polish", "Update"
- Examples: Cross-scene navigation, venue badges, documentation accuracy, visual testing

**3. Fixes**
Bug fixes, broken functionality, technical debt that prevents things from working as intended.

**Indicators:**
- Resolves incorrect behavior or broken features
- Addresses data pipeline gaps or deployment issues
- Fixes regression or misconfiguration
- Title patterns: "Fix", "Resolve", "Address", "Correct"
- Examples: Metadata generation, deployment workflow, data validation

### AI Analysis Prompt

The skill should analyze each issue using this framework:

```
Analyze this GitHub issue and categorize it:

Issue #${number}: ${title}
${body_excerpt}

Categories:
- New Capability: Major new feature or user-facing experience
- Enhancement: Improvement to existing feature, docs, or UX polish
- Fix: Bug fix, broken functionality, or technical debt

Consider:
- Scope of change (new vs. improving existing)
- User impact (enables new workflow vs. refines existing)
- Technical nature (feature vs. polish vs. repair)

Respond with:
1. Category (one of: capability, enhancement, fix)
2. Confidence (high, medium, low)
3. Brief rationale (1 sentence)
```

### Summarization Strategy

**Not a list, a narrative:**
- Don't enumerate every issue
- Tell a story about what's coming
- Group related issues into themes
- Link 1-3 representative examples per category
- Focus on outcomes, not implementation details
- Use Product Marketer voice (see Voice Guidelines below)

**Issue reference hyperlinking:**
- AI generates plain issue references: `(#22)`
- Post-processing converts to markdown links: `([#22](https://github.com/owner/repo/issues/22))`
- Repository owner/name dynamically determined from git remote
- Makes README more interactive and professional

**Selection criteria for linked examples:**
- High-impact or high-interest features
- Clear, easy-to-understand examples
- Span different areas (UI, data, infrastructure)
- Prefer issues with detailed specs over vague ideas

---

## Voice & Tone Guidelines

**Use the Product Marketer voice from `.claude/readme-maintenance.md`:**

✅ **Do:**
- Speak to outcomes and benefits
- Use warm, conversational language
- Make technical concepts accessible
- Show enthusiasm without hyperbole
- Connect features to user experience
- Example: "Polishing existing features with better cross-scene navigation"

❌ **Don't:**
- Use jargon or technical implementation details
- List dry bullet points of features
- Sound like a bug tracker or project manager
- Use corporate speak or marketing fluff
- Focus on "what" without "why"

**Tone examples:**

| Bad (Technical) | Good (Product Marketer) |
|----------------|------------------------|
| "Implement Puppeteer visual regression tests" | "Building a comprehensive visual testing suite to catch UI regressions early" |
| "Refactor validation architecture for separation of concerns" | "Cleaning up the data validation pipeline for easier maintenance" |
| "Add click handlers to venue artist nodes" | "Making it easier to explore connections with clickable artist names in the venue graph" |

---

## Integration with Release Process

### When to Run

**Automatically during `/release` command:**

Add to [.claude/commands/release.md](/.claude/commands/release.md) as Step 5.5 (after changelog, before file updates):

```markdown
### Step 5.5: Update Roadmap (Optional)

**If user-facing changes exist (liner notes published):**

> **Update roadmap?** [Y/n]
>
> The "What's Next" section in README.md can be refreshed to reflect
> current open issues. This helps keep the roadmap current for visitors
> who land on the GitHub repo.

If confirmed, invoke `/roadmap --auto` (non-interactive mode)

**If NO user-facing commits:**
Skip roadmap update (internal-only releases don't need README changes)
```

**Manual invocation:**
Users can also run `/roadmap` standalone anytime to refresh the roadmap.

---

## Technical Implementation

### Skill Structure

```
.claude/skills/roadmap/
├── SKILL.md           # Skill definition and invocation logic
├── prompt.md          # AI categorization prompt template
└── examples.md        # Example categorizations for reference
```

### Data Flow

```
1. Fetch issues
   └─> gh issue list --state open --json number,title,body,labels

2. Analyze each issue
   └─> AI categorization (capability/enhancement/fix)
   └─> Store: { number, title, category, confidence }

3. Generate summary
   └─> Group by category
   └─> Select representative examples (2-3 per category)
   └─> Write prose using Product Marketer voice
   └─> Format with plain issue references: (#N)

3.5. Hyperlink issue references
   └─> Get repo owner/name from git remote
   └─> Convert (#N) to ([#N](https://github.com/owner/repo/issues/N))
   └─> Apply to all category summaries

4. Update README
   └─> Replace lines 132-139 (What's Next section)
   └─> Preserve closing line
   └─> Show diff

5. Confirm and write
   └─> User reviews and approves
   └─> Write to README.md
```

### GitHub CLI Commands

```bash
# Fetch all open issues with full details
gh issue list --state open --json number,title,body,labels --limit 100

# No label manipulation (deferred for future enhancement)
```

### README Update Logic

**Target section:** Lines 132-139

**Template:**
```markdown
## What's Next

A few things I'm thinking about (whenever I get around to them):

${generated_summary}

And always: more shows to add to the list.
```

**Preserve:**
- Section heading: `## What's Next`
- Opening line: "A few things I'm thinking about..."
- Closing line: "And always: more shows to add to the list."

**Replace:**
- Everything between opening and closing lines
- Generated summary with 3 category paragraphs

---

## Acceptance Criteria

### Core Functionality
- [ ] `/roadmap` command fetches open GitHub issues via `gh` CLI
- [ ] AI categorizes each issue into capability/enhancement/fix
- [ ] Generated summary uses Product Marketer voice (warm, outcome-focused)
- [ ] Summary includes 2-3 representative issue links per category
- [ ] Updates README.md "What's Next" section (lines 132-139)
- [ ] Preserves opening and closing lines unchanged

### User Experience
- [ ] `--preview` flag shows generated content without writing
- [ ] Interactive confirmation before updating README
- [ ] Shows git diff after update
- [ ] Clear categorization rationale in output
- [ ] Handles edge cases (no issues, all one category, etc.)

### Integration
- [ ] Can be invoked standalone: `/roadmap`
- [ ] Can be invoked during release: called from `/release` Step 5.5
- [ ] Non-interactive mode for release automation: `--auto`
- [ ] Skips roadmap update for internal-only releases

### Quality
- [ ] Categorization aligns with documented logic (capability/enhancement/fix)
- [ ] Summary is concise (3-5 sentences per category)
- [ ] Language is accessible to non-technical readers
- [ ] Examples are relevant and high-impact
- [ ] No jargon or technical implementation details

---

## Future Enhancements

**Phase 2: GitHub Labels (Deferred)**
- Auto-suggest labels based on AI categorization
- Optionally apply labels via `gh issue edit`
- Labels: `category: capability`, `category: enhancement`, `category: fix`

**Phase 3: Roadmap Insights**
- Count issues per category for progress tracking
- Detect stale issues (no updates in 90+ days)
- Suggest which issues to close or prioritize

**Phase 4: Multi-Target Generation**
- Generate roadmap for docs/ROADMAP.md in addition to README.md
- Different level of detail for each audience
- README: High-level, user-facing
- ROADMAP.md: Detailed, technical

---

## References

- **Voice Guidelines:** [.claude/readme-maintenance.md](/.claude/readme-maintenance.md)
- **Release Process:** [.claude/commands/release.md](/.claude/commands/release.md)
- **Current README:** [README.md:132-139](README.md#L132-L139)
- **GitHub Issues:** https://github.com/mmorper/concerts/issues

---

## Implementation Checklist

- [ ] Create `.claude/skills/roadmap/` directory
- [ ] Write `SKILL.md` with invocation logic
- [ ] Write `prompt.md` with AI categorization template
- [ ] Write `examples.md` with sample categorizations
- [ ] Test categorization accuracy with current issues
- [ ] Test summary generation with Product Marketer voice
- [ ] Test README update logic
- [ ] Add `/roadmap` to skills registry
- [ ] Integrate into `/release` command (Step 5.5)
- [ ] Update CLAUDE.md to document new command
- [ ] Create initial roadmap update with new skill

---

**Status:** Ready to implement
**Estimated Effort:** 2-3 hours
**Priority:** Medium (Nice to have for next release)
