import { useEffect, useState, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ConcertData } from './types/concert'
import { Scene1Hero } from './components/scenes/Scene1Hero'
import { Scene3Map } from './components/scenes/Scene3Map'
import { Scene4Bands } from './components/scenes/Scene4Bands'
import { Scene5Genres } from './components/scenes/Scene5Genres/index'
import { ArtistScene } from './components/scenes/ArtistScene/ArtistScene'
import { AskScene } from './components/ask/AskScene'
import { SceneNavigation } from './components/SceneNavigation'
import { ChangelogToast, ChangelogRSS } from './components/changelog'
import { WhatsPlayingPage } from './components/changelog/WhatsPlayingPage'
import { LinerNotesPage, LinerNotePermalink } from './components/liner-notes'
import { AboutPage } from './components/about'
import { CascadePage } from './components/cascade/CascadePage'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { AskDevHarness } from './components/ask/AskDevHarness'
import { AskProvider } from './components/ask/AskProvider'
import { AskSpotlight } from './components/ask/AskSpotlight'
import { AskHotkeys } from './components/ask/AskHotkeys'
import { SCENE_MAP, SCENE_NAMES, TOAST } from './components/changelog/constants'
import { sceneIndexFromScroll } from './hooks/useActiveScene'
import { useChangelogCheck } from './hooks/useChangelogCheck'
import { useLinerNotesCheck } from './hooks/useLinerNotesCheck'
import { analytics } from './services/analytics'
import { buildPagePath, buildPageTitle } from './utils/pageTracking'

function App() {
  return (
    <AskProvider>
      <Routes>
        <Route path="/" element={<MainScenes />} />
        {/* #142: Ask is the final scene, not a separate page. /ask is kept as a friendly alias
            that lands on that scene (preserves the URL + shareability + SEO). The chat itself is
            the Spotlight overlay, opened in place from the scene / rail / ⌘K. */}
        <Route path="/ask" element={<Navigate to="/?scene=ask" replace />} />
        <Route path="/liner-notes" element={<LinerNotesPage />} />
        <Route path="/liner-notes/rss" element={<ChangelogRSS />} />
        <Route path="/liner-notes/:slug" element={<LinerNotePermalink />} />
        <Route path="/whats-playing" element={<WhatsPlayingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<CascadePage />} />
        {/* Operator dashboard (#171). Fenced by Cloudflare Access at the edge; data from /dashboard/data/. */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/*" element={<DashboardPage />} />
        {/* Dev-only: #140 exhibit harness. Gated to dev builds (404s in prod). */}
        {import.meta.env.DEV && <Route path="/ask-dev" element={<AskDevHarness />} />}
        {/* Legacy redirects */}
        <Route path="/cascade" element={<Navigate to="/how-it-works" replace />} />
        <Route path="/changelog" element={<WhatsPlayingPage />} />
        <Route path="/changelog/rss" element={<ChangelogRSS />} />
      </Routes>
      {/* Container B — the Spotlight overlay + its power keys, available over any route. */}
      <AskSpotlight />
      <AskHotkeys />
    </AskProvider>
  )
}

