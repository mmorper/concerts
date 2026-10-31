# Ask the Archive — Media in Answers

**Status:** Proposal: mocks out for review, no code yet
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

## What would change in the envelope

The exhibit envelope stays thin: identity and selection only, hydrated client-side. Two
additions:

- `AlbumExhibit { kind: "album", mbid, title, releaseDate, coverAvailable, artist: EntityRef,
  heardLive?: { date, venue: EntityRef, songsFromAlbum: string[] } }`. The album fields ride
  in the envelope because the SPA doesn't load `song-albums.json` or `album-eras.json` (900 KB
  together), and they are identity, not presentation.
- `ShowExhibit { kind: "show", concertId, date, headliner: EntityRef, venue: EntityRef }`, with
  per-song album identity for the record strip.

Personal photos are hydrated client-side from `media-index.json` (107 KB), fetched lazily the
first time Ask opens rather than at app load.

## Open questions for review

1. Should my photos lead the artist card whenever they exist (B), or only when the question
   is about a night I photographed?
2. Is the night card (C) worth a new kind, or should setlist answers stay on the artist card
   with the record strip added?
3. Does the discography wall (F) earn a place in the first cut, or is it a follow-up?
4. Cover Art Archive and Deezer are third-party hosts. Hotlink them from the browser, or proxy
   and cache them through the Worker?
5. Out of scope for this proposal: images in the public MCP connector's responses
   (Claude.ai). That is a separate change to the MCP server.
