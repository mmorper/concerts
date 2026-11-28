/**
 * Step 6, "The setlists": what a band played on a night I was there, song by song, each matched
 * to the album it comes from.
 *
 * Setlists are pre-fetched from setlist.fm (scripts/prefetch-setlists.ts → setlists-cache.json).
 * Songs are matched to albums by scripts/resolve-song-albums.ts (song-albums.json), looked up here
 * with the same helper the site uses (scripts/utils/song-album-lookup.ts). A cover credits the
 * original per setlist.fm, and is filed under the album the band itself recorded it on.
 */
import { useState } from 'react'
import { lookupSongAlbum } from '../../../../scripts/utils/song-album-lookup.js'
import { analytics } from '../../../services/analytics'
import { sheetDate, useJson, useNearView, type ArtistMeta } from './data'

interface SetlistSong {
  name: string
  tape?: boolean
  cover?: { name?: string }
}
interface SetlistEntry {
  concertId: string
  artistName: string
  date: string
  venue: string
  setlist?: { sets?: { set?: { song?: SetlistSong[]; encore?: number }[] } }
}
interface SongAlbum {
  albumTitle?: string
  releaseDate?: string
}

export const PICKS = [
  { artist: 'Social Distortion', date: '2024-12-06' },
  { artist: 'Depeche Mode', date: '2023-03-28' },
  { artist: 'Royal Blood', date: '2015-06-10' },
]

export function SetlistStep() {
  const [ref, near] = useNearView<HTMLElement>()
  const cache = useJson<{ entries: SetlistEntry[] }>('/data/setlists-cache.json', near)
  const albums = useJson<{ songs: Record<string, SongAlbum> }>('/data/song-albums.json', near)
  const meta = useJson<Record<string, ArtistMeta>>('/data/artists-metadata.json', near)
  const [sel, setSel] = useState(0)

  const pick = PICKS[sel]
  const entry = cache?.entries.find((e) => e.date === pick.date && e.artistName === pick.artist)
  const sets = (entry?.setlist?.sets?.set ?? []).map((s) => ({ encore: !!s.encore, songs: (s.song ?? []).filter((x) => !x.tape && x.name) }))
  const albumOf = (song: string) =>
    lookupSongAlbum<SongAlbum>(albums?.songs, pick.artist, song, { artistsMetadata: meta })
  const total = sets.reduce((n, s) => n + s.songs.length, 0)
  const matched = sets.reduce((n, s) => n + s.songs.filter((x) => albumOf(x.name)).length, 0)
  const nights = cache?.entries.length ?? 0
  const withSongs = cache?.entries.filter((e) => (e.setlist?.sets?.set ?? []).some((s) => (s.song ?? []).length)).length ?? 0
  const loading = cache === undefined || albums === undefined

  return (
    <figure ref={ref} className="hiw-figure" aria-labelledby="sl-cap">
      <div className="px-4 sm:px-6 pt-5">
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-ink-3)' }}>
          Pick a night
        </div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Example nights">
          {PICKS.map((p, i) => (
            <button
              key={p.date}
              type="button"
              className="hiw-chip"
              aria-pressed={sel === i}
              onClick={() => {
                setSel(i)
                analytics.trackEvent('how_it_works_example_selected', { chapter: 'the-archive', example: `${p.artist} ${p.date}`, surface: 'setlist' })
              }}
            >
              {p.artist}
              <small>{sheetDate(p.date)}</small>
            </button>
          ))}
        </div>
      </div>

      {cache === null || albums === null ? (
        <p className="hiw-figcaption p-6">The setlists didn’t load just now. Try reloading the page.</p>
      ) : (
        <div className="px-4 sm:px-6 pt-5" key={sel} style={{ animation: 'hiw-pop 0.35s ease both' }}>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hiw-panel-line)' }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--hiw-line)' }}>
              <span className="font-sans" style={{ fontSize: 15, fontWeight: 600 }}>
                {pick.artist} · {entry?.venue ?? '…'}
              </span>
              <span className="font-sans" style={{ fontSize: 13, color: 'var(--hiw-ink-3)' }}>
                {sheetDate(pick.date)} · from setlist.fm
              </span>
            </div>
            <ol className="sm:columns-2 gap-6 px-4 py-3 font-sans" style={{ listStyle: 'none', fontSize: 14 }}>
              {sets.flatMap((s, si) => [
                ...(s.encore ? [<li key={`enc-${si}`} className="hiw-step pt-2 pb-1" style={{ fontSize: 11, color: 'var(--hiw-ink-3)', breakInside: 'avoid' }}>Encore</li>] : []),
                ...s.songs.map((song, i) => {
                  const a = albumOf(song.name)
                  return (
                    <li key={`${si}-${i}`} className="flex items-baseline justify-between gap-3 py-1" style={{ breakInside: 'avoid', borderBottom: '1px solid rgba(165,180,252,0.08)' }}>
                      <span style={{ color: 'var(--hiw-ink)' }}>
                        {song.name}
                        {song.cover?.name && (
                          <span className="ml-2 rounded px-1.5 py-0.5" style={{ fontSize: 11, color: '#f9a8d4', background: 'rgba(244,114,182,0.12)' }}>
                            {song.cover.name} cover
                          </span>
                        )}
                      </span>
                      <span className="text-right" style={{ color: a ? 'var(--hiw-ink-3)' : 'rgba(129,137,181,0.5)', fontSize: 12.5, fontStyle: 'italic' }}>
                        {a ? `${a.albumTitle}${a.releaseDate ? `, ${a.releaseDate.slice(0, 4)}` : ''}` : 'no album found'}
                      </span>
                    </li>
                  )
                }),
              ])}
            </ol>
          </div>
        </div>
      )}

      <figcaption id="sl-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        {loading
          ? 'Asking the archive…'
          : `${matched} of these ${total} songs are matched to an album. Across the archive, setlist.fm has a setlist for ${withSongs} of ${nights} band performances. For the rest, the site shows no setlist rather than a guess.`}
      </figcaption>
    </figure>
  )
}
