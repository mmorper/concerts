/**
 * LinerNoteMiniPlayer — compact single-track audio preview for liner notes posts
 * Spec: docs/specs/future/liner-notes-design-mocks.md
 */

import { useState, useRef, useEffect } from 'react'
import type { PostAudio } from '../../types/liner-notes'

interface LinerNoteMiniPlayerProps {
  audio: PostAudio
  accentColor: string
}

export function LinerNoteMiniPlayer({ audio, accentColor }: LinerNoteMiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleToggle = () => {
    const el = audioRef.current
    if (!el) return

    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
    } else {
      el.src = audio.previewUrl
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const handleEnded = () => setIsPlaying(false)
    const handleError = () => setIsPlaying(false)
    el.addEventListener('ended', handleEnded)
    el.addEventListener('error', handleError)
    return () => {
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('error', handleError)
    }
  }, [])

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
      className="flex items-center gap-3 rounded-lg"
      style={{ background: '#f9fafb', padding: '8px 12px', borderRadius: '8px' }}
      role="region"
      aria-label={`Audio preview: ${audio.trackName} by ${audio.artistName}`}
    >
      <audio ref={audioRef} className="hidden" aria-hidden="true" preload="none" />

      {/* Album art */}
      {audio.albumArt && (
        <img
          src={audio.albumArt}
          alt={`${audio.albumName} album art`}
          className="flex-shrink-0 rounded"
          style={{ width: 40, height: 40, objectFit: 'cover' }}
        />
      )}

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-medium text-gray-800 truncate">{audio.trackName}</p>
        <p className="font-sans text-xs text-gray-500 truncate">
          {audio.artistName}
          {audio.albumName && ` · ${audio.albumName}`}
        </p>
      </div>

      {/* Play/Pause button */}
      <button
        onClick={handleToggle}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-80"
        style={{ background: accentColor, minHeight: 44 }}
        aria-label={isPlaying ? `Pause ${audio.trackName}` : `Play ${audio.trackName}`}
      >
        {isPlaying ? (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Duration label */}
      <span className="font-sans text-xs text-gray-400 flex-shrink-0">0:30</span>
    </div>
  )
}
