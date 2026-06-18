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

/** Prose-only answer (archive_info, top_songs, on_this_day, or any non-entity reply). */
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
  artist: 50,
  venue: 50,
  serendipity: 40,
  list: 30,
  plain: 10,
  refusal: 0,
};

/**
 * Pick the primary exhibit from the descriptors a turn produced, in tool-call order. Ties break
 * to the LAST one (the model's final tool call is usually the one the prose is about). Returns a
 * plain exhibit if nothing entity-shaped was produced.
 */
export function pickPrimaryExhibit(descriptors: Exhibit[]): Exhibit {
  let best: Exhibit = { kind: "plain" };
  let bestRank = -1;
  for (const d of descriptors) {
    const rank = KIND_PRIORITY[d.kind];
    if (rank >= bestRank) {
      best = d;
      bestRank = rank;
    }
  }
  return best;
}

// Deep-link builders — mirror docs/DEEP_LINKING.md so the worker and the SPA agree on URL shape.
export const artistDeepLink = (slug: Slug): string => `/?scene=artists&artist=${slug}`;
export const venueDeepLink = (slug: Slug): string => `/?scene=venues&venue=${slug}`;
