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
