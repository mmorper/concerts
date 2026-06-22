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

export interface DashboardSnapshot {
  refreshedAt: string
  dataAge: 'fresh' | 'stale'
  cloudflare: CloudflareSection | null
  spend: SpendSection | null
  ask: AskSection | null
  sourceStatus: Record<'cloudflare' | 'spend' | 'ask', SourceStatus>
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
