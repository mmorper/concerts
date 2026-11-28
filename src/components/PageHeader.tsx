/**
 * The header for the site's standalone index pages: Liner Notes, What's Playing, About and the How
 * It Works landing page. An indigo accent bar, the title and a one-line subtitle, at one size
 * everywhere, so the pages read as one family. Before this each page set its own size by hand,
 * and How It Works ended up 40% larger than its siblings.
 *
 * How It Works chapters are long-form articles and use ChapterHeader
 * (src/components/how-it-works/shared.tsx) instead. The design-system skill says when to use which.
 *
 * The ref goes to the <h1>: pages focus it after loading, for screen readers.
 */
import { forwardRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'

const THEMES = {
  light: { bar: '#4f46e5', title: '#1f2937', subtitle: '#6b7280' },
  dark: { bar: '#818cf8', title: 'var(--hiw-ink, #eef0ff)', subtitle: 'var(--hiw-ink-2, #b9c0e8)' },
}

export const PageHeader = forwardRef<
  HTMLHeadingElement,
  { title: ReactNode; subtitle?: ReactNode; theme?: keyof typeof THEMES; className?: string }
>(function PageHeader({ title, subtitle, theme = 'light', className = 'mb-8' }, ref) {
  const c = THEMES[theme]
  return (
    <header className={className} role="banner">
      <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.bar, marginBottom: 16 }} aria-hidden="true" />
      <motion.h1
        ref={ref}
        tabIndex={-1}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="outline-none mb-2"
        style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, color: c.title, lineHeight: 1.15 }}
      >
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="font-sans"
          style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: c.subtitle, lineHeight: 1.5, maxWidth: 680 }}
        >
          {subtitle}
        </motion.p>
      )}
    </header>
  )
})
