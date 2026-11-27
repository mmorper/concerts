/**
 * The Round Trip: the whole of Now Spinning on one page.
 *
 * The music never leaves the house. A fingerprint goes up, a song name comes back, the archive
 * is asked, and the answer comes down to the TV. Warm is the house, cool is the internet.
 *
 * One diagram, two readings: "Simple" names what each part does, "Under the hood" relabels the
 * same shapes with the real components and protocols. ▶ sends one record through.
 *
 * Wide screens get a loop; phones get the same journey as a column (house → internet → house),
 * because the loop's labels can't be read at 360 px.
 */
import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { analytics } from '../../../services/analytics'
import { useMediaQuery, useReducedMotion } from '../shared'

type Mode = 'simple' | 'hood'
type NodeId = 'record' | 'ear' | 'name' | 'memory' | 'screen'
type EdgeId = 'music' | 'fp' | 'title' | 'ask' | 'story' | 'wake'

const NODE_TEXT: Record<NodeId, Record<Mode, [string, string]>> = {
  record: { simple: ['The record', 'Plays like it always has'], hood: ['Turntable', '→ receiver Zone 2 out'] },
  ear: { simple: ['The ear', 'A tiny computer listens'], hood: ['Raspberry Pi 5', 'USB audio · Python'] },
  name: { simple: ['The name', 'Shazam knows the song'], hood: ['Shazam', 'fingerprint lookup'] },
  memory: { simple: ['The memory', '40 years of setlists'], hood: ['Cloudflare Worker', 'index + Durable Object'] },
  screen: { simple: ['The screen', 'The TV tells the story'], hood: ['Apple TV app', 'tvOS, SwiftUI'] },
}

const EDGE_TEXT: Record<EdgeId, Record<Mode, string>> = {
  music: { simple: 'the music', hood: 'line-level audio' },
  fp: { simple: 'a fingerprint, not audio', hood: 'signature · HTTPS' },
  title: { simple: 'the song’s name', hood: 'artist · title · album' },
  ask: { simple: 'what’s this song to me?', hood: 'POST /api/now-spinning' },
  story: { simple: 'the story', hood: 'WebSocket push' },
  wake: { simple: 'wakes the TV', hood: 'Wake-on-LAN · pyatv' },
}

const ZONE = {
  house: { label: 'In the house', fill: 'rgba(246, 178, 107, 0.07)', ink: '#f6b26b' },
  net: { label: 'On the internet', fill: 'rgba(125, 211, 252, 0.06)', ink: '#7dd3fc' },
}

const WARM = '#f6b26b'
const COOL = '#7dd3fc'
const PINK = '#f472b6'

interface NodeGeo {
  x: number
  y: number
  w: number
  h: number
  zone: 'house' | 'net'
}
interface EdgeGeo {
  d: string
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
  dashed?: boolean
}
interface Layout {
  w: number
  h: number
  zones: { y: number; h: number; zone: 'house' | 'net' }[]
  nodes: Record<NodeId, NodeGeo>
  edges: Partial<Record<EdgeId, EdgeGeo>>
}

// Wide: a loop. The record and the ear in the house on the left, the internet across the top,
// back down to the screen on the right.
const WIDE: Layout = {
  w: 1000,
  h: 560,
  zones: [
    { y: 0, h: 260, zone: 'net' },
    { y: 260, h: 300, zone: 'house' },
  ],
  nodes: {
    record: { x: 140, y: 410, w: 220, h: 96, zone: 'house' },
    ear: { x: 480, y: 410, w: 220, h: 96, zone: 'house' },
    name: { x: 480, y: 120, w: 220, h: 96, zone: 'net' },
    memory: { x: 830, y: 120, w: 230, h: 96, zone: 'net' },
    screen: { x: 830, y: 410, w: 230, h: 96, zone: 'house' },
  },
  edges: {
    music: { d: 'M250 410 L366 410', label: { x: 308, y: 396, anchor: 'middle' } },
    fp: { d: 'M455 362 L455 172', label: { x: 443, y: 226, anchor: 'end' } },
    title: { d: 'M505 168 L505 358', label: { x: 517, y: 226, anchor: 'start' } },
    ask: { d: 'M590 380 C655 380, 655 150, 711 150', label: { x: 668, y: 300, anchor: 'start' } },
    story: { d: 'M830 168 L830 358', label: { x: 842, y: 300, anchor: 'start' } },
    wake: { d: 'M590 438 L711 438', label: { x: 652, y: 462, anchor: 'middle' }, dashed: true },
  },
}

