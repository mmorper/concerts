/**
 * LinerNotePermalink — single post view at /liner-notes/:slug
 * Spec: docs/specs/future/liner-notes-design-mocks.md (#62)
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import type { LinerNotesPost, LinerNotesData } from '../../types/liner-notes'
import { CATEGORY_ACCENT_COLORS, CATEGORY_LABELS } from './constants'
import { LinerNoteMiniPlayer } from './LinerNoteMiniPlayer'

const SITE_URL = 'https://concerts.morperhaus.org'
const RELATED_THRESHOLD = 30

export function LinerNotePermalink() {
  const { slug } = useParams<{ slug: string }>()

  const [post, setPost] = useState<LinerNotesPost | null>(null)
  const [related, setRelated] = useState<LinerNotesPost[]>([])
  const [totalPosts, setTotalPosts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch('/data/liner-notes.json')
      .then((res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then((data: LinerNotesData) => {
        const found = data.posts.find((p) => p.slug === slug) ?? null
        if (!found) {
          setNotFound(true)
        } else {
          setPost(found)
          setTotalPosts(data.posts.length)
          const relatedPosts = found.relatedSlugs
            .map((s) => data.posts.find((p) => p.slug === s))
            .filter((p): p is LinerNotesPost => p !== undefined)
          setRelated(relatedPosts)
        }
        setLoading(false)
      })
      .catch(() => {
        setNotFound(true)
        setLoading(false)
      })
  }, [slug])

  // Inject JSON-LD and RSS autodiscovery into <head>
  useEffect(() => {
    if (!post) return

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.headline,
      description: post.prose,
      datePublished: post.publishedAt,
      url: `${SITE_URL}/liner-notes/${post.slug}`,
      image: post.image.url || undefined,
      author: { '@type': 'Person', name: 'Mike Morper' },
      about: [
        ...post.artists.map((a) => ({ '@type': 'MusicGroup', name: a })),
        ...post.venues.map((v) => ({ '@type': 'EventVenue', name: v })),
      ],
      keywords: ['concert history', ...post.artists, ...post.venues, ...post.tags],
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'liner-note-jsonld'
    script.textContent = JSON.stringify(jsonLd)
    document.head.appendChild(script)

    const rssLink = document.createElement('link')
    rssLink.rel = 'alternate'
    rssLink.type = 'application/rss+xml'
    rssLink.title = 'Liner Notes'
    rssLink.href = '/liner-notes.xml'
    rssLink.id = 'liner-note-rss'
    document.head.appendChild(rssLink)

    return () => {
      document.getElementById('liner-note-jsonld')?.remove()
      document.getElementById('liner-note-rss')?.remove()
    }
  }, [post])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fafaf9' }}>
        <p className="font-sans text-sm text-gray-400 animate-pulse">Loading...</p>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <main className="min-h-screen" style={{ background: '#fafaf9' }}>
        <div
          className="max-w-3xl mx-auto"
          style={{ padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px)' }}
        >
          <Link
            to="/liner-notes"
            className="inline-flex items-center gap-1 font-sans text-sm text-gray-500 hover:text-gray-800 transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Liner Notes
          </Link>
          <h1
            className="mb-4"
            style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color: '#1f2937' }}
          >
            Post not found
          </h1>
          <p className="font-sans text-gray-500">
            This liner note doesn&apos;t exist or may have been removed.
          </p>
        </div>
      </main>
    )
  }

  const accentColor = CATEGORY_ACCENT_COLORS[post.category]
  const categoryLabel = CATEGORY_LABELS[post.category]
  const publishedDate = format(new Date(post.publishedAt), 'MMMM d, yyyy')
  const showRelated = related.length > 0 && totalPosts >= RELATED_THRESHOLD

  return (
    <main className="min-h-screen overflow-y-auto" style={{ background: '#fafaf9' }}>
      <div
        className="max-w-3xl mx-auto"
        style={{ padding: 'clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px)', maxWidth: 800 }}
      >
        {/* Back link */}
        <Link
          to="/liner-notes"
          className="inline-flex items-center gap-1 font-sans text-sm text-gray-500 hover:text-gray-800 transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Liner Notes
        </Link>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Image */}
          {post.image.url && post.image.source !== 'placeholder' && (
            <div
              style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}
            >
              <img
                src={post.image.url}
                alt={post.image.alt}
                style={{
                  width: '100%',
                  maxHeight: 'clamp(240px, 30vw, 360px)',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Category + date */}
          <div className="flex items-center gap-4 mb-3">
            <span
              className="font-sans text-xs font-semibold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              {categoryLabel}
            </span>
            <span className="font-sans text-sm text-gray-400">{publishedDate}</span>
          </div>

          {/* Headline */}
          <h1
            className="mb-5"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(24px, 4vw, 28px)',
              fontWeight: 700,
              color: '#1f2937',
              lineHeight: 1.25,
            }}
          >
            {post.headline}
          </h1>

          {/* Prose */}
          <p
            className="font-sans mb-6"
            style={{
              fontSize: 'clamp(17px, 2.5vw, 18px)',
              color: '#374151',
              lineHeight: 'clamp(1.65, 2vw, 1.7)',
            }}
          >
            {post.prose}
          </p>

          {/* MiniPlayer */}
          {post.audio && (
            <div className="mb-6">
              <LinerNoteMiniPlayer audio={post.audio} accentColor={accentColor} />
            </div>
          )}

          {/* Deep links */}
          {post.deepLinks.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {post.deepLinks.map((link, i) => (
                <span key={link.url} className="font-sans text-sm font-medium">
                  {i > 0 && <span className="text-gray-400 mx-1">·</span>}
                  <Link
                    to={link.url}
                    className="transition-colors hover:underline"
                    style={{ color: '#6b7280' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-8">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-sans text-xs font-medium rounded-full"
                  style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', color: '#9ca3af' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Related posts */}
          {showRelated && (
            <div className="border-t border-gray-200 pt-8">
              <p
                className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4"
              >
                Related
              </p>
              <div className="space-y-3">
                {related.map((rel) => (
                  <Link
                    key={rel.slug}
                    to={`/liner-notes/${rel.slug}`}
                    className="block group"
                  >
                    <div className="flex gap-3 items-start">
                      {rel.image.url && rel.image.source !== 'placeholder' && (
                        <img
                          src={rel.image.url}
                          alt={rel.image.alt}
                          className="flex-shrink-0 rounded-lg"
                          style={{ width: 64, height: 64, objectFit: 'cover' }}
                        />
                      )}
                      <div>
                        <p
                          className="font-sans text-sm font-medium group-hover:underline transition-colors"
                          style={{ color: CATEGORY_ACCENT_COLORS[rel.category] }}
                        >
                          {rel.headline}
                        </p>
                        <p className="font-sans text-xs text-gray-400 mt-0.5">
                          {format(new Date(rel.publishedAt), 'MMMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.article>
      </div>
    </main>
  )
}
