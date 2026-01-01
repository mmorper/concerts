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
  const [revealedLabel, setRevealedLabel] = useState<number | null>(null)

  useEffect(() => {
    const scrollContainer = document.querySelector('.snap-y')
    if (!scrollContainer) return

    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop
      const windowHeight = window.innerHeight
      const sceneIndex = Math.round(scrollPosition / windowHeight) + 1
      setActiveScene(Math.min(Math.max(sceneIndex, 1), scenes.length))

      // Dismiss label on scroll
      setRevealedLabel(null)
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-dismiss label after 3 seconds
  useEffect(() => {
    if (revealedLabel === null) return

    const timeout = setTimeout(() => {
      setRevealedLabel(null)
    }, 3000)

    return () => clearTimeout(timeout)
  }, [revealedLabel])

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
      <div className="flex flex-col gap-3">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={(e) => {
              // Toggle label on tap, navigate on second tap or when label already shown
              if (revealedLabel === scene.id) {
                scrollToScene(scene.id)
                setRevealedLabel(null)
              } else {
                e.stopPropagation()
                setRevealedLabel(scene.id)
              }
            }}
            className="group relative flex items-center justify-center min-w-[44px] min-h-[44px]"
            aria-label={`Go to ${scene.label}`}
          >
            {/* Dot - visually smaller but larger touch target */}
            <motion.div
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                activeScene === scene.id
                  ? `${scene.color} scale-125`
                  : 'bg-gray-400/50 group-hover:bg-gray-400 group-active:bg-gray-400'
              }`}
              animate={revealedLabel === scene.id ? { scale: 1.3 } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            />

            {/* Label on tap or hover */}
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{
                opacity: revealedLabel === scene.id ? 1 : 0,
                x: revealedLabel === scene.id ? 0 : 10
              }}
              transition={{ duration: 0.2 }}
              className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none"
            >
              {scene.label}
            </motion.span>

            {/* Also show on desktop hover */}
            <span className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none hidden md:block">
              {scene.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
