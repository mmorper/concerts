// Operator-dashboard snapshot — client-side mirror of the contract the refresh Worker writes
// (workers/dashboard-refresh/src/index.ts) and the Pages Function serves (functions/dashboard/data.ts).
// Phase 1 (#171) subset: Cloudflare traffic + ask_turns spend/volume/topics. Later phases extend it.

export type SourceStatus = 'ok' | 'error' | 'not_configured'

export interface CloudflareSection {
  requests7d: number
  requests30d: number
  workerRequests7d: number
  workerRequests30d: number
}

export interface SpendSection {
  source: 'ask_turns'
  costUsdToday: number
  costUsd7d: number
  costUsd30d: number
  costUsdMonthToDate: number
  capUsd: number | null
  series: Array<{ date: string; costUsd: number }>
}

export interface AskSection {
  turns7d: number
  turns30d: number
  byOutcome: Record<string, number>
  topTopics: Array<{ term: string; n: number }>
  refusalRate30d: number
}

// Phase 3 (#173) — GA4 website + custom-event engagement. The custom-dimension breakdowns
// ("what's getting clicked") only carry data from the day their GA4 dimensions were registered.
export interface GaWebsite {
  sessions7d: number
  sessions30d: number
  sessions90d: number
  byChannel: Record<string, number>
  byCountry: Record<string, number>
  topReferrers: Array<{ source: string; sessions: number }>
  topPages: Array<{ page: string; views: number }>
}

export interface GaEngagement {
  byScene: Record<string, number>
  sceneNav: number
  deepLinks: number
  interactions: Record<string, number>
  searches: { count: number; topTerms: Array<{ term: string; n: number }> }
  audioPreviews: number
  ask: Record<string, number>
  device: Record<string, number>
  topArtists: Array<{ name: string; n: number }>
  topVenues: Array<{ name: string; n: number }>
  topSongs: Array<{ name: string; n: number }>
  topSetlists: Array<{ name: string; n: number }>
  // Phase 4 (#174) — Ask-as-navigation: ask_deeplink_clicked by target_scene. Empty until the
  // `target_scene` GA4 custom dimension is registered (an owner console task, not retroactive).
  askNav: Array<{ name: string; n: number }>
}

export interface GaSection {
  website: GaWebsite
  engagement: GaEngagement
}

// Phase 4 (#174) — MCP & Ask telemetry. Unions the in-SPA Ask chat (ask_turns) with external MCP
// clients (mcp_queries — the net-new Analytics Engine collector in the morperhaus-mcp Worker).
// `series` carries both planes per day for the multi-line chart; `byTool` is external-only. Until
// mcp-server ships its instrumentation, `bySource.external` is 0 and the tab notes it's pending.
export interface McpSection {
  queries7d: number
  queries30d: number
  byTool: Record<string, number>
  bySource: { spa: number; external: number }
  series: Array<{ date: string; spa: number; external: number }>
  askExhibitKinds: Record<string, number>
  // false → the mcp_queries collector isn't deployed yet (tab shows "pending instrumentation");
  // true with external 0 → deployed but a quiet window. Distinguishes the two so a legitimately
  // quiet month doesn't read as undeployed.
  externalLive: boolean
}

// Phase 5 (#175) — Archive Health. One equally-weighted coverage row per enrichment stage,
// computed from the generated public/data/*.json (spec Appendix C).
export interface ArchiveStage {
  stage: string
  covered: number
  total: number
  pct: number
  note?: string
}

export interface ArchiveHealthSection {
  lastBuildAt: string | null
  concerts: number
  artists: number
  venues: number
  stages: ArchiveStage[]
}

export interface DashboardSnapshot {
  refreshedAt: string
  dataAge: 'fresh' | 'stale'
  cloudflare: CloudflareSection | null
  spend: SpendSection | null
  ask: AskSection | null
  ga: GaSection | null
  mcp: McpSection | null
  archiveHealth: ArchiveHealthSection | null
  sourceStatus: Record<'cloudflare' | 'spend' | 'ask' | 'ga' | 'mcp' | 'archiveHealth', SourceStatus>
  fetchErrors: string[]
}

// ── Live control plane (Phase 2 / #172) ──────────────────────────────────────────────────────
// Real-time state from the Access-gated ask-chat admin API (workers/ask-chat/src/admin.ts), NOT
// the daily KV snapshot above. Mirrors the JSON shapes returned by /api/ask/admin/state etc.

export type AskMode = 'on' | 'deterministic-only' | 'paused'

// SpendStatus mirror — workers/ask-chat/src/types.ts. Today's live spend from the SpendCounter DO.
export interface AskSpendStatus {
  day: string // YYYY-MM-DD (UTC)
  committedMicroUsd: number
  reservedMicroUsd: number
  capMicroUsd: number
  fraction: number // committed / cap, drives the ≥80% tripwire
}

// GET /api/ask/admin/state
export interface AskAdminState {
  mode: AskMode
  spend: AskSpendStatus
  adminIps: string[]
}
