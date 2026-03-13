# Spec: Unified Toast Notification System

## Overview
Repurpose the existing changelog toast into a generic notification slot that can surface two types of content: new app features (current behavior) and new liner note posts.

## Toast Types
- `'changelog'` — existing behavior: new app releases since last visit
- `'liner-notes'` — new: new liner note posts since last visit

## Priority
When both types have new content, show **changelog** first. After it's dismissed (or on next visit if it was session-dismissed), the liner-notes toast becomes eligible.

In practice: use the same session-dismissal pattern per type. Each has its own localStorage + sessionStorage key.

## Liner Notes Detection
- Source: `public/data/liner-notes.json`, field `posts[].publishedAt` (ISO datetime, already exists)
- "New" = posts with `publishedAt` > `lastSeen` timestamp for liner notes (separate from changelog lastSeen)
- localStorage key: `morperhaus_linernotes_lastSeen`
- sessionStorage key: `morperhaus_linernotes_dismissedSession`

## Toast Content by Type

### `changelog` (unchanged)
- Title: feature title or "N new features"
- Body: feature description or bullet list
- CTA: "See What's Playing →" → `/whats-playing`
- Accent color: amber (#d97706)

### `liner-notes`
- Title (1 post): the post's `headline`
- Title (2–3 posts): "N new liner notes"
- Title (4+ posts): "N new liner notes"
- Body (1 post): short teaser — first ~100 chars of `prose`, truncated with ellipsis
- Body (2–3 posts): bullet list of headlines
- Body (4+ posts): "New stories from your concert history"
- CTA: "Read the Liner Notes →" → `/liner-notes`
- Accent color: sky/cyan (#0ea5e9 / sky-500) to visually distinguish from changelog amber

## Component Changes

### `ChangelogToast.tsx` → rename content, add `type` prop
Add prop: `type: 'changelog' | 'liner-notes'`
Make border color, button color, and CTA text conditional on type.

### `types.ts`
Add `ToastType = 'changelog' | 'liner-notes'`
Add `LinerNotesPost` interface: `{ id, slug, headline, prose, publishedAt }`
Add `LinerNotesToastProps` extending the base toast props pattern

### `constants.ts`
Add liner-notes accent: `LINER_NOTES_ACCENT: '#0ea5e9'`
Add new storage keys: `LINER_NOTES_LAST_SEEN`, `LINER_NOTES_DISMISSED_SESSION`

### New hook: `useLinerNotesCheck.ts`
Same shape as `useChangelogCheck` but reads from `public/data/liner-notes.json`, compares `publishedAt` timestamps.

### `App.tsx`
Run both hooks. Determine which toast to show via priority logic. Show one at a time.

## Out of Scope
- Queueing/showing both toasts sequentially in the same session (keep it simple — highest priority wins per visit)
- Toast stacking

## Open Questions
- Should liner-notes toast navigate to `/liner-notes` (index) or the specific post permalink (only valid for single-post case)?
  - Recommendation: always go to `/liner-notes` for simplicity; the specific post is visible at the top
