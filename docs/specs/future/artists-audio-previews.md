# Artist Audio Previews - Top Tracks Integration

> **Status:** Planned
> **Priority:** High
> **Version:** TBD
> **Related:** [artists-spotify-integration.md](artists-spotify-integration.md), [global-image-sourcing-strategy.md](global-image-sourcing-strategy.md)

---

## Executive Summary

Implement a 30-second audio preview mini-player in the Artist Gatefold using **Deezer** as the primary source and **iTunes Search API** as the fallback. Both APIs are free, require no authentication, and provide consistent "Top 5 Tracks" experiences. This delivers the same functionality as Spotify integration without dependency on Spotify API access.

**What this delivers:**
- Top 5 tracks by popularity with 30-second audio previews
- Play/pause controls with auto-advance
- Album artwork thumbnails for each track
- "Listen on Deezer/Apple Music" deep links
- Graceful fallback for tracks without previews

**What this does NOT include:**
- OAuth user authentication
- Full track playback (30-90 second clips only)
- Playlist creation or saving
- Runtime API calls (all data fetched at build time)

---

## Success Criteria

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Artist Coverage** | 90-95% | At least 230 of 254 artists have Top 5 tracks |
| **Preview Coverage** | 40%+ per artist | At least 2 of 5 tracks must have preview URLs |
| **User Experience** | 100% consistent | Always show 5 tracks or empty state, never 1-3 tracks |
| **Audio Quality** | 256kbps+ (Deezer) or 128kbps (iTunes) | Acceptable streaming quality |
| **Load Time** | <100ms | Pre-fetched data, instant playback start |

---

## Design Specifications

### Visual Overview

The audio preview player follows industry-standard music player patterns (Spotify, Apple Music) with a dark aesthetic that matches the gatefold's concert history panel.

**Panel Dimensions:**
- Desktop: 400×400px
- Mobile: Full-width panel, height determined by device

**Layout Structure:**
```
┌─────────────────────────────────────┐
│  🎵 TOP TRACKS                      │
│                                     │
│  ▶ Play All                         │
│                                     │
│  [Track List - 5 rows]              │
│                                     │
│  🔗 Listen on Deezer/Apple Music    │
└─────────────────────────────────────┘
```

---

### Section Header

**Layout:**
```tsx
<div className="flex items-center gap-2 mb-4">
  <MusicalNoteIcon className="w-[18px] h-[18px] text-gray-400" />
  <span className="font-sans text-xs font-semibold text-gray-400
    uppercase tracking-wider">
    Top Tracks
  </span>
</div>
```

