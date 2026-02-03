import { Play, Pause } from 'lucide-react'
import type { TopTrack } from '../../../types/artist'
import { EqualizerIcon } from './EqualizerIcon'

interface TrackRowProps {
  number: number
  track: TopTrack
  isPlaying: boolean
  isPhone?: boolean
  onPlay: () => void
  defaultHover?: boolean
  onHoverChange?: () => void
}

/**
 * Format duration from milliseconds to mm:ss
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Individual track row component
 * Supports 4 states: default, hover, playing, disabled
 */
export function TrackRow({
  number,
  track,
  isPlaying,
  isPhone = false,
  onPlay,
  defaultHover = false,
  onHoverChange
}: TrackRowProps) {
  const hasPreview = track.previewUrl !== null

  // Album art size adjustments for phone
  const albumArtSize = isPhone ? 'w-9 h-9' : 'w-10 h-10'

  return (
    <div
      data-testid={`track-row-${number}`}
      data-track-name={track.name}
      data-has-preview={hasPreview}
      data-is-playing={isPlaying}
      onClick={hasPreview ? onPlay : undefined}
      onMouseEnter={hasPreview && onHoverChange ? onHoverChange : undefined}
      className={`
        group flex items-center gap-3 p-3 rounded-lg
        transition-all duration-200
        ${hasPreview ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed opacity-40'}
        ${isPlaying ? 'bg-white/5' : ''}
        ${defaultHover && !isPlaying ? 'bg-white/5' : ''}
      `}
      role={hasPreview ? 'button' : undefined}
      aria-label={`${track.name}, ${track.albumName}, ${formatDuration(track.durationMs)}${!hasPreview ? ', No preview available' : ''}`}
      aria-disabled={!hasPreview}
      tabIndex={hasPreview ? 0 : -1}
      onKeyDown={(e) => {
        if (hasPreview && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onPlay()
        }
      }}
    >
      {/* Track Number / Play Icon / Equalizer */}
      <div className="w-5 flex items-center justify-center flex-shrink-0">
        {isPlaying ? (
          // Playing: Show animated equalizer
          <EqualizerIcon />
        ) : hasPreview ? (
          // Has preview: Show play icon on hover or default hover, otherwise number
          <>
            <span className={`text-sm text-gray-400 ${defaultHover ? 'hidden' : 'group-hover:hidden md:block'}`}>
              {number}
            </span>
            <Play className={`w-4 h-4 text-gray-400 group-hover:text-white transition-colors ${defaultHover ? 'inline text-white' : 'hidden group-hover:block md:group-hover:inline'}`} />
          </>
        ) : (
          // No preview: Just show number
          <span className="text-sm text-gray-400">
            {number}
          </span>
        )}
      </div>

      {/* Album Art */}
      <img
        src={track.albumArt}
        alt={track.albumName}
        className={`${albumArtSize} rounded flex-shrink-0 ${!hasPreview ? 'grayscale' : ''}`}
      />

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isPlaying ? 'text-white' : hasPreview ? 'text-gray-300' : 'text-gray-500'}`}>
          {track.name}
        </p>
        <p className={`text-xs truncate ${hasPreview ? 'text-gray-400' : 'text-gray-500'}`}>
          {track.albumName}
        </p>
      </div>

      {/* Duration / Pause Icon / No Preview Label */}
      <div className="w-10 flex items-center justify-center flex-shrink-0">
        {isPlaying ? (
          // Playing: Show pause icon
          <Pause className="w-5 h-5 text-white" />
        ) : hasPreview ? (
          // Has preview: Show duration
          <span className="text-xs text-gray-400">
            {formatDuration(track.durationMs)}
          </span>
        ) : (
          // No preview: Show label
          <span className="text-[10px] text-gray-500">
            No preview
          </span>
        )}
      </div>
    </div>
  )
}
