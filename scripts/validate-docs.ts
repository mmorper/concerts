#!/usr/bin/env tsx
/**
 * Validate Docs
 *
 * Fails when prose in README.md, docs/ROADMAP.md or CLAUDE.md contradicts the
 * code and data it describes.
 *
 * Why this exists (#284): README claimed "Five scenes" for the seven months
 * after Ask the Archive shipped as scene 6, across roughly forty releases.
 * Nothing could fail on it. `validate:version` compares git tag, changelog and
 * package.json and stops there — the entire enforcement surface of the release
 * gate was version strings.
 *
 * Truth comes from two places and is never typed here:
 *   - the scene roster: src/components/changelog/constants.ts
 *   - the counts:       public/data/concerts.json
 *
 * A NOTE ON THE DESIGN. Every claim below must match its pattern. A pattern
 * that finds nothing is reported as a failure, not skipped. This is the same
 * bug that froze llm.txt's album stats: a `.replace()` whose regex stopped
 * matching became a silent no-op, and the script reported success either way.
 * Prose gets reworded; when it does, this should go red and ask to be updated
 * rather than quietly stop checking anything.
 *
 * The patterns match bare digits and reject "184+" style hedges on purpose.
 * README said "174+ shows" for months: an approximate number is one nobody
 * feels obliged to correct, and `.claude/readme-maintenance.md` used to bless
 * that with a "counts within 5 of actual" tolerance. These counts are exact
 * and cheap to derive, so they are checked exactly. If a "+" is ever wanted
 * deliberately, widen the specific pattern — don't loosen all of them.
 *
 * Usage:
 *   npm run validate:docs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { SCENE_NAMES, SCENE_LABELS } from '../src/components/changelog/constants'

interface Concert {
  headliner: string
  openers?: string[]
  venue: string
  year: number
}

interface Claim {
  /** Repo-relative file the claim lives in */
  file: string
  /** Human-readable name, shown on failure */
  label: string
  /** Must contain exactly one capture group — the asserted value */
  pattern: RegExp
  /** The derived truth the capture must equal */
  expected: string
}

const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
]

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8')
}

/** Counts, derived the same way the meta pipeline derives them. */
function deriveStats() {
  const data: { concerts: Concert[] } = JSON.parse(
    readRepoFile('public/data/concerts.json')
  )
  const concerts = data.concerts

  const artistSet = new Set<string>()
  concerts.forEach((c) => {
    if (c.headliner) artistSet.add(c.headliner)
    c.openers?.forEach((o) => artistSet.add(o))
  })

  const venueSet = new Set(concerts.map((c) => c.venue))
  const years = concerts.map((c) => c.year)

  // v6.0 data files. Optional: a fresh clone before enrichment has neither, and
  // a missing file must not fail the doc gate — but a PRESENT file whose counts
  // have drifted from the prose must.
  const songAlbums = readOptionalJson<{ songs?: Record<string, { releaseDate?: string }> }>(
    'public/data/song-albums.json'
  )
  const albumEras = readOptionalJson<{ artists?: Record<string, unknown> }>(
    'public/data/album-eras.json'
  )

  const songEntries = Object.values(songAlbums?.songs ?? {})
  const precision = { day: 0, month: 0, year: 0 }
  for (const entry of songEntries) {
    const parts = String(entry?.releaseDate ?? '').split('-').length
    if (parts === 3) precision.day++
    else if (parts === 2) precision.month++
    else precision.year++
  }

  return {
    concerts: concerts.length,
    artists: artistSet.size,
    venues: venueSet.size,
    startYear: Math.min(...years),
    endYear: Math.max(...years),
    songAlbums: songAlbums ? songEntries.length : null,
    albumErasArtists: albumEras ? Object.keys(albumEras.artists ?? {}).length : null,
    precision,
  }
}

/** Null when absent — an un-enriched clone documents nothing, and that is fine. */
function readOptionalJson<T>(relativePath: string): T | null {
  try {
    return JSON.parse(readRepoFile(relativePath)) as T
  } catch {
    return null
  }
}

/** 1716 -> "1,716", matching how the prose writes them. */
function withCommas(n: number): string {
  return n.toLocaleString('en-US')
}

