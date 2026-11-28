/**
 * The whole journey: from a row in the spreadsheet to the page you're reading.
 *
 * Two zones, because the archive does its heavy work ahead of time: once a week, a build reads
 * the spreadsheet, asks the outside services about every band, venue and night, and writes the
 * answers down as data files. When you visit, the site only reads those files (and asks
 * Ticketmaster for upcoming tours, live).
 *
 * Facts: .github/workflows/data-refresh.yml (Mondays 07:00 UTC, commits public/data/*.json),
 * scripts/build-data.ts, docs/DATA_PIPELINE.md §Data Sources Overview.
 */
import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { analytics } from '../../../services/analytics'
import { readingTime, StepControls, useMediaQuery, useReducedMotion } from '../shared'

type Mode = 'simple' | 'hood'
type NodeId = 'sheet' | 'build' | 'files' | 'site' | 'tours'
type EdgeId = 'rows' | 'ask' | 'answer' | 'write' | 'publish' | 'live'

const PINK = '#f472b6'
const BUILD = '#a5b4fc'
const VISIT = '#7dd3fc'

const NODE_TEXT: Record<NodeId, Record<Mode, [string, string]>> = {
  sheet: { simple: ['The spreadsheet', 'One row per concert'], hood: ['Google Sheet', 'Google Sheets API'] },
  build: { simple: ['The weekly update', 'Every Monday morning'], hood: ['GitHub Actions', 'build-data.ts · Mon 07:00 UTC'] },
  files: { simple: ['The saved answers', 'Ready for the site'], hood: ['public/data/*.json', 'committed to the repo'] },
  site: { simple: ['The website', 'What you’re looking at'], hood: ['Cloudflare Pages', 'React · D3 · Leaflet'] },
  tours: { simple: ['Upcoming tours', 'checked as you browse'], hood: ['Ticketmaster API', 'called from your browser'] },
}

const SERVICES: Record<Mode, string[]> = {
  simple: ['Maps and venue photos', 'Band photos and stories', 'Song previews', 'Albums', 'Setlists'],
  hood: ['Google Geocoding · Places', 'TheAudioDB → Deezer', 'Apple Music → Deezer', 'MusicBrainz', 'setlist.fm'],
}

const EDGE_TEXT: Record<EdgeId, Record<Mode, string>> = {
  rows: { simple: 'rows', hood: 'every row' },
  ask: { simple: 'questions', hood: 'rate-limited' },
  answer: { simple: 'answers', hood: 'cached' },
  write: { simple: 'saved', hood: 'git push' },
  publish: { simple: 'published', hood: 'deploy' },
  live: { simple: 'tour dates', hood: 'fetch at runtime' },
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}
interface Layout {
  w: number
  h: number
  zones: { y?: number; x?: number; size: number; label: string; kind: 'build' | 'visit' }[]
  nodes: Record<NodeId, Box>
  services: Box
  /** A layout may leave an edge out (the phone column has no room for the save arrow). */
  edges: Partial<Record<EdgeId, { d: string; lx: number; ly: number; anchor: 'start' | 'middle' | 'end' }>>
}

// Wide: left to right. The services sit above the build, which asks them and hears back.
const WIDE: Layout = {
  w: 1000,
  h: 460,
  zones: [
    { x: 0, size: 690, label: 'Once a week', kind: 'build' },
    { x: 690, size: 310, label: 'Every time you visit', kind: 'visit' },
  ],
  nodes: {
    sheet: { x: 98, y: 340, w: 168, h: 84 },
    build: { x: 340, y: 340, w: 214, h: 84 },
    files: { x: 588, y: 340, w: 182, h: 84 },
    site: { x: 850, y: 340, w: 200, h: 84 },
    tours: { x: 850, y: 140, w: 200, h: 84 },
  },
  services: { x: 340, y: 140, w: 290, h: 150 },
  edges: {
    rows: { d: 'M182 340 L228 340', lx: 205, ly: 404, anchor: 'middle' },
    ask: { d: 'M315 298 L315 219', lx: 305, ly: 262, anchor: 'end' },
    answer: { d: 'M365 219 L365 298', lx: 375, ly: 262, anchor: 'start' },
    write: { d: 'M447 340 L492 340', lx: 470, ly: 404, anchor: 'middle' },
    publish: { d: 'M679 340 L745 340', lx: 712, ly: 404, anchor: 'middle' },
    live: { d: 'M850 182 L850 294', lx: 862, ly: 242, anchor: 'start' },
  },
}

