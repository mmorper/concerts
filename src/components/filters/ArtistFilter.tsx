import { useFilterStore } from '@/store/useFilterStore'
import { MultiSelectFilter } from './MultiSelectFilter'

interface ArtistFilterProps {
  artists: string[]
}

export function ArtistFilter({ artists }: ArtistFilterProps) {
  const { selectedArtists, toggleArtist, setSelectedArtists } = useFilterStore()

  return (
    <MultiSelectFilter
      label="Artist"
      icon="🎤"
      options={artists}
      selectedValues={selectedArtists}
      onToggle={toggleArtist}
      onClear={() => setSelectedArtists([])}
    />
  )
}
