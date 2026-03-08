import { useEffect, useState, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import type { ConcertData } from './types/concert'
import { Scene1Hero } from './components/scenes/Scene1Hero'
import { Scene3Map } from './components/scenes/Scene3Map'
import { Scene4Bands } from './components/scenes/Scene4Bands'
import { Scene5Genres } from './components/scenes/Scene5Genres/index'
import { ArtistScene } from './components/scenes/ArtistScene/ArtistScene'
import { SceneNavigation } from './components/SceneNavigation'
import { ChangelogToast, ChangelogRSS } from './components/changelog'
import { WhatsPlayingPage } from './components/changelog/WhatsPlayingPage'
import { LinerNotesPage, LinerNotePermalink } from './components/liner-notes'
import { AboutPage } from './components/about'
import { SCENE_MAP, TOAST } from './components/changelog/constants'
import { useChangelogCheck } from './hooks/useChangelogCheck'
import { analytics } from './services/analytics'
import { buildPagePath, buildPageTitle } from './utils/pageTracking'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainScenes />} />
      <Route path="/liner-notes" element={<LinerNotesPage />} />
      <Route path="/liner-notes/rss" element={<ChangelogRSS />} />
      <Route path="/liner-notes/:slug" element={<LinerNotePermalink />} />
      <Route path="/whats-playing" element={<WhatsPlayingPage />} />
      <Route path="/about" element={<AboutPage />} />
      {/* Legacy redirects */}
      <Route path="/changelog" element={<WhatsPlayingPage />} />
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
  const [pendingVenueArtistFocus, setPendingVenueArtistFocus] = useState<{
    venue: string
    artist?: string
  } | null>(null)
  const [currentDeepLinkParams, setCurrentDeepLinkParams] = useState<{
    artist?: string | null
    venue?: string | null
  }>({})

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

  // Handle artist navigation from timeline to artist scene
  const handleArtistNavigate = (artistName: string) => {
    setPendingArtistFocus(artistName)

    // Scroll to artist scene (Scene 5)
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    const windowHeight = window.innerHeight
    scrollContainer.scrollTo({
      top: (5 - 1) * windowHeight, // Scene 5 = Artists
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
      const newScene = Math.min(Math.max(sceneIndex, 1), 5)

      if (newScene !== currentScene) {
        setCurrentScene(newScene)

        // Track virtual pageview
        const pagePath = buildPagePath(newScene, currentDeepLinkParams)
        const pageTitle = buildPageTitle(newScene, currentDeepLinkParams)
        analytics.trackPageView(pagePath, pageTitle)

        // Keep legacy scene_view event for continuity
        const sceneNames = ['timeline', 'venues', 'geography', 'genres', 'artists']
        const sceneName = sceneNames[newScene - 1]
        analytics.trackEvent('scene_view', {
          scene_name: sceneName,
          scene_number: newScene,
        })
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [currentScene, currentDeepLinkParams])

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

    // Store deep link parameters in state for pageview tracking
    setCurrentDeepLinkParams({
      artist: artistParam,
      venue: venueParam,
    })

    // Track deep link access with legacy event (for continuity)
    if (sceneParam || artistParam || venueParam) {
      analytics.trackEvent('deep_link_accessed', {
        scene: sceneParam || undefined,
        artist: artistParam || undefined,
        venue: venueParam || undefined,
        has_artist_filter: !!(artistParam && venueParam),
      })
    }

    if (sceneParam && SCENE_MAP[sceneParam]) {
      const sceneId = SCENE_MAP[sceneParam]

      // Track virtual pageview for deep link
      const pagePath = buildPagePath(sceneId, {
        artist: artistParam,
        venue: venueParam,
      })
      const pageTitle = buildPageTitle(sceneId, {
        artist: artistParam,
        venue: venueParam,
      })
      analytics.trackPageView(pagePath, pageTitle)

      // If artist parameter is provided, set it for the ArtistScene
      if (artistParam && sceneId === 5) {
        setPendingArtistFocus(artistParam)
      }

      // If venue parameter is provided, set it for the appropriate scene
      if (venueParam && sceneId === 2) {
        // Check if artist parameter is also provided for venue+artist deep linking
        if (artistParam) {
          setPendingVenueArtistFocus({
            venue: venueParam,
            artist: artistParam
          })
        } else {
          // Venue-only deep linking (legacy behavior)
          setPendingVenueFocus(venueParam)
        }
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
        <Scene1Hero concerts={concerts} onNavigateToArtist={handleArtistNavigate} />

        {/* Scene 2: Venues (force-directed graph) */}
        <Scene4Bands
          concerts={concerts}
          pendingVenueFocus={pendingVenueFocus}
          onVenueFocusComplete={() => setPendingVenueFocus(null)}
          pendingVenueArtistFocus={pendingVenueArtistFocus}
          onVenueArtistFocusComplete={() => setPendingVenueArtistFocus(null)}
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
