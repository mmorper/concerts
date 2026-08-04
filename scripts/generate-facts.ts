#!/usr/bin/env tsx
/**
 * @deprecated Superseded by the agentic liner notes pipeline (scripts/liner-notes/).
 *
 * This script generates facts.json for the legacy "By the Numbers" section
 * of the Liner Notes component. It will be removed in Phase 4 when the
 * LinerNotes component is redesigned as a blog feed and facts.json is no
 * longer consumed by the app.
 *
 * DO NOT add new features here. Use scripts/liner-notes/ instead.
 *
 * ---
 * Generate Facts Script
 *
 * Computes statistics from concerts.json and generates facts.json
 * for the Liner Notes "By the Numbers" section and llm.txt integration.
 *
 * Run: npm run generate:facts (or as part of build-data pipeline)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Fact, FactsData, FactCategory } from '../src/components/changelog/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Concert {
  id: string
  date: string
  headliner: string
  headlinerNormalized: string
  genre: string
  genreNormalized: string
  openers: string[]
  venue: string
  venueNormalized: string
  city: string
  state: string
  cityState: string
  year: number
  decade: string
}

interface ConcertsData {
  concerts: Concert[]
}

interface CountEntry {
  name: string
  normalized: string
  count: number
  firstYear?: number
  lastYear?: number
}

/**
 * Group items by a key and count occurrences
 */
