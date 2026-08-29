# Artist and Venue Handles in Social Posts

**Status:** Shipped on Bluesky (#423). X and Instagram sequenced behind #334/#335
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
channels live today, the reach is thin: 21 of 257 artists have a findable
Bluesky account and exactly one has a Mastodon address. On the two channels
Phase 3 adds, it is worth building: 170 of 257 artists have an X account and
143 have an Instagram account, both already curated by MusicBrainz and Wikidata
editors.

Bluesky shipped first anyway, and not on reach. A bug in the swap rule
mis-tags 11 posts there and would mis-tag over a hundred on X. It earned that
immediately — see *Sequencing*.

**Venues came second and are covered here too** (#423). They are a better
prospect than artists on every axis but one: active accounts with a reason to
engage, and no stable identifier. Coordinates supply the identifier.

Nineteen entities are on file today — 17 artists and 2 venues — and 11 of the
58 published notes carry a mention.

---

## What the data actually says

Measured 2026-08-28 against the live archive: 257 artists, 232 of which carried a
MusicBrainz ID via `discography.json` at the time.

> ⚠️ **The 232 denominator below is historical.** Coverage is now **256 of 257**
> — the 25 that appeared to be missing were mostly a keying bug, not absent
> records (#433). The 24 artists that gained an ID were re-harvested and the
> results are in the worksheet; the per-source columns are left at their
> original denominator because that is what was actually measured, and
> restating them without re-running the sweep would be inventing numbers.

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

- **9 of 58 (16%)** would carry a Bluesky mention on the research inventory.
  With the curated MusicBrainz and Wikidata rows accepted and venues in, the
  shipped figure is **11 of 58**.
- **0 of 3** current On This Day posts would.
- **4 of the 21 Bluesky accounts have never posted** — `@colinhay.com`,
  `@depechemode.com`, `@loslobos.org`, `@publicenemyno1.bsky.social`. A mention
  reaches a notification inbox nobody opens. They publish anyway; dormancy is
  not permanent and a liveness threshold is one more number to defend.

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

### The one automatic rule that is safe — and the half of it that is not

A Bluesky domain handle is proven by DNS TXT record or an HTTPS well-known
file. If `depechemode.com` resolves as a handle, whoever controls DNS for the
band's official website set it. That is stronger evidence than platform
verification, and it needs no human judgement.

126 of 257 artists have a `website` in `artists-metadata.json`. Eleven of those
domains resolve as Bluesky handles and are the artist's own:

```
Bruce Springsteen  @brucespringsteen.net    Depeche Mode   @depechemode.com
Dropkick Murphys   @dropkickmurphys.com     Joe Satriani   @satriani.com
Echo & The Bunnymen @bunnymen.com           Living Colour  @livingcolour.com
EMF                @emf-theband.com         Los Lobos      @loslobos.org
Squeeze            @squeezeofficial.com     Umphrey's McGee @umphreys.com
```

**The DNS check answers a narrower question than it appears to.** It proves
whoever set the record owns the domain, which is only an *identification* if
the domain is the artist's own. The first real harvest proposed `@lojinx.com`
for Fountains of Wayne: MusicBrainz lists it as their official homepage, the
domain genuinely resolves as a Bluesky handle, and Lojinx is their record
label. Every step was correct and the answer was wrong.

So the rule carries a second half. The registrable name has to look like the
entity's — one contains the other, and the shorter is at least 0.3 of the
longer. That keeps `bunnymen` for Echo & The Bunnymen, `satriani` for Joe
Satriani and `emftheband` for EMF, and drops `lojinx`. The 0.3 floor is what
`emf` inside `emftheband` needs; below it, short common words start matching
long names by coincidence.

With both halves, the rule costs one HTTP call per entity and gets better on
its own as artists adopt domain handles. It is the only resolution rule that
should ever run unattended.

---

## Venues

Venues were added after the artist work (#423). They are a better prospect than
artists on every axis except one: they are businesses, they are active on
social media, and they have a reason to engage with a post about a show in
their room. What they lack is a stable identifier — there is no venue
equivalent of a MusicBrainz artist ID in our data.

### Coordinates are the identifier

MusicBrainz has **Place** entities, and Places carry coordinates. We hold a
geocode for all 79 venues. So the venue is identified by measurement rather
than by name: search MusicBrainz by name, keep the nearest result inside 2 km,
and read its URL relationships.

That distance threshold is not a guess. Real matches cluster far below it:

| Venue | Distance |
|---|---|
| Staples Center | 0.005 km |
| Howard Theater | 0.003 km |
| 9:30 Club | 0.010 km |
| Kia Forum | 0.011 km |
| Irvine Meadows | 1.683 km |

The outlier is an amphitheatre whose geocode lands on its car park, which is
what sets the ceiling. A different venue in the same city is kilometres away,
so there is a wide gap between the loosest true match and the tightest possible
false one.

**Name scoring is deliberately not attempted.** MusicBrainz spells venues
differently than we do, and the roster contains names generic enough — "The
Forum", "UCLA" — that a name match would be actively misleading exactly where
the coordinates are decisive.

### What it found

28 of 79 venues matched a Place and carried at least one usable link: 26 on X,
24 on Instagram, 2 on Bluesky. The same lopsidedness as the artists, and for
the same reason — the reference data reflects where these accounts actually
are.

### Which entity a post mentions

One mention per post, following the tag priority already in `tags.ts`: the lead
artist, and the venue **only when the lead artist has no account**. A venue
mention displaces the venue tag, not the first tag — displacing by position
would throw away the artist tag, which is the more valuable one, and still
print `@theanthem #TheAnthem`.

### "Official account" and "right account" are different questions

`ucla` resolves to `@ucla.edu`. Both proofs hold — the domain resolves and the
coordinates matched — and the account is the University of California rather
than a concert hall. It was blocked on review for that reason and then
unblocked, because the two posts it affects are campus shows: the university
*is* the venue, and "UCLA" is not standing in for a room inside it.

Worth recording as the worked example. The rules establish that an account
belongs to an entity. Whether naming that entity is the right thing to do in a
given post is a judgement the rules cannot make, and the `blocked` state is
where that judgement gets written down.

---

## Design

### The fallback already ships

`entityTags()` puts artists first, in billing order, and `tagsForChannel()`
gives Bluesky the first one or two. Every post about an artist already carries
that artist's hashtag on every channel that takes tags. **No fallback code is
needed.** The feature is the mention half only, and "no handle on file" is the
normal, correct, zero-work path.

### Data: `data/social-handles.json`

Alongside the ledger and the pause switch.

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
  },
  "venues": {
    "the-anthem": {
      "bluesky": {
        "handle": "theanthemdc.bsky.social",
        "did": "did:plc:fv3ksu5ms3met4rn2n435u5e",
        "evidence": "musicbrainz",
        "verifiedAt": "2026-08-28"
      }
    }
  }
}
```

**Not in `public/data/`, and not merged into `artists-metadata.json`.** Three
reasons, the first decisive. `enrich-artists.ts` replaces records wholesale
(`metadata[normalized] = audioDbInfo`) rather than merging them, so a curated
`blocked: true` — a promise to somebody who asked not to be tagged — would be
silently destroyed by the next enrichment run. Human decisions must not live in
a file a scraper rewrites. Beyond that, six client call sites fetch
`/data/artists-metadata.json`, so it ships to every visitor for data only the
build-time pipeline reads; and putting venues in `venues-metadata.json` would
split one rule across two files with the same rewrite problem.

If the *site* ever wants to show these on the artist page, the answer is a
derived public projection — handles minus the `evidence`/`blocked`
bookkeeping — emitted at build time. Curated source in `data/`, derived copy
ships.

Five rules govern the shape.

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

**5. An opt-out is `"blocked": true`, never a deleted row.** A deleted row is
indistinguishable from one that was never harvested, so the next harvest would
re-propose it and quietly undo the request. The row stays, carries the refusal,
and the harvester skips anything holding it.

### Harvesting

`npm run harvest:handles` — a review tool, never a publish path.

1. Read MusicBrainz `url-rels` for each MBID (1 req/sec, ~4 minutes for 232
   artists) and Wikidata via one bulk SPARQL query on `P434`.
2. Run the Bluesky domain rule against every known `website`.
3. Write proposals to a worksheet, **not** to `social-handles.json`.
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
pipeline posts unattended. Decided policy, and the reasoning, are in
*Staleness — the drift check is the mechanism, the date is the backstop* below:
`verifyHandles` reports drift without acting on it, and an unconfirmed row
falls back to the hashtag after 18 months.

---

## Sequencing

**Harvest and curate now, wire Bluesky now, ship the value with Phase 3.**

| Stage | Work | Reach | State |
|---|---|---|---|
| **A** | Harvester, `social-handles.json`, `handles.ts`, the Bluesky swap | 19 entities, 11 of 58 posts | **Done (#423)** |
| **B — with #334 / #335** | Instagram and X mentions | 152 and 178 artists, 24 and 26 venues | Waiting on the adapters |
| **Never** | Mastodon | 1 artist | — |

Stage A does not pay for itself on reach alone. The reason to do it first is
that a bug in the swap rule mis-tags 11 posts on Bluesky and would mis-tag over
a hundred on X. Bluesky is the rehearsal, and it is the cheap one — it earned
that description immediately, finding three defects before anything shipped:
the label-domain false positive above, a tag displacement that dropped the
wrong tag, and an expiry that floored to the month.

The curation cost is lopsided in our favour. Bluesky coverage would need
roughly 250 hand-searches to gain about a dozen mentions — not worth it, so
Bluesky took only the domain rule and the curated MusicBrainz and Wikidata
rows. X and Instagram need **review, not research**: those editors have already
done the work, and the 380 rows sitting in the worksheet are an afternoon of
confirming already-curated links.

**Do not review those rows until the adapters exist.** X and Instagram store a
bare username with no stable identifier and both platforms recycle usernames,
so a review done a year early is a review done twice.

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

## Decided (owner, 2026-08-28)

1. **The billing name only, never a substitution.** Ian McCulloch and Echo &
   The Bunnymen both have accounts. A post billed to the Bunnymen mentions the
   Bunnymen. The pipeline never reaches past the name on the ticket to find a
   member with a livelier account.
2. **Label- and estate-run accounts publish.** "Official" is the claim being
   made, not "personally typed". `evidence` records where the identification
   came from; it does not claim who holds the phone.
3. **Dormant accounts are mentioned.** Four of 21 have never posted. It costs
   nothing, dormancy is not permanent, and a liveness threshold would be one
   more number to defend.
4. **Opt-out is a state, not a deletion.** `"blocked": true` on the row. A
   deleted row is indistinguishable from one never harvested, so the next
   harvest would re-propose it and the request would be silently undone.

---

## Staleness — the drift check is the mechanism, the date is the backstop

A `verifiedAt` cutoff was proposed at 12 months and is **revised to 18**, with
the real work moved to the check.

The two live-channel risks are narrower than a calendar timer implies. A
Bluesky DID is permanent and never reassigned, so the account we verified stays
the account we mention; what can change is that it is renamed, abandoned, or
transferred. `verifyHandles` re-resolves each stored DID and reports drift, and
**drift is a warning, never an auto-update** — a changed handle can mean a
transferred account, which is exactly when we should stop mentioning it.

The timer is a genuinely different guarantee, and it is what catches the check
itself falling over: a row nobody has confirmed in 18 months falls back to the
hashtag until someone re-confirms it. That is not an error state. It is the
system declining to vouch for something it has not looked at.

**X and Instagram will need a shorter cutoff and a liveness probe**, because
they store a bare username with no stable identifier behind it and both
platforms recycle usernames. There, a stale row can genuinely point at a
different person. Set that number when #334/#335 land, against those platforms'
behaviour rather than by analogy to this one.

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
| 2026-08-28 | Venues added. MusicBrainz Places matched by coordinates, 28 of 79 carry a link. The domain rule gains a name-affinity half after it proposed a record label for Fountains of Wayne. Stage A shipped (#423). |
| 2026-08-28 | Owner decisions recorded: billing name only, label/estate accounts publish, dormant accounts publish, opt-out is a `blocked` state. Staleness reframed — the drift check is the mechanism, the date is the backstop, 18 months not 12. |
