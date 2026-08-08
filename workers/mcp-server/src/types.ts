export interface Env {
  DATA_BASE_URL: string;
  MCP_QUERY_USAGE: KVNamespace;
  ANTHROPIC_API_KEY?: string;
  // Optional spend tripwire for the `query` escape hatch — same simple push endpoint shape as the
  // ask-chat worker (ntfy/Pushover-style). Absent → the tripwire is a log line only.
  NOTIFY_WEBHOOK_URL?: string;
  // Phase 4 (#174) — per-tool-call telemetry to Cloudflare Analytics Engine (dataset `mcp_queries`).
  // OPTIONAL: absent in dev/test and any deploy that hasn't added the dataset → recordMcpQuery no-ops.
  // The operator dashboard's refresh Worker reads this via the SQL API to count external tool-calls.
  MCP_ANALYTICS?: AnalyticsEngineDataset;
}

// ---------- Source data payloads ----------
// Subset of src/types/concert.ts + the enrichment-file roots the tools read.
// W3 tools may tighten these; W2 only needs the shapes the data helpers return.

export interface Concert {
  id: string;
  date: string; // ISO 8601: "2023-06-15"
  headliner: string;
  headlinerNormalized: string;
  genre: string;
  genreNormalized: string;
  openers: string[];
  venue: string;
  venueNormalized: string;
  city: string;
  state: string;
  cityState: string;
  reference?: string;
  year: number;
  month: number;
  day: number;
  dayOfWeek: string;
  decade: string;
  location: { lat: number; lng: number };
  headlinerImage?: string;
  headlinerBio?: string;
  openerImages?: Record<string, string>;
}

export interface ConcertData {
  concerts: Concert[];
  metadata: {
    lastUpdated: string;
    totalConcerts: number;
    dateRange: { earliest: string; latest: string };
    uniqueArtists: number;
    uniqueVenues: number;
    uniqueCities: number;
  };
}

export interface Fact {
  id: string;
  category: string;
  headline: string;
  detail: string;
}

export interface FactsData {
  computedAt: string;
  facts: Fact[];
}

export interface ArtistMetadata {
  name: string;
  image?: string;
  genres?: string[];
  formed?: string;
  website?: string;
}

export interface VenueConcertRef {
  id: string;
  date: string;
  headliner: string;
}

export interface VenueStats {
  totalConcerts: number;
  firstEvent: string;
  lastEvent: string;
  uniqueArtists: number;
}

export interface VenueMetadata {
  name: string;
  normalizedName: string;
  city: string;
  state: string;
  cityState: string;
  location?: { lat: number; lng: number };
  stats?: VenueStats;
  concerts?: VenueConcertRef[];
  status?: string; // active | closed | demolished | renamed
  closedDate?: string;
  notes?: string;
}

// setlist.fm shape (nested). Songs live at setlist.sets.set[].song[].
// `setlist` is null for ~21% of cached entries (lookup ran, no setlist found).
//
// Kept in step with src/types/setlist.ts, which the site's SetlistPanel renders in
// full. This type was `{ name }` alone, which silently discarded the rest of the
// cached record: asked whether Nile Rodgers played any Duran Duran, the tools saw a
// bare "Notorious" and answered no, while the site showed "(Duran Duran cover)" from
// the very same cache entry. A song is not just its title.
export interface SetlistSong {
  name: string;
  cover?: { name: string };
  with?: { name: string };
  tape?: boolean;
  info?: string;
}

export interface SetlistSet {
  song?: SetlistSong[];
}

export interface Setlist {
  tour?: { name?: string };
  sets?: { set?: SetlistSet[] };
}

export interface SetlistEntry {
  concertId: string;
  artistName: string;
  date: string;
  venue: string;
  city?: string;
  setlist: Setlist | null;
  fetchedAt?: string;
}

export interface SetlistsCache {
  version: string;
  generatedAt: string;
  entries: SetlistEntry[];
}

// Archive-wide song frequency, computed at build time from setlists-cache.json.
// Coverage is partial — see scripts/aggregate-most-played-songs.ts — so the `coverage`
// block is narrated up front by get_archive_top_songs.
export interface SongStat {
  name: string;
  count: number;
  artists: string[];
}

export interface MostPlayedSongs {
  version: string;
  generatedAt: string;
  coverage: {
    concertsWithSetlist: number;
    totalConcerts: number;
    distinctSongs: number;
  };
  songs: SongStat[];
}

