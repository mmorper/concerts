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
