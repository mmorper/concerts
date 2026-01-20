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

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';

    // Only process HTML requests from bots
    if (!isBot(userAgent) || !isHTMLRequest(request)) {
      return fetch(request);
    }

    console.log(`[Bot Detected] ${userAgent.substring(0, 50)}... | ${url.pathname}${url.search}`);

    // Parse deep link parameters
    const scene = url.searchParams.get('scene');
    const artist = url.searchParams.get('artist');
    const venue = url.searchParams.get('venue');

    // Fetch original HTML from origin
    const response = await fetch(request);

    // If not OK or not HTML, pass through
    const contentType = response.headers.get('Content-Type') || '';
    if (!response.ok || !contentType.includes('text/html')) {
      return response;
    }

    let html = await response.text();

    // Inject dynamic meta tags based on URL params
    if (scene === 'artists' && artist) {
      html = await injectArtistMeta(html, artist, url.origin);
    } else if ((scene === 'venues' || scene === 'geography') && venue) {
      html = await injectVenueMeta(html, venue, url.origin, scene);
    }

    // Return modified HTML
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600', // Cache bot responses for 1 hour
      },
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
async function injectArtistMeta(html, artistNormalized, origin) {
  try {
    // Fetch artist metadata
    const artistsResponse = await fetch(`${origin}/data/artists-metadata.json`);
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
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
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
    const title = `${metadata.name} - Morperhaus Concert Archives`;
    const description = `${concertCount} ${concertCount === 1 ? 'concert' : 'concerts'} from ${dateRange}. Explore setlists, tour history, and venue details for ${metadata.name}.`;
    const imageUrl = metadata.image || `${origin}/og-image.jpg`;
    const pageUrl = `${origin}/?scene=artists&artist=${artistNormalized}`;

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
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
async function injectVenueMeta(html, venueNormalized, origin, scene) {
  try {
    // Fetch venue metadata
    const venuesResponse = await fetch(`${origin}/data/venues-metadata.json`);
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
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
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
    const title = `${metadata.name} - Morperhaus Concert Archives`;
    const description = `${concertCount} ${concertCount === 1 ? 'concert' : 'concerts'} at ${metadata.name} in ${metadata.city}, ${metadata.state}. Featured artists: ${topArtists.join(', ')}.`;
    const pageUrl = `${origin}/?scene=${scene}&venue=${venueNormalized}`;

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
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
 * Escape HTML special characters
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
