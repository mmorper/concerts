/**
 * The Memory: how a song name from Shazam becomes "you've heard this one live 5 times".
 *
 * 1. What Shazam sends: the title as its catalogue spells it.
 * 2. Tidy it up: version labels go, and both names fold to plain keys (the same rules the
 *    setlists were folded with when the index was built).
 * 3. Search the setlists: a scan across forty years of concerts lights the nights the band played.
 * 4. The answer: the nights the song was on the setlist, and the TV's sentence.
 *
 * Everything shown is live: memoryOf() reads the published index and runs the TV's lookup.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { analytics } from '../../../services/analytics'
import { readingTime, useMediaQuery, useReducedMotion } from '../shared'
import { siteLoader } from './ladder'
import { allConcertDates, MEMORY_EXAMPLE, memoryOf, type Memory as MemoryData } from './memory'

const PINK = '#f472b6'
const COOL = '#7dd3fc'
const LAV = '#a5b4fc'

const STAGES = ['What Shazam sends', 'Tidy it up', 'Search the setlists', 'The answer']

// "Everything Counts (Remastered 2006)" → the title, and the extra words the tidying removes.
const [, TITLE_BASE, TITLE_EXTRA] = /^(.*?)\s*(\(.*\))?$/.exec(MEMORY_EXAMPLE.title) ?? ['', MEMORY_EXAMPLE.title, '']

const year = (d: string) => Number(d.slice(0, 4))
const spelled = (n: number) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n)

export function Memory() {
  const narrow = useMediaQuery('(max-width: 640px)')
  const reduced = useReducedMotion()
  const load = useMemo(() => siteLoader(), [])
  const [data, setData] = useState<MemoryData | null | undefined>(undefined)
  const [all, setAll] = useState<string[]>([])
  const [stage, setStage] = useState(0)
  const [auto, setAuto] = useState(false)

  useEffect(() => {
    memoryOf(MEMORY_EXAMPLE, load).then(setData)
    allConcertDates().then(setAll)
  }, [load])

  useEffect(() => {
    if (!auto) return
    if (stage >= STAGES.length - 1) {
      setAuto(false)
      return
    }
    const t = window.setTimeout(() => setStage((s) => s + 1), readingTime(captions[stage] ?? '', 3000))
    return () => window.clearTimeout(t)
  }, [auto, stage])

  const go = (i: number) => {
    setAuto(false)
    setStage(i)
    analytics.trackEvent('how_it_works_diagram_step', { chapter: 'now-spinning', diagram: 'memory', step: i + 1 })
  }
  const play = () => {
    analytics.trackEvent('how_it_works_diagram_played', { chapter: 'now-spinning', diagram: 'memory' })
    setStage(0)
    setAuto(true)
  }

  const nights = data?.nights ?? []
  const heard = nights.filter((n) => n.heard)
  const withSetlist = nights.filter((n) => n.hasSetlist).length
  const captions = [
    'Shazam sends the song’s name the way its catalogue spells it, often with extra words such as a remaster date.',
    'The archive removes the extra words and simplifies both names into plain keys. Every setlist was simplified the same way, so the two can be compared exactly.',
    nights.length
      ? `It checks every concert where I saw ${MEMORY_EXAMPLE.artist}: ${spelled(nights.length)} of them, from ${year(nights[0].date)} to ${year(nights[nights.length - 1].date)}. ${withSetlist === nights.length ? `All ${spelled(nights.length)} have a setlist.` : `${spelled(withSetlist)} of them have a setlist.`}`
      : 'It checks every concert where I saw the band.',
    data ? `The song is on ${heard.length === nights.length ? `all ${spelled(heard.length)}` : spelled(heard.length)} of those setlists, so the TV says: “${data.track.headline}”` : '',
  ]

  if (data === null) {
    return (
      <figure className="hiw-figure p-6">
        <p className="hiw-figcaption">The archive didn’t answer just now, so this diagram can’t run. Try reloading the page.</p>
      </figure>
    )
  }

  // Timeline geometry
  const W = 1000
  const H = narrow ? 230 : 170
  const x0 = 30
  const x1 = W - 30
  const y = narrow ? 120 : 95
  const from = 1984
  const to = Math.max(2027, ...all.map(year))
  const xOf = (d: string) => {
    const t = year(d) + (Number(d.slice(5, 7)) - 1) / 12
    return x0 + ((t - from) / (to - from)) * (x1 - x0)
  }
  const fs = narrow ? 30 : 15
  // Year labels that would collide are lifted onto a second row.
  const labelRow = new Map<number, number>()
  {
    let lastX = -Infinity
    let lastRow = 1
    nights.forEach((n, i) => {
      if (!n.heard) return
      const x = xOf(n.date)
      const row = x - lastX < fs * 3.4 && lastRow === 0 ? 1 : 0
      labelRow.set(i, row)
      lastX = x
      lastRow = row
    })
  }
  const searching = stage >= 2
  const answered = stage >= 3

  return (
    <figure className="hiw-figure" aria-labelledby="mem-cap">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Steps">
          {STAGES.map((s, i) => (
            <button key={s} type="button" className="hiw-chip" aria-pressed={stage === i} onClick={() => go(i)} style={{ minHeight: 36, padding: '6px 12px' }}>
              <span style={{ color: stage === i ? PINK : 'var(--hiw-ink-3)', fontWeight: 600, marginRight: 6 }}>{i + 1}</span>
              {s}
            </button>
          ))}
        </div>
        <button type="button" className="hiw-btn" onClick={play} disabled={auto || !data}>
          {stage === STAGES.length - 1 && !auto ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {auto ? 'Playing…' : 'Play'}
        </button>
      </div>

      {/* The names, before and after tidying */}
      <div className="px-4 sm:px-6 pt-6 grid gap-3 sm:grid-cols-2">
        <NameCard
          label="Song"
          raw={
            <>
              {TITLE_BASE}{' '}
              <span
                style={{
                  textDecoration: stage >= 1 ? 'line-through' : 'none',
                  textDecorationColor: PINK,
                  opacity: stage >= 1 ? 0.45 : 1,
                  transition: 'opacity 500ms',
                }}
              >
                {TITLE_EXTRA}
              </span>
            </>
          }
          keyText={data?.titleKey}
          showKey={stage >= 1}
        />
        <NameCard label="Band" raw={<>{MEMORY_EXAMPLE.artist}</>} keyText={data?.actKey} showKey={stage >= 1} />
      </div>

      {/* Forty years of concerts */}
      <div className="px-2 sm:px-4 pt-4">
        <svg className="hiw-svg block w-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A timeline of every concert in the archive since 1984. The ${nights.length} ${MEMORY_EXAMPLE.artist} concerts are marked, and the ${heard.length} where this song was on the setlist light up.`}>
          <defs>
            <filter id="mem-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <line x1={x0} x2={x1} y1={y} y2={y} stroke={LAV} strokeOpacity="0.25" />
          {/* Decades */}
          {[1990, 2000, 2010, 2020].map((d) => {
            const x = x0 + ((d - from) / (to - from)) * (x1 - x0)
            return (
              <g key={d}>
                <line x1={x} x2={x} y1={y - 10} y2={y + 10} stroke={LAV} strokeOpacity="0.3" />
                <text x={x} y={y + 18 + fs} fontSize={fs} textAnchor="middle" fill="#8189b5">
                  {d}
                </text>
              </g>
            )
          })}
          {/* Every concert, faint */}
          {all.map((d, i) => (
            <circle key={i} cx={xOf(d)} cy={y} r={narrow ? 4 : 2.6} fill={LAV} fillOpacity={searching ? 0.18 : 0.35} style={{ transition: 'fill-opacity 600ms' }} />
          ))}
          {/* The scan */}
          {stage === 2 && !reduced && (
            <line x1={x0} x2={x0} y1={y - 40} y2={y + 14} stroke={COOL} strokeWidth="2" style={{ animation: 'hiw-scan 2.2s cubic-bezier(0.4,0,0.2,1) both' }} />
          )}
          {/* The band's nights */}
          {nights.map((n, i) => {
            const x = xOf(n.date)
            const lit = answered && n.heard
            const delay = reduced ? 0 : ((x - x0) / (x1 - x0)) * 2.2
            return (
              <g key={n.date + i} style={{ opacity: searching ? 1 : 0, transition: `opacity 300ms ${stage === 2 ? delay : 0}s` }}>
                {lit && <circle cx={x} cy={y} r={narrow ? 18 : 12} fill={PINK} opacity="0.5" filter="url(#mem-glow)" />}
                <circle
                  cx={x}
                  cy={y}
                  r={narrow ? 11 : 7}
                  fill={lit ? PINK : '#0a0e26'}
                  stroke={lit ? PINK : COOL}
                  strokeWidth={narrow ? 3 : 2}
                  strokeDasharray={n.hasSetlist ? undefined : '3 3'}
                  style={{ transition: 'fill 400ms, stroke 400ms' }}
                />
                {lit && (
                  <text x={x} y={y - (narrow ? 26 : 18) - (labelRow.get(i) ?? 0) * (fs + 6)} fontSize={fs} fontWeight="600" textAnchor="middle" fill="#fff" style={{ animation: 'hiw-pop 0.4s ease both' }}>
                    {year(n.date)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-2 pb-1 font-sans" style={{ fontSize: 13, color: 'var(--hiw-ink-3)' }} aria-hidden="true">
          <span>
            <Dot fill={LAV} opacity={0.5} /> every concert in the archive
          </span>
          <span>
            <Dot ring={COOL} /> a {MEMORY_EXAMPLE.artist} concert
          </span>
          <span>
            <Dot fill={PINK} /> the song is on its setlist
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-5 pt-3">
        <p id="mem-cap" className="hiw-figcaption" aria-live="polite" style={{ minHeight: '4.7em', color: 'var(--hiw-ink)' }}>
          <span style={{ color: PINK, fontWeight: 600 }}>
            {stage + 1}. {STAGES[stage]}.{' '}
          </span>
          {data === undefined ? 'Asking the archive…' : captions[stage]}
        </p>
      </div>
    </figure>
  )
}

function NameCard({ label, raw, keyText, showKey }: { label: string; raw: ReactNode; keyText?: string; showKey: boolean }) {
  return (
    <div className="hiw-hood" style={{ padding: '12px 14px' }}>
      <div className="hiw-step" style={{ fontSize: 11, color: 'var(--hiw-ink-3)' }}>
        {label}
      </div>
      <div className="font-sans mt-1" style={{ fontSize: 17, color: 'var(--hiw-ink)' }}>
        {raw}
      </div>
      <div className="font-sans mt-2 flex items-center gap-2" style={{ fontSize: 14, minHeight: 26, opacity: showKey ? 1 : 0, transition: 'opacity 500ms 300ms' }}>
        <span style={{ color: PINK }} aria-hidden="true">
          →
        </span>
        <code style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: '#c7d2fe', background: 'rgba(165,180,252,0.1)', padding: '2px 8px', borderRadius: 6 }}>
          {keyText ?? '…'}
        </code>
      </div>
    </div>
  )
}

function Dot({ fill, ring, opacity = 1 }: { fill?: string; ring?: string; opacity?: number }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
      <circle cx="5" cy="5" r="4" fill={fill ?? 'transparent'} fillOpacity={opacity} stroke={ring} strokeWidth={ring ? 1.6 : 0} />
    </svg>
  )
}
