/**
 * Live data for the "How the Archive Is Built" diagrams: the same published files the site reads,
 * so the examples are always today's archive. Each file is fetched once per page.
 */
import { useEffect, useRef, useState } from 'react'

export interface ConcertRow {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  genre?: string
  openers: string[]
  venue: string
  venueNormalized?: string
  city: string
  state: string
  cityState: string
  dayOfWeek?: string
  decade?: string
  year: number
  location?: { lat: number; lng: number }
}

export interface Aliases {
  sameAct: { canonical: string; name: string; billings: string[]; note?: string }[]
  sharesMember: { acts: string[]; who: string; note?: string }[]
}

const cache = new Map<string, Promise<unknown>>()
function load<T>(url: string): Promise<T | null> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
    cache.set(url, p)
  }
  return p as Promise<T | null>
}

/** undefined while loading, null if it couldn't be read. */
export function useConcerts(): ConcertRow[] | null | undefined {
  const [rows, setRows] = useState<ConcertRow[] | null | undefined>(undefined)
  useEffect(() => {
    load<{ concerts: ConcertRow[] }>('/data/concerts.json').then((d) => setRows(d ? d.concerts : null))
  }, [])
  return rows
}

export function useAliases(): Aliases | null | undefined {
  const [a, setA] = useState<Aliases | null | undefined>(undefined)
  useEffect(() => {
    load<Aliases>('/data/artist-aliases.json').then(setA)
  }, [])
  return a
}

/** "2024-12-06" → "12/6/2024": how a date reads in a US spreadsheet. */
export const sheetDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}/${d}/${y}`
}

/** True once the element has come within a screen of the viewport (then stays true). */
export function useNearView<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '100% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  return [ref, near]
}

/**
 * One of the archive's larger published files, fetched only when `enabled` (several are close
 * to 1 MB). undefined while waiting or loading, null if it couldn't be read.
 */
export function useJson<T>(url: string, enabled: boolean): T | null | undefined {
  const [v, setV] = useState<T | null | undefined>(undefined)
  useEffect(() => {
    if (!enabled) return
    let live = true
    load<T>(url).then((d) => live && setV(d))
    return () => {
      live = false
    }
  }, [url, enabled])
  return v
}

export interface VenueMeta {
  name: string
  cityState: string
  location?: { lat: number; lng: number }
  places?: { formattedAddress?: string }
  photoUrls?: { thumbnail?: string; medium?: string }
  stats?: { totalConcerts?: number }
}
export interface ArtistMeta {
  name: string
  image?: string
  source?: 'theaudiodb' | 'deezer' | 'lastfm' | 'manual'
}
export interface TopTracks {
  name: string
  source?: string
  tracks?: { name: string; previewUrl?: string; albumName?: string; albumArt?: string }[]
}
