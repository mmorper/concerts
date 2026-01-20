# About Page

**Status:** Implemented
**Target Version:** v3.8.0
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** None

---

## Executive Summary

Add an `/about` page to provide E-E-A-T signals (Experience, Expertise, Authoritativeness, Trust) for SEO and AI discoverability. The page surfaces the creator's identity, the project's origin story, and links to external validation (LinkedIn, GitHub).

**Problem solved:** The SEO analysis (94/100) identified missing author context as a gap in Authority & Trust scoring. Search engines and AI agents benefit from understanding who created content and why.

**User value:** New visitors understand this is a personal labor of love, not a generic database. The backstory adds emotional resonance.

---

## Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session:**

```
I need to implement the About Page feature for Morperhaus Concerts.

**Feature Overview:**
- Static /about page for E-E-A-T (Experience, Expertise, Authoritativeness, Trust) signals
- Follows ChangelogPage.tsx pattern (dark theme, back button, Framer Motion)
- Surfaces creator identity, origin story, methodology mention, LinkedIn posts
- Updates Schema.org, sitemap, and llm.txt for SEO

**Key References:**
- Full Spec: docs/specs/future/global-about-page.md
- Pattern to follow: src/components/changelog/ChangelogPage.tsx
- README backstory: README.md lines 20-28
- Schema.org: index.html lines 68-146

**Implementation Approach:**
1. Create AboutPage.tsx + index.ts
2. Add route to App.tsx
3. Update index.html Schema.org
4. Update generate-sitemap.ts
5. Update llm.txt
6. Add nav link from Liner Notes

**Design Philosophy:**
Personal, authentic, SEO-optimized. Full backstory with real identity.

Let's start. Read the spec first, then implement.
```

---

## Visual Design

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Timeline                    [About link]     │
│                                                         │
│  About the Archive        (amber-400, Playfair Display) │
│  The human behind the data              (slate-400)     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  THE ARCHIVIST                    (section header)      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Michael Morper                                   │   │
│  │  Software engineer, concert enthusiast            │   │
│  │  Southern California                              │   │
│  │  [LinkedIn] [GitHub]                              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  THE ORIGIN STORY                 (section header)      │
│                                                         │
│  [Adapt from README.md backstory]                       │
│  - Concert-going since 1984                             │
│  - Wife involvement ("we" language)                     │
│  - Pandemic Google Sheet project                        │
│  - Evolution to interactive app                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  HOW IT'S BUILT                   (section header)      │
│                                                         │
│  Brief methodology (1-2 paragraphs)                     │
│  Link to GitHub README for details                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  WRITING                          (section header)      │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │ LinkedIn Post 1    │  │ LinkedIn Post 2    │         │
│  │ [placeholder]      │  │ [placeholder]      │         │
│  └────────────────────┘  └────────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Styling (follows ChangelogPage.tsx)

- Background: `bg-black`
- Text: `text-white`, `text-slate-400` secondary
- Title: `text-amber-400 font-display text-5xl lg:text-6xl`
- Section headers: `text-xs uppercase tracking-widest text-slate-500`
- Layout: `max-w-7xl mx-auto px-6 lg:px-20 py-12`
- Animations: Framer Motion staggered entry

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/about/AboutPage.tsx` | Main page component |
| `src/components/about/index.ts` | Barrel export |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add route and import |
| `index.html` | Enhance Schema.org creator, add AboutPage to hasPart |
| `scripts/generate-sitemap.ts` | Add /about URL |
| `public/llm.txt` | Add "About the Creator" section |
| `src/components/changelog/ChangelogPage.tsx` | Add "About" link in header |

### Schema.org Enhancement (index.html)

Enhance creator object (lines 76-80):

```json
"creator": {
  "@type": "Person",
  "name": "Michael Morper",
  "alternateName": "Morperhaus",
  "url": "https://concerts.morperhaus.org/about",
  "sameAs": [
    "https://www.linkedin.com/in/USERNAME/",
    "https://github.com/USERNAME"
  ]
}
```

Add to hasPart array:

```json
{
  "@type": "AboutPage",
  "name": "About the Archive",
  "url": "https://concerts.morperhaus.org/about",
  "description": "Meet the concert enthusiast behind the Morperhaus Concert Archives"
}
```

### LinkedIn Posts Data Structure

```typescript
interface LinkedInPost {
  title: string
  date: string
  url: string
  preview?: string
}

const LINKEDIN_POSTS: LinkedInPost[] = [
  {
    title: "Building a Concert Archive with AI",
    date: "Coming soon",
    url: "#",
    preview: "Placeholder - update with actual post URL"
  }
]
```

---

## Content Sources

| Section | Source |
|---------|--------|
| The Archivist | New content (name, role, location) |
| Origin Story | Adapt from README.md lines 20-28 |
| How It's Built | Brief mention + link to GitHub README |
| Writing | Placeholder LinkedIn post cards |

---

## Testing Checklist

- [ ] Page renders at /about
- [ ] Back button returns to /
- [ ] Framer Motion animations work
- [ ] Mobile responsive
- [ ] Schema.org validates (Google Rich Results Test)
- [ ] Sitemap includes /about
- [ ] llm.txt includes creator section
- [ ] LinkedIn links open in new tab

---

## Revision History

- **2026-01-19:** Initial specification created
- **Version:** 1.0.0
- **Status:** Planned
