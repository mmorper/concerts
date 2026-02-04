# /roadmap - Update "What's Next" Section

Analyzes open GitHub issues and generates a compelling, user-friendly roadmap for README.md "What's Next" section.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--preview` | No | false | Show generated content without writing |
| `--auto` | No | false | Non-interactive mode (for release automation) |

**Examples:**
```
/roadmap              # Interactive mode with confirmation
/roadmap --preview    # Show what would be generated
/roadmap --auto       # Auto-update during release (no prompts)
```

## Output

Updates README.md lines 132-139 (What's Next section) with AI-generated roadmap summary.

---

## Workflow

### Step 1: Fetch Open Issues

```bash
gh issue list --state open --json number,title,body,labels --limit 100
```

**Output:**
```
🗺️  Fetching open GitHub issues...

Found 15 open issues
```

**If no issues:**
```
ℹ️  No open issues found. "What's Next" section will show minimal content.

Continue anyway? (yes / cancel)
```

---

### Step 2: Analyze and Categorize

**For each issue, perform AI categorization:**

**Categorization Prompt:**
```
Analyze this GitHub issue and categorize it:

Issue #${number}: ${title}
${body_excerpt (first 500 chars)}

Categories:
- New Capability: Major new feature or entirely new user-facing experience
  Examples: New scenes, audio preview player, discography UI, major integrations

- Enhancement: Improvement to existing feature, docs update, UX polish, tooling
  Examples: Cross-scene navigation, better badges, docs accuracy, visual tests

- Fix: Bug fix, broken functionality, technical debt that prevents correct operation
  Examples: Metadata generation failure, deployment issues, data validation gaps

Consider:
- Scope: Does this create something new (capability) or improve existing (enhancement)?
- User impact: New workflow (capability) vs. refinement (enhancement) vs. repair (fix)?
- Technical nature: Feature (capability) vs. polish (enhancement) vs. broken (fix)?

Respond with ONLY ONE WORD: capability, enhancement, or fix
```

**Store categorization:**
```typescript
interface CategorizedIssue {
  number: number
  title: string
  category: 'capability' | 'enhancement' | 'fix'
}
```

**Display results:**
```
Categorized 15 issues:
  - 3 New Capabilities
  - 8 Enhancements
  - 4 Fixes
```

---

### Step 3: Generate Summary

**Use AI to generate narrative summaries for each category with Product Marketer voice.**

**Summary Generation Prompt:**
```
Generate a compelling 2-4 sentence summary for the "${category}" category
of upcoming work on a personal concert archive web app.

Open issues in this category:
${issues.map(i => `#${i.number}: ${i.title}`).join('\n')}

