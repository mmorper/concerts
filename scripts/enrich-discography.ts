import { MusicBrainzClient, Album } from './utils/musicbrainz-client'
import { createBackup } from './utils/backup'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

/**
 * Enrich artist discographies from MusicBrainz
 *
 * This script fetches comprehensive discography data (albums, release dates, cover art)
 * for all artists in the concert database. Data is cached for 90 days.
 *
 * Usage:
 *   npm run enrich:discography                        # Enrich new/stale artists only
 *   npm run enrich:discography -- --dry-run           # Preview without writing
 *   npm run enrich:discography -- --force             # Re-fetch all artists
 *   npm run enrich:discography -- --artist the-go-go-s --force
 *                                                     # Re-fetch ONE artist
 *
 * Output: public/data/discography.json
 */

dotenv.config()

interface ArtistMetadata {
  name: string
  normalizedName: string
  dataSource?: string
  source?: string
  fetchedAt: string
  [key: string]: any
}

interface ArtistDiscography {
  artistName: string
  normalizedName: string
  mbid: string | null
  fetchedAt: string
  cachedAt: string
  albumCount: number
  albums: Album[]
}

interface DiscographyFile {
  [normalizedArtistName: string]: ArtistDiscography
}

/**
 * MBIDs that MusicBrainz's own artist search gets wrong.
 *
 * This is an *enrichment input* — which MusicBrainz artist to fetch — not a
 * lookup concern, which is why it lives beside the fetch rather than in a data
 * file. Name-variance between our files is handled by scripts/utils/artist-key.ts,
 * and act identity by public/data/artist-aliases.json. Keep the three separate:
 * a general-purpose override map would absorb all of them and hide real bugs.
 *
 * Add an entry only when search returns a *different artist*, never to paper
 * over a thin-but-correct discography.
 *
 * Spec: docs/specs/future/global-discography-trajectory.md §2b
 */
const MBID_CORRECTIONS: Record<string, { mbid: string; note: string }> = {
  // Search resolved to "The Go-Go's (RCA Victor group)" — an unrelated act with
  // a single 1964 release, "Swim With The Go-Go's". That produced a fictitious
  // 47-year album-era gap on a marquee artist.
  //
  // Root cause: the correct record is spelled "Go\u2010Go's" with a TYPOGRAPHIC
  // hyphen (U+2010), so an ASCII-hyphen name search scores it below the wrong
  // one. This is the 1978 Belinda Carlisle band.
  'the-go-go-s': {
    mbid: 'eec163e4-a013-4af0-9641-c5b2df41fff7',
    note: 'ASCII-hyphen search matches the wrong act; correct record uses U+2010',
  },

  // The SAME defect as the Go-Go's above, and worth noticing that it recurred:
  // the correct record is "Re‐Flex" with a TYPOGRAPHIC hyphen (U+2010), so an
  // ASCII-hyphen search scores it below "The Reflex" — a French remixer, type
  // Person, still releasing (Million Streamers Vol.2, 2025). We held 25 of his
  // releases for a band that made two albums.
  //
  // This one was invisible to the existing mis-resolution heuristic in
  // validate-concerts.ts, which warns on a LOW release count: a wrong artist
  // with a healthy catalogue looks perfectly normal, and 25 > 2 (#275).
  //
  // Both spellings are pinned because the Google Sheet was corrected upstream
  // on 2026-08-10 — "The Reflex" becomes "Re-Flex" on the next refresh, and
  // whichever key the data carries must land on the same band (#300).
  'the-reflex': {
    mbid: 'd4bdc7e1-d287-4f88-b9c3-ad9f74964629',
    note: 'ASCII-hyphen search returns "The Reflex", a French remixer; correct record uses U+2010',
  },
  're-flex': {
    mbid: 'd4bdc7e1-d287-4f88-b9c3-ad9f74964629',
    note: 'post-rename key for the same band (#300)',
  },

  // ── The five that genuinely mis-resolve ────────────────────────────────────
  //
  // Found while auditing 25 artists that appeared to have no MusicBrainz ID.
  // TWENTY of those were not resolution failures at all — their records were
  // fetched correctly and filed under a normalised DISPLAY NAME instead of the
  // artist's slug, so nothing in the project could find them. That is fixed at
  // the loop above. Pinning them here would have hard-coded twenty MBIDs to
  // work around a one-line keying bug, which is precisely what the note at the
  // top of this table warns against.
  //
  // These five are the real thing: MusicBrainz answers, and answers wrong.

  // Search returns "O.M.D", a Ragga Dancehall act, at 60% similarity — below
  // the 0.8 bar, so it resolves to nothing rather than to the wrong band. The
  // archive's "OMD" is the Wirral synthpop group, whose record is filed under
  // the name spelled out in full and is unreachable from the initialism.
  'omd': {
    mbid: '6d072aa8-c851-49c5-92f9-cbca05f4bed9',
    note: 'initialism does not reach "Orchestral Manoeuvres in the Dark"; search finds a Ragga Dancehall act',
  },

  // "Haircut 100" scores 64% against "Haircut", a US punk band from Northport.
  // The correct record spells the number out — "Haircut One Hundred" — and a
  // digit never matches a word by edit distance.
  'haircut-100': {
    mbid: 'bbb94ad0-3bb7-42af-99cd-e92f5a42c4c5',
    note: 'MusicBrainz spells the number out as "Haircut One Hundred"',
  },

  // The best Latin-script match is "Worm Quartet" at 77%. The correct record is
  // filed under its Cyrillic name, Терем-квартет, which cannot be reached by
  // edit distance from a transliteration at any threshold.
  'terem-quartet': {
    mbid: 'a6b3b7c2-4b5b-4047-a206-8850a4f449b5',
    note: 'record is filed under the Cyrillic "Терем-квартет"; transliteration matches "Worm Quartet"',
  },

  // "The Polecats" scores 67% against "Polecats" — the definite article alone
  // is enough to miss the 0.8 bar on a nine-letter name. Same 1977 rockabilly
  // band, and the only Polecats MusicBrainz has.
  'the-polecats': {
    mbid: '663d6cd0-b275-41a4-a581-4bb3cb878eb9',
    note: 'leading "The" drops similarity to 67% against the correct record, "Polecats"',
  },

  // 🔴 This one was resolved to the WRONG ARTIST and cached, rather than left
  // empty. `artists-metadata.json` carries the display name "smcke" for this
  // act, which is itself upstream corruption — the archive's booking is Smoke
  // and Mirrors Sound System. Searching "smcke" finds an Australian solo artist
  // of that exact name at 100%, so every confidence check passed on a record
  // for a different person.
  //
  // Pinned rather than waiting on the upstream name fix, because the wrong
  // answer is live and scores perfectly. Fix the display name too and this
  // entry becomes redundant rather than wrong.
  'smoke-mirrors-sound-system': {
    mbid: '3074c329-4e06-41a4-9ce9-a1792449f0fa',
    note: 'display name is corrupted to "smcke", which matches an unrelated Australian artist at 100%',
  },
}

