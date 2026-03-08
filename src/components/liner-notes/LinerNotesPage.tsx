/**
 * LinerNotesPage — blog feed at /liner-notes
 * Reads public/data/liner-notes.json and renders a filterable post feed
 * Spec: docs/specs/future/liner-notes-design-mocks.md (#61)
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Rss } from 'lucide-react'
import type { LinerNotesPost, LinerNotesData, PostCategory } from '../../types/liner-notes'
import { LinerNoteCard } from './LinerNoteCard'
import { CategoryFilterChips } from './CategoryFilterChips'
import { TagFilterRow } from './TagFilterRow'
import { setLastSeenChangelog } from '../../utils/changelogStorage'

const INITIAL_VISIBLE = 10
const LOAD_MORE_COUNT = 10

type ActiveCategory = PostCategory | 'all'

export function LinerNotesPage() {
  const navigate = useNavigate()
  const headerRef = useRef<HTMLHeadingElement>(null)

  const [posts, setPosts] = useState<LinerNotesPost[]>([])
  const [totalPosts, setTotalPosts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
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
        // Graceful empty state — not an error
        setEmpty(true)
        setLoading(false)
      })
  }, [])

  // Derive unique tags from all posts
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort()

  // Filter posts
  const filtered = posts.filter((p) => {
    const categoryMatch = activeCategory === 'all' || p.category === activeCategory
    const tagMatch = activeTag === null || p.tags.includes(activeTag)
    return categoryMatch && tagMatch
  })

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const handleCategoryChange = (cat: ActiveCategory) => {
    setActiveCategory(cat)
    setActiveTag(null)
    setVisibleCount(INITIAL_VISIBLE)
  }

  const handleTagClick = (tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag))
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
        <div className="max-w-3xl mx-auto" style={{ padding: 'clamp(32px, 6vw, 48px) clamp(16px, 4vw, 24px)' }}>
          <nav className="mb-8">
            <button
              onClick={() => navigate('/')}
              className="font-sans text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Archive
            </button>
          </nav>
          <h1
            className="mb-3"
            style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 36px)', fontWeight: 700, color: '#1f2937' }}
          >
            Liner Notes
          </h1>
          <p className="font-sans text-gray-500 mb-12" style={{ fontSize: 'clamp(14px, 2vw, 16px)' }}>
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
      <div
        className="max-w-3xl mx-auto"
        style={{ padding: 'clamp(32px, 6vw, 48px) clamp(16px, 4vw, 24px)' }}
      >
        {/* Nav */}
        <nav className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="font-sans text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Archive
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/about')}
              className="font-sans text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              About
            </button>
            <button
              onClick={() => navigate('/whats-playing')}
              className="font-sans text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              What&apos;s Playing
            </button>
          </div>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <motion.h1
            ref={headerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="outline-none mb-2"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(28px, 5vw, 36px)',
              fontWeight: 700,
              color: '#1f2937',
            }}
          >
            Liner Notes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-sans text-gray-500"
            style={{ fontSize: 'clamp(14px, 2vw, 16px)' }}
          >
            Stories from 42 years of live music
          </motion.p>
        </header>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mb-4"
        >
          <CategoryFilterChips active={activeCategory} onChange={handleCategoryChange} />
        </motion.div>

        {allTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mb-6"
          >
            <TagFilterRow tags={allTags} activeTag={activeTag} onTagClick={handleTagClick} />
          </motion.div>
        )}

        {/* Post count */}
        <p className="font-sans text-xs text-gray-400 mb-6">
          {totalPosts} liner {totalPosts === 1 ? 'note' : 'notes'} · Updated weekly
        </p>

        {/* Post cards */}
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
                onTagClick={handleTagClick}
              />
            ))}
          </section>
        )}

        {/* Show More */}
        {hasMore && (
          <div className="flex justify-center mt-4 mb-8">
            <button
              onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
              className="font-sans text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-300 hover:border-gray-400 rounded-lg px-6"
              style={{ minHeight: 44 }}
            >
              Show More
            </button>
          </div>
        )}

        {/* RSS footer */}
        <div className="border-t border-gray-200 mt-8 pt-8 flex items-center gap-2">
          <Rss className="w-4 h-4 text-gray-400" />
          <a
            href="/liner-notes.xml"
            className="font-sans text-sm text-gray-400 hover:text-gray-700 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Subscribe to new liner notes via RSS
          </a>
        </div>
      </div>
    </main>
  )
}
