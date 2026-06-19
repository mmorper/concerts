// Container B — the Spotlight overlay (#141). Summoned over whatever scene you're on: the scene
// stays mounted, dimmed and blurred behind. It's an overlay, not a route — `esc` returns you
// exactly where you were. One element that morphs command-bar → reading surface as exhibits land.
// Capped at ~70vh with internal scroll; "Open full view ↗" promotes the same conversation to /ask.

import { useEffect, useRef } from 'react'
import { useAsk } from './AskProvider'
import { AskConversation } from './AskConversation'

export function AskSpotlight() {
  const { open, close, exchanges, busy, ask, archive } = useAsk()
  const paletteRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Esc closes (restores focus to the trigger); Tab is trapped inside the palette.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'Tab') {
        const focusables = paletteRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div
      className="ask-spotlight-scrim"
      onMouseDown={(e) => {
        // A click on the scrim (outside the palette) dismisses, like a command palette.
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={paletteRef}
        className="ask-spotlight"
        role="dialog"
        aria-modal="true"
        aria-label="Ask the Archive"
      >
        <div className="ask-spot-head">
          <span className="ask-spot-mark">
            <span className="ask-live-dot" aria-hidden="true" />
            Ask the archive
          </span>
          <button type="button" className="ask-esc" onClick={() => close()} aria-label="Close (Esc)">
            esc
          </button>
        </div>

        <AskConversation
          exchanges={exchanges}
          busy={busy}
          archive={archive}
          onAsk={ask}
          autoFocus
          inputRef={inputRef}
        />
      </div>
    </div>
  )
}
