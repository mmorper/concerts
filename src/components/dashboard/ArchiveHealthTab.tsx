import type { ReactNode } from 'react'
import type { ArchiveHealthSection, ArchiveStage } from '@/types/dashboard'
import type { SnapshotLoadState } from './EngagementTab'

// Phase 5 (#175) — the Archive Health tab. One equally-weighted coverage bar per enrichment stage
// (spec Appendix C), computed by the refresh Worker from the generated public/data/*.json. Reads
// `snapshot.archiveHealth`; null → a "pending" placeholder. Demand×Coverage quadrant deferred (needs
// the Phase-3 GA click data, which isn't flowing until the GA4 custom dimensions are registered).

const fmtInt = (n: number) => n.toLocaleString()

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return 'unknown'
  const d = Math.round(ms / 86_400_000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

// Coverage color: healthy ≥85%, watch ≥60%, gap below.
const barColor = (pct: number) => (pct >= 85 ? '#16a34a' : pct >= 60 ? '#f59e0b' : '#dc2626')

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">{children}</div>
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 text-center text-sm text-stone-500">{children}</div>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-2 font-serif text-4xl font-semibold text-indigo-950">{fmtInt(value)}</div>
    </Card>
  )
}

function CoverageRow({ s }: { s: ArchiveStage }) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-stone-700">{s.stage}</span>
        <span className="tabular-nums text-stone-500">
          <b className="text-indigo-950">{s.pct}%</b> · {fmtInt(s.covered)}/{fmtInt(s.total)}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: barColor(s.pct) }} />
      </div>
      {s.note && <div className="mt-1 text-xs text-stone-400">{s.note}</div>}
    </div>
  )
}

function ArchiveHealthView({ health }: { health: ArchiveHealthSection }) {
  const { stages, lastBuildAt, concerts, artists, venues } = health
  // Equal-weight mean of stage coverage — the single "how enriched is the archive" headline.
  const overall = stages.length
    ? Math.round(stages.reduce((sum, s) => sum + s.pct, 0) / stages.length)
    : 0

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
        <p className="text-sm text-stone-500">
          Enrichment-pipeline coverage from <code>public/data</code> — all stages weighted equally.
        </p>
        {lastBuildAt && (
          <span className="text-xs text-stone-400">last build {relativeTime(lastBuildAt)}</span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Kpi label="Concerts" value={concerts} />
        <Kpi label="Artists" value={artists} />
        <Kpi label="Venues" value={venues} />
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Overall coverage</div>
          <div className="mt-2 font-serif text-4xl font-semibold" style={{ color: barColor(overall) }}>
            {overall}%
          </div>
          <div className="mt-1 text-xs text-stone-400">mean across {stages.length} stages</div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <h3 className="font-serif text-lg font-semibold text-indigo-950">Coverage by enrichment stage</h3>
          <p className="mt-0.5 font-mono text-xs text-stone-400">spec Appendix C · one row per stage</p>
          <div className="mt-2 divide-y divide-stone-100">
            {stages.map((s) => (
              <CoverageRow key={s.stage} s={s} />
            ))}
          </div>
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 5 — Archive Health · Demand×Coverage quadrant lands once GA click data accrues (Epic #159)
      </p>
    </div>
  )
}

function Pending() {
  return (
    <Centered>
      Archive Health is pending — the snapshot has no <code>archiveHealth</code> section yet.
      <br />
      The refresh Worker computes it from <code>public/data/*.json</code> on its next run.
    </Centered>
  )
}

export function ArchiveHealthTab({ state }: { state: SnapshotLoadState }) {
  if (state.status === 'loading') return <Centered>Loading archive health…</Centered>
  if (state.status === 'empty')
    return (
      <Centered>
        No data yet — the first refresh runs at 06:00 UTC.
        <br />
        (Seed <code>dashboard:snapshot</code> in KV to preview.)
      </Centered>
    )
  if (state.status === 'error') return <Centered>Couldn&rsquo;t load the dashboard: {state.message}</Centered>
  if (!state.snapshot.archiveHealth) return <Pending />
  return <ArchiveHealthView health={state.snapshot.archiveHealth} />
}