// Narrow: one column, top to bottom, with the services in sequence (the build asks, then writes).
const NARROW: Layout = {
  w: 400,
  h: 1010,
  zones: [
    { y: 0, size: 690, label: 'Once a week', kind: 'build' },
    { y: 690, size: 320, label: 'Every time you visit', kind: 'visit' },
  ],
  nodes: {
    sheet: { x: 200, y: 80, w: 260, h: 84 },
    build: { x: 200, y: 222, w: 260, h: 84 },
    files: { x: 200, y: 600, w: 260, h: 84 },
    site: { x: 200, y: 790, w: 260, h: 84 },
    tours: { x: 200, y: 940, w: 260, h: 84 },
  },
  services: { x: 200, y: 412, w: 300, h: 160 },
  edges: {
    rows: { d: 'M200 122 L200 176', lx: 214, ly: 154, anchor: 'start' },
    ask: { d: 'M180 264 L180 328', lx: 168, ly: 302, anchor: 'end' },
    answer: { d: 'M220 496 L220 554', lx: 234, ly: 530, anchor: 'start' },
    publish: { d: 'M200 642 L200 744', lx: 214, ly: 700, anchor: 'start' },
    live: { d: 'M200 898 L200 836', lx: 214, ly: 872, anchor: 'start' },
  },
}

interface Step {
  nodes: (NodeId | 'services')[]
  edges?: EdgeId[]
  ms: number
  caption: string
}

const STEPS: Step[] = [
  { nodes: ['sheet'], ms: 1700, caption: 'It starts with my spreadsheet: one row for every concert I’ve been to.' },
  { nodes: ['build'], edges: ['rows'], ms: 1800, caption: 'Every Monday morning, an automatic update reads every row.' },
  {
    nodes: ['services'],
    edges: ['ask'],
    ms: 2200,
    caption: 'For each band, venue and night, it asks other services questions. Where is this venue? What does this band look like? What did they play that night?',
  },
  { nodes: ['build'], edges: ['answer'], ms: 1700, caption: 'The answers come back. Most were already saved in earlier weeks, so only a few questions are new.' },
  { nodes: ['files'], edges: ['write'], ms: 1800, caption: 'All the answers are saved as data files.' },
  { nodes: ['site'], edges: ['publish'], ms: 1900, caption: 'Saving the files updates the website. All of this happens before you arrive.' },
  { nodes: ['site', 'tours'], edges: ['live'], ms: 2300, caption: 'When you visit, the site reads the saved answers. Only upcoming tour dates are looked up live, while you browse.' },
]

