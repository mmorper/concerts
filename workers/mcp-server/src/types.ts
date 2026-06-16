export interface Env {
  DATA_BASE_URL: string;
  MCP_QUERY_USAGE: KVNamespace;
  ANTHROPIC_API_KEY?: string;
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

export interface VenueMetadata {
  name: string;
  normalizedName: string;
  city: string;
  state: string;
  cityState: string;
  location?: { lat: number; lng: number };
}

export interface SetlistEntry {
  concertId: string;
  artistName: string;
  date: string;
  venue: string;
  songs?: string[];
}

export interface SetlistsCache {
  version: string;
  generatedAt: string;
  entries: SetlistEntry[];
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
