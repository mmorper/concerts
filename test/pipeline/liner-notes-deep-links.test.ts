/**
 * Liner notes deep links (#198)
 *
 * Covers the `setlist` member added to the DeepLink union, and asserts the
 * emitted URL against test/fixtures/deep-link-urls.json — the shared contract
 * the SPA, MCP server, ask exhibits and sitemap all check themselves against.
 * A published post's links are the longest-lived URLs the archive emits, so
 * drift here is the most expensive kind.
 */

import { describe, it, expect } from 'vitest'
import { buildDeepLinks } from '../../scripts/liner-notes/curate'
import type { ScoredFinding } from '../../scripts/liner-notes/types'
import type { CurateOptions } from '../../scripts/liner-notes/curate'
import fixture from '../fixtures/deep-link-urls.json'

const options = {
  artistsMetadata: { 'nile-rodgers': { name: 'Nile Rodgers' } },
  artistsTopTracks: {},
  venuesMetadata: { 'pacific-amphitheatre': { name: 'Pacific Amphitheatre' } },
  existingPosts: [],
} as unknown as CurateOptions

function finding(overrides: Partial<ScoredFinding> = {}): ScoredFinding {
  return {
    id: 'test-finding',
    detector: 'longevity',
    category: 'personal',
    temporality: 'evergreen',
    headline: 'A night worth remembering',
    dataPoints: {},
    artists: ['nile-rodgers'],
    venues: ['pacific-amphitheatre'],
    years: [2026],
    tags: [],
    score: 90,
    scoreBreakdown: {},
    ...overrides,
  } as unknown as ScoredFinding
}

describe('buildDeepLinks — setlist links (#198)', () => {
  it('emits a setlist link matching the shared contract fixture', () => {
    const links = buildDeepLinks(
      finding({ concertDate: fixture.setlist.input.date, artists: [fixture.setlist.input.slug] }),
      options
    )
    const setlist = links.find((l) => l.type === 'setlist')
    expect(setlist).toBeDefined()
    expect(setlist!.url).toBe(fixture.setlist.url)
  })

  it('labels the link with a readable date', () => {
    const links = buildDeepLinks(finding({ concertDate: '2026-07-31' }), options)
    expect(links.find((l) => l.type === 'setlist')!.label).toBe('July 31, 2026')
  })

  it('does not slip a day when formatting the label', () => {
    // Parsed at UTC midnight; a naive local parse renders this as Dec 31 west
    // of Greenwich, which would silently mislabel the night.
    const links = buildDeepLinks(finding({ concertDate: '2024-01-01' }), options)
    expect(links.find((l) => l.type === 'setlist')!.label).toBe('January 1, 2024')
  })

  it('emits nothing when the finding is not about one specific night', () => {
    const links = buildDeepLinks(finding(), options)
    expect(links.some((l) => l.type === 'setlist')).toBe(false)
  })

  it('emits nothing when there is no artist to hang the link on', () => {
    const links = buildDeepLinks(finding({ concertDate: '2026-07-31', artists: [] }), options)
    expect(links.some((l) => l.type === 'setlist')).toBe(false)
  })

  it('never keys the link on a concert id', () => {
    const links = buildDeepLinks(finding({ concertDate: '2026-07-31' }), options)
    for (const link of links) {
      expect(link.url).not.toMatch(/show=concert-/)
    }
  })

  it('leaves the existing artist, venue and timeline links untouched', () => {
    // `setlist` is additive — published posts must not change shape.
    const withDate = buildDeepLinks(finding({ concertDate: '2026-07-31' }), options)
    const without = buildDeepLinks(finding(), options)
    const strip = (links: typeof withDate) =>
      links.filter((l) => l.type !== 'setlist').map((l) => `${l.type}:${l.url}`)
    expect(strip(withDate)).toEqual(strip(without))
  })

  it('nests safely with the timeline label rather than clobbering it', () => {
    // The setlist label ("July 31, 2026") *contains* the timeline label
    // ("2026"). That's fine, but only because linkifyProse sorts labels
    // longest-first: the full date is matched and consumed before the bare
    // year is considered, so "on July 31, 2026" links to the setlist while a
    // standalone "2026" elsewhere in the prose still links to the timeline.
    //
    // The invariant that makes it safe is that any containing label must be
    // strictly longer than the label it contains — assert that, not the
    // absence of nesting.
    const links = buildDeepLinks(finding({ concertDate: '2026-07-31' }), options)
    for (const a of links) {
      for (const b of links) {
        if (a === b) continue
        if (a.label.includes(b.label)) {
          expect(a.label.length).toBeGreaterThan(b.label.length)
        }
      }
    }
  })

  it('sorts the setlist label ahead of the year it contains', () => {
    // Mirrors linkifyProse's own ordering, so a regression in label format
    // that broke the nesting would fail here rather than in the rendered prose.
    const links = buildDeepLinks(finding({ concertDate: '2026-07-31' }), options)
    const sorted = [...links].sort((a, b) => b.label.length - a.label.length)
    const setlistIdx = sorted.findIndex((l) => l.type === 'setlist')
    const timelineIdx = sorted.findIndex((l) => l.type === 'timeline')
    expect(setlistIdx).toBeLessThan(timelineIdx)
  })
})
