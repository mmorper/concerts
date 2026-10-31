// The exhibit schema — the structured side-channel that turns a chat answer into a composed
// "exhibit" card (spec §"Exhibit schema + rendering", issue #140).
//
// WHY THIS EXISTS: the v1 SSE stream carries only prose + tool NAME. The frontend can't build
// an artist/venue/ranking card from prose. So when the agent loop finishes a turn, the backend
// emits ONE extra event — `event: exhibit` — describing which card to render and which entities
// it's about. The model still writes the prose (streamed as `token`); this envelope is derived
// deterministically from the tool trace, so the archive's voice still can't invent a stat.
//
// THIN-ENVELOPE CONTRACT (the load-bearing design decision):
// The SPA already ships and loads concerts.json, artists-metadata.json, and venues-metadata.json
// on mount. So this envelope does NOT re-send photos, genres, lat/lng, bios, or per-artist counts.
// It carries only IDENTITY + SELECTION — kind, entity slugs, concert ids, deep-links, ordering.
// The frontend HYDRATES the visual atoms (photo, genre spine, map tile, show chips, "times seen"
// counts) from its own local data using the slugs/ids here. Keeps the payload tiny, avoids a
// second source of truth, and means a richer card never needs a backend change — only the data.
//
// SELECTION, NOT RENDERING: a `slug` here is a promise that artists-metadata.json has that key
// (it's the same `headlinerNormalized` / `normalizedName` the data was built from). `name` and
// `deepLink` are included so the frontend can render a correct, clickable card even if a metadata
// lookup misses (new artist not yet enriched) — graceful degradation, no lookup race.

/** Deep-link slugs are the normalized names the data layer is keyed by (src/utils/normalize.ts). */
export type Slug = string;

export type ExhibitKind =
  | "artist"
  | "venue"
  | "list"
  | "serendipity"
  | "album"
  | "discography"
  | "show"
  | "era"
  | "shape"
  | "songs"
  | "plain"
  | "disambiguation"
  | "refusal";

/** One clickable entity reference. `deepLink` is prebuilt so the frontend stays dumb. */
export interface EntityRef {
  entity: "artist" | "venue";
  slug: Slug;
  name: string; // display name — render fallback if local metadata lacks this slug
  deepLink: string; // e.g. "/?scene=artists&artist=depeche-mode"
}

/** get_artist_history resolved to a single artist. Frontend hydrates photo+genre+shows by slug. */
export interface ArtistExhibit extends EntityRef {
  kind: "artist";
  entity: "artist";
}

/** get_venue_history resolved to a single venue. Frontend hydrates the map tile from local lat/lng. */
export interface VenueExhibit extends EntityRef {
  kind: "venue";
  entity: "venue";
}

/** One concert in a list exhibit. Frontend hydrates the photo/genre from the artist slug. */
export interface ConcertRow {
  concertId: string;
  date: string; // ISO ("1998-04-27"); frontend formats
  artist: EntityRef;
  venue: EntityRef;
}

/**
 * A list of concerts — search_concerts ("shows in 1998", "Cure shows in DC") and on_this_day.
 * Carries the concert rows in the tool's own order; everything visual (photo, genre spine) is
 * hydrated client-side from the slugs. NOTE: this is a chronological/result list, NOT a
 * count-ranking ("most-seen artists") — no tool emits that structured today; it'd be a v2 card.
 */
export interface ListExhibit {
  kind: "list";
  title: string; // concise echo of the query, e.g. "12 concerts in 1998"
  rows: ConcertRow[];
}

/** surprise_me — one highlighted show. Frontend hydrates the full concert from concerts.json by id. */
export interface SerendipityExhibit {
  kind: "serendipity";
  concertId: string;
  artist: EntityRef; // the headliner, for the spine + deep-link
}

/**
 * Resolver returned several candidates ("a few artists matching 'the…'"). Choice chips.
 * Slugs are derived from the display names via the same normalize fn the data was keyed by, so a
 * chip always deep-links correctly even though the resolver only hands back display names today.
 */
export interface DisambiguationExhibit {
  kind: "disambiguation";
  entity: "artist" | "venue";
  candidates: EntityRef[];
}

