/**
 * Actionable Playbook Generator
 *
 * Converts insights into step-by-step guides for marketers and webmasters.
 */

import type {
  CorrelationInsight,
  ActionablePlaybook,
  AnalysisContext,
  PageAnalysis,
} from '../types.js'
import { urlMatch, findCrawlPage } from './engine.js'

// ============================================================================
// Playbook Generators
// ============================================================================

/**
 * Generate CTR improvement playbook
 */
function generateCTRPlaybook(
  insight: CorrelationInsight,
  context: AnalysisContext
): ActionablePlaybook {
  const pageUrl = insight.affectedPages[0]
  const page = findCrawlPage(context.crawlData, pageUrl)
  const gscPage = context.gscData?.pages.find((p) => urlMatch(p.page, pageUrl))

  // Generate title suggestions
  const suggestedTitles = generateTitleSuggestions(page, context)
  const suggestedDescriptions = generateDescriptionSuggestions(page, context)

  return {
    insight,
    diagnosis: {
      current: `Title: "${page?.title || 'Unknown'}" | CTR: ${((gscPage?.ctr || 0) * 100).toFixed(1)}%`,
      expected: `CTR of ${(context.avgCTR * 100).toFixed(1)}% or higher at position #${gscPage?.position.toFixed(1) || 'N/A'}`,
      gap: `Missing ${Math.round(((context.avgCTR - (gscPage?.ctr || 0)) / context.avgCTR) * 100)}% of potential clicks`,
    },
    fix: {
      summary: 'Rewrite title and meta description to increase click-through rate',
      steps: [
        'Open your meta tag configuration file or Cloudflare Worker',
        `Find meta tags for: ${pageUrl}`,
        `Update title to: "${suggestedTitles[0] || 'See suggestion below'}"`,
        `Update description to: "${suggestedDescriptions[0] || 'See suggestion below'}"`,
        'Deploy changes',
        '(Optional) Request re-crawl in Google Search Console',
      ],
      codeSnippet: generateMetaTagSnippet(
        suggestedTitles[0] || page?.title || '',
        suggestedDescriptions[0] || page?.description || ''
      ),
    },
    impact: {
      metric: 'Click-through rate',
      estimate: `+${Math.round((context.avgCTR - (gscPage?.ctr || 0)) * (gscPage?.impressions || 0))} clicks/month`,
      timeframe: '2-4 weeks',
    },
    verification: {
      method: 'Google Search Console → Performance → Pages',
      target: `CTR > ${(context.avgCTR * 0.8 * 100).toFixed(1)}%`,
      checkAfter: '3-4 weeks',
    },
  }
}

/**
 * Generate bounce rate reduction playbook
 */
function generateBouncePlaybook(
  insight: CorrelationInsight,
  context: AnalysisContext
): ActionablePlaybook {
  const pageUrl = insight.affectedPages[0]
  const ga4Page = context.ga4Data?.pageMetrics.find((p) =>
    urlMatch(p.pagePath, pageUrl)
  )

  return {
    insight,
    diagnosis: {
      current: `Bounce rate: ${((ga4Page?.bounceRate || 0) * 100).toFixed(0)}%`,
      expected: `Bounce rate < 60% (site average: ${(context.avgBounceRate * 100).toFixed(0)}%)`,
      gap: `${((ga4Page?.bounceRate || 0) - context.avgBounceRate) * 100 > 0 ? '+' : ''}${(((ga4Page?.bounceRate || 0) - context.avgBounceRate) * 100).toFixed(0)}% above average`,
    },
    fix: {
      summary: 'Investigate and fix content or UX issues causing high bounce',
      steps: [
        `Open ${pageUrl} and check for errors in browser DevTools`,
        'Check search queries driving traffic in GSC',
        'Test the page on mobile devices',
        'Check page load time in PageSpeed Insights',
        'Add clear call-to-action or orientation text',
        'Ensure content matches search intent',
      ],
    },
    impact: {
      metric: 'Bounce rate',
      estimate: `+${Math.round((ga4Page?.pageViews || 0) * 0.3)} engaged visitors/month`,
      timeframe: '1-2 weeks',
    },
    verification: {
      method: 'GA4 → Reports → Engagement → Pages',
      target: 'Bounce rate < 60%',
      checkAfter: '2 weeks',
    },
  }
}

/**
 * Generate zombie page handling playbook
 */
