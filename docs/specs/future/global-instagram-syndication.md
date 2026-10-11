# Instagram Syndication Channel

**Status:** Planned
**Target Version:** next
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** Syndication pipeline Phases 1–2 (live: Bluesky, Mastodon); #553/#554 proven by a clean week of runs before go-live; #337 (token expiry surfaced)
**Issue:** #334 (Phase 3 of #323)

---

## Executive Summary

Add Instagram (`@concertsmorperhaus`) as the third live syndication channel. Every liner
note, archive drip post and On This Day post that goes to Bluesky and Mastodon also goes to
Instagram, as a **single 4:5 image post**: the card is the post, and the caption is a
footnote.

Most of what #334 called "the real cost" is already paid. The 1080×1350 card is drawn at
post time for every payload (`render-card.ts`, format `4x5`), and both live channels
already post it as a native image (2026-09-26). Instagram's caption budget (2200), tag
budget (3–5) and `instagram` channel slot already exist in `budgets.ts`, `tags.ts` and
`types.ts`.

What is genuinely new, and what this spec decides:

1. **Hosting.** The Graph API takes an image **by public URL**, not by upload. Today the
   card exists only in `.renditions/` on the runner.
2. **Credentials that don't die quietly.** Instagram tokens expire, and an expired token
   is the textbook silent failure (`docs/SYNDICATION.md`, "Is it still posting?").
3. **Retraction and correction.** Both live channels can delete a post. Instagram may not
   allow deletion through the API, so `--retract` and `--correct` need defined behaviour.
4. **The caption.** No clickable links: the path to the site is the bio link.

