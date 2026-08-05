/**
 * Tests for scripts/update-meta-tags.ts
 *
 * Covers:
 * - Stats calculation (concerts, artists, venues, albums, date ranges)
 * - index.html meta description updates
 * - index.html Schema.org JSON-LD updates
 * - public/llm.txt stat updates
 * - public/og-stats.json generation
 * - Discography.json reading with graceful fallback
 * - Date formatting (ISO dates, modified time)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'

// Mock fs module
// The scripts under test use a *default* import (`import fs from 'fs'`), so
// mocking only the named exports left `fs.readFileSync` / `fs.writeFileSync`
// pointing at the real module: every assertion saw an empty captured string,
// and the suite quietly rewrote the real public/ artifacts on each run.
// Same vi.fn() instances are shared between the namespace and the default
// export, so configuring `fs.readFileSync` from a test still drives the
// script's `fs.readFileSync`.
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  const readFileSync = vi.fn()
  const writeFileSync = vi.fn()
  // Deterministic: the scripts use existsSync only to probe for optional data
  // files. Left unmocked it reads the developer's real public/ directory, so
  // the suite would pass or fail depending on whether a generated artifact
  // happened to be present locally.
  const existsSync = vi.fn(() => false)
  return {
    ...actual,
    readFileSync,
    writeFileSync,
    existsSync,
    default: {
      ...((actual as unknown as { default?: object }).default ?? actual),
      readFileSync,
      writeFileSync,
      existsSync,
    },
  }
})

describe('update-meta-tags.ts', () => {
  let originalLog: typeof console.log
  let originalWarn: typeof console.warn

  const mockConcertsData = {
    concerts: [
      {
        headliner: 'Depeche Mode',
        openers: ['Goldfrapp'],
        venue: '9:30 Club',
        year: 2024,
        date: '2024-05-15',
      },
      {
        headliner: 'New Order',
        openers: [],
        venue: 'Hollywood Palladium',
        year: 2023,
        date: '2023-08-20',
      },
      {
        headliner: 'Depeche Mode',
        openers: ['Pet Shop Boys'],
        venue: '9:30 Club',
        year: 1990,
        date: '1990-03-10',
      },
    ],
  }

  const mockDiscographyData = {
    'depeche-mode': {
      albums: [
        { title: 'Violator', releaseDate: '1990-03-19' },
        { title: 'Songs of Faith and Devotion', releaseDate: '1993-03-22' },
      ],
    },
    'new-order': {
      albums: [
        { title: 'Power, Corruption & Lies', releaseDate: '1983-05-02' },
      ],
    },
  }

  const mockIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Morperhaus Concert Archives</title>
    <meta name="description" content="Old description with 100 concerts from 1980-2020" />

    <meta property="og:description" content="Old OG description with 100 concerts from 1980-2020" />
    <meta property="twitter:description" content="Old Twitter description with 100 concerts from 1980-2020" />
    <meta property="article:modified_time" content="2020-01-01T00:00:00Z" />

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "description": "Old schema description with 100 concerts from 1980-2020",
      "dateModified": "2020-01-01",
      "mainEntity": {
        "numberOfEvents": 100,
        "startDate": "1980-01-01",
        "endDate": "2020-12-31",
        "performer": {
          "numberOfItems": 50
        }
      },
      "hasPart": [
        {
          "name": "Timeline",
          "description": "Interactive timeline visualization of 100 concerts"
        },
        {
          "name": "Artists",
          "description": "50 artists with photos, bios, and setlists"
        },
        {
          "name": "Venues",
          "description": "30 venues with location data and concert history"
        }
      ]
    }
    </script>
  </head>
</html>`

  const mockLlmTxt = `# Morperhaus Concert Archives - AI Assistant Documentation

## Overview

Personal concert archive spanning 1980-2020. Interactive web application with 100 concerts, 50 artists, 30 venues.

### Authoritative Data (Objective)
- Artist discographies (via MusicBrainz API - 1,000+ albums)

## Data Endpoints

### Concert Data
**Records:** 100 concerts

### Artist Metadata
**Records:** 50 artists

### Venue Metadata
**Records:** 30 venues

### Artist Discography
**Records:** 1,000+ albums across 50 artists

### Data Integration
- **MusicBrainz API** - Artist discographies (1,000+ albums)

**Last Updated:** 2020-01-01
**Total Content:** 100 concerts | 50 artists | 30 venues | 1,000+ albums | 1980-2020
`

  beforeEach(() => {
    // Save originals
    originalLog = console.log
    originalWarn = console.warn

    // Mock console
    console.log = vi.fn()
    console.warn = vi.fn()

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore originals
    console.log = originalLog
    console.warn = originalWarn
  })

  describe('Stats Calculation', () => {
    it('should calculate concert count correctly', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      // Dynamically import to trigger execution
      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('3 concerts'))
    })

    it('should calculate unique artist count (headliners + openers)', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Should count: Depeche Mode, New Order, Goldfrapp, Pet Shop Boys = 4 unique artists
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('4 artists'))
    })

    it('should calculate unique venue count', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Should count: 9:30 Club, Hollywood Palladium = 2 unique venues
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 venues'))
    })

    it('should calculate album count from discography.json', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('discography.json')) {
          return JSON.stringify(mockDiscographyData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Should count: 2 (Depeche Mode) + 1 (New Order) = 3 albums
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('3 albums'))
    })

    it('should handle missing discography.json gracefully', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('discography.json')) {
          throw new Error('File not found')
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not read discography.json')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('0 albums'))
    })

    it('should calculate correct year range', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Year range: 1990-2024
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1990-2024'))
    })

    it('should find earliest and latest concert dates', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Earliest: 1990-03-10, Latest: 2024-05-15
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1990-03-10 to 2024-05-15'))
    })
  })

  describe('File Updates', () => {
    it('should update index.html meta descriptions', async () => {
      const mockFs = fs as any
      let writtenIndexHtml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('index.html')) {
          writtenIndexHtml = content
        }
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Check that new description is present
      expect(writtenIndexHtml).toContain('3 concerts from 1990-2024')
      expect(writtenIndexHtml).toContain('4 artists')
      expect(writtenIndexHtml).toContain('2 venues')
    })

    it('should update Schema.org JSON-LD fields', async () => {
      const mockFs = fs as any
      let writtenIndexHtml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('index.html')) {
          writtenIndexHtml = content
        }
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Check Schema.org fields updated
      expect(writtenIndexHtml).toContain('"numberOfEvents": 3')
      expect(writtenIndexHtml).toContain('"numberOfItems": 4')
      expect(writtenIndexHtml).toContain('"startDate": "1990-03-10"')
      expect(writtenIndexHtml).toContain('"endDate": "2024-05-15"')
    })

    it('should update llm.txt stats', async () => {
      const mockFs = fs as any
      let writtenLlmTxt = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('llm.txt')) {
          writtenLlmTxt = content
        }
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      // Check llm.txt updated
      expect(writtenLlmTxt).toContain('3 concerts, 4 artists, 2 venues')
      expect(writtenLlmTxt).toContain('**Records:** 3 concerts')
      expect(writtenLlmTxt).toContain('**Records:** 4 artists')
      expect(writtenLlmTxt).toContain('**Records:** 2 venues')
    })

    it('should update og-stats.json', async () => {
      const mockFs = fs as any
      let writtenOgStats = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('og-stats.json')) {
          writtenOgStats = content
        }
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      const ogStats = JSON.parse(writtenOgStats)
      expect(ogStats).toEqual({
        concerts: 3,
        scenes: 5,
        artists: 4,
        venues: 2,
        // Added by the liner notes work (#57). Zero here because existsSync is
        // mocked false, so the optional liner-notes.json read is skipped.
        linerNotesCount: 0,
      })
    })

    it('should update dateModified to today', async () => {
      const mockFs = fs as any
      let writtenIndexHtml = ''
      const today = new Date().toISOString().split('T')[0]

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('index.html')) {
          writtenIndexHtml = content
        }
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      expect(writtenIndexHtml).toContain(`"dateModified": "${today}"`)
      expect(writtenIndexHtml).toContain(`<meta property="article:modified_time" content="${today}T00:00:00Z"`)
    })
  })

  describe('Console Output', () => {
    it('should log success messages for all file updates', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        // package.json and facts.json are read by the script but were never
        // mocked — the suite only ever "passed" because importing the module
        // ran it against the real filesystem.
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '9.9.9' })
        }
        if (filePath.includes('facts.json')) {
          return JSON.stringify({ computedAt: '2024-01-01', facts: [] })
        }
        // main() calls generateSitemap() at the end, which reads these two.
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify({ 'depeche-mode': { name: 'Depeche Mode' } })
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify({ '9-30-club': { name: '9:30 Club' } })
        }
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('index.html')) {
          return mockIndexHtml
        }
        if (filePath.includes('llm.txt')) {
          return mockLlmTxt
        }
        throw new Error('File not found')
      })

      const { default: main } = await import('../../scripts/update-meta-tags')
      await main()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updated index.html meta tags and Schema.org JSON-LD')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updated public/og-stats.json')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Updated public/llm.txt')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('All meta tags and SEO files updated successfully')
      )
    })
  })
})
