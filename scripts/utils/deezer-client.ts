/**
 * Deezer API Client
 * Free tier: No documented rate limit (generous)
 * Docs: https://developers.deezer.com/api
 */

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
   * Get artist info and return in our format
   */
  async getArtistInfo(artistName: string) {
    const artists = await this.searchArtist(artistName)
    if (!artists || artists.length === 0) {
      return null
    }

    // Take the first result (most relevant match)
    const artist = artists[0]

    // Prefer picture_big (500x500), fallback to picture_medium (250x250)
    const image = artist.picture_big || artist.picture_medium

    // Skip if no image available
    if (!image) {
      return null
    }

    // Reject Deezer placeholder images (contain //500x500 with missing artist ID)
    if (image.includes('//500x500') || image.includes('//250x250')) {
      return null
    }

    return {
      name: artist.name,
      image: image,
      genres: [], // Deezer doesn't provide genres in search endpoint
      source: 'deezer' as const,
      fetchedAt: new Date().toISOString(),
    }
  }
}
