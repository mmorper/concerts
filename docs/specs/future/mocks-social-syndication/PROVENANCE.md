# Image Provenance — what ships, from where, to which channel

Issue [#327](https://github.com/mmorper/concerts/issues/327), epic
[#323](https://github.com/mmorper/concerts/issues/323).

> **Scope, per the owner's decision of 2026-08-21:** this is a **record, not a
> gate**. Good imagery comes first. Nothing here blocks a post. It exists for two
> reasons that are not legal arguments: one source is *operationally* broken, and
> writing down what shipped costs nothing now and cannot be reconstructed later.
>
> The residual risk, stated once: the realistic failure is not litigation but an
> automated content-ID or DMCA strike against a young account with no goodwill.
> The mitigation chosen is **not** avoiding sourced imagery — it is that the
> ledger records `tier` and `source` per post, so a strike's blast radius is
> greppable and a policy change is a filter rather than an archaeology project.

---

## Sources, measured against the 57 published notes

| Source | Used for | Actual share | Resolution | Verdict |
|---|---|---|---|---|
| **Personal photography** | anything | 0 today | 3000px+ | **Tier 1. Ships with a byline.** Owned outright; the only source with no third-party question at all. |
| **TheAudioDB** | artists | **46 / 57 (81%)** | 700×700 | **Tier 2, and the de-facto workhorse.** Fan-contributed press shots on one host. Highest-volume and highest-exposure source we have. |
| **Apple / mzstatic** | album art | 10 / 57 | varies | Tier 2. Reached via the `audio.albumArt` path. Prefer Cover Art Archive where both resolve. |
| **Cover Art Archive** | albums | **1 / 57** | `front-1200` available | **Tier 2, and the most defensible sourced imagery we have** — album art adjacent to commentary about that album. Badly under-used. |
| **Deezer CDN** | artists | 53 / 257 artists resolve | varies | Tier 2. Label-supplied via CDN. |
| **Google Places** | venues | **65 of 67 dead (403)** | — | **Do not design a tier-2 venue path around this until [#315](https://github.com/mmorper/concerts/issues/315) closes.** Broken in practice regardless of terms. |
| **Spotify** | artist top tracks | — | — | Guidelines prohibit modifying or overlaying, which the composite does. **Avoid for syndication.** Prefer Cover Art Archive. |
| **Wikimedia CC** | concert photography | unused | varies | Tier 2, available. Requires in-caption attribution wherever it ships. |
| **Generated / material** | anything | — | authored at frame | **Tier 3.** Owned outright, no ceiling, no question. |

**Two facts worth acting on:**

1. **Cover Art Archive is requested at `front-500` and serves `front-1200`.**
   A one-line change in `scripts/liner-notes/image-refs.ts` removes the upscale
   problem from the album path entirely. *Confirm against current CAA docs before
   relying on it.*
2. **Artist imagery is the only fallback with ~100% coverage**, which is exactly
   why it gets reached for constantly, and why `MediaAsset.source` distinguishes
   `artist-audiodb` from `artist-deezer` rather than lumping them.

---

## What appears on the card, per tier

| Tier | On-image credit | Rationale |
|---|---|---|
| **1 · personal** | `Mike Morper · 31 July 2026` | A byline. It is what makes personal imagery visibly outrank sourced imagery instead of being indistinguishable from it. |
| **1 · different night** | `Mike Morper · July 2026, not the 1987 night` | Non-negotiable. Implying a photo is *the* night when it is not is the fabricated-memory failure the voice rules exist to prevent. |
| **2 · sourced** | none | Deliberate. The absence is what gives the tier-1 byline meaning. |
| **2 · Wikimedia CC** | none on-image; **attribution in-caption** | CC terms require it. The only source that forces caption copy. |
| **3 · derived / material** | none | Owned outright. |

The byline rides **in the image**, bottom-left, not in the caption: a card gets
screenshotted and re-shared without its caption, and a claim about whose
photograph this is has to travel with the picture.

---

## Per-channel

| Channel | Attribution mechanism | Note |
|---|---|---|
| Bluesky | In-image byline; alt text required on every asset | Alt text is not attribution but is non-optional for accessibility. |
| Mastodon | In-image byline; alt text required | The instance's own media policy applies on top of this. |
| X | In-image byline | — |
| Instagram | In-image byline; **CC attribution in caption** where a Wikimedia asset ships | Captions carry no links, so a CC attribution URL is text only. |

---

## Recorded in code (Phase 1)

```ts
interface MediaAsset {
  tier: 1 | 2 | 3
  source: "personal" | "cover-art" | "venue-places" | "artist-audiodb"
        | "artist-deezer" | "wikimedia" | "generative" | "material"
  alt: string          // required, never optional
}
```

`tier` and `source` are not bookkeeping. They are how "never bare type" and
"personal beats sourced" become *testable*: an adapter asserts `media[0]` exists
before it posts, and the ledger records which tier actually shipped.

**Not enforced as a gate.** No post is blocked by this file.

---

## Photography and this repository

`.gitignore` in this directory excludes `*.jpg` / `*.png`. **This repo is public,
so committing an image here *is* the publishing act this policy governs.**
`nile-rodgers-2026.jpg` is referenced by filename by five artboards and rides in
the published canvas; a fresh clone shows a broken image until the file is dropped
back in. That is intentional and should stay until storage is decided.

**Storage** flips on the #338 count: commit the stills at N≈20; R2 at 100+.
See `global-social-syndication.md` § "Storage".

---

**Version:** 1.0.0 · **Date:** 2026-08-21 · **Status:** record, not a gate
