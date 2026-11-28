/**
 * PageNav — the shared top navigation for the secondary pages (Liner Notes, What's Playing,
 * How It Works, About).
 *
 * Every page shows the same items in the same order, and the page you're on is underlined rather
 * than removed, so the menu never changes shape from page to page. The order matches the phone
 * bar and the desktop rail's menu: Ask, then the pages about the site.
 */

import { ChevronLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { analytics } from '../../services/analytics'

type Section = 'liner-notes' | 'whats-playing' | 'about' | 'how-it-works'

interface PageNavProps {
  /** Which section this page belongs to: underlined in the menu */
  current: Section
  /** Dark theme (What's Playing) vs light theme (Liner Notes) */
  theme: 'dark' | 'light'
}

const ITEMS: { key: Section | 'ask'; to: string; label: string }[] = [
  // Ask is the in-app Ask scene (#142) — an SPA <Link> to the deep link, no full reload.
  { key: 'ask', to: '/?scene=ask', label: 'Ask the Archive' },
  { key: 'liner-notes', to: '/liner-notes', label: 'Liner Notes' },
  { key: 'how-it-works', to: '/how-it-works', label: 'How It Works' },
  { key: 'whats-playing', to: '/whats-playing', label: "What's Playing" },
  { key: 'about', to: '/about', label: 'About' },
]

export function PageNav({ current, theme }: PageNavProps) {
  const navigate = useNavigate()
  const dark = theme === 'dark'

  const backClass = dark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
  const linkClass = dark ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
  const hereClass = dark ? 'text-white' : 'text-gray-900'
  const dividerClass = dark ? 'text-slate-700' : 'text-gray-300'
  const underline = dark ? '#f472b6' : '#4f46e5'

  return (
    // Wraps rather than squeezing. The separating dots show only from `sm` up, so a wrapped
    // second line on a phone never starts with a stray "·".
    <nav className="flex flex-wrap items-center gap-x-4 sm:gap-x-3 gap-y-2 mb-10" aria-label="Page navigation">
      <button
        onClick={() => navigate('/')}
        className={`font-sans text-sm flex items-center gap-1 whitespace-nowrap transition-colors ${backClass}`}
      >
        <ChevronLeft className="w-4 h-4" />
        Archive
      </button>

      <span className={dividerClass} aria-hidden="true">
        |
      </span>

      {ITEMS.map((it, i) => {
        const here = current === it.key
        return (
          <span key={it.key} className="flex items-center gap-x-3">
            {i > 0 && (
              <span className={`${dividerClass} hidden sm:inline`} aria-hidden="true">
                ·
              </span>
            )}
            <Link
              to={it.to}
              aria-current={here ? 'true' : undefined}
              className={`font-sans text-sm whitespace-nowrap transition-colors ${here ? hereClass : linkClass}`}
              style={
                here
                  ? { textDecoration: 'underline', textDecorationColor: underline, textDecorationThickness: 2, textUnderlineOffset: 6 }
                  : undefined
              }
              onClick={() => {
                if (it.key === 'ask') analytics.trackEvent('ask_archive_nav_clicked', { surface: 'pagenav', current })
                else analytics.trackEvent('page_nav_clicked', { destination: it.key, current })
              }}
            >
              {it.label}
            </Link>
          </span>
        )
      })}
    </nav>
  )
}
