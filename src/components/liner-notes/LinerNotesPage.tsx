/**
 * LinerNotesPage — blog feed at /liner-notes
 * Reads public/data/liner-notes.json and renders a filterable post feed
 * Spec: docs/specs/future/liner-notes-design-mocks.md (#61)
 */

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rss, X } from 'lucide-react'
import type { LinerNotesPost, LinerNotesData, PostCategory } from '../../types/liner-notes'
import { LinerNoteCard } from './LinerNoteCard'
import { CategoryFilterChips } from './CategoryFilterChips'
import { PageNav } from './PageNav'
import { setLastSeenChangelog } from '../../utils/changelogStorage'

const INITIAL_VISIBLE = 10
const LOAD_MORE_COUNT = 10

type ActiveCategory = PostCategory | 'all'

/** Humanize a normalized slug: "howard-jones" → "Howard Jones" */
function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function LinerNotesPage() {
  const headerRef = useRef<HTMLHeadingElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-driven filters (#66)
  const artistParam = searchParams.get('artist')
  const venueParam = searchParams.get('venue')

  const [posts, setPosts] = useState<LinerNotesPost[]>([])
  const [totalPosts, setTotalPosts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('all')
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  useEffect(() => {
    fetch('/data/liner-notes.json')
      .then((res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then((data: LinerNotesData) => {
        if (!data.posts || data.posts.length === 0) {
          setEmpty(true)
        } else {
          setPosts(data.posts)
          setTotalPosts(data.metadata?.totalPosts ?? data.posts.length)
        }
        setLoading(false)
        setLastSeenChangelog()
        setTimeout(() => headerRef.current?.focus(), 100)
      })
      .catch(() => {
        setEmpty(true)
        setLoading(false)
      })
  }, [])

  const filtered = posts.filter((p) => {
    if (activeCategory !== 'all' && p.category !== activeCategory) return false
    // Exclude aggregate posts from artist/venue URL filters (#66)
    if ((artistParam || venueParam) && p.aggregate) return false
    if (artistParam && !p.artists.includes(artistParam)) return false
    if (venueParam && !p.venues.includes(venueParam)) return false
    return true
  })

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleCategoryChange = (cat: ActiveCategory) => {
    setActiveCategory(cat)
    setVisibleCount(INITIAL_VISIBLE)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#fafaf9' }}>
        <p className="font-sans text-sm text-gray-400 animate-pulse">Loading liner notes...</p>
      </div>
    )
  }

  if (empty) {
    return (
      <main className="h-screen overflow-y-auto" style={{ background: '#fafaf9' }}>
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-10">
          <PageNav current="liner-notes" theme="light" />
          <h1
            className="mb-3"
            style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: '#1f2937' }}
          >
            Liner Notes
          </h1>
          <p className="font-sans text-gray-500 mb-12" style={{ fontSize: 'clamp(14px, 2vw, 18px)' }}>
            Stories from 42 years of live music
          </p>
          <p className="font-sans text-gray-500 leading-relaxed">
            Liner notes coming soon — the first stories from 42 years of live music are on their way.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-y-auto" style={{ background: '#fafaf9' }}>
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-10">

        <PageNav current="liner-notes" theme="light" />

        {/* Page header */}
        <header className="mb-8">
          {/* Indigo accent bar — ties to app primary color */}
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#4f46e5',
              marginBottom: 16,
            }}
          />
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
            Liner Notes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="font-sans text-gray-500"
            style={{ fontSize: 'clamp(15px, 2vw, 18px)' }}
          >
            Stories from 42 years of live music
          </motion.p>
        </header>

        {/* Active artist/venue filter chips (#66) */}
        {(artistParam || venueParam) && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {artistParam && (
              <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium px-3 py-1 rounded-full"
                style={{ background: 'rgba(79,70,229,0.08)', color: '#4f46e5', border: '1px solid rgba(79,70,229,0.2)' }}>
                Artist: {slugToLabel(artistParam)}
                <button
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.delete('artist')
                    setSearchParams(next)
                  }}
                  aria-label={`Remove artist filter: ${slugToLabel(artistParam)}`}
                  className="hover:opacity-70 transition-opacity"
                  style={{ lineHeight: 1 }}
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {venueParam && (
              <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium px-3 py-1 rounded-full"
                style={{ background: 'rgba(79,70,229,0.08)', color: '#4f46e5', border: '1px solid rgba(79,70,229,0.2)' }}>
                Venue: {slugToLabel(venueParam)}
                <button
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.delete('venue')
                    setSearchParams(next)
                  }}
                  aria-label={`Remove venue filter: ${slugToLabel(venueParam)}`}
                  className="hover:opacity-70 transition-opacity"
                  style={{ lineHeight: 1 }}
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Filter row + meta — horizontal across top */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <CategoryFilterChips active={activeCategory} onChange={handleCategoryChange} />

          <div className="flex items-center gap-4 flex-shrink-0">
            <p className="font-sans text-xs text-gray-400">
              {filtered.length} {filtered.length === 1 ? 'story' : 'stories'}
              {(activeCategory !== 'all' || artistParam || venueParam) ? ' matching filter' : ` · ${totalPosts} total`}
              {' · Updated weekly'}
            </p>
            <a
              href="/liner-notes.xml"
              className="flex items-center gap-1.5 font-sans text-xs text-gray-400 hover:text-indigo-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="RSS feed"
            >
              <Rss className="w-3.5 h-3.5" />
              RSS
            </a>
          </div>
        </div>

        {/* Post feed */}
        {visible.length === 0 ? (
          <p className="font-sans text-sm text-gray-500 py-8 text-center">
            No posts match the current filter.
          </p>
        ) : (
          <section aria-label="Liner notes posts">
            {visible.map((post, i) => (
              <LinerNoteCard
                key={post.id}
                post={post}
                index={i}
              />
            ))}
          </section>
        )}

        {hasMore && (
          <div className="flex justify-center mt-2 mb-8">
            <button
              onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
              className="font-sans text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors border border-gray-300 hover:border-indigo-400 rounded-lg px-6"
              style={{ minHeight: 44 }}
            >
              Show More
            </button>
          </div>
        )}

      </div>
    </main>
  )
}
