/**
 * iTunes Search API Client
 *
 * Keyless and free, but NOT unlimited — the previous version of this comment
 * said "no rate limits (Apple encourages usage)" and that is measurably wrong.
 * Two full 257-artist sweeps, measured 2026-08-08:
 *
 *   600ms cadence   27x HTTP 429, then 149x HTTP 403
 *   3000ms cadence   0x HTTP 429, then 156x HTTP 403
 *
 * Both runs died at roughly the same ARTIST COUNT (~45-90) despite a 5x
 * difference in cadence. That is a request-budget signature, not a rate one:
 * slowing down does not buy more requests, it just spreads the same allowance
 * over more wall-clock. Sustained 429s escalate to a 403 block on the whole
 * client, which clears on its own within minutes.
 *
 * The practical consequence: a full sweep must be CHUNKED (~40 artists, pause,
 * repeat), not slowed. And a 403 must stop the run — see ITunesBlockedError.
 *
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */

/**
 * Apple has blocked this client, not merely throttled it.
 *
 * Distinct from an empty result because the correct response is different:
 * an empty result means "this artist has no tracks", a block means "nothing
 * you ask for will succeed until this expires." Retrying is not just futile,
 * it is counterproductive — the block is what sustained retrying earns.
 */
export class ITunesBlockedError extends Error {
  constructor(label: string) {
    super(`iTunes returned 403 for "${label}" — client is blocked, not rate limited`)
    this.name = 'ITunesBlockedError'
  }
}

interface iTunesTrack {
  trackName: string
  previewUrl: string | null
  trackTimeMillis: number
  collectionName: string
  artworkUrl100: string
  trackViewUrl: string
  artistName: string
  artistId: number
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

  /**
   * Who iTunes thinks recorded this — PROVENANCE, not persisted.
   *
   * A name search returns whoever the term matched, which is not necessarily
   * who we asked for: "Bad Religion" once returned Frank Ocean's *channel
   * ORANGE* and "ABC" returned children's alphabet songs (#275). Nothing in
   * the stored record captured that, so the only symptom was an album title
   * that failed to match the artist's discography — a silent recall loss two
   * layers downstream.
   *
   * The caller compares these against the artist it asked for, records the
   * outcome once per artist, and STRIPS these fields before writing. They are
   * ~80% duplicated across an artist's five tracks, and this file is fetched
   * by the SPA on every artist view.
   */
  artistName: string
  artistId: number
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

        // Not retried, and deliberately not swallowed into an empty result:
        // every subsequent request will fail the same way until it expires.
        if (response.status === 403) {
          throw new ITunesBlockedError(label)
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
          streamingUrl: track.trackViewUrl,
          artistName: track.artistName,
          artistId: track.artistId
        }))

      } catch (error) {
        // A block is the caller's problem to act on, not a per-artist miss.
        if (error instanceof ITunesBlockedError) throw error

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
