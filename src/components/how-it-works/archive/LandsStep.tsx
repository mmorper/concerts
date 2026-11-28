/**
 * "Where it all lands": pick any concert in the archive and watch its row become the site —
 * a dot on the timeline, a pin on the map, a face and a sound, a setlist — each linking into the
 * real scene (links built with src/utils/deepLinks.ts, as everywhere).
 *
 * This replaces the old interactive cascade's "try any concert", in the chapter's visual language.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { analytics } from '../../../services/analytics'
import { artistDeepLink, setlistDeepLink, timelineYearDeepLink, venueMapDeepLink } from '../../../utils/deepLinks'
import { sheetDate, useConcerts, useJson, useNearView, type ArtistMeta, type ConcertRow, type TopTracks, type VenueMeta } from './data'
import { ledgerFor, type FactData } from './facts'

const PINK = '#f472b6'
const DEFAULT = '2024-12-06'

interface SetlistEntry {
  date: string
  artistName: string
  setlist?: { sets?: { set?: { song?: { name: string; tape?: boolean }[] }[] } }
}

export function LandsStep({ data }: { data?: FactData | null }) {
  const [ref, near] = useNearView<HTMLElement>()
  const concerts = useConcerts()
  const venues = useJson<Record<string, VenueMeta>>('/data/venues-metadata.json', near)
  const meta = useJson<Record<string, ArtistMeta>>('/data/artists-metadata.json', near)
  const tops = useJson<Record<string, TopTracks>>('/data/artists-top-tracks.json', near)
  const sets = useJson<{ entries: SetlistEntry[] }>('/data/setlists-cache.json', near)
  const [query, setQuery] = useState('')
  const [date, setDate] = useState(DEFAULT)

  const today = new Date().toISOString().slice(0, 10)
  const past = useMemo(() => (concerts ?? []).filter((c) => c.date <= today), [concerts, today])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return past
      .filter((c) => `${c.headliner} ${c.venue} ${c.city} ${c.year} ${c.openers.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6)
  }, [past, query])

  const c: ConcertRow | undefined = past.find((x) => x.date === date)
  const venueSlug = c?.venueNormalized
  const v = venueSlug ? venues?.[venueSlug] : undefined
  const a = c ? meta?.[c.headlinerNormalized] : undefined
  const track = c ? tops?.[c.headlinerNormalized]?.tracks?.find((t) => t.previewUrl) : undefined
  const setlist = c ? sets?.entries.find((e) => e.date === c.date && e.artistName === c.headliner) : undefined
  const songs = (setlist?.setlist?.sets?.set ?? []).flatMap((s) => s.song ?? []).filter((s) => !s.tape && s.name)
  const ledger = useMemo(() => (c && data ? ledgerFor(c, data) : undefined), [c, data])
  const shows = c ? (concerts ?? []).filter((x) => x.headlinerNormalized === c.headlinerNormalized && x.date <= today).length : 0

  // Timeline: shows per year, this year lit
  const perYear = useMemo(() => {
    const m = new Map<number, number>()
    for (const x of past) m.set(x.year, (m.get(x.year) ?? 0) + 1)
    return m
  }, [past])
  const years = [...perYear.keys()].sort((x, y) => x - y)
  const y0 = years[0] ?? 1984
  const y1 = years[years.length - 1] ?? 2026

  // Map: every venue by its coordinates, this one lit
  const pts = venues ? Object.values(venues).filter((x) => x.location) : []
  const la = pts.map((x) => x.location!.lat)
  const ln = pts.map((x) => x.location!.lng)
  const [minLa, maxLa, minLn, maxLn] = [Math.min(...la), Math.max(...la), Math.min(...ln), Math.max(...ln)]
  const mx = (lng: number) => 10 + ((lng - minLn) / (maxLn - minLn || 1)) * 280
  const my = (lat: number) => 10 + ((maxLa - lat) / (maxLa - minLa || 1)) * 120

  const choose = (x: ConcertRow) => {
    setDate(x.date)
    setQuery('')
    analytics.trackEvent('how_it_works_example_selected', { chapter: 'the-archive', example: `${x.headliner} ${x.date}`, surface: 'lands' })
  }

  return (
    <figure ref={ref} className="hiw-figure" aria-labelledby="lands-cap">
      <div className="px-4 sm:px-6 pt-5">
        <label htmlFor="lands-q" className="hiw-step block mb-3" style={{ color: 'var(--hiw-ink-3)' }}>
          Try any concert
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color="#8189b5" aria-hidden="true" />
          <input
            id="lands-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A band, a venue, a city or a year"
            autoComplete="off"
            className="w-full font-sans rounded-xl pl-9 pr-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hiw-panel-line)', color: 'var(--hiw-ink)', fontSize: 15 }}
          />
        </div>
        {matches.length > 0 && (
          <ul className="mt-2 grid gap-1" style={{ listStyle: 'none' }}>
            {matches.map((x) => (
              <li key={x.date}>
                <button type="button" onClick={() => choose(x)} className="hiw-chip w-full flex justify-between gap-3">
                  <span>{x.headliner}</span>
                  <span style={{ color: 'var(--hiw-ink-3)', fontSize: 13 }}>
                    {x.venue} · {sheetDate(x.date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && matches.length === 0 && (
          <p className="font-sans mt-2" style={{ fontSize: 14, color: 'var(--hiw-ink-3)' }}>
            Nothing in the archive matches that.
          </p>
        )}
      </div>

      {c && (
        <div className="px-4 sm:px-6 pt-5">
          <div className="font-sans" style={{ fontSize: 15, color: 'var(--hiw-ink-2)' }}>
            <span style={{ color: 'var(--hiw-ink)', fontWeight: 600 }}>{c.headliner}</span> · {c.venue}, {c.cityState} · {sheetDate(c.date)}
          </div>
          {ledger && (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center mt-4 font-sans" key={`t-${c.date}`} style={{ animation: 'hiw-pop 0.4s ease both' }}>
              <Total n={ledger.typed} label="typed into the sheet" />
              <span className="hidden sm:inline" style={{ color: 'var(--hiw-lav)', fontSize: 20 }} aria-hidden="true">
                →
              </span>
              <Total n={ledger.total} label="facts the site knows about this night" accent />
              <p className="col-span-2" style={{ fontSize: 14, color: 'var(--hiw-ink-3)', lineHeight: 1.45, flex: '1 1 200px' }}>
                {ledger.songs
                  ? 'Pick another concert and the numbers change.'
                  : 'No setlist exists for this night, so it has fewer facts. Older shows often don’t.'}
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 mt-3" key={c.date}>
            {/* Timeline */}
            <Panel count={ledger?.groups.timeline} title="On the timeline" to={timelineYearDeepLink(c.year)} delay={0}>
              <svg viewBox="0 0 300 70" className="block w-full hiw-svg" aria-hidden="true">
                {years.map((yr) => {
                  const x = 10 + ((yr - y0) / (y1 - y0 || 1)) * 280
                  const r = 1.5 + Math.sqrt(perYear.get(yr) ?? 0) * 1.6
                  const on = yr === c.year
                  return <circle key={yr} cx={x} cy={38} r={on ? r + 2 : r} fill={on ? PINK : '#a5b4fc'} fillOpacity={on ? 1 : 0.4} />
                })}
                <text x={10 + ((c.year - y0) / (y1 - y0 || 1)) * 280} y={18} fontSize="12" fontWeight="600" textAnchor="middle" fill="#fff">
                  {c.year}
                </text>
              </svg>
              <Note>
                {perYear.get(c.year)} {perYear.get(c.year) === 1 ? 'show' : 'shows'} that year
              </Note>
            </Panel>

            {/* Map */}
            <Panel count={ledger?.groups.map} title="On the map" to={venueSlug ? venueMapDeepLink(venueSlug) : undefined} delay={0.08}>
              <svg viewBox="0 0 300 140" className="block w-full hiw-svg" aria-hidden="true">
                {pts.map((p, i) => (
                  <circle key={i} cx={mx(p.location!.lng)} cy={my(p.location!.lat)} r={2.4} fill="#a5b4fc" fillOpacity="0.4" />
                ))}
                {v?.location && (
                  <>
                    <circle cx={mx(v.location.lng)} cy={my(v.location.lat)} r={10} fill={PINK} opacity={0.3} />
                    <circle cx={mx(v.location.lng)} cy={my(v.location.lat)} r={4.5} fill={PINK} stroke="#fff" strokeWidth="1.2" />
                  </>
                )}
              </svg>
              <Note>{v?.places?.formattedAddress ?? (venues === undefined ? '…' : 'No address on file')}</Note>
            </Panel>

            {/* The band */}
            <Panel count={ledger?.groups.band} title="The band" to={artistDeepLink(c.headlinerNormalized)} delay={0.16}>
              <div className="flex items-center gap-3">
                {a?.image ? (
                  <img src={a.image} alt="" loading="lazy" className="rounded-lg object-cover" style={{ width: 64, height: 64, border: '1px solid rgba(255,255,255,0.14)' }} />
                ) : (
                  <span className="rounded-lg" style={{ width: 64, height: 64, background: '#1e1b4b' }} />
                )}
                <div className="min-w-0">
                  <div className="font-sans" style={{ fontSize: 16, fontWeight: 600 }}>
                    {a?.name ?? c.headliner}
                  </div>
                  <Note>
                    {shows === 1 ? 'Seen once' : `Seen ${shows} times`}
                    {track ? ` · preview: “${track.name}”` : ''}
                  </Note>
                </div>
              </div>
            </Panel>

            {/* The setlist */}
            <Panel count={ledger?.groups.setlist} title="The setlist" to={songs.length ? setlistDeepLink(c.headlinerNormalized, c.date) : undefined} delay={0.24}>
              {sets === undefined ? (
                <Note>…</Note>
              ) : songs.length ? (
                <>
                  <ol className="font-sans" style={{ listStyle: 'none', fontSize: 14, color: 'var(--hiw-ink)' }}>
                    {songs.slice(0, 3).map((s, i) => (
                      <li key={i} className="truncate">
                        {i + 1}. {s.name}
                      </li>
                    ))}
                  </ol>
                  <Note>{songs.length > 3 ? `and ${songs.length - 3} more` : `${songs.length} songs`}</Note>
                </>
              ) : (
                <Note>setlist.fm has no setlist for this night, so the site doesn’t show one.</Note>
              )}
            </Panel>
          </div>
        </div>
      )}

      <figcaption id="lands-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        One row in the spreadsheet ends up in four places on the site. Use “Open” to go to each one.
      </figcaption>
    </figure>
  )
}

