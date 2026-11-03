// Conversation state for "Ask the Archive" (#140). Owns the transcript of exchanges, drives the
// SSE stream, and accumulates streaming prose + the composed exhibit per turn. Container shells
// (#141) render `exchanges`; this hook is UI-agnostic.

import { useCallback, useRef, useState } from 'react'
import type { Chip, Exhibit, SignedShare } from '@/types/exhibit'
import { streamAskTurn, type Turn } from '@/services/askArchive'
import { analytics } from '@/services/analytics'

export type ExchangeStatus = 'streaming' | 'done' | 'refused' | 'error'

export interface Exchange {
  id: string
  question: string
  prose: string
  exhibit: Exhibit | null
  /** One or two follow-ups the Worker offered with the card. */
  chips?: Chip[]
  /** The Worker's signed copy of this answer, for the Share button. Absent when it can't be shared. */
  share?: SignedShare
  /** Set when this answer was opened from a shared link: its id, and the day it was first given. */
  shared?: { id: string; answeredOn: string }
  status: ExchangeStatus
  message?: string // refusal / error copy
}

let seq = 0
const nextId = () => `ex-${++seq}`

export interface UseAskArchiveOptions {
  // Lazily mint / silently re-mint the Turnstile-issued session (from useAskSession). Omitted in
  // the dev harness, which uses a pasted token.
  ensureSession?: (force?: boolean) => Promise<string | null>
}

export function useAskArchive(options: UseAskArchiveOptions = {}) {
  const { ensureSession } = options
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const patch = (id: string, fn: (ex: Exchange) => Exchange) =>
    setExchanges((xs) => xs.map((x) => (x.id === id ? fn(x) : x)))

  // `chip` when the question is a follow-up the Worker offered: its tool runs before the model.
  const ask = useCallback(
    async (question: string, chip?: Chip) => {
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
      const turns: Turn[] = [...history, { role: 'user', text: q, ...(chip ? { chip: { tool: chip.tool, input: chip.input } } : {}) }]

      const id = nextId()
      setExchanges((xs) => [
        ...xs,
        { id, question: q, prose: '', exhibit: null, status: 'streaming' },
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
                patch(id, (x) => ({ ...x, prose: x.prose + event.text }))
                break
              // 'tool' events are ignored: the worker buffers interim prose and streams only the
              // final answer, and the UI shows a single loading cue until the exhibit lands.
              case 'exhibit':
                patch(id, (x) => ({ ...x, exhibit: event.exhibit, ...(event.chips ? { chips: event.chips } : {}) }))
                analytics.trackEvent('ask_exhibit_shown', { kind: event.exhibit.kind })
                break
              case 'refusal':
                patch(id, (x) => ({ ...x, status: 'refused', message: event.message }))
                // Refusals are a real signal (off-topic asks, daily cap hit) — worth seeing
                // separately from technical errors.
                analytics.trackEvent('ask_refused', { turn_index: history.length / 2 })
                break
              case 'done':
                patch(id, (x) =>
                  x.status === 'streaming' ? { ...x, status: 'done', ...(event.share ? { share: event.share } : {}) } : x,
                )
                break
              case 'error':
                patch(id, (x) => ({ ...x, status: 'error', message: event.message }))
                analytics.trackEvent('ask_error', { reason: 'stream' })
                break
            }
          },
          { signal: controller.signal, ensureSession },
        )
      } catch (err) {
        // A deliberate cancel (overlay closed/cleared) isn't an error — drop it silently.
        if (controller.signal.aborted) return
        const reason = err instanceof Error ? err.message : 'error'
        // Bucket by the worker's machine-readable reasons so session/rate-limit friction is
        // visible in analytics without leaking free-text error copy.
        analytics.trackEvent('ask_error', {
          reason:
            reason === 'session_required' || reason === 'rate_limited' ? reason : 'request_failed',
        })
        patch(id, (x) => ({
          ...x,
          status: 'error',
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
        patch(id, (x) => (x.status === 'streaming' ? { ...x, status: 'done' } : x))
        setBusy(false)
        abortRef.current = null
      }
    },
    [busy, exchanges, ensureSession],
  )

  // An answer the site already holds, like a song picked from the matches. It joins the transcript
  // as a finished turn with no model call, and its prose becomes history for a follow-up question.
  // `shared` marks an answer reopened from a shared link, so it can say when it was given and be
  // shared on with the same link.
  const show = useCallback(
    (question: string, prose: string, exhibit: Exhibit, shared?: { id: string; answeredOn: string }) => {
      if (busy) return
      setExchanges((xs) => [...xs, { id: nextId(), question, prose, exhibit, status: 'done', ...(shared ? { shared } : {}) }])
      analytics.trackEvent('ask_exhibit_shown', { kind: exhibit.kind })
    },
    [busy],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setExchanges([])
    setBusy(false)
  }, [])

  return { exchanges, busy, ask, show, reset }
}
