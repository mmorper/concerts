/**
 * The How It Works "Honesty Ladder" (src/components/how-it-works/now-spinning/) runs the TV's real
 * lookup in the browser. Its example records are each chosen to show one rung. This checks, against
 * the real data, that each still lands where its chip says, so an archive change that moves one
 * (a new show where Depeche Mode play "Barrel of a Gun") turns red here instead of quietly
 * showing a different rung than the example was picked for. Swap the example when that happens.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildIndex, readInputs } from '../../scripts/build-now-spinning-index.ts'
import { lookup, unknownTrack, type Loader } from '../../workers/now-spinning/src/identify.ts'
import type { Track } from '../../workers/now-spinning/src/types.ts'
import { EXAMPLES, RUNG_ORDER, rungOf, seenWording } from '../../src/components/how-it-works/now-spinning/ladder'

const DATA = path.join(__dirname, '..', '..', 'public', 'data')
const { manifest, files } = buildIndex(readInputs(DATA))
const all: Record<string, unknown> = { ...files, 'manifest.json': manifest }
const loader: Loader = async (p) => all[p] ?? null

describe('How It Works: honesty ladder', () => {
  it('lists the rungs in the order the screen checks them', () => {
    expect(RUNG_ORDER).toEqual(['unknown', 'heard', 'seen-cover', 'seen', 'cover-of-this', 'covers', 'none'])
  })

  it('contrasts the two careful wordings: every setlist ("never") and a missing setlist ("maybe")', () => {
    const seen = new Set(EXAMPLES.filter((e) => e.expect === 'seen').map((e) => e.wording))
    expect(seen.has('never') && seen.has('maybe')).toBe(true)
  })

  for (const ex of EXAMPLES) {
    it(`${ex.artist}, "${ex.title}" lands on ${ex.expect}${ex.wording ? ` (${ex.wording})` : ''}`, async () => {
      const t = await lookup({ artist: ex.artist, title: ex.title }, loader)
      expect(rungOf(t)).toEqual(ex.wording ? { rung: ex.expect, wording: ex.wording } : { rung: ex.expect })
    })
  }

  it('reads an unreachable archive as the first rung', async () => {
    const t = await lookup({ artist: 'Royal Blood', title: 'Out of the Black' }, async () => null)
    expect(rungOf(t)).toEqual({ rung: 'unknown' })
    expect(rungOf(unknownTrack({ artist: 'X', title: 'Y' })).rung).toBe('unknown')
  })

  it('tells the seen wordings apart by the copy identify.ts writes', () => {
    const base = { screen: 'seen', headline: "You've seen X 2 times.", lines: [] } as unknown as Track
    expect(seenWording({ ...base, lines: ['Something close to it is on 2 of those setlists: “A”.'] })).toBe('near')
    expect(seenWording({ ...base, headline: "You've seen X 2 times, but never heard this one live." })).toBe('never')
    expect(seenWording({ ...base, lines: ["There's no setlist from that night, so maybe you did."] })).toBe('maybe')
  })
})
