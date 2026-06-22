import { useEffect, useState, type ReactNode } from 'react'
import { analytics } from '@/services/analytics'
import type { DashboardSnapshot } from '@/types/dashboard'
import { CostControlTab } from './CostControlTab'
import { EngagementTab, type SnapshotLoadState } from './EngagementTab'

// Phase 1 (#171) — Operator MVP (Overview) + Phase 2 (#172) Cost & Control + Phase 3 (#173)
// Engagement (GA4). Overview + Engagement read the daily KV snapshot; Cost & Control reads the live
// ask-chat admin API.

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

function OverviewView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { spend, cloudflare, ask, sourceStatus, fetchErrors, dataAge, refreshedAt } = snapshot
  const capPct =
    spend && spend.capUsd ? Math.min(100, (spend.costUsdMonthToDate / spend.capUsd) * 100) : 0
  const capColor = capPct >= 100 ? 'bg-red-500' : capPct >= 75 ? 'bg-amber-500' : 'bg-indigo-600'

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
      <p className="mb-6 text-sm text-stone-500">Cost control · traffic · topics of interest</p>

      {fetchErrors.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Partial data:</b> {fetchErrors.join(' · ')}
        </div>
      )}

      {/* Hero KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Label>💸 Spend · month-to-date</Label>
          {spend ? (
            <>
              <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">
                {fmtUsd(spend.costUsdMonthToDate)}
                {spend.capUsd != null && (
                  <span className="ml-1 font-sans text-lg text-stone-400">/ {fmtUsd(spend.capUsd)}</span>
                )}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                {spend.capUsd != null ? `${capPct.toFixed(0)}% of cap` : 'no cap set'} · today{' '}
                {fmtUsd(spend.costUsdToday)}
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
          <Label>💬 Ask turns · 30 days</Label>
          {ask ? (
            <>
              <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">{fmtInt(ask.turns30d)}</div>
              <div className="mt-1 text-sm text-stone-500">
                {fmtInt(ask.turns7d)} in 7d · {(ask.refusalRate30d * 100).toFixed(1)}% refused
              </div>
            </>
          ) : (
            <Pending />
          )}
        </Card>

        <Card>
          <Label>📈 Traffic · 30 days</Label>
          {cloudflare ? (
            <>
              <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">
                {fmtInt(cloudflare.requests30d)}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                edge requests · {fmtInt(cloudflare.workerRequests30d)} worker
              </div>
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

type TabId = 'overview' | 'cost' | 'engagement'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cost', label: 'Cost & Control' },
  { id: 'engagement', label: 'Engagement' },
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
    </div>
  )
}