There is **no site UI change**. This is pipeline work: one adapter, one hosting step, one
workflow change and docs.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement the Instagram syndication channel for Morperhaus Concerts (#334).

**IMPORTANT CONTEXT WINDOW MANAGEMENT:**
- This is a fresh session with NO prior context about the project
- You have access to the full codebase and can read any files
- At the end of EACH implementation window, you MUST:
  1. Assess remaining context window capacity
  2. If <30% remains, STOP and ask if I want to continue in a new session
  3. Provide a handoff summary for the next session
- Implement the spec AS WRITTEN - it's the source of truth
- Ask clarifying questions if anything is ambiguous

**Feature Overview:**
- New `InstagramAdapter` alongside Bluesky and Mastodon; same `Adapter` contract
- Posts the existing 4:5 card as a single image, two-step: create container, then publish
- The card is uploaded to public hosting first, because the Graph API fetches by URL
- Caption: hook + caption + "link in bio" + 3–5 tags; no URLs
- Expiry of the credential is surfaced in syndication health, never silent

**Key References:**
- Full spec: docs/specs/future/global-instagram-syndication.md
- Operating doc: docs/SYNDICATION.md (kill switch, schedule, health, retraction)
- Design record: docs/specs/future/global-social-syndication.md (Phase 3, Account Setup)
- Secrets: docs/SECRETS.md
- Adapters to mirror: scripts/syndication/adapters/mastodon.ts, bluesky.ts
- Repo PR guidance: .claude/skills/steward/SKILL.md

**Implementation Approach:**
- Window 1: hosting step + adapter + caption composer, all behind `configured()`; unit tests
- Window 2: workflow wiring, health/expiry, retraction behaviour, docs
- Window 3: dry-run against the real account, seed the ledger, go live

Let's start with Window 1. Should I begin by reading the Mastodon adapter and the Questions
for Review in the spec, to confirm which hosting and token options were chosen?
```

---

## Design Philosophy

**Instagram is a formatting function, not a content pipeline.** The payload is already
decided (`SyndicationPayload`), checked (claim check, #529) and drawn (`4x5` card) before
any adapter sees it. The adapter turns a finished payload into one platform's request
shape and never makes content decisions (`adapters/types.ts`). If Instagram copy ever
needs to say something different from Mastodon's, that is a payload change, made once.

**Unattended means loud.** Every Instagram-specific failure mode (expired token, image
fetch failure, a container stuck processing) must surface through `syndication-health.json`
the same way a Mastodon 401 does. A channel that can stop quietly is worse than no channel.

---

## Visual Design

No new artwork. The post is the existing **4:5 card** (`FORMATS["4x5"]`, 1080×1350,
full bleed, ≤ 1 MB JPEG), which Instagram accepts natively (allowed range 1.91:1 to 4:5;
4:5 performs best).

**The grid.** Instagram shows nine posts at once. Mock a nine-up from the last nine real
payloads before go-live (`syndicate:preview` already renders cards). If it reads as one
template repeated, raise it as a follow-up; it does not block this spec.

---

## Interaction Design

Not applicable: no site UI. The "interaction" is the reader's path:

```
Instagram post (4:5 card)
  caption: hook · caption · "Full story: link in bio" · 3–5 tags
    → profile bio link → /liner-notes?utm_source=instagram&utm_medium=social&utm_campaign=bio
      → newest-first list; the top note is the one the post refers to
```

On This Day posts point at `/liner-notes` too; their anniversary deep link is on the card.

### Accessibility

Alt text is **required** on every asset, every channel (existing rule). Pass the payload's
card `alt` with the image container (Graph API `alt_text` on image media — **verify the
field name and availability at build time**; if it is unavailable, record that in
`docs/SYNDICATION.md` rather than shipping a post without it silently).

---

## Technical Implementation

### Component Architecture

```
scripts/syndication/
  adapters/instagram.ts        NEW  InstagramAdapter: configured / post / retract
  host.ts                      NEW  publishCard(path) → public URL; cleanup(url)
  compose.ts (or adapter)           composeInstagramCaption(payload)
  types.ts                     MOD  IMPLEMENTED_CHANNELS += "instagram"
  run.ts                       MOD  default adapters include InstagramAdapter
  health.ts                    MOD  token-expiry signal (see below)
.github/workflows/syndicate.yml MOD  pass Instagram + hosting secrets
docs/SYNDICATION.md            MOD  channel table, caption shape, retraction note
docs/SECRETS.md                MOD  Instagram credentials and rotation
```

### Publish flow (per payload)

1. `publishCard(card.path)` uploads the rendered JPEG to public hosting and returns an
   HTTPS URL (see Q1).
2. `POST /{ig-user-id}/media` with `image_url`, `caption`, `alt_text` returns a container id.
3. Poll the container's `status_code` until `FINISHED` (short backoff, hard cap ~60 s).
   `ERROR` or timeout throws, and the run records a channel failure, as today.
4. `POST /{ig-user-id}/media_publish` with `creation_id` returns the media id, which is
   stored as `uri`. Fetch `permalink` for the run log.
5. The hosted copy can be deleted after publish (Instagram has copied it), or kept with a
   short TTL. Either is fine; deleting keeps hosting free of orphans.

**Idempotency.** The ledger already prevents a re-post after success. The gap is a crash
between `media_publish` succeeding and the ledger write. Mitigation: write the ledger
immediately after publish (the run loop already persists per post) and, on retry, check the
account's most recent media for a caption match before publishing again. Cheap, and the
only way to be sure on a platform with no idempotency key.

### Caption

```
{hook}

{caption}

Full story: link in bio.

#TheBand #NewWave #IrvineMeadows …   (3–5, from tags.ts, instagram budget)
```

- **No URLs.** They are not clickable and read as spam.
- Mentions: none in v1. The handles on file (`handles.ts`) are Bluesky's, not
  Instagram's; a mapping is a follow-up.
- Budget: 2200 (`CHANNEL_LIMITS.instagram`); in practice ~415 (`budgets.ts`).

### Credentials and expiry (see Q2)

| Secret | Purpose |
|---|---|
| `INSTAGRAM_USER_ID` | The professional account's IG user id |
| `INSTAGRAM_ACCESS_TOKEN` | Publishing token (type depends on Q2) |
| hosting credentials | Per Q1 |

`configured()` is true only when all are present. Until then the channel is **skipped with a
notice**, which is how it can merge before the account is set up. Health gains an expiry
signal: the adapter checks the token once per run (debug or introspection endpoint) and
alerts when fewer than 10 days remain. If the token never expires (Q2 option A), the check
still runs and alerts on an invalid token.

### Retraction and correction (see Q3)

If the Graph API cannot delete a feed post, `retract()` throws a clear, typed
"manual action needed: delete {permalink} in the app" error, which the run log prints
and health records as a channel failure. `--correct` on Instagram becomes: post the corrected version,
then ask for the old one to be deleted by hand. The ledger marks the old row
`retracted: manual` so it is never re-posted.

### Data flow

```
payload (checked, card drawn) → host.publishCard → IG container → poll → publish
       → ledger row {platform: instagram, uri: mediaId} → health → cleanup hosted copy
```

### Ledger seeding

Before the first live run: `npm run syndicate -- --seed-ledger --channels instagram`, or
Instagram would receive the entire back catalogue in one run. The existing seed command does
this; the docs already warn about it for the first two channels.

---

## Testing Strategy

### Automated (`test/pipeline/syndication-instagram.test.ts`)

- [ ] Caption has no URL, has "link in bio", has 3–5 tags, fits budget
- [ ] Container → poll → publish happy path (fetch mocked)
- [ ] Container `ERROR` and poll timeout become a channel failure, not a crash
- [ ] `configured()` false skips with a notice
- [ ] Alt text is sent on every post
- [ ] Retract on an undeletable platform raises the manual-action error and marks the row
- [ ] Hosting: upload returns HTTPS URL; cleanup is called after publish, not before

### Manual (Window 3)

- [ ] `--dry-run --channels instagram` prints the exact caption and hosted URL
- [ ] One real post, end to end, to the account; check it on a phone
- [ ] Nine-up grid mock from the last nine payloads
- [ ] `--retract` on that post behaves as Q3 decides

---

## Implementation Plan

### Phase 1: Adapter and hosting (Window 1)

**Create:** `adapters/instagram.ts`, `host.ts`, the test file.
**Modify:** `types.ts` (`IMPLEMENTED_CHANNELS`), caption composer.
**Acceptance:** all automated tests green; channel inert without secrets.

### Phase 2: Wiring and health (Window 2)

**Modify:** `run.ts` default adapters, `syndicate.yml` secrets, `health.ts` expiry,
`docs/SYNDICATION.md`, `docs/SECRETS.md`.
**Acceptance:** a run with no Instagram secrets is identical to today's; with secrets
present but invalid, health records a failure and alerts.

### Phase 3: Go-live (Window 3), only after a clean week on Bluesky and Mastodon

1. Owner completes account setup (below).
2. Add secrets. Run `--seed-ledger --channels instagram`.
3. `--dry-run`, then one manual dispatch, then let the schedule run.

### Account setup (owner, one-time)

- [ ] Convert `@concertsmorperhaus` to a professional (Creator or Business) account
- [ ] Create the Meta app and grant `instagram_content_publish` (+ basic read)
- [ ] If Q2 = A: link a Facebook Page and create a system user in Business settings
- [ ] Set the bio link: `https://concerts.morperhaus.org/liner-notes?utm_source=instagram&utm_medium=social&utm_campaign=bio`
- [ ] Profile copy is already written (#358); avatar (#355) and header (#356) are outstanding

---

## Future Enhancements

- **Carousels (L2).** A liner note's `beats` are a natural 3–5 panel story. Strongest
  format on the platform; one extra call per post. Separate spec once single-image is
  stable.
- Instagram handle mapping for opener mentions.
- Reels (video) is a different surface and depends on L3 video (#100).

---

## Questions for Review

**Q1. Where does the card live long enough for Instagram to fetch it?**
- **A. Cloudflare R2 public bucket (recommended).** Upload at post time, delete after
  publish. Immediate, no repo growth, and the account already runs on Cloudflare. Costs
  one new bucket and an access key pair.
- B. Commit the JPEG to the site (`public/syndication/`) and post on the next run, once
  Pages has deployed it. No new infrastructure, but adds a day's lag and ~200 KB per post
  to the repo forever.

**Q2. Which token, and how does it stay alive?**
- **A. Facebook-Login path with a Business system-user token (recommended, verify at
  build).** System-user tokens can be issued without an expiry, so there is no refresh job,
  and no need for a workflow that rewrites its own GitHub secret (which needs a PAT). Costs
  linking a Facebook Page and a Business portfolio.
- B. Instagram-Login path, long-lived token (60 days) refreshed programmatically. No
  Facebook Page, but the refreshed token must be written back somewhere the next run can
  read: a GitHub secret (needs a fine-grained PAT with secrets write) or Cloudflare KV.
  More moving parts, and exactly the silent-death risk this project keeps paying for.

**Q3. If the API can't delete a feed post, is "manual delete, flagged loudly" acceptable?**
Verify deletion support at build time; it has changed before. If it is supported, `retract`
works like Mastodon's and this question disappears.

**Q4. Do On This Day posts go to Instagram too?** Recommended yes. They are the most
visual posts and already carry the card. The alternative is liner notes only.

---

## Revision History

- **2026-10-11:** Initial specification created
- **Version:** 1.0.0
- **Author:** Claude Code (for Mike Morper)
- **Status:** Planned
