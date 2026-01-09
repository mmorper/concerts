import { useEffect, useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Concert } from '../../types/concert'
import { normalizeVenueName } from '../../utils/normalize'
import { haptics } from '../../utils/haptics'

interface VenueMetadata {
  name: string
  normalizedName: string
  city: string
  state: string
  cityState: string
  location?: {
    lat: number
    lng: number
  }
  concerts: Array<{
    id: string
    date: string
    headliner: string
  }>
  stats: {
    totalConcerts: number
    firstEvent: string
    lastEvent: string
    uniqueArtists: number
  }
  status: string
  closedDate?: string | null
  notes?: string | null
  places?: any
  manualPhotos?: Array<{
    url: string
    width: number
    height: number
  }> | null
  photoUrls?: {
    thumbnail: string
    medium: string
    large: string
  } | null
  fetchedAt: string
  photoCacheExpiry?: string | null
}

interface Scene3MapProps {
  concerts: Concert[]
  onVenueNavigate?: (venueName: string) => void
  pendingVenueFocus?: string | null
  onVenueFocusComplete?: () => void
}

type Region = 'all' | 'california' | 'dc'

const ZOOM_BOUNDS = {
  min: 3.5, // Mobile: wider view to show both coasts
  max: 16,  // Street-level with context
}

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
    filter: (c) => c.state === 'California' || c.state === 'CA' || c.city === 'Tijuana' // Include Tijuana (border city)
  },
  dc: {
    center: [39.00, -77.03], // Moved north to include Silver Spring area
    zoom: 10.5, // Slightly wider to show full metro area
    label: 'DC Area',
    filter: (c) => ['Virginia', 'VA', 'Maryland', 'MD', 'District of Columbia', 'DC'].includes(c.state)
  },
}

