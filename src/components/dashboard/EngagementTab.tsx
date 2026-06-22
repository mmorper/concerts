import type { ReactNode } from 'react'
import type { DashboardSnapshot, GaSection } from '@/types/dashboard'

// Phase 3 (#173) — the Engagement tab. Renders the GA4 layer from the daily KV snapshot: the
// custom-event taxonomy (scenes, Ask funnel, high-signal interactions, search, "what's getting
// clicked", audio, device split) plus the generic website report (sessions / channels / countries /
// referrers / pages). Reads `snapshot.ga`; null → a "GA pending" placeholder (creds not yet live).

// Shared snapshot load-state (the daily KV plane) — also consumed by DashboardPage's Overview tab.
export type SnapshotLoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: DashboardSnapshot }

const fmtInt = (n: number) => n.toLocaleString()

const INDIGO = '#4f46e5'
const VIOLET = '#7c3aed'

// Ask funnel, in narrative order with intent colors (opened → sent → exhibit / refused).
const FUNNEL: { key: string; label: string; color: string }[] = [
  { key: 'ask_opened', label: 'Opened', color: VIOLET },
  { key: 'ask_question_sent', label: 'Question sent', color: INDIGO },
  { key: 'ask_exhibit_shown', label: 'Exhibit shown', color: '#16a34a' },
  { key: 'ask_refused', label: 'Refused', color: '#dc2626' },
]

// Pretty interaction-event labels (fall back to the raw event name).
const INTERACTION_LABELS: Record<string, string> = {
  artist_card_opened: 'Artist card opened',
  timeline_card_clicked: 'Timeline card clicked',
  map_marker_clicked: 'Map marker clicked',
  venue_node_clicked: 'Venue node clicked',
  setlist_button_clicked: 'Setlist opened',
  artist_preview_played: 'Audio preview played',
  genre_tile_clicked: 'Genre tile clicked',
  artist_tab_viewed: 'Artist tab viewed',
  liner_notes_badge_clicked: 'Liner-notes badge',
  tour_badge_clicked: 'Tour badge clicked',
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
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 text-center text-sm text-stone-500">{children}</div>
  )
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

