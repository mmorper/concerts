/**
 * useShareSetlistLink — share/copy a deep link to one night's setlist (#196)
 *
 * One hook, two renders. `LinerNotesPanel` (desktop) and `SetlistOverlay`
 * (phone, inside PhoneArtistModal) look nothing alike, but URL construction,
 * the share/copy decision, and analytics must not be written twice — that is
 * where a divergence bug would hide.
 *
 * Behaviour differs deliberately by surface:
 *   - Phone: navigator.share() when available, clipboard as fallback.
 *     Sharing on a phone means sending to a person, not parking text on a
 *     clipboard, and the OS sheet doubles as the confirmation.
 *   - Desktop: clipboard, with an inline confirmation the caller renders.
 *
 * Feature detection for navigator.share happens *inside* the phone branch.
 * Detecting it alone would hand desktop Safari a share sheet while desktop
 * Chrome got a clipboard copy — same app, same click, different behaviour.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { setlistDeepLink, absoluteUrl } from '../utils/deepLinks'
import { analytics } from '../services/analytics'
import { haptics } from '../utils/haptics'

/** How long the inline "copied" confirmation stays up. */
const CONFIRM_MS = 1500

export type ShareStatus = 'idle' | 'shared' | 'copied' | 'error'

interface UseShareSetlistLinkOptions {
  /** Normalized headliner name, e.g. "nile-rodgers" */
  artistSlug: string
  /** Concert date, YYYY-MM-DD — the `show` param value */
  date: string
  /** Display name, used for the share sheet title */
  artistName: string
  venue: string
  /** Phone uses the native share sheet; desktop copies. */
  isPhone?: boolean
}

interface UseShareSetlistLink {
  share: () => Promise<void>
  /** Drives the inline icon → checkmark swap. Never render a toast for this. */
  status: ShareStatus
  url: string
}

export function useShareSetlistLink({
  artistSlug,
  date,
  artistName,
  venue,
  isPhone = false,
}: UseShareSetlistLinkOptions): UseShareSetlistLink {
  const [status, setStatus] = useState<ShareStatus>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const url = absoluteUrl(setlistDeepLink(artistSlug, date))

  // Clear a pending confirmation if the panel closes mid-countdown, otherwise
  // setStatus fires on an unmounted component.
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

    const track = (method: 'share_sheet' | 'clipboard', ok: boolean) => {
      analytics.trackEvent('setlist_link_shared', {
        artist_name: artistName,
        concert_date: date,
        venue_name: venue,
        method,
        succeeded: ok,
        device_type: isPhone ? 'mobile' : 'desktop',
      })
    }

    if (isPhone && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${artistName} at ${venue}`,
          text: `${artistName} at ${venue} — the setlist`,
          url,
        })
        track('share_sheet', true)
        // The OS sheet is its own confirmation; don't also flash the icon.
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
        // Anything else (share unsupported for this payload, permission
        // policy) falls through to the clipboard path below.
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      track('clipboard', true)
      flash('copied')
    } catch {
      track('clipboard', false)
      flash('error')
    }
  }, [artistName, date, venue, isPhone, url, flash])

  return { share, status, url }
}
