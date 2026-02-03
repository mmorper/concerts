import { useState, useRef, useCallback, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { TrackRow } from './TrackRow'
import type { TopTrack } from '../../../types/artist'

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
  const playTrack = useCallback((index: number) => {
    const track = tracks[index]
    const audio = audioRef.current

    if (!track.previewUrl || !audio) {
      console.warn(`[AudioPreview] Track ${index + 1} has no preview URL:`, track.name)
      return
    }

    // If clicking same track, toggle play/pause
    if (index === currentIndex) {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        audio.play().catch(error => {
          console.error('[AudioPreview] Playback failed:', error, track)
          setIsPlaying(false)
        })
        setIsPlaying(true)
      }
      return
    }

    // New track: load and play
    audio.src = track.previewUrl
    audio.load()
    setCurrentIndex(index)

    audio.play()
      .then(() => {
        setIsPlaying(true)
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
      className="flex flex-col h-full"
      role="region"
      aria-label={`Top tracks by ${artistName}`}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        className="hidden"
        aria-hidden="true"
        preload="metadata"
      />

      {/* Live region for screen readers */}
      {isPlaying && currentIndex !== null && (
        <div aria-live="polite" className="sr-only">
          Now playing: {tracks[currentIndex].name}
        </div>
      )}

      {/* Track List with Footer Inside Scroll Container */}
      <div
        className="flex-1 overflow-y-auto space-y-0.5 min-h-0"
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

        {/* Streaming Link Footer - Inside Scroll Container */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <a
            href={streamingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-xs
              text-gray-400 hover:text-white transition-colors group"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Listen to more on {source === 'deezer' ? 'Deezer' : 'Apple Music'}</span>
          </a>
        </div>
      </div>
    </div>
  )
}