function generateZombiePlaybook(
  insight: CorrelationInsight,
  context: AnalysisContext
): ActionablePlaybook {
  const pageUrl = insight.affectedPages[0]
  const gscPage = context.gscData?.pages.find((p) => urlMatch(p.page, pageUrl))

  return {
    insight,
    diagnosis: {
      current: `Impressions: ${gscPage?.impressions || 0}/month, Clicks: ${gscPage?.clicks || 0}/month`,
      expected: 'Either meaningful traffic or removal from index',
      gap: 'Page consumes crawl budget without providing value',
    },
    fix: {
      summary: 'Either improve the page or remove/consolidate it',
      steps: [
        'Decide: Is this content valuable and unique?',
        'If YES: Rewrite content, improve title/description, add internal links',
        'If NO (similar content exists): Add 301 redirect to parent page',
        'If NO (no redirect target): Return 410 Gone and remove from sitemap',
        'Request removal in GSC if needed',
      ],
      codeSnippet: `// 301 Redirect (Cloudflare Worker)
if (url.pathname === '${new URL(pageUrl, 'https://example.com').pathname}') {
  return Response.redirect('https://yoursite.com/parent-page', 301)
}

// OR 410 Gone
if (url.pathname === '${new URL(pageUrl, 'https://example.com').pathname}') {
  return new Response('Gone', { status: 410 })
}`,
    },
    impact: {
      metric: 'Crawl efficiency',
      estimate: 'Improved site authority signal',
      timeframe: '4-6 weeks',
    },
    verification: {
      method: 'GSC → Pages → Search for URL',
      target: 'Page removed or CTR > 1%',
      checkAfter: '4-6 weeks',
    },
  }
}

/**
 * Generate link building outreach playbook
 */
function generateOutreachPlaybook(
  insight: CorrelationInsight,
  context: AnalysisContext
): ActionablePlaybook {
  const referringDomains = context.backlinkData?.metrics.referringDomains || 0

  return {
    insight,
    diagnosis: {
      current: `${referringDomains} referring domains`,
      expected: '15+ referring domains for competitive niches',
      gap: `Need ${Math.max(15 - referringDomains, 5)} more quality backlinks`,
    },
    fix: {
      summary: 'Promote high-engagement content to build backlinks',
      steps: [
        'Identify your most engaged pages (low bounce, high time on page)',
        'Create shareable assets (infographics, embeddable widgets)',
        'Share on relevant subreddits (r/dataisbeautiful, r/InternetIsBeautiful)',
        'Post on Hacker News as "Show HN"',
        'Reach out to relevant bloggers and journalists',
        'Add "Embed this" widgets to interactive content',
      ],
      codeSnippet: `<!-- Embed Widget Example -->
<p>Embed this visualization:</p>
<textarea readonly onclick="this.select()">
&lt;iframe src="https://yoursite.com/?embed=true" width="800" height="600"&gt;&lt;/iframe&gt;
</textarea>`,
    },
    impact: {
      metric: 'Referring domains',
      estimate: '+5-10 domains over 3-6 months',
      timeframe: '3-6 months',
    },
    verification: {
      method: 'Ahrefs/SEMrush → Backlinks or GSC → Links',
      target: '5+ new referring domains',
      checkAfter: 'Monthly',
    },
  }
}

/**
 * Generate duplicate content fix playbook
 */
function generateDuplicatePlaybook(
  insight: CorrelationInsight,
  context: AnalysisContext
): ActionablePlaybook {
  return {
    insight,
    diagnosis: {
      current: `${insight.affectedPages.length} pages flagged as duplicates`,
      expected: 'All pages have clear canonical URLs',
      gap: 'Google may index wrong versions, diluting authority',
    },
    fix: {
      summary: 'Add canonical tags to specify preferred URLs',
      steps: [
        'Identify the "correct" URL for each duplicate set',
        'Add <link rel="canonical"> to the page head',
        'Update sitemap.xml to only include canonical URLs',
        'Request re-crawl in GSC for affected pages',
      ],
      codeSnippet: `<!-- Add to <head> -->
<link rel="canonical" href="https://yoursite.com/canonical-path">

<!-- Cloudflare Worker for dynamic canonicals -->
const canonicalUrl = new URL(request.url)
canonicalUrl.search = canonicalUrl.searchParams.toString()
const tag = \`<link rel="canonical" href="\${canonicalUrl.href}">\`
html = html.replace('</head>', \`\${tag}</head>\`)`,
    },
    impact: {
      metric: 'GSC Coverage warnings',
      estimate: 'Consolidated link equity improves rankings',
      timeframe: '2-4 weeks',
    },
    verification: {
      method: 'GSC → Indexing → Pages → "Duplicate without canonical"',
      target: '0 pages in this category',
      checkAfter: '2-4 weeks',
    },
  }
}

