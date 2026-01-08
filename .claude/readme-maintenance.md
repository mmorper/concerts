# README Maintenance Guidelines

## When to Update README.md

Update README.md whenever:
1. A new version is released to production
2. Major features are added
3. Data sources or pipeline changes significantly
4. Stats become outdated (concerts, artists, venues counts)

## What to Update

### "What's New" Section

- **Always** reflects the **latest production release** (check `git describe --tags`)
- **Format:** "**v{VERSION} is live!** [User-facing feature description]"
- **User value first, not technical details**
- Link to `/liner-notes` for full changelog

**Example (User-Facing):**
✅ "Click venue markers on the map to explore their full concert history"
❌ "Implemented cross-scene navigation using Zustand store"

**Content Guidelines:**
- Lead with user benefit (what they can do now)
- Keep it concise (2-3 sentences max)
- Use active voice ("Click", "Explore", "See")
- Avoid technical jargon

### "What's Next" Section

**Source of truth:** `docs/specs/future/`

**Selection criteria:**
- User-facing features only (no dev tooling)
- High or medium priority specs
- Things that add user value or delight

**Tone & Language:**
- Exploratory, not committal ("thinking about" not "will ship")
- No version numbers or timelines
- Benefits first, implementation details never
- Casual voice matching the rest of README

**When to update:**
- When a "next" feature ships (move to "What's New", replace with next item)
- When priorities shift in planning docs
- When new interesting specs are added to future/

**Review:** Before each release, scan `docs/specs/future/` and verify "What's Next" still reflects current thinking.

### Stats (Always Current)

Update these whenever data refreshes:
- Concert count: `cat public/data/concerts.json | jq '.concerts | length'`
- Artist count: Check concerts metadata or changelog
- Venue count: Check concerts metadata
- Decade range: First and last concert years

**Where stats appear:**
- "What Is This?" section (opening paragraph)
- Keep them accurate to within 5-10 concerts (exact precision not required)

## Version Release Checklist

When tagging a new version:

1. **Update changelog first:**
   - Add entry to `src/data/changelog.json`
   - **CRITICAL:** Version format must be "1.x.x" (no 'v' prefix) to match version.json
   - User-facing language, highlight key features
   - Include `route` for deep linking
   - **This version is displayed in the `/liner-notes` footer**

2. **Update README.md:**
   - Update "What's New" with latest version
   - Verify stats are current
   - Update "What's Next" if roadmap changed
   - Review all links still work

3. **Verify version consistency:**
   - Run `npm run validate:version` to check all versions match
   - Fix any mismatches before proceeding
   - Run `npm run build` to generate `public/version.json`
   - Verify `/liner-notes` page shows correct version in bottom-right corner

4. **Verify links:**
   - Test `/liner-notes` page renders correctly
   - Verify deep links (e.g., `/?scene=geography`) work
   - Check external links (docs/STATUS.md, docs/WORKFLOW.md)

5. **Commit & Tag:**

   ```bash
   git add README.md src/data/changelog.json
   git commit -m "docs: Update README and changelog for v1.x.x"
   git tag v1.x.x
   git push origin main --tags
   ```

---

## Callable Checklist: README Updates

Structured for automation. Each item is pass/fail.

### For Feature Releases

| Step | Action | Validation |
|------|--------|------------|
| 1 | Update "What's New" heading | Contains `**v{VERSION} is live!**` |
| 2 | Add user-facing description | 1-2 sentences, benefit-first |
| 3 | Include changelog link | Contains `[Full changelog →](/liner-notes)` |
| 4 | Verify stats current | Counts within 5 of actual |
| 5 | Review "What's Next" | Still reflects `docs/specs/future/` |

### For Bugfix Releases

| Step | Action | Validation |
|------|--------|------------|
| 1 | Skip "What's New" | Unless user requests |
| 2 | Verify stats current | If data changed |

### Stats Commands

```bash
# Concert count
cat public/data/concerts.json | jq '.concerts | length'

# Verify build generates version.json
npm run build
cat dist/version.json | jq '.version'
```

---

**Version Consistency Notes:**

- `/liner-notes` displays version from `changelog.json` (first release)
- `public/version.json` is auto-generated during build from git tags
- Both should show the same version number (format: "1.x.x" without 'v')

