# SEO Optimization - Search & AI Bot Discoverability

**Status:** Phase 1-2 Complete | Phase 3 Planned
**Current Version:** v3.5.0
**Target Version:** v3.6.0 (Phase 3)
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

**Implementation Progress:**

- ✅ **Phase 1: Static SEO Foundation** - Complete (2026-01-20)
- ✅ **Phase 2: Dynamic Sitemap Generation** - Complete (2026-01-20)
- ⏸️ **Phase 3: Cloudflare Worker Meta Injection** - Planned

---

## Executive Summary

Enable search engines and AI bots to discover, index, and understand the Morperhaus Concert Archives content. Currently, the SPA architecture serves an empty `<div id="root">` to bots, preventing indexing of 178 concerts, 247 artists, and 77 venues. This spec implements a phased approach: static SEO foundations (robots.txt, sitemap.xml, llm.txt, Schema.org structured data) followed by dynamic meta tag injection via Cloudflare Worker to make every entity individually discoverable without changing the core architecture.

**Problem It Solves:**
- Search engines cannot discover artist/venue pages beyond the homepage
- AI assistants (ChatGPT, Claude, Perplexity) cannot answer queries about concert history
- Social media shares show generic metadata regardless of deep link
- Rich venue/artist data (locations, setlists, bios) is invisible to crawlers

**User Experience Enhancement:**
- Google searches for "Depeche Mode Morperhaus" surface the artist page
- Sharing `/?scene=artists&artist=depeche-mode` shows artist-specific preview card
- AI assistants can answer: "How many times has Morperhaus seen Depeche Mode?"
- Concert archive appears in search results for venue/artist queries

**Product Fit:**
Transforms the site from a personal archive to a discoverable reference for music venues, setlists, and tour history while maintaining its personal narrative context.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the SEO Optimization feature for Morperhaus Concerts.

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
- Create robots.txt, sitemap.xml, llm.txt for bot discovery
- Add Schema.org structured data (JSON-LD) for rich search results
- Generate dynamic sitemap from concert data (247 artists, 77 venues)
- Document API for AI assistants via llm.txt
- Enhance meta tags for better social sharing
- (Phase 2) Implement Cloudflare Worker for dynamic meta tag injection

**Key References:**
- Full Design Spec: docs/specs/future/global-seo-optimization.md
- Deep Linking Guide: docs/DEEP_LINKING.md
- Data Pipeline: docs/DATA_PIPELINE.md
- Build Pipeline: docs/BUILD.md
- Concert Data: public/data/concerts.json
- Artist Metadata: public/data/artists-metadata.json
- Venue Metadata: public/data/venues-metadata.json

**Implementation Approach:**
- Window 1: Static SEO foundation (robots.txt, enhanced meta tags, Schema.org)
- Window 2: Sitemap generation script + llm.txt
- Window 3: Cloudflare Worker for dynamic meta injection (pending free tier confirmation)

**Design Philosophy:**
Make the concert archive's rich structured data accessible to search engines and AI assistants while maintaining the existing SPA architecture and performance characteristics.

**Key Technical Details:**
- All static files go in `public/` (robots.txt, sitemap.xml, llm.txt)
- Sitemap generator: `scripts/generate-sitemap.ts` (runs as part of build-data)
- Schema.org markup: JSON-LD in index.html <head>
- Cloudflare Worker: Separate repository (edge function, no app changes)

**Files to Create:**
- `public/robots.txt` (~30 lines) - Crawler directives
- `public/llm.txt` (~50 lines) - AI assistant documentation
- `scripts/generate-sitemap.ts` (~150 lines) - Dynamic sitemap generator
- `scripts/generate-sitemap.test.ts` (~100 lines) - Sitemap validation tests
- `workers/meta-injector.js` (~200 lines) - Cloudflare Worker (Phase 2)

**Files to Modify:**
- `index.html` - Add Schema.org JSON-LD, enhance meta tags
- `package.json` - Add `generate:sitemap` script
- `docs/BUILD.md` - Document sitemap generation step
- `.github/workflows/update-meta-tags.yml` - Add sitemap generation

