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

  const run = async (i: number, animate: boolean) => {
    const id = ++runId.current
    setSel(i)
    setTrack(null)
    setWalk(animate && !reduced ? 0 : RUNG_ORDER.length)
    const ex = EXAMPLES[i]
    const t = await ask({ artist: ex.artist, title: ex.title }, load)
    if (id !== runId.current) return
    setTrack(t)
  }

  useEffect(() => {
    run(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    <figure className="hiw-figure" aria-labelledby="ladder-cap">
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
              onClick={() => {
                analytics.trackEvent('how_it_works_example_selected', { chapter: 'now-spinning', example: ex.label })
                run(i, true)
              }}
            >
              {ex.label}
              <small>{ex.artist}</small>
            </button>
          ))}
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
                {isHit && track && <TvCard t={track} />}
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

function TvCard({ t }: { t: Track }) {
  const photos = t.photos.slice(0, 3)
  return (
    <div
      className="mt-4"
      style={{
        borderRadius: 12,
        padding: '16px 18px',
        background: `radial-gradient(400px 200px at 85% 0%, hsl(${t.accentHue} 70% 35% / 0.45), transparent 70%), linear-gradient(160deg, #0d1b4d, #081032)`,
        border: '1px solid rgba(96,165,250,0.35)',
        animation: 'hiw-pop 0.4s ease both',
      }}
    >
      <div className="hiw-kicker" style={{ fontSize: 10, letterSpacing: '0.22em' }}>
        <span className="hiw-dot" style={{ width: 7, height: 7 }} aria-hidden="true" />
        Now spinning
      </div>
      <div className="flex gap-4 items-start mt-2">
        {t.count && (
          <div className="hiw-title shrink-0" style={{ fontSize: 46, lineHeight: 1, color: '#fff' }} aria-hidden="true">
            {t.count.n}
            {t.count.times && <span style={{ fontSize: 22, color: '#a5b4fc' }}>×</span>}
          </div>
        )}
        <div className="min-w-0">
          <div className="hiw-title" style={{ fontSize: 22, color: '#fff' }}>
            {t.title}
          </div>
          <div className="font-sans" style={{ fontSize: 14, color: '#c7d2fe' }}>
            {t.artist}
            {t.album ? ` · ${t.album.title}${t.album.year ? `, ${t.album.year}` : ''}` : ''}
          </div>
        </div>
      </div>
      <p className="font-sans mt-3" style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>
        {t.headline}
      </p>
      {t.lines.map((l) => (
        <p key={l} className="font-sans mt-1" style={{ fontSize: 14, color: '#c7d2fe', lineHeight: 1.5 }}>
          {l}
        </p>
      ))}
      {t.nights.length > 0 && (
        <ul className="mt-3 font-sans" style={{ listStyle: 'none', fontSize: 13.5, color: '#dbe2ff' }}>
          {t.nights.slice(0, 3).map((n) => (
            <li key={n.date + n.text} className="flex gap-3" style={{ lineHeight: 1.7 }}>
              <span style={{ fontWeight: 600, minWidth: 92, flex: 'none' }}>{n.dateLabel}</span>
              <span className="min-w-0" style={{ color: '#b9c0e8' }}>
                {n.text}
              </span>
            </li>
          ))}
          {t.nights.length + t.moreNights > 3 && <li style={{ color: '#8189b5' }}>+ {t.nights.length + t.moreNights - 3} more</li>}
        </ul>
      )}
      {photos.length > 0 && (
        <div className="flex gap-2 mt-3">
          {photos.map((p) => (
            <img
              key={p.url}
              src={p.url}
              alt={p.caption}
              loading="lazy"
              style={{
                width: 64,
                height: 80,
                objectFit: 'cover',
                objectPosition: `${Math.round(p.fx * 100)}% ${Math.round(p.fy * 100)}%`,
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
