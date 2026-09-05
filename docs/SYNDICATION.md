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

### From a phone

**Actions → Syndicate → Run workflow → mode: `pause`.** Leave `channels` blank
to stop everything, or name one to stop only that. Add a `reason` — it goes
into the commit.

That is the whole procedure. The workflow writes the switch, commits it and
pushes, so it takes effect exactly the way a pause from a laptop does. `resume`
is the same dialog with a different mode.

It runs before the workflow's own kill-switch gate on purpose: that gate skips
every later step when the switch is engaged, which would otherwise make
`resume` the one mode that could never run.

### From a machine

```bash
npm run syndicate -- --pause "why"
npm run syndicate -- --pause "why" --channels mastodon   # one channel only
npm run syndicate -- --resume
npm run syndicate -- --resume --channels mastodon
git add data/syndication-pause.json && git commit -m "chore: pause syndication" && git push
```

Or `/social-pause` in Claude Code, which does all of that including the push.

**It only takes effect once pushed.** The scheduled workflow reads the switch
from the repository, not from your machine. A pause sitting in a working copy
stops nothing. The workflow path above pushes for you, which is most of why it
exists.

Check state at any time:

```bash
npm run syndicate -- --status
```

`--status` lists the global switch *and* every channel stopped on its own, even
while the global one is engaged — so "what is actually off" is one question
with one answer, rather than something you discover after resuming.

For an immediate stop that does not wait on CI, also disable the **Syndicate**
workflow in the GitHub Actions UI. Useful, but not the mechanism — a workflow
disabled in a web UI is invisible in the code, and six months later nobody
knows why it happened or that it did.

### One channel, not all of them

Mastodon misbehaving should not cost Bluesky its posts. A `channels` map in the
same file stops one and leaves the rest running:

```jsonc
{
  "paused": false,
  "channels": {
    "mastodon": { "paused": true, "reason": "instance is down", "pausedAt": "..." }
  }
}
```

Every rule below applies again, scoped: a malformed channel entry pauses **that
channel**, `SYNDICATION_PAUSED_CHANNELS=mastodon` pauses it whatever the file
says, and no environment variable can resume one.

**The global switch outranks the map.** `paused: true` stops every channel
regardless of what the map says, because "stop everything" has to mean it. For
the same reason, resuming one channel does not lift a global pause — the CLI
says so rather than letting you think it worked.

**Retraction still works on a paused channel.** You pause a channel precisely
when you may need to pull something off it.

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
| `channels.<name>.paused: true` | That channel paused; the rest keep posting. |
| A malformed channel entry | **That channel** paused. Same asymmetry, scoped. |
| `SYNDICATION_PAUSED_CHANNELS=mastodon` | Those channels paused, whatever the file says. |

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

### Proof the queue before it posts

```bash
npm run contact-sheet                  # every pending post, both channels
npm run contact-sheet -- --limit 10
npm run contact-sheet -- --slug <slug>
npm run contact-sheet -- --no-render   # reuse what is already in .renditions/
```

Writes `.renditions/contact-sheet.html` — the card, the caption, the shortened
link, the mention and the tags, per channel, for everything still queued.

A dry run proves the pipeline runs. It proves nothing about whether the post is
any good. What goes wrong is visual and textual at once: a hook overflowing its
box, a press shot of the wrong band, a caption that reads fine alone and badly
under the image, a mention pointing at a stranger. None of that is legible in a
JSON dump and all of it is obvious on a page.

Every string on the sheet comes from `composeBlueskyText` and
`composeMastodonStatus` — the same functions the adapters call. Re-implementing
the formatting for display would produce a proof sheet that agrees with itself
and disagrees with production, and the reviewer would sign off on something that
was never going to ship.

Mentions render as links to the account's **DID**, so "is this really the right
account" is one click away from the sheet.

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
| `scripts/syndication/handles.ts` | `@artist` / `@venue` lookup; built out of refusals |
| `scripts/syndication/harvest-handles.ts` | Proposes handles for review. Never a publish path |
| `scripts/syndication/contact-sheet.ts` | Proofs the queue as a page. Reads only |
| `scripts/on-this-day/` | The second stream — detection, scoring, card, CLI |

---

## Naming the account, not just the name

A post about The Human League carries `#TheHumanLeague`. When we know the
artist's — or the venue's — real account on the channel we are posting to, it
carries `@thehumanleague` instead.

```bash
npm run harvest:handles                # propose candidates into a worksheet
npm run harvest:handles -- --new-only  # only what the archive has just gained
npm run harvest:handles -- --venues    # one entity kind
npm run harvest:handles -- --promote   # accept the self-proving rows
npm run harvest:handles -- --accept artist:blondie:bluesky,venue:the-anthem:bluesky
npm run harvest:handles -- --verify    # re-resolve stored DIDs, report renames
```

### New artists and venues look after themselves

