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
  private maxRetries = 3
  private retryBaseDelayMs = 2000

  /**
   * Fetch top tracks by iTunes artist ID (exact lookup — no search ambiguity).
   * Uses the Lookup API: /lookup?id=ARTIST_ID&entity=song&limit=N
   */
  async getTopTracksByArtistId(artistId: number, limit: number = 5): Promise<NormalizedTrack[]> {
    const url = `${this.baseUrl}/lookup?id=${artistId}&entity=song&limit=${limit}&country=US`
    return this.fetchTracks(url, `artist ID ${artistId}`)
  }

  /**
   * Search for tracks by artist name (returns top tracks by relevance/popularity).
   * No authentication required. Retries up to 3 times on 429 with exponential backoff.
   */
  async getTopTracks(artistName: string, limit: number = 5): Promise<NormalizedTrack[]> {
    const encodedName = encodeURIComponent(artistName)
    const url = `${this.baseUrl}/search?term=${encodedName}&entity=song&limit=${limit}&country=US`

    return this.fetchTracks(url, artistName)
  }

  private async fetchTracks(url: string, label: string): Promise<NormalizedTrack[]> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url)

        if (response.status === 429) {
          if (attempt < this.maxRetries) {
            const delay = this.retryBaseDelayMs * Math.pow(2, attempt)
            console.log(`    ⏳ iTunes rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          throw new Error(`iTunes API error: 429 (exhausted retries)`)
        }

        if (!response.ok) {
          throw new Error(`iTunes API error: ${response.status}`)
        }

        const data: iTunesSearchResponse = await response.json()

        // Lookup API returns the artist as first result; filter to songs only
        const songs = data.results.filter(r => (r as iTunesTrack & { wrapperType?: string }).wrapperType === 'track' || !('wrapperType' in r))

        if (!songs || songs.length === 0) {
          return []
        }

        return songs.map(track => ({
          name: track.trackName,
          previewUrl: track.previewUrl || null,
          durationMs: track.trackTimeMillis,
          albumName: track.collectionName,
          albumArt: track.artworkUrl100,
          streamingUrl: track.trackViewUrl
        }))

      } catch (error) {
        if (attempt < this.maxRetries && error instanceof Error && error.message.includes('429')) {
          continue
        }
        console.error(`Failed to fetch tracks from iTunes: ${label}`, error)
        return []
      }
    }

    return []
  }
}
