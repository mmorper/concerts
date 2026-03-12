import { useEffect, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { haptics } from '../utils/haptics'
import { analytics } from '../services/analytics'

const NAV_LINKS = [
  { to: '/liner-notes', label: 'Liner Notes', event: 'liner_notes_nav_clicked' },
  { to: '/whats-playing', label: "What's Playing", event: 'whats_playing_nav_clicked' },
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

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 2, duration: 0.8 }}
      className="fixed right-8 top-1/2 -translate-y-1/2 z-40 hidden md:block"
    >
      <div className="flex flex-col gap-3">
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

        {/* Liner Notes link — separated from scene dots */}
        <div
          className="flex flex-col items-center"
          style={{
            borderTop: `1px solid ${[1, 5].includes(activeScene) ? 'rgba(30,41,59,0.15)' : 'rgba(255,255,255,0.1)'}`,
            paddingTop: 10,
            marginTop: 4,
          }}
        >
          <Link
            to="/liner-notes"
            className="group relative flex items-center justify-center min-w-[44px] min-h-[44px]"
            aria-label="Go to Liner Notes"
            onClick={() => analytics.trackEvent('liner_notes_nav_clicked', { from_scene: activeScene })}
          >
            <span
              className="font-sans transition-colors duration-200"
              style={{
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: [1, 5].includes(activeScene) ? 'rgba(30,41,59,0.55)' : 'rgba(255,255,255,0.4)',
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                lineHeight: 1,
              }}
            >
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
        {NAV_LINKS.map(({ to, label, event }, i) => (
          <Fragment key={to}>
            {i > 0 && (
              <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, lineHeight: 1 }}>·</span>
            )}
            <Link
              to={to}
              className="font-sans transition-colors duration-200 hover:text-white active:text-white"
              style={{ fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}
              onClick={() => analytics.trackEvent(event, { from_scene: activeScene })}
            >
              {label}
            </Link>
          </Fragment>
        ))}
      </div>
    </motion.nav>
  </>
  )
}
