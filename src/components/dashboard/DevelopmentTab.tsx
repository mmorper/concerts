import type { ReactNode } from 'react'
import type { GitHubSection } from '@/types/dashboard'
import type { SnapshotLoadState } from './EngagementTab'

// Phase 6 (#176) — the Development tab. Reads `snapshot.github` (commit velocity, open issues by
// label, recent merged PRs for mmorper/concerts). Optional — null until a GH_TOKEN secret is set on
// the refresh Worker; the tab shows a "pending" note until then.

const fmtInt = (n: number) => n.toLocaleString()
const INDIGO = '#4f46e5'

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">{children}</div>
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-20 text-center text-sm text-stone-500">{children}</div>
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">{fmtInt(value)}</div>
    </Card>
  )
}

function HBar({ data }: { data: Array<{ label: string; value: number }> }) {
  if (data.length === 0) return <p className="mt-3 text-sm text-stone-400">No labels in range.</p>
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="mt-3 space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-stone-600">{d.label}</span>
            <span className="font-semibold tabular-nums text-indigo-950">{fmtInt(d.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: INDIGO }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function relativeDay(iso: string): string {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(d)) return ''
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function DevelopmentView({ github }: { github: GitHubSection }) {
  const { velocity, issues, recentPrs } = github
  const labelBars = Object.entries(issues.byLabel)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      <p className="pt-2 text-sm text-stone-500">
        Repository velocity for <code>mmorper/concerts</code> — commits, merged PRs, open issues.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Kpi label="Commits · 7d" value={velocity.commitsLast7d} />
        <Kpi label="Commits · 30d" value={velocity.commitsLast30d} />
        <Kpi label="Merged PRs · 30d" value={velocity.mergedPrsLast30d} />
        <Kpi label="Open issues" value={issues.open} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="font-serif text-lg font-semibold text-indigo-950">Open issues by label</h3>
          <HBar data={labelBars} />
        </Card>
        <Card>
          <h3 className="font-serif text-lg font-semibold text-indigo-950">Recent merged PRs</h3>
          {recentPrs.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No merged PRs in range.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentPrs.map((pr) => (
                <li key={pr.number} className="border-b border-stone-100 pb-2 text-sm last:border-0">
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-baseline justify-between gap-3 hover:text-indigo-700"
                  >
                    <span className="truncate text-stone-700">
                      <span className="font-mono text-stone-400">#{pr.number}</span> {pr.title}
                    </span>
                    <span className="shrink-0 text-xs text-stone-400">{relativeDay(pr.mergedAt)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">Phase 6 — Development · GitHub velocity (Epic #159)</p>
    </div>
  )
}

function Pending() {
  return (
    <Centered>
      Development is pending — the snapshot has no <code>github</code> section yet.
      <br />
      Set a <code>GH_TOKEN</code> secret on the refresh Worker to enable it.
    </Centered>
  )
}

export function DevelopmentTab({ state }: { state: SnapshotLoadState }) {
  if (state.status === 'loading') return <Centered>Loading development…</Centered>
  if (state.status === 'empty')
    return (
      <Centered>
        No data yet — the first refresh runs at 06:00 UTC.
        <br />
        (Seed <code>dashboard:snapshot</code> in KV to preview.)
      </Centered>
    )
  if (state.status === 'error') return <Centered>Couldn&rsquo;t load the dashboard: {state.message}</Centered>
  if (!state.snapshot.github) return <Pending />
  return <DevelopmentView github={state.snapshot.github} />
}
