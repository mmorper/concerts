import type { LatLngExpression, Map as LeafletMap, ZoomPanOptions } from 'leaflet'

/**
 * `map.flyTo` that survives a map with no size.
 *
 * flyTo divides by the map's size to plan its path, so on a 0x0 map every frame comes
 * out NaN and it throws `Invalid LatLng object: (NaN, NaN)`. A hidden tab or pane can
 * lay the page out at 0x0, and the throw lands in a React effect. There is nothing to
 * animate at that size anyway, so jump straight to the same centre and zoom. Leaflet
 * keeps that view when the map gets a size again.
 */
export function safeFlyTo(
  map: Pick<LeafletMap, 'getSize' | 'flyTo' | 'setView'>,
  center: LatLngExpression,
  zoom: number,
  options?: ZoomPanOptions,
): void {
  const { x, y } = map.getSize()

  if (x === 0 || y === 0) {
    map.setView(center, zoom, { animate: false })
    return
  }

  map.flyTo(center, zoom, options)
}
