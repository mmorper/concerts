# Ask the Archive: Shareable Answers

**Status:** Planned
**Target Version:** next
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** The Ask redesign, Phase 6 of `global-ask-media.md` (shipped). The meta-injector
Worker.

---

## Executive Summary

Ask produces the best-looking things on the site: an act across every night, a night beside its
setlist, a clip poster, a song card. None of them can leave the site. Ask has no share button,
and no URL reopens an answer. A visitor who finds something worth sending has nothing to send.

This spec adds a link that reopens an answer exactly as it was given, and a preview for it on
social and in messages. Opening a shared answer costs no model call, so it never touches the $25
cap.

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```
I need to implement Ask the Archive: Shareable Answers for Morperhaus Concerts.

- Spec: docs/specs/future/global-ask-shareable-answers.md. It is the source of truth.
- Read first: .claude/skills/design-system/SKILL.md, .claude/skills/analytics/SKILL.md,
  docs/DEEP_LINKING.md, test/README.md (each Worker has its own test config and CI),
  docs/SECRETS.md (before touching any key).
- Build the phases in order. Each one ships on its own.

Start with Phase 1, signing answers in the ask-chat Worker.
```

---

## Design Philosophy

**A shared answer is a snapshot.** It reopens with the words it was given, not a fresh answer.
Re-asking would cost a model call per visitor, could hit the cap, and could say something
different from what was shared.

**Only the Worker's own words get stored.** The browser holds the conversation, so it could send
any text. Every answer is signed by the Worker when it is given, and `/share` stores only an
answer whose signature checks. Nobody can publish their own prose under the site's name.

**Store on share, not on answer.** Signing costs nothing. Only an answer someone shares is
written to storage.

**A visitor's question never becomes the site's headline.** A preview's title comes from the
answer's subject, such as the act, the night or the song. The question as typed appears only on
the page, in the search box, where it reads as something asked.

**An answer built without a model needs no storage.** The song card is built on the site from
`song-index.json`. A plain deep link rebuilds it.

---

## What can be shared

| Answer | Link | Storage |
|---|---|---|
| A model answer with a card | `/?scene=ask&answer=<id>` | One KV record |
| A song card, from type-ahead | `/?scene=ask&artist=<slug>&song=<song-slug>` | None |
| A band, venue or year match | Already has its own deep link | None |

**Never shareable:**
- Refusals, errors, the cap message and quiet-mode replies.
- A `plain` exhibit, since an answer with no card has nothing to show.
- A `disambiguation` exhibit, since it is a question back to the visitor.
- An answer still streaming. The button appears with the `done` event.

---

## Technical Implementation

### The snapshot

```ts
interface SharedAnswer {
  v: 1
  question: string     // as typed, at most 200 characters
  prose: string        // the Worker's text for that turn
  exhibit: Exhibit     // the thin envelope from exhibits.ts: ids and slugs, not pixels
  answeredOn: string   // YYYY-MM-DD
  followUp: boolean    // true when the turn was not the first in its conversation
}
```

The record is at most 16 KB. The exhibit stays thin, as it is today, so the site hydrates it from
the current data. Counts on the card can grow after the answer was given, while the prose keeps
its original numbers. The "Answered on" line covers the gap.

### Phase 1: signing, and the share endpoints

In `workers/ask-chat/src/index.ts`:

- When a turn ends with a shareable exhibit, the `done` event carries `share: { snapshot, sig }`.
  The signature is an HMAC over the canonical JSON of the snapshot (keys sorted at every depth).
  The site posts both back unchanged, so it never has to rebuild the snapshot to match.
- The key is derived from `SESSION_HMAC_KEY` as `HMAC(SESSION_HMAC_KEY, "ask-share-v1")`, so no new
  secret has to be set in every place keys live. Rotating the session key voids signatures not yet
  shared. Stored answers are unaffected, since they are already verified.