// Narrow: one column, top to bottom. The journey leaves the house and comes back to it.
const NARROW: Layout = {
  w: 400,
  h: 980,
  zones: [
    { y: 0, h: 300, zone: 'house' },
    { y: 300, h: 360, zone: 'net' },
    { y: 660, h: 320, zone: 'house' },
  ],
  nodes: {
    record: { x: 170, y: 70, w: 230, h: 84, zone: 'house' },
    ear: { x: 170, y: 230, w: 230, h: 84, zone: 'house' },
    name: { x: 170, y: 400, w: 230, h: 84, zone: 'net' },
    memory: { x: 170, y: 580, w: 230, h: 84, zone: 'net' },
    screen: { x: 170, y: 780, w: 230, h: 84, zone: 'house' },
  },
  edges: {
    music: { d: 'M170 112 L170 188', label: { x: 184, y: 155, anchor: 'start' } },
    fp: { d: 'M150 272 L150 358', label: { x: 140, y: 320, anchor: 'end' } },
    title: { d: 'M190 358 L190 272', label: { x: 204, y: 320, anchor: 'start' } },
    ask: { d: 'M170 442 L170 538', label: { x: 184, y: 495, anchor: 'start' } },
    story: { d: 'M170 622 L170 738', label: { x: 184, y: 685, anchor: 'start' } },
    wake: { d: 'M285 230 C370 230, 370 780, 285 780', label: { x: 338, y: 470, anchor: 'end' }, dashed: true },
  },
}

interface Step {
  node: NodeId
  edges?: EdgeId[]
  ms: number
  caption: string
  phase: 'needle' | 'listen' | 'name' | 'remember' | 'show'
}

const STEPS: Step[] = [
  { node: 'record', ms: 1400, phase: 'needle', caption: 'The needle drops: Royal Blood, “Out of the Black.”' },
  {
    node: 'ear',
    edges: ['music', 'wake'],
    ms: 2600,
    phase: 'listen',
    caption: 'The Pi hears sound after silence and starts a 12-second clip. At the same moment it wakes the TV and opens the app.',
  },
  { node: 'name', edges: ['fp'], ms: 1700, phase: 'name', caption: 'It boils the clip down to a fingerprint and sends only that to Shazam. No audio leaves the house.' },
  { node: 'ear', edges: ['title'], ms: 1500, phase: 'name', caption: 'Shazam answers: Royal Blood, “Out of the Black.”' },
  { node: 'memory', edges: ['ask'], ms: 1700, phase: 'remember', caption: 'The Pi asks the archive what that song means to me.' },
  {
    node: 'memory',
    ms: 1900,
    phase: 'remember',
    caption: 'Three nights: the 9:30 Club in 2015 and 2017, and the House of Blues Anaheim in 2022.',
  },
  { node: 'screen', edges: ['story'], ms: 2600, phase: 'show', caption: 'The TV: “You’ve heard this one live 3 times.”' },
]

const PHASES: { id: Step['phase']; label: string; weight: number }[] = [
  { id: 'needle', label: 'Needle drops', weight: 1 },
  { id: 'listen', label: 'Listening, 12 s', weight: 5 },
  { id: 'name', label: 'Naming', weight: 1.4 },
  { id: 'remember', label: 'Remembering', weight: 1.4 },
  { id: 'show', label: 'On screen', weight: 1.4 },
]

const IDLE_CAPTION = 'Press play to send one record around the loop.'

