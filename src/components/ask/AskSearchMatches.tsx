// The list under the Ask box as you type. A band, venue, year or song opens its card here, in Ask,
// with no model call; leaving Ask is the card's own link, never a match. A clip still opens in its
// gatefold, the only place it plays. Each row keeps its href, so a new tab goes straight there. The
// last row hands the words to the model.

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
  onPick,
}: {
  id: string
  query: string
  matches: SearchEntry[]
  active: number
  /** Sits over an answer in progress rather than in an empty panel. */
  over: boolean
  busy: boolean
  onAsk: () => void
  /** Opens a match's card in Ask. Returns false when the match has none (a clip), to follow its link. */
  onPick?: (match: SearchEntry) => boolean
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
          onClick={(e) => {
            analytics.trackEvent('ask_search_match_clicked', { result_kind: m.kind, position: i, search_term: query })
            // A new tab still gets the link. A plain click stays in Ask when the match has a card.
            const plain = !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && e.button === 0
            if (plain && !busy && onPick?.(m)) e.preventDefault()
          }}
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
