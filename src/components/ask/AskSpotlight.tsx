// Container B — the Spotlight overlay (#141). Summoned over whatever scene you're on: the scene
// stays mounted, dimmed and blurred behind. It's an overlay, not a route — `esc` returns you
// exactly where you were. One element that morphs command-bar → reading surface as exhibits land.
// Capped at ~70vh with internal scroll; "Open full view ↗" promotes the same conversation to /ask.

import { useEffect, useRef } from 'react'
import { useAsk } from './AskProvider'
import { AskConversation } from './AskConversation'

export function AskSpotlight() {
  const { open, close, exchanges, busy, ask, show, archive } = useAsk()
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
          'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input, [tabindex]:not([tabindex="-1"])',
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

  // Keyboard tracking without a global viewport change. #191 had to revert
  // `interactive-widget=resizes-content` because that meta resizes the whole app and broke the
  // iPad snap-scroll scenes on rotation. Instead, mirror the visual viewport's height/offset into
  // CSS vars that ONLY the mobile `.ask-spotlight` sheet consumes — so the full-screen sheet shrinks
  // to sit above the on-screen keyboard, and nothing else (iPad scenes included) is affected.
  useEffect(() => {
    const vv = window.visualViewport
    if (!open || !vv) return
    const root = document.documentElement
    const sync = () => {
      root.style.setProperty('--ask-vvh', `${vv.height}px`)
      root.style.setProperty('--ask-vvtop', `${vv.offsetTop}px`)
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      root.style.removeProperty('--ask-vvh')
      root.style.removeProperty('--ask-vvtop')
    }
  }, [open])

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
        {/* Phone only: the box leads on desktop, with esc beside it. */}
        <div className="ask-spot-head">
          {/* Mobile back affordance — on a full-screen sheet there's no esc key or scrim to tap, so
              "esc" (kept for desktop) is replaced by a real ‹ control (#189). */}
          <button type="button" className="ask-back" onClick={() => close()} aria-label="Back">
            &lsaquo;
          </button>
          <span className="ask-spot-mark">
            <span className="ask-live-dot" aria-hidden="true" />
            Ask the archive
          </span>
        </div>

        <AskConversation
          exchanges={exchanges}
          busy={busy}
          archive={archive}
          onAsk={ask}
          onShow={show}
          crate
          autoFocus
          inputRef={inputRef}
          dockEnd={
            <button type="button" className="ask-esc" onClick={() => close()} aria-label="Close (Esc)">
              esc
            </button>
          }
        />
      </div>
    </div>
  )
}
