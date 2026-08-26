/**
 * `npm run media:audit` — the corpus scan across every concert in the archive (#381).
 *
 * WHAT IT ANSWERS. Not "which photograph is best" — `media:review` does that, one show at a
 * time, with a human. This answers "WHERE SHOULD I LOOK NEXT", across 184 shows, so the
 * expensive human step gets spent on the nights that actually hold something.
 *
 * ONE LIBRARY PASS, NOT 184. osxphotos materialises the library on every invocation
 * regardless of --from-date, so looping `media:prep` over the archive would pay that cost
 * 184 times. `query_window.py::corpus` walks it once and buckets each asset into whichever
 * show window contains it.
 *
 * READ-ONLY AGAINST PHOTOS. Every library access goes through the read-only guard at
 * `concert-photos-audit/bin/osxphotos`, never `.osxphotos-raw`.
 *
 * NO YEAR CAP. The old probes stopped at 2012 and that hid real supply: 2007–2011 sits at
 * 24% coverage and contains a 26-still and a 22-still show. Every concert is scanned.
 *
 * SCORE, NEVER FILTER — and REPORT WHAT WAS EXCLUDED. Both rules exist because this corner
 * of the project has already produced confident nonsense once: the 17:00->04:00 window is a
 * DATE filter, not a concert filter, and of 66 assets in the Beck window none were of the
 * show — they were a wedding. A count that does not say what it dropped cannot be trusted,
 * so every stage here reports its own exclusions and the summary carries the denominator.
 *
 * WHAT IT WRITES. Per-asset detail lands in the ignored evaluation workspace, because it
 * holds filenames and capture times. Only the summary is printed. Nothing here is a
 * decision — re-running it costs a library pass and nothing else.
 *
 * FIRST FULL PASS, 2026-08-26. 58,542 library assets scanned in 25 seconds of CPU. 769 fell
 * in a show window — 1.3% of the library — and 639 of those are unjudged and rankable
 * across 77 shows. This is the re-derivation #338 needed: its supply figures counted
 * evenings, and an evening is not a concert.
 *
 * The shape of it is worth knowing before planning any of the work:
 *
 *   1980s   27 shows    0 in window    all 27 empty
 *   1990s   25 shows    0 in window    all 25 empty
 *   2000s   25 shows   20 in window    22 empty
 *   2010s   65 shows  334 in window    21 empty
 *   2020s   42 shows  415 in window     8 empty
 *
 * Every photograph in this archive is post-2007. The first 52 shows — half the archive by
 * count, and the half with the best stories — have nothing to mine and never will. Any plan
 * that assumes even coverage across 184 shows is planning for an archive that does not
 * exist.
 *
 * RUN IT WITH THE OWNER AT THE KEYBOARD. macOS raises a permission prompt on the library
 * read, and an unattended run blocks behind it indefinitely — 76 minutes, in the worst case
 * measured, against 25 seconds when someone was there to dismiss it. See "Verify output,
 * not exit codes" in the media-pipeline skill.
 *
 * Usage:
 *   npm run media:audit                    scan every concert
 *   npm run media:audit -- --limit 20      first 20 shows, for a fast sanity pass
 *   npm run media:audit -- --from 2015     only shows in or after that year
 *
 * @module scripts/media/audit
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { loadConcerts, showWindow, type Concert } from './show'
import { rankCandidates, type Candidate, type Ranked } from './rank'
import { loadDecisions, decidedUuids } from './decisions'

const GUARD = resolve('concert-photos-audit/bin/osxphotos')
const QUERY_FN = resolve('scripts/media/query_window.py')
const AUDIT_DIR = resolve('concert-photos-audit/audit')
const MEDIA_INDEX = resolve('public/data/media-index.json')

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

interface CorpusPayload {
  windows: number
  scanned: number
  excluded: { no_date: number; outside_all_windows: number }
  ambiguous: number
  shows: Record<string, Candidate[]>
}

/** One night's standing in the worklist. */
export interface ShowAudit {
  date: string
  headliner: string
  venue: string
  /** Everything the window caught, before any judgement. */
  inWindow: number
  /** Photos never scored these; they are listed, never ranked. */
  unscored: number
  /** Already judged by the owner — `data/media-decisions.json`. */
  decided: number
  /** Already published — `public/data/media-index.json`. */
  published: number
  /** In-window, scored, and never ruled on. The only number that means "work available". */
  unjudged: number
  /** Best combined likelihood x quality among the unjudged. Null when there are none. */
  bestScore: number | null
  /** Sum of likelihood x quality across the unjudged — depth, not just a peak. */
  opportunity: number
}

/**
 * Rank the shows the same way `rank.ts` ranks assets: two factors, never conflated.
 *
 * `bestScore` says "is there one great frame here". `opportunity` says "is there a body of
 * work here". A night with a single 0.9 and a night with twelve 0.4s are different jobs and
 * one number cannot carry both, which is the lesson the Black Keys already taught at the
 * asset level — model 0.84, owner rejected all 8.
 */
