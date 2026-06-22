import { useEffect, useState, type ReactNode } from 'react'
import { analytics } from '@/services/analytics'
import type { DashboardSnapshot } from '@/types/dashboard'
import { CostControlTab } from './CostControlTab'
import { EngagementTab, type SnapshotLoadState } from './EngagementTab'
import { McpAskTab } from './McpAskTab'
import { ArchiveHealthTab } from './ArchiveHealthTab'
import { TopicsGapsTab } from './TopicsGapsTab'
import { TrendsTab } from './TrendsTab'
import { DevelopmentTab } from './DevelopmentTab'

// Phases 1–6 (Epic #159). Overview · Cost & Control · Engagement · MCP & Ask · Archive Health ·
// Topics & Gaps · Trends · Development. All snapshot tabs read the daily KV plane; Cost & Control
// reads the live ask-chat admin API.

// Snapshot load-state (the daily KV plane), shared with the Engagement tab.
type LoadState = SnapshotLoadState

const fmtInt = (n: number) => n.toLocaleString()
const fmtUsd = (n: number) => '$' + n.toFixed(2)

const OUTCOME_COLOR: Record<string, string> = {
  answered: '#16a34a',
  deterministic: '#4f46e5',
  refused: '#f59e0b',
  cap: '#dc2626',
  paused: '#94a3b8',
  error: '#dc2626',
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return 'unknown'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 240
  const h = 44
  const max = Math.max(...values) || 1
  const step = w / (values.length - 1)
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="44" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">{children}</div>
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{children}</div>
}

type Window = 7 | 30 | 90
/** Segmented 7 / 30 / 90-day picker driving the Overview hero cards. */
function WindowToggle({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 text-xs font-semibold">
      {([7, 30, 90] as Window[]).map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className={`px-3 py-1.5 transition-colors ${
            value === w ? 'bg-indigo-600 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
          }`}
        >
          {w}d
        </button>
      ))}
    </div>
  )
}

