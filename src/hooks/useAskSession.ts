// Session lifecycle for "Ask the Archive" (#141).
//
// Lazy + invisible: no Turnstile runs on page load. The first time a visitor opens Ask we mint a
// session (Turnstile → signed token), cache it (~30 min, the worker's TTL), and silently re-mint
// on expiry so a long visit never hits an error wall. In dev, a pasted token (mint-dev-session)
// is honoured and Turnstile is skipped — keeps /ask-dev working without a site key.

import { useCallback, useRef } from 'react'
import {
  getSessionToken,
  clearSessionToken,
  exchangeTurnstileForSession,
} from '@/services/askArchive'
import { getTurnstileToken, turnstileConfigured } from '@/services/turnstile'

export function useAskSession() {
  // De-dupe concurrent mints (e.g. two quick opens) so we run at most one challenge at a time.
  const inflight = useRef<Promise<string | null> | null>(null)

  const mint = useCallback(async (): Promise<string | null> => {
    // Dev / no-Turnstile fallback: if a token was pasted, use it; we can't mint without a key.
    if (!turnstileConfigured()) return getSessionToken()
    try {
      const turnstileToken = await getTurnstileToken()
      return await exchangeTurnstileForSession(turnstileToken)
    } catch (err) {
      console.warn('ask session mint failed:', err)
      return null
    }
  }, [])

  // Return a valid session token, minting if absent (or `force`d after a 401). Concurrent callers
  // share one in-flight mint.
  const ensureSession = useCallback(
    async (force = false): Promise<string | null> => {
      if (!force) {
        const existing = getSessionToken()
        if (existing) return existing
      } else {
        clearSessionToken()
      }
      if (inflight.current) return inflight.current
      // mint() already stores the token via exchangeTurnstileForSession on success.
      const p = mint().finally(() => {
        inflight.current = null
      })
      inflight.current = p
      return p
    },
    [mint],
  )

  return { ensureSession }
}
