// Album questions for Ask the Archive (#317).
//
// "What album is Story of My Life from?", "how many records does Sting have?",
// "did they play anything off Nebraska?" — the archive could answer all three since
// v5.4/v6.0, and Ask was the one surface that couldn't. Deterministic, like every
// other tool here: the numbers and titles come from this function, the model only
// writes the connective prose.
//
// Two files, both already fetched by the data layer for other tools:
//   • song-albums.json (346 KB) — every song heard live → the studio album carrying it.
//   • album-eras.json  (576 KB) — every artist's studio-album spine.
// discography.json (4.9 MB) is deliberately NOT read: the studio spine answers the
// album questions people ask, and #115 is deciding whether that file ships at all.

import { resolveArtist } from "../../mcp-server/src/tools.js";
import type { AliasIndex, ArtistAliasData } from "../../mcp-server/src/aliases.js";
import type {
  AlbumEras,
  AlbumRef,
  ArtistsMetadata,
  Concert,
  SongAlbum,
  SongAlbums,
} from "../../mcp-server/src/types.js";
import { songAlbumArtistKeys } from "../../../scripts/utils/song-album-lookup.js";
import { songAlbumKey } from "../../../scripts/utils/song-title.js";

export interface AlbumInfoArgs {
  song?: string;
  artist?: string;
  album?: string;
}

export interface AlbumInfoData {
  concerts: Concert[];
  eras: AlbumEras | null;
  songAlbums: SongAlbums | null;
  meta: ArtistsMetadata;
  aliasData: ArtistAliasData | null;
  aliasIndex?: AliasIndex;
}

interface Entry {
  artistKey: string;
  songKey: string;
  album: SongAlbum;
}

const yearOf = (date: string): string => (date ? date.slice(0, 4) : "year unknown");
const fold = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function entries(songAlbums: SongAlbums | null): Entry[] {
  if (!songAlbums?.songs) return [];
  return Object.entries(songAlbums.songs).map(([key, album]) => {
    const sep = key.indexOf("::");
    return { artistKey: key.slice(0, sep), songKey: key.slice(sep + 2), album };
  });
}

function displayName(key: string, data: AlbumInfoData): string {
  return data.eras?.artists[key]?.displayName ?? data.meta[key]?.name ?? key;
}

function albumLine(a: Pick<AlbumRef, "title" | "releaseDate">): string {
  return `*${a.title}* (${yearOf(a.releaseDate)})`;
}

type ArtistKeys = { name: string; keys: Set<string> } | { message: string };

function resolveKeys(query: string, data: AlbumInfoData): ArtistKeys {
  const r = resolveArtist(data.concerts, query, data.aliasIndex);
  if (r.kind === "ambiguous") return { message: `Which one did you mean — ${r.options.join(", ")}?` };
  if (r.kind === "owner") return { message: `${r.name} is the person whose shows these are, not an act with records of their own.` };
  if (r.kind === "none") return { message: `"${query}" isn't in the archive.` };
  const keys = new Set<string>();
  for (const slug of [r.slug, ...r.slugs]) {
    for (const k of songAlbumArtistKeys(slug, { discographyKeys: data.aliasData?.discographyKeys, artistsMetadata: data.meta })) {
      keys.add(k);
    }
    keys.add(slug);
  }
  for (const k of songAlbumArtistKeys(r.name, { discographyKeys: data.aliasData?.discographyKeys, artistsMetadata: data.meta })) {
    keys.add(k);
  }
  return { name: r.name, keys };
}

const COVERAGE_NOTE =
  "Song-to-album matching covers about nine in ten of the songs in my setlists, and I only have setlists for some shows — so a missing song isn't proof it wasn't played.";

