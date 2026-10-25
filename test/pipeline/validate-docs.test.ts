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
  // deriveTopology() counts Workers and PR gates off the filesystem, so the
  // directory reads are mocked too — the alternative is a test whose fixture
  // silently depends on the real repo having exactly four Workers.
  const readdirSync = vi.fn()
  const existsSync = vi.fn()
  return {
    ...actual,
    default: { ...actual, readFileSync, readdirSync, existsSync },
    readFileSync,
    readdirSync,
    existsSync,
  }
})

/** Two concerts, three artists, two venues, 1990-2000. */
const CONCERTS_FIXTURE = JSON.stringify({
  concerts: [
    { headliner: 'A', openers: ['B'], venue: 'V1', year: 1990, date: '1990-01-01' },
    { headliner: 'C', openers: [], venue: 'V2', year: 2000, date: '2000-01-01' },
  ],
})

// `calendarDays: 1` — both fixture concerts fall on 01-01. It is 1 where
// `concerts` is 2 on purpose: this stat moves independently of the concert
// count, which is exactly how it drifted unnoticed on 2026-09-07.
const EXPECTED = { concerts: 2, artists: 3, venues: 2, span: '1990-2000', calendarDays: 1 }

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
    // Both fixture concerts fall on 01-01, so the archive covers exactly ONE
    // calendar day. Deliberately not `${EXPECTED.concerts}` — the point of this
    // stat is that it moves independently of the concert count, which is how it
    // drifted unnoticed in the first place.
    `On This Day posts on ${EXPECTED.calendarDays} of 366 calendar days`,
    `- **${EXPECTED.concerts} concerts** spanning ${EXPECTED.span}`,
    `- **${EXPECTED.artists} artists** (including openers) with 100% imagery coverage`,
    `- **${EXPECTED.venues} unique venues** across 35 cities`,
    `- **${SCENE_COUNT} interactive scenes**: ${ROSTER}`,
  ].join('\n')
}

function goodClaudeMd() {
  return `**Version:** v5.4.0 | ${EXPECTED.concerts} concerts, ${EXPECTED.artists} artists, ${EXPECTED.venues} venues`
}

const SCENE_WORD_LOWER = SCENE_WORD.toLowerCase()

function goodSceneDesignGuide() {
  return [
    `## Canonical scene roster`,
    ``,
    `The archive has **${SCENE_WORD_LOWER}** scenes.`,
    ``,
    `| # | Slug | Name | Component file |`,
    `|---|------|------|----------------|`,
    ...SCENE_NAMES.map(
      (n, i) => `| ${i + 1} | \`${n}\` | ${SCENE_LABELS[n]} | \`scenes/Whatever.tsx\` |`
    ),
    ``,
    `---`,
    ``,
    `## Unrelated section`,
  ].join('\n')
}

/** SKILL.md carries two independent roster tables — the bug this guards against. */
function goodSkillMd() {
  return [
    `### Scene roster — read this first`,
    ``,
    `There are **${SCENE_WORD_LOWER}** scenes.`,
    ``,
    `| # | Slug | Name | Component | Path |`,
    `|---|------|------|-----------|------|`,
    ...SCENE_NAMES.map(
      (n, i) => `| ${i + 1} | \`${n}\` | ${SCENE_LABELS[n]} | \`Whatever\` | \`src/whatever.tsx\` |`
    ),
    ``,
    `---`,
    ``,
    `### Scene Backgrounds`,
    ``,
    `| # | Name | Background | Text |`,
    ...SCENE_NAMES.map((n, i) => `| ${i + 1} | ${SCENE_LABELS[n]} | \`#ffffff\` | Dark |`),
    ``,
    `---`,
    ``,
    `## Unrelated section`,
  ].join('\n')
}

function goodUiComponentPatterns() {
  return [
    `## Cross-Scene Pattern Matrix`,
    ``,
    `| Scene | Component | Background |`,
    `|-------|-----------|------------|`,
    ...SCENE_NAMES.map(
      (n, i) => `| **${i + 1}. ${SCENE_LABELS[n]}** | \`Whatever\` | Light |`
    ),
    ``,
    `---`,
    ``,
    `## Unrelated section`,
  ].join('\n')
}

/**
 * A synthetic topology for docs/architecture.svg's two counts. Deliberately
 * NOT the real repo's: the point is that the validator counts what it finds,
 * so the fixture supplies its own four Workers and six gates and the diagram
 * fixture is derived from them.
 */
const TOPOLOGY = {
  workers: ['ask-chat', 'dashboard-refresh', 'mcp-server', 'meta-injector'],
  gates: [
    'ci.yml',
    'ask-chat-ci.yml',
    'dashboard-refresh-ci.yml',
    'mcp-ci.yml',
    'meta-injector-ci.yml',
    'scene-ci.yml',
  ],
  // Tag- and cron-triggered. These gate nothing and must not be counted.
  crons: ['data-refresh.yml', 'deploy.yml', 'liner-notes.yml', 'on-this-day.yml', 'syndicate.yml'],
}

