/**
 * `npm run syndicate:preview [slug]` — exactly what would go out, before anything goes out.
 *
 * 🔴 WHY THIS EXISTS. `--dry-run` printed `[dry-run] bluesky ← some-slug` and nothing else.
 * That answers "would it fire", which was never the question worth asking. The question is
 * what the post would SAY and what the picture would LOOK like, and until now the only way
 * to find out was to post it.
 *
 * Everything here is the real path. The payload is `buildPayload`, the card is `renderCard`,
 * and the text comes from the adapters' own composers — `composeBlueskyText` and
 * `composeMastodonStatus`, the same functions the live post calls. Nothing is re-implemented
 * for display, because a preview that composes its own text is a preview of itself.
 *
 * NOTHING IS SENT. No adapter is constructed, no credential is read, the ledger is not
 * touched, and the pause switch is irrelevant because there is no code path here that posts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { buildPayload, ROOT, type PayloadSources } from "./payload.ts";
import { FORMATS, renderCard, type RenderSources } from "./render-card.ts";
import { composeBlueskyText } from "./adapters/bluesky.ts";
import { composeMastodonStatus, mastodonWeight } from "./adapters/mastodon.ts";
import { CHANNEL_LIMITS } from "./budgets.ts";
import { graphemeLength } from "./text.ts";
import type { LinerNotesData, LinerNotesPost } from "../../src/types/liner-notes.ts";

const DIM = "\x1b[2m", BOLD = "\x1b[1m", OFF = "\x1b[0m";
const GREEN = "\x1b[32m", RED = "\x1b[31m", CYAN = "\x1b[36m";

const load = <T,>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;

/** A limit that is met, or one that is not — said plainly rather than as a raw number. */
function budget(label: string, used: number, max: number): string {
  const ok = used <= max;
  const bar = `${used}/${max}`;
  return `${ok ? GREEN + "✓" : RED + "✗"} ${label.padEnd(9)} ${bar.padEnd(9)}${OFF}` +
    (ok ? `${DIM} ${max - used} to spare${OFF}` : `${RED} OVER by ${used - max}${OFF}`);
}

function block(text: string): string {
  return text.split("\n").map((l) => `    ${DIM}│${OFF} ${l}`).join("\n");
}

async function main() {
  const slug = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const notes = load<LinerNotesData>("public/data/liner-notes.json");

  const sources = {
    concerts: load<{ concerts: unknown[] }>("public/data/concerts.json").concerts,
    artistsMetadata: load("public/data/artists-metadata.json"),
    venuesMetadata: load("public/data/venues-metadata.json"),
    artistsTopTracks: load("public/data/artists-top-tracks.json"),
    mediaIndex: load("public/data/media-index.json"),
    // The card does not exist yet — it is drawn below, exactly as the live run draws it.
    cardExists: () => true,
  } as unknown as PayloadSources & RenderSources;

  const chosen: LinerNotesPost[] = slug
    ? notes.posts.filter((p) => p.slug === slug)
    : notes.posts.slice(0, 1);
  if (!chosen.length) {
    console.error(`\n  no post with slug "${slug}"\n`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true });
  try {
    for (const post of chosen) {
      const payload = buildPayload(post, sources);
      console.log(`\n${BOLD}${post.slug}${OFF}`);
      console.log(`${DIM}${"─".repeat(74)}${OFF}`);

      if (!payload.eligible) {
        console.log(`  ${RED}WOULD NOT POST${OFF}`);
        for (const r of payload.ineligibleReasons) console.log(`    · ${r}`);
        continue;
      }

      const card = await renderCard(post, sources, browser, FORMATS.wide);
      console.log(`  ${CYAN}THE PICTURE${OFF}`);
      console.log(`    ${card.path}`);
      console.log(`    ${DIM}1200×630 · ${(card.bytes / 1024).toFixed(0)} KB at q${card.quality} · ` +
        `tier ${card.tier}${card.tier === 1 ? " (yours)" : " (sourced)"}${card.byline ? ` · ${card.byline}` : " · no byline"}${OFF}`);
      console.log(`    ${DIM}alt: ${payload.media.find((m) => m.role === "card")?.alt ?? "(none)"}${OFF}`);

      const bsky = composeBlueskyText(payload);
      console.log(`\n  ${CYAN}BLUESKY${OFF}   ${budget("graphemes", graphemeLength(bsky.text), CHANNEL_LIMITS.bluesky)}`);
      console.log(block(bsky.text));

      const masto = composeMastodonStatus(payload);
      console.log(`\n  ${CYAN}MASTODON${OFF}  ${budget("weight", mastodonWeight(masto), CHANNEL_LIMITS.mastodon)}`);
      console.log(block(masto));
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${DIM}  Nothing was sent. Open the file above to see the card.${OFF}\n`);
}

main().catch((e) => {
  console.error(`\n  ✗ ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
