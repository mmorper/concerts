/**
 * A real street map for "How the Archive Is Built": the archive's own dark basemap
 * (src/utils/basemap.ts, as in the Map scene and Ask's venue card) with venues pinned on it.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { addDarkBasemap } from '../../../utils/basemap'
import { useReducedMotion } from '../shared'

/** Straight-line distance in km between two points on the globe. */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * The site's own dark street map (the same basemap as the Map scene), still and non-interactive:
 * a picture of a neighbourhood. Changing the place flies the map to the new one.
 *
 * `numbered` pins match a numbered list beside the map (Step 3); otherwise nearby venues are
 * small dots (Where it all lands).
 */
export function StreetMap({
  here,
  name,
  points,
  numbered = true,
  className = 'hiw-map',
}: {
  here: { lat: number; lng: number }
  name: string
  points: { slug: string; lat: number; lng: number }[]
  numbered?: boolean
  className?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      dragging: false,
      keyboard: false,
      boxZoom: false,
      attributionControl: true,
    })
    m.attributionControl.setPrefix(false)
    addDarkBasemap(m, 18)
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  const key = `${here.lat},${here.lng}|${points.map((p) => p.slug).join(',')}`
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    m.invalidateSize()
    g.clearLayers()
    points.forEach((p, i) =>
      L.marker([p.lat, p.lng], {
        icon: numbered
          ? L.divIcon({ className: 'hiw-map-pin', html: `<span>${i + 1}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] })
          : L.divIcon({ className: 'hiw-map-dot', html: '<span></span>', iconSize: [10, 10], iconAnchor: [5, 5] }),
        keyboard: false,
        interactive: false,
      }).addTo(g),
    )
    const safe = name.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    L.marker([here.lat, here.lng], {
      icon: L.divIcon({ className: 'hiw-map-here', html: `<span></span><b>${safe}</b>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
      keyboard: false,
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(g)
    const bounds = L.latLngBounds([[here.lat, here.lng], ...points.map((p) => [p.lat, p.lng] as [number, number])])
    const opts = { padding: [48, 48] as [number, number], maxZoom: 16 }
    if (reduced || !m.getZoom()) m.fitBounds(bounds, opts)
    else m.flyToBounds(bounds, { ...opts, duration: 1.2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced, numbered])

  return <div ref={el} className={className} role="img" aria-label={`A street map around ${name}, with the nearest venues from the archive.`} />
}
