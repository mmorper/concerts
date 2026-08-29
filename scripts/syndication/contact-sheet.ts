#!/usr/bin/env tsx
/**
 * `npm run contact-sheet` — proof every pending post before it goes out.
 *
 * Usage:
 *   npm run contact-sheet                  every post that has not been posted
 *   npm run contact-sheet -- --limit 10    the first ten
 *   npm run contact-sheet -- --slug <slug> one post
 *   npm run contact-sheet -- --no-render   reuse whatever is in .renditions/
 *
 * ## Why this exists
 *
 * `--dry-run` prints payloads to a terminal, which proves the pipeline runs and
 * proves nothing about whether the post is any good. The things that go wrong
 * are visual and textual at once: a hook that overflows its box, a press shot
 * that is the wrong band, a caption that reads fine in isolation and badly
 * under the image, a mention pointing at a stranger. None of that is legible in
 * a JSON dump, and all of it is obvious on a page.
 *
 * So this renders **what the reader will actually see** — the card, the caption,
 * the shortened link, the mention, the tags — per channel, for every post still
 * in the queue. It is the last human gate before an unattended cron starts
 * publishing.
 *
 * ## It composes, it never invents
 *
 * Every string here comes from the same functions the adapters call:
 * `composeBlueskyText` and `composeMastodonStatus`. Re-implementing the
 * formatting for display would produce a proof sheet that agrees with itself
 * and disagrees with production, which is worse than no proof sheet — the
 * reviewer would sign off on something that was never going to ship.
 *
 * ## Relationship to `syndicate:preview`
 *
 * `preview.ts` answers "what would the next run post", one post at a time, in a
 * terminal. This answers "what is queued behind it", all of it, as a page you
 * can scroll. They share the archive loader and both call the adapters' own
 * composers, so the two cannot disagree about what a post says — only about how
 * many they show and where.
 *
 * ## Output
 *
 * `.renditions/contact-sheet.html`, alongside the cards it references.
 * Gitignored, like every rendition: it is a pure function of the data and the
 * renderer, so committing it would only create something to go stale.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import puppeteer from "puppeteer";

import { composeBlueskyText } from "./adapters/bluesky.ts";
import { composeMastodonStatus, mastodonWeight } from "./adapters/mastodon.ts";
import { CHANNEL_LIMITS } from "./budgets.ts";
import { graphemeLength, type Facet } from "./facets.ts";
import { buildOnThisDayPayload, buildPayload, ROOT } from "./payload.ts";
import { loadArchive } from "./run.ts";
import { withUtm } from "./utm.ts";
import type { SyndicationPayload } from "./types.ts";

const OUT_DIR = join(ROOT, ".renditions");
const OUT_PATH = join(OUT_DIR, "contact-sheet.html");

const load = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const value = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? undefined : args[i + 1];
};

// ── Text, marked up exactly as the facets describe it ────────────────────────

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Rebuild the post text as HTML, colouring each span the facets claim.
 *
 * Slicing is done on the **UTF-8 buffer**, because that is the unit
 * `facet.index` is expressed in. Slicing the string instead would be the exact
 * bug facets.ts exists to prevent, reintroduced in the tool meant to catch it —
 * and it would look right until the first artist with a diacritic.
 */
function markUpBluesky(text: string, facets: Facet[]): string {
  const bytes = Buffer.from(text, "utf8");
  const ordered = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);
  let cursor = 0;
  let html = "";

  for (const facet of ordered) {
    html += escape(bytes.subarray(cursor, facet.index.byteStart).toString("utf8"));
    const slice = escape(bytes.subarray(facet.index.byteStart, facet.index.byteEnd).toString("utf8"));
    const feature = facet.features[0];
    if (feature.$type === "app.bsky.richtext.facet#link") {
      html += `<a class="f link" href="${escape(feature.uri)}" title="${escape(feature.uri)}">${slice}</a>`;
    } else if (feature.$type === "app.bsky.richtext.facet#mention") {
      html += `<a class="f mention" href="https://bsky.app/profile/${escape(feature.did)}" title="${escape(feature.did)}">${slice}</a>`;
    } else {
      html += `<span class="f tag">${slice}</span>`;
    }
    cursor = facet.index.byteEnd;
  }
  html += escape(bytes.subarray(cursor).toString("utf8"));
  return html.replace(/\n/g, "<br>");
}

