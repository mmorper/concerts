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
 */

const fetchPhotoUri = vi.hoisted(() => vi.fn())

vi.mock('../../scripts/utils/google-places-client.js', () => ({
  fetchPhotoUri,
  getVenuePlaceDetails: vi.fn(),
  loadCache: vi.fn(),
  saveCache: vi.fn(),
  getCacheKey: vi.fn(),
  batchFetchVenuePlaces: vi.fn(),
}))

const { resolveLivePhotoUrls } = await import('../../scripts/enrich-venues.ts')

/** Resolve each photo name to a distinct, predictable URL per size. */
function resolveByName() {
  fetchPhotoUri.mockImplementation(async (name: string, px: number) =>
    `https://cdn.test/${name}-${px}.jpg`
  )
}

describe('resolveLivePhotoUrls', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
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

    const urls = await resolveLivePhotoUrls([{ name: 'photoA' }, { name: 'photoB' }])

    expect(urls).toEqual({
      thumbnail: 'https://cdn.test/photoA-400.jpg',
      medium: 'https://cdn.test/photoA-800.jpg',
      large: 'https://cdn.test/photoA-1200.jpg',
    })
  })

  /** The greek-theatre / garden-amp case. */
  it('walks to the next photo when the first resolves but 403s', async () => {
    resolveByName()
    headStatus((url) => (url.includes('photoA') ? 403 : 200))

    const urls = await resolveLivePhotoUrls([{ name: 'photoA' }, { name: 'photoB' }])

    expect(urls?.large).toBe('https://cdn.test/photoB-1200.jpg')
  })

  it('returns null when every candidate is dead, so the caller falls back', async () => {
    resolveByName()
    headStatus(() => 404)

    const urls = await resolveLivePhotoUrls([{ name: 'a' }, { name: 'b' }, { name: 'c' }])

    expect(urls).toBeNull()
  })

  /**
   * A transient 5xx must not cost a venue its photo — otherwise one bad CI run
   * downgrades every venue to the generic fallback at once.
   */
  it('accepts a photo whose check returns 5xx rather than discarding it', async () => {
    resolveByName()
    headStatus(() => 503)

    const urls = await resolveLivePhotoUrls([{ name: 'photoA' }])

    expect(urls?.large).toBe('https://cdn.test/photoA-1200.jpg')
  })

  it('skips a photo whose URI cannot be resolved at all', async () => {
    fetchPhotoUri.mockImplementation(async (name: string, px: number) =>
      name === 'broken' ? null : `https://cdn.test/${name}-${px}.jpg`
    )
    headStatus(() => 200)

    const urls = await resolveLivePhotoUrls([{ name: 'broken' }, { name: 'good' }])

    expect(urls?.large).toBe('https://cdn.test/good-1200.jpg')
  })

  it('stops after a bounded number of candidates', async () => {
    resolveByName()
    headStatus(() => 404)

    const many = Array.from({ length: 10 }, (_, i) => ({ name: `p${i}` }))
    await resolveLivePhotoUrls(many)

    // 5 candidates × 3 sizes
    expect(fetchPhotoUri).toHaveBeenCalledTimes(15)
  })
})
