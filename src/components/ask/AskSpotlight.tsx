// Container B — the Spotlight overlay (#141). Summoned over whatever scene you're on: the scene
// stays mounted, dimmed and blurred behind. It's an overlay, not a route — `esc` returns you
// exactly where you were. One element that morphs command-bar → reading surface as exhibits land.
// Capped at ~70vh with internal scroll; "Open full view ↗" promotes the same conversation to /ask.

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAsk } from './AskProvider'
import { AskConversation } from './AskConversation'

/**
 * Leaving Ask never costs the conversation. A link in an answer moves within
 * the site rather than reloading the page, Ask steps aside with the conversation kept, and "Back to
 * Ask" (or the browser's Back, to the page Ask was opened on) brings it back as it was.
 */
export function AskSpotlight() {
  const { open, close, leave, returnTo, openSpotlight, exchanges, busy, ask, show, archive, notice } = useAsk()
  const paletteRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const at = location.pathname + location.search
  // The page Ask was opened on. A different one while it's open means a link took the visitor out.
  const openedAt = useRef<string | null>(null)

  useEffect(() => {
    openedAt.current = open ? (openedAt.current ?? at) : null
    // Only open/close moves this; a page change is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open && openedAt.current !== null && at !== openedAt.current) {
      leave(openedAt.current)
    } else if (!open && returnTo === at && exchanges.length > 0) {
      // Back to the page Ask was left from: the browser's Back reopens it where it was.
      openSpotlight('return')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])

  /** A same-site link in an answer moves within the site. A new tab, or another site, is left alone. */
  const onLinkClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented) return
    const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
    if (!a || (a.target && a.target !== '_self')) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    const url = new URL(a.href, window.location.href)
    if (url.origin !== window.location.origin) return
    e.preventDefault()
    const target = url.pathname + url.search
    // A link to the page already behind Ask: no page change to notice, so step aside directly.
    if (target === at) leave(at)
    else navigate(target + url.hash)
  }

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

  if (!open) {
    if (!returnTo || exchanges.length === 0) return null
    return (
      <div className="ask-return" role="region" aria-label="Your Ask conversation">
        <button type="button" className="ask-return-go" onClick={() => openSpotlight('return')}>
          <span aria-hidden="true">&larr;</span> Back to Ask
        </button>
        <button type="button" className="ask-return-x" onClick={() => close()} aria-label="Clear the Ask conversation">
          &times;
        </button>
      </div>
    )
  }

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
        onClick={onLinkClick}
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
          notice={notice}
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
