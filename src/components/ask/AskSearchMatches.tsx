// The list under the Ask box as you type. Every row links to where that thing lives, and the last
// row hands the words to the model, so looking something up never spends a model call.

import { analytics } from '@/services/analytics'
import { FramedPhoto, LadderImage } from './AskMedia'
import type { SearchEntry } from './search'

export const optionId = (listId: string, index: number) => `${listId}-${index}`

function Thumb({ entry }: { entry: SearchEntry }) {
  const letter = entry.name.replace(/^The /, '').charAt(0).toUpperCase()
  const mark = <span className="mark">{letter}</span>
  if (entry.photo) return <FramedPhoto photo={entry.photo} aspect={1} alt="" fallback={mark} />
  return <LadderImage sources={[entry.image]} alt="" fallback={mark} />
}

export function AskSearchMatches({
  id,
  query,
  matches,
  active,
  over,
  busy,
  onAsk,
}: {
  id: string
  query: string
  matches: SearchEntry[]
  active: number
  /** Sits over an answer in progress rather than in an empty panel. */
  over: boolean
  busy: boolean
  onAsk: () => void
}) {
  return (
    <div id={id} className={`ask-matches ${over ? 'over' : ''}`} role="listbox" aria-label="Matches in the archive">
      {matches.map((m, i) => (
        <a
          key={`${m.kind}-${m.href}-${m.name}`}
          id={optionId(id, i)}
          className={`ask-match ${i === active ? 'on' : ''}`}
          href={m.href}
          role="option"
          aria-selected={i === active}
          tabIndex={-1}
          onClick={() =>
            analytics.trackEvent('ask_search_match_clicked', { result_kind: m.kind, position: i, search_term: query })
          }
        >
          <span className="thumb">
            <Thumb entry={m} />
          </span>
          <span className="text">
            <span className="name">{m.kind === 'clip' || m.kind === 'song' ? `“${m.name}”` : m.name}</span>
            <span className="sub">{m.sub}</span>
          </span>
          <span className="kind">{m.kind}</span>
        </a>
      ))}
      <button
        type="button"
        id={optionId(id, matches.length)}
        className={`ask-match ask-match-ask ${matches.length === active ? 'on' : ''}`}
        role="option"
        aria-selected={matches.length === active}
        tabIndex={-1}
        disabled={busy}
        onClick={onAsk}
      >
        <span className="thumb q" aria-hidden="true">?</span>
        <span className="text">
          <span className="name">Ask the archive about &ldquo;{query}&rdquo;</span>
        </span>
      </button>
    </div>
  )
}
