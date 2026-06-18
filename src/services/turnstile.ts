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
 * Run one Turnstile challenge and resolve with a one-time token (to be exchanged server-side for
 * a session). Renders an invisible widget into an off-screen container, executes it, and cleans
 * up regardless of outcome. Rejects if Turnstile isn't configured/available or the challenge fails.
 */
export async function getTurnstileToken(): Promise<string> {
  if (!SITE_KEY) throw new Error('turnstile_not_configured')
  const ts = await whenReady()

  return new Promise<string>((resolve, reject) => {
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.bottom = '0'
    host.style.left = '0'
    host.style.width = '0'
    host.style.height = '0'
    host.style.overflow = 'hidden'
    document.body.appendChild(host)

    let widgetId: string | undefined
    let settled = false
    const cleanup = () => {
      if (widgetId) {
        try {
          ts.remove(widgetId)
        } catch {
          /* ignore */
        }
      }
      host.remove()
    }
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }

    try {
      widgetId = ts.render(host, {
        sitekey: SITE_KEY,
        size: 'invisible',
        retry: 'never',
        callback: (token: string) => done(() => resolve(token)),
        'error-callback': () => done(() => reject(new Error('turnstile_error'))),
        'expired-callback': () => done(() => reject(new Error('turnstile_expired'))),
        'timeout-callback': () => done(() => reject(new Error('turnstile_timeout'))),
      })
      ts.execute(host, { sitekey: SITE_KEY })
    } catch (e) {
      done(() => reject(e instanceof Error ? e : new Error('turnstile_error')))
    }

    // Hard backstop so a silently-stuck challenge can't hang the caller forever.
    setTimeout(() => done(() => reject(new Error('turnstile_timeout'))), 20000)
  })
}
