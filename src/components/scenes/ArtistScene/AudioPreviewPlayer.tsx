import { useState, useRef, useCallback, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { TrackRow } from './TrackRow'
import type { TopTrack } from '../../../types/artist'
import { analytics } from '../../../services/analytics'

interface AudioPreviewPlayerProps {
  artistName: string
  tracks: TopTrack[]
  source: 'deezer' | 'itunes'
  streamingUrl: string
  isPhone?: boolean
}

/**
 * Audio preview mini-player component
 * Manages playback state for top 5 tracks with 30-second previews
 */
export function AudioPreviewPlayer({
  artistName,
  tracks,
  source,
  streamingUrl,
  isPhone = false
}: AudioPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  /**
   * Play a specific track by index
   */
  const playTrack = useCallback((index: number, trigger: 'track_click' | 'auto_advance' = 'track_click') => {
    const track = tracks[index]
    const audio = audioRef.current

    if (!track.previewUrl || !audio) {
      console.warn(`[AudioPreview] Track ${index + 1} has no preview URL:`, track.name)
      return
    }

    // If clicking same track, toggle play/pause
    if (index === currentIndex) {
      if (isPlaying) {
        // Track pause event
        try {
          const elapsed = audio.currentTime || 0
          analytics.trackEvent('artist_preview_paused', {
            artist_name: artistName,
            track_name: track.name,
            track_position: index + 1,
            playback_duration: Math.round(elapsed * 10) / 10,
            device_type: isPhone ? 'mobile' : 'desktop'
          })
        } catch (error) {
          console.error('[AudioPreview] Analytics error:', error)
        }

        audio.pause()
        setIsPlaying(false)
      } else {
        // Track play event (resume)
        try {
          analytics.trackEvent('artist_preview_played', {
            artist_name: artistName,
            track_name: track.name,
            track_position: index + 1,
            source: source,
            device_type: isPhone ? 'mobile' : 'desktop',
            trigger: 'track_click'
          })
        } catch (error) {
          console.error('[AudioPreview] Analytics error:', error)
        }

        audio.play().catch(error => {
          console.error('[AudioPreview] Playback failed:', error, track)
          setIsPlaying(false)
        })
        setIsPlaying(true)
      }
      return
    }

    // Track manual track change if switching from another playing track
    if (currentIndex !== null && trigger === 'track_click') {
      try {
        analytics.trackEvent('artist_preview_track_changed', {
          artist_name: artistName,
          from_track_position: currentIndex + 1,
          to_track_position: index + 1,
          change_type: 'manual',
          device_type: isPhone ? 'mobile' : 'desktop'
        })
      } catch (error) {
        console.error('[AudioPreview] Analytics error:', error)
      }
    }

    // New track: load and play
    // Note: do NOT call audio.load() — setting src is sufficient and load() breaks
    // Safari's user gesture chain, preventing play() from being allowed.
    audio.src = track.previewUrl
    setCurrentIndex(index)

    audio.play()
      .then(() => {
        setIsPlaying(true)

        // Track play event for new track
        try {
          analytics.trackEvent('artist_preview_played', {
            artist_name: artistName,
            track_name: track.name,
            track_position: index + 1,
            source: source,
            device_type: isPhone ? 'mobile' : 'desktop',
            trigger: trigger
          })
        } catch (error) {
          console.error('[AudioPreview] Analytics error:', error)
        }
      })
      .catch(error => {
        console.error('[AudioPreview] Failed to load/play track:', error, track)
        setIsPlaying(false)
        setCurrentIndex(null)
      })
  }, [tracks, currentIndex, isPlaying])


  /**
   * Auto-advance to next track when preview ends
   */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => {
      // Find next track with preview
      let nextIndex = (currentIndex ?? -1) + 1
      while (nextIndex < tracks.length) {
        if (tracks[nextIndex].previewUrl) {
          // Track auto-advance event
          try {
            analytics.trackEvent('artist_preview_track_changed', {
              artist_name: artistName,
              from_track_position: (currentIndex ?? 0) + 1,
              to_track_position: nextIndex + 1,
              change_type: 'auto_advance',
              device_type: isPhone ? 'mobile' : 'desktop'
            })
          } catch (error) {
            console.error('[AudioPreview] Analytics error:', error)
          }

          playTrack(nextIndex, 'auto_advance')
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

  /**
   * Setup audio error handling
   */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleError = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('error', handleError)
    return () => audio.removeEventListener('error', handleError)
  }, [])

  /**
   * Cleanup audio when component unmounts
   */
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  return (
    <div
      data-testid="audio-preview-player"
      data-artist-name={artistName}
      className="flex flex-col h-full min-h-0"
      style={{ position: 'relative', zIndex: 10 }}
      role="region"
      aria-label={`Top tracks by ${artistName}`}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        className="hidden"
        aria-hidden="true"
        preload="none"
      />

      {/* Live region for screen readers */}
      {isPlaying && currentIndex !== null && (
        <div aria-live="polite" className="sr-only">
          Now playing: {tracks[currentIndex].name}
        </div>
      )}

      {/* Track List - No scrolling needed for 5 tracks */}
      <div
        className="space-y-1.5"
        role="list"
        aria-label="Track list"
      >
        {tracks.map((track, index) => (
          <TrackRow
            key={index}
            number={index + 1}
            track={track}
            isPlaying={isPlaying && currentIndex === index}
            isPhone={isPhone}
            onPlay={() => playTrack(index)}
            defaultHover={index === 0 && hoveredIndex === null}
            onHoverChange={() => setHoveredIndex(index)}
          />
        ))}
      </div>

      {/* Streaming Link Footer - Fixed below track list */}
      <div className="mt-4 flex-shrink-0">
          <a
            href={streamingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              try {
                analytics.trackEvent('artist_preview_streaming_link_clicked', {
                  artist_name: artistName,
                  source: source,
                  was_playing: isPlaying,
                  device_type: isPhone ? 'mobile' : 'desktop'
                })
              } catch (error) {
                console.error('[AudioPreview] Analytics error:', error)
              }
            }}
            className="flex items-center justify-center gap-2 text-xs
              text-gray-300 hover:text-white transition-colors group"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Listen to more on {source === 'deezer' ? 'Deezer' : 'Apple Music'}</span>
          </a>
        </div>
    </div>
  )
}
