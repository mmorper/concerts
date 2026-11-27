/**
 * The shapes Now Spinning reads and writes.
 *
 * The index is many small files, not one big one: the Cloudflare account is on the free tier
 * (10 ms of CPU per request), and parsing one 360 KB file was too close to that. A lookup reads
 * the manifest, then at most one act file and the covers files the manifest lists.
 *
 * Spec: docs/specs/future/global-now-spinning/global-now-spinning-spec.md §Data, §Worker API
 */

export const INDEX_VERSION = 1 as const;

export interface Photo {
  /** Site-relative URL, e.g. /images/shows/2023-03-28-depeche-mode-01.jpg */
  u: string;
  /** Focal point (the centre of the crop Mike chose), 0–1. */
  fx: number;
  fy: number;
  /**
   * The thumbnail: a 4:5 box `[x, y, w, h]`, in fractions of the image. Mike's crop, widened to
   * exactly 4:5 where the photo allows. Absent when the media index has no size for the photo.
   */
  t?: Box;
}

/** `[x, y, w, h]`, in fractions of an image: 0–1, and x + w, y + h at most 1. */
export type Box = [number, number, number, number];

export interface Album {
  t: string;
  /** Release year, or "". */
  y: string;
  /** Cover image URL, 600×600 where available. */
  c: string | null;
}

/** public/data/now-spinning/manifest.json */
export interface Manifest {
  v: typeof INDEX_VERSION;
  generatedAt: string;
  /** `rulesFingerprint()` at build time. */
  rules: string;
  /** `actKey` of every name an act is billed under → the act's file slug. */
  acts: Record<string, string>;
  /** `actKey`s that have a covers file. */
  covers: string[];
  /** `actKey`s shared by two different acts. The lookup never guesses between them. */
  ambiguous: string[];
  /** Data the builder left out rather than fail the site's build. Empty when all is well. */
  problems: { kind: "no-key" | "no-act-key" | "ambiguous-act"; what: string }[];
}

export interface Night {
  d: string;
  /** The billing slug that night (one act can play under several billings). */
  billing: string;
  venue: string;
  city: string;
  role: "h" | "o";
  /** Is there a setlist for this act on this night? */
  setlist: boolean;
  photos: Photo[];
}

/** public/data/now-spinning/acts/<slug>.json — one act, its billings merged. */
export interface ActFile {
  slug: string;
  name: string;
  /** Every name the act is billed under. Covers are looked up under each one. */
  names: string[];
  /** Oldest first. */
  nights: Night[];
  songs: {
    /** The setlist's spelling. */
    n: string;
    /** Strict keys: `titleKeys(n)`. */
    k: string[];
    /** Near-miss keys: `nearKeys(n)`. */
    nk: string[];
    /** Indexes into `nights`. */
    on: number[];
    album: Album | null;
  }[];
}

/** One time someone else played this act's song, at a show Mike was at. */
export interface CoverRow {
  n: string;
  k: string[];
  /** The performer's display name. */
  by: string;
  /** The performer's act slug. */
  bySlug: string;
  d: string;
  venue: string;
  city: string;
  photos: Photo[];
}

/** public/data/now-spinning/covers/<actKey>.json */
export interface CoversFile {
  rows: CoverRow[];
}

/** What the listener sends for a song. */
export interface TrackInput {
  artist: string;
  title: string;
  album?: string;
  artworkUrl?: string;
}

export type Screen = "heard" | "seen-cover" | "seen" | "cover-of-this" | "covers" | "none" | "unknown";

/** The `track` part of the state contract. The Worker writes every word; displays only lay out. */
export interface Track {
  title: string;
  artist: string;
  album: { title: string; year?: string; coverUrl?: string } | null;
  screen: Screen;
  /** The big numeral; `times` → draw the "×". */
  count?: { n: number; times: boolean };
  headline: string;
  /** 0–2 supporting lines, already written. */
  lines: string[];
  /** Newest first, at most 4. */
  nights: { date: string; dateLabel: string; text: string; hasPhotos: boolean }[];
  moreNights: number;
  /**
   * Absolute URLs, newest night first, at most 5. `fx`/`fy` place the blurred backdrop; `thumb`,
   * when present, is the 4:5 box the strip shows (the index's `t`).
   */
  photos: { url: string; caption: string; fx: number; fy: number; thumb?: { x: number; y: number; w: number; h: number } }[];
  /** For the generated sleeve and the glow. */
  accentHue: number;
}

export type Kind = "idle" | "unmatched" | "track" | "gap";

/** The state contract every display renders. */
export interface NowSpinningState {
  v: typeof INDEX_VERSION;
  kind: Kind;
  /** When this state began (server clock). */
  at: string;
  /** Server clock when this message was sent. */
  now: string;
  /** Idle only: one line the Worker writes when the listener is offline or can't identify. */
  notice?: string;
  track?: Track;
}
