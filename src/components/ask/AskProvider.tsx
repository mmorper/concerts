// Shared "Ask the Archive" state (#141). One provider holds the open/close state of the Spotlight
// overlay, the (session-ephemeral) conversation, the session-minting fn, and the lazily-loaded
// hydration data. Both the Spotlight overlay and the /ask canvas read this, so "Open full view"
// carries the live conversation from the overlay into the full page with no re-ask.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useAskArchive, type Exchange } from '@/hooks/useAskArchive'
import type { Exhibit } from '@/types/exhibit'
import { useAskSession } from '@/hooks/useAskSession'
import { useArchiveData } from '@/hooks/useArchiveData'
import type { ArchiveLookups } from './types'
import { mediaId, wholeNightReel, type ReelItem } from './media'
import { analytics } from '@/services/analytics'

export type AskOpenSurface = 'kbd' | 'scene' | 'prompt' | 'shared' | 'return'

/**
 * Where the visitor was when an answer's link took them out of Ask, kept for the tab. While it's
 * set, "Back to Ask" shows, and arriving back at that page (the browser's Back) reopens Ask.
 */
const RETURN_KEY = 'ask:return'
const readReturn = (): string | null => {
  try {
    return sessionStorage.getItem(RETURN_KEY)
  } catch {
    return null
  }
}
const writeReturn = (at: string | null) => {
  try {
    if (at) sessionStorage.setItem(RETURN_KEY, at)
    else sessionStorage.removeItem(RETURN_KEY)
  } catch {
    /* storage unavailable: the button just won't outlive the page */
  }
}

/** A night's photos and clips, open in Ask over the answer that led to them. */
export interface AskViewerState {
  date: string
  reel: ReelItem[]
  /** `mediaId` of the frame it opened on. */
  initialId: string
}

/** A line above the empty overlay, for a shared link that couldn't open. `retry` when trying again may help. */
export interface AskNotice {
  text: string
  retry?: () => void
}

interface AskContextValue {
  open: boolean
  // The Spotlight is the one chat surface (#142). Opened over any scene from the rail, ⌘K, the
  // mobile nav, or the Ask scene. An optional `prefill` (from a suggested prompt) is asked at once.
  openSpotlight: (surface: AskOpenSurface, prefill?: string) => void
  // Dismissing the overlay clears the conversation (a fresh ask each open). Promotion to the
  // full /ask view passes { clear: false } so the conversation carries over instead.
  close: (opts?: { clear?: boolean }) => void
  /** An answer's link took the visitor out of Ask, from page `from`. Hides Ask and keeps the conversation. */
  leave: (from: string) => void
  /** The page an answer's link was followed from, while the conversation waits. Null otherwise. */
  returnTo: string | null
  // The conversation + controls (shared between overlay and /ask).
  exchanges: Exchange[]
  busy: boolean
  ask: (q: string) => void
  /** Add an answer the site already holds, with no model call (a song picked from the matches, or a shared answer). */
  show: (question: string, prose: string, exhibit: Exhibit, shared?: { id: string; answeredOn: string }) => void
  notice: AskNotice | null
  setNotice: (n: AskNotice | null) => void
  reset: () => void
  archive: ArchiveLookups & { loading: boolean }
  /** The night's photos and clips, when one is open over the answer. */
  viewer: AskViewerState | null
  /** Opens a frame in Ask, with the rest of its night. False when the archive doesn't hold it. */
  openMedia: (date: string, id: string) => boolean
  closeViewer: () => void
  // Marks Ask as "used" so the archive data begins loading (the /ask route calls this on mount).
  activate: () => void
}

const AskContext = createContext<AskContextValue | null>(null)

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<AskNotice | null>(null)
  // Archive data is deferred until Ask is first touched (open or /ask), so other pages don't fetch.
  const [active, setActive] = useState(false)
  const { ensureSession } = useAskSession()
  const { exchanges, busy, ask: askArchive, show: showAnswer, reset } = useAskArchive({ ensureSession, persist: true })
  const [viewer, setViewer] = useState<AskViewerState | null>(null)
  const closeViewer = useCallback(() => setViewer(null), [])
  const [returnTo, setReturnTo] = useState<string | null>(readReturn)
  const setReturn = useCallback((at: string | null) => {
    setReturnTo(at)
    writeReturn(at)
  }, [])
  const archive = useArchiveData(active)

  // A new question goes back to the answers, where it lands.
  const ask = useCallback<typeof askArchive>((...args) => {
    setViewer(null)
    return askArchive(...args)
  }, [askArchive])
  const show = useCallback<typeof showAnswer>((...args) => {
    setViewer(null)
    return showAnswer(...args)
  }, [showAnswer])

  const openMedia = useCallback(
    (date: string, id: string) => {
      const night = archive.concertByDate(date)
      if (!night) return false
      const reel = wholeNightReel(archive.media, night)
      if (!reel.some((item) => mediaId(item) === id)) return false
      setViewer({ date, reel, initialId: id })
      return true
    },
    [archive],
  )

  // Where the overlay was opened from, so close() can restore focus there.
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const activate = useCallback(() => setActive(true), [])

  const openSpotlight = useCallback(
    (surface: AskOpenSurface, prefill?: string) => {
      restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null
      setActive(true)
      setOpen(true)
      setReturn(null)
      // Warm a session in the background so the first answer doesn't wait on the challenge.
      void ensureSession()
      analytics.trackEvent('ask_opened', { surface })
      // A suggested prompt opens straight into its answer instead of an empty composer.
      if (prefill) ask(prefill)
    },
    [ensureSession, ask, setReturn],
  )

  const leave = useCallback(
    (from: string) => {
      setOpen(false)
      setNotice(null)
      setViewer(null)
      setReturn(from)
      analytics.trackEvent('ask_closed', { reason: 'leave', turn_count: exchanges.length })
    },
    [setReturn, exchanges.length],
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
      if (opts?.clear !== false) {
        reset()
        setReturn(null)
      }
      setNotice(null)
      setViewer(null)
      // Restore focus to the trigger (esc returns you exactly where you were).
      const el = restoreFocusRef.current
      if (el && typeof el.focus === 'function') requestAnimationFrame(() => el.focus())
    },
    [reset, exchanges.length, setReturn],
  )

  const value = useMemo<AskContextValue>(
    () => ({ open, openSpotlight, close, leave, returnTo, exchanges, busy, ask, show, notice, setNotice, reset, archive, viewer, openMedia, closeViewer, activate }),
    [open, openSpotlight, close, leave, returnTo, exchanges, busy, ask, show, notice, reset, archive, viewer, openMedia, closeViewer, activate],
  )

  return <AskContext.Provider value={value}>{children}</AskContext.Provider>
}

export function useAsk(): AskContextValue {
  const ctx = useContext(AskContext)
  if (!ctx) throw new Error('useAsk must be used within <AskProvider>')
  return ctx
}
