# Ask the Archive: Photos and Clips

**Status:** Planned
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
counts, then "Ask the archive about…". It runs on the site with no model call. Extend it to
setlist songs, or the word "song" in the placeholder over-promises.

**The ⌘K banner.** One large photo banner under the box, with a "Pull another" button.
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

**Build order:** type-ahead and the search box, then the response layout, then the banner, then the
opening idea, then the Ask scene carousel.

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

- **2026-11-02:** Imagery ladder and the full set of response layouts added to Phase 6
- **2026-11-02:** Phase 6 added: the search-first redesign, from the owner's review of the mocks
- **2026-11-02:** Song search moved into Phase 2, since #612 shipped `song`
- **2026-11-01:** Initial specification created
- **Version:** 1.1.0
- **Status:** Planned
