# Social Syndication

How the archive posts to social channels, and how to stop it.

The site is canonical. Every social post is a deliberately lossy pointer back
to it — the goal is clicks to the archive, not an audience on someone else's
platform. This is the **POSSE** pattern: Publish on your Own Site, Syndicate
Elsewhere.

Design rationale lives in [`specs/future/global-social-syndication.md`](specs/future/global-social-syndication.md);
this doc is how to operate it.

---

## 🛑 Stop everything

```bash
npm run syndicate -- --pause "why"
git add data/syndication-pause.json && git commit -m "chore: pause syndication" && git push
```

Or `/social-pause` in Claude Code, which does all of that including the push.

**It only takes effect once pushed.** The scheduled workflow reads the switch
from the repository, not from your machine. A pause sitting in a working copy
stops nothing.

Check state at any time:

```bash
npm run syndicate -- --status
```

For an immediate stop that does not wait on CI, also disable the **Syndicate**
workflow in the GitHub Actions UI. Useful, but not the mechanism — a workflow
disabled in a web UI is invisible in the code, and six months later nobody
knows why it happened or that it did.

### How the switch behaves

`data/syndication-pause.json`, committed. Two independent layers honour it: the
workflow gates its own step, and `run.ts` checks before anything reaches an
adapter.

The defaults are deliberately asymmetric — **ambiguity means stop**:

| State | Result |
|---|---|
| File missing | Active. The normal state needs no ceremony. |
| `paused: true` | Paused. |
| Malformed or unreadable | **Paused**, and says why. |
| `SYNDICATION_PAUSED=1` | Paused, whatever the file says. |

The malformed case is inverted from the ledger, which *throws* on corruption
because silently starting fresh there would re-post everything. Here, "I cannot
tell" has to read as "do not post".

**No environment variable can force a resume.** An emergency stop should work
from anywhere; an emergency start should require editing the file that records
why it stopped.

**Still works while paused:** retraction (a kill switch that disabled the undo
would be the wrong shape), ledger seeding (writes no posts), and dry runs.

---

## 🗑 Unpublish something

```bash
npm run syndicate -- --retract <slug>
```

Deletes the post from every channel it went to. The ledger stores the returned
post IDs precisely so this is possible — it is impossible to retrofit once
those IDs are gone, which is why it shipped in Phase 1 rather than later.

This matters more than it looks. A note deleted from the site leaves its social
copies standing on servers we do not control. Retraction is the answer to that,
and the reason full automation was acceptable at all.

---

## What posts, where, when

### Two content streams

| Stream | Cadence | Source |
|---|---|---|
| **Liner notes** | ~1/week | `public/data/liner-notes.json` |
| **On This Day** | ~1.4/week, irregular | `public/data/on-this-day.json` |

On This Day exists because liner notes publish once a week (`POSTS_PER_RUN = 1`)
and that is thin. It posts about what happened on today's calendar day in a
previous year — **only on days that actually hit**. 145 of 366 calendar days
carry a show. Widening the window to "this week in" to manufacture a daily
rhythm is explicitly rejected: it makes every post weaker and turns the account
into a content mill.

### Channels

