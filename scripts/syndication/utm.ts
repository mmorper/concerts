/**
 * Per-channel UTM parameters (#331).
 *
 * Distinct per channel so GA4 can answer *which channels actually deliver*
 * rather than inviting a guess. Without this the whole fan-out lands in GA4 as
 * one undifferentiated "social" bucket, and the decision the epic exists to
 * inform — is any of this worth the maintenance — becomes unanswerable after
 * the fact rather than before it.
 */

import type { Channel, SyndicationPayload } from "./types.ts";

export function withUtm(url: string, channel: Channel, kind: SyndicationPayload["kind"]): string {
  const parsed = new URL(url);
  parsed.searchParams.set("utm_source", channel);
  parsed.searchParams.set("utm_medium", "social");
  // The campaign separates the two content streams, so "does On This Day pull
  // its weight against the weekly note" is a filter rather than an argument.
  parsed.searchParams.set("utm_campaign", kind);
  return parsed.toString();
}
