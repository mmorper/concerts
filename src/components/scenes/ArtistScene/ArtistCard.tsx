import { useRef } from 'react'
import { ArtistCardFront } from './ArtistCardFront'
import type { ArtistCard as ArtistCardType } from './types'

interface ArtistCardProps {
  artist: ArtistCardType
  onClick: (rect: DOMRect) => void
}

/**
 * Artist tile card - click to open gatefold
 * Simple clickable tile that triggers the gatefold overlay
 */
export function ArtistCard({ artist, onClick }: ArtistCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleClick = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      onClick(rect)
    }
  }

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      ref={cardRef}
      className="relative w-[200px] h-[200px]"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`View ${artist.name} concert history`}
      aria-haspopup="dialog"
    >
      <ArtistCardFront
        artistName={artist.name}
        albumCover={artist.albumCover}
        genre={artist.primaryGenre}
      />
    </div>
  )
}
