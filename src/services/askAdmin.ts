// Client for the Access-gated ask-chat admin API (workers/ask-chat/src/admin.ts) — the LIVE
// control plane behind the operator dashboard's "Cost & Control" tab. Distinct from the daily
// KV snapshot (services consumed in DashboardPage): every call here is real-time.
//
// Auth: the endpoints sit behind Cloudflare Access. In prod the dashboard is served from the
// same origin as the worker route (concerts.morperhaus.org/api/ask*), so the CF_Authorization
// cookie rides along — we send `credentials: 'include'` so it does on preview origins too.

import { ASK_API_BASE } from './askArchive'
import type { AskAdminState, AskMode } from '@/types/dashboard'

// Thrown on a 403 so the UI can distinguish "you're not signed into Access" from a real failure.
export class AskAdminAuthError extends Error {
  constructor() {
    super('Cloudflare Access required')
    this.name = 'AskAdminAuthError'
  }
}

const opts: RequestInit = { credentials: 'include', cache: 'no-store' }

async function guard(res: Response): Promise<Response> {
  if (res.status === 403) throw new AskAdminAuthError()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

// GET /api/ask/admin/state — mode + today's live spend + the admin-IP allowlist.
export async function fetchAdminState(signal?: AbortSignal): Promise<AskAdminState> {
  const res = await guard(await fetch(`${ASK_API_BASE}/api/ask/admin/state`, { ...opts, signal }))
  return (await res.json()) as AskAdminState
}

// POST /api/ask/admin/mode?to=<mode>&format=json — flip the kill switch. Returns the new mode.
export async function setAskMode(mode: AskMode): Promise<AskMode> {
  const res = await guard(
    await fetch(`${ASK_API_BASE}/api/ask/admin/mode?to=${encodeURIComponent(mode)}&format=json`, {
      ...opts,
      method: 'POST',
      headers: { accept: 'application/json' },
    }),
  )
  const body = (await res.json()) as { ok?: boolean; mode?: AskMode }
  // Guard the wire shape: a 2xx with a missing/unknown mode must not silently become `undefined`
  // and corrupt the optimistic UI state — surface it as an error instead.
  if (body.mode !== 'on' && body.mode !== 'deterministic-only' && body.mode !== 'paused') {
    throw new Error('unexpected mode response')
  }
  return body.mode
}

// POST /api/ask/admin/ips — add/remove an admin IP. Returns the updated allowlist.
export async function updateAdminIp(op: 'add' | 'remove', ip: string): Promise<string[]> {
  const res = await guard(
    await fetch(`${ASK_API_BASE}/api/ask/admin/ips`, {
      ...opts,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, ip }),
    }),
  )
  const body = (await res.json()) as { adminIps: string[] }
  return body.adminIps
}
