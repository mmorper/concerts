import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { normalizeArtistName, normalizeVenueName } from '../../src/utils/normalize.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../public/data')

const read = (f: string) => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'))

/**
 * Every key in a metadata file must be reachable from concerts.json via the
 * canonical normalizer.
 *
 * This is the invariant that was missing, and two separate defects hid in the
 * gap:
 *
 *   - #255: records keyed by the enrichment API's display name instead of ours,
 *     leaving 23 unreachable orphans that shipped to clients for five months.
 *   - #259: `enrich-top-tracks.ts` and `useArtistTopTracks.ts` each carried a
 *     private normalizer that deleted special characters where the canonical one
 *     hyphenates them. Eight artists were keyed so that the liner-notes pipeline
 *     could never find them — no album art, no audio preview, and a silently
 *     missing 3-point score.
 *
 * Both were invisible because a missing key looks identical to an artist with no
 * data. Asserting reachability makes the next one fail loudly instead.
 */
describe('metadata key reachability', () => {
  const concertsData = read('concerts.json')
  const concerts = concertsData.concerts ?? concertsData

  const liveArtists = new Set<string>()
  const liveVenues = new Set<string>()
  for (const c of concerts) {
    if (c.headliner) liveArtists.add(normalizeArtistName(c.headliner))
    for (const o of c.openers ?? []) liveArtists.add(normalizeArtistName(o))
    if (c.venue) liveVenues.add(normalizeVenueName(c.venue))
  }

  it.each([
    ['artists-metadata.json', 'artist'],
    ['artists-top-tracks.json', 'artist'],
    ['venues-metadata.json', 'venue'],
  ])('every key in %s resolves to an entity in concerts.json', (file, kind) => {
    const data = read(file)
    const live = kind === 'artist' ? liveArtists : liveVenues
    const unreachable = Object.keys(data).filter((key) => !live.has(key))

    expect(unreachable, `unreachable keys in ${file}: ${unreachable.join(', ')}`).toEqual([])
  })

  /**
   * The complement: an artist in the archive should have a top-tracks record.
   * Not every artist resolves on iTunes, so this asserts the *keying* is sane
   * rather than demanding full coverage — it fails if a whole class of names
   * (those with internal punctuation) goes missing again.
   */
  it('artists with internal punctuation are keyed the same way as any other', () => {
    const topTracks = read('artists-top-tracks.json')
    const metadata = read('artists-metadata.json')

    const punctuated = [...liveArtists].filter((k) => /-[a-z]-/.test(k))
    expect(punctuated.length).toBeGreaterThan(0) // guard: the sample is non-empty

    // Whatever coverage looks like, it must not be systematically worse for
    // punctuated names than for the archive as a whole.
    const covered = (keys: string[], data: Record<string, unknown>) =>
      keys.filter((k) => k in data).length / keys.length

    const allKeys = [...liveArtists]
    expect(covered(punctuated, metadata)).toBeGreaterThanOrEqual(
      covered(allKeys, metadata) * 0.9
    )
    expect(covered(punctuated, topTracks)).toBeGreaterThanOrEqual(
      covered(allKeys, topTracks) * 0.5
    )
  })
})