/**
 * Enrich artist discographies from MusicBrainz
 */
async function enrichDiscography(
  options: { dryRun?: boolean; force?: boolean; artist?: string } = {}
) {
  const artistFlagIndex = process.argv.indexOf('--artist')
  const {
    dryRun = process.argv.includes('--dry-run'),
    force = process.argv.includes('--force'),
    // Targeted re-fetch. Exists so an MBID_CORRECTIONS entry can be applied
    // without 257 MusicBrainz round-trips at 1 req/sec.
    artist = artistFlagIndex >= 0 ? process.argv[artistFlagIndex + 1] : undefined
  } = options

  console.log(`🎵 Enriching artist discographies from MusicBrainz...${dryRun ? ' (DRY RUN)' : ''}\n`)

  // Load artists metadata to get list of artists
  const artistsMetadataPath = join(process.cwd(), 'public', 'data', 'artists-metadata.json')
  if (!existsSync(artistsMetadataPath)) {
    console.error('❌ artists-metadata.json not found. Run "npm run build-data" first.')
    process.exit(1)
  }

  const artistsMetadata: Record<string, ArtistMetadata> = JSON.parse(
    readFileSync(artistsMetadataPath, 'utf-8')
  )

  // Get unique artists, KEEPING THE KEY.
  //
  // `Object.values()` threw away the slug and the loop below re-derived it with
  // `normalizeArtistName(artist.name)`, which is not the same string. A display
  // name does not round-trip: 23 of 257 artists normalise to something other
  // than their own key — "The Beach Boys" to `the-beach-boys` rather than
  // `beach-boys`, "Yazoo" to `yazoo` rather than `yaz`, "Run-D.M.C." to
  // `run-d-m-c` rather than `run-dmc`.
  //
  // The effect was invisible and total: the record was fetched correctly, the
  // albums were correct, and the whole thing was filed under a key nothing else
  // in the project ever looks up. 20 artists appeared to have no MusicBrainz ID
  // while their discography sat in the same file under a name-shaped key.
  //
  // Worse, it collided. `brian-setzer-68-comeback-special` and
  // `brian-setzer-and-the-nashvillians` are two distinct acts in the archive
  // and both normalise to `brian-setzer`, so one silently overwrote the other.
  const uniqueArtists = Object.entries(artistsMetadata)
  console.log(`Found ${uniqueArtists.length} unique artists\n`)

  // Load existing discography cache if available
  const discographyPath = join(process.cwd(), 'public', 'data', 'discography.json')
  let discography: DiscographyFile = {}
  if (existsSync(discographyPath)) {
    discography = JSON.parse(readFileSync(discographyPath, 'utf-8'))
    console.log(`Loaded ${Object.keys(discography).length} existing discography records\n`)
  }

  // Initialize MusicBrainz client
  const mbClient = new MusicBrainzClient()

  // Cache TTL: 90 days
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000

  let enriched = 0
  let skipped = 0
  let failed = 0

  const artistFilter = artist
  if (artistFilter) {
    console.log(`🎯 Restricted to a single artist: ${artistFilter}\n`)
  }

  for (const [normalized, artist] of uniqueArtists) {

    // --artist restricts the run to one slug (see the flag comment above)
    if (artistFilter && normalized !== artistFilter) {
      skipped++
      continue
    }

    // Skip mock data artists (no real metadata yet)
    const isMockData = artist.dataSource === 'mock' || artist.source === 'mock'
    if (isMockData) {
      skipped++
      continue
    }

    // Skip if already cached and not stale (unless --force)
    const existingData = discography[normalized]
    if (existingData && !force) {
      const age = Date.now() - new Date(existingData.cachedAt).getTime()
      if (age < NINETY_DAYS) {
        skipped++
        continue
      }
    }

    console.log(`Fetching: ${artist.name}`)

    try {
      // Search for artist MBID — unless we've recorded that the search is wrong
      const correction = MBID_CORRECTIONS[normalized]
      if (correction) {
        console.log(`  📌 Using corrected MBID (${correction.note})`)
      }
      const mbid = correction?.mbid ?? (await mbClient.searchArtist(artist.name))

      if (!mbid) {
        console.log(`  ⚠️  Not found in MusicBrainz`)

        // Store empty entry to avoid re-fetching
        discography[normalized] = {
          artistName: artist.name,
          normalizedName: normalized,
          mbid: null,
          albumCount: 0,
          albums: [],
          fetchedAt: new Date().toISOString(),
          cachedAt: new Date().toISOString()
        }

        failed++
        continue
      }

      console.log(`  ✅ Found MBID: ${mbid}`)

      // Fetch discography
      const albums = await mbClient.getDiscography(mbid, artist.name)

      console.log(`  ✅ Found ${albums.length} albums`)

      // Count albums with cover art
      const withCovers = albums.filter(a => a.coverAvailable).length
      console.log(`  ✅ ${withCovers}/${albums.length} albums have cover art`)

      // Store discography entry
      discography[normalized] = {
        artistName: artist.name,
        normalizedName: normalized,
        mbid,
        albumCount: albums.length,
        albums,
        fetchedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString()
      }

      enriched++
    } catch (error) {
      console.error(`  ❌ Error fetching ${artist.name}:`, error)
      failed++
    }

    console.log() // Blank line between artists
  }

  // Save discography
  if (dryRun) {
    console.log('=' .repeat(60))
    console.log('🔍 DRY RUN MODE - No files will be modified')
    console.log('=' .repeat(60))
    console.log(`\nWould write to: ${discographyPath}`)
    console.log(`File size: ${(JSON.stringify(discography, null, 2).length / 1024).toFixed(1)} KB`)
  } else {
    // Create backup before overwriting
    if (existsSync(discographyPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + 'T' +
                       new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0]
      createBackup(discographyPath, { maxBackups: 10, verbose: true })
      console.log(`📦 Backup created: discography.json.backup.${timestamp}\n`)
    }

    // Write new discography
    writeFileSync(discographyPath, JSON.stringify(discography, null, 2))
  }

  console.log(`📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched} artist discographies`)
  console.log(`   ⏭️  Skipped (cached): ${skipped} artist discographies`)
  console.log(`   ❌ Failed: ${failed} artist discographies`)

  if (dryRun) {
    console.log('\n💡 To apply these changes, run without --dry-run flag')
  } else {
    console.log(`\n💾 Saved to: ${discographyPath}`)
  }

  console.log(`\n🎉 Done!${dryRun ? ' (DRY RUN)' : ''}`)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  enrichDiscography()
}

export { enrichDiscography }
