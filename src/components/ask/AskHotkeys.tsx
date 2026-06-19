// Power-key invocation for Ask (#141, invocation tier 3): ⌘K / Ctrl-K from anywhere opens the
// Spotlight; `/` focuses it like a search field. Both are no-ops while the user is typing in a
// field. The Spotlight is the one chat surface (#142), so the keys work on every route. Renders nothing.

import { useEffect } from 'react'
import { useAsk } from './AskProvider'

function isTyping(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  if (!node) return false
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable
}

export function AskHotkeys() {
  const { open, openSpotlight } = useAsk()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (!open) openSpotlight('kbd')
        return
      }
      // `/` focuses Ask like a search box — but only when not already typing somewhere.
      if (e.key === '/' && !open && !isTyping(e.target) && !isTyping(document.activeElement)) {
        e.preventDefault()
        openSpotlight('kbd')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, openSpotlight])

  return null
}
