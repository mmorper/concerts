#!/usr/bin/env node
// Build the Social Distortion 34 Years payload from the concerts archive.
// Running this re-derives payload.json from the source data — making v2
// videos a payload swap, not a rebuild.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');

const concerts = JSON.parse(
  fs.readFileSync(path.join(REPO, 'public/data/concerts.json'), 'utf-8')
).concerts;
const artists = JSON.parse(
  fs.readFileSync(path.join(REPO, 'public/data/artists-metadata.json'), 'utf-8')
);
const tracks = JSON.parse(
  fs.readFileSync(path.join(REPO, 'public/data/artists-top-tracks.json'), 'utf-8')
);

const ARTIST_SLUG = 'social-distortion';
const ARTIST_NAME = 'Social Distortion';
const FEATURED_TRACK = 'Ball and Chain';

const shows = concerts
  .filter(c => c.headlinerNormalized === ARTIST_SLUG)
  .sort((a, b) => a.date.localeCompare(b.date));

if (shows.length === 0) {
  console.error(`No shows found for ${ARTIST_SLUG}`);
  process.exit(1);
}

const artistEntry = Object.values(artists).find(
  a => a.name === ARTIST_NAME
);
const trackEntry = tracks[ARTIST_SLUG];
const featured = trackEntry?.tracks?.find(t => t.name === FEATURED_TRACK);

if (!artistEntry) throw new Error(`Artist metadata missing for ${ARTIST_NAME}`);
if (!featured) throw new Error(`Featured track "${FEATURED_TRACK}" not found`);

// Upgrade iTunes album-art URL from 100x100 to 1000x1000 for print-quality frames
const albumArt = featured.albumArt.replace(/\/\d+x\d+bb\./, '/1000x1000bb.');

const firstShow = shows[0];
const lastShow = shows[shows.length - 1];
const firstYear = firstShow.year;
const lastYear = lastShow.year;
const spanYears = lastYear - firstYear;

const payload = {
  template: 'the-thread',
  sourceLinerNoteUrl:
    'https://concerts.morperhaus.org/liner-notes/social-distortion-34-years-of-shows',
  sourceLinerNoteStatus: 'pilot-hypothetical',
  generatedAt: new Date().toISOString(),
  artist: {
    name: artistEntry.name,
    normalized: ARTIST_SLUG,
    image: artistEntry.image,
    imageLocal: 'assets/social-distortion-artist.jpg',
    formedYear: parseInt(artistEntry.formed, 10),
    genres: artistEntry.genres,
  },
  thread: {
    firstYear,
    lastYear,
    spanYears,
    showCount: shows.length,
    firstShow: {
      date: firstShow.date,
      venue: firstShow.venue,
      city: firstShow.cityState,
    },
    lastShow: {
      date: lastShow.date,
      venue: lastShow.venue,
      city: lastShow.cityState,
    },
    shows: shows.map(s => ({
      year: s.year,
      date: s.date,
      venue: s.venue,
      city: s.cityState,
      dayOfWeek: s.dayOfWeek,
    })),
  },
  featuredTrack: {
    name: featured.name,
    album: featured.albumName,
    albumArt,
    albumArtLocal: 'assets/social-distortion-album.jpg',
    year: firstYear,
    streamingUrl: featured.streamingUrl,
  },
  pullQuote: {
    text: 'Each one felt like checking in with an old friend who\u2019d weathered the same storms.',
    splitPoint: 'who\u2019d',
  },
  outro: {
    wordmark: 'morperhaus concerts',
    ctaUrl: 'concerts.morperhaus.org/liner-notes',
  },
};

const outPath = path.join(HERE, 'payload.json');
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
console.log(
  `Wrote ${outPath} — ${shows.length} shows, ${firstYear}\u2013${lastYear} (${spanYears}y span)`
);
