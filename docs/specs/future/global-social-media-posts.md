# Social Media Posts: Photos and Clips

**Status:** Planned
**Target Version:** next
**Priority:** Medium
**Estimated Complexity:** High
**Dependencies:** On This Day photo fix (shipped first), `media:publish-video`, #529 claim check

---

## Executive Summary

Add a third syndication stream: a post built around one photo or one clip. It adds to the
liner notes and On This Day posts, and it runs on the same schedule, ledger and kill switch.

Every post's link opens that exact item in the artist's gatefold. A clip posts as native video
on Bluesky and Mastodon.

The owner's decisions, 2026-11-01:

1. New posts, added to the existing inventory and mixed into the existing cadence.
2. Every link goes to the gatefold deep link, never to a liner note.
3. The pool is signatures, heroes that beat another frame, and published clips.
4. Clips with live audio may post to Bluesky and Mastodon.
5. Clips get a `song` field, set by the owner.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Social Media Posts feature for Morperhaus Concerts.

- Spec: docs/specs/future/global-social-media-posts.md. It is the source of truth.
- Read first: docs/SYNDICATION.md, .claude/skills/media-pipeline/SKILL.md,
  .claude/skills/liner-notes-voice/SKILL.md, docs/DEEP_LINKING.md.
- Build the phases in order. Phase 1 ships on its own.
- Never hand-build a deep link. Use src/utils/deepLinks.ts.

Start with Phase 1, the song field.
```

---

## Design Philosophy

**The owner's marks choose the content. Scores do not.** Measured 2026-11-01 on the 986
candidates in `concert-photos-audit/review/*/all.json`:

| Test | Result |
|---|---|
| `overall` ranks a keeper above a reject | 58% of the time |
| `curation` ranks a keeper above a reject | 54% of the time |
| Top `overall` frame is the owner's hero | 11 of 21, against about 8 by chance |

Those files are gitignored, so a CI job could not read them anyway.

**A hero is not automatically a quality mark.** Of 54 hero stills, 29 are the only frame of
that act that night. No comparison happened, so those stay out of the pool until the owner
marks them signature.

**A post never describes what it cannot see.** The model has no view of the frame. Copy comes
from archive facts, the owner's `song`, and the owner's `notes` when present.

---

## Selection

An item is eligible when it is one of these:

| Item | Test |
|---|---|
| Signature still | `signature: true` |
| Contested hero | `hero: true`, and another still exists for the same act on the same date |
| Published clip | `kind: 'video'` with a `url` |

Also required:

- A still needs a `crop`, because the renderer refuses a personal photo without one.
- The act must be credited. A room frame needs its own explicit `signature`.

On 2026-11-01 that is 30 stills across 24 acts and 22 shows. Clip supply is changing while the
remaining clips are published, so read the count from the index rather than quoting one.

**Order:** least-recently-posted act first, then clips before stills, then newest show. Never
post the same act within 30 days. Never reuse an item: the ledger slug is the identity.

---

## Cadence

- One post a week. `generate:media-post` runs Thursdays at 07:00 UTC, so the post is committed
  and deployed before Syndicate runs at 10:00.
- Never Monday, which belongs to the liner note.
- The post shares the run's normal cap of 3. It does not raise the ceiling.
- If nothing is eligible, the run posts nothing and says so.

---

## Song Field

`song?: string` on a video row in `media-index.json`. Set by the owner, never inferred.

| Where | Change |
|---|---|
| Review page | A song field beside the clip's in and out marks. Suggestions come from that night's setlist; free text is allowed because setlists are often partial |
| `selects.json` | Carries `song` in `marks` |
| `media-decisions.json` | Carries `song`, so a re-finish cannot lose it |
| `media:ingest` / `frames.ts` | Writes `song` to the video row and keeps it on a re-render |
| Backfill | `npm run media:song <date>` lists that night's clips and sets the song on each |

`credit.song` already renders on the card, so stills need no card work. A frame pulled from a
tagged clip does not inherit the song: the song belongs to the clip.

**Backfill issue:** open a GitHub issue once `media:song` ships, with one checkbox per clip,
grouped by show. The owner works through it in their own time. A clip with no song still posts.

---

## Technical Implementation

### Payload

- `SyndicationPayload.kind` gains `"media"`. This is additive: no adapter branches on `kind`.
- `withUtm` gains a campaign for it.
- `url` is always `photoDeepLink` + `mediaId`, in the gatefold of the act in the frame.
- `linkText` reuses `LINK_TEXT.onThisDayPhoto` for a still. A clip uses "Watch and see the full
  night →", re-measured against the budget in `budgets.ts`.
- The claim check runs as it does for the other streams.

### Stills

The existing 4:5 card, with the owner's crop and byline. The display line is the act. The
eyebrow is the date, with no "years ago today" wording.

### Clips

Post as native video, `MediaAsset.role: "video"`, a role the payload already has. Do not post a
still with a play mark: it looks playable and is not.

- The runner fetches the published R2 file. The skill's "video needs the owner's Mac" reason
  predates R2 and must be updated when this ships.
- A clip has no card, so the byline, act and date go in the post text and alt text.
- `MediaAsset.source` stays `personal`, so a rights complaint has a greppable blast radius.
- A failed video upload follows the per-pair retry path and never falls back to the poster.
- **Measure first.** Check each channel's current size, length and processing rules with one
  real test post. None of this has been tested yet.
- Instagram stays out until its credentials exist. Reels is a separate decision.

### Files

| Create | Purpose |
|---|---|
| `scripts/media-posts/select.ts` | The pool and the order. Pure, unit-tested |
| `scripts/media-posts/build.ts` | Item → post, like `on-this-day/build.ts` |
| `scripts/media-posts/index.ts` | CLI: `--dry-run`, `--date` |
| `public/data/media-posts.json` | The published record |
| `.github/workflows/media-post.yml` | The Thursday job |

| Modify | Change |
|---|---|
| `scripts/syndication/types.ts`, `payload.ts`, `run.ts` | The third stream |
| `scripts/syndication/adapters/bluesky.ts`, `mastodon.ts` | Native video |
| `scripts/syndication/contact-sheet.ts` | Show clips on the proof sheet |
| `docs/SYNDICATION.md`, `docs/DEEP_LINKING.md`, media-pipeline skill | Keep them true |

---

## Implementation Plan

### Phase 1: Song field

Ship the field, `media:song`, and the backfill issue.

- [ ] A re-render keeps `song`
- [ ] A re-finish keeps `song`
- [ ] `media:song` lists a night's clips with its setlist

### Phase 2: Photo posts

The selection, stream, workflow and contact sheet, stills only.

- [ ] Selection is correct against the real index
- [ ] A dry run proofs on the contact sheet
- [ ] Links open the exact frame
- [ ] The kill switch stops the stream, and `--retract` and `--correct` work

### Phase 3: Clip posts

One real test post on each channel, then the adapters.

- [ ] A clip plays in both feeds, with sound on tap
- [ ] A failed upload retries one channel only
- [ ] A clip's song appears in the text only when the owner set it

---

## Testing Strategy

- Unit tests for selection, including solo heroes staying out and the 30-day act rule.
- Ledger tests: a retried run never double-posts.
- Unicode acts in text, as the existing tests do with Björk and Motörhead.
- A live check of one opener link, because a gatefold opens differently for a card that has not
  rendered yet.

---

## Future Enhancements

- Instagram Reels, after #334.
- A play button on setlist rows, for songs with a clip.
- Carousels of one night, under #366.

---

## Revision History

- **2026-11-01:** Initial specification created
- **Version:** 1.0.0
- **Status:** Planned
