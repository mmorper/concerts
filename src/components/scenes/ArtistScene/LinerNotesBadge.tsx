/**
 * LinerNotesBadge — tab button in Concert History Panel
 *
 * Navigates to /liner-notes?artist={normalizedName} (SPA push).
 * Only rendered when the artist has ≥ 1 liner notes post.
 * Styled to complement TourBadge — indigo accent matching /liner-notes page.
 */

import { useNavigate } from 'react-router-dom'
import { haptics } from '../../../utils/haptics'
import { analytics } from '../../../services/analytics'

interface LinerNotesBadgeProps {
  /** Number of liner notes posts for this artist */
  count: number
  /** Artist normalized slug, e.g. "depeche-mode" */
  artistNormalizedName: string
  /** Artist display name for analytics */
  artistName: string
}

export function LinerNotesBadge({
  count,
  artistNormalizedName,
  artistName,
}: LinerNotesBadgeProps) {
  const navigate = useNavigate()

  if (count === 0) return null

  const handleClick = () => {
    haptics.light()

    analytics.trackEvent('liner_notes_badge_clicked', {
      artist_name: artistName,
      liner_notes_count: count,
      device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
    })

    navigate(`/liner-notes?artist=${artistNormalizedName}`)
  }

  return (
    <button
      onClick={handleClick}
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-sans text-xs font-semibold uppercase tracking-wider cursor-pointer transition-all duration-150 ease-out hover:scale-[1.02] touchable-subtle"
      style={{
        background: 'rgba(79, 70, 229, 0.15)',
        border: '1px solid rgba(79, 70, 229, 0.3)',
        color: '#818cf8',
        minHeight: 28,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(79, 70, 229, 0.25)'
        e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.5)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(79, 70, 229, 0.15)'
        e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.3)'
      }}
      aria-label={`Read ${count} liner notes ${count === 1 ? 'story' : 'stories'} about ${artistName}`}
    >
      {/* Pencil icon */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
      </svg>

      <span>
        LINER NOTES · {count} {count === 1 ? 'story' : 'stories'}
      </span>
    </button>
  )
}
