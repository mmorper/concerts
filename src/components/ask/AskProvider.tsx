// Shared "Ask the Archive" state (#141). One provider holds the open/close state of the Spotlight
// overlay, the (session-ephemeral) conversation, the session-minting fn, and the lazily-loaded
// hydration data. Both the Spotlight overlay and the /ask canvas read this, so "Open full view"
// carries the live conversation from the overlay into the full page with no re-ask.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useAskArchive, type Exchange } from '@/hooks/useAskArchive'
import { useAskSession } from '@/hooks/useAskSession'
import { useArchiveData } from '@/hooks/useArchiveData'
import type { ArchiveLookups } from './types'
import { analytics } from '@/services/analytics'

export type AskOpenSurface = 'kbd' | 'rail' | 'navmobile' | 'scene' | 'prompt'

interface AskContextValue {
  open: boolean
  // The Spotlight is the one chat surface (#142). Opened over any scene from the rail, ⌘K, the
  // mobile nav, or the Ask scene. An optional `prefill` (from a suggested prompt) is asked at once.
  openSpotlight: (surface: AskOpenSurface, prefill?: string) => void
  // Dismissing the overlay clears the conversation (a fresh ask each open). Promotion to the
  // full /ask view passes { clear: false } so the conversation carries over instead.
  close: (opts?: { clear?: boolean }) => void
  // The conversation + controls (shared between overlay and /ask).
  exchanges: Exchange[]
  busy: boolean
  ask: (q: string) => void
  reset: () => void
  archive: ArchiveLookups & { loading: boolean }
  // Marks Ask as "used" so the archive data begins loading (the /ask route calls this on mount).
  activate: () => void
}

const AskContext = createContext<AskContextValue | null>(null)

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Archive data is deferred until Ask is first touched (open or /ask), so other pages don't fetch.
  const [active, setActive] = useState(false)
  const { ensureSession } = useAskSession()
  const { exchanges, busy, ask, reset } = useAskArchive({ ensureSession })
  const archive = useArchiveData(active)

  // Where the overlay was opened from, so close() can restore focus there.
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const activate = useCallback(() => setActive(true), [])

  const openSpotlight = useCallback(
    (surface: AskOpenSurface, prefill?: string) => {
      restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null
      setActive(true)
      setOpen(true)
      // Warm a session in the background so the first answer doesn't wait on the challenge.
      void ensureSession()
      analytics.trackEvent('ask_opened', { surface })
      // A suggested prompt opens straight into its answer instead of an empty composer.
      if (prefill) ask(prefill)
    },
    [ensureSession, ask],
  )

  const close = useCallback(
    (opts?: { clear?: boolean }) => {
      setOpen(false)
      // `clear === false` means we're promoting to the full /ask view (conversation carries over);
      // anything else is a plain dismiss. turn_count = how many questions this session got before
      // closing — the raw material for "how far do people get" / dwell.
      analytics.trackEvent('ask_closed', {
        reason: opts?.clear === false ? 'promote' : 'dismiss',
        turn_count: exchanges.length,
      })
      // Clear the transcript on a plain dismiss (esc / scrim / esc button) so each open starts
      // fresh; skip clearing when promoting to the full view, which carries the conversation.
      if (opts?.clear !== false) reset()
      // Restore focus to the trigger (esc returns you exactly where you were).
      const el = restoreFocusRef.current
      if (el && typeof el.focus === 'function') requestAnimationFrame(() => el.focus())
    },
    [reset, exchanges.length],
  )

  const value = useMemo<AskContextValue>(
    () => ({ open, openSpotlight, close, exchanges, busy, ask, reset, archive, activate }),
    [open, openSpotlight, close, exchanges, busy, ask, reset, archive, activate],
  )

  return <AskContext.Provider value={value}>{children}</AskContext.Provider>
}

export function useAsk(): AskContextValue {
  const ctx = useContext(AskContext)
  if (!ctx) throw new Error('useAsk must be used within <AskProvider>')
  return ctx
}
