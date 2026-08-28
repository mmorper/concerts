/**
 * Crop-box derivation (#342).
 *
 * The rule was decided from renders on 2026-08-27 and then lived only in `.preview/`
 * throwaway scripts and three prose documents. These pin it in committed code, against the
 * percentages #342 published — arrived at independently of this implementation, which is
 * what makes them worth asserting rather than a restatement of the same arithmetic.
 */
import { describe, it, expect } from 'vitest'
import { AUTHORED_ASPECT, deriveRect, derivationFor, retainedFraction } from '../../scripts/media/derive'

/** The real hero: 2024-08-20-howard-jones-03.jpg, 1152x2048, box drawn flush to both edges. */
const HERO = { x: 0, y: 0.0856, w: 1, h: 0.7034 }
const HERO_SOURCE = { width: 1152, height: 2048 }

const INSTAGRAM = 1080 / 1350
const BAND = 1080 / 820
const SQUARE = 1
const OPEN_GRAPH = 1200 / 630
const STORY = 1080 / 1920

describe('the authored box', () => {
  it('is 4:5, which is what makes one box serve every channel', () => {
    const bw = HERO.w * HERO_SOURCE.width
    const bh = HERO.h * HERO_SOURCE.height
    expect(bw / bh).toBeCloseTo(AUTHORED_ASPECT, 3)
  })
})

describe('deriveRect at 4:5', () => {
  it('is the identity — the box IS the card, nothing discarded', () => {
    // This is the entire case for full bleed over the 1080x820 band. The band asked a
    // portrait rectangle to fill a landscape hole; the 4:5 card asks nothing of it.
    const r = deriveRect(HERO, HERO_SOURCE, INSTAGRAM, 'top')
    expect(r).toEqual({ left: 0, top: 175, width: 1152, height: 1440 })
    expect(r.width / r.height).toBeCloseTo(0.8, 2)
    expect(retainedFraction(HERO, HERO_SOURCE, INSTAGRAM)).toBeCloseTo(1, 3)
  })
})

describe('the vertical rule', () => {
  it('top-derivation starts at the top of the box, keeping the head', () => {
    // The box top is y=0.0856 of 2048 = 175px. A top-derived band starts exactly there.
    const r = deriveRect(HERO, HERO_SOURCE, BAND, 'top')
    expect(r.top).toBe(175)
  })

  it('centre-derivation starts 283px lower — which is where the head was', () => {
    // Not a rounding difference. 283px of a 1440px box is the top 19.7% of the crop, and
    // on a frame shot upward from a crowd that is the subject's head. This is the measured
    // failure that decapitated all four test acts.
    const top = deriveRect(HERO, HERO_SOURCE, BAND, 'top')
    const centre = deriveRect(HERO, HERO_SOURCE, BAND, 'centre')
    expect(centre.top - top.top).toBe(283)
    expect(centre.height).toBe(top.height)
  })

  it('is chosen by tier, not guessed', () => {
    expect(derivationFor(1)).toBe('top')
    expect(derivationFor(2)).toBe('centre')
    expect(derivationFor(3)).toBe('centre')
  })
})

describe('retainedFraction matches the cost table #342 published', () => {
  // #342's own numbers, derived before this module existed. Two independent derivations
  // agreeing is the evidence the geometry is right.
  it('the 1080x820 band shows 60.7% of the box', () => {
    expect(retainedFraction(HERO, HERO_SOURCE, BAND)).toBeCloseTo(0.607, 3)
  })

  it('the 630x630 wide-card square shows 80%', () => {
    expect(retainedFraction(HERO, HERO_SOURCE, SQUARE)).toBeCloseTo(0.8, 3)
  })

  it('the 1200x630 open-graph card shows 42% — the most aggressive slice in the system', () => {
    expect(retainedFraction(HERO, HERO_SOURCE, OPEN_GRAPH)).toBeCloseTo(0.42, 2)
  })
})

describe('a target TALLER than the box', () => {
  it('gives up width from the centre, never height', () => {
    // 9:16. There is no vertical rule to apply — nothing is being discarded vertically —
    // so the full box height survives and the width centres. Stated as a decision, not an
    // accident of the branch order.
    const r = deriveRect(HERO, HERO_SOURCE, STORY, 'top')
    expect(r.top).toBe(175)
    // The box is 1440.56px tall. A 4:5 target computes its height from the width and lands
    // on 1440; this one keeps the box height itself and rounds to 1441. A half pixel, noted
    // so it does not read as a bug the next time someone compares the two.
    expect(r.height).toBe(1441)
    expect(r.width).toBe(810)
    expect(r.left).toBe(171)
  })
})

describe('the rectangle never leaves the source image', () => {
  it('clamps a box drawn flush to the frame', () => {
    // 30 of the 34 published stills have x = 0. sharp throws on a rectangle that overruns
    // by one pixel, and a weekly unattended run must not die on a rounding error.
    for (const aspect of [INSTAGRAM, BAND, SQUARE, OPEN_GRAPH, STORY]) {
      for (const d of ['top', 'centre'] as const) {
        const r = deriveRect({ x: 0, y: 0, w: 1, h: 1 }, HERO_SOURCE, aspect, d)
        expect(r.left).toBeGreaterThanOrEqual(0)
        expect(r.top).toBeGreaterThanOrEqual(0)
        expect(r.left + r.width).toBeLessThanOrEqual(HERO_SOURCE.width)
        expect(r.top + r.height).toBeLessThanOrEqual(HERO_SOURCE.height)
      }
    }
  })
})
