import type { Concert } from '@/types/concert'
import type { ArtistFacts, VenueFacts } from '@/hooks/useArchiveData'

// The hydration surface the exhibit cards draw on (subset of useArchiveData's return).
export interface ArchiveLookups {
  concertById: (id: string) => Concert | null
  artistFacts: (slug: string) => ArtistFacts
  venueFacts: (slug: string) => VenueFacts
}
