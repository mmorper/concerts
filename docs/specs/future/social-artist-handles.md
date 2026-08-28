# Artist Handles in Social Posts

**Status:** Research complete — not implemented
**Target Version:** Phase 3 of the syndication epic (#323)
**Priority:** Medium
**Estimated Complexity:** Low engineering, Medium data curation
**Dependencies:** #334 (Instagram adapter), #335 (X adapter) — see *Sequencing*

---

## Executive Summary

Today a post about The Human League carries `#TheHumanLeague`. This spec covers
the other half of that: carrying `@thehumanleague` when the artist has an
official account on the channel we are posting to, and keeping the hashtag when
they do not.

The engineering is small. The pipeline already resolves a lead artist, already
generates entity tags in priority order, and already has a place to put the
swap. The whole change is one lookup and one substitution.

**The hard part is knowing which account is really the artist's**, and that is
not automatable. A resolver built on the strongest signals Bluesky exposes —
platform verification plus an exact display-name match — returned INTERPOL, the
international police organisation, as the official account for the band
Interpol. It returned a sitting Member of Parliament for the ska musician Chris
Murray. Two wrong answers out of nineteen, and the pipeline posts unattended on
a daily schedule.

So the inventory has to be a **curated allowlist with recorded evidence**,
harvested from sources that are already human-edited, and it must be capable of
saying "I don't know" — which is free, because the hashtag fallback already
ships.

**The measured payoff is lopsided and it decides the sequencing.** On the two
channels that are live today, this feature is nearly worthless: 21 of 257
artists have a findable Bluesky account, and exactly one has a Mastodon
address. On the two channels Phase 3 adds, it is worth building: 170 of 257
artists have an X account and 143 have an Instagram account, both already
curated by MusicBrainz and Wikidata editors.

---

## What the data actually says

Measured 2026-08-28 against the live archive: 257 artists, 232 of which carry a
MusicBrainz ID via `discography.json`.

### Handle coverage by channel

| Channel | MusicBrainz | Wikidata | Union, hand-verified | Adapter today |
|---|---|---|---|---|
| Facebook | 172 / 232 | 181 / 214 | — | none |
| X / Twitter | 155 / 232 | 161 / 214 | **170 / 257 (66%)** | #335 |
| YouTube | 143 / 232 | — | — | #349 |
| Instagram | 115 / 232 | 128 / 214 | **143 / 257 (56%)** | #334 |
| TikTok | 22 / 232 | — | — | #350 |
| Threads | 9 / 232 | 23 / 214 | — | none |
| **Bluesky** | 6 / 232 | 6 / 214 | **21 / 257 (8%)** | **live** |
| **Mastodon** | 0 / 232 | 1 / 214 | **1 / 257** | **live** |

The two channels we post to today are the two the reference data barely covers.
That is not a gap in the sources — it is the shape of where musicians actually
are. Both live channels post to audiences the artists themselves have largely
not joined.

### What that means for real posts

Against the 58 published liner notes, using the lead artist:

- **9 of 58 (16%)** would carry a Bluesky mention.
- **0 of 3** current On This Day posts would.
- **4 of the 21 Bluesky accounts have never posted** — `@colinhay.com`,
  `@depechemode.com`, `@loslobos.org`, `@publicenemyno1.bsky.social`. A mention
  reaches a notification inbox nobody opens.

### The verification problem, measured

Three automated resolution rules were run across all 257 artists against
Bluesky's public search:

| Rule | Matches | Wrong |
|---|---|---|
| Handle is the artist's known official website domain | 8 | 0 |
| Custom-domain handle matching the artist name | 4 | 0 |
| Platform-verified **and** exact display-name match | 7 | **2** |

The two failures were `interpol.int` (INTERPOL, the police organisation, 17k
followers, platform-verified) matched to the band Interpol, and
`chrismurraymp.bsky.social` ("MP for Edinburgh East and Musselburgh") matched to
Chris Murray. Both cleared the strictest rule available.

Loosening further is worse, not better. **80 artists have a Bluesky account
whose display name is character-for-character the artist's name**, and **41 of
those have two or more such accounts**. The top search hit for "The Human
League" is a fan. The top hit for "New Order" is a private individual whose
display name is a stylised "New Order". Automated resolution at that tier means
repeatedly @-mentioning strangers from an unattended cron job.

### The one automatic rule that is safe

A Bluesky domain handle is proven by DNS TXT record or an HTTPS well-known
file. If `depechemode.com` resolves as a handle, whoever controls DNS for the
band's official website set it. That is stronger evidence than platform
verification, and it needs no human judgement.

126 of 257 artists have a `website` in `artists-metadata.json`. Nine of those
domains resolve as Bluesky handles, with no false positives:

```
Bruce Springsteen  @brucespringsteen.net    Depeche Mode   @depechemode.com
Crowded House      @crowdedhouse.com        The Cure       @thecure.com
Dropkick Murphys   @dropkickmurphys.com     Joe Satriani   @satriani.com
Echo & The Bunnymen @bunnymen.com           Living Colour  @livingcolour.com
EMF                @emf-theband.com
```

This rule costs one HTTP call per artist and gets better on its own as artists
adopt domain handles. It is the only resolution rule that should ever run
unattended.

---

## Design

### The fallback already ships

`entityTags()` puts artists first, in billing order, and `tagsForChannel()`
gives Bluesky the first one or two. Every post about an artist already carries
that artist's hashtag on every channel that takes tags. **No fallback code is
needed.** The feature is the mention half only, and "no handle on file" is the
normal, correct, zero-work path.

### Data: `data/artist-handles.json`

Alongside the ledger and the pause switch, not in `public/data/` — the client
never needs it and it must not enter the bundle.

```jsonc
{
  "version": 1,
  "updatedAt": "2026-08-28T00:00:00.000Z",
  "artists": {
    "depeche-mode": {
      "bluesky": {
        "handle": "depechemode.com",
        "did": "did:plc:ueppiwulfqikh4zl2qre3evh",
        "evidence": "site-domain",
        "verifiedAt": "2026-08-28"
      },
      "x": { "handle": "depechemode", "evidence": "musicbrainz", "verifiedAt": "2026-08-28" }
    }
  }
}
```

Four rules govern the shape.

**1. `evidence` is a required enum, and it is the publish gate.**

```ts
type HandleEvidence = "site-domain" | "musicbrainz" | "wikidata" | "owner-checked";
```

Anything not in that union does not publish. This is the same move `MediaSource`
makes in `types.ts` and for the same reason: if a mention ever lands on the
wrong person, "every post that used a handle from source X" has to be one
`grep`, not an archaeology project. A search-heuristic handle has no member in
this union by construction — the strongest available form of "never", exactly
as `tags.ts` never reads `post.tags`.

**2. The DID is the identity; the handle is display text.** Bluesky handles are
mutable and re-assignable. The mention facet carries the DID, so it always
points at the account we verified. The handle is only what the reader sees, and
it can go stale — see *Staleness* below.

**3. Absence is normal, not an error.** No entry, no channel key, or expired
verification all mean the same thing: emit the hashtag. Nothing logs a warning.

**4. `verifiedAt` is when a human or the domain rule last confirmed it**, not
when the file was written.

### Harvesting

`npm run harvest:handles` — a review tool, never a publish path.

1. Read MusicBrainz `url-rels` for each MBID (1 req/sec, ~4 minutes for 232
   artists) and Wikidata via one bulk SPARQL query on `P434`.
2. Run the Bluesky domain rule against every known `website`.
3. Write proposals to a worksheet, **not** to `artist-handles.json`.
4. A human promotes rows. Only `site-domain` rows may be promoted
   automatically, because they are self-proving.

This mirrors `build-artist-pin-worksheet.ts` — propose, review, promote.

### Post-time resolution

Pure lookup. **No network call, no search, no fuzzy matching at post time.** A
scheduled job that guesses is the failure mode this whole spec exists to
prevent.

```ts
// scripts/syndication/handles.ts
export function mentionFor(artistSlug: string, channel: Channel): Mention | undefined
```

### The mention replaces the artist hashtag — it never adds to it

Measured against `budgets.ts`, Bluesky, worst case in graphemes:

```
today                        200 caption + 40 link + 35 tags + 4 seps = 279 / 300  ✅
mention added                                                  + 29   = 308 / 300  ❌
mention replaces artist tag  200 caption + 40 link + 18 tag  + 4 + 29 = 291 / 300  ✅
```

Adding overflows. The 21 characters of headroom `CAPTION_MAX` was chosen to
leave are already spent: across all 58 published captions the median is 175 and
the maximum is exactly 200.

Substitution is also the better post. `@DepecheMode #DepecheMode` in one line
is the tell of an automated account, which is the thing the authored-copy rule
exists to avoid.

**One mention per post, the lead artist only.** 40 of 58 notes name a single
artist and every On This Day post names exactly one, so this is the common case
already. It also caps the blast radius: the 22-artist venue-loyalty note must
never tag 22 accounts.

### Mastodon: do not implement

Two independent reasons.

- One artist of 257 has a Mastodon address.
- A Mastodon status that **begins** with a mention is treated as a reply and
  reaches only people who follow both accounts. Any implementation would have
  to guarantee the mention never leads — a real constraint to carry for a
  feature that would fire once.

### Staleness

Handles rot. Accounts are renamed, abandoned, sold and hijacked, and this
pipeline posts unattended.

- `verifyHandles` re-resolves each stored DID to its current handle and reports
  drift. **Drift is a warning, never an auto-update** — a changed handle can
  mean a transferred account, which is precisely when we should stop mentioning
  it.
- A `verifiedAt` older than 12 months falls back to the hashtag until
  re-confirmed. An expired entry is not an error; it is the system declining to
  vouch for something it last checked a year ago.

---

## Sequencing

**Do the harvest and the data file now. Wire Bluesky now. Ship the value with
Phase 3.**

| Stage | Work | Reach |
|---|---|---|
| **A — now** | Harvester, `artist-handles.json`, `handles.ts`, Bluesky swap | 21 artists, ~16% of posts |
| **B — with #334 / #335** | Instagram and X mentions | 143 and 170 artists, 56% and 66% |
| **Never** | Mastodon | 1 artist |

Stage A does not pay for itself on its own. It is worth doing now because the
harvest and the curation pass are the expensive part, they are the same work
whichever channel ships first, and doing them now turns Stage B into a
formatting change.

The curation cost is also lopsided, and in our favour. Bluesky coverage would
need roughly 250 hand-searches to gain about a dozen mentions — not worth it,
so Bluesky takes only the free domain rule and the six MusicBrainz rows.
X and Instagram need **review, not research**: MusicBrainz and Wikidata editors
have already done the work, and 313 rows of confirming already-curated links is
an afternoon.

---

## Editorial position

A mention is a **credit**, not a distribution tactic. Neither Bluesky nor
Mastodon amplifies a post because it mentions someone; it lands in a
notification inbox, and the upside is a repost that may never come. That is
consistent with the rule already in `types.ts` — *withhold the interpretation;
never the identification* — and it is the reason one mention, replacing a tag,
is the right size. An account that tags an artist in every post to farm
attention is a different kind of account than this one.

---

## Open questions

1. **Solo members versus the band.** Ian McCulloch and Echo & The Bunnymen both
   have accounts. A post about a Bunnymen show — which one? Proposal: the
   billing name only, never a substitution.
2. **Estates and label-run accounts.** Some official accounts are run by a
   label or an estate rather than the artist. Publish them, or restrict to
   artist-run? Proposal: publish — "official" is the claim, not "personally
   typed".
3. **Should a dormant account be mentioned at all?** Four of 21 have never
   posted. Proposal: yes. It costs nothing and dormancy is not permanent.
4. **12-month expiry — right number?**
5. **Opt-out.** If an artist asks not to be tagged, the mechanism is a row in
   the file. Worth an explicit `"blocked": true` state rather than deletion, so
   a later harvest cannot re-propose it.

---

## Related

| Topic | File |
|---|---|
| Parent epic and phase plan | [`global-social-syndication.md`](global-social-syndication.md) |
| Tag rules per channel (§7) | [`mocks-social-syndication/DECISIONS.md`](mocks-social-syndication/DECISIONS.md) |
| Operating the pipeline | [`../../SYNDICATION.md`](../../SYNDICATION.md) |
| Entity tags and the fallback | `scripts/syndication/tags.ts` |
| Text budgets | `scripts/syndication/budgets.ts` |

---

## Revision History

| Date | Change |
|---|---|
| 2026-08-28 | Research complete. Coverage, false-positive rate and budget arithmetic measured against live APIs. |
