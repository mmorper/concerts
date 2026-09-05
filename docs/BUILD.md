# Build & Deployment

This document covers the build process, deployment pipeline, and automated asset generation for the Morperhaus Concert Archives.

## Build Process

The build process runs through several stages when you execute `npm run build`:

```bash
npm run build
```

### Build Pipeline Stages

1. **Version Generation** (`tsx scripts/generate-version.ts`)
   - Generates `public/version.json` with git metadata
   - Captures: version tag, build timestamp, commit hash, branch name
   - Used for production debugging and release tracking

2. **TypeScript Compilation** (`tsc`)
   - Compiles all TypeScript files
   - Type-checks the entire codebase
   - Outputs to `dist/`

3. **Vite Build** (`vite build`)
   - Bundles React application
   - Optimizes assets (JS, CSS, images)
   - Applies tree-shaking and minification
   - Copies `public/` (including pre-generated OG image) to `dist/`
   - Outputs production build to `dist/`

## Open Graph (Social Media Preview)

When users share the site URL on social platforms (Facebook, Twitter, LinkedIn, etc.), a preview card appears with an image and metadata.

### Metadata Configuration

**Location**: `index.html` (lines 11-23)

The metadata includes:
- **Title**: "Morperhaus Concert Archives"
- **Description**: "A visual love letter to four decades of live music..."
- **Image**: `https://concerts.morperhaus.org/og-image.jpg` (1200×630px)
- **Type**: Website
- **Card Type**: `summary_large_image` (Twitter)

### Open Graph Image Generation

**Script**: `scripts/generate-og-simple.ts`
**Output**: `public/og-image.jpg` (1200×630px, ~126KB)
**Storage**: Committed to git (not generated during CI builds)
**Manual Regeneration**: `OG_SITE_URL=https://concerts.morperhaus.org npm run og:generate`

> **Note**: The OG image is pre-generated and committed to the repository to avoid Cloudflare Pages free tier build timeout limits (20 minutes). Puppeteer + production site loading takes ~6-8 minutes, which when combined with the full build, would exceed free tier limits.

#### How It Works

1. **Launches Headless Browser**
   - Uses Puppeteer to open production URL
   - Viewport: 1920×1080px
   - Waits for page load and network idle

2. **Scrapes Live Stats**
   - Concerts: Counts `[data-concert-id]` elements
   - Artists: Counts `[data-artist-name]` elements
   - Venues: Counts `[data-venue-name]` elements
   - Decades: Calculates from 1984 to current year

3. **Captures Venues Scene**
   - Navigates to Scene 2 (Venues force graph)
   - Waits 6 seconds for D3.js force simulation to stabilize
   - Hides UI chrome (title, buttons, navigation dots)
   - Takes full viewport screenshot

4. **Applies Image Processing**
   - Scales up to 1.4× (zoom effect)
   - Crops to 1200×630px to eliminate edges
   - Vertical offset (+40px) to remove top UI elements

5. **Overlays Dynamic Text**
   - Title: "Morperhaus Concert Archives"
   - Subtitle: "X+ decades. Y shows. Z artists. V venues. Q interactive stories."
   - Uses Google Fonts (Playfair Display + Source Sans 3)
   - Text shadows for contrast (no rectangular overlay)
   - Vertically centered at y=285/325

6. **Outputs Final Image**
   - Saves to `public/og-image.jpg`
   - JPEG format, 90% quality
   - Ready for deployment

#### Dynamic Content

The OG image updates automatically when data changes:

| Stat | Calculation | Example |
|------|-------------|---------|
| **Decades** | `Math.ceil((currentYear - 1984) / 10)` | "5+ decades" (in 2025) |
| **Shows** | Count of `[data-concert-id]` elements | "175 shows" |
| **Artists** | Count of `[data-artist-name]` elements | "248 artists" |
| **Venues** | Count of `[data-venue-name]` elements | "77 venues" |
| **Scenes** | Hardcoded | "5 interactive stories" |

**When to Regenerate**:
- After adding new concerts to the database
- After updating artist data
- After geocoding new venues
- When changing site branding or design
- Before major releases

**Regeneration Workflow**:
```bash
# 1. Generate new OG image from production
OG_SITE_URL=https://concerts.morperhaus.org npm run og:generate

# 2. Commit the updated image
git add public/og-image.jpg public/og-stats.json
git commit -m "chore: Update OG image with latest stats"
git push
```

#### Environment Variables

- `OG_SITE_URL`: URL to capture (default: `http://localhost:5173`)
  - **Local dev**: Use `http://localhost:5173` (requires dev server running)
  - **Production**: Use `https://concerts.morperhaus.org`

