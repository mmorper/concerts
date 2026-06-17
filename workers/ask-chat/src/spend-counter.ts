// Atomic per-day spend counter (Durable Object).
//
// WHY A DO, NOT KV: the $/day cap is the kill-switch's independent ceiling (spec
// §"Kill switch"). The MCP worker's existing cap is KV read-modify-write — eventually
// consistent and racy, so concurrent public requests can each read a stale low count and
// blow past the cap before it converges. A single DO instance serializes every read and
// write, so the ceiling actually holds. Decided 2026-06-17.
//
// RESERVE / COMMIT: an agent turn's real cost isn't known until the loop ends, and many
// turns can be in flight at once. Pre-flight `reserve(est)` claims a conservative estimate
// so concurrent bursts can't all pass the check; post-flight `commit(actual, est)` swaps the
// estimate for the measured cost (usually far less), freeing the slack. A crash between
// reserve and commit would leak a reservation, so reservations carry a timestamp and any
// older than RESERVATION_TTL_MS are pruned on the next op — the counter self-heals.

import type { Env, SpendStatus } from "./types.js";

// Stale-reservation cutoff. A single agent turn can't outrun the Worker request lifetime,
// so anything older than this was orphaned by a crash and is reclaimed.
const RESERVATION_TTL_MS = 120_000;

interface DayState {
  day: string; // YYYY-MM-DD (UTC)
  committedMicroUsd: number;
  reservations: Record<string, { est: number; at: number }>;
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function reservedTotal(s: DayState): number {
  let sum = 0;
  for (const k in s.reservations) sum += s.reservations[k].est;
  return sum;
}

export class SpendCounter implements DurableObject {
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, _env: Env) {
    this.storage = state.storage;
  }

  // Load today's state, rolling over at the UTC day boundary and pruning orphaned
  // reservations. Yesterday's committed total is simply abandoned (a fresh day key).
  private async load(now: number): Promise<DayState> {
    const today = utcDay(now);
    let s = (await this.storage.get<DayState>("state")) ?? null;
    if (!s || s.day !== today) {
      s = { day: today, committedMicroUsd: 0, reservations: {} };
      return s;
    }
    let pruned = false;
    for (const k in s.reservations) {
      if (now - s.reservations[k].at > RESERVATION_TTL_MS) {
        delete s.reservations[k];
        pruned = true;
      }
    }
    if (pruned) await this.storage.put("state", s);
    return s;
  }

  private status(s: DayState, capMicroUsd: number): SpendStatus {
    return {
      day: s.day,
      committedMicroUsd: s.committedMicroUsd,
      reservedMicroUsd: reservedTotal(s),
      capMicroUsd,
      fraction: capMicroUsd > 0 ? s.committedMicroUsd / capMicroUsd : 1,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();
    const capMicroUsd = Number(url.searchParams.get("cap") ?? "0");
    const s = await this.load(now);

    if (url.pathname === "/status") {
      // Wrapped in {status} like the other endpoints so the cost.ts client reads it uniformly.
      return Response.json({ ok: true, status: this.status(s, capMicroUsd) });
    }

    if (url.pathname === "/reserve") {
      const est = Number(url.searchParams.get("est") ?? "0");
      const projected = s.committedMicroUsd + reservedTotal(s) + est;
      if (projected > capMicroUsd) {
        return Response.json({ ok: false, status: this.status(s, capMicroUsd) });
      }
      const id = crypto.randomUUID();
      s.reservations[id] = { est, at: now };
      await this.storage.put("state", s);
      return Response.json({ ok: true, id, status: this.status(s, capMicroUsd) });
    }

    if (url.pathname === "/commit") {
      const id = url.searchParams.get("id") ?? "";
      const actual = Number(url.searchParams.get("actual") ?? "0");
      s.committedMicroUsd += actual;
      delete s.reservations[id]; // swap the estimate for the measured cost
      await this.storage.put("state", s);
      return Response.json({ ok: true, status: this.status(s, capMicroUsd) });
    }

    if (url.pathname === "/release") {
      // Turn failed before producing cost — drop the reservation, charge nothing.
      const id = url.searchParams.get("id") ?? "";
      delete s.reservations[id];
      await this.storage.put("state", s);
      return Response.json({ ok: true, status: this.status(s, capMicroUsd) });
    }

    return new Response("not found", { status: 404 });
  }
}
