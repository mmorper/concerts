import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { PARALLAX, FALLBACK, LAYOUT } from './constants'
import type { TimelineHoverContentProps } from './types'

/**
 * Content component for the timeline hover preview
 *
 * Displays artist name, year, concert count, and artist image with parallax effect
 *
 * @param props - Component props
 * @returns React component
 */
export function TimelineHoverContent({
  artistName,
  year,
  concertCount,
  imageUrl,
}: TimelineHoverContentProps) {
  const [localMousePosition, setLocalMousePosition] = useState({ x: 0, y: 0 })

  /**
   * Track mouse position relative to the popup for parallax effect
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!PARALLAX.ENABLED) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2

    setLocalMousePosition({ x, y })
  }, [])

  /**
   * Calculate parallax shift based on mouse position
   */
  const parallaxX = PARALLAX.ENABLED
    ? (localMousePosition.x / (LAYOUT.WIDTH / 2)) * PARALLAX.MAX_SHIFT_X
    : 0
  const parallaxY = PARALLAX.ENABLED
    ? (localMousePosition.y / (LAYOUT.HEIGHT / 2)) * PARALLAX.MAX_SHIFT_Y
    : 0

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-white rounded-lg shadow-2xl"
      onMouseMove={handleMouseMove}
    >
      {/* Background image with parallax */}
      <div className="absolute inset-0">
        {imageUrl ? (
          <motion.img
            src={imageUrl}
            alt={artistName}
            className="w-full h-full object-cover"
            animate={{
              x: parallaxX,
              y: parallaxY,
            }}
            transition={{
              duration: PARALLAX.ENABLED ? 0.2 : 0,
              ease: 'easeOut',
            }}
          />
        ) : (
          // Fallback gradient when no image is available
          <motion.div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${FALLBACK.GRADIENT_START} 0%, ${FALLBACK.GRADIENT_END} 100%)`,
            }}
            animate={{
              x: parallaxX,
              y: parallaxY,
            }}
            transition={{
              duration: PARALLAX.ENABLED ? 0.2 : 0,
              ease: 'easeOut',
            }}
          />
        )}
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4">
        <div className="text-white">
          {/* Artist name */}
          <h3 className="font-serif text-xl font-semibold mb-1 leading-tight">
            {artistName}
          </h3>

          {/* Year and concert count */}
          <div className="font-sans text-sm text-white/90 flex items-center gap-2">
            <span className="font-medium">{year}</span>
            <span className="text-white/60">•</span>
            <span>
              {concertCount} concert{concertCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
