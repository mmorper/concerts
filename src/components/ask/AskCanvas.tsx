// Container A — the full-canvas /ask route (#141). The deliberate destination: opens on the dark
// coda gradient (continuity from the end-of-scroll card), suggested-prompt chips at the empty
// state, and the same conversation surface as the Spotlight. This is also the mobile target and
// where "Open full view ↗" lands — the conversation carries over via AskProvider, no re-ask.

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAsk } from './AskProvider'
import { AskConversation } from './AskConversation'

const SUGGESTED = [
  'Tell me about Depeche Mode',
  'Every show at the 9:30 Club',
  'What did you see in 1998?',
  'Surprise me with a show',
  'Most-played songs',
]

export function AskCanvas() {
  const { exchanges, busy, ask, archive, activate } = useAsk()

  // Loading this route counts as using Ask — kick off the archive-data + session warmup.
  useEffect(() => {
    activate()
  }, [activate])

  const empty = exchanges.length === 0

  return (
    <div className="ask-canvas">
      <div className="ask-canvas-bar">
        <Link to="/" className="ask-back" aria-label="Back to the archive">
          <span aria-hidden="true">←</span> The archive
        </Link>
        <span className="ask-canvas-mark">
          <span className="ask-live-dot" aria-hidden="true" /> Ask the archive
        </span>
      </div>

      <div className="ask-canvas-inner">
        {empty && (
          <div className="ask-opener">
            <h1>Ask the archive</h1>
            <p>
              Forty years of live music, in its own voice. Ask about a band, a venue, a year — or
              just say &ldquo;surprise me.&rdquo;
            </p>
          </div>
        )}

        <AskConversation
          exchanges={exchanges}
          busy={busy}
          archive={archive}
          onAsk={ask}
          suggestedPrompts={SUGGESTED}
          autoFocus
        />

        {empty && (
          <p className="ask-canvas-foot">
            Prefer to ask inside Claude?{' '}
            <a href="/about-mcp">Add the archive as a connector →</a>
          </p>
        )}
      </div>
    </div>
  )
}
