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
