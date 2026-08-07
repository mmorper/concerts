/**
 * Album title normalization and matching.
 *
 * Reconciles iTunes album names (`artists-top-tracks.json`) with MusicBrainz
 * release-group titles (`discography.json`). The same album is spelled
 * differently by each source:
 *
 *   iTunes                                       MusicBrainz
 *   "Violator (Deluxe)"                     ->   "Violator"
 *   "Speak and Spell (Deluxe)"              ->   "Speak & Spell"
 *   "Garbage (20th Anniversary Edition)
 *    [2015 Remaster]"                       ->   "Garbage"
 *   "Honky Château (Bonus Track Version)"   ->   "Honky Château"
 *
 * Measured on live data: a naive lowercase comparison matches 58.1% of eligible
 * names; this module matches 74.0% (758 of 1,024) on current data.
 *
 * ── DESIGN CONSTRAINT: FAIL CLOSED ───────────────────────────────────────────
 * Returning null is a valid, common, and CORRECT outcome. Do not add a
 * Levenshtein / token-similarity tier to push the rate higher. The residual
 * misses are not a normalization problem — they are upstream artist
 * mis-resolution in the iTunes enrichment (see #275):
 *
 *   bad-religion   :: channel ORANGE     <- Frank Ocean
 *   common-sense   :: Schmilco           <- Wilco
 *   abc            :: Nursery Rhymes
 *
 * A fuzzier matcher would bind "channel ORANGE" to *something* in Bad
 * Religion's 100-release list and emit a fabricated claim into a first-person
 * liner note. On contaminated input the correct output is nothing.
 *
 * Shared with the future setlist song -> album attribution work (v5.5), which
 * is why this is a standalone util rather than a private helper. Keep it free
 * of caller-specific logic.
 *
 * Spec: docs/specs/future/global-discography-trajectory.md §Part 1
 */

/**
 * Words that mark a parenthetical as an edition marker rather than part of the
 * title. Only groups matching this are stripped — see stripQualifiers.
 */
const EDITION_RE = new RegExp(
  '\\b(' +
    [
      'deluxe',
      'expanded',
      'remaster(?:ed)?',
      're-?master(?:ed)?',
      'anniversary',
      'edition',
      'bonus\\s+track(?:s)?',
      'bonus',
      'special',
      "collector'?s?",
      'collectors',
      'reissue',
      'version',
      'explicit',
      'clean',
      'mono',
      'stereo',
      'remix(?:es|ed)?',
      'extended',
      'legacy',
      'definitive',
      'complete',
      'super',
      'platinum',
      'gold',
      'digital',
      'japanese',
      'international',
      'us',
      'uk',
      '\\d{4}\\s+remaster',
      '\\d+(?:st|nd|rd|th)',
    ].join('|') +
    ')\\b',
  'i'
)

/** "(feat. X)" / "[featuring Y]" — never part of an album's identity. */
const FEAT_RE = /\s*[([]\s*(feat|featuring|with)\.?\s[^)\]]*[)\]]/gi

/** iTunes marks non-album releases with a trailing " - Single" / " - EP". */
const TRAILING_KIND_RE = /\s*[-–—]\s*(single|ep|maxi[- ]single)\s*$/i

/** Max stacked qualifier groups to strip: "X (Deluxe Version) [Remastered]". */
const MAX_QUALIFIER_PASSES = 4

/**
 * Unicode folding: strip diacritics, straighten curly quotes, normalize dashes.
 *
 * "Honky Château" -> "Honky Chateau". Note this FOLDS rather than deletes —
 * deleting the accented character is the bug that produced `tone-l-c` from
 * "Tone-Lōc" in the artist keys (see artist-key.ts).
 */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
}

/**
 * Strip ONLY parentheticals whose contents look like an edition marker.
 *
 * Blanket-stripping every parenthetical is wrong — these carry title-bearing
 * groups and must survive:
 *
 *   "(What's the Story) Morning Glory?"
 *   "Duran Duran (The Wedding Album)"
 *
 * Loops because titles stack qualifiers: "Hello Nasty (Deluxe Version)
 * [Remastered]" needs two passes.
 */
