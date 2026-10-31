// The cards for the three tools that used to answer in text only (#593): one night's place in
// an act's catalogue, the archive-wide shape, and the most-heard songs. Pure builders over the
// same selections the prose uses (`careerPositionNight`, `careerShapeData`, the most-played
// list), so a card can never show a night, a record or a song the text doesn't.

import type {
  AlbumEras,
  AlbumRef,
  ArtistEra,
  ArtistsMetadata,
  Concert,
  ConcertEra,
  MostPlayedSongs,
  SetlistsCache,
  SongAlbum,
  SongAlbums,
} from "../../mcp-server/src/types.js";
import type { ArtistAliasData } from "../../mcp-server/src/aliases.js";
import { careerShapeData } from "../../mcp-server/src/tools.js";
import { lookupSongAlbum } from "../../../scripts/utils/song-album-lookup.js";
import {
  artistDeepLink,
  venueDeepLink,
  type AlbumIdentity,
  type EntityRef,
  type EraExhibit,
  type ShapeExhibit,
  type SongsExhibit,
} from "./exhibits.js";

const identity = (a: AlbumRef | SongAlbum): AlbumIdentity => ({
  mbid: a.mbid,
  title: "albumTitle" in a ? a.albumTitle : a.title,
  releaseDate: a.releaseDate,
  coverAvailable: a.coverAvailable,
});

const artistRef = (c: Concert): EntityRef => ({
  entity: "artist",
  slug: c.headlinerNormalized,
  name: c.headliner,
  deepLink: artistDeepLink(c.headlinerNormalized),
});

const venueRef = (c: Concert): EntityRef => ({
  entity: "venue",
  slug: c.venueNormalized,
  name: c.venue,
  deepLink: venueDeepLink(c.venueNormalized),
});

/** Matches src/utils/normalize.ts — the slug the archive's artist links are keyed by. */
const slugOf = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** get_career_position's night as a card. The caller resolves the night with careerPositionNight. */
export function eraExhibit(concert: Concert, era: ConcertEra, artistEra: ArtistEra): EraExhibit {
  // `albumsBefore` doubles as the slice index into studioAlbums, so flag before deduping:
  // MusicBrainz lists a few records twice, and the duplicate must not shift the marker.
  const seen = new Set<string>();
  const shelf = artistEra.studioAlbums
    .map((a, i) => ({ ...identity(a), before: i < era.albumsBefore }))
    .filter((a) => (seen.has(a.mbid) ? false : (seen.add(a.mbid), true)));
  return {
    kind: "era",
    concertId: concert.id,
    date: concert.date,
    artist: artistRef(concert),
    venue: venueRef(concert),
    touring: era.currentAlbum ? identity(era.currentAlbum) : null,
    daysSinceRelease: era.daysSinceRelease,
    albumsAfter: era.albumsAfter,
    defining: era.definingAlbum
      ? { ...identity(era.definingAlbum), ahead: era.definingAlbumAhead, monthsAway: era.definingAlbumMonthsAway }
      : null,
    shelf,
    truncated: artistEra.truncated,
  };
}

/** get_career_shape as a card: the five buckets and the "before the record" nights the prose quotes. */
export function shapeExhibit(concerts: Concert[], eras: AlbumEras, limit = 8): ShapeExhibit | undefined {
  const shape = careerShapeData(eras);
  if (!shape) return undefined;
  const byId = new Map(concerts.map((c) => [c.id, c]));
  const ahead = shape.quotable
    .map((e) => ({ e, c: byId.get(e.concertId) }))
    .filter((x): x is { e: ConcertEra; c: Concert } => !!x.c && !!x.e.definingAlbum && x.e.definingAlbumMonthsAway !== null)
    .slice(0, limit)
    .map(({ e, c }) => ({
      concertId: c.id,
      date: c.date,
      artist: artistRef(c),
      album: identity(e.definingAlbum!),
      monthsAway: e.definingAlbumMonthsAway!,
    }));
  return {
    kind: "shape",
    placed: shape.placed,
    total: concerts.length,
    medianMonths: shape.medianMonths,
    buckets: shape.buckets,
    aheadCount: shape.aheadCount,
    ahead,
  };
}

export interface SongsCardData {
  concerts: Concert[];
  /** For a cover's original act's display name. */
  eras?: AlbumEras | null;
  /** setlist.fm's own cover credits — the fallback when song-albums has no entry for a cover. */
  setlists?: SetlistsCache | null;
  songAlbums: SongAlbums | null;
  meta: ArtistsMetadata;
  aliasData: ArtistAliasData | null;
}

/**
 * get_archive_top_songs as a card: the same top N as the prose (same clamp), each with the
 * record it came off. A song heard from several acts takes the first act whose attribution
 * isn't a cover — the original's record, not a cover band's.
 */
export function songsExhibit(most: MostPlayedSongs | null, limit: number | undefined, data: SongsCardData): SongsExhibit | undefined {
  if (!most || most.songs.length === 0) return undefined;
  const n = Math.min(Math.max(limit ?? 10, 1), 25);
  const acts = new Set(data.concerts.flatMap((c) => [c.headlinerNormalized, ...(c.openers ?? []).map(slugOf)]));
  const ctx = { discographyKeys: data.aliasData?.discographyKeys, artistsMetadata: data.meta };
  // "song|performer" → setlist.fm's cover credit, the same credit the setlist prose prints.
  const credited = new Map<string, string>();
  for (const e of data.setlists?.entries ?? []) {
    for (const set of e.setlist?.sets?.set ?? []) {
      for (const song of set.song ?? []) {
        if (song.name && song.cover?.name) credited.set(`${song.name.toLowerCase()}|${slugOf(e.artistName)}`, song.cover.name);
      }
    }
  }
  return {
    kind: "songs",
    withSetlist: most.coverage.concertsWithSetlist,
    totalConcerts: most.coverage.totalConcerts,
    songs: most.songs.slice(0, n).map((s) => {
      let album: AlbumIdentity | null = null;
      let coverOf: string | undefined;
      for (const who of s.artists) {
        const rec = lookupSongAlbum<SongAlbum>(data.songAlbums?.songs, who, s.name, ctx);
        if (rec && !rec.isCover) {
          album = identity(rec);
          break;
        }
        // A cover's record is the original act's; name them instead of drawing their sleeve.
        if (rec?.isCover && rec.originalArtistKey && !coverOf) {
          const k = rec.originalArtistKey;
          coverOf =
            data.eras?.artists[k]?.displayName ??
            data.meta[k]?.name ??
            k.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
        }
      }
      if (!album && !coverOf) {
        coverOf = s.artists.map((who) => credited.get(`${s.name.toLowerCase()}|${slugOf(who)}`)).find(Boolean);
      }
      const only = s.artists.length === 1 ? s.artists[0] : null;
      const slug = only ? slugOf(only) : "";
      return {
        title: s.name,
        count: s.count,
        artist: only && acts.has(slug) ? { entity: "artist" as const, slug, name: only, deepLink: artistDeepLink(slug) } : null,
        artistNames: s.artists,
        album,
        ...(album || !coverOf ? {} : { coverOf }),
      };
    }),
  };
}