**Examples**:
```bash
# Generate from local dev server
npm run dev  # Start dev server first
npm run og:generate

# Generate from production site
OG_SITE_URL=https://concerts.morperhaus.org npm run og:generate
```

#### Debugging

**Preview Tool**: `npm run og:preview`

Generates full-scene screenshots with **red crop guide boxes** showing exactly where the image will be cropped. Useful for:
- Adjusting crop coordinates
- Verifying UI elements are hidden
- Testing different scenes
- Visual debugging before regenerating final image

Output: `public/preview-scene-{N}-{name}.png` files

**Troubleshooting**:

| Issue | Solution |
|-------|----------|
| UI elements visible | Check element hiding logic in script (lines 69-89) |
| Text not readable | Increase font sizes or adjust drop-shadow values |
| Force graph not rendered | Increase wait time (currently 6s + 2s) |
| Wrong stats showing | Verify data attribute selectors match production HTML |
| Image looks cropped wrong | Run `npm run og:preview` and adjust extract coordinates |

### Legacy Scripts (Not Used)

- `scripts/generate-og-image.ts` - Multi-scene capture (obsolete)
- `scripts/create-og-composite.ts` - Grid composite layout (obsolete)
- `scripts/preview-og-crops.ts` - Debug tool for multi-scene (still useful)

These were part of the original multi-scene composite approach. The simplified single-scene approach (`generate-og-simple.ts`) is now preferred.

## SEO & Discovery

### Sitemap Generation

**Script**: `scripts/generate-sitemap.ts`
**Output**: `public/sitemap.xml`
**Storage**: Committed to git (regenerated on data changes)
**Manual Generation**: `npm run generate:sitemap`
**Auto-Generated**: During `npm run build-data` (Step 11)

The sitemap provides search engines and bots with a complete index of all discoverable URLs:

#### URL Types

| Type | Count | Priority | Change Freq | Example |
|------|-------|----------|-------------|---------|
| **Homepage** | 1 | 1.0 | weekly | `/` |
| **Timeline Scene** | 1 | 0.9 | weekly | `/?scene=timeline` |
| **Artists Scene** | 1 | 0.9 | weekly | `/?scene=artists` |
| **Venues Scene** | 1 | 0.7 | monthly | `/?scene=venues` |
| **Geography Scene** | 1 | 0.7 | monthly | `/?scene=geography` |
| **Genres Scene** | 1 | 0.7 | monthly | `/?scene=genres` |
| **Artist Deep Links** | 247+ | 0.8 | monthly | `/?scene=artists&artist=depeche-mode` |
| **Venue Network Links** | 77+ | 0.7 | monthly | `/?scene=venues&venue=9-30-club` |
| **Venue Map Links** | 77+ | 0.6 | monthly | `/?scene=geography&venue=9-30-club` |
| **Changelog** | 2 | 0.5-0.4 | weekly | `/liner-notes`, `/liner-notes/rss` |

**Total URLs**: ~410 (1 homepage + 5 scenes + 247 artists + 154 venue links + 2 changelog)

#### Priority Logic

Scene priorities reflect update frequency:
- **Timeline & Artists** (0.9): Update frequently as new concerts are added
- **Venues, Geography, Genres** (0.7): Update infrequently (venues change rarely)

#### Sorting

Artists and venues are sorted by concert count (descending) to signal content richness to search engines:
- Top artists (e.g., Depeche Mode, Duran Duran) appear first
- Top venues (e.g., 9:30 Club, Irvine Meadows) appear first

#### When Sitemap Regenerates

Automatically during:
```bash
npm run build-data  # Step 11 of pipeline
```

Manually:
```bash
npm run generate:sitemap
```

**After regeneration**, commit the updated sitemap:
```bash
git add public/sitemap.xml
git commit -m "chore: Update sitemap with latest concerts"
git push
```

#### Search Engine Submission

**One-Time Setup**:
1. **Google Search Console**: https://search.google.com/search-console
   - Submit sitemap URL: `https://concerts.morperhaus.org/sitemap.xml`
2. **Bing Webmaster Tools**: https://www.bing.com/webmasters
   - Submit sitemap URL: `https://concerts.morperhaus.org/sitemap.xml`

**Verification**:
- Sitemap declared in `public/robots.txt` (line 13)
- Sitemap validates at: https://www.xml-sitemaps.com/validate-xml-sitemap.html

### Meta Tags & Schema.org

