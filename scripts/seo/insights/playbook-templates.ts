/**
 * Playbook Templates
 *
 * Reusable templates for generating actionable playbooks.
 * Separated from playbooks.ts for easier customization.
 */

// ============================================================================
// Title Templates
// ============================================================================

/**
 * Title patterns that work well for SEO
 * Uses placeholders: {count}, {type}, {year}, {action}
 */
export const TITLE_TEMPLATES = {
  venues: [
    '{count} Concert Venues I\'ve Visited Since {year} | Interactive Map',
    'Explore {count} Venues Across {cityCount} Cities | Concert History',
    'My Concert Venue Map: {count} Venues, {concertCount} Shows',
  ],
  artists: [
    '{count} Artists I\'ve Seen Live | Interactive Concert Archive',
    'Concert History: {count} Artists, {concertCount} Shows Since {year}',
    'Live Music Archive: {count} Artists Across {yearSpan} Years',
  ],
  timeline: [
    '{count} Concerts Since {year} | Visual Timeline',
    'My {yearSpan}-Year Concert Journey: {count} Shows',
    'Concert Timeline: {count} Shows from {year} to Present',
  ],
  genres: [
    'Concert Genres Explored | {count} Shows Across Musical Styles',
    'Explore Music Genres: {count} Concerts Visualized',
  ],
  geography: [
    'Concert Map: {venueCount} Venues Across {cityCount} Cities',
    'Geographic Concert History | Interactive Map of {concertCount} Shows',
  ],
  default: ['{title} | {siteName}'],
}

/**
 * Description templates by page type
 */
export const DESCRIPTION_TEMPLATES = {
  venues: [
    'Explore an interactive network visualization of {count} venues across {cityCount} cities. See which artists played where, discover venue connections, and find your next show.',
    'Interactive map of {count} concert venues spanning {yearSpan} years. Browse by city, capacity, or artist history.',
  ],
  artists: [
    'Interactive archive of {count} artists I\'ve seen live. Browse photos, concert history, and connections between artists and venues.',
    'Discover {count} artists through an interactive network visualization. See concert dates, venues, and genre connections.',
  ],
  timeline: [
    'Visual timeline of {count} concerts from {year} to present. Click any year to explore shows, artists, and venues.',
    'Browse {count} concerts across {yearSpan} years. Interactive timeline with photos, setlists, and venue data.',
  ],
  genres: [
    'Explore concert history by genre. See how {count} shows break down across musical styles from {year} to present.',
  ],
  geography: [
    'Interactive concert map showing {venueCount} venues across {cityCount} cities. Click markers to explore show history.',
  ],
  default: [
    'Explore {title} - part of an interactive concert archive with {concertCount} shows.',
  ],
}

// ============================================================================
// Code Snippet Templates
// ============================================================================

export const CODE_SNIPPETS = {
  metaTags: (title: string, description: string) => `<!-- Updated Meta Tags -->
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">`,

  redirect301: (fromPath: string, toPath: string) => `// 301 Redirect (Cloudflare Worker)
if (url.pathname === '${fromPath}') {
  return Response.redirect('${toPath}', 301)
}`,

  gone410: (path: string) => `// 410 Gone (Cloudflare Worker)
if (url.pathname === '${path}') {
  return new Response('Gone', { status: 410 })
}`,

  canonical: (url: string) => `<!-- Add to <head> -->
<link rel="canonical" href="${url}">`,

  canonicalDynamic: () => `<!-- Cloudflare Worker for dynamic canonicals -->
const canonicalUrl = new URL(request.url)
canonicalUrl.search = canonicalUrl.searchParams.toString()
const tag = \`<link rel="canonical" href="\${canonicalUrl.href}">\`
html = html.replace('</head>', \`\${tag}</head>\`)`,

  embedWidget: (embedUrl: string) => `<!-- Embed Widget -->
<p>Embed this visualization:</p>
<textarea readonly onclick="this.select()">
&lt;iframe src="${embedUrl}" width="800" height="600"&gt;&lt;/iframe&gt;
</textarea>`,
}

// ============================================================================
// Fix Step Templates
// ============================================================================

export const FIX_STEPS = {
  ctrOptimization: [
    'Open your meta tag configuration file or Cloudflare Worker',
    'Find meta tags for the affected page',
    'Update title to use the suggested format',
    'Update description to be compelling and accurate',
    'Deploy changes',
    '(Optional) Request re-crawl in Google Search Console',
  ],

  bounceReduction: [
    'Open the page and check for errors in browser DevTools',
    'Check search queries driving traffic in GSC',
    'Test the page on mobile devices',
    'Check page load time in PageSpeed Insights',
    'Add clear call-to-action or orientation text',
    'Ensure content matches search intent',
  ],

  zombiePage: [
    'Decide: Is this content valuable and unique?',
    'If YES: Rewrite content, improve title/description, add internal links',
    'If NO (similar content exists): Add 301 redirect to parent page',
    'If NO (no redirect target): Return 410 Gone and remove from sitemap',
    'Request removal in GSC if needed',
  ],

  linkBuilding: [
    'Identify your most engaged pages (low bounce, high time on page)',
    'Create shareable assets (infographics, embeddable widgets)',
    'Share on relevant subreddits (r/dataisbeautiful, r/InternetIsBeautiful)',
    'Post on Hacker News as "Show HN"',
    'Reach out to relevant bloggers and journalists',
    'Add "Embed this" widgets to interactive content',
  ],

  duplicateContent: [
    'Identify the "correct" URL for each duplicate set',
    'Add <link rel="canonical"> to the page head',
    'Update sitemap.xml to only include canonical URLs',
    'Request re-crawl in GSC for affected pages',
  ],

  generic: [
    'Review the affected pages',
    'Identify the root cause',
    'Implement the recommended fix',
    'Verify the fix is working',
  ],
}

// ============================================================================
// Verification Templates
// ============================================================================

export const VERIFICATION = {
  ctr: {
    method: 'Google Search Console → Performance → Pages',
    checkAfter: '3-4 weeks',
  },
  bounce: {
    method: 'GA4 → Reports → Engagement → Pages',
    checkAfter: '2 weeks',
  },
  zombie: {
    method: 'GSC → Pages → Search for URL',
    checkAfter: '4-6 weeks',
  },
  backlinks: {
    method: 'Ahrefs/SEMrush → Backlinks or GSC → Links',
    checkAfter: 'Monthly',
  },
  duplicate: {
    method: 'GSC → Indexing → Pages → "Duplicate without canonical"',
    checkAfter: '2-4 weeks',
  },
  generic: {
    method: 'Re-run /seo analysis',
    checkAfter: '2-4 weeks',
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fill template placeholders with actual values
 */
export function fillTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  let result = template
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return result
}

/**
 * Get templates for a page type
 */
export function getPageType(url: string): keyof typeof TITLE_TEMPLATES {
  if (url.includes('scene=venues')) return 'venues'
  if (url.includes('scene=artists')) return 'artists'
  if (url.includes('scene=timeline')) return 'timeline'
  if (url.includes('scene=genres')) return 'genres'
  if (url.includes('scene=geography')) return 'geography'
  return 'default'
}
