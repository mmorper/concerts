import { useEffect, useRef, useState, Fragment, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
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
 * The rail takes its tone from the scene behind it (mocks: Scene Rail Mocks). Light on the white
 * Timeline, dark on the four dark scenes, and on Artists, where it sits over busy photos, one
 * frosted capsule behind the whole rail. Colours ride on CSS variables so a tone change cross-fades.
 */
type RailTone = 'light' | 'dark' | 'imagery'
const SCENE_TONE: Record<number, RailTone> = {
  [SCENE_MAP.timeline]: 'light',
  [SCENE_MAP.venues]: 'dark',
  [SCENE_MAP.geography]: 'dark',
  [SCENE_MAP.genres]: 'dark',
  [SCENE_MAP.artists]: 'imagery',
  [SCENE_MAP.ask]: 'dark',
}

const LIGHT_VARS = {
  '--rail-dot': '#64748b', // slate-500, 4.8:1 on white
  '--rail-icon': '#64748b',
  '--rail-on': '#0f172a',
  '--rail-hover-bg': 'rgba(255,255,255,0.85)',
  '--rail-hover-bd': '#e2e8f0',
} as CSSProperties
const DARK_VARS = {
  '--rail-dot': 'rgba(255,255,255,0.42)',
  '--rail-icon': 'rgba(255,255,255,0.7)',
  '--rail-on': '#ffffff',
  '--rail-hover-bg': 'rgba(255,255,255,0.12)',
  '--rail-hover-bd': 'rgba(255,255,255,0.22)',
} as CSSProperties

/** Search and More: a bare glyph at rest; a 28px disc appears only on hover or focus. */
const ICON_DISC =
  'w-7 h-7 rounded-full flex items-center justify-center border border-transparent text-[var(--rail-icon)] ' +
  'transition-colors duration-300 group-hover:text-[var(--rail-on)] group-hover:bg-[var(--rail-hover-bg)] ' +
  'group-hover:border-[var(--rail-hover-bd)] group-hover:backdrop-blur-sm group-focus-visible:text-[var(--rail-on)] ' +
  'group-focus-visible:bg-[var(--rail-hover-bg)] group-focus-visible:border-[var(--rail-hover-bd)]'

/** One label per item, shown on hover or keyboard focus. */
const LABEL =
  'absolute right-[50px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 ' +
  'transition-opacity duration-200 whitespace-nowrap font-sans text-xs font-semibold leading-none text-white ' +
  'px-[11px] py-[7px] rounded-lg pointer-events-none'
const LABEL_LIGHT: CSSProperties = { background: '#111827' }
// Dark scenes use the Ask glass, the same as the More menu.
const LABEL_GLASS: CSSProperties = {
  background: 'rgba(30,27,75,0.92)',
  border: '1px solid rgba(165,180,252,0.18)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
}

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
  const { openSpotlight } = useAsk()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)

  const tone = SCENE_TONE[activeScene] ?? 'dark'
  const light = tone === 'light'
  const labelStyle = light ? LABEL_LIGHT : LABEL_GLASS
  // Reduced motion: the pill cross-fades into place instead of sliding (design-system rule 1).
  const reduceMotion = useReducedMotion()

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

  useEffect(() => {
    if (isScrolling) setMenuOpen(false)
  }, [isScrolling])

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
      style={light ? LIGHT_VARS : DARK_VARS}
    >
      {/* The dots are the flow content, so the outer -translate-y-1/2 centers THEM at the
          viewport middle. Search (above) and More (below) are floated out of flow, so their
          heights never shift the dots off center. */}
      <div className="relative flex flex-col items-center w-11">
        {/* Over the Artists photos: one frosted capsule behind the whole rail, Search to More
            (40px icon row + 4px margin + 4px padding at each end). Fades with the tone. */}
        <div
          aria-hidden="true"
          className="absolute -top-12 -bottom-12 left-0 w-11 rounded-[22px] pointer-events-none transition-opacity duration-300"
          style={{
            opacity: tone === 'imagery' ? 1 : 0,
            background: 'rgba(15,23,42,0.45)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        />

        {/* Search: opens Ask's ⌘K panel where you are. The sixth dot is the way to the Ask scene;
            this is the way to ask from anywhere. */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex flex-col items-center">
          <button
            type="button"
            className="group relative flex items-center justify-center w-11 h-10"
            aria-label="Ask the Archive (⌘K)"
            onClick={() => openSpotlight('rail')}
          >
            <span className={ICON_DISC} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
              </svg>
            </span>
            <span className={LABEL} style={labelStyle}>
              Ask the Archive <span style={{ opacity: 0.6, marginLeft: 6 }}>⌘K</span>
            </span>
          </button>
        </div>

        {scenes.map((scene) => {
          const isActive = activeScene === scene.id
          return (
            <button
              key={scene.id}
              onClick={() => scrollToScene(scene.id)}
              className="group relative flex items-center justify-center w-11 h-[34px] touchable"
              aria-label={`Go to ${scene.label}`}
              aria-current={isActive ? 'location' : undefined}
            >
              {isActive ? (
                // The active marker is a pill that slides between positions as the scene changes.
                reduceMotion ? (
                  <motion.span
                    key={scene.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="block w-1.5 h-5 rounded-[3px] bg-[var(--rail-on)] transition-colors duration-300"
                  />
                ) : (
                  <motion.span
                    layoutId="scene-rail-active"
                    className="block w-1.5 h-5 rounded-[3px] bg-[var(--rail-on)] transition-colors duration-300"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )
              ) : (
                <span className="block w-[7px] h-[7px] rounded-full bg-[var(--rail-dot)] group-hover:bg-[var(--rail-on)] group-focus-visible:bg-[var(--rail-on)] transition-colors duration-300" />
              )}
              <span className={LABEL} style={labelStyle}>
                {scene.label}
              </span>
            </button>
          )
        })}

        {/* More: the pages about the site, behind one quiet mark (no text on the rail). */}
        <div
          ref={menuRef}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 flex flex-col items-center"
          onBlur={(e) => {
            // Tabbing past the last item closes the menu, so focus never sits outside an open menu.
            // A blur with no relatedTarget (Safari, on a mouse click) is left to the outside-click
            // handler, so it can't close the menu before a click on one of its links lands.
            const next = e.relatedTarget as Node | null
            if (menuOpen && next && !menuRef.current?.contains(next)) setMenuOpen(false)
          }}
        >
          <button
            ref={moreButton}
            type="button"
            className="group relative flex items-center justify-center w-11 h-10"
            aria-label="More: Liner Notes, How It Works, What's Playing, About"
            aria-expanded={menuOpen}
            aria-controls="site-more-menu"
            onClick={() => {
              if (!menuOpen) analytics.trackEvent('site_menu_opened', { from_scene: activeScene })
              setMenuOpen((o) => !o)
            }}
          >
            <span className={`${ICON_DISC} gap-[2.5px]`} aria-hidden="true">
              {[0, 1, 2].map((k) => (
                <span key={k} className="block w-[3px] h-[3px] rounded-full bg-current" />
              ))}
            </span>
            {!menuOpen && (
              <span className={LABEL} style={labelStyle}>
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
