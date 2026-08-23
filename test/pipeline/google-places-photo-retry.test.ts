import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * #315 — Google rotates Places photo resource names, and the client had no
 * answer for either half of what that causes.
 *
 * Measured on 2026-08-22, one 79-venue run: **872 × HTTP 400** from cached
 * names Google no longer recognised, and **227 × HTTP 429** from the traffic
 * spent rediscovering that. Ten venues lost a photo they still had, because a
 * 429 was handled exactly like a 404.
 */

const { fetchPhoto } = await import('../../scripts/utils/google-places-client.ts')

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response

describe('fetchPhoto', () => {
  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn())
    // Backoff sleeps are real timers; collapse them so the suite stays fast.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)
  })
  afterEach(() => {
    // One case deletes the key; restore it so a later suite sharing this
    // worker does not inherit an unconfigured environment.
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns the photo URI on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ photoUri: 'https://cdn.test/a=s4800-h1200' }))

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toEqual({
      ok: true,
      uri: 'https://cdn.test/a=s4800-h1200',
    })
  })

  /**
   * The rotated-name case. `400 INVALID_ARGUMENT — "The photo resource in the
   * request is invalid"` is what every name cached on 2026-07-13 returned.
   */
  it('reports a 400 as stale without retrying', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: { status: 'INVALID_ARGUMENT' } }, 400))

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toEqual({
      ok: false,
      reason: 'stale',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports a 403 as stale — the photo is gone, not deferred', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 403))

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toEqual({
      ok: false,
      reason: 'stale',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 and succeeds when the limit clears', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ photoUri: 'https://cdn.test/a=s4800-h1200' }))

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toEqual({
      ok: true,
      uri: 'https://cdn.test/a=s4800-h1200',
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('retries a 5xx as transient', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ photoUri: 'https://cdn.test/a=s4800-h1200' }))

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toMatchObject({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  /**
   * The distinction the caller depends on: a persistent 429 must never be
   * reported as a fact about the photo, or `enrich-venues` writes a placeholder
   * over a working image.
   */
  it('gives up on a persistent 429 as throttled, never as stale', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 429))

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toEqual({
      ok: false,
      reason: 'throttled',
    })
    // First attempt plus PHOTO_MAX_RETRIES.
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it('treats a network error as throttled rather than a content verdict', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNRESET'))

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toEqual({
      ok: false,
      reason: 'throttled',
    })
  })

  it('honours Retry-After when Google sends one', async () => {
    const delays: number[] = []
    vi.mocked(setTimeout).mockImplementation(((fn: () => void, ms?: number) => {
      delays.push(ms ?? 0)
      fn()
      return 0 as unknown as NodeJS.Timeout
    }) as typeof setTimeout)

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(jsonResponse({ photoUri: 'https://cdn.test/a=s4800-h1200' }))

    await fetchPhoto('places/p/photos/x', 1200)

    expect(delays[0]).toBe(2000)
  })

  /** The key belongs in the header, never in a URL that lands in logs. */
  it('sends the key as a header and keeps it out of the URL', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ photoUri: 'https://cdn.test/a=s4800-h1200' }))

    await fetchPhoto('places/p/photos/x', 1200)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).not.toContain('test-key')
    expect((init?.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('test-key')
  })

  it('reports "unconfigured" when no key is set', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY

    await expect(fetchPhoto('places/p/photos/x', 1200)).resolves.toEqual({
      ok: false,
      reason: 'unconfigured',
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
