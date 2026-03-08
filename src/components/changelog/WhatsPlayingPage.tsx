/**
 * WhatsPlayingPage — app changelog at /whats-playing
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rss } from 'lucide-react'
import { ChangelogCard } from './ChangelogCard'
import { setLastSeenChangelog } from '../../utils/changelogStorage'
import { PageNav } from '../liner-notes/PageNav'
import type { Release } from './types'

export function WhatsPlayingPage() {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLHeadingElement>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    import('../../data/changelog.json')
      .then((changelogData) => {
        setReleases(changelogData.releases || [])
        setLoading(false)
        setLastSeenChangelog()
        setTimeout(() => headerRef.current?.focus(), 100)
      })
      .catch((err) => {
        console.error('Failed to load changelog:', err)
        setError('Failed to load data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <p className="text-slate-400 animate-pulse">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="text-slate-300 hover:text-white transition-colors text-sm"
          >
            ← Back to Archive
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="h-screen bg-black text-white overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-20 py-10">

        <PageNav current="whats-playing" theme="dark" />

        {/* Page header */}
        <header className="mb-12" role="banner">
          <motion.h1
            ref={headerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl lg:text-6xl font-display text-amber-400 mb-3 outline-none"
          >
            What&apos;s Playing
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-slate-400 text-lg"
          >
            App updates and new features
          </motion.p>
        </header>

        {/* Release History Cards */}
        <section id="releases" aria-label="Release history">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
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
                transition: { staggerChildren: 0.1 },
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

        {/* RSS + version — fixed bottom-right on desktop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="fixed bottom-8 right-8 hidden md:block"
        >
          <div className="flex flex-col items-end gap-1">
            <a
              href="/liner-notes.xml"
              className="text-slate-600 hover:text-indigo-400 text-xs flex items-center gap-1.5 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe via RSS"
            >
              <Rss className="w-3.5 h-3.5" />
              RSS
            </a>
            {releases.length > 0 && (
              <span className="text-slate-600 text-xs">v{releases[0].version}</span>
            )}
          </div>
        </motion.div>

      </div>
    </main>
  )
}
