/**
 * The Honesty Ladder: what the screen is allowed to say.
 *
 * The screen asks its questions in order and stops at the first yes. Pick a record and the page
 * runs the TV's real lookup against the published archive, walks down the ladder, and shows the
 * screen the TV would show. Nothing here is written for the page: if the archive can't be
 * reached, the ladder lands on its first rung, which is exactly what that rung is for.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Track } from '../../../../workers/now-spinning/src/types'
import { analytics } from '../../../services/analytics'
import { useReducedMotion } from '../shared'
import { ask, EXAMPLES, rungOf, RUNG_ORDER, siteLoader, type RungId, type SeenWording } from './ladder'

const PINK = '#f472b6'

const RUNGS: Record<RungId, { q: string; rule: string }> = {
  unknown: {
    q: 'The archive can’t be reached.',
    rule: 'Show the song and nothing else. Don’t guess.',
  },
  heard: {
    q: 'I saw this band play this song.',
    rule: 'Say how many times, and list the concerts. Opening acts count too.',
  },
  'seen-cover': {
    q: 'I saw this band, but I heard someone else play this song.',
    rule: 'Say who played it.',
  },
  seen: {
    q: 'I saw this band, but this song isn’t on their setlists.',
    rule: 'Choose the words carefully. It depends on what the setlists can prove:',
  },
  'cover-of-this': {
    q: 'I never saw this band, but I heard someone else play this song.',
    rule: 'Say who played it, and when.',
  },
  covers: {
    q: 'I never saw this band, but I heard other bands play some of their songs.',
    rule: 'Say how many of their songs I’ve heard that way.',
  },
  none: {
    q: 'None of the above.',
    rule: 'Say “Not in the archive. Yet.”',
  },
}

const WORDINGS: { id: SeenWording; when: string; says: string }[] = [
  { id: 'near', when: 'A similar title is on a setlist.', says: 'Name it. Don’t say “heard” or “never heard.”' },
  { id: 'never', when: 'Every one of those concerts has a setlist.', says: 'Only then is it safe to say “never heard this one live.”' },
  { id: 'maybe', when: 'At least one concert has no setlist.', says: 'Say “maybe you did.”' },
]

export function HonestyLadder() {
  const reduced = useReducedMotion()
  const load = useMemo(() => siteLoader(), [])
  const [sel, setSel] = useState(0)
  const [track, setTrack] = useState<Track | null>(null)
  const [walk, setWalk] = useState<number>(RUNG_ORDER.length) // how many rungs have been asked
  const runId = useRef(0)
  const figure = useRef<HTMLElement>(null)
  const started = useRef(false)
  const [touched, setTouched] = useState(false) // has the reader picked a record yet?

  const run = async (i: number, animate: boolean) => {
    started.current = true
    const id = ++runId.current
    setSel(i)
    setTrack(null)
    setWalk(animate && !reduced ? 0 : RUNG_ORDER.length)
    const ex = EXAMPLES[i]
    const t = await ask({ artist: ex.artist, title: ex.title, album: ex.album, artworkUrl: ex.artworkUrl }, load)
    if (id !== runId.current) return
    setTrack(t)
  }

  // Royal Blood, the record in the photo, plays out once when the ladder first scrolls into view,
  // so the reader sees the steps decide before being asked to click anything.
  useEffect(() => {
    const el = figure.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      run(0, false)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        if (!started.current) run(0, true)
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pick = (i: number, surface: 'chip' | 'hint') => {
    setTouched(true)
    analytics.trackEvent('how_it_works_example_selected', { chapter: 'now-spinning', example: EXAMPLES[i].label, surface })
    run(i, true)
  }
  const NEXT = 1 // Barrel of a Gun: the same kind of question, a very different answer

  const hit = track ? rungOf(track) : null
  const hitIdx = hit ? RUNG_ORDER.indexOf(hit.rung) : -1

  // Walk down the ladder one rung at a time until the hit.
  useEffect(() => {
    if (!track || walk > hitIdx) return
    const t = window.setTimeout(() => setWalk((w) => w + 1), 420)
    return () => window.clearTimeout(t)
  }, [track, walk, hitIdx])

  const settled = track !== null && walk > hitIdx

  return (
    <figure ref={figure} className="hiw-figure" aria-labelledby="ladder-cap">
      <div className="px-4 sm:px-6 pt-5">
        <div className="hiw-step mb-3" style={{ color: 'var(--hiw-ink-3)' }}>
          Pick a record
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Example records">
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex.title}
              type="button"
              className="hiw-chip"
              aria-pressed={sel === i}
              onClick={() => pick(i, 'chip')}
            >
              {ex.label}
              <small>{ex.artist}</small>
            </button>
          ))}
        </div>
        {/* One invitation, once: the most instructive next pick. Gone after the first click. */}
        {/* Space kept for the line, so the ladder doesn't jump when it appears or goes. */}
        <div style={{ minHeight: 34 }}>
        {settled && !touched && sel === 0 && (
          <p className="font-sans pt-3" style={{ fontSize: 15, color: 'var(--hiw-ink-2)', animation: 'hiw-pop 0.5s ease 1s both' }}>
            Now try{' '}
            <button
              type="button"
              onClick={() => pick(NEXT, 'hint')}
              className="font-semibold underline underline-offset-4"
              style={{ color: 'var(--hiw-ink)', textDecorationColor: 'var(--hiw-dot)' }}
            >
              {EXAMPLES[NEXT].label}
            </button>
            : a band I’ve seen, but a very different answer.
          </p>
        )}
        </div>
      </div>

      <ol className="px-4 sm:px-6 py-6" style={{ listStyle: 'none' }}>
        {RUNG_ORDER.map((id, i) => {
          const asked = track !== null && i < walk
          const isHit = settled && i === hitIdx
          const passed = asked && i < hitIdx
          const pending = track === null || i >= walk || (settled && i > hitIdx)
          return (
            <li key={id} className="relative" style={{ paddingLeft: 40, paddingBottom: i === RUNG_ORDER.length - 1 ? 0 : 14 }}>
              {/* The rail */}
              {i < RUNG_ORDER.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 13,
                    top: 30,
                    bottom: 0,
                    width: 2,
                    background: passed ? 'rgba(165,180,252,0.55)' : 'rgba(165,180,252,0.15)',
                    transition: 'background 300ms',
                  }}
                />
              )}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 2,
                  top: 4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: isHit ? PINK : passed ? 'rgba(165,180,252,0.18)' : '#0a0e26',
                  border: `1.5px solid ${isHit ? PINK : passed ? 'rgba(165,180,252,0.6)' : 'rgba(165,180,252,0.3)'}`,
                  boxShadow: isHit ? '0 0 16px rgba(244,114,182,0.7)' : undefined,
                  transition: 'all 300ms',
                }}
              >
                {isHit ? <Check size={14} color="#fff" strokeWidth={3} /> : passed ? <X size={12} color="#a5b4fc" strokeWidth={3} /> : null}
              </span>

              <div
                className="hiw-rung"
                style={{
                  opacity: pending ? 0.55 : passed ? 0.5 : 1,
                  borderRadius: 14,
                  padding: isHit ? '12px 14px 14px' : '4px 0',
                  marginLeft: isHit ? -6 : 0,
                  background: isHit ? 'rgba(244,114,182,0.07)' : 'transparent',
                  border: `1px solid ${isHit ? 'rgba(244,114,182,0.35)' : 'transparent'}`,
                }}
              >
                <div className="font-sans" style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--hiw-ink)', lineHeight: 1.4 }}>
                  {RUNGS[id].q}
                  {passed && <span className="sr-only"> Not true.</span>}
                  {isHit && <span className="sr-only"> True: this is what the screen says.</span>}
                </div>
                <div className="font-sans mt-1" style={{ fontSize: 14.5, color: 'var(--hiw-ink-2)', lineHeight: 1.55 }}>
                  {RUNGS[id].rule}
                </div>
                {id === 'seen' && (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-3" style={{ listStyle: 'none' }}>
                    {WORDINGS.map((w) => {
                      const on = isHit && hit?.wording === w.id
                      return (
                        <li
                          key={w.id}
                          className="font-sans"
                          style={{
                            fontSize: 13.5,
                            lineHeight: 1.45,
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: `1px solid ${on ? PINK : 'rgba(165,180,252,0.2)'}`,
                            background: on ? 'rgba(244,114,182,0.12)' : 'rgba(255,255,255,0.03)',
                            color: 'var(--hiw-ink-2)',
                            transition: 'all 300ms',
                          }}
                        >
                          <span style={{ color: 'var(--hiw-ink)', fontWeight: 600 }}>{w.when}</span> {w.says}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {/* The answer lands on the screen, in the step that decided it. */}
                {isHit && track && <TvScreen key={sel} track={track} />}
              </div>
            </li>
          )
        })}
      </ol>

      <figcaption id="ladder-cap" className="hiw-figcaption px-4 sm:px-6 pb-5" aria-live="polite">
        {settled
          ? hit?.rung === 'unknown' && EXAMPLES[sel].expect !== 'unknown'
            ? 'The archive didn’t answer just now, so the screen would show only the song. That’s the first rule doing its job.'
            : 'This is a live answer. The page just ran the same lookup as the TV, on the same archive.'
          : 'Asking the archive…'}
      </figcaption>
    </figure>
  )
}