function buildClaims(): Claim[] {
  const stats = deriveStats()
  const sceneCount = SCENE_NAMES.length
  const roster = SCENE_NAMES.map((n) => SCENE_LABELS[n]).join(', ')

  return [
    // ---- README: the intro paragraph. Unowned by /release until #284; this
    // is the exact line that sat at "Five scenes" and "178 shows".
    {
      file: 'README.md',
      label: 'intro scene count',
      pattern: /personal concert history\. (\w+) scenes—/,
      expected: numberWord(sceneCount),
    },
    {
      file: 'README.md',
      label: 'intro scene roster',
      pattern: /\w+ scenes—(.+?)—each offering/,
      expected: roster,
    },
    {
      file: 'README.md',
      label: 'intro show count',
      pattern: /each offering a different lens on ([\d,]+) shows/,
      expected: String(stats.concerts),
    },
    {
      file: 'README.md',
      label: 'stats line — shows',
      pattern: /\*\*\s*•\s*([\d,]+) shows/,
      expected: String(stats.concerts),
    },
    {
      file: 'README.md',
      label: 'stats line — artists',
      pattern: /shows • ([\d,]+) artists/,
      expected: String(stats.artists),
    },
    {
      file: 'README.md',
      label: 'stats line — venues',
      pattern: /artists • ([\d,]+) venues/,
      expected: String(stats.venues),
    },
    // ---- README: the Features section. The canonical place a new scene is
    // announced, and the other line that went unchanged for seven months.
    {
      file: 'README.md',
      label: 'Features heading scene count',
      pattern: /(\w+) interactive scenes, each one a different lens/,
      expected: numberWord(sceneCount),
    },
    {
      file: 'README.md',
      label: 'quick-start show count',
      pattern: /Browse ([\d,]+) shows to see how it works/,
      expected: String(stats.concerts),
    },

    // ---- docs/ROADMAP.md: the Current State block.
    {
      file: 'docs/ROADMAP.md',
      label: 'Current State — concerts',
      pattern: /- \*\*([\d,]+) concerts\*\* spanning/,
      expected: String(stats.concerts),
    },
    {
      file: 'docs/ROADMAP.md',
      label: 'Current State — year span',
      pattern: /concerts\*\* spanning (\d{4}-\d{4})/,
      expected: `${stats.startYear}-${stats.endYear}`,
    },
    {
      file: 'docs/ROADMAP.md',
      label: 'Current State — artists',
      pattern: /- \*\*([\d,]+) artists\*\* \(including openers\)/,
      expected: String(stats.artists),
    },
    {
      file: 'docs/ROADMAP.md',
      label: 'Current State — venues',
      pattern: /- \*\*([\d,]+) unique venues\*\*/,
      expected: String(stats.venues),
    },
    {
      file: 'docs/ROADMAP.md',
      label: 'Current State — scene count',
      pattern: /- \*\*(\d+) interactive scenes\*\*/,
      expected: String(sceneCount),
    },
    {
      file: 'docs/ROADMAP.md',
      label: 'Current State — scene roster',
      pattern: /- \*\*\d+ interactive scenes\*\*: (.+)/,
      expected: roster,
    },

    // ---- CLAUDE.md: the header stats line.
    {
      file: 'CLAUDE.md',
      label: 'header — concerts',
      pattern: /\| ([\d,]+) concerts, [\d,]+ artists, [\d,]+ venues/,
      expected: String(stats.concerts),
    },
    {
      file: 'CLAUDE.md',
      label: 'header — artists',
      pattern: /\| [\d,]+ concerts, ([\d,]+) artists, [\d,]+ venues/,
      expected: String(stats.artists),
    },
    {
      file: 'CLAUDE.md',
      label: 'header — venues',
      pattern: /\| [\d,]+ concerts, [\d,]+ artists, ([\d,]+) venues/,
      expected: String(stats.venues),
    },

    // ---- public/llm.txt: the v6.0 data-file counts (#290).
    //
    // llm.txt was OUTSIDE this gate until now, and it is the file whose stats
    // froze at a number that was never true — the `.replace()` whose own regex
    // could not match what it wrote (#287). That fix made the writer WARN on a
    // miss; this makes the reader FAIL. Same file, same class of bug, now
    // enforced rather than announced.
    //
    // Skipped entirely when the data file is absent: a fresh clone before
    // enrichment documents nothing, and that is not drift.
    ...(stats.songAlbums === null
      ? []
      : [
          {
            file: 'public/llm.txt',
            label: 'song-albums record count',
            pattern: /\*\*Records:\*\* ([\d,]+) of [\d,]+ unique artist\+song pairs/,
            expected: withCommas(stats.songAlbums),
          },
          {
            file: 'public/llm.txt',
            label: 'song-albums full-date count',
            pattern: /([\d,]+) entries are full dates/,
            expected: withCommas(stats.precision.day),
          },
          {
            file: 'public/llm.txt',
            label: 'song-albums month-precision count',
            pattern: /full dates, ([\d,]+) are `YYYY-MM`/,
            expected: withCommas(stats.precision.month),
          },
          {
            file: 'public/llm.txt',
            label: 'song-albums year-precision count',
            pattern: /([\d,]+) are bare `YYYY`/,
            expected: withCommas(stats.precision.year),
          },
        ]),
    ...(stats.albumErasArtists === null
      ? []
      : [
          {
            file: 'public/llm.txt',
            label: 'album-eras artist count',
            pattern: /\*\*Records:\*\* ([\d,]+) artists — the join/,
            expected: withCommas(stats.albumErasArtists),
          },
        ]),
  ]
}

