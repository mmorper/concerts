/**
 * Liveness check for stored third-party URLs.
 *
 * Enrichment used to trust that a successful API response meant a usable URL.
 * It does not: the Places API happily returns a photo URI for a photo that has
 * since been unpublished, and that URI 403s on fetch. `enrich-venues` only fell
 * back when the *API call* failed, so dead URLs were stored and served (#252,
 * #255).
 *
 * These checks hit the image CDNs directly, not the Places API — no key, no
 * quota, no billing.
 */

export type UrlHealth = "ok" | "dead" | "unknown";

export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * A local asset path is always fine; a 4xx is definitive; a 5xx, timeout or
 * network error is "unknown".
 *
 * The distinction matters: "unknown" must never trigger a downgrade. Treating a
 * transient blip as proof an image is gone would let one bad CI run rewrite
 * every record to a fallback at once.
 */
export async function checkUrl(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<UrlHealth> {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return "ok";
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return "ok";
    if (res.status >= 400 && res.status < 500) return "dead";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Convenience: only a definitive 4xx counts as "replace this". */
export async function isDead(url: string, timeoutMs?: number): Promise<boolean> {
  return (await checkUrl(url, timeoutMs)) === "dead";
}
