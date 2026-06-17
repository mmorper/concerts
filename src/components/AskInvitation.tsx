import { motion, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import { analytics } from '../services/analytics'
import { haptics } from '../utils/haptics'

/**
 * AskInvitation — the end-of-scroll coda (spec B, issue #134).
 *
 * Mounts as the final snap panel after the Artists scene. It is intentionally NOT a scene
 * (no nav dot) — a quiet, earned invitation that appears only once the journey is complete.
 * Dark "fin" background that rhymes with the /ask landing page; the top of the gradient
 * starts at the Artists scene's light tone so the light→dark seam reads as a designed dusk
 * fade rather than a hard cut.
 */

// Matches the Artists scene above (Tailwind bg-stone-50) for a seamless transition.
const ARTISTS_BG = '#fafaf9'

export function AskInvitation() {
  const reduce = useReducedMotion()
  const viewed = useRef(false)

  return (
    <section
      className="h-screen flex items-center justify-center snap-start snap-always relative overflow-hidden px-6"
      style={{
        background: `linear-gradient(180deg, ${ARTISTS_BG} 0%, #1e1b4b 24%, #3b0764 100%)`,
      }}
      aria-label="Ask the Archive"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.3, 1] }}
        onViewportEnter={() => {
          if (viewed.current) return
          viewed.current = true
          analytics.trackEvent('ask_archive_invite_viewed')
        }}
        className="w-full max-w-[440px] text-center"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 20,
          padding: '38px 34px',
          boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
        }}
      >
        <p
          className="font-sans"
          style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginBottom: 14 }}
        >
          You&rsquo;ve reached the present
        </p>
        <h2 className="font-serif" style={{ fontWeight: 500, fontSize: 34, lineHeight: 1.1, color: '#fff', margin: '0 0 12px' }}>
          That&rsquo;s forty years.<br />Now ask me about it.
        </h2>
        <p className="font-sans" style={{ color: 'rgba(255,255,255,0.78)', fontSize: 16, margin: '0 0 24px' }}>
          You&rsquo;ve been reading the archive. Inside Claude, you can talk to it &mdash; your
          history with a band, every show at a venue, or just &ldquo;surprise me.&rdquo;
        </p>
        {/* /ask is a static (non-SPA) page — full-navigation <a>, not <Link>. */}
        <a
          href="/ask"
          onClick={() => {
            haptics.light()
            analytics.trackEvent('ask_archive_invite_clicked', { path: 'primary_cta' })
          }}
          className="font-sans group"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#1e1b4b', fontWeight: 700, fontSize: 15.5, borderRadius: 999, padding: '12px 22px', textDecoration: 'none' }}
        >
          Ask the archive
          <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-1">&rarr;</span>
        </a>
        <p className="font-sans" style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          or add{' '}
          <a
            href="/ask"
            onClick={() => analytics.trackEvent('ask_archive_invite_clicked', { path: 'connector_url' })}
            style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.8)', fontWeight: 600, textDecoration: 'none' }}
          >
            concerts.morperhaus.org/mcp
          </a>{' '}
          in Claude
        </p>
      </motion.div>
    </section>
  )
}