const WORKER_WORD = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][
  TOPOLOGY.workers.length
].toUpperCase()

/** Only the two lines the validator reads — not the whole drawing. */
function goodArchitectureSvg() {
  return [
    `<text x="684" y="248">${WORKER_WORD} WORKERS</text>`,
    `<text x="224" y="134">${TOPOLOGY.gates.length} CI gates</text>`,
  ].join('\n')
}

function workflowFixtures(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of TOPOLOGY.gates) out[`.github/workflows/${f}`] = 'on:\n  push:\n  pull_request:\n'
  for (const f of TOPOLOGY.crons) out[`.github/workflows/${f}`] = 'on:\n  schedule:\n'
  return out
}

/**
 * The five surfaces the validator checks for #295 compliance. Content only has
 * to satisfy the guard: mention `deriveArchiveStats`, and build no Set over the
 * archive roster.
 */
const COMPLIANT_SURFACE = `const stats = deriveArchiveStats(concerts)`

function compliantSurfaces(): Record<string, string> {
  return {
    'scenes/Scene1Hero.tsx': COMPLIANT_SURFACE,
    'scenes/Scene3Map.tsx': COMPLIANT_SURFACE,
    'ArtistScene/ArtistScene.tsx': COMPLIANT_SURFACE,
    'generate-og-simple.ts': COMPLIANT_SURFACE,
    'update-meta-tags.ts': COMPLIANT_SURFACE,
  }
}

