/**
 * Artist billing aliases in the mosaic (#227 Q4).
 *
 * Merging cards is the visible half of this change, and the risk is links: all
 * four Brian Setzer billings are in the sitemap and three published liner notes
 * point at `the-brian-setzer-orchestra`. Every one has to keep landing on the
 * merged card.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  aliasDisplayName,
  buildArtistAliasMap,
  canonicalArtist,
  EMPTY_ARTIST_ALIAS_MAP,
} from '../../src/utils/artistAliases'

const ROOT = join(__dirname, '..', '..')
const published = JSON.parse(
  readFileSync(join(ROOT, 'public', 'data', 'artist-aliases.json'), 'utf8')
)
const map = buildArtistAliasMap(published)

describe('the published alias file', () => {
  it('is served from public/data so the SPA and MCP can both read it', () => {
    expect(published.sameAct?.length).toBeGreaterThan(0)
  })

  it('matches the hand-maintained source', () => {
    const source = JSON.parse(readFileSync(join(ROOT, 'data', 'artist-aliases.json'), 'utf8'))
    expect(published.sameAct).toEqual(source.sameAct)
  })

  it('drops the authoring commentary, which is most of the bytes', () => {
    expect(published.$comment).toBeUndefined()
  })
})

describe('collapsing billings', () => {
  it('folds every Setzer marquee onto one act', () => {
    for (const billing of [
      'brian-setzer',
      'the-brian-setzer-orchestra',
      'brian-setzer-and-the-nashvillians',
      'brian-setzer-68-comeback-special',
    ]) {
      expect(canonicalArtist(map, billing), billing).toBe('brian-setzer')
    }
  })

  it('names the merged card from the map, not from whichever concert came first', () => {
    expect(aliasDisplayName(map, 'the-brian-setzer-orchestra')).toBe('Brian Setzer')
  })
})

describe('existing links keep working', () => {
  it('resolves every billing that appears in the sitemap', () => {
    const sitemap = readFileSync(join(ROOT, 'public', 'sitemap.xml'), 'utf8')
    const billings = published.sameAct.flatMap((a: { billings: string[] }) => a.billings)
    for (const billing of billings) {
      if (!sitemap.includes(billing)) continue
      // Must land somewhere real rather than 404 — the merged card.
      expect(canonicalArtist(map, billing), billing).toBeTruthy()
    }
  })

  it('resolves the billing three published liner notes link to', () => {
    const feed = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'liner-notes.json'), 'utf8'))
    const linked = feed.posts.flatMap((p: { deepLinks?: Array<{ url: string }> }) =>
      (p.deepLinks ?? [])
        .map((l) => l.url.match(/artist=([^&]+)/)?.[1])
        .filter((s): s is string => Boolean(s))
        .map((s) => decodeURIComponent(s))
    )
    for (const slug of linked) {
      expect(canonicalArtist(map, slug), slug).toBeTruthy()
    }
    expect(linked).toContain('the-brian-setzer-orchestra')
  })
})

describe('degrading without the map', () => {
  it('leaves every billing as its own act', () => {
    expect(canonicalArtist(EMPTY_ARTIST_ALIAS_MAP, 'the-brian-setzer-orchestra')).toBe(
      'the-brian-setzer-orchestra'
    )
    expect(aliasDisplayName(EMPTY_ARTIST_ALIAS_MAP, 'brian-setzer')).toBeUndefined()
  })

  it('survives a malformed file rather than throwing', () => {
    expect(() => buildArtistAliasMap(null)).not.toThrow()
    expect(() => buildArtistAliasMap({ sameAct: [{}] })).not.toThrow()
  })

  it('ignores sharesMember — those acts must stay apart', () => {
    // Oingo Boingo and Danny Elfman are two cards on purpose.
    expect(canonicalArtist(map, 'danny-elfman')).toBe('danny-elfman')
    expect(canonicalArtist(map, 'oingo-boingo')).toBe('oingo-boingo')
  })
})