function Icon({ id, x, y, active }: { id: NodeId; x: number; y: number; active: boolean }) {
  const c = active ? PINK : 'rgba(238,240,255,0.7)'
  switch (id) {
    case 'record':
      return (
        <g transform={`translate(${x} ${y})`}>
          <g className={active ? 'hiw-spin' : undefined}>
            <circle r="15" fill="#05070f" stroke={c} strokeWidth="1.4" />
            <circle r="10" fill="none" stroke={c} strokeOpacity="0.35" />
            <circle r="5" fill="none" stroke={c} strokeOpacity="0.35" />
            <circle r="2.5" fill={PINK} />
            <line x1="0" y1="-15" x2="0" y2="-8" stroke={c} strokeOpacity="0.6" />
          </g>
        </g>
      )
    case 'ear':
      return (
        <g transform={`translate(${x} ${y})`} fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round">
          {[-10, -5, 0, 5, 10].map((dx, i) => (
            <line key={dx} x1={dx} x2={dx} y1={-[5, 10, 14, 9, 4][i]} y2={[5, 10, 14, 9, 4][i]} />
          ))}
        </g>
      )
    case 'name':
      return (
        <g transform={`translate(${x} ${y})`} fill={c}>
          {[
            [-11, 6],
            [-5, -8],
            [1, 2],
            [7, -11],
            [11, 8],
            [-1, 11],
          ].map(([dx, dy]) => (
            <circle key={`${dx}${dy}`} cx={dx} cy={dy} r="2" />
          ))}
          <path d="M-11 6 L-5 -8 L1 2 L7 -11 M1 2 L11 8 M1 2 L-1 11" stroke={c} strokeOpacity="0.5" fill="none" />
        </g>
      )
    case 'memory':
      return (
        <g transform={`translate(${x} ${y})`} fill="none" stroke={c} strokeWidth="1.4">
          <ellipse cx="0" cy="-9" rx="12" ry="4" />
          <path d="M-12 -9 V9 C-12 14, 12 14, 12 9 V-9" />
          <path d="M-12 0 C-12 5, 12 5, 12 0" strokeOpacity="0.5" />
        </g>
      )
    case 'screen':
      return (
        <g transform={`translate(${x} ${y})`} fill="none" stroke={c} strokeWidth="1.4">
          <rect x="-15" y="-11" width="30" height="19" rx="2.5" />
          <line x1="-6" y1="12" x2="6" y2="12" strokeLinecap="round" />
          <circle cx="-9" cy="-5" r="1.6" fill={PINK} stroke="none" />
          <line x1="-5" y1="-5" x2="9" y2="-5" strokeOpacity="0.8" />
          <line x1="-9" y1="1" x2="7" y2="1" strokeOpacity="0.45" />
        </g>
      )
  }
}

