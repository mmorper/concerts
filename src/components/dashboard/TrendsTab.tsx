import type { ReactNode } from 'react'
import type { TrendPoint, TrendsSection } from '@/types/dashboard'
import type { SnapshotLoadState } from './EngagementTab'

// Phase 6 (#176) — the Trends tab. Reads `snapshot.trends`: a per-day union of GA sessions, MCP
// queries, and ask_turns spend. Sessions & spend back-fill 30d immediately (retroactive); the
// external-MCP slice is forward-only, so early days under-count external queries until it accrues.

const fmtInt = (n: number) => n.toLocaleString()
const fmtUsd = (n: number) => '$' + n.toFixed(2)

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">{children}</div>
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-20 text-center text-sm text-stone-500">{children}</div>
}

// Single-series line, x positioned by calendar date so gaps read truthfully. Pure SVG.
function Line({
  series,
  pick,
  color,
  fmt,
}: {
  series: TrendPoint[]
  pick: (p: TrendPoint) => number
  color: string
  fmt: (n: number) => string
}) {
  const pts = series
    .map((p) => ({ date: p.date, v: pick(p) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1)) // defensive: x-scale assumes ascending dates
  if (pts.length < 2) return <p className="mt-3 text-sm text-stone-400">Not enough days in range yet.</p>
  const w = 720
  const h = 150
  const pad = 8
  const max = Math.max(1, ...pts.map((p) => p.v))
  const dayNum = (d: string) => Math.round(Date.parse(d) / 86_400_000)
  const first = dayNum(pts[0].date)
  const span = Math.max(1, dayNum(pts[pts.length - 1].date) - first)
  const x = (d: string) => pad + ((dayNum(d) - first) / span) * (w - pad * 2)
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const line = pts.map((p) => `${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const peak = pts.reduce((a, b) => (b.v > a.v ? b : a), pts[0])
  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="mt-3" aria-hidden>
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-stone-400">
        <span>{pts[0].date}</span>
        <span>peak {fmt(peak.v)}</span>
        <span>{pts[pts.length - 1].date}</span>
      </div>
    </>
  )
}

function TrendsView({ trends }: { trends: TrendsSection }) {
  const { series } = trends
  const sum = (pick: (p: TrendPoint) => number) => series.reduce((a, p) => a + pick(p), 0)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      <p className="pt-2 text-sm text-stone-500">
        Per-day series — GA sessions, MCP queries, and Anthropic spend. Sessions &amp; spend back-fill
        30 days; the external-MCP slice accrues forward from instrumentation.
      </p>

      <div className="mt-4 space-y-4">
        <Card>
          <h3 className="font-serif text-lg font-semibold text-indigo-950">Sessions · per day</h3>
          <p className="mt-0.5 font-mono text-xs text-stone-400">
            GA website sessions · {fmtInt(sum((p) => p.sessions))} in range
          </p>
          <Line series={series} pick={(p) => p.sessions} color="#4f46e5" fmt={fmtInt} />
        </Card>
        <Card>
          <h3 className="font-serif text-lg font-semibold text-indigo-950">MCP queries · per day</h3>
          <p className="mt-0.5 font-mono text-xs text-stone-400">
            in-SPA + external · {fmtInt(sum((p) => p.mcpQueries))} in range
          </p>
          <Line series={series} pick={(p) => p.mcpQueries} color="#7c3aed" fmt={fmtInt} />
        </Card>
        <Card>
          <h3 className="font-serif text-lg font-semibold text-indigo-950">Spend · per day</h3>
          <p className="mt-0.5 font-mono text-xs text-stone-400">
            ask_turns µUSD → USD · {fmtUsd(sum((p) => p.spendUsd))} in range
          </p>
          <Line series={series} pick={(p) => p.spendUsd} color="#16a34a" fmt={fmtUsd} />
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 6 — Trends · history accrues forward from each daily refresh (Epic #159)
      </p>
    </div>
  )
}

function Pending() {
  return (
    <Centered>
      Trends is pending — the snapshot has no <code>trends</code> section yet.
      <br />
      It unions GA sessions, MCP queries, and spend once those sources are flowing.
    </Centered>
  )
}

export function TrendsTab({ state }: { state: SnapshotLoadState }) {
  if (state.status === 'loading') return <Centered>Loading trends…</Centered>
  if (state.status === 'empty')
    return (
      <Centered>
        No data yet — the first refresh runs at 06:00 UTC.
        <br />
        (Seed <code>dashboard:snapshot</code> in KV to preview.)
      </Centered>
    )
  if (state.status === 'error') return <Centered>Couldn&rsquo;t load the dashboard: {state.message}</Centered>
  if (!state.snapshot.trends || state.snapshot.trends.series.length === 0) return <Pending />
  return <TrendsView trends={state.snapshot.trends} />
}
