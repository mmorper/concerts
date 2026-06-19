// Spend tripwire push (spec §"Detection = the remedy"). When committed spend crosses a budget
// milestone, push a notification deep-linking to /ask/admin so alert and fix are one swipe apart.
//
// THREE milestones — 50% / 75% / 100% — each fires AT MOST ONCE PER DAY (a per-threshold KV latch
// keyed on the UTC day) so you get a heads-up well before the cap, a warning, and the hard stop,
// without a busy day spamming you. We fire only the HIGHEST crossed-but-unlatched milestone per
// turn, so a single big jump (0 → 100%) sends one "100%" alert, not three.
//
// NOTIFY_WEBHOOK_URL is any simple push endpoint (ntfy.sh / Pushover-style); absent → the tripwire
// is a log line only. To get these as *email*, point the webhook at an ntfy topic with email
// notifications enabled (or any webhook→email relay) — no email infrastructure needed in the worker.

import type { Env, SpendStatus } from "./types.js";

const ADMIN_URL = "https://concerts.morperhaus.org/api/ask/admin";

// Ascending. The highest crossed-but-unlatched one is the alert we send.
const THRESHOLDS = [0.5, 0.75, 1.0] as const;

export async function maybeTripwire(env: Env, status: SpendStatus, ctx: ExecutionContext): Promise<void> {
  const crossed = THRESHOLDS.filter((t) => status.fraction >= t);
  if (crossed.length === 0) return;
  const milestone = crossed[crossed.length - 1]; // highest crossed
  const pct = Math.round(milestone * 100);

  const latchKey = `tripwire:${status.day}:${pct}`;
  try {
    if (await env.ASK_CONTROL.get(latchKey)) return; // this milestone already fired today
    await env.ASK_CONTROL.put(latchKey, "1", { expirationTtl: 60 * 60 * 36 });
  } catch (e) {
    console.error("tripwire latch read/write failed", e);
    // fall through — better to risk a duplicate alert than to miss one
  }

  const usd = (status.committedMicroUsd / 1_000_000).toFixed(2);
  console.warn(`ask spend tripwire: crossed ${pct}% of daily cap ($${usd})`);

  if (!env.NOTIFY_WEBHOOK_URL) return;
  const note = pct >= 100 ? "budget spent — Ask will refuse until tomorrow" : `${pct}% of today's budget`;
  const body = `Ask the Archive: ${note} ($${usd}). Tap to manage → ${ADMIN_URL}`;
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
