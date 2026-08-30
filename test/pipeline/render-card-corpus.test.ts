/**
 * The renderer against the REAL corpus — every published post, no browser.
 *
 * WHY THIS FILE EXISTS. Two bugs shipped past a full green unit suite on 2026-08-28 and
 * died the moment the renderer was pointed at real data:
 *
 *   1. `renderCard` refused any post without archive photography. 53 of 58 published posts
 *      carry a press shot or an album cover, so the first real run would have dropped
 *      nearly the whole feed.
 *   2. It re-resolved the tier-1 asset itself, walking past the venue gates in
 *      `resolveImage` and `upgradeToOwnPhotography` — a `venue-loyalty` post about a
 *      demolished venue drew a Howard Jones frame from a different venue six years later.
 *
 * Neither is about DRAWING. Both are about which image gets picked, which is pure and cheap
 * to check — so the expensive half (a browser, a network fetch, 58 screenshots) is not what
 * this needs. Fixtures could not have caught either: a fixture written alongside the broken
 * code encodes the same mistake, which is the lesson `liner-notes-region-mapping.test.ts`
 * already records for #232.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { classifyImageUrl } from '../../scripts/syndication/provenance'
import { VENUE_SUBJECT_DETECTORS } from '../../scripts/liner-notes/image-refs'
import type { LinerNotesPost } from '../../src/types/liner-notes'

const posts: LinerNotesPost[] =
  JSON.parse(readFileSync('public/data/liner-notes.json', 'utf8')).posts

/** What the renderer takes as its image, mirrored: url, crop and capture date off the post. */
const sourceFor = (p: LinerNotesPost) =>
  p.image?.url ? { url: p.image.url, crop: p.image.crop, date: p.image.shotOn } : undefined

describe('every published post can produce a card', () => {
  it('has an image the renderer will accept', () => {
    // BUG 1. Refusing tier 2 left 5 of 58 renderable. "Never bare type" means every post
    // has an image, and the renderer has to be able to use whichever one it is.
    const without = posts.filter((p) => !sourceFor(p)).map((p) => p.slug)
    expect(without).toEqual([])
  })

  it('has an image whose host or path classifies', () => {
    // An unclassified source throws in the renderer, which at post time means a dropped
    // post. A new CDN appearing is a thing to notice here rather than at 10am.
    const unclassified = posts
      .filter((p) => !classifyImageUrl(p.image?.url))
      .map((p) => `${p.slug} → ${p.image?.url}`)
    expect(unclassified).toEqual([])
  })

  it('has an authored hook, without which no card can be drawn', () => {
    expect(posts.filter((p) => !p.social?.hook?.trim()).map((p) => p.slug)).toEqual([])
  })
})

describe('the tier the renderer draws matches the tier the pipeline chose', () => {
  it('agrees on every post', () => {
    // BUG 2. The renderer re-derived tier and could disagree with the pipeline. It draws
    // `post.image` now, so these cannot diverge — and if someone reintroduces a lookup,
    // this is what fails.
    const disagree = posts
      .map((p) => ({
        slug: p.slug,
        stored: p.image.source,
        tier: classifyImageUrl(p.image.url)?.tier,
      }))
      .filter((r) => (r.stored === 'show') !== (r.tier === 1))
    expect(disagree).toEqual([])
  })

  it('NEVER puts the archive\'s own photography on a venue-subject post', () => {
    // The gate that was bypassed. venue-loyalty and venue-ghost carry an artists array, so
    // artists[0] is whoever sorts first — on both Universal Amphitheater posts that is
    // Howard Jones, photographed in 2024 at a venue demolished years earlier.
    const wrong = posts
      .filter((p) => VENUE_SUBJECT_DETECTORS.has(p.detector) && p.image.source === 'show')
      .map((p) => `${p.slug} (${p.detector}) → ${p.image.url}`)
    expect(wrong).toEqual([])
  })
})

describe('a tier-1 post carries what the tier-1 path needs', () => {
  /* ⚠️ VACUOUS TODAY, ON PURPOSE. `liner-notes.json` was generated 2026-08-24, before
     `upgradeToOwnPhotography` existed, so no published post carries `source: "show"` yet —
     these pass over an empty set. They become real on the next pipeline run, when five posts
     are promoted. Asserted rather than skipped because the day they start doing work is the
     day the data changes, and a skipped test would stay skipped. */
  it('records how many tier-1 posts these actually cover', () => {
    const tier1 = posts.filter((p) => p.image.source === 'show').length
    expect(tier1).toBeGreaterThanOrEqual(0)
    if (tier1 === 0) console.warn('[corpus] no tier-1 posts yet — the assertions below are vacuous')
  })

  it('has a crop box and a capture date on every show image', () => {
    // The renderer REFUSES an uncropped tier-1 asset rather than centre-cropping, because
    // that failure is invisible — the card renders and the head is gone. A tier-1 post
    // without a box is therefore a post that cannot publish.
    const bad = posts
      .filter((p) => p.image.source === 'show')
      .filter((p) => !p.image.crop || !p.image.shotOn)
      .map((p) => `${p.slug}: crop=${!!p.image.crop} shotOn=${p.image.shotOn ?? 'none'}`)
    expect(bad).toEqual([])
  })

  it('carries a byline on tier 1 and none on tier 2', () => {
    // The absence on tier 2 is what makes personal imagery visibly outrank a press shot.
    const wrong = posts
      .filter((p) => (p.image.source === 'show') !== Boolean(p.image.credit))
      .map((p) => `${p.slug}: source=${p.image.source} credit=${p.image.credit ?? 'none'}`)
    expect(wrong).toEqual([])
  })
})

