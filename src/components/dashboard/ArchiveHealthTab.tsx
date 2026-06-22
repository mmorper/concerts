import type { ReactNode } from 'react'
import type { ArchiveHealthSection, ArchiveStage, GaSection } from '@/types/dashboard'
import { normalizeArtistName } from '@/utils/normalize'
import type { SnapshotLoadState } from './EngagementTab'

// Phase 5 (#175) — the Archive Health tab. One equally-weighted coverage bar per enrichment stage
// (spec Appendix C), computed by the refresh Worker from the generated public/data/*.json. Reads
// `snapshot.archiveHealth`; null → a "pending" placeholder. Phase 6 (#176) adds the Demand×Coverage
// quadrant — GA's most-clicked artists (demand) joined against per-artist enrichment % (coverage);
// the high-demand + low-coverage quadrant is the prioritized enrichment backlog.

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

// Demand×Coverage quadrant: each GA-clicked artist plotted at x = clicks (demand), y = enrichment %
// (coverage). The bottom-right (high demand, low coverage) is the prioritized enrichment backlog.
function DemandCoverage({ ga, coverageByArtist }: { ga: GaSection; coverageByArtist: Record<string, number> }) {
  const points = ga.engagement.topArtists
    .map((a) => {
      const cov = coverageByArtist[normalizeArtistName(a.name)]
      return cov === undefined ? null : { name: a.name, demand: a.n, coverage: cov }
    })
    .filter((p): p is { name: string; demand: number; coverage: number } => p !== null)

  if (points.length === 0)
    return (
      <p className="mt-3 text-sm text-stone-400">
        No overlap between GA-clicked artists and the archive yet — needs GA click data (register the
        <code> artist_name</code> custom dimension).
      </p>
    )

  const w = 640
  const h = 280
  const pad = 36
  const maxDemand = Math.max(1, ...points.map((p) => p.demand))
  const x = (d: number) => pad + (d / maxDemand) * (w - pad * 2)
  const y = (c: number) => h - pad - (c / 100) * (h - pad * 2)
  const midDemand = maxDemand / 2
  // A "high-demand" cut needs a real distribution — with only a point or two, a median of one is
  // meaningless, so don't flag an enrichment backlog until there are enough overlapping artists.
  const quadrantMeaningful = points.length >= 3
  const isEnrichNext = (p: { demand: number; coverage: number }) =>
    quadrantMeaningful && p.demand >= midDemand && p.coverage < 75
  const enrichNext = points.filter(isEnrichNext).sort((a, b) => b.demand - a.demand)

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="mt-3" role="img" aria-label="Demand vs coverage scatter">
        {/* quadrant guides: 75% coverage line + median demand line */}
        <line x1={pad} y1={y(75)} x2={w - pad} y2={y(75)} stroke="#e7e5e4" strokeDasharray="4 4" />
        <line x1={x(midDemand)} y1={pad} x2={x(midDemand)} y2={h - pad} stroke="#e7e5e4" strokeDasharray="4 4" />
        {/* axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#d6d3d1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#d6d3d1" />
        <text x={w - pad} y={h - pad + 24} textAnchor="end" className="fill-stone-400" fontSize="11">demand (clicks) →</text>
        <text x={pad - 8} y={pad - 8} textAnchor="start" className="fill-stone-400" fontSize="11">↑ coverage %</text>
        {points.map((p) => {
          const lowCov = isEnrichNext(p)
          return (
            <g key={p.name}>
              <circle cx={x(p.demand)} cy={y(p.coverage)} r="5" fill={lowCov ? '#dc2626' : '#4f46e5'} opacity="0.85" />
              <text x={x(p.demand) + 8} y={y(p.coverage) + 3} className="fill-stone-500" fontSize="10">{p.name}</text>
            </g>
          )
        })}
      </svg>
      {enrichNext.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <b>Enrich next</b> (high demand, &lt;75% coverage):{' '}
          {enrichNext.map((p) => `${p.name} (${p.coverage}%)`).join(' · ')}
        </div>
      )}
    </>
  )
}

function ArchiveHealthView({ health, ga }: { health: ArchiveHealthSection; ga: GaSection | null }) {
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

      <div className="mt-4">
        <Card>
          <h3 className="font-serif text-lg font-semibold text-indigo-950">Demand × Coverage</h3>
          <p className="mt-0.5 font-mono text-xs text-stone-400">
            GA most-clicked artists × per-artist enrichment % · bottom-right = enrich next
          </p>
          {ga ? (
            <DemandCoverage ga={ga} coverageByArtist={health.coverageByArtist} />
          ) : (
            <p className="mt-3 text-sm text-stone-400">
              Pending GA — the demand axis needs the engagement click data (Engagement tab).
            </p>
          )}
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 5 — Archive Health · Phase 6 adds the Demand×Coverage quadrant (Epic #159)
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
  return <ArchiveHealthView health={state.snapshot.archiveHealth} ga={state.snapshot.ga} />
}
