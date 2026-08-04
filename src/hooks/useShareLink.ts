/**
 * useShareLink — the single share/copy implementation (#204)
 *
 * Consolidates what were four separate hand-rolled versions:
 *   ConcertHistoryPanel  artist link, hand-built URL, clipboard + tooltip
 *   PhoneArtistModal     artist link, clipboard + toast, iOS execCommand fallback
 *   LinerNoteCard        post permalink, navigator.share or clipboard
 *   useShareSetlistLink  setlist link, navigator.share on phone (#196)
 *
 * They disagreed on URL construction (two built strings by hand), on whether a
 * share sheet was offered at all, and on how success was reported. Callers now
 * supply a URL and a label; everything else is one behaviour.
 *
 * Behaviour differs deliberately by surface, not by component:
 *   - Phone: navigator.share() when available, clipboard as fallback. Sharing on
 *     a phone means sending to a person, and the OS sheet is its own confirmation.
 *   - Desktop: clipboard, with the caller rendering an inline confirmation.
 *
 * Feature detection for navigator.share happens *inside* the phone branch.
 * Detecting it alone would hand desktop Safari a share sheet while desktop
 * Chrome got a clipboard copy — same app, same click, different behaviour.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { analytics } from '../services/analytics'
import { haptics } from '../utils/haptics'

/** How long an inline confirmation stays up. */
const CONFIRM_MS = 1500

export type ShareStatus = 'idle' | 'shared' | 'copied' | 'error'

interface UseShareLinkOptions {
  /** Absolute URL to share. Build it with src/utils/deepLinks.ts — never by hand. */
  url: string
  /** Share-sheet title, e.g. "Nile Rodgers at Pacific Amphitheatre" */
  title: string
  /** Optional share-sheet body text. */
  text?: string
  /** Phone offers the native sheet; desktop copies. */
  isPhone?: boolean
  /** Optional GA event fired on each attempt, with method/succeeded merged in. */
  analyticsEvent?: { name: string; params?: Record<string, unknown> }
}

interface UseShareLink {
  share: () => Promise<void>
  /** Drives an inline confirmation. Never route this through the toast system. */
  status: ShareStatus
}

/**
 * Clipboard write with the iOS Safari fallback preserved from PhoneArtistModal.
 *
 * navigator.clipboard can reject on iOS Safari even in a secure context; the
 * hidden-textarea + execCommand path still works there. execCommand is
 * deprecated but has no equivalent replacement for that failure mode, so it
 * stays until iOS makes it unnecessary. Dropping it during consolidation would
 * have been a silent regression on the platform most likely to be sharing.
 */
export async function writeToClipboard(
  url: string,
  // Injectable so the fallback path is testable under vitest's node
  // environment, which has no document. Tests exercise this function itself
  // rather than a copy of it — a mirrored test can pass while the real code
  // is broken.
  env: { nav?: Navigator; doc?: Document } = {}
): Promise<boolean> {
  const nav = env.nav ?? (typeof navigator !== 'undefined' ? navigator : undefined)
  const doc = env.doc ?? (typeof document !== 'undefined' ? document : undefined)

  try {
    if (!nav?.clipboard) throw new Error('clipboard unavailable')
    await nav.clipboard.writeText(url)
    return true
  } catch {
    try {
      if (!doc) return false
      const textArea = doc.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      doc.body.appendChild(textArea)
      textArea.select()
      const ok = doc.execCommand('copy')
      doc.body.removeChild(textArea)
      return ok
    } catch {
      return false
    }
  }
}

export function useShareLink({
  url,
  title,
  text,
  isPhone = false,
  analyticsEvent,
}: UseShareLinkOptions): UseShareLink {
  const [status, setStatus] = useState<ShareStatus>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear a pending confirmation if the surface unmounts mid-countdown,
  // otherwise setStatus fires on an unmounted component.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const flash = useCallback((next: ShareStatus) => {
    setStatus(next)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setStatus('idle'), CONFIRM_MS)
  }, [])

  const share = useCallback(async () => {
    haptics.light()

    const track = (method: 'share_sheet' | 'clipboard', succeeded: boolean) => {
      if (!analyticsEvent) return
      analytics.trackEvent(analyticsEvent.name, {
        ...analyticsEvent.params,
        method,
        succeeded,
        device_type: isPhone ? 'mobile' : 'desktop',
      })
    }

    if (isPhone && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url })
        track('share_sheet', true)
        // The OS sheet is its own confirmation; don't also flash the control.
        setStatus('shared')
        return
      } catch (err) {
        // AbortError means the user dismissed the sheet — a deliberate choice,
        // not a failure. Stay silent rather than flashing an error at someone
        // who simply changed their mind.
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus('idle')
          return
        }
        // Anything else (unsupported payload, permission policy) falls through
        // to the clipboard path below.
      }
    }

    const ok = await writeToClipboard(url)
    track('clipboard', ok)
    flash(ok ? 'copied' : 'error')
  }, [url, title, text, isPhone, analyticsEvent, flash])

  return { share, status }
}
