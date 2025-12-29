import { useEffect, useRef, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Concert } from '../../types/concert'

interface Scene3MapProps {
  concerts: Concert[]
}

type Region = 'all' | 'california' | 'dc' | 'boston'

const REGION_VIEWS: Record<Region, { center: [number, number]; zoom: number; label: string; filter?: (concert: Concert) => boolean }> = {
  all: {
    center: [39.8283, -98.5795],
    zoom: 4,
    label: 'All',
  },
  california: {
    center: [33.8, -118.0], // LA area center
    zoom: 9, // Much tighter zoom
    label: 'California',
    filter: (c) => c.state === 'California' || c.state === 'CA'
  },
  dc: {
    center: [38.9072, -77.0369],
    zoom: 11, // Tighter zoom for DC metro area
    label: 'DC Area',
    filter: (c) => {
      // Include DC area states (including 'Washington' which is used for DC venues in the data)
      const isDCArea = ['Virginia', 'VA', 'Maryland', 'MD', 'District of Columbia', 'DC', 'Washington'].includes(c.state)
      // Exclude concerts with invalid coordinates (0, 0)
      const hasValidCoords = c.location.lat !== 0 && c.location.lng !== 0
      return isDCArea && hasValidCoords
    }
  },
  boston: {
    center: [42.3601, -71.0589],
    zoom: 10,
    label: 'Boston',
    filter: (c) => c.state === 'Massachusetts' || c.state === 'MA'
  },
}

export function Scene3Map({ concerts }: Scene3MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<Region>('all')

  // Filter concerts based on selected region
  const filteredConcerts = useMemo(() => {
    const filter = REGION_VIEWS[selectedRegion].filter
    return filter ? concerts.filter(filter) : concerts
  }, [concerts, selectedRegion])

  // Count unique cities in filtered set
  const cityCount = useMemo(() => {
    const cities = new Set(filteredConcerts.map(c => c.cityState))
    return cities.size
  }, [filteredConcerts])

  // Initialize map (one-time setup)
  useEffect(() => {
    if (!mapRef.current || concerts.length === 0) return

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: REGION_VIEWS.all.center,
        zoom: REGION_VIEWS.all.zoom,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false, // Disable scroll zoom to prevent hijacking
        doubleClickZoom: false,
        touchZoom: false,
        dragging: false, // Make it completely static
      })

      // Monochromatic tile layer with dark grayscale styling
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Create layer group for markers
      const markersLayer = L.layerGroup().addTo(map)
      markersLayerRef.current = markersLayer

      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      if (markersLayerRef.current) {
        markersLayerRef.current = null
      }
    }
  }, [concerts])

  // Update markers when region changes
  useEffect(() => {
    if (!markersLayerRef.current) return

    // Clear existing markers
    markersLayerRef.current.clearLayers()

    // Aggregate concerts by city
    const cityMarkers = new Map<string, { lat: number; lng: number; count: number }>()

    filteredConcerts.forEach(concert => {
      const key = concert.cityState
      const existing = cityMarkers.get(key)
      if (existing) {
        existing.count++
      } else {
        cityMarkers.set(key, {
          lat: concert.location.lat,
          lng: concert.location.lng,
          count: 1,
        })
      }
    })

    // Create markers with size based on concert count
    cityMarkers.forEach((data, city) => {
      const radius = Math.sqrt(data.count) * 5

      if (markersLayerRef.current) {
        L.circleMarker([data.lat, data.lng], {
          radius,
          fillColor: '#6366f1',
          color: '#818cf8',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6,
          pane: 'markerPane', // Ensure markers render in proper pane
        })
          .bindPopup(`<strong>${city}</strong><br/>${data.count} concert${data.count !== 1 ? 's' : ''}`)
          .addTo(markersLayerRef.current)
      }
    })
  }, [filteredConcerts])

  // Handle region changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      const view = REGION_VIEWS[selectedRegion]
      mapInstanceRef.current.flyTo(view.center, view.zoom, {
        duration: 1.5,
      })
    }
  }, [selectedRegion])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-center bg-gray-900 relative snap-start snap-always"
    >
      {/* Title Overlay - increased z-index to be above Leaflet panes */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0 }}
        className="absolute top-20 left-0 right-0 z-[1000] text-center px-8 pointer-events-none"
      >
        <h2 className="font-serif text-5xl md:text-7xl text-white mb-3 tracking-tight">
          The Geography
        </h2>
        <p className="font-sans text-lg md:text-xl text-gray-400 mb-6">
          {cityCount} cities across the map
        </p>

        {/* Region Tabs */}
        <div className="flex justify-center gap-2 pointer-events-auto">
          {(Object.keys(REGION_VIEWS) as Region[]).map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`font-sans px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedRegion === region
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {REGION_VIEWS[region].label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Map Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 1, delay: 0.4 }}
        className="w-full h-full absolute inset-0 z-0"
      >
        <div ref={mapRef} className="w-full h-full" />
      </motion.div>

      {/* Stats Overlay */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute bottom-20 left-0 right-0 z-[1000] text-center"
      >
        <p className="font-sans text-xs text-gray-500 font-medium uppercase tracking-widest">
          {concerts.length} Shows · {cityCount} Cities
        </p>
      </motion.div>
    </motion.section>
  )
}
