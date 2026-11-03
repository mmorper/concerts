// The shared answer surface for "Ask the Archive" (#141): the search box + what it finds as you type
// + the transcript of exhibits + the empty-state crate. UI-agnostic — the containers
// (Spotlight overlay, /ask canvas) own their outer chrome (scrim, gradient, header) and drop this
// inside. One surface, so the dev harness, the overlay, and the full page render answers identically.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Exchange } from '@/hooks/useAskArchive'
import type { ArchiveLookups } from './types'
import { AskExhibit } from './AskExhibit'
import { SearchMark } from './AskMedia'
import { AskSearchMatches, optionId } from './AskSearchMatches'
import { MIN_QUERY, matchAnswer, searchArchive, songAnswer } from './search'
import { AskCrate } from './AskCrate'
import { AskShareButton, answeredOnLabel, canShare } from './AskShare'
import type { AskNotice, AskViewerState } from './AskProvider'
import { AskMediaViewer } from './AskMediaViewer'
import type { Chip, Exhibit } from '@/types/exhibit'
import { analytics } from '@/services/analytics'

export interface AskConversationProps {
  exchanges: Exchange[]
  busy: boolean
  archive: ArchiveLookups
  /** `chip` when the question is a follow-up the archive offered. */
  onAsk: (question: string, chip?: Chip) => void
  /** Show the crate of ideas, as in the Ask scene, until the first question. */
  crate?: boolean
  placeholder?: string
  /** Focus the input on mount (overlay opens straight into a ready cursor). */
  autoFocus?: boolean
  /** Imperatively focus the input from a parent (e.g. the `/` shortcut). */
  inputRef?: React.RefObject<HTMLInputElement>
  /** Sits beside the box, for the container's own control (the overlay's esc). */
  dockEnd?: React.ReactNode
  /** Adds an answer the site already holds. Without it a song match follows its link. */
  onShow?: (question: string, prose: string, exhibit: Exhibit) => void
  /** A shared link that couldn't open, said above the empty state. */
  notice?: AskNotice | null
  /** A night's photos and clips, shown over the answers until `onCloseViewer`. */
  viewer?: AskViewerState | null
  onCloseViewer?: () => void
}

