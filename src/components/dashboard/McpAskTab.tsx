import type { ReactNode } from 'react'
import type { AskSection, DashboardSnapshot, GaSection, McpSection } from '@/types/dashboard'
import type { SnapshotLoadState } from './EngagementTab'

// Phase 4 (#174) — the MCP & Ask tab. Unions the two planes that drive the archive's tools: the
// in-SPA Ask chat (ask_turns) and external MCP clients (mcp_queries — the net-new Analytics Engine
// collector in the morperhaus-mcp Worker). Reads `snapshot.mcp` (queries over time, by tool, source
// split), `snapshot.ask` (outcomes), and `snapshot.ga` (Ask-as-navigation). Until mcp-server ships
// its instrumentation, `mcp.bySource.external` is 0 and the tab says so.

const fmtInt = (n: number) => n.toLocaleString()

const INDIGO = '#4f46e5'
const VIOLET = '#7c3aed'

const OUTCOME_COLOR: Record<string, string> = {
  answered: '#16a34a',
  deterministic: '#4f46e5',
  refused: '#f59e0b',
  cap: '#dc2626',
  paused: '#94a3b8',
  error: '#dc2626',
}

// Exhibit-kind legend swatches (artist / venue / concert), matching the mock.
const EXHIBIT_COLOR: Record<string, string> = {
  artist: '#1e40af',
  venue: '#16a34a',
  concert: '#f59e0b',
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">{children}</div>
}

function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <h3 className="font-serif text-lg font-semibold text-indigo-950">{children}</h3>
      {hint && <p className="mt-0.5 font-mono text-xs text-stone-400">{hint}</p>}
    </>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-20 text-center text-sm text-stone-500">{children}</div>
}

type Bar = { label: string; value: number; color?: string }

