import { useEffect, useState } from 'react'
import type { ConcertData } from './types/concert'
import { Scene1Hero } from './components/scenes/Scene1Hero'
import { Scene2Venues } from './components/scenes/Scene2Venues'
import { Scene3Map } from './components/scenes/Scene3Map'
import { Scene4Bands } from './components/scenes/Scene4Bands'
import { Scene5Genres } from './components/scenes/Scene5Genres'
import { SceneNavigation } from './components/SceneNavigation'

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Spinning loader */}
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600 font-light text-sm tracking-wide animate-pulse">
            Loading concert archive...
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">Failed to load concert data</p>
          <p className="text-gray-500">Please check the console for errors</p>
        </div>
      </div>
    )
  }

  const concerts = data.concerts

  return (
    <>
      <div className="relative snap-y snap-mandatory h-screen overflow-y-scroll">
        {/* Scene 1: Hero/Timeline */}
        <Scene1Hero concerts={concerts} />

        {/* Scene 2: Venues (force-directed graph) */}
        <Scene4Bands concerts={concerts} />

        {/* Scene 3: Map */}
        <Scene3Map concerts={concerts} />

        {/* Scene 4: Genres (sunburst) */}
        <Scene5Genres concerts={concerts} />

        {/* Scene 5: Artist List */}
        <Scene2Venues concerts={concerts} />
      </div>

      {/* Scene Navigation */}
      <SceneNavigation />
    </>
  )
}

export default App
