#!/usr/bin/env tsx
/**
 * Propose artist and venue handles for review. NEVER a publish path.
 *
 * Usage:
 *   npm run harvest:handles                  # propose into the worksheet
 *   npm run harvest:handles -- --new-only    # only entities the archive has gained
 *   npm run harvest:handles -- --new-only --recheck 180
 *   npm run harvest:handles -- --artists     # one entity kind only
 *   npm run harvest:handles -- --venues
 *   npm run harvest:handles -- --promote     # accept the self-proving rows
 *   npm run harvest:handles -- --accept artist:blondie:bluesky,venue:the-anthem:bluesky
 *   npm run harvest:handles -- --verify      # re-resolve stored DIDs, report drift
 *
 * ## The shape, and why
 *
 * This script finds candidates. A human accepts them. The one exception is
 * `--promote`, which accepts `site-domain` rows without asking, because those
 * are the only ones that prove themselves — see below.
 *
 * The separation is the whole design. Automated resolution of "which account
 * is really theirs" was measured and it does not work: Bluesky's strongest
 * available signal, a verification badge plus an exact display-name match,
 * returns INTERPOL for the band Interpol and a Member of Parliament for the
 * ska musician Chris Murray. `handles.ts` carries the full numbers. So the
 * output of this script is a worksheet, and the worksheet is not read by
 * anything that posts.
 *
 * ## Three sources, in descending order of trust
 *
 * 1. **A resolvable website domain** (Bluesky only). If `depechemode.com`
 *    resolves as a handle, whoever controls DNS for the band's official site
 *    set it — proven by a TXT record or an HTTPS well-known file. That is
 *    stronger than platform verification and it needs no judgement, which is
 *    why it is the only rule `--promote` accepts.
 * 2. **MusicBrainz URL relationships**, human-curated per entity. For venues
 *    the entity has to be identified first, and coordinates do it: we hold a
 *    geocode for all 79 venues, MusicBrainz Places carry their own, and a
 *    place within `PLACE_MATCH_KM` of ours is the same building. That is a
 *    measurement, not an opinion about names — which matters when the archive
 *    contains "The Forum" and "UCLA".
 * 3. **Wikidata**, one bulk SPARQL query keyed on the MusicBrainz ID.
 *
 * Everything else — search, scoring, fuzzy name matching — is deliberately
 * absent. There is no evidence value for it in `HandleEvidence`, so a handle
 * found that way has nowhere to be recorded and cannot reach a post even by
 * accident.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

import { ROOT } from "./payload.ts";
import {
  HANDLES_PATH,
  domainMatchesEntity,
  loadHandles,
  needsHarvest,
  type HandleEvidence,
  type HandlesFile,
  type EntityKind,
} from "./handles.ts";
import type { Channel } from "./types.ts";

const WORKSHEET_PATH = join(ROOT, "data/social-handles.worksheet.json");

const UA = "Morperhaus-Concerts/6.0.0 ( concerts@morperhaus.org )";
/** MusicBrainz asks for one request per second and enforces it. */
const MB_DELAY_MS = 1150;
/**
 * Our geocode and MusicBrainz's disagree by a few hundred metres at worst; a
 * different venue in the same city is kilometres away. Measured across the
 * roster, real matches cluster under 0.5 km and the loosest true match is
 * 1.7 km — an amphitheatre whose geocode lands on its car park.
 */
const PLACE_MATCH_KM = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Proposals ────────────────────────────────────────────────────────────────

interface Proposal {
  kind: EntityKind;
  slug: string;
  name: string;
  channel: Channel;
  handle: string;
  did?: string;
  evidence: HandleEvidence;
  /** How this candidate was arrived at, for the human reading the worksheet. */
  note: string;
}

interface Worksheet {
  version: 1;
  generatedAt: string;
  /**
   * Rows a human has to accept or reject. `--promote` empties only the
   * `site-domain` ones; the rest stay here until somebody looks.
   */
  proposals: Proposal[];
  /** Entities with no candidate from any source. Normal, and the majority. */
  unresolved: Array<{ kind: EntityKind; slug: string; name: string }>;
  /**
   * `kind:slug` → the date we last looked, for **every** entity crawled,
   * whether or not it produced anything.
   *
   * This is what makes `--new-only` possible, and it has to record the misses
   * to work at all. 129 of 336 entities have no account anywhere; without a
   * record of having asked, each incremental run would re-crawl all of them at
   * MusicBrainz's one request per second and take twenty minutes to discover
   * nothing, which is the same as not being incremental.
   */
  attempted: Record<string, string>;
}

