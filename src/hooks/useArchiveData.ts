// Loads the three local data files the exhibits hydrate from (concerts + artist/venue metadata)
// and exposes slug/id lookups. This is the engine of the THIN-ENVELOPE contract: the chat worker
// sends only slugs/ids, and these lookups turn them into photos, genres, counts, and map tiles —
// all from data the SPA already ships, so a card's numbers can never disagree with the site.

import { useEffect, useMemo, useState } from 'react'
import type { Concert } from '@/types/concert'

export interface ArtistMeta {
  name: string
  image?: string
  genres?: string[]
  formed?: string
}

export interface VenueMeta {
  name: string
  normalizedName: string
  cityState?: string
  location?: { lat: number; lng: number }
}

export interface ArtistFacts {
  meta: ArtistMeta | null
  shows: Concert[] // chronological
  count: number
  firstYear?: number
  lastYear?: number
  primaryGenre?: string
}

export interface VenueFacts {
  meta: VenueMeta | null
  shows: Concert[]
  count: number
  firstYear?: number
  lastYear?: number
  cityState?: string
  location?: { lat: number; lng: number }
  primaryGenre?: string
}

interface ArchiveData {
  loading: boolean
  concertById: (id: string) => Concert | null
  artistFacts: (slug: string) => ArtistFacts
  venueFacts: (slug: string) => VenueFacts
}

const byDate = (a: Concert, b: Concert) => a.date.localeCompare(b.date)

function topGenre(shows: Concert[]): string | undefined {
  if (!shows.length) return undefined
  const counts = new Map<string, number>()
  for (const c of shows) counts.set(c.genre, (counts.get(c.genre) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

// `enabled` lets a caller defer the three fetches until Ask is actually used (the provider passes
// false until the first open / the /ask route), so unrelated pages don't pay for the metadata.
export function useArchiveData(enabled = true): ArchiveData {
  const [concerts, setConcerts] = useState<Concert[] | null>(null)
  const [artists, setArtists] = useState<Record<string, ArtistMeta> | null>(null)
  const [venues, setVenues] = useState<Record<string, VenueMeta> | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    async function load() {
      const [c, a, v] = await Promise.all([
        fetch('/data/concerts.json').then((r) => r.json()),
        fetch('/data/artists-metadata.json').then((r) => r.json()),
        fetch('/data/venues-metadata.json').then((r) => r.json()),
      ])
      if (cancelled) return
      setConcerts((c.concerts ?? c) as Concert[])
      setArtists(a as Record<string, ArtistMeta>)
      setVenues(v as Record<string, VenueMeta>)
    }
    load().catch(() => {
      if (!cancelled) {
        setConcerts([])
        setArtists({})
        setVenues({})
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  // Index concerts by id and by artist/venue slug once loaded.
  const indexes = useMemo(() => {
    const byId = new Map<string, Concert>()
    const byArtist = new Map<string, Concert[]>()
    const byVenue = new Map<string, Concert[]>()
    for (const c of concerts ?? []) {
      byId.set(c.id, c)
      ;(byArtist.get(c.headlinerNormalized) ?? byArtist.set(c.headlinerNormalized, []).get(c.headlinerNormalized)!).push(c)
      ;(byVenue.get(c.venueNormalized) ?? byVenue.set(c.venueNormalized, []).get(c.venueNormalized)!).push(c)
    }
    for (const list of byArtist.values()) list.sort(byDate)
    for (const list of byVenue.values()) list.sort(byDate)
    return { byId, byArtist, byVenue }
  }, [concerts])

  const loading = concerts === null || artists === null || venues === null

  return {
    loading,
    concertById: (id) => indexes.byId.get(id) ?? null,

    artistFacts: (slug) => {
      const shows = indexes.byArtist.get(slug) ?? []
      return {
        meta: artists?.[slug] ?? null,
        shows,
        count: shows.length,
        firstYear: shows[0]?.year,
        lastYear: shows[shows.length - 1]?.year,
        primaryGenre: topGenre(shows),
      }
    },

    venueFacts: (slug) => {
      const shows = indexes.byVenue.get(slug) ?? []
      const meta = venues?.[slug] ?? null
      return {
        meta,
        shows,
        count: shows.length,
        firstYear: shows[0]?.year,
        lastYear: shows[shows.length - 1]?.year,
        cityState: meta?.cityState ?? shows[0]?.cityState,
        location: meta?.location ?? shows[0]?.location,
        primaryGenre: topGenre(shows),
      }
    },
  }
}
