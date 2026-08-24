import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import worker from './worker.js'

/**
 * This Worker sits in front of **every request to concerts.morperhaus.org**, so
 * its blast radius is the whole site rather than the feature it implements. The
 * tests here are weighted accordingly: most of them assert that traffic it
 * should not touch passes through untouched, because that is the failure that
 * takes the site down for humans.
 *
 * Meta-tag *content* is deliberately under-tested — it degrades to the generic
 * card, which is a cosmetic problem. Passthrough is not.
 */

const HTML = '<html><head><title>Morperhaus Concert Archives</title></head><body></body></html>'

// The real `index.html` head, trimmed to the tags the injector rewrites. `HTML`
// alone carries no <meta>, so the replace would no-op and a description
// assertion against it would pass on an empty match rather than on content.
const PAGE =
  '<html><head><title>Morperhaus Concert Archives</title>' +
  '<meta name="description" content="A visual love letter to 5+ decades of live music." />' +
  '<meta property="og:title" content="Morperhaus Concert Archives" />' +
  '<meta property="og:description" content="A visual love letter to 5+ decades of live music." />' +
  '<meta property="og:url" content="https://concerts.morperhaus.org/" />' +
  '<meta property="og:image" content="https://concerts.morperhaus.org/og-image.jpg" />' +
  '<meta property="twitter:description" content="A visual love letter to 5+ decades of live music." />' +
  '<meta property="twitter:image" content="https://concerts.morperhaus.org/og-image.jpg" />' +
  '</head><body></body></html>'

const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

function htmlResponse(body = HTML, init = {}) {
  // `...init` must come FIRST. Spreading it last overwrote the merged headers
  // with init.headers alone, dropping Content-Type — so the worker saw a
  // non-HTML response and passed it through. The header-preservation test then
  // passed by exercising passthrough rather than the code it names, and a
  // mutation that stopped preserving headers went undetected.
  return new Response(body, {
    ...init,
    status: init.status ?? 200,
    headers: { 'Content-Type': 'text/html;charset=UTF-8', ...(init.headers ?? {}) },
  })
}

function req(path, { ua = GOOGLEBOT, accept = 'text/html' } = {}) {
  return new Request(`https://concerts.morperhaus.org${path}`, {
    headers: { 'User-Agent': ua, Accept: accept },
  })
}

const ctx = { waitUntil: vi.fn() }

