/**
 * The Heartbeat: one side of a record, drawn as three lanes.
 *
 * - What the Pi hears: sound and silence.
 * - What the Pi tells the archive: "track" when a song is identified, "alive" every 60 seconds,
 *   "gap" after 4 seconds of silence, "stopped" after 3 minutes of it.
 * - What the TV shows.
 *
 * A second scenario shows the safety net: if the Pi goes quiet (it loses power), the archive's
 * 3-minute alarm sets the screen to idle on its own. Timings follow now-spinning/pi/now_spinning/
 * loop.py and the spec's §Worker API; the drawing is not to scale (a 4-second gap would be
 * invisible).
 */
import { useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { analytics } from '../../../services/analytics'
import { useMediaQuery, useReducedMotion } from '../shared'

const PINK = '#f472b6'
const LAV = '#a5b4fc'
const WARM = '#f6b26b'
const COOL = '#7dd3fc'

type Scenario = 'normal' | 'quiet'

interface Ev {
  t: number
  kind: 'track' | 'alive' | 'gap' | 'stopped' | 'power' | 'alarm'
  n?: number
}
interface Band {
  from: number
  to: number
  label: string
  kind: 'idle' | 'song' | 'faded'
}

/** Drawn in "visual minutes" (0–12), not to scale. */
const SCENARIOS: Record<
  Scenario,
  { label: string; sound: [number, number][]; heardUntil: number; events: Ev[]; tv: Band[]; notes: string[] }
> = {
  normal: {
    label: 'A side of a record',
    sound: [
      [0.2, 4],
      [4.4, 8],
    ],
    heardUntil: 12,
    events: [
      { t: 0.6, kind: 'track', n: 1 },
      { t: 1.6, kind: 'alive' },
      { t: 2.6, kind: 'alive' },
      { t: 3.6, kind: 'alive' },
      { t: 4.1, kind: 'gap', n: 2 },
      { t: 4.8, kind: 'track', n: 3 },
      { t: 5.8, kind: 'alive' },
      { t: 6.8, kind: 'alive' },
      { t: 7.8, kind: 'alive' },
      { t: 8.1, kind: 'gap', n: 4 },
      { t: 9.1, kind: 'alive' },
      { t: 10.1, kind: 'alive' },
      { t: 11, kind: 'stopped', n: 5 },
    ],
    tv: [
      { from: 0, to: 0.6, label: 'Idle', kind: 'idle' },
      { from: 0.6, to: 4.8, label: 'Out of the Black', kind: 'song' },
      { from: 4.8, to: 9.6, label: 'Come On Over', kind: 'song' },
      { from: 9.6, to: 11, label: 'faded', kind: 'faded' },
      { from: 11, to: 12, label: 'Idle', kind: 'idle' },
    ],
    notes: [
      'The needle drops. After 12 seconds of sound, the song is identified and the screen shows it. While it plays, the Pi checks in with the archive every 60 seconds.',
      'Four seconds of silence: the gap between two songs. The screen keeps showing the last song.',
      'Sound again, so a new song. It’s identified straight away and the screen changes.',
      'The side ends. After 90 seconds of silence, the text on the screen fades, to protect the TV.',
      'Three minutes of silence means the record is over. The screen goes back to idle.',
    ],
  },
  quiet: {
    label: 'The Pi goes quiet',
    sound: [[0.2, 12]],
    heardUntil: 2.9,
    events: [
      { t: 0.6, kind: 'track', n: 1 },
      { t: 1.6, kind: 'alive' },
      { t: 2.6, kind: 'alive' },
      { t: 2.9, kind: 'power', n: 2 },
      { t: 5.6, kind: 'alarm', n: 3 },
    ],
    tv: [
      { from: 0, to: 0.6, label: 'Idle', kind: 'idle' },
      { from: 0.6, to: 5.6, label: 'Out of the Black', kind: 'song' },
      { from: 5.6, to: 12, label: 'Idle', kind: 'idle' },
    ],
    notes: [
      'A song is identified and the screen shows it. The Pi checks in every 60 seconds.',
      'The Pi loses power. The record keeps playing, but nobody is listening, and the check-ins stop.',
      'The archive has an alarm that resets with every check-in. Three minutes after the last one, it rings and sets the screen to idle on its own, so the TV never shows a stale song.',
    ],
  },
}

const LANE_LABELS = ['What the Pi hears', 'What the Pi tells the archive', 'What the TV shows']

/** A deterministic waveform for a span of sound. */
function wave(x0: number, x1: number, y: number, amp: number, seed: number) {
  let d = `M${x0} ${y}`
  let s = seed
  for (let x = x0 + 3; x < x1; x += 3) {
    s = (s * 9301 + 49297) % 233280
    const a = (0.35 + (s / 233280) * 0.65) * amp
    d += ` L${x - 1.5} ${y - a} L${x} ${y + a * 0.8}`
  }
  return d + ` L${x1} ${y}`
}

export function Heartbeat() {
  const narrow = useMediaQuery('(max-width: 640px)')
  const reduced = useReducedMotion()
  const [scenario, setScenario] = useState<Scenario>('normal')
  const [run, setRun] = useState(0) // bumps to replay the reveal
  const S = SCENARIOS[scenario]

  const W = 1000
  const fs = narrow ? 30 : 14
  const laneGap = narrow ? 150 : 96
  const top = narrow ? 70 : 44
  const lanes = [top, top + laneGap, top + laneGap * 2]
  const H = lanes[2] + (narrow ? 90 : 56)
  const x0 = 24
  const x1 = W - 24
  const X = (t: number) => x0 + (t / 12) * (x1 - x0)
  const amp = narrow ? 26 : 16
  const r = narrow ? 16 : 10

  const choose = (s: Scenario) => {
    setScenario(s)
    setRun((n) => n + 1)
    analytics.trackEvent('how_it_works_diagram_mode_changed', { chapter: 'now-spinning', diagram: 'heartbeat', mode: s })
  }
  const play = () => {
    setRun((n) => n + 1)
    analytics.trackEvent('how_it_works_diagram_played', { chapter: 'now-spinning', diagram: 'heartbeat', mode: scenario })
  }

  return (
    <figure className="hiw-figure" aria-labelledby="hb-cap">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="hiw-seg" role="group" aria-label="Scenario">
          {(['normal', 'quiet'] as Scenario[]).map((s) => (
            <button key={s} type="button" aria-pressed={scenario === s} onClick={() => choose(s)}>
              {SCENARIOS[s].label}
            </button>
          ))}
        </div>
        <button type="button" className="hiw-btn" onClick={play}>
          {run > 0 ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {run > 0 ? 'Replay' : 'Play'}
        </button>
      </div>

      <div className="px-2 sm:px-4 pt-4">
        <svg
          className="hiw-svg block w-full"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${S.label}, in three lanes: what the Pi hears, what it tells the archive, and what the TV shows. ${S.notes.join(' ')}`}
        >
          <defs>
            <clipPath id="hb-reveal">
              <rect
                key={`${scenario}-${run}`}
                x="0"
                y="0"
                width={W}
                height={H}
                style={
                  run > 0 && !reduced
                    ? { transformBox: 'fill-box', transformOrigin: 'left', animation: 'hiw-reveal-x 5.5s linear both' }
                    : undefined
                }
              />
            </clipPath>
          </defs>

          {/* Lane labels and baselines */}
          {lanes.map((y, i) => (
            <g key={i}>
              <text x={x0} y={y - (narrow ? 34 : 24)} fontSize={fs} fontWeight="600" letterSpacing="1" fill={i === 1 ? COOL : WARM} fillOpacity="0.9">
                {LANE_LABELS[i].toUpperCase()}
              </text>
              {i < 2 && <line x1={x0} x2={x1} y1={y} y2={y} stroke={LAV} strokeOpacity="0.15" />}
            </g>
          ))}

          <g clipPath="url(#hb-reveal)">
            {/* Lane 1: sound */}
            {S.sound.map(([a, b], i) => {
              const heardEnd = Math.min(b, S.heardUntil)
              return (
                <g key={i}>
                  {heardEnd > a && <path d={wave(X(a), X(heardEnd), lanes[0], amp, 7 + i)} fill="none" stroke={WARM} strokeWidth={narrow ? 2.4 : 1.4} />}
                  {b > S.heardUntil && (
                    <path d={wave(X(Math.max(a, S.heardUntil)), X(b), lanes[0], amp, 11 + i)} fill="none" stroke={LAV} strokeOpacity="0.18" strokeWidth={narrow ? 2.4 : 1.4} />
                  )}
                </g>
              )
            })}
            {S.heardUntil < 12 && (
              <text x={X(S.heardUntil) + 10} y={lanes[0] + amp + fs + 4} fontSize={fs * 0.9} fontStyle="italic" fill="#8189b5">
                the record plays on, unheard
              </text>
            )}

            {/* Lane 2: what the Pi sends */}
            {S.events.map((e, i) => {
              const x = X(e.t)
              const y = lanes[1]
              const color = e.kind === 'track' ? PINK : e.kind === 'alive' ? LAV : e.kind === 'power' ? '#8189b5' : e.kind === 'alarm' ? WARM : COOL
              return (
                <g key={i}>
                  {e.kind === 'alive' ? (
                    <path d={`M${x - r * 0.7} ${y} L${x - r * 0.3} ${y} L${x} ${y - r * 1.1} L${x + r * 0.3} ${y + r * 0.6} L${x + r * 0.6} ${y}`} fill="none" stroke={color} strokeWidth={narrow ? 2.6 : 1.6} />
                  ) : e.kind === 'power' ? (
                    <g stroke={color} strokeWidth={narrow ? 3 : 2}>
                      <line x1={x - r * 0.7} y1={y - r * 0.7} x2={x + r * 0.7} y2={y + r * 0.7} />
                      <line x1={x + r * 0.7} y1={y - r * 0.7} x2={x - r * 0.7} y2={y + r * 0.7} />
                    </g>
                  ) : (
                    <circle cx={x} cy={y} r={e.kind === 'track' ? r : r * 0.75} fill={e.kind === 'track' ? color : '#0a0e26'} stroke={color} strokeWidth={narrow ? 3 : 2} />
                  )}
                  {e.n && <Marker x={x} y={y + r + (narrow ? 34 : 22)} n={e.n} r={narrow ? 17 : 10} fs={fs * 0.85} />}
                </g>
              )
            })}
            {scenario === 'quiet' && (
              <line x1={X(2.9)} x2={X(5.6)} y1={lanes[1]} y2={lanes[1]} stroke={WARM} strokeOpacity="0.5" strokeDasharray="4 5" strokeWidth={narrow ? 2.4 : 1.4} />
            )}

            {/* Lane 3: the TV */}
            {S.tv.map((b, i) => {
              const x = X(b.from) + 2
              const w = X(b.to) - X(b.from) - 4
              const h = narrow ? 52 : 30
              const song = b.kind === 'song'
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={lanes[2] - h / 2}
                    width={w}
                    height={h}
                    rx="6"
                    fill={song ? 'rgba(59,130,246,0.35)' : b.kind === 'faded' ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.04)'}
                    stroke={song ? 'rgba(96,165,250,0.6)' : 'rgba(165,180,252,0.18)'}
                  />
                  {w > fs * 4 && (
                    <text x={x + 10} y={lanes[2] + fs * 0.35} fontSize={fs} fill={song ? '#fff' : '#8189b5'} fontStyle={song ? undefined : 'italic'} className={song ? 'serif' : undefined}>
                      {b.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <ol className="px-4 sm:px-6 pb-5 pt-2 grid gap-2" id="hb-cap" style={{ listStyle: 'none' }}>
        {S.notes.map((n, i) => (
          <li key={i} className="flex gap-3 font-sans" style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--hiw-ink-2)' }}>
            <span
              aria-hidden="true"
              className="shrink-0 grid place-items-center"
              style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${PINK}`, color: '#fff', fontSize: 12, fontWeight: 600, marginTop: 1 }}
            >
              {i + 1}
            </span>
            <span>{n}</span>
          </li>
        ))}
        <li className="hiw-figcaption mt-1">
          {scenario === 'normal' ? 'Not drawn to scale: a 4-second gap would be too thin to see.' : 'Not drawn to scale.'}
        </li>
      </ol>
    </figure>
  )
}

function Marker({ x, y, n, r, fs }: { x: number; y: number; n: number; r: number; fs: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#0a0e26" stroke={PINK} strokeWidth="1.5" />
      <text x={x} y={y + fs * 0.36} fontSize={fs} fontWeight="600" textAnchor="middle" fill="#fff">
        {n}
      </text>
    </g>
  )
}