export function ArchiveJourney() {
  const narrow = useMediaQuery('(max-width: 640px)')
  const reduced = useReducedMotion()
  const L = narrow ? NARROW : WIDE
  const [mode, setMode] = useState<Mode>('simple')
  const [step, setStep] = useState(-1)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | null>(null)
  const playing = step >= 0 && step < STEPS.length
  const done = step >= STEPS.length

  // Each step stays up long enough to read its caption; Pause holds it.
  useEffect(() => {
    if (!playing || paused) return
    timer.current = window.setTimeout(() => setStep((s) => s + 1), readingTime(STEPS[step].caption, STEPS[step].ms))
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [step, playing, paused])

  const cur = playing ? STEPS[step] : null
  const fs = narrow ? 1.06 : 1
  const caption = cur ? cur.caption : done ? 'Done. The slow work happens once a week. Your visit only reads the results.' : 'Press “Play” to follow one week, from the spreadsheet to this page.'

  const nodeBox = (b: Box, id: string, active: boolean, kind: 'build' | 'visit') => {
    const edge = kind === 'build' ? BUILD : VISIT
    return (
      <rect
        key={`r-${id}`}
        x={b.x - b.w / 2}
        y={b.y - b.h / 2}
        width={b.w}
        height={b.h}
        rx="16"
        fill="#0a0e26"
        stroke={active ? PINK : edge}
        strokeOpacity={active ? 1 : 0.5}
        strokeWidth={active ? 2 : 1.3}
        className="hiw-node-rect"
      />
    )
  }

  return (
    <figure className="hiw-figure" aria-labelledby="aj-cap">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="hiw-seg" role="group" aria-label="Diagram labels">
          {(['simple', 'hood'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                analytics.trackEvent('how_it_works_diagram_mode_changed', { chapter: 'the-archive', diagram: 'journey', mode: m })
              }}
            >
              {m === 'simple' ? 'Simple' : 'Under the hood'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="hiw-btn"
          disabled={playing}
          onClick={() => {
            analytics.trackEvent('how_it_works_diagram_played', { chapter: 'the-archive', diagram: 'journey', mode })
            setPaused(false)
            setStep(0)
          }}
        >
          {done ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing ? 'Playing…' : done ? 'Play again' : 'Play'}
        </button>
      </div>

      <svg
        className="hiw-svg block w-full"
        viewBox={`0 0 ${L.w} ${L.h}`}
        role="img"
        style={{ marginTop: 8 }}
        aria-label="Once a week, a build reads the spreadsheet, asks outside services about every band, venue and night, and writes the answers into data files that publish the website. When you visit, the site reads those files and looks up upcoming tours live."
      >
        <defs>
          <filter id="aj-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <marker id="aj-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 z" fill={BUILD} />
          </marker>
          <marker id="aj-arrow-pink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1 L9 5 L0 9 z" fill={PINK} />
          </marker>
        </defs>

        {L.zones.map((z, i) =>
          narrow ? (
            <g key={i}>
              <rect x="0" y={z.y} width={L.w} height={z.size} fill={z.kind === 'build' ? 'rgba(165,180,252,0.05)' : 'rgba(125,211,252,0.07)'} />
              {i > 0 && <line x1="0" x2={L.w} y1={z.y} y2={z.y} stroke={BUILD} strokeOpacity="0.3" strokeDasharray="4 6" />}
              <text x="16" y={(z.y ?? 0) + z.size - 14} fontSize={11 * fs} fontWeight="600" letterSpacing="2.2" fill={z.kind === 'build' ? BUILD : VISIT}>
                {z.label.toUpperCase()}
              </text>
            </g>
          ) : (
            <g key={i}>
              <rect x={z.x} y="0" width={z.size} height={L.h} fill={z.kind === 'build' ? 'rgba(165,180,252,0.05)' : 'rgba(125,211,252,0.07)'} />
              {i > 0 && <line x1={z.x} x2={z.x} y1="0" y2={L.h} stroke={BUILD} strokeOpacity="0.3" strokeDasharray="4 6" />}
              <text x={(z.x ?? 0) + 22} y="30" fontSize="11" fontWeight="600" letterSpacing="2.2" fill={z.kind === 'build' ? BUILD : VISIT}>
                {z.label.toUpperCase()}
              </text>
            </g>
          ),
        )}

        {/* Edges */}
        {(Object.keys(L.edges) as EdgeId[]).map((id) => {
          const e = L.edges[id]!
          const live = cur?.edges?.includes(id)
          return (
            <g key={id}>
              <path d={e.d} fill="none" stroke={live ? PINK : BUILD} strokeOpacity={live ? 1 : 0.55} strokeWidth={live ? 2.4 : 1.6} markerEnd={`url(#${live ? 'aj-arrow-pink' : 'aj-arrow'})`} />
              {live && !reduced && (
                <circle r="5" fill={PINK} filter="url(#aj-glow)">
                  <animateMotion dur="1s" path={e.d} fill="freeze" />
                </circle>
              )}
              <text x={e.lx} y={e.ly} textAnchor={e.anchor} fontSize={(mode === 'hood' ? 11.5 : 12.5) * fs} fontStyle={mode === 'hood' ? undefined : 'italic'} className={mode === 'hood' ? 'mono' : undefined} fill={live ? '#fff' : '#b9c0e8'}>
                {EDGE_TEXT[id][mode]}
              </text>
            </g>
          )
        })}

        {/* The outside services */}
        {(() => {
          const b = L.services
          const active = cur?.nodes.includes('services')
          return (
            <g>
              {active && <rect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h} rx="16" fill={PINK} opacity="0.25" filter="url(#aj-glow)" />}
              <rect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h} rx="16" fill="#0a0e26" stroke={active ? PINK : BUILD} strokeOpacity={active ? 1 : 0.5} strokeDasharray="5 5" />
              <text x={b.x - b.w / 2 + 18} y={b.y - b.h / 2 + 26} fontSize={11 * fs} fontWeight="600" letterSpacing="1.8" fill={BUILD}>
                OUTSIDE SERVICES
              </text>
              {SERVICES[mode].map((s, i) => (
                <text key={s} x={b.x - b.w / 2 + 18} y={b.y - b.h / 2 + 50 + i * (narrow ? 21 : 20)} fontSize={(mode === 'hood' ? 12 : 13.5) * fs} fill="#dbe2ff" className={mode === 'hood' ? 'mono' : undefined}>
                  {s}
                </text>
              ))}
            </g>
          )
        })()}

        {/* Nodes */}
        {(Object.keys(L.nodes) as NodeId[]).map((id) => {
          const b = L.nodes[id]
          const active = !!cur?.nodes.includes(id)
          const kind = id === 'site' || id === 'tours' ? 'visit' : 'build'
          const [title, sub] = NODE_TEXT[id][mode]
          return (
            <g key={id}>
              {active && <rect x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h} rx="18" fill={PINK} opacity="0.3" filter="url(#aj-glow)" />}
              {nodeBox(b, id, active, kind)}
              <text x={b.x - b.w / 2 + 18} y={b.y - 4} fontSize={(mode === 'hood' ? 15 : 17) * fs} fontWeight="600" fill="#eef0ff" className={mode === 'simple' ? 'serif' : undefined}>
                {title}
              </text>
              <text x={b.x - b.w / 2 + 18} y={b.y + 18} fontSize={(mode === 'hood' ? 11 : 12.5) * fs} fill="#b9c0e8" className={mode === 'hood' ? 'mono' : undefined}>
                {sub}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="px-4 sm:px-6 pb-5 pt-2">
        <p id="aj-cap" className="hiw-figcaption" aria-live="polite" style={{ minHeight: '3em', color: cur ? 'var(--hiw-ink)' : undefined }}>
          {caption}
        </p>
        {playing && (
          <StepControls
            index={step}
            total={STEPS.length}
            paused={paused}
            onBack={() => {
              setPaused(true)
              setStep((s) => Math.max(0, s - 1))
            }}
            onToggle={() => setPaused((p) => !p)}
            onNext={() => {
              setPaused(true)
              setStep((s) => s + 1)
            }}
          />
        )}
      </div>
    </figure>
  )
}
