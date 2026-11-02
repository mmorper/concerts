#!/usr/bin/env tsx
/**
 * Generate Sitemap Script
 *
 * Creates sitemap.xml from concert data with all deep-linkable URLs:
 * - Homepage
 * - 5 scene navigation links
 * - 247+ artist deep links
 * - One show URL per act and night with a setlist or media, carrying that act's stills
 * - One URL per published clip, as a video entry
 * - 77+ venue deep links (2 scenes each)
 * - Changelog pages
 *
 * URLs sorted by concert count (most-attended first) for SEO priority.
 *
 * Run: npm run generate:sitemap
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildArtistAliasMap, canonicalArtist, EMPTY_ARTIST_ALIAS_MAP } from '../src/utils/artistAliases.ts'
import { mediaId, photoDeepLink, setlistDeepLink } from '../src/utils/deepLinks.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Concert {
  /** e.g. "concert-182" — used only to join against the setlist cache (#193) */
  id: string
  headliner?: string
  headlinerNormalized: string
  venue?: string
  venueNormalized: string
  cityState?: string
  date: string
}

interface ConcertsData {
  concerts: Concert[]
}

/** One row of media-index.json. Only the fields a sitemap entry reads. */
interface MediaAsset {
  kind: string
  url: string | null
  date: string
  artist: string | null
  artistNormalized: string | null
  subject: string
  duration?: number
  poster?: string | null
  song?: string | null
}

/** One act's page for one night, and the stills that page's gatefold holds. */
interface ShowPage {
  artist: string
  date: string
  images: string[]
}

/** A clip's own page. It only names itself as canonical once it has a share image. */
interface ClipPage {
  asset: MediaAsset & { url: string; poster: string; duration: number }
  act: string
  concert: Concert
}

const SITE_URL = 'https://concerts.morperhaus.org'
const OUTPUT_PATH = path.join(process.cwd(), 'public/sitemap.xml')

