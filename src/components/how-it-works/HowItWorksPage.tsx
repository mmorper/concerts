/**
 * /how-it-works: the landing page for the explainers. One card per chapter (chapters.ts).
 */
import { Link } from 'react-router-dom'
import { motion, MotionConfig } from 'framer-motion'
import { PageHeader } from '../PageHeader'
import { PageNav } from '../liner-notes/PageNav'
import { analytics } from '../../services/analytics'
import { ALSO, CHAPTERS } from './chapters'
import { usePageTitle } from './shared'

function ArchiveMotif() {
  // Three seeds (artist, venue, date) falling into a fan of everything they become.
  const seeds = [
    { x: 40, c: '#8b5cf6' },
    { x: 80, c: '#6366f1' },
    { x: 120, c: '#64748b' },
  ]
  return (
    <svg viewBox="0 0 160 96" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d={`M80 40 C80 64, ${16 + i * 16} 60, ${16 + i * 16} 90`}
          fill="none"
          stroke="#a5b4fc"
          strokeOpacity={0.18 + (i % 3) * 0.08}
          strokeWidth="1.2"
        />
      ))}
      {seeds.map((s) => (
        <path key={s.x} d={`M${s.x} 12 C${s.x} 28, 80 24, 80 40`} fill="none" stroke={s.c} strokeWidth="1.6" />
      ))}
      {seeds.map((s) => (
        <circle key={s.x} cx={s.x} cy="10" r="5" fill={s.c} />
      ))}
      <circle cx="80" cy="40" r="4" fill="#eef0ff" />
    </svg>
  )
}

function SpinningMotif() {
  // A record, a round trip up to the internet and back down to a screen.
  return (
    <svg viewBox="0 0 160 96" width="100%" height="100%" aria-hidden="true">
      <line x1="0" y1="50" x2="160" y2="50" stroke="#a5b4fc" strokeOpacity="0.2" strokeDasharray="3 4" />
      <circle cx="30" cy="72" r="18" fill="#0b0f26" stroke="#f6b26b" strokeOpacity="0.7" />
      <circle cx="30" cy="72" r="11" fill="none" stroke="#f6b26b" strokeOpacity="0.3" />
      <circle cx="30" cy="72" r="3" fill="#f472b6" />
      <path d="M48 72 C70 72, 64 20, 86 20 S 110 20, 116 50 S 126 74, 128 74" fill="none" stroke="#7dd3fc" strokeWidth="1.6" />
      <circle cx="86" cy="20" r="4" fill="#7dd3fc" />
      <rect x="120" y="60" width="32" height="22" rx="3" fill="#0b0f26" stroke="#f6b26b" strokeOpacity="0.7" />
      <circle cx="126" cy="66" r="1.6" fill="#f472b6" />
      <rect x="130" y="65" width="16" height="2" rx="1" fill="#eef0ff" fillOpacity="0.7" />
      <rect x="126" y="71" width="20" height="2" rx="1" fill="#eef0ff" fillOpacity="0.35" />
    </svg>
  )
}

const MOTIFS: Record<string, () => JSX.Element> = {
  'the-archive': ArchiveMotif,
  'now-spinning': SpinningMotif,
}

export function HowItWorksPage() {
  usePageTitle('How It Works | Morperhaus Concert Archives')

  return (
    <MotionConfig reducedMotion="user">
    <main className="hiw h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-10">
        <PageNav current="how-it-works" theme="dark" />

        <PageHeader
          theme="dark"
          className="mb-12"
          title="How It Works"
          subtitle={
            <>
              The machinery behind the archive, for the curious. Every chapter tells the story first. When you want
              the engineering, open the panels marked <em>Under the hood</em>.
            </>
          }
        />

        <div className="grid gap-5 md:grid-cols-2">
          {CHAPTERS.map((c, i) => {
            const Motif = MOTIFS[c.id]
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.1 }}
              >
                <Link
                  to={c.path}
                  className="hiw-card p-6 h-full"
                  onClick={() => analytics.trackEvent('how_it_works_chapter_clicked', { chapter: c.id, surface: 'index' })}
                >
                  <div
                    style={{
                      height: 120,
                      borderRadius: 12,
                      marginBottom: 20,
                      padding: '12px 24px',
                      background: 'rgba(7, 11, 31, 0.7)',
                      border: '1px solid var(--hiw-line)',
                    }}
                  >
                    {Motif && <Motif />}
                  </div>
                  <div className="hiw-step" style={{ color: 'var(--hiw-ink-3)' }}>
                    Chapter {i + 1}
                  </div>
                  <h2 className="hiw-title mt-2" style={{ fontSize: 30 }}>
                    {c.title}
                  </h2>
                  <p className="font-sans mt-3" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--hiw-ink-2)' }}>
                    {c.dek}
                  </p>
                  <div className="font-sans mt-5" style={{ fontSize: 14, fontWeight: 600, color: 'var(--hiw-lav)' }}>
                    Read the chapter →
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-12">
          <div className="hiw-kicker mb-4">Also</div>
          {ALSO.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="hiw-card p-5"
              onClick={() => analytics.trackEvent('how_it_works_chapter_clicked', { chapter: a.href.slice(1), surface: 'index' })}
            >
              {/* The layout lives on an inner box: .hiw-card sets display: block, and unlayered CSS
                  beats Tailwind's utilities, so "flex" on the card itself was silently ignored. */}
              <span className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="hiw-title" style={{ fontSize: 22 }}>
                  {a.title}
                </span>
                <span className="font-sans" style={{ fontSize: 15, color: 'var(--hiw-ink-2)' }}>
                  {a.dek}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </main>
    </MotionConfig>
  )
}
