import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createBackup } from './utils/backup'
import { buildArtistKeyIndex, resolveArtistKey } from './utils/artist-key'
import { matchAlbumTitle, isSingleOrEp } from './utils/album-title'
import { normalizeAlbumName } from '../src/utils/normalize.js'

/**
 * Derive album-eras.json — the join at the centre of Discography Trajectory.
 *
 * discography.json has 11,359 releases. concerts.json has 184 nights. Neither
 * is interesting alone; the intersection is. For every concert this computes
 * where the artist stood in their arc that night and — the part nothing else in
 * the archive can answer — WHAT HAD NOT HAPPENED YET.
 *
 * Depeche Mode, The Rose Bowl, June 1988: 264 days into the Music for the
 * Masses cycle, with Violator still 20 months away and ten albums to come.
 *
 * ── WHY THIS IS A VECTOR, NOT A SCALAR ───────────────────────────────────────
 * An earlier design was backward-looking only (nearest preceding album, days
 * since release). That answers "what were they touring" and nothing else.
 * Trajectory needs each concert's position ALONG the whole arc, including what
 * came after — and retrofitting that later would mean regenerating published
 * liner notes.
 *
 * ── WHY ALBUM IDENTITY SHIPS BEFORE ANYTHING RENDERS IT ──────────────────────
 * Published posts freeze into liner-notes.json at generation time: prose,
 * image, audio and deepLinks all persist as written. If mbid/albumSlug/coverUrl
 * are absent when a post is generated, adding album deep links later means
 * regenerating posts (new prose, broken permalinks) or string-matching album
 * names out of finished prose. Carrying three fields now makes the future
 * discography surface a rendering change instead of a migration.
 *
 * ── SHAPE: NORMALIZED, NOT DENORMALIZED ─────────────────────────────────────
 * Each artist's studio album list is stored once on the artist record. A
 * concert's "albums still to come" is a slice of it, using albumsBefore as the
 * index. Copying those refs onto every concert cost 154 KB and would have
 * capped the answer at ten.
 *
 * Usage:
 *   npm run derive:album-eras              # Derive and write
 *   npm run derive:album-eras -- --dry-run # Report only, no write
 *
 * Output: public/data/album-eras.json
 * Spec:   docs/specs/future/global-discography-trajectory.md §Part 3
 */

// ── Tunables ─────────────────────────────────────────────────────────────────

/**
 * Hard budget — the MCP fetches this file over the network per cold start.
 *
 * Set against the codebase's own precedent rather than intuition. The MCP
 * already lazy-loads venues-metadata.json (963 KB), setlists-cache.json
 * (831 KB) and artists-top-tracks.json (746 KB), so 400 KB is unremarkable —
 * it would be the fourth largest of five lazy files.
 *
 * The spec's original 250 KB was picked without checking those numbers and was
 * ~4x stricter than anything shipping. It is raised here on evidence, NOT to
 * accommodate bloat: every redundancy it caught (cover URLs, album slugs,
 * per-concert album copies, pretty-printing) stayed removed, taking the file
 * from 534 KB to 302 KB on the way.
 */
const SIZE_BUDGET_KB = 400

/** A defining album needs at least this many top tracks to be asserted. */
const MIN_DEFINING_TOP_TRACKS = 2

/**
 * Release-groups MusicBrainz classifies as studio albums but which are not.
 *
 * A MANUAL, evidence-based list — deliberately not a heuristic. Title-pattern
 * matching ("Live", "Volume N", city names) would exclude real albums, and a
 * wrongly excluded album is as bad as a wrongly included bootleg: both change
 * the "albums still to come" count that ends up in published prose.
 *
 * Observed rate is low (1 of 1,146 spine albums), so the proportionate response
 * is a list, not an algorithm. Same discipline as MBID_CORRECTIONS in
 * enrich-discography.ts: add an entry only with a stated reason.
 */
