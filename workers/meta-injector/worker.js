/**
 * Cloudflare Worker: Dynamic Meta Tag Injection
 *
 * Intercepts bot requests and injects dynamic meta tags based on URL parameters.
 * Human users bypass this worker completely for optimal performance.
 *
 * Flow:
 * 1. Detect if request is from a bot (Googlebot, Facebook, Twitter, etc.)
 * 2. If bot: Parse URL params (?scene=artists&artist=depeche-mode)
 * 3. Fetch entity metadata from origin
 * 4. Inject dynamic meta tags into HTML <head>
 * 5. Return modified HTML
 *
 * If not bot: Pass through unchanged (fast SPA)
 */

// List of known bot user agents
const BOT_USER_AGENTS = [
  // Search Engines
  'googlebot',
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',

  // Social Media
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegram',
  'slackbot',
  'discordbot',

  // AI Bots
  'gptbot',
  'chatgpt-user',
  'claude-web',
  'claudebot',
  'anthropic-ai',
  'perplexitybot',
  'google-extended',
];

// Cache same-origin JSON between requests so we don't pay fetch+parse on every bot hit.
// Spike #110 measured cold-isolate CPU at 11–16 ms on venue routes (over the 10 ms free-tier limit);
// the parse dominates. 300s TTL keeps SEO bots within acceptable staleness.
async function cachedJsonFetch(url, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) return response;

  const cacheable = new Response(response.body, response);
  cacheable.headers.set('Cache-Control', 'public, max-age=300');
  ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
  return cacheable;
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';

    // TEMPORARY WORKAROUND — REMOVE AFTER ~2026-06-26.
    // /ask was a static landing page until #141 reclaimed it for the SPA. The retired file was
    // served with a 7-day s-maxage and is wedged in the edge cache on the query-less /ask key;
    // by-URL and full purges did not reliably evict it. A query-string variant misses that stale
    // key and returns the live SPA shell, so we fetch /ask that way and return it in place (the
    // client URL stays /ask; React Router then redirects /ask → /?scene=ask per #142).
    // NOT a no-op: this runs an extra origin fetch on EVERY /ask request. It is only needed until
    // the stale object expires (cached ~2026-06-19, s-maxage 7d → gone ~2026-06-26) — delete this
    // whole branch then. (Subrequests to the worker's own route go to origin, so no recursion.)
    if (url.pathname === '/ask' && !url.searchParams.has('__spa')) {
      const fresh = new URL(request.url);
      fresh.searchParams.set('__spa', '1');
      return fetch(new Request(fresh.toString(), request));
    }

    // Only process HTML requests from bots
    if (!isBot(userAgent) || !isHTMLRequest(request)) {
      return fetch(request);
    }

    console.log(`[Bot Detected] ${userAgent.substring(0, 50)}... | ${url.pathname}${url.search}`);

    // Parse deep link parameters
    const scene = url.searchParams.get('scene');
    const artist = url.searchParams.get('artist');
    const venue = url.searchParams.get('venue');
    const genre = url.searchParams.get('genre');
    const region = url.searchParams.get('region');
    const show = url.searchParams.get('show'); // #193 — concert date, YYYY-MM-DD

    // Fetch original HTML from origin
    const response = await fetch(request);

    // If not OK or not HTML, pass through
    const contentType = response.headers.get('Content-Type') || '';
    if (!response.ok || !contentType.includes('text/html')) {
      return response;
    }

    let html = await response.text();

    // Inject dynamic meta tags — pathname routes take precedence over query params
    if (url.pathname === '/how-it-works') {
      html = await injectHowItWorksMeta(html, url.origin, ctx);
    } else if (url.pathname === '/liner-notes') {
      html = await injectLinerNotesFeedMeta(html, url.origin, ctx);
    } else if (url.pathname.startsWith('/liner-notes/') && url.pathname !== '/liner-notes/rss') {
      const slug = url.pathname.slice('/liner-notes/'.length);
      html = await injectLinerNotesPostMeta(html, slug, url.origin, ctx);
    } else if (url.pathname === '/whats-playing') {
      html = await injectWhatsPlayingMeta(html, url.origin);
    } else if (scene === 'artists' && artist && show) {
      // More specific than the artist branch, so it must come first (#193).
      // Falls back to injectArtistMeta internally if `show` doesn't resolve.
      html = await injectShowMeta(html, artist, show, url.origin, ctx);
    } else if (scene === 'artists' && artist) {
      html = await injectArtistMeta(html, artist, url.origin, ctx);
    } else if ((scene === 'venues' || scene === 'geography') && venue) {
      html = await injectVenueMeta(html, venue, url.origin, scene, ctx);
    } else if (scene === 'genres' && genre) {
      html = await injectGenreMeta(html, genre, url.origin, ctx);
    } else if (scene === 'geography' && region) {
      html = await injectRegionMeta(html, region, url.origin, ctx);
    } else {
      // Scene-only or homepage — inject scene meta
      html = await injectSceneMeta(html, scene, url.origin, ctx);
    }

    // Preserve all original headers (CORS, CSP, security headers, etc.)
    const headers = new Headers(response.headers);

    // Only override specific headers
    headers.set('Content-Type', 'text/html;charset=UTF-8');
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache bot responses for 1 hour

    // Return modified HTML with all original headers preserved
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  },
};

