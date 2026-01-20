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
import * as path from 'path'

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
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

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('3 concerts'))
    })

    it('should calculate unique artist count (headliners + openers)', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      // Should count: Depeche Mode, New Order, Goldfrapp, Pet Shop Boys = 4 unique artists
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('4 artists'))
    })

    it('should calculate unique venue count', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      // Should count: 9:30 Club, Hollywood Palladium = 2 unique venues
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 venues'))
    })

    it('should calculate album count from discography.json', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      // Should count: 2 (Depeche Mode) + 1 (New Order) = 3 albums
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('3 albums'))
    })

    it('should handle missing discography.json gracefully', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not read discography.json')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('0 albums'))
    })

    it('should calculate correct year range', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      // Year range: 1990-2024
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1990-2024'))
    })

    it('should find earliest and latest concert dates', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      // Earliest: 1990-03-10, Latest: 2024-05-15
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1990-03-10 to 2024-05-15'))
    })
  })

  describe('File Updates', () => {
    it('should update index.html meta descriptions', async () => {
      const mockFs = fs as any
      let writtenIndexHtml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      // Check that new description is present
      expect(writtenIndexHtml).toContain('3 concerts from 1990-2024')
      expect(writtenIndexHtml).toContain('4 artists')
      expect(writtenIndexHtml).toContain('2 venues')
    })

    it('should update Schema.org JSON-LD fields', async () => {
      const mockFs = fs as any
      let writtenIndexHtml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      const ogStats = JSON.parse(writtenOgStats)
      expect(ogStats).toEqual({
        concerts: 3,
        scenes: 5,
        artists: 4,
        venues: 2,
      })
    })

    it('should update dateModified to today', async () => {
      const mockFs = fs as any
      let writtenIndexHtml = ''
      const today = new Date().toISOString().split('T')[0]

      mockFs.readFileSync.mockImplementation((filePath: string) => {
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

      expect(writtenIndexHtml).toContain(`"dateModified": "${today}"`)
      expect(writtenIndexHtml).toContain(`<meta property="article:modified_time" content="${today}T00:00:00Z"`)
    })
  })

  describe('Console Output', () => {
    it('should log success messages for all file updates', async () => {
      const mockFs = fs as any
      mockFs.readFileSync.mockImplementation((filePath: string) => {
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
