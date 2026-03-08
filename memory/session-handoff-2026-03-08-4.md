# Session Handoff — 2026-03-08 (Session 4)

## What Was Completed

All work this session is uncommitted. These are the changes in the working tree:

**UI/Design fixes — Liner Notes feed & permalink:**
- Moved `CategoryFilterChips` from sidebar to a horizontal row above the post feed
- Removed tags entirely from `LinerNoteCard` and `LinerNotePermalink` (deemed noise)
- Removed `TagFilterRow` from `LinerNotesPage` (component + import + state)
- Removed sidebar layout from `LinerNotesPage` — now single-column
- Replaced full-bleed hero image on cards with 160×160 right-side thumbnail
- Same thumbnail treatment applied to `LinerNotePermalink` header
- Thumbnail hidden entirely when `image.source === 'placeholder'`
- Thumbnail on card is wrapped in a `<Link>` to permalink (`tabIndex={-1} aria-hidden`)
- `LinerNoteMiniPlayer` rewritten to match TrackRow pattern (inline Play/Pause, no fat circle)
- `CategoryFilterChips` rewritten as compact `rounded-full` horizontal pills matching app pattern
- Shared `PageNav` component created (`src/components/liner-notes/PageNav.tsx`) — used across LinerNotesPage, LinerNotePermalink, WhatsPlayingPage
- Both pages now use `h-screen overflow-y-auto` scroll pattern (fixes scroll broken by `body { overflow: hidden }`)

**Pipeline fixes:**
- `curate.ts` `getVenueImageUrl()` now correctly reads `photoUrls.large ?? photoUrls.medium ?? photoUrls.thumbnail` (was doing `photoUrls[0]` — always undefined because data is an object not array). This was why 0/77 venues showed photos.
- `CurateOptions.venuesMetadata.photoUrls` type updated to `string[] | { thumbnail?, medium?, large? }`
- `curate.ts` `upsizeAppleMusicUrl()` added — replaces `100x100bb.jpg` with `600x600bb.jpg` in album art URLs used as card hero images
- `constants.ts` category labels updated: `cultural: 'The Scene'`, `personal: 'I Was There'`, `'deep-cut': 'Deep Cuts'`
- `constants.ts` deep-cut accent color darkened: `#06b6d4` → `#0e7490` (legibility)

**New detectors in `analyze.ts`:**
- `detectRareSighting()` — headliners seen exactly once, category: `deep-cut`, caps at 25, suggestedImage: artist
- `detectHistoricalMoment()` — one concert per year (best-bill pick, ≥2 concerts/year), category: `deep-cut`, caps at 20, suggestedImage: venue

**Web search in `generate.ts`:**
- `generateProseWithWebSearch()` — uses `web_search_20250305` built-in Anthropic tool with agentic loop (max 5 iterations)
- `buildUserPromptHistorical()` — instructs Claude to search for "[month year]" and "[city] [year]" world events before writing
- `generateProse()` now routes `historical-moment` findings through web search path

**`types.ts`:**
- Added `"rare-sighting"` and `"historical-moment"` to `DetectorName`

**`liner-notes.json` patches:**
- 6 Apple Music album art URLs upsized from `100x100bb.jpg` to `600x600bb.jpg`
- 3 venue posts patched with correct venue photo URLs: Pacific Amphitheatre, House of Blues Anaheim, Kia Forum

## Releases Shipped

(none this session)

## In Progress / Pending

- **All changes are uncommitted** — need a commit before these can be released
- **Deep-cut posts not yet generated** — the two new detectors are implemented but the pipeline hasn't been run yet to produce actual deep-cut posts. The current 12 posts are all `personal` (10) or `cultural` (2), zero `deep-cut`.
- **`--seed --force` run needed** to hydrate deep-cut posts — or run normally and get 1 deep-cut per weekly cycle

## Key Decisions

1. **Right-side 160×160 thumbnail instead of hero image** — full-bleed hero was cropping unpredictably for portrait artist photos and square album art. Thumbnail at fixed square size solves the crop problem and matches Substack/Apple News patterns.

2. **Tags removed entirely** — user decision: "I'm not sure they add value. I think they just start to be noise." Removed from both card and permalink views.

3. **`historicalMoment` uses web search, not curated event list** — user pushed back on static list; agreed that grounded web search (via Anthropic's built-in `web_search_20250305` tool) is better and avoids hallucination risk.

4. **`historicalMoment` suggestedImage → venue** — post is about "what was in the air at this place in time," venue photo anchors it better than artist headshot.

5. **`rareSighting` suggestedImage → artist** — post is about the artist you only caught once; artist photo is the right anchor. Fallback chain still tries venue if artist has no image.

6. **Venue photo bug root cause** — `curate.ts` was doing `photoUrls[0]` (array index) but `venues-metadata.json` stores photos as `{ thumbnail, medium, large }` object. Fixed in `getVenueImageUrl()`.

7. **Category imbalance** — currently 6 personal detectors, 1 cultural, 2 deep-cut. Next session could add a second cultural detector or a `genreOutlier` deep-cut for better balance.

## Relevant GitHub Issues

No open issues directly track this session's work. The liner notes feature was covered by #59–#65 (all closed in v4.4.0).

## Next Steps for Next Session

1. **Commit all current changes** — large batch of UI + pipeline changes, all clean (build passes). Suggested message: `feat: liner notes UI polish + deep-cut detectors + venue image fix`

2. **Run dry-run to preview deep-cut candidates** — `npm run generate:liner-notes -- --dry-run` to see which `rare-sighting` and `historical-moment` findings would be selected and scored

3. **Run pipeline to generate deep-cut posts** — `npm run generate:liner-notes -- --force` (drops 3 deep-cut posts into liner-notes.json without --seed mode, respecting existing posts). Or `--seed --force` to generate a larger batch.

4. **Verify web search actually works** — the `web_search_20250305` tool is wired up but hasn't been exercised yet. If there are API errors (tool not supported, auth issue), may need to fall back to standard prose generation for `historical-moment` findings.

5. **Consider a second cultural detector** — `opener-to-headliner` is the only cultural detector. A `sceneDefiningShow` or `genreEra` detector would improve category balance significantly.

6. **Release v4.4.1 or v4.5.0** — depends on whether deep-cut generation goes cleanly. If it produces good posts + venue images are visually improved, this warrants a user-facing release.

## Files to Know About

- `scripts/liner-notes/analyze.ts` — added `detectRareSighting()` and `detectHistoricalMoment()` at bottom, both registered in `analyze()` export
- `scripts/liner-notes/generate.ts` — `generateProseWithWebSearch()` + `buildUserPromptHistorical()` added; `generateProse()` routes by detector
- `scripts/liner-notes/curate.ts` — `getVenueImageUrl()` fixed; `upsizeAppleMusicUrl()` added
- `src/components/liner-notes/PageNav.tsx` — NEW file, not yet in git
- `public/data/liner-notes.json` — patched in place; no pipeline re-run yet