/**
 * Check if request is from a bot
 */
function isBot(userAgent) {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

/**
 * Check if request is for HTML (not API, images, etc.)
 */
function isHTMLRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get('Accept') || '';

  // Skip API endpoints and static assets
  if (url.pathname.startsWith('/data/') ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.match(/\.(js|css|json|jpg|png|svg|ico|xml|txt)$/)) {
    return false;
  }

  // Check Accept header
  return accept.includes('text/html') || accept.includes('*/*');
}

/**
 * Inject artist-specific meta tags
 */
/**
 * Inject meta tags for one specific night (#193).
 *
 * A shared setlist link previously unfurled as the generic artist card — correct,
 * but it couldn't say *which* show. This makes the card name the venue and date.
 *
 * Degrades rather than fails: if `show` doesn't resolve to a concert (stale link,
 * renamed artist, malformed date), this hands off to injectArtistMeta so the
 * visitor still gets a good artist card instead of an error or empty meta.
 *
 * Matches on date AND artist. Date uniqueness holds in the current data but is
 * not an enforced invariant — two shows on one date is physically possible — so
 * this never assumes a single result.
 */
async function injectShowMeta(html, artistNormalized, showDate, origin, ctx) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate)) {
      return injectArtistMeta(html, artistNormalized, origin, ctx);
    }

    const concertsResponse = await cachedJsonFetch(`${origin}/data/concerts.json`, ctx);
    if (!concertsResponse.ok) {
      console.error('Failed to fetch concerts.json');
      return injectArtistMeta(html, artistNormalized, origin, ctx);
    }
    const concertsData = await concertsResponse.json();
    const concert =
      concertsData.concerts.find(
        c => c.date === showDate && c.headlinerNormalized === artistNormalized
      ) || concertsData.concerts.find(c => c.date === showDate);

    if (!concert) {
      console.warn(`Show not found: ${artistNormalized} on ${showDate}`);
      return injectArtistMeta(html, artistNormalized, origin, ctx);
    }

    const artistsResponse = await cachedJsonFetch(`${origin}/data/artists-metadata.json`, ctx);
    const artistsData = artistsResponse.ok ? await artistsResponse.json() : {};
    const metadata = artistsData[artistNormalized];
    const artistName = metadata?.name || concert.headliner;

    const longDate = new Date(`${concert.date}T00:00:00Z`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const title = `${artistName} at ${concert.venue} · ${longDate} | Morperhaus Concert Archives`;
    const description =
      `The setlist from ${artistName} at ${concert.venue}, ${concert.cityState || concert.city} ` +
      `on ${longDate}, from a personal concert archive spanning four decades.`;
    // Per-show cards are a follow-up (#194); until then the artist image is the
    // best available, and a missing one falls back to the site card.
    const imageUrl = metadata?.image || `${origin}/og-image.jpg`;
    const pageUrl = `${origin}/?scene=artists&artist=${artistNormalized}&show=${concert.date}`;

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeTitleText(title)}</title>`);
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`
    );
    html = html.replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
    );
    html = html.replace(
      /<meta property="twitter:description" content="[^"]*" \/>/,
      `<meta property="twitter:description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="twitter:image" content="[^"]*" \/>/,
      `<meta property="twitter:image" content="${escapeHtml(imageUrl)}" />`
    );

    console.log(`[Show Meta Injected] ${artistName} at ${concert.venue}, ${concert.date}`);
    return html;
  } catch (err) {
    console.error('injectShowMeta failed:', err);
    return injectArtistMeta(html, artistNormalized, origin, ctx);
  }
}

async function injectArtistMeta(html, artistNormalized, origin, ctx) {
  try {
    // Fetch artist metadata
    const artistsResponse = await cachedJsonFetch(`${origin}/data/artists-metadata.json`, ctx);
    if (!artistsResponse.ok) {
      console.error('Failed to fetch artists-metadata.json');
      return html;
    }
    const artistsData = await artistsResponse.json();
    const metadata = artistsData[artistNormalized];

    if (!metadata) {
      console.warn(`Artist not found: ${artistNormalized}`);
      return html;
    }

    // Fetch concert data to count concerts
    const concertsResponse = await cachedJsonFetch(`${origin}/data/concerts.json`, ctx);
    if (!concertsResponse.ok) {
      console.error('Failed to fetch concerts.json');
      return html;
    }
    const concertsData = await concertsResponse.json();
    const artistConcerts = concertsData.concerts.filter(
      c => c.headlinerNormalized === artistNormalized
    );
    const concertCount = artistConcerts.length;

    // Calculate date range
    const years = artistConcerts.map(c => c.year).sort();
    const dateRange = years.length > 0
      ? `${years[0]}-${years[years.length - 1]}`
      : 'various years';

    // Build dynamic meta tags
    const title = `${metadata.name} | Morperhaus Concert Archives`;
    const description = `${concertCount} ${concertCount === 1 ? 'concert' : 'concerts'} from ${dateRange}. Explore setlists, tour history, and venue details for ${metadata.name}.`;
    const imageUrl = metadata.image || `${origin}/og-image.jpg`;
    const pageUrl = `${origin}/?scene=artists&artist=${artistNormalized}`;

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeTitleText(title)}</title>`
    );

    // Replace meta description
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );

    // Replace OG title
    html = html.replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    );

    // Replace OG description
    html = html.replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    );

    // Replace OG URL
    html = html.replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`
    );

    // Replace OG image
    html = html.replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
    );

    // Replace Twitter description
    html = html.replace(
      /<meta property="twitter:description" content="[^"]*" \/>/,
      `<meta property="twitter:description" content="${escapeHtml(description)}" />`
    );

    // Replace Twitter image
    html = html.replace(
      /<meta property="twitter:image" content="[^"]*" \/>/,
      `<meta property="twitter:image" content="${escapeHtml(imageUrl)}" />`
    );

    console.log(`[Artist Meta Injected] ${metadata.name} (${concertCount} concerts)`);
    return html;

  } catch (error) {
    console.error(`Error injecting artist meta: ${error.message}`);
    return html; // Return original HTML on error
  }
}

/**
 * Inject venue-specific meta tags
 */
async function injectVenueMeta(html, venueNormalized, origin, scene, ctx) {
  try {
    // Fetch venue metadata
    const venuesResponse = await cachedJsonFetch(`${origin}/data/venues-metadata.json`, ctx);
    if (!venuesResponse.ok) {
      console.error('Failed to fetch venues-metadata.json');
      return html;
    }
    const venuesData = await venuesResponse.json();
    const metadata = venuesData[venueNormalized];

    if (!metadata) {
      console.warn(`Venue not found: ${venueNormalized}`);
      return html;
    }

    // Fetch concert data to count concerts
    const concertsResponse = await cachedJsonFetch(`${origin}/data/concerts.json`, ctx);
    if (!concertsResponse.ok) {
      console.error('Failed to fetch concerts.json');
      return html;
    }
    const concertsData = await concertsResponse.json();
    const venueConcerts = concertsData.concerts.filter(
      c => c.venueNormalized === venueNormalized
    );
    const concertCount = venueConcerts.length;

    // Get featured artists (top 3)
    const artistCounts = {};
    venueConcerts.forEach(c => {
      artistCounts[c.headliner] = (artistCounts[c.headliner] || 0) + 1;
    });
    const topArtists = Object.keys(artistCounts)
      .sort((a, b) => artistCounts[b] - artistCounts[a])
      .slice(0, 3);

    // Build dynamic meta tags
    const sceneLabel = scene === 'geography' ? 'Map' : 'Network';
    const title = `${metadata.name} | Morperhaus Concert Archives`;
    const description = `${concertCount} ${concertCount === 1 ? 'concert' : 'concerts'} at ${metadata.name} in ${metadata.city}, ${metadata.state}. Featured artists: ${topArtists.join(', ')}.`;
    const pageUrl = `${origin}/?scene=${scene}&venue=${venueNormalized}`;

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeTitleText(title)}</title>`
    );

    // Replace meta description
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );

    // Replace OG title
    html = html.replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    );

    // Replace OG description
    html = html.replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    );

    // Replace OG URL
    html = html.replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`
    );

    // Replace Twitter description
    html = html.replace(
      /<meta property="twitter:description" content="[^"]*" \/>/,
      `<meta property="twitter:description" content="${escapeHtml(description)}" />`
    );

    console.log(`[Venue Meta Injected] ${metadata.name} (${concertCount} concerts, ${sceneLabel} scene)`);
    return html;

  } catch (error) {
    console.error(`Error injecting venue meta: ${error.message}`);
    return html; // Return original HTML on error
  }
}

/**
 * Inject region-specific meta tags
 */
async function injectRegionMeta(html, regionNormalized, origin, ctx) {
  try {
    const concertsResponse = await cachedJsonFetch(`${origin}/data/concerts.json`, ctx);
    if (!concertsResponse.ok) {
      console.error('Failed to fetch concerts.json');
      return html;
    }
    const concertsData = await concertsResponse.json();

    // Region name lookup (normalized → display name)
    const regionNames = {
      'losangeles': 'Los Angeles',
      'la': 'Los Angeles',
      'orangecounty': 'Orange County',
      'oc': 'Orange County',
      'sandiego': 'San Diego',
      'sanfrancisco': 'San Francisco',
      'sf': 'San Francisco',
      'bayarea': 'Bay Area',
      'california': 'California',
      'lasvegas': 'Las Vegas',
      'vegas': 'Las Vegas',
      'newyork': 'New York',
      'nyc': 'New York',
      'chicago': 'Chicago',
      'seattle': 'Seattle',
      'portland': 'Portland',
      'austin': 'Austin',
      'dallas': 'Dallas',
      'denver': 'Denver',
      'phoenix': 'Phoenix',
      'atlanta': 'Atlanta',
      'boston': 'Boston',
      'miami': 'Miami',
      'nashville': 'Nashville',
      'newOrleans': 'New Orleans',
    };

    const regionName = regionNames[regionNormalized.toLowerCase()] ||
      regionNormalized.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Filter concerts by region (check city field)
    const regionConcerts = concertsData.concerts.filter(c => {
      const cityNorm = (c.city || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const stateNorm = (c.state || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const regionNorm = regionNormalized.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cityNorm.includes(regionNorm) || stateNorm.includes(regionNorm) ||
             regionNorm.includes(cityNorm);
    });

    if (regionConcerts.length === 0) {
      console.warn(`Region not found or no concerts: ${regionNormalized}`);
      return html;
    }

    // Get top venues in this region
    const venueCounts = {};
    regionConcerts.forEach(c => {
      venueCounts[c.venue] = (venueCounts[c.venue] || 0) + 1;
    });
    const topVenues = Object.keys(venueCounts)
      .sort((a, b) => venueCounts[b] - venueCounts[a])
      .slice(0, 3);

    const title = `Concerts in ${regionName} (${regionConcerts.length}) | Morperhaus Concert Archives`;
    const description = `${regionConcerts.length} concerts in ${regionName} at venues like ${topVenues.join(', ')}.`;
    const pageUrl = `${origin}/?scene=geography&region=${regionNormalized}`;

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeTitleText(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta property="twitter:description" content="[^"]*" \/>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);

    console.log(`[Region Meta Injected] ${regionName} (${regionConcerts.length} concerts)`);
    return html;

  } catch (error) {
    console.error(`Error injecting region meta: ${error.message}`);
    return html;
  }
}

/**
 * Inject genre-specific meta tags
 */
async function injectGenreMeta(html, genreNormalized, origin, ctx) {
  try {
    const concertsResponse = await cachedJsonFetch(`${origin}/data/concerts.json`, ctx);
    if (!concertsResponse.ok) {
      console.error('Failed to fetch concerts.json');
      return html;
    }
    const concertsData = await concertsResponse.json();

    // Count concerts in this genre (check both primary and secondary genres)
    const genreConcerts = concertsData.concerts.filter(c => {
      const primaryMatch = c.genreNormalized === genreNormalized;
      const secondaryMatch = c.genres?.some(g =>
        g.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === genreNormalized
      );
      return primaryMatch || secondaryMatch;
    });

    if (genreConcerts.length === 0) {
      console.warn(`Genre not found or no concerts: ${genreNormalized}`);
      return html;
    }

    // Format genre name (capitalize words)
    const genreName = genreNormalized
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    // Get sample artists for this genre
    const artistCounts = {};
    genreConcerts.forEach(c => {
      artistCounts[c.headliner] = (artistCounts[c.headliner] || 0) + 1;
    });
    const topArtists = Object.keys(artistCounts)
      .sort((a, b) => artistCounts[b] - artistCounts[a])
      .slice(0, 3);

    const title = `${genreName} Concerts (${genreConcerts.length}) | Morperhaus Concert Archives`;
    const description = `${genreConcerts.length} ${genreName.toLowerCase()} concerts featuring ${topArtists.join(', ')} and more.`;
    const pageUrl = `${origin}/?scene=genres&genre=${genreNormalized}`;

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeTitleText(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta property="twitter:description" content="[^"]*" \/>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);

    console.log(`[Genre Meta Injected] ${genreName} (${genreConcerts.length} concerts)`);
    return html;

  } catch (error) {
    console.error(`Error injecting genre meta: ${error.message}`);
    return html;
  }
}

/**
 * Inject meta tags for /how-it-works — the interactive data pipeline explainer
 */
async function injectHowItWorksMeta(html, origin, ctx) {
  try {
    const concertsResponse = await cachedJsonFetch(`${origin}/data/concerts.json`, ctx);
    if (!concertsResponse.ok) return html;
    const concertsData = await concertsResponse.json();

    const concertCount = concertsData.concerts.length;
    const years = concertsData.concerts.map(c => c.year);
    const yearSpan = Math.max(...years) - Math.min(...years) + 1;

    const title = `How It Works | Morperhaus Concert Archives`;
    const description = `See how ${concertCount} concerts come to life. An interactive walkthrough of the data enrichment pipeline — from a single artist, venue, and date through seven APIs across six tiers, building ${yearSpan} years of live music history.`;
    const pageUrl = `${origin}/how-it-works`;

    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta property="twitter:description" content="[^"]*" \/>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);

    console.log(`[How It Works Meta Injected]`);
    return html;

  } catch (error) {
    console.error(`Error injecting how-it-works meta: ${error.message}`);
    return html;
  }
}

/**
 * Inject scene-specific meta tags (no entity deep link)
 */
async function injectSceneMeta(html, scene, origin, ctx) {
  try {
    // Fetch stats from concerts.json
    const concertsResponse = await cachedJsonFetch(`${origin}/data/concerts.json`, ctx);
    if (!concertsResponse.ok) {
      console.error('Failed to fetch concerts.json');
      return html;
    }
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
        title: `${stats.concerts} Concerts (${stats.firstYear}-${stats.lastYear}) | Morperhaus Concert Archives`,
        description: `Interactive timeline of ${stats.concerts} concerts from ${stats.firstYear}-${stats.lastYear}. Click any year to explore shows, artists, and venues.`,
      },
      artists: {
        title: `${stats.artists} Artists I've Seen Live | Morperhaus Concert Archives`,
        description: `Browse ${stats.artists} artists I've seen live. View photos, concert history, and connections between artists.`,
      },
      venues: {
        title: `${stats.venues} Concert Venues | Morperhaus Concert Archives`,
        description: `Explore ${stats.venues} concert venues through an interactive network visualization. See artist connections and concert history.`,
      },
      geography: {
        title: `Concert Map: ${stats.venues} Venues Across North America | Morperhaus`,
        description: `Interactive map of ${stats.venues} concert venues. Click markers to explore show history and artist lineups.`,
      },
      genres: {
        title: `Music Genres Explored | Morperhaus Concert Archives`,
        description: `How ${stats.concerts} concerts break down by genre. Explore the musical diversity of ${stats.lastYear - stats.firstYear}+ years of live shows.`,
      },
      about: {
        title: `About | Morperhaus Concert Archives`,
        description: `The story behind ${stats.concerts} concerts across ${stats.lastYear - stats.firstYear}+ years. A personal archive of live music memories.`,
      },
    };

    const meta = sceneMeta[scene] || sceneMeta.timeline;
    const pageUrl = scene ? `${origin}/?scene=${scene}` : origin;

    // Replace meta tags
    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeTitleText(meta.title)}</title>`);
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

/**
 * Inject meta tags for /liner-notes feed page
 */
async function injectLinerNotesFeedMeta(html, origin, ctx) {
  try {
    const feedResponse = await cachedJsonFetch(`${origin}/data/liner-notes.json`, ctx);
    const title = 'Liner Notes | Morperhaus Concert Archives';
    const description = 'Stories from 42 years of live music — personal essays, cultural context, and deep cuts.';
    const pageUrl = `${origin}/liner-notes`;
    let imageUrl = `${origin}/og-image.jpg`;

    if (feedResponse.ok) {
      const feedData = await feedResponse.json();
      const firstPost = feedData.posts && feedData.posts[0];
      if (firstPost && firstPost.image && firstPost.image.url && firstPost.image.source !== 'placeholder') {
        imageUrl = firstPost.image.url;
      }
    }

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeTitleText(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`);
    html = html.replace(/<meta property="twitter:description" content="[^"]*" \/>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="twitter:image" content="[^"]*" \/>/, `<meta property="twitter:image" content="${escapeHtml(imageUrl)}" />`);

    console.log('[Liner Notes Feed Meta Injected]');
    return html;

  } catch (error) {
    console.error(`Error injecting liner notes feed meta: ${error.message}`);
    return html;
  }
}

