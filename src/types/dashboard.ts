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
