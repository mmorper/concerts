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
import { execFileSync, spawn } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { createInterface, emitKeypressEvents } from 'readline'
import { loadConcerts, type Concert } from './show'
import { phaseOf, minedAlready, unmarkedClipWarning, changeLines, TOTAL_STEPS, type Phase, type Snapshot } from './phase'

const REVIEW_ROOT = resolve('concert-photos-audit/review')
const AUDIT = resolve('concert-photos-audit/audit/audit.json')
const MEDIA_INDEX = resolve('public/data/media-index.json')
const REVIEW_PORT = Number(process.env.REVIEW_PORT ?? 8787)

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
    actsMissingHero: 0, stillsUncropped: 0,
  }

  const index = readJson<{ assets: IndexedAsset[] }>(MEDIA_INDEX)
  const mine = (index?.assets ?? []).filter((a) => a.date === date)
  const indexedCount = mine.length
  const indexedVideos = mine.filter((a) => a.kind === 'video').length
  const { actsMissingHero, stillsUncropped } = framingGaps(mine)
  if (!existsSync(runDir)) {
    return { ...empty, indexedCount, indexedVideos, actsMissingHero, stillsUncropped }
  }

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
    actsMissingHero,
    stillsUncropped,
  }
}

interface IndexedAsset {
  date?: string
  kind?: string
  url?: string | null
  artistNormalized?: string | null
  subject?: string | null
  hero?: boolean
  crop?: unknown
}

/**
 * The judgements that happen AFTER a show is published: a hero per act, a crop per still.
 *
 * Heroes are counted per ACT, not per show, because that is how the rule is written — one
 * per act per show — and a bill can run to six acts. A venue or crowd frame is exempt: it
 * has no act to lead, and demanding a hero for it would leave every show permanently
 * unfinished.
 *
 * Stills only. A render carries `url: null` — video is never served from this repo — so it
 * has no box to draw and no post will ever reach for it.
 */
export function framingGaps(assets: IndexedAsset[]): { actsMissingHero: number; stillsUncropped: number } {
  const stills = assets.filter((a) => a.kind === 'image' && a.url)
  const byAct = new Map<string, IndexedAsset[]>()
  for (const a of stills) {
    if (!a.artistNormalized) continue
    const list = byAct.get(a.artistNormalized) ?? []
    list.push(a)
    byAct.set(a.artistNormalized, list)
  }
  let actsMissingHero = 0
  for (const [, list] of byAct) if (!list.some((a) => a.hero)) actsMissingHero++
  return { actsMissingHero, stillsUncropped: stills.filter((a) => !a.crop).length }
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
  snap: (d: string) => Snapshot, all = false): Row[] {
  const rows: Row[] = []
  for (const c of concerts) {
    const s = snap(c.date)
    const a = audit.get(c.date)
    const phase = phaseOf(s, c.date)

    /* 🔴 `all` IS NOT A DEBUG FLAG. A finished show used to be dropped here, which made this
       a worklist with no way back: the owner could not reach a published show to redo a crop
       or mark a hero, from this command or any other. Browsing to a show you already
       finished is a first-class need — "I want to change my mind about that frame" — and it
       is served by the same picker rather than by a second tool with its own conventions. */
    if (!all && phase.id === 'done') continue

    // Nothing here at all — never worth offering, in either mode.
    if (!s.hasRun && !(a && a.unjudged > 0) && s.indexedCount === 0) continue

    rows.push({ concert: c, phase, snapshot: s, unjudged: a?.unjudged ?? 0, opportunity: a?.opportunity ?? 0 })
  }
  return rows.sort((x, y) => {
    /* Work first, finished last. In browse mode a done show is a destination rather than a
       task, so it sorts below anything still carrying an unmade decision — and `frame`
       (published but unheroed or uncropped) is work, so it sorts up with the rest. */
    const rank = (r: Row) => (r.phase.id === 'done' ? 2 : r.snapshot.hasRun ? 0 : 1)
    return rank(x) - rank(y) || y.opportunity - x.opportunity || x.concert.date.localeCompare(y.concert.date)
  })
}

