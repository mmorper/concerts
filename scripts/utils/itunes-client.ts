/**
 * iTunes Search API Client
 * Free tier: No rate limits (Apple encourages usage)
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */

interface iTunesTrack {
  trackName: string
  previewUrl: string | null
  trackTimeMillis: number
  collectionName: string
  artworkUrl100: string
  trackViewUrl: string
}

interface iTunesSearchResponse {
  resultCount: number
  results: iTunesTrack[]
}

export interface NormalizedTrack {
  name: string
  previewUrl: string | null
  durationMs: number
  albumName: string
  albumArt: string
  streamingUrl: string
}

export class iTunesClient {
  private baseUrl = 'https://itunes.apple.com'

  /**
   * Search for tracks by artist (returns top tracks by relevance/popularity)
   * No authentication required
   */
  async getTopTracks(artistName: string, limit: number = 5): Promise<NormalizedTrack[]> {
    try {
      const encodedName = encodeURIComponent(artistName)
      const url = `${this.baseUrl}/search?term=${encodedName}&entity=song&limit=${limit}&country=US`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`iTunes API error: ${response.status}`)
      }

      const data: iTunesSearchResponse = await response.json()

      if (!data.results || data.results.length === 0) {
        return []
      }

      // Normalize to common format
      return data.results.map(track => ({
        name: track.trackName,
        previewUrl: track.previewUrl || null,
        durationMs: track.trackTimeMillis,
        albumName: track.collectionName,
        albumArt: track.artworkUrl100,
        streamingUrl: track.trackViewUrl
      }))

    } catch (error) {
      console.error(`Failed to fetch tracks from iTunes: ${artistName}`, error)
      return []
    }
  }
}
