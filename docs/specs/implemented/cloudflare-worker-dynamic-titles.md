# Cloudflare Worker: Dynamic Scene Titles

**Status:** Implemented ✅
**Issue:** [#29](https://github.com/mmorper/concerts/issues/29) (open - deployment pending)
**Priority:** High (SEO improvement — 4 point impact)
**Discovered by:** `/seo` analysis — inconsistent deep link metadata
**Implemented:** 2026-01-20
**Moved to implemented:** 2026-02-05

---

## Problem

The `/seo` tool (v1.5) discovered that **approximately 60% of deep link pages show generic metadata** instead of entity-specific titles.

### Current State

All pages return generic metadata "Morperhaus Concert Archives" — including deep links to real entities:

| URL | Entity Exists? | Title (Observed) | Status |
|-----|----------------|------------------|--------|
| `/?scene=artists&artist=social-distortion` | ✅ Yes (6 concerts) | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=artists&artist=howard-jones` | ✅ Yes (5 concerts) | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=artists&artist=depeche-mode` | ✅ Yes (5 concerts) | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=venues&venue=kia-forum` | ✅ Yes (3 concerts) | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=genres&genre=new-wave` | ✅ Yes (49 concerts) | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=timeline` | N/A | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=venues` | N/A | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=artists` | N/A | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=geography` | N/A | "Morperhaus Concert Archives" | ❌ Generic |
| `/?scene=genres` | N/A | "Morperhaus Concert Archives" | ❌ Generic |

### Root Cause

The Cloudflare Worker (`workers/meta-injector.js`) either:
1. **Not deployed** — meta injection code exists but isn't active
2. **Not matching patterns** — URL routing doesn't trigger injection functions
3. **Failing silently** — metadata fetch errors cause fallback to defaults

---

## Investigation Steps

Before implementing, verify the current Worker behavior using **real entities from the archive**:

```bash
# Test artist deep links (Social Distortion = most-seen artist, 6 concerts)
curl -s "https://concerts.morperhaus.org/?scene=artists&artist=social-distortion" | grep -i "<title>"
# Expected: "Social Distortion - Morperhaus Concert Archives"
# Current: "Morperhaus Concert Archives" (generic)

# Test venue deep links (Kia Forum = 3 concerts)
curl -s "https://concerts.morperhaus.org/?scene=venues&venue=kia-forum" | grep -i "<title>"
# Expected: "Kia Forum - Morperhaus Concert Archives"
# Current: "Morperhaus Concert Archives" (generic)

# Test genre deep links (New Wave = 49 concerts)
curl -s "https://concerts.morperhaus.org/?scene=genres&genre=new-wave" | grep -i "<title>"
# Expected: "New Wave Concerts (49) - Morperhaus Concert Archives"
# Current: "Morperhaus Concert Archives" (generic)

# Test scene-only pages
curl -s "https://concerts.morperhaus.org/?scene=timeline" | grep -i "<title>"
# Expected: "179 Concerts (1984-2026) - Morperhaus Concert Archives"
# Current: "Morperhaus Concert Archives" (generic)
```

**Note:** Always test with entities that exist in the archive. Check `concerts.json` for valid normalized names.

---

## Solution

---

## Solution

Extend the Worker to inject scene-specific titles for all URL patterns.

### Proposed Title Patterns

| URL Pattern | Title |
|-------------|-------|
| `/` or `/?scene=timeline` | "179 Concerts (1984-2026) - Morperhaus Concert Archives" |
| `/?scene=artists` | "254 Artists I've Seen Live - Morperhaus Concert Archives" |
| `/?scene=artists&artist=X` | "Artist Name - Morperhaus Concert Archives" (existing) |
| `/?scene=venues` | "77 Concert Venues - Morperhaus Concert Archives" |
| `/?scene=venues&venue=X` | "Venue Name - Morperhaus Concert Archives" (existing) |
| `/?scene=geography` | "Concert Map: 77 Venues Across North America - Morperhaus" |
| `/?scene=geography&venue=X` | "Venue Name on Map - Morperhaus Concert Archives" (existing) |
| `/?scene=geography&region=X` | "Concerts in Region Name - Morperhaus Concert Archives" |
| `/?scene=genres` | "Music Genres Explored - Morperhaus Concert Archives" |
| `/?scene=genres&genre=X` | "Genre Name Concerts - Morperhaus Concert Archives" |

### Proposed Description Patterns

| URL Pattern | Description |
|-------------|-------------|
| `/` or `/?scene=timeline` | "Interactive timeline of 179 concerts from 1984-2026. Click any year to explore shows, artists, and venues." |
| `/?scene=artists` | "Browse 254 artists I've seen live. View photos, concert history, and connections between artists." |
| `/?scene=venues` | "Explore 77 concert venues through an interactive network visualization. See artist connections and concert history." |
| `/?scene=geography` | "Interactive map of 77 concert venues across North America. Click markers to explore show history." |
| `/?scene=genres` | "How 179 concerts break down by genre. Explore the musical diversity of 5+ decades of live shows." |

---

## Implementation

### Step 1: Add Scene Meta Injection Function

Add to `workers/meta-injector.js`:

```javascript
/**
 * Inject scene-specific meta tags (no entity deep link)
 */
async function injectSceneMeta(html, scene, origin) {
  try {
    // Fetch stats from concerts.json
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
    if (!concertsResponse.ok) return html;
    const concertsData = await concertsResponse.json();

    const stats = {
      concerts: concertsData.concerts.length,
      artists: new Set(concertsData.concerts.map(c => c.headlinerNormalized)).size,
      venues: new Set(concertsData.concerts.map(c => c.venueNormalized)).size,
      firstYear: Math.min(...concertsData.concerts.map(c => c.year)),
      lastYear: Math.max(...concertsData.concerts.map(c => c.year)),
    };

    // Scene-specific metadata
    const sceneMeta = {
      timeline: {
        title: `${stats.concerts} Concerts (${stats.firstYear}-${stats.lastYear}) - Morperhaus Concert Archives`,
        description: `Interactive timeline of ${stats.concerts} concerts from ${stats.firstYear}-${stats.lastYear}. Click any year to explore shows, artists, and venues.`,
      },
      artists: {
        title: `${stats.artists} Artists I've Seen Live - Morperhaus Concert Archives`,
        description: `Browse ${stats.artists} artists I've seen live. View photos, concert history, and connections between artists.`,
      },
      venues: {
        title: `${stats.venues} Concert Venues - Morperhaus Concert Archives`,
        description: `Explore ${stats.venues} concert venues through an interactive network visualization. See artist connections and concert history.`,
      },
      geography: {
        title: `Concert Map: ${stats.venues} Venues Across North America - Morperhaus`,
        description: `Interactive map of ${stats.venues} concert venues. Click markers to explore show history and artist lineups.`,
      },
      genres: {
        title: `Music Genres Explored - Morperhaus Concert Archives`,
        description: `How ${stats.concerts} concerts break down by genre. Explore the musical diversity of ${stats.lastYear - stats.firstYear}+ years of live shows.`,
      },
    };

    const meta = sceneMeta[scene] || sceneMeta.timeline;
    const pageUrl = scene ? `${origin}/?scene=${scene}` : origin;

    // Replace meta tags (same pattern as existing functions)
    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(meta.description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta property="twitter:description" content="[^"]*" \/>/, `<meta property="twitter:description" content="${escapeHtml(meta.description)}" />`);

    console.log(`[Scene Meta Injected] ${scene || 'homepage'}`);
    return html;

  } catch (error) {
    console.error(`Error injecting scene meta: ${error.message}`);
    return html;
  }
}
```

### Step 2: Add Genre Meta Injection Function

```javascript
/**
 * Inject genre-specific meta tags
 */
