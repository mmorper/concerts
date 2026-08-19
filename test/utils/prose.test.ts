/**
 * Liner-notes prose emphasis contract tests.
 *
 * Every marked-up string here is real — taken verbatim from
 * public/data/liner-notes.json. The unbalanced cases matter as much as the
 * balanced ones: a stray asterisk must stay literal rather than swallowing the
 * rest of a post into italics.
 */

import { describe, it, expect } from 'vitest'
import { splitEmphasis, stripEmphasis } from '../../src/utils/prose'

describe('splitEmphasis', () => {
  it('splits a marked album title out of the sentence around it', () => {
    expect(
      splitEmphasis('I heard four tracks from *Born to Kill* a full 519 days before')
    ).toEqual([
      { text: 'I heard four tracks from ', emphasis: false },
      { text: 'Born to Kill', emphasis: true },
      { text: ' a full 519 days before', emphasis: false },
    ])
  })

  it('handles punctuation inside a title', () => {
    expect(splitEmphasis("*(Who's Afraid of) The Art of Noise?*")).toEqual([
      { text: "(Who's Afraid of) The Art of Noise?", emphasis: true },
    ])
  })

  it('handles more than one title in a post', () => {
    expect(
      splitEmphasis('between *Tragic Kingdom* and *Rock Steady*, the band changed')
    ).toEqual([
      { text: 'between ', emphasis: false },
      { text: 'Tragic Kingdom', emphasis: true },
      { text: ' and ', emphasis: false },
      { text: 'Rock Steady', emphasis: true },
      { text: ', the band changed', emphasis: false },
    ])
  })

  it('returns unmarked prose as a single plain run', () => {
    const plain = 'Punk rock has always been about the song before the studio catches up.'
    expect(splitEmphasis(plain)).toEqual([{ text: plain, emphasis: false }])
  })

  it('leaves an unpaired asterisk literal', () => {
    const dangling = 'a 5* review, they said'
    expect(splitEmphasis(dangling)).toEqual([{ text: dangling, emphasis: false }])
  })

  it('does not let a marker span a line break', () => {
    const across = 'first line *not a title\nsecond line* still not'
    expect(splitEmphasis(across)).toEqual([{ text: across, emphasis: false }])
  })

  it('handles an empty string', () => {
    expect(splitEmphasis('')).toEqual([])
  })
})

describe('stripEmphasis', () => {
  it('keeps the words and drops the markers', () => {
    expect(stripEmphasis('four tracks from *Born to Kill* a full 519 days')).toBe(
      'four tracks from Born to Kill a full 519 days'
    )
  })

  it('leaves unmarked prose untouched', () => {
    const plain = 'Stories from 42 years of live music'
    expect(stripEmphasis(plain)).toBe(plain)
  })

  it('leaves an unpaired asterisk in place', () => {
    expect(stripEmphasis('a 5* review')).toBe('a 5* review')
  })

  it('round-trips every published post through split and strip', async () => {
    const data = await import('../../public/data/liner-notes.json')
    const posts = (data.default ?? data).posts as Array<{ prose: string }>

    for (const post of posts) {
      // Reassembling the runs must reproduce the prose minus its markers,
      // and no run may still carry one.
      const stripped = stripEmphasis(post.prose)
      expect(stripped).toBe(post.prose.replace(/\*([^*\n]+)\*/g, '$1'))
      for (const run of splitEmphasis(post.prose)) {
        expect(run.text).not.toContain('*')
      }
    }
  })
})