/**
 * The real TV screen: public/now-spinning.html in ?embed mode, the web twin of the tvOS app,
 * drawn from the same state. It is framed rather than copied, so any change to the screen's
 * design shows here too. It appears inside the step that matched, once the ladder has settled,
 * and stays hidden until it has painted, so the idle screen never flashes.
 */
const SCREEN_URL = import.meta.env.DEV ? '/now-spinning.html?embed' : '/now-spinning?embed'

function TvScreen({ track }: { track: Track }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [painted, setPainted] = useState(false)

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin === location.origin && e.source === frame.current?.contentWindow && e.data?.type === 'now-spinning:ready') setReady(true)
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [])

  useEffect(() => {
    if (!ready) return
    const now = new Date().toISOString()
    frame.current?.contentWindow?.postMessage(
      // Mirrored: the sleeve on the right, as on the TV in the photo at the top of the page.
      { type: 'now-spinning:show', mirrored: true, state: { v: 1, kind: 'track', at: now, now, track } },
      location.origin,
    )
    // Two frames: the message is handled, then the screen has drawn.
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setPainted(true))))
    return () => cancelAnimationFrame(id)
  }, [ready, track])

  return (
    <div className={`mt-4 hiw-land${painted ? ' is-in' : ''}`}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#0b0918',
          border: '6px solid #05060d',
          outline: '1px solid rgba(165,180,252,0.22)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.45), 0 0 80px rgba(59,130,246,0.12)',
        }}
      >
        <iframe
          ref={frame}
          src={SCREEN_URL}
          title="The Now Spinning TV screen"
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: 'none' }}
        />
      </div>
      {/* The screen's words, readable on a phone (where the TV is too small) and by a screen reader. */}
      <div className="mt-3 sm:sr-only">
        <p className="font-sans" style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--hiw-ink-2)' }}>
          <span style={{ color: 'var(--hiw-ink)', fontWeight: 600 }}>
            {track.title}, {track.artist}.
          </span>{' '}
          {track.headline} {track.lines.join(' ')}
        </p>
      </div>
    </div>
  )
}