describe('the card and its alt text describe the SAME show', () => {
  it('agrees on every published post', async () => {
    // THE BUG. `cardAlt` used the payload's `resolveAnchorConcert`; the renderer overrode it
    // for a tier-1 card so the credit stack would follow the photograph. On
    // `crowded-house-from-opener-to-headliner` the card said "The Wiltern · May 2023" and its
    // own alt said "Olympic Velodrome, Carson, 18 September 1993" — a screen-reader user got
    // a different show from a sighted one. Accessibility failure first, factual second.
    //
    // `cardConcert` is the one rule now. This asserts the two callers cannot drift again.
    const { cardConcert, buildCredit, cardAlt } = await import('../../scripts/syndication/payload')
    const concerts = JSON.parse(readFileSync('public/data/concerts.json', 'utf8')).concerts
    const sources = {
      concerts,
      artistsMetadata: JSON.parse(readFileSync('public/data/artists-metadata.json', 'utf8')),
      venuesMetadata: JSON.parse(readFileSync('public/data/venues-metadata.json', 'utf8')),
    } as never

    const mismatched: string[] = []
    for (const post of posts) {
      const concert = cardConcert(post, concerts, post.image?.shotOn)
      if (!concert) continue
      const alt = cardAlt(post, buildCredit(post, concert, sources))
      /* The invariant is that the alt names the concert `cardConcert` chose — NOT that it
         names the photograph's venue. Those differ on purpose: a post about ONE night names
         that night in both card and alt, and the byline separately states when the picture
         was taken. `the-human-league-8-more-2018-festival-bill` is exactly that case — a
         2026 photograph on a post about the 2018 festival — and asserting the venue would
         have failed a correct card. */
      if (!alt.includes(concert.venue)) {
        mismatched.push(`${post.slug}: card night is ${concert.venue} ${concert.date}, alt says "${alt.slice(0, 60)}…"`)
      }
    }
    expect(mismatched).toEqual([])
  })

  /**
   * #443. Two separate faults, both reachable only once a post gains a tier-1 photograph
   * from a night other than its own — which is why neither appeared until culling reached
   * a second show for the same act.
   */
  it('the credit names ONE show — venue and date never come from different nights', async () => {
    const { cardConcert, buildCredit } = await import('../../scripts/syndication/payload')
    const concerts = JSON.parse(readFileSync('public/data/concerts.json', 'utf8')).concerts
    // Held separately from `sources` so it stays readable — `sources` is cast to `never`
    // to satisfy the builder's shape, which makes reading a property back off it a
    // typecheck error rather than a lookup.
    const venuesMetadata: Record<string, { name?: string }> =
      JSON.parse(readFileSync('public/data/venues-metadata.json', 'utf8'))
    const sources = {
      concerts,
      artistsMetadata: JSON.parse(readFileSync('public/data/artists-metadata.json', 'utf8')),
      venuesMetadata,
    } as never

    const mixed: string[] = []
    for (const post of posts) {
      const concert = cardConcert(post, concerts, post.image?.shotOn)
      if (!concert) continue
      const credit = buildCredit(post, concert, sources)
      // The date is taken straight off the concert, so the venue has to be too. When they
      // disagreed the card announced "Hard Rock Cafe · November 2017" — a venue from a 1995
      // show and a date from a 2017 one, a night that never happened.
      const named = venuesMetadata[concert.venueNormalized]?.name ?? concert.venue
      if (credit.venue !== named || credit.date !== concert.date) {
        mixed.push(`${post.slug}: credit says ${credit.venue} · ${credit.date}, concert is ${named} · ${concert.date}`)
      }
    }
    expect(mixed).toEqual([])
  })

  it('a venue photograph is of the venue the card NAMES', async () => {
    /* The Kia Forum on a post about Irvine Meadows. `upgradeVenuePosts` took the first
       venue in the list that happened to have a photo — a different question from which
       venue the card names — and a 16-venue post walked past Irvine Meadows, which is
       tract housing now, to find one that did.

       A photograph of the wrong building under the right name is the same fabrication as a
       byline naming the wrong night, in the element a reader takes in first. */
    const { cardConcert } = await import('../../scripts/syndication/payload')
    const concerts = JSON.parse(readFileSync('public/data/concerts.json', 'utf8')).concerts

    const wrong: string[] = []
    for (const post of posts) {
      if (post.image?.source !== 'venue' || !post.image.ref) continue
      const concert = cardConcert(post, concerts, post.image?.shotOn)
      if (!concert) continue
      if (post.image.ref !== concert.venueNormalized) {
        wrong.push(`${post.slug}: card names ${concert.venueNormalized}, photograph is of ${post.image.ref}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('a post naming one year and one venue is about THAT night, setlist or not', async () => {
    // A `?show=` link means "setlist.fm has this night", not "this post is about one
    // night". 12 of 58 posts name a single year and a single venue while carrying no link,
    // and reading that absence as "span" let the card follow a photograph from another
    // decade. `the-brian-setzer-orchestra-days-after-the-bends-dropped` is the case: Hard
    // Rock Cafe, 1995, days after The Bends — no setlist exists for it.
    const { cardConcert } = await import('../../scripts/syndication/payload')
    const concerts = JSON.parse(readFileSync('public/data/concerts.json', 'utf8')).concerts

    const wrong: string[] = []
    for (const post of posts) {
      if (post.years?.length !== 1 || post.venues?.length !== 1) continue
      // Ask as if a photograph from an unrelated night were attached.
      const concert = cardConcert(post, concerts, '2024-08-20')
      if (!concert) continue
      if (concert.year !== post.years[0]) {
        wrong.push(`${post.slug}: post names ${post.years[0]}, card would name ${concert.date}`)
      }
    }
    expect(wrong).toEqual([])
  })
})
