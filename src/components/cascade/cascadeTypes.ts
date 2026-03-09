export type FocusAtom = 'date' | 'venue' | 'artist' | null

export interface ApiService {
  name: string
  type: string
  isFallback?: boolean
}

export interface ApiTag {
  key: string
  value: string
  /** Optional data-type icon: image, audio, external link, or internal ID */
  icon?: 'image' | 'audio' | 'link' | 'id'
  /** Service name for source attribution color-tinting (Tier 3) */
  source?: string
}
