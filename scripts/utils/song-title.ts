/**
 * Song title normalization and matching.
 *
 * Reconciles setlist.fm song names with MusicBrainz track titles. The same
 * performance is spelled differently by each source:
 *
 *   setlist.fm                          MusicBrainz
 *   "Enjoy the Silence"            ->   "Enjoy the Silence / Interlude #2: Crucified"
 *   "Behind the Wheel"             ->   "Behind the Wheel (Shave the Monkey remix)"
 *   "Just Can't Get Enough"        ->   "Just Can’t Get Enough"
 *   "Blasphemous Rumours"          ->   "Blasphemous Rumours - 2006 Remaster"
 *
 * ── DESIGN CONSTRAINT: FAIL CLOSED ───────────────────────────────────────────
 * This is the sibling of scripts/utils/album-title.ts and inherits its rule:
 * returning null is a valid, common and CORRECT outcome. Do NOT add a
 * Levenshtein or token-similarity tier.
 *
 * The stakes are higher here than for album titles. A wrongly attributed song
 * becomes a sentence in a first-person liner note claiming the archive owner
 * heard something on a night they did not — and setlist.fm data is
 * fan-contributed, so the input is already noisier than a curated catalogue.
 * An unattributed song is a small gap in a data file. A misattributed one is a
 * fabricated memory.
 *
 * Spec: docs/specs/future/global-setlist-album-attribution.md §Part 2
 */

/**
 * Words marking a parenthetical as a VERSION marker rather than part of the
 * title. Only groups matching this are stripped — see stripSongQualifiers.
 *
 * Deliberately absent: "reprise", "part", "pt", "conclusion", "finale". Those
 * name a distinct track, not a different rendering of the same one — "Encore
 * (Reprise)" and "Encore" can sit on the same record as two tracks.
 */
const VERSION_RE = new RegExp(
  '\\b(' +
    [
      'live',
      'remix(?:ed)?',
      'remaster(?:ed)?',
      're-?master(?:ed)?',
      'mix',
      'edit',
      'radio\\s+edit',
      'single\\s+version',
      'album\\s+version',
      'extended(?:\\s+version)?',
      'acoustic',
      'unplugged',
      'demo',
      'instrumental',
      'a\\s?cappella',
      'mono',
      'stereo',
      'version',
      'take\\s+\\d+',
      'alternate',
      'rehearsal',
      'session',
      'bonus\\s+track',
      'explicit',
      'clean',
      'deluxe',
      'anniversary',
      'reissue',
      '\\d{4}\\s+(?:remaster|mix|version)',
    ].join('|') +
    ')\\b',
  'i'
)

/** "(feat. X)", "featuring X", "ft. X" — never title-bearing on a song. */
const FEAT_RE = /\s*[([]?\s*\b(?:feat|ft|featuring|with)\b\.?\s+[^)\]]*[)\]]?\s*/gi

const MAX_QUALIFIER_PASSES = 3

/** Unicode punctuation folded to ASCII so both sources compare equal. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
}

/**
 * Strip ONLY parentheticals whose contents look like a version marker.
 *
 * Blanket-stripping every parenthetical is wrong — plenty of songs carry a
 * title-bearing group, and it is usually at the FRONT, which is why the
 * trailing-anchored pattern leaves these intact:
 *
 *   "(Don't Fear) The Reaper"
 *   "(I Can't Get No) Satisfaction"
 *   "(What's So Funny 'Bout) Peace, Love and Understanding"
 *
 * Loops because titles stack qualifiers: "Halo (Goldfrapp remix) [2006
 * Remaster]" needs two passes.
 */
export function stripSongQualifiers(title: string): string {
  let out = fold(title).replace(FEAT_RE, ' ')

  for (let i = 0; i < MAX_QUALIFIER_PASSES; i++) {
    const next = out.replace(/\s*[([]([^)\]]*)[)\]]\s*$/, (match, inner: string) =>
      VERSION_RE.test(inner) ? ' ' : match
    )
    if (next === out) break
    out = next
  }

  // Hyphen form: "Blasphemous Rumours - 2006 Remaster", "Halo - Live"
  out = out.replace(/\s*[-–—]\s*[^-–—]*$/, (match) =>
    VERSION_RE.test(match) ? '' : match
  )

  return out.trim()
}

/**
 * Split a track title that carries more than one song.
 *
 * MusicBrainz pressings sometimes merge a hidden interlude or a segue into one
 * track title, which is how *Violator*'s canonical nine tracks arrive as:
 *
 *   "Enjoy the Silence / Interlude #2: Crucified"
 *   "Blue Dress / Interlude #3"
 *
 * Left alone, "Enjoy the Silence" would not match the album it is famously on.
 * Each component is a complete title in its own right, so indexing all of them
 * is exact rather than fuzzy — the worst case is an extra index key that no
 * setlist song ever matches.
 *
 * Only splits on a SPACED slash. "AC/DC" and "24/7" keep their slash.
 */
export function splitMedley(title: string): string[] {
  const parts = title
    .split(/\s+\/\s+/)
    .map(p => p.trim())
    .filter(Boolean)

  return parts.length > 1 ? parts : [title]
}

/**
 * Canonical comparison key.
 *
 * MUST be applied to BOTH sides of every comparison — never compare a raw
 * title against a normalized one.
 *
 * @example
 * foldSongTitle("Enjoy the Silence")            // => "enjoy the silence"
 * foldSongTitle("Behind the Wheel (Remix)")     // => "behind the wheel"
 * foldSongTitle("Just Can’t Get Enough")        // => "just cant get enough"
 * foldSongTitle("Blasphemous Rumours - 2006 Remaster") // => "blasphemous rumours"
 */
export function foldSongTitle(title: string): string {
  if (!title) return ''

  return stripSongQualifiers(title)
    .toLowerCase()
    .replace(/'/g, '') // "can't" -> "cant", not "can t"
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*\+\s*/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Every comparison key a track title should be indexed under.
 *
 * One title can yield several: a merged track contributes each component, and
 * each component is folded independently.
 */
export function songIndexKeys(trackTitle: string): string[] {
  const keys = splitMedley(trackTitle).map(foldSongTitle).filter(Boolean)
  return [...new Set(keys)]
}
