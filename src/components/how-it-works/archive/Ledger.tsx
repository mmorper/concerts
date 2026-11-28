/**
 * The running tally: one row of the spreadsheet, followed down the page, with a count of what the
 * site knows about that night after each step.
 *
 * On a wide screen it rides along in the right margin (LedgerAside). Anywhere narrower, each step
 * ends with a small receipt instead (StepReceipt), so nothing floats over the text. The counting
 * itself is in facts.ts; the data is the same published files the rest of the chapter reads.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMediaQuery, useReducedMotion } from '../shared'
import { archiveTotals, FOLLOWED, ledgerFor, STEPS, type FactData, type Ledger, type SetlistEntry, type Step } from './facts'
import { sheetDate, useConcerts, useJson, type ArtistMeta, type TopTracks, type VenueMeta } from './data'

const COLOR: Record<Step, string> = {
  typed: '#94a3b8',
  row: '#64748b',
  names: '#8b5cf6',
  map: '#6366f1',
  face: '#a78bfa',
  sound: '#7dd3fc',
  setlists: '#f472b6',
}

/** The six files the counts need. Fetched a moment after the page appears (shared with the steps). */
export function useFactData(): FactData | null | undefined {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setGo(true), 600)
    return () => window.clearTimeout(t)
  }, [])
  const concerts = useConcerts()
  const venues = useJson<Record<string, VenueMeta>>('/data/venues-metadata.json', go)
  const meta = useJson<Record<string, ArtistMeta>>('/data/artists-metadata.json', go)
  const tops = useJson<Record<string, TopTracks>>('/data/artists-top-tracks.json', go)
  const sets = useJson<{ entries: SetlistEntry[] }>('/data/setlists-cache.json', go)
  const albums = useJson<{ songs: Record<string, unknown> }>('/data/song-albums.json', go)
  return useMemo(() => {
    const all = [concerts, venues, meta, tops, sets, albums]
    if (all.some((x) => x === null)) return null
    if (all.some((x) => x === undefined)) return undefined
    return { concerts: concerts!, venues: venues!, meta: meta!, tops: tops!, sets: sets!.entries, albums: albums!.songs }
  }, [concerts, venues, meta, tops, sets, albums])
}

/** The followed row's ledger, or undefined until the data is in. */
export function useFollowedLedger(data: FactData | null | undefined): Ledger | undefined {
  return useMemo(() => {
    const c = data?.concerts.find((x) => x.date === FOLLOWED)
    return data && c ? ledgerFor(c, data) : undefined
  }, [data])
}

/** Which of the chapter's sections is crossing the middle of the screen. */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    for (const id of key.split(',')) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [key])
  return active
}

function useCountUp(target: number): number {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (reduced || from.current === target) {
      from.current = target
      setShown(target)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600)
      setShown(Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])
  return shown
}

