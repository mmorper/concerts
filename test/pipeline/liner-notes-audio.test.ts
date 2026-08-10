/**
 * Footer audio resolution (#299)
 *
 * A post headlined *"Notorious"* played *Get Lucky* — a Daft Punk record Nile
 * Rodgers played guitar on. The plumbing for the right answer already existed
 * and was dead at both ends: no detector set `suggestedTrack.trackName`, and
 * `resolveAudio` never read it.
 *
 * What makes this worth its own suite is that the fix ADDS a network lookup to
 * a permalinked artifact. A wrong track is permanent, and the wrong track is
 * not hypothetical — measured against live iTunes on 2026-08-10:
 *
 *   Nile Rodgers + "Notorious"          -> Axel F                (wrong title)
 *   Gorillaz     + "Valley of the Pagans" -> by "Sweet Little Band" (wrong artist)
 *
 * The second is a lullaby-cover act and it is the FIRST result, with a correct
 * title and a working preview. Title verification alone would have shipped it.
 * So both guards are load-bearing, and each one has a test below standing on a
 * real observed response rather than an invented one.
 */

import { describe, it, expect } from 'vitest'
import { buildPosts, fetchSubjectTracks } from '../../scripts/liner-notes/curate'
import type { CurateOptions, SongSearch } from '../../scripts/liner-notes/curate'
import type { ScoredFinding } from '../../scripts/liner-notes/types'
import type { NormalizedTrack } from '../../scripts/utils/itunes-client'

// ── Fixtures ────────────────────────────────────────────────────────────────

function finding(overrides: Partial<ScoredFinding> = {}): ScoredFinding {
  return {
    id: 'full-circle-notorious-nile-rodgers-duran-duran',
    detector: 'full-circle',
    category: 'cultural',
    temporality: 'evergreen',
    headline: '"Notorious": Nile Rodgers and Duran Duran, 39 Years Apart',
    dataPoints: {},
    artists: ['nile-rodgers'],
    venues: ['the-observatory'],
    years: [1987, 2026],
    tags: [],
    score: 40,
    scoreBreakdown: {},
    prose: 'I had seen Duran Duran play it in 1987.',
    ...overrides,
  } as unknown as ScoredFinding
}

/**
 * `nile-rodgers` has top tracks and Duran Duran does not, which is the shape
 * that produced the bug: the fallback list is populated for the act that did
 * not record the song.
 */
function options(overrides: Partial<CurateOptions> = {}): CurateOptions {
  return {
    artistsMetadata: {
      'nile-rodgers': { name: 'Nile Rodgers' },
      'duran-duran': { name: 'Duran Duran' },
    },
    artistsTopTracks: {
      'nile-rodgers': {
        name: 'Nile Rodgers',
        tracks: [
          {
            name: 'Get Lucky',
            albumName: 'Random Access Memories',
            previewUrl: 'https://itunes/get-lucky.m4a',
            albumArt: 'https://img/ram.jpg',
          },
        ],
      },
    },
    venuesMetadata: {},
    existingPosts: [],
    publishedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  } as unknown as CurateOptions
}

function track(overrides: Partial<NormalizedTrack> = {}): NormalizedTrack {
  return {
    name: 'Notorious',
    previewUrl: 'https://itunes/notorious.m4a',
    durationMs: 240000,
    albumName: 'Notorious (Deluxe Edition)',
    albumArt: 'https://img/notorious.jpg',
    streamingUrl: 'https://music.apple.com/notorious',
    artistName: 'Duran Duran',
    artistId: 123,
    ...overrides,
  }
}

/** Stub iTunes that records what it was asked and replays canned answers. */
function stubSearch(
  answers: Record<string, NormalizedTrack[] | Error>
): SongSearch & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async searchSong(artistName: string, songTitle: string) {
      const key = `${artistName}::${songTitle}`
      calls.push(key)
      const answer = answers[key]
      if (answer instanceof Error) throw answer
      return answer ?? []
    },
  }
}

const SUBJECT = {
  artistNormalized: 'nile-rodgers',
  trackName: 'Notorious',
  recordedByNormalized: 'duran-duran',
}

// ── resolveAudio, through buildPosts ────────────────────────────────────────

