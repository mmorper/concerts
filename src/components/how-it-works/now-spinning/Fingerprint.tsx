/**
 * The Fingerprint: how twelve seconds of a record become a song name.
 *
 * 1. Listen: the clip drawn as a spectrogram (time across, pitch up, brightness is loudness).
 * 2. Peaks: keep only the loudest points. They survive surface noise and a worn needle.
 * 3. Send: only that pattern of dots crosses the house wall. No audio leaves (spec §Privacy:
 *    shazamio-core makes the signature on the Pi and the request carries only that).
 * 4. Match: Shazam slides the pattern along the songs it knows until the dots line up. Pitch has
 *    to agree exactly; time is free to slide, which is why any 12 seconds of the song will do.
 *
 * Conceptual, not a plot of the real signature: the dots are generated, the idea is real.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { analytics } from '../../../services/analytics'
import { readingTime, useMediaQuery, useReducedMotion } from '../shared'

interface Box {
  x: number
  y: number
  w: number
  h: number
}
interface Geo {
  w: number
  h: number
  clip: Box
  strip: Box
  wall: { x1: number; y1: number; x2: number; y2: number }
  piLabel: { x: number; y: number }
  shazamLabel: { x: number; y: number }
  wallLabel: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; rotate?: number }
}

const WIDE: Geo = {
  w: 1000,
  h: 440,
  clip: { x: 70, y: 92, w: 370, h: 280 },
  strip: { x: 560, y: 122, w: 400, h: 220 },
  wall: { x1: 500, y1: 40, x2: 500, y2: 410 },
  piLabel: { x: 70, y: 48 },
  shazamLabel: { x: 560, y: 48 },
  wallLabel: { x: 508, y: 410, anchor: 'start' },
}

const NARROW: Geo = {
  w: 400,
  h: 740,
  clip: { x: 48, y: 80, w: 322, h: 240 },
  strip: { x: 30, y: 476, w: 340, h: 220 },
  wall: { x1: 16, y1: 394, x2: 384, y2: 394 },
  piLabel: { x: 24, y: 40 },
  shazamLabel: { x: 24, y: 438 },
  wallLabel: { x: 384, y: 386, anchor: 'end' },
}

/** How much of the strip (the whole song) the 12-second pattern covers, and where it fits. */
const SPAN = 0.3
const AT = 0.52

const WARM = '#f6b26b'
const COOL = '#7dd3fc'
const PINK = '#f472b6'

const STAGES = [
  {
    label: 'Listen',
    caption:
      'The Pi records 12 seconds of the song. Here it’s drawn as a picture: time goes left to right, pitch goes bottom to top, and brighter means louder.',
  },
  {
    label: 'Find the peaks',
    caption: 'The Pi keeps only the loudest points, called peaks. Peaks stay the same even with surface noise or a worn needle.',
  },
  {
    label: 'Send the pattern',
    caption: 'Only this pattern of dots is sent to Shazam. The sound itself stays in the house.',
  },
  {
    label: 'Find the match',
    caption:
      'Shazam slides the pattern along the songs it knows until the dots line up. When they do, it has found the song. That’s why any 12 seconds of a song will work.',
  },
]

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Pt {
  u: number
  v: number
}

function useStars() {
  return useMemo(() => {
    const r = rng(0x5eed)
    // Pitches the song keeps returning to (a key, a bass line), so the peaks band like real music.
    const lines = [0.14, 0.27, 0.38, 0.52, 0.61, 0.74, 0.86]
    const peaks: Pt[] = []
    for (let i = 0; i < 30; i++) {
      const u = 0.03 + (i / 30) * 0.94 + (r() - 0.5) * 0.03
      const v = lines[Math.floor(r() * lines.length)] + (r() - 0.5) * 0.05
      peaks.push({ u, v })
    }
    // The catalogue's copy of the whole song: its own peaks everywhere, ours embedded at AT.
    const song: Pt[] = []
    for (let i = 0; i < 70; i++) {
      const u = r()
      if (u > AT - 0.01 && u < AT + SPAN + 0.01) continue
      song.push({ u, v: 0.06 + r() * 0.88 })
    }
    // The spectrogram: a soft field, banded at the song's pitches, brightest at the peaks.
    const cols = 46
    const rows = 26
    const heat: { c: number; rr: number; k: number }[] = []
    for (let c = 0; c < cols; c++) {
      for (let rr = 0; rr < rows; rr++) {
        const u = (c + 0.5) / cols
        const v = 1 - (rr + 0.5) / rows
        let k = 0.08 + r() * 0.12
        for (const l of lines) k += 0.16 * Math.exp(-((v - l) ** 2) / 0.0012)
        for (const p of peaks) k += 0.9 * Math.exp(-(((u - p.u) * 2.2) ** 2 + (v - p.v) ** 2) / 0.0016)
        heat.push({ c, rr, k: Math.min(1, k) })
      }
    }
    return { peaks, song, heat, cols, rows }
  }, [])
}