const attemptKey = (kind: EntityKind, slug: string) => `${kind}:${slug}`;

// ── Sources ──────────────────────────────────────────────────────────────────

function classify(resource: string): Channel | "unsupported" {
  const u = resource.toLowerCase();
  if (u.includes("bsky.app") || u.includes("bsky.social")) return "bluesky";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("twitter.com") || u.includes("//x.com")) return "x";
  return "unsupported";
}

/**
 * `https://bsky.app/profile/foo.com` → `foo.com`,
 * `https://twitter.com/depechemode?lang=en` → `depechemode`.
 *
 * The query string has to go before the last path segment is taken, or a
 * tracking parameter ends up inside the handle.
 */
function handleFromUrl(resource: string): string {
  const match = resource.match(/bsky\.app\/profile\/([^/?#]+)/);
  if (match) return decodeURIComponent(match[1]).replace(/^@/, "");
  return resource
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "")
    .split("/")
    .pop()!
    .replace(/^@/, "");
}

async function musicbrainz<T>(path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://musicbrainz.org/ws/2/${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      // 503 is MusicBrainz's "busy", not an error — it wants the retry.
      if (res.status === 503 || res.status === 429) {
        await sleep(3000);
        continue;
      }
      const json = (await res.json()) as T & { error?: string };
      if (json.error) {
        await sleep(3000);
        continue;
      }
      return json;
    } catch {
      await sleep(2000);
    }
  }
  return null;
}

interface MbRelation {
  type: string;
  ended?: boolean;
  url?: { resource: string };
}

/** Great-circle distance. Venue identity is a measurement, not a name match. */
function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Does this domain resolve as a Bluesky handle?
 *
 * A 200 means the DNS or well-known check passed on Bluesky's side, which is
 * the proof. A 400 is the ordinary answer for "nobody claimed this domain" and
 * is not an error worth reporting.
 */
async function resolveHandle(handle: string): Promise<string | null> {
  try {
    const url = new URL(
      "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle"
    );
    url.searchParams.set("handle", handle);
    const res = await fetch(url);
    if (res.status !== 200) return null;
    return ((await res.json()) as { did: string }).did;
  } catch {
    return null;
  }
}

/** The current handle for a DID, for `--verify`. */
async function resolveDid(did: string): Promise<string | null> {
  try {
    const url = new URL("https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile");
    url.searchParams.set("actor", did);
    const res = await fetch(url);
    if (!res.ok) return null;
    return ((await res.json()) as { handle: string }).handle;
  } catch {
    return null;
  }
}

function domainCandidates(website: string): string[] {
  const host = website.trim().replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  if (!host) return [];
  return host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];
}

// ── Harvest ──────────────────────────────────────────────────────────────────

interface Target {
  kind: EntityKind;
  slug: string;
  name: string;
  mbid?: string;
  website?: string;
  location?: { lat: number; lng: number };
}

function artistTargets(): Target[] {
  const artists = JSON.parse(
    readFileSync(join(ROOT, "public/data/artists-metadata.json"), "utf8")
  ) as Record<string, { name: string; website?: string }>;
  const discography = JSON.parse(
    readFileSync(join(ROOT, "public/data/discography.json"), "utf8")
  ) as Record<string, { mbid?: string }>;

  return Object.entries(artists).map(([slug, a]) => ({
    kind: "artist" as const,
    slug,
    name: a.name,
    mbid: discography[slug]?.mbid,
    website: a.website,
  }));
}

function venueTargets(): Target[] {
  const venues = JSON.parse(
    readFileSync(join(ROOT, "public/data/venues-metadata.json"), "utf8")
  ) as Record<string, { name: string; location?: { lat: number; lng: number } }>;

  return Object.entries(venues).map(([slug, v]) => ({
    kind: "venue" as const,
    slug,
    name: v.name,
    location: v.location,
  }));
}

