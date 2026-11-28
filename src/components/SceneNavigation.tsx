import { useEffect, useRef, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { haptics } from '../utils/haptics'
import { analytics } from '../services/analytics'
import { useActiveScene } from '../hooks/useActiveScene'
import { SCENE_MAP } from './changelog/constants'
import { useAsk } from './ask/AskProvider'

const NAV_LINKS = [
  // Ask leads (#142). Like the rail's scene dots it's a button that scrolls to its scene, not a
  // navigation. The /?scene=ask URL is addressable on its own (App.tsx deep-links it; /ask
  // redirects to it), so CTAs/shared links don't need this to be an anchor.
  { to: '/ask', label: 'Ask', event: 'ask_archive_nav_clicked', ask: true },
  { to: '/liner-notes', label: 'Liner Notes', event: 'liner_notes_nav_clicked' },
  { to: '/how-it-works', label: 'How It Works', event: 'how_it_works_nav_clicked' },
  { to: '/about', label: 'About', event: 'about_nav_clicked' },
] as const

/** The desktop rail's "more" menu: the pages about the site. */
const MORE_LINKS = [
  { to: '/liner-notes', label: 'Liner Notes', note: 'Stories from the archive', event: 'liner_notes_nav_clicked' },
  { to: '/how-it-works', label: 'How It Works', note: 'The machinery, explained', event: 'how_it_works_nav_clicked' },
  { to: '/whats-playing', label: "What's Playing", note: 'What changed, and when', event: 'whats_playing_nav_clicked' },
  { to: '/about', label: 'About', note: 'Who, and why', event: 'about_nav_clicked' },
] as const

// Ask is the last scene (from the canonical roster). It is the sixth dot; the magnifier opens its ⌘K panel.
const ASK_SCENE = SCENE_MAP.ask

/**
 * Every rail item is a disc: a dark fill inside a white ring, like the scene dots. That reads on
 * the white timeline, the dark scenes and the busy artist cards alike, where a bare grey glyph
 * disappeared.
 */
const DISC = 'w-[22px] h-[22px] rounded-full flex items-center justify-center border-[1.5px] border-white/60 group-hover:border-white transition-colors duration-200'
const DISC_FILL = 'rgba(30,41,59,0.85)'

const scenes = [
  { id: 1, label: 'Timeline' },
  { id: 2, label: 'Venues' },
  { id: 3, label: 'Map' },
  { id: 4, label: 'Genres' },
  { id: 5, label: 'Artists' },
  { id: 6, label: 'Ask the Archive' },
]

export function SceneNavigation() {
  // Shared scroll observer (#142) — the rail and the wayfinding dock read the same source so they
  // can never disagree on the active scene.
  const { scene: activeScene, isScrolling } = useActiveScene({ sceneCount: ASK_SCENE })
  const [revealedLabel, setRevealedLabel] = useState<number | null>(null)
  const { openSpotlight } = useAsk()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)

  // The "more" menu closes on Escape (returning focus to its button), on a click outside it, and
  // when a scroll starts.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        moreButton.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [menuOpen])

  // Dismiss any revealed dot-label as soon as the user starts scrolling.
  useEffect(() => {
    if (isScrolling) {
      setRevealedLabel(null)
      setMenuOpen(false)
    }
  }, [isScrolling])

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
      {/* The dots are the flow content, so the outer -translate-y-1/2 centers THEM at the
          viewport middle. "Ask the Archive" (above) and "Liner Notes" (below) are floated out of
          flow, so their unequal heights never shift the dots off center. */}
      <div className="relative flex flex-col gap-3 items-center">
        {/* Search: opens Ask's ⌘K panel where you are. The sixth dot is the way to the Ask scene;
            this is the way to ask from anywhere. Floated out of flow, like the menu below, so the
            dots stay centred on the viewport. */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex flex-col items-center">
          <button
            type="button"
            className="group relative flex items-center justify-center min-w-[44px] min-h-[40px]"
            aria-label="Ask the Archive (⌘K)"
            onClick={() => openSpotlight('rail')}
          >
            <span className={DISC} style={{ background: DISC_FILL }} aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
              </svg>
            </span>
            <span className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none">
              Ask the Archive <span style={{ opacity: 0.6, marginLeft: 6 }}>⌘K</span>
            </span>
          </button>
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

        {/* More: the pages about the site, behind one quiet mark (no text on the rail). */}
        <div ref={menuRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-3 flex flex-col items-center">
          <button
            ref={moreButton}
            type="button"
            className="group relative flex items-center justify-center min-w-[44px] min-h-[36px]"
            aria-label="More: Liner Notes, How It Works, What's Playing, About"
            aria-expanded={menuOpen}
            aria-controls="site-more-menu"
            onClick={() => {
              if (!menuOpen) analytics.trackEvent('site_menu_opened', { from_scene: activeScene })
              setMenuOpen((o) => !o)
            }}
          >
            <span className={`${DISC} gap-[2px]`} style={{ background: DISC_FILL }} aria-hidden="true">
              {[0, 1, 2].map((k) => (
                <span key={k} style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: '#fff' }} />
              ))}
            </span>
            {!menuOpen && (
              <span className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none">
                More
              </span>
            )}
          </button>
          {menuOpen && (
            <motion.nav
              id="site-more-menu"
              aria-label="More"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.3, 1] }}
              className="absolute right-12 bottom-0 w-60 rounded-2xl p-2"
              style={{
                background: 'rgba(30,27,75,0.92)',
                border: '1px solid rgba(165,180,252,0.18)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
              }}
            >
              {MORE_LINKS.map((m) => (
                <Link
                  key={m.to}
                  to={m.to}
                  className="block rounded-xl px-3 py-2.5 hover:bg-white/10 focus-visible:bg-white/10 outline-none transition-colors"
                  onClick={() => {
                    analytics.trackEvent(m.event, { from_scene: activeScene, surface: 'menu' })
                    setMenuOpen(false)
                  }}
                >
                  <span className="block font-sans text-sm font-semibold text-white">{m.label}</span>
                  <span className="block font-sans text-xs" style={{ color: 'rgba(199,210,254,0.7)' }}>
                    {m.note}
                  </span>
                </Link>
              ))}
            </motion.nav>
          )}
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
          const isAsk = 'ask' in link && link.ask
          const cls = 'font-sans transition-colors duration-200 hover:text-white active:text-white'
          // Ask is a plain peer of the other links (matches the quiet rail treatment).
          const style = { fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)' }
          const onClick = () => {
            analytics.trackEvent(link.event, {
              from_scene: activeScene,
              ...(isAsk ? { surface: 'navmobile' } : external ? { surface: 'mobile' } : {}),
            })
            // Ask goes to the Ask scene, the same as the desktop rail.
            if (isAsk) scrollToScene(ASK_SCENE)
          }
          return (
            <Fragment key={link.to}>
              {i > 0 && (
                <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, lineHeight: 1 }}>·</span>
              )}
              {isAsk ? (
                <button type="button" className={cls} style={{ ...style, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={onClick}>
                  {link.label}
                </button>
              ) : external ? (
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
