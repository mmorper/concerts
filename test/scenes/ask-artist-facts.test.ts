import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { indexConcerts } from '@/hooks/useArchiveData'
import type { Concert } from '@/types/concert'
import { normalizeArtistName } from '@/utils/normalize'

const raw = JSON.parse(readFileSync('public/data/concerts.json', 'utf-8'))
const concerts: Concert[] = raw.concerts ?? raw

describe('indexConcerts', () => {
  const ix = indexConcerts(concerts)

  it('counts the nights an act opened, not just the ones it headlined (#219)', () => {
    // Blancmange headlined Irvine in 1986 and opened for Thompson Twins in Glasgow.
    const shows = ix.byArtist.get('blancmange') ?? []
    expect(shows.map((c) => c.city)).toEqual(['Irvine', 'Glasgow'])
    expect(ix.headlined.get('blancmange')).toHaveLength(1)
    const glasgow = shows.find((c) => c.city === 'Glasgow')!
    expect(ix.opened.get('blancmange')?.has(glasgow.id)).toBe(true)
  })

  it('lists each night once per act: headlined, or on the bill as an opener', () => {
    // Computed independently of indexConcerts, the way the Artists scene does it.
    const expected = new Map<string, Set<string>>()
    const add = (slug: string, id: string) => (expected.get(slug) ?? expected.set(slug, new Set()).get(slug)!).add(id)
    for (const c of concerts) {
      add(c.headlinerNormalized, c.id)
      for (const o of c.openers ?? []) if (o.trim()) add(normalizeArtistName(o.trim()), c.id)
    }
    expect(ix.byArtist.size).toBe(expected.size)
    for (const [slug, ids] of expected) expect(new Set(ix.byArtist.get(slug)?.map((c) => c.id))).toEqual(ids)
  })

  it('keeps each list chronological', () => {
    for (const shows of ix.byArtist.values()) expect(shows.map((c) => c.date)).toEqual([...shows.map((c) => c.date)].sort())
  })
})