## Quick Reference Commands

```bash
# Validate version consistency (git tag, changelog.json, package.json)
npm run validate:version

# Get current version
git describe --tags --abbrev=0

# Count concerts
cat public/data/concerts.json | jq '.concerts | length'

# List future specs
ls docs/specs/future/

# Check current roadmap
head -50 docs/ROADMAP.md

# View latest changelog entries
cat src/data/changelog.json | jq '.releases[0:3]'
```

## README Structure (Reference)

1. **Hero** - Title, tagline, screenshot
2. **What Is This?** - Crisp 2-3 sentence description + stats
3. **What's New** - Latest production feature (link to /liner-notes)
4. **Backstory** - Origin story, personal narrative
5. **Features** - Five interactive scenes
6. **Where Data Comes From** - Sources + enrichment (high-level)
7. **How It's Built** - Tech stack + architecture
8. **Running It Yourself** - Installation instructions
9. **What's Next** - Planned features from specs/future
10. **Footer** - "Built with ❤️ for live music"

---

## Key Principles

**README is for users first, developers second.**
- Technical details belong in `docs/`
- Personal narrative is a differentiator—keep it authentic
- Lead with clarity: what/who/why before how
- Progressive disclosure: quick facts → story → features → technical depth

**Always accurate.**
- Version numbers must match production
- Stats should be current (within reason)
- "What's Next" reflects actual planning docs, not wishes

**Maintain the voice.**
- Conversational, first-person
- "Honestly? To learn." spirit
- No corporate speak or marketing fluff
- Technical when needed, but approachable

---

## Voice & Tone Guidelines

Documentation in this project serves two distinct audiences. Write with the appropriate voice for each.

### For Concert Explorers (Product Marketer Voice)

**Applies to:** Liner notes, release notes (changelog.json), "What's New" and "What's Next" in README

These readers are here to explore concert memories and discover connections in the music data. Write as a product marketer who understands:

- **Benefits over features** — What can they *do* now? What will they *discover*?
- **Emotional resonance** — Concerts are memories. Acknowledge the nostalgia, the "I was there" moments
- **Active discovery language** — "Explore", "Discover", "Relive", "See how"
- **Concrete examples** — "Click Depeche Mode to see every show since 1984" not "Artist detail views available"

**Tone:** Warm, inviting, slightly reverent about live music. Like a friend showing you their record collection.

**Examples:**
- ✅ "Now you can trace how your taste evolved decade by decade"
- ✅ "See which venues hosted the most shows—some might surprise you"
- ❌ "Added decade filtering to timeline component"
- ❌ "Implemented venue aggregation statistics"

### For Developers (Helpful Hobbyist Voice)

**Applies to:** Technical docs (`docs/BUILD.md`, `docs/WORKFLOW.md`), "Running It Yourself" section, GitHub release notes when feature is primarily technical

These readers want to clone, fork, or understand how it works. The project creator isn't a developer—this is a passion project built for fun and learning. Write as someone sharing what they built:

- **Stays benefit-focused** — Why does this matter? What problem does it solve?
- **Honest about the journey** — "This approach worked for me" not "best practice"
- **Welcoming to tinkerers** — Assume they want to adapt it for their own concerts, not judge the code
- **No false expertise** — Don't claim authority. Share what was learned along the way

**Tone:** Friendly, practical, "here's what I figured out." Like sharing a recipe you've been experimenting with.

**Examples:**

- ✅ "The data pipeline validates on every build, so broken data never reaches production"
- ✅ "Went with Zustand because it was simpler to understand than Redux"
- ❌ "Implements industry-standard validation patterns" (not our voice)
- ❌ "Uses modern best practices" (claims expertise we don't have)

### Deciding Which Voice

| Document | Primary Audience | Voice |
|----------|-----------------|-------|
| README "What's New" | Concert explorers | Product Marketer |
| README "What's Next" | Concert explorers | Product Marketer |
| `changelog.json` entries | Concert explorers (via /liner-notes) | Product Marketer |
| README "Running It Yourself" | Tinkerers | Helpful Hobbyist |
| `docs/*.md` technical docs | Tinkerers | Helpful Hobbyist |
| GitHub release notes | Mixed | Lead with explorer value, then technical notes |

---

**Last Updated:** 2026-01-06
