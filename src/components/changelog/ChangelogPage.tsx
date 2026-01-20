/**
 * Changelog Page Component
 *
 * Full-page view of all changelog entries with "What's Playing" branding
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Rss } from 'lucide-react'
import { ChangelogCard } from './ChangelogCard'
import { FactCard } from './FactCard'
import { setLastSeenChangelog } from '../../utils/changelogStorage'
import type { Release, Fact, FactsData } from './types'

/** Number of fact cards to display (spec: 12-15) */
const FACTS_TO_DISPLAY = 12

export function ChangelogPage() {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLHeadingElement>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [facts, setFacts] = useState<Fact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load changelog and facts data in parallel
    Promise.all([
      import('../../data/changelog.json'),
      fetch('/data/facts.json').then((res) => res.ok ? res.json() : null),
    ])
      .then(([changelogData, factsData]) => {
        setReleases(changelogData.releases || [])

        // Load facts if available (sorted by priority, top N)
        if (factsData?.facts) {
          const sortedFacts = (factsData as FactsData).facts
            .sort((a, b) => a.priority - b.priority)
            .slice(0, FACTS_TO_DISPLAY)
          setFacts(sortedFacts)
        }

        setLoading(false)

        // Mark changelog as seen (update localStorage timestamp)
        setLastSeenChangelog()

        // Focus header for accessibility
        setTimeout(() => {
          headerRef.current?.focus()
        }, 100)
      })
      .catch((err) => {
        console.error('Failed to load data:', err)
        setError('Failed to load data')
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
            className="text-slate-300 hover:text-white transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Timeline
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
            Liner Notes
          </h1>
          <p className="text-slate-400 mb-8">No updates yet. Check back soon!</p>
          <button
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Timeline
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
          <nav className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/')}
              className="text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Timeline</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => navigate('/about')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              About
            </button>
          </nav>

          <motion.h1
            ref={headerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl lg:text-6xl font-display text-amber-400 mb-3 outline-none"
          >
            Liner Notes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-slate-400 text-lg"
          >
            What's new in the archives
          </motion.p>
        </header>

        {/* By the Numbers - Fact Cards */}
        {facts.length > 0 && (
          <section aria-label="Archive statistics" className="mb-16">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xs uppercase tracking-widest text-slate-500 font-medium mb-6"
            >
              By the Numbers
            </motion.h2>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.08,
                  },
                },
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {facts.map((fact) => (
                <FactCard key={fact.id} fact={fact} />
              ))}
            </motion.div>
          </section>
        )}

        {/* Release History Cards */}
        <section aria-label="Release history">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-xs uppercase tracking-widest text-slate-500 font-medium mb-6"
          >
            Release History
          </motion.h2>
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
              href="/liner-notes/rss"
              className="text-slate-600 hover:text-slate-400 text-xs flex items-center gap-1.5 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe to liner notes via RSS"
            >
              <Rss className="w-3.5 h-3.5" />
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
