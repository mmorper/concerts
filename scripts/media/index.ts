/**
 * `npm run media [date]` — the one command. It works out where you are and what is next.
 *
 * WHY. The pipeline is seven commands in a non-obvious order, and the owner should not have
 * to hold that order in their head: "the idea that I'm going to commit to memory every
 * single one of these terminal commands and sequence them in the right order is just not
 * viable." So this reads the disk, decides, explains, and offers to run it.
 *
 *   npm run media            pick a show from the worklist
 *   npm run media 2024-08-20 go straight to that show
 *
 * IT NEVER RUNS ANYTHING WITHOUT ASKING. Every step here reaches the Photos library, costs
 * a download, or writes to the repo. It prints what it is about to do and waits.
 *
 * THE ONE SOURCE OF TRUTH FOR "WHAT'S NEXT". Individual commands used to volunteer their
 * own guesses — `--finish` printed "Next: npm run media:ingest" while seven unmined clips
 * sat there. Now `phase.ts` decides and this is the only thing that says it out loud.
 *
 * @module scripts/media/index
 */
import { spawnSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { createInterface, emitKeypressEvents } from 'readline'
import { loadConcerts, type Concert } from './show'
import { phaseOf, minedAlready, unmarkedClipWarning, TOTAL_STEPS, type Phase, type Snapshot } from './phase'

const REVIEW_ROOT = resolve('concert-photos-audit/review')
const AUDIT = resolve('concert-photos-audit/audit/audit.json')
const MEDIA_INDEX = resolve('public/data/media-index.json')

const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const OFF = '\x1b[0m'

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

// ── Reading the disk ─────────────────────────────────────────────────────────────────────

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

/** Everything phase detection needs, gathered in one place so `phaseOf` stays pure. */
export function snapshotOf(date: string): Snapshot {
  const runDir = join(REVIEW_ROOT, date)
  const empty: Snapshot = {
    hasRun: false, onPage: 0, judged: 0, framesOnPage: 0, framesJudged: 0,
    hasSelects: false, selectsStale: false, clipsKept: 0, clipsUnmarked: 0,
    publishable: 0, indexedCount: 0, indexedVideos: 0,
  }

  const index = readJson<{ assets: Array<{ date?: string; kind?: string }> }>(MEDIA_INDEX)
  const mine = (index?.assets ?? []).filter((a) => a.date === date)
  const indexedCount = mine.length
  const indexedVideos = mine.filter((a) => a.kind === 'video').length
  if (!existsSync(runDir)) return { ...empty, indexedCount, indexedVideos }

  const all = readJson<Array<{ uuid: string; media?: string }>>(join(runDir, 'all.json')) ?? []
  const verdicts = readJson<Record<string, { verdict?: string }>>(join(runDir, 'verdicts.json')) ?? {}
  const judgedOf = (u: string) => verdicts[u]?.verdict === 'keep' || verdicts[u]?.verdict === 'reject'
  const frames = all.filter((i) => String(i.uuid).startsWith('frame:'))

  const selectsPath = join(runDir, 'selects.json')
  const hasSelects = existsSync(selectsPath)
  // Stale when a verdict was recorded after selects.json was written. The review page saves
  // on every keystroke, so mtime is a faithful record of the last decision.
  const selectsStale =
    hasSelects && existsSync(join(runDir, 'verdicts.json'))
      ? statSync(join(runDir, 'verdicts.json')).mtimeMs > statSync(selectsPath).mtimeMs
      : false

  const selects = hasSelects
    ? readJson<{ selects: Array<{ uuid: string; sourceFile?: string | null; marks?: { frames?: number[]; trim?: unknown } | null }> }>(selectsPath)
    : null
  const media = new Map(all.map((i) => [i.uuid, i.media]))
  const chosen = selects?.selects ?? []
  // An extracted frame is a FILE, not a library asset, so it has no `media` — `sourceFile`
  // is what identifies it, and it publishes as a still like any other.
  const clips = chosen.filter((s) => !s.sourceFile && media.get(s.uuid) === 'video')
  const stills = chosen.filter((s) => s.sourceFile || media.get(s.uuid) !== 'video')
  const trims = clips.filter((c) => c.marks?.trim)

  return {
    hasRun: true,
    onPage: all.length,
    judged: all.filter((i) => judgedOf(i.uuid)).length,
    framesOnPage: frames.length,
    framesJudged: frames.filter((i) => judgedOf(i.uuid)).length,
    hasSelects,
    selectsStale,
    clipsKept: clips.length,
    clipsUnmarked: clips.filter((c) => !c.marks?.frames?.length && !c.marks?.trim).length,
    publishable: stills.length + trims.length,
    indexedCount,
    indexedVideos,
  }
}

// ── The picker ───────────────────────────────────────────────────────────────────────────

interface Row {
  concert: Concert
  phase: Phase
  snapshot: Snapshot
  unjudged: number
  opportunity: number
}

/**
 * Shows worth offering, in the order they are worth doing.
 *
 * IN-FLIGHT FIRST. A show already part-way through is the cheapest thing to finish and the
 * easiest to forget — that is exactly the state the owner was in when they asked for this.
 * Everything else falls back to the audit's depth ranking.
 */
export function buildRows(concerts: Concert[], audit: Map<string, { unjudged: number; opportunity: number }>,
  snap: (d: string) => Snapshot): Row[] {
  const rows: Row[] = []
  for (const c of concerts) {
    const s = snap(c.date)
    const a = audit.get(c.date)
    const done = phaseOf(s, c.date).id === 'done'
    if (done) continue
    // Neither started nor holding any supply — never worth offering.
    if (!s.hasRun && !(a && a.unjudged > 0)) continue
    rows.push({
      concert: c,
      phase: phaseOf(s, c.date),
      snapshot: s,
      unjudged: a?.unjudged ?? 0,
      opportunity: a?.opportunity ?? 0,
    })
  }
  return rows.sort((x, y) => {
    const xs = x.snapshot.hasRun ? 0 : 1
    const ys = y.snapshot.hasRun ? 0 : 1
    return xs - ys || y.opportunity - x.opportunity || x.concert.date.localeCompare(y.concert.date)
  })
}

function renderRow(r: Row, selected: boolean, width: number): string {
  const mark = selected ? `${CYAN}❯${OFF}` : ' '
  const inFlight = r.snapshot.hasRun
  const badge = inFlight
    ? `${YELLOW}step ${r.phase.step}/${TOTAL_STEPS}${OFF}`
    : `${DIM}not started${OFF}`
  const name = `${r.concert.headliner} · ${r.concert.venue}`
  const trimmed = name.length > width ? name.slice(0, width - 1) + '…' : name.padEnd(width)
  const label = selected ? `${BOLD}${trimmed}${OFF}` : trimmed
  /* An in-flight show reports its OWN progress. The audit's `unjudged` is a snapshot from
     whenever it last ran, and showing "29 unjudged" for a show already fully judged is the
     same class of lie this whole command exists to stop. */
  const supply = inFlight
    ? `${DIM}${r.snapshot.judged}/${r.snapshot.onPage} judged${OFF}`.padEnd(23)
    : `${String(r.unjudged).padStart(3)} unjudged`
  return `${mark} ${r.concert.date}  ${label}  ${supply}  ${badge}`
}

/** Arrow keys, j/k, digits, enter, q. Falls back to a typed number when stdin is not a TTY. */
async function pick(rows: Row[]): Promise<Row | null> {
  if (!process.stdin.isTTY) {
    rows.forEach((r, i) => console.log(`${String(i + 1).padStart(3)}. ${renderRow(r, false, 42)}`))
    console.log('\nNot a TTY — re-run with a date:  npm run media <YYYY-MM-DD>\n')
    return null
  }
  const PAGE = Math.min(rows.length, 15)
  let cursor = 0
  let top = 0

  const draw = (first: boolean) => {
    if (!first) process.stdout.write(`\x1b[${PAGE + 3}A`)
    console.log(`\n${BOLD}Pick a show${OFF}  ${DIM}↑↓ move · enter choose · q quit${OFF}\x1b[K`)
    for (let i = top; i < top + PAGE; i++) {
      process.stdout.write(renderRow(rows[i], i === cursor, 42) + '\x1b[K\n')
    }
    console.log(`${DIM}  ${cursor + 1} of ${rows.length}${OFF}\x1b[K`)
  }

  draw(true)
  emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)
  process.stdin.resume()

  return new Promise((done) => {
    const onKey = (_: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      if (key.name === 'up' || key.name === 'k') cursor = Math.max(0, cursor - 1)
      else if (key.name === 'down' || key.name === 'j') cursor = Math.min(rows.length - 1, cursor + 1)
      else if (key.name === 'return') return finish(rows[cursor])
      else if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) return finish(null)
      else if (key.sequence && /^[1-9]$/.test(key.sequence)) {
        const n = Number(key.sequence) - 1
        if (n < rows.length) cursor = n
      } else return
      if (cursor < top) top = cursor
      if (cursor >= top + PAGE) top = cursor - PAGE + 1
      draw(false)
    }
    const finish = (r: Row | null) => {
      process.stdin.off('keypress', onKey)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      console.log('')
      done(r)
    }
    process.stdin.on('keypress', onKey)
  })
}