function MainScenes() {
  const location = useLocation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ConcertData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentScene, setCurrentScene] = useState(1)
  // Mirror currentScene in a ref so the resize handler (mounted once) always re-aligns to the live scene.
  const currentSceneRef = useRef(currentScene)
  currentSceneRef.current = currentScene
  // TEMP DIAGNOSTIC (#191): on-screen readout of viewport/scene metrics after rotation.
  const [dbg, setDbg] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [toastShownThisSession, setToastShownThisSession] = useState(false)
  const [pendingVenueFocus, setPendingVenueFocus] = useState<string | null>(null)
  const [pendingMapVenueFocus, setPendingMapVenueFocus] = useState<string | null>(null)
  const [pendingArtistFocus, setPendingArtistFocus] = useState<string | null>(null)
  const [pendingVenueArtistFocus, setPendingVenueArtistFocus] = useState<{
    venue: string
    artist?: string
  } | null>(null)
  const [pendingYearFocus, setPendingYearFocus] = useState<number | null>(null)
  const [currentDeepLinkParams, setCurrentDeepLinkParams] = useState<{
    artist?: string | null
    venue?: string | null
  }>({})

  // Check for new changelog entries and liner notes posts
  const {
    shouldShow: changelogShouldShow,
    newFeatureCount,
    latestRelease,
    newReleases,
    dismissToast: dismissChangelog,
    markAsSeen: markChangelogSeen,
  } = useChangelogCheck(currentScene)

  const {
    shouldShow: linerNotesShouldShow,
    latestPost,
    newPosts,
    dismissToast: dismissLinerNotes,
    markAsSeen: markLinerNotesSeen,
  } = useLinerNotesCheck(currentScene)

  // Priority: changelog > liner-notes. One toast per session.
  const activeToastType = changelogShouldShow ? 'changelog' : linerNotesShouldShow ? 'liner-notes' : null
  const shouldShow = activeToastType !== null

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
      const newScene = sceneIndexFromScroll(scrollContainer, SCENE_NAMES.length)

      if (newScene !== currentScene) {
        setCurrentScene(newScene)

        // Track virtual pageview
        const pagePath = buildPagePath(newScene, currentDeepLinkParams)
        const pageTitle = buildPageTitle(newScene, currentDeepLinkParams)
        analytics.trackPageView(pagePath, pageTitle)

        // Keep legacy scene_view event for continuity
        const sceneName = SCENE_NAMES[newScene - 1]
        analytics.trackEvent('scene_view', {
          scene_name: sceneName,
          scene_number: newScene,
        })
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [currentScene, currentDeepLinkParams])

  // Re-align the snap scroll to the in-focus scene after an orientation change. Scene offsets are
  // absolute pixels ((sceneId-1) * innerHeight); on rotation innerHeight changes but scrollTop does
  // not, so you land between two scenes (rotate landscape→portrait from the Ask scene and you drop
  // halfway between Genres and Artists — they appear to overlap). Chromium re-snaps scroll-snap on
  // resize and self-corrects; Safari doesn't, so we force it. Guarded to width changes so the iOS
  // toolbar showing/hiding (a height-only resize during normal scrolling) never yanks the page.
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    // Pin scene/container heights to the measured viewport (index.css consumes --app-vh). iOS Safari
    // leaves CSS 100vh stale after a rotation, so scenes keep the old orientation's height and the
    // snap scenes overlap; an explicit px value isn't subject to that bug.
    const setAppHeight = () => document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`)
    setAppHeight()

    let lastWidth = window.innerWidth
    const apply = () => {
      if (window.innerWidth === lastWidth) return // height-only change (iOS toolbar) — leave it alone
      lastWidth = window.innerWidth
      setAppHeight()
      scrollContainer.scrollTo({ top: (currentSceneRef.current - 1) * window.innerHeight, behavior: 'auto' })
      // TEMP DIAGNOSTIC (#191)
      const sec = scrollContainer.querySelector('section')
      setDbg(
        `win ${window.innerWidth}x${window.innerHeight} scene#${currentSceneRef.current}\n` +
        `sceneH ${sec ? Math.round(sec.getBoundingClientRect().height) : '?'} scrollTop ${Math.round(scrollContainer.scrollTop)}`,
      )
    }
    // rAF catches the post-layout frame; the delayed pass covers Safari reporting stale dimensions
    // on the orientationchange event itself.
    const realign = () => {
      requestAnimationFrame(apply)
      setTimeout(apply, 300)
    }

    window.addEventListener('resize', realign)
    window.addEventListener('orientationchange', realign)
    return () => {
      window.removeEventListener('resize', realign)
      window.removeEventListener('orientationchange', realign)
    }
    // Depend on `loading`: the scroll container isn't mounted during the loading state, so an []-deps
    // effect would run once with a null ref and bail forever. Re-run once data loads and it exists.
  }, [loading])

  // Show toast with delay — one per session, highest priority wins
  useEffect(() => {
    if (loading || !shouldShow || toastShownThisSession) return

    const timer = setTimeout(() => {
      setShowToast(true)
      setToastShownThisSession(true)
    }, TOAST.INITIAL_DELAY)

    return () => clearTimeout(timer)
  }, [loading, shouldShow, toastShownThisSession])

  // Handle deep linking via query parameters
  useEffect(() => {
    if (loading || !scrollContainerRef.current) return

    const params = new URLSearchParams(location.search)
    const sceneParam = params.get('scene')
    const artistParam = params.get('artist')
    const venueParam = params.get('venue')
    const yearParam = params.get('year')

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

      // If year parameter is provided, expand that year's card stack on the timeline
      if (yearParam && sceneId === 1) {
        const year = Number(yearParam)
        if (!isNaN(year)) setPendingYearFocus(year)
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
      {/* TEMP DIAGNOSTIC (#191): viewport/scene readout, removed once the rotation fix is confirmed. */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, zIndex: 999999,
          font: '700 12px/1.35 monospace', whiteSpace: 'pre', color: '#000',
          background: '#00e000', padding: '4px 7px', pointerEvents: 'none',
        }}
      >
        {dbg || 'rotate to test'}
      </div>
      <div ref={scrollContainerRef} className="relative snap-y snap-mandatory h-screen overflow-y-scroll">
        {/* Scene 1: Hero/Timeline */}
        <Scene1Hero
          concerts={concerts}
          onNavigateToArtist={handleArtistNavigate}
          pendingYearFocus={pendingYearFocus}
          onYearFocusComplete={() => setPendingYearFocus(null)}
        />

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

        {/* Scene 6: Ask the Archive — the blended invitation (#142). Deep link /?scene=ask. */}
        <AskScene />
      </div>

      {/* Scene Navigation */}
      <SceneNavigation />

      {/* Toast (only on Scene 1) — changelog or liner-notes, one per session */}
      {activeToastType && (
        <ChangelogToast
          isVisible={showToast}
          type={activeToastType}
          newFeatureCount={newFeatureCount}
          latestRelease={latestRelease}
          newReleases={newReleases}
          newPosts={newPosts}
          latestPost={latestPost}
          onDismiss={() => {
            setShowToast(false)
            activeToastType === 'changelog' ? dismissChangelog() : dismissLinerNotes()
          }}
          onNavigate={() => {
            setShowToast(false)
            activeToastType === 'changelog' ? markChangelogSeen() : markLinerNotesSeen()
          }}
        />
      )}
    </>
  )
}

export default App
