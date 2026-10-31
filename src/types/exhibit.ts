// The exhibit schema — MIRRORS the chat worker's contract in
// `workers/ask-chat/src/exhibits.ts`. The worker emits these as the SSE `event: exhibit`
// payload (#140). Keep the two in sync; the worker file is the source of truth.
//
// THIN ENVELOPE: the worker sends only identity + selection (kind, slugs, concertId,
// deep-links, ordering). This client HYDRATES the visual atoms — photo, genre spine, "N shows",
// year range, map tile — from the SPA's local data (concerts/artists/venues JSON) using the
// slugs/ids here. See `useArchiveData` for the hydration lookups.

export type ExhibitKind =
  | 'artist'
  | 'venue'
  | 'list'
  | 'serendipity'
  | 'album'
  | 'discography'
  | 'show'
  | 'era'
  | 'shape'
  | 'songs'
  | 'plain'
  | 'disambiguation'
  | 'refusal'

export interface EntityRef {
  entity: 'artist' | 'venue'
  slug: string
  name: string
  deepLink: string
}

export interface ConcertRow {
  concertId: string
  date: string // ISO ("1998-04-27")
  artist: EntityRef
  venue: EntityRef
}

export interface ArtistExhibit extends EntityRef {
  kind: 'artist'
  entity: 'artist'
}

export interface VenueExhibit extends EntityRef {
  kind: 'venue'
  entity: 'venue'
}

export interface ListExhibit {
  kind: 'list'
  title: string
  rows: ConcertRow[]
}

export interface SerendipityExhibit {
  kind: 'serendipity'
  concertId: string
  artist: EntityRef
}

export interface DisambiguationExhibit {
  kind: 'disambiguation'
  entity: 'artist' | 'venue'
  candidates: EntityRef[]
}

// Record-shaped cards (#593). Album IDENTITY rides in the envelope (the SPA doesn't load the
// ~900 KB of album data); every image, photo and fallback is still resolved client-side.

export interface AlbumIdentity {
  mbid: string
  title: string
  /** "1984", "1984-03" or "1984-03-17" — render the year. */
  releaseDate: string
  /** False: Cover Art Archive has no front image — don't request one, draw the derived sleeve. */
  coverAvailable: boolean
}

export interface SetSong {
  title: string
  coverOf?: string
  album: AlbumIdentity | null
}

export interface AlbumExhibit {
  kind: 'album'
  album: AlbumIdentity
  artist: EntityRef | null
  artistName: string
  song?: string
  position?: { index: number; total: number }
  defining?: boolean
  heardLive?: {
    concertId: string
    date: string
    headliner: EntityRef
    venue: EntityRef
    performer: string
    songs: SetSong[]
  }
}

export interface DiscographyExhibit {
  kind: 'discography'
  artist: EntityRef
  albums: Array<AlbumIdentity & { seen: string[]; defining: boolean }>
  truncated: boolean
}

export interface ShowExhibit {
  kind: 'show'
  concertId: string
  date: string
  headliner: EntityRef
  venue: EntityRef
  performer: string
  isOpener: boolean
  songs: SetSong[]
  touring: AlbumIdentity | null
}

/** get_career_position: one night's place in the act's catalogue. */
export interface EraExhibit {
  kind: 'era'
  concertId: string
  date: string
  artist: EntityRef
  venue: EntityRef
  touring: AlbumIdentity | null
  daysSinceRelease: number | null
  albumsAfter: number
  defining: (AlbumIdentity & { ahead: boolean; monthsAway: number | null }) | null
  shelf: Array<AlbumIdentity & { before: boolean }>
  truncated: boolean
}

export interface AheadNight {
  concertId: string
  date: string
  artist: EntityRef
  album: AlbumIdentity
  monthsAway: number
}

/** get_career_shape: where my nights fall in albums' lives, and the "before the record" nights. */
export interface ShapeExhibit {
  kind: 'shape'
  placed: number
  total: number
  medianMonths: number
  buckets: Record<'fresh' | 'current' | 'mature' | 'deep' | 'catalog', number>
  aheadCount: number
  ahead: AheadNight[]
}

export interface TopSong {
  title: string
  count: number
  artist: EntityRef | null
  artistNames: string[]
  album: AlbumIdentity | null
  coverOf?: string
}

/** get_archive_top_songs: the most-heard songs with their records. */
export interface SongsExhibit {
  kind: 'songs'
  withSetlist: number
  totalConcerts: number
  songs: TopSong[]
}

export interface PlainExhibit {
  kind: 'plain'
}

export interface RefusalExhibit {
  kind: 'refusal'
}

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
  | RefusalExhibit

// SSE events streamed by POST /api/ask/chat (see the worker's index.ts header).
export type AskEvent =
  | { type: 'token'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'exhibit'; exhibit: Exhibit }
  | { type: 'refusal'; message: string }
  | { type: 'done'; fraction: number }
  | { type: 'error'; message: string }
