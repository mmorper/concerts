import { useEffect, useRef, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Concert } from '../../types/concert'

interface Scene3MapProps {
  concerts: Concert[]
}

type Region = 'all' | 'california' | 'dc' | 'boston'

const REGION_VIEWS: Record<Region, { center: [number, number]; zoom: number; label: string }> = {
  all: { center: [39.8283, -98.5795], zoom: 4, label: 'All' },
  california: { center: [34.0522, -118.2437], zoom: 7, label: 'California' },
  dc: { center: [38.9072, -77.0369], zoom: 10, label: 'DC Area' },
  boston: { center: [42.3601, -71.0589], zoom: 10, label: 'Boston' },
}

export function Scene3Map({ concerts }: Scene3MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<Region>('all')

  // Count unique cities
  const cityCount = useMemo(() => {
    const cities = new Set(concerts.map(c => c.cityState))
    return cities.size
  }, [concerts])

  useEffect(() => {
    if (!mapRef.current || concerts.length === 0) return

    // Initialize map
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

      mapInstanceRef.current = map

      // Add markers for each concert
      const cityMarkers = new Map<string, { lat: number; lng: number; count: number }>()

      concerts.forEach(concert => {
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

        L.circleMarker([data.lat, data.lng], {
          radius,
          fillColor: '#6366f1',
          color: '#818cf8',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6,
        })
          .bindPopup(`<strong>${city}</strong><br/>${data.count} concert${data.count !== 1 ? 's' : ''}`)
          .addTo(map)
      })
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [concerts])

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
      {/* Title Overlay */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: false }}
        transition={{ duration: 0.8, delay: 0 }}
        className="absolute top-20 left-0 right-0 z-20 text-center px-8 pointer-events-none"
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
        className="absolute bottom-20 left-0 right-0 z-20 text-center"
      >
        <p className="font-sans text-xs text-gray-500 font-medium uppercase tracking-widest">
          {concerts.length} Shows · {cityCount} Cities
        </p>
      </motion.div>
    </motion.section>
  )
}
