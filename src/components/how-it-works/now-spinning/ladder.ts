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
  /**
   * What Shazam sends with the song: the album and its cover. The TV uses the archive's album when
   * the archive has one, and these otherwise, so the example looks as it would on the TV.
   * Covers are iTunes artwork at 600 × 600, from the archive's album-covers.json where it has them.
   */
  album?: string
  artworkUrl?: string
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
  {
    artist: 'Depeche Mode',
    title: 'Barrel of a Gun',
    label: 'Barrel of a Gun',
    album: 'Ultra',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/24/74/1a/24741aaa-419f-7f83-691e-c07e6e1fd0e5/0724347387258.jpg/600x600bb.jpg',
    expect: 'seen',
    wording: 'never',
  },
  {
    artist: 'Oingo Boingo',
    title: 'Weird Science',
    label: 'Weird Science',
    album: 'Dead Man’s Party',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/be/5b/14/be5b14fc-5480-81cc-53a1-59f98f185f2b/06UMGIM03141.rgb.jpg/600x600bb.jpg',
    expect: 'seen',
    wording: 'maybe',
  },
  {
    artist: 'Fleetwood Mac',
    title: 'Dreams',
    label: 'Dreams',
    album: 'Rumours',
    // Not in the archive (no Fleetwood Mac show), so this one is from the iTunes Search API.
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg',
    expect: 'none',
  },
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