function MiniBar({ data }: { data: Array<[string, number]> }) {
  if (data.length === 0) return <p className="mt-3 text-sm text-stone-400">No data in range.</p>
  const max = Math.max(1, ...data.map(([, v]) => v))
  return (
    <div className="mt-3 space-y-2">
      {data.map(([label, v]) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-stone-600">{label}</span>
            <span className="font-semibold tabular-nums text-indigo-950">{fmtInt(v)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function OverviewView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { spend, cloudflare, ask, ga, monitoring, sourceStatus, fetchErrors, dataAge, refreshedAt } = snapshot
  const [win, setWin] = useState<Window>(30)
  const topN = (rec: Record<string, number>, n: number): Array<[string, number]> =>
    Object.entries(rec)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
  const capPct =
    spend && spend.capUsd ? Math.min(100, (spend.costUsdMonthToDate / spend.capUsd) * 100) : 0
  const capColor = capPct >= 100 ? 'bg-red-500' : capPct >= 75 ? 'bg-amber-500' : 'bg-indigo-600'
  // The 7/30/90 toggle drives the three hero cards. Each metric carries all three windows in the snapshot.
  const pick = <T,>(d7: T, d30: T, d90: T): T => (win === 7 ? d7 : win === 90 ? d90 : d30)
  const spendWin = spend ? pick(spend.costUsd7d, spend.costUsd30d, spend.costUsd90d) : 0
  const turnsWin = ask ? pick(ask.turns7d, ask.turns30d, ask.turns90d) : 0
  const visitsWin = ga ? pick(ga.website.sessions7d, ga.website.sessions30d, ga.website.sessions90d) : 0

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      {/* Snapshot meta */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-2">
        <span className="text-sm text-stone-500">
          Refreshed {relativeTime(refreshedAt)}
          {dataAge === 'stale' && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              stale
            </span>
          )}
        </span>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">Cost control · visits · topics of interest</p>
        <WindowToggle value={win} onChange={setWin} />
      </div>

      {fetchErrors.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Partial data:</b> {fetchErrors.join(' · ')}
        </div>
      )}

      {/* Hero KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Label>💸 Spend · {win}d</Label>
          {spend ? (
            <>
              <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">{fmtUsd(spendWin)}</div>
              <div className="mt-1 text-sm text-stone-500">
                {fmtUsd(spend.costUsdMonthToDate)} this month
                {spend.capUsd != null ? ` · ${capPct.toFixed(0)}% of ${fmtUsd(spend.capUsd)} cap` : ' · no cap set'}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                <div className={`h-full rounded-full ${capColor}`} style={{ width: `${capPct}%` }} />
              </div>
              <div className="mt-2">
                <Sparkline values={spend.series.map((s) => s.costUsd)} />
              </div>
            </>
          ) : (
            <Pending />
          )}
        </Card>

        <Card>
          <Label>💬 Ask turns · {win}d</Label>
          {ask ? (
            <>
              <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">{fmtInt(turnsWin)}</div>
              <div className="mt-1 text-sm text-stone-500">
                {(ask.refusalRate30d * 100).toFixed(1)}% refused · 30d
              </div>
            </>
          ) : (
            <Pending />
          )}
        </Card>

        <Card>
          <Label>📈 Visits · {win}d</Label>
          {ga ? (
            <>
              <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">{fmtInt(visitsWin)}</div>
              <div className="mt-1 text-sm text-stone-500">sessions · concerts.morperhaus.org</div>
            </>
          ) : (
            <Pending />
          )}
        </Card>
      </div>

      {/* Topics + outcomes */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <Label>Topics of interest · 30d</Label>
          {ask && ask.topTopics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {ask.topTopics.map((t) => (
                <span
                  key={t.term}
                  className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm text-stone-700"
                >
                  {t.term}
                  <b className="text-violet-700">{t.n}</b>
                </span>
              ))}
            </div>
          ) : (
            <Pending />
          )}
        </Card>

        <Card>
          <Label>Ask outcomes · 30d</Label>
          {ask ? (
            <div className="mt-3 space-y-2">
              {Object.entries(ask.byOutcome)
                .sort((a, b) => b[1] - a[1])
                .map(([outcome, n]) => (
                  <div key={outcome} className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ background: OUTCOME_COLOR[outcome] ?? '#94a3b8' }}
                    />
                    <span className="capitalize text-stone-600">{outcome}</span>
                    <span className="ml-auto font-semibold tabular-nums text-indigo-950">{fmtInt(n)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <Pending />
          )}
        </Card>
      </div>

      {/* Reliability glance (Phase 6 monitoring) */}
      {monitoring && (
        <div className="mt-4">
          <Card>
            <Label>Reliability · 30d</Label>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Edge 5xx', monitoring.edge5xx30d],
                ['Worker 5xx', monitoring.worker5xx30d],
                ['Ask errors', monitoring.askErrors30d],
                ['Ask refusals', monitoring.askRefusals30d],
                ['MCP errors', monitoring.mcpErrors30d],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-xl bg-stone-50 py-3 text-center">
                  <div
                    className={`font-serif text-2xl font-semibold ${
                      (n as number) > 0 ? 'text-amber-700' : 'text-indigo-950'
                    }`}
                  >
                    {fmtInt(n as number)}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-stone-400">{label}</div>
                </div>
              ))}
            </div>
            {cloudflare && (
              <div className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">
                Infra · 30d: <b className="text-stone-700">{fmtInt(cloudflare.requests30d)}</b> edge requests ·{' '}
                <b className="text-stone-700">{fmtInt(cloudflare.workerRequests30d)}</b> worker invocations
              </div>
            )}
          </Card>
        </div>
      )}

      {/* GA website report (Phase 3 panels surfaced on Overview — deferred fast-follow) */}
      {ga && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <Label>Sessions by channel · 30d</Label>
            <MiniBar data={topN(ga.website.byChannel, 6)} />
          </Card>
          <Card>
            <Label>Top countries · 30d</Label>
            <MiniBar data={topN(ga.website.byCountry, 6)} />
          </Card>
          <Card>
            <Label>Top pages · 30d</Label>
            <MiniBar data={ga.website.topPages.slice(0, 6).map((p) => [p.page, p.views] as [string, number])} />
          </Card>
          <Card>
            <Label>Referring traffic · 30d</Label>
            <MiniBar data={ga.website.topReferrers.slice(0, 6).map((r) => [r.source, r.sessions] as [string, number])} />
          </Card>
        </div>
      )}

      {/* Source status */}
      <div className="mt-4">
        <Card>
          <Label>Source status</Label>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-stone-600">
            {Object.entries(sourceStatus).map(([src, status]) => (
              <span key={src} className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    status === 'ok' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-stone-300'
                  }`}
                />
                {src} · {status}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 1 — Operator MVP · Cloudflare + ask_turns · further tabs land in later phases (Epic #159)
      </p>
    </div>
  )
}

function Pending() {
  return <div className="mt-3 text-sm text-stone-400">Pending — source not yet available</div>
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-stone-500">{children}</div>
  )
}

type TabId = 'overview' | 'cost' | 'engagement' | 'mcp' | 'archive' | 'topics' | 'trends' | 'dev'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cost', label: 'Cost & Control' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'mcp', label: 'MCP & Ask' },
  { id: 'archive', label: 'Archive Health' },
  { id: 'topics', label: 'Topics & Gaps' },
  { id: 'trends', label: 'Trends' },
  { id: 'dev', label: 'Development' },
]

function OverviewTab({ state }: { state: LoadState }) {
  return (
    <>
      {state.status === 'loading' && <Centered>Loading dashboard…</Centered>}
      {state.status === 'empty' && (
        <Centered>
          No data yet — the first refresh runs at 06:00 UTC.
          <br />
          (Seed <code>dashboard:snapshot</code> in KV to preview.)
        </Centered>
      )}
      {state.status === 'error' && <Centered>Couldn’t load the dashboard: {state.message}</Centered>}
      {state.status === 'ready' && <OverviewView snapshot={state.snapshot} />}
    </>
  )
}

export function DashboardPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [tab, setTab] = useState<TabId>('overview')

  // Overview snapshot (daily KV plane). The Cost & Control tab loads its own LIVE data.
  useEffect(() => {
    analytics.trackPageView('/dashboard', 'Operator Dashboard')
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/dashboard/data/')
        if (res.status === 503) {
          if (!cancelled) setState({ status: 'empty' })
          return
        }
        if (!res.ok) {
          if (!cancelled) setState({ status: 'error', message: `HTTP ${res.status}` })
          return
        }
        const text = await res.text()
        try {
          const snapshot = JSON.parse(text) as DashboardSnapshot
          if (!cancelled) setState({ status: 'ready', snapshot })
        } catch {
          // Dev (no Pages Function) returns index.html → treat as "no data yet".
          if (!cancelled) setState({ status: 'empty' })
        }
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : 'failed' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const switchTab = (id: TabId) => {
    setTab(id)
    analytics.trackEvent('dashboard_tab', { tab: id })
  }

  return (
    <div className="h-screen overflow-y-auto bg-stone-50 font-sans text-stone-900">
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-indigo-950">
          Concerts — Operator Console
        </h1>
        <nav className="mt-4 flex flex-wrap gap-1 border-b border-stone-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={[
                '-mb-px rounded-t-md border-b-2 px-3.5 py-2.5 text-sm font-semibold transition',
                tab === t.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-900',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && <OverviewTab state={state} />}
      {tab === 'cost' && <CostControlTab />}
      {tab === 'engagement' && <EngagementTab state={state} />}
      {tab === 'mcp' && <McpAskTab state={state} />}
      {tab === 'archive' && <ArchiveHealthTab state={state} />}
      {tab === 'topics' && <TopicsGapsTab state={state} />}
      {tab === 'trends' && <TrendsTab state={state} />}
      {tab === 'dev' && <DevelopmentTab state={state} />}
    </div>
  )
}
