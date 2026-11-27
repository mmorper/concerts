/**
 * The How It Works "Memory" diagram (src/components/how-it-works/now-spinning/memory.ts) lights
 * the concerts where a song was on the setlist, and quotes the TV's sentence for it. Both come
 * from the real index here, so the diagram can never show a different number from the TV.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildIndex, readInputs } from '../../scripts/build-now-spinning-index.ts'
import type { Loader } from '../../workers/now-spinning/src/identify.ts'
import { MEMORY_EXAMPLE, memoryOf } from '../../src/components/how-it-works/now-spinning/memory'

const DATA = path.join(__dirname, '..', '..', 'public', 'data')
const { manifest, files } = buildIndex(readInputs(DATA))
const all: Record<string, unknown> = { ...files, 'manifest.json': manifest }
const loader: Loader = async (p) => all[p] ?? null

describe('How It Works: memory diagram', () => {
  it('tidies the example the way the TV does', async () => {
    const m = await memoryOf(MEMORY_EXAMPLE, loader)
    expect(m).not.toBeNull()
    expect(m!.titleKey).not.toMatch(/remaster/i)
    expect(m!.track.screen).toBe('heard')
  })

  it('lights exactly as many concerts as the TV counts', async () => {
    const m = (await memoryOf(MEMORY_EXAMPLE, loader))!
    expect(m.nights.filter((n) => n.heard).length).toBe(m.track.count?.n)
  })

  it('lists the nights oldest first, every one a real show', async () => {
    const m = (await memoryOf(MEMORY_EXAMPLE, loader))!
    const shows = new Set(readInputs(DATA).concerts.map((c) => c.date))
    const dates = m.nights.map((n) => n.date)
    expect([...dates].sort()).toEqual(dates)
    for (const d of dates) expect(shows.has(d), d).toBe(true)
  })

  it('says nothing when the archive can\'t be reached', async () => {
    expect(await memoryOf(MEMORY_EXAMPLE, async () => null)).toBeNull()
  })
})
