# Handoff: Now Spinning (vinyl → Apple TV, with concert history)

> **Historical.** This is the original brief. Where it differs from
> [`global-now-spinning-spec.md`](global-now-spinning-spec.md), the spec wins: play logging was
> dropped, the lookup rules were corrected, and the tvOS app became one of two display options.

Start in `mmorper/concerts` with push access, and run `/spec` from this note.

## The idea
When a record plays on the turntable, the Apple TV shows the song, its album, and the archive's connection to it: the nights Mike heard it live, with his photos from those nights.

## Setup today (confirmed)
- Turntable: Music Hall 2.3 → Phono input on a Marantz AV7703, which feeds a Marantz MM7055 amp.
- Phono uses the Virtual sound mode (L, R and subwoofer).
- Video Select on Phono is set to the Apple TV, so the TV shows the Apple TV picture while you hear the record.
- Apple TV 4K (2026). Its built-in microphones are **not** available to apps, because Apple processes microphone data in Secure Exclaves.

## Proposed architecture
1. **Capture:** the AV7703 ZONE2 PRE OUT, with its source set to Phono, feeds a line-level USB audio input on a Raspberry Pi. The Pi gets a clean signal with no room noise.
   - **Confirmed from the manuals:** analog sources, including Phono, can play in Zone 2 and Zone 3. This comes from the manual for the near-identical AV7702; the AV7703 page should be checked. The RCA pre-outs run at 1.2 V, which is line level.
   - **Confirmed:** Zone 2 Setup has a Volume Level setting that can be Variable or fixed at a set level. Fix it so the Pi always gets the same level.
   - Zone 3 works the same way for analog sources, so it can serve as a backup.
   - **To check:** the front panel showed MULTI ZONE lit, so something may already use Zone 2. Zone 2 also has to be on, with Phono selected, whenever a record plays. To automate that, the Pi could control the AV7703 over the network: switch Zone 2 to Phono, and only listen while the main zone is on Phono. Spec it once the 7703's network control is confirmed.
2. **Identify:** the Pi runs ShazamIO (or similar). It skips silence between tracks, notices when the song changes, and stays quiet when the record isn't playing.
3. **Look up:** the Pi POSTs `{artist, title, album?, artwork?, isrc?}` to a new Worker, `concerts.morperhaus.org/api/now-spinning`, protected by a shared secret. The Worker runs the archive lookup and stores the latest result, probably in a Durable Object because KV can take a while to show new values.
4. **Display:** a tvOS SwiftUI app polls the endpoint or holds a WebSocket open, then renders the screen.
- Alternative to weigh in the spec: run everything on the home network, with the Pi serving the result and the Apple TV reading it directly. There's no cloud dependency, but the archive data would have to be copied to the Pi.

## Lookup rules (prototyped in the mock)
- Normalize the way `src/utils/normalize.ts` does. Strip Shazam noise from titles, like "(Remastered 2006)", "- Single Version" and "feat. X".
- Merge billings using `artist-aliases.json` `sameAct` (Brian Setzer has four billings that count as one act). Keep the `sharesMember` acts separate.
- Screen states:
  1. **Heard this song live:** count, the nights (newest first), and photos from those nights.
  2. **Seen the artist but not this song:** say "never heard it live" only when every one of those nights has a setlist. Otherwise say "maybe" (119 of 185 shows have setlists).
  3. **Never seen the artist, but someone else played this song:** uses setlist.fm's `cover` field. Example: Bowie's "Let's Dance" by Nile Rodgers and Heaven 17.
  4. **Never seen the artist, but someone played other songs of theirs:** example: the Stones via Devo, Foo Fighters and Social Distortion.
  5. **No connection:** "Not in the archive. Yet."

## Data findings
- `public/data/song-index.json` only uses the **headliner's** setlist for each concert, so opening acts' songs are missing. Example: Blancmange's "Blind Vision" from Sep 16, 2026. The mock builds from `setlists-cache.json` instead, which gives 2,267 songs, compared with 1,720 in the index. Ask the Archive probably has the same gap.
- Albums come from `song-albums.json` (keyed `artist-slug::song-slug`) and covers from `album-covers.json` (resize mzstatic images from 100x100bb to 600x600bb). Photos come from `media-index.json`, keyed by `date|artistNormalized`.

## Spec should cover
- A hardware list to order: the Pi model, a USB audio interface with line-in, cables from the Zone 2 pre-out, power, and where it all sits on the shelf.
- Data flow and sequence diagrams.
- Worker API contract and auth.
- tvOS app: polling or push, an idle screen, what happens between tracks and sides, and when the archive data refreshes.
- Logging vinyl plays: a play history to compare with concert history.
- Privacy: the Pi only listens to the line feed, not the room.

## Artifacts (in this folder)
- `mock/index.html` is the TV-screen mock with all five states. To rebuild its data from the repo, run `python3 docs/specs/implemented/global-now-spinning/mock/build_mock_data.py` from the repo root. Then serve the folder with `python3 -m http.server -d docs/specs/implemented/global-now-spinning/mock 8765` and open the page. `data.json` and `p/` are generated, so add them to .gitignore.
- `screens/` has screenshots of each state (JPEG). Two were added with the spec's v1.1.0 review.
- The same mock is published on claude.ai as "Now Spinning — Morperhaus Concert Archives" (artifact U5dworSwGunfBzfUbt29Mv).
- The lookup logic in `mock/index.html` (`identify()`) is the reference the Worker should copy.