export function AskConversation({
  exchanges,
  busy,
  archive,
  onAsk,
  crate,
  placeholder = 'Search a band, venue, song or year, or ask anything',
  autoFocus,
  inputRef,
  dockEnd,
  onShow,
  notice,
  viewer,
  onCloseViewer,
}: AskConversationProps) {
  const [input, setInput] = useState('')
  // Which row the arrow keys are on. -1 is the box itself, so Enter asks the words as typed.
  const [active, setActive] = useState(-1)
  const [dismissed, setDismissed] = useState(false)
  const listId = useId()
  const localRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? localRef
  const transcriptRef = useRef<HTMLDivElement>(null)
  const lastTurnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus, ref])

  // When a new question is asked, bring IT to the top of the transcript, once. The answer then
  // streams in and its card lands below the question, and the view stays put. This used to
  // scroll to the bottom on every change (each streamed token, then the card), which left a
  // long answer pinned to its end with the question and the top of the card scrolled away.
  // It runs again when the answer lands: the card can change the layout above a smooth scroll that
  // is still running, and that is the moment the reader needs the question in view.
  const last = exchanges[exchanges.length - 1]
  const lastId = last?.id
  const lastAnswered = !!last && (last.status !== 'streaming' || !!last.exhibit)
  useEffect(() => {
    const box = transcriptRef.current
    const turn = lastTurnRef.current
    if (!box || !turn || !lastId) return
    // The last turn fills the view, or a short answer leaves nothing to scroll into and its
    // question stops partway down. Measured here because a percentage can't resolve: the panel's
    // height comes from its content.
    for (const child of box.children) (child as HTMLElement).style.minHeight = ''
    turn.style.minHeight = `${box.clientHeight}px`
    const top = turn.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    box.scrollTo({ top: Math.max(0, top - 4), behavior: reduce ? 'auto' : 'smooth' })
  }, [lastId, lastAnswered])

  // A clip picked from the matches opens over them, so the list closes with the words that found it.
  useEffect(() => {
    if (!viewer) return
    setInput('')
    setActive(-1)
  }, [viewer])

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed || busy) return
    setInput('')
    setActive(-1)
    onAsk(trimmed)
  }

  const empty = exchanges.length === 0
  const query = input.trim()
  const matches = useMemo(() => searchArchive(archive.searchEntries, query), [archive.searchEntries, query])
  const matching = query.length >= MIN_QUERY && !dismissed
  // The question stays in the box while the archive thinks, so a clicked card visibly went in.
  const pending = busy && !input ? last?.question : undefined

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!matching) return
    const rows = matches.length + 1
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => ((a + 1 + step + rows + 1) % (rows + 1)) - 1)
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      document.getElementById(optionId(listId, active))?.click()
    } else if (e.key === 'Escape') {
      // One esc closes the list. The next one closes the overlay.
      e.preventDefault()
      e.stopPropagation()
      setDismissed(true)
    }
  }

  return (
    <div className="ask-convo">
      {/* First in the DOM and on the page: this reads as search. On a phone CSS moves it to the
          bottom, above the keyboard. */}
      <div className="ask-dock-row">
        <form
          className="ask-dock"
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
        >
          <SearchMark />
          <div className="ask-dock-field">
            <input
              ref={ref}
              className="ask-dock-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setActive(-1)
                setDismissed(false)
                // Typing is searching again, which happens over the answers.
                if (viewer) onCloseViewer?.()
              }}
              onKeyDown={onKeyDown}
              placeholder={pending ? '' : placeholder}
              aria-label="Search or ask the archive"
              role="combobox"
              aria-expanded={matching}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={matching && active >= 0 ? optionId(listId, active) : undefined}
              enterKeyHint="send"
            />
            {pending && (
              <span className="ask-dock-pending" role="status" aria-label="Composing an answer">
                <span className="q">{pending}</span>
                <span className="ask-loading">
                  <span className="ask-loading-dot" />
                  <span className="ask-loading-dot" />
                  <span className="ask-loading-dot" />
                </span>
              </span>
            )}
          </div>
          <button
            type="submit"
            className="ask-dock-send"
            disabled={busy || !input.trim()}
            aria-label="Send question"
          >
            ↑
          </button>
        </form>
        {dockEnd}
      </div>

      <div className={`ask-stage ${viewer ? 'viewing' : ''}`}>
        {/* Over the answers rather than in place of them, so Back finds the answer where it was. */}
        {viewer && onCloseViewer && (
          <AskMediaViewer key={`${viewer.date}-${viewer.initialId}`} viewer={viewer} archive={archive} onClose={onCloseViewer} />
        )}
        {/* Empty state: the crate, the same as the Ask scene's, so a just-opened sheet never reads as
            a blank void (#189). Typing replaces it with matches, and the first question replaces it
            with the transcript. */}
        {empty ? (
          !matching && (
            <>
              {notice && (
                <p className="ask-notice" role="status">
                  {notice.text}
                  {notice.retry && (
                    <>
                      {' '}
                      <button type="button" className="ask-own" onClick={notice.retry}>
                        Try again
                      </button>
                    </>
                  )}
                </p>
              )}
              {crate && <AskCrate archive={archive} onAsk={submit} surface="overlay" />}
            </>
          )
        ) : (
          <div className="ask-transcript" ref={transcriptRef}>
            {exchanges.map((ex, i) => (
              <div key={ex.id} ref={i === exchanges.length - 1 ? lastTurnRef : undefined}>
                <div className="ask-q">{ex.question}</div>
                <AskExhibit exchange={ex} archive={archive} />
                {ex.shared && (
                  <p className="ask-answered-on">
                    {answeredOnLabel(ex.shared.answeredOn)} ·{' '}
                    <button type="button" className="ask-own" onClick={() => ref.current?.focus()}>
                      Ask your own
                    </button>
                  </p>
                )}
                {/* The line under an answer: its follow-ups, then Share at the end. Follow-ups only
                    under the newest answer, since an older one's next step has been taken or passed. */}
                {(() => {
                  const chips = i === exchanges.length - 1 && ex.status === 'done' && !busy ? (ex.chips ?? []) : []
                  if (!chips.length && !canShare(ex)) return null
                  return (
                    <div className="ask-after">
                      {chips.length > 0 && (
                        <div className="chips ask-followups" role="group" aria-label="Ask next">
                          {chips.map((chip, n) => (
                            <button
                              key={chip.label}
                              type="button"
                              className="chip"
                              onClick={() => {
                                analytics.trackEvent('ask_suggested_prompt_clicked', {
                                  prompt: chip.label,
                                  position: n,
                                  source: 'chip',
                                  exhibit_kind: ex.exhibit?.kind ?? 'none',
                                })
                                setInput('')
                                setActive(-1)
                                onAsk(chip.label, chip)
                              }}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <AskShareButton exchange={ex} />
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>
        )}
        {matching && (
          <AskSearchMatches
            id={listId}
            query={query}
            matches={matches}
            active={active}
            over={!empty}
            busy={busy}
            onAsk={() => submit(input)}
            onPick={
              onShow &&
              ((m) => {
                const answer = m.song ? songAnswer(m.song) : matchAnswer(m, archive)
                if (!answer) return false
                setInput('')
                setActive(-1)
                onShow(answer.question, answer.prose, answer.exhibit)
                return true
              })
            }
          />
        )}
      </div>
    </div>
  )
}
