import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { analytics } from '@/services/analytics'
import { AskAdminAuthError, fetchAdminState, setAskMode, updateAdminIp } from '@/services/askAdmin'
import type { AskAdminState, AskMode } from '@/types/dashboard'

// Phase 2 (#172, folds #158) — the LIVE control surface. Reads/writes the Access-gated
// /api/ask/admin/* endpoints in real time (not the daily KV snapshot the Overview tab uses):
// kill-switch mode, today's spend vs cap, the admin-IP allowlist, and derived tripwire status.

const POLL_MS = 15_000

const MODES: { value: AskMode; label: string; blurb: string }[] = [
  { value: 'on', label: 'On', blurb: 'full LLM turns' },
  { value: 'deterministic-only', label: 'Deterministic-only', blurb: 'tool answers, no model' },
  { value: 'paused', label: 'Paused', blurb: 'graceful resting reply' },
]

const fmtUsd = (microUsd: number) => '$' + (microUsd / 1_000_000).toFixed(2)

function relativeTime(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.round(s / 60)}m ago`
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
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 text-center text-sm text-stone-500">{children}</div>
  )
}

function ModeControl({
  state,
  busy,
  onSet,
}: {
  state: AskAdminState
  busy: AskMode | null
  onSet: (m: AskMode) => void
}) {
  const { spend } = state
  const pct = Math.min(100, Math.round(spend.fraction * 100))
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-600'
  const current = MODES.find((m) => m.value === state.mode)

  return (
    <Card>
      <CardTitle hint="POST /api/ask/admin/mode">Ask mode</CardTitle>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {MODES.map((m) => {
          const active = m.value === state.mode
          return (
            <button
              key={m.value}
              type="button"
              disabled={busy !== null || active}
              onClick={() => onSet(m.value)}
              className={[
                'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                active
                  ? m.value === 'paused'
                    ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500'
                    : 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50',
                busy === m.value ? 'opacity-60' : '',
                'disabled:cursor-default',
              ].join(' ')}
            >
              {busy === m.value ? '…' : m.label}
              {active ? ' ✓' : ''}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-stone-600">
        Current: <b className="text-indigo-950">{current?.label}</b>
        <span className="text-stone-400"> — {current?.blurb}</span>
      </p>

      <div className="mt-4 flex items-baseline justify-between text-sm">
        <span className="text-stone-500">Live day spend (public budget)</span>
        <span className="font-semibold tabular-nums text-indigo-950">
          {fmtUsd(spend.committedMicroUsd)} / {fmtUsd(spend.capMicroUsd)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-stone-400">
        <span>{pct}% · kill-switch arms at 100%</span>
        <span>resets 00:00 UTC</span>
      </div>
      {spend.reservedMicroUsd > 0 && (
        <p className="mt-1 text-xs text-stone-400">Reserved in flight: {fmtUsd(spend.reservedMicroUsd)}</p>
      )}
    </Card>
  )
}

function IpAllowlist({
  ips,
  busy,
  onAdd,
  onRemove,
}: {
  ips: string[]
  busy: boolean
  onAdd: (ip: string) => void
  onRemove: (ip: string) => void
}) {
  const [draft, setDraft] = useState('')
  const submit = () => {
    const ip = draft.trim()
    if (ip) {
      onAdd(ip)
      setDraft('')
    }
  }

  return (
    <Card>
      <CardTitle hint="ASK_CONTROL KV · admin:ips — bypasses public caps (#158)">Admin IP allowlist</CardTitle>
      <div className="mt-3 space-y-2">
        {ips.length === 0 && <p className="text-sm text-stone-400">No admin IPs configured.</p>}
        {ips.map((ip) => (
          <div
            key={ip}
            className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm tabular-nums text-stone-700"
          >
            <span>{ip}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(ip)}
              className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add IP (e.g. 203.0.113.7)"
          inputMode="decimal"
          className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <button
          type="button"
          disabled={busy || draft.trim() === ''}
          onClick={submit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <p className="mt-3 text-xs text-stone-400">
        Per-IP reset (surgical unblock) —{' '}
        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-500">planned</span> needs{' '}
        <code>SpendCounter.reset()</code>
      </p>
    </Card>
  )
}

// Tripwires derived from the LIVE day-spend fraction. The admin API exposes spend but not the
// notification transport, so we report armed/tripped honestly from the cap fraction and flag the
// log-only transport per #164 (real pushes land once NOTIFY_WEBHOOK_URL is set).
function Tripwires({ fraction }: { fraction: number }) {
  const pct = spendPct(fraction)
  const rows: { at: number; label: string; color: string }[] = [
    { at: 50, label: 'ask-chat · 50% daily cap', color: '#16a34a' },
    { at: 75, label: 'ask-chat · 75% daily cap', color: '#f59e0b' },
    { at: 100, label: 'ask-chat · 100% daily cap (kill-switch)', color: '#dc2626' },
  ]
  return (
    <Card>
      <CardTitle hint="derived from live day spend · notifications log-only until NOTIFY_WEBHOOK_URL is set (#164)">
        Spend-alert tripwires
      </CardTitle>
      <div className="mt-3 divide-y divide-stone-100">
        {rows.map((r) => {
          const tripped = pct >= r.at
          return (
            <div key={r.at} className="flex items-center gap-3 py-2.5">
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white"
                style={{ background: r.color }}
              >
                {r.at}
              </span>
              <span className="text-sm text-stone-700">{r.label}</span>
              <span
                className={[
                  'ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  tripped ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800',
                ].join(' ')}
              >
                {tripped ? 'tripped today' : 'armed'}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-stone-400">
        Transport:
        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-500">
          log-only — set NOTIFY_WEBHOOK_URL
        </span>
      </div>
    </Card>
  )
}

function spendPct(fraction: number): number {
  return Math.round(fraction * 100)
}

type LoadState =
  | { status: 'loading' }
  | { status: 'auth' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AskAdminState }

export function CostControlTab() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [modeBusy, setModeBusy] = useState<AskMode | null>(null)
  const [ipBusy, setIpBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchAdminState(signal)
      if (signal?.aborted) return
      setState({ status: 'ready', data })
      setUpdatedAt(Date.now())
    } catch (e) {
      if (signal?.aborted) return
      if (e instanceof AskAdminAuthError) setState({ status: 'auth' })
      else setState({ status: 'error', message: e instanceof Error ? e.message : 'failed' })
    }
  }, [])

  // Initial fetch + light polling so the live spend/mode stay current while the tab is open.
  const stateStatus = state.status
  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  useEffect(() => {
    if (stateStatus !== 'ready') return
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [stateStatus, load])

  const onSetMode = async (mode: AskMode) => {
    setActionError(null)
    setModeBusy(mode)
    try {
      const next = await setAskMode(mode)
      analytics.trackEvent('dashboard_mode_change', { mode: next })
      setState((s) => (s.status === 'ready' ? { status: 'ready', data: { ...s.data, mode: next } } : s))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Mode change failed')
    } finally {
      setModeBusy(null)
    }
  }

  const onIp = async (op: 'add' | 'remove', ip: string) => {
    setActionError(null)
    setIpBusy(true)
    try {
      const adminIps = await updateAdminIp(op, ip)
      analytics.trackEvent('dashboard_admin_ip', { op })
      setState((s) => (s.status === 'ready' ? { status: 'ready', data: { ...s.data, adminIps } } : s))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'IP update failed')
    } finally {
      setIpBusy(false)
    }
  }

  if (state.status === 'loading') return <Centered>Loading live controls…</Centered>
  if (state.status === 'auth')
    return (
      <Centered>
        Cloudflare Access sign-in required to reach the control plane.
        <br />
        These endpoints are fenced at the edge — open <code>/dashboard</code> through Access.
      </Centered>
    )
  if (state.status === 'error')
    return <Centered>Couldn’t reach the control plane: {state.message}</Centered>

  const { data } = state
  return (
    <div className="mx-auto max-w-5xl px-6 pb-20">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
        <p className="text-sm text-stone-500">
          Live controls — reads/writes the Access-gated <code>/api/ask/admin/*</code> endpoints, not the
          daily snapshot. (#158 · #164)
        </p>
        {updatedAt && <span className="text-xs text-stone-400">updated {relativeTime(updatedAt)}</span>}
      </div>

      {actionError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ModeControl state={data} busy={modeBusy} onSet={onSetMode} />
        <IpAllowlist
          ips={data.adminIps}
          busy={ipBusy}
          onAdd={(ip) => void onIp('add', ip)}
          onRemove={(ip) => void onIp('remove', ip)}
        />
      </div>

      <div className="mt-4">
        <Tripwires fraction={data.spend.fraction} />
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Phase 2 — Control surface · live ask-chat admin API · polls every {POLL_MS / 1000}s (Epic #159)
      </p>
    </div>
  )
}
