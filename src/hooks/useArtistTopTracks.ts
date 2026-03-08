import { useState, useEffect } from 'react'
import type { TopTrack } from '../types/artist'

interface TopTracksData {
  tracks: TopTrack[] | null
  source: 'itunes' | null
  streamingUrl: string | null
  loading: boolean
  error: string | null
}

/**
 * Normalize artist name to match the format used in artists-top-tracks.json
 */
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/-+/g, '-')           // Collapse hyphens
    .replace(/^-|-$/g, '')         // Trim hyphens
}

/**
 * Get Apple Music search URL for the artist
 */
function getArtistStreamingUrl(artistName: string): string {
  return `https://music.apple.com/us/search?term=${encodeURIComponent(artistName)}`
}

/**
 * Hook to load top tracks for an artist
 * Data comes from pre-generated artists-top-tracks.json
 */
export function useArtistTopTracks(artistName: string): TopTracksData {
  const [data, setData] = useState<TopTracksData>({
    tracks: null,
    source: null,
    streamingUrl: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    let isMounted = true

    async function loadTopTracks() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        // Load the pre-generated data file
        const response = await fetch('/data/artists-top-tracks.json')

        if (!response.ok) {
          throw new Error(`Failed to load top tracks data: ${response.status}`)
        }

        const allTopTracks = await response.json()

        // Normalize artist name to match the key format
        const normalizedName = normalizeArtistName(artistName)

        // Look up this artist's data
        const artistData = allTopTracks[normalizedName]

        if (!isMounted) return

        if (artistData && artistData.tracks && artistData.tracks.length > 0) {
          setData({
            tracks: artistData.tracks,
            source: artistData.source,
            streamingUrl: getArtistStreamingUrl(artistName),
            loading: false,
            error: null
          })
        } else {
          // Artist not found or no tracks available
          setData({
            tracks: null,
            source: null,
            streamingUrl: null,
            loading: false,
            error: null // Not an error, just no data available
          })
        }
      } catch (error) {
        if (!isMounted) return

        console.error('Error loading top tracks:', error)
        setData({
          tracks: null,
          source: null,
          streamingUrl: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load top tracks'
        })
      }
    }

    loadTopTracks()

    return () => {
      isMounted = false
    }
  }, [artistName])

  return data
}
