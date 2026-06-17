// Spend tripwire push (spec §"Detection = the remedy"). When committed spend crosses the
// ≥80% line, push a notification deep-linking to /ask/admin so alert and fix are one swipe
// apart. Fires AT MOST ONCE PER DAY (a KV latch keyed on the UTC day) so a busy day doesn't
// spam. NOTIFY_WEBHOOK_URL is any simple push endpoint (ntfy.sh / Pushover-style); absent →
// the tripwire is a log line only.

import type { Env, SpendStatus } from "./types.js";

const ADMIN_URL = "https://concerts.morperhaus.org/api/ask/admin";

export async function maybeTripwire(env: Env, status: SpendStatus, ctx: ExecutionContext): Promise<void> {
  if (status.fraction < 0.8) return;

  const latchKey = `tripwire:${status.day}`;
  try {
    if (await env.ASK_CONTROL.get(latchKey)) return; // already fired today
    await env.ASK_CONTROL.put(latchKey, "1", { expirationTtl: 60 * 60 * 36 });
  } catch (e) {
    console.error("tripwire latch read/write failed", e);
    // fall through — better to risk a duplicate alert than to miss one
  }

  const pct = Math.round(status.fraction * 100);
  const usd = (status.committedMicroUsd / 1_000_000).toFixed(2);
  console.warn(`ask spend tripwire: ${pct}% of daily cap ($${usd})`);

  if (!env.NOTIFY_WEBHOOK_URL) return;
  const body = `Ask the Archive: ${pct}% of today's budget ($${usd}). Tap to manage → ${ADMIN_URL}`;
  ctx.waitUntil(
    fetch(env.NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
    }).then(
      () => undefined,
      (e) => console.error("tripwire push failed", e),
    ),
  );
}
