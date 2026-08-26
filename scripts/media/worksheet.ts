/**
 * Render WORKSHEET.md — the thing that actually points at photographs.
 *
 * The tool does not review media. Photos.app does playback, scrubbing, frame export and
 * trimming better than anything this project would build, and driving it through
 * AppleScript needs a separate Automation permission plus 15-30GB of downloads. So the
 * worksheet POINTS: `original_filename` (IMG_5693.HEIC) is directly searchable in the
 * Photos search field, and that is the whole point of the column.
 *
 * It RANKS, it does not filter. Everything in the window is listed, and every stage says
 * what it excluded — the window looked like it was finding concerts for a whole session
 * before anyone checked, and a stage that silently discards is a stage that can be wrong
 * invisibly.
 *
 * @module scripts/media/worksheet
 */
import type { Act, Concert } from './show'
import { VENUE_FOLDER } from './show'
import type { Ranked } from './rank'

export interface WorksheetInput {
  concert: Concert
  acts: Act[]
  window: { from: string; to: string }
  coarseScanned: number
  excluded: { no_date: number; outside_window: number }
  scored: Ranked[]
  unscored: Ranked[]
  generatedAt: string
}

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}`)

const dims = (r: Ranked) => (r.width && r.height ? `${r.width}×${r.height}` : '—')

const secs = (r: Ranked) =>
  r.duration === null ? '—' : r.duration >= 60
    ? `${Math.floor(r.duration / 60)}m${String(Math.round(r.duration % 60)).padStart(2, '0')}s`
    : `${r.duration.toFixed(1)}s`

const kind = (r: Ranked) => (r.is_movie ? 'video' : r.live_photo ? 'live' : 'photo')

const yes = (b: boolean) => (b ? '✓' : '')

const who = (r: Ranked) => {
  if (r.contributors.length === 0) return '—'
  // First names are enough and the full list is noise; the question is whose camera.
  return r.contributors.map((c) => c.split(' ')[0]).join('/')
}

const HEAD =
  '| # | `original_filename` | time | type | dur | resolution | orient | 9:16 | grab | tag | likely | qual | who | signals |'
const RULE = '|--:|---|--:|---|--:|---|---|:-:|:-:|:-:|--:|--:|---|---|'

function row(r: Ranked, i: number): string {
  return [
    `${i + 1}`,
    `\`${r.original_filename}\``,
    r.local_time.slice(11, 16),
    kind(r),
    secs(r),
    dims(r),
    r.orientation.slice(0, 4),
    yes(r.vertical916),
    yes(r.frameGrab),
    yes(r.mhTagged),
    pct(r.likelihood),
    pct(r.quality),
    who(r),
    r.signals.join(' ') || '—',
  ]
    .map((cell) => `| ${cell} `)
    .join('') + '|'
}

