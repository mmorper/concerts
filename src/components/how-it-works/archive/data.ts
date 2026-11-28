/**
 * Live data for the "How the Archive Is Built" diagrams: the same published files the site reads,
 * so the examples are always today's archive. Each file is fetched once per page.
 */
import { useEffect, useState } from 'react'

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
