import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Concert } from '../../types/concert'

interface Scene2VenuesProps {
  concerts: Concert[]
}

export function Scene2Venues({ concerts }: Scene2VenuesProps) {
  // Calculate top artists
  const topArtists = useMemo(() => {
    const artistCounts = new Map<string, { name: string; genre: string; count: number }>()

    concerts.forEach(concert => {
      const key = concert.headliner
      const existing = artistCounts.get(key)
      if (existing) {
        existing.count++
      } else {
        artistCounts.set(key, {
          name: concert.headliner,
          genre: concert.genre,
          count: 1,
        })
      }
    })

    return Array.from(artistCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  }, [concerts])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
      className="min-h-screen flex flex-col items-center justify-center bg-stone-50 py-20 snap-start snap-always"
    >
      <div className="max-w-7xl w-full px-8">
        {/* Title */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-light text-gray-900 mb-4 tracking-tight">
            The Artists
          </h2>
          <p className="text-lg text-gray-600">
            305 bands and musicians across 42 years
          </p>
        </motion.div>

        {/* Artist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {topArtists.map((artist, index) => (
            <motion.div
              key={artist.name}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: false }}
              transition={{ duration: 0.4, delay: index * 0.03 }}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-lg transition-all"
            >
              <div className="flex items-baseline gap-3 mb-2">
                <div className="text-3xl font-light text-indigo-600">
                  {artist.count}
                </div>
                <div className="text-xs text-gray-500">×</div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1 leading-tight">
                {artist.name}
              </h3>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {artist.genre}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center mt-16 text-gray-500 text-sm"
        >
          <p>
            Top {topArtists.length} most-seen artists
          </p>
        </motion.div>
      </div>
    </motion.section>
  )
}
