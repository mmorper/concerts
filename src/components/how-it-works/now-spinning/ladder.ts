/**
 * The Honesty Ladder's logic: which rung a real lookup lands on.
 *
 * The page runs the TV's own lookup (`workers/now-spinning/src/identify.ts`) in the browser,
 * against the same published index the Worker reads (`/data/now-spinning/`, built by
 * `npm run build`). So every example answer is what the TV would say tonight, never copy
 * written for this page.
 */
import { lookup, unknownTrack, type Loader } from '../../../../workers/now-spinning/src/identify'
import type { Track, TrackInput } from '../../../../workers/now-spinning/src/types'

export type RungId = 'unknown' | 'heard' | 'seen-cover' | 'seen' | 'cover-of-this' | 'covers' | 'none'
export type SeenWording = 'near' | 'never' | 'maybe'

/** The order the screen asks its questions in, and stops at the first yes (spec §Screen states). */
export const RUNG_ORDER: RungId[] = ['unknown', 'heard', 'seen-cover', 'seen', 'cover-of-this', 'covers', 'none']

export interface Example {
  artist: string
  title: string
  /** Short chip label. */
  label: string
  /** The rung this example is chosen to show. A test checks it against the real data. */
  expect: RungId
  wording?: SeenWording
}

/**
 * Four records, chosen to tell the honesty story: one I heard, two bands I saw whose setlists don't
 * have the song (one with every setlist, one with a night missing), and one never in the archive.
 */
export const EXAMPLES: Example[] = [
  { artist: 'Royal Blood', title: 'Out of the Black', label: 'Out of the Black', expect: 'heard' },
  { artist: 'Depeche Mode', title: 'Barrel of a Gun', label: 'Barrel of a Gun', expect: 'seen', wording: 'never' },
  { artist: 'Oingo Boingo', title: 'Weird Science', label: 'Weird Science', expect: 'seen', wording: 'maybe' },
  { artist: 'Fleetwood Mac', title: 'Dreams', label: 'Dreams', expect: 'none' },
]

/** Which of the `seen` screen's three wordings a track uses. Mirrors identify.ts's `seen` branch. */
export function seenWording(t: Track): SeenWording {
  if (t.lines.some((l) => l.startsWith('Something close'))) return 'near'
  if (t.headline.includes('never heard this one live')) return 'never'
  return 'maybe'
}

export function rungOf(t: Track): { rung: RungId; wording?: SeenWording } {
  return t.screen === 'seen' ? { rung: 'seen', wording: seenWording(t) } : { rung: t.screen }
}

/**
 * Reads the published index. Anything that isn't JSON comes back null: a missing file on this
 * site is served as the app's HTML with status 200, and the manifest is what decides what exists.
 */
export function siteLoader(base = '/data/now-spinning/'): Loader {
  const cache = new Map<string, Promise<unknown | null>>()
  return (path) => {
    let p = cache.get(path)
    if (!p) {
      p = fetch(base + path)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      cache.set(path, p)
    }
    return p
  }
}

export async function ask(input: TrackInput, load: Loader): Promise<Track> {
  try {
    return await lookup(input, load)
  } catch {
    return unknownTrack(input)
  }
}
