# Timeline Hover Preview

**Status:** Proposed (v1.2+)  
**Scene:** Scene1Hero (Timeline)  
**Priority:** High  
**Complexity:** Medium  

---

## Overview

Add hover-triggered preview popups to timeline year dots, revealing artist imagery and concert details before the user commits to a click. This feature transforms passive timeline viewing into an explorative "scrubbing through time" experience.

### Design Philosophy

The popup serves as a **memory trigger** — a glimpse into a year's musical moments. Large album art creates immediate recognition ("Oh, that was the year I saw Radiohead!"), while the venue anchors the memory in place. The interaction should feel like flipping through a photo album, not reading a database.

### Key Experience Goals

1. **Delight on discovery** — Random artist selection creates variety across visits
2. **Invite the click** — "+ X more" text sparks curiosity about what else happened that year
3. **Zero friction** — Hover reveals; no commitment required
4. **Fluid exploration** — Moving across dots feels like scrubbing a timeline, not opening/closing boxes

---

## Visual Design

### Popup Dimensions & Shape

| Property | Value | Rationale |
|----------|-------|-----------|
| Width | 220px | Large enough for impactful imagery, small enough to not overwhelm |
| Min Height | ~200px | Accommodates image + text content |
| Border Radius | 12px | Matches existing card patterns in app |
| Shadow | `0 10px 40px rgba(0, 0, 0, 0.4)` | Elevated, floating feel over timeline |

### Popup Structure

```
┌─────────────────────────────────────┐
│                                     │
│   ┌─────────────────────────────┐   │
│   │                             │   │
│   │                             │   │
│   │      ARTIST IMAGE           │   │  ← 188px × 140px
│   │      (Album Cover)          │   │     with parallax effect
│   │                             │   │
│   │                             │   │
│   └─────────────────────────────┘   │
│                                     │
│   Radiohead at The Greek Theatre    │  ← Artist + Venue (single line)
│                                     │
│   + 7 more                          │  ← Additional concerts (if any)
│                                     │
│   ─────────────────────────────     │  ← Subtle divider
│                                     │
│   1997 · 8 shows                    │  ← Year + total count
│                                     │
└─────────────────────────────────────┘
         ▼
    [Arrow pointer to dot]
```

### Image Container

| Property | Value |
|----------|-------|
| Width | 188px (220px - 32px padding) |
| Height | 140px |
| Border Radius | 8px |
| Overflow | Hidden (for parallax) |
| Object Fit | `cover` (image fills container) |

The image should be slightly larger than its container (scaled ~1.1x) to allow for parallax movement without exposing edges.

### Arrow Pointer

The popup includes a triangular pointer connecting it to the year dot:

| Property | Above Dot | Below Dot |
|----------|-----------|-----------|
| Position | Bottom center | Top center |
| Size | 16px base × 8px height | 16px base × 8px height |
| Color | Matches popup background | Matches popup background |
| Border | 1px matches popup border | 1px matches popup border |

---

## Typography

All text uses the existing app type system.

### Artist + Venue Line

```css
font-family: 'Source Sans 3', system-ui, sans-serif;
font-size: 15px;
font-weight: 600;
color: #ffffff;
line-height: 1.3;
```

Format: `{Artist Name} at {Venue Name}`

**Truncation:** If combined length exceeds container width, truncate venue name with ellipsis. Artist name should never truncate.

Example truncation:
- Full: "Radiohead at The Greek Theatre"
- Truncated: "Radiohead at The Greek Thea…"

### "+ X more" Line

```css
font-family: 'Source Sans 3', system-ui, sans-serif;
font-size: 13px;
font-weight: 400;
color: #94a3b8;  /* Muted gray */
line-height: 1.4;
margin-top: 4px;
```

**Copy variations:**
- 2+ additional concerts: "+ 7 more"
- 1 additional concert: "+ 1 more"
- No additional concerts: *Line omitted entirely*

### Year + Count Line

```css
font-family: 'Source Sans 3', system-ui, sans-serif;
font-size: 12px;
font-weight: 500;
color: #6366f1;  /* Indigo accent */
line-height: 1.4;
margin-top: 12px;
padding-top: 12px;
border-top: 1px solid rgba(99, 102, 241, 0.2);
```

Format: `{Year} · {N} show{s}`

Examples:
- "1997 · 8 shows"
- "2003 · 1 show"

---

## Color Specification

### Popup Container

| Element | Value | Notes |
|---------|-------|-------|
| Background | `#1e1e3f` | Deep indigo-purple, matches app dark theme |
| Border | `1px solid #3730a3` | Indigo-700, subtle definition |
| Shadow | `0 10px 40px rgba(0, 0, 0, 0.4)` | Depth and elevation |

### Text Colors

| Element | Color | Tailwind Equivalent |
|---------|-------|---------------------|
| Artist + Venue | `#ffffff` | `text-white` |
| "+ X more" | `#94a3b8` | `text-slate-400` |
| Year + Count | `#6366f1` | `text-indigo-500` |
| Divider | `rgba(99, 102, 241, 0.2)` | `border-indigo-500/20` |

### CSS Variables (for consistency)

```css
:root {
  --popup-bg: #1e1e3f;
  --popup-border: #3730a3;
  --popup-text-primary: #ffffff;
  --popup-text-secondary: #94a3b8;
  --popup-text-accent: #6366f1;
  --popup-divider: rgba(99, 102, 241, 0.2);
}
```

---

## Content Logic

### Image Sources

