import { useFilterStore } from '@/store/useFilterStore'
import { SearchBar } from './SearchBar'
import { ArtistFilter } from './ArtistFilter'
import { GenreFilter } from './GenreFilter'
import { VenueFilter } from './VenueFilter'
import { CityFilter } from './CityFilter'
import { YearRangeSlider } from './YearRangeSlider'

interface FilterBarProps {
  uniqueArtists: string[]
  uniqueGenres: string[]
  uniqueVenues: string[]
  uniqueCities: string[]
  yearRange: [number, number]
  filteredCount: number
  totalCount: number
}

export function FilterBar({
  uniqueArtists,
  uniqueGenres,
  uniqueVenues,
  uniqueCities,
  yearRange,
  filteredCount,
  totalCount,
}: FilterBarProps) {
  const { hasOpenersOnly, setHasOpenersOnly, clearFilters, getActiveFilterCount } =
    useFilterStore()

  const activeFilters = getActiveFilterCount()

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 sticky top-[120px] z-40">
      <div className="container mx-auto px-4 py-4">
        {/* Search bar */}
        <div className="mb-4">
          <SearchBar />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-3 mb-4">
          <ArtistFilter artists={uniqueArtists} />
          <GenreFilter genres={uniqueGenres} />
          <VenueFilter venues={uniqueVenues} />
          <CityFilter cities={uniqueCities} />

          {/* Has Openers Toggle */}
          <button
            onClick={() => setHasOpenersOnly(!hasOpenersOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              hasOpenersOnly
                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
            }`}
          >
            <span>🎵</span>
            <span className="font-medium text-sm">Has Openers</span>
          </button>
        </div>

        {/* Year range slider */}
        <div className="mb-4">
          <YearRangeSlider minYear={yearRange[0]} maxYear={yearRange[1]} />
        </div>

        {/* Active filters summary and clear button */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-purple-400 font-bold">
              {filteredCount} {filteredCount === 1 ? 'show' : 'shows'}
            </span>
            {filteredCount !== totalCount && (
              <span className="text-gray-500">
                of {totalCount} total
              </span>
            )}
          </div>

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>Clear all filters</span>
              <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-bold">
                {activeFilters}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
