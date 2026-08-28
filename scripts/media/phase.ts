/**
 * Where a show is in the media workflow, derived entirely from what is on disk.
 *
 * WHY THIS EXISTS. The pipeline is seven commands in an order that is not guessable:
 * judge, finish, mine, judge again, finish AGAIN, ingest. The owner reported the obvious
 * problem — "the idea that I'm going to commit to memory every single one of these terminal
 * commands and sequence them in the right order is just not viable" — and had already been
 * bitten by it: `media:review --finish` printed "Next: npm run media:ingest" while seven
 * unmined clips were still sitting there, and following that would have skipped three steps
 * and published a show with none of its video mined.
 *
 * NOTHING NEW IS STORED. The state was always fully derivable — verdicts.json, then
 * selects.json, then extracted frames, then media-index.json. This just reads it in one
 * place so exactly ONE thing decides what comes next and no command can disagree with
 * another about it.
 *
 * PURE, SO IT CAN BE TESTED. `phaseOf` takes a snapshot and returns a verdict. Reading the
 * disk happens in the driver, where it belongs.
 *
 * @module scripts/media/phase
 */

export type PhaseId =
  | 'not-started'
  | 'judging'
  | 'finish'
  | 'mine'
  | 'judge-frames'
  | 'finish-again'
  | 'ingest'
  | 'frame'
  | 'done'

/** Everything phase detection is allowed to look at. */
export interface Snapshot {
  /**
   * Published acts at this show with no hero marked.
   *
   * 🔴 A JUDGEMENT, NOT A NICETY. The hero is one per act per show, set by hand, and it is
   * what a post reaches for first: `getShowAsset` falls back to the lowest ordinal without
   * one, so an unmarked act publishes `-01` of seventeen by default rather than by choice.
   * Counting it here is what stops a show going dark while the decision is still unmade.
   */
  actsMissingHero: number
  /** Published stills with no crop box. Same class of unfinished judgement. */
  stillsUncropped: number
  /** A review run exists for this date. */
  hasRun: boolean
  /** Assets on the review page, extracted frames included. */
  onPage: number
  /** Of those, how many carry a keep/reject verdict. */
  judged: number
  /** Extracted frames staged onto the page (`frame:<uuid>:<n>`). */
  framesOnPage: number
  /** Of those, how many are judged. */
  framesJudged: number
  /** selects.json exists. */
  hasSelects: boolean
  /** selects.json is older than the last verdict keystroke, so it does not reflect them. */
  selectsStale: boolean
  /** Clips kept in selects.json — the ones `media:frames` would mine. */
  clipsKept: number
  /** Kept clips carrying no frame or trim mark, which fall back to automatic picking. */
  clipsUnmarked: number
  /**
   * What this show OUGHT to end up with in media-index.json: every still, plus one render
   * per trimmed clip.
   *
   * NOT the number of selects. A kept clip is a decision to MINE, not to publish, and a
   * clip whose extracted frames were all rejected publishes nothing at all — a legitimate
   * end state, not missing work. Counting selects made 2026-06-04 look permanently
   * unfinished at 25 of 29 when it was complete.
   */
  publishable: number
  /** Assets already in media-index.json for this date. */
  indexedCount: number
  /** Of those, videos — the proof that `media:frames` has actually run. */
  indexedVideos: number
}

export interface Phase {
  id: PhaseId
  /** 1-based, for "step 3 of 6". `done` reports 6. */
  step: number
  title: string
  /** What the owner should understand about this step, in one line. */
  why: string
  /** The command that advances it, or null when there is nothing left to run. */
  command: string | null
}

export const TOTAL_STEPS = 7

/**
 * The one place that decides what comes next.
 *
 * ORDER MATTERS AND IS NOT THE OBVIOUS ONE. Mining comes AFTER the first finish, because
 * `media:frames` reads selects.json to know which clips were kept — that is the gate that
 * keeps 22.5GB of unwanted video off the disk. And finishing happens TWICE, because mining
 * creates stills that did not exist when the first pass was judged.
 */
