// Container B — the Spotlight overlay (#141). Summoned over whatever scene you're on: the scene
// stays mounted, dimmed and blurred behind. It's an overlay, not a route — `esc` returns you
// exactly where you were. One element that morphs command-bar → reading surface as exhibits land.
// Capped at ~70vh with internal scroll; "Open full view ↗" promotes the same conversation to /ask.

import { useEffect, useRef } from 'react'
import { useAsk } from './AskProvider'
import { AskConversation } from './AskConversation'

// Empty-state scaffolding for a just-opened sheet (#189). Mirrors the Ask scene's voice + prompts
// so opening the overlay never lands on a blank surface (especially the full-screen mobile sheet).
const EMPTY_HINT = "Ask it the way you'd ask a friend who never misses a show."
const SUGGESTED_PROMPTS = [
  'Have you ever seen Depeche Mode?',
  'Everything at the 9:30 Club',
  'Surprise me',
]

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
          <button type="button" className="ask-esc" onClick={() => close()} aria-label="Close (Esc)">
            esc
          </button>
        </div>

        <AskConversation
          exchanges={exchanges}
          busy={busy}
          archive={archive}
          onAsk={ask}
          suggestedPrompts={SUGGESTED_PROMPTS}
          emptyHint={EMPTY_HINT}
          autoFocus
          inputRef={inputRef}
        />
      </div>
    </div>
  )
}
