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
    const genre = url.searchParams.get('genre');
    const region = url.searchParams.get('region');

    // Fetch original HTML from origin
    const response = await fetch(request);

    // If not OK or not HTML, pass through
    const contentType = response.headers.get('Content-Type') || '';
    if (!response.ok || !contentType.includes('text/html')) {
      return response;
    }

    let html = await response.text();

    // Inject dynamic meta tags based on URL params (most specific first)
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
async function injectRegionMeta(html, regionNormalized, origin) {
  try {
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
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
async function injectGenreMeta(html, genreNormalized, origin) {
  try {
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
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
 * Inject scene-specific meta tags (no entity deep link)
 */
async function injectSceneMeta(html, scene, origin) {
  try {
    // Fetch stats from concerts.json
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
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
