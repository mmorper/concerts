/**
 * Is the archive still posting, and if not, since when?
 *
 * Silent token death is the defining failure mode of an unattended system
 * (#337). Instagram's 60-day refresh and X's rotating tokens both fail quietly;
 * so does a workflow that simply stops being scheduled. The syndicate job has
 * already gone silent twice — five consecutive nights from 28 August (#451), and
 * again on 5 September — and both were found by someone happening to look.
 *
 * ONE NUMBER MAKES THAT OBVIOUS: the last time each channel accepted a post.
 * A timestamp that stops moving is a dead credential, a dead workflow or a dead
 * channel, and it does not matter which until you know it happened.
 *
 * ── Why this is not derivable from the ledger alone ──────────────────────────
 *
 * The ledger records `posted`, `seeded` and `retracted`. It deliberately records
 * NOTHING for a failure: "the ledger records nothing; a retry resumes only that
 * channel". That is correct for idempotency — a failed pair must stay retryable
 * — but it means the ledger can say when a channel last succeeded and can never
 * say that it has been failing since.
 *
 * So failures come from the run summary and are CARRIED FORWARD in this file.
 * A run that fails writes the error; a run that succeeds clears it. Without the
 * carry-forward, the record of a failure would live only in an Actions log that
 * expires, which is how both silences went unnoticed.
 */

import type { Channel, LedgerEntry, SyndicationLedger } from "./types.ts";

export interface ChannelHealth {
  channel: Channel;
  /** Last time this channel accepted a post. The token-death signal. */
  lastSuccessAt?: string;
  /** Posts this channel has ever accepted. */
  postedCount: number;
  /** Runs in a row that failed on this channel. Reset by any success. */
  consecutiveFailures: number;
  lastError?: string;
  lastErrorAt?: string;
}

export interface SyndicationHealth {
  version: 1;
  generatedAt: string;
  /** When a run last reached the point of writing this file — alive or not. */
  lastRunAt?: string;
  paused: boolean;
  pausedReason?: string;
  ledger: { total: number; posted: number; seeded: number; retracted: number };
  channels: ChannelHealth[];
}

/** What `deriveHealth` needs from a run. A subset of `RunSummary`, so tests need no run. */
export interface HealthRunInput {
  posted: Array<{ slug: string; channel: Channel }>;
  failed: Array<{ slug: string; channel: Channel; error: string }>;
}

/**
 * Merge the durable ledger with this run's outcome and the previous file.
 *
 * `previous` is what carries a failure across runs. `now` is injected so the
 * output is reproducible and the tests do not move with the wall clock.
 */
export function deriveHealth(
  ledger: SyndicationLedger,
  options: {
    channels: readonly Channel[];
    previous?: SyndicationHealth;
    run?: HealthRunInput;
    paused?: { paused: boolean; reason?: string };
    now: string;
  }
): SyndicationHealth {
  const { channels, previous, run, paused, now } = options;

  const counts = { total: ledger.entries.length, posted: 0, seeded: 0, retracted: 0 };
  for (const e of ledger.entries) {
    if (e.status === "posted") counts.posted++;
    else if (e.status === "seeded") counts.seeded++;
    else if (e.status === "retracted") counts.retracted++;
  }

  const prevByChannel = new Map((previous?.channels ?? []).map((c) => [c.channel, c]));

  const health: ChannelHealth[] = channels.map((channel) => {
    const rows = ledger.entries.filter(
      (e: LedgerEntry) => e.platform === channel && e.status === "posted" && e.postedAt
    );
    const lastSuccessAt = rows
      .map((e) => e.postedAt as string)
      .sort()
      .pop();

    const prev = prevByChannel.get(channel);
    const succeededThisRun = (run?.posted ?? []).some((p) => p.channel === channel);
    const failure = (run?.failed ?? []).find((f) => f.channel === channel);

    // A success clears the failure record outright. Anything less than that and
    // an old error would outlive the problem it described, which is worse than
    // no record at all — it sends you looking for a fault that is already fixed.
    if (succeededThisRun) {
      return { channel, lastSuccessAt, postedCount: rows.length, consecutiveFailures: 0 };
    }
    if (failure) {
      return {
        channel,
        lastSuccessAt,
        postedCount: rows.length,
        consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
        lastError: failure.error,
        lastErrorAt: now,
      };
    }
    // Neither posted nor failed: a quiet run with nothing due. Carry the record.
    return {
      channel,
      lastSuccessAt,
      postedCount: rows.length,
      consecutiveFailures: prev?.consecutiveFailures ?? 0,
      lastError: prev?.lastError,
      lastErrorAt: prev?.lastErrorAt,
    };
  });

  return {
    version: 1,
    generatedAt: now,
    lastRunAt: now,
    paused: paused?.paused ?? false,
    pausedReason: paused?.reason,
    ledger: counts,
    channels: health,
  };
}

/**
 * Channels that warrant waking somebody.
 *
 * Two independent triggers, because the two silences had different shapes: one
 * channel erroring while the other posts, and everything going quiet at once.
 */
export function alertsFor(
  health: SyndicationHealth,
  options: { now: string; quietDays?: number }
): string[] {
  const quietDays = options.quietDays ?? 10;
  const out: string[] = [];

  for (const c of health.channels) {
    if (c.consecutiveFailures > 0) {
      out.push(
        `${c.channel}: ${c.consecutiveFailures} failed run(s) in a row — ${c.lastError ?? "no error recorded"}`
      );
      continue;
    }
    // A channel that has NEVER posted is not yet a fault — it may not be live.
    if (!c.lastSuccessAt) continue;
    const days = Math.floor(
      (Date.parse(options.now) - Date.parse(c.lastSuccessAt)) / 86_400_000
    );
    if (days >= quietDays) {
      out.push(`${c.channel}: nothing posted for ${days} days (last ${c.lastSuccessAt.slice(0, 10)})`);
    }
  }
  return out;
}
