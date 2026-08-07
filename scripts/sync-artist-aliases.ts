/**
 * Publish the hand-maintained artist alias map to public/data/ (#227 Q4).
 *
 * `data/artist-aliases.json` is the source of truth and is edited by hand. The
 * SPA fetches it at runtime and the MCP Worker reads it from the live site via
 * DATA_BASE_URL, so both need it served — but neither should be the thing that
 * defines it. This copies source → published, and is wired into build-data so
 * the two cannot drift.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "data", "artist-aliases.json");
const PUBLISHED = join(ROOT, "public", "data", "artist-aliases.json");

export function syncArtistAliases(): void {
  if (!existsSync(SOURCE)) {
    console.warn("⚠️  data/artist-aliases.json missing — nothing to publish");
    return;
  }

  const raw = readFileSync(SOURCE, "utf8");
  const parsed = JSON.parse(raw); // fail loudly here rather than in a browser

  const sameAct = parsed.sameAct?.length ?? 0;
  const sharesMember = parsed.sharesMember?.length ?? 0;
  const discographyKeys = parsed.discographyKeys?.length ?? 0;

  // Drop the $comment block — it's authoring guidance, not payload, and it is
  // most of the file's bytes.
  const { $schema: _schema, $comment: _comment, ...payload } = parsed;
  writeFileSync(PUBLISHED, JSON.stringify(payload, null, 2) + "\n");

  console.log(
    `   ✓ public/data/artist-aliases.json (${sameAct} same-act, ${sharesMember} shares-member, ${discographyKeys} discography-key)`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncArtistAliases();
}