export function Scene3Map({ concerts, pendingVenueFocus, onVenueFocusComplete }: Scene3MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const venueMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map())
  const [selectedRegion, setSelectedRegion] = useState<Region>('all')
  const [isMapActive, setIsMapActive] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [venuesMetadata, setVenuesMetadata] = useState<Record<string, VenueMetadata> | null>(null)

  // Load venue metadata (lazy load when Scene 3 mounts)
  useEffect(() => {
    const loadVenuesMetadata = async () => {
      try {
        const response = await fetch('/data/venues-metadata.json')
        const data = await response.json()
        setVenuesMetadata(data)
      } catch (err) {
        console.warn('Failed to load venue metadata:', err)
        // Popups gracefully degrade to no-image state
      }
    }

    loadVenuesMetadata()
  }, [])

  // Use ResizeObserver to handle orientation changes and call invalidateSize
  useEffect(() => {
    if (!mapRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        // Delay to ensure layout is settled
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize()
        }, 100)
      }
    })

    resizeObserver.observe(mapRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Helper function to scroll to a specific scene
  const scrollToScene = (sceneId: number) => {
    const scrollContainer = document.querySelector('.snap-y')
    if (!scrollContainer) return

    const windowHeight = window.innerHeight
    scrollContainer.scrollTo({
      top: (sceneId - 1) * windowHeight,
      behavior: 'smooth',
    })
  }

  const handleSceneNavigation = (sceneId: number) => {
    setIsMapActive(false)
    scrollToScene(sceneId)
  }

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

  // Helper function to generate popup HTML with photo and legacy badge
  const generatePopupHTML = (venueName: string, cityState: string, concertCount: number): string => {
    if (!venuesMetadata) {
      // Fallback to simple popup if metadata not loaded yet
      return `<strong>${venueName}<br/><span style="font-size: 11px; color: #9ca3af;">${cityState}</span></strong><br/>${concertCount} concert${concertCount !== 1 ? 's' : ''}`
    }

    const normalizedName = normalizeVenueName(venueName)
    const venue = venuesMetadata[normalizedName]
    const thumbnailUrl = venue?.photoUrls?.thumbnail

    // Legacy badge logic
    let legacyBadge = ''
    if (venue?.status && venue.status !== 'active') {
      const icon = venue.status === 'demolished' ? '🔨' : '🏛️'
      const label = venue.status === 'demolished' ? 'Demolished' : 'Closed'
      const year = venue.closedDate ? ` ${venue.closedDate.split('-')[0]}` : ''
      legacyBadge = `<div class="venue-popup-badge">${icon} ${label}${year}</div>`
    }

    return `
      <div class="venue-popup-content">
        ${thumbnailUrl ? `
          <div class="venue-popup-image-container">
            <img
              src="${thumbnailUrl}"
              alt="${venueName}"
              class="venue-popup-image"
              loading="lazy"
              onload="this.parentElement.classList.add('loaded')"
              onerror="this.parentElement.style.display='none'"
            />
            <div class="venue-popup-skeleton"></div>
          </div>
        ` : ''}
        <div class="venue-popup-text">
          <div class="venue-popup-name">${venueName}</div>
          <div class="venue-popup-location">${cityState}</div>
          ${legacyBadge}
          <div class="venue-popup-count">${concertCount} concert${concertCount !== 1 ? 's' : ''}</div>
          <a
            href="/?scene=venues&venue=${normalizedName}"
            class="venue-popup-link"
            data-venue-name="${venueName}"
            aria-label="View ${venueName} in venues scene"
          >
            <svg class="venue-graph-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="5" r="3.5" fill="currentColor" opacity="0.9"/>
              <circle cx="16" cy="12" r="3" fill="currentColor" opacity="0.7"/>
              <circle cx="14" cy="21" r="3" fill="currentColor" opacity="0.7"/>
              <line x1="9" y1="7" x2="13.5" y2="10" stroke="currentColor" stroke-width="2" opacity="0.4"/>
              <line x1="8.5" y1="7.5" x2="11.5" y2="18.5" stroke="currentColor" stroke-width="2" opacity="0.4"/>
            </svg>
            <span>Explore Venue</span>
            <span class="arrow">→</span>
          </a>
        </div>
      </div>
    `
  }

  // Initialize map (one-time setup)
  useEffect(() => {
    if (!mapRef.current || concerts.length === 0) return

    if (!mapInstanceRef.current) {
      // Use wider zoom on mobile to show both coasts
      const isMobile = window.innerWidth < 768
      const initialZoom = isMobile ? 3.5 : REGION_VIEWS.all.zoom

      const map = L.map(mapRef.current, {
        center: REGION_VIEWS.all.center,
        zoom: initialZoom,
        minZoom: ZOOM_BOUNDS.min,
        maxZoom: ZOOM_BOUNDS.max,
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

      // Create a custom pane for popups with high z-index
      map.createPane('popupPane')
      map.getPane('popupPane')!.style.zIndex = '9999'

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

    // Show individual venues for all regions to display venue-level detail when zoomed in
    const showVenues = true
    const markers = new Map<string, { lat: number; lng: number; count: number; venueName: string; cityState: string }>()

    filteredConcerts.forEach(concert => {
      const key = showVenues ? `${concert.venue}|${concert.cityState}` : concert.cityState
      const existing = markers.get(key)
      if (existing) {
        existing.count++
      } else {
        markers.set(key, {
          lat: concert.location.lat,
          lng: concert.location.lng,
          count: 1,
          venueName: concert.venue,
          cityState: concert.cityState,
        })
      }
    })

    // Clear previous marker references
    venueMarkersRef.current.clear()

    // Create markers with size based on concert count
    markers.forEach((data) => {
      const radius = Math.sqrt(data.count) * 5

      if (markersLayerRef.current) {
        const marker = L.circleMarker([data.lat, data.lng], {
          radius,
          fillColor: '#6366f1',
          color: '#818cf8',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6,
          pane: 'markerPane',
          // Increase interactive hit area for small markers on touch devices
          // This makes tiny dots easier to tap without changing visual size
          interactive: true,
          bubblingMouseEvents: false,
        })
          .bindPopup(generatePopupHTML(data.venueName, data.cityState, data.count), {
            className: 'venue-popup',
            pane: 'popupPane',
            maxWidth: 240,
            autoPan: false, // We'll handle panning manually for precise control
          })
          .on('popupopen', () => {
            // When popup opens, position it precisely below filter buttons
            if (mapInstanceRef.current) {
              const map = mapInstanceRef.current

              // Get marker's current screen position
              const markerLatLng = marker.getLatLng()
              const markerPoint = map.latLngToContainerPoint(markerLatLng)

              // Get the actual popup element and measure it
              const popupElement = marker.getPopup()?.getElement()
              if (!popupElement) return

              // Get the popup's bounding rect to see where it actually is
              const popupRect = popupElement.getBoundingClientRect()
              const popupCurrentTop = popupRect.top

              // Calculate where we want the popup top to be
              const isMobile = window.innerWidth < 768
              const filterButtonsBottom = isMobile ? 244 : 260
              const padding = isMobile ? 20 : 24
              const desiredPopupTop = filterButtonsBottom + padding // 264px mobile / 284px desktop

              // Calculate how much we need to move the popup down (positive = down)
              const popupShiftNeeded = desiredPopupTop - popupCurrentTop

              // Since popup is anchored to marker, move marker down by the same amount
              // In screen coordinates, moving down means increasing Y
              const targetMarkerY = markerPoint.y + popupShiftNeeded

              // Center horizontally
              const mapCenterX = map.getSize().x / 2
              const targetPoint = L.point(mapCenterX, targetMarkerY)

              // Calculate how much to pan the map
              const panOffset = markerPoint.subtract(targetPoint)
              const distance = Math.sqrt(panOffset.x * panOffset.x + panOffset.y * panOffset.y)

              // Only pan if adjustment is significant (prevents jitter)
              if (distance > 30) {
                const currentCenter = map.getSize().divideBy(2)
                const newCenter = map.containerPointToLatLng(currentCenter.add(panOffset))

                map.panTo(newCenter, {
                  duration: 1.0,
                  easeLinearity: 0.08,
                })
              }
            }
          })
          .on('click', () => {
            // Haptic feedback when marker is clicked
            haptics.light()

            // Activate map interactions when marker is clicked
            setIsMapActive(true)
            setShowHint(false)
          })
          .addTo(markersLayerRef.current)

        // Store marker reference by normalized venue name
        venueMarkersRef.current.set(normalizeVenueName(data.venueName), marker)
      }
    })
  }, [filteredConcerts, selectedRegion, venuesMetadata])

  // Handle deep link venue focus from URL parameters
  useEffect(() => {
    if (!pendingVenueFocus || !mapInstanceRef.current || venueMarkersRef.current.size === 0) return

    const marker = venueMarkersRef.current.get(pendingVenueFocus)
    if (marker) {
      // Activate map interactions
      setIsMapActive(true)
      setShowHint(false)

      // Fly to marker location and open popup
      const latlng = marker.getLatLng()
      mapInstanceRef.current.flyTo(latlng, 13, {
        duration: 1.5,
      })

      // Open popup after animation
      setTimeout(() => {
        marker.openPopup()
        onVenueFocusComplete?.()
      }, 1600)
    } else {
      console.warn('Venue marker not found for deep link:', pendingVenueFocus)
      onVenueFocusComplete?.()
    }
  }, [pendingVenueFocus, onVenueFocusComplete])

  // Handle region changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      const view = REGION_VIEWS[selectedRegion]
      // Use wider zoom on mobile for "All" region to show both coasts
      const isMobile = window.innerWidth < 768
      const zoom = selectedRegion === 'all' && isMobile ? 3.5 : view.zoom

      mapInstanceRef.current.flyTo(view.center, zoom, {
        duration: 1.5,
      })
    }
  }, [selectedRegion])

  // Toggle Leaflet interactions based on isMapActive state
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current

    if (isMapActive) {
      map.scrollWheelZoom.enable()
      map.dragging.enable()
      map.touchZoom.enable()
      map.doubleClickZoom.enable()
    } else {
      map.scrollWheelZoom.disable()
      map.dragging.disable()
      map.touchZoom.disable()
      map.doubleClickZoom.disable()
    }
  }, [isMapActive])

  // Click detection (map vs marker) - activate on map tile click
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current

    const handleMapClick = () => {
      // Only activate if clicking map tiles, not markers
      // Markers have their own click handlers that stop propagation
      if (!isMapActive) {
        setIsMapActive(true)
        setShowHint(false)
      }
    }

    map.on('click', handleMapClick)

    return () => {
      map.off('click', handleMapClick)
    }
  }, [isMapActive])

  // ESC key listener to deactivate map
  useEffect(() => {
    if (!isMapActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMapActive(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMapActive])

  // Event delegation for venue link clicks in popups (haptic feedback only)
  useEffect(() => {
    if (!mapRef.current) return

    const handleVenueLinkClick = (e: Event) => {
      const target = e.target as HTMLElement
      // Check if click is on the link or its children
      if (target.classList.contains('venue-popup-link') || target.closest('.venue-popup-link')) {
        // Haptic feedback for venue navigation
        haptics.light()
        // Let the default link behavior handle navigation
      }
    }

    const mapContainer = mapRef.current
    mapContainer.addEventListener('click', handleVenueLinkClick)

    return () => {
      mapContainer.removeEventListener('click', handleVenueLinkClick)
    }
  }, [])

  // Scroll trapping when map is active
  useEffect(() => {
    if (!isMapActive) return

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation()
    }

    const mapContainer = mapRef.current
    if (mapContainer) {
      mapContainer.addEventListener('wheel', handleWheel, { passive: false })

      return () => {
        mapContainer.removeEventListener('wheel', handleWheel)
      }
    }
  }, [isMapActive])

  // Auto-fade hint: show after 1s delay, hide after 3s
  useEffect(() => {
    // Reset hint when scene is viewed again
    setShowHint(true)

    const showTimer = setTimeout(() => {
      setShowHint(true)
    }, 1000)

    const hideTimer = setTimeout(() => {
      setShowHint(false)
    }, 4000) // 1s delay + 3s visible

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, []) // Run once on mount

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="h-screen flex flex-col items-center justify-center bg-gray-900 relative snap-start snap-always"
      aria-label={isMapActive ? "Map exploration mode - interactive" : "Map - click to explore"}
    >
      {/* Accessibility: Announce state changes */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isMapActive ? "Map exploration mode activated. Press Escape to exit." : ""}
      </div>

      {/* Scene Navigation Links - only visible when map is active */}
      <AnimatePresence>
        {isMapActive && (
          <>
            {/* Top Navigation - to Bands scene */}
            <motion.button
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              onClick={() => {
                haptics.light()
                handleSceneNavigation(2)
              }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[1001] bg-gray-900/70 backdrop-blur-sm text-gray-300 hover:text-white px-4 py-2 rounded-full min-h-[44px] flex items-center gap-2 transition-colors"
              aria-label="Go to The Venues scene"
            >
              <span>↑</span>
              <span>The Venues</span>
            </motion.button>

            {/* Bottom Navigation - to Genres scene */}
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              onClick={() => {
                haptics.light()
                handleSceneNavigation(4)
              }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1001] bg-gray-900/70 backdrop-blur-sm text-gray-300 hover:text-white px-4 py-2 rounded-full min-h-[44px] flex items-center gap-2 transition-colors"
              aria-label="Go to The Music scene"
            >
              <span>The Music</span>
              <span>↓</span>
            </motion.button>
          </>
        )}
      </AnimatePresence>
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
              onClick={() => {
                haptics.light() // Haptic feedback on region change
                setSelectedRegion(region)
              }}
              className={`font-sans px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] touchable-no-scale ${
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

      {/* "Tap to explore" Hint - only visible when map is locked and hint is active */}
      <AnimatePresence>
        {!isMapActive && showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute bottom-32 left-0 right-0 z-[1000] text-center pointer-events-none"
          >
            <div className="inline-block bg-gray-800/80 backdrop-blur-sm text-gray-400 text-sm px-4 py-2 rounded-full">
              Tap to explore map
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