function Panel({ title, count, to, delay, children }: { title: string; count?: number; to?: string; delay: number; children: React.ReactNode }) {
  return (
    <div className="hiw-hood p-4 flex flex-col gap-2" style={{ animation: `hiw-pop 0.4s ease ${delay}s both` }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="hiw-step" style={{ fontSize: 11, color: 'var(--hiw-ink-3)' }}>
          {title}
          {count !== undefined && (
            <span style={{ color: 'var(--hiw-dot)', marginLeft: 8, letterSpacing: 0 }}>
              {count} {count === 1 ? 'fact' : 'facts'}
            </span>
          )}
        </span>
        {to && (
          <Link
            to={to}
            className="font-sans"
            style={{ fontSize: 13, color: 'var(--hiw-lav)' }}
            onClick={() => analytics.trackEvent('how_it_works_deep_link_clicked', { chapter: 'the-archive', panel: title })}
          >
            Open →
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function Total({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl px-4 py-2 text-center" style={{ border: `1px solid ${accent ? 'rgba(244,114,182,0.5)' : 'var(--hiw-panel-line)'}` }}>
      <b className="block" style={{ fontSize: 30, lineHeight: 1.1, color: accent ? 'var(--hiw-dot)' : 'var(--hiw-ink)', fontVariantNumeric: 'tabular-nums' }}>
        {n}
      </b>
      <span style={{ fontSize: 12.5, color: 'var(--hiw-ink-3)' }}>{label}</span>
    </div>
  )
}

const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="font-sans" style={{ fontSize: 13, color: 'var(--hiw-ink-3)', lineHeight: 1.45 }}>
    {children}
  </div>
)