// ---------------------------------------------------------------------------------------------
// Record-shaped cards (#593). These break the thin-envelope rule in one deliberate place: album
// IDENTITY rides in the envelope. The SPA does not load song-albums.json or album-eras.json
// (~900 KB together) and should not start to just to draw a cover, while a release-group id,
// title and date are identity, not presentation. Everything visual — the cover image, photos,
// genre colour, fallbacks — is still resolved client-side.
// ---------------------------------------------------------------------------------------------

/** A studio album, as MusicBrainz knows it. `mbid` is the release-group id Cover Art Archive keys on. */
export interface AlbumIdentity {
  mbid: string;
  title: string;
  /** "1984", "1984-03" or "1984-03-17": MusicBrainz precision varies, so render the year. */
  releaseDate: string;
  /** False means Cover Art Archive has no front image: skip the request, draw the derived sleeve. */
  coverAvailable: boolean;
}

/** One song in a set, with the record it came off when the attribution data knows. */
export interface SetSong {
  title: string;
  /** setlist.fm's cover credit ("Kajagoogoo"). A cover never carries an album. */
  coverOf?: string;
  album: AlbumIdentity | null;
}

/**
 * get_album_info resolved to one record — "what album was Blind Vision on?". `heardLive` is
 * the most recent night a song from it is in one of my setlists, with that whole set so the
 * card can mark the songs that came off this record.
 */
export interface AlbumExhibit {
  kind: "album";
  album: AlbumIdentity;
  /** The act whose record it is. Null when that act isn't in the archive (a cover's original). */
  artist: EntityRef | null;
  artistName: string;
  /** The song asked about, when the question was about a song. */
  song?: string;
  /** 1-based place in the act's studio albums, when the record is one of them. */
  position?: { index: number; total: number };
  /** The record carrying most of the act's best-known tracks (album-eras `definingAlbum`). */
  defining?: boolean;
  heardLive?: {
    concertId: string;
    date: string;
    headliner: EntityRef;
    venue: EntityRef;
    /** Whose set this is — an opener's when the song came from their set. */
    performer: string;
    songs: SetSong[];
  };
}

/** get_album_info for an act — every studio album, with the cycles I saw them in. */
export interface DiscographyExhibit {
  kind: "discography";
  artist: EntityRef;
  albums: Array<AlbumIdentity & { seen: string[]; defining: boolean }>;
  /** The act's release list hit the fetch cap: first/last may not be the true first/last. */
  truncated: boolean;
}

/**
 * get_concert_setlist resolved to one night. The lineup, photos and venue are hydrated from
 * concerts.json + media-index.json by `concertId`; the set and its records ride here.
 */
export interface ShowExhibit {
  kind: "show";
  concertId: string;
  date: string;
  headliner: EntityRef;
  venue: EntityRef;
  /** Whose set `songs` is. */
  performer: string;
  isOpener: boolean;
  /** Empty when no setlist is on record — the card still shows the night. */
  songs: SetSong[];
  /** The record the headliner was touring, even if nothing from it was played. */
  touring: AlbumIdentity | null;
}

/**
 * get_career_position resolved to one night: where the act stood in their own catalogue.
 * `shelf` is every studio album in order, each flagged `before` when it was already out that
 * night (album-eras `albumsBefore` is the authority, not a date comparison).
 */
export interface EraExhibit {
  kind: "era";
  concertId: string;
  date: string;
  artist: EntityRef;
  venue: EntityRef;
  /** The record they were touring; null for a night before their first studio album. */
  touring: AlbumIdentity | null;
  daysSinceRelease: number | null;
  albumsAfter: number;
  /** The record they'd be remembered for, and whether it was still ahead that night. */
  defining: (AlbumIdentity & { ahead: boolean; monthsAway: number | null }) | null;
  shelf: Array<AlbumIdentity & { before: boolean }>;
  truncated: boolean;
}

/** One night where the defining record didn't exist yet. */
export interface AheadNight {
  concertId: string;
  date: string;
  artist: EntityRef;
  album: AlbumIdentity;
  monthsAway: number;
}

