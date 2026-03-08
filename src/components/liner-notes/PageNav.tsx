/**
 * PageNav — shared top navigation for Liner Notes and What's Playing pages.
 * Establishes consistent app-family identity across content pages.
 */

import { ChevronLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'

interface PageNavProps {
  /** Which page this nav is on — used to hide the self-link */
  current: 'liner-notes' | 'whats-playing'
  /** Dark theme (What's Playing) vs light theme (Liner Notes) */
  theme: 'dark' | 'light'
}

export function PageNav({ current, theme }: PageNavProps) {
  const navigate = useNavigate()

  const backClass =
    theme === 'dark'
      ? 'text-slate-400 hover:text-white'
      : 'text-gray-500 hover:text-gray-900'

  const linkClass =
    theme === 'dark'
      ? 'text-slate-500 hover:text-indigo-400'
      : 'text-gray-400 hover:text-indigo-600'

  const dividerClass = theme === 'dark' ? 'text-slate-700' : 'text-gray-300'

  return (
    <nav className="flex items-center gap-3 mb-10" aria-label="Page navigation">
      <button
        onClick={() => navigate('/')}
        className={`font-sans text-sm flex items-center gap-1 transition-colors ${backClass}`}
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Archive
      </button>

      <span className={dividerClass} aria-hidden="true">|</span>

      {current !== 'liner-notes' && (
        <Link
          to="/liner-notes"
          className={`font-sans text-sm transition-colors ${linkClass}`}
        >
          Liner Notes
        </Link>
      )}

      {current !== 'liner-notes' && current !== 'whats-playing' && (
        <span className={dividerClass} aria-hidden="true">·</span>
      )}

      {current !== 'whats-playing' && (
        <Link
          to="/whats-playing"
          className={`font-sans text-sm transition-colors ${linkClass}`}
        >
          What&apos;s Playing
        </Link>
      )}

      <span className={dividerClass} aria-hidden="true">·</span>

      <Link
        to="/about"
        className={`font-sans text-sm transition-colors ${linkClass}`}
      >
        About
      </Link>
    </nav>
  )
}
