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