**Specifications:**
- Icon: Heroicons `MusicalNoteIcon` (outline variant)
- Size: 18×18px
- Color: `text-gray-400` (#9ca3af)
- Label: "TOP TRACKS" (all caps, 12px, 600 weight, 0.05em letter-spacing)
- No source branding (Spotify logo removed)
- Generic music icon indicates music content

---

### Play All Button

**Placement:** Below section header, above track list

**Specifications:**
```tsx
<button className="
  w-10 h-10 rounded-full
  bg-white hover:bg-gray-100
  shadow-md hover:shadow-lg hover:scale-105
  transition-all duration-200
  flex items-center justify-center
  mb-4
">
  <PlayIcon className="w-5 h-5 fill-black ml-0.5" />
</button>
```

**States:**
- Default: White background, black play icon
- Hover: Slight scale (1.05), increased shadow
- Playing: Replace play icon with pause icon
- Disabled: `opacity-50 cursor-not-allowed` (no tracks available)

**Behavior:**
- Starts playback from first available preview
- If clicked while playing, pauses current track
- Auto-advances through all tracks with previews

---

### Track Row Layout

**Structure (5 rows, ~52px height each):**

```
[#] [Album Art] [Track Name     ] [Duration/Icon]
                [Album Name     ]
```

**Column Breakdown:**
| Column | Width | Content |
|--------|-------|---------|
| Track # | 20px | Number / Play Icon / Equalizer |
| Spacing | 12px | Gap |
| Album Art | 40px | 40×40px rounded image |
| Spacing | 12px | Gap |
| Track Info | flex-1 | Name (14px) + Album (12px) |
| Spacing | 8px | Gap |
| Duration | 40px | Time (mm:ss) or Pause icon |

**Total Row Height:** 52px (44px min + 8px padding)

---

### Track Row States

#### 1. Default State (Has Preview, Not Playing)

```tsx
<div className="
  flex items-center gap-3 p-3 rounded-lg
  cursor-pointer transition-all duration-200
  hover:bg-white/5
">
  {/* Track Number */}
  <span className="w-5 text-center text-sm text-gray-400">
    {number}
  </span>

  {/* Album Art */}
  <img
    src={albumArt}
    alt={albumName}
    className="w-10 h-10 rounded flex-shrink-0"
  />

  {/* Track Info */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-gray-300 truncate">
      {trackName}
    </p>
    <p className="text-xs text-gray-400 truncate">
      {albumName}
    </p>
  </div>

  {/* Duration */}
  <span className="w-10 text-center text-xs text-gray-400">
    {duration}
  </span>
</div>
```

**Visual Characteristics:**
- Background: Transparent
- Track number: Visible (1-5)
- Text: Gray tones
- Cursor: Pointer
- Hover: Subtle white overlay (5% opacity)

---

#### 2. Hover State (Desktop Only)

**Changes on hover:**
- Background: `bg-white/5` (5% white overlay)
- Track number → Play icon (▶)
- Play icon: `text-gray-400 group-hover:text-white`

```tsx
<div className="group">
  {/* Track Number becomes Play Icon */}
  <div className="w-5 flex items-center justify-center">
    {showPlayIcon ? (
      <PlayIcon className="w-4 h-4 text-gray-400 group-hover:text-white
        transition-colors" />
    ) : (
      <span className="text-sm text-gray-400">{number}</span>
    )}
  </div>
</div>
```

**Note:** Mobile (touch) devices skip this state - they go directly to playing on tap.

---

#### 3. Playing State

**Visual changes:**
- Background: `bg-white/5` (persists)
- Track number → **Animated equalizer bars** (3 vertical bars, bouncing)
- Track name: `text-white` (brighter, from gray-300)
- Album name: `text-gray-400` (unchanged)
- Duration → **Pause icon** (⏸)

```tsx
{isPlaying && (
  <>
    {/* Equalizer replaces track number */}
    <div className="w-5 flex items-center justify-center">
      <EqualizerIcon className="w-4 h-4 text-white" />
    </div>

    {/* Track name brighter */}
    <p className="text-sm font-medium text-white truncate">
      {trackName}
    </p>

    {/* Pause icon replaces duration */}
    <div className="w-10 flex items-center justify-center">
      <PauseIcon className="w-5 h-5 text-white" />
    </div>
  </>
)}
```

**Equalizer Animation:**
- 3 vertical bars (2px width each, 4px gap)
- Heights: 4px, 8px, 6px (randomized bouncing)
- Animation: `animate-bounce` staggered delays
- Color: White (#ffffff)

---

#### 4. Disabled State (No Preview Available)

**Visual changes:**
- Entire row: `opacity-40 cursor-not-allowed`
- Track number: Shows number (no play icon on hover)
- Duration replaced with: "No preview" text
- No hover effect

```tsx
<div className="
  flex items-center gap-3 p-3 rounded-lg
  opacity-40 cursor-not-allowed
">
  {/* Track number remains visible */}
  <span className="w-5 text-center text-sm text-gray-400">
    {number}
  </span>

  {/* Album art (grayed out) */}
  <img
    src={albumArt}
    className="w-10 h-10 rounded flex-shrink-0 grayscale"
  />

  {/* Track info (muted) */}
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-gray-500 truncate">
      {trackName}
    </p>
    <p className="text-xs text-gray-500 truncate">
      {albumName}
    </p>
  </div>

  {/* "No preview" label */}
  <span className="text-[10px] text-gray-500">
    No preview
  </span>
</div>
```

**Note:** Users cannot interact with disabled tracks. They are shown for context (complete Top 5 list) but clearly indicated as unavailable.

---

### Color Palette

| Element | Default | Hover | Active/Playing | Disabled |
|---------|---------|-------|----------------|----------|
| Background | `#121212` | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.05)` | `#121212` |
| Track Number | `#9ca3af` | Play icon | Equalizer (white) | `#6b7280` |
| Track Name | `#d1d5db` | `#d1d5db` | `#ffffff` | `#6b7280` |
| Album Name | `#9ca3af` | `#9ca3af` | `#9ca3af` | `#6b7280` |
| Duration | `#9ca3af` | `#9ca3af` | Pause icon (white) | — |
| Play All Button | `#ffffff` | `#f3f4f6` | `#ffffff` | `#6b7280` |

**Contrast Ratios (WCAG AA):**
- White text on `#121212`: 15.3:1 ✅
- Gray-300 text on `#121212`: 10.2:1 ✅
- Gray-400 text on `#121212`: 7.1:1 ✅

---

### Typography

| Element | Font | Size | Weight | Color | Line Height |
|---------|------|------|--------|-------|-------------|
| Section Label | Source Sans | 12px | 600 | Gray-400 | 1.2 |
| Track Name | Source Sans | 14px | 500 | Gray-300/White | 1.3 |
| Album Name | Source Sans | 12px | 400 | Gray-400 | 1.3 |
| Duration | Source Sans | 12px | 400 | Gray-400 | 1.2 |
| Streaming Link | Source Sans | 12px | 400 | Gray-400 | 1.4 |

**Text Truncation:**
- Track names: `truncate` (single line with ellipsis)
- Album names: `truncate` (single line with ellipsis)
- Long names never wrap to preserve row height

---

### Spacing & Sizing

**Panel Padding:**
- Desktop: `p-8` (32px all sides)
- Mobile: `p-6` (24px all sides)

**Section Spacing:**
- Header → Play button: `mb-4` (16px)
- Play button → Track list: `mb-4` (16px)
- Track rows: `gap-1` (4px vertical spacing)
- Track list → Streaming link: `mt-4` (16px)

**Element Sizing:**
- Play All button: 40×40px (min-height: 44px with padding)
- Track row height: 52px (ensures 44px+ tap target)
- Album art: 40×40px
- Icons: 16-20px (depending on context)

**Mobile Adjustments:**
- Track row height: 52px (maintained for touch)
- Album art: 36×36px (slightly smaller)
- Panel padding: 24px (reduced from 32px)
- Hide duration on very narrow screens (<350px width)

---

### Streaming Link Footer

**Layout:**
```tsx
<div className="mt-4 pt-4 border-t border-white/10">
  <a
    href={streamingUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-center gap-2 text-xs
      text-gray-400 hover:text-white transition-colors group"
  >
    <ExternalLinkIcon className="w-3.5 h-3.5" />
    <span>Listen on {source === 'deezer' ? 'Deezer' : 'Apple Music'}</span>
  </a>
</div>
```

**Specifications:**
- Border: 1px solid `rgba(255,255,255,0.1)` above link
- Padding: 16px top
- Text: 12px, gray-400
- Icon: Heroicons `ArrowTopRightOnSquareIcon` (3.5×3.5)
- Hover: Text and icon turn white
- Dynamic label: "Deezer" or "Apple Music" based on source

---

### Empty States

#### 1. Coming Soon (Skeleton State)

**Used when:** Feature not yet implemented or data not loaded

```tsx
<div className="flex flex-col items-center justify-center h-full py-12">
  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center
    justify-center mb-4">
    <MusicalNoteIcon className="w-6 h-6 text-gray-600" />
  </div>
  <p className="font-sans text-sm text-gray-500 mb-1">
    Track Previews
  </p>
  <p className="font-sans text-xs text-gray-600">
    Coming Soon
  </p>
</div>
```

---

#### 2. No Data Available

**Used when:** Artist doesn't meet quality bar (< 40% preview coverage)

```tsx
<div className="flex flex-col items-center justify-center h-full py-12">
  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center
    justify-center mb-4">
    <MusicalNoteIcon className="w-6 h-6 text-gray-700" />
  </div>
  <p className="font-sans text-sm text-gray-500 text-center px-8">
    Track previews not available for this artist
  </p>
</div>
```

**Visual Differences:**
- "Coming Soon" uses brighter icon (gray-600)
- "Not Available" uses dimmer icon (gray-700)
- "Not Available" is artist-specific (some artists have data, others don't)

---

### Interactive Behaviors

#### Click/Tap Behavior

**Entire track row is clickable:**
- Click anywhere on row → Play/pause that track
- 52px row height = large touch target (exceeds 44px minimum)
- Clear hover feedback (desktop) indicates clickability

**Play All button:**
- Starts playback from first track with preview URL
- If already playing, pauses current track
- Disabled if no tracks have previews

**Streaming link:**
- Opens Deezer/Apple Music in new tab
- Does NOT pause playback (keeps playing in background)

---

#### Auto-Advance Logic

**When a track ends:**
1. Find next track with `previewUrl !== null`
2. If found, start playing that track
3. If no more tracks, stop playback and reset UI

**Example flow:**
- Tracks 1, 3, 5 have previews
- Tracks 2, 4 do not
- Play All → Plays 1 → Auto-advances to 3 → Auto-advances to 5 → Stops

---

#### Gatefold Close Behavior

**When user closes gatefold:**
1. Stop audio playback immediately
2. Reset player state (no track playing)
3. Clear audio element source
4. Prevent audio from continuing in background

```tsx
useEffect(() => {
  // Cleanup when gatefold closes
  return () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }
}, [])
```

---

### Accessibility

#### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus between Play All button and track rows |
| `Shift + Tab` | Move focus backward |
| `Enter` / `Space` | Play/pause focused track or activate Play All |
| `Escape` | Close gatefold (stops playback) |

**Focus Indicators:**
```tsx
<div className="
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-white/50
  focus-visible:ring-offset-2
  focus-visible:ring-offset-[#121212]
">
```

---

#### ARIA Attributes

**Player Container:**
```tsx
<div
  role="region"
  aria-label={`Top tracks by ${artistName}`}
>
```

**Track List:**
```tsx
<div role="list" aria-label="Track list">
  {tracks.map((track, i) => (
    <div
      role="listitem"
      aria-label={`${track.name}, ${track.albumName}, ${formatDuration(track.durationMs)}`}
      aria-disabled={!track.previewUrl}
      tabIndex={track.previewUrl ? 0 : -1}
    >
  ))}
</div>
```

**Live Region Announcements:**
```tsx
{isPlaying && (
  <div aria-live="polite" className="sr-only">
    Now playing: {tracks[currentIndex].name}
  </div>
)}
```

**Play All Button:**
```tsx
<button
  aria-label={isPlaying ? "Pause all tracks" : "Play all tracks"}
  aria-pressed={isPlaying}
>
```

---

#### Screen Reader Support

**Disabled tracks:**
- Use `aria-disabled="true"`
- Include "No preview available" in aria-label
- Remove from tab order (`tabIndex={-1}`)

**Currently playing:**
- Announce track name via `aria-live="polite"`
- Update button labels dynamically (Play → Pause)
- Provide audio element with `aria-hidden="true"` (hidden but functional)

---

### Animation Specifications

#### Equalizer Animation (Playing Indicator)

**Structure:**
```tsx
<div className="flex items-end gap-0.5 h-4">
  <div className="w-0.5 bg-white animate-bounce" style={{
    animationDelay: '0ms',
    animationDuration: '800ms'
  }} />
  <div className="w-0.5 bg-white animate-bounce" style={{
    animationDelay: '200ms',
    animationDuration: '900ms'
  }} />
  <div className="w-0.5 bg-white animate-bounce" style={{
    animationDelay: '400ms',
    animationDuration: '850ms'
  }} />
</div>
```

**Specifications:**
- 3 bars, 2px width each, 4px total height
- Staggered bounce animation (200ms offsets)
- Varying durations (800-900ms) for natural feel
- White color (#ffffff)

---

#### Hover Transitions

**All interactive elements:**
- Duration: `200ms`
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- Properties: `background-color`, `color`, `transform`, `box-shadow`

**Play All Button:**
- Hover scale: `transform: scale(1.05)`
- Shadow increase: `shadow-md` → `shadow-lg`
- Duration: `200ms`

**Track Rows:**
- Background fade: 0% → 5% white overlay
- No scale or movement (maintains list stability)

---

#### Loading States (Future)

**Skeleton while tracks load:**
- Show 5 gray rectangles (track name placeholders)
- Pulse animation: `animate-pulse`
- Duration: 1.5s infinite
- Opacity range: 0.5 → 1.0

---

### Mobile-Specific Considerations

#### Phone Layout Adjustments

**Changes for phone gatefold (vertical orientation):**
1. Panel takes full width of device
2. Reduced padding: `p-6` (24px vs 32px desktop)
3. Slightly smaller album art: 36×36px (vs 40px desktop)
4. No hover states (direct tap interaction)
5. Larger Play All button: 44×44px minimum

**Very narrow screens (<350px):**
- Hide duration text (only show on playing track as pause icon)
- Reduce horizontal padding to `p-4` (16px)
- Slightly smaller album art: 32×32px

---

#### Touch Target Sizes

**Minimum touch targets (iOS/Android guidelines):**
- Play All button: 44×44px ✅
- Track row: 52×52px ✅
- Streaming link: 44px height (with padding) ✅

**All interactive elements meet WCAG 2.5.5 (Target Size) Level AAA**

---

### Responsive Breakpoints

| Breakpoint | Width | Changes |
|------------|-------|---------|
| Desktop | ≥1024px | Full 400×400px panel, 40px album art, show duration |
| Tablet | 768-1023px | Full-width panel, 40px album art, show duration |
| Mobile | 350-767px | Full-width panel, 36px album art, show duration |
| Small mobile | <350px | Full-width panel, 32px album art, hide duration except when playing |

---

### Performance Considerations

**Image Loading:**
- Album art preloaded during gatefold open animation
- Lazy load non-visible tracks (only top 3 initially)
- Fallback to gradient placeholder if image fails

**Audio Preloading:**
- Do NOT preload audio files (waste of bandwidth)
- Load audio only when user clicks play
- Use native `<audio>` element (no heavy libraries)

**Animation Performance:**
- Use `transform` and `opacity` only (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Use `will-change: transform` on hover elements

---

## Analytics Tracking

### Overview

Track all user interactions with the audio preview player to understand engagement, identify popular features, and monitor data quality. All events follow project naming conventions (`artist_*` prefix, `snake_case`, past tense verbs).

**Analytics Service:** Use existing `src/services/analytics.ts`

**Core Metrics:**
- Play rate: % of gatefolds where users play at least one preview
- Completion rate: % of played tracks that reach 30 seconds
- Auto-advance usage: % of sessions using Play All vs. individual tracks
- Data quality: % of artists with insufficient preview coverage

---

### Event Naming Conventions

**Pattern:** `artist_preview_{action}`

**Standard Parameters:**
- `artist_name` (string) - Display name of artist
- `device_type` (string) - `'mobile'` or `'desktop'`
- `track_name` (string) - Track title
- `track_position` (number) - Position in Top 5 list (1-5)
- `source` (string) - `'deezer'` or `'itunes'`

---

### Core Events

#### 1. `artist_preview_played`

**Fired when:** User plays a track (via track row click or Play All button).

**Parameters:**
```typescript
analytics.trackEvent('artist_preview_played', {
  artist_name: string,         // "Depeche Mode"
  track_name: string,           // "Enjoy the Silence"
  track_position: number,       // 1-5
  source: 'deezer' | 'itunes',  // Which API provided preview
  device_type: 'mobile' | 'desktop',
  trigger: 'track_click' | 'play_all' | 'auto_advance'
})
```

**Trigger Values:**
- `'track_click'` - User clicked specific track row
- `'play_all'` - Started via Play All button
- `'auto_advance'` - Previous track ended, auto-advanced

**Implementation:**
```tsx
const handlePlay = (trackIndex: number, trigger: string) => {
  const track = tracks[trackIndex]
  analytics.trackEvent('artist_preview_played', {
    artist_name: artist.name,
    track_name: track.name,
    track_position: trackIndex + 1,
    source: track.source,
    device_type: isPhone ? 'mobile' : 'desktop',
    trigger
  })
  // Start playback...
}
```

---

#### 2. `artist_preview_paused`

**Fired when:** User explicitly pauses playback (clicks pause icon or playing track row).

**Parameters:**
```typescript
analytics.trackEvent('artist_preview_paused', {
  artist_name: string,
  track_name: string,
  track_position: number,
  playback_duration: number,    // Seconds played before pause
  device_type: 'mobile' | 'desktop'
})
```

**Implementation:**
```tsx
const handlePause = () => {
  const elapsed = audioRef.current?.currentTime || 0
  analytics.trackEvent('artist_preview_paused', {
    artist_name: artist.name,
    track_name: tracks[currentIndex].name,
    track_position: currentIndex + 1,
    playback_duration: Math.round(elapsed * 10) / 10, // Round to 0.1s
    device_type: isPhone ? 'mobile' : 'desktop'
  })
  // Pause audio...
}
```

**Note:** Do NOT fire this event when gatefold closes (use cleanup logic, not analytics).

---

#### 3. `artist_preview_track_changed`

**Fired when:** Playing track changes (manual click or auto-advance).

**Parameters:**
```typescript
analytics.trackEvent('artist_preview_track_changed', {
  artist_name: string,
  from_track_position: number,  // Previous track (1-5)
  to_track_position: number,    // New track (1-5)
  change_type: 'manual' | 'auto_advance',
  device_type: 'mobile' | 'desktop'
})
```

**Change Types:**
- `'manual'` - User clicked different track while one was playing
- `'auto_advance'` - Previous track ended, automatically moved to next

**Implementation:**
```tsx
const handleTrackChange = (newIndex: number, isAutoAdvance: boolean) => {
  if (currentIndex !== null) {
    analytics.trackEvent('artist_preview_track_changed', {
      artist_name: artist.name,
      from_track_position: currentIndex + 1,
      to_track_position: newIndex + 1,
      change_type: isAutoAdvance ? 'auto_advance' : 'manual',
      device_type: isPhone ? 'mobile' : 'desktop'
    })
  }
  // Change track...
}
```

---

#### 4. `artist_preview_play_all_clicked`

**Fired when:** User clicks the Play All button.

**Parameters:**
```typescript
analytics.trackEvent('artist_preview_play_all_clicked', {
  artist_name: string,
  available_tracks: number,     // How many tracks have preview URLs (1-5)
  total_tracks: number,         // Always 5
  device_type: 'mobile' | 'desktop'
})
```

**Implementation:**
```tsx
const handlePlayAll = () => {
  const availableCount = tracks.filter(t => t.previewUrl).length

  analytics.trackEvent('artist_preview_play_all_clicked', {
    artist_name: artist.name,
    available_tracks: availableCount,
    total_tracks: tracks.length,
    device_type: isPhone ? 'mobile' : 'desktop'
  })

  // Start playback from first track with preview...
}
```

**Analysis Use Cases:**
- Compare Play All usage vs. individual track clicks
- Identify if users prefer auto-advance playlist mode
- Correlate available track count with Play All usage

---

#### 5. `artist_preview_unavailable`

**Fired when:** Audio preview section renders but no tracks meet quality bar (< 40% preview coverage).

**Parameters:**
```typescript
analytics.trackEvent('artist_preview_unavailable', {
  artist_name: string,
  reason: 'no_data' | 'insufficient_coverage' | 'api_error',
  available_tracks: number,     // How many tracks had preview URLs
  total_tracks: number,         // Tracks returned from API
  device_type: 'mobile' | 'desktop'
})
```

**Reason Values:**
- `'no_data'` - API returned no tracks or artist not found
- `'insufficient_coverage'` - Tracks exist but < 40% have preview URLs
- `'api_error'` - API request failed

**Implementation:**
```tsx
useEffect(() => {
  if (!topTracksData || !topTracksData.tracks) {
    analytics.trackEvent('artist_preview_unavailable', {
      artist_name: artist.name,
      reason: 'no_data',
      available_tracks: 0,
      total_tracks: 0,
      device_type: isPhone ? 'mobile' : 'desktop'
    })
  } else {
    const availableCount = topTracksData.tracks.filter(t => t.previewUrl).length
    const coveragePercent = (availableCount / topTracksData.tracks.length) * 100

    if (coveragePercent < 40) {
      analytics.trackEvent('artist_preview_unavailable', {
        artist_name: artist.name,
        reason: 'insufficient_coverage',
        available_tracks: availableCount,
        total_tracks: topTracksData.tracks.length,
        device_type: isPhone ? 'mobile' : 'desktop'
      })
    }
  }
}, [topTracksData])
```

**Analysis Use Cases:**
- Monitor data quality across all artists
- Identify which API (Deezer vs. iTunes) has better coverage
- Prioritize artists for manual curation or API fallback

---

### Optional Future Events

These events can be added in later iterations to deepen analysis:

**`artist_preview_completed`** - Track played to 30-second completion
```typescript
analytics.trackEvent('artist_preview_completed', {
  artist_name: string,
  track_name: string,
  track_position: number,
  device_type: 'mobile' | 'desktop'
})
```

**`artist_preview_skipped`** - User skipped before 10-second mark
```typescript
analytics.trackEvent('artist_preview_skipped', {
  artist_name: string,
  track_name: string,
  track_position: number,
  playback_duration: number,
  device_type: 'mobile' | 'desktop'
})
```

**`artist_preview_section_viewed`** - Section came into viewport (impression tracking)
```typescript
analytics.trackEvent('artist_preview_section_viewed', {
  artist_name: string,
  available_tracks: number,
  device_type: 'mobile' | 'desktop'
})
```

**`artist_preview_streaming_link_clicked`** - User clicked "Listen on Deezer/Apple Music"
```typescript
analytics.trackEvent('artist_preview_streaming_link_clicked', {
  artist_name: string,
  source: 'deezer' | 'itunes',
  was_playing: boolean,        // Was audio playing when link clicked?
  device_type: 'mobile' | 'desktop'
})
```

---

### Implementation Notes

**Service Import:**
```tsx
import { analytics } from '@/services/analytics'
```

**Device Type Detection:**
```tsx
const isPhone = /* existing gatefold phone detection logic */
const deviceType = isPhone ? 'mobile' : 'desktop'
```

**Event Timing:**
- Fire events **after** user action completes successfully
- Do NOT fire events on failed actions (e.g., audio load error)
- Do NOT fire duplicate events for same interaction

**Error Handling:**
- Wrap analytics calls in try-catch (don't break UI if analytics fails)
- Log analytics errors to console (dev mode only)

**Privacy:**
- No personally identifiable information (PII) in events
- Artist names and track names are public data
- Device type is aggregated category, not fingerprinting

---

### Data Quality Monitoring

**Key Metrics to Track:**

1. **Preview Availability Rate**
   - Formula: `artist_preview_played` / (`artist_preview_played` + `artist_preview_unavailable`)
   - Target: >90% (at least 230 of 254 artists have playable previews)

2. **Play Engagement Rate**
   - Formula: `artist_preview_played` / `artist_card_opened` (existing event)
   - Target: >30% (at least 3 in 10 gatefolds result in preview playback)

3. **Play All vs. Individual Track**
   - Formula: `artist_preview_play_all_clicked` / total `artist_preview_played` events
   - Insight: Do users prefer playlist mode or browsing individual tracks?

4. **Auto-Advance Completion**
   - Formula: Count of `auto_advance` triggers in `artist_preview_track_changed`
   - Insight: Are users listening through multiple tracks or stopping after one?

5. **Coverage Quality by Source**
   - Group `artist_preview_unavailable` by `source` (Deezer vs. iTunes)
   - Insight: Which API provides better preview coverage?

**Dashboard Queries (Google Analytics 4):**

```
Event: artist_preview_played
Dimensions: artist_name, source, device_type
Metrics: Event count, unique users
```

```
Event: artist_preview_unavailable
Dimensions: reason, source
Metrics: Event count
Filter: Last 30 days
```

---

## Data Architecture

### Source Files

| File | Purpose |
|------|---------|
| `concerts.json` | Canonical artist list (source of truth) |
| `artists-metadata.json` | Artist images, bios, genres (existing) |
| `artists-top-tracks.json` | **NEW:** Top 5 tracks with preview URLs |

### Data Structure

**New file:** `public/data/artists-top-tracks.json`

```typescript
interface ArtistTopTracks {
  [artistNormalized: string]: {
    name: string;
    source: 'deezer' | 'itunes';
    fetchedAt: string;
    tracks: TopTrack[];
  };
}

interface TopTrack {
  name: string;
  previewUrl: string | null;  // 30-sec MP3 (Deezer) or M4A (iTunes)
  durationMs: number;
  albumName: string;
  albumArt: string;           // 100-250px square
  streamingUrl: string;       // Deezer or Apple Music deep link
}
```

**Example:**
```json
{
  "depeche-mode": {
    "name": "Depeche Mode",
    "source": "deezer",
    "fetchedAt": "2026-02-03T00:00:00.000Z",
    "tracks": [
      {
        "name": "Personal Jesus",
        "previewUrl": "https://cdns-preview-c.dzcdn.net/stream/...",
        "durationMs": 238000,
        "albumName": "Violator",
        "albumArt": "https://e-cdns-images.dzcdn.net/images/cover/.../250x250.jpg",
        "streamingUrl": "https://www.deezer.com/track/123456"
      },
      {
        "name": "Enjoy the Silence",
        "previewUrl": null,
        "durationMs": 374000,
        "albumName": "Violator",
        "albumArt": "https://e-cdns-images.dzcdn.net/images/cover/.../250x250.jpg",
        "streamingUrl": "https://www.deezer.com/track/789012"
      }
      // ... 3 more tracks
    ]
  }
}
```

---

## API Integration

### Configuration

```typescript
// config.ts
export const AUDIO_PREVIEW_CONFIG = {
  trackLimit: 5,                    // Always fetch exactly 5 tracks
  minPreviewCoverage: 0.4,         // At least 2/5 must have preview URLs
  preferredSource: 'deezer',       // Try Deezer first (better quality)
  fallbackSource: 'itunes',        // Fall back to iTunes
  rateLimitMs: 350,                // 350ms between requests (~3 req/sec)
  timeout: 5000,                   // 5-second timeout per request
};
```

### 1. Deezer API (Primary)

**Endpoint:**
```
GET https://api.deezer.com/search/artist?q={name}
GET https://api.deezer.com/artist/{id}/top?limit=5
```

**Features:**
- ✅ Explicit "top tracks" endpoint sorted by popularity
- ✅ 30-second MP3 previews (256kbps)
- ✅ No authentication required
- ✅ Generous rate limits (~2000 calls/day)
- ✅ Returns rank/popularity score

**Response:**
```json
{
  "data": [
    {
      "id": 123456,
      "title": "Personal Jesus",
      "preview": "https://cdns-preview-c.dzcdn.net/...",
      "duration": 238,
      "rank": 920543,
      "album": {
        "title": "Violator",
        "cover_medium": "https://..."
      },
      "link": "https://www.deezer.com/track/123456"
    }
  ]
}
```

### 2. iTunes Search API (Secondary)

**Endpoint:**
```
GET https://itunes.apple.com/search?term={name}&entity=song&limit=5&country=US
```

**Features:**
- ✅ Returns songs sorted by relevance + popularity
- ✅ 30-90 second M4A previews (128kbps AAC)
- ✅ No authentication required
- ✅ No rate limits (Apple encourages usage)
- ✅ Excellent coverage (~85%)

**Response:**
```json
{
  "results": [
    {
      "trackName": "Personal Jesus",
      "previewUrl": "https://audio-ssl.itunes.apple.com/...",
      "trackTimeMillis": 238000,
      "collectionName": "Violator",
      "artworkUrl100": "https://...",
      "trackViewUrl": "https://music.apple.com/..."
    }
  ]
}
```

---

## Enrichment Logic

### Script: `scripts/enrich-top-tracks.ts`

**Workflow:**

```typescript
import { DeezerClient } from './utils/deezer-client'
import { iTunesClient } from './utils/itunes-client'
import { normalizeArtistName } from '../src/utils/normalize'
import { RateLimiter } from './utils/rate-limiter'
import { AUDIO_PREVIEW_CONFIG } from './config'

async function enrichTopTracks() {
  console.log('🎵 Enriching artist top tracks...\n')

  const concerts = loadConcerts()
  const artists = getUniqueArtists(concerts) // All headliners + openers

  const deezer = new DeezerClient()
  const itunes = new iTunesClient()
  const rateLimiter = new RateLimiter(AUDIO_PREVIEW_CONFIG.rateLimitMs / 1000)

  const results: ArtistTopTracks = {}
  let enriched = 0
  let skipped = 0
  let failed = 0

  for (const artistName of artists) {
    const normalized = normalizeArtistName(artistName)

    // Skip if already enriched recently (within 30 days)
    if (shouldSkip(normalized)) {
      skipped++
      continue
    }

    console.log(`Fetching tracks for: ${artistName}`)

    try {
      await rateLimiter.wait()

      // Try Deezer first
      const deezerTracks = await deezer.getTopTracks(artistName, AUDIO_PREVIEW_CONFIG.trackLimit)

      if (deezerTracks && meetsQualityBar(deezerTracks)) {
        const previewCount = countPreviews(deezerTracks)
        console.log(`  ✅ Deezer: ${previewCount}/${AUDIO_PREVIEW_CONFIG.trackLimit} tracks have previews`)

        results[normalized] = {
          name: artistName,
          source: 'deezer',
          fetchedAt: new Date().toISOString(),
          tracks: normalizeDeezerTracks(deezerTracks)
        }
        enriched++
        continue
      }

      // Fallback to iTunes
      console.log(`  → Trying iTunes...`)
      const iTunesTracks = await itunes.getTopTracks(artistName, AUDIO_PREVIEW_CONFIG.trackLimit)

      if (iTunesTracks && meetsQualityBar(iTunesTracks)) {
        const previewCount = countPreviews(iTunesTracks)
        console.log(`  ✅ iTunes: ${previewCount}/${AUDIO_PREVIEW_CONFIG.trackLimit} tracks have previews`)

        results[normalized] = {
          name: artistName,
          source: 'itunes',
          fetchedAt: new Date().toISOString(),
          tracks: normalizeiTunesTracks(iTunesTracks)
        }
        enriched++
        continue
      }

      // Neither source had sufficient preview coverage
      console.log(`  ⚠️  No sufficient preview coverage found`)
      failed++

    } catch (error) {
      console.error(`  ❌ Error fetching ${artistName}:`, error)
      failed++
    }
  }

  // Save results
  writeJSON('public/data/artists-top-tracks.json', results)

  console.log(`\n📊 Enrichment Summary:`)
  console.log(`   ✅ Enriched: ${enriched}`)
  console.log(`   ⏭️  Skipped (cached): ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`\n🎉 Done!`)
}

/**
 * Quality bar: At least 40% of tracks must have preview URLs
 * For 5 tracks, this means at least 2 tracks need previews
 */
function meetsQualityBar(tracks: any[]): boolean {
  const previewCount = tracks.filter(t => t.previewUrl !== null).length
  const coverage = previewCount / tracks.length
  return coverage >= AUDIO_PREVIEW_CONFIG.minPreviewCoverage
}

function countPreviews(tracks: any[]): number {
  return tracks.filter(t => t.previewUrl !== null).length
}
```

### Quality Guarantees

**Only accept an API result if:**
1. ✅ Returns exactly 5 tracks
2. ✅ At least 2 tracks have `previewUrl` (40% coverage)
3. ✅ All required fields present (name, duration, album art, streaming URL)

**This ensures:**
- Users never see a list with only 1 playable track
- Consistent experience across all artists
- High-quality data or no data (never partial/broken data)

---

## Client Implementation

### 1. DeezerClient Extension

**File:** `scripts/utils/deezer-client.ts`

```typescript
export class DeezerClient {
  // ... existing methods ...

  /**
   * Get top 5 tracks by popularity with preview URLs
   */
  async getTopTracks(artistName: string, limit: number = 5) {
    try {
      // Step 1: Search for artist
      const artists = await this.searchArtist(artistName)
      if (!artists || artists.length === 0) return null

      const artistId = artists[0].id

      // Step 2: Get top tracks
      const response = await fetch(
        `${this.baseUrl}/artist/${artistId}/top?limit=${limit}`
      )

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('  ⚠️  Rate limit hit, waiting 2 seconds...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          return this.getTopTracks(artistName, limit) // Retry once
        }
        throw new Error(`Deezer API error: ${response.status}`)
      }

      const data = await response.json()
      return data.data || []

    } catch (error) {
      console.error(`Failed to fetch top tracks from Deezer: ${artistName}`, error)
      return null
    }
  }
}
```

### 2. iTunesClient (New)

**File:** `scripts/utils/itunes-client.ts`

```typescript
export class iTunesClient {
  private baseUrl = 'https://itunes.apple.com'

  /**
   * Search for tracks by artist (returns top tracks by relevance/popularity)
   * No authentication required!
   */
  async getTopTracks(artistName: string, limit: number = 5) {
    try {
      const encodedName = encodeURIComponent(artistName)
      const response = await fetch(
        `${this.baseUrl}/search?term=${encodedName}&entity=song&limit=${limit}&country=US`
      )

      if (!response.ok) {
        throw new Error(`iTunes API error: ${response.status}`)
      }

      const data = await response.json()
      return data.results || []

    } catch (error) {
      console.error(`Failed to fetch tracks from iTunes: ${artistName}`, error)
      return null
    }
  }
}
```

### 3. Track Normalization

```typescript
/**
 * Normalize Deezer response to common format
 */
function normalizeDeezerTracks(tracks: DeezerTrack[]): TopTrack[] {
  return tracks.map(t => ({
    name: t.title,
    previewUrl: t.preview || null,
    durationMs: t.duration * 1000,
    albumName: t.album.title,
    albumArt: t.album.cover_medium,
    streamingUrl: t.link
  }))
}

/**
 * Normalize iTunes response to common format
 */
function normalizeiTunesTracks(tracks: iTunesTrack[]): TopTrack[] {
  return tracks.map(t => ({
    name: t.trackName,
    previewUrl: t.previewUrl || null,
    durationMs: t.trackTimeMillis,
    albumName: t.collectionName,
    albumArt: t.artworkUrl100,
    streamingUrl: t.trackViewUrl
  }))
}
```

---

## Frontend Implementation

### Component Structure

```
src/components/scenes/ArtistScene/
├── AudioPreviewPlayer.tsx       # NEW: Main player component
├── TrackRow.tsx                 # NEW: Individual track row
├── useAudioPlayer.ts            # NEW: Playback hook
└── ArtistCardBack.tsx           # MODIFY: Integrate player
```

### 1. Audio Player Component

**File:** `src/components/scenes/ArtistScene/AudioPreviewPlayer.tsx`

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { TopTrack } from '@/types/artist'
import { TrackRow } from './TrackRow'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'

interface AudioPreviewPlayerProps {
  artistName: string
  tracks: TopTrack[]
  source: 'deezer' | 'itunes'
  streamingUrl: string
}

export function AudioPreviewPlayer({
  artistName,
  tracks,
  source,
  streamingUrl
}: AudioPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const playTrack = useCallback((index: number) => {
    const track = tracks[index]
    if (!track.previewUrl || !audioRef.current) return

    // If clicking same track, toggle play/pause
    if (index === currentIndex) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
      return
    }

    // New track: load and play
    audioRef.current.src = track.previewUrl
    audioRef.current.play()
    setCurrentIndex(index)
    setIsPlaying(true)
  }, [tracks, currentIndex, isPlaying])

  const handlePlayAll = () => {
    const firstPlayable = tracks.findIndex(t => t.previewUrl !== null)
    if (firstPlayable >= 0) {
      playTrack(firstPlayable)
    }
  }

  // Auto-advance to next track when preview ends
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => {
      // Find next track with preview
      let nextIndex = (currentIndex ?? -1) + 1
      while (nextIndex < tracks.length) {
        if (tracks[nextIndex].previewUrl) {
          playTrack(nextIndex)
          return
        }
        nextIndex++
      }
      // No more tracks: stop
      setIsPlaying(false)
      setCurrentIndex(null)
    }

    audio.addEventListener('ended', handleEnded)
    return () => audio.removeEventListener('ended', handleEnded)
  }, [currentIndex, tracks, playTrack])

  if (!tracks || tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="text-sm">Track previews not available</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioRef} className="hidden" />

      {/* Header with Play All */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Top 5 Tracks</h3>
        <button
          onClick={handlePlayAll}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-full text-white text-sm transition-colors"
        >
          <PlayIcon className="w-4 h-4" />
          Play All
        </button>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {tracks.map((track, index) => (
          <TrackRow
            key={index}
            number={index + 1}
            track={track}
            isPlaying={isPlaying && currentIndex === index}
            onPlay={() => playTrack(index)}
          />
        ))}
      </div>

      {/* Streaming Link */}
      <a
        href={streamingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        🔗 Listen on {source === 'deezer' ? 'Deezer' : 'Apple Music'}
      </a>
    </div>
  )
}
```

### 2. Track Row Component

**File:** `src/components/scenes/ArtistScene/TrackRow.tsx`

```tsx
import { TopTrack } from '@/types/artist'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { formatDuration } from '@/utils/format'

interface TrackRowProps {
  number: number
  track: TopTrack
  isPlaying: boolean
  onPlay: () => void
}

export function TrackRow({ number, track, isPlaying, onPlay }: TrackRowProps) {
  const hasPreview = track.previewUrl !== null

  return (
    <div
      onClick={hasPreview ? onPlay : undefined}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all",
        hasPreview ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed opacity-50",
        isPlaying && "bg-green-600/10"
      )}
      role={hasPreview ? "button" : undefined}
      aria-disabled={!hasPreview}
    >
      {/* Track Number */}
      <span className="text-sm text-gray-400 w-4">{number}</span>

      {/* Album Art */}
      <img
        src={track.albumArt}
        alt={track.albumName}
        className="w-10 h-10 rounded"
      />

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{track.name}</p>
        <p className="text-xs text-gray-400 truncate">{track.albumName}</p>
      </div>

      {/* Duration */}
      <span className="text-xs text-gray-400">
        {formatDuration(track.durationMs)}
      </span>

      {/* Play/Pause Icon */}
      <div className="w-6 h-6 flex items-center justify-center">
        {hasPreview ? (
          isPlaying ? (
            <PauseIcon className="w-5 h-5 text-green-500" />
          ) : (
            <PlayIcon className="w-5 h-5" />
          )
        ) : (
          <span className="text-[10px] text-gray-500">No preview</span>
        )}
      </div>
    </div>
  )
}
```

### 3. Integration with Gatefold

**File:** `src/components/scenes/ArtistScene/ArtistCardBack.tsx`

```tsx
import { AudioPreviewPlayer } from './AudioPreviewPlayer'
import { useArtistTopTracks } from '@/hooks/useArtistTopTracks'

export function ArtistCardBack({ artist }: ArtistCardBackProps) {
  const { tracks, source, streamingUrl, loading } = useArtistTopTracks(artist.name)

  return (
    <div className="gatefold-right-panel">
      {/* Concert History Panel (Left) - existing */}
      <div className="concert-history">
        {/* ... existing concert history ... */}
      </div>

      {/* Audio Preview Panel (Right) - NEW */}
      <div className="audio-preview-panel">
        {loading ? (
          <LoadingSpinner />
        ) : tracks ? (
          <AudioPreviewPlayer
            artistName={artist.name}
            tracks={tracks}
            source={source}
            streamingUrl={streamingUrl}
          />
        ) : (
          <EmptyState message="Track previews not available" />
        )}
      </div>
    </div>
  )
}
```

---

## Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move between track rows and Play All button |
| `Enter` / `Space` | Play/pause focused track |
| `Escape` | Close gatefold (stops playback) |

### ARIA Attributes

```tsx
<div
  role="region"
  aria-label={`Top tracks by ${artistName}`}
>
  <audio ref={audioRef} aria-hidden="true" />

  <div role="list" aria-label="Track list">
    {tracks.map((track, i) => (
      <div
        role="listitem"
        aria-label={`${track.name}, ${formatDuration(track.durationMs)}`}
        aria-disabled={!track.previewUrl}
        tabIndex={track.previewUrl ? 0 : -1}
      >
        {/* ... track content ... */}
      </div>
    ))}
  </div>
</div>

{/* Screen reader announcements */}
{isPlaying && (
  <div aria-live="polite" className="sr-only">
    Now playing: {tracks[currentIndex].name}
  </div>
)}
```

---

## Testing Requirements

### Data Enrichment Tests

**File:** `test/pipeline/enrich-top-tracks.test.ts`

```typescript
describe('enrichTopTracks', () => {
  it('should fetch top 5 tracks from Deezer', async () => {
    // Mock Deezer API to return 5 tracks with 3 previews
    // Verify: Returns normalized data with source: 'deezer'
  })

  it('should fall back to iTunes when Deezer has low coverage', async () => {
    // Mock Deezer API to return only 1 preview (below 40% threshold)
    // Mock iTunes API to return 4 previews
    // Verify: Uses iTunes result with source: 'itunes'
  })

  it('should reject artist when neither source meets quality bar', async () => {
    // Mock both APIs to return <40% preview coverage
    // Verify: Returns null, artist not included in output
  })

  it('should normalize track data consistently', () => {
    // Test normalizeDeezerTracks() and normalizeiTunesTracks()
    // Verify: Both produce identical structure
  })

  it('should handle rate limiting gracefully', async () => {
    // Mock 429 response from Deezer
    // Verify: Waits 2 seconds and retries
  })
})
```

### Frontend Component Tests

```typescript
describe('AudioPreviewPlayer', () => {
  it('should render 5 track rows', () => {
    // Verify: Exactly 5 <TrackRow> components rendered
  })

  it('should play track when clicked', () => {
    // Click track row, verify audio.play() called
  })

  it('should auto-advance to next track when preview ends', () => {
    // Simulate audio 'ended' event, verify next track plays
  })

  it('should skip tracks without preview URLs', () => {
    // Verify: Tracks with previewUrl: null are grayed out and not clickable
  })

  it('should show empty state when no tracks available', () => {
    // Render with tracks: [], verify empty state shown
  })
})
```

---

## Implementation Checklist

### Phase 1: API Clients & Enrichment (Backend)
**Estimated: 6-8 hours**

- [ ] Create `scripts/utils/itunes-client.ts` with `getTopTracks()` method
- [ ] Extend `scripts/utils/deezer-client.ts` with `getTopTracks()` method
- [ ] Create `scripts/enrich-top-tracks.ts` with waterfall logic
- [ ] Add track normalization functions
- [ ] Implement quality bar validation (40% preview coverage)
- [ ] Add rate limiting and error handling
- [ ] Test on 10 sample artists
- [ ] Run full enrichment on all 254 artists
- [ ] Verify output file: `public/data/artists-top-tracks.json`

### Phase 2: Frontend Data Hook
**Estimated: 2-3 hours**

- [ ] Create `src/hooks/useArtistTopTracks.ts` hook
- [ ] Load `artists-top-tracks.json` at build time
- [ ] Implement lookup by normalized artist name
- [ ] Add TypeScript interfaces for `TopTrack` and `ArtistTopTracks`

### Phase 3: Audio Player Components
**Estimated: 6-8 hours**

- [ ] Create `AudioPreviewPlayer.tsx` component
- [ ] Create `TrackRow.tsx` component
- [ ] Implement `useAudioPlayer` hook with play/pause logic
- [ ] Add auto-advance functionality
- [ ] Implement Play All button
- [ ] Add loading and empty states
- [ ] Style components (Tailwind)

### Phase 4: Gatefold Integration
**Estimated: 3-4 hours**

- [ ] Integrate `AudioPreviewPlayer` into `ArtistCardBack.tsx`
- [ ] Replace skeleton/placeholder with real player
- [ ] Stop playback when gatefold closes
- [ ] Test with artists that have/don't have track data
- [ ] Adjust panel layouts if needed

### Phase 5: Testing & Polish
**Estimated: 4-5 hours**

- [ ] Write unit tests for enrichment script
- [ ] Write component tests for player
- [ ] Keyboard navigation testing
- [ ] Screen reader testing
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsive testing
- [ ] Performance audit (no memory leaks)

---

## Expected Coverage Results

Based on typical API behavior:

| Artist Category | % of Total | Deezer Coverage | iTunes Coverage | Combined Result |
|-----------------|------------|-----------------|-----------------|-----------------|
| Major label (Social Distortion, Depeche Mode) | 80% | ✅ 90% | ✅ 95% | **✅ 95%** |
| Indie/alternative (Against Me!, Dead Kennedys) | 15% | ⚠️ 60% | ✅ 80% | **✅ 80%** |
| Obscure/local (opening acts) | 5% | ❌ 30% | ⚠️ 50% | **⚠️ 50%** |

**Expected Final Coverage:**
- **230-240 artists** (90-95%) will have Top 5 tracks with 2+ previews
- **10-20 artists** (5-10%) won't meet quality bar (show empty state)
- **No artists** will have incomplete/broken data (quality bar ensures this)

---

## Future Enhancements

Once this is implemented:

1. **Expand to Top 10** - Increase track limit if user feedback is positive
2. **Volume Controls** - Add volume slider (currently uses system volume)
3. **Progress Bar** - Show visual playback progress for current track
4. **Queue Management** - Allow reordering or skipping tracks
5. **Album Deep Links** - Click album art to view full album
6. **Lyrics Integration** - Fetch lyrics from Musixmatch or Genius

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `scripts/utils/itunes-client.ts` | **Create** | iTunes Search API client |
| `scripts/utils/deezer-client.ts` | **Modify** | Add `getTopTracks()` method |
| `scripts/enrich-top-tracks.ts` | **Create** | Enrichment script with waterfall logic |
| `public/data/artists-top-tracks.json` | **Create** | Generated track data (build artifact) |
| `src/components/scenes/ArtistScene/AudioPreviewPlayer.tsx` | **Create** | Main player component |
| `src/components/scenes/ArtistScene/TrackRow.tsx` | **Create** | Individual track row |
| `src/components/scenes/ArtistScene/useAudioPlayer.ts` | **Create** | Playback hook |
| `src/components/scenes/ArtistScene/ArtistCardBack.tsx` | **Modify** | Integrate player |
| `src/hooks/useArtistTopTracks.ts` | **Create** | Data fetching hook |
| `src/types/artist.ts` | **Modify** | Add `TopTrack` and `ArtistTopTracks` interfaces |
| `test/pipeline/enrich-top-tracks.test.ts` | **Create** | Enrichment tests |
| `test/pipeline/itunes-client.test.ts` | **Create** | iTunes client tests |
| `package.json` | **Modify** | Add `enrich:tracks` script |

---

## Related Documentation

- [artists-spotify-integration.md](artists-spotify-integration.md) — Original Spotify-based approach (superseded by this spec)
- [global-image-sourcing-strategy.md](global-image-sourcing-strategy.md) — Unified image strategy using free APIs
- [global-deezer-artist-imagery.md](../implemented/global-deezer-artist-imagery.md) — Deezer integration for artist images
- [DATA_PIPELINE.md](../../DATA_PIPELINE.md) — Data enrichment documentation
- [api-setup.md](../../api-setup.md) — API configuration (no auth needed for this feature!)

---

**Total Estimated Time:** 21-28 hours
**Risk Level:** Low (free APIs, no authentication, additive feature)
**Dependencies:** None (Deezer client already exists)
**Proposed Release:** TBD

---

*Created: 2026-02-03*
*Author: Claude Code + User*
*Replaces Spotify dependency with free API alternatives*
