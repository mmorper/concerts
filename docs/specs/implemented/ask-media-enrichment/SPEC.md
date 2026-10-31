# Ask the Archive — Media in Answers

**Status:** Released in v6.2.0 (PR #593). Decisions below; the open questions are answered.
**Builds on:** the exhibit system (#140), its containers (#141), the album tool (#317), the media index (#340)
**Visual references:** the design canvas at https://claude.ai/artifact/Wdq4QzHxyGqzqG9iR9EUAE
(nine artboards, A–I below). Stage, crowd and marquee frames on it are real photos from
`public/images/shows`. Album covers and artist portraits are labelled stand-ins: the session
that drew them couldn't reach Cover Art Archive or Deezer.

---

## The problem

Ask "What album was Blind Vision on?" and the answer comes back as a bare text card: no cover,
no artist, nothing to click. There are three reasons:

1. `get_album_info` only attaches a card when the model passes `artist`. Asked about a song
   alone, it falls through to the plain card (`workers/ask-chat/src/tools-bridge.ts`, the
   `get_album_info` case).
2. There is no album card kind. `ExhibitKind` stops at artist, venue, list, serendipity,
   disambiguation, plain and refusal.
3. The cards that do exist use one image source each: the Deezer portrait for artists and a
   map for venues. None of the 129 personal photos in `media-index.json` reach the site at all.

## What the archive already has

| Media | Source | Coverage | In Ask today |
|---|---|---|---|
| My photos | `media-index.json` → `/images/shows/*.jpg`, each with `artist`, `subject`, `hero`, `crop` | 129 stills across 44 nights; 15 videos (no committed file yet) | No |
| Artist portraits | `artists-metadata.json` → `image` (Deezer) | 258 / 258 | Artist and surprise-me cards |
| Album covers | `song-albums.json`, `album-eras.json` → release-group ID + `coverAvailable`; `coverArtUrl()` | 1,706 song→album matches; every studio album | No |
| Venue photos | `venues-metadata.json` → `photoUrls`, `manualPhotos` | 80 / 80 | No (map only) |

## The proposals (one artboard each)

**New cards**

- **A · Album card.** Cover, title, year, "studio album 2 of 20", and the defining-record tag
  when it applies. If I heard the song live, show that night's set with the other songs from
  the same record marked. Fires from `get_album_info` whether or not the model passed an
  artist: the artist comes from the matched song.
- **B · Artist card with my photos.** When I have photos of the act, my hero frame leads, the
  portrait shrinks to the avatar, and a filmstrip shows more frames of *that act only*. The
  show chip for a night with photos carries a camera mark.
- **C · Night card** (new `show` kind) for setlist questions. A photo mosaic with one tile per
  act on the bill, each labelled with who is in it. A strip of the records the set drew on,
  with counts, including the album being toured if nothing came from it. The setlist with an
  album swatch per song: the same data the MCP setlist output already annotates.

**Existing cards, richer**

- **D · Venue card.** Photo first (mine, then Google Places), map kept as an inset, one frame
  per night I was there.
- **E · List card.** A thumbnail on every row. Square with a count = my photos; round = sourced
  portrait. A row whose only frame is a marquee says so.
- **F · Discography wall.** For "how many records…" and era questions: every studio cover, the
  cycles I saw them in ringed, the defining record tagged. Built from `album-eras.json`.

**The rules underneath**

- **G · Fallback ladder.** The media-pipeline rubric, applied as-is: personal beats sourced
  beats derived, and a card is never bare type. The derived floor is the genre colour with the
  name set over it.
- **G · Captions.** Both attribution rules from `.claude/skills/media-pipeline/SKILL.md`:
  - A photo from a different night says so ("my photo from 20 Aug 2024, not this night").
  - A photo of a different act says so ("Pet Shop Boys, on New Order's bill").

  48% of shows have openers, so a frame is never credited to the headliner by default.
- **H/I · Phone.** The hero becomes a swipeable strip; a tap opens a lightbox carrying the full
  caption.

## Decisions (owner review of the mocks)

| Question | Decision |
|---|---|
| Do my photos lead? | Yes, whenever they exist, framed on the subject (see Framing). |
| Night card as its own kind? | Yes: `show`. |
| Discography wall in the first cut? | Yes. |
| Covers: hotlink or proxy? | Hotlink from the browser, lazy, with a fallback on error (see Covers). |
| Fallbacks | Every image has a full ladder, at selection time and at load time. |

## How it's built

**Envelope.** Still thin: identity and selection, hydrated client-side. The exception is
album identity (`mbid`, `title`, `releaseDate`, `coverAvailable`), which rides in the envelope
because the SPA doesn't load `song-albums.json` or `album-eras.json` (~900 KB together).

| Kind | Fired by | Carries |
|---|---|---|
| `album` | `get_album_info` with a song or an album that resolves to one record | album, owning act (null for a cover's original act if I never saw them), studio position, defining flag, the most recent night a song from it is in a setlist, and that whole set |
| `discography` | `get_album_info` with only an artist | every studio album (deduplicated), the nights I saw them in each cycle, the defining record |
| `show` | `get_concert_setlist` resolved to one night | the set with each song's album, whose set it is, the record being toured |
| `era` | `get_career_position` resolved to a night with album-era data | the record being toured and its age, every studio album flagged before/after the night, the defining record and whether it was still ahead |
| `shape` | `get_career_shape` | the five album-age buckets, the median, and the "before the record existed" nights in the order the prose quotes them |
| `songs` | `get_archive_top_songs` | the same top N as the prose, each with its record; a cover names the original act (from song-albums, else setlist.fm's own credit) |

The worker builds these from the same resolvers as the prose (`albumExhibit` beside
`albumInfo`; `setlistSelection` beside `concertSetlist`; `careerPositionNight` and
`careerShapeData`, extracted from the career tools with their text byte-identical on the real
archive), so the card always names the record or night the text names. Where the prose hedges (several records, several nights, an unknown act),
there is no card. A record or night outranks the act's card when a turn produces both.

**Photos.** `media-index.json` loads beside the other three files the first time Ask opens.
A failed fetch means "no personal photos": every card falls to its sourced tier.

**Framing.** Every published still has a crop box the owner drew by hand (`media:crop`), almost
always 4:5. That box is the subject, and cards position the image on it (`focalPosition`), never
on the frame's centre.

- A box at the crop's own aspect shows exactly the crop. Verified across all 129 published stills.
- A wide hero is a 3:2 banner, used only when it keeps at least 80% of the crop; otherwise the
  photo sits beside the title at the crop's own aspect. 16:9 was rejected: over the published
  crops it kept as little as 60%, and over a portrait crop under half.
- A box smaller than the crop (square thumbnails) sits inside it, toward the top, where faces are.
- Night-card tiles are 4:5, so every tile shows exactly the owner's framing.

**Fallback ladder, per image.** Selection follows the rubric (personal > sourced > derived), and
`LadderImage` repeats it at load time, so a 404 drops a rung instead of showing a broken image.

| Card | 1 · personal | 2 · sourced | 3 · derived |
|---|---|---|---|
| Artist hero | signature, else latest hero, of this act | Deezer portrait | genre tile with initials |
| Venue hero | my venue shot, newest night | hand-placed photo, then Google Places (the generic `fallback*.jpg` placeholder doesn't count) | the map, as before |
| List row | that night: headliner, else an opener (labelled), else the venue (labelled) | Deezer portrait (round) | genre tile |
| Night card | one 4:5 tile per act photographed, plus the venue | my photo of the headliner from another night (captioned "not this night"), then Deezer | genre tile |
| Covers | — | iTunes (resolved at build time), then Cover Art Archive (only when `coverAvailable`) | a sleeve in the genre colour, tinted per title, with title and year (type dropped below 60px) |
| Era card | that night's frame | Deezer portrait | genre tile |
| Choice chips (artists) | my lead photo of them | Deezer portrait | genre tile with initials |

**Captions.** `photoCaption` enforces both attribution rules: a frame from another night says
"not this night"; a frame of another act names them and whose bill it was; a venue frame names
the venue. Every caption names the night.

**Covers.** The failures did show up: after 6.2.0, Cover Art Archive returned 500s for Dare,
Hysteria, Secrets and Credo (originals and thumbnails alike). Each sleeve now tries, in order: the
iTunes cover resolved at build time (`public/data/album-covers.json`, from
`scripts/resolve-album-covers.ts`, `docs/DATA_PIPELINE.md` §8.6); then Cover Art Archive
`front-250` → `front-500` → the original; then the derived sleeve. Strict matching on purpose: a
wrong sleeve is worse than the derived one. A runtime route on the ask-chat Worker was tried first
(#596, #597) and removed: iTunes answered it with HTTP 429, since Workers share egress IPs.

**Lightbox.** Tapping any of my photos opens it with the full caption. Arrow keys or swipe page
through; Escape closes the photo without closing the Spotlight underneath (keys are caught on
`window` in the capture phase); Tab stays inside it; focus returns to the photo.

**Tools that still answer in text only:** `get_archive_info` (a stats summary), and any tool
whose prose hedges (an ambiguous name, several nights, nothing matched). Refusals and errors stay
plain on purpose.

**Where the build departs from the mocks.**

- C's "I filmed ABC, video only" tile is gone: the site never shows video, so a night card only
  tiles acts I have stills of.
- H's swipeable hero strip became swipe inside the lightbox; the card keeps one framed hero.
- D's venue hero, when my venue shot is a portrait frame, sits beside the map instead of over it.

**Analytics.** `ask_photo_opened` `{ kind, subject, date }` when a photo is opened. New links use
the existing `ask_deeplink_clicked`.

**Code.** `src/components/ask/media.ts` (selection, framing, captions; tested in
`media.test.ts`), `AskMedia.tsx` (ladder image, derived art, covers, lightbox), `AskRecordCards.tsx`
(album, discography, night), `AskCareerCards.tsx` (era, shape, songs), `AskExhibit.tsx` (artist,
venue, list, surprise, choice chips). Worker: `album-info.ts` (`albumExhibit`), `career-cards.ts`
(era, shape, songs), `tools-bridge.ts` (`showExhibit`), and `setlistSelection`,
`careerPositionNight`, `careerShapeData` in `workers/mcp-server/src/tools.ts`.

**Seeing every card without a backend:** `npm run dev`, then `/ask-dev?fixtures`. The
fixtures in `src/components/ask/devFixtures.ts` were generated by the worker's own functions
from the real archive, and load on demand so they never ship.

## Out of scope

Images in the public MCP connector's responses (Claude.ai). That is a separate change to the
MCP server.