/**
 * Generate generic playbook for unhandled insight types
 */
function generateGenericPlaybook(
  insight: CorrelationInsight,
  context: AnalysisContext
): ActionablePlaybook {
  return {
    insight,
    diagnosis: {
      current: insight.description,
      expected: 'Issue resolved',
      gap: 'Requires investigation',
    },
    fix: {
      summary: insight.recommendation,
      steps: [
        'Review the affected pages',
        'Identify the root cause',
        'Implement the recommended fix',
        'Verify the fix is working',
      ],
    },
    impact: {
      metric: 'SEO health',
      estimate: 'Variable based on fix',
      timeframe: 'Variable',
    },
    verification: {
      method: 'Re-run /seo analysis',
      target: 'Issue no longer flagged',
      checkAfter: '2-4 weeks',
    },
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate title suggestions based on page type and site stats
 */
function generateTitleSuggestions(
  page: PageAnalysis | undefined,
  context: AnalysisContext
): string[] {
  const suggestions: string[] = []
  const stats = context.siteStats
  const url = page?.url || ''

  if (url.includes('scene=venues')) {
    suggestions.push(
      `${stats.venueCount} Concert Venues I've Visited Since ${stats.firstYear} | Interactive Map`
    )
    suggestions.push(
      `Explore ${stats.venueCount} Venues Across ${stats.cityCount} Cities | Concert History`
    )
  } else if (url.includes('scene=artists')) {
    suggestions.push(
      `${stats.artistCount} Artists I've Seen Live | Interactive Concert Archive`
    )
    suggestions.push(
      `Concert History: ${stats.artistCount} Artists, ${stats.concertCount} Shows Since ${stats.firstYear}`
    )
  } else if (url.includes('scene=timeline')) {
    suggestions.push(`${stats.concertCount} Concerts Since ${stats.firstYear} | Visual Timeline`)
    suggestions.push(`My ${stats.yearSpan}-Year Concert Journey: ${stats.concertCount} Shows`)
  } else if (url.includes('scene=genres')) {
    suggestions.push(`Concert Genres Explored | ${stats.concertCount} Shows Across Musical Styles`)
  } else if (url.includes('scene=geography')) {
    suggestions.push(
      `Concert Map: ${stats.venueCount} Venues Across ${stats.cityCount} Cities`
    )
  }

  return suggestions
}

/**
 * Generate description suggestions
 */
function generateDescriptionSuggestions(
  page: PageAnalysis | undefined,
  context: AnalysisContext
): string[] {
  const suggestions: string[] = []
  const stats = context.siteStats
  const url = page?.url || ''

  if (url.includes('scene=venues')) {
    suggestions.push(
      `Explore an interactive network visualization of ${stats.venueCount} venues across ${stats.cityCount} cities. See which artists played where, discover venue connections, and find your next show.`
    )
  } else if (url.includes('scene=artists')) {
    suggestions.push(
      `Interactive archive of ${stats.artistCount} artists I've seen live. Browse photos, concert history, and connections between artists and venues.`
    )
  } else if (url.includes('scene=timeline')) {
    suggestions.push(
      `Visual timeline of ${stats.concertCount} concerts from ${stats.firstYear} to present. Click any year to explore shows, artists, and venues.`
    )
  }

  return suggestions
}

/**
 * Generate meta tag HTML snippet
 */
function generateMetaTagSnippet(title: string, description: string): string {
  return `<!-- Updated Meta Tags -->
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">`
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a playbook for an insight
 */
export function generatePlaybook(
  insight: CorrelationInsight,
  context: AnalysisContext
): ActionablePlaybook {
  switch (insight.type) {
    case 'ctr_opportunity':
      return generateCTRPlaybook(insight, context)
    case 'engagement_mismatch':
      return generateBouncePlaybook(insight, context)
    case 'zombie_page':
      return generateZombiePlaybook(insight, context)
    case 'linkworthy_content':
      return generateOutreachPlaybook(insight, context)
    case 'cannibalizing_pages':
    case 'duplicate_content':
      return generateDuplicatePlaybook(insight, context)
    default:
      return generateGenericPlaybook(insight, context)
  }
}

/**
 * Generate playbooks for all insights
 */
export function generatePlaybooks(
  insights: CorrelationInsight[],
  context: AnalysisContext
): ActionablePlaybook[] {
  return insights.map((insight) => generatePlaybook(insight, context))
}
