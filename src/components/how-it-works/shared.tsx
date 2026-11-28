import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { analytics } from '../../services/analytics'
import { ALSO, CHAPTERS } from './chapters'
import './how-it-works.css'

/** True while a media query matches. Starts from the real value, so the first paint is right. */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')

/** Sets the tab title while the page is open. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const before = document.title
    document.title = title
    return () => {
      document.title = before
    }
  }, [title])
}

/**
 * "Under the hood": the engineering detail, folded away so the story reads straight through.
 * A native <details>, so it works with the keyboard and a screen reader with no extra wiring.
 */
export function Hood({ chapter, id, title, children }: { chapter: string; id: string; title: string; children: ReactNode }) {
  return (
    <details
      className="hiw-hood"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) {
          analytics.trackEvent('how_it_works_hood_opened', { chapter, section: id })
        }
      }}
    >
      <summary>
        <span className="hiw-hood-tag">Under the hood</span>
        <span>{title}</span>
        <ChevronRight className="hiw-hood-chev" size={18} aria-hidden="true" />
      </summary>
      <div className="hiw-hood-body">{children}</div>
    </details>
  )
}

/** The footer every chapter shares: the other chapters, and the way back to the landing page. */
export function MoreChapters({ current }: { current: string }) {
  const others = CHAPTERS.filter((c) => c.id !== current)
  return (
    <section
      aria-labelledby="hiw-more"
      className="hiw"
      style={{ background: 'transparent', padding: '56px 20px 72px', position: 'relative', zIndex: 2 }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ height: 1, background: 'var(--hiw-line)', marginBottom: 40 }} />
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
          <h2 id="hiw-more" className="hiw-kicker">
            More from How It Works
          </h2>
          <Link
            to="/how-it-works"
            className="font-sans text-sm"
            style={{ color: 'var(--hiw-lav)' }}
            onClick={() => analytics.trackEvent('how_it_works_chapter_clicked', { chapter: 'index', surface: `footer:${current}` })}
          >
            All chapters →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {others.map((c) => (
            <Link
              key={c.id}
              to={c.path}
              className="hiw-card p-5"
              onClick={() => analytics.trackEvent('how_it_works_chapter_clicked', { chapter: c.id, surface: `footer:${current}` })}
            >
              <div className="hiw-title" style={{ fontSize: 22, color: 'var(--hiw-ink)' }}>
                {c.title}
              </div>
              <p className="font-sans mt-2" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--hiw-ink-2)' }}>
                {c.dek}
              </p>
            </Link>
          ))}
          {ALSO.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="hiw-card p-5"
              onClick={() => analytics.trackEvent('how_it_works_chapter_clicked', { chapter: a.href.slice(1), surface: `footer:${current}` })}
            >
              <div className="hiw-title" style={{ fontSize: 22, color: 'var(--hiw-ink)' }}>
                {a.title}
              </div>
              <p className="font-sans mt-2" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--hiw-ink-2)' }}>
                {a.dek}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/** A chapter section: an optional step label, a heading, then its content. */
export function Section({ id, step, title, children }: { id: string; step?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-20 sm:mt-24">
      {step && (
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-dot)' }}>
          {step}
        </div>
      )}
      <h2 id={`${id}-h`} className="hiw-h2 mb-6">
        {title}
      </h2>
      {children}
    </section>
  )
}

export const Prose = ({ children }: { children: ReactNode }) => <div className="hiw-prose">{children}</div>
/** Diagrams break out of the text column on wider screens. */
/**
 * A chapter's opening: "How It Works · Chapter n", its title and its subtitle. One size for every
 * chapter (they are long-form articles, so their title is larger than an index page's PageHeader).
 * The title and the number come from the chapter list, so a new chapter is numbered and sized
 * like the others.
 */
export function ChapterHeader({ id, dek }: { id: string; dek: ReactNode }) {
  const index = CHAPTERS.findIndex((c) => c.id === id)
  const chapter = CHAPTERS[index]
  return (
    <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
      <div className="hiw-kicker mb-5">
        <span className="hiw-dot" aria-hidden="true" />
        How It Works · Chapter {index + 1}
      </div>
      <h1 className="hiw-title" style={{ fontSize: 'clamp(40px, 7vw, 64px)' }}>
        {chapter?.title}
      </h1>
      <p className="hiw-dek font-sans mt-4" style={{ fontSize: 'clamp(19px, 2.4vw, 22px)', lineHeight: 1.5, color: 'var(--hiw-ink-2)' }}>
        {dek}
      </p>
    </motion.header>
  )
}

export const Wide = ({ children }: { children: ReactNode }) => <div className="my-10 -mx-1 sm:-mx-8 lg:-mx-24">{children}</div>

/**
 * How long a step stays up while a diagram plays: long enough to read its caption at an easy
 * pace (about 16 characters a second, plus a moment to look at the picture), never shorter than
 * the step's own minimum.
 */
export function readingTime(caption: string, minimum = 0): number {
  return Math.max(minimum, 1600 + caption.length * 62)
}

/** Back · Pause/Resume · Next, with "Step n of m", for a diagram that plays through steps. */
export function StepControls({
  index,
  total,
  paused,
  onBack,
  onToggle,
  onNext,
  returnFocusTo,
}: {
  index: number
  total: number
  paused: boolean
  onBack: () => void
  onToggle: () => void
  onNext: () => void
  /** Where keyboard focus goes when playback ends and these controls disappear. */
  returnFocusTo?: RefObject<HTMLElement>
}) {
  const group = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = group.current
    return () => {
      // If focus was on one of these buttons, move it to the play button rather than drop it on <body>.
      if (el?.contains(document.activeElement)) requestAnimationFrame(() => returnFocusTo?.current?.focus())
    }
  }, [returnFocusTo])
  const btn = 'font-sans text-sm px-3 min-h-[36px] rounded-full transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300 disabled:opacity-40'
  return (
    <div ref={group} className="flex flex-wrap items-center gap-2 mt-2" role="group" aria-label="Playback">
      <button type="button" className={btn} onClick={onBack} disabled={index === 0} style={{ color: 'var(--hiw-ink-2)' }}>
        ← Back
      </button>
      <button type="button" className={btn} onClick={onToggle} style={{ color: 'var(--hiw-ink)', border: '1px solid var(--hiw-panel-line)' }}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className={btn} onClick={onNext} style={{ color: 'var(--hiw-ink-2)' }}>
        {index === total - 1 ? 'Finish →' : 'Next →'}
      </button>
      <span className="font-sans ml-auto" style={{ fontSize: 12.5, color: 'var(--hiw-ink-3)' }}>
        Step {index + 1} of {total}
      </span>
    </div>
  )
}
