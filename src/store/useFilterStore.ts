import { create } from 'zustand'

export interface FilterState {
  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Multi-select filters
  selectedArtists: string[]
  setSelectedArtists: (artists: string[]) => void
  toggleArtist: (artist: string) => void

  selectedGenres: string[]
  setSelectedGenres: (genres: string[]) => void
  toggleGenre: (genre: string) => void

  selectedVenues: string[]
  setSelectedVenues: (venues: string[]) => void
  toggleVenue: (venue: string) => void

  selectedCities: string[]
  setSelectedCities: (cities: string[]) => void
  toggleCity: (city: string) => void

  // Year range
  yearRange: [number, number]
  setYearRange: (range: [number, number]) => void

  // Has openers toggle
  hasOpenersOnly: boolean
  setHasOpenersOnly: (value: boolean) => void

  // Clear all filters
  clearFilters: () => void

  // Active filter count
  getActiveFilterCount: () => number
}

const DEFAULT_YEAR_RANGE: [number, number] = [1995, 2024]

export const useFilterStore = create<FilterState>((set, get) => ({
  // Initial state
  searchQuery: '',
  selectedArtists: [],
  selectedGenres: [],
  selectedVenues: [],
  selectedCities: [],
  yearRange: DEFAULT_YEAR_RANGE,
  hasOpenersOnly: false,

  // Search actions
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Artist actions
  setSelectedArtists: (artists) => set({ selectedArtists: artists }),
  toggleArtist: (artist) =>
    set((state) => ({
      selectedArtists: state.selectedArtists.includes(artist)
        ? state.selectedArtists.filter((a) => a !== artist)
        : [...state.selectedArtists, artist],
    })),

  // Genre actions
  setSelectedGenres: (genres) => set({ selectedGenres: genres }),
  toggleGenre: (genre) =>
    set((state) => ({
      selectedGenres: state.selectedGenres.includes(genre)
        ? state.selectedGenres.filter((g) => g !== genre)
        : [...state.selectedGenres, genre],
    })),

  // Venue actions
  setSelectedVenues: (venues) => set({ selectedVenues: venues }),
  toggleVenue: (venue) =>
    set((state) => ({
      selectedVenues: state.selectedVenues.includes(venue)
        ? state.selectedVenues.filter((v) => v !== venue)
        : [...state.selectedVenues, venue],
    })),

  // City actions
  setSelectedCities: (cities) => set({ selectedCities: cities }),
  toggleCity: (city) =>
    set((state) => ({
      selectedCities: state.selectedCities.includes(city)
        ? state.selectedCities.filter((c) => c !== city)
        : [...state.selectedCities, city],
    })),

  // Year range actions
  setYearRange: (range) => set({ yearRange: range }),

  // Has openers toggle
  setHasOpenersOnly: (value) => set({ hasOpenersOnly: value }),

  // Clear all filters
  clearFilters: () =>
    set({
      searchQuery: '',
      selectedArtists: [],
      selectedGenres: [],
      selectedVenues: [],
      selectedCities: [],
      yearRange: DEFAULT_YEAR_RANGE,
      hasOpenersOnly: false,
    }),

  // Get active filter count
  getActiveFilterCount: () => {
    const state = get()
    let count = 0

    if (state.searchQuery) count++
    if (state.selectedArtists.length > 0) count += state.selectedArtists.length
    if (state.selectedGenres.length > 0) count += state.selectedGenres.length
    if (state.selectedVenues.length > 0) count += state.selectedVenues.length
    if (state.selectedCities.length > 0) count += state.selectedCities.length
    if (
      state.yearRange[0] !== DEFAULT_YEAR_RANGE[0] ||
      state.yearRange[1] !== DEFAULT_YEAR_RANGE[1]
    )
      count++
    if (state.hasOpenersOnly) count++

    return count
  },
}))
