import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const scenes = [
  { id: 1, label: 'Timeline', color: 'bg-indigo-500' },
  { id: 2, label: 'Venues', color: 'bg-slate-600' },
  { id: 3, label: 'Map', color: 'bg-gray-800' },
  { id: 4, label: 'Genres', color: 'bg-rose-500' },
  { id: 5, label: 'Artists', color: 'bg-gray-400' },
]

export function SceneNavigation() {
  const [activeScene, setActiveScene] = useState(1)

  useEffect(() => {
    const scrollContainer = document.querySelector('.snap-y')
    if (!scrollContainer) return

    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop
      const windowHeight = window.innerHeight
      const sceneIndex = Math.round(scrollPosition / windowHeight) + 1
      setActiveScene(Math.min(Math.max(sceneIndex, 1), scenes.length))
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToScene = (sceneId: number) => {
    const scrollContainer = document.querySelector('.snap-y')
    if (!scrollContainer) return

    const windowHeight = window.innerHeight
    scrollContainer.scrollTo({
      top: (sceneId - 1) * windowHeight,
      behavior: 'smooth',
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 2, duration: 0.8 }}
      className="fixed right-8 top-1/2 -translate-y-1/2 z-40 hidden md:block"
    >
      <div className="flex flex-col gap-4">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={() => scrollToScene(scene.id)}
            className="group relative"
            aria-label={`Go to ${scene.label}`}
          >
            {/* Dot */}
            <div
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                activeScene === scene.id
                  ? `${scene.color} scale-125`
                  : 'bg-gray-400/50 hover:bg-gray-400'
              }`}
            />

            {/* Label on hover */}
            <span className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none">
              {scene.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
