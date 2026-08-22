# Liner Notes Voice Skill

**Purpose:** Reference this skill when writing or reviewing liner notes prose — system prompts, generated copy, or any first-person editorial content in the liner notes feed.

**When to use:**
- Writing or editing the system prompt in `scripts/liner-notes/generate.ts`
- Reviewing AI-generated prose for voice consistency
- Writing example posts or test fixtures
- Deciding whether a cultural reference is allowed

---

## The Voice

**Tone:** Warm, inviting, slightly reverent about live music. Like telling a close friend about your record collection — personal, specific, a little wry.

**Person:** Always first person. Always "I" — never "you," never "the archive owner," never "one might say."

| ✅ Do | ❌ Don't |
|------|---------|
| "I saw them at Irvine Meadows in 1985" | "You might remember this era" |
| "I didn't know it would be my last chance to see them" | "The archive owner recalls" |
| "That gap contains most of my concert-going life" | "It goes without saying" |
| "38 years. Same band. Just 41,000 more people." | "A legendary career spanning decades" |

---

## Structural Rules

Every post must:

- Be **2–5 sentences** (not a paragraph, not a one-liner)
- Name **specific artists, venues, and years**
- Include **at least one number** (years apart, concert count, attendance, etc.)
- End with something **human** — a reaction, reflection, or wry observation
- Be **self-contained** — no "as I mentioned above" or forward references

---

## Category-Specific Guidance

### Cultural Context (`"cultural"`)
Lead with the broader significance of the pattern, then bridge to "my experience of it."

> *"Blancmange opened for Depeche Mode at the Sports Arena in 1984, a year before their own debut album. By the time I saw them headline the Palace in 1986, they'd gone from support act to sold-out run — one of the cleaner career arcs I watched happen in real time."*

### Personal Connection (`"personal"`)
Lead with "I" and the personal moment. Bridge to what it meant.

> *"I first saw Depeche Mode at Irvine Meadows in 1985, the year they released Some Great Reward. 38 years later, I watched them fill Dodger Stadium — same band, same intensity, just 41,000 more people. That gap between two shows contains most of my concert-going life."*

### Deep-Cut Correlation (`"deep-cut"`)
Lead with the surprising discovery. Prove it with the data. React to it.

> *"I've been to the Hollywood Palladium 14 times across four decades, which I only noticed when sorting by venue. That's more than any other room — more than the Forum, more than the Staples Center. Apparently I have a type."*

---

## Cultural Context Confidence Tiers

Cultural references add era flavor. Use the tiers strictly:

### Tier 1 — Always allowed (grounded in your data)
- Artists, albums, genres, and dates **in concerts.json or enriched data**
- Artist's top tracks (from `artists-top-tracks.json`)
- Genre from `enriched data` ("they were part of the New Wave scene")
- **Album release dates and titles present in `album-eras.json`** ✨ v5.4
- **Where a show sat in an artist's arc** — the record they were touring, how
  old it was, how many albums came before or after ✨ v5.4

### Tier 2 — Allowed with approximate framing
- Well-known band breakups and reunions for major artists
- Career milestones widely documented in music history
- **Must use approximate language:** "around the time," "they had just released," "that was the era of," "I didn't know it would be one of the last shows"
- **One cultural detail per post maximum**
- **When in doubt, leave it out**

### Tier 3 — Never use
- Specific chart positions ("debuted at #4")
- Sales figures ("15 million copies worldwide")
- Unrelated cultural events ("same week Kurt Cobain died")
- Specific dates not in the dataset

