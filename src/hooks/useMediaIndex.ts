/**
 * useMediaIndex — the owner's photographs, indexed by night and by act
 *
 * Fetches /data/media-index.json once (module-level cache), the same way
 * useLinerNotesCount does, so opening a second gatefold costs nothing. Ask the
 * Archive keeps its own copy in useArchiveData because that load is gated on the
 * chat being opened; the Artist scene cannot wait for that.
 */

import { useEffect, useState } from 'react'
import { buildMediaIndex, EMPTY_MEDIA, withCanonicalActs, type MediaAsset, type MediaIndex } from '../components/ask/media'
import { buildArtistAliasMap, canonicalArtist, EMPTY_ARTIST_ALIAS_MAP } from '../utils/artistAliases'

let cachedIndex: MediaIndex | null = null
let fetchPromise: Promise<MediaIndex> | null = null

async function getMediaIndex(): Promise<MediaIndex> {
  if (cachedIndex) return cachedIndex
  if (fetchPromise) return fetchPromise

  // A card merges an act's billings (#227), so photos filed under one billing have to answer to
  // the card's name, or those nights show no Photos link. Failing to load only keeps them apart.
  const aliases = fetch('/data/artist-aliases.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data ? buildArtistAliasMap(data) : EMPTY_ARTIST_ALIAS_MAP))
    .catch(() => EMPTY_ARTIST_ALIAS_MAP)

  fetchPromise = fetch('/data/media-index.json')
    .then((res) => {
      if (!res.ok) throw new Error('media-index.json not found')
      return res.json() as Promise<{ assets?: MediaAsset[] }>
    })
    .then(async (data) => {
      const map = await aliases
      cachedIndex = buildMediaIndex(withCanonicalActs(data.assets, (slug) => canonicalArtist(map, slug)))
      fetchPromise = null
      return cachedIndex
    })
    .catch((err) => {
      fetchPromise = null
      throw err
    })

  return fetchPromise
}

/**
 * Returns the media index, empty until it loads and if it fails to load. A failed
 * load only means no Photos links appear, so it is never surfaced as an error.
 *
 * @param enabled — load only once something is going to show a photo
 */
export function useMediaIndex(enabled: boolean): MediaIndex {
  const [index, setIndex] = useState<MediaIndex>(cachedIndex ?? EMPTY_MEDIA)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getMediaIndex()
      .then((ix) => {
        if (!cancelled) setIndex(ix)
      })
      .catch(() => {
        /* no photos, no links */
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return index
}
