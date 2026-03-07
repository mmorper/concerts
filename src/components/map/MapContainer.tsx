import { useEffect, useRef } from 'react'
import { MapContainer as LeafletMap, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import type { Concert } from '@/types/concert'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in React Leaflet
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

interface MapContainerProps {
  concerts: Concert[]
  focusedConcert: Concert | null
  onMarkerClick?: (concert: Concert) => void
}

// Component to handle map flyTo when concert is focused
function MapController({ focusedConcert }: { focusedConcert: Concert | null }) {
  const map = useMap()

  useEffect(() => {
    if (focusedConcert) {
      map.flyTo([focusedConcert.location.lat, focusedConcert.location.lng], 13, {
        duration: 1,
      })
    }
  }, [focusedConcert, map])

  return null
}

export function MapContainer({ concerts, focusedConcert, onMarkerClick }: MapContainerProps) {
  const mapRef = useRef<L.Map | null>(null)

  // Calculate center point from all concerts
  const center: [number, number] = concerts.length > 0
    ? [
        concerts.reduce((sum, c) => sum + c.location.lat, 0) / concerts.length,
        concerts.reduce((sum, c) => sum + c.location.lng, 0) / concerts.length,
      ]
    : [39.7392, -104.9903] // Default to Denver

  // Custom cluster icon
  const createClusterCustomIcon = (cluster: any) => {
    const count = cluster.getChildCount()
    let size = 'small'
    if (count > 10) size = 'large'
    else if (count > 5) size = 'medium'

    return L.divIcon({
      html: `<div class="cluster-marker cluster-${size}">
        <span>${count}</span>
      </div>`,
      className: 'custom-cluster-icon',
      iconSize: L.point(40, 40, true),
    })
  }

  if (concerts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-center text-gray-500">
          <svg
            className="w-16 h-16 mx-auto mb-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-sm font-mono uppercase tracking-wider">
            No locations to display
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full rounded-lg overflow-hidden border border-gray-800 shadow-xl">
      <LeafletMap
        center={center}
        zoom={6}
        className="h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController focusedConcert={focusedConcert} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
        >
          {concerts.map((concert) => (
            <Marker
              key={concert.id}
              position={[concert.location.lat, concert.location.lng]}
              eventHandlers={{
                click: () => onMarkerClick?.(concert),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-display text-lg uppercase text-purple-600 mb-1">
                    {concert.headliner}
                  </p>
                  <p className="text-xs text-gray-600 mb-2">
                    {new Date(concert.date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-gray-700 font-semibold">{concert.venue}</p>
                  <p className="text-gray-500 text-xs">{concert.cityState}</p>
                  {concert.openers.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      + {concert.openers.length} opener{concert.openers.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </LeafletMap>

      <style>{`
        .custom-cluster-icon {
          background: transparent;
          border: none;
        }

        .cluster-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-weight: bold;
          color: white;
          background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
          border: 3px solid rgba(124, 58, 237, 0.3);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
          transition: transform 0.2s;
        }

        .cluster-marker:hover {
          transform: scale(1.1);
        }

        .cluster-small {
          width: 35px;
          height: 35px;
          font-size: 12px;
        }

        .cluster-medium {
          width: 42px;
          height: 42px;
          font-size: 14px;
        }

        .cluster-large {
          width: 50px;
          height: 50px;
          font-size: 16px;
        }

        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          padding: 0;
        }

        .leaflet-popup-content {
          margin: 12px;
        }
      `}</style>
    </div>
  )
}