export interface TopTrack {
  name: string;
  previewUrl?: string;
}

export interface ArtistTopTracks {
  name: string;
  source: string;
  fetchedAt: string;
  tracks: TopTrack[];
}

// Maps keyed by normalized slug (e.g. "depeche-mode").
export type ArtistsMetadata = Record<string, ArtistMetadata>;
export type VenuesMetadata = Record<string, VenueMetadata>;
export type ArtistsTopTracks = Record<string, ArtistTopTracks>;

export interface Narration {
  context?: string;
  closingArc?: string;
}

export interface NarrationRecord {
  narration: Narration;
  inputHash: string;
  generatedAt: string;
  promptVersion: number;
}

export type NarrationKind = "venues" | "artists";

export interface QueryUsageRecord {
  tokens: number;
  calls: number;
}

export const QUERY_DAILY_TOKEN_CAP = 250_000;
export const QUERY_DAILY_CALL_CAP = 8;

// ---------- album-eras.json (v5.4, #270) ----------
// The discography x attendance join. Derived at build time by
// scripts/derive-album-eras.ts; see docs/specs/future/global-discography-trajectory.md.
//
// Nothing derivable is stored: cover URLs are a pure function of `mbid`
// (coverArtUrl below) and slugs of `title`. Album refs are normalized too — an
// artist's studio spine lives once on ArtistEra.studioAlbums, and a concert's
// "albums still to come" is `studioAlbums.slice(albumsBefore)`, not a copy.

export interface AlbumRef {
  mbid: string;
  title: string;
  releaseDate: string;
  coverAvailable: boolean;
}

export interface DefiningAlbum extends AlbumRef {
  /** How many of the artist's top tracks come from this album. */
  topTrackCount: number;
  topTrackTotal: number;
  matchTier: string;
}

export type CycleBucket = "fresh" | "current" | "mature" | "deep" | "catalog";

export interface ConcertEra {
  concertId: string;
  artistKey: string;
  date: string;
  currentAlbum: AlbumRef | null;
  daysSinceRelease: number | null;
  cycleBucket: CycleBucket | null;
  /** Doubles as the slice index into ArtistEra.studioAlbums. */
  albumsBefore: number;
  albumsAfter: number;
  /** Years since debut. Null for a pre-debut show — never negative (#272). */
  careerYear: number | null;
  yearsBeforeDebut: number | null;
  careerPercentile: number | null;
  isDebutEra: boolean;
  definingAlbum: DefiningAlbum | null;
  definingAlbumAhead: boolean;
  definingAlbumMonthsAway: number | null;
}

export interface ArtistEra {
  artistKey: string;
  displayName: string;
  studioAlbumCount: number;
  studioAlbums: AlbumRef[];
  debutAlbum: AlbumRef | null;
  latestAlbum: AlbumRef | null;
  definingAlbum: DefiningAlbum | null;
  /** Release list hit the 100-item fetch cap — first/last album claims are unsafe. */
  truncated: boolean;
  erasSeen: Array<{ albumSlug: string; title: string; showCount: number; dates: string[] }>;
}

export interface AlbumEras {
  version: string;
  generatedAt: string;
  concerts: Record<string, ConcertEra>;
  artists: Record<string, ArtistEra>;
  stats: Record<string, unknown>;
}

/**
 * One attributed song → the earliest studio album carrying it.
 *
 * `releaseDate` is NOT always a full date: MusicBrainz supplies `YYYY-MM` and
 * bare `YYYY` for older records. 254 of 1,716 entries are imprecise. Any
 * consumer measuring a gap against it must respect that precision — see
 * §5a of the attribution spec.
 */
export interface SongAlbum {
  songTitle: string;
  albumTitle: string;
  mbid: string;
  releaseDate: string;
  coverAvailable: boolean;
  matchTier: number;
  /** Set when the performance was a cover; the album belongs to the original act. */
  isCover?: boolean;
  /** Present only for covers: the key of the artist whose record carries the song. */
  originalArtistKey?: string;
}

export interface SongAlbums {
  version: string;
  generatedAt: string;
  songs: Record<string, SongAlbum>;
}

/**
 * Cover Art Archive URL for a release-group. Verified deterministic across all
 * 11,382 covers in discography.json. Only call when `coverAvailable` is true.
 */
export function coverArtUrl(mbid: string): string {
  return `https://coverartarchive.org/release-group/${mbid}/front-500.jpg`;
}
