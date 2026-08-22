/**
 * The adapter contract.
 *
 * Adapters **truncate and format only** — they never make content decisions.
 * Nothing in here takes a liner note, a detector, or a data point: an adapter
 * sees a finished `SyndicationPayload` and turns it into one platform's
 * request shape. That is what makes a new channel a formatting function rather
 * than a content pipeline, and what stops the X copy drifting into a different
 * register from the Mastodon copy with no single place to fix it.
 */

import type { Channel, LedgerEntry, SyndicationPayload } from "../types.ts";

export interface PostResult {
  /** Platform-native identifier, stored in the ledger as the retraction index. */
  uri: string;
  /** Bluesky needs the record key as well as the at:// URI to delete. */
  rkey?: string;
  /** Human-clickable URL, for the run log. */
  permalink?: string;
}

export interface Adapter {
  channel: Channel;
  /**
   * Whether credentials are present. A channel with no credentials is skipped
   * with a notice rather than throwing: the operator adding Mastodon a week
   * after Bluesky should not be a broken run.
   */
  configured(): boolean;
  post(payload: SyndicationPayload): Promise<PostResult>;
  retract(entry: LedgerEntry): Promise<void>;
}
