/**
 * Agentic Liner Notes — Setlist index
 *
 * Reads `public/data/setlists-cache.json` into a lookup the detectors can join
 * against. 159 of 184 concerts have a setlist; 2,700-odd song performances that
 * no detector touched until #229.
 *
 * **Keyed on date + artist, never `concertId`.** Row ids are re-import artifacts
 * — keying on one is what shipped a duplicate post in #242, and what
 * `docs/DEEP_LINKING.md` warns against for the same reason. Date + artist is the
 * same key the `?show=` deep-link grammar settled on.
 */

export interface SetlistSong {
  name: string;
  /** Present when the song is someone else's — `cover.name` is the original artist (#225). */
  cover?: { name: string };
  /** Guest performer on this song. */
  with?: { name: string };
  /** Free-text note, e.g. "Acoustic", "Played during fireworks". */
  info?: string;
  /**
   * Played over the PA rather than performed — walk-on music, video interludes,
   * fireworks accompaniment. Excluded everywhere, because "the last song at a
   * venue that's gone" should be the last thing the band played, not the AC/DC
   * record the fireworks went off to.
   */
  tape?: boolean;
}

/** Lookup of `${date}::${artistNormalized}` → the songs performed that night. */
export type SetlistIndex = ReadonlyMap<string, SetlistSong[]>;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const keyOf = (date: string, artistNormalized: string) => `${date}::${artistNormalized}`;

/**
 * Build the index from a parsed `setlists-cache.json`. Entries with no performed
 * songs are dropped, so a hit always means there is something to say.
 */
export function buildSetlistIndex(cache: unknown): SetlistIndex {
  const index = new Map<string, SetlistSong[]>();
  const entries = (cache as { entries?: Record<string, unknown> })?.entries;
  if (!entries) return index;

  for (const raw of Object.values(entries)) {
    const entry = raw as {
      date?: string;
      artistName?: string;
      setlist?: { sets?: { set?: Array<{ song?: SetlistSong[] }> } };
    };
    if (!entry?.date || !entry.artistName) continue;

    const sets = entry.setlist?.sets?.set;
    if (!Array.isArray(sets)) continue;

    const performed = sets
      .flatMap((s) => s.song ?? [])
      .filter((s): s is SetlistSong => Boolean(s?.name) && s.tape !== true);
    if (!performed.length) continue;

    index.set(keyOf(entry.date, slugify(entry.artistName)), performed);
  }
  return index;
}

/** Songs performed by this artist on this night. Empty when nothing is on record. */
export function songsFor(
  index: SetlistIndex | undefined,
  date: string | undefined,
  artistNormalized: string | undefined
): SetlistSong[] {
  if (!index || !date || !artistNormalized) return [];
  return index.get(keyOf(date, artistNormalized)) ?? [];
}

/** True when this night has songs on record — used to gate `?show=` deep links. */
export function hasSetlist(
  index: SetlistIndex | undefined,
  date: string | undefined,
  artistNormalized: string | undefined
): boolean {
  return songsFor(index, date, artistNormalized).length > 0;
}

/**
 * Song titles present at *every* one of these shows — the all-shows intersection
 * that absorbs the `never-left` idea from #228. Shows without a setlist are
 * ignored rather than treated as misses, so one missing night doesn't erase a
 * song that survived the rest.
 *
 * Returns [] unless at least `minShows` of them have a setlist: a song common to
 * two shows is a coincidence, not a streak.
 */
export function songsAtEveryShow(
  index: SetlistIndex | undefined,
  shows: Array<{ date: string }>,
  artistNormalized: string,
  minShows = 3
): string[] {
  const lists = shows
    .map((s) => songsFor(index, s.date, artistNormalized))
    .filter((songs) => songs.length > 0);
  if (lists.length < minShows) return [];

  const [first, ...rest] = lists.map((songs) => new Set(songs.map((s) => s.name)));
  return [...first].filter((name) => rest.every((set) => set.has(name)));
}

/** Songs this artist played in both roles — as an opener then as a headliner. */
export function songsInCommon(
  index: SetlistIndex | undefined,
  a: { date: string },
  b: { date: string },
  artistNormalized: string
): string[] {
  const first = new Set(songsFor(index, a.date, artistNormalized).map((s) => s.name));
  if (!first.size) return [];
  return songsFor(index, b.date, artistNormalized)
    .map((s) => s.name)
    .filter((name) => first.has(name));
}

/**
 * "Ring of Fire (Johnny Cash cover)" when it's someone else's song, otherwise
 * just the title. The attribution only became visible in #225 — before that the
 * pipeline saw bare titles.
 */
export function describeSong(song: SetlistSong | undefined): string | undefined {
  if (!song) return undefined;
  return song.cover ? `${song.name} (${song.cover.name} cover)` : song.name;
}

/**
 * Tags a detector adds when it found a real song join. Kept here so the scorer
 * and the detectors agree on what "carries a song join" means, rather than each
 * keeping its own list.
 */
export const SONG_JOIN_TAGS = [
  "#never-left",       // artist-longevity — played at every show on record
  "#same-song",        // opener-to-headliner — same song in both roles
  "#first-song-back",  // drought-comeback — what they opened the comeback with
  "#only-setlist",     // rare-sighting — the one night's opener and closer
  "#last-song",        // venue-ghost — the last thing played in a room that's gone
] as const;

/** True when a finding carries song detail joined from the setlist corpus. */
export function hasSongJoin(tags: readonly string[]): boolean {
  return tags.some((t) => (SONG_JOIN_TAGS as readonly string[]).includes(t));
}