describe('meta-injector worker', () => {
  beforeEach(() => {
    // mockImplementation, not mockResolvedValue: a Response body can only be read
    // once, so returning the *same* object made every injector hit "body is
    // locked" and pass via its catch block instead of the path under test.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => htmlResponse()))
    // caches.default — the worker's same-origin JSON cache.
    vi.stubGlobal('caches', {
      default: { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) },
    })
    ctx.waitUntil.mockClear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ── Passthrough: the failures that would break the site ────────────────────

  describe('passthrough', () => {
    it('passes a human straight through without reading the body', async () => {
      const res = await worker.fetch(req('/?scene=artists&artist=depeche-mode', { ua: CHROME }), {}, ctx)

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(await res.text()).toBe(HTML)
      // No meta injection, no extra origin fetches for JSON.
      expect(ctx.waitUntil).not.toHaveBeenCalled()
    })

    it.each([
      '/data/concerts.json',
      '/assets/index-abc123.js',
      '/favicon.ico',
      '/sitemap.xml',
      '/robots.txt',
      '/images/venues/fallback.jpg',
    ])('passes %s through even for a bot', async (path) => {
      // Served AS text/html on purpose. If the response were non-HTML, the
      // content-type check downstream would pass it through anyway and this test
      // would hold even with the asset guard deleted — which is exactly how a
      // mutation removing that guard initially survived.
      vi.mocked(fetch).mockImplementation(async () =>
        htmlResponse('asset-body-not-a-page')
      )

      const res = await worker.fetch(req(path), {}, ctx)

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(await res.text()).toBe('asset-body-not-a-page')
    })

    it('passes through a non-HTML response', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )

      const res = await worker.fetch(req('/liner-notes'), {}, ctx)

      expect(await res.text()).toBe('{"ok":true}')
    })

    it('passes through a non-OK response rather than injecting into an error page', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('not found', { status: 404, headers: { 'Content-Type': 'text/html' } })
      )

      const res = await worker.fetch(req('/liner-notes'), {}, ctx)

      expect(res.status).toBe(404)
      expect(await res.text()).toBe('not found')
    })
  })

  // ── Bot detection ──────────────────────────────────────────────────────────

  describe('bot detection', () => {
    it.each([
      ['Googlebot', GOOGLEBOT],
      ['facebookexternalhit', 'facebookexternalhit/1.1'],
      ['Twitterbot', 'Twitterbot/1.0'],
      ['Slackbot', 'Slackbot-LinkExpanding 1.0'],
      ['ClaudeBot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0)'],
      ['GPTBot', 'Mozilla/5.0 (compatible; GPTBot/1.0)'],
    ])('treats %s as a bot', async (_name, ua) => {
      await worker.fetch(req('/', { ua }), {}, ctx)
      // A bot on an HTML route triggers the JSON fetch for scene meta.
      expect(fetch.mock.calls.length).toBeGreaterThan(1)
    })

    it('does not treat an empty User-Agent as a bot', async () => {
      await worker.fetch(req('/', { ua: '' }), {}, ctx)
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  // ── Injection actually happens ─────────────────────────────────────────────

  describe('injection', () => {
    /** Serve the page, and real-shaped JSON for whatever the injector asks for. */
    function serveWithData(data) {
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = String(input?.url ?? input)
        if (url.includes('/data/')) {
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return htmlResponse()
      })
    }

    it('rewrites the title for a bot on a liner-note permalink', async () => {
      serveWithData({
        posts: [
          {
            slug: 'my-post',
            headline: 'A Very Specific Headline',
            prose: 'Some prose about the show.',
            image: { url: 'https://cdn.test/x.jpg', alt: 'x', source: 'venue' },
            category: 'personal',
            publishedAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      })

      const res = await worker.fetch(req('/liner-notes/my-post'), {}, ctx)
      const body = await res.text()

      expect(body).toContain('A Very Specific Headline')
      // The generic title must be gone, or the card is still the default one.
      expect(body).not.toMatch(/<title>Morperhaus Concert Archives<\/title>/)
    })

    it('leaves the same page untouched for a human', async () => {
      serveWithData({ posts: [{ slug: 'my-post', headline: 'A Very Specific Headline' }] })

      const res = await worker.fetch(req('/liner-notes/my-post', { ua: CHROME }), {}, ctx)
      const body = await res.text()

      expect(body).toBe(HTML)
      expect(body).not.toContain('A Very Specific Headline')
    })
  })

  // ── Artist counts ──────────────────────────────────────────────────────────

  describe('artist meta counts billings, not headliners', () => {
    // The one exception to the "content is deliberately under-tested" rule at the
    // top of this file. A wrong count is not a card that degrades — it is a card
    // that states a confident falsehood, and it stated one for 150 of the
    // archive's 257 artists. Richard Cheese shared as "0 concerts from various
    // years" under a photo of the night he played.
    const OPENED_ONLY = {
      id: 'concert-55',
      date: '2002-12-21',
      headliner: 'The Brian Setzer Orchestra',
      headlinerNormalized: 'the-brian-setzer-orchestra',
      openers: ['Richard Cheese'],
      venue: 'Universal Amphitheater',
      cityState: 'Los Angeles, California',
      venueNormalized: 'universal-amphitheater',
      year: 2002,
    }

    /** Route each /data/ file the artist injector asks for to its own fixture. */
    function serveArchive({ concerts, artists = {}, aliases = { sameAct: [] } }) {
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = String(input?.url ?? input)
        const json = (body) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        if (url.includes('/data/concerts.json')) return json({ concerts })
        if (url.includes('/data/artists-metadata.json')) return json(artists)
        if (url.includes('/data/artist-aliases.json')) return json(aliases)
        return htmlResponse(PAGE)
      })
    }

    const descriptionOf = (body) =>
      body.match(/<meta name="description" content="([^"]*)" \/>/)?.[1]

    it('counts a show the artist opened', async () => {
      serveArchive({
        concerts: [OPENED_ONLY],
        artists: { 'richard-cheese': { name: 'Richard Cheese' } },
      })

      const res = await worker.fetch(req('/?scene=artists&artist=richard-cheese'), {}, ctx)
      const body = await res.text()

      expect(descriptionOf(body)).toBe(
        '1 concert from 2002. Explore setlists, tour history, and venue details for Richard Cheese.'
      )
      expect(body).not.toContain('0 concerts')
      expect(body).not.toContain('various years')
    })

    it('counts headlining and opening shows together', async () => {
      // The English Beat headlines five nights and opens five more. Counting
      // only the marquee halved it.
      serveArchive({
        concerts: [
          { headlinerNormalized: 'the-english-beat', headliner: 'The English Beat', openers: [], year: 2003 },
          { headlinerNormalized: 'squeeze', headliner: 'Squeeze', openers: ['The English Beat'], year: 2024 },
        ],
        artists: { 'the-english-beat': { name: 'The English Beat' } },
      })

      const res = await worker.fetch(req('/?scene=artists&artist=the-english-beat'), {}, ctx)

      expect(descriptionOf(await res.text())).toContain('2 concerts from 2003-2024')
    })

    it('says the year once when every show is in the same year', async () => {
      serveArchive({
        concerts: [OPENED_ONLY],
        artists: { 'richard-cheese': { name: 'Richard Cheese' } },
      })

      const body = await (
        await worker.fetch(req('/?scene=artists&artist=richard-cheese'), {}, ctx)
      ).text()

      expect(body).toContain('from 2002.')
      expect(body).not.toContain('2002-2002')
    })

    it('collapses same-act billings and names the merged act', async () => {
      // `?artist=the-brian-setzer-orchestra` is in the sitemap and in published
      // liner notes, so the card it unfurls has to be the merged one (#227).
      serveArchive({
        concerts: [
          { headlinerNormalized: 'the-brian-setzer-orchestra', headliner: 'The Brian Setzer Orchestra', openers: [], year: 1995 },
          { headlinerNormalized: 'brian-setzer', headliner: 'Brian Setzer', openers: [], year: 2024 },
        ],
        artists: { 'the-brian-setzer-orchestra': { name: 'The Brian Setzer Orchestra' } },
        aliases: {
          sameAct: [
            {
              canonical: 'brian-setzer',
              name: 'Brian Setzer',
              billings: ['brian-setzer', 'the-brian-setzer-orchestra'],
            },
          ],
        },
      })

      const body = await (
        await worker.fetch(req('/?scene=artists&artist=the-brian-setzer-orchestra'), {}, ctx)
      ).text()

      expect(descriptionOf(body)).toContain('2 concerts from 1995-2024')
      expect(body).toContain('<title>Brian Setzer | Morperhaus Concert Archives</title>')
    })

    it('keeps a correct billing count when the aliases file is unavailable', async () => {
      // Aliases only ever add knowledge. Losing them must not resurrect the zero.
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = String(input?.url ?? input)
        if (url.includes('/data/artist-aliases.json')) return new Response('nope', { status: 500 })
        if (url.includes('/data/concerts.json')) {
          return new Response(JSON.stringify({ concerts: [OPENED_ONLY] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (url.includes('/data/artists-metadata.json')) {
          return new Response(JSON.stringify({ 'richard-cheese': { name: 'Richard Cheese' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return htmlResponse(PAGE)
      })

      const body = await (
        await worker.fetch(req('/?scene=artists&artist=richard-cheese'), {}, ctx)
      ).text()

      expect(descriptionOf(body)).toContain('1 concert from 2002')
    })

    it('counts the artists scene roster as everyone who played', async () => {
      // 257 billings, not the 107 distinct headliners — the figure the README,
      // llm.txt and the scene footer all publish (#295).
      serveArchive({
        concerts: [
          { headlinerNormalized: 'squeeze', headliner: 'Squeeze', openers: ['The English Beat', 'Boy George'], venueNormalized: 'the-forum', year: 2024 },
        ],
      })

      const body = await (await worker.fetch(req('/?scene=artists'), {}, ctx)).text()

      expect(body).toContain('<title>3 Artists')
      expect(descriptionOf(body)).toContain('Browse 3 artists')
    })
  })

  // ── Route dispatch ─────────────────────────────────────────────────────────

  describe('route dispatch', () => {
    it('does not treat /liner-notes/rss as a post slug', async () => {
      // The RSS feed lives under the same prefix as post permalinks; treating it
      // as a slug would look up a post that does not exist.
      const res = await worker.fetch(req('/liner-notes/rss'), {}, ctx)
      const body = await res.text()

      expect(body).not.toContain('undefined')
      expect(res.status).toBe(200)
    })

    it('still returns valid HTML when origin JSON is unavailable', async () => {
      // First call = the page itself; subsequent = the JSON the injector wants.
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = String(input?.url ?? input)
        if (url.includes('/data/')) return new Response('nope', { status: 500 })
        return htmlResponse()
      })

      const res = await worker.fetch(req('/liner-notes/some-post'), {}, ctx)

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('<html>')
    })

    it('degrades to the original HTML when the injector throws', async () => {
      vi.mocked(fetch).mockImplementation(async (input) => {
        const url = String(input?.url ?? input)
        if (url.includes('/data/')) throw new Error('ECONNRESET')
        return htmlResponse()
      })

      const res = await worker.fetch(req('/?scene=artists&artist=depeche-mode'), {}, ctx)

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('<html>')
    })
  })

  // ── Response integrity ─────────────────────────────────────────────────────

  describe('response integrity', () => {
    it('preserves origin headers such as CSP and CORS', async () => {
      vi.mocked(fetch).mockResolvedValue(
        htmlResponse(HTML, {
          headers: {
            'Content-Security-Policy': "default-src 'self'",
            'Access-Control-Allow-Origin': '*',
            'X-Frame-Options': 'DENY',
          },
        })
      )

      const res = await worker.fetch(req('/'), {}, ctx)

      expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'self'")
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it('returns HTML content-type and a cache header for bots', async () => {
      const res = await worker.fetch(req('/'), {}, ctx)

      expect(res.headers.get('Content-Type')).toContain('text/html')
      expect(res.headers.get('Cache-Control')).toContain('max-age=3600')
    })

    it('never returns an empty body for an HTML route', async () => {
      const res = await worker.fetch(req('/how-it-works'), {}, ctx)
      const body = await res.text()

      expect(body.length).toBeGreaterThan(0)
      expect(body).toContain('</html>')
    })
  })
})