export function RoundTrip() {
  const narrow = useMediaQuery('(max-width: 640px)')
  const reduced = useReducedMotion()
  const L = narrow ? NARROW : WIDE
  const [mode, setMode] = useState<Mode>('simple')
  const [step, setStep] = useState(-1) // -1: not started; STEPS.length: finished
  const timer = useRef<number | null>(null)

  const playing = step >= 0 && step < STEPS.length
  const done = step >= STEPS.length

  useEffect(() => {
    if (!playing) return
    timer.current = window.setTimeout(() => setStep((s) => s + 1), STEPS[step].ms * (reduced ? 1.15 : 1))
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [step, playing, reduced])

  const play = () => {
    analytics.trackEvent('how_it_works_diagram_played', { chapter: 'now-spinning', diagram: 'round-trip', mode })
    setStep(0)
  }

  const cur = playing ? STEPS[step] : null
  const visited = new Set<NodeId>()
  const travelled = new Set<EdgeId>()
  const upto = done ? STEPS.length - 1 : step
  for (let i = 0; i <= upto; i++) {
    visited.add(STEPS[i].node)
    STEPS[i].edges?.forEach((e) => travelled.add(e))
  }

  const caption = cur ? cur.caption : done ? 'Seconds from needle to screen. Most of that is listening.' : IDLE_CAPTION
  const phaseIdx = cur ? PHASES.findIndex((p) => p.id === cur.phase) : done ? PHASES.length : -1
  const totalWeight = PHASES.reduce((a, p) => a + p.weight, 0)
  const fs = narrow ? 1.06 : 1 // a touch larger in the column, where the SVG is shrunk most

  return (
    <figure className="hiw-figure" aria-labelledby="rt-cap">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="hiw-seg" role="group" aria-label="Diagram labels">
          {(['simple', 'hood'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                analytics.trackEvent('how_it_works_diagram_mode_changed', { chapter: 'now-spinning', diagram: 'round-trip', mode: m })
              }}
            >
              {m === 'simple' ? 'Simple' : 'Under the hood'}
            </button>
          ))}
        </div>
        <button type="button" className="hiw-btn" onClick={play} disabled={playing}>
          {done ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing ? 'Playing…' : done ? 'Play again' : 'Play a record'}
        </button>
      </div>

      <svg
        className="hiw-svg block w-full"
        viewBox={`0 0 ${L.w} ${L.h}`}
        role="img"
        aria-label="A record plays. A small computer in the house hears it, sends a fingerprint to Shazam, gets the song's name back, asks the archive in the cloud what the song means, and the answer appears on the TV."
        style={{ marginTop: 8 }}
      >
        <defs>
          <filter id="rt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <marker id="rt-arrow-warm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 z" fill={WARM} />
          </marker>
          <marker id="rt-arrow-cool" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 z" fill={COOL} />
          </marker>
          <marker id="rt-arrow-pink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 z" fill={PINK} />
          </marker>
        </defs>

        {/* Zones */}
        {L.zones.map((z, i) => (
          <g key={i}>
            <rect x="0" y={z.y} width={L.w} height={z.h} fill={ZONE[z.zone].fill} />
            <text
              x={narrow ? 16 : 24}
              y={narrow ? z.y + z.h - 14 : z.y + 26}
              fontSize={11 * fs}
              fontWeight="600"
              letterSpacing="2.4"
              fill={ZONE[z.zone].ink}
              fillOpacity="0.85"
            >
              {ZONE[z.zone].label.toUpperCase()}
            </text>
            {i > 0 && <line x1="0" x2={L.w} y1={z.y} y2={z.y} stroke="#a5b4fc" strokeOpacity="0.28" strokeDasharray="4 6" />}
          </g>
        ))}

        {/* Edges */}
        {(Object.keys(L.edges) as EdgeId[]).map((id) => {
          const e = L.edges[id]!
          const lit = travelled.has(id)
          const live = cur?.edges?.includes(id)
          const internet = id === 'fp' || id === 'title' || id === 'ask' || id === 'story'
          const base = internet ? COOL : WARM
          const marker = live ? 'rt-arrow-pink' : internet ? 'rt-arrow-cool' : 'rt-arrow-warm'
          return (
            <g key={id}>
              <path
                d={e.d}
                fill="none"
                stroke={live ? PINK : base}
                strokeOpacity={lit || step < 0 ? 0.9 : 0.35}
                strokeWidth={live ? 2.4 : 1.6}
                strokeDasharray={e.dashed ? '5 6' : undefined}
                markerEnd={`url(#${marker})`}
                className="hiw-node-rect"
              />
              {live && !reduced && <path d={e.d} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="2" className="hiw-flow" />}
              {live && !reduced && (
                <circle r="6" fill={PINK} filter="url(#rt-glow)">
                  <animateMotion dur="1.1s" path={e.d} fill="freeze" />
                </circle>
              )}
              {live && !reduced && (
                <circle r="3.5" fill="#fff">
                  <animateMotion dur="1.1s" path={e.d} fill="freeze" />
                </circle>
              )}
              <EdgeLabel x={e.label.x} y={e.label.y} anchor={e.label.anchor} text={EDGE_TEXT[id][mode]} mono={mode === 'hood'} size={12.5 * fs} lit={!!live} narrow={narrow} />
            </g>
          )
        })}

        {/* Nodes */}
        {(Object.keys(L.nodes) as NodeId[]).map((id) => {
          const n = L.nodes[id]
          const active = cur?.node === id
          const seen = visited.has(id)
          const [title, sub] = NODE_TEXT[id][mode]
          const edge = n.zone === 'house' ? WARM : COOL
          return (
            <g key={id}>
              {active && <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx="18" fill={PINK} opacity="0.35" filter="url(#rt-glow)" />}
              {active && id === 'ear' && cur?.phase === 'listen' && (
                <circle cx={n.x - n.w / 2 + 34} cy={n.y} r="22" fill="none" stroke={PINK} strokeWidth="1.5" className={reduced ? undefined : 'hiw-ripple'} />
              )}
              <rect
                className="hiw-node-rect"
                x={n.x - n.w / 2}
                y={n.y - n.h / 2}
                width={n.w}
                height={n.h}
                rx="16"
                fill="#0a0e26"
                stroke={active ? PINK : edge}
                strokeOpacity={active ? 1 : seen ? 0.85 : 0.45}
                strokeWidth={active ? 2 : 1.3}
              />
              <Icon id={id} x={n.x - n.w / 2 + 34} y={n.y} active={active} />
              <text x={n.x - n.w / 2 + 62} y={n.y - 4} fontSize={(mode === 'hood' ? 16 : 18) * fs} fontWeight="600" fill="#eef0ff" className={mode === 'simple' ? 'serif' : undefined}>
                {title}
              </text>
              <text x={n.x - n.w / 2 + 62} y={n.y + 18} fontSize={12.5 * fs} fill="#b9c0e8" className={mode === 'hood' ? 'mono' : undefined} style={mode === 'hood' ? { fontSize: 11 * fs } : undefined}>
                {sub}
              </text>
            </g>
          )
        })}

        {/* What the TV shows, once the story arrives */}
        {(done || cur?.phase === 'show') && <ScreenPop n={L.nodes.screen} narrow={narrow} />}
      </svg>

      {/* Timing rail */}
      <div className="px-4 sm:px-6 pb-5">
        <div className="flex gap-1" aria-hidden="true">
          {PHASES.map((p, i) => (
            <div key={p.id} style={{ flex: p.weight / totalWeight }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: i < phaseIdx ? 'rgba(165,180,252,0.7)' : i === phaseIdx ? PINK : 'rgba(165,180,252,0.15)',
                  transition: 'background 300ms',
                }}
              />
              <div
                className="font-sans mt-2 hidden sm:block"
                style={{ fontSize: 12, color: i === phaseIdx ? '#fff' : 'var(--hiw-ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {p.label}
              </div>
            </div>
          ))}
        </div>
        <p id="rt-cap" className="hiw-figcaption mt-3" aria-live="polite" style={{ minHeight: '3.1em', color: cur ? 'var(--hiw-ink)' : undefined }}>
          {caption}
        </p>
      </div>
    </figure>
  )
}

