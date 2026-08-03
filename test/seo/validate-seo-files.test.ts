/**
 * Tests for SEO file validation
 *
 * Covers:
 * - robots.txt existence and syntax
 * - llm.txt existence and URL validity
 * - Schema.org JSON-LD syntax validation
 * - Verification that stats are not hardcoded
 * - Meta tag completeness
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('SEO Files Validation', () => {
  const projectRoot = path.join(__dirname, '..', '..')
  const publicDir = path.join(projectRoot, 'public')
  const indexHtmlPath = path.join(projectRoot, 'index.html')

  describe('robots.txt', () => {
    it('should exist in public directory', () => {
      const robotsPath = path.join(publicDir, 'robots.txt')
      expect(fs.existsSync(robotsPath)).toBe(true)
    })

    it('should have valid syntax', () => {
      const robotsPath = path.join(publicDir, 'robots.txt')
      const content = fs.readFileSync(robotsPath, 'utf-8')

      // Should have User-agent directive
      expect(content).toContain('User-agent:')

      // Should have Allow or Disallow directives
      expect(content).toMatch(/Allow:|Disallow:/)

      // Should declare sitemap
      expect(content).toContain('Sitemap:')
      expect(content).toContain('https://concerts.morperhaus.org/sitemap.xml')
    })

    it('should welcome AI bots explicitly', () => {
      const robotsPath = path.join(publicDir, 'robots.txt')
      const content = fs.readFileSync(robotsPath, 'utf-8')

      // Check for common AI bot user agents
      expect(content).toContain('GPTBot')
      expect(content).toContain('ClaudeBot')
      expect(content).toContain('Claude-Web')
    })

    it('should allow social media crawlers', () => {
      const robotsPath = path.join(publicDir, 'robots.txt')
      const content = fs.readFileSync(robotsPath, 'utf-8')

      expect(content).toContain('facebookexternalhit')
      expect(content).toContain('Twitterbot')
    })
  })

  describe('llm.txt', () => {
    it('should exist in public directory', () => {
      const llmPath = path.join(publicDir, 'llm.txt')
      expect(fs.existsSync(llmPath)).toBe(true)
    })

    it('should have valid URLs', () => {
      const llmPath = path.join(publicDir, 'llm.txt')
      const content = fs.readFileSync(llmPath, 'utf-8')

      // Extract all URLs
      const urlRegex = /https?:\/\/[^\s)]+/g
      const urls = content.match(urlRegex) || []

      expect(urls.length).toBeGreaterThan(0)

      // All URLs should be valid
      urls.forEach((url) => {
        expect(() => new URL(url)).not.toThrow()
      })
    })

    it('should document all data endpoints', () => {
      const llmPath = path.join(publicDir, 'llm.txt')
      const content = fs.readFileSync(llmPath, 'utf-8')

      expect(content).toContain('concerts.json')
      expect(content).toContain('artists-metadata.json')
      expect(content).toContain('venues-metadata.json')
      expect(content).toContain('discography.json')
    })

    it('should explain deep linking patterns', () => {
      const llmPath = path.join(publicDir, 'llm.txt')
      const content = fs.readFileSync(llmPath, 'utf-8')

      expect(content).toContain('Deep Linking')
      expect(content).toContain('?scene=')
      expect(content).toContain('artist=')
      expect(content).toContain('venue=')
    })

    it('should have usage policy section', () => {
      const llmPath = path.join(publicDir, 'llm.txt')
      const content = fs.readFileSync(llmPath, 'utf-8')

      expect(content).toContain('Usage Policy')
      expect(content).toContain('AI Training')
      expect(content).toContain('Attribution')
    })

    it('should distinguish personal vs authoritative data', () => {
      const llmPath = path.join(publicDir, 'llm.txt')
      const content = fs.readFileSync(llmPath, 'utf-8')

      expect(content).toContain('Personal Experience')
      expect(content).toContain('Authoritative Data')
    })

    it('should have current stats (updated by update:meta)', () => {
      const llmPath = path.join(publicDir, 'llm.txt')
      const content = fs.readFileSync(llmPath, 'utf-8')

      // Should have stats that match pattern (may include commas and + signs)
      expect(content).toMatch(/[\d,]+\+? concerts/)
      expect(content).toMatch(/[\d,]+\+? artists/)
      expect(content).toMatch(/[\d,]+\+? venues/)
      expect(content).toMatch(/[\d,]+\+? albums/)

      // Should have last updated date
      expect(content).toMatch(/\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/)
    })
  })

  describe('index.html Meta Tags', () => {
    it('should exist', () => {
      expect(fs.existsSync(indexHtmlPath)).toBe(true)
    })

    it('should have complete basic meta tags', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      expect(content).toContain('<meta charset="UTF-8"')
      expect(content).toContain('<meta name="viewport"')
      expect(content).toContain('<meta name="description"')
      expect(content).toContain('<meta name="author"')
      expect(content).toContain('<meta name="keywords"')
      expect(content).toContain('<link rel="canonical"')
    })

    it('should have complete Open Graph tags', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      expect(content).toContain('og:type')
      expect(content).toContain('og:url')
      expect(content).toContain('og:title')
      expect(content).toContain('og:description')
      expect(content).toContain('og:image')
      expect(content).toContain('og:site_name')
      expect(content).toContain('og:locale')
    })

    it('should have Twitter Card tags', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      expect(content).toContain('twitter:card')
      expect(content).toContain('twitter:title')
      expect(content).toContain('twitter:description')
      expect(content).toContain('twitter:image')
    })

    it('should have RSS feed discovery link', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      expect(content).toContain('application/rss+xml')
      expect(content).toContain('/rss.xml')
    })

    it('should have JSON data endpoint discovery link', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      expect(content).toContain('application/json')
      expect(content).toContain('/data/concerts.json')
    })
  })

  describe('Schema.org JSON-LD', () => {
    it('should be present in index.html', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      expect(content).toContain('application/ld+json')
      expect(content).toContain('@context')
      expect(content).toContain('https://schema.org')
    })

    it('should have valid JSON syntax', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      // Extract JSON-LD
      const jsonLdMatch = content.match(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
      )

      expect(jsonLdMatch).not.toBeNull()

      if (jsonLdMatch) {
        const jsonLdContent = jsonLdMatch[1]

        // Should parse without errors
        expect(() => JSON.parse(jsonLdContent)).not.toThrow()

        const parsed = JSON.parse(jsonLdContent)

        // Validate required fields
        expect(parsed['@context']).toBe('https://schema.org')
        expect(parsed['@type']).toBe('CollectionPage')
        expect(parsed.name).toBeTruthy()
        expect(parsed.description).toBeTruthy()
        expect(parsed.url).toBeTruthy()
      }
    })

    it('should have MusicEventSeries with current stats', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      const jsonLdMatch = content.match(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
      )

      if (jsonLdMatch) {
        const parsed = JSON.parse(jsonLdMatch[1])

        expect(parsed.mainEntity).toBeDefined()
        expect(parsed.mainEntity['@type']).toBe('MusicEventSeries')
        expect(parsed.mainEntity.numberOfEvents).toBeGreaterThan(0)
        expect(parsed.mainEntity.startDate).toMatch(/\d{4}-\d{2}-\d{2}/)
        expect(parsed.mainEntity.endDate).toMatch(/\d{4}-\d{2}-\d{2}/)
        expect(parsed.mainEntity.performer.numberOfItems).toBeGreaterThan(0)
      }
    })

    it('should have hasPart with all scenes and About page', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      const jsonLdMatch = content.match(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
      )

      if (jsonLdMatch) {
        const parsed = JSON.parse(jsonLdMatch[1])

        expect(parsed.hasPart).toBeDefined()
        expect(parsed.hasPart).toHaveLength(7) // 5 scenes + How It Works + About page

        const sceneNames = parsed.hasPart.map((scene: any) => scene.name)
        expect(sceneNames).toContain('Timeline')
        expect(sceneNames).toContain('Artists')
        expect(sceneNames).toContain('Venues')
        expect(sceneNames).toContain('Geography')
        expect(sceneNames).toContain('Genres')
        expect(sceneNames).toContain('About the Archive')
      }
    })

    it('should have SearchAction potentialAction', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      const jsonLdMatch = content.match(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
      )

      if (jsonLdMatch) {
        const parsed = JSON.parse(jsonLdMatch[1])

        expect(parsed.potentialAction).toBeDefined()
        expect(parsed.potentialAction['@type']).toBe('SearchAction')
        expect(parsed.potentialAction.target.urlTemplate).toContain('?scene=artists&artist=')
      }
    })

    it('should have recent dateModified', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      const jsonLdMatch = content.match(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
      )

      if (jsonLdMatch) {
        const parsed = JSON.parse(jsonLdMatch[1])

        expect(parsed.dateModified).toMatch(/\d{4}-\d{2}-\d{2}/)

        // Should be within last 30 days (assuming update:meta runs regularly)
        const modifiedDate = new Date(parsed.dateModified)
        const now = new Date()
        const daysDiff = (now.getTime() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24)

        expect(daysDiff).toBeLessThan(30)
      }
    })
  })

  describe('Stats Consistency', () => {
    it('should have matching concert counts across files', () => {
      const indexContent = fs.readFileSync(indexHtmlPath, 'utf-8')
      const llmContent = fs.readFileSync(path.join(publicDir, 'llm.txt'), 'utf-8')

      // Extract concert count from index.html Schema.org
      const jsonLdMatch = indexContent.match(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
      )

      if (jsonLdMatch) {
        const parsed = JSON.parse(jsonLdMatch[1])
        const concertCountIndex = parsed.mainEntity.numberOfEvents

        // Extract concert count from llm.txt
        const llmConcertMatch = llmContent.match(/(\d+) concerts/)
        expect(llmConcertMatch).not.toBeNull()

        if (llmConcertMatch) {
          const concertCountLlm = parseInt(llmConcertMatch[1])

          // Counts should match
          expect(concertCountIndex).toBe(concertCountLlm)
        }
      }
    })

    it('should have matching artist counts across files', () => {
      const indexContent = fs.readFileSync(indexHtmlPath, 'utf-8')
      const llmContent = fs.readFileSync(path.join(publicDir, 'llm.txt'), 'utf-8')

      const jsonLdMatch = indexContent.match(
        /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
      )

      if (jsonLdMatch) {
        const parsed = JSON.parse(jsonLdMatch[1])
        const artistCountIndex = parsed.mainEntity.performer.numberOfItems

        const llmArtistMatch = llmContent.match(/(\d+) artists/)
        expect(llmArtistMatch).not.toBeNull()

        if (llmArtistMatch) {
          const artistCountLlm = parseInt(llmArtistMatch[1])
          expect(artistCountIndex).toBe(artistCountLlm)
        }
      }
    })
  })

  describe('OG Image', () => {
    it('should reference valid OG image URL', () => {
      const content = fs.readFileSync(indexHtmlPath, 'utf-8')

      const ogImageMatch = content.match(/og:image" content="([^"]+)"/)
      expect(ogImageMatch).not.toBeNull()

      if (ogImageMatch) {
        const ogImageUrl = ogImageMatch[1]
        expect(ogImageUrl).toBe('https://concerts.morperhaus.org/og-image.jpg')
      }
    })

    it('should have og-image.jpg in public directory', () => {
      const ogImagePath = path.join(publicDir, 'og-image.jpg')
      expect(fs.existsSync(ogImagePath)).toBe(true)
    })
  })
})
