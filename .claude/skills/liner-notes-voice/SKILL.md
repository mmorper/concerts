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
- Specific dates not in the dataset ("released March 19, 1990")

### Examples

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

---

## Validation Checklist

Before accepting generated prose, verify:

- [ ] Written in first person (contains "I" or "my")
- [ ] 2–5 sentences
- [ ] Names at least one specific artist, venue, or year
- [ ] Contains at least one number
- [ ] No Tier 3 cultural references
- [ ] No banned phrases
- [ ] Ends with a human moment (not a dry restatement of facts)
- [ ] 40–500 words total

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

**Last Updated:** 2026-03-08
