#!/usr/bin/env node
// Fetch all assets for Phase 2 compositions into video/assets/.
// Deterministic: writes only when the file is missing or size differs.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets");
const DATA = path.resolve(ROOT, "..", "public", "data");

const artistsMeta = JSON.parse(await fs.readFile(path.join(DATA, "artists-metadata.json"), "utf8"));
const topTracks = JSON.parse(await fs.readFile(path.join(DATA, "artists-top-tracks.json"), "utf8"));
const venuesMeta = JSON.parse(await fs.readFile(path.join(DATA, "venues-metadata.json"), "utf8"));

const BILL_KEYS = [
  "social-distortion",
  "bad-religion",
  "the-offspring",
  "pennywise",
  "suicidal-tendencies",
  "voodoo-glow-skulls",
  "t-s-o-l",
  "black-rebel-motorcycle-club",
  "snuff",
  "fear",
  "mad-caddies",
  "rancid",
  "aaron-lee-tasjan",
  "the-interrupters",
];

const VENUE_KEYS = [
  "cal-state-fullerton",
  "hard-rock-hotel-las-vegas",
  "9-30-club",
  "the-fillmore-silver-spring",
  "huntington-state-beach",
  "house-of-blues-anaheim",
  "the-belasco",
];

const tasks = [];

for (const k of BILL_KEYS) {
  const a = artistsMeta[k];
  if (!a?.image) { console.warn("no image for", k); continue; }
  tasks.push({ url: a.image, out: `artist-${k}.jpg` });
}

// SD albums — pick first occurrence of each unique albumName
const sd = topTracks["social-distortion"];
if (sd?.tracks) {
  const seen = new Set();
  for (const tr of sd.tracks) {
    if (!tr.albumName || seen.has(tr.albumName)) continue;
    seen.add(tr.albumName);
    const slug = tr.albumName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    // Upgrade to 1000x1000 variant
    const art = (tr.albumArt || "").replace("100x100bb", "1000x1000bb");
    if (art) tasks.push({ url: art, out: `album-${slug}.jpg` });
  }
}

for (const k of VENUE_KEYS) {
  const v = venuesMeta[k];
  const url = v?.photoUrls?.medium || v?.photoUrls?.thumbnail;
  if (!url) { console.warn("no venue photo for", k); continue; }
  tasks.push({ url, out: `venue-${k}.jpg` });
}

await fs.mkdir(OUT, { recursive: true });

let fetched = 0;
let skipped = 0;
for (const t of tasks) {
  const outPath = path.join(OUT, t.out);
  try {
    const st = await fs.stat(outPath);
    if (st.size > 1024) { skipped++; continue; }
  } catch {}
  try {
    const res = await fetch(t.url);
    if (!res.ok) { console.warn("fetch failed", t.url, res.status); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outPath, buf);
    fetched++;
    console.log("fetched", t.out, `${buf.length} bytes`);
  } catch (e) {
    console.warn("error fetching", t.url, e.message);
  }
}

console.log(`\nDone. fetched=${fetched} skipped=${skipped} total=${tasks.length}`);

// Write a manifest for the compositions to consume
const manifest = {
  generatedAt: new Date().toISOString(),
  artists: BILL_KEYS.map(k => {
    const a = artistsMeta[k];
    return {
      key: k,
      name: a?.name || k,
      image: `assets/artist-${k}.jpg`,
      hasImage: !!a?.image,
    };
  }),
  albums: Array.from((() => {
    const s = new Map();
    if (sd?.tracks) {
      for (const tr of sd.tracks) {
        if (!tr.albumName || s.has(tr.albumName)) continue;
        const slug = tr.albumName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        s.set(tr.albumName, {
          key: slug,
          name: tr.albumName,
          featuredTrack: tr.name,
          image: `assets/album-${slug}.jpg`,
          year: tr.releaseDate ? tr.releaseDate.slice(0, 4) : null,
        });
      }
    }
    return s.values();
  })()),
  venues: VENUE_KEYS.map(k => {
    const v = venuesMeta[k];
    return {
      key: k,
      name: v?.name || k,
      city: v?.city,
      state: v?.state,
      lat: v?.location?.lat,
      lng: v?.location?.lng,
      image: `assets/venue-${k}.jpg`,
    };
  }),
  shows: [
    { year: 1990, date: "1990-09-13", dayOfWeek: "Thursday", venueKey: "cal-state-fullerton" },
    { year: 2005, date: "2005-03-23", dayOfWeek: "Wednesday", venueKey: "hard-rock-hotel-las-vegas" },
    { year: 2010, date: "2010-10-26", dayOfWeek: "Tuesday", venueKey: "9-30-club" },
    { year: 2012, date: "2012-11-06", dayOfWeek: "Tuesday", venueKey: "9-30-club" },
    { year: 2015, date: "2015-08-25", dayOfWeek: "Tuesday", venueKey: "the-fillmore-silver-spring" },
    { year: 2018, date: "2018-10-28", dayOfWeek: "Sunday", venueKey: "huntington-state-beach" },
    { year: 2022, date: "2022-12-08", dayOfWeek: "Thursday", venueKey: "house-of-blues-anaheim" },
    { year: 2024, date: "2024-12-05", dayOfWeek: "Thursday", venueKey: "the-belasco" },
  ],
};

await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("wrote manifest.json");