/**
 * Identify the venue before asking about its links.
 *
 * Search by name, then keep the nearest result inside `PLACE_MATCH_KM`. Name
 * scoring is not attempted: MusicBrainz spells venues differently than we do,
 * and the roster contains names generic enough ("The Forum", "UCLA") that a
 * name match would be actively misleading where the coordinates are decisive.
 * A place with no coordinates is skipped rather than guessed at.
 */
async function findPlace(
  target: Target
): Promise<{ id: string; name: string; km: number } | null> {
  if (!target.location) return null;
  const search = await musicbrainz<{
    places?: Array<{ id: string; name: string; coordinates?: { latitude: string; longitude: string } }>;
  }>(`place/?query=${encodeURIComponent(target.name)}&fmt=json&limit=10`);
  await sleep(MB_DELAY_MS);
  if (!search?.places?.length) return null;

  let best: { id: string; name: string; km: number } | null = null;
  for (const place of search.places) {
    if (!place.coordinates) continue;
    const km = distanceKm(target.location, {
      lat: Number(place.coordinates.latitude),
      lng: Number(place.coordinates.longitude),
    });
    if (!best || km < best.km) best = { id: place.id, name: place.name, km };
  }
  return best && best.km <= PLACE_MATCH_KM ? best : null;
}

async function harvestOne(target: Target): Promise<Proposal[]> {
  const out: Proposal[] = [];
  const seen = new Set<string>();
  const push = (p: Proposal) => {
    const key = `${p.channel}:${p.handle.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  // ── MusicBrainz ──
  let website = target.website;
  let relations: MbRelation[] = [];

  if (target.kind === "artist" && target.mbid) {
    const artist = await musicbrainz<{ relations?: MbRelation[] }>(
      `artist/${target.mbid}?inc=url-rels&fmt=json`
    );
    await sleep(MB_DELAY_MS);
    relations = artist?.relations ?? [];
  } else if (target.kind === "venue") {
    const place = await findPlace(target);
    if (place) {
      const full = await musicbrainz<{ relations?: MbRelation[] }>(
        `place/${place.id}?inc=url-rels&fmt=json`
      );
      await sleep(MB_DELAY_MS);
      relations = full?.relations ?? [];
    }
  }

  for (const rel of relations) {
    const resource = rel.url?.resource;
    if (!resource) continue;
    // An ended relationship is a link the artist used to have. Publishing it
    // would be worse than publishing nothing.
    if (rel.ended) continue;
    if (rel.type === "official homepage" && !website) website = resource;
    const channel = classify(resource);
    if (channel === "unsupported") continue;
    push({
      kind: target.kind,
      slug: target.slug,
      name: target.name,
      channel,
      handle: handleFromUrl(resource),
      evidence: "musicbrainz",
      note: `MusicBrainz "${rel.type}" relationship → ${resource}`,
    });
  }

  // ── The domain rule ──
  //
  // Last, because it needs the website MusicBrainz may just have supplied.
  if (website) {
    for (const candidate of domainCandidates(website)) {
      // Affinity first: a failed name check is free, a resolve call is not.
      if (!domainMatchesEntity(candidate, target.name)) continue;
      const did = await resolveHandle(candidate);
      if (!did) continue;
      push({
        kind: target.kind,
        slug: target.slug,
        name: target.name,
        channel: "bluesky",
        handle: candidate,
        did,
        evidence: "site-domain",
        note: `${candidate} resolves as a Bluesky handle — proven by DNS or /.well-known against the official site`,
      });
      break;
    }
  }

  // Bluesky rows from MusicBrainz and Wikidata arrive as handles with no DID.
  // The facet needs one, and `handles.ts` refuses a Bluesky row without it, so
  // resolve now rather than leaving an unpublishable row for review.
  for (const proposal of out) {
    if (proposal.channel !== "bluesky" || proposal.did) continue;
    let did = await resolveHandle(proposal.handle);
    if (!did) {
      // The public appview rate-limits, and a run this long will hit it. One
      // retry separates "throttled" from "gone" often enough to matter — the
      // note below has to stay honest about not knowing which.
      await sleep(1500);
      did = await resolveHandle(proposal.handle);
    }
    if (did) proposal.did = did;
    else proposal.note += " — ⚠️ did not resolve (account gone, or we were throttled). No DID means this row cannot publish.";
  }

  return out;
}

/** One SPARQL query for the whole roster, keyed on MusicBrainz ID (P434). */
async function harvestWikidata(targets: Target[]): Promise<Proposal[]> {
  const byMbid = new Map(targets.filter((t) => t.mbid).map((t) => [t.mbid!, t]));
  if (!byMbid.size) return [];

  const values = [...byMbid.keys()].map((m) => `"${m}"`).join(" ");
  const query = `
SELECT ?mbid ?bluesky ?twitter ?instagram WHERE {
  VALUES ?mbid { ${values} }
  ?item wdt:P434 ?mbid .
  OPTIONAL { ?item wdt:P12361 ?bluesky }
  OPTIONAL { ?item wdt:P2002 ?twitter }
  OPTIONAL { ?item wdt:P2003 ?instagram }
}`;

  const res = await fetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) {
    console.warn(`   ⚠️  Wikidata returned ${res.status}; skipping that source`);
    return [];
  }

  const json = (await res.json()) as {
    results: { bindings: Array<Record<string, { value: string }>> };
  };

  const out: Proposal[] = [];
  const seen = new Set<string>();
  const fields: Array<[string, Channel]> = [
    ["bluesky", "bluesky"],
    ["twitter", "x"],
    ["instagram", "instagram"],
  ];

  for (const binding of json.results.bindings) {
    const target = byMbid.get(binding.mbid.value);
    if (!target) continue;
    for (const [field, channel] of fields) {
      const value = binding[field]?.value;
      if (!value) continue;
      const handle = value.replace(/^@/, "");
      const key = `${target.slug}:${channel}:${handle.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: target.kind,
        slug: target.slug,
        name: target.name,
        channel,
        handle,
        evidence: "wikidata",
        note: `Wikidata property for MusicBrainz ID ${target.mbid}`,
      });
    }
  }
  return out;
}

