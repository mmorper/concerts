/**
 * Artist key matching between concert records and enriched artist data.
 *
 * `discography.json` is keyed off the display name in `artists-metadata.json`,
 * while lookups arrive as `concerts.json`'s `headlinerNormalized`. When the two
 * spellings differ, the record is silently unreachable:
 *
 *   concert key                 display name           discography key
 *   echo-and-the-bunnymen   <-  Echo & The Bunnymen ->  echo-the-bunnymen
 *   run-dmc                 <-  Run-D.M.C.          ->  run-d-m-c
 *   tone-loc                <-  Tone-Lōc            ->  tone-l-c
 *   beach-boys              <-  The Beach Boys      ->  the-beach-boys
 *
 * Ten headliners were unreachable this way. This module resolves six of them
 * mechanically; the rest are genuine act-identity questions handled by
 * `artist-aliases.json` (Yaz/Yazoo, The English Beat/The Beat, OMD, and the
 * Brian Setzer billings).
 *
 * ── DO NOT USE THIS TO GENERATE SLUGS ────────────────────────────────────────
 * `src/utils/normalize.ts` is the single source of truth for stored slugs, and
 * those slugs appear in published deep links, the RSS feed, indexed URLs, and
 * every liner note's persisted `deepLinks` array. Changing them silently breaks
 * live URLs.
 *
 * This module is for COMPARISON ONLY. Normalize both sides, mutate neither —
 * the same discipline album-title.ts follows.
 *
 * Spec: docs/specs/future/global-discography-trajectory.md §Part 2a
 */

/**
 * Comparison key for an artist name.
 *
 * Fixes four defect classes that `normalizeArtistName` leaves in place, all of
 * which are harmless for slugs but fatal for cross-file matching:
 *
 *   1. diacritics FOLDED, not deleted  — "Tone-Lōc" keeps its o
 *   2. "&" and "+" expand to "and"     — "Echo & The Bunnymen"
 *   3. periods elide rather than split — "Run-D.M.C." -> "run dmc"
 *   4. leading articles dropped        — "The Beach Boys" == "Beach Boys"
 *
 * @example
 * foldArtistName("Echo & The Bunnymen")  // => "echo and bunnymen"
 * foldArtistName("Run-D.M.C.")           // => "run dmc"
 * foldArtistName("Tone-Lōc")             // => "tone loc"
 * foldArtistName("The Beach Boys")       // => "beach boys"
 */
export function foldArtistName(name: string): string {
  if (!name) return ''

  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // fold diacritics — never delete the base letter
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s*\+\s*/g, ' and ')
    .replace(/[.']/g, '') // "Run-D.M.C." -> "run-dmc", "Guns N' Roses" -> "guns n roses"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/, '')
}

/** A record carrying the artist's display name, e.g. a discography entry. */
interface NamedArtistRecord {
  artistName: string
}

/**
 * Index enriched artist records by folded display name.
 *
 * First-write-wins so a deterministic winner survives when two records fold
 * identically — callers pass a stable-ordered object, so the result is stable.
 */
export function buildArtistKeyIndex(
  records: Readonly<Record<string, NamedArtistRecord>>
): Map<string, string> {
  const index = new Map<string, string>()

  for (const [key, record] of Object.entries(records)) {
    // Index the record's own key too: it is already a slug of the display name
    // in the common case, and covers records with an empty/missing artistName.
    for (const candidate of [record?.artistName, key]) {
      const folded = foldArtistName(candidate ?? '')
      if (folded && !index.has(folded)) index.set(folded, key)
    }
  }

  return index
}

export type ResolutionPath = 'direct' | 'folded' | 'alias'

export type ArtistResolution =
  | { key: string; via: ResolutionPath }
  | { key: null; via: 'unresolved' }

export interface ResolveOptions<T> {
  /**
   * Every slug equivalent to this one, from `artist-aliases.json` — the
   * canonical plus all its billings. Used for act-identity cases no fold can
   * derive: Yaz/Yazoo and The English Beat/The Beat are territorial renames.
   *
   * Note this takes *all* billings rather than just the canonical. Canonical
   * slugs stay concert-side (`yaz`, not `yazoo`) so prose and deep links are
   * unaffected; the discography spelling is simply another known billing.
   */
  aliasesOf?: (slug: string) => readonly string[]

  /**
   * Whether a record is actually usable. Defaults to "it exists".
   *
   * Needed because a direct hit on an EMPTY record is worse than no hit:
   * `omd` exists in discography.json with 0 albums, while the real 100-album
   * record lives under `orchestral-manoeuvres-in-the-dark`. Without this the
   * resolver would confidently return the empty one and stop looking.
   */
  isUsable?: (record: T) => boolean
}

/**
 * Resolve a concert's artist to its key in an enriched data file.
 *
 * Resolution order — first *usable* hit wins:
 *   1. direct — the slug is already a valid key (the overwhelming majority)
 *   2. folded — display names match once folded (the 6 mechanical drift cases)
 *   3. alias  — act identity from artist-aliases.json (Yaz/Yazoo, OMD, Setzer)
 *
 * @param slug         `headlinerNormalized` from the concert record
 * @param displayName  `headliner` from the concert record
 * @param index        from buildArtistKeyIndex over the target data file
 * @param records      the target data file
 */
export function resolveArtistKey<T>(
  slug: string,
  displayName: string,
  index: ReadonlyMap<string, string>,
  records: Readonly<Record<string, T>>,
  options: ResolveOptions<T> = {}
): ArtistResolution {
  const { aliasesOf, isUsable } = options

  const usable = (key: string | undefined): key is string => {
    if (!key || !Object.prototype.hasOwnProperty.call(records, key)) return false
    return isUsable ? isUsable(records[key]) : true
  }

  if (usable(slug)) return { key: slug, via: 'direct' }

  for (const candidate of [displayName, slug]) {
    const folded = foldArtistName(candidate ?? '')
    const hit = folded ? index.get(folded) : undefined
    if (usable(hit)) return { key: hit, via: 'folded' }
  }

  for (const alias of aliasesOf?.(slug) ?? []) {
    if (alias === slug) continue
    if (usable(alias)) return { key: alias, via: 'alias' }

    const folded = foldArtistName(alias)
    const hit = folded ? index.get(folded) : undefined
    if (usable(hit)) return { key: hit, via: 'alias' }
  }

  return { key: null, via: 'unresolved' }
}