/**
 * Mastodon has no facets — the server linkifies, and it hides most of the URL.
 *
 * A Mastodon client renders a long link in three spans: the scheme `invisible`,
 * a middle portion shown, and the tail `invisible` behind an ellipsis. Every
 * UTM parameter we append lands in that hidden tail, so a status carrying a
 * 121-character permalink reads as `concerts.morperhaus.org/liner-notes/…`.
 *
 * Printing the raw URL here would make the post look far worse on the proof
 * sheet than it does in a client, and a reviewer would go rewrite a caption
 * that was never the problem. That is the same failure as re-implementing the
 * formatting: a sheet that disagrees with production.
 *
 * The 30-character split is where Mastodon's own front end truncates.
 */
const MASTODON_VISIBLE = 30;

function markUpMastodon(status: string): string {
  return escape(status)
    .replace(/(https?:\/\/\S+)/g, (url) => {
      const bare = url.replace(/^https?:\/\//, "");
      const shown = bare.length <= MASTODON_VISIBLE ? bare : bare.slice(0, MASTODON_VISIBLE);
      const hidden = bare.slice(shown.length);
      return (
        `<a class="f link" href="${url}" title="${url}">${shown}` +
        (hidden ? `<span class="invisible">…</span>` : "") +
        `</a>`
      );
    })
    .replace(/(^|\s)(#[A-Za-z0-9_]+)/g, '$1<span class="f tag">$2</span>')
    .replace(/(^|\s)(@[A-Za-z0-9_.-]+)/g, '$1<span class="f mention">$2</span>')
    .replace(/\n/g, "<br>");
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Card {
  payload: SyndicationPayload;
  image?: string;
  renderError?: string;
}

function meter(used: number, limit: number): string {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const state = used > limit ? "over" : pct > 90 ? "tight" : "ok";
  return `<div class="meter ${state}"><i style="width:${pct}%"></i></div>
          <span class="count ${state}">${used} / ${limit}</span>`;
}

function section(card: Card): string {
  const { payload } = card;
  const bsky = composeBlueskyText(payload);
  const mastodon = composeMastodonStatus(payload);
  const asset = payload.media.find((m) => m.role === "card");
  const bskyLen = graphemeLength(bsky.text);
  const mastLen = mastodonWeight(mastodon);

  const mention = bsky.facets
    .flatMap((f) => f.features)
    .find((f) => f.$type === "app.bsky.richtext.facet#mention");

  const provenance = asset
    ? `<span class="pill tier${asset.tier}">tier ${asset.tier}</span>
       <span class="pill">${escape(asset.source)}</span>
       ${asset.byline ? `<span class="pill byline">${escape(asset.byline)}</span>` : ""}
       ${asset.focalPoint ? `<span class="pill">focal ${asset.focalPoint.x}, ${asset.focalPoint.y}</span>` : ""}`
    : `<span class="pill bad">no card</span>`;

  return `
<article class="post${payload.eligible ? "" : " blocked"}">
  <header>
    <h2>${escape(payload.hook || payload.slug)}</h2>
    <p class="credit">${escape(payload.credit.artists.join(", "))} · ${escape(payload.credit.venue)}, ${escape(payload.credit.city)}${payload.credit.region ? ", " + escape(payload.credit.region) : ""} · ${escape(payload.credit.date)}</p>
    <p class="meta">
      <span class="pill kind">${payload.kind}</span>
      ${provenance}
      ${mention ? `<span class="pill mention">@mention</span>` : `<span class="pill quiet">hashtag only</span>`}
    </p>
    ${payload.eligible ? "" : `<p class="reasons">⛔ will not post — ${payload.ineligibleReasons.map(escape).join("; ")}</p>`}
  </header>

  <div class="body">
    <figure>
      ${card.image
        ? `<img src="${escape(card.image)}" alt="${escape(asset?.alt ?? "")}" loading="lazy">`
        : `<div class="missing">${escape(card.renderError ?? "not rendered")}</div>`}
      <figcaption>${escape(asset?.alt ?? "no alt text")}</figcaption>
    </figure>

    <div class="channels">
      <section class="channel">
        <h3>Bluesky</h3>
        <div class="post-text">${markUpBluesky(bsky.text, bsky.facets)}</div>
        <div class="budget">${meter(bskyLen, CHANNEL_LIMITS.bluesky)}<span class="unit">graphemes</span></div>
        <p class="target">click target → ${escape(withUtm(payload.url, "bluesky", payload.kind))}</p>
      </section>

      <section class="channel">
        <h3>Mastodon</h3>
        <div class="post-text">${markUpMastodon(mastodon)}</div>
        <div class="budget">${meter(mastLen, CHANNEL_LIMITS.mastodon)}<span class="unit">weighted chars</span></div>
        <p class="target">click target → ${escape(withUtm(payload.url, "mastodon", payload.kind))}</p>
      </section>
    </div>
  </div>
</article>`;
}

function page(cards: Card[], generatedAt: string): string {
  const eligible = cards.filter((c) => c.payload.eligible).length;
  const withMention = cards.filter((c) =>
    composeBlueskyText(c.payload).facets.some((f) =>
      f.features.some((x) => x.$type === "app.bsky.richtext.facet#mention")
    )
  ).length;
  const tier1 = cards.filter((c) => c.payload.media.some((m) => m.tier === 1)).length;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pending posts — contact sheet</title>
<style>
  :root {
    --bg: #12101a; --panel: #1b1826; --line: #2e2940; --ink: #ece9f5;
    --dim: #9c95b5; --accent: #a78bfa; --link: #7dd3fc; --tag: #86efac;
    --warn: #fbbf24; --bad: #fb7185;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 15px/1.55 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: var(--dim); margin: 0 0 28px; }
  .totals { display: flex; gap: 10px; flex-wrap: wrap; margin: 0 0 32px; }
  .totals b { background: var(--panel); border: 1px solid var(--line); border-radius: 999px;
              padding: 6px 14px; font-weight: 500; font-size: 13px; }
  .totals b i { color: var(--accent); font-style: normal; font-weight: 700; }

  .post { background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
          padding: 22px; margin: 0 0 22px; }
  .post.blocked { border-color: var(--bad); }
  .post header h2 { font-size: 19px; margin: 0 0 4px; }
  .credit { color: var(--dim); margin: 0 0 10px; font-size: 13px; }
  .meta { display: flex; gap: 6px; flex-wrap: wrap; margin: 0 0 16px; }
  .pill { font-size: 11px; letter-spacing: .03em; text-transform: uppercase;
          border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; color: var(--dim); }
  .pill.tier1 { color: #12101a; background: var(--tag); border-color: var(--tag); font-weight: 700; }
  .pill.tier2 { color: var(--ink); }
  .pill.tier3 { color: var(--warn); border-color: var(--warn); }
  .pill.mention { color: var(--accent); border-color: var(--accent); }
  .pill.byline { color: var(--tag); border-color: var(--tag); text-transform: none; }
  .pill.bad { color: var(--bad); border-color: var(--bad); }
  .reasons { color: var(--bad); font-size: 13px; margin: 0 0 12px; }

  .body { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 24px; }
  @media (max-width: 860px) { .body { grid-template-columns: 1fr; } }
  figure { margin: 0; }
  figure img { width: 100%; border-radius: 10px; display: block; background: #000; }
  .missing { aspect-ratio: 1.91; display: grid; place-items: center; border-radius: 10px;
             border: 1px dashed var(--bad); color: var(--bad); font-size: 13px; text-align: center; padding: 12px; }
  figcaption { color: var(--dim); font-size: 12px; margin-top: 8px; }

  .channels { display: flex; flex-direction: column; gap: 18px; }
  .channel h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
                color: var(--dim); margin: 0 0 8px; }
  .post-text { background: #100e18; border: 1px solid var(--line); border-radius: 10px;
               padding: 14px; white-space: normal; word-break: break-word; }
  .f.link { color: var(--link); text-decoration: none; }
  .f.tag { color: var(--tag); }
  .f.mention { color: var(--accent); font-weight: 600; text-decoration: none; }
  .invisible { color: var(--dim); }
  .budget { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .meter { flex: 1; height: 5px; background: var(--line); border-radius: 999px; overflow: hidden; }
  .meter i { display: block; height: 100%; background: var(--tag); }
  .meter.tight i { background: var(--warn); }
  .meter.over i { background: var(--bad); }
  .count { font-size: 12px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .count.tight { color: var(--warn); } .count.over { color: var(--bad); }
  .unit { font-size: 11px; color: var(--dim); }
  .target { font-size: 11px; color: var(--dim); margin: 6px 0 0; word-break: break-all; }
</style>
</head><body><div class="wrap">
<h1>Pending posts</h1>
<p class="sub">Everything queued and not yet published. Generated ${escape(generatedAt)}.</p>
<div class="totals">
  <b><i>${cards.length}</i> posts</b>
  <b><i>${eligible}</i> will post</b>
  <b><i>${cards.length - eligible}</i> blocked</b>
  <b><i>${tier1}</i> on personal photography</b>
  <b><i>${withMention}</i> carry an @mention</b>
</div>
${cards.map(section).join("\n")}
</div></body></html>`;
}

// ── Selection and render ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  // The same loader the run uses. Re-reading the four JSON files here would
  // give the sheet its own idea of what the archive contains, which is the
  // failure this file's header warns about one level up.
  const { posts, onThisDay, sources: archiveSources } = loadArchive();
  const ledger = load<{ entries: Array<{ slug: string; status: string }> }>("data/syndication-log.json");

  // Pending means never published. A `seeded` row is the back catalogue waiting
  // its turn, which is exactly what wants proofing — so seeded posts are IN.
  //
  // Deliberately NOT `selectCandidates`: that answers "what would the next run
  // post", honouring the limit and the backlog opt-in, and the point here is to
  // see everything queued behind it.
  const published = new Set(
    ledger.entries.filter((e) => e.status !== "seeded").map((e) => e.slug)
  );

  const only = value("slug");
  const sources = {
    ...archiveSources,
    // Assume the card renders; this tool is about to render it.
    cardExists: () => true,
  };

  const payloads: SyndicationPayload[] = [];
  for (const post of posts) {
    if (only ? post.slug !== only : published.has(post.slug)) continue;
    payloads.push(buildPayload(post, sources));
  }
  for (const post of onThisDay) {
    if (only ? post.slug !== only : published.has(post.slug)) continue;
    payloads.push(buildOnThisDayPayload(post));
  }

  const limit = Number(value("limit") ?? NaN);
  const selected = Number.isFinite(limit) ? payloads.slice(0, limit) : payloads;

  if (!selected.length) {
    console.error("nothing pending to proof");
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const cards: Card[] = [];
  const shouldRender = !flag("no-render");
  const browser = shouldRender ? await puppeteer.launch({ headless: true }) : undefined;

  try {
    console.log(`📄 Proofing ${selected.length} pending post(s)\n`);
    for (let i = 0; i < selected.length; i++) {
      const payload = selected[i];
      const asset = payload.media.find((m) => m.role === "card");
      const card: Card = { payload };

      if (asset) {
        const absolute = join(ROOT, asset.path);
        // Committed cards (On This Day) are used as they are. Renditions are
        // drawn now, because they are drawn at post time and do not exist yet.
        if (!asset.path.startsWith(".renditions/") && existsSync(absolute)) {
          card.image = relativeToOut(asset.path);
        } else if (browser) {
          try {
            // The payload is everything the card needs, so this cannot draw
            // something other than what the adapters will post.
            const { renderCard, FORMATS } = await import("./render-card.ts");
            const r = await renderCard(payload, browser, FORMATS.wide);
            card.image = relativeToOut(r.path.replace(`${ROOT}/`, ""));
          } catch (err) {
            // A render that throws takes only its own card down. A contact
            // sheet missing one image is still worth reading; a crashed run is
            // not.
            card.renderError = (err as Error).message;
          }
        } else if (existsSync(absolute)) {
          card.image = relativeToOut(asset.path);
        } else {
          card.renderError = "no rendition on disk — drop --no-render";
        }
      }

      cards.push(card);
      const mark = card.image ? "✓" : "✗";
      console.log(`   ${mark} ${String(i + 1).padStart(3)}/${selected.length}  ${payload.slug}`);
    }
  } finally {
    await browser?.close();
  }

  writeFileSync(OUT_PATH, page(cards, new Date().toISOString()));
  console.log(`\n📄 ${OUT_PATH}`);
  console.log(`   open .renditions/contact-sheet.html`);
}

/** Images live beside the HTML, so paths are relative to `.renditions/`. */
function relativeToOut(repoRelative: string): string {
  return repoRelative.startsWith(".renditions/")
    ? repoRelative.slice(".renditions/".length)
    : `../${repoRelative}`;
}

main().catch((err) => {
  console.error(`\n❌ ${err.message ?? err}`);
  process.exit(1);
});
