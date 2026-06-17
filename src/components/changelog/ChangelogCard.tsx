/**
 * ChangelogCard — editorial list entry for /whats-playing
 * Styled to match LinerNoteCard: light background, indigo left accent, Playfair headline
 */

import { motion } from 'framer-motion'
import type { ChangelogCardProps } from './types'

const INDIGO = '#4f46e5'

export function ChangelogCard({ release, isLatest = false }: ChangelogCardProps) {

  const formattedDate = new Date(release.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        borderLeft: `4px solid ${INDIGO}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        marginBottom: '24px',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
        {/* Category label + date row */}
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-sans text-xs font-semibold uppercase tracking-wider"
            style={{ color: INDIGO }}
          >
            {isLatest ? 'Latest Release' : 'Release'}
          </span>
          <time dateTime={release.date} className="font-sans text-[13px] text-gray-400">
            {formattedDate}
          </time>
        </div>

        {/* Version + title as Playfair headline */}
        <h2
          className="mb-3"
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 22,
            fontWeight: 700,
            color: '#1f2937',
            lineHeight: 1.3,
          }}
        >
          v{release.version} — {release.title}
        </h2>

        {/* Description */}
        <p
          className="font-sans mb-4"
          style={{ fontSize: 16, color: '#374151', lineHeight: 1.65 }}
        >
          {release.description}
        </p>

        {/* Highlights */}
        <ul className="mb-4 space-y-1.5">
          {release.highlights.map((highlight, i) => (
            <li key={i} className="font-sans text-sm flex items-start gap-2" style={{ color: '#4b5563' }}>
              <span style={{ color: INDIGO, marginTop: 1, flexShrink: 0 }}>·</span>
              {highlight}
            </li>
          ))}
        </ul>

        {/* CTA — full navigation (anchor), so it works for both in-app routes and
            static pages like /ask (client-side navigate() can't reach a non-SPA path). */}
        {release.route && (
          <a
            href={release.route}
            className="font-sans text-sm font-medium transition-colors"
            style={{ color: INDIGO }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            See it live →
          </a>
        )}
      </div>
    </motion.article>
  )
}
