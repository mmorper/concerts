/**
 * Step 5, "The sound": every band gets a few 30-second previews and their album art.
 *
 * scripts/enrich-top-tracks.ts asks Apple Music first and Deezer as the backup; the results are
 * public/data/artists-top-tracks.json, which this reads live. The previews play from Apple's
 * servers, exactly as they do on the artist pages.
 */
import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { analytics } from '../../../services/analytics'
import { useJson, useNearView, type TopTracks } from './data'

export const PICKS = ['social-distortion', 'depeche-mode', 'royal-blood']

export function SoundStep() {
  const [ref, near] = useNearView<HTMLElement>()
  const tops = useJson<Record<string, TopTracks>>('/data/artists-top-tracks.json', near)
  const [sel, setSel] = useState(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  // Stop on unmount, and when the band changes.
  useEffect(() => () => audio.current?.pause(), [])
  useEffect(() => {
    audio.current?.pause()
    setPlaying(null)
  }, [sel])

  const band = tops?.[PICKS[sel]]
  const tracks = (band?.tracks ?? []).filter((t) => t.previewUrl).slice(0, 3)
  const withPreviews = tops ? Object.values(tops).filter((b) => b.tracks?.some((t) => t.previewUrl)).length : 0
  const bySource = tops
    ? Object.values(tops).reduce<Record<string, number>>((acc, b) => {
        const k = b.source ?? 'other'
        acc[k] = (acc[k] ?? 0) + 1
        return acc
      }, {})
    : {}

  const toggle = (url: string, name: string) => {
    if (playing === url) {
      audio.current?.pause()
      setPlaying(null)
      return
    }
    audio.current?.pause()
    const a = new Audio(url)
    a.onended = () => setPlaying(null)
    a.play().catch(() => setPlaying(null))
    audio.current = a
    setPlaying(url)
    analytics.trackEvent('how_it_works_preview_played', { chapter: 'the-archive', artist: PICKS[sel], track: name })
  }

  return (
    <figure ref={ref} className="hiw-figure" aria-labelledby="sound-cap">
      <div className="px-4 sm:px-6 pt-5">
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-ink-3)' }}>
          Pick a band
        </div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Example bands">
          {PICKS.map((slug, i) => (
            <button
              key={slug}
              type="button"
              className="hiw-chip"
              aria-pressed={sel === i}
              onClick={() => {
                setSel(i)
                analytics.trackEvent('how_it_works_example_selected', { chapter: 'the-archive', example: slug, surface: 'sound' })
              }}
            >
              {tops?.[slug]?.name ?? '…'}
            </button>
          ))}
        </div>
      </div>

      {tops === null ? (
        <p className="hiw-figcaption p-6">The previews didn’t load just now. Try reloading the page.</p>
      ) : (
        <ul className="grid gap-2 px-4 sm:px-6 pt-5" style={{ listStyle: 'none' }} key={sel}>
          {tracks.map((t, i) => {
            const on = playing === t.previewUrl
            return (
              <li key={t.name} style={{ animation: `hiw-pop 0.35s ease ${i * 0.06}s both` }}>
                <button
                  type="button"
                  onClick={() => toggle(t.previewUrl!, t.name)}
                  aria-pressed={on}
                  aria-label={`${on ? 'Pause' : 'Play'} a preview of ${t.name}`}
                  className="hiw-hood w-full flex items-center gap-3 text-left"
                  style={{ padding: '10px 12px', borderColor: on ? 'rgba(244,114,182,0.6)' : undefined }}
                >
                  {t.albumArt ? (
                    <img src={t.albumArt} alt="" loading="lazy" className="rounded-md" style={{ width: 44, height: 44, flex: 'none' }} />
                  ) : (
                    <span className="rounded-md" style={{ width: 44, height: 44, flex: 'none', background: '#1e1b4b' }} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans truncate" style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--hiw-ink)' }}>
                      {t.name}
                    </span>
                    <span className="block font-sans truncate" style={{ fontSize: 13, color: 'var(--hiw-ink-3)' }}>
                      {t.albumName}
                    </span>
                  </span>
                  <span className="grid place-items-center rounded-full" style={{ width: 36, height: 36, flex: 'none', background: on ? '#f472b6' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }} aria-hidden="true">
                    {on ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <figcaption id="sound-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        {tops
          ? `Live: ${withPreviews} bands in the archive have previews. ${bySource.itunes ?? 0} came from Apple Music${bySource.deezer ? `, ${bySource.deezer} from Deezer` : ', and none so far have needed the Deezer backup'}.`
          : 'Asking the archive…'}
      </figcaption>
    </figure>
  )
}