The archive gains artists and venues whenever concerts are added, so
`npm run build-data` harvests for them — `--new-only`, then `--promote`.

It has to be incremental to survive. A full crawl is twenty minutes at
MusicBrainz's one request per second; the incremental run for two new entities
is seconds. A step that expensive is a step everybody learns to skip with
`--skip-handles`.

That works because the worksheet records `attempted` for **every** entity a
harvest looked at, including the ones that produced nothing. Recording the
misses is the load-bearing part: 129 of 336 entities have no account anywhere,
and without a record of having asked they would be re-crawled forever. Pass
`--recheck <days>` to re-ask about old attempts; it is off by default, because
an artist with no account today probably has no account next Tuesday.

**The step is never fatal.** MusicBrainz being down must not fail a data
refresh — the pipeline's job is concert data, and a missing handle costs a
hashtag we were going to print anyway. It publishes nothing on its own either:
proposals land in the worksheet, and only the self-proving `site-domain` rows
promote.

### It is an allowlist, and that is not caution for its own sake

Finding an artist's real account cannot be automated. Measured across all 257
artists, Bluesky's strongest available signal — a verification badge plus an
exact display-name match — returned `interpol.int` for the band Interpol. That
is INTERPOL, the international police organisation. It returned an MP for
Edinburgh East for the ska musician Chris Murray. Two wrong out of nineteen.

Loosening is worse: **80 artists have an account whose display name is
character-for-character theirs, and 41 of those have two or more.** The top hit
for "New Order" is a private individual.

So `handles.ts` never searches, guesses or touches the network. A mention is a
row in `data/social-handles.json` or it does not happen, and every row records
`evidence` from a closed union. **There is no member for "found by search"**, so
a handle discovered that way has nowhere to be written and cannot reach a post
even by accident — the same structural "never" that keeps detector tags out by
never reading `post.tags`.

### The two rules that prove themselves

Only these promote without a human.

- **A resolvable website domain** (Bluesky). If `depechemode.com` resolves as a
  handle, whoever controls DNS for the band's official site set it — proven by
  a TXT record or an HTTPS well-known file, which is stronger than a
  verification badge.
- **Coordinates, for venues.** We hold a geocode for all 79; MusicBrainz Places
  carry their own; a place within 2 km is the same building. That is a
  measurement rather than an opinion about names, which matters when the roster
  contains "The Forum" and "UCLA". Real matches cluster under 0.5 km.

### Rules the pipeline enforces

- **The mention replaces the artist tag; it never joins it.** Appending
  overflows Bluesky at 308 graphemes against a 300 limit; swapping fits at 291.
  `@DepecheMode #DepecheMode` would also be the tell of an automated account.
- **One mention per post — the lead artist, then the venue.** Same priority as
  the tags. The 22-artist venue-loyalty note must never tag 22 accounts.
- **The billing name only.** A post billed to Echo & The Bunnymen mentions the
  Bunnymen, never Ian McCulloch, however much livelier his account is.
- **The facet carries a DID, never a handle.** Handles are re-assignable; a DID
  is not. `--verify` reports renames and **never acts on one** — a rename looks
  identical whether the artist rebranded or the account changed hands.
- **A row nobody has confirmed in 18 months stops publishing.** Not an error;
  the archive declining to vouch for something it has not looked at.
- **An opt-out is `"blocked": true`, never a deleted row.** A deleted row reads
  as never-harvested, so the next harvest would re-propose it and silently undo
  the request.

Every one of those lands on the hashtag, which was shipping anyway. There is no
error path and nothing logs a warning.

**Mastodon is deliberately not implemented.** One artist of 257 has an address,
and a status that *begins* with a mention is treated as a reply that reaches
only people following both accounts.

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

## Authored, never derived

The one sentence this whole stage exists for: the social copy is written on
purpose, not chopped out of the note. `checkSocial()` enforces it with two rules.

| Rule | Fails when |
|---|---|
| `derived-copy` (headline) | The hook is the headline with different punctuation. |
| `derived-copy` (prose) | Any field shares **8+ words of phrasing** with the note's prose. |

**The prose rule exists because the headline rule was not enough.** It compared
the hook to the headline and nothing else — the prose was never passed in — so
copy chopped out of the paragraph was structurally invisible to the one check
built to prevent it. It shipped: the Tears For Fears hook read "Roland Orzabal's
voice felt like it could crack open the world", eleven words verbatim from its
own note, authored under every other rule on this branch.

Names are masked before comparing — artists, venues, cities and years. You
cannot paraphrase a band or a date, and a caption that names the artist the hook
could not is doing its job, not copying. Eight words is measured, not chosen: at
8 every flagged field is a genuine lift, and at 7 the rule starts catching facts
like "welsh alternative rock band formed in 1981".

