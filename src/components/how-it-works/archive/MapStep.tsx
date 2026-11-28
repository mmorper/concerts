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
import { km, StreetMap } from './StreetMap'
import { useJson, useNearView, type VenueMeta } from './data'

const PLACE = '#6366f1'

export const PICKS = ['the-belasco', '9-30-club', 'hollywood-bowl']

export function MapStep() {
  const [ref, near] = useNearView<HTMLElement>()
  const venues = useJson<Record<string, VenueMeta>>('/data/venues-metadata.json', near)
  const [sel, setSel] = useState(0)
  const v = venues?.[PICKS[sel]]
  const all = venues ? Object.entries(venues).filter(([, x]) => x.location) : []

  // The five nearest venues in the archive, by straight-line distance (haversine), within 25 km
  // so a lonely venue doesn't zoom the map out to a whole region.
  const here = v?.location
  const neighbours = here
    ? all
        .filter(([slug]) => slug !== PICKS[sel])
        .map(([slug, x]) => ({ slug, name: x.name, lat: x.location!.lat, lng: x.location!.lng, d: km(here, x.location!) }))
        .filter((n) => n.d <= 25)
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
    : []

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
          {/* Zoomed on the venue: a real street map, with its nearest neighbours from the archive */}
          <div className="hiw-hood p-2 md:col-span-3">
            {here && v && <StreetMap here={here} name={v.name} points={neighbours} />}
            {neighbours.length > 0 && (
              <ol className="font-sans px-2 pt-3 pb-1 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3" style={{ listStyle: 'none', fontSize: 14, color: '#c7d2fe' }}>
                {neighbours.map((n, i) => (
                  <li key={n.slug} className="flex gap-2 items-baseline">
                    <span className="hiw-map-num" aria-hidden="true">{i + 1}</span>
                    {n.name}
                    <span className="ml-auto" style={{ color: 'var(--hiw-ink-3)', fontSize: 13 }}>
                      {n.d < 10 ? n.d.toFixed(1) : Math.round(n.d)} km
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="font-sans px-2 pb-1" style={{ fontSize: 12, color: 'var(--hiw-ink-3)' }}>
              The closest venues I’ve been to, on a real street map
            </div>
          </div>
        </div>
      )}

      <figcaption id="map-cap" className="hiw-figcaption px-4 sm:px-6 pb-5 pt-4">
        Nothing here is drawn by hand. Each numbered pin is another venue from the archive, placed using the location
        Google sent back.
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