**Auto-Update Script**: `scripts/update-meta-tags.ts`
**Runs During**: `npm run build-data` (Step 10)
**Manual Update**: `npm run update:meta`

This script keeps SEO metadata synchronized with current concert data:

#### Files Updated

| File | What Updates | Purpose |
|------|-------------|---------|
| `index.html` | Meta descriptions, Schema.org JSON-LD | Search results, rich snippets |
| `public/llm.txt` | All stat occurrences | AI assistant documentation |
| `public/og-stats.json` | Concert/artist/venue counts | OG image generation |

#### Stats Auto-Updated

- **Concert count**: Total concerts (e.g., "178 concerts")
- **Artist count**: Unique headliners + openers (e.g., "253 artists")
- **Venue count**: Unique venues (e.g., "77 venues")
- **Album count**: From `discography.json` (e.g., "6,092+ albums")
- **Date range**: Earliest → latest concert (e.g., "1984-2026")
- **Decades**: Calculated from start year (e.g., "5+ decades")
- **Last modified**: Current date (ISO format)

#### Schema.org Structured Data

**Location**: `index.html` lines 68-146

The JSON-LD provides machine-readable structure for:
- **CollectionPage**: Site classification
- **MusicEventSeries**: Concert archive metadata
- **WebPage** (hasPart): 5 interactive scenes
- **SearchAction**: Artist search capability

**Fields Auto-Updated**:
- `description`: Full stats summary
- `dateModified`: Current date
- `numberOfEvents`: Concert count
- `startDate`: Earliest concert date
- `endDate`: Latest concert date
- `numberOfItems`: Artist count
- Scene descriptions (Timeline, Artists, Venues)

**Validation**:
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/

### AI Assistant Documentation (llm.txt)

**File**: `public/llm.txt`
**Format**: Human-readable markdown
**Purpose**: Help AI assistants (ChatGPT, Claude, Perplexity) understand the site

**Contents**:
- Site overview and stats (auto-updated)
- Content scope (personal vs. authoritative data)
- Data endpoints (JSON URLs and schemas)
- Deep linking patterns
- Common queries and how to answer them
- Features and tech stack
- Usage policy and attribution

**Example Queries AI Bots Can Answer**:
- "How many times has Morperhaus seen Depeche Mode?"
- "What's the most-attended venue?"
- "What venues are in Washington, DC?"
- "Show me concerts from 2024"

**Access**: https://concerts.morperhaus.org/llm.txt

### Robots.txt

**File**: `public/robots.txt`
**Purpose**: Direct crawler behavior

**Key Directives**:
- Allow all crawlers (`User-agent: *`, `Allow: /`)
- Explicitly welcome AI bots (GPTBot, ClaudeBot, Google-Extended, PerplexityBot)
- Welcome social media scrapers (Facebook, Twitter, LinkedIn)
- Declare sitemap location
- Rate limit: 1 second crawl delay

**Access**: https://concerts.morperhaus.org/robots.txt

## Deployment

### Cloudflare Pages

The site is automatically deployed via Cloudflare Pages:

- **Repository**: Connected to GitHub repository
- **Branch**: `main` (auto-deploy on push)
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`
- **URL**: https://concerts.morperhaus.org

**Installs float.** `package-lock.json` is gitignored, so every Pages build,
every Actions job and the tag deploy re-resolve the dependency tree from the
live registry. A registry-side change can therefore break the install with no
commit in this repo — it did on 2026-09-05, when vitest moved its `latest`
dist-tag to 5.0.0 and npm's peer resolver began crashing on the resulting tree.
The root `.npmrc` sets `legacy-peer-deps=true` as the unblock; the comment in
that file has the full chain. If a Pages check goes red about 30 seconds after
a push while Actions stays green, suspect the install step before anything
else: the Pages build log is in the dashboard, not in GitHub.

### Deployment Workflow

1. Commit and push changes to `main` branch
2. Cloudflare Pages detects push
3. Runs `npm run build` (includes OG generation)
4. Deploys `dist/` folder to CDN
5. OG image automatically updated at `/og-image.jpg`

### Caching Considerations

- **OG Image**: Browsers and social platforms cache OG images aggressively
- **Cache Busting**: May take hours/days for social platforms to refresh
- **Testing**: Use [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) or [Twitter Card Validator](https://cards-dev.twitter.com/validator) to force refresh

### Cloudflare Worker (Dynamic Meta Tags)

**Location**: `workers/meta-injector/worker.js`
**Purpose**: Inject dynamic meta tags for bots while keeping SPA fast for humans
**Status**: Deployed to production
**Worker URL**: <https://concerts-meta-injector.morps.workers.dev>
**Route**: `concerts.morperhaus.org/*`

#### Worker Flow

The worker sits in front of the Cloudflare Pages site and:

1. **Detects Bot User Agents** (Googlebot, Facebook, Twitter, AI bots)
2. **Parses URL Parameters** (`?scene=artists&artist=depeche-mode`)
3. **Fetches Entity Metadata** from production JSON files
4. **Injects Dynamic Meta Tags** into HTML `<head>`
5. **Returns Personalized HTML** with entity-specific title, description, OG image

**For Human Users**: Bypasses worker completely (no performance impact)

#### Deep Link Patterns

**Artist Pages**:

```text
/?scene=artists&artist={artist-normalized}
```

Example: `/?scene=artists&artist=depeche-mode`

Injects:

- `<title>Depeche Mode - Morperhaus Concert Archives</title>`
- Description with concert count and date range
- Artist photo as OG image (if available)

**Venue Pages (Network)**:

```text
/?scene=venues&venue={venue-normalized}
```

Example: `/?scene=venues&venue=9-30-club`

**Venue Pages (Map)**:

```text
/?scene=geography&venue={venue-normalized}
```

Example: `/?scene=geography&venue=irvine-meadows`

Injects:

- Venue name and location in title
- Description with concert count and featured artists
- Default OG image

#### Worker Testing

**Test Bot Detection**:

```bash
curl -A "Googlebot/2.1" \
  "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" | grep "<title>"
# Returns: <title>Depeche Mode - Morperhaus Concert Archives</title>
```

**Test Human Bypass**:

```bash
curl "https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode" | grep "<title>"
# Returns: <title>Morperhaus Concert Archives</title> (static)
```

**Test Social Media Previews**:

- **Facebook**: <https://developers.facebook.com/tools/debug/>
- **Twitter**: <https://cards-dev.twitter.com/validator>
- **LinkedIn**: <https://www.linkedin.com/post-inspector/>

Enter URL: `https://concerts.morperhaus.org/?scene=artists&artist=depeche-mode`

#### Worker Deployment

See [workers/README.md](../workers/README.md) for:

- Local testing with `wrangler dev`
- Deployment with `wrangler deploy`
- Route configuration
- Monitoring with `wrangler tail`
- Troubleshooting common issues

#### Worker Performance

**Bot Requests**:

- Cold start: ~50-100ms (first request after deploy)
- Warm requests: ~10-20ms (cached metadata)
- Total latency: ~30-120ms

**Human Requests**:

- Worker overhead: ~0ms (bypassed immediately)
- No performance impact

#### Bot Detection List

**Search Engines**: Googlebot, Bingbot, DuckDuckBot, Yandexbot
**Social Media**: Facebook, Twitter, LinkedIn, WhatsApp, Telegram, Slack, Discord
**AI Assistants**: ChatGPT, Claude, Perplexity, Google-Extended

Full list: See `BOT_USER_AGENTS` in [workers/meta-injector/worker.js:18-44](../workers/meta-injector/worker.js#L18-L44)

## NPM Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start development server |
| `build` | Full pipeline | Build production bundle |
| `preview` | `vite preview` | Preview production build locally |
| `build-data` | `tsx scripts/build-data.ts` | Fetch + validate + enrich concert data |
| `fetch-sheet` | `tsx scripts/fetch-google-sheet.ts` | Fetch data from Google Sheets |
| `validate-data` | `tsx scripts/validate-concerts.ts` | Validate concert data quality |
| `diff-data` | `tsx scripts/diff-concerts.ts` | Compare data changes |
| `geocode` | `tsx scripts/geocode-venues.ts` | Geocode venue locations |
| `enrich` | `tsx scripts/enrich-artists.ts` | Enrich artist metadata (out of scope v1.2.0) |
| `og:generate` | `tsx scripts/generate-og-simple.ts` | Generate OG image from live site |
| `og:preview` | `tsx scripts/preview-og-crops.ts` | Preview crop regions with guides |

For detailed data pipeline documentation, see [DATA_PIPELINE.md](DATA_PIPELINE.md).

## Dependencies for Build

### Production
- `puppeteer@^24.34.0` - Headless browser automation
- `sharp@^0.34.5` - High-performance image processing
- `tsx@^4.19.2` - TypeScript execution

### Why These Tools?
- **Puppeteer**: Captures live force graph animations that can't be server-rendered
- **Sharp**: Fast image resizing, cropping, and compositing (faster than ImageMagick)
- **SVG Overlay**: Ensures web fonts render correctly in social previews