function EdgeLabel({
  x,
  y,
  anchor,
  text,
  mono,
  size,
  lit,
  narrow,
}: {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  text: string
  mono: boolean
  size: number
  lit: boolean
  narrow: boolean
}) {
  // Long phrases wrap onto two lines in the narrow column.
  const words = text.split(' ')
  const lines = narrow && text.length > 16 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [text]
  return (
    <text
      x={x}
      y={y - (lines.length - 1) * size * 0.6}
      textAnchor={anchor}
      fontSize={mono ? size * 0.9 : size}
      fontStyle={mono ? undefined : 'italic'}
      fill={lit ? '#fff' : '#b9c0e8'}
      className={mono ? 'mono' : undefined}
      style={{ transition: 'fill 300ms' }}
    >
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * 1.25}>
          {l}
        </tspan>
      ))}
    </text>
  )
}

function ScreenPop({ n, narrow }: { n: NodeGeo; narrow: boolean }) {
  // A small card of the real screen, under the TV node.
  const w = 200
  const h = 74
  const x = narrow ? n.x - w / 2 : n.x - w / 2 + 30
  const y = n.y + n.h / 2 + 14
  return (
    <g className="hiw-fade" style={{ animation: 'hiw-pop 0.4s ease both' }}>
      <rect x={x} y={y} width={w} height={h} rx="10" fill="#0b1640" stroke="#3b82f6" strokeOpacity="0.6" />
      <circle cx={x + 14} cy={y + 15} r="2.6" fill={PINK} />
      <text x={x + 22} y={y + 18} fontSize="8.5" letterSpacing="1.6" fill="#a5b4fc" fontWeight="600">
        NOW SPINNING
      </text>
      <text x={x + 12} y={y + 40} fontSize="17" fontWeight="700" fill="#fff" className="serif">
        Out of the Black
      </text>
      <text x={x + 12} y={y + 60} fontSize="11" fill="#dbe2ff">
        You’ve heard this one live 3 times.
      </text>
    </g>
  )
}
