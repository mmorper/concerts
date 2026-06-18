// Conversation state for "Ask the Archive" (#140). Owns the transcript of exchanges, drives the
// SSE stream, and accumulates streaming prose + the composed exhibit per turn. Container shells
// (#141) render `exchanges`; this hook is UI-agnostic.

import { useCallback, useRef, useState } from 'react'
import type { Exhibit } from '@/types/exhibit'
import { streamAskTurn, type Turn } from '@/services/askArchive'
import { analytics } from '@/services/analytics'

export type ExchangeStatus = 'streaming' | 'done' | 'refused' | 'error'

export interface Exchange {
  id: string
  question: string
  prose: string
  exhibit: Exhibit | null
  consulting: string | null // tool currently being consulted, for the "consulting…" affordance
  status: ExchangeStatus
  message?: string // refusal / error copy
}

let seq = 0
const nextId = () => `ex-${++seq}`

export function useAskArchive() {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const patch = (id: string, fn: (ex: Exchange) => Exchange) =>
    setExchanges((xs) => xs.map((x) => (x.id === id ? fn(x) : x)))

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy) return

      // Prior completed exchanges become conversation history (prose only — the worker re-runs
      // tools as needed). Skip refused/errored turns.
      const history: Turn[] = exchanges
        .filter((x) => x.status === 'done' && x.prose)
        .flatMap((x) => [
          { role: 'user' as const, text: x.question },
          { role: 'assistant' as const, text: x.prose },
        ])
      const turns: Turn[] = [...history, { role: 'user', text: q }]

      const id = nextId()
      setExchanges((xs) => [
        ...xs,
        { id, question: q, prose: '', exhibit: null, consulting: null, status: 'streaming' },
      ])
      setBusy(true)
      analytics.trackEvent('ask_question_sent', { turn_index: history.length / 2, char_len: q.length })

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await streamAskTurn(
          turns,
          (event) => {
            switch (event.type) {
              case 'token':
                patch(id, (x) => ({ ...x, prose: x.prose + event.text, consulting: null }))
                break
              case 'tool':
                // Any prose streamed before a tool call is the model thinking out loud
                // ("let me check…"); the real answer comes after the last tool. Drop it.
                patch(id, (x) => ({ ...x, consulting: event.name, prose: '' }))
                break
              case 'exhibit':
                patch(id, (x) => ({ ...x, exhibit: event.exhibit }))
                analytics.trackEvent('ask_exhibit_shown', { kind: event.exhibit.kind })
                break
              case 'refusal':
                patch(id, (x) => ({ ...x, status: 'refused', message: event.message, consulting: null }))
                break
              case 'done':
                patch(id, (x) => (x.status === 'streaming' ? { ...x, status: 'done', consulting: null } : x))
                break
              case 'error':
                patch(id, (x) => ({ ...x, status: 'error', message: event.message, consulting: null }))
                break
            }
          },
          controller.signal,
        )
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'error'
        patch(id, (x) => ({
          ...x,
          status: 'error',
          consulting: null,
          message:
            reason === 'session_required'
              ? 'No session — mint a dev token first.'
              : reason === 'rate_limited'
                ? 'Easy there — too many questions too fast. Give it a moment.'
                : reason && !reason.startsWith('ask request failed')
                  ? reason // worker's own message, e.g. "This conversation has gone long — start a fresh one."
                  : 'Something went sideways reaching the archive.',
        }))
      } finally {
        // A stream that closed without a terminal event still resolves the turn.
        patch(id, (x) => (x.status === 'streaming' ? { ...x, status: 'done', consulting: null } : x))
        setBusy(false)
        abortRef.current = null
      }
    },
    [busy, exchanges],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setExchanges([])
    setBusy(false)
  }, [])

  return { exchanges, busy, ask, reset }
}
