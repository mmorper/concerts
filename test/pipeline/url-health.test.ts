import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkUrl, isDead } from '../../scripts/utils/url-health.ts'

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