// ── Promote ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Accept the self-proving rows and leave the rest for a human.
 *
 * Only `site-domain` promotes. Every other evidence value is somebody else's
 * assertion — well-curated, usually right, and still an assertion. A DNS
 * record on the artist's own domain is not.
 *
 * A `blocked` row is never overwritten, and this is the reason opt-out is a
 * state rather than a deletion: a deleted row reads as never-harvested, so the
 * next run would re-propose it and silently undo the request.
 */
function promote(worksheet: Worksheet, file: HandlesFile): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  for (const proposal of worksheet.proposals) {
    if (proposal.evidence !== "site-domain") {
      skipped++;
      continue;
    }
    if (accept(proposal, file)) added++;
    else skipped++;
  }
  return { added, skipped };
}

/**
 * Write one reviewed proposal into the live file.
 *
 * Shared by `--promote` and `--accept` so a self-proving row and a
 * hand-reviewed one land identically. The alternative — hand-editing
 * `social-handles.json` — is the error-prone step this whole design exists to
 * remove, and it would be a shame to leave it as the only way to say yes to
 * the rows a human actually has to look at.
 */
function accept(proposal: Proposal, file: HandlesFile): boolean {
  const bucket = proposal.kind === "artist" ? file.artists : file.venues;
  const entity = (bucket[proposal.slug] ??= {});
  // An opt-out outranks a reviewer. Somebody asked not to be tagged, and
  // "accept this row" is not the same statement as "overturn that".
  if (entity[proposal.channel]?.blocked) return false;
  // A Bluesky row without a DID cannot be posted, so accepting one would write
  // a row that silently never publishes. Better to refuse it here, loudly.
  if (proposal.channel === "bluesky" && !proposal.did) return false;
  entity[proposal.channel] = {
    handle: proposal.handle,
    ...(proposal.did ? { did: proposal.did } : {}),
    evidence: proposal.evidence,
    verifiedAt: today(),
  };
  return true;
}

/**
 * Accept named rows: `--accept artist:blondie:bluesky,venue:the-anthem:bluesky`.
 *
 * A missing DID is resolved here rather than refused. Accepting is the moment
 * the row is committed to, and the harvest run that proposed it may simply
 * have been throttled — the first run recorded no DID for @garbage.com and
 * @thecure.com, both of which exist. Re-asking one question at review time is
 * cheaper than re-running a twenty-minute crawl.
 */
