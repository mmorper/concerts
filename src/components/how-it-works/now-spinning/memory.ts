/**
 * The Memory diagram's data: what the archive does with a song name, from the live index.
 *
 * It uses the same matching rules as the TV (workers/now-spinning/src/match.ts, which uses the
 * repo's scripts/utils/song-title.ts and act-name.ts), and the same published index the Worker
 * reads. The count it shows comes from the TV's own lookup, so the diagram can't disagree with
 * the screen. A test checks that the nights this marks as heard add up to that count.
 */
import { actKeysFor, foldSongTitle, titleKeys } from '../../../../workers/now-spinning/src/match'
import type { Loader } from '../../../../workers/now-spinning/src/identify'
import type { ActFile, Manifest, Track } from '../../../../workers/now-spinning/src/types'
import { ask } from './ladder'

export const MEMORY_EXAMPLE = { artist: 'Depeche Mode', title: 'Everything Counts (Remastered 2006)' }

export interface MemoryNight {
  date: string
  venue: string
  hasSetlist: boolean
  heard: boolean
}

export interface Memory {
  /** The tidied title and act name the archive compares. */
  titleKey: string
  actKey: string
  /** Every night the act was seen, oldest first. */
  nights: MemoryNight[]
  /** The TV's answer for the same song. */
  track: Track
}

export async function memoryOf(input: { artist: string; title: string }, load: Loader): Promise<Memory | null> {
  const [track, manifest] = await Promise.all([ask(input, load), load('manifest.json') as Promise<Manifest | null>])
  if (!manifest || track.screen === 'unknown') return null
  const actKey = actKeysFor(input.artist).find((k) => manifest.acts[k])
  if (!actKey) return null
  const act = (await load(`acts/${manifest.acts[actKey]}.json`)) as ActFile | null
  if (!act || !Array.isArray(act.nights)) return null

  const keys = new Set(titleKeys(input.title))
  const heardOn = new Set<number>()
  for (const s of act.songs) if (s.k.some((k) => keys.has(k))) s.on.forEach((i) => heardOn.add(i))

  return {
    titleKey: foldSongTitle(input.title),
    actKey,
    nights: act.nights.map((n, i) => ({ date: n.d, venue: n.venue, hasSetlist: n.setlist, heard: heardOn.has(i) })),
    track,
  }
}

/** Concert dates for the faint background of the timeline: every show in the archive. */
export async function allConcertDates(): Promise<string[]> {
  try {
    const r = await fetch('/data/concerts.json')
    if (!r.ok) return []
    const d = (await r.json()) as { concerts?: { date: string }[] }
    return (d.concerts ?? []).map((c) => c.date)
  } catch {
    return []
  }
}
