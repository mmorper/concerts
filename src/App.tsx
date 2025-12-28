import { useEffect, useState } from 'react'
import type { ConcertData } from './types/concert'
import { useConcertData } from './hooks/useConcertData'
import { FilterBar } from './components/filters/FilterBar'
import { TimelineContainer } from './components/timeline/TimelineContainer'

function App() {
  const [data, setData] = useState<ConcertData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/data/concerts.json')
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load concert data:', err)
        setLoading(false)
      })
  }, [])

  const {
    filteredConcerts,
    uniqueArtists,
    uniqueGenres,
    uniqueVenues,
    uniqueCities,
    yearRange,
    stats,
  } = useConcertData(data)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-mono text-sm uppercase tracking-wider">
            Loading your concert history...
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="text-xl font-semibold mb-2">Failed to load concert data</p>
          <p className="text-gray-500">Please check the console for errors</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-display uppercase tracking-wider text-purple-400">
            Morperhaus
          </h1>
          <p className="text-sm font-mono uppercase tracking-widest text-gray-400 mt-1">
            Concert Archives
          </p>
          <div className="flex gap-4 mt-3 text-sm text-gray-500">
            <span>{stats.filtered} Shows</span>
            <span>·</span>
            <span>{stats.artists} Artists</span>
            <span>·</span>
            <span>{stats.venues} Venues</span>
            <span>·</span>
            <span>{stats.cities} Cities</span>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar
        uniqueArtists={uniqueArtists}
        uniqueGenres={uniqueGenres}
        uniqueVenues={uniqueVenues}
        uniqueCities={uniqueCities}
        yearRange={yearRange}
        filteredCount={stats.filtered}
        totalCount={stats.total}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <TimelineContainer concerts={filteredConcerts} />
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-800 text-center text-gray-500 text-sm">
        <p>Built with love for live music 🎸</p>
      </footer>
    </div>
  )
}

export default App
