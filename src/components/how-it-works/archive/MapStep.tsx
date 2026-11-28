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
  const lats = all.map(([, x]) => x.location!.lat)
  const lngs = all.map(([, x]) => x.location!.lng)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const W = 400
  const H = 220
  const pad = 18
  const px = (lng: number) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - pad * 2)
  const py = (lat: number) => pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - pad * 2)

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
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1.3fr] items-center px-4 sm:px-6 pt-6" key={sel} style={{ animation: 'hiw-pop 0.35s ease both' }}>
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
          <Arrow label="plotted" />
          {/* Every venue, by its real coordinates */}
          <div className="hiw-hood p-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full hiw-svg" role="img" aria-label={`Every venue in the archive plotted by its coordinates, with ${v?.name ?? 'the venue'} highlighted.`}>
              {all.map(([slug, x]) => (
                <circle key={slug} cx={px(x.location!.lng)} cy={py(x.location!.lat)} r={3} fill="#a5b4fc" fillOpacity="0.45" />
              ))}
              {v?.location && (
                <g>
                  <circle cx={px(v.location.lng)} cy={py(v.location.lat)} r="14" fill={PINK} opacity="0.25" />
                  <circle cx={px(v.location.lng)} cy={py(v.location.lat)} r="6" fill={PINK} stroke="#fff" strokeWidth="1.5" />
                </g>
              )}
            </svg>
            <div className="font-sans px-2 pb-1" style={{ fontSize: 12, color: 'var(--hiw-ink-3)' }}>
              All {all.length} venues, placed by their coordinates
            </div>
          </div>
        </div>
      )}

      <figcaption id="map-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        The map isn’t drawn by hand: every dot is a venue, placed by the coordinates Google sent back. Squint and you can see
        Southern California, and Washington, D.C.
      </figcaption>
    </figure>
  )
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex md:flex-col items-center justify-center gap-1 font-sans" style={{ fontSize: 12, color: 'var(--hiw-ink-3)' }} aria-hidden="true">
      <span className="md:hidden" style={{ color: '#a5b4fc' }}>
        ↓
      </span>
      <span className="hidden md:inline" style={{ color: '#a5b4fc', fontSize: 18 }}>
        →
      </span>
      <span style={{ fontStyle: 'italic' }}>{label}</span>
    </div>
  )
}
