/**
 * Agentic Liner Notes — Artist alias resolver (#227)
 *
 * Artist *name* is not artist *identity*. The archive stores every billing as a
 * separate artist, so Brian Setzer appears four times under four marquees across
 * eight shows. A cover detector that doesn't know this emits "you've heard Rock
 * This Town from four different artists" about one man.
 *
 * Two relations, and the distinction is the whole point:
 *
 *   same-act      collapse. Different marquees, one act.
 *   shares-member link, never collapse. Different acts, a person in common —
 *                 Danny Elfman playing Oingo Boingo songs 35 years later is a
 *                 story precisely *because* they are two acts.
 *
 * The map is hand-maintained in `data/artist-aliases.json`. Nothing in the data
 * can infer any of it.
 */

export interface AliasMap {
  /** billing slug → canonical slug. Only same-act billings appear. */
  readonly canonical: ReadonlyMap<string, string>;
  /** canonical slug → every billing that collapses into it. */
  readonly billings: ReadonlyMap<string, readonly string[]>;
  /** act slug → acts sharing a member. Symmetric; never collapsed. */
  readonly related: ReadonlyMap<string, readonly string[]>;
  /** act-pair key → the person in common, for prose. */
  readonly sharedMember: ReadonlyMap<string, string>;
  /** canonical slug → display name. */
  readonly displayName: ReadonlyMap<string, string>;
}

interface RawAliasFile {
  sameAct?: Array<{ canonical: string; name?: string; billings: string[] }>;
  sharesMember?: Array<{ acts: [string, string]; who: string }>;
}

const pairKey = (a: string, b: string) => [a, b].sort().join("::");

/** An empty map — every artist resolves to itself, nothing is related. */
export const EMPTY_ALIAS_MAP: AliasMap = {
  canonical: new Map(),
  billings: new Map(),
  related: new Map(),
  sharedMember: new Map(),
  displayName: new Map(),
};

export function buildAliasMap(raw: unknown): AliasMap {
  const file = (raw ?? {}) as RawAliasFile;
  const canonical = new Map<string, string>();
  const billings = new Map<string, readonly string[]>();
  const related = new Map<string, string[]>();
  const sharedMember = new Map<string, string>();
  const displayName = new Map<string, string>();

  for (const entry of file.sameAct ?? []) {
    if (!entry?.canonical || !Array.isArray(entry.billings)) continue;
    billings.set(entry.canonical, [...entry.billings]);
    if (entry.name) displayName.set(entry.canonical, entry.name);
    for (const billing of entry.billings) canonical.set(billing, entry.canonical);
  }

  for (const entry of file.sharesMember ?? []) {
    const [a, b] = entry?.acts ?? [];
    if (!a || !b) continue;
    if (!related.has(a)) related.set(a, []);
    if (!related.has(b)) related.set(b, []);
    related.get(a)!.push(b);
    related.get(b)!.push(a);
    if (entry.who) sharedMember.set(pairKey(a, b), entry.who);
  }

  return { canonical, billings, related, sharedMember, displayName };
}

/**
 * The canonical identity for a billing. An artist with no entry resolves to
 * itself — the map only ever adds knowledge, never gates.
 */
export function canonicalOf(map: AliasMap, artistSlug: string): string {
  return map.canonical.get(artistSlug) ?? artistSlug;
}

/**
 * True when two billings are the same act. This is the guard a cover or guest
 * detector needs: without it, "Brian Setzer covered Brian Setzer" is a finding.
 */
export function isSameAct(map: AliasMap, a: string, b: string): boolean {
  return canonicalOf(map, a) === canonicalOf(map, b);
}

/** Every billing that collapses into this artist's canonical identity. */
export function billingsOf(map: AliasMap, artistSlug: string): readonly string[] {
  return map.billings.get(canonicalOf(map, artistSlug)) ?? [artistSlug];
}

/** Display name for an act, when the map carries one. */
export function displayNameOf(map: AliasMap, artistSlug: string): string | undefined {
  return map.displayName.get(canonicalOf(map, artistSlug));
}

/**
 * Acts sharing a member with this one — deliberately *not* collapsed, so a
 * detector can use the link as the story rather than erasing it.
 */
export function relatedActs(map: AliasMap, artistSlug: string): readonly string[] {
  return map.related.get(artistSlug) ?? [];
}

/** The person two acts have in common, when they share one. */
export function sharedMemberOf(map: AliasMap, a: string, b: string): string | undefined {
  return map.sharedMember.get(pairKey(a, b));
}
