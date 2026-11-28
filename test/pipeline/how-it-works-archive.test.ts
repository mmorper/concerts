/**
 * "How the Archive Is Built" (src/components/how-it-works/archive/) shows live data, but each
 * diagram is anchored on hand-picked examples. These check, against the real published data, that
 * every example still exists, so a data change can't leave a diagram empty. Properties, not
 * counts: the counts on the page are computed live.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PICKS as ROW_PICKS } from '../../src/components/how-it-works/archive/ThreeWords'
import { PICKS as VENUE_PICKS } from '../../src/components/how-it-works/archive/MapStep'
import { PICKS as SOUND_PICKS } from '../../src/components/how-it-works/archive/SoundStep'
import { PICKS as NIGHT_PICKS } from '../../src/components/how-it-works/archive/SetlistStep'
import { NOT_FROM_DEEZER } from '../../src/components/how-it-works/archive/FaceStep'

const ROOT = path.join(__dirname, '..', '..')
const json = (f: string) => JSON.parse(readFileSync(path.join(ROOT, 'public', 'data', f), 'utf8'))
const concerts: { date: string; headliner: string; venueNormalized: string }[] = json('concerts.json').concerts

describe('How It Works: How the Archive Is Built', () => {
  it('every example concert row exists', () => {
    for (const p of ROW_PICKS) expect(concerts.some((c) => c.date === p.date), p.date).toBe(true)
  })

  it('the opening picture’s row (Social Distortion, The Belasco, 2024-12-06) exists as drawn', () => {
    const c = concerts.find((x) => x.date === '2024-12-06')
    expect(c?.headliner).toBe('Social Distortion')
    expect(c?.venueNormalized).toBe('the-belasco')
  })

  it('every example venue has coordinates', () => {
    const venues = json('venues-metadata.json')
    for (const slug of VENUE_PICKS) expect(venues[slug]?.location, slug).toBeDefined()
  })

  it('every example band has previews', () => {
    const tops = json('artists-top-tracks.json')
    for (const slug of SOUND_PICKS) expect(tops[slug]?.tracks?.some((t: { previewUrl?: string }) => t.previewUrl), slug).toBe(true)
  })

  it('every example night has a setlist with songs', () => {
    const entries: { date: string; artistName: string; setlist?: { sets?: { set?: { song?: unknown[] }[] } } }[] = json('setlists-cache.json').entries
    for (const p of NIGHT_PICKS) {
      const e = entries.find((x) => x.date === p.date && x.artistName === p.artist)
      expect((e?.setlist?.sets?.set ?? []).some((s) => (s.song ?? []).length), `${p.artist} ${p.date}`).toBe(true)
    }
  })

  it('Brian Setzer’s billings are folded, and Stray Cats kept apart, as the diagram says', () => {
    const a = json('artist-aliases.json')
    expect(a.sameAct.find((g: { canonical: string }) => g.canonical === 'brian-setzer')?.billings.length).toBeGreaterThan(1)
    expect(a.sharesMember.some((s: { acts: string[] }) => s.acts.includes('brian-setzer') && s.acts.includes('stray-cats'))).toBe(true)
  })

  it('the "never asked of Deezer" list matches the exception lists in scripts/enrich-artists.ts', () => {
    const src = readFileSync(path.join(ROOT, 'scripts', 'enrich-artists.ts'), 'utf8')
    const setOf = (name: string) => {
      const m = src.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]\\)`))
      return (m?.[1].match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1))
    }
    const script = [...setOf('DEEZER_NAMESAKES'), ...setOf('DEEZER_WRONG_PICTURES')].sort()
    expect(script.length).toBeGreaterThan(0)
    expect(NOT_FROM_DEEZER.map((n) => n.slug).sort()).toEqual(script)
  })
})
