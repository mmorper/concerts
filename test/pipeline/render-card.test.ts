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
    expect(showByline('2024-08-20')).toBe('Mike Morper · 20 August 2024')
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
    expect(actLine(bill, 'The Human League', 3))
      .toBe('The Human League · The Alarm · Dramarama +6\u00a0more')
  })

  it('leads with the act actually in the photograph', async () => {
    // The byline is about that act and so is the frame. A card naming it fourth is
    // describing something other than the picture above it.
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['The Cult', 'Against Me!'], 'Against Me!', 2)).toBe('Against Me! · The Cult')
  })

  it('leaves a short bill exactly as it is', async () => {
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['Howard Jones'], 'Howard Jones', 3)).toBe('Howard Jones')
    expect(actLine(['Haircut 100', 'Howard Jones'], 'Howard Jones', 3))
      .toBe('Howard Jones · Haircut 100')
  })

  it('keeps the count honest rather than trailing off', async () => {
    // "+6 more" is identification, not withholding — DECISIONS.md §3 holds back the
    // interpretation and never the names, and the caption carries the full bill.
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['a', 'b', 'c', 'd'], 'a', 3)).toContain('+1\u00a0more')
  })

  it('survives an unphotographed lead', async () => {
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['A', 'B'], undefined, 2)).toBe('A · B')
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

describe('actLine as a walk-down', () => {
  // The renderer measures and drops names until the pill fits one line, so `show` is the
  // knob that walk turns. These pin its ends.
  it('drops from the END, so the photographed act is the last to go', async () => {
    const { actLine } = await import('../../scripts/syndication/render-card')
    const bill = ['The Cult', 'Against Me!', 'Another Band']
    expect(actLine(bill, 'Against Me!', 1)).toBe('Against Me! +2 more')
  })

  it('never drops below one name — that is identification', async () => {
    const { actLine } = await import('../../scripts/syndication/render-card')
    expect(actLine(['A', 'B', 'C'], 'A', 0)).toBe('A +2 more')
  })

  it('binds "+N more" with a non-breaking space so it cannot split', async () => {
    // "…DRAMARAMA +6 / MORE" was the wrap that prompted the one-line rule. The measured
    // walk-down is what guarantees one line; this guarantees the count is never what breaks
    // it, which no amount of dropping names would fix.
    const { actLine } = await import('../../scripts/syndication/render-card')
    const line = actLine(['A', 'B', 'C'], 'A', 1)
    expect(line).toContain('+2\u00a0more')
    expect(line).not.toContain('+2 more')
  })
})

describe('ACT_PILL', () => {
  it('is DARKENED, because white on the raw category colour fails', async () => {
    // personal #0ea5e9 is 2.77:1 against white — below even large-text AA — and it is 27 of
    // 58 posts. A solid pill at the source value would be worst exactly where it is most
    // common, which is the opposite of a contrast fix.
    const { ACT_PILL } = await import('../../scripts/syndication/render-card')
    const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
    const lum = (h: string) => { const n = h.slice(1); const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
    for (const [category, hex] of Object.entries(ACT_PILL)) {
      const ratio = 1.05 / (lum(hex) + 0.05)
      expect(ratio, `${category} ${hex}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('covers every category the pipeline emits', async () => {
    const { ACT_PILL } = await import('../../scripts/syndication/render-card')
    expect(Object.keys(ACT_PILL).sort()).toEqual(['cultural', 'deep-cut', 'personal'])
  })
})

// ── The renderer draws what the post says ───────────────────────────────────

describe('the tier decision lives in ONE place', () => {
  it('does not re-resolve archive photography behind the pipeline\'s back', async () => {
    // THE BUG. renderCard used to call getShowAsset(lead) itself, which was right when it
    // was the only path to tier 1 — and wrong the moment #416 taught the pipeline to promote
    // a published post. `resolveImage` and `upgradeToOwnPhotography` both REFUSE to put an
    // artist photograph on a venue-subject post, and re-resolving walked past both.
    //
    // Measured live: `universal-amphitheater-5-shows-over-3-decades` is a venue-loyalty post
    // whose stored image is correctly an album cover, and the renderer drew a Howard Jones
    // frame shot at YouTube Theatre in 2024 — different act, different venue, years after
    // Universal was demolished.
    //
    // Asserted on the IMPORT, not on a substring of the body — the body still explains the
    // bug in prose, and a test that greps for the function name matches its own comment.
    // The module cannot call what it does not import.
    const { readFileSync } = await import('fs')
    const src = readFileSync('scripts/syndication/render-card.ts', 'utf8')
    const imports = src.slice(0, src.indexOf('export const CARD_WIDTH'))
    expect(imports).not.toContain('getShowAsset')
  })

  it('takes the url, the crop and the capture date from post.image', async () => {
    // Everything the renderer needs has been on the post since #415, so there is nothing
    // left to re-derive — and deriving it here means the tier rule lives in two places that
    // can disagree.
    const { readFileSync } = await import('fs')
    const src = readFileSync('scripts/syndication/render-card.ts', 'utf8')
    expect(src).toContain('url: post.image.url')
    expect(src).toContain('crop: post.image.crop')
    expect(src).toContain('date: post.image.shotOn')
  })
})