describe('resolveAudio — subject song (#299)', () => {
  it('plays the fetched song rather than the performing artist\'s best-known track', () => {
    const [built] = buildPosts(
      [finding({ suggestedTrack: SUBJECT })],
      options({ subjectTracks: { 'duran-duran::notorious': track() } })
    )

    expect(built.audio?.trackName).toBe('Notorious')
    expect(built.audio?.artistName).toBe('Duran Duran')
    expect(built.audio?.role).toBe('subject')
    // The regression itself.
    expect(built.audio?.trackName).not.toBe('Get Lucky')
  })

  it('finds the song in the cached top tracks when nothing was fetched', () => {
    const [built] = buildPosts(
      [finding({ suggestedTrack: SUBJECT })],
      options({
        artistsTopTracks: {
          'nile-rodgers': {
            name: 'Nile Rodgers',
            tracks: [{ name: 'Get Lucky', previewUrl: 'https://itunes/get-lucky.m4a' }],
          },
          'duran-duran': {
            name: 'Duran Duran',
            // Qualified title: a raw string compare misses this, which is why
            // the match folds both sides.
            tracks: [{ name: 'Notorious (2010 Remaster)', previewUrl: 'https://itunes/n.m4a' }],
          },
        },
      })
    )

    expect(built.audio?.trackName).toBe('Notorious (2010 Remaster)')
    expect(built.audio?.artistName).toBe('Duran Duran')
    expect(built.audio?.role).toBe('subject')
  })

  it('searches the recording artist before the performing artist', () => {
    // Both lists hold a "Notorious". The recording artist's must win — the
    // performing artist's list is where the wrong answer lives.
    const [built] = buildPosts(
      [finding({ suggestedTrack: SUBJECT })],
      options({
        artistsTopTracks: {
          'nile-rodgers': {
            name: 'Nile Rodgers',
            tracks: [{ name: 'Notorious', previewUrl: 'https://itunes/wrong.m4a' }],
          },
          'duran-duran': {
            name: 'Duran Duran',
            tracks: [{ name: 'Notorious', previewUrl: 'https://itunes/right.m4a' }],
          },
        },
      })
    )

    expect(built.audio?.previewUrl).toBe('https://itunes/right.m4a')
  })

  it('falls back to the best-known track, LABELLED, when the song cannot be found', () => {
    const [built] = buildPosts([finding({ suggestedTrack: SUBJECT })], options())

    expect(built.audio?.trackName).toBe('Get Lucky')
    // Playing it is acceptable. Playing it silently is the bug.
    expect(built.audio?.role).toBe('best-known')
  })

  it('leaves audio unlabelled when the post is not about a song', () => {
    // ~15 detectors are about a night, an artist or a venue. Their audio was
    // never wrong and must not acquire an apology.
    const [built] = buildPosts(
      [finding({ suggestedTrack: { artistNormalized: 'nile-rodgers' } })],
      options()
    )

    expect(built.audio?.trackName).toBe('Get Lucky')
    expect(built.audio?.role).toBeUndefined()
  })

  it('ignores a subject song that does not say who recorded it', () => {
    // Unresolvable rather than merely harder: searching the performing act is
    // what returns Axel F.
    const [built] = buildPosts(
      [finding({ suggestedTrack: { artistNormalized: 'nile-rodgers', trackName: 'Notorious' } })],
      options({ subjectTracks: { 'duran-duran::notorious': track() } })
    )

    expect(built.audio?.trackName).toBe('Get Lucky')
    expect(built.audio?.role).toBe('best-known')
  })

  it('emits no audio when the artist has no previewable track at all', () => {
    const [built] = buildPosts(
      [finding({ suggestedTrack: SUBJECT })],
      options({ artistsTopTracks: {} })
    )

    expect(built.audio).toBeUndefined()
  })
})

// ── fetchSubjectTracks ──────────────────────────────────────────────────────

