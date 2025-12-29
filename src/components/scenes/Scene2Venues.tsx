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
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-purple-950 py-20 snap-start snap-always"
    >
      <div className="max-w-7xl w-full px-8">
        {/* Title */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-5xl md:text-7xl text-white mb-4 tracking-tight">
            The Artists
          </h2>
          <p className="font-sans text-lg md:text-xl text-gray-400">
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
              className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 hover:border-indigo-400 hover:bg-white/20 transition-all duration-200"
            >
              <div className="flex items-baseline gap-3 mb-2">
                <div className="font-serif text-3xl text-indigo-300">
                  {artist.count}
                </div>
                <div className="font-sans text-xs text-gray-400">×</div>
              </div>
              <h3 className="font-sans text-lg font-semibold text-white mb-1 leading-tight">
                {artist.name}
              </h3>
              <p className="font-sans text-xs text-gray-400 uppercase tracking-widest">
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
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mt-8 font-sans text-gray-400 text-xs font-medium tracking-widest uppercase"
        >
          <p>
            Top {topArtists.length} most-seen artists
          </p>
        </motion.div>
      </div>
    </motion.section>
  )
}
