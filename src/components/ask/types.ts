import type { Concert } from '@/types/concert'
import type { ArtistFacts, VenueFacts } from '@/hooks/useArchiveData'
import type { MediaIndex } from './media'

// The hydration surface the exhibit cards draw on (subset of useArchiveData's return).
export interface ArchiveLookups {
  concertById: (id: string) => Concert | null
  concertByDate: (date: string) => Concert | null
  media: MediaIndex
  artistFacts: (slug: string) => ArtistFacts
  venueFacts: (slug: string) => VenueFacts
}