> ⚠️ **Changed in v5.4.** This list used to read *"Specific dates not in the
> dataset (\"released March 19, 1990\")"*. Album release dates **are** now in
> the dataset — `album-eras.json` carries them for every studio album by every
> artist in the archive. For those albums the date is **Tier 1**: state it
> plainly. The rule still bites for albums by artists we've never seen.

### The defining-album citation ✨ v5.4

A shape the tiers above don't cover, because it is evidence about **the
listener** rather than a claim about the artist.

`album-eras.json` records which album carries a plurality of an artist's
still-streamed top tracks, with the counts (`topTrackCount` / `topTrackTotal`).
That supports a statement about what endured in *my* listening. It does **not**
support a critical verdict — the corpus has no notion of quality.

**Cite the evidence. Never assert the judgment.**

```
✅ "Three of the five Depeche Mode songs I still reach for come from an album
    that didn't exist that night"
   (Tier 1 — grounded in topTrackCount/topTrackTotal, and a claim about MY
    listening, which is the only claim the data can carry)

✅ "The record most of what I still play came from was two years away"

❌ "Violator was their masterpiece"
   (Critical judgment — nothing in the data supports it)

❌ "Violator was their most important album"
   (Same problem, softer wording)

❌ "Violator was their best-selling record"
   (Tier 3 — sales figures, unchanged)
```

### Song → album attribution ✨ v6.0

`song-albums.json` maps a performed song to the earliest studio album carrying
it. When an entry is present, the album is **Tier 1**: name it plainly.

**When attribution is absent, say nothing about the album.** Do not fill the gap
from your own knowledge of the record. This is the single most likely
hallucination this feature introduces, and it is the same rule the generator
prompt already states for invented biographical specifics — *"a number that
sounds right and is wrong is the single worst thing this pipeline can
produce."* Same rule, different field: an album that sounds right and is wrong
is a fabricated memory. Neither is a judgement call.

**`road-tested` claims the ALBUM, never the song.** The detector knows one
thing: the record we attribute the song to came out after the night. It does
not know the song was unwritten, unreleased, or unheard — Garbage's "No Horses"
was a standalone 2017 single that only reached an album in 2021, so the song
existed the night it was heard. Only the album was ahead.

**`road-tested` is retrospective, never foresight.** The sentence is written
from now, looking back. Nobody in that room knew what was coming.

```
✅ "I'd heard four of these a year before the record came out"
   (Tier 1 — grounded in songsHeardEarly and daysBeforeRelease)

✅ "Half that set was from an album that didn't exist yet"

❌ "They played songs that hadn't been written yet"
   (Unsupported — only the ALBUM was in the future)

❌ "Little did I know I was hearing the record a year early"
   (Foresight in the moment — nobody in the room knew)

❌ "Then they played something off Violator"
   (No attribution for that song — say nothing rather than guess)
```

**`most-witnessed-album` must not claim a fraction unless it is given one.**
`albumTrackCount` is `null` whenever the count cannot be trusted, and a null
means "seventeen songs", never "seventeen of twelve".

Enforced in `scripts/liner-notes/voice-check.ts` — rules `song-existence`,
`foresight`, and `album-without-attribution`, all errors. The checklist below is
executable; adding a rule here means adding it there.

### Examples### Examples

```
✅ "The album that 'Enjoy the Silence' came from was already a classic by then"
   (Tier 1 — Violator is in top tracks data)

✅ "They had just released what would become their biggest album"
   (Tier 2 — approximate, no specific claim)

✅ "That was around the time they broke up — I didn't know it would be
   one of the last shows"
   (Tier 2 — approximate, personal framing)

❌ "Their album debuted at #4 on the Billboard 200"
   (Tier 3 — specific chart position)

❌ "They had sold over 15 million copies worldwide"
   (Tier 3 — sales figures)

❌ "This was the same week that Kurt Cobain died"
   (Tier 3 — unrelated cultural event)
```

---

## Anti-Patterns

These phrases are banned. If you see them in generated prose, regenerate:

| Banned | Why |
|--------|-----|
| "journey" | Vague, overused |
| "tapestry" | Vague, overused |
| "legendary" (without evidence) | Empty superlative |
| "it goes without saying" | Filler |
| "a diverse range of" | Filler |
| "over the years" (as opener) | Weak opening |
| Any claim without a specific fact | Every sentence must earn its place |
| "they never made another record" | **Perishable** — see below |
| "their last album" | Perishable, unless pinned to a stated year |
| "the peak of their career" | Unfalsifiable, and unsupported by the data |

### Perishable claims ✨ v5.4

Posts are permalinked, RSS-syndicated, and never revisited. A sentence that is
true today and false next year does not age into being wrong — it *is* wrong,
permanently, under a first-person byline.

The line is about **which direction time runs**:

| | |
|---|---|
| ✅ Facts about the future *relative to the show* | *"Violator was 20 months away."* True about June 1988 forever. |
| ❌ Facts about the present | *"They never made another record."* True until the day it isn't. |

The Roots and Blondie are both active bands sitting in our data with no
album after their last show. Writing "nothing since" about either is a
liability, not an observation. If a claim of that shape is unavoidable, pin it:
*"the last album they'd released as of 2026."*

### Verbs must agree with their object ✨ v6.1

A song is **heard** or listened to. A performance, a set, or a show is
**watched** or **seen**. A band is **seen**.

"I watched the same song twice" mismatches the verb to its object. It
reads as slightly wrong without a reader being able to say why, which is the
worst kind of wrong in a first-person sentence.

```
✅ "I heard the same song twice, thirty-nine years apart"

✅ "I watched Rodgers claim it fully at the Pacific Amphitheatre"
   (the object is a performer, not the song)

✅ "watching Sting perform his polished pop-rock"

❌ "I watched the same song twice"
   (you do not watch a song)
```

The fix is usually just `heard`, which carries the passage of time more
quietly than `watched` anyway. Where the performance genuinely is the subject,
name the performer as the object and let them do something: *watched X play it*.

Enforced as rule `verb-object` in `voice-check.ts`. The check is deliberately
narrow — it fires only where a watch verb takes a song noun as its **direct**
object, so *"watched them play the song"* passes. Bare "music" is excluded:
*"watching music fill an outdoor amphitheatre"* is a scene, not a
mis-agreement, and it is already published.

---

## Social Copy ✨ v7.0

Every published note also carries an authored social payload — a `hook`, a
`caption` and an optional 3–5 `beats` carousel — written by
`scripts/liner-notes/social.ts` in a **separate API call** from the prose, and
checked by `checkSocial()` in `voice-check.ts`.

**Authored, never derived.** The social copy is written on purpose, in this
voice, by the run that writes the note. It is never chopped out of the first
paragraph. Every RSS-to-social bridge in existence fails there, and Phase 0
measured what it costs: 28 of the first 57 published headlines follow one of
five detector templates, and "Caught Once, Never Again" alone accounts for
nine. A nine-up profile grid of derived copy reads as robotic no matter how it
is art-directed — the cause is copy, not layout.

**The ratchet is tighter than for prose.** A note deleted from the site leaves
its social copies standing on servers we do not control. Every perishable-claim
rule above applies here at least as hard, which is why `checkSocial()` reuses
the same tables rather than restating them.

### The three surfaces

| Field | Budget | Rule |
|---|---|---|
| `hook` | ≤ 120 chars | The line that earns the click, set large on the card. |
| `caption` | ≤ 200 chars | The core sentence pair. Ships unchanged on every channel. |
| `beats[]` | 3–5, ≤ 120 each | One narrative unit per carousel pane. Phase 3 consumes them. |

Budgets are **graphemes**, not characters — a combining accent is one thing a
reader sees. They live in `scripts/syndication/budgets.ts`, where the caption
figure is derived from Bluesky's 300-grapheme limit rather than chosen.

### Rules specific to social copy

- **The hook must not repeat the credit stack.** Artist, song, venue, city and
  date are rendered as separate furniture on the same card. The hook is the one
  line that is not already on screen; spending it on a name wastes it.
- **The hook must not restate the headline.** If it is the headline with
  different punctuation, it inherits the detector template, and the template is
  what makes the grid look automated. `checkSocial()` fails this as an error.
- **Withhold the interpretation, never the identification.** Withholding artist
  names for an open loop was mocked and rejected: it makes posts unfindable by
  search, gives a scrolling fan no reason to stop, and on Instagram — where
  captions carry no clickable link — teases a reveal the reader cannot reach.
  At 124px, the true phone profile-grid scale, the artist name is the only
  legible text on a tile.
- **The caption stands alone.** It travels without the card, so it may name the
  artist and it carries the first person. The hook sits above a credit stack
  that supplies the subject, so forcing "I" into 120 characters of display type
  produces worse copy — first person is a warning there, not an error.
- **No furniture.** No hashtags, no URLs, no emoji, no "link in bio", no "read
  more". Tags are generated per channel from entities the record already knows,
  and the link is appended by the adapter. Authoring any of them is an error.
- **Detector tags never publish.** `#full-circle` and `#road-tested` are
  internal taxonomy: meaningless to a reader and an instant tell. The payload
  builder never reads `post.tags` at all.

A social failure costs a tweet, not a liner note: the post publishes either
way, and is simply not eligible to syndicate.

---

## Validation Checklist

> ✅ **Automated since v5.4.** `scripts/liner-notes/voice-check.ts` runs these
> as code after generation and before anything is written — a post that fails
> an `error` rule is dropped from the run rather than published. This list had
> been prose-only for four minor versions, and two defects reached generated
> output that a human had already read past.
>
> The checker is not a substitute for reading the prose; it catches the rules
> that are mechanically checkable, which is most of the ones below.

Before accepting generated prose, verify:

- [ ] Written in first person (contains "I" or "my")
- [ ] 2–5 sentences
- [ ] Names at least one specific artist, venue, or year
- [ ] Contains at least one number
- [ ] No Tier 3 cultural references
- [ ] No album named that is not in the finding's data points (v6.0)
- [ ] `road-tested` claims the album, never the song's existence (v6.0)
- [ ] `road-tested` reads as retrospective, not foresight in the moment (v6.0)
- [ ] No banned phrases
- [ ] **Verbs agree with their object — songs are heard, performers watched** ✨ v6.1
- [ ] Ends with a human moment (not a dry restatement of facts)
- [ ] 40–500 words total
- [ ] **No claim that could become false without the post changing** ✨ v5.4
- [ ] **Album facts cite the data, not a critical verdict** ✨ v5.4

And for the social payload (`checkSocial`) ✨ v7.0:

- [ ] Hook within 120 graphemes; caption within 200; beats 3–5 within 120 each
- [ ] Hook does not restate the headline
- [ ] Hook does not repeat the artist, venue, city or date
- [ ] No hashtags, URLs, emoji or feed-tool boilerplate in authored copy
- [ ] Caption reads in first person and stands alone without the card
- [ ] Every perishable-claim, verdict and Tier 3 rule above still holds

---

## Anthropic API Parameters

```typescript
model: "claude-sonnet-4-6"
max_tokens: 400
temperature: 0.7
```

Temperature 0.7 balances creativity with factual grounding. Do not lower below 0.5 (output becomes dry) or raise above 0.9 (hallucination risk increases).

---

## Spec Reference

Full voice and generation spec: `docs/specs/future/agentic-liner-notes-v3.md`
- System prompt design: "Story Generator — Agentic Prose Layer"
- Cultural context tiers: "Cultural Context Correlation (Era Flavor)"

**Last Updated:** 2026-08-07
