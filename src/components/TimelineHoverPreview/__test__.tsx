/**
 * Test component for Timeline Hover Preview
 *
 * This file can be temporarily imported in the app to verify
 * that data loading and basic rendering work correctly.
 *
 * Usage: Import in App.tsx or Scene1Hero.tsx during development
 */

import { useArtistMetadata } from './useArtistMetadata'
import { TimelineHoverContent } from './TimelineHoverContent'

export function TimelineHoverPreviewTest() {
  const { loading, error, getArtistImage, getArtistMetadata } = useArtistMetadata()

  if (loading) {
    return <div className="p-4">Loading artist metadata...</div>
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error.message}</div>
  }

  // Test with a few known artists
  const testArtists = [
    { name: 'The Cure', year: 1989, count: 2, venue: 'Irvine Meadows' },
    { name: 'Depeche Mode', year: 1990, count: 1, venue: 'Dodger Stadium' },
    { name: 'U2', year: 1992, count: 1, venue: 'The Forum' },
  ]

  return (
    <div className="p-8 space-y-8 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Timeline Hover Preview Test</h1>

      <div className="space-y-4">
        {testArtists.map((artist) => {
          const metadata = getArtistMetadata(artist.name)
          const imageUrl = getArtistImage(artist.name)

          return (
            <div key={artist.name} className="bg-white p-4 rounded shadow">
              <h2 className="font-semibold mb-2">{artist.name}</h2>
              <p className="text-sm text-gray-600 mb-2">
                Metadata: {metadata ? 'Found' : 'Not found'}
                {metadata && ` (${metadata.dataSource})`}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Image: {imageUrl ? 'Available' : 'No image'}
              </p>

              {/* Preview component */}
              <div style={{ width: 320, height: 180 }}>
                <TimelineHoverContent
                  artistName={artist.name}
                  year={artist.year}
                  concertCount={artist.count}
                  venue={artist.venue}
                  imageUrl={imageUrl}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
