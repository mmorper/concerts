#!/usr/bin/env node
// Fetch setlists for the 8 Social Distortion shows from setlist.fm
// Output: video/assets/setlists-sd.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets", "setlists-sd.json");
const ENV_PATH = path.resolve(ROOT, "..", ".env");

// Load API key from .env
const env = await fs.readFile(ENV_PATH, "utf8");
const API_KEY = env.match(/VITE_SETLISTFM_API_KEY=([^\s#]+)/)?.[1];
if (!API_KEY) throw new Error("No VITE_SETLISTFM_API_KEY in .env");

const shows = [
  { year: 1990, date: "1990-09-13", venue: "Cal State Fullerton",       city: "Fullerton" },
  { year: 2005, date: "2005-03-23", venue: "Hard Rock Hotel Las Vegas", city: "Las Vegas" },
  { year: 2010, date: "2010-10-26", venue: "9:30 Club",                 city: "Washington" },
  { year: 2012, date: "2012-11-06", venue: "9:30 Club",                 city: "Washington" },
  { year: 2015, date: "2015-08-25", venue: "The Fillmore Silver Spring", city: "Silver Spring" },
  { year: 2018, date: "2018-10-28", venue: "Huntington State Beach",    city: "Huntington Beach" },
  { year: 2022, date: "2022-12-08", venue: "House of Blues Anaheim",    city: "Anaheim" },
  { year: 2024, date: "2024-12-05", venue: "The Belasco",               city: "Los Angeles" },
];

function toApiDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

async function fetchSetlist(show) {
  const url = new URL("https://api.setlist.fm/rest/1.0/search/setlists");
  url.searchParams.set("artistName", "Social Distortion");
  url.searchParams.set("date", toApiDate(show.date));

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "x-api-key": API_KEY,
      "User-Agent": "morperhaus-concerts-pilot/1.0",
    },
  });
  if (!res.ok) {
    console.warn(`  ✗ ${show.date}: HTTP ${res.status}`);
    return { show, setlist: null, songs: [] };
  }
  const data = await res.json();
  const candidates = data.setlist || [];
  // Pick setlist that best matches venue
  let best = null;
  for (const sl of candidates) {
    const venueName = (sl.venue?.name || "").toLowerCase();
    const showVenue = show.venue.toLowerCase();
    if (venueName.includes(showVenue.split(" ")[0]) || showVenue.includes(venueName.split(" ")[0])) {
      best = sl; break;
    }
  }
  best = best || candidates[0] || null;
  if (!best) { console.warn(`  ✗ ${show.date}: no setlists found`); return { show, setlist: null, songs: [] }; }
  // Flatten songs across sets + encores
  const songs = [];
  for (const set of (best.sets?.set || [])) {
    const isEncore = !!set.encore;
    for (const song of (set.song || [])) {
      songs.push({
        name: song.name || "[Unknown]",
        cover: song.cover?.name || null,
        encore: isEncore,
      });
    }
  }
  console.log(`  ✓ ${show.date} @ ${best.venue?.name}: ${songs.length} songs`);
  return { show, setlistId: best.id, venue: best.venue?.name, songs };
}

const results = [];
for (const show of shows) {
  const r = await fetchSetlist(show);
  results.push(r);
  // Rate limit: 1 request per ~700ms (setlist.fm is 2 req/sec max)
  await new Promise(r => setTimeout(r, 800));
}

// Analyze cross-show song frequency
const songFreq = new Map();
for (const r of results) {
  for (const s of r.songs) {
    const k = s.name.toLowerCase().trim();
    if (!songFreq.has(k)) songFreq.set(k, { name: s.name, count: 0, shows: [] });
    const entry = songFreq.get(k);
    entry.count++;
    entry.shows.push(r.show.year);
  }
}
const allSongs = Array.from(songFreq.values()).sort((a, b) => b.count - a.count);
const coreRepertoire = allSongs.filter(s => s.count >= 5);
const threadSongs = allSongs.filter(s => s.count >= 7);

const out = {
  generatedAt: new Date().toISOString(),
  shows: results,
  analysis: {
    totalShows: results.filter(r => r.songs.length > 0).length,
    totalUniqueSongs: allSongs.length,
    threadSongs,     // appeared in 7+ shows
    coreRepertoire,  // appeared in 5+ shows
    allSongs,
  },
};

await fs.writeFile(OUT, JSON.stringify(out, null, 2));
console.log(`\nWrote ${OUT}`);
console.log(`Total shows with data: ${out.analysis.totalShows}/8`);
console.log(`Thread songs (7+ shows): ${threadSongs.map(s => s.name).join(", ") || "(none)"}`);
console.log(`Core repertoire (5+ shows): ${coreRepertoire.map(s => s.name).join(", ") || "(none)"}`);