async function generateSitemap() {
  console.log('🗺️  Generating sitemap.xml...\n')

  // Load data
  const concertsPath = path.join(__dirname, '..', 'public', 'data', 'concerts.json')
  const artistsPath = path.join(__dirname, '..', 'public', 'data', 'artists-metadata.json')
  const venuesPath = path.join(__dirname, '..', 'public', 'data', 'venues-metadata.json')

  const concertsData: ConcertsData = JSON.parse(fs.readFileSync(concertsPath, 'utf-8'))
  const artistsData = JSON.parse(fs.readFileSync(artistsPath, 'utf-8'))
  const venuesData = JSON.parse(fs.readFileSync(venuesPath, 'utf-8'))

  // Setlist coverage, for the per-show URLs below (#193). Optional — the cache
  // may not exist on a fresh checkout, in which case no per-show URLs are emitted.
  const setlistsPath = path.join(__dirname, '..', 'public', 'data', 'setlists-cache.json')

  // Load liner notes posts (optional — may not exist on first run)
  const linerNotesPath = path.join(__dirname, '..', 'public', 'data', 'liner-notes.json')
  const linerNotesSlugs: string[] = []
  if (fs.existsSync(linerNotesPath)) {
    const linerNotesData = JSON.parse(fs.readFileSync(linerNotesPath, 'utf-8'))
    linerNotesSlugs.push(...(linerNotesData.posts ?? []).map((p: { slug: string }) => p.slug))
  }

  // Published media, for the show and clip URLs below. Optional, as the setlist cache is. Only a
  // row with a `url` can be seen on the site.
  const mediaPath = path.join(__dirname, '..', 'public', 'data', 'media-index.json')
  const media: MediaAsset[] = fs.existsSync(mediaPath)
    ? (JSON.parse(fs.readFileSync(mediaPath, 'utf-8')).assets ?? []).filter((a: MediaAsset) => a.url)
    : []

  // A card merges an act's billings (#227), so frames filed under one billing live in its gatefold.
  const aliasesPath = path.join(__dirname, '..', 'public', 'data', 'artist-aliases.json')
  const aliases = fs.existsSync(aliasesPath)
    ? buildArtistAliasMap(JSON.parse(fs.readFileSync(aliasesPath, 'utf-8')))
    : EMPTY_ARTIST_ALIAS_MAP

  const concerts = concertsData.concerts
  const artists = Object.keys(artistsData)
  const venues = Object.keys(venuesData)

  // Use current date as lastmod (when sitemap was generated/site was updated)
  const lastmod = new Date().toISOString().split('T')[0]

  // Also get latest concert date for logging
  const dates = concerts.map((c) => c.date).sort()
  const latestConcertDate = dates[dates.length - 1]

  console.log(`Data loaded:`)
  console.log(`  ${concerts.length} concerts`)
  console.log(`  ${artists.length} artists`)
  console.log(`  ${venues.length} venues`)
  console.log(`  Latest concert: ${latestConcertDate}`)
  console.log(`  Sitemap lastmod: ${lastmod}\n`)

  // Start XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
  xml += ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
  xml += ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n'

  // Homepage
  xml += generateUrlEntry('/', 1.0, 'weekly', lastmod)

  // Scene links with adjusted priorities based on update frequency
  // Timeline & Artists update frequently (0.9)
  // Ask is a headline surface but its content doesn't change with new shows (0.8)
  // Venues, Map, Genres update least (0.7)
  const scenes = [
    { path: 'timeline', priority: 0.9, changefreq: 'weekly' }, // Updates frequently
    { path: 'artists', priority: 0.9, changefreq: 'weekly' }, // Updates frequently
    { path: 'ask', priority: 0.8, changefreq: 'monthly' }, // Scene 6 (#283)
    { path: 'venues', priority: 0.7, changefreq: 'monthly' }, // Updates least
    { path: 'geography', priority: 0.7, changefreq: 'monthly' }, // Updates least (map)
    { path: 'genres', priority: 0.7, changefreq: 'monthly' }, // Updates least
  ]

  scenes.forEach((scene) => {
    xml += generateUrlEntry(`/?scene=${scene.path}`, scene.priority, scene.changefreq, lastmod)
  })

  // Artist deep links (sorted by concert count)
  const artistConcertCounts = new Map<string, number>()
  concerts.forEach((concert) => {
    const count = artistConcertCounts.get(concert.headlinerNormalized) || 0
    artistConcertCounts.set(concert.headlinerNormalized, count + 1)
  })

  const sortedArtists = artists.sort((a, b) => {
    const countA = artistConcertCounts.get(a) || 0
    const countB = artistConcertCounts.get(b) || 0
    return countB - countA
  })

  sortedArtists.forEach((artist) => {
    xml += generateUrlEntry(`/?scene=artists&artist=${artist}`, 0.8, 'monthly')
  })

  // Per-show deep links (#193). One URL per concert with a setlist on record, and
  // one per act with media from that night. A night with neither is a thin page
  // and shouldn't be indexed. Setlist coverage is roughly 2/3 of the archive, so
  // the gate matters.
  //
  // priority 0.6   below artist pages (0.8): narrower intent
  // changefreq     yearly — a past setlist is immutable once enriched
  // ordering       newest first, mirroring the "most relevant first" convention
  //                used for artists and venues above
  const setlistConcertIds = new Set<string>()
  if (fs.existsSync(setlistsPath)) {
    const setlistsCache = JSON.parse(fs.readFileSync(setlistsPath, 'utf-8'))
    for (const entry of setlistsCache.entries ?? []) {
      const sets = entry.setlist?.sets?.set ?? []
      const hasSongs = sets.some((s: { song?: unknown[] }) => (s.song ?? []).length > 0)
      if (hasSongs && entry.concertId) setlistConcertIds.add(entry.concertId)
    }
  }

  const showPages = new Map<string, ShowPage>()
  const showPage = (artist: string, date: string): ShowPage => {
    const key = `${artist}|${date}`
    const page = showPages.get(key) ?? { artist, date, images: [] }
    showPages.set(key, page)
    return page
  }
  concerts.filter((c) => setlistConcertIds.has(c.id)).forEach((c) => showPage(c.headlinerNormalized, c.date))

  const concertsByDate = new Map(concerts.map((c) => [c.date, c]))
  const clipPages: ClipPage[] = []
  let clipsSkipped = 0

  media.forEach((asset) => {
    const concert = concertsByDate.get(asset.date)
    if (!concert) return

    // A gatefold holds that act's frames and the room, so a frame is listed on the page that shows
    // it. The room is everyone's, and goes on the headliner's page.
    const onHeadliner =
      !asset.artistNormalized ||
      canonicalArtist(aliases, asset.artistNormalized) === canonicalArtist(aliases, concert.headlinerNormalized)
    const page = showPage(
      onHeadliner ? concert.headlinerNormalized : canonicalArtist(aliases, asset.artistNormalized!),
      asset.date,
    )
    if (asset.kind !== 'video') {
      page.images.push(`${SITE_URL}${asset.url}`)
      return
    }

    const shareImage = path.join(__dirname, '..', 'public', 'og', 'shows', `${asset.date}-${mediaId({ ...asset, url: asset.url! })}.jpg`)
    if (asset.poster && asset.duration && fs.existsSync(shareImage)) {
      clipPages.push({ asset: asset as ClipPage['asset'], act: page.artist, concert })
    } else {
      clipsSkipped++
    }
  })

  const sortedShowPages = [...showPages.values()].sort((a, b) => b.date.localeCompare(a.date))
  sortedShowPages.forEach(({ artist, date, images }) => {
    xml += generateUrlEntry(
      setlistDeepLink(artist, date),
      0.6,
      'yearly',
      undefined,
      images.map((loc) => `    <image:image><image:loc>${escapeXml(loc)}</image:loc></image:image>\n`).join(''),
    )
  })

  clipPages
    .sort((a, b) => b.concert.date.localeCompare(a.concert.date))
    .forEach((clip) => {
      xml += generateUrlEntry(
        photoDeepLink(clip.act, clip.concert.date, mediaId(clip.asset)),
        0.6,
        'yearly',
        undefined,
        videoEntry(clip),
      )
    })

  // Say what was left out. A silent gate reads as "we covered everything".
  const showDates = new Set(sortedShowPages.map((p) => p.date))
  const skipped = concerts.filter((c) => !showDates.has(c.date)).length
  const imageCount = sortedShowPages.reduce((n, p) => n + p.images.length, 0)
  console.log(
    `  ${sortedShowPages.length} per-show URLs (${skipped} concerts skipped — no setlist or media on record)`,
  )
  console.log(`  ${imageCount} stills on those URLs`)
  console.log(`  ${clipPages.length} clip URLs (${clipsSkipped} skipped — no poster, duration or share image)`)

  // Venue deep links (both scenes, sorted by concert count)
  const venueConcertCounts = new Map<string, number>()
  concerts.forEach((concert) => {
    const count = venueConcertCounts.get(concert.venueNormalized) || 0
    venueConcertCounts.set(concert.venueNormalized, count + 1)
  })

  const sortedVenues = venues.sort((a, b) => {
    const countA = venueConcertCounts.get(a) || 0
    const countB = venueConcertCounts.get(b) || 0
    return countB - countA
  })

  sortedVenues.forEach((venue) => {
    // Venues scene (network graph)
    xml += generateUrlEntry(`/?scene=venues&venue=${venue}`, 0.7, 'monthly')
    // Geography scene (map)
    xml += generateUrlEntry(`/?scene=geography&venue=${venue}`, 0.6, 'monthly')
  })

  // Liner notes feed and post permalinks
  xml += generateUrlEntry('/liner-notes', 0.7, 'weekly', lastmod)
  xml += generateUrlEntry('/liner-notes.xml', 0.4, 'weekly', lastmod)
  linerNotesSlugs.forEach((slug) => {
    xml += generateUrlEntry(`/liner-notes/${slug}`, 0.8, 'weekly', lastmod)
  })

  // How It Works — interactive data pipeline explainer
  xml += generateUrlEntry('/how-it-works', 0.6, 'monthly', lastmod)

  // Ask the Archive is emitted with the scenes above as its canonical
  // `/?scene=ask` URL. `/ask` is a redirect to that URL — listing both told
  // search engines the doormat and the room were separate pages (#283).

  // MCP server — human-facing connector page (canonical, static via Pages)
  xml += generateUrlEntry('/about-mcp', 0.6, 'monthly', lastmod)

  // About page
  xml += generateUrlEntry('/about', 0.6, 'monthly')

  xml += '</urlset>'

  // Write file
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf-8')

  const totalUrls = xml.split('<url>').length - 1

  console.log(`✅ Sitemap generated: ${OUTPUT_PATH}`)
  console.log(`   Total URLs: ${totalUrls}`)
  console.log(`   - Homepage: 1`)
  console.log(`   - Scenes: ${scenes.length}`)
  console.log(`   - Artists: ${sortedArtists.length}`)
  console.log(`   - Shows: ${sortedShowPages.length}`)
  console.log(`   - Clips: ${clipPages.length}`)
  console.log(`   - Venues: ${sortedVenues.length} × 2 scenes = ${sortedVenues.length * 2}`)
  console.log(`   - Liner notes: ${2 + linerNotesSlugs.length} (feed + ${linerNotesSlugs.length} posts)`)
  console.log(`   - How It Works: 1`)
  console.log(`   - Connector (about-mcp): 1`)
  console.log(`   - About: 1`)
  console.log()
}

