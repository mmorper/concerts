/**
 * Step 3, "Putting it on the map": a venue and a city become coordinates and a photo.
 *
 * The coordinates come from Google's geocoding (cached per venue in the build), and the address
 * and photo from Google Places (scripts/enrich-venues.ts), all published in
 * public/data/venues-metadata.json. The little map plots every venue in the archive by its real
 * coordinates; nothing is drawn by hand.
 */
import { useState } from 'react'
import { analytics } from '../../../services/analytics'
import { useJson, useNearView, type VenueMeta } from './data'

const PLACE = '#6366f1'
const PINK = '#f472b6'

export const PICKS = ['the-belasco', '9-30-club', 'hollywood-bowl']

export function MapStep() {
  const [ref, near] = useNearView<HTMLElement>()
  const venues = useJson<Record<string, VenueMeta>>('/data/venues-metadata.json', near)
  const [sel, setSel] = useState(0)

  const v = venues?.[PICKS[sel]]
  const all = venues ? Object.entries(venues).filter(([, x]) => x.location) : []

  // Zoom on the chosen venue: frame it with its nearest neighbours from the archive.
  // Equirectangular around the venue (longitude scaled by cos(latitude)), so distances read true.
  const W = 900
  const H = 340
  const here = v?.location
  const kmPerDegLat = 111.32
  const k = here ? Math.cos((here.lat * Math.PI) / 180) : 1
  const offsetKm = (lat: number, lng: number) => (here ? { x: (lng - here.lng) * kmPerDegLat * k, y: (here.lat - lat) * kmPerDegLat } : { x: 0, y: 0 })
  const neighbours = here
    ? all
        .filter(([slug]) => slug !== PICKS[sel])
        .map(([slug, x]) => ({ slug, name: x.name, ...offsetKm(x.location!.lat, x.location!.lng) }))
        .map((n) => ({ ...n, d: Math.hypot(n.x, n.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 6)
    : []
  // Frame the closest few tightly (they're the interesting part); farther ones that fall outside
  // the frame are simply not drawn.
  const halfKm = Math.max(1.2, (neighbours[3]?.d ?? neighbours[neighbours.length - 1]?.d ?? 4) * 1.35)
  const scale = W / 2 / halfKm
  const px = (xKm: number) => W / 2 + xKm * scale
  const py = (yKm: number) => H / 2 + yKm * scale
  const barKm = [1, 2, 5, 10, 20, 50].find((km) => km * scale > 90) ?? 50

  // Names sit in two columns, left and right, with a thin leader back to each dot, so they stay
  // readable however close together the venues are.
  const inFrame = neighbours
    .map((n) => ({ ...n, cx: px(n.x), cy: py(n.y) }))
    .filter((n) => n.cx > 24 && n.cx < W - 24 && n.cy > 24 && n.cy < H - 40)
  const column = (side: 'left' | 'right') => {
    const list = inFrame.filter((n) => (side === 'left' ? n.cx <= W / 2 : n.cx > W / 2)).sort((a, b) => a.cy - b.cy)
    const gap = 34
    const start = H / 2 - ((list.length - 1) * gap) / 2
    const colX = side === 'left' ? 230 : W - 230
    return list.map((n, i) => ({ ...n, lx: colX, ly: start + i * gap, side }))
  }
  const labelled = [...column('left'), ...column('right')]

  return (
    <figure ref={ref} className="hiw-figure" aria-labelledby="map-cap">
      <div className="px-4 sm:px-6 pt-5">
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-ink-3)' }}>
          Pick a venue
        </div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Example venues">
          {PICKS.map((slug, i) => (
            <button
              key={slug}
              type="button"
              className="hiw-chip"
              aria-pressed={sel === i}
              onClick={() => {
                setSel(i)
                analytics.trackEvent('how_it_works_example_selected', { chapter: 'the-archive', example: slug, surface: 'map' })
              }}
            >
              {venues?.[slug]?.name ?? '…'}
              <small>{venues?.[slug]?.cityState ?? ''}</small>
            </button>
          ))}
        </div>
      </div>

      {venues === null ? (
        <p className="hiw-figcaption p-6">The venue data didn’t load just now. Try reloading the page.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1.2fr] items-center px-4 sm:px-6 pt-6" key={sel} style={{ animation: 'hiw-pop 0.35s ease both' }}>
          {/* What I typed */}
          <div className="hiw-hood p-4">
            <div className="hiw-step" style={{ fontSize: 11, color: 'var(--hiw-ink-3)' }}>
              From the spreadsheet
            </div>
            <div className="font-sans mt-2" style={{ fontSize: 17, fontWeight: 600 }}>
              {v?.name ?? '…'}
            </div>
            <div className="font-sans" style={{ fontSize: 14, color: 'var(--hiw-ink-2)' }}>
              {v?.cityState}
            </div>
            <div style={{ width: 28, height: 3, borderRadius: 2, background: PLACE, marginTop: 10 }} aria-hidden="true" />
          </div>
          <Arrow label="Google" />
          {/* What comes back */}
          <div className="hiw-hood p-4">
            <div className="hiw-step" style={{ fontSize: 11, color: 'var(--hiw-ink-3)' }}>
              What comes back
            </div>
            <div className="font-sans mt-2" style={{ fontSize: 14, color: 'var(--hiw-ink)' }}>
              {v?.places?.formattedAddress ?? '…'}
            </div>
            <div className="mt-2" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13, color: '#c7d2fe' }}>
              {v?.location ? `${v.location.lat.toFixed(4)}, ${v.location.lng.toFixed(4)}` : ''}
            </div>
            {v?.photoUrls?.thumbnail && (
              <img
                src={v.photoUrls.thumbnail}
                alt={`${v.name}, from Google Places`}
                loading="lazy"
                className="mt-3 w-full rounded-lg object-cover"
                style={{ height: 96, border: '1px solid rgba(255,255,255,0.12)' }}
              />
            )}
          </div>
          <div className="md:col-span-3">
            <Arrow label="placed on the map" down />
          </div>
          {/* Zoomed on the venue: its nearest neighbours from the archive, placed by coordinates */}
          <div className="hiw-hood p-2 md:col-span-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full hiw-svg" role="img" aria-label={`A map zoomed on ${v?.name ?? 'the venue'}, with the nearest venues from the archive: ${neighbours.map((n) => n.name).join(', ')}.`}>
              {/* A faint grid, one line per scale unit, for a sense of distance */}
              {Array.from({ length: 9 }, (_, i) => (
                <g key={i} stroke="rgba(165,180,252,0.07)">
                  <line x1={W / 2 + (i - 4) * barKm * scale} x2={W / 2 + (i - 4) * barKm * scale} y1="0" y2={H} />
                  <line y1={H / 2 + (i - 4) * barKm * scale} y2={H / 2 + (i - 4) * barKm * scale} x1="0" x2={W} />
                </g>
              ))}
              {labelled.map((n) => (
                <g key={n.slug}>
                  <polyline
                    points={`${n.cx},${n.cy} ${n.side === 'left' ? n.lx + 12 : n.lx - 12},${n.ly} ${n.lx},${n.ly}`}
                    fill="none"
                    stroke="rgba(165,180,252,0.35)"
                    strokeWidth="1"
                  />
                  <circle cx={n.cx} cy={n.cy} r="5" fill="#a5b4fc" />
                  <text x={n.side === 'left' ? n.lx - 6 : n.lx + 6} y={n.ly + 5} fontSize="14" textAnchor={n.side === 'left' ? 'end' : 'start'} fill="#c7d2fe">
                    {n.name}
                  </text>
                </g>
              ))}
              {here && (
                <g>
                  <circle cx={W / 2} cy={H / 2} r="20" fill={PINK} opacity="0.25" />
                  <circle cx={W / 2} cy={H / 2} r="8" fill={PINK} stroke="#fff" strokeWidth="2" />
                  <text x={W / 2} y={H / 2 + 38} fontSize="16" fontWeight="700" textAnchor="middle" fill="#fff">
                    {v?.name}
                  </text>
                </g>
              )}
              {/* Scale bar */}
              <g>
                <line x1="18" x2={18 + barKm * scale} y1={H - 18} y2={H - 18} stroke="#eef0ff" strokeWidth="2" />
                <text x="18" y={H - 26} fontSize="13" fill="#b9c0e8">
                  {barKm} km
                </text>
              </g>
            </svg>
            <div className="font-sans px-2 pb-1" style={{ fontSize: 12, color: 'var(--hiw-ink-3)' }}>
              The closest venues I’ve been to, placed at their real locations
            </div>
          </div>
        </div>
      )}

      <figcaption id="map-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        Nothing here is drawn by hand. Each dot is another venue from the archive, placed using the location Google sent
        back. Distances are to scale.
      </figcaption>
    </figure>
  )
}

function Arrow({ label, down = false }: { label: string; down?: boolean }) {
  return (
    <div className={`flex ${down ? '' : 'md:flex-col'} items-center justify-center gap-1 font-sans`} style={{ fontSize: 12, color: 'var(--hiw-ink-3)' }} aria-hidden="true">
      <span className={down ? '' : 'md:hidden'} style={{ color: '#a5b4fc' }}>
        ↓
      </span>
      <span className={down ? 'hidden' : 'hidden md:inline'} style={{ color: '#a5b4fc', fontSize: 18 }}>
        →
      </span>
      <span style={{ fontStyle: 'italic' }}>{label}</span>
    </div>
  )
}