/** The answer, as markdown the model reads. */
export function albumInfo(args: AlbumInfoArgs, data: AlbumInfoData): string {
  if (!data.songAlbums && !data.eras) return "My album data is temporarily unavailable. Try again in a moment.";

  const song = args.song?.trim();
  const album = args.album?.trim();
  const artistQuery = args.artist?.trim();
  if (!song && !album && !artistQuery) return "Name a song, an album, or an artist and I'll tell you what I know about the records.";

  let artist: { name: string; keys: Set<string> } | undefined;
  if (artistQuery) {
    const r = resolveKeys(artistQuery, data);
    if ("message" in r) return r.message;
    artist = r;
  }

  const all = entries(data.songAlbums);
  const scoped = artist ? all.filter((e) => artist!.keys.has(e.artistKey)) : all;

  // ── A song → its album ───────────────────────────────────────────────────
  if (song) {
    const wanted = songAlbumKey("x", song).slice(3);
    let hits = scoped.filter((e) => e.songKey === wanted);
    if (!hits.length) {
      const needle = fold(song);
      hits = scoped.filter((e) => fold(e.album.songTitle).includes(needle)).slice(0, 5);
    }
    if (!hits.length) {
      return `I don't have "${song}"${artist ? ` by ${artist.name}` : ""} matched to an album. ${COVERAGE_NOTE}`;
    }
    const lines = hits.map((e) => {
      const who = displayName(e.artistKey, data);
      const cover =
        e.album.isCover && e.album.originalArtistKey
          ? ` — a cover; the record is ${displayName(e.album.originalArtistKey, data)}'s`
          : "";
      return `"${e.album.songTitle}" (${who}, heard live) is from ${albumLine({ title: e.album.albumTitle, releaseDate: e.album.releaseDate })}${cover}.`;
    });
    return lines.join("\n");
  }

  // ── Songs heard live off one album ───────────────────────────────────────
  if (album) {
    const needle = fold(album);
    const live = scoped.filter((e) => fold(e.album.albumTitle) === needle || fold(e.album.albumTitle).includes(needle));
    const spines = artist
      ? [...artist.keys].map((k) => data.eras?.artists[k]).filter((a): a is NonNullable<typeof a> => Boolean(a))
      : Object.values(data.eras?.artists ?? {});
    const studio = spines.flatMap((a) =>
      a.studioAlbums.filter((s) => fold(s.title) === needle).map((s) => ({ artist: a.displayName, ref: s })),
    );

    if (!live.length && !studio.length) {
      return `I don't have a record called *${album}*${artist ? ` for ${artist.name}` : ""}.`;
    }

    const byAlbum = new Map<string, Entry[]>();
    for (const e of live) {
      const k = `${e.artistKey}::${e.album.albumTitle}`;
      byAlbum.set(k, [...(byAlbum.get(k) ?? []), e]);
    }
    const lines: string[] = [];
    for (const group of byAlbum.values()) {
      const first = group[0];
      const titles = group.map((e) => `"${e.album.songTitle}"`).sort();
      lines.push(
        `${albumLine({ title: first.album.albumTitle, releaseDate: first.album.releaseDate })} by ${displayName(first.artistKey, data)} — ${group.length} ${group.length === 1 ? "song" : "songs"} from it in my setlists: ${titles.join(", ")}.`,
      );
    }
    for (const s of studio) {
      const already = live.some((e) => fold(e.album.albumTitle) === fold(s.ref.title));
      if (!already) {
        lines.push(`${albumLine(s.ref)} by ${s.artist} — none of the songs in my setlists of theirs came off it.`);
      }
    }
    lines.push(COVERAGE_NOTE);
    return lines.join("\n");
  }

  // ── An artist's records ──────────────────────────────────────────────────
  const a = artist!;
  const spine = [...a.keys].map((k) => data.eras?.artists[k]).find(Boolean);
  const lines: string[] = [];
  if (spine) {
    const list = spine.studioAlbums.map(albumLine).join(", ");
    lines.push(
      `${spine.displayName} — ${spine.studioAlbumCount} studio ${spine.studioAlbumCount === 1 ? "album" : "albums"}: ${list}.` +
        (spine.truncated ? " (Their release list is long enough that the first and last of these may not be the true first and last.)" : ""),
    );
  } else {
    lines.push(`I don't have a studio discography on file for ${a.name}.`);
  }

  if (scoped.length) {
    const counts = new Map<string, { n: number; releaseDate: string; coverOf?: string }>();
    for (const e of scoped) {
      const c = counts.get(e.album.albumTitle) ?? { n: 0, releaseDate: e.album.releaseDate };
      c.n++;
      // A cover's album belongs to the original act — say whose, so "Heart Shaped World"
      // under Social Distortion reads as Chris Isaak's record, not theirs.
      if (e.album.isCover && e.album.originalArtistKey) c.coverOf = displayName(e.album.originalArtistKey, data);
      counts.set(e.album.albumTitle, c);
    }
    const ranked = [...counts.entries()].sort((x, y) => y[1].n - x[1].n || x[0].localeCompare(y[0]));
    lines.push(
      `The records the songs in my setlists of theirs came from (songs per record): ${ranked
        .map(
          ([title, c]) =>
            `${albumLine({ title, releaseDate: c.releaseDate })}${c.coverOf ? ` — ${c.coverOf}'s, a cover` : ""} — ${c.n}`,
        )
        .join("; ")}.`,
    );
  }
  return lines.join("\n");
}
