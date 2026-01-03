import { useMemo, useState, useEffect } from 'react'
import { normalizeArtistName } from '../../../utils/normalize'
import type { Concert } from '../../../types/concert'
import type {
  ArtistCard,
  ArtistsMetadataFile,
  SizeClass,
  SortOrder,
  ArtistConcert
} from './types'

/**
 * All cards use uniform size (240px front, 600px back when flipped)
 */
function getSizeClass(_timesSeen: number): SizeClass {
  return 'uniform'
}

/**
 * Aggregate concerts by artist and merge with Spotify metadata
 */
export function useArtistData(concerts: Concert[]) {
  const [spotifyMetadata, setSpotifyMetadata] = useState<ArtistsMetadataFile | null>(null)

  // Load Spotify metadata on mount
  useEffect(() => {
    fetch('/data/artists-metadata.json')
      .then(res => res.json())
      .then(data => setSpotifyMetadata(data))
      .catch(err => console.error('Failed to load artist metadata:', err))
  }, [])

  // Aggregate concert data by artist
  const artistCards = useMemo(() => {
    if (!spotifyMetadata) return []

    // Map to track artist appearances
    const artistMap = new Map<
      string,
      {
        name: string // Use the actual display name from concerts
        normalizedName: string
        concerts: ArtistConcert[]
        genres: Map<string, number> // genre -> count
      }
    >()

    // Process all concerts (headliners AND openers)
    concerts.forEach(concert => {
      // Add headliner
      const headlinerNorm = normalizeArtistName(concert.headliner)

      if (!artistMap.has(headlinerNorm)) {
        artistMap.set(headlinerNorm, {
          name: concert.headliner,
          normalizedName: headlinerNorm,
          concerts: [],
          genres: new Map()
        })
      }

      const headlinerData = artistMap.get(headlinerNorm)!
      headlinerData.concerts.push({
        date: concert.date,
        venue: concert.venue,
        city: concert.cityState,
        isHeadliner: true
      })

      // Track genre
      const genreCount = headlinerData.genres.get(concert.genre) || 0
      headlinerData.genres.set(concert.genre, genreCount + 1)

      // Add openers
      if (concert.openers && concert.openers.length > 0) {
        concert.openers.forEach(opener => {
          if (!opener || !opener.trim()) return

          const openerNorm = normalizeArtistName(opener)

          if (!artistMap.has(openerNorm)) {
            artistMap.set(openerNorm, {
              name: opener.trim(),
              normalizedName: openerNorm,
              concerts: [],
              genres: new Map()
            })
          }

          const openerData = artistMap.get(openerNorm)!
          openerData.concerts.push({
            date: concert.date,
            venue: concert.venue,
            city: concert.cityState,
            isHeadliner: false
          })

          // Track genre for opener (use concert genre)
          const openerGenreCount = openerData.genres.get(concert.genre) || 0
          openerData.genres.set(concert.genre, openerGenreCount + 1)
        })
      }
    })

    // Convert to ArtistCard array and merge with Spotify data
    const cards: ArtistCard[] = []

    artistMap.forEach((artistData, normalizedName) => {
      // Find primary genre (most frequent)
      let primaryGenre = 'Other'
      let maxCount = 0
      artistData.genres.forEach((count, genre) => {
        if (count > maxCount) {
          maxCount = count
          primaryGenre = genre
        }
      })

      // Sort concerts by date (newest first)
      const sortedConcerts = artistData.concerts.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      const timesSeen = artistData.concerts.length

      // Get Spotify metadata if available
      const spotify = spotifyMetadata[normalizedName]

      // Determine which album cover size to use - medium is good for 240px cards
      const sizeClass = getSizeClass(timesSeen)
      let albumCoverUrl: string | undefined
      if (spotify?.mostPopularAlbum?.coverArt) {
        const { small, medium, large } = spotify.mostPopularAlbum.coverArt
        // Use medium size (300px) for all uniform 240px cards
        albumCoverUrl = medium || large || small || undefined
      }

      cards.push({
        name: artistData.name,
        normalizedName,
        timesSeen,
        sizeClass,
        primaryGenre,
        concerts: sortedConcerts,
        // Spotify data (may be undefined for mock)
        albumCover: albumCoverUrl,
        albumName: spotify?.mostPopularAlbum?.name,
        spotifyArtistUrl: spotify?.spotifyArtistUrl,
        topTracks: spotify?.topTracks?.map(track => ({
          name: track.name,
          previewUrl: track.previewUrl,
          spotifyUrl: track.spotifyUrl
        }))
      })
    })

    return cards
  }, [concerts, spotifyMetadata])

  return { artistCards, isLoading: !spotifyMetadata }
}

/**
 * Sort artist cards based on selected order
 */
export function sortArtistCards(cards: ArtistCard[], sortOrder: SortOrder): ArtistCard[] {
  const sorted = [...cards]

  switch (sortOrder) {
    case 'timesSeen':
      // Weighted: sort by frequency, then alphabetically for ties
      return sorted.sort((a, b) => {
        const freqCompare = b.timesSeen - a.timesSeen
        if (freqCompare !== 0) return freqCompare
        return a.name.localeCompare(b.name)
      })

    case 'alphabetical':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))

    case 'genre':
      // Genre: sort by genre, then alphabetically within genre
      return sorted.sort((a, b) => {
        const genreCompare = a.primaryGenre.localeCompare(b.primaryGenre)
        if (genreCompare !== 0) return genreCompare
        return a.name.localeCompare(b.name)
      })

    case 'chronological':
      return sorted.sort((a, b) => {
        // Sort by first-seen date (earliest concert)
        const aFirstDate = a.concerts[a.concerts.length - 1]?.date || ''
        const bFirstDate = b.concerts[b.concerts.length - 1]?.date || ''
        return aFirstDate.localeCompare(bFirstDate)
      })

    default:
      return sorted
  }
}
