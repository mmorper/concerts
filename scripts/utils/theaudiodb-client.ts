/**
 * TheAudioDB API Client
 * Free tier: 2 calls per second
 * Docs: https://www.theaudiodb.com/api_guide.php
 */

interface AudioDBResponse {
  artists?: Array<{
    idArtist: string
    strArtist: string
    strArtistThumb?: string
    strArtistLogo?: string
    strGenre?: string
    strStyle?: string
    intFormedYear?: string
    strBiographyEN?: string
    strWebsite?: string
  }>
}

/**
 * TheAudioDB fills unknown fields with sentinels rather than omitting them: "0" for a
 * formed year it doesn't have, "" for a missing website. Those are truthy-or-empty
 * strings, not absences, so storing them verbatim leaks into anything that guards with
 * a plain `if (meta.formed)` — which is how 11 artists ended up narrated as "Formed 0".
 *
 * Normalize at the boundary so the sentinel never enters our data in the first place.
 */
function cleanYear(value?: string): string | undefined {
  const v = value?.trim()
  return v && /^(1[89]|20)\d{2}$/.test(v) ? v : undefined
}

function cleanText(value?: string): string | undefined {
  const v = value?.trim()
  return v ? v : undefined
}

export class TheAudioDBClient {
  private apiKey: string
  private baseUrl = 'https://www.theaudiodb.com/api/v1/json'

  constructor(apiKey: string = '2') {
    this.apiKey = apiKey
  }

  /**
   * Search for an artist by name
   */
  async searchArtist(artistName: string): Promise<AudioDBResponse['artists']> {
    try {
      const encodedName = encodeURIComponent(artistName)
      const url = `${this.baseUrl}/${this.apiKey}/search.php?s=${encodedName}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`TheAudioDB API error: ${response.status}`)
      }

      const data: AudioDBResponse = await response.json()
      return data.artists || []
    } catch (error) {
      console.error(`Failed to fetch artist from TheAudioDB: ${artistName}`, error)
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

    const artist = artists[0]
    return {
      name: artist.strArtist,
      image: artist.strArtistThumb || artist.strArtistLogo,
      bio: cleanText(artist.strBiographyEN)?.slice(0, 500), // Truncate to 500 chars
      genres: [artist.strGenre, artist.strStyle].filter((g): g is string => Boolean(g)),
      formed: cleanYear(artist.intFormedYear),
      website: cleanText(artist.strWebsite),
      source: 'theaudiodb' as const,
      fetchedAt: new Date().toISOString(),
    }
  }
}