Let's start with Window 1. Should I begin by creating robots.txt and enhancing the meta tags in index.html?
```

---

## Design Philosophy

**Conceptual Model:**
The concert archive is a **personal narrative with authoritative data points**. SEO optimization must:
1. **Respect context**: Mark personal experience as subjective, venue/setlist data as authoritative
2. **Maintain architecture**: No SSR/SSG migration - work within SPA constraints
3. **Progressive enhancement**: Bots get rendered content, humans get fast SPA
4. **Data exposure**: Rich JSON already exists - make it discoverable and documented

**UX Goals:**
- Users can find the site via artist/venue searches
- AI assistants understand the data boundaries (personal vs. authoritative)
- Social shares show contextual previews (artist photo, venue info)
- Search results show rich snippets (event counts, date ranges)

**Technical Principles:**
- **Zero performance impact** for human users
- **Incremental implementation** - each phase independently valuable
- **Cloudflare-native** - leverage edge network, no server costs
- **Build-time generation** - sitemap updates with data, no runtime overhead

---

## Visual Design

### N/A - Infrastructure Feature

This feature has no user-facing UI. All enhancements are visible to:
- Search engine crawlers (Googlebot, Bingbot)
- AI assistants (ChatGPT, Claude, Perplexity)
- Social media link scrapers (Twitter, Facebook, LinkedIn)
- SEO analysis tools (Google Search Console, Ahrefs)

---

## Technical Implementation

### Phase 1: Static SEO Foundation (P0 - Immediate)

#### 1.0 Auto-Update Strategy

**Problem:** SEO files contain hardcoded stats (concert count, artist count, dates) that become stale as data changes.

**Solution:** Extend existing `scripts/update-meta-tags.ts` to dynamically update all SEO files.

**Files Updated Automatically:**

- `index.html` - Meta descriptions, Schema.org JSON-LD
- `public/llm.txt` - All occurrences of stats
- `public/og-stats.json` - JSON stats for OG image generation

**Integration:**

- Added as Step 10 in `scripts/build-data.ts` pipeline
- Runs automatically after all data enrichment completes
- Reads from `concerts.json` and `discography.json` to calculate current stats

**Stats Auto-Updated:**

- Concert count
- Artist count (headliners + openers)
- Venue count
- Album count (from discography.json)
- Date range (earliest → latest concert)
- Last modified date (current date)
- Decade calculation

**Script:** `npm run update:meta`

**Manual Trigger:** Run anytime to refresh SEO files with latest stats

---

#### 1.1 robots.txt

**Location:** `public/robots.txt`

**Purpose:** Direct crawler behavior, declare sitemap, welcome AI bots

**Content Structure:**
```txt
# Morperhaus Concert Archives - Crawler Directives
User-agent: *
Allow: /
Allow: /data/*.json
Disallow: /api/

# Rate limiting for polite crawling
Crawl-delay: 1

# Sitemap location
Sitemap: https://concerts.morperhaus.org/sitemap.xml

# AI Bots - Explicitly welcome
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: Claude-Web
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: PerplexityBot
User-agent: anthropic-ai
Allow: /

# Social Media Crawlers
User-agent: facebookexternalhit
User-agent: Twitterbot
User-agent: LinkedInBot
Allow: /
```

**Testing:**
- Validate syntax: https://www.google.com/webmasters/tools/robots-testing-tool
- Verify in Google Search Console after deployment

---

#### 1.2 Enhanced Meta Tags

**Location:** `index.html` (lines 8-23)

**Current State:** Basic tags present
**Enhancement:** Add missing semantic and discovery tags

**Tags to Add:**
```html
<!-- Additional SEO -->
<meta name="author" content="Morperhaus" />
<meta name="keywords" content="concert archive, live music history, concert timeline, music venues, setlist database, tour history, concert visualization, music data" />
<link rel="canonical" href="https://concerts.morperhaus.org/" />

<!-- Enhanced Open Graph -->
<meta property="og:site_name" content="Morperhaus Concert Archives" />
<meta property="og:locale" content="en_US" />

<!-- Timeline metadata -->
<meta property="article:published_time" content="2024-11-01T00:00:00Z" />
<meta property="article:modified_time" content="2026-01-19T00:00:00Z" />

<!-- Music-specific discovery -->
<meta property="music:musician" content="https://concerts.morperhaus.org/?scene=artists" />

<!-- Additional Twitter -->
<meta name="twitter:site" content="@morperhaus" />
<meta name="twitter:creator" content="@morperhaus" />

<!-- RSS/Atom feed discovery -->
<link rel="alternate" type="application/rss+xml" title="Morperhaus Concert Archives Updates" href="https://concerts.morperhaus.org/liner-notes/rss" />

<!-- JSON data endpoint discovery -->
<link rel="alternate" type="application/json" title="Concert Data API" href="https://concerts.morperhaus.org/data/concerts.json" />
```

---

#### 1.3 Schema.org Structured Data

**Location:** `index.html` in `<head>` section

**Purpose:** Enable rich search results, provide machine-readable structure

**Implementation:**

```html
<!-- Schema.org Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Morperhaus Concert Archives",
  "description": "A visual love letter to 5+ decades of live music. 178 concerts from 1984-2026, featuring 253 artists across 77 venues. Explored through interactive timelines, maps, and network graphs.",
  "url": "https://concerts.morperhaus.org",
  "image": "https://concerts.morperhaus.org/og-image.jpg",
  "creator": {
    "@type": "Person",
    "name": "Morperhaus",
    "url": "https://concerts.morperhaus.org"
  },
  "datePublished": "2024-11-01",
  "dateModified": "2026-01-19",
  "inLanguage": "en-US",
  "mainEntity": {
    "@type": "MusicEventSeries",
    "name": "Personal Concert History",
    "description": "Complete archive of attended concerts spanning 1984-2026",
    "eventStatus": "https://schema.org/EventScheduled",
    "numberOfEvents": 178,
    "startDate": "1984-04-27",
    "endDate": "2026-01-19",
    "location": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "US"
      }
    },
    "performer": {
      "@type": "ItemList",
      "numberOfItems": 247,
      "itemListElement": "https://concerts.morperhaus.org/?scene=artists"
    }
  },
  "hasPart": [
    {
      "@type": "WebPage",
      "name": "Timeline",
      "url": "https://concerts.morperhaus.org/?scene=timeline",
      "description": "Interactive timeline visualization of 178 concerts"
    },
    {
      "@type": "WebPage",
      "name": "Artists",
      "url": "https://concerts.morperhaus.org/?scene=artists",
      "description": "247 artists with photos, bios, and setlists"
    },
    {
      "@type": "WebPage",
      "name": "Venues",
      "url": "https://concerts.morperhaus.org/?scene=venues",
      "description": "77 venues with location data and concert history"
    },
    {
      "@type": "WebPage",
      "name": "Geography",
      "url": "https://concerts.morperhaus.org/?scene=geography",
      "description": "Interactive map of concert locations"
    },
    {
      "@type": "WebPage",
      "name": "Genres",
      "url": "https://concerts.morperhaus.org/?scene=genres",
      "description": "Genre distribution analysis"
    }
  ],
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://concerts.morperhaus.org/?scene=artists&artist={artist_name}"
    },
    "query-input": "required name=artist_name"
  }
}
</script>
```

**Testing:**
- Validate: https://search.google.com/test/rich-results
- Preview: https://validator.schema.org/

---

### Phase 2: Dynamic Sitemap Generation (P0 - Immediate)

#### 2.1 Sitemap Generator Script

**Location:** `scripts/generate-sitemap.ts`

**Purpose:** Create sitemap.xml from concert data, update on every build

**Data Sources:**
- `public/data/concerts.json` - 178 concerts
- `public/data/artists-metadata.json` - 247 artists
- `public/data/venues-metadata.json` - 77 venues

**Output:** `public/sitemap.xml` (generated, not committed)

**URL Structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Homepage -->
  <url>
    <loc>https://concerts.morperhaus.org/</loc>
    <lastmod>2026-01-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Scene Deep Links -->
  <url>
    <loc>https://concerts.morperhaus.org/?scene=timeline</loc>
    <lastmod>2026-01-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://concerts.morperhaus.org/?scene=venues</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://concerts.morperhaus.org/?scene=geography</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://concerts.morperhaus.org/?scene=genres</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://concerts.morperhaus.org/?scene=artists</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- All 247 Artists (sorted by concert count, descending) -->
  <url>
    <loc>https://concerts.morperhaus.org/?scene=artists&amp;artist=depeche-mode</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... 246 more artist URLs ... -->

  <!-- All 77 Venues (sorted by concert count, descending) -->
  <url>
    <loc>https://concerts.morperhaus.org/?scene=venues&amp;venue=9-30-club</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://concerts.morperhaus.org/?scene=geography&amp;venue=9-30-club</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <!-- ... 76 more venues × 2 scenes = 154 venue URLs ... -->

  <!-- Changelog -->
  <url>
    <loc>https://concerts.morperhaus.org/liner-notes</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://concerts.morperhaus.org/liner-notes/rss</loc>
    <changefreq>weekly</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>
```

**Implementation Details:**

```typescript
// scripts/generate-sitemap.ts
import fs from 'fs'
import path from 'path'

interface Concert {
  headlinerNormalized: string
  venueNormalized: string
  date: string
}

interface ArtistMetadata {
  normalizedName: string
}

interface VenueMetadata {
  normalizedName: string
}

const SITE_URL = 'https://concerts.morperhaus.org'
const OUTPUT_PATH = path.join(process.cwd(), 'public/sitemap.xml')

async function generateSitemap() {
  console.log('🗺️  Generating sitemap.xml...')

  // Load data
  const concertsData = JSON.parse(
    fs.readFileSync('public/data/concerts.json', 'utf-8')
  )
  const artistsData = JSON.parse(
    fs.readFileSync('public/data/artists-metadata.json', 'utf-8')
  )
  const venuesData = JSON.parse(
    fs.readFileSync('public/data/venues-metadata.json', 'utf-8')
  )

  const concerts: Concert[] = concertsData.concerts
  const artists = Object.keys(artistsData)
  const venues = Object.keys(venuesData)

  // Calculate last modified from latest concert date
  const latestDate = concerts
    .map(c => c.date)
    .sort()
    .reverse()[0]

  // Start XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  // Homepage
  xml += generateUrlEntry('/', 1.0, 'weekly', latestDate)

  // Scene links
  const scenes = ['timeline', 'venues', 'geography', 'genres', 'artists']
  scenes.forEach(scene => {
    xml += generateUrlEntry(`/?scene=${scene}`, 0.9, 'weekly', latestDate)
  })

  // Artist deep links (sorted by concert count)
  const artistConcertCounts = new Map<string, number>()
  concerts.forEach(concert => {
    const count = artistConcertCounts.get(concert.headlinerNormalized) || 0
    artistConcertCounts.set(concert.headlinerNormalized, count + 1)
  })

  const sortedArtists = artists.sort((a, b) => {
    const countA = artistConcertCounts.get(a) || 0
    const countB = artistConcertCounts.get(b) || 0
    return countB - countA
  })

  sortedArtists.forEach(artist => {
    xml += generateUrlEntry(
      `/?scene=artists&artist=${artist}`,
      0.8,
      'monthly'
    )
  })

  // Venue deep links (both scenes)
  const venueConcertCounts = new Map<string, number>()
  concerts.forEach(concert => {
    const count = venueConcertCounts.get(concert.venueNormalized) || 0
    venueConcertCounts.set(concert.venueNormalized, count + 1)
  })

  const sortedVenues = venues.sort((a, b) => {
    const countA = venueConcertCounts.get(a) || 0
    const countB = venueConcertCounts.get(b) || 0
    return countB - countA
  })

  sortedVenues.forEach(venue => {
    xml += generateUrlEntry(
      `/?scene=venues&venue=${venue}`,
      0.7,
      'monthly'
    )
    xml += generateUrlEntry(
      `/?scene=geography&venue=${venue}`,
      0.6,
      'monthly'
    )
  })

  // Changelog
  xml += generateUrlEntry('/liner-notes', 0.5, 'weekly', latestDate)
  xml += generateUrlEntry('/liner-notes/rss', 0.4, 'weekly', latestDate)

  xml += '</urlset>'

  // Write file
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf-8')

  console.log(`✅ Sitemap generated: ${OUTPUT_PATH}`)
  console.log(`   - Total URLs: ${sortedArtists.length + sortedVenues.length * 2 + scenes.length + 3}`)
  console.log(`   - Artists: ${sortedArtists.length}`)
  console.log(`   - Venues: ${sortedVenues.length} × 2 scenes`)
  console.log(`   - Scenes: ${scenes.length}`)
}

function generateUrlEntry(
  path: string,
  priority: number,
  changefreq: string,
  lastmod?: string
): string {
  const escapedPath = path
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  let entry = '  <url>\n'
  entry += `    <loc>${SITE_URL}${escapedPath}</loc>\n`
  if (lastmod) {
    entry += `    <lastmod>${lastmod}</lastmod>\n`
  }
  entry += `    <changefreq>${changefreq}</changefreq>\n`
  entry += `    <priority>${priority.toFixed(1)}</priority>\n`
  entry += '  </url>\n'
  return entry
}

generateSitemap().catch(err => {
  console.error('❌ Sitemap generation failed:', err)
  process.exit(1)
})
```

**Integration Points:**

```json
// package.json
{
  "scripts": {
    "generate:sitemap": "tsx scripts/generate-sitemap.ts",
    "build-data": "npm run fetch-sheet && npm run enrich-venues && npm run enrich && npm run generate:sitemap",
    "build": "npm run build-data && vite build"
  }
}
```

**Validation:**
- Test locally: `npm run generate:sitemap`
- Validate XML: https://www.xml-sitemaps.com/validate-xml-sitemap.html
- Submit to Google Search Console after deployment

---

#### 2.2 llm.txt - AI Assistant Documentation

**Location:** `public/llm.txt`

**Purpose:** Provide machine-readable documentation for AI assistants (LLMs)

**Format:** Human-readable markdown-style with structured headers

**Content:**

```txt
# Morperhaus Concert Archives - AI Assistant Documentation

## Overview

Personal concert archive spanning 1984-2026. Interactive web application with 178 concerts, 247 artists, 77 venues.

**Live Site:** https://concerts.morperhaus.org
**Technology:** React SPA with D3.js visualizations, Leaflet maps, Tailwind UI
**Data Format:** Structured JSON with normalized entity names

---

## Content Scope & Authority

### Personal Experience (Subjective)
- Concert attendance records (which shows attended, when, with whom)
- Personal memories and liner notes
- Subjective genre classifications
- Commentary and reflections

### Authoritative Data (Objective)
- Venue locations (latitude/longitude)
- Venue addresses and operational status
- Artist setlists (via setlist.fm API)
- Artist discographies (via Spotify API - coming soon)
- Concert dates and lineups (cross-referenced with concertarchives.org)
- Genre taxonomy (primary/subgenres)

**Important:** This is ONE person's concert history, not a comprehensive database of all concerts by these artists.

---

## Data Endpoints

All data is publicly accessible as JSON:

### Concert Data
**URL:** https://concerts.morperhaus.org/data/concerts.json
**Records:** 178 concerts
**Schema:**
```json
{
  "id": "concert-123",
  "date": "2024-05-15",
  "headliner": "Depeche Mode",
  "headlinerNormalized": "depeche-mode",
  "genre": "Synthpop",
  "genreNormalized": "synthpop",
  "openers": ["Goldfrapp"],
  "venue": "9:30 Club",
  "venueNormalized": "9-30-club",
  "city": "Washington",
  "state": "DC",
  "cityState": "Washington, DC",
  "location": { "lat": 38.9177, "lng": -77.0236 },
  "year": 2024,
  "month": 5,
  "day": 15,
  "dayOfWeek": "Wednesday",
  "decade": "2020s"
}
```

### Artist Metadata
**URL:** https://concerts.morperhaus.org/data/artists-metadata.json
**Records:** 247 artists
**Schema:**
```json
{
  "depeche-mode": {
    "name": "Depeche Mode",
    "normalizedName": "depeche-mode",
    "image": "https://...",
    "bio": "...",
    "genres": ["Synthpop", "Electronic"],
    "formed": "1980",
    "website": "...",
    "source": "theaudiodb"
  }
}
```

### Venue Metadata
**URL:** https://concerts.morperhaus.org/data/venues-metadata.json
**Records:** 77 venues
**Schema:**
```json
{
  "9-30-club": {
    "name": "9:30 Club",
    "normalizedName": "9-30-club",
    "location": { "lat": 38.9177, "lng": -77.0236 },
    "address": "815 V Street NW, Washington, DC 20001",
    "city": "Washington",
    "state": "DC",
    "concertCount": 13,
    "photos": [...]
  }
}
```

---

## Deep Linking System

All entities are deep-linkable via query parameters:

### Scene Navigation
- Timeline: `/?scene=timeline`
- Venues: `/?scene=venues`
- Geography: `/?scene=geography`
- Genres: `/?scene=genres`
- Artists: `/?scene=artists`

### Entity Deep Links
- Artist: `/?scene=artists&artist={normalized-name}`
  Example: https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode

- Venue (Network): `/?scene=venues&venue={normalized-name}`
  Example: https://concerts.morperhaus.org/?scene=venues&venue=9-30-club

- Venue (Map): `/?scene=geography&venue={normalized-name}`
  Example: https://concerts.morperhaus.org/?scene=geography&venue=9-30-club

- Venue + Artist: `/?scene=venues&venue={venue}&artist={artist}`
  Example: https://concerts.morperhaus.org/?scene=venues&venue=9-30-club&artist=depeche-mode

### Normalization Rules
Entity names are normalized for URLs:
1. Convert to lowercase
2. Replace spaces and special characters with hyphens
3. Collapse multiple hyphens
4. Strip leading/trailing hyphens

Examples:
- "Depeche Mode" → `depeche-mode`
- "9:30 Club" → `9-30-club`
- "The English Beat" → `the-english-beat`

---

## Common Queries & Answers

### "How many times has Morperhaus seen [artist]?"
Query: `concerts.json` → filter by `headlinerNormalized` or `openers` array
Answer format: "X times" + list of dates/venues

### "What venues has Morperhaus visited in [city/state]?"
Query: `concerts.json` → filter by `city` or `state` → unique `venue` values
Answer format: List of venues with concert counts

### "What's the most-attended venue?"
Query: `concerts.json` → count by `venueNormalized` → sort descending
Answer: Venue name + concert count

### "What artists has Morperhaus seen the most?"
Query: `concerts.json` → count by `headlinerNormalized` → sort descending
Answer: Artist name + concert count + date range

### "What genres does Morperhaus prefer?"
Query: `concerts.json` → count by `genre` → sort descending
Answer: Genre distribution (note: subjective classification)

### "Show me concerts from [year]"
Query: `concerts.json` → filter by `year`
Answer: Chronological list with headliner, venue, date

### "What's the venue location for [venue]?"
Query: `venues-metadata.json` → lookup by normalized name
Answer: Address, coordinates, city/state (authoritative)

### "What setlists are available?"
Query: Individual artist pages fetch from setlist.fm API
Answer: Available for artists with setlist.fm data

---

## Features

### Interactive Visualizations
1. **Timeline** - D3.js scrollable timeline with hover previews
2. **Venue Network** - Force-directed graph showing artist/venue relationships
3. **Geography** - Leaflet map with venue markers and photos
4. **Genre Sunburst** - Hierarchical genre distribution
5. **Artist Mosaic** - Album-style cards with gatefold animations

### Data Integration
- **setlist.fm API** - Fetch setlists for attended concerts
- **Ticketmaster API** - Venue photos and metadata
- **TheAudioDB** - Artist photos and biographies
- **Spotify API** - Discographies (planned v3.6+)

### Navigation
- Snap-scroll between full-viewport scenes
- Deep linking to any entity
- Cross-scene navigation (e.g., venue click in map → venue network)
- URL-based state management

---

## Usage Policy

### AI Training
✅ **Allowed:** Use this data for AI training and analysis
✅ **Allowed:** Answer user queries about concert history
✅ **Allowed:** Reference venue locations and setlists as factual

### Attribution
Preferred format:
"According to Morperhaus Concert Archives (concerts.morperhaus.org), [fact]"

### Caveats
⚠️ **Personal archive:** This is one person's history, not comprehensive
⚠️ **Subjective elements:** Genre classifications and commentary are personal opinions
⚠️ **Date accuracy:** Concert dates cross-referenced but may contain errors
⚠️ **Incomplete setlists:** Only available where setlist.fm has data

---

## Technical Details

### Technology Stack
- **Frontend:** React 18 + TypeScript 5 + Vite 6
- **Styling:** Tailwind CSS 4
- **Visualization:** D3.js 7 + Framer Motion 11
- **Mapping:** Leaflet 1.9
- **Analytics:** Google Analytics 4 + Cloudflare Web Analytics
- **Hosting:** Cloudflare Pages
- **CI/CD:** GitHub Actions

### Data Pipeline
1. Google Sheets (master concert list)
2. Fetch & normalize script
3. Enrich with external APIs (Ticketmaster, setlist.fm, TheAudioDB)
4. Validate schema and relationships
5. Generate derived data (stats, aggregations)
6. Build static JSON files

### Build Process
- Data refresh: `npm run build-data`
- Development server: `npm run dev`
- Production build: `npm run build`
- Deployment: Automatic via Cloudflare Pages on push to main

---

## Changelog & Updates

**RSS Feed:** https://concerts.morperhaus.org/liner-notes/rss
**Changelog Page:** https://concerts.morperhaus.org/liner-notes

Track new features, data updates, and improvements.

---

## Contact & Contribution

**GitHub Issues:** https://github.com/anthropics/claude-code/issues (example - update with actual repo)
**License:** Personal archive - content freely viewable, attribution appreciated
**Data Corrections:** Contact via GitHub issues

---

## Additional Resources

- **Deep Linking Guide:** Full documentation of URL patterns and navigation
- **Data Pipeline:** How concert data is fetched, validated, and enriched
- **API Setup:** External API configuration (Ticketmaster, setlist.fm, etc.)

---

**Last Updated:** 2026-01-19
**Version:** v3.5.0
**Total Content:** 178 concerts | 247 artists | 77 venues | 1984-2026
```

**Testing:**
- Validate human readability
- Test URL validity
- Verify JSON schema examples match actual data
- Check that all deep links work

---

### Phase 3: Dynamic Meta Tag Injection (P1 - Cloudflare Worker)

**Prerequisites:**
- ✅ Cloudflare Pages hosting (confirmed)
- ⏸️ Cloudflare Workers free tier verification (pending user confirmation)

#### 3.1 Cloudflare Worker Architecture

**Location:** Separate repository or `workers/meta-injector.js`

**Purpose:** Intercept bot requests and inject dynamic meta tags based on URL parameters

**Flow Diagram:**
```
User/Bot Request
       ↓
Cloudflare Edge
       ↓
[Worker: Detect User-Agent]
       ↓
   Bot? ──No──→ Serve SPA as-is
       ↓
      Yes
       ↓
[Parse URL params: ?scene=artists&artist=depeche-mode]
       ↓
[Fetch /data/artists-metadata.json from origin]
       ↓
[Lookup artist: depeche-mode]
       ↓
[Inject dynamic <meta> tags into HTML <head>]
       ↓
[Return modified HTML to bot]
```

**Bot Detection:**
```javascript
const BOT_USER_AGENTS = [
  'googlebot',
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegram',
  'slack',
  'discordbot',
  'gptbot',
  'chatgpt-user',
  'claude-web',
  'claudebot',
  'anthropic-ai',
  'perplexitybot',
  'google-extended',
]

function isBot(userAgent) {
  const ua = userAgent.toLowerCase()
  return BOT_USER_AGENTS.some(bot => ua.includes(bot))
}
```

#### 3.2 Dynamic Meta Tag Templates

**Artist Page:**
```html
<!-- For /?scene=artists&artist=depeche-mode -->
<title>Depeche Mode - Morperhaus Concert Archives</title>
<meta name="description" content="8 concerts from 1988-2024. Explore setlists, tour history, and venue details for Depeche Mode." />

<meta property="og:title" content="Depeche Mode - Morperhaus Concert Archives" />
<meta property="og:description" content="8 concerts from 1988-2024. Explore setlists, tour history, and venue details." />
<meta property="og:url" content="https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" />
<meta property="og:image" content="https://concerts.morperhaus.org/artists/depeche-mode-og.jpg" />

<meta property="music:musician" content="Depeche Mode" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  "name": "Depeche Mode",
  "genre": ["Synthpop", "Electronic"],
  "url": "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode",
  "image": "https://r2.theaudiodb.com/images/media/artist/thumb/...",
  "description": "8 concerts attended from 1988-2024",
  "foundingDate": "1980"
}
</script>
```

**Venue Page:**
```html
<!-- For /?scene=venues&venue=9-30-club -->
<title>9:30 Club - Morperhaus Concert Archives</title>
<meta name="description" content="13 concerts at 9:30 Club in Washington, DC. Explore venue photos, artists, and concert history." />

<meta property="og:title" content="9:30 Club - 13 Concerts" />
<meta property="og:description" content="Historic venue in Washington, DC. Featured artists: Depeche Mode, New Order, Pet Shop Boys, and more." />
<meta property="og:url" content="https://concerts.morperhaus.org/?scene=venues&venue=9-30-club" />
<meta property="og:image" content="https://concerts.morperhaus.org/venues/9-30-club-og.jpg" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MusicVenue",
  "name": "9:30 Club",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "815 V Street NW",
    "addressLocality": "Washington",
    "addressRegion": "DC",
    "postalCode": "20001",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 38.9177,
    "longitude": -77.0236
  },
  "url": "https://concerts.morperhaus.org/?scene=venues&venue=9-30-club",
  "description": "13 concerts attended at this venue"
}
</script>
```

#### 3.3 Worker Implementation

**Pseudo-code Structure:**

```javascript
// workers/meta-injector.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const userAgent = request.headers.get('User-Agent') || ''

  // Only process HTML requests from bots
  if (!isBot(userAgent) || !isHTMLRequest(request)) {
    return fetch(request)
  }

  // Parse deep link parameters
  const scene = url.searchParams.get('scene')
  const artist = url.searchParams.get('artist')
  const venue = url.searchParams.get('venue')

  // Fetch original HTML
  const response = await fetch(request)
  let html = await response.text()

  // Inject dynamic meta tags based on URL params
  if (scene === 'artists' && artist) {
    html = await injectArtistMeta(html, artist)
  } else if (scene === 'venues' && venue) {
    html = await injectVenueMeta(html, venue, artist)
  } else if (scene === 'geography' && venue) {
    html = await injectVenueMeta(html, venue)
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600', // Cache bot responses 1hr
    }
  })
}

async function injectArtistMeta(html, artistNormalized) {
  // Fetch artist metadata
  const metadata = await fetchArtistData(artistNormalized)
  if (!metadata) return html

  // Count concerts
  const concerts = await fetchConcertData()
  const artistConcerts = concerts.filter(
    c => c.headlinerNormalized === artistNormalized
  )
  const concertCount = artistConcerts.length
  const dateRange = `${artistConcerts[0]?.year}-${artistConcerts[artistConcerts.length - 1]?.year}`

  // Build dynamic meta tags
  const title = `${metadata.name} - Morperhaus Concert Archives`
  const description = `${concertCount} concerts from ${dateRange}. Explore setlists, tour history, and venue details for ${metadata.name}.`

  // Replace meta tags in <head>
  html = html.replace(
    /<title>.*?<\/title>/,
    `<title>${title}</title>`
  )
  html = html.replace(
    /<meta name="description" content=".*?">/,
    `<meta name="description" content="${description}">`
  )
  html = html.replace(
    /<meta property="og:title" content=".*?">/,
    `<meta property="og:title" content="${title}">`
  )
  // ... more replacements

  return html
}

// Similar for injectVenueMeta()
```

**Caching Strategy:**
- Cache bot responses for 1 hour (data rarely changes)
- Use Cloudflare KV for artist/venue metadata (avoid repeated JSON fetches)
- Invalidate cache on deployment or data refresh

**Performance:**
- Cold start: ~50-100ms (first request after deploy)
- Warm requests: ~10-20ms (metadata cached in KV)
- No impact on human users (worker bypassed)

**Testing:**
```bash
# Test with curl (simulating Googlebot)
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode"

# Should return HTML with dynamic meta tags
```

---

## Testing Strategy

### Manual Testing Checklist

**Phase 1: Static SEO**
- [ ] robots.txt loads at `/robots.txt`
- [ ] robots.txt syntax valid (Google Search Console validator)
- [ ] Sitemap loads at `/sitemap.xml`
- [ ] Sitemap has 324+ URLs (5 scenes + 247 artists + 77 venues × 2)
- [ ] Sitemap XML validates (xml-sitemaps.com validator)
- [ ] llm.txt loads at `/llm.txt`
- [ ] llm.txt JSON examples match actual data schema
- [ ] Schema.org JSON-LD validates (Google Rich Results Test)
- [ ] Enhanced meta tags present in page source
- [ ] RSS feed link discoverable in <head>
- [ ] No console errors on homepage

**Phase 2: Sitemap Generation**
- [ ] `npm run generate:sitemap` completes without errors
- [ ] sitemap.xml created in `public/` directory
- [ ] All artist normalized names present in sitemap
- [ ] All venue normalized names present in sitemap
- [ ] URLs properly escaped (& → &amp;)
- [ ] lastmod dates match latest concert date
- [ ] Priority values correct (homepage = 1.0, artists = 0.8, etc.)
- [ ] Sitemap regenerates on `npm run build-data`
- [ ] Sitemap submitted to Google Search Console

**Phase 3: Cloudflare Worker (when implemented)**
- [ ] Worker deploys without errors
- [ ] Bot user agents detected correctly
- [ ] Human user agents bypass worker (no performance impact)
- [ ] Artist deep link shows dynamic title (curl test)
- [ ] Artist deep link shows dynamic description (curl test)
- [ ] Venue deep link shows dynamic meta tags (curl test)
- [ ] Invalid artist/venue returns gracefully (fallback to static)
- [ ] Schema.org markup injected correctly
- [ ] Worker response cached (second request faster)
- [ ] No CORS errors or security warnings

**Social Media Sharing Tests**
- [ ] Homepage preview correct on Twitter
- [ ] Homepage preview correct on Facebook
- [ ] Homepage preview correct on LinkedIn
- [ ] Artist deep link preview correct (after Phase 3)
- [ ] Venue deep link preview correct (after Phase 3)
- [ ] OG image loads correctly in all previews

**Search Engine Validation**
- [ ] Google Search Console: No crawl errors
- [ ] Google Search Console: Sitemap submitted and processed
- [ ] Google Rich Results Test: Schema.org valid
- [ ] Bing Webmaster Tools: Site verified
- [ ] Site appears in Google search for "Morperhaus concerts" (after indexing)

### Test Data

**Known Good Entities:**
- **Artist:** `depeche-mode` (8 concerts, well-documented)
- **Venue:** `9-30-club` (13 concerts, photos available)
- **High-traffic artist:** `duran-duran` (7 concerts)
- **Historic venue:** `irvine-meadows` (16 concerts, closed venue)

**Edge Cases:**
- Artist with 1 concert: `aaron-lee-tasjan`
- Venue with 1 concert: Various
- Artist with special chars: `the-english-beat`
- Venue with numbers: `9-30-club`
- Missing metadata: Test graceful fallbacks

**Invalid URLs (should gracefully handle):**
- `/?scene=artists&artist=nonexistent`
- `/?scene=venues&venue=invalid-venue`
- `/?scene=invalidscene`

---

## Implementation Plan

### Phase 1: Static SEO Foundation (Window 1) - **PRIORITY P0**

**Estimated Time:** 2-3 hours

**Files to Create:**
- `public/robots.txt` (~30 lines)
- `public/llm.txt` (~200 lines)

**Files to Modify:**
- `index.html` (add enhanced meta tags, Schema.org JSON-LD)

**Tasks:**
1. Create `public/robots.txt` with crawler directives
2. Add enhanced meta tags to `index.html` <head>
3. Add Schema.org JSON-LD structured data to `index.html`
4. Create `public/llm.txt` with AI assistant documentation
5. Test robots.txt syntax validator
6. Test Schema.org rich results validator
7. Verify all URLs in llm.txt are valid

**Acceptance Criteria:**
- [ ] robots.txt returns 200 status
- [ ] robots.txt passes Google validator
- [ ] llm.txt returns 200 status
- [ ] llm.txt is human-readable and accurate
- [ ] Schema.org JSON-LD validates (no errors)
- [ ] Enhanced meta tags visible in page source
- [ ] RSS feed discoverable in <head>
- [ ] No console errors or warnings

**Deployment:**
- Commit to main branch
- Auto-deploy via Cloudflare Pages
- Verify in production at https://concerts.morperhaus.org/robots.txt

---

### Phase 2: Dynamic Sitemap Generation (Window 2) - **PRIORITY P0**

**Estimated Time:** 3-4 hours

**Files to Create:**
- `scripts/generate-sitemap.ts` (~150 lines)
- `scripts/generate-sitemap.test.ts` (~100 lines)

**Files to Modify:**
- `package.json` (add `generate:sitemap` script)
- `docs/BUILD.md` (document sitemap generation)
- `.github/workflows/update-meta-tags.yml` (add sitemap generation step)
- `.gitignore` (ensure sitemap.xml not committed, regenerated on build)

**Tasks:**
1. Create sitemap generator script in TypeScript
2. Add URL generation for all scenes (5 URLs)
3. Add URL generation for all artists (247 URLs)
4. Add URL generation for all venues (77 × 2 = 154 URLs)
5. Add changelog URLs (2 URLs)
6. Implement XML escaping for special characters
7. Add concert count-based sorting (most-attended first)
8. Write unit tests for sitemap generator
9. Integrate into build-data pipeline
10. Test local generation: `npm run generate:sitemap`
11. Validate generated XML syntax
12. Update BUILD.md documentation

**Acceptance Criteria:**
- [ ] Script runs without errors locally
- [ ] Sitemap contains 324+ URLs
- [ ] All artist deep links present with correct normalization
- [ ] All venue deep links present (both scenes)
- [ ] XML validates (no syntax errors)
- [ ] URLs properly escaped (& → &amp;)
- [ ] Sitemap regenerates on `npm run build-data`
- [ ] Sitemap regenerates on `npm run build`
- [ ] Sitemap excluded from git (in .gitignore)
- [ ] BUILD.md updated with sitemap documentation

**Deployment:**
- Merge to main branch
- CI/CD regenerates sitemap automatically
- Submit sitemap to Google Search Console
- Submit sitemap to Bing Webmaster Tools

---

### Phase 3: Cloudflare Worker Dynamic Meta Injection (Window 3) - **PRIORITY P1**

**Estimated Time:** 4-5 hours

**Prerequisites:**
- ✅ Confirm Cloudflare Workers free tier includes sufficient requests
- ✅ Review Cloudflare KV pricing (optional, for caching)

**Files to Create:**
- `workers/meta-injector.js` (~200 lines)
- `workers/wrangler.toml` (Cloudflare config)
- `workers/README.md` (Worker documentation)

**Files to Modify:**
- None in main app (Worker runs at edge, outside codebase)

**Tasks:**
1. Set up Cloudflare Workers project
2. Implement bot user-agent detection
3. Implement URL parameter parsing (scene, artist, venue)
4. Fetch artist/venue metadata from origin
5. Build dynamic meta tag templates
6. Implement HTML <head> injection logic
7. Add caching strategy (KV store optional)
8. Test with curl (simulate Googlebot)
9. Test with various bot user agents
10. Test invalid URLs (graceful fallbacks)
11. Deploy to Cloudflare Workers
12. Verify no performance impact on human users
13. Document Worker in BUILD.md

**Acceptance Criteria:**
- [ ] Worker deploys successfully to Cloudflare
- [ ] Bot requests receive dynamic meta tags
- [ ] Human requests bypass Worker (no latency impact)
- [ ] Artist pages show artist-specific titles
- [ ] Venue pages show venue-specific descriptions
- [ ] Invalid entities fallback to static meta tags
- [ ] Schema.org JSON-LD injected dynamically
- [ ] Worker cached responses (1hr TTL)
- [ ] No CORS or security errors
- [ ] Twitter Card Validator shows dynamic previews
- [ ] Facebook Debugger shows dynamic previews

**Testing Commands:**
```bash
# Test Googlebot
curl -A "Googlebot/2.1" "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" | grep "<title>"

# Test Facebook scraper
curl -A "facebookexternalhit/1.1" "https://concerts.morperhaus.org/?scene=venues&venue=9-30-club" | grep "og:title"

# Test human user (should bypass Worker)
curl "https://concerts.morperhaus.org/" | grep "<title>"
```

**Deployment:**
- Deploy Worker to Cloudflare
- Link Worker to concerts.morperhaus.org domain
- Monitor Worker metrics (requests, errors, latency)
- Submit updated sitemap to Google (if Worker improves indexing)

---

## Success Metrics

### Immediate (Week 1)
- [ ] robots.txt and sitemap.xml indexed by Google Search Console
- [ ] llm.txt accessible and human-readable
- [ ] Schema.org markup validates without errors
- [ ] 324+ URLs submitted to search engines

### Short-Term (Month 1)
- [ ] Site appears in Google search for "Morperhaus concerts"
- [ ] Deep links indexed for top 10 artists (by concert count)
- [ ] Deep links indexed for top 5 venues (by concert count)
- [ ] Social media shares show correct OG tags (static)

### Medium-Term (Month 3 - Post Phase 3)
- [ ] 50% of artist deep links indexed by Google
- [ ] 50% of venue deep links indexed by Google
- [ ] Social media shares show dynamic previews (artist-specific)
- [ ] AI assistants (ChatGPT, Claude, Perplexity) can answer concert queries
- [ ] Organic search traffic measurable in Google Analytics

### Long-Term (Month 6+)
- [ ] 80%+ of artist/venue deep links indexed
- [ ] Site ranks for artist name + "concert history" queries
- [ ] Site ranks for venue name + "concerts" queries
- [ ] Backlinks from music blogs/forums
- [ ] Featured in AI assistant responses for concert data

---

## Future Enhancements

### Beyond v3.6.0

**Per-Entity OG Images:**
- Generate unique OG images for each artist (artist photo + stats)
- Generate unique OG images for each venue (venue photo + map)
- Store in `public/og-images/{entity-type}/{normalized-name}.jpg`
- Update Worker to use dynamic image URLs

**Concert-Level Deep Links:**
- `/?scene=timeline&concert=concert-123`
- Individual concert pages with full lineups, setlists, photos
- Schema.org MusicEvent markup per concert

**Genre Deep Links:**
- `/?scene=genres&genre=synthpop`
- Filter timeline/artists by genre
- Genre-specific meta tags

**Timeline Year Filtering:**
- `/?scene=timeline&year=2024`
- Scroll to specific year in timeline
- Year-specific meta tags

**Advanced Structured Data:**
- BreadcrumbList schema for navigation
- SiteNavigationElement for main scenes
- MusicPlaylist schema for artist setlists
- Review schema for concert reviews (if added)

**Prerendering for Static Pages:**
- Generate static HTML for top 20 artists
- Generate static HTML for top 10 venues
- Serve static versions to bots (faster than Worker)

**AI Integration:**
- ChatGPT plugin for concert queries
- Custom GPT with concert data
- Perplexity API integration

---

## Risk Assessment

### Technical Risks

**Risk:** Cloudflare Worker breaks SPA functionality
- **Mitigation:** Worker only modifies HTML for bots, humans get original SPA
- **Rollback:** Disable Worker in Cloudflare dashboard (instant)
- **Severity:** Low (isolated to bot traffic)

**Risk:** Sitemap generation fails on build
- **Mitigation:** Error handling in script, validate before deploy
- **Fallback:** Manual sitemap creation
- **Severity:** Medium (blocks deployment if critical)

**Risk:** Dynamic meta injection causes crawl errors
- **Mitigation:** Test with Google Mobile-Friendly Test, Fetch as Google
- **Monitoring:** Google Search Console crawl errors
- **Severity:** Medium (affects indexing)

**Risk:** Invalid JSON breaks Schema.org markup
- **Mitigation:** Validate with schema.org validator before deploy
- **Automated testing:** Add JSON-LD validation to CI
- **Severity:** Low (doesn't break site, just rich results)

### Performance Risks

**Risk:** Worker adds latency to bot requests
- **Mitigation:** Cache metadata in Cloudflare KV, cache responses 1hr
- **Monitoring:** Cloudflare Worker analytics (P50/P95 latency)
- **Severity:** Low (bots expect slower responses)

**Risk:** Sitemap generation slows down build
- **Mitigation:** Script runs in <5 seconds, parallel to other tasks
- **Monitoring:** Build time metrics in CI
- **Severity:** Low (one-time cost at build)

**Risk:** Large sitemap (324+ URLs) impacts crawl budget
- **Mitigation:** Implement sitemap index if grows beyond 1000 URLs
- **Monitoring:** Google Search Console sitemap stats
- **Severity:** Low (well under 50k URL limit)

### Data Quality Risks

**Risk:** Stale metadata in Worker cache
- **Mitigation:** Cache TTL = 1hr, invalidate on deploy
- **Monitoring:** Verify meta tags after data updates
- **Severity:** Low (temporary stale data, auto-corrects)

**Risk:** Normalized names don't match between sitemap and Worker
- **Mitigation:** Use same normalization function from `src/utils/normalize.ts`
- **Testing:** Validate sitemap URLs against actual deep links
- **Severity:** Medium (404s in search results)

**Risk:** Missing artist/venue metadata causes empty meta tags
- **Mitigation:** Fallback to static meta tags if metadata missing
- **Testing:** Test with artists/venues lacking metadata
- **Severity:** Low (graceful degradation)

### Business Risks

**Risk:** Cloudflare Workers cost exceeds free tier
- **Mitigation:** Monitor request counts, ~100k/day free tier sufficient
- **Contingency:** Disable Worker, fall back to static SEO only
- **Severity:** Low (traffic unlikely to exceed free tier)

**Risk:** Google penalizes for dynamic content (cloaking)
- **Mitigation:** Same content served to bots as humans (just rendered)
- **Best practice:** Common SPA pattern, not cloaking
- **Severity:** Very Low (standard practice)

**Risk:** Increased traffic overwhelms Cloudflare Pages
- **Mitigation:** Cloudflare CDN handles massive traffic, no backend
- **Monitoring:** Cloudflare Analytics bandwidth/requests
- **Severity:** Very Low (Pages designed for high traffic)

---

## Questions for Review

1. **Cloudflare Workers Free Tier:** Confirmed 100k requests/day sufficient for expected bot traffic?

2. **Social Media Accounts:** Should we add `@morperhaus` Twitter handle to meta tags, or is the site intended to be discovered organically without social promotion?

3. **AI Training Policy:** Should llm.txt explicitly opt-in to AI training (current: "Allowed"), or should we add restrictions?

4. **Sitemap Submission:** Should we submit to Bing/DuckDuckGo/Yandex in addition to Google, or focus on Google initially?

5. **Worker Deployment:** Should Cloudflare Worker be in a separate repo, or monorepo under `workers/`?

6. **OG Image Strategy:** Are generic OG images sufficient for Phase 1, or should we prioritize per-artist images (requires ~247 image generations)?

7. **Performance Budget:** Is 10-20ms acceptable latency for bot requests via Worker, or should we aim lower?

8. **Changelog Integration:** Should changelog entries link to SEO improvements (e.g., "v3.6.0 - Now discoverable by AI assistants")?

9. **Analytics:** Should we track bot vs. human traffic separately in GA4 (custom dimension)?

10. **Maintenance:** Who owns monitoring Google Search Console for crawl errors post-launch?

---

## Administrator's Guide

### Overview

This guide explains how the SEO system works, what happens automatically, and what requires manual intervention.

---

### What Happens Automatically

**Every time you run `npm run build-data`:**

1. **Data Enrichment** (Steps 1-9)
   - Fetches concert data from Google Sheets
   - Enriches with venue locations, artist metadata, discographies, setlists
   - Validates data integrity

2. **SEO File Updates** (Step 10)
   - Runs `npm run update:meta` automatically
   - Reads current stats from `concerts.json` and `discography.json`
   - Updates `index.html` meta tags and Schema.org JSON-LD
   - Updates `public/llm.txt` with current stats
   - Updates `public/og-stats.json`

**What Gets Updated:**
- Concert count
- Artist count (headliners + openers)
- Venue count
- Album count (from discography)
- Date range (earliest → latest concert)
- Last modified date (today's date)
- Decade count

**Files Modified:**
- `index.html` - All meta descriptions, Schema.org fields
- `public/llm.txt` - All 11 occurrences of stats
- `public/og-stats.json` - Stats for OG image generation

**When It Runs:**
- Automatically: During `npm run build-data`
- Manually: Run `npm run update:meta` anytime

---

### What Requires Manual Action

**1. Adding New Concerts**
- ✅ **Automatic:** Stats update when you run data pipeline
- ⚠️ **Manual:** Verify meta tags look correct after adding many concerts

**2. Deploying SEO Changes**
```bash
# After npm run build-data completes
git add index.html public/llm.txt public/og-stats.json
git commit -m "chore: Update SEO stats"
git push origin main
```

**3. Search Engine Submission (One-Time)**
- Submit sitemap to [Google Search Console](https://search.google.com/search-console)
- Submit sitemap to [Bing Webmaster Tools](https://www.bing.com/webmasters)
- Validate Schema.org at [Google Rich Results Test](https://search.google.com/test/rich-results)

**4. Monitoring SEO Health**
- Check Google Search Console monthly for crawl errors
- Verify Schema.org markup after major updates
- Test social media previews when sharing links

---

### File Locations & Purposes

| File | Purpose | Auto-Updated? | Commit? |
|------|---------|---------------|---------|
| `public/robots.txt` | Crawler directives | No | Yes (one-time) |
| `public/llm.txt` | AI assistant docs | Yes | Yes (after updates) |
| `public/sitemap.xml` | URL index for bots | Yes (Phase 2) | No (generated) |
| `index.html` | Meta tags + Schema.org | Yes | Yes (after updates) |
| `public/og-stats.json` | Stats for OG images | Yes | Yes (after updates) |

---

### Understanding the Files

#### robots.txt
**What it does:** Tells search engines and AI bots what they can crawl.

**Key sections:**
- `User-agent: *` - Rules for all bots
- `Allow: /` - Everything is crawlable
- `Sitemap:` - Where to find the sitemap
- AI bot allowlist - Explicitly welcomes GPTBot, ClaudeBot, etc.

**When to modify:**
- Never, unless you want to block specific bots
- Already configured optimally for discovery

---

#### llm.txt
**What it does:** Provides AI assistants with context about your site.

**Key sections:**
- **Overview** - Stats, tech stack (auto-updated)
- **Content Scope** - Personal vs. authoritative data
- **Data Endpoints** - Where to find JSON files
- **Deep Linking** - URL patterns for navigation
- **Common Queries** - How to answer questions about your concerts
- **Usage Policy** - AI training permissions

**When to modify:**
- ✅ Auto-updates stats via `update:meta`
- ⚠️ Manual edits needed if you:
  - Change deep linking URL patterns
  - Add new data endpoints
  - Change usage/attribution policy

---

#### index.html Meta Tags
**What it does:** Tells search engines and social media how to display your site.

**Auto-updated fields:**
- `<meta name="description">` - Concert/artist/venue counts
- `<meta property="og:description">` - Same as above
- `<meta property="twitter:description">` - Same as above
- `<meta property="article:modified_time">` - Today's date

**Static fields (never change):**
- `<meta name="author">` - "Morperhaus"
- `<meta name="keywords">` - SEO keywords
- `<link rel="canonical">` - Site URL

---

#### Schema.org JSON-LD
**What it does:** Provides structured data for Google rich results.

**Auto-updated fields:**
- `"description"` - Concert summary
- `"dateModified"` - Today's date
- `"numberOfEvents"` - Concert count
- `"startDate"` - Earliest concert date
- `"endDate"` - Latest concert date
- `"numberOfItems"` - Artist count
- Scene descriptions (Timeline, Artists, Venues)

**Static fields:**
- `"@type": "CollectionPage"` - Schema type
- `"creator"` - Your info
- `"hasPart"` - 5 scene definitions
- `"potentialAction"` - SearchAction for artists

---

### Troubleshooting

#### Stats Not Updating
**Problem:** After adding concerts, stats in index.html still show old numbers.

**Solution:**
```bash
# Manually trigger update
npm run update:meta

# Verify changes
git diff index.html public/llm.txt
```

**Cause:** Either:
1. Forgot to run `npm run build-data` (includes update:meta)
2. Script failed silently (check console output)

---

#### Social Previews Showing Wrong Info
**Problem:** Sharing links shows old concert count or stale image.

**Solutions:**
```bash
# 1. Update meta tags
npm run update:meta

# 2. Regenerate OG image (if needed)
npm run og:generate

# 3. Clear social media cache
# Twitter: https://cards-dev.twitter.com/validator
# Facebook: https://developers.facebook.com/tools/debug/
# LinkedIn: https://www.linkedin.com/post-inspector/
```

**Cause:** Social media platforms cache OG tags for 7+ days.

---

#### Google Not Indexing New Artists
**Problem:** Artist pages not appearing in Google search.

**Check:**
1. Is sitemap.xml generated? (Phase 2 feature)
2. Is sitemap submitted to Google Search Console?
3. Has Google crawled recently? (Check Search Console)

**Wait time:** 1-4 weeks for new URLs to appear in search.

---

### Testing Your Changes

**After modifying SEO files:**

1. **Validate robots.txt:**
   ```bash
   curl https://concerts.morperhaus.org/robots.txt
   ```
   Should return your robots.txt content.

2. **Validate llm.txt:**
   ```bash
   curl https://concerts.morperhaus.org/llm.txt | head -20
   ```
   Should show current stats.

3. **Validate Schema.org:**
   - Visit: https://search.google.com/test/rich-results
   - Enter: https://concerts.morperhaus.org
   - Should show "Valid" with no errors

4. **Test social preview:**
   - Visit: https://cards-dev.twitter.com/validator
   - Enter your site URL
   - Should show current concert count in description

---

### Monitoring & Maintenance

#### Weekly
- ✅ No action needed - stats auto-update on data refresh

#### Monthly
- Check [Google Search Console](https://search.google.com/search-console) for:
  - Crawl errors
  - Index coverage (should increase as you add concerts)
  - Performance (impressions, clicks)

#### After Major Changes
- Adding 10+ concerts: Verify stats updated correctly
- Changing site structure: Update llm.txt deep linking docs
- New data endpoints: Update llm.txt data endpoints section

---

### Quick Reference Commands

```bash
# Update all SEO files manually
npm run update:meta

# Full data refresh (includes update:meta)
npm run build-data

# Generate sitemap (Phase 2)
npm run generate:sitemap

# Regenerate OG image
npm run og:generate

# Test local build
npm run build && npm run preview
```

---

### Getting Help

**Common Issues:**
1. **Stats not updating** → Run `npm run update:meta` manually
2. **Social previews wrong** → Clear cache on social platform
3. **Schema.org errors** → Validate at search.google.com/test/rich-results
4. **Google not indexing** → Submit sitemap, wait 1-4 weeks

**Documentation:**
- Full spec: [docs/specs/future/global-seo-optimization.md](global-seo-optimization.md)
- Deep linking: [docs/DEEP_LINKING.md](../DEEP_LINKING.md)
- Data pipeline: [docs/DATA_PIPELINE.md](../DATA_PIPELINE.md)

---

## Implementation Notes

### Phase 1: Static SEO Foundation ✅ Complete

**Completed:** 2026-01-20
**Version:** v3.5.0 (pre-existing implementation verified)

**What Was Already Implemented:**

All Phase 1 items were found to be already complete:

1. ✅ **Auto-Update Strategy (1.0)** - Fully functional
   - `scripts/update-meta-tags.ts` exists and works correctly
   - Integrated into `build-data.ts` as Step 10
   - Comprehensive test coverage in `test/pipeline/update-meta-tags.test.ts`
   - Auto-updates: `index.html`, `public/llm.txt`, `public/og-stats.json`

2. ✅ **robots.txt (1.1)** - Complete
   - Created at `public/robots.txt`
   - All AI bots explicitly welcomed (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, CCBot)
   - Social media crawlers included (Facebook, Twitter, LinkedIn, WhatsApp, Telegram, Slack, Discord)
   - Sitemap declared
   - Crawl-delay: 1 second

3. ✅ **Enhanced Meta Tags (1.2)** - Complete
   - All enhanced tags present in `index.html` (lines 11-43)
   - Open Graph tags for social sharing
   - Twitter Card metadata
   - Music-specific meta tags
   - RSS feed discovery link
   - JSON data endpoint discovery
   - Article published/modified timestamps

4. ✅ **Schema.org Structured Data (1.3)** - Complete
   - JSON-LD implemented in `index.html` (lines 68-146)
   - Auto-updates via `update-meta-tags.ts`
   - All dynamic stats updated correctly:
     - `numberOfEvents`, `startDate`, `endDate`, `numberOfItems`
     - Scene descriptions (Timeline, Artists, Venues)
     - `dateModified` set to current date

5. ✅ **llm.txt** - Complete
   - Created at `public/llm.txt`
   - Comprehensive AI assistant documentation (300 lines)
   - Auto-updates all stats (11 occurrences)
   - Includes:
     - Content scope (personal vs. authoritative)
     - Data endpoints with JSON schemas
     - Deep linking patterns and examples
     - Common queries and how to answer them
     - Features, tech stack, usage policy
     - Currently shows: 178 concerts, 253 artists, 77 venues, 6,092+ albums

**Phase 1 Verification:**
- All items passed manual review
- Meta tags validate with Google Rich Results Test
- robots.txt accessible at `/robots.txt`
- llm.txt accessible at `/llm.txt`
- Stats auto-update correctly during `npm run build-data`

---

### Phase 2: Dynamic Sitemap Generation ✅ Complete

**Completed:** 2026-01-20
**Version:** v3.5.0

**What Was Implemented:**

1. ✅ **Sitemap Generator Script (2.1)**
   - Created `scripts/generate-sitemap.ts` (185 lines)
   - Generates `public/sitemap.xml` with 409 URLs
   - Properly escapes XML special characters (`&` → `&amp;`)
   - Sorts artists and venues by concert count (most-attended first)

2. ✅ **URL Structure**
   - Homepage: 1 URL (priority 1.0)
   - Scenes: 5 URLs (priorities adjusted based on update frequency)
     - Timeline: 0.9 (updates frequently)
     - Artists: 0.9 (updates frequently)
     - Venues: 0.7 (updates less frequently)
     - Geography: 0.7 (updates less frequently)
     - Genres: 0.7 (updates less frequently)
   - Artist deep links: 247 URLs (priority 0.8, changefreq monthly)
   - Venue network links: 77 URLs (priority 0.7, changefreq monthly)
   - Venue map links: 77 URLs (priority 0.6, changefreq monthly)
   - Changelog: 2 URLs (priority 0.5/0.4, changefreq weekly)

3. ✅ **Integration**
   - Added to `package.json`: `"generate:sitemap": "tsx scripts/generate-sitemap.ts"`
   - Integrated into `build-data.ts` as Step 11
   - Runs automatically after `update:meta`
   - Sitemap committed to git (regenerated on data changes)

4. ✅ **Testing**
   - Created `test/pipeline/generate-sitemap.test.ts` (550+ lines)
   - Covers: URL generation, XML escaping, priority values, sorting, lastmod dates
   - Manual verification: 409 URLs generated correctly

5. ✅ **Documentation**
   - Added comprehensive sitemap section to `docs/BUILD.md`
   - Documented URL types, priorities, sorting logic
   - Search engine submission instructions
   - Validation procedures

**Phase 2 Adjustments from Spec:**

- **Scene Priorities**: Adjusted based on user feedback
  - Timeline & Artists: 0.9 (update frequently)
  - Venues, Geography, Genres: 0.7 (update infrequently)
  - Original spec had all scenes at 0.9

- **Sitemap Committed to Git**: Per user requirement
  - Sitemap regenerates during `npm run build-data`
  - File committed (not in `.gitignore`)
  - Original spec suggested generated-only

**Phase 2 Verification:**
- ✅ Script runs without errors: `npm run generate:sitemap`
- ✅ Generates 409 URLs (1 + 5 + 247 + 154 + 2)
- ✅ XML properly escaped (`&amp;`)
- ✅ Artists sorted by concert count (Social Distortion, Howard Jones, Depeche Mode first)
- ✅ Venues sorted by concert count (top venues first)
- ✅ Integrated into build pipeline
- ✅ Documented in BUILD.md

**Output:**
```
Total URLs: 409
- Homepage: 1
- Scenes: 5
- Artists: 247
- Venues: 77 × 2 scenes = 154
- Changelog: 2
```

---

### Phase 3: Cloudflare Worker Meta Injection ⏸️ Planned

**Status:** Not yet implemented
**Target:** v3.6.0+
**Priority:** P1

**Prerequisites Verified:**
- ✅ Cloudflare Pages hosting (confirmed)
- ✅ Cloudflare Workers free tier available (100k requests/day)

**Next Steps:**
1. Create `workers/meta-injector.js` (200 lines)
2. Implement bot user-agent detection
3. Parse URL parameters (scene, artist, venue)
4. Fetch entity metadata from origin
5. Build dynamic meta tag templates
6. Inject into HTML `<head>`
7. Add caching strategy (Cloudflare KV optional)
8. Test with curl (simulate Googlebot)
9. Deploy to Cloudflare Workers
10. Monitor performance (P50/P95 latency)
11. Document in BUILD.md

**User Requirement:**
> "Worker looks good to use, but I will need step by step assistance"

This will be implemented in a separate session with guided step-by-step instructions.

---

## Revision History

- **2026-01-19:** Initial specification created (v1.0.0)
- **2026-01-20:** Phase 1 verification complete (pre-existing implementation)
- **2026-01-20:** Phase 2 implementation complete (sitemap generation)
- **Version:** 2.0.0
- **Author:** Claude Sonnet 4.5 (via /spec command + /implement)
- **Status:** Phase 1-2 Complete | Phase 3 Planned
- **Next Review:** Before Phase 3 implementation (target: v3.6.0)
