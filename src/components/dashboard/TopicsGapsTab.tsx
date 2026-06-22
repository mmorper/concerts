import type { ReactNode } from 'react'
import type { TopicsSection } from '@/types/dashboard'
import type { SnapshotLoadState } from './EngagementTab'

// Phase 6 (#176) — the Topics & Gaps tab. Reads `snapshot.topics` (derived from the ask_turns ledger
// + GA search). Intent is rule-based bucketing (no LLM); the gap/wishlist split is heuristic. The
// zero-result-searches and suggested-prompt panels stay "pending" until their GA4 custom dimensions
// (results_found / prompt) are registered — neither is in the current set of 7.

const fmtInt = (n: number) => n.toLocaleString()
const pctStr = (frac: number) => `${(frac * 100).toFixed(1)}%`

const INDIGO = '#4f46e5'
const VIOLET = '#7c3aed'

const EXHIBIT_COLOR: Record<string, string> = {
  artist: '#1e40af',
  venue: '#16a34a',
  concert: '#f59e0b',
  none: '#94a3b8',
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

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-8 first:mt-2">
      <h2 className="font-serif text-xl font-semibold tracking-tight text-indigo-950">{children}</h2>
      {sub && <p className="text-sm text-stone-500">{sub}</p>}
    </div>
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
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? INDIGO }} />
          </div>
        </div>
      ))}
    </div>
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

function GapList({ items, empty }: { items: Array<{ term: string; n: number }>; empty: string }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-stone-400">{empty}</p>
  return (
    <ul className="mt-3 space-y-2">
      {items.map((g) => (
        <li key={g.term} className="flex items-baseline justify-between gap-3 border-b border-stone-100 pb-2 text-sm last:border-0">
          <span className="text-stone-700">{g.term}</span>
          <span className="font-semibold tabular-nums text-violet-700">{fmtInt(g.n)}×</span>
        </li>
      ))}
    </ul>
  )
}

const recordBars = (rec: Record<string, number>, color?: string): Bar[] =>
  Object.entries(rec)
    .map(([label, value]) => ({ label, value, color }))
    .sort((a, b) => b.value - a.value)

function TopicsView({ topics }: { topics: TopicsSection }) {
  const t = topics
  // Distinct unanswered topics (refused or no-exhibit), split into gaps + wishlist — always populated
  // from ask_turns, unlike the GA-gated zero-result metric (which needs a custom dimension).
  const unansweredTopics = t.contentGaps.length + t.wishlist.length

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      <p className="pt-2 text-sm text-stone-500">
        What people actually ask &amp; search — from the <code>ask_turns</code> query ledger and GA search.
        30-day windows.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Kpi label="Questions · 30d" value={fmtInt(t.questions30d)} />
        <Kpi label="Answered" value={pctStr(t.answeredRate30d)} />
        <Kpi label="Refused" value={pctStr(t.refusalRate30d)} />
        <Kpi label="Unanswered topics" value={fmtInt(unansweredTopics)} sub="gaps + wishlist" />
      </div>

      <SectionTitle sub="A cheap rule-based read on what the chat is for (not an LLM classifier).">
        Intent &amp; topics
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="question intent — rule-based buckets">Question intent mix · 30d</CardTitle>
          <HBar data={recordBars(t.intentMix, VIOLET)} />
        </Card>
        <Card>
          <CardTitle hint="ask_turns query text — normalized top-N">Most-asked topics · 30d</CardTitle>
          <HBar data={t.askTopics.map((x) => ({ label: x.term, value: x.n }))} />
        </Card>
      </div>

      <SectionTitle sub="Refused or no-exhibit questions, split by whether the entity is in the archive.">
        Content gaps &amp; wishlist
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="refused/no-exhibit · entity exists → enrich next">Content gaps · 30d</CardTitle>
          <GapList items={t.contentGaps} empty="No gaps detected in range." />
        </Card>
        <Card>
          <CardTitle hint="asked about shows not in the archive">Wishlist · 30d</CardTitle>
          <GapList items={t.wishlist} empty="No wishlist questions in range." />
        </Card>
      </div>

      <SectionTitle sub="From GA search events.">Search</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle hint="artist_search_performed · search_term">Top search terms · 30d</CardTitle>
          {t.searchTerms.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">Pending GA — set up the refresh Worker&rsquo;s GA creds.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {t.searchTerms.map((s) => (
                <span key={s.term} className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm text-stone-700">
                  {s.term}
                  <b className="text-violet-700">{s.n}</b>
                </span>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle hint="results_found = 0">Zero-result searches · 30d</CardTitle>
          {t.zeroResultSearches.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">
              Pending the <code>results_found</code> GA4 custom dimension (not in the current set).
            </p>
          ) : (
            <GapList items={t.zeroResultSearches} empty="None in range." />
          )}
        </Card>
        <Card>
          <CardTitle hint="ask_suggested_prompt_clicked">Suggested-prompt clicks · 30d</CardTitle>
          {t.suggestedPrompts.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">
              Pending the <code>prompt</code> GA4 custom dimension (not in the current set).
            </p>
          ) : (
            <GapList items={t.suggestedPrompts.map((p) => ({ term: p.prompt, n: p.n }))} empty="None in range." />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardTitle hint="ask_turns · primary exhibit kind">Answer composition · 30d</CardTitle>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
            {recordBars(t.exhibitKinds).map(({ label, value }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: EXHIBIT_COLOR[label] ?? '#94a3b8' }} />
                {label} {fmtInt(value)}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 6 — Topics &amp; Gaps · intent is heuristic; gap/wishlist is flavor, not fact (Epic #159)
      </p>
    </div>
  )
}

function Pending() {
  return (
    <Centered>
      Topics &amp; Gaps is pending — the snapshot has no <code>topics</code> section yet.
      <br />
      The refresh Worker derives it from the <code>ask_turns</code> ledger on its next run.
    </Centered>
  )
}

export function TopicsGapsTab({ state }: { state: SnapshotLoadState }) {
  if (state.status === 'loading') return <Centered>Loading topics…</Centered>
  if (state.status === 'empty')
    return (
      <Centered>
        No data yet — the first refresh runs at 06:00 UTC.
        <br />
        (Seed <code>dashboard:snapshot</code> in KV to preview.)
      </Centered>
    )
  if (state.status === 'error') return <Centered>Couldn&rsquo;t load the dashboard: {state.message}</Centered>
  if (!state.snapshot.topics) return <Pending />
  return <TopicsView topics={state.snapshot.topics} />
}
