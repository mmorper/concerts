# Changelog Style Guide

## Overview

The "What's Playing" changelog celebrates user-facing features with concert-themed language. Every entry should feel like discovering a new song on a setlist—exciting, immediate, and worth experiencing.

---

## Voice & Tone

**Voice:** Conversational, music-loving, enthusiastic but not over-the-top

**Tone Principles:**

1. **Value-First** - Lead with what users can *do* or *experience*, not technical details
2. **Pithy & Clear** - One compelling sentence that makes users want to try it
3. **Active Voice** - "Hover over years to see artist photos" not "Artist photos can be seen"
4. **Show, Don't Tell** - Describe the experience, not the implementation
5. **Concert-Themed** - Use music/concert metaphors when natural (don't force it)

**What We Sound Like:**
- "Flip through concert memories by hovering over any year"
- "Explore venues with stunning photos from Google Places"
- "Navigate the map by region—Southern California, Pacific Northwest, or all of them"

**What We Don't Sound Like:**
- "New feature: Timeline hover preview implementation" ❌
- "v1.4.0 includes parallax effects and smart positioning" ❌
- "Enhanced user experience through optimized rendering" ❌

---

## Writing Guidelines

### Title (Feature Name)

**Format:** 2-5 words, title case, no emoji
**Purpose:** Quick identification of the feature

**Good Examples:**
- Timeline Hover Preview
- Venue Photos
- Regional Map Filtering
- Artist Gatefold Browser

**Bad Examples:**
- New Timeline Feature ❌ (too vague)
- Hover Preview Popups v2 ❌ (version numbers, technical)
- 🎸 Timeline Previews ❌ (emoji in title)

### Description (One-Liner)

**Format:** 1 sentence (2 sentences max if complex), 60-120 characters ideal
**Purpose:** Convince users this feature is worth trying

**Formula:** `[Action] + [Benefit/Experience]`

**Examples:**

✅ "Hover over any year to see artist photos with subtle parallax effects"
- Action: Hover over any year
- Benefit: See artist photos with parallax

✅ "Explore every venue with stunning photography from Google Places"
- Action: Explore venues
- Benefit: See stunning photography

✅ "Filter the map by region to zero in on concerts near you"
- Action: Filter by region
- Benefit: Find concerts near you

❌ "Implementation of hover-triggered preview system with image loading" (technical jargon)
❌ "Users can now see previews" (passive, vague)
❌ "Timeline dots have been enhanced with new functionality" (bureaucratic)

### Highlights (Feature Details)

**Format:** 2-4 bullet points, each 3-8 words
**Purpose:** Quick scan of what makes this feature special

**Good Examples:**
- "Artist imagery on hover"
- "Smart positioning above/below dots"
- "Smooth parallax mouse tracking"
- "High-res venue photography"
- "Interactive map popups"

**Bad Examples:**
- "220×200px card with 140px artist photo" ❌ (technical specs)
- "Utilizes TheAudioDB API for enrichment" ❌ (implementation detail)
- "70px offset prevents popup overlap" ❌ (internal metrics)

### Deep Link Route

**Format:** URL path with scene parameter
**Purpose:** Navigate users directly to the feature

**Examples:**
- `/?scene=timeline` - Timeline scene (Scene 1)
- `/?scene=venues` - Venue Network scene (Scene 2)
- `/?scene=geography` - Geography/Map scene (Scene 3)
- `/?scene=genres` - Genres scene (Scene 4)
- `/?scene=artists` - Artists scene (Scene 5)

---

## changelog.json Schema

```json
{
  "releases": [
    {
      "version": "1.4.0",
      "date": "2026-01-03",
      "title": "Timeline Hover Preview",
      "description": "Hover over any year to see artist photos with subtle parallax effects",
      "route": "/?scene=timeline",
      "highlights": [
        "Artist imagery on hover",
        "Smart above/below positioning",
        "Smooth parallax mouse tracking"
      ]
    }
  ]
}
```

**Field Definitions:**

- `version` - Semantic version (matches release tag)
- `date` - ISO date format (YYYY-MM-DD)
- `title` - Feature name (2-5 words, title case)
- `description` - One-liner (60-120 chars, value-driven)
- `route` - Deep link to feature (URL path)
- `highlights` - 2-4 bullet points (3-8 words each)

---

## Toast Notification Writing

**Context:** Toast appears for returning visitors when new features are available

**Format:** `[Number] new feature[s] added!`

**Examples:**
- "1 new feature added!"
- "2 new features added!"
- "3 new features added!"

**CTA Button:** "See What's Playing →"

**Behavior:**
- Shows on homepage after 2-second delay
- Auto-dismisses after 10 seconds
- User can dismiss with × button
- Clicking toast or CTA navigates to `/changelog`

---

## Examples: Good vs Bad

### Example 1: Timeline Hover Preview

**✅ GOOD:**
```json
{
  "title": "Timeline Hover Preview",
  "description": "Hover over any year to see artist photos with subtle parallax effects",
  "highlights": [
    "Artist imagery on hover",
    "Smart above/below positioning",
    "Smooth parallax mouse tracking"
  ]
}
```

**❌ BAD:**
```json
{
  "title": "v1.4.0 Timeline Enhancements",
  "description": "New hover-triggered popup system with TheAudioDB integration and 70px offset positioning",
  "highlights": [
    "220×200px cards with 140px images",
    "120ms hover delay, 300ms linger",
    "Mobile disabled below 768px"
  ]
}
```

**Why Bad?**
- Title includes version number
- Description is technical (APIs, pixel offsets)
- Highlights list implementation details users don't care about

---

### Example 2: Venue Photos

**✅ GOOD:**
```json
{
  "title": "Venue Photos",
  "description": "Explore every venue with stunning photography from Google Places",
  "highlights": [
    "High-res venue photography",
    "Interactive map popups",
    "Historical venue context"
  ]
}
```

**❌ BAD:**
```json
{
  "title": "Google Places API Integration",
  "description": "Enhanced venue markers with photo metadata retrieved via Places API service",
  "highlights": [
    "Async photo fetching pipeline",
    "Error handling for missing images",
    "Fallback image system"
  ]
}
```

**Why Bad?**
- Title is API/technical focus
- Description reads like documentation
- Highlights describe engineering, not user value

---

## Checklist: Before Publishing

Before adding a changelog entry, verify:

- [ ] **User-facing?** - Does this change what users see/do? (Not just code changes)
- [ ] **Value-clear?** - Can users understand the benefit in 5 seconds?
- [ ] **Title concise?** - 2-5 words, title case, no emoji or version
- [ ] **Description active?** - Uses active voice and action verbs
- [ ] **Highlights brief?** - Each 3-8 words, user-benefit focused
- [ ] **Route works?** - Deep link navigates to the actual feature
- [ ] **Concert-themed?** - Matches project aesthetic (music/concert vibe)
- [ ] **No jargon?** - Free of technical terms (APIs, pixels, state management)
- [ ] **No versions?** - Doesn't mention version numbers in user-facing text

---

## When NOT to Create Entries

**Skip these changes:**

- Bug fixes (unless creates new visible capability)
- Performance improvements (unless dramatically faster load time)
- Code refactoring or reorganization
- Dependency updates
- Build pipeline changes
- Documentation updates
- Data normalization migrations
- TypeScript type improvements
- Test coverage additions

**Exception:** If a "technical" change creates obvious user value, write about the value:

❌ "Migrated to normalized artist data"
✅ "Artists now appear consistently across all scenes" (if bug was visible)

---

## Maintenance Schedule

**When to update:** Before every production release with user-facing features

**Process:**
1. Review commits since last release
2. Identify user-facing changes
3. Write changelog entry following this guide
4. Add to `src/data/changelog.json`
5. Test toast notification appears
6. Verify deep link works
7. Include in release commit

**Version Alignment:** Changelog entry version should match git tag/release version

---

## Questions?

If unsure whether something qualifies for the changelog, ask:

1. **Would a visitor notice this change?**
2. **Can I describe it without technical jargon?**
3. **Does it make the app more useful/enjoyable?**

If yes to all three → write a changelog entry.
If no to any → skip it.

---

_Last Updated: 2026-01-03_