export function phaseOf(s: Snapshot, date: string): Phase {
  const at = (id: PhaseId, step: number, title: string, why: string, command: string | null): Phase => ({
    id, step, title, why, command,
  })

  if (!s.hasRun) {
    return at('not-started', 1, 'Judge the stills',
      'Opens the review page. Nothing has been looked at yet.',
      `npm run media:review ${date}`)
  }

  // Frames staged but not all judged — the SECOND judging pass.
  if (s.framesOnPage > 0 && s.framesJudged < s.framesOnPage) {
    return at('judge-frames', 4, 'Judge the extracted frames',
      `${s.framesOnPage - s.framesJudged} extracted frame(s) still unjudged. They are stills now — judge them as stills.`,
      `npm run media:review ${date}`)
  }

  if (s.judged < s.onPage) {
    return at('judging', 1, 'Judge the stills',
      `${s.onPage - s.judged} of ${s.onPage} still unjudged. Re-opens the page where you left off.`,
      `npm run media:review ${date}`)
  }

  if (!s.hasSelects || s.selectsStale) {
    const second = s.framesOnPage > 0
    return at(second ? 'finish-again' : 'finish',
      second ? 5 : 2,
      second ? 'Write the decisions again' : 'Write the decisions',
      second
        ? 'Rewrites selects.json to include the frames you just judged. Yes, twice — mining created stills that did not exist the first time.'
        : 'Turns your verdicts into selects.json, and records keeps AND rejects durably in data/media-decisions.json.',
      `npm run media:review ${date} -- --finish`)
  }

  /* MINING OUTRANKS INGESTION, and getting this backwards is what caused the bug this
     function exists to prevent. `media:ingest` publishes whatever is in selects.json and
     reports success — but a clip cannot be published, only mined, so on 2024-08-20 it
     published the show's ONE still, exited 0, and left seven clips untouched. Read as
     "something was ingested, therefore done", that is a show quietly published with all of
     its video missing. So: if clips are kept and `media:frames` has not run, the next step
     is mining, no matter what is already in the index. */
  if (s.clipsKept > 0 && !minedAlready(s)) {
    return at('mine', 3, 'Mine the clips',
      `${s.clipsKept} kept clip(s). Downloads only these — never the rest — and cuts your marks.`,
      `npm run media:frames ${date}`)
  }

  if (s.indexedCount < s.publishable) {
    return at('ingest', TOTAL_STEPS, 'Ingest',
      `${s.publishable - s.indexedCount} of ${s.publishable} publishable asset(s) not in media-index.json yet. ` +
        'Fetches the originals, strips EXIF, names them, and indexes them.',
      `npm run media:ingest ${date}`)
  }

  /* 🔴 INDEXED IS NOT FINISHED. `done` used to mean "every file reached media-index.json",
     which is a statement about ingest, not about the show. Two judgements happen at or
     after publication — the crop box and the hero — and neither counted, so a show with
     four acts and no heroes anywhere read "Done", left the picker, and became unreachable
     from any entry point. Measured 2026-08-28: 4 acts across 2 shows in exactly that state,
     including the 17-still Human League set that three published posts resolve against.

     Both are fixed from the same page and neither needs the Photos library, which is why
     this is one step rather than two. */
  if (s.actsMissingHero > 0 || s.stillsUncropped > 0) {
    const missing = [
      s.actsMissingHero > 0 ? `${s.actsMissingHero} act(s) with no hero` : null,
      s.stillsUncropped > 0 ? `${s.stillsUncropped} still(s) with no crop box` : null,
    ].filter(Boolean).join(' and ')
    return at('frame', TOTAL_STEPS - 1, 'Frame',
      `Published, but ${missing}. The hero is what a post reaches for first, and an ` +
        'uncropped still gets centre-cropped. No Photos access, no prompt.',
      `npm run media:crop ${date}`)
  }

  return at('done', TOTAL_STEPS, 'Done',
    `All ${s.indexedCount} publishable asset(s) are indexed, cropped and have a hero. Commit it.`, null)
}

/**
 * Has `media:frames` run for this show?
 *
 * Extracted frames on the page prove it, but a clip marked only with a trim produces a
 * RENDER and no page frame — so an indexed video is equally good proof. Checking only for
 * frames would send a trim-only show back to mine forever.
 */
export function minedAlready(s: Snapshot): boolean {
  return s.framesOnPage > 0 || s.indexedVideos > 0
}

/**
 * The warning that has to arrive BEFORE the download, not after.
 *
 * Automatic frame picking went 0-for-7 against a hand-marked frame on 2026-06-04 and is
 * retired as a first choice. An unmarked clip still gets it as a fallback, so the owner
 * should know which clips those are while marking them is still cheap — after `media:frames`
 * has fetched a gigabyte of 4K is too late to be told.
 */
export function unmarkedClipWarning(s: Snapshot): string | null {
  if (s.clipsUnmarked === 0) return null
  return `${s.clipsUnmarked} kept clip(s) carry no marks and will fall back to automatic ` +
    `picking, which went 0-for-7 on 2026-06-04. Mark them in Photos first, or expect to reject the picks.`
}

/**
 * What the step actually changed, as plain lines.
 *
 * Separated from printing so it can be tested. The report is the last thing the owner reads
 * before deciding what to do next, and "nothing changed" versus "9 frames extracted" is the
 * difference between re-running a step and moving on — worth pinning down.
 */
export function changeLines(before: Snapshot, after: Snapshot): string[] {
  const moved: string[] = []
  const delta = (label: string, a: number, b: number) => {
    if (a !== b) moved.push(`${label} ${a} → ${b}`)
  }
  delta('judged', before.judged, after.judged)
  delta('frames extracted', before.framesOnPage, after.framesOnPage)
  delta('frames judged', before.framesJudged, after.framesJudged)
  delta('renders', before.indexedVideos, after.indexedVideos)
  delta('in media-index', before.indexedCount, after.indexedCount)
  if (!before.hasSelects && after.hasSelects) moved.push('selects.json written')
  else if (before.selectsStale && !after.selectsStale) moved.push('selects.json brought up to date')
  return moved
}

