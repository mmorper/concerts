/**
 * ChangelogCard Component
 *
 * Individual feature card with gatefold aesthetic and deep linking
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { ChangelogCardProps } from './types'

export function ChangelogCard({ release, isLatest = false }: ChangelogCardProps) {
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)

  const handleNavigate = () => {
    // Navigate to the deep link route
    navigate(release.route)
  }

  // Format the date for display
  const formattedDate = new Date(release.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative bg-zinc-950 rounded-2xl p-8 mx-4 lg:mx-0
        border-2 transition-all duration-300
        ${isHovered ? 'border-amber-500 shadow-xl shadow-amber-500/20' : 'border-slate-700'}
      `}
    >
      {/* Latest badge */}
      {isLatest && (
        <div className="absolute top-4 right-4 bg-amber-600 text-white px-3 py-1 rounded-full text-sm font-medium">
          Latest
        </div>
      )}

      {/* Title */}
      <h2 className="text-2xl font-semibold text-white mb-3">
        {release.title}
      </h2>

      {/* Date */}
      <time dateTime={release.date} className="text-slate-400 text-sm mb-4 block">
        {formattedDate}
      </time>

      {/* Description */}
      <p className="text-slate-300 text-lg mb-8 leading-relaxed">
        {release.description}
      </p>

      {/* Highlights */}
      <ul className="space-y-2 mb-6">
        {release.highlights.map((highlight, index) => (
          <li key={index} className="flex items-center gap-2 text-slate-400">
            <span className="text-amber-500">•</span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={handleNavigate}
        className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg transition-colors font-medium min-h-[44px]"
        aria-label={`Navigate to ${release.title} feature`}
      >
        See it live →
      </button>
    </motion.article>
  )
}
