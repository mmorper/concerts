/**
 * Tests for scripts/generate-sitemap.ts
 *
 * Covers:
 * - URL generation for all entity types
 * - XML escaping for special characters
 * - Priority values per entity type
 * - Concert count-based sorting
 * - Changefreq values
 * - Lastmod date handling
 * - Total URL count calculation
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

describe('generate-sitemap.ts', () => {
  let originalLog: typeof console.log
  let originalError: typeof console.error

  const mockConcertsData = {
    concerts: [
      {
        headlinerNormalized: 'depeche-mode',
        venueNormalized: '9-30-club',
        date: '2024-05-15',
      },
      {
        headlinerNormalized: 'depeche-mode',
        venueNormalized: 'hollywood-palladium',
        date: '2024-06-20',
      },
      {
        headlinerNormalized: 'new-order',
        venueNormalized: '9-30-club',
        date: '2023-08-20',
      },
      {
        headlinerNormalized: 'pet-shop-boys',
        venueNormalized: '9-30-club',
        date: '1990-03-10',
      },
    ],
  }

  const mockArtistsData = {
    'depeche-mode': { name: 'Depeche Mode' },
    'new-order': { name: 'New Order' },
    'pet-shop-boys': { name: 'Pet Shop Boys' },
  }

  const mockVenuesData = {
    '9-30-club': { name: '9:30 Club' },
    'hollywood-palladium': { name: 'Hollywood Palladium' },
  }

  beforeEach(() => {
    // Save originals
    originalLog = console.log
    originalError = console.error

    // Mock console
    console.log = vi.fn()
    console.error = vi.fn()

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore originals
    console.log = originalLog
    console.error = originalError
  })

  describe('URL Generation', () => {
    it('should generate homepage URL with priority 1.0', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      expect(writtenXml).toContain('<loc>https://concerts.morperhaus.org/</loc>')
      expect(writtenXml).toContain('<priority>1.0</priority>')
      expect(writtenXml).toContain('<changefreq>weekly</changefreq>')
    })

    it('should generate all 5 scene URLs', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // Check all scene URLs present
      expect(writtenXml).toContain('?scene=timeline')
      expect(writtenXml).toContain('?scene=artists')
      expect(writtenXml).toContain('?scene=venues')
      expect(writtenXml).toContain('?scene=geography')
      expect(writtenXml).toContain('?scene=genres')
    })

    it('should assign priority 0.9 to timeline and artists scenes', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // Extract timeline and artists URL blocks
      const timelineMatch = writtenXml.match(
        /<url>\s*<loc>[^<]*\?scene=timeline<\/loc>\s*<lastmod>[^<]*<\/lastmod>\s*<changefreq>[^<]*<\/changefreq>\s*<priority>([^<]*)<\/priority>/
      )
      const artistsMatch = writtenXml.match(
        /<url>\s*<loc>[^<]*\?scene=artists<\/loc>\s*<lastmod>[^<]*<\/lastmod>\s*<changefreq>[^<]*<\/changefreq>\s*<priority>([^<]*)<\/priority>/
      )

      expect(timelineMatch?.[1]).toBe('0.9')
      expect(artistsMatch?.[1]).toBe('0.9')
    })

    it('should assign priority 0.7 to venues, geography, and genres scenes', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // These scenes update less frequently
      const venuesMatch = writtenXml.match(
        /<url>\s*<loc>[^<]*\?scene=venues<\/loc>\s*<lastmod>[^<]*<\/lastmod>\s*<changefreq>monthly<\/changefreq>\s*<priority>([^<]*)<\/priority>/
      )
      const geographyMatch = writtenXml.match(
        /<url>\s*<loc>[^<]*\?scene=geography<\/loc>\s*<lastmod>[^<]*<\/lastmod>\s*<changefreq>monthly<\/changefreq>\s*<priority>([^<]*)<\/priority>/
      )
      const genresMatch = writtenXml.match(
        /<url>\s*<loc>[^<]*\?scene=genres<\/loc>\s*<lastmod>[^<]*<\/lastmod>\s*<changefreq>monthly<\/changefreq>\s*<priority>([^<]*)<\/priority>/
      )

      expect(venuesMatch?.[1]).toBe('0.7')
      expect(geographyMatch?.[1]).toBe('0.7')
      expect(genresMatch?.[1]).toBe('0.7')
    })

    it('should generate artist deep links for all artists', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // All 3 artists should have deep links
      expect(writtenXml).toContain('?scene=artists&amp;artist=depeche-mode')
      expect(writtenXml).toContain('?scene=artists&amp;artist=new-order')
      expect(writtenXml).toContain('?scene=artists&amp;artist=pet-shop-boys')
    })

    it('should generate venue deep links for both scenes', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // Each venue should have 2 URLs (venues scene + geography scene)
      expect(writtenXml).toContain('?scene=venues&amp;venue=9-30-club')
      expect(writtenXml).toContain('?scene=geography&amp;venue=9-30-club')
      expect(writtenXml).toContain('?scene=venues&amp;venue=hollywood-palladium')
      expect(writtenXml).toContain('?scene=geography&amp;venue=hollywood-palladium')
    })

    it('should generate changelog URLs', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      expect(writtenXml).toContain('<loc>https://concerts.morperhaus.org/liner-notes</loc>')
      expect(writtenXml).toContain('<loc>https://concerts.morperhaus.org/liner-notes/rss</loc>')
    })
  })

  describe('XML Escaping', () => {
    it('should escape ampersands in URLs', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // All query params should have escaped ampersands
      expect(writtenXml).toContain('?scene=artists&amp;artist=')
      expect(writtenXml).toContain('?scene=venues&amp;venue=')
      expect(writtenXml).toContain('?scene=geography&amp;venue=')

      // Should NOT contain unescaped ampersands in URLs
      const urlMatches = writtenXml.match(/<loc>([^<]*)<\/loc>/g)
      urlMatches?.forEach((url) => {
        const urlContent = url.replace(/<\/?loc>/g, '')
        if (urlContent.includes('?')) {
          // URLs with query params should use &amp; not &
          expect(urlContent).not.toMatch(/\?[^<]*&[^a]/) // Not followed by 'a' (for 'amp;')
        }
      })
    })
  })

  describe('Sorting', () => {
    it('should sort artists by concert count descending', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // Extract artist URLs in order
      const artistUrlMatches = writtenXml.match(/\?scene=artists&amp;artist=([a-z-]+)/g)
      const artistNames = artistUrlMatches?.map((match) =>
        match.replace('?scene=artists&amp;artist=', '')
      )

      // Depeche Mode (2 concerts) should appear before New Order (1) and Pet Shop Boys (1)
      expect(artistNames?.[0]).toBe('depeche-mode')
    })

    it('should sort venues by concert count descending', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // Extract venue URLs in order
      const venueUrlMatches = writtenXml.match(/venue=([a-z0-9-]+)/g)
      const venueNames = venueUrlMatches?.map((match) => match.replace('venue=', ''))

      // 9-30-club (3 concerts) should appear before hollywood-palladium (1 concert)
      // Each venue appears twice (venues scene + geography scene)
      expect(venueNames?.[0]).toBe('9-30-club')
      expect(venueNames?.[1]).toBe('9-30-club')
      expect(venueNames?.[2]).toBe('hollywood-palladium')
      expect(venueNames?.[3]).toBe('hollywood-palladium')
    })
  })

  describe('Priority Values', () => {
    it('should assign correct priorities to all URL types', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // Artist URLs should have priority 0.8
      expect(writtenXml).toMatch(
        /<loc>[^<]*\?scene=artists&amp;artist=depeche-mode<\/loc>\s*<changefreq>monthly<\/changefreq>\s*<priority>0\.8<\/priority>/
      )

      // Venue network URLs should have priority 0.7
      expect(writtenXml).toMatch(
        /<loc>[^<]*\?scene=venues&amp;venue=9-30-club<\/loc>\s*<changefreq>monthly<\/changefreq>\s*<priority>0\.7<\/priority>/
      )

      // Geography venue URLs should have priority 0.6
      expect(writtenXml).toMatch(
        /<loc>[^<]*\?scene=geography&amp;venue=9-30-club<\/loc>\s*<changefreq>monthly<\/changefreq>\s*<priority>0\.6<\/priority>/
      )
    })
  })

  describe('Lastmod Date', () => {
    it('should use latest concert date for lastmod', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      // Latest concert date is 2024-06-20
      expect(writtenXml).toContain('<lastmod>2024-06-20</lastmod>')
    })
  })

  describe('URL Count', () => {
    it('should calculate total URL count correctly', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      const urlCount = (writtenXml.match(/<url>/g) || []).length

      // Expected: 1 (homepage) + 5 (scenes) + 3 (artists) + 4 (2 venues × 2 scenes) + 2 (changelog) = 15
      expect(urlCount).toBe(15)
    })
  })

  describe('XML Structure', () => {
    it('should generate valid XML with proper declaration and namespace', async () => {
      const mockFs = fs as any
      let writtenXml = ''

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation((filePath: string, content: string) => {
        if (filePath.includes('sitemap.xml')) {
          writtenXml = content
        }
      })

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      expect(writtenXml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
      expect(writtenXml).toContain(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
      )
      expect(writtenXml).toContain('</urlset>')
    })
  })

  describe('Console Output', () => {
    it('should log success message and stats', async () => {
      const mockFs = fs as any

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('concerts.json')) {
          return JSON.stringify(mockConcertsData)
        }
        if (filePath.includes('artists-metadata.json')) {
          return JSON.stringify(mockArtistsData)
        }
        if (filePath.includes('venues-metadata.json')) {
          return JSON.stringify(mockVenuesData)
        }
        throw new Error('File not found')
      })

      mockFs.writeFileSync.mockImplementation(() => {})

      const { generateSitemap } = await import('../../scripts/generate-sitemap')
      await generateSitemap()

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Sitemap generated'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total URLs: 15'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Artists: 3'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Venues: 2'))
    })
  })
})
