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
   - Outputs production build to `dist/`

4. **OG Image Generation** (`npm run og:generate`)
   - Automatically generates social media preview image
   - See [Open Graph Image Generation](#open-graph-image-generation) below

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
**Runs**: Automatically during `npm run build`
**Manual**: `OG_SITE_URL=https://concerts.morperhaus.org npm run og:generate`

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
- Before major releases

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

## Deployment

### Cloudflare Pages

The site is automatically deployed via Cloudflare Pages:

- **Repository**: Connected to GitHub repository
- **Branch**: `main` (auto-deploy on push)
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`
- **URL**: https://concerts.morperhaus.org

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

## NPM Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start development server |
| `build` | Full pipeline | Build production bundle + OG image |
| `preview` | `vite preview` | Preview production build locally |
| `og:generate` | `tsx scripts/generate-og-simple.ts` | Generate OG image from live site |
| `og:preview` | `tsx scripts/preview-og-crops.ts` | Preview crop regions with guides |

## Dependencies for Build

### Production
- `puppeteer@^24.34.0` - Headless browser automation
- `sharp@^0.34.5` - High-performance image processing
- `tsx@^4.19.2` - TypeScript execution

### Why These Tools?
- **Puppeteer**: Captures live force graph animations that can't be server-rendered
- **Sharp**: Fast image resizing, cropping, and compositing (faster than ImageMagick)
- **SVG Overlay**: Ensures web fonts render correctly in social previews
