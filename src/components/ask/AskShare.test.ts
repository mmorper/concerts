import { describe, it, expect } from 'vitest'
import { answeredOnLabel, canShare, knownShareLink } from './AskShare'
import type { Exchange } from '@/hooks/useAskArchive'
import type { Exhibit, SignedShare } from '@/types/exhibit'

const artist: Exhibit = { kind: 'artist', entity: 'artist', slug: 'the-cure', name: 'The Cure', deepLink: '/?scene=artists&artist=the-cure' }
const song: Exhibit = {
  kind: 'song',
  title: 'A Forest',
  artist: { entity: 'artist', slug: 'the-cure', name: 'The Cure', deepLink: '/?scene=artists&artist=the-cure' },
  dates: ['2023-05-24'],
  album: null,
}
const signed = { snapshot: { v: 1 }, sig: 'x'.repeat(43) } as unknown as SignedShare
const ex = (over: Partial<Exchange>): Exchange => ({ id: 'ex-1', question: 'Have you seen The Cure?', prose: 'Six times.', exhibit: artist, status: 'done', ...over })

describe('which answers get a Share button', () => {
  it('a model answer the Worker signed', () => {
    expect(canShare(ex({ share: signed }))).toBe(true)
  })

  it('a song card, which needs no signature', () => {
    expect(canShare(ex({ exhibit: song }))).toBe(true)
  })

  it('an answer opened from a shared link', () => {
    expect(canShare(ex({ shared: { id: 'Ab3dE5fG7hJ9', answeredOn: '2026-11-02' } }))).toBe(true)
  })

  it('not an unsigned answer, a refusal, or one still streaming', () => {
    expect(canShare(ex({}))).toBe(false)
    expect(canShare(ex({ status: 'refused', share: signed }))).toBe(false)
    expect(canShare(ex({ status: 'streaming', exhibit: song }))).toBe(false)
  })
})

describe('knownShareLink', () => {
  it('a song card links to itself, by the song title as a slug', () => {
    expect(knownShareLink(ex({ exhibit: song }))).toBe('/?scene=ask&artist=the-cure&song=a-forest')
  })

  it('a reopened answer shares on with the link it came from', () => {
    expect(knownShareLink(ex({ shared: { id: 'Ab3dE5fG7hJ9', answeredOn: '2026-11-02' } }))).toBe('/?scene=ask&answer=Ab3dE5fG7hJ9')
  })

  it('a signed answer has no link until it is shared', () => {
    expect(knownShareLink(ex({ share: signed }))).toBeNull()
  })
})

describe('answeredOnLabel', () => {
  it('names the day in the order the site writes dates', () => {
    expect(answeredOnLabel('2026-11-02')).toBe('Answered on November 2, 2026')
  })

  it('says nothing for a date it cannot read', () => {
    expect(answeredOnLabel('not a date')).toBe('')
  })
})