export function auditShow(
  concert: Concert,
  candidates: Candidate[],
  decided: Set<string>,
  published: Set<string>
): ShowAudit {
  const { scored, unscored } = rankCandidates(candidates, {
    venue: concert.venue,
    city: concert.city,
    lat: concert.location?.lat,
    lng: concert.location?.lng,
  })
  const open = scored.filter((r) => !decided.has(r.uuid) && !published.has(r.uuid))
  const value = (r: Ranked) => r.likelihood * (r.quality as number)
  return {
    date: concert.date,
    headliner: concert.headliner,
    venue: concert.venue,
    inWindow: candidates.length,
    unscored: unscored.length,
    decided: candidates.filter((c) => decided.has(c.uuid)).length,
    published: candidates.filter((c) => published.has(c.uuid)).length,
    unjudged: open.length,
    bestScore: open.length ? Math.max(...open.map(value)) : null,
    opportunity: open.reduce((sum, r) => sum + value(r), 0),
  }
}

/** UUIDs already carried by `media-index.json`, including a frame's source clip. */
export function publishedUuids(path = MEDIA_INDEX): Set<string> {
  if (!existsSync(path)) return new Set()
  const index = JSON.parse(readFileSync(path, 'utf-8')) as {
    assets: Array<{ uuid?: string | null; derivedFrom?: { original?: string } | null; render?: { uuid?: string } | null }>
  }
  const seen = new Set<string>()
  for (const a of index.assets) {
    if (a.uuid) seen.add(a.uuid)
    if (a.derivedFrom?.original) seen.add(a.derivedFrom.original)
    if (a.render?.uuid) seen.add(a.render.uuid)
  }
  return seen
}

