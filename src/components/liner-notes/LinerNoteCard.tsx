/**
 * LinerNoteCard — post card for the /liner-notes blog feed
 * Spec: docs/specs/future/liner-notes-design-mocks.md
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import type { LinerNotesPost, DeepLink } from '../../types/liner-notes'
import { CATEGORY_ACCENT_COLORS, CATEGORY_LABELS } from './constants'
import { LinerNoteMiniPlayer } from './LinerNoteMiniPlayer'

interface LinerNoteCardProps {
  post: LinerNotesPost
  index: number
  onTagClick: (tag: string) => void
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Parses prose and wraps deepLink labels with <Link> elements.
 * Matches are case-sensitive and non-overlapping (longer labels first).
 */
function linkifyProse(prose: string, deepLinks: DeepLink[], accentColor: string) {
  if (!deepLinks.length) return [prose]

  // Sort longest first to prevent shorter substrings clobbering longer matches
  const sorted = [...deepLinks].sort((a, b) => b.label.length - a.label.length)

  type Segment = string | React.ReactNode
  let segments: Segment[] = [prose]

  for (const link of sorted) {
    const next: Segment[] = []
    for (const seg of segments) {
      if (typeof seg !== 'string') {
        next.push(seg)
        continue
      }
      const parts = seg.split(link.label)
      parts.forEach((part, i) => {
        if (part) next.push(part)
        if (i < parts.length - 1) {
          next.push(
            <Link
              key={`${link.url}-${i}`}
              to={link.url}
              className="transition-colors hover:underline"
              style={{ color: accentColor, fontWeight: 500 }}
            >
              {link.label}
            </Link>
          )
        }
      })
    }
    segments = next
  }

  return segments
}

export function LinerNoteCard({ post, index, onTagClick }: LinerNoteCardProps) {
  const accentColor = CATEGORY_ACCENT_COLORS[post.category]
  const categoryLabel = CATEGORY_LABELS[post.category]

  const publishedDate = format(new Date(post.publishedAt), 'MMMM d, yyyy')
  const proseSegments = linkifyProse(post.prose, post.deepLinks, accentColor)

  return (
    <motion.article
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.08 }}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Image */}
      {post.image.url && post.image.source !== 'placeholder' && (
        <div style={{ maxHeight: 280, overflow: 'hidden' }}>
          <img
            src={post.image.url}
            alt={post.image.alt}
            style={{
              width: '100%',
              maxHeight: 280,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-6" style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
        {/* Category label + date */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-sans text-xs font-semibold uppercase tracking-wider"
            style={{ color: accentColor }}
          >
            {categoryLabel}
          </span>
          <span className="font-sans text-[13px] text-gray-400">{publishedDate}</span>
        </div>

        {/* Headline */}
        <h2 className="mb-3" style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: '#1f2937' }}>
          <Link
            to={`/liner-notes/${post.slug}`}
            className="hover:underline transition-colors"
            style={{ color: '#1f2937' }}
          >
            {post.headline}
          </Link>
        </h2>

        {/* Prose with inline deeplinks */}
        <p
          className="font-sans mb-4"
          style={{ fontSize: 16, color: '#374151', lineHeight: 1.65 }}
        >
          {proseSegments}
        </p>

        {/* MiniPlayer */}
        {post.audio && (
          <div className="mb-4">
            <LinerNoteMiniPlayer audio={post.audio} accentColor={accentColor} />
          </div>
        )}

        {/* Deep links footer row */}
        {post.deepLinks.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
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
          <div className="flex flex-wrap gap-1">
            {post.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="font-sans text-xs font-medium rounded-full transition-colors"
                style={{
                  padding: '2px 8px',
                  backgroundColor: '#f3f4f6',
                  color: '#9ca3af',
                  minHeight: 44,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  )
}