Two potential sources for artist imagery, checked in priority order:

| Priority | Source | Field | Status |
|----------|--------|-------|--------|
| 1 | Spotify | `mostPopularAlbum.coverArt.medium` | Future (not yet enabled) |
| 2 | TheAudioDB | `image` | ✅ Available (~87 artists enriched) |

**Current state:** Spotify integration is not yet enabled, so all images will come from TheAudioDB artist photos. When Spotify is enabled, album art will take priority.

### Artist Selection Algorithm

When a year has multiple concerts, select ONE artist to feature — but **only from artists that have images**:

```typescript
function selectFeaturedArtist(
  concerts: Concert[], 
  metadata: Record<string, ArtistMetadata>
): Concert | null {
  // Filter to concerts where headliner has an image
  const withImages = concerts.filter(c => {
    const artistKey = normalizeArtistName(c.headliner);
    const meta = metadata[artistKey];
    
    // Check Spotify first (future), then TheAudioDB
    const hasSpotifyImage = meta?.mostPopularAlbum?.coverArt?.medium;
    const hasAudioDBImage = meta?.image;
    
    return hasSpotifyImage || hasAudioDBImage;
  });
  
  // If NO artists have images, return null (no popup for this year)
  if (withImages.length === 0) {
    return null;
  }
  
  // Random selection from artists WITH images only
  const randomIndex = Math.floor(Math.random() * withImages.length);
  return withImages[randomIndex];
}
```

**Key behaviors:**
- Only artists with images are considered — no fallback to text-only
- Random selection happens once per hover session
- Moving away and returning to the same dot MAY show a different artist (adds discovery/delight)

### Image URL Resolution

```typescript
function getArtistImageUrl(
  headliner: string, 
  metadata: Record<string, ArtistMetadata>
): string | null {
  const artistKey = normalizeArtistName(headliner);
  const meta = metadata[artistKey];
  
  if (!meta) return null;
  
  // Priority 1: Spotify album art (future)
  if (meta.mostPopularAlbum?.coverArt?.medium) {
    return meta.mostPopularAlbum.coverArt.medium;
  }
  
  // Priority 2: TheAudioDB artist photo (current)
  if (meta.image) {
    return meta.image;
  }
  
  return null;
}
```

### No Popup Case

If a year has **zero** artists with images → **no popup appears for that dot**.

The dot retains its existing hover behavior (scale up + glow), but the preview popup simply doesn't render. This is expected to be rare given ~87% image coverage from TheAudioDB enrichment.

### Concert Count Calculation

```typescript
const totalShows = concerts.filter(c => c.year === hoveredYear).length;
const additionalShows = totalShows - 1;  // Subtract the featured one
```

### Venue Name Handling

Use the venue from the **featured concert** (the one whose artist image is shown).

```typescript
const venueName = featuredConcert.venue;
// Results in: "Radiohead at The Greek Theatre"
```

---

## Responsive Considerations

### Desktop (1200px+)

Full popup experience as described above.

### Tablet / iPad (768px - 1199px)

Same popup experience. Touch behavior handled in Part 2 (Interaction spec).

### Mobile (<768px)

**Popup disabled.** Mobile will require a different interaction pattern for the entire Timeline scene (out of scope for this spec, see `mobile-optimization.md`).

Detection:

```typescript
const isMobile = window.matchMedia('(max-width: 767px)').matches;
// or use existing responsive hook if available
```

---

## Accessibility

### Focus Management

- Popups are **not focusable** (they're hover-only previews)
- Dots remain keyboard-accessible via existing tab order
- Screen readers announce dot content via existing `<title>` elements

### Reduced Motion

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

If `true`:
- Parallax effect disabled (image static)
- Entry animation simplified (opacity only, no scale/translate)
- Crossfade replaced with instant swap

### Color Contrast

| Text | Background | Ratio | WCAG |
|------|------------|-------|------|
| White on `#1e1e3f` | Primary text | 12.5:1 | AAA ✓ |
| `#94a3b8` on `#1e1e3f` | Secondary text | 5.8:1 | AA ✓ |
| `#6366f1` on `#1e1e3f` | Accent text | 4.6:1 | AA ✓ |

---

## File Placement

```
src/components/scenes/Scene1Hero/
├── Scene1Hero.tsx              # Existing (will be modified)
├── TimelinePopup.tsx           # NEW: Popup component
├── TimelinePopup.css           # NEW: Popup styles (or use Tailwind)
├── useTimelineHover.ts         # NEW: Hover state management hook
└── types.ts                    # NEW: TypeScript interfaces
```

---

## Summary: Part 1 Decisions

| Decision | Resolution |
|----------|------------|
| Popup width | 220px |
| Image size | 188px × 140px |
| Content | Artist at Venue, + X more, Year · N shows |
| Image priority | Spotify album art (future) → TheAudioDB artist photo (current) |
| Artist selection | Random, **only from artists with images** |
| No-image years | No popup appears (dot retains normal hover state) |
| Mobile | Disabled (separate mobile strategy needed) |
| Accessibility | Reduced motion support, WCAG AA contrast |

---

## Next: Part 2 — Interaction & Animation

Part 2 will cover:
- Hover timing (delay, linger, exit)
- Popup positioning (above/below dot, session persistence)
- Entry/exit animations (fade, scale, translate)
- Crossfade behavior between dots
- Parallax effect implementation
- Click behavior (removal of existing modal)

---

*Spec Version: 1.0*  
*Author: Claude (Lead Designer)*  
*Date: January 2026*
