/**
 * LinerNoteMiniPlayer — single-track audio preview for liner notes posts.
 * Matches the TrackRow pattern from the Artist Gatefold: inline icon, no circle button.
 */

import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
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
    const stop = () => setIsPlaying(false)
    el.addEventListener('ended', stop)
    el.addEventListener('error', stop)
    return () => {
      el.removeEventListener('ended', stop)
      el.removeEventListener('error', stop)
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

  // The post names a song and this is not it — say so rather than letting the
  // player imply otherwise (#299). Absent on posts about a night, an artist or
  // a venue, and on everything published before the fix.
  const isStandIn = audio.role === 'best-known'

  return (
    <>
      {isStandIn && (
        <p className="font-sans text-xs text-gray-400 italic px-3 pb-1">
          Not the song above — here&apos;s what they&apos;re best known for
        </p>
      )}
    <div
      onClick={handleToggle}
      className="group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100"
      role="button"
      aria-label={
        `${isPlaying ? 'Pause' : 'Play'} ${audio.trackName}` +
        (isStandIn ? ' — not the song this post is about' : '')
      }
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle() } }}
    >
      <audio ref={audioRef} className="hidden" aria-hidden="true" preload="none" />

      {/* Play / Pause icon — matches TrackRow */}
      <div className="w-5 flex items-center justify-center flex-shrink-0">
        {isPlaying
          ? <Pause className="w-4 h-4" style={{ color: accentColor }} />
          : <Play className="w-4 h-4 text-gray-400 group-hover:text-gray-700 transition-colors" />
        }
      </div>

      {/* Album art */}
      {audio.albumArt && (
        <img
          src={audio.albumArt}
          alt={audio.albumName ?? 'Album art'}
          className="flex-shrink-0 rounded"
          style={{ width: 36, height: 36, objectFit: 'cover' }}
        />
      )}

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={`font-sans text-sm font-medium truncate ${isPlaying ? 'text-gray-900' : 'text-gray-700'}`}>
          {audio.trackName}
        </p>
        <p className="font-sans text-xs text-gray-400 truncate">
          {audio.artistName}{audio.albumName && ` · ${audio.albumName}`}
        </p>
      </div>

      {/* Duration */}
      <span className="font-sans text-xs text-gray-400 flex-shrink-0">0:30</span>
    </div>
    </>
  )
}