export function Fingerprint() {
  const narrow = useMediaQuery('(max-width: 640px)')
  const reduced = useReducedMotion()
  const G = narrow ? NARROW : WIDE
  const { peaks, song, heat, cols, rows } = useStars()
  const [stage, setStage] = useState(0)
  const [auto, setAuto] = useState(false)
  const [matched, setMatched] = useState(false)
  const t = useRef<number | null>(null)

  // Stage 4 slides first, then lights the match.
  useEffect(() => {
    setMatched(false)
    if (stage !== 3) return
    const id = window.setTimeout(() => setMatched(true), reduced ? 350 : 1750)
    return () => window.clearTimeout(id)
  }, [stage, reduced])

  useEffect(() => {
    if (!auto) return
    if (stage >= STAGES.length - 1) {
      setAuto(false)
      return
    }
    t.current = window.setTimeout(() => setStage((s) => s + 1), readingTime(STAGES[stage].caption, 3000))
    return () => {
      if (t.current) window.clearTimeout(t.current)
    }
  }, [auto, stage])

  const go = (i: number) => {
    setAuto(false)
    setStage(i)
    analytics.trackEvent('how_it_works_diagram_step', { chapter: 'now-spinning', diagram: 'fingerprint', step: i + 1 })
  }
  const play = () => {
    analytics.trackEvent('how_it_works_diagram_played', { chapter: 'now-spinning', diagram: 'fingerprint' })
    setStage(0)
    setAuto(true)
  }

  const C = G.clip
  const S = G.strip
  const inClip = (p: Pt) => ({ x: C.x + p.u * C.w, y: C.y + (1 - p.v) * C.h })
  const inStrip = (p: Pt, offset: number) => ({ x: S.x + (offset + p.u * SPAN) * S.w, y: S.y + (1 - p.v) * S.h })
  const offset = stage === 3 ? AT : 0
  const cellW = C.w / cols
  const cellH = C.h / rows

  return (
    <figure className="hiw-figure" aria-labelledby="fp-cap">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Steps">
          {STAGES.map((s, i) => (
            <button key={s.label} type="button" className="hiw-chip" aria-pressed={stage === i} onClick={() => go(i)} style={{ minHeight: 36, padding: '6px 12px' }}>
              <span style={{ color: stage === i ? PINK : 'var(--hiw-ink-3)', fontWeight: 600, marginRight: 6 }}>{i + 1}</span>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" className="hiw-btn" onClick={play} disabled={auto}>
          {stage === STAGES.length - 1 && !auto ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {auto ? 'Playing…' : 'Play'}
        </button>
      </div>

      <svg
        className="hiw-svg block w-full"
        viewBox={`0 0 ${G.w} ${G.h}`}
        role="img"
        aria-label="Twelve seconds of music become a picture of sound. Only its loudest points are kept, and that pattern of dots, not the audio, goes to Shazam, which slides it along the songs it knows until the dots line up."
        style={{ marginTop: 8 }}
      >
        <defs>
          <filter id="fp-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Where things happen */}
        <text x={G.piLabel.x} y={G.piLabel.y} fontSize="11.5" letterSpacing="2.2" fontWeight="600" fill={WARM}>
          ON THE PI · IN THE HOUSE
        </text>
        <text x={G.shazamLabel.x} y={G.shazamLabel.y} fontSize="11.5" letterSpacing="2.2" fontWeight="600" fill={COOL}>
          AT SHAZAM · ON THE INTERNET
        </text>
        <line {...G.wall} stroke="#a5b4fc" strokeOpacity="0.35" strokeDasharray="4 6" />
        <text x={G.wallLabel.x} y={G.wallLabel.y} textAnchor={G.wallLabel.anchor} fontSize="11.5" fontStyle="italic" fill="#8189b5">
          the house wall
        </text>

        {/* The clip */}
        <rect x={C.x - 1} y={C.y - 1} width={C.w + 2} height={C.h + 2} rx="6" fill="#060918" stroke={WARM} strokeOpacity="0.3" />
        <g
          className="hiw-reveal"
          style={{ opacity: stage === 0 ? 1 : stage === 1 ? 0.18 : 0.06 }}
        >
          <g key={stage === 0 ? 'sweep' : 'still'} style={stage === 0 && !reduced ? { animation: 'hiw-sweep 2.2s cubic-bezier(0.4,0,0.2,1) both' } : undefined}>
            {heat.map(({ c, rr, k }) => (
              <rect
                key={`${c}-${rr}`}
                x={C.x + c * cellW}
                y={C.y + rr * cellH}
                width={cellW + 0.4}
                height={cellH + 0.4}
                fill={`hsl(${232 - k * 92} ${60 + k * 30}% ${8 + k * 52}%)`}
              />
            ))}
          </g>
        </g>
        <text x={C.x} y={C.y + C.h + 22} fontSize="12" fill="#8189b5">
          time →
        </text>
        <text x={C.x + C.w} y={C.y + C.h + 22} fontSize="12" fill="#8189b5" textAnchor="end">
          12 seconds
        </text>
        <text x={C.x - 14} y={C.y + C.h / 2} fontSize="12" fill="#8189b5" textAnchor="middle" transform={`rotate(-90 ${C.x - 14} ${C.y + C.h / 2})`}>
          pitch →
        </text>

        {/* Stage 2: the peaks, paired into a pattern */}
        <g className="hiw-fade" style={{ opacity: stage === 1 ? 1 : 0 }} aria-hidden="true">
          {peaks.slice(0, -1).map((p, i) => {
            const a = inClip(p)
            const b = inClip(peaks[i + 1])
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#a5b4fc" strokeOpacity="0.3" />
          })}
        </g>

        {/* The catalogue: the whole song, with copies of other songs stacked behind it */}
        <g className="hiw-fade" style={{ opacity: stage >= 2 ? 1 : 0.35 }}>
          {[2, 1].map((k) => (
            <rect key={k} x={S.x + k * 10} y={S.y - k * 10} width={S.w} height={S.h} rx="6" fill="#060918" stroke={COOL} strokeOpacity={0.12 + (2 - k) * 0.08} />
          ))}
          <rect x={S.x} y={S.y} width={S.w} height={S.h} rx="6" fill="#060918" stroke={COOL} strokeOpacity="0.45" />
          {song.map((p, i) => {
            const q = { x: S.x + p.u * S.w, y: S.y + (1 - p.v) * S.h }
            return <circle key={i} cx={q.x} cy={q.y} r="2.4" fill="#7dd3fc" fillOpacity="0.45" />
          })}
          {/* The catalogue's own copy of our twelve seconds: it lights when the pattern lands */}
          {peaks.map((p, i) => {
            const q = inStrip(p, AT)
            return (
              <circle
                key={i}
                cx={q.x}
                cy={q.y}
                r={matched ? 5 : 2.4}
                fill={matched ? PINK : '#7dd3fc'}
                fillOpacity={matched ? 1 : 0.45}
                style={{ transition: 'r 300ms, fill 300ms, fill-opacity 300ms' }}
                filter={matched ? 'url(#fp-glow)' : undefined}
              />
            )
          })}
          <text x={S.x} y={S.y + S.h + 22} fontSize="12" fill="#8189b5">
            the whole song →
          </text>
          {matched && (
            <rect
              x={S.x + AT * S.w - 6}
              y={S.y + 6}
              width={SPAN * S.w + 12}
              height={S.h - 12}
              rx="6"
              fill="none"
              stroke={PINK}
              strokeWidth="1.5"
              style={{ animation: 'hiw-pop 0.4s ease both' }}
            />
          )}
          <text
            x={S.x + S.w}
            y={S.y + S.h + 22}
            fontSize="13"
            fontWeight="600"
            textAnchor="end"
            fill="#fff"
            className="hiw-fade"
            style={{ opacity: matched ? 1 : 0 }}
          >
            Royal Blood · “Out of the Black”
          </text>
        </g>

        {/* Our pattern: born in the clip, carried across the wall, slid along the song */}
        <g aria-hidden="true">
          {peaks.map((p, i) => {
            const from = inClip(p)
            const to = inStrip(p, offset)
            const there = stage >= 2
            const pos = there ? to : from
            return (
              <g
                key={i}
                className="hiw-slide"
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  transitionDelay: stage === 2 && !reduced ? `${i * 18}ms` : undefined,
                  opacity: stage === 0 ? 0 : 1,
                }}
              >
                <circle r={there ? 6 : 8} fill={PINK} opacity="0.55" filter="url(#fp-glow)" />
                <circle r={there ? 3 : 3.6} fill="#fff" />
              </g>
            )
          })}
        </g>
      </svg>

      <div className="px-4 sm:px-6 pb-5">
        <p id="fp-cap" className="hiw-figcaption" aria-live="polite" style={{ minHeight: '4.7em', color: 'var(--hiw-ink)' }}>
          <span style={{ color: PINK, fontWeight: 600 }}>
            {stage + 1}. {STAGES[stage].label}.{' '}
          </span>
          {STAGES[stage].caption}
        </p>
      </div>
    </figure>
  )
}