export function renderWorksheet(input: WorksheetInput): string {
  const { concert, acts, window, scored, unscored, excluded, coarseScanned } = input
  const total = scored.length + unscored.length
  const videos = [...scored, ...unscored].filter((r) => r.is_movie)
  const missing = [...scored, ...unscored].filter((r) => r.is_missing)
  const lines: string[] = []

  lines.push(`# ${concert.date} — ${concert.headliner} @ ${concert.venue}`)
  lines.push('')
  lines.push(
    `**${concert.city}, ${concert.state}** · ${acts.length} ${acts.length === 1 ? 'act' : 'acts'} on the bill · ` +
      `generated ${input.generatedAt} by \`npm run media:prep ${concert.date}\``
  )
  lines.push('')
  lines.push(
    '> Generated file — a re-run replaces it, and the previous copy is kept as ' +
      '`WORKSHEET.prev.md`. Anything you want to survive belongs in `notes.txt`.'
  )
  lines.push('')

  lines.push('## The bill')
  lines.push('')
  lines.push('| act | role | folder |')
  lines.push('|---|---|---|')
  for (const act of acts) lines.push(`| ${act.name} | ${act.role} | \`${act.slug}/\` |`)
  lines.push(`| — | the night | \`${VENUE_FOLDER}/\` |`)
  lines.push('')
  lines.push(
    'Every act has a folder, **including the headliner**. There is no implicit default: a ' +
      'file left at the root of the date folder is an error `media:ingest` will flag, ' +
      'rather than a wrong credit it would silently produce. 89 of 184 shows (48%) have ' +
      'openers.'
  )
  lines.push('')
  lines.push(
    `\`${VENUE_FOLDER}/\` is for frames that belong to the night rather than a performer — ` +
      'marquee, exterior, ticket stub, crowd before doors. Those matter out of proportion ' +
      'to their number: venue-subject posts have no working tier-2 fallback while Places ' +
      'is unreliable (#315), so a personal marquee shot is often the only image available ' +
      'at tier 1 or 2.'
  )
  lines.push('')
  lines.push('**An empty artist folder is a signal, not an absence** — it means no personal')
  lines.push('media for that act, and the post falls back to tier 2.')
  lines.push('')

  lines.push('## How to use this')
  lines.push('')
  lines.push(
    '1. Search Photos.app for the `original_filename` — that column exists to be pasted ' +
      'into the search field.'
  )
  lines.push(
    '2. Review there. Video especially: **a poster frame cannot be judged**, so play it. ' +
      'Photos does scrubbing, frame export and trimming better than this project ever will.'
  )
  lines.push(
    `3. Export the keepers into the folder for **whoever is in the frame**, under ` +
      `\`inbox/${concert.date}/\`.`
  )
  lines.push('4. Name a hero `hero.*` or `01.*` if you have one. Otherwise naming is free.')
  lines.push('5. `npm run media:ingest` when the folders are filled.')
  lines.push('')
  lines.push(
    'If a frame is from a **different night**, say so in `notes.txt`. Implying a photo is ' +
      '*the* night when it is not is a fabricated memory, and the post must disclose it.'
  )
  lines.push('')

  lines.push('## What was searched, and what was excluded')
  lines.push('')
  lines.push('| stage | count |')
  lines.push('|---|--:|')
  lines.push(`| Assets handed over by the coarse date pre-filter | ${coarseScanned} |`)
  lines.push(`| — excluded: no capture date | ${excluded.no_date} |`)
  lines.push(`| — excluded: outside ${window.from.slice(11, 16)}–${window.to.slice(11, 16)} local | ${excluded.outside_window} |`)
  lines.push(`| **Candidates listed below** | **${total}** |`)
  lines.push(`| — of those, video | ${videos.length} |`)
  lines.push(`| — of those, unscored by Photos | ${unscored.length} |`)
  lines.push(`| — of those, iCloud-only (will download on open) | ${missing.length} |`)
  lines.push('')
  lines.push(
    `**Nothing else was excluded.** Every asset in the window is listed, in both tables. ` +
      'The ranking sorts; it never removes. A hard cut would drop the 18:00 daylight ' +
      'marquee shot, which is the scarcest frame in the archive.'
  )
  lines.push('')
  lines.push(
    '⚠️ **The window is a DATE filter, not a concert filter.** 17:00→04:00 catches the ' +
      'whole evening — dinner, the drive, the after-party. Of 66 frames in the Beck ' +
      "window (2018-04-27), *none* were of the concert; they were a wedding. Treat " +
      '`likely` as the tool\'s guess at subject and trust your own eyes over it.'
  )
  lines.push('')

  lines.push('## Candidates')
  lines.push('')
  lines.push(
    '`likely` = concert-likelihood, is this the right **subject** (labels, darkness, ' +
      'location, hour, your own `mh-concerts` tag). `qual` = is it worth **publishing** ' +
      "(Apple's `overall` and `curation` only — the other fields reward frames containing " +
      'faces, and 35% of concert stills have no person in them). Both are 0–100. ' +
      'They are independent: a real concert photo can be a bad one.'
  )
  lines.push('')
  lines.push('Sorted by likelihood × quality.')
  lines.push('')

  if (scored.length === 0) {
    lines.push('_No scored candidates in this window._')
  } else {
    lines.push(HEAD)
    lines.push(RULE)
    scored.forEach((r, i) => lines.push(row(r, i)))
  }
  lines.push('')

  if (unscored.length > 0) {
    lines.push('### Unscored by Photos')
    lines.push('')
    lines.push(
      `${unscored.length} of ${total} assets carry an all-zero \`ScoreInfo\`. Photos never ` +
        'scored them, and osxphotos cannot distinguish that from a genuine zero. The scale ' +
        'is **signed** (≈−1..+1), so zero is *mid-range* — left in the table above these ' +
        'would sort into the middle and read as average photographs. They are listed ' +
        'separately and ordered by likelihood alone. **Judge them by eye; they are not ' +
        'worse, they are unmeasured.**'
    )
    lines.push('')
    lines.push(HEAD)
    lines.push(RULE)
    unscored.forEach((r, i) => lines.push(row(r, i)))
    lines.push('')
  }

  if (videos.length > 0) {
    const v916 = videos.filter((r) => r.vertical916).length
    const grabbable = videos.filter((r) => r.frameGrab).length
    lines.push('### Video')
    lines.push('')
    lines.push(
      `${videos.length} clips · ${v916} are 9:16-capable (tier 3 supply) · ${grabbable} ` +
        'clear the frame-grab bar (short side ≥ 1350).'
    )
    lines.push('')
    lines.push(
      '**Watch these, and mark the moment by hand.** A clip that is dull to watch can ' +
        'still hold the best still of the night — but only you can find it. Algorithmic ' +
        'picking was retired 2026-08-25: it scores frames by sharpness, motion blurs ' +
        'frames, so it reliably picks the stillest and dullest instant of a clip. Judged ' +
        'beside a hand-marked frame, 0 of 7 auto picks survived. Scrub in Photos, read the ' +
        'time off the scrubber, and enter it as a frame mark in the review page.'
    )
    lines.push('')
    lines.push(
      'A 9:16 crop of landscape capture is limited by height: 1080p landscape yields ' +
        '607×1080 and fails, 4K landscape yields 1215×2160 and passes. Portrait always passes.'
    )
    lines.push('')
  }

  return lines.join('\n') + '\n'
}