function HBar({ data, fmt }: { data: Bar[]; fmt?: (n: number) => string }) {
  if (data.length === 0) return <p className="mt-3 text-sm text-stone-400">No data in range.</p>
  const max = Math.max(1, ...data.map((d) => d.value))
  const f = fmt ?? fmtInt
  return (
    <div className="mt-3 space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-stone-600">{d.label}</span>
            <span className="font-semibold tabular-nums text-indigo-950">{f(d.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? INDIGO }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function StatRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-stone-100 py-2 text-sm last:border-0">
      <span className="text-stone-500">{k}</span>
      <span className="font-semibold tabular-nums text-indigo-950">{v}</span>
    </div>
  )
}

// Two-segment doughnut (in-SPA vs external). Pure SVG, no chart lib (matches the app's hand-rolled viz).
function SourceDonut({ spa, external }: { spa: number; external: number }) {
  const total = spa + external
  const segs = [
    { label: 'in-SPA', value: spa, color: INDIGO },
    { label: 'external', value: external, color: VIOLET },
  ]
  const r = 52
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="mt-3 flex items-center gap-5">
      <svg viewBox="0 0 140 140" width="120" height="120" aria-hidden>
        <g transform="translate(70,70) rotate(-90)">
          <circle r={r} fill="none" stroke="#f1f0ee" strokeWidth="18" />
          {total > 0 &&
            segs.map((s) => {
              const len = (s.value / total) * c
              const dash = `${len} ${c - len}`
              const el = (
                <circle
                  key={s.label}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="18"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              )
              offset += len
              return el
            })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-indigo-950 font-serif" fontSize="22" fontWeight="600">
          {fmtInt(total)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="fill-stone-400" fontSize="11">
          queries · 30d
        </text>
      </svg>
      <div className="space-y-2 text-sm">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-stone-600">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-indigo-950">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Multi-line chart: in-SPA + external queries per day. Pure SVG. x is positioned by CALENDAR DATE
// (not array index) so sparse days read truthfully — a 6-day quiet gap is six times wider than a
// 1-day gap, instead of collapsing to an equal step the way an index-based sparkline would.
function MultiLine({ series }: { series: McpSection['series'] }) {
  if (series.length < 2)
    return <p className="mt-3 text-sm text-stone-400">Not enough days in range to chart yet.</p>
  const w = 560
  const h = 160
  const pad = 6
  const max = Math.max(1, ...series.flatMap((p) => [p.spa, p.external]))
  const dayNum = (d: string) => Math.round(Date.parse(d) / 86_400_000)
  // series is sorted ascending by date (assembleMcp); span the x-axis across the real date range.
  const first = dayNum(series[0].date)
  const span = Math.max(1, dayNum(series[series.length - 1].date) - first)
  const x = (d: string) => pad + ((dayNum(d) - first) / span) * (w - pad * 2)
  const path = (key: 'spa' | 'external') =>
    series
      .map((p) => `${x(p.date).toFixed(1)},${(h - pad - (p[key] / max) * (h - pad * 2)).toFixed(1)}`)
      .join(' ')
  const lines = [
    { key: 'spa' as const, label: 'in-SPA (ask)', color: INDIGO },
    { key: 'external' as const, label: 'external (Claude et al.)', color: VIOLET },
  ]
  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="mt-3" aria-hidden>
        {lines.map((l) => (
          <polyline key={l.key} points={path(l.key)} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        {lines.map((l) => (
          <span key={l.key} className="flex items-center gap-2 text-stone-600">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </>
  )
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">{value}</div>
      {sub && <div className="mt-1 text-sm text-stone-500">{sub}</div>}
    </Card>
  )
}

const TOOL_LABELS: Record<string, string> = {
  query: 'query (LLM)',
  search_concerts: 'search_concerts',
  get_artist_history: 'get_artist_history',
  get_venue_history: 'get_venue_history',
  get_concert_setlist: 'get_concert_setlist',
  get_archive_top_songs: 'get_archive_top_songs',
  on_this_day: 'on_this_day',
  surprise_me: 'surprise_me',
  get_archive_info: 'get_archive_info',
}

function McpAskView({ mcp, ask, ga }: { mcp: McpSection; ask: AskSection | null; ga: GaSection | null }) {
  const { bySource } = mcp
  const total = bySource.spa + bySource.external
  const spaPct = total > 0 ? Math.round((bySource.spa / total) * 100) : 0

  const toolBars: Bar[] = Object.entries(mcp.byTool)
    .map(([tool, value]) => ({ label: TOOL_LABELS[tool] ?? tool, value }))
    .sort((a, b) => b.value - a.value)

  const exhibitTotal = Object.values(mcp.askExhibitKinds).reduce((a, b) => a + b, 0)

  // "Pending" means the collector hasn't responded (not deployed) — NOT merely zero external calls.
  // Once deployed, a quiet 30d window (external 0, externalLive true) reads as real data, not pending.
  const externalPending = !mcp.externalLive

  const navBars: Bar[] = (ga?.engagement.askNav ?? []).map((x) => ({ label: `→ ${x.name}`, value: x.n }))
  const deepLinksClicked = ga?.engagement.ask['ask_deeplink_clicked'] ?? 0

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      <p className="pt-2 text-sm text-stone-500">
        Query volume from the in-SPA chat (<code>ask_turns</code>) and external MCP clients (
        <code>mcp_queries</code>). 30-day windows.
      </p>

      {externalPending && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          External tool-calls pending instrumentation — the in-SPA (Ask) side is live; external client
          counts read 0 until the <code>morperhaus-mcp</code> Worker is deployed with its Analytics
          Engine collector (not retroactive).
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Kpi label="Queries · 7d" value={fmtInt(mcp.queries7d)} />
        <Kpi label="Queries · 30d" value={fmtInt(mcp.queries30d)} />
        <Kpi
          label="SPA vs external"
          value={
            <>
              {spaPct}
              <span className="font-sans text-2xl text-stone-400">/{100 - spaPct}</span>
            </>
          }
          sub="in-app / Claude et al."
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardTitle hint="daily · in-SPA (ask_turns) + external (mcp_queries)">Queries over time · 30d</CardTitle>
            <MultiLine series={mcp.series} />
          </Card>
        </div>
        <Card>
          <CardTitle hint="in-SPA vs external clients">Source split · 30d</CardTitle>
          <SourceDonut spa={bySource.spa} external={bySource.external} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="mcp_queries · tool name → call count">By tool · 30d</CardTitle>
          {externalPending && toolBars.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">
              Per-tool counts come from external clients — pending instrumentation.
            </p>
          ) : (
            <HBar data={toolBars} />
          )}
        </Card>
        <Card>
          <CardTitle hint="ask_turns · outcome + exhibit kind">Ask outcomes · 30d</CardTitle>
          {ask ? (
            <>
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
              {exhibitTotal > 0 && (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-stone-100 pt-3 text-sm text-stone-600">
                  {Object.entries(mcp.askExhibitKinds)
                    .sort((a, b) => b[1] - a[1])
                    .map(([kind, n]) => (
                      <span key={kind} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{ background: EXHIBIT_COLOR[kind] ?? '#94a3b8' }}
                        />
                        {kind} {Math.round((n / exhibitTotal) * 100)}%
                      </span>
                    ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-stone-400">Ask outcomes pending — no <code>ask</code> section.</p>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardTitle hint="ask_deeplink_clicked · does the chat drive people into the archive?">
            Ask as a navigation engine · 30d
          </CardTitle>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            <div>
              <StatRow k="Deep-links clicked" v={fmtInt(deepLinksClicked)} />
              <StatRow k="Deep links accessed" v={fmtInt(ga?.engagement.deepLinks ?? 0)} />
              <p className="mt-3 text-sm text-stone-500">
                High pass-through → Ask is a discovery surface, not a dead-end. Worth more real estate.
              </p>
            </div>
            <div>
              {navBars.length > 0 ? (
                <HBar data={navBars} />
              ) : (
                <p className="mt-3 text-sm text-stone-400">
                  Per-scene breakdown pending — register the <code>target_scene</code> GA4 custom dimension
                  (not retroactive).
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 4 — MCP &amp; Ask · external tool-call history accrues from the day mcp-server deploys its
        Analytics Engine collector (Epic #159)
      </p>
    </div>
  )
}

function Pending() {
  return (
    <Centered>
      MCP &amp; Ask is pending — the snapshot has no <code>mcp</code> section yet.
      <br />
      The refresh Worker builds it from the <code>ask_turns</code> + <code>mcp_queries</code> Analytics
      Engine tables on its next run.
    </Centered>
  )
}

export function McpAskTab({ state }: { state: SnapshotLoadState }) {
  if (state.status === 'loading') return <Centered>Loading MCP &amp; Ask…</Centered>
  if (state.status === 'empty')
    return (
      <Centered>
        No data yet — the first refresh runs at 06:00 UTC.
        <br />
        (Seed <code>dashboard:snapshot</code> in KV to preview.)
      </Centered>
    )
  if (state.status === 'error') return <Centered>Couldn&rsquo;t load the dashboard: {state.message}</Centered>
  const snapshot: DashboardSnapshot = state.snapshot
  if (!snapshot.mcp) return <Pending />
  return <McpAskView mcp={snapshot.mcp} ask={snapshot.ask} ga={snapshot.ga} />
}