describe('fetchSubjectTracks — verification guards (#299)', () => {
  const artistsMetadata = {
    'duran-duran': { name: 'Duran Duran' },
    gorillaz: { name: 'Gorillaz' },
    chic: { name: 'Chic' },
  }

  it('accepts a title that differs only by a qualifier', async () => {
    const client = stubSearch({
      'Duran Duran::Notorious': [track({ name: 'Notorious (Deluxe Edition)' })],
    })

    const got = await fetchSubjectTracks([finding({ suggestedTrack: SUBJECT })], artistsMetadata, client)

    expect(got['duran-duran::notorious']?.name).toBe('Notorious (Deluxe Edition)')
  })

  it('rejects a result with the wrong title — the Axel F case', async () => {
    const client = stubSearch({
      'Duran Duran::Notorious': [
        track({ name: 'Axel F', artistName: 'Duran Duran', albumName: 'Beverly Hills Cop' }),
      ],
    })

    const got = await fetchSubjectTracks([finding({ suggestedTrack: SUBJECT })], artistsMetadata, client)

    expect(got).toEqual({})
  })

  it('rejects a right-title result by the wrong artist — the Sweet Little Band case', async () => {
    // Verbatim shape of the live response: the lullaby cover is result #1 with
    // a working preview, and the real artist's entry is a different song.
    const client = stubSearch({
      'Gorillaz::The Valley of the Pagans': [
        track({
          name: 'The Valley of the Pagans',
          artistName: 'Sweet Little Band',
          albumName: 'Lullaby Renditions',
        }),
        track({ name: 'Machine Bitez #17', artistName: 'Gorillaz' }),
      ],
    })

    const got = await fetchSubjectTracks(
      [
        finding({
          suggestedTrack: {
            artistNormalized: 'beck',
            trackName: 'The Valley of the Pagans',
            recordedByNormalized: 'gorillaz',
          },
        }),
      ],
      artistsMetadata,
      client
    )

    expect(got).toEqual({})
  })

  it('accepts a differently-billed pressing of the same act', async () => {
    // iTunes bills one recording as "Chic", "Nile Rodgers & Chic" and
    // "CHIC feat. Nile Rodgers". An exact compare rejects real matches.
    const client = stubSearch({
      'Chic::Le Freak': [
        track({ name: 'Le Freak', artistName: 'Nile Rodgers & CHIC', albumName: "C'est Chic" }),
      ],
    })

    const got = await fetchSubjectTracks(
      [
        finding({
          suggestedTrack: {
            artistNormalized: 'chic',
            trackName: 'Le Freak',
            recordedByNormalized: 'chic',
          },
        }),
      ],
      artistsMetadata,
      client
    )

    expect(got['chic::le-freak']?.name).toBe('Le Freak')
  })

  it('does not accept a different act whose name merely contains ours', async () => {
    // Substring containment would take Chicago for Chic.
    const client = stubSearch({
      'Chic::Le Freak': [track({ name: 'Le Freak', artistName: 'Chicago' })],
    })

    const got = await fetchSubjectTracks(
      [
        finding({
          suggestedTrack: {
            artistNormalized: 'chic',
            trackName: 'Le Freak',
            recordedByNormalized: 'chic',
          },
        }),
      ],
      artistsMetadata,
      client
    )

    expect(got).toEqual({})
  })

  it('rejects a verified match with no preview — there is nothing to play', async () => {
    const client = stubSearch({
      'Duran Duran::Notorious': [track({ previewUrl: null })],
    })

    const got = await fetchSubjectTracks([finding({ suggestedTrack: SUBJECT })], artistsMetadata, client)

    expect(got).toEqual({})
  })

  it('skips findings that name no subject song', async () => {
    const client = stubSearch({})

    const got = await fetchSubjectTracks(
      [finding({ suggestedTrack: { artistNormalized: 'nile-rodgers' } }), finding({ suggestedTrack: undefined })],
      artistsMetadata,
      client
    )

    expect(client.calls).toEqual([])
    expect(got).toEqual({})
  })

  it('asks iTunes once for a song two findings share', async () => {
    const client = stubSearch({ 'Duran Duran::Notorious': [track()] })

    await fetchSubjectTracks(
      [
        finding({ id: 'a', suggestedTrack: SUBJECT }),
        finding({ id: 'b', suggestedTrack: SUBJECT }),
      ],
      artistsMetadata,
      client
    )

    expect(client.calls).toEqual(['Duran Duran::Notorious'])
  })
})

describe('fetchSubjectTracks — failure handling (#299)', () => {
  const artistsMetadata = {
    'duran-duran': { name: 'Duran Duran' },
    gorillaz: { name: 'Gorillaz' },
  }

  function blocked(): Error {
    const err = new Error('iTunes returned 403 — client is blocked, not rate limited')
    err.name = 'ITunesBlockedError'
    return err
  }

  it('stops the sweep on a 403 and keeps what it already resolved', async () => {
    // A 403 is a budget, not a rate: every later request fails the same way,
    // and retrying is what earns the block in the first place.
    const client = stubSearch({
      'Duran Duran::Notorious': [track()],
      'Gorillaz::Feel Good Inc.': blocked(),
      'Gorillaz::Clint Eastwood': [track({ name: 'Clint Eastwood', artistName: 'Gorillaz' })],
    })

    const got = await fetchSubjectTracks(
      [
        finding({ id: 'a', suggestedTrack: SUBJECT }),
        finding({
          id: 'b',
          suggestedTrack: {
            artistNormalized: 'gorillaz',
            trackName: 'Feel Good Inc.',
            recordedByNormalized: 'gorillaz',
          },
        }),
        finding({
          id: 'c',
          suggestedTrack: {
            artistNormalized: 'gorillaz',
            trackName: 'Clint Eastwood',
            recordedByNormalized: 'gorillaz',
          },
        }),
      ],
      artistsMetadata,
      client
    )

    expect(got['duran-duran::notorious']).toBeDefined()
    expect(client.calls).toEqual(['Duran Duran::Notorious', 'Gorillaz::Feel Good Inc.'])
  })

  it('skips one failed lookup and carries on', async () => {
    const client = stubSearch({
      'Duran Duran::Notorious': new Error('socket hang up'),
      'Gorillaz::Clint Eastwood': [track({ name: 'Clint Eastwood', artistName: 'Gorillaz' })],
    })

    const got = await fetchSubjectTracks(
      [
        finding({ id: 'a', suggestedTrack: SUBJECT }),
        finding({
          id: 'c',
          suggestedTrack: {
            artistNormalized: 'gorillaz',
            trackName: 'Clint Eastwood',
            recordedByNormalized: 'gorillaz',
          },
        }),
      ],
      artistsMetadata,
      client
    )

    expect(got['duran-duran::notorious']).toBeUndefined()
    expect(got['gorillaz::clint-eastwood']).toBeDefined()
  })

  it('never throws — a failed lookup must not take the weekly run down', async () => {
    const client = stubSearch({ 'Duran Duran::Notorious': blocked() })

    await expect(
      fetchSubjectTracks([finding({ suggestedTrack: SUBJECT })], artistsMetadata, client)
    ).resolves.toEqual({})
  })
})
