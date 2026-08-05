/**
 * Artist billing aliases for the MCP server (#227 Q4).
 *
 * The archive stores every billing as its own artist, so `get_artist_history`
 * for "Brian Setzer" answered "I've seen Brian Setzer 1 time" — the 2024 show —
 * while the archive holds eight across four marquees going back to 1995.
 *
 * Read from the live site alongside every other data file. A missing or
 * unreadable file degrades to the identity map, which is the behaviour before
 * this existed.
 *
 * Deliberately narrow, like the app-side reader: only `sameAct` is used. The
 * `sharesMember` relation exists to keep acts *apart* and is a liner-notes
 * concern — folding Oingo Boingo into Danny Elfman here would be wrong.
 */

export interface ArtistAliasData {
  sameAct?: Array<{ canonical: string; name?: string; billings: string[] }>;
}

export interface AliasIndex {
  /** billing slug → canonical slug */
  canonical: Map<string, string>;
  /** canonical slug → every billing that collapses into it */
  billings: Map<string, string[]>;
  /** canonical slug → display name */
  displayName: Map<string, string>;
}

export const EMPTY_ALIAS_INDEX: AliasIndex = {
  canonical: new Map(),
  billings: new Map(),
  displayName: new Map(),
};

export function buildAliasIndex(raw: ArtistAliasData | null | undefined): AliasIndex {
  const canonical = new Map<string, string>();
  const billings = new Map<string, string[]>();
  const displayName = new Map<string, string>();

  for (const entry of raw?.sameAct ?? []) {
    if (!entry?.canonical || !Array.isArray(entry.billings)) continue;
    billings.set(entry.canonical, [...entry.billings]);
    if (entry.name) displayName.set(entry.canonical, entry.name);
    for (const billing of entry.billings) canonical.set(billing, entry.canonical);
  }

  return { canonical, billings, displayName };
}

/** Canonical identity for a billing; unmapped artists resolve to themselves. */
export function canonicalSlug(index: AliasIndex, slug: string): string {
  return index.canonical.get(slug) ?? slug;
}

/** Every slug that counts as this artist — always includes the slug itself. */
export function slugsFor(index: AliasIndex, slug: string): string[] {
  const canon = canonicalSlug(index, slug);
  return index.billings.get(canon) ?? [slug];
}

/** Preferred display name for a merged act, when the map names one. */
export function aliasName(index: AliasIndex, slug: string): string | undefined {
  return index.displayName.get(canonicalSlug(index, slug));
}
