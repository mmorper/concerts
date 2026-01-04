/**
 * Type definitions for the Artist Scene
 */

// All cards now use uniform 240px size (front) → 600px (back when flipped)
export type SizeClass = 'uniform'

export type SortOrder = 'timesSeen' | 'alphabetical'

export interface ArtistConcert {
  concertId: string // Concert ID from concerts.json (for static cache lookups)
  date: string // ISO date
  venue: string
  city: string
  isHeadliner: boolean // true if this artist was the headliner
}

export interface ArtistCard {
  name: string
  normalizedName: string // lowercase, no punctuation
  timesSeen: number
  sizeClass: SizeClass
  primaryGenre: string // most frequent genre across appearances
  concerts: ArtistConcert[]

  // From Spotify metadata (may be undefined for mock data)
  albumCover?: string // Spotify CDN URL
  albumName?: string
  spotifyArtistUrl?: string
  topTracks?: SpotifyTrack[]
}

export interface SpotifyTrack {
  name: string
  previewUrl: string | null // 30-sec MP3, may be null
  spotifyUrl: string
}

export interface SpotifyArtistMetadata {
  name: string
  normalizedName: string
  spotifyArtistId?: string
  spotifyArtistUrl?: string
  mostPopularAlbum?: {
    name: string
    spotifyAlbumId: string
    spotifyAlbumUrl: string
    coverArt: {
      small: string | null // 64px
      medium: string | null // 300px
      large: string | null // 640px
    }
    releaseYear: number
  }
  topTracks?: Array<{
    name: string
    spotifyTrackId: string
    spotifyUrl: string
    previewUrl: string | null
    durationMs: number
  }>
  genres?: string[]
  popularity?: number
  fetchedAt: string
  dataSource: 'spotify' | 'mock'
}

export type ArtistsMetadataFile = Record<string, SpotifyArtistMetadata>
