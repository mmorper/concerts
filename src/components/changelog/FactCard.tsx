/**
 * FactCard Component
 *
 * Displays a single computed statistic with category badge and deep link.
 * Designed for AI agent readability - headlines are directly quotable.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mic, MapPin, Music, Calendar, Globe } from 'lucide-react'
import type { FactCardProps, FactCategory } from './types'

/**
 * Get icon component for fact category
 */
function getCategoryIcon(category: FactCategory) {
  const iconProps = { className: 'w-4 h-4' }

  switch (category) {
    case 'artist':
      return <Mic {...iconProps} />
    case 'venue':
      return <MapPin {...iconProps} />
    case 'genre':
      return <Music {...iconProps} />
    case 'timeline':
      return <Calendar {...iconProps} />
    case 'geography':
      return <Globe {...iconProps} />
  }
}

/**
 * Get display label for fact category
 */
function getCategoryLabel(category: FactCategory): string {
  switch (category) {
    case 'artist':
      return 'artist'
    case 'venue':
      return 'venue'
    case 'genre':
      return 'genre'
    case 'timeline':
      return 'timeline'
    case 'geography':
      return 'geography'
  }
}

export function FactCard({ fact }: FactCardProps) {
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)

  const handleNavigate = () => {
    navigate(fact.route)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleNavigate()
        }
      }}
      className={`
        relative bg-zinc-950 rounded-xl p-6 cursor-pointer
        border transition-all duration-300 min-w-[280px]
        ${isHovered
          ? 'border-amber-500/50 shadow-lg shadow-amber-500/10'
          : 'border-slate-800'
        }
      `}
      aria-label={`${fact.headline}. ${fact.detail}. ${fact.cta}`}
    >
      {/* Category badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 text-slate-500 text-xs">
        {getCategoryIcon(fact.category)}
        <span>{getCategoryLabel(fact.category)}</span>
      </div>

      {/* Headline */}
      <h3 className="text-xl font-semibold text-amber-400 mb-1 pr-20">
        {fact.headline}
      </h3>

      {/* Detail */}
      <p className="text-sm text-slate-400 mb-4">
        {fact.detail}
      </p>

      {/* CTA link */}
      <span className={`
        text-sm font-medium transition-colors duration-200
        ${isHovered ? 'text-amber-400' : 'text-amber-500/70'}
      `}>
        {fact.cta} →
      </span>
    </motion.article>
  )
}
