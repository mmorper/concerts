// SSE client for the "Ask the Archive" chat backend (#140). Parses the worker's event stream
// into typed AskEvent callbacks. The exhibit-rendering layer consumes these; container shells
// (Spotlight overlay / `/ask` canvas) and the Turnstile session exchange are #141.

import type { AskEvent } from '@/types/exhibit'

export interface Turn {
  role: 'user' | 'assistant'
  text: string
}

// Same-origin in production (the worker owns /api/ask*). For local dev the SPA runs on :5173
// and the worker on another port — set VITE_ASK_BASE_URL to e.g. http://localhost:8799.
const BASE = (import.meta.env.VITE_ASK_BASE_URL ?? '').replace(/\/$/, '')

// Dev-only: a session token minted via workers/ask-chat/scripts/mint-dev-session.mjs, stashed
// in localStorage so the harness can call /chat without the (still-unbuilt, #141) Turnstile
// widget. In production this is replaced by the /api/ask/session exchange.
const DEV_SESSION_KEY = 'ask_dev_session'
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(DEV_SESSION_KEY)
  } catch {
    return null
  }
}
export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(DEV_SESSION_KEY, token)
  } catch {
    /* ignore */
  }
}

export async function getStatus(): Promise<{ mode: 'on' | 'paused' | 'deterministic-only' } | null> {
  try {
    const res = await fetch(`${BASE}/api/ask/status`)
    if (!res.ok) return null
    return (await res.json()) as { mode: 'on' | 'paused' | 'deterministic-only' }
  } catch {
    return null
  }
}

/**
 * Stream one turn. Calls `onEvent` for each parsed SSE event. Resolves when the stream closes;
 * rejects only on a transport/HTTP failure (the worker reports kill-switch/cap as graceful
 * `refusal` events, never an error status). Pass an AbortSignal to cancel mid-stream.
 */
export async function streamAskTurn(
  turns: Turn[],
  onEvent: (event: AskEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getSessionToken()
  const res = await fetch(`${BASE}/api/ask/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-ask-session': token } : {}),
    },
    body: JSON.stringify({ turns }),
    signal,
  })

  if (!res.ok || !res.body) {
    if (res.status === 401) throw new Error('session_required')
    if (res.status === 429) throw new Error('rate_limited')
    // 400s carry a human-readable reason (e.g. "This conversation has gone long…") — surface it.
    let detail = ''
    try {
      detail = ((await res.json()) as { error?: string })?.error ?? ''
    } catch {
      /* no body */
    }
    throw new Error(detail || `ask request failed: ${res.status}`)
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    // SSE frames are separated by a blank line; each frame has `event:` + `data:` lines.
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const event = parseFrame(frame)
      if (event) onEvent(event)
    }
  }
}

function parseFrame(frame: string): AskEvent | null {
  let name = ''
  let data = ''
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!name || !data) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(data)
  } catch {
    return null
  }
  switch (name) {
    case 'token':
      return { type: 'token', text: String(payload.text ?? '') }
    case 'tool':
      return { type: 'tool', name: String(payload.name ?? '') }
    case 'exhibit':
      return { type: 'exhibit', exhibit: payload as never }
    case 'refusal':
      return { type: 'refusal', message: String(payload.message ?? '') }
    case 'done':
      return { type: 'done', fraction: Number(payload.fraction ?? 0) }
    case 'error':
      return { type: 'error', message: String(payload.message ?? '') }
    default:
      return null
  }
}