/** Wire the mocked fs up to a set of file contents. */
function mockFiles(overrides: Partial<Record<string, string>> = {}) {
  const files: Record<string, string> = {
    'concerts.json': CONCERTS_FIXTURE,
    'README.md': goodReadme(),
    'ROADMAP.md': goodRoadmap(),
    'CLAUDE.md': goodClaudeMd(),
    'docs/architecture.svg': goodArchitectureSvg(),
    'docs/design/scene-design-guide.md': goodSceneDesignGuide(),
    'docs/design/ui-component-patterns.md': goodUiComponentPatterns(),
    '.claude/skills/design-system/SKILL.md': goodSkillMd(),
    ...workflowFixtures(),
    ...compliantSurfaces(),
    ...overrides,
  }
  const mockFs = fs as any
  mockFs.readFileSync.mockImplementation((filePath: string) => {
    const key = Object.keys(files).find((k) => String(filePath).endsWith(k))
    if (!key) throw new Error(`Unexpected read: ${filePath}`)
    return files[key]
  })

  mockFs.readdirSync.mockImplementation((dir: string) => {
    const d = String(dir)
    if (d.endsWith('workers')) {
      return TOPOLOGY.workers.map((name) => ({ name, isDirectory: () => true }))
    }
    if (d.endsWith('.github/workflows')) {
      return [...TOPOLOGY.gates, ...TOPOLOGY.crons]
    }
    throw new Error(`Unexpected readdir: ${dir}`)
  })

  mockFs.existsSync.mockImplementation(() => true)
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

    /**
     * The regression this claim exists for. On 2026-09-07 four corrected concert
     * dates collapsed three previously-unique calendar days, moving the archive
     * from 145 to 142 — while the concert count stayed at 184. Every stat the
     * validator already guarded stayed true, so nothing went red, and the stale
     * figure sat in nine places across code comments, docs and two workflows.
     */
    it('flags a stale On This Day calendar-day count', async () => {
      mockFiles({
        'ROADMAP.md': goodRoadmap().replace(
          `${EXPECTED.calendarDays} of 366 calendar days`,
          '145 of 366 calendar days'
        ),
      })
      const failures = await runValidator()

      expect(failures).toHaveLength(1)
      expect(failures[0]).toMatchObject({
        file: 'docs/ROADMAP.md',
        label: 'On This Day calendar-day supply',
        reason: 'mismatch',
        actual: '145',
        expected: String(EXPECTED.calendarDays),
      })
    })

    it('flags a surface that stopped using the shared derivation (#295)', async () => {
      // The counts moved out of the prose and into a function, so there is no
      // literal left to compare. What is checkable is that the surface still
      // asks the one derivation rather than answering for itself.
      mockFiles({ 'scenes/Scene1Hero.tsx': `const total = concerts.length` })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toEqual(['reads the shared archive derivation'])
      expect(failures[0].file).toContain('Scene1Hero')
    })

    it('flags a surface that grew a second roster count beside it (#295)', async () => {
      // The drift this whole issue is about: a surface that calls the shared
      // derivation AND counts artists itself is one edit from disagreeing.
      mockFiles({
        'scenes/Scene3Map.tsx':
          `const stats = deriveArchiveStats(concerts)\nconst mine = new Set(concerts.map(c => c.headliner))`,
      })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toEqual(['counts the archive roster itself'])
      expect(failures[0].reason).toBe('mismatch')
    })

    it('allows a view-scoped city count, which is not an archive stat (#295)', async () => {
      // Scene3Map counts cities in the SELECTED REGION for its subtitle. That
      // is supposed to change as you browse, and a guard that fired on it
      // would be a guard nobody keeps.
      mockFiles({
        'scenes/Scene3Map.tsx':
          `const stats = deriveArchiveStats(concerts)\nconst cities = new Set(filteredConcerts.map(c => c.cityState))`,
      })

      expect(await runValidator()).toEqual([])
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

  describe('catches an architecture diagram that has gone stale', () => {
    it('flags a Worker count the drawing has outgrown', async () => {
      mockFiles({
        'docs/architecture.svg': goodArchitectureSvg().replace(
          `${WORKER_WORD} WORKERS`,
          'THREE WORKERS'
        ),
      })
      const failures = await runValidator()

      expect(failures).toHaveLength(1)
      expect(failures[0]).toMatchObject({
        file: 'docs/architecture.svg',
        label: 'architecture diagram — Worker count',
        reason: 'mismatch',
        expected: WORKER_WORD,
        actual: 'THREE',
      })
    })

    it('flags a CI gate count the drawing has outgrown', async () => {
      mockFiles({
        'docs/architecture.svg': goodArchitectureSvg().replace(
          `${TOPOLOGY.gates.length} CI gates`,
          '4 CI gates'
        ),
      })
      const failures = await runValidator()

      expect(failures).toHaveLength(1)
      expect(failures[0]).toMatchObject({
        file: 'docs/architecture.svg',
        label: 'architecture diagram — CI gate count',
        reason: 'mismatch',
        actual: '4',
      })
    })

    it('does not count the cron- and tag-triggered workflows as gates', async () => {
      // The guard that matters: syndicate.yml and deploy.yml sit in the same
      // directory and gate nothing. If they were counted, the honest diagram
      // would be the one reported as wrong.
      mockFiles()
      expect(await runValidator()).toEqual([])
    })
  })

  describe('catches design-doc roster drift (#284 follow-up)', () => {
    it('flags a wrong scene count sentence in the scene design guide', async () => {
      mockFiles({
        'docs/design/scene-design-guide.md': goodSceneDesignGuide().replace(
          `**${SCENE_WORD_LOWER}** scenes`,
          '**five** scenes'
        ),
      })
      const failures = await runValidator()

      expect(failures).toHaveLength(1)
      expect(failures[0]).toMatchObject({
        file: 'docs/design/scene-design-guide.md',
        label: 'scene design guide — scene count',
        reason: 'mismatch',
        actual: 'five',
        expected: SCENE_WORD_LOWER,
      })
    })

    it('flags a canonical roster table row that names the wrong scene', async () => {
      mockFiles({
        'docs/design/scene-design-guide.md': goodSceneDesignGuide().replace(
          `| 2 | \`${SCENE_NAMES[1]}\` | ${SCENE_LABELS[SCENE_NAMES[1]]} | \`scenes/Whatever.tsx\` |`,
          `| 2 | \`${SCENE_NAMES[1]}\` | Bands | \`scenes/Whatever.tsx\` |`
        ),
      })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toContain('canonical scene roster table')
      const f = failures.find((f) => f.label === 'canonical scene roster table')
      expect(f?.reason).toBe('mismatch')
      expect(f?.actual).toContain('Bands')
    })

    /**
     * The regression this whole follow-up exists for: SKILL.md's roster table
     * and its backgrounds table, a few rows apart, disagreeing about which
     * scene is which. A bare count claim can't catch this — both tables still
     * have six rows. Only checking each table's own Name column against
     * SCENE_LABELS does.
     */
    it('flags SKILL.md when its two roster tables disagree with each other', async () => {
      mockFiles({
        '.claude/skills/design-system/SKILL.md': goodSkillMd().replace(
          `| 4 | ${SCENE_LABELS['genres']} | \`#ffffff\` | Dark |`,
          `| 4 | ${SCENE_LABELS['artists']} | \`#ffffff\` | Dark |`
        ),
      })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toEqual(['scene backgrounds table'])
      expect(failures[0].reason).toBe('mismatch')
    })

    it('flags a Cross-Scene Pattern Matrix row out of order', async () => {
      mockFiles({
        'docs/design/ui-component-patterns.md': goodUiComponentPatterns().replace(
          `**2. ${SCENE_LABELS[SCENE_NAMES[1]]}**`,
          `**2. Bands**`
        ),
      })
      const failures = await runValidator()

      expect(failures.map((f) => f.label)).toContain('cross-scene pattern matrix')
    })

    it('treats a missing roster table as a failure, not a skip', async () => {
      mockFiles({ 'docs/design/scene-design-guide.md': '## Canonical scene roster\n\nNothing here.\n' })
      const failures = await runValidator()

      const labels = failures.map((f) => f.label)
      expect(labels).toContain('scene design guide — scene count')
      expect(labels).toContain('canonical scene roster table')
      expect(failures.find((f) => f.label === 'canonical scene roster table')?.reason).toBe('no-match')
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