// Record → bars, sorted desc, optionally relabeled, capped at `limit`.
function recordBars(
  rec: Record<string, number>,
  limit = 12,
  label: (k: string) => string = (k) => k,
): Bar[] {
  return Object.entries(rec)
    .map(([k, value]) => ({ label: label(k), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function StatRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-stone-100 py-2 text-sm last:border-0">
      <span className="text-stone-500">{k}</span>
      <span className="font-semibold tabular-nums text-indigo-950">{v}</span>
    </div>
  )
}

function EngagementView({ ga }: { ga: GaSection }) {
  const { engagement: e, website: w } = ga

  const funnelBars: Bar[] = FUNNEL.map((f) => ({ label: f.label, value: e.ask[f.key] ?? 0, color: f.color }))
  const sceneBars = recordBars(e.byScene, 12, capitalize)
  const interactionBars = recordBars(e.interactions, 10, (k) => INTERACTION_LABELS[k] ?? k)
  // device arrives as raw eventCount per device_type; render as share-of-total so the "%" reads true.
  const deviceTotal = Object.values(e.device).reduce((a, b) => a + b, 0)
  const deviceBars = recordBars(e.device, 5, capitalize).map((b) => ({
    label: b.label,
    value: deviceTotal > 0 ? Math.round((b.value / deviceTotal) * 100) : 0,
    color: b.label.toLowerCase().startsWith('mob') || b.label.toLowerCase().startsWith('phone') ? VIOLET : INDIGO,
  }))
  const toBars = (xs: Array<{ name: string; n: number }>): Bar[] => xs.map((x) => ({ label: x.name, value: x.n }))

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      <p className="pt-2 text-sm text-stone-500">
        GA4 custom events &amp; website report — what people do across the scenes. 30-day windows.
      </p>

      <SectionTitle sub="The SPA's custom GA4 events.">Engagement</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="scene_view · eventCount by scene_name">Scenes by usage · 30d</CardTitle>
          <HBar data={sceneBars} />
        </Card>
        <Card>
          <CardTitle hint="ask_opened → question_sent → exhibit / refused">Ask funnel · 30d</CardTitle>
          <HBar data={funnelBars} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="eventCount per interaction event">High-signal interactions · 30d</CardTitle>
          <HBar data={interactionBars} />
        </Card>
        <Card>
          <CardTitle hint="artist_search_performed · search_term">Search volume &amp; top terms · 30d</CardTitle>
          <StatRow k="Searches" v={fmtInt(e.searches.count)} />
          <StatRow k="Scene navigations" v={fmtInt(e.sceneNav)} />
          <StatRow k="Deep links accessed" v={fmtInt(e.deepLinks)} />
          {e.searches.topTerms.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {e.searches.topTerms.map((t) => (
                <span
                  key={t.term}
                  className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm text-stone-700"
                >
                  {t.term}
                  <b className="text-violet-700">{t.n}</b>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <SectionTitle sub="Event params surfaced as GA4 custom dimensions — the actual artists, venues, songs & setlists people engage with.">
        What&rsquo;s getting clicked
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="artist_card_opened · artist_name">Most-opened artists · 30d</CardTitle>
          <HBar data={toBars(e.topArtists)} />
        </Card>
        <Card>
          <CardTitle hint="venue_node_clicked + map_marker_clicked · venue_name">Most-clicked venues · 30d</CardTitle>
          <HBar data={toBars(e.topVenues)} />
        </Card>
        <Card>
          <CardTitle hint="artist_preview_played · track_name">Most-played songs · 30d</CardTitle>
          <HBar data={toBars(e.topSongs)} />
        </Card>
        <Card>
          <CardTitle hint="setlist_button_clicked · artist_name">Most-viewed setlists · 30d</CardTitle>
          <HBar data={toBars(e.topSetlists)} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="audio: artist_preview_played · device: device_type share">Audio &amp; device</CardTitle>
          <StatRow k="Audio previews played" v={fmtInt(e.audioPreviews)} />
          <div className="mt-3">
            <HBar data={deviceBars} fmt={(n) => `${n}%`} />
          </div>
        </Card>
        <Card>
          <CardTitle hint="sessions · 7 / 30 / 90-day windows">Website sessions</CardTitle>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            {[
              ['7d', w.sessions7d],
              ['30d', w.sessions30d],
              ['90d', w.sessions90d],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-xl bg-stone-50 py-3">
                <div className="font-serif text-2xl font-semibold text-indigo-950">{fmtInt(n as number)}</div>
                <div className="text-xs uppercase tracking-wide text-stone-400">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <SectionTitle sub="GA4 generic website report.">Website traffic</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle hint="sessionDefaultChannelGroup · sessions (30d)">Sessions by channel</CardTitle>
          <HBar data={recordBars(w.byChannel, 8, (k) => k)} />
        </Card>
        <Card>
          <CardTitle hint="country · sessions (30d, top 6)">Top countries</CardTitle>
          <HBar data={recordBars(w.byCountry, 6, (k) => k)} />
        </Card>
        <Card>
          <CardTitle hint="region · sessions (30d, top 6)">Top regions</CardTitle>
          <HBar data={recordBars(w.byRegion, 6, (k) => k)} />
        </Card>
        <Card>
          <CardTitle hint="pagePath · screenPageViews (30d)">Top pages</CardTitle>
          {w.topPages.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No data in range.</p>
          ) : (
            <div className="mt-3">
              {w.topPages.map((p) => (
                <StatRow key={p.page} k={p.page} v={fmtInt(p.views)} />
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle hint="sessionSource · sessions (30d)">Referring traffic</CardTitle>
          {w.topReferrers.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">No data in range.</p>
          ) : (
            <div className="mt-3">
              {w.topReferrers.map((r) => (
                <StatRow key={r.source} k={r.source} v={fmtInt(r.sessions)} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 3 — Engagement (GA4) · custom dimensions are not retroactive; breakdowns start at registration (Epic #159)
      </p>
    </div>
  )
}

function GaPending() {
  return (
    <Centered>
      GA engagement is pending — the snapshot has no <code>ga</code> section yet.
      <br />
      Set <code>GA_PROPERTY</code> + <code>GA_SA_KEY_JSON</code> on the refresh Worker and register the
      GA4 custom dimensions (they are not retroactive).
    </Centered>
  )
}

export function EngagementTab({ state }: { state: SnapshotLoadState }) {
  if (state.status === 'loading') return <Centered>Loading engagement…</Centered>
  if (state.status === 'empty')
    return (
      <Centered>
        No data yet — the first refresh runs at 06:00 UTC.
        <br />
        (Seed <code>dashboard:snapshot</code> in KV to preview.)
      </Centered>
    )
  if (state.status === 'error') return <Centered>Couldn&rsquo;t load the dashboard: {state.message}</Centered>
  if (!state.snapshot.ga) return <GaPending />
  return <EngagementView ga={state.snapshot.ga} />
}
