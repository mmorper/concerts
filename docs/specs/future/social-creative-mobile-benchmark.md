# Social Creative — Mobile Benchmark

**Status:** Review, no code changes yet. Recommendations for discussion.
**Specimen:** Bluesky, On This Day, The Roots · NMAAHC · 2016-09-24 (posted 2026-09-24).
**Renderer under review:** `scripts/syndication/render-card.ts` → `wideSplit()` (1200×630),
posted by `scripts/syndication/adapters/bluesky.ts` as an `app.bsky.embed.external` link card.

---

## What the reader actually sees

On an iPhone the link card renders roughly 360pt wide, so every pixel on the 1200px canvas
shows at about **0.30×**:

| Element | Canvas px | On phone (≈pt) | Verdict |
|---|---|---|---|
| Hook (Playfair, ramp 50→27) | 46–50 | ~14–15 | Readable, but smaller than the post text above it |
| Act pill ("THE ROOTS") | 24 | ~7 | Tiny. The artist, the one thing a scroller recognises, is nearly the smallest element |
| Venue · city · month line | 21 | ~6 | Not readable |
| `concerts.morperhaus.org` wordmark | 18 | ~5 | Not readable; also repeated twice below the card |
| Photo byline pill | 16 | ~5 | Not readable. **On tier-2 (press) images it renders as an empty pill** — the grey dash bottom-left of the photo |

The whole card occupies about **190pt of an ~850pt screen — ~22%**. Everything else in the
post is text.

## Reactions

1. **The same sentence appears three times.** Post text ("…Living Colour and Public Enemy
   went with them"), the card hook ("Living Colour and Public Enemy opened, and I've never
   gone back to see either one."), and the link-card title (identical to the hook). On a
   phone these stack vertically within one thumb-length; the repetition is the most
   noticeable thing about the post.
2. **Hierarchy is inverted for a feed.** The hook is the largest type; the artist is a 7pt
   pill. `scripts/on-this-day/card.ts` itself records the opposite rule — "the artist is the
   largest thing… at feed scale it is the only text a scrolling reader reliably takes in"
   (DECISIONS.md §11) — but the wide split doesn't honour it.
3. **Half the canvas is type most readers can't read.** The 570px column was designed at
   desktop scale. At 0.30× only the hook survives.
4. **The photograph is the strongest asset and gets the least room** — a ~180pt square.
5. **The link-card format caps visual presence.** A 1.91:1 external embed is the shortest
   thing Bluesky will draw full-width. We already render a **1080×1350 (4:5) full-bleed**
   card for Instagram (`fullBleed()`), which is exactly the mobile-native shape.
6. **Text nits.** The trailing bare `concerts.morperhaus.org/` duplicates the link card;
   `#NationalMuseumOfAfricanAmericanHistoryAndCulture` wraps mid-word and reads as noise;
   "went with them" is ambiguous (reads as if the openers left with the band).
7. **Contrast.** `#8a80ab` meta and `#5d5480` wordmark on `#14111f` are low-contrast even
   before the 0.30× scale.

## Benchmark: screen share by format (same ~360pt width)

| Format | Aspect | Height | Share of screen | vs. today |
|---|---|---|---|---|
| Link card (today) | 1.91:1 | ~190pt | ~22% | 1.0× |
| Native image, square | 1:1 | ~360pt | ~42% | ~1.9× |
| Native image, portrait | 4:5 | ~450pt | ~53% | ~2.4× |

Portrait native images are how photo-led accounts win the mobile feed. Must verify in-app
how Bluesky and Mastodon clients crop or cap tall single images before committing to 4:5.

**The trade-off:** Bluesky allows an image embed *or* an external link card, not both. A
native image means the link lives only as a text facet — bigger visual, smaller tap target.
Since the channel's job is clicks back to the site (POSSE), this should be decided by data,
not taste.

## Recommendations

Ordered by cost.

### Quick fixes (no format change)

- **Don't render the byline pill when there's no byline** (tier 2). It's a visible artifact
  on every press-shot card.
- **Stop repeating the hook.** Give each layer a different job:
  - Post text: the story (authored copy, as now).
  - Card: identity — artist name large, date/venue, photograph.
  - Link-card title/description: artist · venue · date, i.e. the factual line, not the hook.
- **Drop the bare URL from the post text** when a link card is attached; keep hashtags to
  1–2 short ones (skip venue tags longer than ~20 characters).

### Redesign the wide card for 0.30× (if we keep link cards)

- Artist name becomes the headline type (~64–80px → ~20–24pt on phone).
- Hook moves off the card (it's already in the post text) or shrinks to one line.
- Anything under ~40px on the canvas is either removed or made ≥40px. Drop the wordmark
  (the domain is printed under the card by the client).
- Give the photograph more width, e.g. a 3:2 or full-bleed image with a scrim instead of
  the 630/570 split.

### Test native portrait images (the bigger lever)

- Bluesky: post the existing 4:5 `fullBleed` render as `app.bsky.embed.images` with
  `aspectRatio`, link as a facet in the text. Mastodon: attach the 4:5 image; link stays in
  the status.
- Run it as an A/B: alternate formats across the next ~8–10 posts per stream and compare
  UTM clicks (`utm_source=bluesky&utm_medium=social`) and likes/reposts per post. Pick the
  winner on clicks, not impressions.
- Before the test: one private test post per channel to confirm 4:5 isn't cropped.

## Open questions for the owner

1. Is the goal of these posts primarily **clicks** or **presence/brand**? That decides the
   link card vs. native image trade.
2. OK to change the link-card title away from the hook (it's also what Bluesky shows for
   anyone who reshares the URL)?
3. Should On This Day and liner notes keep different card looks, or converge on one
   mobile-first template with a date masthead variant?
