/**
 * Changelog Page Component
 *
 * Full-page view of all changelog entries with "What's Playing" branding
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChangelogCard } from './ChangelogCard'
import { setLastSeenChangelog } from '../../utils/changelogStorage'
import type { Release } from './types'

export function ChangelogPage() {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLHeadingElement>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load changelog data
    import('../../data/changelog.json')
      .then((data) => {
        setReleases(data.releases || [])
        setLoading(false)

        // Mark changelog as seen (update localStorage timestamp)
        setLastSeenChangelog()

        // Focus header for accessibility
        setTimeout(() => {
          headerRef.current?.focus()
        }, 100)
      })
      .catch((err) => {
        console.error('Failed to load changelog:', err)
        setError('Failed to load changelog data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 animate-pulse">Loading changelog...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white transition-colors"
          >
            ← Back to Timeline
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (releases.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-display text-amber-400 mb-4">
            What's Playing
          </h1>
          <p className="text-slate-400 mb-8">No updates yet. Check back soon!</p>
          <button
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white transition-colors"
          >
            ← Back to Timeline
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white overflow-y-auto h-screen">
      <div className="max-w-7xl mx-auto px-6 lg:px-20 py-12">
        {/* Header */}
        <header className="mb-12" role="banner">
          <button
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white transition-colors mb-8 flex items-center gap-2"
          >
            <span>←</span>
            <span>Back to Timeline</span>
          </button>

          <motion.h1
            ref={headerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl lg:text-6xl font-display text-amber-400 mb-3 outline-none"
          >
            What's Playing
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-slate-400 text-lg"
          >
            The setlist of new features
          </motion.p>
        </header>

        {/* Cards Grid */}
        <section aria-label="Changelog entries">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {releases.map((release, index) => (
              <ChangelogCard
                key={release.version}
                release={release}
                isLatest={index === 0}
              />
            ))}
          </motion.div>
        </section>

        {/* RSS Link & Version - Lower Right Corner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="fixed bottom-8 right-8 hidden md:block"
        >
          <div className="flex flex-col items-end gap-1">
            <a
              href="/changelog/rss"
              className="text-slate-600 hover:text-slate-400 text-xs flex items-center gap-1.5 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe to changelog via RSS"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z" />
                <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z" />
              </svg>
              RSS
            </a>
            {releases.length > 0 && (
              <span className="text-slate-600 text-xs">
                v{releases[0].version}
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </main>
  )
}
