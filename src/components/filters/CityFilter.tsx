import { useFilterStore } from '@/store/useFilterStore'
import { MultiSelectFilter } from './MultiSelectFilter'

interface CityFilterProps {
  cities: string[]
}

export function CityFilter({ cities }: CityFilterProps) {
  const { selectedCities, toggleCity, setSelectedCities } = useFilterStore()

  return (
    <MultiSelectFilter
      label="City"
      icon="📍"
      options={cities}
      selectedValues={selectedCities}
      onToggle={toggleCity}
      onClear={() => setSelectedCities([])}
    />
  )
}