Found by a parallel working session, not by this one. It is recorded here
because the check is easy to weaken by accident and the reasoning is not
obvious from the code.

## How much a run posts

**The ceiling is `3 + backlog`, per channel.** Not `backlog`.

`run.ts` caps the normal queue at 3 and liner notes and On This Day *share* that
cap; the drip is added on top. So the scheduled `DEFAULT_BACKLOG: "1"` means up
to four posts per channel in a run, not one. The first live drip made this
concrete: `--backlog 2` posted five — two archived notes and three anniversaries
that were already due.

That arithmetic is why the scheduled default is 1 and not 3. Raising it raises
the ceiling by the same amount on every run, including days that already have a
full normal queue.

**Mondays do not drip.** The weekly liner note publishes then, and the drip
landing on top of it buries the thing it exists to support.

**A dispatch always wins.** `-f backlog=N` is honoured exactly, including 0. The
default applies only to cron, and the workflow branches on `github.event_name`
rather than on whether the input looks empty — `backlog` carries a dispatch
default of `'0'`, and relying on how Actions fills the inputs context under cron
is the kind of assumption whose failure is a drip that silently never drips.

## Decided, not yet done

### Back-catalogue drip: daily at first, then taper

57 archived notes can be dripped with `--backlog N`. The mechanism works; the
schedule is the decision, and it is this:

**Daily except Mondays for the first ~3 weeks, then drop to 2 a week.**

Turn it on only once the new-post flow has run clean on live channels for a
couple of weeks — one variable at a time.

The reasoning is worth keeping, because the obvious read is wrong in both
directions. Six a week clears the archive in 10 weeks; one a week takes 57. The
argument for going slow is **not** volume — 8 posts a week is unremarkable, and
repetition is a non-issue (at 6/week only 2 weeks in 10 contain a repeated
artist). The argument is that neither Bluesky nor Mastodon amplifies anything:
reach is followers × time, so spending a finite, non-renewable archive into a
brand-new account with no followers is spending it at the worst exchange rate
available.

The argument for going fast is real too: a profile with five posts on it does
not convert a visitor into a follower. Hence front-load, then taper — buy the
depth, then stop spending.

Automate it rather than dispatching by hand. A drip that needs someone to
remember runs twice and stops. One line in the workflow, on a fixed weekday
that is not Monday, so it does not land on top of the fresh liner note.

### Dashboard control: deliberately deferred

The kill switch is reachable from a phone via the workflow's `pause` mode, and
that closed the actual gap. A dashboard button is a convenience on top.

**When it is built, spec the WRITE PATH, not "social controls."** Today the
dashboard mirrors state — traffic, MCP usage, spend. A control that stops the
publishing pipeline would be the first time it becomes a lever, and levers need
answers to: who can pull it, where the state lives, what the audit trail is,
what happens when the write fails, and how it is not pulled by accident.

Pausing syndication is the first *user* of that write path, not the reason for
it. It belongs with #172.

If it is built: **commit to the repo via the GitHub API, not KV.** One source
of truth, git history records who and why, and it writes the same file the CLI
and the workflow already write. A second store gives you a second place to look
when posting stops and nobody remembers why.

---

## Not built yet

| | Blocked on |
|---|---|
| Instagram + X adapters (#334, #335) | The 4:5 render target (#342) |
| The 630×630 wide-card composition | #342 — Phase 1 posts the existing OG card |
| Multi-show On This Day days | Tier-3 artwork — 28 days a year deferred |
| YouTube Shorts + TikTok | L3 video and #100 |
| Syndication health on the dashboard | #337. The control surface it would sit beside is #172 — see *Decided, not yet done* above |
| The back-catalogue drip, switched on | Nothing. The schedule is decided; see *Decided, not yet done* above |
| `@artist` mentions on X and Instagram | #334/#335. Bluesky ships now; that is where the coverage is — 170 of 257 artists on X and 143 on Instagram, against 21 on Bluesky. See *Naming the account* below |

---

## Related

| Topic | File |
| ----- | ---- |
| Design rationale and phase plan | [`specs/future/global-social-syndication.md`](specs/future/global-social-syndication.md) |
| Phase 0 creative decisions | [`specs/future/mocks-social-syndication/DECISIONS.md`](specs/future/mocks-social-syndication/DECISIONS.md) |
| Image provenance policy | [`specs/future/mocks-social-syndication/PROVENANCE.md`](specs/future/mocks-social-syndication/PROVENANCE.md) |
| Handles: the coverage and false-positive measurements | [`specs/future/social-artist-handles.md`](specs/future/social-artist-handles.md) |
| Credentials and rotation | [`SECRETS.md`](SECRETS.md) |
| Where the posts come from | [`LINER_NOTES_PIPELINE.md`](LINER_NOTES_PIPELINE.md) |
| Voice rules for social copy | `.claude/skills/liner-notes-voice/SKILL.md` |
