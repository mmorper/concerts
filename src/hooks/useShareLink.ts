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
 * Behaviour differs deliberately by device, not by component:
 *   - Touch (phone or iPad): navigator.share() when available, clipboard as
 *     fallback. Sharing there means sending to a person, and the OS sheet is its
 *     own confirmation.
 *   - Desktop: clipboard, with the caller rendering an inline confirmation.
 *
 * The device is the hook's own call (`wantsShareSheet`), not the caller's. It
 * used to be the caller's `isPhone`, a width check, so an iPad, wider than a
 * phone, copied the link while every phone got the sheet.
 *
 * Feature detection for navigator.share happens *inside* the touch branch.
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
  /** Optional GA event fired on each attempt, with method/succeeded merged in. */
  analyticsEvent?: { name: string; params?: Record<string, unknown> }
}

interface UseShareLink {
  /** Shares `url`, or the string passed here when the link is only known at click time. */
  share: (urlOverride?: unknown) => Promise<void>
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

/**
 * A touch device with a share sheet: every phone, and an iPad. A touch screen is the primary
 * pointer on both. iPadOS Safari asks for desktop sites and calls itself a Mac, and with a
 * trackpad attached its primary pointer is fine, so it is told apart from a real Mac by its touch
 * points (a Mac has none). A desktop with navigator.share still copies.
 */
export function wantsShareSheet(
  // Injectable for the same reason as writeToClipboard: the tests run in node.
  env: { nav?: Navigator; win?: Pick<Window, 'matchMedia'> } = {}
): boolean {
  const nav = env.nav ?? (typeof navigator !== 'undefined' ? navigator : undefined)
  const win = env.win ?? (typeof window !== 'undefined' ? window : undefined)
  if (!nav || typeof nav.share !== 'function') return false
  const touchFirst = !!win?.matchMedia?.('(pointer: coarse)').matches
  const iPad = /Macintosh/.test(nav.userAgent ?? '') && (nav.maxTouchPoints ?? 0) > 1
  return touchFirst || iPad
}

export function useShareLink({
  url: baseUrl,
  title,
  text,
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

  // `urlOverride` is for a link that exists only after the click: an Ask answer gets its id from
  // the Worker when it's first shared. Callers that pass `share` straight to onClick hand it the
  // click event, so only a string counts.
  const share = useCallback(async (urlOverride?: unknown) => {
    const url = typeof urlOverride === 'string' ? urlOverride : baseUrl
    haptics.light()
    const sheet = wantsShareSheet()

    const track = (method: 'share_sheet' | 'clipboard', succeeded: boolean) => {
      if (!analyticsEvent) return
      analytics.trackEvent(analyticsEvent.name, {
        ...analyticsEvent.params,
        method,
        succeeded,
        // 'mobile' is any touch device with a sheet, an iPad included, as it was named before.
        device_type: sheet ? 'mobile' : 'desktop',
      })
    }

    if (sheet) {
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
  }, [baseUrl, title, text, analyticsEvent, flash])

  return { share, status }
}
