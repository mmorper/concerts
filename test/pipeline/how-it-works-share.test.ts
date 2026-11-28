/**
 * How It Works share cards. public/data/how-it-works.json is the one list of chapters: the site's
 * chapter cards, the link-preview Worker (workers/meta-injector) and `npm run og:how-it-works` all
 * read it. These checks make adding a chapter without its share card fail here, instead of the
 * chapter quietly previewing as the generic site image.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import data from '../../public/data/how-it-works.json'
import { CHAPTERS } from '../../src/components/how-it-works/chapters'

const ROOT = path.join(__dirname, '..', '..')
const pages = [data.landing, ...data.chapters]

describe('How It Works share cards', () => {
  it.each(pages.map((p) => [p.path, p]))('%s has a share title, description and card image', async (_, page) => {
    expect(page.share.title).toMatch(/\| Morperhaus Concert Archives$/)
    expect(page.share.description.length).toBeGreaterThan(40)
    expect(page.share.image).toMatch(/^\/og\/how-it-works\/[a-z0-9-]+\.jpg$/)
    const file = path.join(ROOT, 'public', page.share.image)
    expect(existsSync(file), `${page.share.image} is missing: run npm run og:how-it-works`).toBe(true)
    const { width, height } = await sharp(file).metadata()
    expect([width, height]).toEqual([1200, 630])
  })

  it('every chapter has a unique id and path under /how-it-works/, and a known kind of card', () => {
    const ids = data.chapters.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of data.chapters) {
      expect(c.path).toBe(`/how-it-works/${c.id}`)
      expect(['rendered', 'photo']).toContain(c.share.card)
    }
  })

  it('a rendered card is named after its chapter, so the script writes it where the Worker looks', () => {
    for (const c of data.chapters.filter((x) => x.share.card === 'rendered')) {
      expect(c.share.image).toBe(`/og/how-it-works/${c.id}.jpg`)
    }
  })

  it('every chapter has a page: a route in src/App.tsx', () => {
    const app = readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8')
    for (const c of data.chapters) expect(app).toContain(`path="${c.path}"`)
  })

  it("every chapter page's ChapterHeader names a chapter in the list", () => {
    const dir = path.join(ROOT, 'src', 'components', 'how-it-works')
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('Chapter.tsx'))
    const ids = files.flatMap((f) => [...readFileSync(path.join(dir, f), 'utf8').matchAll(/<ChapterHeader id="([^"]+)"/g)].map((m) => m[1]))
    expect(ids.length).toBe(data.chapters.length)
    for (const id of ids) expect(data.chapters.map((c) => c.id)).toContain(id)
  })

  it('the site shows the same chapters, in the same order', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(data.chapters.map((c) => c.id))
  })
})
