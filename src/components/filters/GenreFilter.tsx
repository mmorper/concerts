import { useFilterStore } from '@/store/useFilterStore'
import { MultiSelectFilter } from './MultiSelectFilter'

interface GenreFilterProps {
  genres: string[]
}

export function GenreFilter({ genres }: GenreFilterProps) {
  const { selectedGenres, toggleGenre, setSelectedGenres } = useFilterStore()

  return (
    <MultiSelectFilter
      label="Genre"
      icon="🎸"
      options={genres}
      selectedValues={selectedGenres}
      onToggle={toggleGenre}
      onClear={() => setSelectedGenres([])}
    />
  )
}
