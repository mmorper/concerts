#!/usr/bin/env tsx
/**
 * Generate Facts Script
 *
 * Computes statistics from concerts.json and generates facts.json
 * for the Liner Notes "By the Numbers" section and llm.txt integration.
 *
 * Facts are designed to be directly quotable by AI agents with natural
 * language headlines and deep links for exploration.
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
function generateFacts(concerts: Concert[]): Fact[] {
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
      `/?scene=artists&artist=${firstConcert.headlinerNormalized}`,
      'View artist details',
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
      `/?scene=artists&artist=${latestConcert.headlinerNormalized}`,
      'View artist details',
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

  // Generate facts
  const facts = generateFacts(concertsData.concerts)

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
