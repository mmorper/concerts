import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { haptics } from '../utils/haptics'
import { analytics } from '../services/analytics'

const NAV_LINKS = [
  { to: '/liner-notes', label: 'Liner Notes', event: 'liner_notes_nav_clicked' },
  { to: '/whats-playing', label: "What's Playing", event: 'whats_playing_nav_clicked' },
  // /ask is a static (non-SPA) page, so it renders as a full-navigation <a>, not <Link>.
  { to: '/ask', label: 'Ask', event: 'ask_archive_nav_clicked', external: true },
  { to: '/about', label: 'About', event: 'about_nav_clicked' },
] as const

const scenes = [
  { id: 1, label: 'Timeline' },
  { id: 2, label: 'Venues' },
  { id: 3, label: 'Map' },
  { id: 4, label: 'Genres' },
  { id: 5, label: 'Artists' },
]

export function SceneNavigation() {
  const [activeScene, setActiveScene] = useState(1)
  const [revealedLabel, setRevealedLabel] = useState<number | null>(null)

  useEffect(() => {
    const scrollContainer = document.querySelector('.snap-y')
    if (!scrollContainer) return

    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop
      const windowHeight = window.innerHeight
      const sceneIndex = Math.round(scrollPosition / windowHeight) + 1
      setActiveScene(Math.min(Math.max(sceneIndex, 1), scenes.length))

      // Dismiss label on scroll
      setRevealedLabel(null)
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-dismiss label after 3 seconds
  useEffect(() => {
    if (revealedLabel === null) return

    const timeout = setTimeout(() => {
      setRevealedLabel(null)
    }, 3000)

    return () => clearTimeout(timeout)
  }, [revealedLabel])

  const scrollToScene = (sceneId: number) => {
    haptics.light() // Haptic feedback on navigation

    // Track scene navigation
    analytics.trackEvent('scene_nav_clicked', {
      from_scene: activeScene,
      to_scene: sceneId,
    })

    const scrollContainer = document.querySelector('.snap-y')
    if (!scrollContainer) return

    const windowHeight = window.innerHeight
    scrollContainer.scrollTo({
      top: (sceneId - 1) * windowHeight,
      behavior: 'smooth',
    })
  }

  // Scenes 1 (Timeline) and 5 (Artists) are light backgrounds; the rest are dark.
  const onLight = [1, 5].includes(activeScene)
  const railLabel = onLight ? 'rgba(30,41,59,0.55)' : 'rgba(255,255,255,0.4)'
  const railEdge = onLight ? 'rgba(30,41,59,0.15)' : 'rgba(255,255,255,0.1)'

  // Shared vertical-text style for the rail's two destination labels.
  const vLabel = (color: string) => ({
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color,
    writingMode: 'vertical-rl' as const,
    transform: 'rotate(180deg)',
    lineHeight: 1,
  })

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 2, duration: 0.8 }}
      className="fixed right-8 top-1/2 -translate-y-1/2 z-40 hidden md:block"
    >
      {/* The dots are the flow content, so the outer -translate-y-1/2 centers THEM at the
          viewport middle. "Ask the Archive" (above) and "Liner Notes" (below) are floated
          out of flow, so their unequal heights never shift the dots off center. */}
      <div className="relative flex flex-col gap-3 items-center">
        {/* Ask the Archive — floated above the dots; a quiet peer of Liner Notes below */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col items-center gap-2.5">
          <a
            href="/ask"
            className="group flex items-center justify-center min-w-[44px]"
            aria-label="Ask the Archive"
            onClick={() => {
              haptics.light()
              analytics.trackEvent('ask_archive_nav_clicked', { surface: 'rail', from_scene: activeScene })
            }}
          >
            <span className="font-sans transition-colors duration-200" style={vLabel(railLabel)}>
              Ask the Archive
            </span>
          </a>
          <span aria-hidden="true" style={{ width: 18, height: 1, background: railEdge }} />
        </div>

        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={() => {
              // Single click navigates directly
              scrollToScene(scene.id)
            }}
            onMouseEnter={() => setRevealedLabel(scene.id)}
            onMouseLeave={() => setRevealedLabel(null)}
            className="group relative flex items-center justify-center min-w-[44px] min-h-[44px] touchable"
            aria-label={`Go to ${scene.label}`}
          >
            {/* Dot - visually smaller but larger touch target */}
            {/* Uses dark fill with white border for visibility on both light and dark backgrounds */}
            <motion.div
              className={`w-3 h-3 rounded-full transition-all duration-300 border-2 ${
                activeScene === scene.id
                  ? 'bg-slate-800 border-white scale-125'
                  : 'bg-slate-600 border-white/60 group-hover:bg-slate-700 group-hover:border-white'
              }`}
              animate={revealedLabel === scene.id ? { scale: 1.3 } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            />

            {/* Label on tap or hover */}
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{
                opacity: revealedLabel === scene.id ? 1 : 0,
                x: revealedLabel === scene.id ? 0 : 10
              }}
              transition={{ duration: 0.2 }}
              className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none"
            >
              {scene.label}
            </motion.span>

            {/* Also show on desktop hover */}
            <span className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none hidden md:block">
              {scene.label}
            </span>
          </button>
        ))}

        {/* Liner Notes — floated below the dots (mirrors the Ask block above) */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 flex flex-col items-center gap-2.5">
          <span aria-hidden="true" style={{ width: 18, height: 1, background: railEdge }} />
          <Link
            to="/liner-notes"
            className="group flex items-center justify-center min-w-[44px]"
            aria-label="Go to Liner Notes"
            onClick={() => analytics.trackEvent('liner_notes_nav_clicked', { from_scene: activeScene })}
          >
            <span className="font-sans transition-colors duration-200" style={vLabel(railLabel)}>
              Liner Notes
            </span>
          </Link>
        </div>
      </div>
    </motion.div>

    {/* Mobile bottom nav — mirrors desktop right-side nav, visible on small screens only */}
    <motion.nav
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2, duration: 0.8 }}
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      aria-label="Site navigation"
      style={{
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-center py-3" style={{ gap: 16 }}>
        {NAV_LINKS.map((link, i) => {
          const external = 'external' in link && link.external
          const cls = 'font-sans transition-colors duration-200 hover:text-white active:text-white'
          // Ask is a plain peer of the other links (matches the quiet rail treatment).
          const style = { fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)' }
          const onClick = () =>
            analytics.trackEvent(link.event, { from_scene: activeScene, ...(external ? { surface: 'mobile' } : {}) })
          return (
            <Fragment key={link.to}>
              {i > 0 && (
                <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, lineHeight: 1 }}>·</span>
              )}
              {external ? (
                <a href={link.to} className={cls} style={style} onClick={onClick}>{link.label}</a>
              ) : (
                <Link to={link.to} className={cls} style={style} onClick={onClick}>{link.label}</Link>
              )}
            </Fragment>
          )
        })}
      </div>
    </motion.nav>
  </>
  )
}
