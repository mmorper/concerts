import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * #264 — `enrich-artists` was the last surface still trusting the API over the
 * artifact.
 *
 * #255 fixed venues and liner notes but left this script judging freshness purely
 * on `fetchedAt`. Any record under 30 days old was skipped without anyone asking
 * whether its stored image still loads — and image death is a content event with
 * no schedule (#256), so no TTL predicts it. A record enriched on day 1 whose
 * image is unpublished on day 2 served a broken image for the remaining 29 days
 * while the weekly run walked straight past it.
 *
 * The load-bearing rule, as everywhere else: only a definitive 4xx may cause a
 * downgrade. A 5xx or timeout must never let one bad run strip every artist at
 * once.
 */

const getArtistInfo = vi.hoisted(() => vi.fn())
const writeFileSync = vi.hoisted(() => vi.fn())

vi.mock('../../scripts/utils/theaudiodb-client', () => ({
  TheAudioDBClient: class {
    getArtistInfo = getArtistInfo
  },
}))
vi.mock('../../scripts/utils/lastfm-client', () => ({
  LastFmClient: class {
    getArtistInfo = vi.fn(async () => null)
  },
}))
vi.mock('../../scripts/utils/deezer-client', () => ({
  DeezerClient: class {
    getArtistInfo = vi.fn(async () => null)
  },
}))
vi.mock('../../scripts/utils/rate-limiter', () => ({
  RateLimiter: class {
    wait = vi.fn(async () => {})
  },
  delay: vi.fn(async () => {}),
}))
vi.mock('../../scripts/utils/backup', () => ({ createBackup: vi.fn() }))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, existsSync: () => true, readFileSync, writeFileSync }
})

/** Serve concerts.json / artists-metadata.json off the fixtures below. */
let concertsFixture: any
let metadataFixture: any
const readFileSync = vi.hoisted(() => vi.fn())

const { enrichArtists, findDeadImages } = await import('../../scripts/enrich-artists.ts')

const DAY = 24 * 60 * 60 * 1000

/** A record the TTL alone would call fresh. */
function cached(name: string, image: string, ageDays = 1) {
  return {
    name,
    image,
    source: 'theaudiodb',
    fetchedAt: new Date(Date.now() - ageDays * DAY).toISOString(),
  }
}

/** The metadata object handed to `writeFileSync` at the end of the run. */
function written(): any {
  const call = writeFileSync.mock.calls.at(-1)
  return JSON.parse(call![1] as string)
}

function headStatus(fn: (url: string) => number) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const status = fn(String(input))
    return { ok: status >= 200 && status < 300, status } as Response
  })
}

describe('findDeadImages', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns the keys whose image 404s and no others', async () => {
    headStatus((url) => (url.includes('gone') ? 404 : 200))

    const dead = await findDeadImages([
      { key: 'a', url: 'https://cdn.test/gone.jpg' },
      { key: 'b', url: 'https://cdn.test/live.jpg' },
    ])

    expect([...dead]).toEqual(['a'])
  })

  it('leaves a 5xx alone — a blip is not proof an image is gone', async () => {
    headStatus(() => 503)
    expect((await findDeadImages([{ key: 'a', url: 'https://cdn.test/a.jpg' }])).size).toBe(0)
  })

  it('makes no network call for an empty set', async () => {
    expect((await findDeadImages([])).size).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('enrichArtists image validation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getArtistInfo.mockReset()
    writeFileSync.mockReset()
    concertsFixture = { concerts: [{ headliner: 'Gorillaz', openers: [] }] }
    metadataFixture = {}
    readFileSync.mockImplementation((p: string) =>
      JSON.stringify(String(p).includes('concerts.json') ? concertsFixture : metadataFixture)
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('skips a fresh record whose image still loads', async () => {
    metadataFixture = { gorillaz: cached('Gorillaz', 'https://cdn.test/live.jpg') }
    headStatus(() => 200)

    await enrichArtists()

    expect(getArtistInfo).not.toHaveBeenCalled()
    expect(written().gorillaz.image).toBe('https://cdn.test/live.jpg')
  })

  /** The defect: freshness by `fetchedAt` alone hid a dead image for 29 days. */
  it('re-fetches a fresh record whose image is gone, and stores the repair', async () => {
    metadataFixture = { gorillaz: cached('Gorillaz', 'https://cdn.test/gone.jpg') }
    headStatus((url) => (url.includes('gone') ? 404 : 200))
    getArtistInfo.mockResolvedValue({
      name: 'Gorillaz',
      image: 'https://cdn.test/fresh.jpg',
      source: 'theaudiodb',
      fetchedAt: new Date().toISOString(),
    })

    await enrichArtists()

    expect(getArtistInfo).toHaveBeenCalledWith('Gorillaz')
    expect(written().gorillaz.image).toBe('https://cdn.test/fresh.jpg')
  })

  it('does not re-fetch when the image check only returns 5xx', async () => {
    metadataFixture = { gorillaz: cached('Gorillaz', 'https://cdn.test/blip.jpg') }
    headStatus(() => 503)

    await enrichArtists()

    expect(getArtistInfo).not.toHaveBeenCalled()
    expect(written().gorillaz.image).toBe('https://cdn.test/blip.jpg')
  })

  /** Validate what we store, not merely that an API answered. */
  it('drops a newly fetched image that is already dead', async () => {
    metadataFixture = { gorillaz: cached('Gorillaz', 'https://cdn.test/gone.jpg', 60) }
    headStatus((url) => (url.includes('gone') || url.includes('alsogone') ? 404 : 200))
    getArtistInfo.mockResolvedValue({
      name: 'Gorillaz',
      image: 'https://cdn.test/alsogone.jpg',
      bio: 'kept',
      source: 'theaudiodb',
      fetchedAt: new Date().toISOString(),
    })

    await enrichArtists()

    const record = written().gorillaz
    expect(record.image).toBeUndefined()
    expect(record.bio).toBe('kept') // the record survives; only the dead URL goes
  })

  /** No source could repair it, so the client must fall back rather than 404. */
  it('drops a dead cached image when the re-fetch finds nothing', async () => {
    metadataFixture = { gorillaz: cached('Gorillaz', 'https://cdn.test/gone.jpg') }
    headStatus(() => 404)
    getArtistInfo.mockResolvedValue(null)

    await enrichArtists()

    expect(written().gorillaz.image).toBeUndefined()
    expect(written().gorillaz.name).toBe('Gorillaz')
  })

  it('leaves records with no image alone', async () => {
    metadataFixture = {
      gorillaz: { name: 'Gorillaz', source: 'theaudiodb', fetchedAt: new Date().toISOString() },
    }
    headStatus(() => 404)

    await enrichArtists()

    expect(fetch).not.toHaveBeenCalled()
    expect(getArtistInfo).not.toHaveBeenCalled()
  })
})