async function acceptNamed(
  keys: string[],
  worksheet: Worksheet,
  file: HandlesFile
): Promise<{ added: number; missing: string[]; unresolved: string[] }> {
  const missing: string[] = [];
  const unresolved: string[] = [];
  let added = 0;

  for (const key of keys) {
    const [kind, slug, channel] = key.split(":");
    const proposal = worksheet.proposals.find(
      (p) => p.kind === kind && p.slug === slug && p.channel === channel
    );
    if (!proposal) {
      missing.push(key);
      continue;
    }
    if (proposal.channel === "bluesky" && !proposal.did) {
      const did = await resolveHandle(proposal.handle);
      await sleep(300);
      if (!did) {
        unresolved.push(`${key} (@${proposal.handle} does not resolve)`);
        continue;
      }
      proposal.did = did;
      console.log(`   resolved @${proposal.handle} → ${did}`);
    }
    if (accept(proposal, file)) added++;
    else unresolved.push(`${key} (blocked, or no DID)`);
  }
  return { added, missing, unresolved };
}

/**
 * Re-resolve every stored DID and report renames. Reports only — it never
 * rewrites a row.
 *
 * A changed handle is ambiguous in the one direction that matters: it looks
 * identical whether the artist rebranded or the account was transferred to
 * somebody else. Auto-updating would quietly follow it into the second case,
 * which is precisely when the archive should stop mentioning it.
 */
async function verify(file: HandlesFile): Promise<number> {
  let drift = 0;
  const buckets: Array<[EntityKind, Record<string, Partial<Record<Channel, { handle: string; did?: string }>>>]> = [
    ["artist", file.artists],
    ["venue", file.venues],
  ];
  for (const [kind, bucket] of buckets) {
    for (const [slug, channels] of Object.entries(bucket)) {
      const record = channels.bluesky;
      if (!record?.did) continue;
      const current = await resolveDid(record.did);
      await sleep(250);
      if (current === null) {
        drift++;
        console.log(`   ⚠️  ${kind} ${slug}: DID ${record.did} no longer resolves — account gone?`);
      } else if (current !== record.handle) {
        drift++;
        console.log(`   ⚠️  ${kind} ${slug}: @${record.handle} is now @${current} — confirm before re-verifying`);
      }
    }
  }
  return drift;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);

function value(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const next = args[index + 1];
  // A flag present with no value is an operator mistake, not an empty list —
  // `--accept --dry-run` must not quietly accept nothing and report success.
  if (next === undefined || next.startsWith("--")) {
    throw new Error(`--${name} requires a value`);
  }
  return next;
}

