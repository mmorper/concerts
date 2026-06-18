// Cloudflare Turnstile — promise wrapper around the explicit-render widget API (#141).
//
// The challenge runs invisibly and on demand: we mint a session only when a visitor actually
// opens Ask, not on page load, so the ~99% who never ask never pay for a challenge. The widget
// renders into a hidden container; if Turnstile's mode needs an interaction it will surface its
// own UI, but for a managed/invisible site key this resolves silently.

interface TurnstileAPI {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  execute: (el: HTMLElement | string, opts?: Record<string, unknown>) => void
  remove: (id: string) => void
  reset: (id?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

export function turnstileConfigured(): boolean {
  return SITE_KEY.length > 0
}

// Wait for the async-loaded api.js to define window.turnstile (it's `defer`ed in index.html).
function whenReady(timeoutMs = 8000): Promise<TurnstileAPI> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const start = Date.now()
    const tick = () => {
      if (window.turnstile) return resolve(window.turnstile)
      if (Date.now() - start > timeoutMs) return reject(new Error('turnstile_unavailable'))
      setTimeout(tick, 120)
    }
    tick()
  })
}

/**
 * Run one Turnstile challenge and resolve with a one-time token (exchanged server-side for a
 * session). The widget is **Managed** (Cloudflare-decided), rendered with
 * `appearance: 'interaction-only'`: it stays invisible for virtually everyone and only paints a
 * challenge on the rare occasion one is actually required — so the container must be real and
 * on-screen (a hidden/0×0 box would make an interactive challenge impossible to complete). Cleans
 * up regardless of outcome. Rejects if Turnstile isn't configured/available or the challenge fails.
 */
export async function getTurnstileToken(): Promise<string> {
  if (!SITE_KEY) throw new Error('turnstile_not_configured')
  const ts = await whenReady()

  return new Promise<string>((resolve, reject) => {
    const host = document.createElement('div')
    // Centered, high z-index, empty until/unless Turnstile paints a challenge into it.
    host.className = 'ts-gate'
    document.body.appendChild(host)

    let widgetId: string | undefined
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      if (widgetId) {
        try {
          ts.remove(widgetId)
        } catch {
          /* ignore */
        }
      }
      host.remove()
      fn()
    }

    try {
      widgetId = ts.render(host, {
        sitekey: SITE_KEY,
        appearance: 'interaction-only', // invisible unless a challenge is genuinely needed
        theme: 'dark',
        retry: 'never',
        callback: (token: string) => done(() => resolve(token)),
        'error-callback': () => done(() => reject(new Error('turnstile_error'))),
        'expired-callback': () => done(() => reject(new Error('turnstile_expired'))),
        'timeout-callback': () => done(() => reject(new Error('turnstile_timeout'))),
      })
    } catch (e) {
      done(() => reject(e instanceof Error ? e : new Error('turnstile_error')))
    }

    // Hard backstop so a silently-stuck challenge can't hang the caller forever.
    setTimeout(() => done(() => reject(new Error('turnstile_timeout'))), 30000)
  })
}
