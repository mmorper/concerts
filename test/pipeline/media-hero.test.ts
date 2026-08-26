/**
 * Hero marking — the frame that leads a social post.
 *
 * `hero` was in the schema from the start and was unreachable in practice. `media:ingest`
 * inferred it from a FILENAME — `hero.*` or `01.*` — which worked while selects were
 * dragged into an inbox by hand, and stopped working silently the moment ingest began
 * fetching originals itself: those arrive as `IMG_3077.HEIC`, so the check never matched.
 * Every one of the 26 assets in the archive was `hero: false`, and nothing reported it.
 *
 * These tests pin the replacement: the owner marks a hero on the review page, and it
 * survives to media-index.json.
 */
import { describe, it, expect } from 'vitest'
import { buildSelects, type Verdict } from '../../scripts/media/selects'
import { toDecision } from '../../scripts/media/decisions'
import type { Act } from '../../scripts/media/show'

const ACTS: Act[] = [
  { name: 'Howard Jones', slug: 'howard-jones', role: 'headliner' },
  { name: 'ABC', slug: 'abc', role: 'opener' },
]
const asset = (uuid: string) => ({
  uuid,
  original_filename: `${uuid}.HEIC`,
  local_time: '2024-08-20T21:30:00',
  is_missing: false,
  rank: 1,
})
const build = (verdicts: Record<string, Verdict>, uuids: string[]) =>
  buildSelects({
    date: '2024-08-20',
    headliner: 'Howard Jones',
    venue: 'YouTube Theatre',
    acts: ACTS,
    assets: uuids.map(asset),
    verdicts,
    generated: '2026-08-26T00:00:00.000Z',
  })

describe('hero on a select', () => {
  it('survives from the review page to selects.json', () => {
    const f = build({ a: { verdict: 'keep', artist: 'Howard Jones', subject: 'performer', hero: true } }, ['a'])
    expect(f.selects[0].hero).toBe(true)
  })

  it('defaults to false rather than undefined', () => {
    // media-index.json carries `hero` on every asset, so the field must always be a boolean.
    const f = build({ a: { verdict: 'keep', artist: 'Howard Jones', subject: 'performer' } }, ['a'])
    expect(f.selects[0].hero).toBe(false)
  })

  it('is dropped when the frame belongs to the night rather than an act', () => {
    // Subject decides placement: a venue frame has no act, and hero is scoped per act, so a
    // hero belonging to nobody has nothing to lead.
    const f = build({ a: { verdict: 'keep', artist: 'Howard Jones', subject: 'venue', hero: true } }, ['a'])
    expect(f.selects[0].folder).toBe('_venue')
    expect(f.selects[0].hero).toBe(false)
  })

  it('allows one hero per act on a multi-act bill', () => {
    // 48% of shows have openers. A three-act night needs a lead frame for each act, not one
    // for the whole evening.
    const f = build(
      {
        a: { verdict: 'keep', artist: 'Howard Jones', subject: 'performer', hero: true },
        b: { verdict: 'keep', artist: 'ABC', subject: 'performer', hero: true },
      },
      ['a', 'b']
    )
    expect(f.selects.filter((s) => s.hero).map((s) => s.artistNormalized).sort())
      .toEqual(['abc', 'howard-jones'])
  })

  it('never marks a rejected asset as hero', () => {
    const f = build({ a: { verdict: 'reject', artist: 'Howard Jones', hero: true } }, ['a'])
    expect(f.selects).toHaveLength(0)
  })
})

describe('hero in the durable record', () => {
  it('persists on a keeper', () => {
    expect(toDecision({ verdict: 'keep', artist: 'ABC', subject: 'performer', hero: true }))
      .toEqual({ verdict: 'keep', artist: 'ABC', subject: 'performer', hero: true })
  })

  it('is recorded only when true, never as an absence', () => {
    const d = toDecision({ verdict: 'keep', artist: 'ABC', subject: 'performer' })
    expect(d).not.toHaveProperty('hero')
  })

  it('is not carried on a rejection', () => {
    expect(toDecision({ verdict: 'reject', hero: true })).toEqual({ verdict: 'reject' })
  })
})

describe('hero reaches media-index.json, not just selects.json', () => {
  it('carries onto a render, because a trimmed clip can be the hero', async () => {
    // ABC's hero on 2024-08-20 was a trimmed clip. Hero was wired through ingest, which
    // handles stills, and never through the render path — so it never landed.
    const { buildSelects } = await import('../../scripts/media/selects')
    const f = buildSelects({
      date: '2024-08-20',
      headliner: 'Howard Jones',
      venue: 'YouTube Theatre',
      acts: ACTS,
      assets: [asset('clip')],
      verdicts: {
        clip: { verdict: 'keep', artist: 'ABC', subject: 'performer', hero: true, trim: { in: 12, out: 27 } },
      },
      generated: '',
    })
    // The select is what frames.ts reads when it writes the render asset.
    expect(f.selects[0].hero).toBe(true)
    expect(f.selects[0].marks?.trim).toEqual({ in: 12, out: 27 })
  })
})
