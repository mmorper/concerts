// Per-IP and per-session rate limits — the PRIMARY abuse defense (decided 2026-06-17). The
// $/day cap is only a backstop (and a ~$0.83/day griefing vector if it's the front line), so
// these limiters carry the load. Cloudflare's native Rate Limiting binding is edge-local and
// cheap — no Durable Object hot-spot for a global per-IP counter.

export interface RateLimit {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

// Returns true if allowed, false if the caller should be turned away. A missing binding
// fails OPEN (the limiters are defense-in-depth; the session gate + cost cap still apply) —
// but logs loudly so a misconfig is visible.
export async function allow(limiter: RateLimit | undefined, key: string, label: string): Promise<boolean> {
  if (!limiter) {
    console.warn(`rate limiter '${label}' not bound — allowing through`);
    return true;
  }
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (e) {
    console.error(`rate limiter '${label}' threw — allowing through`, e);
    return true;
  }
}
