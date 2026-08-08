/**
 * Tests for scripts/validate-docs.ts (#284)
 *
 * The point of this validator is that it goes red when prose stops matching
 * the code. So the tests that matter are the ones that break something and
 * assert it is caught — a green run against the real repo proves very little
 * on its own, since a validator that checks nothing also passes.
 *
 * `fs` is mocked so these never touch the real README/ROADMAP/CLAUDE.md. The
 * mocked reads are keyed by filename, and concerts.json gets a small synthetic
 * fixture whose derived counts are known exactly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import { SCENE_NAMES, SCENE_LABELS } from '../../src/components/changelog/constants'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  const readFileSync = vi.fn()
  return { ...actual, default: { ...actual, readFileSync }, readFileSync }
})

/** Two concerts, three artists, two venues, 1990-2000. */
const CONCERTS_FIXTURE = JSON.stringify({
  concerts: [
    { headliner: 'A', openers: ['B'], venue: 'V1', year: 1990, date: '1990-01-01' },
    { headliner: 'C', openers: [], venue: 'V2', year: 2000, date: '2000-01-01' },
  ],
})

const EXPECTED = { concerts: 2, artists: 3, venues: 2, span: '1990-2000' }

const ROSTER = SCENE_NAMES.map((n) => SCENE_LABELS[n]).join(', ')
const SCENE_COUNT = SCENE_NAMES.length
const SCENE_WORD = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][SCENE_COUNT]

function goodReadme() {
  return [
    `An interactive web app for exploring personal concert history. ${SCENE_WORD} scenes—${ROSTER}—each offering a different lens on ${EXPECTED.concerts} shows spanning 1990 to today.`,
    ``,
    `**Live at [concerts.morperhaus.org](https://concerts.morperhaus.org)** • ${EXPECTED.concerts} shows • ${EXPECTED.artists} artists • ${EXPECTED.venues} venues • 3+ decades`,
    ``,
    `${SCENE_WORD} interactive scenes, each one a different lens on the same history:`,
    ``,
    `The app includes my concert data as static JSON—no setup required. Browse ${EXPECTED.concerts} shows to see how it works.`,
  ].join('\n')
}

function goodRoadmap() {
  return [
    `- **${EXPECTED.concerts} concerts** spanning ${EXPECTED.span}`,
    `- **${EXPECTED.artists} artists** (including openers) with 100% imagery coverage`,
    `- **${EXPECTED.venues} unique venues** across 35 cities`,
    `- **${SCENE_COUNT} interactive scenes**: ${ROSTER}`,
  ].join('\n')
}

function goodClaudeMd() {
  return `**Version:** v5.4.0 | ${EXPECTED.concerts} concerts, ${EXPECTED.artists} artists, ${EXPECTED.venues} venues`
}

/** Wire the mocked fs up to a set of file contents. */
function mockFiles(overrides: Partial<Record<string, string>> = {}) {
  const files: Record<string, string> = {
    'concerts.json': CONCERTS_FIXTURE,
    'README.md': goodReadme(),
    'ROADMAP.md': goodRoadmap(),
    'CLAUDE.md': goodClaudeMd(),
    ...overrides,
  }
  const mockFs = fs as any
  mockFs.readFileSync.mockImplementation((filePath: string) => {
    const key = Object.keys(files).find((k) => String(filePath).endsWith(k))
    if (!key) throw new Error(`Unexpected read: ${filePath}`)
    return files[key]
  })
}

async function runValidator() {
  vi.resetModules()
  const { validateDocs } = await import('../../scripts/validate-docs')
  return validateDocs()
}

describe('validate-docs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes when every claim matches the derived truth', async () => {
    mockFiles()
    expect(await runValidator()).toEqual([])
  })

  describe('catches stale counts', () => {
    it('flags a wrong scene count in the README intro', async () => {
      mockFiles({ 'README.md': goodReadme().replace(`${SCENE_WORD} scenes—`, 'Five scenes—') })
      const failures = await runValidator()

      expect(failures).toHaveLength(1)
      expect(failures[0]).toMatchObject({
        file: 'README.md',
        label: 'intro scene count',
        reason: 'mismatch',
        actual: 'Five',
        expected: SCENE_WORD,
      })
    })

    it('flags a wrong scene count in ROADMAP Current State', async () => {
      mockFiles({
        'ROADMAP.md': goodRoadmap().replace(`**${SCENE_COUNT} interactive scenes**`, '**5 interactive scenes**'),
      })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toContain('Current State — scene count')
    })

    it('flags stale concert, artist and venue counts together', async () => {
      mockFiles({
        'CLAUDE.md': `**Version:** v5.4.0 | 999 concerts, 888 artists, 777 venues`,
      })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toEqual([
        'header — concerts',
        'header — artists',
        'header — venues',
      ])
      expect(failures.every((f) => f.reason === 'mismatch')).toBe(true)
    })

    it('flags a scene missing from the roster prose', async () => {
      const short = SCENE_NAMES.slice(0, -1).map((n) => SCENE_LABELS[n]).join(', ')
      mockFiles({ 'README.md': goodReadme().replace(ROSTER, short) })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toContain('intro scene roster')
      expect(failures.find((f) => f.label === 'intro scene roster')?.actual).toBe(short)
    })
  })

  describe('treats an unmatched pattern as a failure, not a skip', () => {
    // The whole design rests on this. A regex that matches nothing is how
    // llm.txt's album stats froze for months while the script reported success.

    it('fails when the prose is reworded out from under a pattern', async () => {
      mockFiles({
        'README.md': goodReadme().replace(
          `${SCENE_WORD} interactive scenes, each one a different lens on the same history:`,
          'A handful of scenes, each a different lens on the same history:'
        ),
      })
      const failures = await runValidator()

      expect(failures).toHaveLength(1)
      expect(failures[0]).toMatchObject({
        label: 'Features heading scene count',
        reason: 'no-match',
      })
    })

    it('fails on a "+" hedge rather than accepting an approximate count', async () => {
      mockFiles({
        'README.md': goodReadme().replace(
          `Browse ${EXPECTED.concerts} shows`,
          `Browse ${EXPECTED.concerts}+ shows`
        ),
      })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toContain('quick-start show count')
      expect(failures.find((f) => f.label === 'quick-start show count')?.reason).toBe('no-match')
    })

    it('fails when a claim is deleted outright', async () => {
      mockFiles({ 'ROADMAP.md': '- **Standalone pages**: /liner-notes, /about' })
      const failures = await runValidator()

      // Every ROADMAP claim should report, and all as no-match.
      expect(failures.length).toBeGreaterThanOrEqual(5)
      expect(failures.every((f) => f.file === 'docs/ROADMAP.md')).toBe(true)
      expect(failures.every((f) => f.reason === 'no-match')).toBe(true)
    })
  })

  describe('guards its own source of truth', () => {
    it('has a label for every scene in the roster', () => {
      const unlabelled = SCENE_NAMES.filter((n) => !SCENE_LABELS[n])
      expect(unlabelled).toEqual([])
    })

    it('derives the roster from SCENE_NAMES order, not a hand-written list', () => {
      expect(ROSTER.split(', ')).toEqual(SCENE_NAMES.map((n) => SCENE_LABELS[n]))
    })
  })
})