/**
 * Inject meta tags for /liner-notes/:slug post permalink
 */
async function injectLinerNotesPostMeta(html, slug, origin, ctx) {
  try {
    const feedResponse = await cachedJsonFetch(`${origin}/data/liner-notes.json`, ctx);
    if (!feedResponse.ok) {
      console.error('Failed to fetch liner-notes.json');
      return html;
    }
    const feedData = await feedResponse.json();
    const post = feedData.posts && feedData.posts.find(p => p.slug === slug);

    if (!post) {
      console.warn(`Liner note not found: ${slug}`);
      return html;
    }

    const title = `${post.headline} | Liner Notes — Morperhaus`;
    // Truncate prose to ~160 chars for description
    const description = post.prose.length > 160
      ? post.prose.slice(0, 157).trimEnd() + '...'
      : post.prose;
    const pageUrl = `${origin}/liner-notes/${slug}`;
    // Pre-generated OG image from og-image.ts pipeline; fall back to post image or default
    const ogImageUrl = `${origin}/og/liner-notes/${slug}.png`;
    const imageUrl = post.image && post.image.url && post.image.source !== 'placeholder'
      ? post.image.url
      : ogImageUrl;

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeTitleText(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`);
    html = html.replace(/<meta property="twitter:description" content="[^"]*" \/>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="twitter:image" content="[^"]*" \/>/, `<meta property="twitter:image" content="${escapeHtml(ogImageUrl)}" />`);

    console.log(`[Liner Notes Post Meta Injected] ${post.headline}`);
    return html;

  } catch (error) {
    console.error(`Error injecting liner notes post meta: ${error.message}`);
    return html;
  }
}

/**
 * Inject meta tags for /whats-playing app changelog page
 */
async function injectWhatsPlayingMeta(html, origin) {
  try {
    const title = "What's Playing | Morperhaus Concert Archives";
    const description = 'App updates and new features for the Morperhaus Concert Archives.';
    const pageUrl = `${origin}/whats-playing`;
    const imageUrl = `${origin}/og-image.jpg`;

    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeTitleText(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
    html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
    html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`);
    html = html.replace(/<meta property="twitter:description" content="[^"]*" \/>/, `<meta property="twitter:description" content="${escapeHtml(description)}" />`);

    console.log("[What's Playing Meta Injected]");
    return html;

  } catch (error) {
    console.error(`Error injecting whats-playing meta: ${error.message}`);
    return html;
  }
}

/**
 * Escape text for use in <title> tags
 * Title tags contain text content, not HTML, so only escape < and & which could break parsing
 * Apostrophes and quotes are safe in title text and should NOT be entity-encoded
 */
function escapeTitleText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
}

/**
 * Escape HTML special characters for use in HTML attributes
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
