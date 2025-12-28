/**
 * Last.fm API Client
 * Free tier: 5 calls per second
 * Docs: https://www.last.fm/api
 */

interface LastFmResponse {
  artist?: {
    name: string
    mbid?: string
    url?: string
    image?: Array<{
      '#text': string
      size: string
    }>
    bio?: {
      summary?: string
      content?: string
    }
    tags?: {
      tag: Array<{
        name: string
      }>
    }
  }
}

export class LastFmClient {
  private apiKey: string
  private baseUrl = 'https://ws.audioscrobbler.com/2.0/'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Get artist info from Last.fm
   */
  async getArtistInfo(artistName: string) {
    try {
      const params = new URLSearchParams({
        method: 'artist.getinfo',
        artist: artistName,
        api_key: this.apiKey,
        format: 'json',
      })

      const url = `${this.baseUrl}?${params}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Last.fm API error: ${response.status}`)
      }

      const data: LastFmResponse = await response.json()
      if (!data.artist) {
        return null
      }

      const artist = data.artist

      // Find the large image
      const largeImage = artist.image?.find(img => img.size === 'large' || img.size === 'extralarge')

      // Extract bio and remove HTML tags
      const bioText = artist.bio?.summary || artist.bio?.content || ''
      const cleanBio = bioText
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .slice(0, 500) // Truncate to 500 chars

      return {
        name: artist.name,
        image: largeImage?.['#text'],
        bio: cleanBio,
        genres: artist.tags?.tag?.map(t => t.name) || [],
        url: artist.url,
        source: 'lastfm' as const,
        fetchedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error(`Failed to fetch artist from Last.fm: ${artistName}`, error)
      return null
    }
  }
}
