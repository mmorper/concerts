import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * #255 — `enrich-venues` stored whatever the Places API handed back without
 * checking that it loads.
 *
 * A successful API response is not evidence of a usable image: the API returns a
 * photo URI for a photo that has since been unpublished, and that URI 403s on
 * fetch. The old code fell back only when the *API call* failed, so
 * `greek-theatre` and `garden-amp` were both processed by a successful weekly
 * run and left broken.
 *
 * #315 then added the API-side half of the same principle. A 429 is not a
 * verdict about the photo, and must not be reported as one.
 */

const fetchPhoto = vi.hoisted(() => vi.fn())
const fetchPhotoUri = vi.hoisted(() => vi.fn())

vi.mock('../../scripts/utils/google-places-client.js', () => ({
  fetchPhoto,
  fetchPhotoUri,
  getVenuePlaceDetails: vi.fn(),
  loadCache: vi.fn(),
  saveCache: vi.fn(),
  getCacheKey: vi.fn(),
  batchFetchVenuePlaces: vi.fn(),
}))

const { resolveLivePhotoUrls } = await import('../../scripts/enrich-venues.ts')

/**
 * Resolve each photo name to a realistic Places CDN URL.
 *
 * The `-h{px}` suffix matters: `resolveLivePhotoUrls` fetches only the largest
 * size and derives the other two by rewriting it.
 */
function resolveByName() {
  fetchPhoto.mockImplementation(async (name: string, px: number) => ({
    ok: true,
    uri: `https://cdn.test/${name}=s4800-h${px}`,
  }))
}

describe('resolveLivePhotoUrls', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    fetchPhoto.mockReset()
    fetchPhotoUri.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const headStatus = (fn: (url: string) => number) =>
    vi.mocked(fetch).mockImplementation(async (input) => {
      const status = fn(String(input))
      return { ok: status >= 200 && status < 300, status } as Response
    })

  it('returns the first photo when it loads', async () => {
    resolveByName()
    headStatus(() => 200)

    const result = await resolveLivePhotoUrls([{ name: 'photoA' }, { name: 'photoB' }])

    expect(result).toEqual({
      status: 'ok',
      urls: {
        thumbnail: 'https://cdn.test/photoA=s4800-h400',
        medium: 'https://cdn.test/photoA=s4800-h800',
        large: 'https://cdn.test/photoA=s4800-h1200',
      },
    })
  })

  /**
   * #315 — three API calls per candidate to fetch three sizes of the *same*
   * photo is what drove the run into rate limiting. The CDN honours a rewritten
   * `-h{px}` suffix on the same base, verified against every stored venue, so
   * one call is enough.
   */
  it('spends one photo call per candidate, not one per size', async () => {
    resolveByName()
    headStatus(() => 200)

    await resolveLivePhotoUrls([{ name: 'photoA' }])

    expect(fetchPhoto).toHaveBeenCalledTimes(1)
    expect(fetchPhoto).toHaveBeenCalledWith('photoA', 1200)
    expect(fetchPhotoUri).not.toHaveBeenCalled()
  })

  /** The greek-theatre / garden-amp case. */
  it('walks to the next photo when the first resolves but 403s', async () => {
    resolveByName()
    headStatus((url) => (url.includes('photoA') ? 403 : 200))

    const result = await resolveLivePhotoUrls([{ name: 'photoA' }, { name: 'photoB' }])

    expect(result).toEqual({
      status: 'ok',
      urls: expect.objectContaining({ large: 'https://cdn.test/photoB=s4800-h1200' }),
    })
  })

  it('reports "none" when every candidate is dead, so the caller falls back', async () => {
    resolveByName()
    headStatus(() => 404)

    const result = await resolveLivePhotoUrls([{ name: 'a' }, { name: 'b' }, { name: 'c' }])

    expect(result).toEqual({ status: 'none' })
  })

  /**
   * A transient 5xx must not cost a venue its photo — otherwise one bad CI run
   * downgrades every venue to the generic fallback at once.
   */
  it('accepts a photo whose check returns 5xx rather than discarding it', async () => {
    resolveByName()
    headStatus(() => 503)

    const result = await resolveLivePhotoUrls([{ name: 'photoA' }])

    expect(result).toEqual({
      status: 'ok',
      urls: expect.objectContaining({ large: 'https://cdn.test/photoA=s4800-h1200' }),
    })
  })

  it('skips a photo whose name Google no longer recognises', async () => {
    fetchPhoto.mockImplementation(async (name: string, px: number) =>
      name === 'stale'
        ? { ok: false, reason: 'stale' }
        : { ok: true, uri: `https://cdn.test/${name}=s4800-h${px}` }
    )
    headStatus(() => 200)

    const result = await resolveLivePhotoUrls([{ name: 'stale' }, { name: 'good' }])

    expect(result).toEqual({
      status: 'ok',
      urls: expect.objectContaining({ large: 'https://cdn.test/good=s4800-h1200' }),
    })
  })

  /**
   * #315 — the run on 2026-08-22 hit 227 × HTTP 429 and downgraded ten venues
   * that still had usable photos. Throttling says nothing about content, so it
   * gets its own status and the caller keeps the previous photo.
   */
  it('reports "throttled" rather than "none" when rate limited', async () => {
    fetchPhoto.mockResolvedValue({ ok: false, reason: 'throttled' })
    headStatus(() => 200)

    const result = await resolveLivePhotoUrls([{ name: 'a' }, { name: 'b' }])

    expect(result).toEqual({ status: 'throttled' })
  })

  /** Burning four more candidates against a live rate limit helps nobody. */
  it('stops walking candidates as soon as it is throttled', async () => {
    fetchPhoto.mockResolvedValue({ ok: false, reason: 'throttled' })
    headStatus(() => 200)

    await resolveLivePhotoUrls([{ name: 'a' }, { name: 'b' }, { name: 'c' }])

    expect(fetchPhoto).toHaveBeenCalledTimes(1)
  })

  /** A URL without the expected size directive is not guessed at. */
  it('falls back to per-size API calls when the URL shape is unfamiliar', async () => {
    fetchPhoto.mockResolvedValue({ ok: true, uri: 'https://cdn.test/odd-shape' })
    fetchPhotoUri.mockImplementation(async (name: string, px: number) =>
      `https://cdn.test/${name}/${px}`
    )
    headStatus(() => 200)

    const result = await resolveLivePhotoUrls([{ name: 'photoA' }])

    expect(result).toEqual({
      status: 'ok',
      urls: {
        thumbnail: 'https://cdn.test/photoA/400',
        medium: 'https://cdn.test/photoA/800',
        large: 'https://cdn.test/odd-shape',
      },
    })
  })

  it('stops after a bounded number of candidates', async () => {
    resolveByName()
    headStatus(() => 404)

    const many = Array.from({ length: 10 }, (_, i) => ({ name: `p${i}` }))
    await resolveLivePhotoUrls(many)

    expect(fetchPhoto).toHaveBeenCalledTimes(5)
  })
})
