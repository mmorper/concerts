// The dark basemap used by every Leaflet surface in the archive (Scene 3 and the Ask
// venue mini-map).
//
// CARTO now requires an API key for its raster basemaps (#448). Unkeyed requests are not
// blocked — they still return HTTP 200 with a real tile — but CARTO bakes an
// "API KEY REQUIRED / carto.com/basemaps/apikey" watermark into the PNG itself, which
// is why the map suddenly looked vandalised without a single line of our code changing.
//
// The key is free (5M tiles/month fair use), issued instantly by email at
// https://carto.com/basemaps/apikey/, and is a PUBLIC token — it ships in the bundle
// exactly like VITE_TURNSTILE_SITE_KEY. Set VITE_CARTO_API_KEY locally and in the
// Cloudflare Pages dashboard (Production + Preview).
//
// Without a key we fall back to Esri's Dark Gray Canvas, which is keyless and free with
// attribution. It is a close visual match and — critically — carries no watermark, so a
// build that is missing the key degrades to a slightly different map rather than a
// defaced one.

import L from 'leaflet'

const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY ?? '').trim()

/** Highest zoom either provider serves real tiles for. Scene 3 already caps at 16. */
const MAX_NATIVE_ZOOM = 16

const CARTO_DARK = 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'

// Esri splits the canvas into a label-free base and a labels-only reference overlay, so
// the fallback is two layers where CARTO is one.
const ESRI_BASE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'

/** True when the build has a CARTO key, i.e. the tiles will come back unwatermarked. */
export const hasCartoKey = CARTO_KEY.length > 0

/**
 * Add the archive's dark basemap to `map` and return the layers that were added, so
 * callers can dispose of them if they need to. `maxZoom` should match the map's own
 * maxZoom; tiles above MAX_NATIVE_ZOOM are upscaled rather than requested.
 */
export function addDarkBasemap(map: L.Map, maxZoom = MAX_NATIVE_ZOOM): L.TileLayer[] {
  const options: L.TileLayerOptions = { maxZoom, maxNativeZoom: MAX_NATIVE_ZOOM }

  if (hasCartoKey) {
    const carto = L.tileLayer(`${CARTO_DARK}?key=${encodeURIComponent(CARTO_KEY)}`, {
      ...options,
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>, &copy; OpenStreetMap contributors',
    }).addTo(map)
    return [carto]
  }

  // Esri's canvas is a mid-grey, several stops lighter than CARTO's near-black. The
  // classes below darken it in CSS so the fallback sits on Scene 3's #111827 charcoal
  // the way dark_all did, instead of glowing off it.
  const base = L.tileLayer(ESRI_BASE, {
    ...options,
    className: 'basemap-esri-base',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  }).addTo(map)
  const labels = L.tileLayer(ESRI_LABELS, {
    ...options,
    className: 'basemap-esri-labels',
  }).addTo(map)
  return [base, labels]
}
