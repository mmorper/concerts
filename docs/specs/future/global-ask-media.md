# Ask the Archive: Photos and Clips

**Status:** Phases 1–3, 5 and 6 shipped (v6.2.0–v6.3.0), and media now plays inside Ask (#666). Phase 4 ("show me something") remains.
**Target Version:** next
**Priority:** Medium
**Estimated Complexity:** High
**Dependencies:** #593 exhibit media, `song` on clips (#612)

---

## Executive Summary

Ask shows photos on its cards, but its model cannot see them. No tool reads `media-index.json`
and the system prompt never mentions photos or video. So "got any photos of The Cure?" has no
honest answer, and the answer can never say "I have a clip from that night."

Clips cannot play in Ask at all. The only player is in `PhotosPanel.tsx`.

This spec gives the model the facts, adds a media tool and a gallery card, and plays clips.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement Ask the Archive: Photos and Clips for Morperhaus Concerts.

- Spec: docs/specs/future/global-ask-media.md. It is the source of truth.
- Read first: .claude/skills/media-pipeline/SKILL.md (attribution rules),
  .claude/skills/design-system/SKILL.md, .claude/skills/analytics/SKILL.md,
  docs/DEEP_LINKING.md, test/README.md (workers have their own test config).
- Build the phases in order. Each one ships on its own.

Start with Phase 1, media counts on the existing tools.
```

---

## Design Philosophy

**The tool gives identity, the site gives pixels.** This matches `exhibits.ts`: the Worker sends
ids and deep links, and the frontend hydrates from `media-index.json`.

**The owner's marks lead.** Results sort signature, then hero, then order, the same as
`leadPhoto` and `getShowAsset`. Scores are never used.

**Absence is reported honestly.** 46 of 185 shows have media, and none predate 2011. "No photos
from that night" must never read as "that show did not happen."

**An unpublished clip does not exist to Ask.** A kept clip is not a yes to showing it. Only a
clip with a `url` is counted, named or returned.

---

## Technical Implementation

### Data

Add `media-index.json` (126 KB) to the MCP worker's data layer as a lazy, cached fetch, the way
`album-eras.json` is handled. Add a typed slim view in `workers/mcp-server/src/data.ts`.

### Phase 1: media counts

Tool results are markdown, so the counts arrive as one "Media on the site" line above the footer,
from `workers/mcp-server/src/media.ts`. It credits each act, and names each clip's song:

- `get_artist_history`
- `get_concert_setlist`
- `on_this_day`
- `surprise_me`
- `get_venue_history`
- `search_concerts`, so "photos from 2023" has an answer before `get_media` exists

Add a few lines to `buildSystemPrompt` in `agent-loop.ts`: mention media when counts are present,
link to it, and never describe what a photo shows.

### Phase 2: `get_media` and the gallery card

| Input | Notes |
|---|---|
| `artist`, `venue`, `date`, `year` | All optional, combined with AND |
| `kind` | `image`, `video`, or both |
| `song` | Matches a clip's `song`, for "did you film this song?" |

Each result carries `id` (`mediaId`), `kind`, `date`, `act`, `subject`, `deepLink`, and for a clip
`duration` and `song`. Return at most 12, with a `total`.

- `act` comes from the asset. It never defaults to the headliner.
- `deepLink` uses the shape in `test/fixtures/deep-link-urls.json`.
- A `gallery` exhibit joins the union in `workers/ask-chat/src/exhibits.ts` and
  `src/types/exhibit`, with a place in `KIND_PRIORITY`.
- `AskGalleryCard` shows a grid of `FramedPhoto` tiles with `photoCaption`, so the different-night
  and different-act rules are enforced in one place.
- The MCP connector gets the same tool. It returns links, not images: the site is canonical.

### Phase 3: media opens in the gatefold

The owner's decision, 2026-11: Ask has no player and no full-screen viewer. A photo or clip opens
its exact frame in its gatefold, beside the night's other media and setlist. A viewer in Ask was a
dead end, with no way on to the video.

Shipped in #628:

- Every photo on an Ask card goes through `useFrameOpener` in `AskCardParts.tsx`.
- An act with clips gets a "Watch" link on its card.
- The Photos panel keeps its own viewer. It is where those links land.

This drops the shared `ClipPlayer`, so the panel's `<video>` block and its events (#616, #617) stay
as they are. Clip plays all happen in the gatefold, so the GA dimensions need no `surface` param.

**Reversed 2026-11-02: media plays inside Ask.** Leaving Ask for a page change, just to look at a
photo, buried the answer. The owner asked for media in the Ask modal, approved the mocks on the
design canvas ("Media in Ask": a solo photo, a solo clip, a night of both), and this replaced the
behaviour above:

- A photo or clip from any card, a gallery tile or a clip match opens `AskMediaViewer.tsx` over the
  answers. It shows the whole night (`wholeNightReel`): every act on the bill in billing order, then
  the room. An opener's frame says "opening for" the headliner (`viewerByline`).
- The old dead end is gone: the viewer pages, plays clips, shares the frame's link, and links on to
  the gatefold ("The whole night") for the setlist and the bill. Back, or Esc, returns to the answer
  scrolled where it was. A frame Ask can't find still opens in its gatefold.
- The gatefold panel and the viewer share `useMediaReel`, so their events match, and the events now
  carry `surface` (`gatefold`, `ask`). That adds `surface` to the GA dimension list in #617.
- Every link Ask emits is unchanged: `photoDeepLink` still opens the frame in its gatefold from
  outside Ask. Ask only intercepts the click.

For the gallery in Phase 2: build links with `photoDeepLink` and `mediaId`, and never change the
`mediaId` format. The Worker, the sitemap and every share link depend on it. `artist` is the act
whose gatefold holds the frame, by canonical slug, so an opener's frame opens in the opener's
gatefold. A clip link is its own canonical only if its share image exists in `public/og/shows`.
Add Ask to the emitters list in `docs/DEEP_LINKING.md`.

### Phase 4: "show me something"

- `surprise_me` gains `kind: 'photo' | 'clip'`, drawing from the social pool in
  `global-social-media-posts.md`.
- "Got any video of The Cure?" replaces one prompt in `AskScene.tsx` and one in `AskSpotlight.tsx`,
  so each stays at three. Clips open in the gatefold, so it can ship with the next Ask change.
  A test confirms the act still has a published clip.

### Phase 5: follow-up chips

One or two chips under an answer that has a card. A chip must never lead to an empty answer, so
three things guard it:

1. **The Worker chooses them, after the tool has run.** It holds the data the site doesn't load,
   such as setlists and album eras, so it can test each chip before offering it. Chips ride on the
   `exhibit` event. No model call writes them, and the model's text never mentions them.
2. **A chip carries its tool and arguments, not just words.** Clicking it runs that exact tool,
   then the model writes the prose. Free text could be routed elsewhere, or stumble on a name.
3. **A CI test proves it.** It walks every artist, venue and night in the real data, runs each
   chip offered, and fails on an empty result.

| Chip | Offered only when |
|---|---|
| The setlist | That night has at least 3 songs on record, the floor On This Day uses |
| Who else was on the bill | The night has openers (89 of 185) |
| What album they were touring | The night has era data |
| Their first show / my first show here | There are at least 2 shows, or the answer is the card itself |
| The photos / the clips | The night or act has published media, after Phase 2 |

Also:

- No chips on a refusal, an error or "nothing matched".
- No chips unless Ask is in its normal mode, or a chip could lead to a paused or quiet reply.
- Never repeat a question already asked in the conversation.
- Track clicks with the existing `ask_suggested_prompt_clicked`, adding a `source` param.

The test does not cover the daily spend cap or a model failure. Those replies stay as they are
today.

**Done.** `workers/ask-chat/src/chips.ts` offers them. Each candidate is checked against the same
pure fn its tool runs, `setlistSelection`, `mediaResults` or `resolveArtist`, so the check and the
answer can't disagree. What each card offers, at most two:

| Card | Chips |
|---|---|
| An act | Your first show by them (2+ nights), then the clips or the photos |
| A room | "Your first show here" (2+ nights), then the clips or the photos |
| A night | Every show by that act (2+ nights), then the night's clips, or its photos when there are 2+ (the card shows one) |
| A surprise pick, or a list of one night | The setlist (3+ songs), then the night's clips or photos |
| A night's place in a career | The setlist, then every show by that act |
| A gallery of one act on one night | The setlist |
| The seen-most ranking | Every show by the top act |

A label drops a leading "The" ("Your first Human League show"). The tool's input keeps the full
name. A chip comes back with its turn as `{ tool, input }`, and `readChip` throws out any tool or
input key it didn't offer. The Worker runs that tool, then hands the model the result as a tool
call already made, so the prose is written about what the chip promised. The chips skip the
`plain` card, and any turn after which the day's cap is spent. Quiet mode offers none, but a chip
clicked before the switch still runs its tool, with no model call. The walk test is
`chips.test.ts`: it serves the real `public/data` to the shared data layer and runs every chip
offered for every act, room and night.

### Phase 6: the redesign

Mocks: [Ask the Archive redesign](https://claude.ai/artifact/GghUJAdPAzQmZ231XDDBe7), the page
"Moving forward". The canvas is private to the owner until shared.

The modal must read as search first. The owner's decisions, 2026-11-02:

| Decision | Choice |
|---|---|
| The field | A traditional search box, first on the page, with a magnifier and "Search a band, venue, song or year, or ask anything" |
| Follow-ups | The box stays at the top on desktop. A new question replaces the view, with earlier answers above. On a phone it stays at the bottom, above the keyboard |
| A clicked card | Asks straight away. The question shows in the box, followed by thinking dots |
| Where answers appear | The Spotlight overlay, for the Ask scene too |
| Headline | "That's over forty years. Now ask me about it." |
| Connector link | Below the crate, in the Ask scene |

**Type-ahead.** Typing replaces the banner with instant matches: bands, venues and clip songs, with
counts, then "Ask the archive about…". It runs on the site with no model call. It finds
setlist songs too, from `public/data/song-index.json`, which `generate:most-played-songs` writes. A
song with no clip opens a song card in Ask, with no model call: the record it came off and every
night it was heard, each linking to that night's setlist. A song is spread over several nights, so
jumping to one of them hid the rest. A new tab still gets the last night. Years are in there as
well.

**The ⌘K banner.** One large photo banner under the box, with a "Pull another" button.
*Superseded 2026-11-02: the owner preferred the Ask scene's design, so the ⌘K overlay now opens on
the same crate carousel, four cards to a view. `AskBanner.tsx` is gone; the ideas still come from
`banner.ts`.*
Text never rotates on a timer: it would need a pause control and it reads as an ad.

**The opening idea.** One per day, the same for everyone, chosen in this order:

1. A photographed show on this date
2. A show on this date with no photo from that night, using the imagery ladder below
3. The rotation: a clip, a year, a familiar face

A date with several shows prefers a photographed night, then the higher On This Day score. Go
through every item before repeating one. "Pull another" works through the rest.

**The imagery ladder.** Every banner, card and exhibit takes the first that exists:

1. The owner's photo from that night, with the byline
2. The owner's photo of that act from another night, with its full date in the byline
3. A sourced image, whichever suits the response: the artist for an answer about an act, the venue
   for an answer about a room, the album cover for an answer about a record or a tour. There is
   no fixed order among them. The owner approved this on 2026-11-02. It carries no byline, and it
   stays smaller than a personal photo, so the owner's work still visibly outranks it. A photo can
   bleed, but an album cover stays square and uncropped
4. The type-led card, for when nothing else loads. Sourced URLs can die at runtime, so it must
   always work

**The Ask scene.** "Pull one from the crate" is a carousel: five cards at a time on desktop, one on
a phone, with an arrow on each side. An On This Day card leads it on days that are true, and clicking
it asks "What did you see on this day?". Cards need swipe on a phone and a reduced-motion version.

**The response.** A sentence or two in Playfair, then the exhibit as the largest thing on
screen, then chips. No bubbles or avatars. An empty photo slot never appears: with no media, the
layout changes shape. "No photos from 1987" still lists that year's shows.

| Answer | Layout |
|---|---|
| A clip | Large poster that opens the clip in its gatefold, with photos beside it |
| A ranking | A photo beside a list with large numbers |
| No media for a question about media | A plain "no", then the shows |
| A night with no media | Date, venue and bill beside the setlist |
| An act never photographed | A small sourced image beside the shows |
| An act across many nights | A list of nights, with a thumbnail and counts only on nights with media |
| A gallery | One large photo, a grid, and an "All N photos" tile. Each tile names its night and opens in the gatefold |

Every banner, card and opener goes through the same check as the chips in Phase 5: if a tool can't
answer it, it doesn't appear.

**Build order:** type-ahead and the search box (done), then the response layout, then the banner, then the
opening idea, then the Ask scene carousel. The response layout ships in two parts. First the shell
every answer shares (done): a 920px panel, the prose above the exhibit, and no card box. Then the
per-kind layouts in the table above, one at a time. The artist answer is done: my photo (or, for an
act never photographed, a smaller sourced image) beside every night, with a thumbnail and counts
only on nights with media. The photo leads at 280px and the sourced image sits at 200px, so the
owner's work still outranks it. One night is done too: a card with the picture, date, room and
bill beside the setlist in two columns, its heading naming the record they were touring. The
picture follows the ladder, so a night I have no photo from can show my photo of the act from
another night, captioned with that night's date, before it falls to the touring record's cover.
Rankings are done: the songs I've heard most, and the acts I've seen most. The acts ranking is a
new `acts` exhibit that `get_archive_info` sends, built from `tallyActs` in the MCP server, the
same tally its prose reads. Each ranking is my photo of the highest-ranked act I've photographed
beside the list, with the count in large type. The clip poster is done: a gallery that leads with
a clip shows it as a poster that opens in its gatefold, with up to three of that night's photos
beside it, the act's own then the room's, never another act on the bill. The column holds as many
rows as it has photos, and a night with none gives the poster the full width. The plain "no" is
done, which finishes the table: when `get_media` finds nothing for an act, room, night or year, it
also returns the past shows the question was about, and Ask lists them under the no. A question
about a song names no show, so it stays prose only.

The ⌘K banner is done (`banner.ts`, `AskBanner.tsx`), and it replaces the "Try asking" chips in
the overlay. Each idea is a clip, a year or a familiar face (an act seen three times or more). A
clip opens in its gatefold. A year asks "What did you see in 2017?" and a face asks "How many times
have you seen X?". The kinds take turns, the order is shuffled once a day, and "Pull another" goes
through every idea before one repeats. Every published crop is 4:5, which no wide banner holds
whole, so the banner takes landscape frames only and shows the top of the crop.

The opening idea is done. Shows from this date in earlier years lead the deck: a photographed
night first, then the higher score from `scoreDay`, the same scoring the On This Day post uses.
Clicking one asks "What did you see on this day?", which goes straight to `on_this_day`. The
picture follows the ladder. A landscape photo fills the banner. A portrait one sits beside the text
at its 4:5 crop, with the byline under the venue and the year large in the space. A sourced image,
or the type-led tile, is a smaller square in the same place.

The Ask scene carousel is done (`AskCrate.tsx`), which finishes the build order. "Pull one from
the crate" holds the banner's ideas in the same daily order, so this date's show leads it. The
cards are tall, so they take any of my frames, not only landscape ones. Each card keeps its byline
under the text, so a photo from another night or of an opener still says so. It shows five cards
on desktop and one on a phone. The track is a native scroll-snap row, so a phone swipes it, and
the arrows page it by one view. With reduced motion they jump instead of gliding. The connector
link sits below it. The "Try asking" chips and `prompts.ts` are gone.

---

## Files

| Modify | Change |
|---|---|
| `workers/mcp-server/src/data.ts`, `tools.ts` | Media data, counts, `get_media` |
| `workers/ask-chat/src/tools-bridge.ts`, `exhibits.ts`, `agent-loop.ts` | Tool, exhibit, prompt |
| `src/types/exhibit`, `src/components/ask/AskExhibit.tsx` | The gallery kind |
| `docs/DEEP_LINKING.md` | Ask gallery becomes a third emitter of photo links |

| Create | Purpose |
|---|---|
| `src/components/ask/AskGalleryCard.tsx` | The gallery |
| `src/components/ask/search.ts`, `AskSearchMatches.tsx` | Type-ahead |

---

## Testing Strategy

- Worker tests: an unpublished clip never appears in counts or results.
- Worker tests: an opener's frame carries that act.
- Deep links assert against the shared fixture.
- MCP tool snapshots updated on purpose.
- Evals through Claude Code subagents, not scripts that bill the API key:

| Question | Expected |
|---|---|
| "Got any photos of The Cure?" | Gallery |
| "Any video from Thompson Twins?" | Clips only |
| "Photos from 1987?" | Says there are none, and the shows still stand |
| "What's happening in that photo?" | Declines to describe it |

- The $25 cap: check the cost of the longer tool results in `cost.ts` terms before shipping.

---

## Future Enhancements

- **Play buttons on setlist rows,** for songs with a clip.
- **Written descriptions:** alt text and searches like "show me marquees". They must never name
  a person, and the owner reviews them before they go live.
- **Replay the night:** the setlist, photos and clips as one sequence.

---

## Revision History

- **2026-11-02:** The ⌘K overlay opens on the crate, not the single banner, from the owner's review of the live site
- **2026-11-02:** Phase 5 built: follow-up chips, chosen and checked by the Worker
- **2026-11-02:** A song match opens a song card in Ask, from the owner's review of the live search
- **2026-11-02:** Imagery ladder and the full set of response layouts added to Phase 6
- **2026-11-02:** Phase 6 added: the search-first redesign, from the owner's review of the mocks
- **2026-11-02:** Song search moved into Phase 2, since #612 shipped `song`
- **2026-11-01:** Initial specification created
- **Version:** 1.1.0
- **Status:** Planned
