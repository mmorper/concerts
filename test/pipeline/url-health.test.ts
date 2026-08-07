import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkUrl, checkUrls, isDead } from '../../scripts/utils/url-health.ts'

/**
 * The liveness check both enrichment scripts and the liner-notes refresh now
 * share (#252, #255).
 *
 * The load-bearing rule is the ok / dead / unknown split: only a definitive 4xx
 * may cause a caller to replace stored data. Treating a 5xx or a network blip as
 * proof an image is gone would let one bad CI run rewrite every record to a
 * fallback at once.
 */
describe('checkUrl', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const respond = (status: number) =>
    vi.mocked(fetch).mockResolvedValue({ ok: status >= 200 && status < 300, status } as Response)

  it('treats a local asset path as fine without any network call', async () => {
    expect(await checkUrl('/images/venues/fallback-active.jpg')).toBe('ok')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports ok for 2xx', async () => {
    respond(200)
    expect(await checkUrl('https://cdn.test/a.jpg')).toBe('ok')
  })

  it.each([400, 403, 404, 410, 451])('reports dead for %i', async (status) => {
    respond(status)
    expect(await checkUrl('https://cdn.test/a.jpg')).toBe('dead')
  })

  it.each([500, 502, 503, 504])('reports unknown for %i — not dead', async (status) => {
    respond(status)
    expect(await checkUrl('https://cdn.test/a.jpg')).toBe('unknown')
  })

  it('reports unknown when the request throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))
    expect(await checkUrl('https://cdn.test/a.jpg')).toBe('unknown')
  })

  it('uses HEAD and carries an abort signal', async () => {
    respond(200)
    await checkUrl('https://cdn.test/a.jpg')
    expect(fetch).toHaveBeenCalledWith(
      'https://cdn.test/a.jpg',
      expect.objectContaining({ method: 'HEAD', signal: expect.any(AbortSignal) })
    )
  })

  it('isDead is true only for a definitive 4xx', async () => {
    respond(404)
    expect(await isDead('https://cdn.test/a.jpg')).toBe(true)
    respond(503)
    expect(await isDead('https://cdn.test/a.jpg')).toBe(false)
    respond(200)
    expect(await isDead('https://cdn.test/a.jpg')).toBe(false)
  })
})

/**
 * The batch form `enrich-artists` sweeps its whole cache with (#264). Serially,
 * a few hundred HEADs is minutes of wall clock for an incidental check.
 */
describe('checkUrls', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const byUrl = (fn: (url: string) => number) =>
    vi.mocked(fetch).mockImplementation(async (input) => {
      const status = fn(String(input))
      return { ok: status >= 200 && status < 300, status } as Response
    })

  it('returns one verdict per URL, in input order', async () => {
    byUrl((url) => (url.endsWith('b.jpg') ? 404 : url.endsWith('c.jpg') ? 500 : 200))

    const health = await checkUrls([
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
      'https://cdn.test/c.jpg',
    ])

    expect(health).toEqual(['ok', 'dead', 'unknown'])
  })

  it('checks every URL exactly once', async () => {
    byUrl(() => 200)
    const urls = Array.from({ length: 25 }, (_, i) => `https://cdn.test/${i}.jpg`)

    expect(await checkUrls(urls, 4)).toHaveLength(25)
    expect(fetch).toHaveBeenCalledTimes(25)
  })

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    vi.mocked(fetch).mockImplementation(async () => {
      peak = Math.max(peak, ++inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
      return { ok: true, status: 200 } as Response
    })

    await checkUrls(
      Array.from({ length: 20 }, (_, i) => `https://cdn.test/${i}.jpg`),
      3
    )

    expect(peak).toBeLessThanOrEqual(3)
  })

  it('handles an empty list without a network call', async () => {
    expect(await checkUrls([])).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})