function queryCorpus(concerts: Concert[]): CorpusPayload {
  if (!existsSync(GUARD)) {
    fail(`The read-only osxphotos guard is missing at ${GUARD}. It is tracked in git — restore it.`)
  }
  const windows = concerts
    .map((c) => ({ date: c.date, ...showWindow(c.date) }))
    .sort((a, b) => a.from.localeCompare(b.from))
  const runDir = join(tmpdir(), `media-audit-${process.pid}`)
  mkdirSync(runDir, { recursive: true })
  const paramsFile = join(runDir, 'params.json')
  const outFile = join(runDir, 'corpus.json')
  writeFileSync(paramsFile, JSON.stringify({ windows }))

  /* A coarse range spanning the windows actually being scanned, and no wider.
     Across the whole archive it excludes nothing — the windows already span 1984 to now —
     but it is what makes `--limit 3` cost seconds instead of the full pass, and it keeps
     the reported `scanned` denominator honest either way: what osxphotos handed over is
     what the summary divides by. Widened a day on each side because the authoritative
     window test is the naive-local comparison in the query function, not this. */
  const first = windows[0].from.slice(0, 10)
  const last = windows[windows.length - 1].to.slice(0, 10)
  const shift = (d: string, days: number) =>
    new Date(Date.parse(`${d}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10)
  const coarse = { from: `${shift(first, -1)}T00:00:00`, to: `${shift(last, 1)}T00:00:00` }

  console.log(`  reading Photos once for ${windows.length} show windows, ${first.slice(0, 4)}–${last.slice(0, 4)}`)
  console.log(`  one library pass — minutes, not seconds…\n`)

  try {
    execFileSync(
      GUARD,
      // NOTE: the separator is `::`, not the single `:` the --help text claims.
      ['query',
       '--from-date', coarse.from,
       '--to-date', coarse.to,
       '--query-function', `${QUERY_FN}::corpus`, '--quiet'],
      {
        env: { ...process.env, MEDIA_PREP_PARAMS: paramsFile, MEDIA_PREP_OUT: outFile },
        stdio: ['ignore', 'ignore', 'pipe'],
        maxBuffer: 512 * 1024 * 1024,
      }
    )
  } catch (err) {
    const e = err as Error & { stderr?: Buffer; status?: number }
    const detail = e.stderr?.toString().trim()
    if (e.status === 69) fail(detail ?? 'The osxphotos binary is not installed.')
    fail(
      `osxphotos failed. If macOS has not granted Full Disk Access to that binary, grant it\n` +
        `  and re-run; see concert-photos-audit/bin/BUILD.txt.\n  ${e.message}` +
        (detail ? `\n\n${detail}` : '')
    )
  }

  // Verify output, not the exit code: osxphotos exits 0 whether or not the function ran.
  if (!existsSync(outFile)) {
    fail(
      `osxphotos exited cleanly but wrote no corpus file.\n` +
        `  The query function did not run. Check that ${QUERY_FN} is readable and that the\n` +
        `  --query-function separator is "::".`
    )
  }
  return JSON.parse(readFileSync(outFile, 'utf-8')) as CorpusPayload
}

function main(): void {
  const args = process.argv.slice(2)
  const num = (flag: string): number | null => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : null
  }
  const limit = num('--limit')
  const from = num('--from')

  let concerts = loadConcerts().sort((a, b) => a.date.localeCompare(b.date))
  const total = concerts.length
  if (from) concerts = concerts.filter((c) => Number(c.date.slice(0, 4)) >= from)
  if (limit) concerts = concerts.slice(0, limit)
  if (concerts.length === 0) fail('No concerts matched those flags.')

  console.log(`\n📸 media:audit — ${concerts.length} of ${total} concerts\n`)
  const payload = queryCorpus(concerts)

  const decided = decidedUuids(loadDecisions())
  const published = publishedUuids()
  const audits = concerts.map((c) => auditShow(c, payload.shows[c.date] ?? [], decided, published))

  // ── The exclusion ladder. Every stage says what it dropped and out of what. ──────────
  const inWindow = audits.reduce((n, a) => n + a.inWindow, 0)
  const unscored = audits.reduce((n, a) => n + a.unscored, 0)
  const decidedN = audits.reduce((n, a) => n + a.decided, 0)
  const publishedN = audits.reduce((n, a) => n + a.published, 0)
  const unjudged = audits.reduce((n, a) => n + a.unjudged, 0)
  const emptyShows = audits.filter((a) => a.inWindow === 0).length

  const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—')
  console.log('📊 What was excluded, and out of what\n')
  console.log(`  library assets scanned            ${payload.scanned.toLocaleString()}`)
  console.log(`    no capture date                 ${payload.excluded.no_date.toLocaleString()}`)
  console.log(`    outside every show window       ${payload.excluded.outside_all_windows.toLocaleString()}`)
  console.log(`  in a show window                  ${inWindow.toLocaleString()}  (${pct(inWindow, payload.scanned)} of the library)`)
  if (payload.ambiguous) console.log(`    ⚠ in TWO windows, first won      ${payload.ambiguous}`)
  console.log(`    unscored by Photos              ${unscored.toLocaleString()}  (${pct(unscored, inWindow)}) — listed, never ranked`)
  console.log(`    already judged                  ${decidedN.toLocaleString()}`)
  console.log(`    already published               ${publishedN.toLocaleString()}`)
  console.log(`  unjudged and rankable             ${unjudged.toLocaleString()}  (${pct(unjudged, inWindow)})\n`)
  console.log(`  ⚠ THE WINDOW IS A DATE FILTER, NOT A CONCERT FILTER. Everything above counts`)
  console.log(`    assets in an evening, not photographs of a show. Of 66 in the Beck window,`)
  console.log(`    none were the concert — they were a wedding. Ranking discriminates; the`)
  console.log(`    window does not.\n`)
  console.log(`  shows with nothing in the window  ${emptyShows} of ${audits.length}\n`)

  // ── The worklist. Deepest first, because depth is what a review session spends. ──────
  const worklist = audits.filter((a) => a.unjudged > 0).sort((a, b) => b.opportunity - a.opportunity)
  console.log(`🎯 Worklist — ${worklist.length} shows hold unjudged supply\n`)
  console.log(`     ${'date'.padEnd(11)}${'unjudged'.padStart(9)}${'best'.padStart(7)}${'depth'.padStart(8)}  show`)
  for (const [i, a] of worklist.slice(0, 25).entries()) {
    console.log(
      `  ${String(i + 1).padStart(3)}. ${a.date.padEnd(11)}${String(a.unjudged).padStart(9)}` +
        `${(a.bestScore ?? 0).toFixed(2).padStart(7)}${a.opportunity.toFixed(1).padStart(8)}  ${a.headliner} · ${a.venue}`
    )
  }
  if (worklist.length > 25) console.log(`  … ${worklist.length - 25} more in the JSON below`)

  mkdirSync(AUDIT_DIR, { recursive: true })
  const outPath = join(AUDIT_DIR, 'audit.json')
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        scanned: payload.scanned,
        excluded: payload.excluded,
        ambiguous: payload.ambiguous,
        concerts: audits.length,
        totals: { inWindow, unscored, decided: decidedN, published: publishedN, unjudged },
        shows: audits,
      },
      null,
      2
    ) + '\n'
  )

  // Assert its own output rather than trusting the exit code — the recurring failure in
  // this work is a command that reports success while having done nothing.
  const written = JSON.parse(readFileSync(outPath, 'utf-8')) as { shows: ShowAudit[] }
  if (written.shows.length !== audits.length) {
    fail(`Wrote ${written.shows.length} shows but audited ${audits.length}.`)
  }
  if (payload.scanned === 0) {
    fail('The library pass returned zero assets. That is a failed read, not an empty library.')
  }

  console.log(`\n  → ${outPath}\n`)
  console.log(`Next: npm run media:review <date>  on the top of the worklist.\n`)
}

if (process.argv[1] && process.argv[1].endsWith('audit.ts')) main()
