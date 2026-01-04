import { useState } from 'react'
import { getGenreColor } from '../../../constants/colors'
import { ArtistPlaceholder } from './ArtistPlaceholder'

interface ArtistCardFrontProps {
  artistName: string
  albumCover?: string
  genre: string
  getArtistImage: (artistName: string) => string | undefined
  artistImageLoading: boolean
}

/**
 * Front of the artist card - displays album cover or placeholder
 * Uniform size: 240px
 */
export function ArtistCardFront({
  artistName,
  albumCover,
  genre,
  getArtistImage,
  artistImageLoading
}: ArtistCardFrontProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const genreColor = getGenreColor(genre)

  // Unified image sourcing strategy: artist photo → album cover → placeholder
  const artistImage = artistImageLoading ? undefined : getArtistImage(artistName)
  const imageUrl = artistImage || albumCover
  const altText = artistImage
    ? `${artistName} artist photo`
    : albumCover
      ? `${artistName} album cover`
      : undefined

  // Uniform size: 200px (will expand to 480px 2×2 grid when flipped)
  const dimension = 'w-[200px] h-[200px]'

  return (
    <div
      className={`${dimension} relative overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-[1.02]`}
      style={{
        border: `2px solid ${genreColor}`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      {imageUrl ? (
        <>
          {/* Show placeholder while image loads */}
          {!imageLoaded && (
            <div className="absolute inset-0">
              <ArtistPlaceholder artistName={artistName} genre={genre} />
            </div>
          )}
          <img
            src={imageUrl}
            alt={altText}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        </>
      ) : (
        <ArtistPlaceholder artistName={artistName} genre={genre} />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors duration-200 pointer-events-none" />
    </div>
  )
}