- `POST /api/ask/share` takes the snapshot and `sig`.
  - It checks the signature, the size, and that the kind is shareable.
  - It writes `share:<id>` to a new KV namespace, `ASK_SHARES`, with no expiry.
  - The id is the first 12 base62 characters of the SHA-256 of the snapshot. Sharing the same
    answer twice gives the same link, and a retry writes nothing new.
  - It uses the existing per-IP rate-limit binding, keyed `share:<ip>`. That binding has one fixed
    limit and period, so the "20 shares a day" first written here is that binding's limit instead.
    A signature already means only real answers get in.
- `GET /api/ask/share/<id>` returns the snapshot as JSON with `Cache-Control: public,
  max-age=86400`. An unknown or removed id is a 404.

New file: `workers/ask-chat/src/share.ts` for signing, verifying, ids and the store/read logic.

**Done** (Phase 1). The `ASK_SHARES` namespace was created 2026-11-02 and is bound in
`wrangler.toml`. Unbound, no answer is offered for sharing and `/share` answers 503.

### Phase 2: the button, and opening a link

**The button.** A "Share" text button with an icon, at the end of the line under the exhibit.
When the Phase 5 chips are built, it sits on the same line. It uses `useShareLink`, the one share
behaviour on the site (#204):

- On a phone, the OS share sheet.
- On a desktop, it copies the link and shows "Link copied" inline.

A model answer posts to `/share` on the first click, then shares the returned link. The song card
builds its link directly.

**Opening a link.** `?scene=ask&answer=<id>` opens the Spotlight over the Ask scene. It shows:

- the question in the box
- the prose, then the exhibit, laid out as on the night it was given
- one line under it: "Answered on November 2, 2026 · Ask your own"

The box is ready for a follow-up. A follow-up sends the shared turn as history, the same way any
second turn does.

`?scene=ask&artist=<slug>&song=<song-slug>` finds the row in `song-index.json` and renders
`songAnswer`, with no network call.

**When a link fails.** A 404 shows "That answer isn't here any more", then the empty Ask view.
A network failure shows a retry. Neither shows a blank card.

**Deep links.** Add `askAnswerDeepLink(id)` and `askSongDeepLink(artistSlug, songSlug)` to
`src/utils/deepLinks.ts`. Add both shapes to `test/fixtures/deep-link-urls.json` and to
`docs/DEEP_LINKING.md`, with Ask as an emitter. The song slug uses the same normalization as artist
slugs.

**Done** (Phase 2), in `src/components/ask/AskShare.tsx`. How it came out:
- Share sits at the end of the line under an answer, after any follow-up chips. A song card, an
  answer reopened from a shared link (which shares on with the same link), and an answer the Worker
  signed all get it.
- `useShareLink`'s `share()` takes the link at click time, since a model answer's id comes back
  from `/share`. On a phone the share sheet opens after that round trip; a browser that no longer
  counts it as the click falls back to copying the link.
- The date reads "Answered on November 2, 2026", the order the site's bylines use. "Ask your own"
  is a button that puts the cursor in the box, wherever the box is.
- A link opened in the overlay is read by `useOpenSharedLink`, which the Ask scene mounts.

### Phase 3: previews

`workers/meta-injector/worker.js` gains a branch for `scene === 'ask' && answer`. It fetches
`/api/ask/share/<id>` through `cachedJsonFetch`.

| Tag | Value |
|---|---|
| `og:title` | The subject, from the exhibit. "Depeche Mode, seven nights" or "The Cure at the Hollywood Bowl, 1986" |
| `og:description` | The first sentence of the prose, cut at 200 characters on a word |
| `og:image` | The imagery ladder, below |
| `robots` | `noindex` |
| `canonical` | The subject's own deep link, so search credit goes to the indexed page. With no single subject, `/?scene=ask` |

**The image** takes the first that exists:

1. The share image of the owner's frame for that night, from `public/og/shows/<date>-<photo>.jpg`,
   found the way `photoShareImage` already finds it.
2. The image `injectArtistMeta` uses for that act.
3. The Ask scene's default image.

No image is rendered on demand in this phase.

The song link gets the same branch with no fetch. Its title is "Song, by Act" and its image is
rung 2 of the ladder.

### Phase 4: owner controls

- `ask:share` in `ASK_CONTROL`, `on` by default. When `off`, the button is hidden and `POST /share`
  refuses. Links already shared keep working.
- `DELETE /api/ask/admin/share/<id>` removes one shared answer, behind the existing admin gate
  in `admin.ts`. The link then shows the 404 state.
- `docs/DASHBOARD_OPERATIONS.md` gets both commands.

### Analytics

| Event | Params |
|---|---|
| `ask_answer_shared` | `exhibit_kind`, `link_kind` (`answer`, `song`), `method` (`share_sheet`, `clipboard`, or `none` when the Worker refused), `succeeded` |
| `ask_shared_answer_opened` | `exhibit_kind`, `link_kind` |
| `ask_shared_answer_missing` | `link_kind` |

A follow-up asked from a shared answer logs as an `ask_turns` row, like any turn. The row gains a
`source` field, set to `shared`, so the dashboard can count conversations that a share started.

---

## Files

| Create | Purpose |
|---|---|
| `workers/ask-chat/src/share.ts`, `share.test.ts` | Sign, verify, store, read |

| Modify | Change |
|---|---|
| `workers/ask-chat/src/index.ts`, `wrangler.toml` | `share` on `done`, the routes, the `ASK_SHARES` binding |
| `workers/ask-chat/src/admin.ts` | Remove one share |
| `src/components/ask/AskConversation.tsx` | The button, and opening a link |
| `src/components/ask/AskProvider.tsx` | Read `answer` and `song` from the URL |
| `src/utils/deepLinks.ts`, `test/fixtures/deep-link-urls.json` | The two link shapes |
| `workers/meta-injector/worker.js`, `worker.test.js` | Previews |
| `docs/DEEP_LINKING.md`, `docs/DASHBOARD_OPERATIONS.md`, `.claude/skills/analytics/SKILL.md` | Docs |

---

## Testing Strategy

**Worker tests (`share.test.ts`):**
- A signed answer stores, and reading it back returns the same snapshot.
- A changed character in the prose, question or exhibit fails the signature.
- Refusal, `plain` and `disambiguation` answers carry no `share` and are refused if posted.
- The same answer twice gives the same id and one write.
- An oversized snapshot is refused.
- With `ask:share` off, `POST` refuses and `GET` still works.

**Meta-injector tests:**
- An answer link gets the subject title, `noindex`, and the canonical of the subject.
- The question text appears in no tag.
- A night with an owner frame uses its share image.
- A missing id falls back to the Ask scene's meta.

**Site tests:**
- Both link shapes round-trip through the fixture.
- A song link renders `songAnswer` with no fetch.

**Manual:**
- [ ] Share from a phone opens the share sheet. On a desktop, the link is copied.
- [ ] A shared link opens in a private window with the same prose and card.
- [ ] The preview looks right in Bluesky, iMessage and Slack.
- [ ] A removed answer shows the 404 state.
- [ ] Keyboard: the button is reachable after the exhibit, and its state is announced.

---

## Future Enhancements

- **A rendered answer card** for the preview: the subject, the prose and the owner's frame, drawn
  at 1.91:1 and 4:5 at the edge. It waits on whether Phase 3's reused images get clicks.
- **"Post to Bluesky" and "Post to Mastodon"** buttons that prefill a post with the link.
- **Answers worth syndicating.** A shared answer that gets opened often is a candidate for the
  archive's own accounts, reviewed by the owner first, never automatic.

---

## Questions for Review

- Is `noindex` right for shared answers? It keeps visitors' questions out of search, and the
  canonical sends the credit to the subject's page. The cost is that an answer can't rank on its own.
- Should the "Answered on" line show for an answer shared today? The spec shows it always.

---

## Revision History

- **2026-11-02:** Phase 1 built: signing on `done`, `POST /share` and `GET /share/<id>`
- **2026-11-02:** Initial specification created
- **Version:** 1.0.0
- **Status:** Planned
