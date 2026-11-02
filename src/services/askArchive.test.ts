import { describe, it, expect, vi, afterEach } from 'vitest'
import { streamAskTurn } from './askArchive'
import type { AskEvent } from '@/types/exhibit'

const sse = (...frames: Array<[string, unknown]>) =>
  new Response(frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''), { status: 200 })

afterEach(() => vi.unstubAllGlobals())

describe('streamAskTurn — follow-up chips', () => {
  const artist = { kind: 'artist', entity: 'artist', slug: 'the-cure', name: 'The Cure', deepLink: '/?scene=artists&artist=the-cure' }
  const chip = { label: 'Your first The Cure show', tool: 'get_concert_setlist', input: { artist: 'The Cure', date: '1986-08-21' } }

  it('takes the chips off the card, so the exhibit is only the card', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(['exhibit', { ...artist, chips: [chip] }], ['done', { fraction: 0 }])))
    const events: AskEvent[] = []
    await streamAskTurn([{ role: 'user', text: 'The Cure' }], (e) => events.push(e), { ensureSession: async () => 'tok' })
    const ex = events.find((e) => e.type === 'exhibit')
    expect(ex).toEqual({ type: 'exhibit', exhibit: artist, chips: [chip] })
  })

  it('drops a malformed chip and leaves a card with none as it was', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(['exhibit', { ...artist, chips: [{ label: 3 }] }])))
    const events: AskEvent[] = []
    await streamAskTurn([{ role: 'user', text: 'The Cure' }], (e) => events.push(e), { ensureSession: async () => 'tok' })
    expect(events[0]).toEqual({ type: 'exhibit', exhibit: artist })
  })

  it('sends a clicked chip back with its turn', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => sse(['done', { fraction: 0 }]))
    vi.stubGlobal('fetch', fetchMock)
    const turn = { role: 'user' as const, text: chip.label, chip: { tool: chip.tool, input: chip.input } }
    await streamAskTurn([turn], () => {}, { ensureSession: async () => 'tok' })
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body.turns[0]).toEqual(turn)
  })
})
