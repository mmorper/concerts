/**
 * Deezer API Client
 * Free tier: No documented rate limit (generous)
 * Docs: https://developers.deezer.com/api
 */

import { createHash } from 'node:crypto'
import { actKey } from './act-name'

/**
 * Deezer's grey "no picture" silhouette. An artist without a photo gets it under the
 * md5 of an empty string, or under a hash of its own that the CDN serves it for: on
 * 2026-11-12 X's and Berlin's stored URLs did. The CDN names it in an
 * `edge-cache-tag: artist-<empty hash>` header, and its edges send one of two
 * encodings, so the bytes are checked too.
 */
const EMPTY_PICTURE_HASH = 'd41d8cd98f00b204e9800998ecf8427e'
const BLANK_PICTURE_MD5S = new Set([
  'c9d19c4bba2c1605876c762729974916', // 9,622 bytes
  '786c9a9535eee5d3571cc8170e220d13', // 5,922 bytes
])

interface DeezerArtist {
  id: number
  name: string
  picture: string
  picture_small: string
  picture_medium: string
  picture_big: string
  picture_xl: string
  nb_album?: number
  nb_fan?: number
  link?: string
  tracklist?: string
  type: string
}

interface DeezerSearchResponse {
  data: DeezerArtist[]
  total: number
  next?: string
}

interface DeezerTrack {
  id: number
  title: string
  preview: string | null
  duration: number
  rank: number
  album: {
    title: string
    cover_medium: string
  }
  link: string
}

interface DeezerTopTracksResponse {
  data: DeezerTrack[]
  total: number
}

export interface NormalizedTrack {
  name: string
  previewUrl: string | null
  durationMs: number
  albumName: string
  albumArt: string
  streamingUrl: string
}

export class DeezerClient {
  private baseUrl = 'https://api.deezer.com'

  /**
   * Search for an artist by name
   */
  async searchArtist(artistName: string): Promise<DeezerArtist[]> {
    try {
      const encodedName = encodeURIComponent(artistName)
      const url = `${this.baseUrl}/search/artist?q=${encodedName}`

      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('  ⚠️  Rate limit hit, waiting 2 seconds...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          return this.searchArtist(artistName) // Retry once
        }
        throw new Error(`Deezer API error: ${response.status}`)
      }

      const data: DeezerSearchResponse = await response.json()
      return data.data || []
    } catch (error) {
      console.error(`Failed to fetch artist from Deezer: ${artistName}`, error)
      return []
    }
  }

  /**
   * The results named the act asked for, most fans first. Deezer has many acts per
   * name: its first "Berlin" had 9 fans and no photo, the band had 25,618.
   */
  private namedArtists(artists: DeezerArtist[], artistName: string): DeezerArtist[] {
    const key = actKey(artistName)
    return artists
      .filter((a) => actKey(a.name) === key)
      .sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))
  }

  /**
   * Is this URL Deezer's blank silhouette? A failed check answers no: a network blip
   * must not cost an act its real photo.
   */
  async isBlankPicture(url: string): Promise<boolean> {
    if (/\/artist\/\/\d+x\d+/.test(url) || url.includes(`/artist/${EMPTY_PICTURE_HASH}/`)) {
      return true
    }
    try {
      const response = await fetch(url)
      if (!response.ok) return false
      if (response.headers?.get('edge-cache-tag')?.includes(EMPTY_PICTURE_HASH)) return true
      const bytes = Buffer.from(await response.arrayBuffer())
      return BLANK_PICTURE_MD5S.has(createHash('md5').update(bytes).digest('hex'))
    } catch {
      return false
    }
  }

  /**
   * Get artist info and return in our format
   */
  async getArtistInfo(artistName: string) {
    const artists = await this.searchArtist(artistName)
    if (!artists || artists.length === 0) {
      return null
    }

    for (const artist of this.namedArtists(artists, artistName)) {
      // Prefer picture_big (500x500), fallback to picture_medium (250x250)
      const image = artist.picture_big || artist.picture_medium
      if (!image || (await this.isBlankPicture(image))) continue

      return {
        name: artist.name,
        image: image,
        genres: [], // Deezer doesn't provide genres in search endpoint
        source: 'deezer' as const,
        fetchedAt: new Date().toISOString(),
      }
    }

    return null
  }

  /**
   * Get top tracks by popularity with preview URLs
   * Returns normalized track data in common format
   */
  async getTopTracks(artistName: string, limit: number = 5): Promise<NormalizedTrack[]> {
    try {
      // Step 1: Search for artist
      const artists = await this.searchArtist(artistName)
      if (!artists || artists.length === 0) {
        return []
      }

      const [artist] = this.namedArtists(artists, artistName)
      if (!artist) {
        return []
      }
      const artistId = artist.id

      // Step 2: Get top tracks
      const url = `${this.baseUrl}/artist/${artistId}/top?limit=${limit}`
      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('  ⚠️  Rate limit hit, waiting 2 seconds...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          return this.getTopTracks(artistName, limit) // Retry once
        }
        throw new Error(`Deezer API error: ${response.status}`)
      }

      const data: DeezerTopTracksResponse = await response.json()

      if (!data.data || data.data.length === 0) {
        return []
      }

      // Normalize to common format
      return data.data.map(track => ({
        name: track.title,
        previewUrl: track.preview || null,
        durationMs: track.duration * 1000, // Deezer returns seconds, convert to ms
        albumName: track.album.title,
        albumArt: track.album.cover_medium,
        streamingUrl: track.link
      }))

    } catch (error) {
      console.error(`Failed to fetch top tracks from Deezer: ${artistName}`, error)
      return []
    }
  }
}
