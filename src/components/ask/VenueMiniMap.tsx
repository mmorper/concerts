// A real, static mini-map for the venue exhibit — same CartoDB dark tiles as Scene3Map, so the
// card shows the actual location instead of a placeholder. Fully non-interactive (no pan/zoom);
// it's a picture of a place, not a map widget.

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export function VenueMiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const map = L.map(ref.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      dragging: false,
      keyboard: false,
      boxZoom: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)
    L.marker([lat, lng], {
      icon: L.divIcon({ className: 'ask-map-pin', html: '<span></span>', iconSize: [14, 14], iconAnchor: [7, 14] }),
      keyboard: false,
      interactive: false,
    }).addTo(map)
    // Leaflet measures its container on init; the flex/animated card isn't sized yet on first
    // paint, so re-measure on the next frame.
    const t = setTimeout(() => map.invalidateSize(), 0)
    return () => {
      clearTimeout(t)
      map.remove()
    }
  }, [lat, lng])

  return <div ref={ref} className="ask-map" role="img" aria-label={`Map showing ${label}`} />
}
