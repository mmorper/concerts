import { useFilterStore } from '@/store/useFilterStore'
import { MultiSelectFilter } from './MultiSelectFilter'

interface VenueFilterProps {
  venues: string[]
}

export function VenueFilter({ venues }: VenueFilterProps) {
  const { selectedVenues, toggleVenue, setSelectedVenues } = useFilterStore()

  return (
    <MultiSelectFilter
      label="Venue"
      icon="🏟️"
      options={venues}
      selectedValues={selectedVenues}
      onToggle={toggleVenue}
      onClear={() => setSelectedVenues([])}
    />
  )
}
