# Portrait Posts, Opener Mentions and Genre Tags

**Status:** Spec, approved direction (owner, 2026-09-26). Not started.
**Priority:** High. Every post ships with the current creative until this lands.
**Complexity:** Medium. Bluesky and Mastodon adapters, handles, tags, and the On This Day payload.
**Depends on:** #543 (main's CI), the existing 4:5 `fullBleed` renderer.
**Background:** [`social-creative-mobile-benchmark.md`](social-creative-mobile-benchmark.md)
**Mock:** Option B in the benchmark mock, The Roots · NMAAHC · 2016-09-24.

---

## Why

Nearly everyone sees these posts on a phone. There, today's 1200×630 link card takes about
22% of the screen, and most of its type renders at 5–7pt. The owner's goals, in order:

1. Clicks to the archive
2. Engagement (replies, reposts, likes)

The owner chose the full-width portrait photo (Option B) on how it looks. Opener mentions
and genre tags are there for engagement and discovery. Clicks get watched after the switch
(see *Measuring it*).

## What changes

### 1. Bluesky posts a 4:5 image instead of a link card

- Render the existing `FORMATS` 4:5 full-bleed card (`fullBleed()` in
  `scripts/syndication/render-card.ts`) for Bluesky and Mastodon, not `FORMATS.wide`.
- Post it as `app.bsky.embed.images` with `aspectRatio: { width: 1080, height: 1350 }` and
  the card's `alt`. The `app.bsky.embed.external` link card goes away.
- The link becomes a facet in the text, with the display text **"Setlist and the full night →"**
  (liner notes: **"Read the note →"**). The facet carries the full UTM'd URL as it does today.
- The byline pill only renders when there is a byline. Today tier-2 cards draw an empty pill.
- **Card type for On This Day:** the eyebrow is the date line ("Ten years ago today"). Below
  it, the artist name is the display type, then the bill ("with Living Colour & Public
  Enemy"), then venue · city. The hook does **not** go on the card, since it's already in
  the post text.
- **Before the first live post:** make one private test post per channel and confirm the
  app shows the 4:5 image uncropped. If a client crops it, record what it does here before
  shipping.

### 2. Mentions: up to two, openers included

`mentionForPost()` in `scripts/syndication/handles.ts` returns one mention today, headliner
first and venue second. Change it to `mentionsForPost()`, which returns up to two:

1. The headliner, if it has a verified handle
2. The venue, if it has a verified handle
3. Each opener with a verified handle **whose name appears in the post text**

Take the first two, in that order.

- **Only verified handles** from `data/social-handles.json`, as now. Nothing is guessed at
  post time.
- **An opener must be named in the text.** Tagging an act the post doesn't talk about reads
  as spam, and it's the kind of thing a stranger reports.
- **On This Day refs gain openers.** `buildOnThisDayPayload` sets
  `refs: { artists: [post.artistNormalized], ... }`. It should carry the full bill from
  `concerts.json`, with the headliner first, so openers can be found.
- On Bluesky, mentions go on the tag line and are addressed by DID, as now. On Mastodon, a
  mention needs a Mastodon handle. Where there isn't one, skip the mention and let hashtags
  carry the post.

**Example (the mocked post):** The Roots and the museum have no handles. Living Colour
(`livingcolour.com`) and Public Enemy (`publicenemyno1.bsky.social`) are both verified and
both named in the caption, so both get mentioned.

### 3. Hashtags: artist, then genre; long tags dropped

`entityTags()` in `scripts/syndication/tags.ts` builds tags from the artist, venue, city and
decade.

- **Add one genre tag** from a short curated map of the show's `genre` to a broad,
  followed tag. For example: Alternative Hip Hop, Political Hip Hop, Hip Hop and Rap →
  `#HipHop`; New Wave and New Wave Pop → `#NewWave`; Post Punk → `#PostPunk`. A genre not
  in the map gets no tag. The map is reviewed by hand like the handles file, and the tag is
  never made up at post time.
- **Order on Bluesky:** artist, then genre. On Mastodon (4–5 tags): artist, genre, city,
  decade, venue.
- **Drop any tag longer than 20 characters** (after `#`). That is what removes
  `#NationalMuseumOfAfricanAmericanHistoryAndCulture`.
- The rule that detector tags never ship stays as it is.

### 4. Bluesky text budget

`CAPTION_MAX` stays at 200. What gets appended changes:

| Part | Worst case | The Roots post |
|---|---|---|
| Caption | 200 | 160 |
| Link display text | 28 | 28 |
| Two mentions | ~64 | 45 |
| Two tags | ~35 | 17 |
| Line breaks | 3 | 3 |

The worst case goes over 300. When a post is too long, the adapter trims in this order until
it fits:

1. The genre tag
2. The second mention
3. The artist tag

The caption and the link are never trimmed. `budgets.ts` gets the new arithmetic and a
comment explaining it, and the adapter still asserts the 300-grapheme limit before posting.

### 5. Contact sheet

`npm run contact-sheet` should show the 4:5 image, the link facet text, and the mentions
exactly as the adapters will build them. It already calls the adapters' own compose
functions, so this mostly works once those functions change.

## Not changing

- Retraction and correction. Both use post IDs from the ledger and don't depend on the
  embed type. `--correct` must re-render the 4:5 card before it deletes anything, as it
  does now.
- The kill switch, schedule, and ledger.
- Instagram, which already uses 4:5.

## Measuring it

B is the default from the first post. Over the next ten posts, compare against the last ten
link-card posts:

| Metric | Source | Decision |
|---|---|---|
| Clicks per post | GA4, `utm_source=bluesky` / `mastodon`, `utm_medium=social` | If clicks fall clearly, add the link card as the first reply under each post |
| Replies + reposts per post | Platform stats | Expected to rise |
| Reposts by tagged accounts | Platform stats | Decides whether opener mentions stay |

Ten posts is a small sample, so read the numbers as directional.

## Tests

- `mentionsForPost`: ordering, the cap at two, the named-in-text rule, and no unverified
  handles
- The genre map: a mapped genre, an unmapped genre (no tag), and dropping tags over 20
  characters
- Bluesky compose: the trim order at the 300 limit; an images embed with `aspectRatio`, and
  no external embed
- Render: the tier-2 card has no byline pill
- The On This Day payload carries openers in `refs`