Requirements:
- Use Product Marketer voice: warm, outcome-focused, accessible to non-technical readers
- Focus on user benefits and experiences, not implementation details
- Write as a narrative paragraph, not a bullet list
- Link to 1-3 representative examples using (#N) format
- Make it sound exciting but genuine (no hype or corporate speak)
- 2-4 sentences maximum

Category-specific guidance:
- New Capabilities: Emphasize new experiences, workflows, or ways to explore
- Enhancements: Focus on polish, discoverability, and refinement
- Fixes: Frame as foundational work that ensures reliability

Voice examples:
✅ "Building out features that add entirely new ways to experience the archive"
✅ "Polishing existing features with better cross-scene navigation"
✅ "Foundational work that keeps everything running smoothly"

❌ "Implementing Puppeteer-based visual regression testing suite"
❌ "Refactoring validation architecture per SRP principles"
❌ "Addressing technical debt in deployment pipeline"

Generate the summary paragraph now:
```

**Generated structure:**
```markdown
**New Capabilities**
${ai_generated_summary_for_capabilities}

**Enhancements**
${ai_generated_summary_for_enhancements}

**Fixes**
${ai_generated_summary_for_fixes}
```

**Skip empty categories:**
If a category has 0 issues, don't include it in the output.

---

### Step 4: Preview Generated Content

**Show complete preview:**

```
🗺️  Generated Roadmap Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**New Capabilities**
Building out features that add entirely new ways to experience
the archive. The audio preview integration proved how powerful
these immersive touches can be—thinking about extending that to
setlist items (#22) and bringing the full discography UI to life
in the Artist gatefold (#5).

**Enhancements**
Polishing existing features with better cross-scene navigation
(#9), smarter venue status badges (#8), and more accurate
documentation (#23). The kind of improvements that make everything
feel more cohesive and discoverable.

**Fixes**
Addressing deployment workflow gaps (#13) and ensuring all site
metadata stays current (#24). Foundational work that keeps
everything running smoothly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target: README.md lines 132-139 (What's Next section)
```

---

### Step 5: Confirmation

**If `--preview` flag:**
```
✅ Preview complete. No files modified.
```
**STOP HERE**

**If `--auto` flag (non-interactive):**
- Skip confirmation
- Write directly to README.md
- Jump to Step 6

**If interactive mode (default):**
```
Update README.md "What's Next" section? (yes / edit / cancel)

Options:
  yes    - Write changes to README.md
  edit   - Manually edit the summary before writing
  cancel - Abort without changes
```

**If "edit" selected:**
- Open generated summary in temporary file
- User edits in their $EDITOR
- Re-prompt for confirmation after edit

---

### Step 6: Update README.md

**Target section:** Lines 132-139

**Current content:**
```markdown
## What's Next

A few things I'm thinking about (whenever I get around to them):

And always: more shows to add to the list.
```

**Template:**
```markdown
## What's Next

A few things I'm thinking about (whenever I get around to them):

${generated_summary}

And always: more shows to add to the list.
```

**Update logic:**
1. Read README.md
2. Find `## What's Next` section
3. Replace everything between the opening line ("A few things...") and closing line ("And always...")
4. Preserve the heading, opening, and closing lines exactly
5. Write updated README.md

**Code pattern:**
```typescript
const readmePath = 'README.md'
let content = fs.readFileSync(readmePath, 'utf-8')

const startMarker = 'A few things I\'m thinking about (whenever I get around to them):'
const endMarker = 'And always: more shows to add to the list.'

// Replace content between markers
const regex = new RegExp(
  `(${escapeRegex(startMarker)}\\n\\n)([\\s\\S]*?)(\\n\\n${escapeRegex(endMarker)})`,
  'g'
)

content = content.replace(regex, `$1${generatedSummary}$3`)

fs.writeFileSync(readmePath, content, 'utf-8')
```

---

### Step 7: Show Results

**Display git diff:**
```bash
git diff README.md
```

**Summary:**
```
✅ README.md "What's Next" section updated!

Updated:
  - 3 New Capabilities
  - 8 Enhancements
  - 4 Fixes

Next steps:
  • Review changes: git diff README.md
  • Commit changes: git add README.md && git commit -m "docs: Update roadmap"
```

---

## Voice & Tone Guidelines

**Use Product Marketer voice from `.claude/readme-maintenance.md`:**

### Core Principles

1. **Speak to outcomes, not implementation**
   - ✅ "Making it easier to discover connections"
   - ❌ "Adding click handlers to D3 node elements"

2. **Warm and conversational, not corporate**
   - ✅ "Polishing existing features"
   - ❌ "Implementing enhancements to optimize UX metrics"

3. **Accessible to non-technical readers**
   - ✅ "Building a testing suite to catch visual bugs"
   - ❌ "Implementing Puppeteer-based visual regression testing"

4. **Genuine enthusiasm, not hyperbole**
   - ✅ "The audio preview integration proved how powerful these touches can be"
   - ❌ "Revolutionary game-changing audio preview disrupts the industry"

5. **Connect features to experience**
   - ✅ "Navigate smoothly between venues and artists to trace connections"
   - ❌ "Cross-scene navigation implemented via URL parameters"

### Category-Specific Tone

**New Capabilities:**
- Emphasize: New experiences, unlocked workflows, fresh ways to explore
- Keywords: "Building", "adding", "bringing to life", "enabling"
- Example: "Building out features that add entirely new ways to experience the archive"

**Enhancements:**
- Emphasize: Polish, refinement, better discoverability, smoother experience
- Keywords: "Polishing", "improving", "refining", "making it easier"
- Example: "Polishing existing features with better navigation and clearer status indicators"

**Fixes:**
- Emphasize: Reliability, correctness, foundational stability
- Keywords: "Addressing", "ensuring", "foundational work", "keeping things running"
- Example: "Foundational work that keeps everything running smoothly behind the scenes"

### Bad Examples (Don't Do This)

❌ "Refactor validation architecture for SRP"
❌ "Implement OAuth2 flow for GSC integration"
❌ "Add Puppeteer E2E test coverage"
❌ "Optimize bundle size via code splitting"
❌ "Migrate from REST to GraphQL endpoints"

### Good Examples (Do This)

✅ "Making the data validation pipeline easier to maintain"
✅ "Connecting with Google Search Console to track how people find the site"
✅ "Building visual tests to catch UI bugs before they ship"
✅ "Speeding up page loads with smarter code loading"
✅ "Updating how the app fetches data for better reliability"

---

## Integration with Release Process

**Called from `/release` command as Step 5.5 (after changelog, before file updates):**

```markdown
### Step 5.5: Update Roadmap (Optional)

**If user-facing changes exist (liner notes published):**

> **Update roadmap?** [Y/n]
>
> The "What's Next" section in README.md can be refreshed to reflect
> current open issues. This helps keep the roadmap current for visitors
> who land on the GitHub repo.

If confirmed, invoke `/roadmap --auto`

**If NO user-facing commits:**
Skip roadmap update (internal-only releases don't need README changes)
```

**Add to release.md line 284 (after changelog step, before ROADMAP.md update):**

```markdown
### Step 5.5: Update Roadmap

**If liner notes published (user-facing release):**

Optionally refresh the "What's Next" section in README.md:

> **Update roadmap from open issues?** [Y/n]

If confirmed:
```bash
/roadmap --auto
```

This analyzes open GitHub issues and generates a user-friendly summary
of upcoming work, categorized into New Capabilities, Enhancements, and Fixes.

**If declined or internal-only release:**
Skip roadmap update.
```

---

## Edge Cases

### No Open Issues
```
ℹ️  No open issues found.

Generate minimal roadmap? (yes / cancel)
```

If yes, write:
```markdown
## What's Next

A few things I'm thinking about (whenever I get around to them):

Always looking for ways to make the archive more engaging and discoverable. Ideas welcome!

And always: more shows to add to the list.
```

### All Issues in One Category

Still write category headings, but skip empty ones:

```markdown
**Enhancements**
Focusing on polish and refinement with better cross-scene navigation (#9),
smarter venue badges (#8), and improved documentation (#23). Making the
whole experience feel more cohesive and easy to explore.
```

### Issue Links in Summary

- Use GitHub issue number format: `(#22)`
- Always include parentheses
- Link to 1-3 representative examples per category
- Choose high-impact or easy-to-understand issues

### GitHub API Rate Limits

If `gh issue list` fails:
```
❌ Failed to fetch GitHub issues. Check your gh CLI authentication:
   gh auth status

Possible causes:
  - Not authenticated: gh auth login
  - Rate limit exceeded: Try again in a few minutes
  - Network issue: Check internet connection
```

---

## Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| "gh command not found" | GitHub CLI not installed | Install via `brew install gh` |
| "Not authenticated" | gh CLI not logged in | Run `gh auth login` |
| "README.md not found" | Wrong working directory | Ensure running from project root |
| "What's Next section not found" | README structure changed | Manually fix README structure |

---

## Testing Checklist

- [ ] Fetches open issues via `gh` CLI
- [ ] Categorizes issues correctly (capability/enhancement/fix)
- [ ] Generates summaries in Product Marketer voice
- [ ] Updates README.md What's Next section
- [ ] Preserves opening and closing lines
- [ ] `--preview` shows content without writing
- [ ] `--auto` runs non-interactively
- [ ] Handles no issues gracefully
- [ ] Handles all issues in one category
- [ ] Shows git diff after update
- [ ] Skips empty categories

---

## Related

- **Spec:** [docs/specs/future/roadmap-skill.md](docs/specs/future/roadmap-skill.md)
- **Voice Guidelines:** [.claude/readme-maintenance.md](.claude/readme-maintenance.md)
- **Release Integration:** [.claude/commands/release.md](.claude/commands/release.md)
- **Issue Tracking:** #25

---

## Examples

### Example Output (Full Roadmap)

```markdown
## What's Next

A few things I'm thinking about (whenever I get around to them):

**New Capabilities**
Building out features that add entirely new ways to experience the archive. The audio preview integration proved how powerful these immersive touches can be—thinking about extending that to setlist items (#22) and bringing the full discography UI to life in the Artist gatefold (#5).

**Enhancements**
Polishing existing features with better cross-scene navigation (#9), smarter venue status badges (#8), and more accurate documentation (#23). The kind of improvements that make everything feel more cohesive and discoverable.

**Fixes**
Addressing deployment workflow gaps (#13) and ensuring all site metadata stays current (#24). Foundational work that keeps everything running smoothly.

And always: more shows to add to the list.
```

### Example Output (One Category)

```markdown
## What's Next

A few things I'm thinking about (whenever I get around to them):

**Enhancements**
Focusing on polish and refinement—making venue status clearer with renamed venue badges (#8), improving documentation accuracy (#23), and building visual tests to catch UI issues earlier (#10). The kind of foundational work that makes everything feel more solid and trustworthy.

And always: more shows to add to the list.
```