/** get_career_shape — the archive-wide read. `ahead` is in the order the prose quotes them. */
export interface ShapeExhibit {
  kind: "shape";
  placed: number;
  total: number;
  medianMonths: number;
  buckets: Record<"fresh" | "current" | "mature" | "deep" | "catalog", number>;
  aheadCount: number;
  ahead: AheadNight[];
}

/** One song in the most-heard list, with the record it came off when known. */
export interface TopSong {
  title: string;
  count: number;
  /** The act, when one act accounts for it. Null link when the name isn't an archive act. */
  artist: EntityRef | null;
  artistNames: string[];
  album: AlbumIdentity | null;
  /** The original act when every attribution is a cover ("Ring of Fire" → Johnny Cash). */
  coverOf?: string;
}

/** get_archive_top_songs — the most-heard songs, each with its cover. */
export interface SongsExhibit {
  kind: "songs";
  withSetlist: number;
  totalConcerts: number;
  songs: TopSong[];
}

/** Prose-only answer (archive_info, on_this_day with no matches, or any non-entity reply). */
export interface PlainExhibit {
  kind: "plain";
}

/** Kill-switch / cap / empty — mirrors the SSE `refusal` event so the frontend renders one quiet card. */
export interface RefusalExhibit {
  kind: "refusal";
}

/** The `event: exhibit` payload — a discriminated union the frontend switches on by `kind`. */
export type Exhibit =
  | ArtistExhibit
  | VenueExhibit
  | ListExhibit
  | SerendipityExhibit
  | AlbumExhibit
  | DiscographyExhibit
  | ShowExhibit
  | EraExhibit
  | ShapeExhibit
  | SongsExhibit
  | DisambiguationExhibit
  | PlainExhibit
  | RefusalExhibit;

// ---------------------------------------------------------------------------------------------
// Selection: one turn can run several tools. The backend records a descriptor per entity-shaped
// tool result, then picks ONE primary exhibit to render. Priority favors the most specific,
// most navigable card; falls back to a plain prose card when nothing entity-shaped ran.
// ---------------------------------------------------------------------------------------------

/** Higher wins. Disambiguation outranks all — if the archive needs a pick, that IS the answer. */
const KIND_PRIORITY: Record<Exhibit["kind"], number> = {
  disambiguation: 60,
  // A record or a night is narrower than the act: "what album was X on" often also runs
  // get_artist_history, and the card should be the record, not the act.
  album: 55,
  discography: 55,
  show: 55,
  era: 55,
  artist: 50,
  venue: 50,
  serendipity: 40,
  list: 30,
  // Archive-wide reads: any entity card in the same turn is the more specific answer.
  shape: 30,
  songs: 30,
  plain: 10,
  refusal: 0,
};

/**
 * Pick the primary exhibit from the descriptors a turn produced, in tool-call order. Ties break
 * to the FIRST one: on a multi-entity turn ("did X play at venue Y?") the model resolves the
 * sentence's subject first, so the first descriptor at a given priority is the card the prose is
 * actually about. (Using the last one mismatched the card to the prose.) Returns a plain exhibit
 * if nothing entity-shaped was produced.
 */
export function pickPrimaryExhibit(descriptors: Exhibit[]): Exhibit {
  let best: Exhibit = { kind: "plain" };
  let bestRank = -1;
  for (const d of descriptors) {
    const rank = KIND_PRIORITY[d.kind];
    if (rank > bestRank) {
      best = d;
      bestRank = rank;
    }
  }
  return best;
}

// Deep-link builders — mirror docs/DEEP_LINKING.md so the worker and the SPA agree on URL shape.
// Since #196 that agreement is also machine-checked: test/fixtures/deep-link-urls.json is the
// shared contract every emitting surface asserts against, rather than trusting this comment.
export const artistDeepLink = (slug: Slug): string => `/?scene=artists&artist=${slug}`;
export const venueDeepLink = (slug: Slug): string => `/?scene=venues&venue=${slug}`;

/**
 * A specific night (#197). Keyed on the concert date — never the concert id, which is a
 * row-order artifact that a data re-import would renumber, breaking every link already sent.
 * Additive: this is `artistDeepLink` plus one param, so it degrades to the artist gatefold
 * if the date no longer resolves.
 */
export const showDeepLink = (slug: Slug, date: string): string =>
  `${artistDeepLink(slug)}&show=${date}`;
