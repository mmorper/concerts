/**
 * Artist billing aliases, app-side (#227 Q4).
 *
 * The archive stores every billing as its own artist, so Brian Setzer occupies
 * four cards in the mosaic across eight shows: Brian Setzer, The Brian Setzer
 * Orchestra, Brian Setzer and the Nashvillians, and Brian Setzer '68 Comeback
 * Special. They are one act.
 *
 * The map is hand-maintained in `data/artist-aliases.json` and published to
 * `public/data/artist-aliases.json` by `scripts/sync-artist-aliases.ts`.
 *
 * Deliberately a *narrower* reader than the pipeline's `artist-aliases.ts`: the
 * UI only needs the same-act collapse. `sharesMember` exists to keep acts apart
 * and is a detector concern, so the mosaic ignores it — Oingo Boingo and Danny
 * Elfman stay two cards, which is the point of that relation.
 */

export interface ArtistAliasFile {
  sameAct?: Array<{ canonical: string; name?: string; billings: string[] }>;
}

export interface ArtistAliasMap {
  /** billing slug → canonical slug. Only same-act billings appear. */
  readonly canonical: ReadonlyMap<string, string>;
  /** canonical slug → display name, when the map carries one. */
  readonly displayName: ReadonlyMap<string, string>;
}

export const EMPTY_ARTIST_ALIAS_MAP: ArtistAliasMap = {
  canonical: new Map(),
  displayName: new Map(),
};

export function buildArtistAliasMap(raw: unknown): ArtistAliasMap {
  const file = (raw ?? {}) as ArtistAliasFile;
  const canonical = new Map<string, string>();
  const displayName = new Map<string, string>();

  for (const entry of file.sameAct ?? []) {
    if (!entry?.canonical || !Array.isArray(entry.billings)) continue;
    if (entry.name) displayName.set(entry.canonical, entry.name);
    for (const billing of entry.billings) canonical.set(billing, entry.canonical);
  }

  return { canonical, displayName };
}

/**
 * Canonical identity for a billing. An artist with no entry resolves to itself,
 * so the map only ever adds knowledge — an absent or unreachable file leaves the
 * mosaic exactly as it was.
 *
 * This is also what keeps existing links working: `?artist=the-brian-setzer-
 * orchestra` is in the sitemap and in three published liner notes, and it has to
 * keep landing on the merged card rather than 404ing.
 */
export function canonicalArtist(map: ArtistAliasMap, slug: string): string {
  return map.canonical.get(slug) ?? slug;
}

/** Preferred display name for a canonical act, when the map names one. */
export function aliasDisplayName(map: ArtistAliasMap, slug: string): string | undefined {
  return map.displayName.get(canonicalArtist(map, slug));
}