function groupAndCount<T>(
  items: T[],
  getKey: (item: T) => string,
  getNormalized: (item: T) => string,
  getYear?: (item: T) => number
): CountEntry[] {
  const counts = new Map<string, CountEntry>()

  for (const item of items) {
    const key = getKey(item)
    const normalized = getNormalized(item)
    const year = getYear?.(item)

    const existing = counts.get(normalized)
    if (existing) {
      existing.count++
      if (year) {
        existing.firstYear = Math.min(existing.firstYear || year, year)
        existing.lastYear = Math.max(existing.lastYear || year, year)
      }
    } else {
      counts.set(normalized, {
        name: key,
        normalized,
        count: 1,
        firstYear: year,
        lastYear: year,
      })
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count)
}

/**
 * Create a fact object with consistent structure
 */
function createFact(
  id: string,
  category: FactCategory,
  headline: string,
  detail: string,
  route: string,
  cta: string,
  priority: number
): Fact {
  return { id, category, headline, detail, route, cta, priority }
}

/**
 * Generate all facts from concert data
 */

// A fact about one specific night links to that night when a setlist exists,
// and to the artist otherwise. Keyed on date, never concert.id — those are
// row-order artifacts a re-import would renumber. See docs/DEEP_LINKING.md v1.2.
function showRoute(concert: Concert, setlistConcertIds: Set<string>): string {
  const artistRoute = `/?scene=artists&artist=${concert.headlinerNormalized}`
  return setlistConcertIds.has(concert.id)
    ? `${artistRoute}&show=${concert.date}`
    : artistRoute
}

/**
 * `setlistConcertIds` (#197) — concerts with a setlist on record. Optional and
 * defaulting to empty, so existing callers and tests keep working. Facts about
 * one specific night route to that night's setlist when we have one; otherwise
 * they keep routing to the artist, because a link offered as a setlist that
 * opens an empty panel is worse than no link.
 */
function generateFacts(concerts: Concert[], setlistConcertIds: Set<string> = new Set()): Fact[] {
  const facts: Fact[] = []

  // Sort concerts by date for first/last calculations
  const sortedByDate = [...concerts].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const firstConcert = sortedByDate[0]
  const latestConcert = sortedByDate[sortedByDate.length - 1]

  // Calculate year range
  const years = concerts.map((c) => c.year)
  const startYear = Math.min(...years)
  const endYear = Math.max(...years)

  // Group by artist (headliner)
  const artistCounts = groupAndCount(
    concerts,
    (c) => c.headliner,
    (c) => c.headlinerNormalized,
    (c) => c.year
  )

  // Group by venue
  const venueCounts = groupAndCount(
    concerts,
    (c) => c.venue,
    (c) => c.venueNormalized,
    (c) => c.year
  )

  // Group by genre
  const genreCounts = groupAndCount(
    concerts,
    (c) => c.genre,
    (c) => c.genreNormalized
  )

  // Group by state
  const stateCounts = groupAndCount(
    concerts,
    (c) => c.state,
    (c) => c.state.toLowerCase().replace(/\s+/g, '-')
  )

  // Group by city
  const cityCounts = groupAndCount(
    concerts,
    (c) => c.city,
    (c) => c.city.toLowerCase().replace(/\s+/g, '-')
  )

  // Group by year for busiest year
  const yearCounts = new Map<number, number>()
  for (const concert of concerts) {
    yearCounts.set(concert.year, (yearCounts.get(concert.year) || 0) + 1)
  }
  const busiestYear = Array.from(yearCounts.entries()).sort((a, b) => b[1] - a[1])[0]

  // Group by decade
  const decadeCounts = groupAndCount(
    concerts,
    (c) => c.decade,
    (c) => c.decade.toLowerCase()
  )

  // --- Generate Facts ---

  // Priority 1: Top Artist
  const topArtist = artistCounts[0]
  facts.push(
    createFact(
      'top-artist',
      'artist',
      `${topArtist.name}: ${topArtist.count} concerts`,
      `The most-seen live act, ${topArtist.firstYear}–${topArtist.lastYear}`,
      `/?scene=artists&artist=${topArtist.normalized}`,
      `Explore all ${topArtist.count} shows`,
      1
    )
  )

  // Priority 2: Top Venue
  const topVenue = venueCounts[0]
  facts.push(
    createFact(
      'top-venue',
      'venue',
      `${topVenue.name}: ${topVenue.count} shows`,
      `A favorite spot, visited ${topVenue.firstYear}–${topVenue.lastYear}`,
      `/?scene=venues&venue=${topVenue.normalized}`,
      `See all ${topVenue.count} concerts`,
      2
    )
  )

  // Priority 3: Total Concerts
  facts.push(
    createFact(
      'total-concerts',
      'timeline',
      `${concerts.length} concerts since ${startYear}`,
      `${endYear - startYear + 1} years of live music memories`,
      '/?scene=timeline',
      'Explore the timeline',
      3
    )
  )

  // Priority 4: Top Genre
  const topGenre = genreCounts[0]
  facts.push(
    createFact(
      'top-genre',
      'genre',
      `${topGenre.name}: ${topGenre.count} shows`,
      'The dominant sound in this collection',
      '/?scene=genres',
      'Explore genre breakdown',
      4
    )
  )

  // Priority 5: First Concert
  facts.push(
    createFact(
      'first-concert',
      'timeline',
      `First show: ${firstConcert.headliner} (${firstConcert.year})`,
      `Where it all began — ${firstConcert.venue}`,
      showRoute(firstConcert, setlistConcertIds),
      setlistConcertIds.has(firstConcert.id) ? 'See the setlist' : 'View artist details',
      5
    )
  )

  // Priority 6: Top State
  const topState = stateCounts[0]
  facts.push(
    createFact(
      'top-state',
      'geography',
      `${topState.name}: ${topState.count} concerts`,
      'Home base for most concert experiences',
      '/?scene=geography',
      'Explore the map',
      6
    )
  )

  // Priority 7: #2 Artist
  if (artistCounts[1]) {
    const secondArtist = artistCounts[1]
    facts.push(
      createFact(
        'second-artist',
        'artist',
        `${secondArtist.name}: ${secondArtist.count} concerts`,
        'Another favorite who keeps drawing me back',
        `/?scene=artists&artist=${secondArtist.normalized}`,
        `Explore all ${secondArtist.count} shows`,
        7
      )
    )
  }

  // Priority 8: #3 Artist
  if (artistCounts[2]) {
    const thirdArtist = artistCounts[2]
    facts.push(
      createFact(
        'third-artist',
        'artist',
        `${thirdArtist.name}: ${thirdArtist.count} concerts`,
        'Rounding out the top three most-seen',
        `/?scene=artists&artist=${thirdArtist.normalized}`,
        `Explore all ${thirdArtist.count} shows`,
        8
      )
    )
  }

  // Priority 9: #2 Venue
  if (venueCounts[1]) {
    const secondVenue = venueCounts[1]
    facts.push(
      createFact(
        'second-venue',
        'venue',
        `${secondVenue.name}: ${secondVenue.count} shows`,
        'Another venue with great memories',
        `/?scene=venues&venue=${secondVenue.normalized}`,
        `See all ${secondVenue.count} concerts`,
        9
      )
    )
  }

  // Priority 10: Latest Concert
  facts.push(
    createFact(
      'latest-concert',
      'timeline',
      `Latest: ${latestConcert.headliner} (${latestConcert.year})`,
      `The most recent addition — ${latestConcert.venue}`,
      showRoute(latestConcert, setlistConcertIds),
      setlistConcertIds.has(latestConcert.id) ? 'See the setlist' : 'View artist details',
      10
    )
  )

  // Priority 11: Busiest Year
  facts.push(
    createFact(
      'busiest-year',
      'timeline',
      `${busiestYear[0]}: ${busiestYear[1]} shows`,
      'The peak year for live music attendance',
      '/?scene=timeline',
      'View timeline',
      11
    )
  )

  // Priority 12: Unique Cities
  facts.push(
    createFact(
      'unique-cities',
      'geography',
      `${cityCounts.length} cities visited`,
      'Live music across the map',
      '/?scene=geography',
      'Explore the map',
      12
    )
  )

  // Priority 13: Unique Venues
  facts.push(
    createFact(
      'unique-venues',
      'venue',
      `${venueCounts.length} unique venues`,
      'From clubs to arenas and amphitheaters',
      '/?scene=venues',
      'Explore venues',
      13
    )
  )

  // Priority 14: Top Decade
  const topDecade = decadeCounts[0]
  facts.push(
    createFact(
      'top-decade',
      'timeline',
      `${topDecade.name}: ${topDecade.count} shows`,
      'The golden era of concert-going',
      '/?scene=timeline',
      'View timeline',
      14
    )
  )

  // Priority 15: #2 Genre
  if (genreCounts[1]) {
    const secondGenre = genreCounts[1]
    facts.push(
      createFact(
        'second-genre',
        'genre',
        `${secondGenre.name}: ${secondGenre.count} shows`,
        'Another genre that shaped the journey',
        '/?scene=genres',
        'Explore genres',
        15
      )
    )
  }

  return facts.sort((a, b) => a.priority - b.priority)
}

/**
 * Main function
 */
export async function generateFactsData(): Promise<FactsData> {
  // Read concerts data
  const dataPath = path.join(__dirname, '..', 'public', 'data', 'concerts.json')
  const concertsData: ConcertsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  // Setlist coverage, so night-scoped facts can link to the night (#197).
  // Optional — absent on a fresh checkout, in which case those facts keep
  // routing to the artist.
  const setlistsPath = path.join(__dirname, '..', 'public', 'data', 'setlists-cache.json')
  const setlistConcertIds = new Set<string>()
  if (fs.existsSync(setlistsPath)) {
    const cache = JSON.parse(fs.readFileSync(setlistsPath, 'utf-8'))
    for (const entry of cache.entries ?? []) {
      const sets = entry.setlist?.sets?.set ?? []
      const hasSongs = sets.some((set: { song?: unknown[] }) => (set.song ?? []).length > 0)
      if (hasSongs && entry.concertId) setlistConcertIds.add(entry.concertId)
    }
  }

  // Generate facts
  const facts = generateFacts(concertsData.concerts, setlistConcertIds)

  // Create output
  const factsData: FactsData = {
    computedAt: new Date().toISOString(),
    facts,
  }

  return factsData
}

/**
 * Write facts to file
 */
export async function writeFacts(): Promise<void> {
  console.log('📊 Generating facts from concert data...\n')

  const factsData = await generateFactsData()

  // Write to file
  const outputPath = path.join(__dirname, '..', 'public', 'data', 'facts.json')
  fs.writeFileSync(outputPath, JSON.stringify(factsData, null, 2) + '\n', 'utf-8')

  console.log(`✓ Generated ${factsData.facts.length} facts`)
  console.log(`✓ Written to public/data/facts.json`)

  // Show preview
  console.log('\nTop 6 facts (displayed in UI):')
  factsData.facts.slice(0, 6).forEach((fact, i) => {
    console.log(`  ${i + 1}. [${fact.category}] ${fact.headline}`)
  })
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  writeFacts().catch(console.error)
}
