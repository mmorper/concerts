import { describe, it, expect } from 'vitest'
import { cleanProse } from './prose'

describe('cleanProse — GFM table normalization', () => {
  it('preserves a multi-column table that OPENS the reply (the bug: header must not split)', () => {
    const input =
      '| Date | Venue | Songs |\n|------|-------|-------|\n| Nov 6, 2012 | 9:30 Club | Ring of Fire |'
    // The header row must stay intact on line 0 — pre-fix, a blank line was injected mid-header.
    expect(cleanProse(input).split('\n')[0]).toBe('| Date | Venue | Songs |')
    expect(cleanProse(input)).toBe(input) // already well-formed → unchanged
  })

  it('still inserts a blank line before a table GLUED to a preceding sentence', () => {
    const input = 'Here are the last 5 shows.| Date | Venue |\n|------|-------|\n| Nov 6 | 9:30 Club |'
    const out = cleanProse(input).split('\n')
    expect(out[0]).toBe('Here are the last 5 shows.')
    expect(out[1]).toBe('') // blank line so remark-gfm sees the table on its own line
    expect(out[2]).toBe('| Date | Venue |')
  })

  it('strips the "Open on the site" deep-link footer', () => {
    const input = 'Social Distortion closed with Ring of Fire.\n\n**Open on the site:** [Social Distortion](/?scene=artists)'
    expect(cleanProse(input)).toBe('Social Distortion closed with Ring of Fire.')
  })

  it('leaves plain prose untouched', () => {
    const input = 'Ring of Fire closed every one of these five shows.'
    expect(cleanProse(input)).toBe(input)
  })
})