async function injectGenreMeta(html, genreNormalized, origin) {
  try {
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
    if (!concertsResponse.ok) return html;
    const concertsData = await concertsResponse.json();

    // Count concerts in this genre
    const genreConcerts = concertsData.concerts.filter(c =>
      c.genres?.some(g => g.toLowerCase().replace(/[^a-z0-9]/g, '-') === genreNormalized)
    );

    if (genreConcerts.length === 0) return html;

    // Format genre name (capitalize)
    const genreName = genreNormalized.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const title = `${genreName} Concerts (${genreConcerts.length}) - Morperhaus Concert Archives`;
    const description = `${genreConcerts.length} ${genreName.toLowerCase()} concerts from my live music archive. Explore artists, venues, and years.`;
    const pageUrl = `${origin}/?scene=genres&genre=${genreNormalized}`;

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);

    console.log(`[Genre Meta Injected] ${genreName} (${genreConcerts.length} concerts)`);
    return html;

  } catch (error) {
    console.error(`Error injecting genre meta: ${error.message}`);
    return html;
  }
}
```

### Step 3: Update Main Handler

Update the `fetch()` handler to route to the new functions:

```javascript
// In fetch handler, after parsing params:
const scene = url.searchParams.get('scene');
const artist = url.searchParams.get('artist');
const venue = url.searchParams.get('venue');
const genre = url.searchParams.get('genre');
const region = url.searchParams.get('region');

// Fetch and process HTML...

// Inject meta based on URL pattern (most specific first)
if (scene === 'artists' && artist) {
  html = await injectArtistMeta(html, artist, url.origin);
} else if ((scene === 'venues' || scene === 'geography') && venue) {
  html = await injectVenueMeta(html, venue, url.origin, scene);
} else if (scene === 'genres' && genre) {
  html = await injectGenreMeta(html, genre, url.origin);
} else if (scene === 'geography' && region) {
  html = await injectRegionMeta(html, region, url.origin);
} else {
  // Scene-only or homepage — inject scene meta
  html = await injectSceneMeta(html, scene, url.origin);
}
```

---

## Testing

After deployment, verify with:

```bash
# Test each scene
curl -A "Googlebot" "https://concerts.morperhaus.org/?scene=timeline" | grep "<title>"
curl -A "Googlebot" "https://concerts.morperhaus.org/?scene=artists" | grep "<title>"
curl -A "Googlebot" "https://concerts.morperhaus.org/?scene=venues" | grep "<title>"
curl -A "Googlebot" "https://concerts.morperhaus.org/?scene=geography" | grep "<title>"
curl -A "Googlebot" "https://concerts.morperhaus.org/?scene=genres" | grep "<title>"

# Test genre deep link
curl -A "Googlebot" "https://concerts.morperhaus.org/?scene=genres&genre=industrial" | grep "<title>"
```

Expected: Each URL returns a unique, descriptive title.

---

## Verification

Re-run `/seo` after deployment:
- "duplicate_content" insight should disappear
- Content Quality score may increase 2-3 points

---

## Notes

- Region meta injection (`injectRegionMeta`) needs region name lookup — may require additional data file or hardcoded mapping
- Consider caching stats in Worker KV to reduce origin fetches
- Cache invalidation: Redeploy Worker after data refresh
