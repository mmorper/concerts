import { useEffect, useState, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import type { ConcertData } from './types/concert'
import { Scene1Hero } from './components/scenes/Scene1Hero'
import { Scene3Map } from './components/scenes/Scene3Map'
import { Scene4Bands } from './components/scenes/Scene4Bands'
import { Scene5Genres } from './components/scenes/Scene5Genres'
import { ArtistScene } from './components/scenes/ArtistScene/ArtistScene'
import { SceneNavigation } from './components/SceneNavigation'
import { ChangelogPage, ChangelogToast, ChangelogRSS } from './components/changelog'
import { SCENE_MAP, TOAST } from './components/changelog/constants'
import { useChangelogCheck } from './hooks/useChangelogCheck'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainScenes />} />
      <Route path="/liner-notes" element={<ChangelogPage />} />
      <Route path="/liner-notes/rss" element={<ChangelogRSS />} />
      {/* Legacy redirects */}
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/changelog/rss" element={<ChangelogRSS />} />
    </Routes>
  )
}

function MainScenes() {
  const location = useLocation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ConcertData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentScene, setCurrentScene] = useState(1)
  const [showToast, setShowToast] = useState(false)
  const [pendingVenueFocus, setPendingVenueFocus] = useState<string | null>(null)
  const [pendingMapVenueFocus, setPendingMapVenueFocus] = useState<string | null>(null)
  const [pendingArtistFocus, setPendingArtistFocus] = useState<string | null>(null)

  // Check for new changelog entries
  const {
    shouldShow,
    newFeatureCount,
    latestRelease,
    newReleases,
    dismissToast,
    markAsSeen,
  } = useChangelogCheck(currentScene)

  // Handle venue navigation from map to venues scene
  const handleVenueNavigate = (venueName: string) => {
    setPendingVenueFocus(venueName)

    // Scroll to venues scene (Scene 2)
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const windowHeight = window.innerHeight
    scrollContainer.scrollTo({
      top: (2 - 1) * windowHeight, // Scene 2 = Venues
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    fetch('/data/concerts.json')
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load concert data:', err)
        setLoading(false)
      })
  }, [])

  // Track current scene from scroll position
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop
      const windowHeight = window.innerHeight
      const sceneIndex = Math.round(scrollPosition / windowHeight) + 1
      setCurrentScene(Math.min(Math.max(sceneIndex, 1), 5))
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  // Show toast with delay after data loads and if new features available
  useEffect(() => {
    if (loading || !shouldShow) return

    const timer = setTimeout(() => {
      setShowToast(true)
    }, TOAST.INITIAL_DELAY)

    return () => clearTimeout(timer)
  }, [loading, shouldShow])

  // Handle deep linking via query parameters
  useEffect(() => {
    if (loading || !scrollContainerRef.current) return

    const params = new URLSearchParams(location.search)
    const sceneParam = params.get('scene')
    const artistParam = params.get('artist')
    const venueParam = params.get('venue')

    if (sceneParam && SCENE_MAP[sceneParam]) {
      const sceneId = SCENE_MAP[sceneParam]

      // If artist parameter is provided, set it for the ArtistScene
      if (artistParam && sceneId === 5) {
        setPendingArtistFocus(artistParam)
      }

      // If venue parameter is provided, set it for the appropriate scene
      if (venueParam && sceneId === 2) {
        setPendingVenueFocus(venueParam)
      } else if (venueParam && sceneId === 3) {
        setPendingMapVenueFocus(venueParam)
      }

      // Delay to ensure DOM is fully ready
      setTimeout(() => {
        const scrollContainer = scrollContainerRef.current
        if (!scrollContainer) return

        const windowHeight = window.innerHeight
        scrollContainer.scrollTo({
          top: (sceneId - 1) * windowHeight,
          behavior: 'smooth',
        })
      }, 100)
    } else if (sceneParam) {
      console.warn('Invalid scene parameter:', sceneParam)
    }
  }, [location.search, loading])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Spinning loader */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600 font-light text-sm tracking-wide animate-pulse">
            Loading concert archive...
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">Failed to load concert data</p>
          <p className="text-gray-500">Please check the console for errors</p>
        </div>
      </div>
    )
  }

  const concerts = data.concerts

  return (
    <>
      <div ref={scrollContainerRef} className="relative snap-y snap-mandatory h-screen overflow-y-scroll">
        {/* Scene 1: Hero/Timeline */}
        <Scene1Hero concerts={concerts} />

        {/* Scene 2: Venues (force-directed graph) */}
        <Scene4Bands
          concerts={concerts}
          pendingVenueFocus={pendingVenueFocus}
          onVenueFocusComplete={() => setPendingVenueFocus(null)}
        />

        {/* Scene 3: Map */}
        <Scene3Map
          concerts={concerts}
          onVenueNavigate={handleVenueNavigate}
          pendingVenueFocus={pendingMapVenueFocus}
          onVenueFocusComplete={() => setPendingMapVenueFocus(null)}
        />

        {/* Scene 4: Genres (sunburst) */}
        <Scene5Genres concerts={concerts} />

        {/* Scene 5: Artists (album mosaic) */}
        <ArtistScene
          concerts={concerts}
          pendingArtistFocus={pendingArtistFocus}
          onArtistFocusComplete={() => setPendingArtistFocus(null)}
        />
      </div>

      {/* Scene Navigation */}
      <SceneNavigation />

      {/* Changelog Toast (only on Scene 1) */}
      {latestRelease && (
        <ChangelogToast
          isVisible={showToast}
          newFeatureCount={newFeatureCount}
          latestRelease={latestRelease}
          newReleases={newReleases}
          onDismiss={() => {
            setShowToast(false)
            dismissToast()
          }}
          onNavigate={() => {
            setShowToast(false)
            markAsSeen()
          }}
        />
      )}
    </>
  )
}

export default App
