/**
 * Match an inbox folder name to one act on that night's bill.
 *
 * WHY THIS CAN AFFORD TO BE FORGIVING: it only ever matches against ONE SHOW'S LINEUP —
 * two to six candidates — so the space is tiny and genuine ambiguity is close to
 * impossible. `"human league"`, `"Human League"` and `"the-human-league"` must all resolve,
 * because the owner is typing folder names by hand after a show, not filling in a form.
 *
 * WHY IT STILL FAILS LOUD: getting this wrong means fabricated attribution. 89 of 184
 * shows (48%) have openers — 187 credits — so a folder quietly resolving to the headliner
 * would mis-credit photographs on half the archive, and the post would state it as fact.
 * An unknown or ambiguous folder therefore fails with the lineup printed, and never
 * guesses.
 *
 * @module scripts/media/match
 */
import type { Act } from './show'
import { VENUE_FOLDER } from './show'

/** Frames belonging to the night rather than a performer. */
export type VenueMatch = { kind: 'venue' }
export type ActMatch = { kind: 'act'; act: Act }
export type UnknownMatch = { kind: 'unknown'; folder: string }
export type AmbiguousMatch = { kind: 'ambiguous'; folder: string; candidates: Act[] }
export type FolderMatch = VenueMatch | ActMatch | UnknownMatch | AmbiguousMatch

/** Articles dropped when comparing. English only — the archive's acts are English-named. */
const LEADING_ARTICLE = /^(the|a|an)[-\s]+/

/** Punctuation and case removed; `"The Go-Go's"` and `"go gos"` must meet somewhere. */
const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const slugish = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const dropArticle = (s: string) => s.replace(LEADING_ARTICLE, '')

/**
 * The forms a folder name can take, loosest last.
 *
 * Tried in order so an exact spelling always beats a loose one — otherwise two acts whose
 * loose forms collide would report as ambiguous even when the folder named one exactly.
 */
function folderKeys(name: string): string[][] {
  const slug = slugish(name)
  return [
    [slug],
    [dropArticle(slug)],
    [loose(name), loose(dropArticle(slug))],
  ]
}

/**
 * The forms an ACT can be addressed by, at each tier.
 *
 * Tier 0 is the act's ASSIGNED slug and nothing else. That slug is unique across the bill
 * by construction — `folderPlan` suffixes a collision rather than merging two credits — and
 * it is the literal name of the folder that was scaffolded for this act. Re-deriving it
 * from the act's name here instead would throw that disambiguation away, and two acts
 * called "The Band" and "The Band!" would both claim the folder `the-band/` and report as
 * ambiguous even though exactly one of them owns it.
 */
function actKeys(act: Act): string[][] {
  const slug = slugish(act.name)
  return [
    [act.slug],
    [dropArticle(slug)],
    [loose(act.name), loose(dropArticle(slug))],
  ]
}

/**
 * Resolve one folder name against one night's bill.
 *
 * `_venue` (and the bare `venue`) resolve to the night itself, unless an act on the bill
 * is genuinely called that — the bill wins, because a real credit outranks a convention.
 */
export function matchFolder(folder: string, lineup: Act[]): FolderMatch {
  const name = folder.trim()
  const folderSlug = slugish(name)

  const actHit = (tier: number): Act[] => {
    const wanted = folderKeys(name)[tier]
    return lineup.filter((act) => actKeys(act)[tier].some((k) => wanted.includes(k)))
  }

  for (let tier = 0; tier < 3; tier++) {
    const hits = actHit(tier)
    if (hits.length === 1) return { kind: 'act', act: hits[0] }
    if (hits.length > 1) return { kind: 'ambiguous', folder, candidates: hits }
  }

  if (folderSlug === slugish(VENUE_FOLDER) || folderSlug === 'venue') return { kind: 'venue' }
  return { kind: 'unknown', folder }
}

/** The message an unknown or ambiguous folder fails with. Always prints the bill. */
export function explainMatchFailure(match: UnknownMatch | AmbiguousMatch, date: string, lineup: Act[]): string {
  const bill = lineup.map((a) => `  ${a.name}  (${a.slug}/)`).join('\n')
  if (match.kind === 'ambiguous') {
    const names = match.candidates.map((a) => a.name).join(' / ')
    return (
      `${date}/${match.folder}/ matches more than one act on the bill: ${names}\n` +
      `Rename the folder to one of these exactly:\n${bill}`
    )
  }
  return (
    `${date}/${match.folder}/ does not match any act on that night's bill.\n` +
    `Nothing was ingested from it — a guess here would mis-credit the photograph.\n` +
    `That night's lineup:\n${bill}\n` +
    `  (or ${VENUE_FOLDER}/ for the venue, marquee, stub or crowd)`
  )
}

/**
 * A frame extracted from a clip, recognised by the name `extract_frames.sh` gives it:
 * `IMG_3081__f0012__lap42.31.jpg`.
 *
 * Provenance matters beyond bookkeeping: a still pulled from video is still tier 1
 * personal media, but knowing which clip it came from is what lets a different-night
 * disclosure be written accurately.
 */
export function parseDerivedFrom(filename: string): { original: string; frame: number } | null {
  const m = /^(.+?)__f(\d+)__lap[\d.]+$/.exec(filename.replace(/\.[^.]+$/, ''))
  return m ? { original: m[1], frame: Number(m[2]) } : null
}

/** `hero.*` or `01.*` marks the frame that leads the post. Otherwise naming is free. */
export function isHeroName(filename: string): boolean {
  const stem = filename.replace(/\.[^.]+$/, '').toLowerCase()
  return stem === 'hero' || stem === '01' || stem === '1'
}
