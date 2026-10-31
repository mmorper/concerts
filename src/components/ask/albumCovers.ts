// The build-time iTunes covers (public/data/album-covers.json, from
// scripts/resolve-album-covers.ts), loaded once per page and shared by every sleeve.
//
// A module store rather than ArchiveLookups because CoverArt is drawn from a dozen places
// across five cards; threading a lookup through each would be noise. Until the file
// arrives `useAlbumCover` reports `loading`, and CoverArt holds the derived sleeve rather
// than firing Cover Art Archive requests that the iTunes URL would make pointless.

import { useEffect, useSyncExternalStore } from 'react'

type Covers = Record<string, string>
let covers: Covers | null = null
let started = false
const listeners = new Set<() => void>()

function settle(next: Covers) {
  covers = next
  listeners.forEach((l) => l())
}

/** Start the fetch (idempotent). A missing or broken file is just "no iTunes covers". */
export function loadAlbumCovers(): void {
  if (started) return
  started = true
  fetch('/data/album-covers.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((d: { covers?: Covers }) => settle(d.covers ?? {}))
    .catch(() => settle({}))
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => covers

/** This album's iTunes `artworkUrl100`; `undefined` while the file is still loading. */
export function useAlbumCover(mbid: string): string | null | undefined {
  useEffect(loadAlbumCovers, [])
  const all = useSyncExternalStore(subscribe, snapshot, snapshot)
  return all === null ? undefined : (all[mbid] ?? null)
}

/** Tests only. */
export function __setAlbumCovers(next: Covers | null): void {
  covers = next
  started = next !== null
  listeners.forEach((l) => l())
}