const RELEASE_EXCLUSIONS: Record<string, string> = {
  // A 1993 Depeche Mode bootleg tagged primaryType=Album with no secondary
  // types, so it reads as a studio album. Sat between Violator and Songs of
  // Faith and Devotion, inflating the Rose Bowl show's "10 albums to come".
  '0f404f61-00eb-4a68-9971-f661c3504d77': 'Houston Night Volume 2 — bootleg mistagged as a studio album',
}

/** enrich-discography.ts caps at 100 releases; at the cap, suppress first/last claims. */
const RELEASE_CAP = 100

const DAY_MS = 86_400_000
const DAYS_PER_YEAR = 365.25
const DAYS_PER_MONTH = 30.44

// ── Types ────────────────────────────────────────────────────────────────────

/** A raw `discography.json` album, as MusicBrainz gave it to us. */
export interface RawAlbum {
  id: string
  title: string
  releaseDate: string
  year?: number
  primaryType?: string
  secondaryTypes?: string[]
  coverUrl?: string
  coverAvailable?: boolean
}

interface RawDiscographyEntry {
  artistName: string
  mbid: string | null
  albums: RawAlbum[]
}

interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
}

export interface AlbumRef {
  mbid: string
  title: string
  releaseDate: string
  coverAvailable: boolean
}

/**
 * Cover Art Archive URL for a release-group.
 *
 * Verified against all 11,382 covers in discography.json: the URL is a pure
 * function of the MBID, with zero exceptions. Storing it alongside every album
 * reference is derived data in a derived file — it cost 284 KB (more than the
 * entire size budget) before being removed in favour of this helper.
 *
 * Only call when `coverAvailable` is true; the archive 404s otherwise.
 */
export function coverArtUrl(mbid: string): string {
  return `https://coverartarchive.org/release-group/${mbid}/front-500.jpg`
}

export interface DefiningAlbum extends AlbumRef {
  topTrackCount: number
  topTrackTotal: number
  matchTier: string
}

export type CycleBucket = 'fresh' | 'current' | 'mature' | 'deep' | 'catalog'

export interface ConcertEra {
  concertId: string
  artistKey: string
  date: string
  currentAlbum: AlbumRef | null
  daysSinceRelease: number | null
  cycleBucket: CycleBucket | null
  albumsBefore: number
  albumsAfter: number
  /**
   * Years since the debut album. NULL for a show that predates the debut —
   * never negative.
   *
   * It used to go negative, and a generated post rendered No Doubt's -4 as
   * "four years into their existence" when the truth was four years BEFORE
   * their first record. A field whose name says "career year" holding a
   * negative number is a footgun for any consumer that reads it as elapsed
   * time; yearsBeforeDebut carries that case explicitly instead.
   */
  careerYear: number | null
  yearsBeforeDebut: number | null
  careerPercentile: number | null
  isDebutEra: boolean
  definingAlbum: DefiningAlbum | null
  definingAlbumAhead: boolean
  definingAlbumMonthsAway: number | null
}

