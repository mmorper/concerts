import { rmSync } from "fs";
import { join } from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateOgImages } from '../../scripts/liner-notes/og-image.ts'
import type { LinerNotesPost } from '../../src/types/liner-notes.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OG_DIR = path.join(__dirname, '../../public/og/liner-notes')

/**
 * Covers the two defects found in #216's neighbourhood:
 *   - cards were skipped whenever a PNG existed, which made Stage 5c's
 *     "regenerate repaired posts" hand-off a silent no-op (#252)
 *   - the background fetch was unbounded, so one slow CDN could stall the
 *     weekly workflow until GitHub's 6-hour job timeout
 */

function post(slug: string): LinerNotesPost {
  return {
    slug,
    headline: 'Test Headline',
    category: 'personal',
    years: [1999, 2005],
    image: { url: 'https://cdn.test/img.jpg', alt: 'Alt', source: 'venue', ref: 'v' },
  } as LinerNotesPost
}

describe('generateOgImages', () => {
  const created: string[] = []

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response))
  })

  afterEach(() => {
    for (const f of created.splice(0)) fs.rmSync(f, { force: true })
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function tempSlug(name: string) {
    const slug = `zz-ogtest-${name}`
    created.push(path.join(OG_DIR, `${slug}.png`))
    return slug
  }

  it('generates a card for a post that has none', async () => {
    const slug = tempSlug('new')
    await generateOgImages([post(slug)])
    expect(fs.existsSync(path.join(OG_DIR, `${slug}.png`))).toBe(true)
  })

  it('skips a post whose card already exists', async () => {
    const slug = tempSlug('existing')
    const out = path.join(OG_DIR, `${slug}.png`)
    await generateOgImages([post(slug)])
    const first = fs.statSync(out).mtimeMs

    await new Promise((r) => setTimeout(r, 10))
    await generateOgImages([post(slug)])

    expect(fs.statSync(out).mtimeMs).toBe(first)
  })

  /**
   * The regression this file exists for. Without `force`, Stage 8 handed
   * repaired posts to a function that skipped every one of them.
   */
  it('rebuilds an existing card when the slug is in `force`', async () => {
    const slug = tempSlug('forced')
    const out = path.join(OG_DIR, `${slug}.png`)
    await generateOgImages([post(slug)])
    const first = fs.statSync(out).mtimeMs

    await new Promise((r) => setTimeout(r, 10))
    await generateOgImages([post(slug)], { force: [slug] })

    expect(fs.statSync(out).mtimeMs).toBeGreaterThan(first)
  })

  it('only rebuilds the slugs listed in `force`', async () => {
    const forced = tempSlug('multi-forced')
    const untouched = tempSlug('multi-untouched')
    await generateOgImages([post(forced), post(untouched)])
    const before = {
      forced: fs.statSync(path.join(OG_DIR, `${forced}.png`)).mtimeMs,
      untouched: fs.statSync(path.join(OG_DIR, `${untouched}.png`)).mtimeMs,
    }

    await new Promise((r) => setTimeout(r, 10))
    await generateOgImages([post(forced), post(untouched)], { force: [forced] })

    expect(fs.statSync(path.join(OG_DIR, `${forced}.png`)).mtimeMs).toBeGreaterThan(before.forced)
    expect(fs.statSync(path.join(OG_DIR, `${untouched}.png`)).mtimeMs).toBe(before.untouched)
  })

  it('bounds the background fetch with an abort signal', async () => {
    const slug = tempSlug('timeout')
    await generateOgImages([post(slug)])

    expect(fetch).toHaveBeenCalledWith(
      'https://cdn.test/img.jpg',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('still produces a card when the image fetch fails outright', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ETIMEDOUT'))
    const slug = tempSlug('fetch-fails')

    await generateOgImages([post(slug)])

    // Falls back to the solid background rather than throwing.
    expect(fs.existsSync(path.join(OG_DIR, `${slug}.png`))).toBe(true)
  })
})

describe("card fallback reporting (#333)", () => {
  it("separates cards rendered over imagery from cards on a solid ground", async () => {
    // A card composited on a solid ground is bare type. The site still wants
    // it — a plain og:image beats a broken one — but syndication must refuse
    // it, and nothing downstream can tell from the image URL, which still
    // looks fine. generateOgImages is the only place that knows.
    const { generateOgImages } = await import("../../scripts/liner-notes/og-image.ts");

    const post = (slug: string, url: string) =>
      ({
        slug,
        headline: "A Headline",
        category: "cultural",
        years: [1986],
        image: { url, alt: "x", source: "artist" },
      }) as unknown as Parameters<typeof generateOgImages>[0][number];

    // No URL at all cannot be fetched, so it is the deterministic fallback
    // case — no network required to exercise it.
    const result = await generateOgImages([post("__fallback-probe__", "")], {
      force: ["__fallback-probe__"],
    });

    expect(result.fellBack).toContain("__fallback-probe__");
    expect(result.rendered).not.toContain("__fallback-probe__");

    rmSync(join(process.cwd(), "public/og/liner-notes/__fallback-probe__.png"), { force: true });
  });
});