| Channel | Handle | Status |
|---|---|---|
| Bluesky | `@concertsmorperhaus.bsky.social` | **Live** |
| Mastodon | `@concertsmorperhaus@mastodon.social` | **Live** |
| Instagram | `@concertsmorperhaus` | Phase 3 (#334) |
| X | `@concertsmorps` | Phase 3 (#335) |

The X handle is deliberately different — X caps handles at 15 characters and
`concertsmorperhaus` is 18. Not a typo.

### Schedule (UTC)

| Time | Workflow | What it does |
|---|---|---|
| 07:00 daily | On This Day | Scores today; publishes if it clears the bar. **Most days: nothing.** |
| 08:00 Mondays | Liner Notes | Writes the weekly note |
| 10:00 daily | **Syndicate** | The only step that posts to a platform |

The gaps matter: a post's permalink, card and RSS entry must all be committed
and deployed before anything points at them. A social post that lands before
its permalink is a broken link to a stranger.

---

## Commands

```bash
npm run syndicate                        # post what is new
npm run syndicate -- --dry-run           # build payloads, print, post nothing
npm run syndicate -- --status            # is posting on or off?
npm run syndicate -- --pause "reason"    # stop everything
npm run syndicate -- --resume            # allow posting again
npm run syndicate -- --retract <slug>    # unpublish from every channel
npm run syndicate -- --seed-ledger       # suppress the back catalogue (once)
npm run syndicate -- --channels bluesky  # restrict the fan-out
npm run syndicate -- --backlog 1         # opt-in drip of one archived note
npm run syndicate -- --limit 2 --no-jitter

npm run generate:on-this-day             # today's anniversary post
npm run generate:on-this-day -- --survey # a year of supply, no writes
npm run backfill:social                  # author social copy for old notes
```

**A dry run does not prove the credentials work** — it never calls a platform.
The first real proof is the first live run, which fails loudly with a `401`
naming the channel.

---

## First run, once

> ⚠️ **Seed the ledger before the first real run.** 57 notes are already
> published; an empty ledger means the first run fires all of them at once, on
> a brand-new account, in one burst.

```bash
npm run syndicate -- --seed-ledger
```

This writes a `skipped` row for every existing post × channel pair, so the back
catalogue is suppressed rather than posted. Already done — `data/syndication-log.json`
carries 228 seeded rows.

### Backfilling the back catalogue

The 57 notes published before this stage existed carry no `post.social`, so
they are permanently ineligible to syndicate and `--backlog` has nothing to
draw on. `npm run backfill:social` authors copy for them through the **same**
path a new note gets — `generateSocial()` then `checkSocial()` — one API call
each.

```bash
npm run backfill:social -- --dry-run     # list what would be authored
npm run backfill:social -- --limit 5     # author five, then stop
npm run backfill:social                  # author every remaining note
npm run backfill:social -- --slug <slug> # one note
npm run backfill:social -- --force       # re-author notes that already have copy
```

Resumable: a re-run skips whatever already has copy, so the batch can be done
in chunks or picked up after a failure. `liner-notes.json` is written once at
the end — a crash loses that run's API calls, never leaves the file
half-written.

**Do not shortcut this by deriving copy from the headline.** See *Authored,
never derived* below — `checkSocial()`'s `derived-copy` rule means the backfill
cannot take that shortcut even by accident.

---

## How it works

```text
liner-notes.json ──► buildPayload() ──────┐
                                          ├──► SyndicationPayload ──► N dumb adapters
on-this-day.json ──► buildOnThisDayPayload()      (frozen)            bluesky, mastodon
                                                                       │
                                                                       ▼
                                                          data/syndication-log.json
                                                            (slug × platform)
```

**One canonical payload, N dumb adapters.** Adapters truncate and format only —
they never make content decisions. That keeps the voice consistent without
auditing N prompt variants, makes a new channel a formatting function rather
than a pipeline, and means one voice-check failure blocks syndication
everywhere by construction.

**Two streams, one payload.** `kind` is the only field that differs between
them, and the only thing that reads it is `withUtm` for campaign attribution.
No adapter branches on it.

### Authored, never derived

The hook, caption and carousel beats are written **on purpose**, in the
archive's voice, by the generation step — not chopped out of the first
paragraph of the prose. Every RSS-to-social bridge fails here, and it is the
single most visible tell that an account is automated.

Phase 0 measured the cost: 28 of the first 57 published headlines follow one of
five detector templates, and "Caught Once, Never Again" alone accounts for
nine. A profile grid of derived copy reads as robotic no matter how it is art
directed. `checkSocial()` fails a hook that merely restates its headline.

### Never bare type

Every post carries imagery. The rubric, in priority order: **personal beats
sourced beats derived**, and typography is a layer over an image, never the
image itself. `eligible: false` is where that becomes code — a payload with no
publishable media does not post.

`MediaAsset.tier` and `.source` record what actually shipped, per host. That is
not bookkeeping: if a content-ID or DMCA strike ever arrives, "every post
carrying a TheAudioDB press shot" is one `grep` rather than an archaeology
project.

### The ledger

`data/syndication-log.json`, keyed `slug × platform`, committed because it is
diffable, reviewable and greppable.

- **Never post if the pair exists** — re-running does not double-post.
- **Per-pair state** — Bluesky succeeding and Mastodon failing leaves exactly
  one row to retry. Retrying the batch would double-post to Bluesky.
- **Any row blocks**, including `retracted`. A pulled post coming back next
  week is what a naive "skip if posted" check gets catastrophically wrong.
- **Seeded** so the back catalogue never fires. An empty ledger means the first
  run posts everything at once.

### Modules

| File | Job |
| ---- | --- |
| `scripts/syndication/types.ts` | The frozen payload and ledger shapes |
| `scripts/syndication/budgets.ts` | Measured text budgets; the caption figure is *derived* from Bluesky's limit |
| `scripts/syndication/payload.ts` | Both payload builders, credit resolution, eligibility |
| `scripts/syndication/provenance.ts` | Image host → `tier` / `source` |
| `scripts/syndication/tags.ts` | Entity tags; four per-channel answers |
| `scripts/syndication/facets.ts` | Bluesky byte-offset rich text |
| `scripts/syndication/text.ts` | Bytes vs graphemes vs code units |
| `scripts/syndication/ledger.ts` | Idempotency, seeding, the retraction index |
| `scripts/syndication/pause.ts` | The kill switch |
| `scripts/syndication/run.ts` | Fan-out, jitter, partial-failure resume |
| `scripts/liner-notes/backfill-social.ts` | Back-catalogue social copy: selection and application |
| `scripts/on-this-day/` | The second stream — detection, scoring, card, CLI |

---

## Three things that are easy to get wrong

1. **Bluesky facets are UTF-8 byte offsets**, its limit counts **graphemes**,
   and `String.length` gives neither. All three units live in `text.ts`, and
   `FacetedText` makes offsets correct by construction rather than by search.
   An ASCII-only test passes while production ships mangled links — the tests
   deliberately use Björk and Motörhead.
2. **Bluesky will not scrape our OG tag.** The thumbnail must be uploaded as a
   blob first and referenced from the embed.
3. **Any ledger row blocks a post, including `retracted`.** See above.

---

## Credentials

Four secrets, set individually in **Settings → Secrets and variables →
Actions**. Full instructions with the exact menu paths are in
[`SECRETS.md`](SECRETS.md).

| Secret | Value |
|---|---|
| `BLUESKY_IDENTIFIER` | `concertsmorperhaus.bsky.social` |
| `BLUESKY_APP_PASSWORD` | An **app password**, never the account password |
| `MASTODON_BASE_URL` | `https://mastodon.social` |
| `MASTODON_ACCESS_TOKEN` | Scopes: `write:statuses` + `write:media` only |

Neither credential expires. Both are revocable from the account's own settings,
so if either leaks, **revoke first** and regenerate — the opposite of the
rotate-then-revoke order that applies to API keys with no revocation surface.

**A missing credential is not an error.** The channel is skipped with a notice
and the other still posts, so adding a channel later is not a broken run. It
also means a mistyped secret name looks like silence — which is why the dry run
checks for "no credentials configured" lines.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Nothing to syndicate this run" | Normal. Ledger already covers everything, or nothing new was generated. |
| "SYNDICATION IS PAUSED" | The kill switch. `npm run syndicate -- --status`. |
| `⏭ bluesky: no credentials configured` | Secret missing or misnamed — most often all four pasted into one secret. |
| `401` from a channel | Wrong or revoked credential. The ledger records nothing; a retry resumes only that channel. |
| A post is `eligible: false` | The run log gives the reason. Usually no authored social copy, or no publishable media. |
| On This Day published nothing | Expected on most days. `--survey` shows the year's supply. |

---

## Not built yet

| | Blocked on |
|---|---|
| Instagram + X adapters (#334, #335) | The 4:5 render target (#342) |
| The 630×630 wide-card composition | #342 — Phase 1 posts the existing OG card |
| Multi-show On This Day days | Tier-3 artwork — 28 days a year deferred |
| YouTube Shorts + TikTok | L3 video and #100 |
| Syndication health on the dashboard | #337 |
| `@artist` mentions instead of `#artist` tags | Nothing. Researched and deliberately sequenced behind #334/#335 — only 21 of 257 artists are on Bluesky and 1 is on Mastodon, against 170 on X and 143 on Instagram. See [`specs/future/social-artist-handles.md`](specs/future/social-artist-handles.md) |

---

## Related

| Topic | File |
| ----- | ---- |
| Design rationale and phase plan | [`specs/future/global-social-syndication.md`](specs/future/global-social-syndication.md) |
| Phase 0 creative decisions | [`specs/future/mocks-social-syndication/DECISIONS.md`](specs/future/mocks-social-syndication/DECISIONS.md) |
| Image provenance policy | [`specs/future/mocks-social-syndication/PROVENANCE.md`](specs/future/mocks-social-syndication/PROVENANCE.md) |
| Credentials and rotation | [`SECRETS.md`](SECRETS.md) |
| Where the posts come from | [`LINER_NOTES_PIPELINE.md`](LINER_NOTES_PIPELINE.md) |
| Voice rules for social copy | `.claude/skills/liner-notes-voice/SKILL.md` |