// ── The phase view ───────────────────────────────────────────────────────────────────────

function showPhase(concert: Concert, s: Snapshot): Phase {
  const phase = phaseOf(s, concert.date)
  console.log(`\n${BOLD}${concert.date} — ${concert.headliner} @ ${concert.venue}${OFF}` +
    `${DIM}          [ step ${phase.step} of ${TOTAL_STEPS} ]${OFF}\n`)

  const tick = (on: boolean, label: string, detail: string) =>
    console.log(`  ${on ? `${GREEN}✓${OFF}` : `${DIM}·${OFF}`} ${label.padEnd(14)}${on ? detail : `${DIM}${detail}${OFF}`}`)

  tick(s.judged > 0 && s.judged === s.onPage, 'judged',
    s.hasRun ? `${s.judged} of ${s.onPage} assets` : 'not opened yet')
  tick(s.hasSelects && !s.selectsStale, 'finished',
    s.hasSelects ? (s.selectsStale ? 'selects.json is out of date' : 'selects.json + decisions recorded') : 'no selects.json')
  if (s.clipsKept > 0 || s.framesOnPage > 0) {
    tick(minedAlready(s), 'mined',
      minedAlready(s) ? `${s.framesOnPage} frame(s) extracted, ${s.indexedVideos} render(s)` : `${s.clipsKept} clip(s) waiting`)
  }
  tick(s.publishable > 0 && s.indexedCount >= s.publishable, 'ingested',
    s.indexedCount ? `${s.indexedCount} of ${s.publishable || '?'} in media-index.json` : 'not yet')

  console.log(`\n  ${CYAN}→ ${phase.title.toUpperCase()}${OFF}  ${phase.why}`)
  const warn = unmarkedClipWarning(s)
  if (warn && phase.id === 'mine') console.log(`\n  ${YELLOW}⚠${OFF} ${warn}`)
  return phase
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>((r) => rl.question(question, r))
  rl.close()
  return /^y(es)?$/i.test(answer.trim())
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  const concerts = loadConcerts()

  let concert: Concert | undefined
  if (date) {
    concert = concerts.find((c) => c.date === date)
    if (!concert) fail(`No concert on ${date}.`)
  } else {
    const auditFile = readJson<{ shows: Array<{ date: string; unjudged: number; opportunity: number }> }>(AUDIT)
    if (!auditFile) {
      console.log(`\n${DIM}No audit yet — run \`npm run media:audit\` to find where the supply is.${OFF}`)
    }
    const audit = new Map((auditFile?.shows ?? []).map((s) => [s.date, s]))
    const rows = buildRows(concerts, audit, snapshotOf)
    if (rows.length === 0) fail('Nothing to work on. Run `npm run media:audit` first.')
    const chosen = await pick(rows)
    if (!chosen) return
    concert = chosen.concert
  }

  const snap = snapshotOf(concert.date)
  const phase = showPhase(concert, snap)

  if (!phase.command) {
    console.log(`\n  Nothing left to run. Commit it.\n`)
    return
  }
  console.log(`\n  ${DIM}${phase.command}${OFF}`)
  const go = await confirm(`\n  Run this step? [y/N] `)
  if (!go) {
    console.log(`\n  Not run. The command above is the one to use when you are ready.\n`)
    return
  }
  console.log('')
  const [cmd, ...rest] = phase.command.split(' ')
  const result = spawnSync(cmd, rest, { stdio: 'inherit', shell: false })
  if (result.status !== 0) fail(`That step exited with code ${result.status}.`)
}

main()