/** XML escape special characters */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * The video block for one clip.
 *
 * The title credits the act on the asset, never the headliner: a frame of an opener credited to
 * the marquee is fabricated attribution (media-pipeline skill). No publication date, because the
 * index records when a clip was filmed and not when it was uploaded.
 */
function videoEntry({ asset, concert }: ClipPage): string {
  const longDate = new Date(`${concert.date}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const who = asset.artist ?? concert.venue ?? 'A concert'
  const what = asset.song ? `${who} playing "${asset.song}"` : who
  const title = asset.song ? `${who}: ${asset.song}` : `${who}, ${longDate}`
  const place = [concert.venue, concert.cityState].filter(Boolean).join(', ')
  const description = `${what}${place ? ` at ${place}` : ''} on ${longDate}. Filmed by Mike Morper.`

  let block = '    <video:video>\n'
  block += `      <video:thumbnail_loc>${escapeXml(asset.poster)}</video:thumbnail_loc>\n`
  block += `      <video:title>${escapeXml(title)}</video:title>\n`
  block += `      <video:description>${escapeXml(description)}</video:description>\n`
  block += `      <video:content_loc>${escapeXml(asset.url)}</video:content_loc>\n`
  block += `      <video:duration>${Math.round(asset.duration)}</video:duration>\n`
  block += '    </video:video>\n'
  return block
}

/**
 * Generate a single URL entry with proper XML escaping
 *
 * @param extra - Already-escaped image or video blocks, closed before `</url>`
 */
function generateUrlEntry(
  urlPath: string,
  priority: number,
  changefreq: string,
  lastmod?: string,
  extra = ''
): string {
  let entry = '  <url>\n'
  entry += `    <loc>${SITE_URL}${escapeXml(urlPath)}</loc>\n`
  if (lastmod) {
    entry += `    <lastmod>${lastmod}</lastmod>\n`
  }
  entry += `    <changefreq>${changefreq}</changefreq>\n`
  entry += `    <priority>${priority.toFixed(1)}</priority>\n`
  entry += extra
  entry += '  </url>\n'
  return entry
}

// Run if called directly — and *only* then. The comment always said "if called
// directly"; the guard was missing, so `await import()` in a test ran the real
// generator and overwrote public/sitemap.xml on every test run.
// Invoked via `npm run generate:sitemap` (tsx scripts/generate-sitemap.ts);
// nothing imports this module for its side effect.
const isDirectRun =
  !!process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectRun) {
  generateSitemap().catch((err) => {
    console.error('❌ Sitemap generation failed:', err)
    process.exit(1)
  })
}

export { generateSitemap }