function renderRow(r: Row, selected: boolean, width: number): string {
  const mark = selected ? `${CYAN}❯${OFF}` : ' '
  const inFlight = r.snapshot.hasRun
  const badge = r.phase.id === 'done'
    ? `${GREEN}done${OFF}`
    : inFlight
      ? `${YELLOW}step ${r.phase.step}/${TOTAL_STEPS}${OFF}`
      : `${DIM}not started${OFF}`
  const name = `${r.concert.headliner} · ${r.concert.venue}`
  const trimmed = name.length > width ? name.slice(0, width - 1) + '…' : name.padEnd(width)
  const label = selected ? `${BOLD}${trimmed}${OFF}` : trimmed
  /* An in-flight show reports its OWN progress. The audit's `unjudged` is a snapshot from
     whenever it last ran, and showing "29 unjudged" for a show already fully judged is the
     same class of lie this whole command exists to stop. */
  /* A published show reports what is PUBLISHED, not what was judged. Once assets are in the
     index, "29/29 judged" is history; what matters is how many stills there are and whether
     they still need a decision — which is the whole reason a finished show is reachable. */
  const published = r.snapshot.indexedCount > 0
  const gaps = [
    r.snapshot.actsMissingHero > 0 ? `${r.snapshot.actsMissingHero} no hero` : null,
    r.snapshot.stillsUncropped > 0 ? `${r.snapshot.stillsUncropped} uncropped` : null,
  ].filter(Boolean).join(' · ')
  const supply = published
    ? (gaps
        ? `${YELLOW}${r.snapshot.indexedCount} assets · ${gaps}${OFF}`
        : `${DIM}${r.snapshot.indexedCount} assets published${OFF}`).padEnd(gaps ? 32 : 33)
    : inFlight
      ? `${DIM}${r.snapshot.judged}/${r.snapshot.onPage} judged${OFF}`.padEnd(23)
      : `${String(r.unjudged).padStart(3)} unjudged`
  return `${mark} ${r.concert.date}  ${label}  ${supply}  ${badge}`
}

/**
 * Arrow keys, j/k, digits, enter, a, q. Falls back to a typed number when stdin is not a TTY.
 *
 * Takes BOTH lists so `a` can swap between them without re-reading the disk. The work list
 * is what you want nine times in ten; the full list is how you get back to a show you have
 * already finished, which was unreachable from anywhere before.
 */
