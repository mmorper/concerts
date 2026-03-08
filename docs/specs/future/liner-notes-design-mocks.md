# Liner Notes — Design Mocks

**Status:** Design reference — approved before UI implementation begins
**Spec:** `docs/specs/future/agentic-liner-notes-v3.md`
**Implements:** Phase 4 issues #60 (this doc), #61, #62
**Last updated:** 2026-03-08

---

## Design Tokens (Quick Reference)

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#fafaf9` (bg-light-3, Warm Stone) | Both pages |
| Headline font | Playfair Display, 700 | Post headlines, page titles |
| Body font | Source Sans 3, 400 | Prose, labels, metadata |
| Card background | `#ffffff` | Post cards |
| Card border | `1px solid #e5e7eb` (gray-200) | Post cards |
| Card shadow | `0 1px 3px rgba(0,0,0,0.06)` | Post cards |
| Card radius | `12px` | Post cards |
| Cultural Context accent | `#1e3a8a` (New Wave blue) | Label, filter chip active, card border-left |
| Personal Connection accent | `#5b21b6` (Alternative violet) | Label, filter chip active, card border-left |
| Deep-Cut accent | `#06b6d4` (Electronic cyan) | Label, filter chip active, card border-left |
| Body text | `#374151` (gray-700) | Prose |
| Muted text | `#6b7280` (gray-500) | Dates, deep links |
| Very muted | `#9ca3af` (gray-400) | Tags, metadata |
| Tag bg | `#f3f4f6` (gray-100) | Tag pills |
| Page title | `#1f2937` (gray-800) | H1 |

---

## Page 1: `/liner-notes` — Blog Feed

### Desktop (1280px) — Full Feed View