/** Wide screens only: the card in the right margin, shown while a step is on screen. */
export function LedgerAside({ ledger, active }: { ledger?: Ledger; active: string | null }) {
  const wide = useMediaQuery('(min-width: 1440px)')
  const idx = STEPS.indexOf((active ?? '') as Step)
  const visible = wide && !!ledger && idx > 0
  const upTo = ledger && idx > 0 ? ledger.lines.slice(0, idx + 1) : []
  const sofar = upTo.reduce((s, l) => s + l.n, 0)
  const shown = useCountUp(sofar)
  if (!wide || !ledger) return null
  const c = ledger.concert
  return (
    <aside
      aria-label="Facts so far for the row this page follows"
      className="fixed z-20 font-sans"
      style={{
        right: 16,
        top: '50%',
        width: 236,
        transform: `translateY(-50%) translateX(${visible ? 0 : 24}px)`,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        background: 'linear-gradient(180deg, #121842, #0d1232)',
        border: '1px solid var(--hiw-panel-line)',
        borderRadius: 16,
        padding: '16px 16px 12px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      }}
    >
      <div className="hiw-step" style={{ fontSize: 10.5, color: 'var(--hiw-ink-3)' }}>
        Following one row
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, lineHeight: 1.35 }}>
        {c.headliner}
        <span style={{ color: 'var(--hiw-ink-3)', fontWeight: 400 }}>
          {' '}
          · {c.venue} · {sheetDate(c.date)}
        </span>
      </div>
      <div className="flex items-baseline gap-2.5 mt-3">
        <b style={{ fontSize: 40, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
          {shown}
        </b>
        <span style={{ fontSize: 13, color: 'var(--hiw-ink-2)', lineHeight: 1.3 }}>
          facts so far
          <br />
          {ledger.typed} typed, {Math.max(0, sofar - ledger.typed)} found
        </span>
      </div>
      <Bar ledger={ledger} upTo={idx} />
      <ul style={{ listStyle: 'none', fontSize: 12.5 }}>
        {ledger.lines.map((l, i) => {
          const now = i === idx
          const later = i > idx
          return (
            <li
              key={l.step}
              className="flex gap-2 items-baseline"
              style={{
                padding: now ? '5px 7px' : '5px 0',
                margin: now ? '0 -7px' : 0,
                borderRadius: 8,
                background: now ? 'rgba(244,114,182,0.09)' : 'transparent',
                borderTop: i && !now ? '1px solid rgba(165,180,252,0.08)' : '1px solid transparent',
                opacity: later ? 0.35 : 1,
                transition: 'opacity 0.3s ease, background 0.3s ease',
              }}
            >
              <span style={{ minWidth: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: now ? 'var(--hiw-dot)' : undefined }}>
                {i ? `+${l.n}` : l.n}
              </span>
              <span style={{ flex: 1, color: 'var(--hiw-ink)', lineHeight: 1.35 }}>{l.label}</span>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function Bar({ ledger, upTo }: { ledger: Ledger; upTo: number }) {
  return (
    <div className="flex my-3 overflow-hidden" style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} aria-hidden="true">
      {ledger.lines.map((l, i) => (
        <span
          key={l.step}
          style={{
            width: `${(l.n / ledger.total) * 100}%`,
            background: COLOR[l.step],
            opacity: i <= upTo ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        />
      ))}
    </div>
  )
}

/** Below 1440px: what a step added, at the end of the step. */
export function StepReceipt({ ledger, step }: { ledger?: Ledger; step: Step }) {
  const wide = useMediaQuery('(min-width: 1440px)')
  if (wide || !ledger) return null
  const i = STEPS.indexOf(step)
  const line = ledger.lines[i]
  const sofar = ledger.lines.slice(0, i + 1).reduce((s, l) => s + l.n, 0)
  const last = i === STEPS.length - 1
  return (
    <div className="font-sans rounded-2xl mt-6 px-4 py-3" style={{ border: '1px solid var(--hiw-panel-line)', background: 'var(--hiw-panel)' }}>
      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <span style={{ color: 'var(--hiw-dot)', fontWeight: 700, fontSize: 17 }}>
          +{line.n} {line.n === 1 ? 'fact' : 'facts'}
        </span>
        <span style={{ color: 'var(--hiw-ink-3)', fontSize: 13 }}>
          {ledger.concert.headliner}, {sheetDate(ledger.concert.date)} · {sofar} {last ? 'in all' : 'so far'} · {ledger.typed} typed
        </span>
      </div>
      {line.items.length > 0 ? (
        <ul className="mt-2" style={{ listStyle: 'none', fontSize: 14, color: 'var(--hiw-ink-2)' }}>
          {line.items.map((it) => (
            <li key={it.label} className="flex justify-between gap-3 py-0.5">
              <span>
                {it.n > 1 && <b style={{ color: 'var(--hiw-ink)', fontVariantNumeric: 'tabular-nums' }}>{it.n} · </b>}
                {it.label}
              </span>
              <span style={{ color: 'var(--hiw-ink-3)', fontSize: 13, whiteSpace: 'nowrap' }}>{line.where.join(' · ')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1" style={{ fontSize: 14, color: 'var(--hiw-ink-3)' }}>
          {line.label}
        </p>
      )}
    </div>
  )
}

/** The whole archive in one line: values typed, facts known, places that use them. */
export function ArchiveCount({ data }: { data: FactData | null | undefined }) {
  const t = useMemo(() => (data ? archiveTotals(data) : undefined), [data])
  const fmt = (n?: number) => (n === undefined ? '…' : n.toLocaleString('en-US'))
  const PLACES = ['Timeline', 'Venues', 'Map', 'Genres', 'Artists', 'Ask the Archive', 'Liner Notes', 'Now Spinning']
  if (data === null) return null
  return (
    <figure className="hiw-figure p-5 sm:p-6 mt-10" aria-labelledby="archive-count-cap">
      <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-4 font-sans">
        <Box big={fmt(t?.typed)} small={`values typed, ${t ? t.shows : '…'} shows`} />
        <Arrow />
        <Box big={fmt(t?.total)} small="facts the site knows" accent="#f472b6" />
        <Arrow />
        <Box big={String(PLACES.length)} small="places on the site that use them" accent="#a5b4fc" />
      </div>
      <p className="font-sans mt-4" style={{ fontSize: 13.5, color: 'var(--hiw-ink-3)', lineHeight: 1.5 }}>
        {PLACES.map((pl, i) => (
          <span key={pl}>
            <span className="whitespace-nowrap">{pl}</span>
            {i < PLACES.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>
      <figcaption id="archive-count-cap" className="hiw-figcaption mt-2">
        Counted live from today’s data. Each fact counts once: a venue’s address counts once, however many shows I saw
        there.
      </figcaption>
    </figure>
  )
}

function Box({ big, small, accent }: { big: string; small: string; accent?: string }) {
  return (
    <div className="flex-1 rounded-2xl px-2 sm:px-4 py-3 text-center" style={{ border: `1px solid ${accent ? `${accent}66` : 'var(--hiw-panel-line)'}` }}>
      <b className="block" style={{ fontSize: 'clamp(22px, 4vw, 38px)', lineHeight: 1.1, color: accent ?? 'var(--hiw-ink)', fontVariantNumeric: 'tabular-nums' }}>
        {big}
      </b>
      <span className="block" style={{ fontSize: 12.5, color: 'var(--hiw-ink-3)', lineHeight: 1.35 }}>{small}</span>
    </div>
  )
}

const Arrow = () => (
  <span className="hidden sm:inline" style={{ color: 'var(--hiw-lav)', fontSize: 22 }} aria-hidden="true">
    →
  </span>
)

