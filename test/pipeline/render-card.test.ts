/**
 * Which night is a post about?
 *
 * The 4:5 render itself needs a browser and is exercised by `npm run render:card`. This is
 * the question around it that is easy to get wrong and does not crash when you do — it
 * prints a false claim on a published card instead.
 */
import { describe, it, expect } from 'vitest'
import { postNightOf, showByline } from '../../scripts/liner-notes/image-refs'


describe('postNightOf', () => {
  it('is undefined for a post about a span, so nothing gets disclaimed', () => {
    // THE BUG THE OWNER CAUGHT. `howard-jones-39-years-of-shows` is about six shows across
    // 39 years and carries no `?show=` link. Feeding it resolveAnchorConcert's fallback —
    // "earliest by the lead artist", 1985 — rendered "Mike Morper · August 2024, not the
    // 1985 night" over a photograph that is legitimately one of the six. The card
    // apologised for being on-subject.
    expect(postNightOf({ deepLinks: [
      { label: 'Howard Jones', url: '/?scene=artists&artist=howard-jones', type: 'artist' },
      { label: '1985', url: '/?scene=timeline&year=1985', type: 'timeline' },
    ] } as never)).toBeUndefined()
    expect(showByline('2024-08-20', undefined)).toBe('Mike Morper · 20 August 2024')
  })

  it('reads the night off a setlist deep link when the post has one', () => {
    // The pipeline emits `?show=` only when a setlist backs that night, which is what makes
    // it the durable "this post is about ONE night" signal.
    expect(postNightOf({ deepLinks: [
      { label: 'Setlist', url: '/?scene=artists&artist=howard-jones&show=1985-06-04', type: 'setlist' },
    ] } as never)).toBe('1985-06-04')
  })

  it('survives a post with no deep links at all', () => {
    expect(postNightOf({} as never)).toBeUndefined()
  })
})

// ── The act line ────────────────────────────────────────────────────────────

describe('actLine', () => {
  it('caps a festival bill instead of rendering the whole thing', async () => {
    // THE FAILURE THE MOCK SHEET FOUND. `credit.artists` is every act on the post, and
    // `festival-mega-bill-2018-05-12-the-human-league` has nine. Rendered straight it was
    // five lines of uppercase display type on the wide card, crushing the hook to three —
    // #361's worst-case criterion failing on a real published post.
    const { actLine } = await import('../../scripts/syndication/render-card')
    const bill = ['The Human League', 'The Alarm', 'Dramarama', 'The Motels', 'Naked Eyes',
      'The Untouchables', 'Gene Loves Jezabel', 'When In Rome', 'The Polecats']
    expect(actLine(bill, 'The Human League'))
      .toBe('The Human League · The Alarm · Dramarama +6 more')
  })

  it('leads with the act actually in the photograph', async () => {
    // The byline is about that act and so is the frame. A card naming it fourth is
    // describing something other than the picture above it.
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['The Cult', 'Against Me!'], 'Against Me!')).toBe('Against Me! · The Cult')
  })

  it('leaves a short bill exactly as it is', async () => {
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['Howard Jones'], 'Howard Jones')).toBe('Howard Jones')
    expect(actLine(['Haircut 100', 'Howard Jones'], 'Howard Jones'))
      .toBe('Howard Jones · Haircut 100')
  })

  it('keeps the count honest rather than trailing off', async () => {
    // "+6 more" is identification, not withholding — DECISIONS.md §3 holds back the
    // interpretation and never the names, and the caption carries the full bill.
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['a', 'b', 'c', 'd'], 'a')).toContain('+1 more')
  })

  it('survives an unphotographed lead', async () => {
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['A', 'B'], undefined)).toBe('A · B')
  })
})

// ── The two formats ─────────────────────────────────────────────────────────

describe('FORMATS', () => {
  it('derives the wide card against a SQUARE slot, not the 1.91:1 card', async () => {
    // The whole case for this layout. Deriving at 1.905 would take a letterbox out of the
    // box and discard 58% of it for a slot that wanted none of that; the square slot keeps
    // 80%. The 42% figure belongs to the Open Graph card, which really is a full-bleed
    // 1.91:1 background.
    const { FORMATS } = await import('../../scripts/syndication/render-card')
    expect(FORMATS.wide.slotAspect).toBe(1)
    expect(FORMATS.wide.slot).toEqual({ width: 630, height: 630 })
    expect(FORMATS.wide.width / FORMATS.wide.height).toBeCloseTo(1.905, 2)
  })

  it('derives the 4:5 card against the whole card, where it is the identity', async () => {
    const { FORMATS } = await import('../../scripts/syndication/render-card')
    expect(FORMATS['4x5'].slotAspect).toBeCloseTo(0.8, 3)
  })

  it('gives the wide card a lower ramp, because its column is narrower', async () => {
    const { FORMATS } = await import('../../scripts/syndication/render-card')
    expect(FORMATS.wide.hookSizes[0]).toBeLessThan(FORMATS['4x5'].hookSizes[0])
  })
})