```
┌────────────────────────────────────────────────────────────────────────┐
│  bg: #fafaf9 (full viewport)                                           │
│                                                                        │
│  ← Back to Archive                           [about] [what's playing]  │
│  ─────────────────────────────────────────────────────────────────────│
│                                                                        │
│                      ┌──────────────────────────────┐                 │
│                      │                              │                 │
│                      │  LINER NOTES                 │  ← Playfair    │
│                      │  36px / 700 / #1f2937        │     Display    │
│                      │                              │                 │
│                      │  Stories from 42 years of    │  ← Source      │
│                      │  live music                  │     Sans 3     │
│                      │  16px / 400 / #6b7280        │     16px       │
│                      │                              │                 │
│                      │  ┌──────────────────────────┐│                 │
│                      │  │ [All] [Cultural Context] ││  ← filter      │
│                      │  │ [Personal] [Deep-Cut]    ││     chips      │
│                      │  └──────────────────────────┘│                 │
│                      │                              │                 │
│                      │  ┌──────────────────────────┐│                 │
│                      │  │ #anniversary  #longevity ││  ← tag row     │
│                      │  │ #opener-arc  #comeback   ││     (scroll)   │
│                      │  └──────────────────────────┘│                 │
│                      │                              │                 │
│                      │  12 liner notes · Updated    │                 │
│                      │  weekly                      │                 │
│                      │  12px / #9ca3af              │                 │
│                      │                              │                 │
│                      │  ┌──────────────────────────┐│                 │
│                      │  │  POST CARD (newest)      ││                 │
│                      │  │  [see Card Anatomy below]││                 │
│                      │  └──────────────────────────┘│                 │
│                      │                              │                 │
│                      │  ┌──────────────────────────┐│                 │
│                      │  │  POST CARD               ││                 │
│                      │  └──────────────────────────┘│                 │
│                      │                              │                 │
│                      │  ┌──────────────────────────┐│                 │
│                      │  │  POST CARD               ││                 │
│                      │  └──────────────────────────┘│                 │
│                      │                              │                 │
│                      │       [ Show More ]          │                 │
│                      │  (loads 10 more, ghost btn)  │                 │
│                      │                              │                 │
│                      │  ────────────────────────── │                 │
│                      │                              │                 │
│                      │  🔈 Subscribe to new liner   │                 │
│                      │     notes via RSS            │                 │
│                      │                              │                 │
│                      └──────────────────────────────┘                 │
│                         max-width: 768px, centered                     │
│                         padding: 48px 24px                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Desktop — Filter Chips Detail

```
┌────────────────────────────────────────────────────────┐
│  Category filters (primary row):                        │
│                                                        │
│  ┌────────┐  ┌──────────────────┐  ┌───────────┐      │
│  │  All  ◉│  │ Cultural Context │  │  Personal │ ...  │
│  └────────┘  └──────────────────┘  └───────────┘      │
│  Active: violet-600 bg, white text, no border          │
│  Inactive: white bg, gray-300 border, gray-700 text    │
│  Height: 36px  Font: 14px / 500  Gap: 8px  Wrap: yes  │
│                                                        │
│  Tag filters (secondary row, below category row):      │
│                                                        │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  #anniversary  │  │  #longevity  │  │ #comeback│ …│
│  └────────────────┘  └──────────────┘  └──────────┘  │
│  12px / 500 / #9ca3af text on #f3f4f6 bg              │
│  Rounded-full, px-2 py-0.5                            │
│  Hover: category accent color text                     │
│  Horizontal scroll on mobile                           │
└────────────────────────────────────────────────────────┘
```

---

### Desktop — Post Card Anatomy

```
┌─────────────────────────────────────────────────────────┐
│ bg: #ffffff  border: 1px #e5e7eb  radius: 12px          │
│ shadow: 0 1px 3px rgba(0,0,0,0.06)  mb: 24px            │
│ left border: 4px solid [category accent color]          │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │           [IMAGE — full width top of card]          │ │
│ │    16:9 for venue/landscape · square for album art  │ │
│ │              object-cover · max-height 280px        │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│  padding: 24px                                          │
│                                                         │
│  PERSONAL CONNECTION         March 8, 2026             │
│  12px / 600 / uppercase /    13px / 400 / #9ca3af      │
│  tracking-wider / [accent]   right-aligned             │
│                                                         │
│  38 Years of Depeche Mode                              │
│  Playfair Display / 22px / 700 / #1f2937               │
│  → links to /liner-notes/38-years-of-depeche-mode      │
│                                                         │
│  I first saw Depeche Mode at Irvine Meadows in 1985,   │
│  the year they released Some Great Reward. 38 years    │
│  later, I watched them fill Dodger Stadium — same      │
│  band, same intensity, just 41,000 more people.        │
│  Source Sans 3 / 16px / 400 / #374151 / lh 1.65       │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ♫  Enjoy the Silence  ·  Depeche Mode   [▶] 0:30 │ │
│  │    bg: #f9fafb  radius: 8px  px-3 py-2            │ │
│  │    Play btn: [accent color]                        │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Depeche Mode  ·  Irvine Meadows  ·  Dodger Stadium   │
│  14px / 500 / #6b7280  ·  separator                   │
│  hover: [accent color] + underline                     │
│                                                         │
│  #artist-longevity   #multi-decade                     │
│  12px / 500 / #9ca3af on #f3f4f6 / rounded-full       │
│  px-2 py-0.5 / hover: [accent color] text             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Notes:**
- Cards animate in: `opacity 0→1, y 16→0`, 400ms easeOut, staggered 80ms
- `prefers-reduced-motion`: skip animation, render immediately
- Left border accent color matches category (Cultural=#1e3a8a, Personal=#5b21b6, Deep-Cut=#06b6d4)
- MiniPlayer: only rendered when `post.audio` is present
- Deep links: each artist/venue name is a separate link

---

### Mobile (375px) — Feed View

```
┌────────────────────────────────┐
│  bg: #fafaf9                   │
│  padding: 32px 16px            │
│                                │
│  ← Back                        │
│                                │
│  LINER NOTES                   │
│  28px / 700 / Playfair         │
│                                │
│  Stories from 42 years of      │
│  live music                    │
│  14px / #6b7280                │
│                                │
│  ┌────────────────────────────┐│
│  │ [All] [Cultural]          ││  ← wraps to next
│  │ [Personal] [Deep-Cut]     ││     line naturally
│  └────────────────────────────┘│
│                                │
│  ┌─────────── scroll ────────→│
│  │ #anniversary #longevity   ││  ← horizontal
│  │ #comeback #opener-arc ...  ││     scroll
│  └────────────────────────────┘│
│                                │
│  12 liner notes · Updated wkly │
│                                │
│  ┌────────────────────────────┐│
│  │                            ││
│  │      [IMAGE full-width]    ││  ← 16:9 aspect
│  │      max-height: 200px     ││
│  │                            ││
│  ├────────────────────────────┤│
│  │  pad: 16px                 ││
│  │                            ││
│  │  PERSONAL   Mar 8, 2026   ││
│  │  11px/accent  12px/#9ca3af││
│  │                            ││
│  │  38 Years of Depeche Mode  ││
│  │  20px / 700 / Playfair     ││
│  │                            ││
│  │  I first saw Depeche Mode  ││
│  │  at Irvine Meadows in      ││
│  │  1985...                   ││
│  │  15px / #374151            ││
│  │                            ││
│  │  ┌──────────────────────┐  ││
│  │  │♫ Enjoy the Silence [▶]│  ││  ← MiniPlayer
│  │  └──────────────────────┘  ││     compact
│  │                            ││
│  │  Depeche Mode · Irvine    ││  ← deep links
│  │  Meadows · Dodger Stadium ││     (wrap ok)
│  │                            ││
│  │  #artist-longevity         ││  ← tags
│  │  #multi-decade             ││
│  │                            ││
│  └────────────────────────────┘│
│                                │
│  ┌────────────────────────────┐│
│  │  [next post card...]       ││
│  └────────────────────────────┘│
│                                │
│  ┌────────────────────────────┐│
│  │      [ Show More ]         ││  ← 44px height
│  └────────────────────────────┘│
│                                │
│  🔈 Subscribe via RSS          │
│                                │
└────────────────────────────────┘
```

**Mobile notes:**
- Image max-height: 200px (reduced from 280px)
- Card padding: 16px (reduced from 24px)
- Headline: 20px (reduced from 22px)
- Page title: 28px (reduced from 36px)
- Filter chips wrap naturally — no horizontal scroll for categories
- Tag row: horizontal scroll (`overflow-x: auto`, `-webkit-overflow-scrolling: touch`)
- All tap targets minimum 44px height
- Deep link text wraps naturally (no truncation)

---

## Page 2: `/liner-notes/:slug` — Post Permalink

### Desktop (1280px) — Permalink View

```
┌────────────────────────────────────────────────────────────────────────┐
│  bg: #fafaf9 (full viewport)                                           │
│                                                                        │
│                      ┌──────────────────────────────┐                 │
│                      │  max-width: 800px, centered  │                 │
│                      │  padding: 48px 24px          │                 │
│                      │                              │                 │
│                      │  ← Back to Liner Notes       │  ← sticky/     │
│                      │    14px / #6b7280            │     top nav    │
│                      │                              │                 │
│                      │  ┌──────────────────────────┐│                 │
│                      │  │                          ││                 │
│                      │  │      [IMAGE full-width]  ││                 │
│                      │  │      max-height: 360px   ││                 │
│                      │  │      object-cover        ││                 │
│                      │  │                          ││                 │
│                      │  └──────────────────────────┘│                 │
│                      │                              │                 │
│                      │  PERSONAL CONNECTION         │                 │
│                      │  March 8, 2026              │                 │
│                      │  [accent] 12px / 600        │                 │
│                      │                              │                 │
│                      │  38 Years of Depeche Mode    │                 │
│                      │  Playfair / 28px / 700       │                 │
│                      │                              │                 │
│                      │  I first saw Depeche Mode    │                 │
│                      │  at Irvine Meadows in 1985,  │                 │
│                      │  the year they released Some │                 │
│                      │  Great Reward. 38 years      │                 │
│                      │  later, I watched them fill  │                 │
│                      │  Dodger Stadium — same band, │                 │
│                      │  same intensity, just 41,000 │                 │
│                      │  more people.                │                 │
│                      │  18px / 400 / #374151 /      │                 │
│                      │  line-height 1.7             │                 │
│                      │                              │                 │
│                      │  ┌──────────────────────────┐│                 │
│                      │  │ ♫ Enjoy the Silence   [▶]││                 │
│                      │  │   Depeche Mode · Violator││                 │
│                      │  └──────────────────────────┘│                 │
│                      │                              │                 │
│                      │  Depeche Mode · Irvine       │                 │
│                      │  Meadows · Dodger Stadium    │                 │
│                      │                              │                 │
│                      │  #artist-longevity           │                 │
│                      │  #multi-decade               │                 │
│                      │                              │                 │
│                      │  ─────────────────────────── │                 │
│                      │                              │                 │
│                      │  Related  [deferred — shown  │                 │
│                      │  when feed reaches 30+ posts]│                 │
│                      │                              │                 │
│                      └──────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Mobile (375px) — Permalink View

```
┌────────────────────────────────┐
│  bg: #fafaf9                   │
│  padding: 24px 16px            │
│                                │
│  ← Back to Liner Notes         │
│    14px / #6b7280              │
│                                │
│  ┌────────────────────────────┐│
│  │                            ││
│  │      [IMAGE full-width]    ││  ← max-height
│  │      max-height: 240px     ││     240px on
│  │                            ││     mobile
│  └────────────────────────────┘│
│                                │
│  PERSONAL    March 8, 2026    │
│                                │
│  38 Years of Depeche Mode      │
│  24px / 700 / Playfair         │
│                                │
│  I first saw Depeche Mode at   │
│  Irvine Meadows in 1985, the   │
│  year they released Some Great │
│  Reward. 38 years later, I     │
│  watched them fill Dodger      │
│  Stadium — same band, same     │
│  intensity, just 41,000 more   │
│  people.                       │
│  17px / lh 1.65                │
│                                │
│  ┌────────────────────────────┐│
│  │ ♫ Enjoy the Silence    [▶]││
│  └────────────────────────────┘│
│                                │
│  Depeche Mode                  │
│  Irvine Meadows                │
│  Dodger Stadium                │
│  (stacked, 44px each)          │
│                                │
│  #artist-longevity             │
│  #multi-decade                 │
│                                │
└────────────────────────────────┘
```

**Permalink notes:**
- "← Back to Liner Notes" returns to feed, preserving scroll position (browser history state)
- If slug not found: show graceful 404 state with link back to feed
- JSON-LD (BlogPosting) injected for every permalink
- RSS auto-discovery link in `<head>` (same as feed page)
- Related posts section: rendered only when `relatedSlugs.length > 0` AND feed has 30+ posts; placeholder shown in interim

---

## Page 3: `/whats-playing` — App Changelog

### Context: Minimal Changes from Existing ChangelogPage

The existing `src/components/changelog/ChangelogPage.tsx` already has the correct layout. The `/whats-playing` route reuses this component with three changes:

1. **Title:** "Liner Notes" → "What's Playing"
2. **Subtitle:** "What's new in the archives" → "App updates and new features"
3. **Remove:** "By the Numbers" fact cards section (the `FactCard` grid)
4. **Nav:** "← Back to Timeline" remains; internal links stay as-is
5. **RSS link:** Update `/liner-notes/rss` → `/liner-notes.xml` (the agentic feed)

The dark theme, amber accents, and ChangelogCard layout are **kept unchanged**.

### Desktop (1280px) — What's Playing

```
┌────────────────────────────────────────────────────────────────────────┐
│  bg: #000000 (dark — unchanged from existing ChangelogPage)            │
│                                                                        │
│  ← Back to Timeline   |   About                                        │
│                                                                        │
│  What's Playing                                                        │
│  60px / Playfair Display / amber-400                                   │
│                                                                        │
│  App updates and new features                                          │
│  slate-400                                                             │
│                                                                        │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐     │
│  │  v4.3.3                     │  │  v4.3.2                     │     │
│  │  LATEST badge (amber-600)   │  │                             │     │
│  │                             │  │                             │     │
│  │  Mobile Concert Badges       │  │  Artist Audio Previews      │     │
│  │  March 8, 2026              │  │  February 28, 2026          │     │
│  │                             │  │                             │     │
│  │  Description text...        │  │  Description text...        │     │
│  │                             │  │                             │     │
│  │  • Highlight 1              │  │  • Highlight 1              │     │
│  │  • Highlight 2              │  │  • Highlight 2              │     │
│  │                             │  │                             │     │
│  │  [  See it live →  ]        │  │  [  See it live →  ]        │     │
│  │  amber-600 / 44px height    │  │                             │     │
│  └─────────────────────────────┘  └─────────────────────────────┘     │
│                                                                        │
│  ... (more release cards in 2-col grid)                                │
│                                                                        │
│                                          🔈 RSS    v4.3.3             │
│                                          fixed bottom-right            │
└────────────────────────────────────────────────────────────────────────┘
```

### Mobile (375px) — What's Playing

```
┌────────────────────────────────┐
│  bg: #000000                   │
│                                │
│  ← Back to Timeline            │
│                                │
│  What's Playing                │
│  40px / Playfair / amber-400   │
│                                │
│  App updates and new features  │
│                                │
│  ┌────────────────────────────┐│
│  │  v4.3.3  [LATEST]         ││
│  │                            ││
│  │  Mobile Concert Badges     ││
│  │  March 8, 2026            ││
│  │                            ││
│  │  Description...            ││
│  │                            ││
│  │  • Highlight 1             ││
│  │  • Highlight 2             ││
│  │                            ││
│  │  [ See it live → ]         ││  ← 44px min
│  └────────────────────────────┘│
│                                │
│  ┌────────────────────────────┐│
│  │  v4.3.2                    ││
│  │  ...                       ││
│  └────────────────────────────┘│
│                                │
│  (single column on mobile)     │
└────────────────────────────────┘
```

**What's Playing notes:**
- **Theme:** Dark (unchanged from existing `ChangelogPage`). Does NOT get the #fafaf9 light theme.
- **No fact cards** — the "By the Numbers" section is removed entirely from this page
- **Existing ChangelogCard component:** reused unchanged
- **2-col grid on desktop, 1-col on mobile:** unchanged from existing layout
- **RSS link:** fixed bottom-right (desktop only), updated to `/liner-notes.xml`

---

## Implementation Notes for #61

### Component File Plan

```
src/components/
  changelog/
    ChangelogPage.tsx          ← ADD /whats-playing route here (rename title + remove facts)
    WhatsPlayingPage.tsx       ← OR extract as new component (implementer's call)
    ChangelogCard.tsx          ← unchanged
    FactCard.tsx               ← unchanged (still used in ChangelogPage if /liner-notes still loads it)
  liner-notes/
    LinerNotesPage.tsx         ← NEW — blog feed (replaces old ChangelogPage at /liner-notes)
    LinerNoteCard.tsx          ← NEW — post card component
    LinerNotePermalink.tsx     ← NEW — single post view (#62)
    MiniPlayer.tsx             ← REUSE existing MiniPlayer component from ArtistScene
    CategoryFilterChips.tsx    ← NEW — filter pill row
    TagFilterRow.tsx           ← NEW — secondary tag filter
```

### Reuse Decisions

| Component | Source | Action |
|-----------|--------|--------|
| MiniPlayer | `src/components/scenes/ArtistScene/AudioPreviewPlayer.tsx` or `AudioPreviewPanel.tsx` | Verify existing component API, reuse or wrap |
| Framer Motion animations | All existing scenes | Match existing patterns (opacity + y translate) |
| Back navigation | `ChangelogPage.tsx` (`useNavigate`) | Same pattern |
| Deep link navigation | `ChangelogCard.tsx` (`navigate(release.route)`) | Same pattern for artist/venue links |

### Routing (src/App.tsx)

New routes to add:
```
/liner-notes              → <LinerNotesPage />
/liner-notes/:slug        → <LinerNotePermalink />   (NEW — Phase 4 #62)
/whats-playing            → <WhatsPlayingPage />      (NEW — replaces /liner-notes changelog)
```

The existing `/liner-notes` route currently renders `<ChangelogPage />`. After Phase 4, it renders `<LinerNotesPage />`.

---

## Responsive Breakpoints Summary

| Viewport | /liner-notes | /liner-notes/:slug | /whats-playing |
|----------|-------------|-------------------|---------------|
| 375px (mobile) | 1-col, 16px pad, 28px title, chips wrap | 1-col, 24px title, 240px img | 1-col (existing behavior) |
| 768px (tablet) | 1-col, 24px pad, 32px title | 1-col, 26px title | 1-2 col transition |
| 1280px (desktop) | 1-col max-768px centered, 48px pad | 1-col max-800px centered | 2-col grid (existing) |

All interactive elements (filter chips, post card headlines, tag pills, deep links, MiniPlayer play button, Show More button) must have minimum `44px` touch target height on mobile.

---

## Open Questions (Resolve Before Implementation)

1. **MiniPlayer component:** Which existing component handles the audio preview in ArtistScene — `AudioPreviewPlayer.tsx` or `AudioPreviewPanel.tsx`? Implementer should read both and choose the right one to reuse/wrap. Verify that playing a liner notes MiniPlayer pauses any active ArtistScene audio (one stream at a time).

2. **Back navigation scroll restoration:** Browser's native scroll restoration may handle this. If not, use `sessionStorage` to save scroll position before navigating to permalink, restore on back. Implementer should test native behavior first.

3. **Empty state for /liner-notes:** When `liner-notes.json` is empty or missing (e.g., before first pipeline run), show: "Liner notes coming soon — the first stories from 42 years of live music are on their way." Do not show an error state.
