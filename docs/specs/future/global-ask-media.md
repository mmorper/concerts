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

### Phase 3: clip playback

Move the `<video>` block out of `PhotosPanel.tsx` into a shared `ClipPlayer`. Use it in the
Photos panel and the Ask viewer, which then takes `ReelItem[]` rather than stills only.

- `preload="none"` until the viewer opens a clip. A card can carry a dozen tiles.
- Track with `ask_media_opened`, per the analytics skill.

What `ClipPlayer` must keep from the Photos panel, per #616:

- The event and parameter names stay exactly as they are. The owner is registering them as GA
  dimensions in #617: `photo`, `media_kind`, `view_source`, `concert_date`, `song`.
- `clip_played` and `clip_completed` fire once per view, so pause and resume is one play. Paging
  away and back is a new view. Today that reset lives in the panel's `media_viewed` effect, so the
  player needs its own, by remounting on clip identity or with an effect.
- Those two events carry `artist_name`, `concert_date`, `song` and `photo`, which stays the
  `mediaId` ending in `-video`.
- `media_viewed` stays in the panel. It covers stills, and its `view_source` comes from the panel.
- The panel needs play, pause and ended back through a callback, because `isPlaying` hides the
  desktop footer.
- Keep `key={item.url}`, `controls`, `playsInline`, `poster` and contain fit. The panel keeps
  `preload="metadata"`, so `preload` is a prop.
- Plays in Ask would mix with gatefold plays. Add a `surface` param rather than changing any
  existing one, give it a row in #617, and tell the owner the day it ships: a dimension isn't
  retroactive.
- Check the panel on real iOS Safari, not only Chromium. Its phone layout was fixed against it.

For the gallery in Phase 2: build links with `photoDeepLink` and `mediaId`, and never change the
`mediaId` format. The Worker, the sitemap and every share link depend on it. `artist` is the act
whose gatefold holds the frame, by canonical slug, so an opener's frame opens in the opener's
gatefold. A clip link is its own canonical only if its share image exists in `public/og/shows`.
Add Ask to the emitters list in `docs/DEEP_LINKING.md`.

### Phase 4: "show me something"

- `surprise_me` gains `kind: 'photo' | 'clip'`, drawing from the social pool in
  `global-social-media-posts.md`.
- "Got any video of The Cure?" replaces one prompt in `AskScene.tsx` and one in `AskSpotlight.tsx`,
  so each stays at three. It ships with Phase 3, because before that the answer can't play the
  clip. A test confirms the act still has a published clip.

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

Mocks: [Ask the Archive redesign](https://claude.ai/artifact/GghUJAdPAzQmZ231XDDBe7), the rows
"Where I'd land" and "The response". The canvas is private to the owner until shared.

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
2. A show on this date with no photo from that night. Use the owner's photo of that act from
   another night, with its full date in the byline. Use the type-led card only for acts never
   photographed
3. The rotation: a clip, a year, a familiar face

A date with several shows prefers a photographed night, then the higher On This Day score. Go
through every item before repeating one. "Pull another" works through the rest.

**The Ask scene.** "Pull one from the crate" is a carousel: five cards at a time on desktop, one on
a phone, with an arrow on each side. An On This Day card leads it on days that are true, and clicking
it asks "What did you see on this day?". Cards need swipe on a phone and a reduced-motion version.

**The response.** A sentence or two in Playfair, then the exhibit as the largest thing on
screen, then chips. No bubbles or avatars. Three layouts: clip with photos, a ranked list beside a
photo, and shows with no media. "No photos from 1987" still lists that year's shows.

Every banner, card and opener goes through the same check as the chips in Phase 5: if a tool can't
answer it, it doesn't appear.

**Build order:** type-ahead and the search box, then the response layout, then the banner, then the
opening idea, then the Ask scene carousel. Clip rows wait for Phase 3.

---

## Files

| Modify | Change |
|---|---|
| `workers/mcp-server/src/data.ts`, `tools.ts` | Media data, counts, `get_media` |
| `workers/ask-chat/src/tools-bridge.ts`, `exhibits.ts`, `agent-loop.ts` | Tool, exhibit, prompt |
| `src/types/exhibit`, `src/components/ask/AskExhibit.tsx` | The gallery kind |
| `src/components/scenes/ArtistScene/PhotosPanel.tsx` | Use `ClipPlayer` |
| `docs/DEEP_LINKING.md` | Ask gallery becomes a third emitter of photo links |

| Create | Purpose |
|---|---|
| `src/components/ask/AskGalleryCard.tsx` | The gallery |
| `src/components/media/ClipPlayer.tsx` | The shared player |

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

- **2026-11-02:** Phase 6 added: the search-first redesign, from the owner's review of the mocks
- **2026-11-02:** Song search moved into Phase 2, since #612 shipped `song`
- **2026-11-01:** Initial specification created
- **Version:** 1.1.0
- **Status:** Planned