function loadWorksheet(): Worksheet {
  if (!existsSync(WORKSHEET_PATH)) {
    console.error(`❌ No worksheet at ${WORKSHEET_PATH}. Run the harvest first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(WORKSHEET_PATH, "utf8")) as Worksheet;
}

function save(file: HandlesFile): void {
  file.updatedAt = new Date().toISOString();
  writeFileSync(HANDLES_PATH, `${JSON.stringify(file, null, 2)}\n`);
}

async function main(): Promise<void> {
  const file = loadHandles();

  const accepting = value("accept");
  if (accepting !== undefined) {
    const keys = accepting.split(",").map((k) => k.trim()).filter(Boolean);
    const { added, missing, unresolved } = await acceptNamed(keys, loadWorksheet(), file);
    save(file);
    console.log(`✅ Accepted ${added} reviewed row(s) into ${HANDLES_PATH}`);
    for (const key of missing) console.log(`   ⚠️  no such proposal: ${key}`);
    for (const key of unresolved) console.log(`   ⚠️  not written: ${key}`);
    return;
  }

  if (flag("verify")) {
    console.log("🔍 Re-resolving stored Bluesky DIDs\n");
    const drift = await verify(file);
    console.log(drift ? `\n${drift} row(s) need a look.` : "\n✅ No drift.");
    return;
  }

  if (flag("promote")) {
    const { added, skipped } = promote(loadWorksheet(), file);
    save(file);
    console.log(`✅ Promoted ${added} self-proving row(s) into ${HANDLES_PATH}`);
    console.log(`   ${skipped} row(s) left in the worksheet for review — promotion is only ever automatic for site-domain.`);
    return;
  }

  const wantArtists = flag("artists") || !flag("venues");
  const wantVenues = flag("venues") || !flag("artists");

  const previous = existsSync(WORKSHEET_PATH)
    ? (JSON.parse(readFileSync(WORKSHEET_PATH, "utf8")) as Worksheet)
    : undefined;

  const everything = [
    ...(wantArtists ? artistTargets() : []),
    ...(wantVenues ? venueTargets() : []),
  ];

  // `--new-only` is the mode a scheduled run uses: entities the archive has
  // gained since the last harvest, and nothing else. The predicate lives in
  // handles.ts, next to the data model it reasons about.
  const newOnly = flag("new-only");
  const recheckDays = Number(value("recheck") ?? NaN);
  const live = loadHandles();

  const targets = newOnly
    ? everything.filter((t) =>
        needsHarvest(t.kind, t.slug, live, previous?.attempted ?? {}, { recheckDays })
      )
    : everything;

  if (!targets.length) {
    console.log("✅ Nothing new to harvest — every artist and venue has been looked at.");
    return;
  }

  console.log(
    newOnly
      ? `🔎 Harvesting ${targets.length} new entit${targets.length === 1 ? "y" : "ies"} of ${everything.length}`
      : `🔎 Harvesting handles for ${targets.length} entities`
  );
  console.log("   MusicBrainz is rate-limited to 1 req/sec, so this takes a while.\n");

  const proposals: Proposal[] = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    proposals.push(...(await harvestOne(target)));
    if (i % 25 === 0 && targets.length > 25) console.log(`   … ${i}/${targets.length}`);
  }

  proposals.push(...(await harvestWikidata(targets)));

  // An incremental run must not discard what earlier runs proposed. Rows for
  // the entities crawled this time are replaced; every other row stands.
  const crawled = new Set(targets.map((t) => attemptKey(t.kind, t.slug)));
  if (previous) {
    proposals.push(
      ...previous.proposals.filter((p) => !crawled.has(attemptKey(p.kind, p.slug)))
    );
  }

  // MusicBrainz and Wikidata frequently carry the same account. Keep the
  // first, which is MusicBrainz — not because it is more trustworthy but
  // because it is the one that resolved a DID during the artist pass.
  const deduped: Proposal[] = [];
  const seen = new Set<string>();
  for (const p of proposals) {
    const key = `${p.kind}:${p.slug}:${p.channel}:${p.handle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  proposals.length = 0;
  proposals.push(...deduped);

  const withProposals = new Set(proposals.map((p) => attemptKey(p.kind, p.slug)));

  // Recorded for every entity crawled, including the ones that produced
  // nothing. The misses are the whole point — see the note on `attempted`.
  const attempted = { ...(previous?.attempted ?? {}) };
  for (const t of targets) attempted[attemptKey(t.kind, t.slug)] = today();

  const worksheet: Worksheet = {
    version: 1,
    generatedAt: new Date().toISOString(),
    proposals,
    unresolved: everything
      .filter((t) => attempted[attemptKey(t.kind, t.slug)])
      .filter((t) => !withProposals.has(attemptKey(t.kind, t.slug)))
      .map((t) => ({ kind: t.kind, slug: t.slug, name: t.name })),
    attempted,
  };

  writeFileSync(WORKSHEET_PATH, `${JSON.stringify(worksheet, null, 2)}\n`);

  const byEvidence: Record<string, number> = {};
  for (const p of proposals) byEvidence[p.evidence] = (byEvidence[p.evidence] ?? 0) + 1;

  console.log(`\n📝 ${WORKSHEET_PATH}`);
  console.log(`   ${proposals.length} proposal(s) across ${withProposals.size} entities`);
  for (const [evidence, count] of Object.entries(byEvidence)) {
    console.log(`     ${evidence.padEnd(14)} ${count}`);
  }
  console.log(`   ${worksheet.unresolved.length} entities with no candidate — normal, and the majority.`);
  console.log("\n   Nothing here posts. Review, then --promote for the site-domain rows.");
}

main().catch((err) => {
  // A bad flag is an operator mistake, not a bug: one line, not a stack trace.
  console.error(`\n❌ ${err.message ?? err}`);
  process.exit(1);
});
