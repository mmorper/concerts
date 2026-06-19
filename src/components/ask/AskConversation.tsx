// The shared answer surface for "Ask the Archive" (#141): the transcript of exhibits + the input
// dock + empty-state suggested prompts. UI-agnostic — the containers (Spotlight overlay, /ask
// canvas) own their outer chrome (scrim, gradient, header) and drop this inside. One surface, so
// the dev harness, the overlay, and the full page all render answers identically.

import { useEffect, useRef, useState } from 'react'
import type { Exchange } from '@/hooks/useAskArchive'
import type { ArchiveLookups } from './types'
import { AskExhibit } from './AskExhibit'
import { analytics } from '@/services/analytics'

export interface AskConversationProps {
  exchanges: Exchange[]
  busy: boolean
  archive: ArchiveLookups
  onAsk: (question: string) => void
  /** Empty-state chips that teach what's askable; hidden once the first exhibit lands. */
  suggestedPrompts?: string[]
  placeholder?: string
  /** Focus the input on mount (overlay opens straight into a ready cursor). */
  autoFocus?: boolean
  /** Imperatively focus the input from a parent (e.g. the `/` shortcut). */
  inputRef?: React.RefObject<HTMLInputElement>
}

export function AskConversation({
  exchanges,
  busy,
  archive,
  onAsk,
  suggestedPrompts,
  placeholder = 'Ask me about a band, a venue, a year… or just say "surprise me"',
  autoFocus,
  inputRef,
}: AskConversationProps) {
  const [input, setInput] = useState('')
  const localRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? localRef
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus, ref])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [exchanges])

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed || busy) return
    setInput('')
    onAsk(trimmed)
  }

  const empty = exchanges.length === 0

  return (
    <div className="ask-convo">
      {empty && suggestedPrompts && suggestedPrompts.length > 0 && (
        <div className="ask-suggest" aria-label="Suggested questions">
          {suggestedPrompts.map((p, i) => (
            <button
              key={p}
              type="button"
              className="chip"
              onClick={() => {
                analytics.trackEvent('ask_suggested_prompt_clicked', { prompt: p, position: i })
                submit(p)
              }}
              disabled={busy}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="ask-transcript">
        {exchanges.map((ex) => (
          <div key={ex.id}>
            <div className="ask-q">
              <span className="you">You</span>
              <span className="q">&ldquo;{ex.question}&rdquo;</span>
            </div>
            <AskExhibit exchange={ex} archive={archive} />
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="ask-dock"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
      >
        <input
          ref={ref}
          className="ask-dock-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask the archive a question"
          enterKeyHint="send"
        />
        <button
          type="submit"
          className="ask-dock-send"
          disabled={busy || !input.trim()}
          aria-label="Send question"
        >
          ↑
        </button>
      </form>
    </div>
  )
}