export function stripQualifiers(title: string): string {
  let out = fold(title).replace(FEAT_RE, '')

  for (let i = 0; i < MAX_QUALIFIER_PASSES; i++) {
    const next = out.replace(/\s*[([]([^)\]]*)[)\]]\s*$/, (match, inner: string) =>
      EDITION_RE.test(inner) ? ' ' : match
    )
    if (next === out) break
    out = next
  }

  // Hyphen form: "Rio - Deluxe Edition", "Faith - 2010 Remaster"
  out = out.replace(/\s*[-–—]\s*[^-–—]*$/, (match) => (EDITION_RE.test(match) ? '' : match))

  return out.trim()
}

/**
 * Canonical comparison key.
 *
 * MUST be applied to BOTH sides of every comparison — never compare a raw
 * title against a normalized one.
 *
 * @example
 * normalizeAlbumTitle("Violator (Deluxe)")      // => "violator"
 * normalizeAlbumTitle("Speak & Spell")          // => "speak and spell"
 * normalizeAlbumTitle("Honky Château")          // => "honky chateau"
 */
export function normalizeAlbumTitle(title: string): string {
  if (!title) return ''

  return stripQualifiers(title)
    .replace(TRAILING_KIND_RE, '')
    .toLowerCase()
    .replace(/'/g, '') // "what's" -> "whats", not "what s"
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*\+\s*/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** iTunes and MusicBrainz disagree about leading articles. Tier 2 uses this. */
export function dropLeadingArticle(key: string): string {
  return key.replace(/^(the|a|an)\s+/, '')
}

/** True for iTunes' " - Single" / " - EP" suffixes. Excluded before matching. */
export function isSingleOrEp(title: string): boolean {
  return TRAILING_KIND_RE.test(fold(title))
}

export type MatchTier = 'exact' | 'article'

export interface AlbumMatch<T> {
  album: T
  tier: MatchTier
}

interface TitledRelease {
  title: string
}

/**
 * Match a title against a candidate release list, tier by tier.
 *
 * Tiers stop at the first hit:
 *   1. exact   — normalized keys equal
 *   2. article — equal after dropping a leading the/a/an
 *
 * ── NO SUBSTRING / PREFIX TIER, DELIBERATELY ─────────────────────────────────
 * A guarded prefix tier was implemented, measured, and removed. It contributed
 * 13 of 766 matches (1.7%) and the majority were WRONG in the most dangerous
 * direction available:
 *
 *   "Replicas (1998 Remaster)"  -> "Replicas Live"   (studio album -> live album)
 *   "The Bronx (I)/(III)/(IV)"  -> "The Bronx"       (3 distinct albums collapsed)
 *   "Peter Gabriel 1: Car"      -> "Peter Gabriel"   (first four are self-titled)
 *
 * Self-titled and numbered releases make substring similarity actively
 * misleading, and every one of those errors would have become a confident
 * sentence in a first-person liner note. 1.3 percentage points of match rate is
 * not worth a fabricated memory. Do not re-add it.
 *
 * Returns null when nothing matches. That is the expected outcome for
 * compilations, greatest-hits packages, and contaminated input — see the
 * FAIL CLOSED note at the top of this file.
 */
export function matchAlbumTitle<T extends TitledRelease>(
  title: string,
  candidates: readonly T[]
): AlbumMatch<T> | null {
  const key = normalizeAlbumTitle(title)
  if (!key) return null

  // First-write-wins: candidates arrive newest-first, and an earlier release
  // group is the more canonical answer when two normalize identically.
  const byKey = new Map<string, T>()
  for (const candidate of candidates) {
    const candidateKey = normalizeAlbumTitle(candidate.title)
    if (candidateKey && !byKey.has(candidateKey)) byKey.set(candidateKey, candidate)
  }

  const exact = byKey.get(key)
  if (exact) return { album: exact, tier: 'exact' }

  const bareKey = dropLeadingArticle(key)
  for (const [candidateKey, candidate] of byKey) {
    if (dropLeadingArticle(candidateKey) === bareKey) {
      return { album: candidate, tier: 'article' }
    }
  }

  return null
}
