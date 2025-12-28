import { useMemo } from 'react'
import type { Concert, ConcertData } from '@/types/concert'
import { useFilterStore } from '@/store/useFilterStore'

export interface UseConcertDataReturn {
  concerts: Concert[]
  filteredConcerts: Concert[]
  uniqueArtists: string[]
  uniqueGenres: string[]
  uniqueVenues: string[]
  uniqueCities: string[]
  yearRange: [number, number]
  stats: {
    total: number
    filtered: number
    artists: number
    venues: number
    cities: number
  }
}

export function useConcertData(data: ConcertData | null): UseConcertDataReturn {
  const {
    searchQuery,
    selectedArtists,
    selectedGenres,
    selectedVenues,
    selectedCities,
    yearRange,
    hasOpenersOnly,
  } = useFilterStore()

  // Extract unique values for filter options
  const { uniqueArtists, uniqueGenres, uniqueVenues, uniqueCities, dataYearRange } = useMemo(() => {
    if (!data) {
      return {
        uniqueArtists: [],
        uniqueGenres: [],
        uniqueVenues: [],
        uniqueCities: [],
        dataYearRange: [1995, 2024] as [number, number],
      }
    }

    const artists = Array.from(new Set(data.concerts.map((c) => c.headliner))).sort()
    const genres = Array.from(new Set(data.concerts.map((c) => c.genre))).sort()
    const venues = Array.from(new Set(data.concerts.map((c) => c.venue))).sort()
    const cities = Array.from(new Set(data.concerts.map((c) => c.cityState))).sort()

    const years = data.concerts.map((c) => c.year)
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)

    return {
      uniqueArtists: artists,
      uniqueGenres: genres,
      uniqueVenues: venues,
      uniqueCities: cities,
      dataYearRange: [minYear, maxYear] as [number, number],
    }
  }, [data])

  // Apply filters
  const filteredConcerts = useMemo(() => {
    if (!data) return []

    return data.concerts.filter((concert) => {
      // Search query (searches headliner, venue, city, openers)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchableText = [
          concert.headliner,
          concert.venue,
          concert.cityState,
          ...concert.openers,
        ]
          .join(' ')
          .toLowerCase()

        if (!searchableText.includes(query)) return false
      }

      // Artist filter
      if (selectedArtists.length > 0) {
        if (!selectedArtists.includes(concert.headliner)) return false
      }

      // Genre filter
      if (selectedGenres.length > 0) {
        if (!selectedGenres.includes(concert.genre)) return false
      }

      // Venue filter
      if (selectedVenues.length > 0) {
        if (!selectedVenues.includes(concert.venue)) return false
      }

      // City filter
      if (selectedCities.length > 0) {
        if (!selectedCities.includes(concert.cityState)) return false
      }

      // Year range filter
      if (concert.year < yearRange[0] || concert.year > yearRange[1]) return false

      // Has openers filter
      if (hasOpenersOnly && concert.openers.length === 0) return false

      return true
    })
  }, [
    data,
    searchQuery,
    selectedArtists,
    selectedGenres,
    selectedVenues,
    selectedCities,
    yearRange,
    hasOpenersOnly,
  ])

  // Calculate stats
  const stats = useMemo(() => {
    if (!data) {
      return {
        total: 0,
        filtered: 0,
        artists: 0,
        venues: 0,
        cities: 0,
      }
    }

    const filteredArtists = new Set(filteredConcerts.map((c) => c.headliner))
    const filteredVenues = new Set(filteredConcerts.map((c) => c.venue))
    const filteredCities = new Set(filteredConcerts.map((c) => c.cityState))

    return {
      total: data.concerts.length,
      filtered: filteredConcerts.length,
      artists: filteredArtists.size,
      venues: filteredVenues.size,
      cities: filteredCities.size,
    }
  }, [data, filteredConcerts])

  return {
    concerts: data?.concerts || [],
    filteredConcerts,
    uniqueArtists,
    uniqueGenres,
    uniqueVenues,
    uniqueCities,
    yearRange: dataYearRange,
    stats,
  }
}
