/**
 * useLinerNotesCount — returns the number of liner notes posts for a given artist
 *
 * Fetches /data/liner-notes.json once (module-level cache) and filters by
 * the artist's normalized name appearing in post.artists[].
 *
 * Mirrors the useTourDates pattern: called in ArtistGatefold, result passed
 * down to ConcertHistoryPanel to conditionally render LinerNotesBadge.
 */

import { useState, useEffect } from 'react'
import type { LinerNotesData } from '../types/liner-notes'

// Module-level cache — only one fetch for the lifetime of the page
let cachedData: LinerNotesData | null = null
let fetchPromise: Promise<LinerNotesData> | null = null

async function getLinerNotesData(): Promise<LinerNotesData> {
  if (cachedData) return cachedData
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch('/data/liner-notes.json')
    .then((res) => {
      if (!res.ok) throw new Error('liner-notes.json not found')
      return res.json() as Promise<LinerNotesData>
    })
    .then((data) => {
      cachedData = data
      fetchPromise = null
      return data
    })
    .catch((err) => {
      fetchPromise = null
      throw err
    })

  return fetchPromise
}

export interface UseLinerNotesCountResult {
  count: number
  isLoading: boolean
}

/**
 * Returns the count of liner notes posts that feature the given artist.
 *
 * @param artistNormalizedName — normalized slug, e.g. "depeche-mode"
 */
export function useLinerNotesCount(
  artistNormalizedName: string | null
): UseLinerNotesCountResult {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!artistNormalizedName) {
      setCount(0)
      return
    }

    setIsLoading(true)

    getLinerNotesData()
      .then((data) => {
        const matched = data.posts.filter((p) =>
          !p.aggregate && p.artists.includes(artistNormalizedName)
        ).length
        setCount(matched)
      })
      .catch(() => {
        setCount(0)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [artistNormalizedName])

  return { count, isLoading }
}
