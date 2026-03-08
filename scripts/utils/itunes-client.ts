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
   * Search for tracks by artist (returns top tracks by relevance/popularity)
   * No authentication required. Retries up to 3 times on 429 with exponential backoff.
   */
  async getTopTracks(artistName: string, limit: number = 5): Promise<NormalizedTrack[]> {
    const encodedName = encodeURIComponent(artistName)
    const url = `${this.baseUrl}/search?term=${encodedName}&entity=song&limit=${limit}&country=US`

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

        if (!data.results || data.results.length === 0) {
          return []
        }

        return data.results.map(track => ({
          name: track.trackName,
          previewUrl: track.previewUrl || null,
          durationMs: track.trackTimeMillis,
          albumName: track.collectionName,
          albumArt: track.artworkUrl100,
          streamingUrl: track.trackViewUrl
        }))

      } catch (error) {
        if (attempt < this.maxRetries && error instanceof Error && error.message.includes('429')) {
          continue // already handled above
        }
        console.error(`Failed to fetch tracks from iTunes: ${artistName}`, error)
        return []
      }
    }

    return []
  }
}