async function pick(work: Row[], all: Row[], startAll: boolean): Promise<Row | null> {
  let showingAll = startAll
  let rows = showingAll ? all : work

  if (!process.stdin.isTTY) {
    rows.forEach((r, i) => console.log(`${String(i + 1).padStart(3)}. ${renderRow(r, false, 42)}`))
    console.log(`\nNot a TTY — re-run with a date:  npm run media <YYYY-MM-DD>` +
      `${showingAll ? '' : '\nOr list every show, finished ones included:  npm run media -- --all'}\n`)
    return null
  }
  let PAGE = Math.min(rows.length, 15)
  let cursor = 0
  let top = 0

  const draw = (first: boolean) => {
    if (!first) process.stdout.write(`\x1b[${PAGE + 3}A`)
    console.log(`\n${BOLD}Pick a show${OFF}  ${DIM}↑↓ move · enter choose · ${showingAll ? 'a work only' : 'a show all'} · q quit${OFF}\x1b[K`)
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
      } else if (key.name === 'a') {
        /* Keep the cursor on the SAME SHOW across the toggle where it exists. Jumping to the
           top of a longer list every time loses your place, and the whole point of `a` is to
           see more of what you are already looking at. */
        const held = rows[cursor]?.concert.date
        showingAll = !showingAll
        rows = showingAll ? all : work
        if (!rows.length) { showingAll = !showingAll; rows = showingAll ? all : work; return }
        const found = rows.findIndex((r) => r.concert.date === held)
        cursor = found >= 0 ? found : 0
        const before = PAGE
        PAGE = Math.min(rows.length, 15)
        top = Math.max(0, Math.min(cursor, rows.length - PAGE))
        // The frame is a different height now, so redraw from scratch rather than stepping
        // the cursor up by the old count and leaving the tail of the longer list on screen.
        if (PAGE !== before) { process.stdout.write(`\x1b[${before + 3}A\x1b[J`); draw(true); return }
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

/**
 * A review server left running from an earlier session.
 *
 * `media:review` refuses outright when the port is taken (#405), which is right for a bare
 * command but wrong for the driver — the owner's answer to "port busy" is always going to be
 * "then stop it". One stale server survived 22 hours and served the wrong show's
 * photographs for a whole session, so the driver offers to clear it instead of handing back
 * a `kill` command to paste.
 */
function staleServer(): { pid: string; servingDate: string | null } | null {
  let pid: string
  try {
    pid = execFileSync('lsof', ['-nP', `-iTCP:${REVIEW_PORT}`, '-sTCP:LISTEN', '-t'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim().split('\n')[0]
  } catch {
    return null
  }
  if (!pid) return null
  let servingDate: string | null = null
  try {
    const env = execFileSync('ps', ['eww', '-o', 'command=', '-p', pid], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString()
    servingDate = /REVIEW_DIR=\S*?\/(\d{4}-\d{2}-\d{2})/.exec(env)?.[1] ?? null
  } catch {
    /* the PID alone is enough to offer */
  }
  return { pid, servingDate }
}

/** True when the step is clear to run. */
async function clearPort(forDate: string): Promise<boolean> {
  const held = staleServer()
  if (!held) return true
  const what = held.servingDate
    ? held.servingDate === forDate
      ? `still serving this show`
      : `serving ${held.servingDate} — a DIFFERENT show`
    : 'serving something else'
  console.log(`\n  ${YELLOW}⚠${OFF} A review server is already running (pid ${held.pid}), ${what}.`)
  if (!(await confirm(`  Stop it? [y/N] `))) {
    console.log(`\n  Left running. Nothing else can use port ${REVIEW_PORT} until it stops.\n`)
    return false
  }
  try {
    process.kill(Number(held.pid), 'SIGTERM')
  } catch {
    /* already gone */
  }
  // Verify it actually released the port rather than trusting the signal.
  for (let i = 0; i < 20; i++) {
    if (!staleServer()) {
      console.log(`  ${GREEN}✓${OFF} Stopped.`)
      return true
    }
    execFileSync('sleep', ['0.25'])
  }
  console.log(`\n  ${YELLOW}⚠${OFF} pid ${held.pid} is still holding the port. Try: kill -9 ${held.pid}\n`)
  return false
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
  /* Only once something is published: before that there is nothing to crop and no act to
     lead, and a permanently-unticked row would read as a step being skipped. */
  if (s.indexedCount > 0) {
    const framed = s.actsMissingHero === 0 && s.stillsUncropped === 0
    tick(framed, 'framed',
      framed
        ? 'every act has a hero, every still a crop box'
        : [
            s.actsMissingHero > 0 ? `${s.actsMissingHero} act(s) with no hero` : null,
            s.stillsUncropped > 0 ? `${s.stillsUncropped} still(s) uncropped` : null,
          ].filter(Boolean).join(', '))
  }

  console.log(`\n  ${CYAN}→ ${phase.title.toUpperCase()}${OFF}  ${phase.why}`)
  const warn = unmarkedClipWarning(s)
  if (warn && phase.id === 'mine') console.log(`\n  ${YELLOW}⚠${OFF} ${warn}`)
  return phase
}

/**
 * Ask, and default to no.
 *
 * Reads stdin whether or not it is a terminal: a piped `y` is an explicit yes from whoever
 * ran the command, and refusing to look made the stop-the-server path untestable. EOF, a
 * blank line, and anything that is not yes all mean NO — every step behind this prompt
 * either reaches the Photos library, costs a download, or writes to the repo.
 */
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>((r) => {
    rl.question(question, r)
    rl.on('close', () => r(''))
  })
  rl.close()
  return /^y(es)?$/i.test(answer.trim())
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  /* `--all` lists every show that has media, finished ones included. The picker also toggles
     it live with `a`, which is the discovery path — nobody reads a flag they do not know to
     look for. */
  const showAll = args.includes('--all') || args.includes('-a')
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
    const work = buildRows(concerts, audit, snapshotOf, false)
    const everything = buildRows(concerts, audit, snapshotOf, true)
    /* Only truly empty when there is nothing in EITHER list. "Nothing to work on" while a
       published show sits there waiting for a hero is the same lie this command exists to
       stop — and it is the state the owner hit. */
    if (everything.length === 0) fail('Nothing to work on. Run `npm run media:audit` first.')
    if (work.length === 0) {
      console.log(`\n${DIM}Nothing outstanding. Showing every show with media — press ${OFF}a${DIM} for the work list.${OFF}`)
    }
    const chosen = await pick(work, everything, showAll || work.length === 0)
    if (!chosen) return
    concert = chosen.concert
  }

  const snap = snapshotOf(concert.date)
  const phase = showPhase(concert, snap)

  if (!phase.command) {
    console.log(`\n  Nothing left to run. Commit it.\n`)
    return
  }
  // Only the page-opening steps need the port; --finish, mining and ingest do not.
  const needsPort = phase.command.includes('media:review') && !phase.command.includes('--finish')

  /* Cleared BEFORE the confirm, not after. Asking "run this step?" and only then
     discovering the port is taken puts the owner a keystroke past a decision that was
     never available. */
  if (needsPort && !(await clearPort(concert.date))) return

  console.log(`\n  ${DIM}${phase.command}${OFF}`)
  if (needsPort) {
    console.log(`  ${DIM}Opens a page and holds this terminal. Ctrl-C when you are done judging —` +
      ` that stops the server too.${OFF}`)
  }
  const go = await confirm(`\n  Run this step? [y/N] `)
  if (!go) {
    console.log(`\n  Not run. The command above is the one to use when you are ready.\n`)
    return
  }

  console.log('')
  const code = await runStep(phase.command)

  /* An interrupted review is a NORMAL ending. Ctrl-C is how you finish judging — the page
     holds the terminal until you stop it — so 130 and a SIGINT death are success here. A
     real non-zero exit is not. */
  if (code !== 0 && code !== 130) fail(`That step exited with code ${code}.`)

  report(concert, snap, snapshotOf(concert.date))
}

/**
 * Run one step, and outlive it.
 *
 * THE CHILD GETS ITS OWN PROCESS GROUP. Ctrl-C goes to the whole foreground group, so with
 * an ordinary spawn the driver dies alongside the review server and the owner gets no
 * report at the one moment they most want one — right after judging, when they need to know
 * what changed and what is next. Measured: it printed nothing at all.
 *
 * Swallowing SIGINT was tried first and cannot work. `spawnSync` blocks the event loop, so
 * a registered handler never runs; the signal is delivered to a process that has no
 * opportunity to act on it. The fix is not to catch the signal later but to stop the child
 * from being in the group that receives it: `detached` puts it in its own, the terminal
 * signals only the driver, and the driver forwards it deliberately and then reports.
 */
function runStep(command: string): Promise<number> {
  const [cmd, ...rest] = command.split(' ')
  return new Promise((done) => {
    const child = spawn(cmd, rest, { stdio: 'inherit', shell: false, detached: true })
    const forward = () => {
      // Signal the child's whole GROUP — negative pid — because the step is `npm run …`,
      // which is itself a parent of the process doing the work.
      try {
        if (child.pid) process.kill(-child.pid, 'SIGINT')
      } catch {
        /* already gone */
      }
    }
    process.on('SIGINT', forward)
    child.on('exit', (status, signal) => {
      process.off('SIGINT', forward)
      done(signal ? 130 : (status ?? 1))
    })
  })
}

/** What the step changed, and where that leaves the show. */
function report(concert: Concert, before: Snapshot, after: Snapshot): void {
  console.log(`\n${DIM}${'─'.repeat(58)}${OFF}`)
  console.log(`\n${BOLD}${concert.date} — ${concert.headliner}${OFF}`)

  const moved = changeLines(before, after)
  /* Say "nothing changed" out loud rather than printing an empty section. A step that ran
     and moved nothing is worth noticing — it usually means the page was opened and closed
     without judging anything. */
  console.log(moved.length ? moved.map((m) => `  ${GREEN}✓${OFF} ${m}`).join('\n') : `  ${DIM}nothing changed${OFF}`)

  const next = phaseOf(after, concert.date)
  if (!next.command) {
    console.log(`\n  ${GREEN}✓ DONE${OFF}  ${next.why}`)
    console.log(`\n  Commit it, then ${BOLD}npm run media${OFF} for the next show.\n`)
    return
  }
  console.log(`\n  ${CYAN}→ NEXT: ${next.title.toUpperCase()}${OFF}  ${DIM}[ step ${next.step} of ${TOTAL_STEPS} ]${OFF}`)
  console.log(`  ${next.why}`)
  const warn = unmarkedClipWarning(after)
  if (warn && next.id === 'mine') console.log(`\n  ${YELLOW}⚠${OFF} ${warn}`)
  console.log(`\n  ${BOLD}npm run media ${concert.date}${OFF}${DIM}   to run it${OFF}\n`)
}

/* Only run when INVOKED, never when imported.
   A bare `main()` meant `import('./index')` from a test started the driver — which in CI,
   where the gitignored audit.json does not exist, reached `fail()` and exited 1. The suite
   reported 1244 passing and the run still failed. audit.ts already guards this way; this
   did not. */
if (process.argv[1] && /media\/index\.ts$/.test(process.argv[1])) main()
