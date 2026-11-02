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

Add `media: { photos, clips }` to these tool results:

- `get_artist_history`
- `get_concert_setlist`
- `on_this_day`
- `surprise_me`
- `get_venue_history`

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

### Phase 4: "show me something"

- `surprise_me` gains `kind: 'photo' | 'clip'`, drawing from the social pool in
  `global-social-media-posts.md`.
- One Spotlight starter, for example "Show me something from the pit."

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

- **2026-11-02:** Song search moved into Phase 2, since #612 shipped `song`
- **2026-11-01:** Initial specification created
- **Version:** 1.1.0
- **Status:** Planned