export interface ArtistEra {
  artistKey: string
  displayName: string
  studioAlbumCount: number
  /**
   * Every studio album, release-date ascending — stored ONCE per artist.
   *
   * A concert's "what was still to come" is a slice, not a copy:
   *   studioAlbums.slice(concertEra.albumsBefore)
   *
   * Duplicating those refs per concert cost 154 KB and capped the answer at 10
   * albums. This is smaller AND strictly more capable — the future album-era
   * timeline needs the whole spine, not the tail.
   */
  studioAlbums: AlbumRef[]
  debutAlbum: AlbumRef | null
  latestAlbum: AlbumRef | null
  definingAlbum: DefiningAlbum | null
  truncated: boolean
  /** albumSlug retained here only as a stable grouping key for the eras list. */
  erasSeen: Array<{ albumSlug: string; title: string; showCount: number; dates: string[] }>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A "studio album" is primaryType Album with NO secondary types.
 *
 * This deliberately excludes 1,832 compilations and 1,381 live albums. Leaving
 * them in wrecks every era calculation: a 2011 greatest-hits package would make
 * a 1985 show look like it sat inside a 2011 album cycle.
 *
 * EXPORTED because v5.5's song→album attribution needs the same answer, and
 * the predicate is not reproducible from structure alone — it consults
 * RELEASE_EXCLUSIONS. A second implementation would be a second source of
 * truth on whether a mistagged bootleg is a studio album, and the two would
 * disagree exactly where it matters: v5.4 would place a show in one album
 * cycle while v5.5 attributed its songs to a record v5.4 says never existed.
 *
 * Callers pass raw `discography.json` album objects. Anything already reading
 * `album-eras.json`'s `studioAlbums` has been filtered by this function
 * already and must not re-filter.
 */
export function isStudioAlbum(album: RawAlbum): boolean {
  if (RELEASE_EXCLUSIONS[album.id]) return false
  return (
    album.primaryType === 'Album' &&
    (!album.secondaryTypes || album.secondaryTypes.length === 0) &&
    Boolean(album.releaseDate)
  )
}

function studioAlbums(entry: RawDiscographyEntry | undefined): RawAlbum[] {
  return (entry?.albums ?? [])
    .filter(isStudioAlbum)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
}

/**
 * Nothing derivable is stored.
 *
 * `coverUrl` is a pure function of mbid (coverArtUrl), and `albumSlug` is a
 * pure function of title (normalizeAlbumName from src/utils/normalize). Both
 * were carried here in an earlier draft and together cost ~180 KB — most of the
 * size budget — to store values any consumer can compute in one call.
 *
 * The deep-link forward-compatibility requirement is unaffected: what has to
 * freeze album identity is the liner-notes FINDING (see spec §Part 7), and a
 * finding can call normalizeAlbumName(title) exactly as this file would have.
 */
function toRef(album: RawAlbum): AlbumRef {
  return {
    mbid: album.id,
    title: album.title,
    releaseDate: album.releaseDate,
    coverAvailable: Boolean(album.coverAvailable),
  }
}

/** Partial dates are common in MusicBrainz ("1984", "1987-09"). Pad to a day. */
function parseReleaseDate(date: string): number {
  const [y, m = '01', d = '01'] = date.split('-')
  return Date.parse(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`)
}

function parseConcertDate(date: string): number {
  return Date.parse(`${date}T12:00:00Z`)
}

function bucketFor(days: number): CycleBucket {
  if (days < 90) return 'fresh'
  if (days < 365) return 'current'
  if (days < 3 * DAYS_PER_YEAR) return 'mature'
  if (days < 10 * DAYS_PER_YEAR) return 'deep'
  return 'catalog'
}

/**
 * The album carrying a plurality of the artist's iTunes top tracks.
 *
 * This is a proxy for ENDURING POPULARITY, not critical canon — and that
 * framing is the honest one. "The record most of what I still play came from"
 * is a grounded statement about the listener; "their masterpiece" is a critical
 * judgment the corpus cannot support. topTrackCount/topTrackTotal are persisted
 * so prose can cite the evidence rather than assert the conclusion.
 *
 * Returns null below MIN_DEFINING_TOP_TRACKS — a single track is noise.
 */
function findDefiningAlbum(
  tracks: Array<{ albumName?: string }>,
  albums: RawAlbum[]
): DefiningAlbum | null {
  if (!tracks.length || !albums.length) return null

  const tally = new Map<string, { album: RawAlbum; count: number; tier: string }>()

  for (const track of tracks) {
    if (!track.albumName || isSingleOrEp(track.albumName)) continue
    const hit = matchAlbumTitle(track.albumName, albums)
    if (!hit) continue
    const existing = tally.get(hit.album.id)
    if (existing) existing.count++
    else tally.set(hit.album.id, { album: hit.album, count: 1, tier: hit.tier })
  }

  const top = [...tally.values()].sort((a, b) => b.count - a.count)[0]
  if (!top || top.count < MIN_DEFINING_TOP_TRACKS) return null
  if (!isStudioAlbum(top.album)) return null

  return {
    ...toRef(top.album),
    topTrackCount: top.count,
    topTrackTotal: tracks.length,
    matchTier: top.tier,
  }
}

// ── Derivation ───────────────────────────────────────────────────────────────

export function deriveAlbumEras(input: {
  concerts: Concert[]
  discography: Record<string, RawDiscographyEntry>
  topTracks: Record<string, { tracks?: Array<{ albumName?: string }> }>
  aliases: {
    sameAct?: Array<{ billings?: string[] }>
    discographyKeys?: Array<{ act?: string; discographyKey?: string }>
  }
  today: string
}) {
  const { concerts, discography, topTracks, aliases, today } = input

  // Two distinct relations, deliberately not merged:
  //   sameAct         — marquees this act played under (yields billings)
  //   discographyKeys — the key this act's DISCOGRAPHY lives under
  // A test asserts every sameAct billing appears on a real bill, which is why
  // "yazoo" and "the-beat" cannot live there: nobody ever saw those marquees.
  const aliasesOfSlug = new Map<string, string[]>()
  const add = (slug: string, alias: string) => {
    const list = aliasesOfSlug.get(slug) ?? []
    if (!list.includes(alias)) list.push(alias)
    aliasesOfSlug.set(slug, list)
  }
  for (const entry of aliases.sameAct ?? []) {
    for (const billing of entry.billings ?? []) {
      for (const other of entry.billings ?? []) add(billing, other)
    }
  }
  for (const entry of aliases.discographyKeys ?? []) {
    if (entry.act && entry.discographyKey) add(entry.act, entry.discographyKey)
  }

  const keyIndex = buildArtistKeyIndex(discography)
  const resolveOptions = {
    aliasesOf: (slug: string) => aliasesOfSlug.get(slug) ?? [],
    // A record with no albums is not a usable answer — see artist-key.ts.
    isUsable: (record: RawDiscographyEntry) => (record?.albums?.length ?? 0) > 0,
  }

  const resolvedKey = new Map<string, string | null>()
  const resolveFor = (concert: Concert): string | null => {
    const cached = resolvedKey.get(concert.headlinerNormalized)
    if (cached !== undefined) return cached
    const resolution = resolveArtistKey(
      concert.headlinerNormalized,
      concert.headliner,
      keyIndex,
      discography,
      resolveOptions
    )
    resolvedKey.set(concert.headlinerNormalized, resolution.key)
    return resolution.key
  }

  const definingCache = new Map<string, DefiningAlbum | null>()
  const definingFor = (artistKey: string, concertSlug: string, albums: RawAlbum[]) => {
    if (definingCache.has(artistKey)) return definingCache.get(artistKey) ?? null
    // Top tracks are keyed by the CONCERT slug; discography by its own key. Try
    // both, since the two disagree for exactly the drift cases artist-key fixes.
    const tracks = topTracks[concertSlug]?.tracks ?? topTracks[artistKey]?.tracks ?? []
    const defining = findDefiningAlbum(tracks, albums)
    definingCache.set(artistKey, defining)
    return defining
  }

  const concertEras: Record<string, ConcertEra> = {}
  const artistEras: Record<string, ArtistEra> = {}
  const erasSeenAcc = new Map<string, Map<string, { title: string; dates: string[] }>>()

  const todayMs = parseConcertDate(today)
  const pastConcerts = concerts.filter((c) => parseConcertDate(c.date) <= todayMs)

  for (const concert of pastConcerts) {
    const artistKey = resolveFor(concert)
    if (!artistKey) continue

    const entry = discography[artistKey]
    const albums = studioAlbums(entry)
    if (!albums.length) continue

    const concertMs = parseConcertDate(concert.date)
    const before = albums.filter((a) => parseReleaseDate(a.releaseDate) <= concertMs)
    const after = albums.filter((a) => parseReleaseDate(a.releaseDate) > concertMs)

    const currentAlbum = before.length ? before[before.length - 1] : null
    const daysSinceRelease = currentAlbum
      ? Math.round((concertMs - parseReleaseDate(currentAlbum.releaseDate)) / DAY_MS)
      : null

    const debut = albums[0]
    const latest = albums[albums.length - 1]
    const debutMs = parseReleaseDate(debut.releaseDate)
    const latestMs = parseReleaseDate(latest.releaseDate)
    const span = latestMs - debutMs

    const yearsFromDebut = (concertMs - debutMs) / DAY_MS / DAYS_PER_YEAR
    const careerYear = yearsFromDebut >= 0 ? Number(yearsFromDebut.toFixed(1)) : null
    const yearsBeforeDebut = yearsFromDebut < 0 ? Number(Math.abs(yearsFromDebut).toFixed(1)) : null
    const careerPercentile =
      span > 0 ? Number(Math.min(1, Math.max(0, (concertMs - debutMs) / span)).toFixed(3)) : null

    const defining = definingFor(artistKey, concert.headlinerNormalized, albums)
    const definingAhead = Boolean(defining && parseReleaseDate(defining.releaseDate) > concertMs)

    concertEras[concert.id] = {
      concertId: concert.id,
      artistKey,
      date: concert.date,
      currentAlbum: currentAlbum ? toRef(currentAlbum) : null,
      daysSinceRelease,
      cycleBucket: daysSinceRelease === null ? null : bucketFor(daysSinceRelease),
      // albumsBefore doubles as the slice index into artists[].studioAlbums:
      //   albumsAhead === studioAlbums.slice(albumsBefore)
      albumsBefore: before.length,
      albumsAfter: after.length,
      careerYear,
      yearsBeforeDebut,
      careerPercentile,
      isDebutEra: Math.abs(concertMs - debutMs) / DAY_MS <= 730,
      definingAlbum: defining,
      definingAlbumAhead: definingAhead,
      definingAlbumMonthsAway:
        defining && definingAhead
          ? Math.round((parseReleaseDate(defining.releaseDate) - concertMs) / DAY_MS / DAYS_PER_MONTH)
          : null,
    }

    if (currentAlbum) {
      if (!erasSeenAcc.has(artistKey)) erasSeenAcc.set(artistKey, new Map())
      const eras = erasSeenAcc.get(artistKey)!
      const slug = normalizeAlbumName(currentAlbum.title)
      const existing = eras.get(slug)
      if (existing) existing.dates.push(concert.date)
      else eras.set(slug, { title: currentAlbum.title, dates: [concert.date] })
    }

    if (!artistEras[artistKey]) {
      artistEras[artistKey] = {
        artistKey,
        displayName: entry.artistName,
        studioAlbumCount: albums.length,
        studioAlbums: albums.map(toRef),
        debutAlbum: toRef(debut),
        latestAlbum: toRef(latest),
        definingAlbum: defining,
        // At the fetch cap the release list may be incomplete, so first/last
        // album claims are unsafe for this artist.
        truncated: (entry.albums?.length ?? 0) >= RELEASE_CAP,
        erasSeen: [],
      }
    }
  }

  for (const [artistKey, eras] of erasSeenAcc) {
    const record = artistEras[artistKey]
    if (!record) continue
    record.erasSeen = [...eras.entries()]
      .map(([albumSlug, value]) => ({
        albumSlug,
        title: value.title,
        showCount: value.dates.length,
        dates: value.dates.sort(),
      }))
      .sort((a, b) => a.dates[0].localeCompare(b.dates[0]))
  }

  const withEra = Object.values(concertEras)
  const dayGaps = withEra
    .map((e) => e.daysSinceRelease)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    concerts: concertEras,
    artists: artistEras,
    stats: {
      concertsConsidered: pastConcerts.length,
      concertsWithEra: withEra.length,
      medianDaysSinceRelease: dayGaps.length ? dayGaps[Math.floor(dayGaps.length / 2)] : null,
      artistsWithDefiningAlbum: Object.values(artistEras).filter((a) => a.definingAlbum).length,
      definingAlbumAheadCount: withEra.filter((e) => e.definingAlbumAhead).length,
      multiEraArtists: Object.values(artistEras).filter((a) => a.erasSeen.length >= 2).length,
      cycleBuckets: withEra.reduce<Record<string, number>>((acc, e) => {
        if (e.cycleBucket) acc[e.cycleBucket] = (acc[e.cycleBucket] ?? 0) + 1
        return acc
      }, {}),
    },
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

export async function deriveAlbumErasFile() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(`🎸 Deriving album eras...${dryRun ? ' (DRY RUN)' : ''}\n`)

  const dataDir = join(process.cwd(), 'public', 'data')
  const read = (file: string) => JSON.parse(readFileSync(join(dataDir, file), 'utf-8'))

  for (const required of ['concerts.json', 'discography.json']) {
    if (!existsSync(join(dataDir, required))) {
      console.error(`❌ ${required} not found. Run "npm run build-data" first.`)
      process.exit(1)
    }
  }

  const concertsFile = read('concerts.json')
  const result = deriveAlbumEras({
    concerts: concertsFile.concerts ?? concertsFile,
    discography: read('discography.json'),
    topTracks: existsSync(join(dataDir, 'artists-top-tracks.json'))
      ? read('artists-top-tracks.json')
      : {},
    aliases: existsSync(join(dataDir, 'artist-aliases.json')) ? read('artist-aliases.json') : {},
    today: new Date().toISOString().slice(0, 10),
  })

  // Minified deliberately: this file is machine-read (MCP over the network on
  // cold start, plus the liner-notes pipeline), never hand-edited. Indentation
  // was 40% of its bytes.
  const serialized = JSON.stringify(result)
  const sizeKb = serialized.length / 1024
  const s = result.stats

  console.log(`   Concerts considered:        ${s.concertsConsidered}`)
  console.log(`   Concerts with era data:     ${s.concertsWithEra}`)
  console.log(`   Median days since release:  ${s.medianDaysSinceRelease}`)
  console.log(`   Artists with defining album:${String(s.artistsWithDefiningAlbum).padStart(4)}`)
  console.log(`   Defining album still ahead: ${s.definingAlbumAheadCount}`)
  console.log(`   Artists across 2+ eras:     ${s.multiEraArtists}`)
  console.log(`   Cycle buckets:              ${JSON.stringify(s.cycleBuckets)}`)
  console.log(`   File size:                  ${sizeKb.toFixed(1)} KB / ${SIZE_BUDGET_KB} KB budget\n`)

  if (sizeKb > SIZE_BUDGET_KB) {
    console.error(
      `❌ album-eras.json is ${sizeKb.toFixed(1)} KB, over the ${SIZE_BUDGET_KB} KB budget.\n` +
        `   The MCP fetches this per cold start. Before raising the budget, check\n` +
        `   nothing derivable crept back in (cover URLs, slugs) — that is what\n` +
        `   blew it out the first time.`
    )
    process.exit(1)
  }

  const outputPath = join(dataDir, 'album-eras.json')
  if (dryRun) {
    console.log('🔍 DRY RUN — no files written.')
    return
  }

  if (existsSync(outputPath)) createBackup(outputPath, { maxBackups: 5, verbose: true })
  writeFileSync(outputPath, serialized)
  console.log(`💾 Saved to: ${outputPath}`)
  console.log('🎉 Done!')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  deriveAlbumErasFile()
}