interface Failure {
  file: string
  label: string
  reason: 'no-match' | 'mismatch'
  expected: string
  actual?: string
  pattern: RegExp
}

export function validateDocs(): Failure[] {
  const failures: Failure[] = []

  // Guard the source of truth itself: a scene added to SCENE_NAMES without a
  // label would otherwise render as "undefined" inside the expected roster.
  const unlabelled = SCENE_NAMES.filter((n) => !SCENE_LABELS[n])
  if (unlabelled.length > 0) {
    throw new Error(
      `SCENE_LABELS is missing an entry for: ${unlabelled.join(', ')}.\n` +
        `Add it in src/components/changelog/constants.ts — it is the roster ` +
        `every doc is checked against.`
    )
  }

  const fileCache = new Map<string, string>()

  for (const claim of buildClaims()) {
    if (!fileCache.has(claim.file)) {
      fileCache.set(claim.file, readRepoFile(claim.file))
    }
    const content = fileCache.get(claim.file)!
    const match = content.match(claim.pattern)

    if (!match) {
      // Not "skip" — a claim that can no longer be located is a claim that is
      // no longer being checked, which is how this class of drift starts.
      failures.push({
        file: claim.file,
        label: claim.label,
        reason: 'no-match',
        expected: claim.expected,
        pattern: claim.pattern,
      })
      continue
    }

    const actual = match[1].trim()
    if (actual !== claim.expected) {
      failures.push({
        file: claim.file,
        label: claim.label,
        reason: 'mismatch',
        expected: claim.expected,
        actual,
        pattern: claim.pattern,
      })
    }
  }

  return failures
}

function main() {
  console.log('🔍 Validating documentation against code and data...\n')

  const stats = deriveStats()
  console.log(`Derived truth:`)
  console.log(`  Scenes:   ${SCENE_NAMES.length} (${SCENE_NAMES.map((n) => SCENE_LABELS[n]).join(', ')})`)
  console.log(`  Concerts: ${stats.concerts}`)
  console.log(`  Artists:  ${stats.artists}`)
  console.log(`  Venues:   ${stats.venues}`)
  console.log(`  Span:     ${stats.startYear}-${stats.endYear}\n`)

  const failures = validateDocs()

  if (failures.length === 0) {
    console.log('✅ All documented claims match the code and data.')
    process.exit(0)
  }

  console.log(`❌ ${failures.length} documented claim(s) out of date:\n`)

  for (const f of failures) {
    if (f.reason === 'mismatch') {
      console.log(`  ${f.file} — ${f.label}`)
      console.log(`     says:     ${f.actual}`)
      console.log(`     should be: ${f.expected}\n`)
    } else {
      console.log(`  ${f.file} — ${f.label}`)
      console.log(`     could not find this claim at all.`)
      console.log(`     pattern:   ${f.pattern}`)
      console.log(`     expected:  ${f.expected}`)
      console.log(`     Either the prose was reworded (update the pattern in`)
      console.log(`     scripts/validate-docs.ts) or the claim was deleted.\n`)
    }
  }

  console.log('These files describe the archive to people who have not used it.')
  console.log('Fix the prose, or update this script if the wording moved on purpose.')
  process.exit(1)
}

// Only run when invoked directly, so the tests can import validateDocs().
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
