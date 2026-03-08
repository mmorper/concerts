# Agentic Liner Notes — Living Editorial Content System

**Status:** Planned — GitHub issues created, ready for implementation
**Priority:** High
**Estimated Complexity:** Very High
**Dependencies:** Weekly data enrichment pipeline (already running), Anthropic API access (available in Claude Code context — no separate key management needed), existing SEO infrastructure (Cloudflare Worker, sitemap, llm.txt)
**Spec Version:** 3.3
**GitHub Tracking:** Epics #44 (Phase 1), #49 (Phase 2), #53 (Phase 3), #59 (Phase 4)

---

## Executive Summary

The Morperhaus Concert Archives has a rich, growing dataset — 180 concerts, 105 unique artists, 77 venues, enriched with discographies, setlists, images, bios, and audio previews from seven external APIs. Today, the `/liner-notes` page serves as both a "By the Numbers" factoid section and a changelog. Neither role is served well: the facts are static and hand-written, and the changelog dilutes their impact.

This spec introduces an **agentic content generation system** that analyzes the full concert dataset weekly, discovers stories and patterns, scores them for quality and timeliness, and publishes the best 2–3 posts automatically. Each post is written in **first person** (as the archive owner), includes an **image**, at least one **deep link** back into the app, and optionally a **MiniPlayer audio preview**. The system produces three content categories: **cultural context** (artist/venue history connecting to the broader music world), **personal connections** (tying the owner's experience to those artists), and **deep-cut correlations** (surprising patterns only discoverable by cross-referencing multiple data dimensions). Posts may also reference **cultural events and news from the era** of a concert, adding time-capsule depth.

The `/liner-notes` route is reimagined as a **blog-style feed** — newest posts at top, filterable by category, with each post having its own **permalink** and **Open Graph meta tags**. The changelog moves to its own dedicated route at **`/whats-playing`** — a separate page for app release notes, fully disassociated from liner notes. Over time, the liner notes feed grows into a searchable, indexable, evergreen editorial layer that rewards both human visitors and AI crawlers.

The system integrates with the project's **existing SEO infrastructure**: the Cloudflare Worker (`workers/meta-injector.js`) is extended to inject dynamic OG tags for liner notes permalinks, the sitemap (`public/sitemap.xml`) is updated to include all post URLs, `llm.txt` is updated with liner notes content descriptions, and the existing `scripts/generate-facts.ts` fact cards are superseded by the agentic analysis engine. The liner notes pipeline runs as a new step in the `npm run build-data` pipeline, **before** the existing Steps 10-11 (meta tag updates and sitemap generation) so those steps can incorporate the new liner notes URLs and stats.

Two **Claude Code skills** are created alongside the pipeline to support ongoing maintenance and iteration.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Agentic Liner Notes system for the Morperhaus Concert Archives.

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

**Feature Overview:**
- Build a multi-stage content generation pipeline: Analysis Engine → Story Generator → Quality Scorer → Content Curator
- The Analysis Engine (deterministic TypeScript) scans concerts.json + enriched data to detect patterns (artist longevity, opener-to-headliner arcs, venue loyalty, calendar anniversaries, geographic chapters, milestone markers, etc.)
- The Story Generator (Anthropic API) transforms findings into first-person editorial prose across three categories: Cultural Context, Personal Connection, and Deep-Cut Correlation
- Every post includes: an image (artist photo, venue photo, or album art), at least one deep link into the app, and optionally a MiniPlayer audio preview
- The Quality Scorer applies a weighted rubric to rank candidates and select the best 2–3 per week
- The Liner Notes page is a blog-style feed with category filters and post permalinks
- Output is `public/data/liner-notes.json` — a growing feed of posts consumed by the Liner Notes page
- Integrates with the existing weekly data enrichment pipeline (commit + push)
- Two Claude Code skills are created: `liner-notes-pipeline` and `liner-notes-voice`

**Key References:**
- Full Design Spec: docs/specs/future/agentic-liner-notes.md
- Concert Data: public/data/concerts.json (180 concerts, Concert type in src/types/concert.ts)
- Artist Metadata: public/data/artists-metadata.json (ArtistMetadata type in src/types/artist.ts)
- Artist Top Tracks: public/data/artists-top-tracks.json (ArtistTopTracks type in src/types/artist.ts)
- Setlist Types: src/types/setlist.ts
- Existing Liner Notes Page: src/components/LinerNotes/ (or similar — read to confirm)
- Changelog Data: src/data/changelog.json
- Scene Design Guide: docs/design/scene-design-guide.md
- Color Specification: docs/design/color-specification.md
- UI Component Patterns: docs/design/ui-component-patterns.md
- README Maintenance (voice guidelines): .claude/readme-maintenance.md
- **SEO Infrastructure (MUST READ before Window 3-4):**
  - docs/SEO.md — Full SEO documentation
  - workers/meta-injector.js — Existing Cloudflare Worker (extend, don't replace)
  - workers/README.md — Worker deployment guide
  - scripts/generate-sitemap.ts — Sitemap generator (add liner notes URLs)
  - scripts/update-meta-tags.ts — Meta tag auto-updater (add liner notes stats)
  - scripts/generate-facts.ts — Existing fact card generator (superseded by this feature)
  - scripts/build-data.ts — Pipeline orchestrator (insert new step)
  - public/llm.txt — AI assistant documentation (add liner notes info)
  - public/sitemap.xml — Current sitemap (will grow with liner notes URLs)
  - public/og-stats.json — OG image stats (add liner notes count)
  - docs/DEEP_LINKING.md — URL parameter patterns

**Implementation Approach:**

Window 1: Analysis Engine + Pipeline Types + Skills
- Create `scripts/liner-notes/types.ts` — all shared types
- Create `scripts/liner-notes/analyze.ts` — all 11+ pattern detectors
- Create `.claude/skills/liner-notes-pipeline/SKILL.md` — pipeline architecture skill
- Create `.claude/skills/liner-notes-voice/SKILL.md` — content voice skill
- Test against current concerts.json data

Window 2: Story Generator + Quality Scorer + Curator
- Create `scripts/liner-notes/generate.ts` — Anthropic API story generation (first person, with cultural context)
- Create `scripts/liner-notes/score.ts` — quality rubric implementation
- Create `scripts/liner-notes/curate.ts` — selection, deduplication, image/audio assignment
- Test end-to-end with real API calls

Window 3: Pipeline Orchestrator + Data Output + RSS + OG Images + SEO Integration
- Create `scripts/liner-notes/pipeline.ts` — orchestrates the full flow
- Create `scripts/liner-notes/index.ts` — CLI entry point
- Create `scripts/liner-notes/og-image.ts` — OG image generation (1200×630px per post)
- Generates `public/data/liner-notes.json` with feed structure
- Generates `public/liner-notes.xml` — RSS feed
- Generates `public/og/liner-notes/{slug}.png` — OG images per post
- **SEO Integration (modify existing files, don't create new ones):**
  - Modify `scripts/build-data.ts` — insert liner notes generation after Step 9, before Step 10
  - Modify `scripts/generate-sitemap.ts` — add /liner-notes and all /liner-notes/{slug} URLs
  - Modify `scripts/update-meta-tags.ts` — add liner notes count to llm.txt and og-stats.json
  - Deprecate `scripts/generate-facts.ts` — superseded by agentic analysis engine

Window 4: Liner Notes Page Redesign + Changelog Separation + Cloudflare Worker Extension
- Redesign `/liner-notes` as blog-style feed with category filters (NO changelog on this page)
- Post permalinks: `/liner-notes/:slug`
- Each post card: image, headline, prose, category label, tags, deep links, MiniPlayer
- Create `/whats-playing` route for changelog (separate page, renders changelog.json)
- Update README.md and toast notification to link to `/whats-playing` instead of `/liner-notes`
- Semantic HTML + JSON-LD structured data (BlogPosting type, following patterns in index.html lines 68-146)
- **Extend existing `workers/meta-injector.js`** (DO NOT create a new Worker):
  - Add route handler for `/liner-notes/:slug` URLs
  - Add route handler for `/liner-notes` feed page
  - Add route handler for `/whats-playing`
  - Read post data from `public/data/liner-notes.json`
  - Inject og:title, og:description, og:image, og:url, twitter:card, article:published_time
  - Follow existing bot detection and meta injection patterns exactly
- Related posts connections
- RSS auto-discovery link in `<head>`

**Key Design Details:**
- Page background: bg-light-3 (#fafaf9, Warm Stone)
- Typography: Playfair Display for headlines, Source Sans 3 for body
- Category accent colors: Cultural Context → #1e3a8a (New Wave blue), Personal Connection → #5b21b6 (Alternative violet), Deep-Cut → #06b6d4 (Electronic cyan)
- Post cards: white bg, left border accent, image (16:9 or square), 24px padding
- Feed layout: single column, max-width 720px, newest first
- Filter chips: category pills + detector-derived tags at top of feed
- Animation: Cards fade in with staggered 100ms delay, Framer Motion

**API Details:**
- Anthropic API: POST https://api.anthropic.com/v1/messages
- Model: claude-sonnet-4-20250514
- Max tokens: 1000 per story generation call
- System prompt: first-person voice, Product Marketer tone, cultural context encouraged
- Rate limiting: ~10-15 API calls per weekly run
- Cost: ~$0.10-0.15 per weekly run

**Current State:**
- `/liner-notes` route exists with "By the Numbers" fact cards + changelog
- `src/data/changelog.json` contains release history
- Weekly enrichment pipeline runs automatically via `npm run build-data` (commit + push)
- Enriched data: concerts.json, artists-metadata.json, artists-top-tracks.json
- MiniPlayer component exists for audio previews in Artists scene
- Artist images, venue photos, album art all available in enriched data
- **CRITICAL — Existing SEO infrastructure (DO NOT recreate, EXTEND these):**
  - `workers/meta-injector.js` — Cloudflare Worker that detects bot user agents and injects dynamic OG/meta tags per URL. Supports 20+ bots (Google, Bing, Facebook, Twitter, AI crawlers). Human users bypass it entirely.
  - `public/sitemap.xml` — Generated by `scripts/generate-sitemap.ts`, contains 410+ URLs (scenes, artist deep links, venue deep links). Liner notes URLs must be added here.
  - `public/llm.txt` — AI assistant documentation with pre-computed stats. Updated by `scripts/update-meta-tags.ts` (Step 10 of build-data).
  - `public/og-stats.json` — Stats for OG image generation. Liner notes count should be added.
  - `index.html` (lines 17-62) — Enhanced meta tags, auto-updated by Step 10.
  - `index.html` (lines 68-146) — Schema.org JSON-LD (CollectionPage, MusicEventSeries, WebPage).
  - `scripts/generate-facts.ts` — Generates 15 pre-computed AI fact cards for `/liner-notes`. This script is SUPERSEDED by the agentic analysis engine. Read it first to understand existing patterns, then replace or deprecate.
  - `scripts/update-meta-tags.ts` — Step 10 of build-data. Updates index.html meta tags, JSON-LD, llm.txt stats, og-stats.json.
  - `scripts/generate-sitemap.ts` — Step 11 of build-data. Generates sitemap.xml from data.
  - `public/robots.txt` — Crawler permissions and sitemap declaration.
  - Pipeline ordering: Steps 1-9 = data enrichment, Step 10 = meta updates, Step 11 = sitemap. Liner notes generation must run BETWEEN Step 9 and Step 10.

**Files to Create:**
- `scripts/liner-notes/types.ts` (~150 LOC)
- `scripts/liner-notes/analyze.ts` (~550 LOC)
- `scripts/liner-notes/generate.ts` (~300 LOC)
- `scripts/liner-notes/score.ts` (~180 LOC)
- `scripts/liner-notes/curate.ts` (~150 LOC)
- `scripts/liner-notes/pipeline.ts` (~180 LOC)
- `scripts/liner-notes/index.ts` (~60 LOC)
- `scripts/liner-notes/rss.ts` (~80 LOC)
- `scripts/liner-notes/og-image.ts` (~120 LOC)
- `src/types/liner-notes.ts` (~80 LOC)
- `src/components/WhatsPlaying/` (~100 LOC) — Changelog page at `/whats-playing`
- `.claude/skills/liner-notes-pipeline/SKILL.md` (~150 LOC)
- `.claude/skills/liner-notes-voice/SKILL.md` (~100 LOC)

**Files to Modify (existing SEO infrastructure — read these first):**
- `workers/meta-injector.js` — Add `/liner-notes/:slug`, `/liner-notes`, and `/whats-playing` route handling. Read existing bot detection and meta injection patterns. Follow existing patterns exactly.
- `scripts/generate-sitemap.ts` — Add liner notes feed URL, all post permalink URLs, and `/whats-playing` URL to sitemap generation.
- `scripts/update-meta-tags.ts` — Add liner notes count to llm.txt stats section and og-stats.json.
- `scripts/build-data.ts` — Insert `npm run generate:liner-notes` as a new step AFTER Step 9 and BEFORE Step 10.
- `package.json` — Add `generate:liner-notes` script
- `src/components/LinerNotes/` — Full redesign as blog-style feed (remove all changelog rendering)
- `src/App.tsx` or router config — Add `/liner-notes/:slug` permalink route AND `/whats-playing` route
- `README.md` — Update changelog link from `/liner-notes` to `/whats-playing`
- Toast notification component — Update CTA navigation target to `/whats-playing`

**Files to deprecate (replaced by this feature):**
- `scripts/generate-facts.ts` — Read it first to understand existing fact card patterns, then deprecate once the agentic engine is generating content. The agentic liner notes system supersedes the static fact cards.

Let's start with Window 1: Analysis Engine + Skills. Should I begin by reading the existing concert data types and enriched data files to understand what's available, then create the pipeline types and analysis engine?
```

---

## Design Philosophy

**The metaphor:** Liner notes on a box set — the stories behind the music that you discover while the record plays. Written by the person who was there. Not a blog in the traditional sense, but a growing collection of personal music stories that happens to be structured like a feed.

**The voice:** First person, always. "I first saw Howard Jones in 1985." "My busiest concert year was 2022." "June 4th keeps showing up in my concert history." The archive owner is the narrator. The tone is the Product Marketer voice: warm, inviting, slightly reverent about live music. Like a friend showing you their record collection and telling you the story behind each one.

**The system:** A music journalist who has memorized your entire concert history, has access to every artist's discography, and writes you a short column every week. Some weeks the column is about a cultural anniversary. Some weeks it's about a pattern in your data you never noticed. Some weeks it adds a 30-second soundtrack. Every post earns its place through a quality rubric.

**The constraint:** Quality over quantity. Two to three posts per week, max. If the system can't find anything genuinely interesting, it publishes nothing new — the existing feed carries the page.

---

## Content Architecture

### Three Content Categories

Every published post belongs to exactly one of three categories. Weekly publication should include variety across categories when possible.

#### 1. Cultural Context

**What it is:** A story about an artist, venue, or moment that connects to the broader music world. Primarily drawn from external data (discographies, formation dates, cultural history) and the LLM's knowledge of music history. Written in first person but the focus is outward — what was happening in music.

**AI discoverability value:** These posts answer questions real people search for. "When did Tears for Fears release Songs from the Big Chair?" "How many albums has Social Distortion released?" "What was the Curiosa Festival?"

**Examples (first person):**
- "Kraftwerk have released 10 studio albums since 1970 — 52 years of shaping what electronic music sounds like. When I saw them at The Shrine Auditorium in 2022, they were still performing with the same precision that influenced everyone from Afrika Bambaataa to Radiohead."
- "The 9:30 Club has been named Nightclub of the Year multiple times by Pollstar. It became my home venue during the DC years — 13 shows between 2010 and 2024."

**Template structure:** `[Broader cultural fact] + [my connection to it]`

#### 2. Personal Connection

**What it is:** A story centered on the archive owner's experience — the "I was there" dimension. Crosses personal concert data with cultural context. The focus is inward — what this meant to me.

**AI discoverability value:** Primary-source accounts. No other website can say these things.

**Examples (first person):**
- "I first saw Depeche Mode at Irvine Meadows in 1985, the year they released Some Great Reward. 38 years later, I watched them fill Dodger Stadium. Same band, same intensity — just 41,000 more people."
- "When I saw Kings of Leon open for The Cure at Curiosa in 2003, they had just released their debut EP. I had no idea who they were. They've since sold over 20 million albums."

**Template structure:** `[My experience] + [what was happening then] + [what happened since]`

#### 3. Deep-Cut Correlation

**What it is:** A surprising pattern, coincidence, or connection only discoverable by cross-referencing multiple data dimensions. This is where the agentic layer earns its keep.

**AI discoverability value:** Unique, unforgeable content that demonstrates the depth of the archive.

**Examples (first person):**
- "June 4th keeps showing up in my concert history: Howard Jones (1985), The Smithereens (1992), Tears for Fears (2022), and The Human League (2026). Four shows spanning 41 years, all on the same date. I can't explain it."
- "Blancmange opened at one of my first concerts in April 1986 at Irvine Meadows. Forty years later, they're opening for Thompson Twins in Glasgow. The circle closes on the other side of the Atlantic."
- "After 726 days without a concert — the longest drought of my life — I came back with Jimmy Buffett in October 1997. After 678 days of pandemic silence, I came back with The Aquabats. Both comebacks were in California."

**Template structure:** `[Surprising discovery] + [specific data points] + [personal reaction]`

### Cultural Context Correlation (Era Flavor)

Posts may optionally include references to **what was happening in music** at the time of a concert. This adds time-capsule depth and makes the posts feel like personal memory rather than data output. However, this is the area most prone to hallucination, so the system prompt enforces strict guardrails.

**Confidence tiers — what the LLM is allowed to reference:**

**Tier 1 — Grounded in your data (always allowed):**
- Album names that appear in `artists-top-tracks.json` (the `albumName` field). Example: if Depeche Mode's top tracks include songs from *Violator*, the system can reference that album because it's verifiable data.
- Artist formation years from `artists-metadata.json` (the `formed` field).
- Genre from enriched data. "They were part of the New Wave scene" is grounded if the genre is in the data.

**Tier 2 — Well-known music facts (allowed with approximate framing):**
- Major album release *years* (not exact dates) for artists in the archive. The LLM reliably knows when landmark albums came out.
- Band breakups and reunions for well-known artists.
- Career milestones: first album, final tour, Grammy wins, Rock and Roll Hall of Fame induction.
- Constraint: only for artists who appear in the concert archive, not random cultural references.

**Tier 3 — Avoid entirely:**
- Chart positions ("their #3 single") — too specific, easy to get wrong
- Sales figures ("sold 20 million albums") — often inaccurate and unverifiable
- Cultural events unrelated to the artist ("that was the year the Berlin Wall fell")
- Anything about what was happening in a specific city or venue at a specific time
- Exact dates for anything not in the data ("released on September 21, 1993")
- Comparisons or rankings ("widely considered one of the greatest")

**Framing instruction for the system prompt:**
"If you include a cultural detail, present it as approximate personal memory, not as an asserted fact. Use phrases like 'around the time,' 'that was the era of,' 'they had just released' — never cite specific dates or numbers unless they come from the data points provided in this prompt. One cultural detail per post maximum. When in doubt, leave it out — the personal concert data is interesting enough on its own."

**Examples of good cultural context:**
- ✅ "They had just released what would become their biggest album" (Tier 2, approximate)
- ✅ "That was around the time they broke up — I didn't know it would be one of the last shows" (Tier 2, approximate)
- ✅ "The album that 'Enjoy the Silence' came from was already a classic by then" (Tier 1, grounded in top tracks data)

**Examples of bad cultural context:**
- ❌ "Their album debuted at #4 on the Billboard 200" (Tier 3, specific chart position)
- ❌ "They had sold over 15 million copies worldwide" (Tier 3, sales figures)
- ❌ "This was the same week that Kurt Cobain died" (Tier 3, unrelated cultural event)
- ❌ "Released on March 19, 1990" (Tier 3, specific date not in data)

---

### Post Anatomy

Every published liner note post consists of these elements:

```
┌──────────────────────────────────────────────────┐
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │                                              │  │
│  │            [IMAGE — 16:9 or square]          │  │
│  │         Artist photo / venue / album art     │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  PERSONAL CONNECTION          March 7, 2026        │
│                                                    │
│  38 Years of Depeche Mode                          │
│                                                    │
│  I first saw Depeche Mode at Irvine Meadows in     │
│  1985, the year they released Some Great Reward.    │
│  38 years later, I watched them fill Dodger         │
│  Stadium — same band, same intensity, just 41,000   │
│  more people. That was right around when they        │
│  announced the Memento Mori tour, their first        │
│  without Andrew Fletcher.                            │
│                                                    │
│  ♫ Enjoy the Silence · 0:30 preview  [▶]           │
│                                                    │
│  Depeche Mode · Irvine Meadows · Dodger Stadium    │
│                                                    │
│  #artist-longevity  #multi-decade                  │
│                                                    │
│  Related: Kings of Leon Before the Debut ·          │
│           The Venues That Shaped My 80s             │
│                                                    │
└──────────────────────────────────────────────────┘
```

**Required elements (every post must have):**
1. **Image** — artist photo, venue photo, or album art (see Image Selection Logic)
2. **Category label** — "Cultural Context" / "Personal Connection" / "Deep-Cut"
3. **Publication date**
4. **Headline** — 5–12 words, Playfair Display
5. **Prose** — 2–5 sentences, first person, Source Sans 3
6. **At least one deep link** — linking to a scene in the main app
7. **Permalink slug** — unique URL for this post

**Optional elements (included when available):**
8. **MiniPlayer audio** — 30-second preview of a relevant track
9. **Tags** — derived from the detector that produced the finding
10. **Related posts** — links to other liner notes about the same artist/venue/era
11. **Cultural context detail** — era-appropriate cultural reference in the prose

---

### Image Selection Logic

Each post is assigned an image during the curation stage. The selection priority:

1. **If the post references a specific album** → use album art from `artists-top-tracks.json` (the `albumArt` field). Album art is visually striking and connects the post to specific music.

2. **If the post is primarily about an artist** → use artist image from `artists-metadata.json` (the `image` field). Fall back to album art of their most popular track if no artist image exists.

3. **If the post is primarily about a venue** → use venue photo from Google Places data (if available in venue enrichment). Fall back to artist image of the most-seen artist at that venue.

4. **If no image is available from any source** → use a generated placeholder that incorporates the category accent color and the post headline. (Simple SVG or CSS-based, no external dependency.)

**Image data model addition:**
```typescript
interface PostImage {
  url: string;              // Path to image asset
  alt: string;              // Descriptive alt text
  source: "artist" | "venue" | "album" | "placeholder";
  credit?: string;          // "TheAudioDB" | "Google Places" | "Deezer" | "iTunes"
}
```

### Audio Selection Logic

Posts about artists who have audio preview data in `artists-top-tracks.json` can include a MiniPlayer. Selection priority:

1. **If the post mentions a specific song** → use that track's preview (if available)
2. **If the post mentions a specific album** → use the most popular track from that album
3. **If the post is about an artist generally** → use their #1 top track
4. **If no preview is available** → omit the MiniPlayer (it's optional)

**Audio data model addition:**
```typescript
interface PostAudio {
  trackName: string;
  artistName: string;
  albumName: string;
  previewUrl: string;       // 30-sec MP3 or M4A
  albumArt: string;         // Thumbnail for MiniPlayer
  streamingUrl: string;     // Deezer or Apple Music link
  source: "deezer" | "itunes";
}
```

---

### Tags

Tags are derived automatically from the detector that produced the finding. They serve as secondary filter affordances and lightweight metadata for crawlers. They are NOT freeform or user-generated.

**Tag derivation map:**

| Detector | Tags |
|----------|------|
| artist-longevity | `#artist-longevity`, `#multi-decade` (if 3+ decades) |
| opener-to-headliner | `#opener-to-headliner`, `#career-arc` |
| venue-loyalty | `#venue-loyalty`, `#home-venue` (if 10+ shows) |
| calendar-anniversary | `#anniversary`, `#on-this-day` |
| geographic-chapter | `#geographic`, `#two-coasts` |
| concert-streak | `#hot-streak`, `#back-to-back` (if 1-day gap) |
| milestone-marker | `#milestone` |
| festival-mega-bill | `#festival`, `#mega-bill` |
| discography-crossref | `#discography`, `#deep-catalog` |
| drought-comeback | `#drought`, `#comeback` |
| temporal-pattern | `#pattern`, `#calendar-quirk` |

**Visual treatment:** Small, muted pills below the entity links. Source Sans 3, 12px, 500 weight, `#9ca3af` text on `#f3f4f6` background, rounded-full, `px-2 py-0.5`. On hover: category accent color text. Tappable to filter the feed by that tag.

---

### Post Permalinks

Every post gets a unique, human-readable URL:

**Format:** `/liner-notes/{slug}`

**Slug generation:** Derived from the headline, lowercase, hyphenated, max 60 characters. Examples:
- "38 Years of Depeche Mode" → `/liner-notes/38-years-of-depeche-mode`
- "June 4th: My Concert Anniversary" → `/liner-notes/june-4th-my-concert-anniversary`
- "The Blancmange Circle" → `/liner-notes/the-blancmange-circle`

**Slug uniqueness:** If a slug collision occurs (unlikely given headline diversity), append a numeric suffix: `-2`, `-3`.

**Permalink behavior:**
- Direct navigation to `/liner-notes/38-years-of-depeche-mode` renders that single post with full layout, image, audio, and related posts
- Back navigation returns to the feed at the user's previous scroll position
- Social sharing and AI indexing target the permalink URL
- Each permalink page includes its own JSON-LD structured data

---

### Related Posts — Data Model Now, UI Later

Over time, the system generates multiple posts about the same artists, venues, or themes. Related posts create a web of content that rewards exploration.

**IMPORTANT: Build the data model and store `relatedSlugs` in `liner-notes.json` from day one. Defer the UI rendering until the feed has 30+ posts.** With only 10-15 posts, there isn't enough density for related post connections to be meaningful. The data is cheap to compute and store; the UI is wasted effort until the feed has mass.

**Relatedness algorithm (compute during curation, store in JSON):**
1. **Same artist:** Posts that share any artist in their `artists[]` array
2. **Same venue:** Posts that share any venue in their `venues[]` array
3. **Same tag:** Posts that share any tag
4. **Same decade:** Posts whose `years[]` overlap in the same decade

**Storage:** Each post's `relatedSlugs: string[]` field contains 0-2 slugs of related posts, computed at curation time.

**UI (deferred):** When the feed reaches 30+ posts, add a "Related" section at the bottom of each post card showing up to 2 related post titles as links. Prefer "same artist" connections over "same tag" connections.

---

### Feed Architecture

The liner notes page (`/liner-notes`) is a **reverse-chronological feed** of posts.

**Feed layout:**
```
┌──────────────────────────────────────────────┐
│                                               │
│  LINER NOTES                                  │
│  Stories from 42 years of live music          │
│                                               │
│  [All] [Cultural Context] [Personal] [Deep-Cut]│
│  [#anniversary] [#artist-longevity] [...]     │
│                                               │
│  47 liner notes · Updated weekly              │
│                                               │
├──────────────────────────────────────────────┤
│                                               │
│  [Post card — newest]                         │
│                                               │
│  [Post card]                                  │
│                                               │
│  [Post card]                                  │
│                                               │
│  [Post card]                                  │
│                                               │
│  ... (paginated or infinite scroll)           │
│                                               │
├──────────────────────────────────────────────┤
│                                               │
│  RSS icon · "Subscribe to new liner notes"    │
│                                               │
└──────────────────────────────────────────────┘
```

The changelog is NOT on this page. It lives at `/whats-playing` (see Changelog Separation section).

**Filter behavior:**
- Category filters (All / Cultural Context / Personal / Deep-Cut) are primary toggle controls using the solid button pattern from `ui-component-patterns.md` — light scene variant (white inactive / violet-600 active)
- Tag filters are secondary — tapping a tag anywhere in the feed filters to that tag. Displayed as a horizontal scroll row below the category filters
- Active filters are reflected in the URL: `/liner-notes?category=personal` or `/liner-notes?tag=anniversary`
- "All" shows the unfiltered feed
- Filters apply client-side (no API call, all data is in liner-notes.json)

**Pagination:** Start with "Show More" button (loads 10 more posts). Infinite scroll can be added later. Initial page load shows the 10 most recent posts.

**Post count display:** "47 liner notes · Updated weekly" — uses the running count from metadata. Updates automatically as posts accumulate.

---

## Analysis Engine — Pattern Detection

The Analysis Engine is a deterministic TypeScript module that reads `concerts.json` (and optionally enriched data files) and produces structured findings. No AI involved — pure computation.

### Pattern Detectors

Each detector is a function that receives the full concert array and returns zero or more `AnalysisFinding` objects. Detectors are split into two priority tiers — **implement Tier 1 first**, add Tier 2 when you see which categories need more content.

#### Tier 1 — Implement First (High-Value, Straightforward)

#### 1. Artist Longevity Detector
- **Trigger:** Artist seen as headliner 2+ times with span > 5 years
- **Data points:** First show date, last show date, span in years, number of shows, venues visited
- **Bonus signals:** Shows on both coasts, shows across 3+ decades, venue variety

#### 2. Opener-to-Headliner Detector
- **Trigger:** Artist appears in `openers[]` of one concert AND as `headliner` of another
- **Data points:** Opener show (date, headliner they opened for, venue), headliner show (date, venue), gap in years
- **Bonus signals:** Large gap, opener show was before artist's commercial breakthrough

#### 3. Venue Loyalty Detector
- **Trigger:** Venue with 5+ concerts OR venue spanning 3+ decades
- **Data points:** Total shows, first/last show, decades spanned, all artists seen there
- **Bonus signals:** Seasonal patterns, venue no longer exists

#### 4. Calendar Anniversary Detector
- **Trigger:** Run weekly. Finds concerts whose month/day fall within ±7 days of current date in any prior year
- **Data points:** Concert date, artist, venue, years ago
- **Bonus signals:** Multiple concerts on same date, milestone anniversary (10, 20, 25, 30, 40 years)

#### 5. Geographic Chapter Detector
- **Trigger:** Detects clusters of concerts in a region by time period
- **Data points:** Region, date range, venue count, transition points
- **Algorithm:** Sort by date, assign region, detect transitions when 3+ consecutive concerts shift region

#### 6. Concert Streak Detector
- **Trigger:** 3+ concerts within 30 days
- **Data points:** All concerts in streak, total days, venues
- **Bonus signals:** Back-to-back shows (1-day gap), genre diversity within streak

#### 7. Milestone Marker Detector
- **Trigger:** Concert number milestones (1st, 25th, 50th, 75th, 100th, 150th)
- **Data points:** Concert ID, artist, venue, date, milestone number

#### Tier 2 — Add Later (More Niche, Add When Tier 1 Content Is Flowing)

#### 8. Festival Mega-Bill Detector
- **Trigger:** Concert with 5+ openers
- **Data points:** Headliner, all openers, total artist count, venue, date
- **Bonus signals:** Openers who later became major acts

#### 9. Discography Cross-Reference Detector
- **Trigger:** Requires enriched artist data (top tracks, album info)
- **Data points:** Number of albums, number of tracks, years active, most recent release
- **Bonus signals:** Saw artist the year a landmark album released, huge discography vs. small catalog

#### 10. Drought and Comeback Detector
- **Trigger:** Gaps of 180+ days between consecutive concerts
- **Data points:** Gap duration, concert before, concert after
- **Bonus signals:** Two droughts of similar length, comeback artist was significant

#### 11. Day-of-Week / Seasonal Pattern Detector
- **Trigger:** Statistical patterns in when concerts happen
- **Data points:** Day-of-week distribution by decade, monthly distribution, busiest year
- **Bonus signals:** Shift in concert-going patterns over time

---

## AnalysisFinding Type

```typescript
interface AnalysisFinding {
  id: string;                         // Deterministic ID: "longevity-social-distortion"
  detector: DetectorName;
  category: ContentCategory;          // "cultural" | "personal" | "deep-cut"
  temporality: "evergreen" | "timely";
  timeliness?: {
    relevantDate: string;             // ISO date
    windowStart: string;
    windowEnd: string;
  };
  headline: string;                   // Short headline (5-12 words)
  dataPoints: Record<string, any>;    // Structured data for story generator
  artists: string[];                  // Artist names (for cross-referencing + image selection)
  venues: string[];                   // Venue names
  years: number[];                    // Years involved
  suggestedImage?: {                  // Image recommendation
    type: "artist" | "venue" | "album";
    artistNormalized?: string;        // For artist/album lookup
    albumName?: string;               // For specific album art
    venueNormalized?: string;         // For venue photo
  };
  suggestedTrack?: {                  // Audio recommendation
    artistNormalized: string;
    trackName?: string;               // Specific track, or omit for top track
    albumName?: string;               // Specific album
  };
  tags: string[];                     // Auto-derived from detector
  score?: number;                     // Populated by scorer
  prose?: string;                     // Populated by generator
}

type DetectorName =
  | "artist-longevity"
  | "opener-to-headliner"
  | "venue-loyalty"
  | "calendar-anniversary"
  | "geographic-chapter"
  | "concert-streak"
  | "milestone-marker"
  | "festival-mega-bill"
  | "discography-crossref"
  | "drought-comeback"
  | "temporal-pattern";

type ContentCategory = "cultural" | "personal" | "deep-cut";
```

---

## Story Generator — Agentic Prose Layer

The Story Generator takes `AnalysisFinding` objects and produces first-person editorial prose using the Anthropic API.

### System Prompt

The system prompt encodes:

1. **Voice:** First person. Product Marketer tone — warm, inviting, slightly reverent about live music. Like telling a friend about your record collection.
2. **Perspective:** Always "I" — "I saw," "I remember," "my concert history." Never "you" or "the archive owner."
3. **Cultural context:** Follow the tiered confidence system defined in "Cultural Context Correlation (Era Flavor)" section. Only reference Tier 1 (grounded in data) and Tier 2 (well-known music facts with approximate framing) details. Never Tier 3. Frame as memory: "around the time," "they had just released," "that was the era of." One cultural detail per post maximum. When in doubt, leave it out.
4. **Structure rules:**
   - Self-contained (no "as mentioned above")
   - 2–5 sentences
   - Name specific artists, venues, and years
   - Include at least one number (years, count, span)
   - End with something human — a reaction, a reflection, a wry observation
5. **Category-specific guidance:**
   - Cultural Context: lead with the broader significance, bridge to "my experience of it"
   - Personal Connection: lead with "I" and the personal moment, bridge to what it meant
   - Deep-Cut Correlation: lead with the surprising discovery, prove it with data, react to it
6. **Anti-patterns:** No superlatives without evidence. No vague gestures ("a legendary career"). No filler ("it goes without saying"). Every sentence must contain a specific fact. Never use "journey" or "tapestry."

### Generation Flow

```
AnalysisFinding ──→ Build prompt with:
                     - System prompt (voice + rules + first person)
                     - Category-specific instructions
                     - Structured data points from finding
                     - Cultural context instruction
                     
                 ──→ Anthropic API call (claude-sonnet-4-20250514)
                     - max_tokens: 400
                     - temperature: 0.7
                     
                 ──→ Parse response, validate:
                     - Length check (40-500 words)
                     - Written in first person (contains "I" or "my")
                     - Contains required entity names
                     - No hallucinated data points
                     
                 ──→ Attach prose to finding
```

---

## Quality Scorer — The Rubric

### Pre-Prose Scoring (0–60 points)

Evaluated before any API call, based on the `AnalysisFinding` alone:

| Criterion | Points | How It's Measured |
|-----------|--------|-------------------|
| **Specificity** | 0–15 | Named entities count. 3 points per named artist/venue/city/date, max 15. |
| **Span / Scale** | 0–10 | Artist longevity > 30y = 10, > 20y = 7, > 10y = 4. Venue 4+ decades = 10. Festival 10+ acts = 10. |
| **Searchability** | 0–10 | Well-known artists score higher. Scored by: has bio in artists-metadata (5pts), has audio previews (3pts), has 3+ concerts in archive (2pts). |
| **Surprise Factor** | 0–10 | Calendar coincidences, opener-to-headliner with 20+ year gap, geographic symmetry = high. Routine repeat-artist facts = low. |
| **Timeliness Bonus** | 0–10 | Anniversary within ±3 days = 10, ±7 days = 5. Milestone anniversary year (25th, 30th, 40th) = +5 extra. |
| **Category Balance** | 0–5 | Bonus if category is underrepresented in current batch. |

**Pre-prose threshold:** Findings scoring < 20 are eliminated before story generation.

### Post-Prose Scoring — DEFERRED

Post-prose scoring (a second API call to evaluate generated prose quality) is deferred to a future iteration. For the initial implementation, pre-prose scoring alone determines publication. This simplifies the pipeline, halves API costs, and avoids over-engineering before we've seen real output.

**When to add it:** If after 4-6 weeks of operation, the published posts show inconsistent quality despite good pre-prose scores, add post-prose scoring as a pipeline enhancement. The scoring criteria (voice consistency, quotability, distinctiveness, emotional resonance) are documented here for future reference but should NOT be implemented in Phase 1.

**Future post-prose criteria (for reference only — do not implement yet):**
- Voice Consistency (0–10): First-person Product Marketer voice?
- Quotability (0–10): Contains a standalone factoid sentence?
- Distinctiveness (0–10): Different from previously published notes?
- Emotional Resonance (0–5): Evokes nostalgia, surprise, delight?

### Publication Thresholds (Pre-Prose Only, 60-Point Scale)

- **45+:** Publish — strong finding with high specificity and interest
- **30–44:** Publish if needed to fill the weekly 2–3 quota
- **20–29:** Hold — borderline, may be useful during slow weeks
- **Below 20:** Discard — not interesting enough to generate prose for

---

## Content Curator — Selection Logic

### Selection Algorithm

```
1. Sort all candidates by pre-prose score (descending)

2. Apply category diversity:
   - Select highest-scoring candidate from each category (if score > 30)
   
3. If fewer than 2 stories selected:
   - Lower threshold to 20
   - Check for timely stories (anniversaries)
   - Publish only what qualifies (1 or 0 is okay)
   
4. If more than 3 qualify:
   - Hard cap at 3 per week
   - Prefer category diversity over raw score
   - Tie-break: prefer timely over evergreen

5. Deduplication:
   - Same artist + same detector = duplicate (skip)
   - Same artist + different detector = okay (different angle)
   - Allow re-covering an artist if 6+ months since last post about them

6. Image assignment:
   - Resolve suggestedImage to actual URL from enriched data
   - Fall back through priority chain (album → artist → venue → placeholder)

7. Audio assignment:
   - Resolve suggestedTrack to actual preview URL from artists-top-tracks.json
   - Omit if no preview available

8. Slug generation:
   - Generate from headline, check for collisions against published history

9. Related posts:
   - Find up to 2 related posts from published history
   - Prefer same-artist over same-tag connections
```

---

## Data Model — liner-notes.json

```typescript
interface LinerNotesData {
  generatedAt: string;               // ISO timestamp of last pipeline run
  dataHash: string;                  // Hash of concerts.json

  posts: LinerNotePost[];            // All published posts, newest first

  metadata: {
    totalPosts: number;
    totalGenerated: number;          // Lifetime candidates generated
    averageScore: number;
    lastPipelineRun: string;
    concertsAnalyzed: number;
    feedUrl: string;                 // "/liner-notes.xml"
  };
}

interface LinerNotePost {
  id: string;                        // Deterministic ID
  slug: string;                      // URL-safe permalink slug
  category: ContentCategory;
  temporality: "evergreen" | "timely";
  
  // Content
  headline: string;
  prose: string;                     // First-person editorial, 2-5 sentences
  
  // Media
  image: PostImage;
  audio?: PostAudio;                 // Optional MiniPlayer data
  
  // Cross-references
  artists: string[];                 // Normalized names for deep links
  venues: string[];
  years: number[];
  tags: string[];                    // Auto-derived: ["#artist-longevity", "#multi-decade"]
  deepLinks: DeepLink[];             // At least one required
  relatedSlugs: string[];            // Slugs of related posts (0-2)
  
  // Metadata
  score: number;
  detector: DetectorName;
  publishedAt: string;               // ISO timestamp
  
  // AI discoverability
  searchableNarrative?: string;      // Plain-text version, no formatting
}

interface PostImage {
  url: string;
  alt: string;
  source: "artist" | "venue" | "album" | "placeholder";
  credit?: string;
}

interface PostAudio {
  trackName: string;
  artistName: string;
  albumName: string;
  previewUrl: string;
  albumArt: string;
  streamingUrl: string;
  source: "deezer" | "itunes";
}

interface DeepLink {
  label: string;                     // "Depeche Mode" or "Irvine Meadows"
  url: string;                       // "/?scene=artists&artist=depeche-mode"
  type: "artist" | "venue" | "timeline";
}
```

---

## Visual Design

### Page Background and Layout

- Background: `#fafaf9` (bg-light-3, Warm Stone)
- Content max-width: `768px`, centered
- Page title: Playfair Display, 36px, 700 weight, color `#1f2937`
- Subtitle: Source Sans 3, 16px, 400 weight, color `#6b7280` — "Stories from 42 years of live music"
- Padding: `48px 24px` (desktop), `32px 16px` (mobile)

### Category Filter Chips

Using light-scene primary toggle pattern from `ui-component-patterns.md`:

- Inactive: white bg, `border border-gray-300`, text `#374151`, hover `bg-gray-100`
- Active: category accent color bg, white text, no border
- Min-height: `36px` (smaller than scene controls since these are lightweight filters)
- Font: Source Sans 3, 14px, 500 weight
- Gap between chips: `8px`
- Row wraps on mobile

### Post Card

**Container:**
- Background: `#ffffff`
- Border: `1px solid #e5e7eb` (gray-200)
- Border-radius: `12px`
- Overflow: hidden (for image bleed)
- Box-shadow: `0 1px 3px rgba(0,0,0,0.06)`
- Margin-bottom: `24px`

**Image area:**
- Full-width at top of card
- Aspect ratio: 16:9 for venue/landscape photos, square for album art and artist headshots
- Object-fit: cover
- Max-height: `280px`
- Optional: subtle gradient overlay at bottom for text contrast if needed

**Content area:**
- Padding: `24px`

**Category label + date row:**
- Category label: Source Sans 3, 12px, 600 weight, uppercase, tracking-wider, category accent color
- Date: Source Sans 3, 13px, 400 weight, `#9ca3af`, right-aligned
- Flex row, space-between

**Headline:**
- Playfair Display, 22px, 700 weight, color `#1f2937`
- Margin: `8px 0`
- Links to permalink

**Prose:**
- Source Sans 3, 16px, 400 weight, line-height 1.65, color `#374151`
- Margin-bottom: `16px`

**MiniPlayer (when present):**
- Compact inline player: album art thumbnail (40x40), track name, artist, play/pause button
- Background: `#f9fafb` (gray-50), border-radius `8px`, padding `8px 12px`
- Play button: category accent color
- Reuses existing MiniPlayer component patterns from Artists scene
- Margin-bottom: `16px`

**Deep links row:**
- Source Sans 3, 14px, 500 weight, color `#6b7280`
- Links separated by `·`
- On hover: category accent color, underline
- Each link includes an appropriate prefix icon or just text

**Tags row:**
- Below deep links, `4px` gap above
- Small pills: Source Sans 3, 12px, 500 weight, `#9ca3af` text on `#f3f4f6` bg, rounded-full, `px-2 py-0.5`
- On hover: category accent text color
- Tappable to filter feed

**Related posts (when present):**
- Separated by a subtle `1px solid #f3f4f6` divider
- "Related:" label in Source Sans 3, 12px, 600 weight, `#9ca3af`
- Post titles as links, Source Sans 3, 14px, 500 weight, category accent color
- Max 2 related posts

### Card Animation

- Cards animate in with Framer Motion
- `initial={{ opacity: 0, y: 16 }}`
- `animate={{ opacity: 1, y: 0 }}`
- `transition={{ duration: 0.4, ease: "easeOut" }}`
- Staggered by `80ms` per card
- Respect `prefers-reduced-motion`

### Permalink Page

When viewing a single post at `/liner-notes/:slug`:

- Same card layout but larger: max-width `800px`
- Image can be taller (max-height `360px`)
- Headline: 28px
- Prose: 18px, line-height 1.7
- "← Back to Liner Notes" link at top
- Full related posts section with card thumbnails (not just titles)
- JSON-LD structured data in `<head>`

---

## RSS Feed

The pipeline generates an RSS 2.0 feed at `public/liner-notes.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Morperhaus Concert Archives — Liner Notes</title>
    <link>https://concerts.morperhaus.org/liner-notes</link>
    <description>Stories from 42 years of live music</description>
    <atom:link href="https://concerts.morperhaus.org/liner-notes.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>[ISO date]</lastBuildDate>
    <item>
      <title>38 Years of Depeche Mode</title>
      <link>https://concerts.morperhaus.org/liner-notes/38-years-of-depeche-mode</link>
      <description>I first saw Depeche Mode at Irvine Meadows in 1985...</description>
      <pubDate>[RFC 822 date]</pubDate>
      <guid isPermaLink="true">https://concerts.morperhaus.org/liner-notes/38-years-of-depeche-mode</guid>
      <category>Personal Connection</category>
    </item>
    ...
  </channel>
</rss>
```

The RSS feed includes the 20 most recent posts. A `<link>` tag in the HTML `<head>` points to it for auto-discovery:

```html
<link rel="alternate" type="application/rss+xml" title="Liner Notes" href="/liner-notes.xml" />
```

---

## Semantic HTML and AI Discoverability

### JSON-LD Structured Data

Each post (both in the feed and on permalink pages) injects JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "38 Years of Depeche Mode",
  "description": "I first saw Depeche Mode at Irvine Meadows in 1985...",
  "datePublished": "2026-03-07",
  "url": "https://concerts.morperhaus.org/liner-notes/38-years-of-depeche-mode",
  "image": "https://concerts.morperhaus.org/images/depeche-mode.jpg",
  "author": {
    "@type": "Person",
    "name": "Mike Morper"
  },
  "about": [
    { "@type": "MusicGroup", "name": "Depeche Mode" },
    { "@type": "EventVenue", "name": "Irvine Meadows", "address": { "addressLocality": "Irvine", "addressRegion": "CA" } }
  ],
  "keywords": ["concert history", "Depeche Mode", "Irvine Meadows", "live music", "1985"]
}
```

### Semantic HTML

Each post renders as:

```html
<article class="liner-note-post" data-category="personal" data-slug="38-years-of-depeche-mode">
  <img src="..." alt="Depeche Mode" loading="lazy" />
  <header>
    <span class="post-category">Personal Connection</span>
    <time datetime="2026-03-07">March 7, 2026</time>
  </header>
  <h3><a href="/liner-notes/38-years-of-depeche-mode">38 Years of Depeche Mode</a></h3>
  <p>I first saw Depeche Mode at Irvine Meadows in 1985...</p>
  <footer>
    <nav class="deep-links" aria-label="Related scenes">
      <a href="/?scene=artists&artist=depeche-mode">Depeche Mode</a>
      <a href="/?scene=venues">Irvine Meadows</a>
    </nav>
    <div class="tags" role="list">
      <a href="/liner-notes?tag=artist-longevity" role="listitem">#artist-longevity</a>
      <a href="/liner-notes?tag=multi-decade" role="listitem">#multi-decade</a>
    </div>
  </footer>
</article>
```

---

## Deep Linking

**Liner Notes routes:**
- `/liner-notes` — the feed (default view, newest first)
- `/liner-notes?category=personal` — filtered by category
- `/liner-notes?tag=anniversary` — filtered by tag
- `/liner-notes/:slug` — single post permalink

**Changelog route:**
- `/whats-playing` — app changelog (separate page, not part of liner notes)

**Entity deep links within posts (linking INTO the main app):**
- Artist: `/?scene=artists&artist={artistNormalized}`
- Venue: `/?scene=venues` (or `/?scene=venues&venue={venueNormalized}` if available)
- Timeline: `/?scene=timeline` (or `/?scene=timeline&year={year}` if available)

---

## Changelog Separation

The changelog ("What's Playing") moves to its own route at `/whats-playing`, fully disassociated from liner notes. These are different content types serving different purposes:

- **Liner Notes** (`/liner-notes`): Editorial stories about concert history. Written in first person. Updated weekly by the agentic pipeline. Audience: concert explorers, AI crawlers, music fans.
- **What's Playing** (`/whats-playing`): App release notes. Written in Product Marketer voice (third person). Updated per release. Audience: returning visitors curious about new features.

### Implementation

**Create `/whats-playing` route:**
- New route rendering `src/data/changelog.json` (same data source as before)
- Visual style: same page background (`#fafaf9`), same typography system
- Layout: simple reverse-chronological list of releases, matching existing changelog card design
- Each entry: version, date, title, description, highlights, deep link route

**Update existing references:**
- `README.md`: Change "What's New" link from `/liner-notes` to `/whats-playing`
- Toast notification CTA: Change navigation target from `/liner-notes` to `/whats-playing`
- Any internal links to the changelog should point to `/whats-playing`

**SEO integration:**
- Add `/whats-playing` to `scripts/generate-sitemap.ts`
- Add `/whats-playing` route handling to `workers/meta-injector.js` for bot OG tags
- The `/liner-notes` route no longer serves changelog content

**Files to create:**
- `src/components/WhatsPlaying/` or equivalent — changelog page component (can be simple, reuses existing changelog rendering logic)

**Files to modify:**
- `src/App.tsx` or router config — add `/whats-playing` route
- `README.md` — update changelog link
- Toast notification component — update CTA navigation target
- `workers/meta-injector.js` — add `/whats-playing` OG tags
- `scripts/generate-sitemap.ts` — add `/whats-playing` URL

---

## Open Graph Meta Tags

Every post permalink (`/liner-notes/:slug`) must have Open Graph meta tags for rich social sharing previews. These tags are injected server-side by the **existing Cloudflare Worker** (`workers/meta-injector.js`), which already handles dynamic meta injection for artist and venue deep links. The liner notes feature extends this Worker — it does NOT create a new one.

### How the Existing Worker Operates

The project already has a Cloudflare Worker (`workers/meta-injector.js`) that:
1. Intercepts all incoming requests
2. Detects bot user agents (20+ supported: Googlebot, Facebook, Twitter, ChatGPT, Claude, Perplexity, etc.)
3. For human users: passes through to Cloudflare Pages (zero impact)
4. For bots: parses URL parameters, fetches metadata from production JSON files, injects personalized `<meta>` tags into the HTML `<head>`, returns the modified HTML

The Worker already handles routes like `/?scene=artists&artist=depeche-mode` by looking up artist metadata and injecting artist-specific OG tags. **Liner notes permalinks extend this same pattern.**

### What to Add to the Worker

Add a new route handler for URLs matching `/liner-notes/{slug}`:

1. Detect the `/liner-notes/` path prefix
2. Extract the slug from the URL
3. Fetch `public/data/liner-notes.json` (same pattern the Worker uses for artists-metadata.json)
4. Find the post matching the slug in the `posts[]` array
5. Inject OG tags from the post data into the HTML `<head>`
6. If slug not found, fall back to feed-level OG tags

### Required OG Tags Per Post

```html
<!-- Primary OG tags -->
<meta property="og:type" content="article" />
<meta property="og:title" content="38 Years of Depeche Mode — Morperhaus Liner Notes" />
<meta property="og:description" content="I first saw Depeche Mode at Irvine Meadows in 1985, the year they released Some Great Reward. 38 years later, I watched them fill Dodger Stadium." />
<meta property="og:url" content="https://concerts.morperhaus.org/liner-notes/38-years-of-depeche-mode" />
<meta property="og:image" content="https://concerts.morperhaus.org/og/liner-notes/38-years-of-depeche-mode.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="Morperhaus Concert Archives" />

<!-- Article-specific -->
<meta property="article:published_time" content="2026-03-07T00:00:00Z" />
<meta property="article:author" content="Mike Morper" />
<meta property="article:section" content="Personal Connection" />
<meta property="article:tag" content="Depeche Mode" />
<meta property="article:tag" content="concert history" />
<meta property="article:tag" content="live music" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="38 Years of Depeche Mode — Morperhaus Liner Notes" />
<meta name="twitter:description" content="I first saw Depeche Mode at Irvine Meadows in 1985..." />
<meta name="twitter:image" content="https://concerts.morperhaus.org/og/liner-notes/38-years-of-depeche-mode.png" />
```

### OG Title Format

`{headline} — Morperhaus Liner Notes`

### OG Description

First 1–2 sentences of the post prose, truncated to 200 characters max. Must be in first person.

### OG Image Generation

Each post needs a 1200×630px OG image.

**Phase 1 implementation: Use the post's image directly.** Resize/crop the post image (artist photo, venue photo, or album art) to 1200×630. Simple, fast, no additional dependencies. Output to `public/og/liner-notes/{slug}.png`. For placeholder images (when no source image exists), generate a simple branded card with the category accent color and headline text.

**Future enhancement (not in scope): Composite branded OG images.** A styled image combining the post image with text overlay on a dark background, matching the Venues scene gradient. This produces more professional social cards but adds image generation dependencies (`satori`, `sharp`, or `canvas`). Add this when the basic pipeline is stable and you want polished social sharing.

### Feed-Level OG Tags

The `/liner-notes` feed page gets static OG tags (also injected by the Worker when a bot hits `/liner-notes` without a slug):

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="Liner Notes — Morperhaus Concert Archives" />
<meta property="og:description" content="Stories from 42 years of live music. A growing collection of discoveries from 180 concerts, 105 artists, and 77 venues." />
<meta property="og:url" content="https://concerts.morperhaus.org/liner-notes" />
<meta property="og:image" content="https://concerts.morperhaus.org/og/liner-notes-feed.png" />
<meta property="og:site_name" content="Morperhaus Concert Archives" />
```

### OG Image Data Model Addition

```typescript
interface LinerNotePost {
  // ... existing fields ...
  ogImage?: string;              // Path to generated OG image: "/og/liner-notes/{slug}.png"
}
```

---

## Claude Code Skills

### Skill 1: `liner-notes-pipeline`

**Location:** `.claude/skills/liner-notes-pipeline/SKILL.md`

**Purpose:** Describes the full pipeline architecture so any Claude Code session can understand and modify the system.

**Contents:**
- Pipeline overview: analyze → generate → score → curate → output
- File locations: all files in `scripts/liner-notes/`
- Data flow diagram
- How to add a new detector (create function, register in `analyze.ts`, add tags to tag map)
- How to tune the scoring rubric (which file, which weights)
- How to adjust the generation prompt (which file, what to modify)
- How to run the pipeline (`npm run generate:liner-notes` + flags)
- Output files: `public/data/liner-notes.json`, `public/liner-notes.xml`
- Integration point with weekly enrichment pipeline

### Skill 2: `liner-notes-voice`

**Location:** `.claude/skills/liner-notes-voice/SKILL.md`

**Purpose:** Defines the content voice for liner notes, reusable beyond just the pipeline.

**Contents:**
- First-person perspective: always "I" / "my"
- Product Marketer tone guidelines (from readme-maintenance.md, adapted for first person)
- Three content categories with examples of each
- Cultural context correlation rules (when to include, how to frame)
- Anti-patterns: words and phrases to avoid
- 5 example posts that represent "good" (one per category + two variations)
- How the voice differs from the changelog voice ("What's Playing")

---

## Pipeline Integration

### Integration with Existing `npm run build-data` Pipeline

The liner notes generation integrates into the **existing** data pipeline orchestrated by `scripts/build-data.ts`. It is inserted as a new step between data enrichment (Steps 1-9) and SEO file generation (Steps 10-11). This ordering is critical because Steps 10-11 need to know about liner notes URLs and stats.

```
Existing pipeline (scripts/build-data.ts):
  Steps 1-9:  Data fetching and enrichment
              (Google Sheets → concerts.json, artist metadata, top tracks, etc.)
  Step 10:    npm run update:meta
              (scripts/update-meta-tags.ts — updates index.html meta tags,
               Schema.org JSON-LD, llm.txt stats, og-stats.json)
  Step 11:    npm run generate:sitemap
              (scripts/generate-sitemap.ts — generates sitemap.xml)

Updated pipeline with liner notes:
  Steps 1-9:  Data fetching and enrichment (unchanged)
  ✨ NEW Step: npm run generate:liner-notes
              (scripts/liner-notes/index.ts — analyze → generate → score → curate)
              Outputs: public/data/liner-notes.json, public/liner-notes.xml,
                       public/og/liner-notes/*.png
  Step 10:    npm run update:meta (MODIFIED)
              Now ALSO reads liner-notes.json to:
              - Add liner notes count to llm.txt
              - Add liner notes description and example queries to llm.txt
              - Add linerNotesCount to og-stats.json
  Step 11:    npm run generate:sitemap (MODIFIED)
              Now ALSO reads liner-notes.json to:
              - Add /liner-notes feed URL
              - Add /liner-notes/{slug} for each published post
              - Set changefreq="weekly" for liner notes URLs
  Commit and push (unchanged — Cloudflare Pages auto-deploys)
```

### Cloudflare Worker Deployment

After modifying `workers/meta-injector.js` to handle liner notes routes, redeploy the Worker:

```bash
cd workers
npx wrangler deploy
```

See `workers/README.md` for full deployment guide. The Worker reads `liner-notes.json` from production at runtime (same pattern it uses for `artists-metadata.json` and `venues-metadata.json`).

### CLI Interface

```bash
# Full pipeline run
npm run generate:liner-notes

# Analysis only (no API calls)
npm run generate:liner-notes -- --analyze-only

# Force regeneration (ignore deduplication)
npm run generate:liner-notes -- --force

# Dry run (show what would be published)
npm run generate:liner-notes -- --dry-run

# Generate for a specific date (useful for testing anniversary detector)
npm run generate:liner-notes -- --date 2026-06-04

# Seed mode (first run — generate ~10 posts instead of 2-3)
npm run generate:liner-notes -- --seed
```

### Environment Variables

```
ANTHROPIC_API_KEY=sk-...    # Required for story generation and prose scoring
```

---

## Testing Strategy

### Manual Testing Checklist

**Analysis Engine:**
- [ ] Detects Social Distortion as top artist longevity (34 years, 8 shows)
- [ ] Detects Thompson Twins as longest span (42 years)
- [ ] Detects Crowded House opener-to-headliner arc (1993 → 2023)
- [ ] Detects Pacific Amphitheatre as 5-decade venue
- [ ] Detects June 4th as densest calendar date (4 concerts)
- [ ] Detects 2020 as silent year
- [ ] Detects 2022 as busiest year (14 concerts)
- [ ] Detects geographic chapters (CA → DC → CA)
- [ ] Detects 2003 Curiosa Festival as mega-bill (15 artists)
- [ ] Calendar anniversary detector finds relevant concerts for current week

**Story Generator:**
- [ ] All prose is in first person ("I" / "my")
- [ ] Product Marketer voice — warm, factual, no jargon
- [ ] Cultural context details included when appropriate
- [ ] Each story is self-contained
- [ ] No hallucinated facts

**Quality Scorer:**
- [ ] Well-known artists score higher on searchability
- [ ] 40-year span scores higher than 5-year span
- [ ] Timely findings get bonus during their relevant week
- [ ] Category balance bonus works
- [ ] Pre-prose threshold (20) filters weak candidates

**Content Curator:**
- [ ] Never publishes more than 3 per week
- [ ] Prefers category diversity
- [ ] Deduplication works
- [ ] Images resolved for every post
- [ ] Audio resolved when available
- [ ] Slugs are unique
- [ ] Related posts connected correctly

**Liner Notes Page + SEO Integration:**
- [ ] Feed renders newest-first
- [ ] Category filters work
- [ ] Tag filters work
- [ ] Post cards display: image, category, date, headline, prose, deep links, tags
- [ ] MiniPlayer plays audio when present
- [ ] Permalink routes work (`/liner-notes/:slug`)
- [ ] Back navigation from permalink returns to feed
- [ ] `relatedSlugs` computed and stored in liner-notes.json (UI rendering deferred, verify data only)
- [ ] `/whats-playing` renders changelog correctly (separate page, not on liner notes)
- [ ] README.md links to `/whats-playing` for changelog
- [ ] Toast notification CTA navigates to `/whats-playing`
- [ ] RSS link in `<head>` and RSS feed validates
- [ ] JSON-LD in page source (BlogPosting type)
- [ ] Semantic HTML (`<article>`, `<time>`, `<nav>`, `<h3>`)
- [ ] Mobile responsive
- [ ] Lighthouse accessibility audit passes
- [ ] **Worker OG injection:** `curl -A "Googlebot" https://concerts.morperhaus.org/liner-notes/38-years-of-depeche-mode` returns HTML with correct og:title, og:description, og:image
- [ ] **Worker feed OG:** `curl -A "Googlebot" https://concerts.morperhaus.org/liner-notes` returns HTML with feed-level OG tags
- [ ] **OG preview:** Test permalink with https://opengraph.xyz — shows image, title, description
- [ ] **Twitter Card:** Test permalink with Twitter Card Validator — shows summary_large_image
- [ ] **Sitemap:** `public/sitemap.xml` contains `/liner-notes`, all `/liner-notes/{slug}` URLs, and `/whats-playing`
- [ ] **Sitemap validation:** Submit updated sitemap to Google Search Console, verify no errors
- [ ] **llm.txt:** `public/llm.txt` contains liner notes count and description
- [ ] **og-stats.json:** Contains `linerNotesCount` field
- [ ] **Pipeline ordering:** Full `npm run build-data` runs liner notes → meta updates → sitemap in correct order

### Known High-Value Findings (Regression Tests)

Scores are on the 60-point pre-prose scale. Findings from Tier 2 detectors (marked with †) will only be tested after those detectors are implemented.

| Finding | Detector | Category | Expected Pre-Prose Score |
|---------|----------|----------|--------------------------|
| Thompson Twins 42-year span | artist-longevity | personal | 45-55 |
| Crowded House opener→headliner (30yr) | opener-to-headliner | personal | 48-58 |
| Pacific Amphitheatre 5 decades | venue-loyalty | cultural | 42-52 |
| June 4th: 4 concerts, 41 years | calendar-anniversary | deep-cut | 45-55 |
| 2003 Curiosa Festival (Kings of Leon) | festival-mega-bill † | cultural | 48-55 |
| Blancmange 1986→2026 circle | opener-to-headliner | deep-cut | 50-58 |
| Geographic chapters (CA→DC→CA) | geographic-chapter | deep-cut | 42-50 |
| 2022: busiest year post-pandemic | drought-comeback † | personal | 38-48 |
| 9:30 Club: 13 shows | venue-loyalty | personal | 38-48 |

---

## Implementation Plan

### Phase 1: Analysis Engine + Pipeline Types + Skills (Window 1)

**Files to Create:**
- `scripts/liner-notes/types.ts` (~150 LOC) — all shared types
- `scripts/liner-notes/analyze.ts` (~550 LOC) — all pattern detectors
- `.claude/skills/liner-notes-pipeline/SKILL.md` (~150 LOC)
- `.claude/skills/liner-notes-voice/SKILL.md` (~100 LOC)

**Tasks:**
1. Define all TypeScript types
2. Implement each detector
3. Create `runAllDetectors()` orchestrator
4. Write both Claude Code skills
5. Test against current dataset

**Acceptance Criteria:**
- [ ] Tier 1 detectors (1-7) implemented and producing findings
- [ ] Tier 2 detectors (8-11) stubbed with TODO comments for future implementation
- [ ] Known test findings detected (see regression test table)
- [ ] Both skills written and accurate
- [ ] Runs in < 5 seconds

### Phase 2: Story Generator + Quality Scorer + Curator (Window 2)

**Files to Create:**
- `scripts/liner-notes/generate.ts` (~300 LOC)
- `scripts/liner-notes/score.ts` (~120 LOC) — pre-prose scoring only (post-prose deferred)
- `scripts/liner-notes/curate.ts` (~150 LOC)

**Tasks:**
1. Implement system prompt with first-person voice and tiered cultural context rules
2. Build generation function with validation (first person check, entity names, length)
3. Implement pre-prose scoring only (60-point rubric)
4. Build curation with image/audio assignment, slug generation, related slugs computation
5. Test end-to-end with real API calls

**Acceptance Criteria:**
- [ ] First-person prose in Product Marketer voice
- [ ] Cultural context follows tiered confidence rules (no Tier 3 violations)
- [ ] Pre-prose scoring eliminates weak candidates before API calls
- [ ] Images resolved for every post
- [ ] Audio resolved when available
- [ ] API costs < $0.10 per run (no post-prose scoring calls)

### Phase 3: Pipeline Orchestrator + Data Output + RSS + OG Images + SEO Integration (Window 3)

**Files to Create:**
- `scripts/liner-notes/pipeline.ts` (~180 LOC)
- `scripts/liner-notes/index.ts` (~60 LOC)
- `scripts/liner-notes/rss.ts` (~80 LOC)
- `scripts/liner-notes/og-image.ts` (~120 LOC) — OG image generation

**Files to Modify (MUST read existing code first):**
- `scripts/build-data.ts` — Insert liner notes generation after Step 9, before Step 10
- `scripts/generate-sitemap.ts` — Add `/liner-notes` and all `/liner-notes/{slug}` URLs
- `scripts/update-meta-tags.ts` — Add liner notes count to `llm.txt` stats and `og-stats.json`
- `package.json` — Add `generate:liner-notes` script

**Files to Deprecate:**
- `scripts/generate-facts.ts` — Read it first, then deprecate (superseded by agentic engine)

**Tasks:**
1. Read existing `scripts/build-data.ts` to understand pipeline step ordering
2. Read existing `scripts/generate-sitemap.ts` to understand URL generation patterns
3. Read existing `scripts/update-meta-tags.ts` to understand llm.txt and og-stats.json update patterns
4. Read existing `scripts/generate-facts.ts` to understand what it generates and how
5. Wire all liner notes stages together: analyze → filter → generate → score → curate → write
6. Implement `liner-notes.json` read/write with history management
7. Generate RSS feed at `public/liner-notes.xml`
8. Generate OG images for each post at `public/og/liner-notes/{slug}.png`
9. Add CLI flags (--analyze-only, --force, --dry-run, --seed, --date)
10. Insert liner notes step into `build-data.ts` pipeline (after Step 9, before Step 10)
11. Extend `generate-sitemap.ts` to include liner notes URLs
12. Extend `update-meta-tags.ts` to include liner notes stats in llm.txt and og-stats.json

**Acceptance Criteria:**
- [ ] `npm run generate:liner-notes` produces valid `public/data/liner-notes.json`
- [ ] RSS feed validates at `public/liner-notes.xml`
- [ ] OG images generated for each post at `public/og/liner-notes/{slug}.png`
- [ ] `--dry-run`, `--analyze-only`, and `--seed` flags work
- [ ] Pipeline handles first run with `--seed` (generates ~10 posts)
- [ ] `scripts/build-data.ts` runs liner notes BEFORE Steps 10-11
- [ ] `public/sitemap.xml` includes liner notes URLs after full pipeline run
- [ ] `public/llm.txt` includes liner notes stats after full pipeline run
- [ ] `public/og-stats.json` includes `linerNotesCount` after full pipeline run

### Phase 4: Liner Notes Page Redesign + Changelog Separation + Worker Extension (Window 4)

**Files to Create:**
- `src/types/liner-notes.ts` (~80 LOC)
- `src/components/WhatsPlaying/` (~100 LOC) — Changelog page component (reuses existing changelog rendering)

**Files to Modify (MUST read existing code first):**
- `workers/meta-injector.js` — Extend with `/liner-notes/:slug`, `/liner-notes`, and `/whats-playing` route handlers
- `src/components/LinerNotes/` — Full redesign as blog feed (remove all changelog rendering)
- `src/App.tsx` or router — Add `/liner-notes/:slug` permalink route and `/whats-playing` route
- `README.md` — Update changelog link from `/liner-notes` to `/whats-playing`
- Toast notification component — Update CTA navigation target to `/whats-playing`
- `scripts/generate-sitemap.ts` — Add `/whats-playing` URL (if not already done in Phase 3)

**Tasks:**
1. Read existing `workers/meta-injector.js` thoroughly — understand bot detection, URL parsing, metadata fetching, and meta injection patterns
2. Add `/liner-notes/:slug` route handler to Worker following existing patterns
3. Add `/liner-notes` feed-level OG handler to Worker
4. Add `/whats-playing` OG handler to Worker
5. Create `/whats-playing` page component (extract/reuse existing changelog rendering from LinerNotes)
6. Register `/whats-playing` route in app router
7. Build liner notes feed layout with filter chips (no changelog content)
8. Build post card component (image, prose, MiniPlayer, deep links, tags)
9. Build permalink page
10. Implement category and tag filtering
11. Add JSON-LD injection (BlogPosting type, following patterns in index.html lines 68-146)
12. Add RSS auto-discovery link in `<head>`
13. Update README.md changelog link to `/whats-playing`
14. Update toast notification CTA to navigate to `/whats-playing`
15. Test Worker with bot user agent simulation
16. Deploy Worker: `cd workers && npx wrangler deploy`

**Acceptance Criteria:**
- [ ] `/liner-notes` renders feed with all post elements — NO changelog content on this page
- [ ] `/whats-playing` renders changelog from `changelog.json`
- [ ] Filters work (category + tag)
- [ ] Permalinks render individual posts
- [ ] MiniPlayer functional
- [ ] JSON-LD present in page source (BlogPosting type)
- [ ] Worker injects correct OG tags for `/liner-notes/:slug` (test with `curl -A Googlebot`)
- [ ] Worker injects feed-level OG tags for `/liner-notes`
- [ ] Worker injects OG tags for `/whats-playing`
- [ ] Twitter Card tags render correctly
- [ ] OG images display in social previews (test with https://opengraph.xyz)
- [ ] README.md links to `/whats-playing` for changelog
- [ ] Toast notification navigates to `/whats-playing`
- [ ] Mobile responsive
- [ ] Lighthouse accessibility passes

---

## Future Enhancements

**Deferred from this spec (add when pipeline is stable):**
- **Post-prose scoring** — Second API call to evaluate generated prose quality. Add if quality drift becomes a problem after 4-6 weeks of operation.
- **Related posts UI** — Render related post links on each card. Add when feed reaches 30+ posts (data model stores `relatedSlugs` from day one).
- **Composite branded OG images** — Styled 1200×630 images with post image + headline + category color bar on dark background. Upgrade from direct-image OG.
- **Tier 2 detectors** (8-11: festival mega-bill, discography cross-reference, drought/comeback, temporal patterns) — Add when Tier 1 content is flowing and you can see which categories need variety.

**Net-new future ideas:**
- **Structured "this day in music" dataset** for higher-confidence cultural correlations
- **"On This Day" calendar view** — visual calendar showing concerts by date across years
- **Liner notes surfaced in other scenes** — tooltip/overlay "did you know?" in Timeline, Venues, Artists
- **Email digest** — weekly email with new liner notes
- **Setlist archaeology** — cross-reference setlist.fm data ("Story of My Life appeared on 7 of 8 setlists")
- **Album art carousel** — show all album covers for artists with discography cross-reference posts
- **Post reactions** — lightweight visitor engagement (heart, "I was there too")

---

## Cost Analysis

**Weekly Anthropic API costs (Phase 1 — pre-prose scoring only, no post-prose calls):**
- Story generation: ~8-10 calls × ~400 output tokens = ~4,000 tokens output
- Input tokens: ~2,500 per call × 10 calls = ~25,000 tokens input
- **Estimated weekly: ~$0.05-0.08**
- **Estimated annual: < $4.00**

---

## Accessibility Compliance

- Semantic HTML throughout (`<article>`, `<time>`, `<nav>`, `<h3>`, `<footer>`)
- Category identified by both color AND text label
- All images have descriptive `alt` text
- MiniPlayer keyboard-accessible (existing component patterns)
- Filter chips keyboard-navigable
- Framer Motion respects `prefers-reduced-motion`
- Minimum contrast ratios met for all text on `#fafaf9`
- Feed and permalink pages pass Lighthouse accessibility

---

## Documentation Updates Required

- [ ] `docs/ROADMAP.md` — mark feature complete
- [ ] `README.md` — "What's New" section
- [ ] `.claude/context.md` — note new pipeline step and skills
- [ ] `src/data/changelog.json` — add release entry
- [ ] `docs/LINER-NOTES-PIPELINE.md` — technical docs (generated from skill)

---

## Resolved Decisions

1. **Author name for JSON-LD and OG tags:** ✅ "Mike Morper"

2. **ANTHROPIC_API_KEY management:** ✅ No special handling needed. The pipeline runs in Claude Code context (both scheduled and manual), where the API key is already available. No CI/CD secrets configuration required.

3. **First-run seeding:** ✅ Seed with ~10 posts via `--seed` flag on first execution.

4. **Post-prose scoring:** ✅ DEFERRED. Pre-prose scoring only for Phase 1. Add post-prose scoring later if quality drift becomes a problem after 4-6 weeks of operation. Criteria documented in spec for future reference.

5. **Image fallback:** ✅ Use CSS/SVG placeholder when no source image exists. Every post displays an image.

6. **MiniPlayer integration:** ✅ Reuse existing MiniPlayer component. Implementer must verify no conflicts with Artists scene (only one audio stream at a time).

7. **RSS feed hosting:** ✅ `public/liner-notes.xml` deployed statically via Cloudflare Pages.

8. **Cloudflare Worker:** ✅ Extend existing `workers/meta-injector.js`. Do NOT create a new Worker.

9. **Sitemap integration:** ✅ Extend existing `scripts/generate-sitemap.ts`. Do NOT create a separate sitemap.

10. **llm.txt integration:** ✅ Extend existing `scripts/update-meta-tags.ts`.

11. **Pipeline ordering:** ✅ Liner notes generation runs AFTER Step 9, BEFORE Step 10.

12. **Fact cards replacement:** ✅ `scripts/generate-facts.ts` is superseded. Read first, then deprecate.

13. **Changelog separation:** ✅ Changelog moves to `/whats-playing`. Separate page, separate purpose.

14. **Detector prioritization:** ✅ Implement Tier 1 detectors (1-7) first. Add Tier 2 (8-11) when Tier 1 content is flowing and you can see which categories need more variety.

15. **Related posts:** ✅ Compute and store `relatedSlugs` in the data model from day one. Defer the UI rendering until the feed reaches 30+ posts.

16. **OG images:** ✅ Phase 1 uses the post image directly (resized to 1200×630). Composite branded OG images are a future enhancement.

17. **Cultural context:** ✅ Tiered confidence system. Tier 1 (grounded in data) always allowed. Tier 2 (well-known music facts) allowed with approximate framing. Tier 3 (chart positions, sales figures, unrelated events) explicitly prohibited.

18. **Future concert filtering:** ✅ Analysis engine only processes concerts where `date <= today`. Future concerts are excluded entirely to avoid prose tense issues.

19. **Phasing strategy:** ✅ Incremental shipping — each phase is independently mergeable and deployable. Phase 3 can ship before Phase 4. No big-bang release required.

20. **Scoring criterion naming:** ✅ "Searchability" renamed to "Data Richness" — rewards any finding with more supporting evidence, applying equally to artist-centric and venue-centric findings.

21. **Pipeline isolation:** ✅ The liner notes pipeline must never break the main build process. All pipeline logic wrapped in try/catch. Failures exit 0 with a warning. If `liner-notes.json` is missing, all dependent code (sitemap, meta-tags, Worker) degrades gracefully.

22. **Primary design intent:** ✅ The liner notes system's primary purpose is to drive traffic back into the archive. Every post must include at least one deep link into the app. This intent must be explicit in the system prompt for the story generator.

23. **Responsive design:** ✅ Both `/liner-notes` and `/whats-playing` must be fully responsive. Mobile-first, minimum 375px viewport. All tap targets >= 44px. Design mocks required before UI implementation begins (see #60).

24. **Design mocks:** ✅ Desktop and mobile mocks for `/liner-notes` (feed + permalink) and `/whats-playing` are a prerequisite to UI implementation. Issue #60 tracks this.

---

## Revision History

- **2026-03-08 (v3.3):** Implementation planning session — added resolved decisions #18-24: future concert filtering (date <= today), incremental phasing, Data Richness scoring rename, pipeline isolation requirement, deep links as primary traffic-driving intent, responsive/mobile-first requirement, design mocks as prerequisite. GitHub epics #44/#49/#53/#59 created. Status updated to ready for implementation.
- **2026-03-08 (v3.2):** Architect review — deferred post-prose scoring (pre-prose only for Phase 1), tiered detector priority (Tier 1 first, Tier 2 later), deferred related posts UI (data model only), simplified OG images (direct resize, no composite), tiered cultural context confidence system with explicit allow/deny lists, changelog fully separated to `/whats-playing`, 60-point scoring scale
- **2026-03-08 (v3.1):** Changelog separated to `/whats-playing`
- **2026-03-07 (v3.0):** SEO infrastructure integration — Worker extension, sitemap/llm.txt/og-stats integration, pipeline step ordering
- **2026-03-07 (v2.x):** First-person voice, blog feed, permalinks, images, MiniPlayer, cultural context, RSS, OG tags, tags, skills
- **2026-03-07 (v1.0):** Initial specification
- **Author:** Project collaboration (planning session)
- **Status:** Ready for implementation
