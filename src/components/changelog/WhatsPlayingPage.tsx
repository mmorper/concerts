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
      <div className="h-screen flex items-center justify-center" style={{ background: '#fafaf9' }}>
        <p className="font-sans text-sm text-gray-400 animate-pulse">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#fafaf9' }}>
        <div className="text-center">
          <p className="font-sans text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="font-sans text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back to Archive
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="h-screen overflow-y-auto" style={{ background: '#fafaf9' }}>
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-10">

        <PageNav current="whats-playing" theme="light" />

        {/* Page header */}
        <header className="mb-8" role="banner">
          {/* Indigo accent bar — matches Liner Notes */}
          <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#4f46e5', marginBottom: 16 }} />
          <motion.h1
            ref={headerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="outline-none mb-2"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 700,
              color: '#1f2937',
              lineHeight: 1.15,
            }}
          >
            What&apos;s Playing
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="font-sans text-gray-500"
            style={{ fontSize: 'clamp(15px, 2vw, 18px)' }}
          >
            App updates and new features
          </motion.p>
        </header>

        {/* Release list */}
        <section id="releases" aria-label="Release history">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.08 } },
            }}
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
              className="flex items-center gap-1.5 font-sans text-xs text-gray-400 hover:text-indigo-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe via RSS"
            >
              <Rss className="w-3.5 h-3.5" />
              RSS
            </a>
            {releases.length > 0 && (
              <span className="font-sans text-xs text-gray-400">v{releases[0].version}</span>
            )}
          </div>
        </motion.div>

      </div>
    </main>
  )
}
