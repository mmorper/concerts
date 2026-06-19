// The Ask scene (#142) — the final snap panel and the canonical home of "Ask the Archive".
// It fuses the end-of-scroll storytelling coda ("That's forty years. Now ask me about it.") with
// the warmth of the old /ask page (suggested prompts, the connector cross-sell). It is NOT a chat
// page: the composer and prompts open the Spotlight overlay in place (the one chat surface), so
// there's a single invitation and no duplicated content. Deep-linkable at /?scene=ask.

import { useEffect, useRef } from 'react'
import { useAsk } from './AskProvider'
import { analytics } from '@/services/analytics'
import { haptics } from '@/utils/haptics'
import './ask.css'

// { label } is what's shown; { q } is what we actually ask (so a short chip can fire a fuller query).
const PROMPTS: { label: string; q: string }[] = [
  { label: 'Have you ever seen Depeche Mode?', q: 'Have you ever seen Depeche Mode?' },
  { label: 'Everything at the 9:30 Club', q: 'Show me everything at the 9:30 Club' },
  { label: 'What did you see in 1998?', q: 'What did you see in 1998?' },
]

export function AskScene() {
  const { openSpotlight, activate } = useAsk()
  const ref = useRef<HTMLElement>(null)
  const viewed = useRef(false)

  // Lazily warm the archive data + session the first time the scene scrolls into view (so other
  // visitors who never reach the end don't pay for the fetch). Mirrors how /ask used to activate().
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!viewed.current && entries.some((e) => e.isIntersecting)) {
          viewed.current = true
          activate()
          analytics.trackEvent('ask_scene_viewed')
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [activate])

  const openBlank = () => {
    haptics.light()
    openSpotlight('scene')
  }
  const openWith = (q: string) => {
    haptics.light()
    openSpotlight('prompt', q)
  }

  return (
    <section ref={ref} className="ask-scene snap-start snap-always" aria-label="Ask the Archive">
      <div className="ask-scene-wrap">
        <p className="ask-scene-kicker">You&rsquo;ve reached the present</p>
        <h1>
          That&rsquo;s forty years.
          <br />
          Now ask me about it.
        </h1>
        <p className="ask-scene-sub">
          Forty years of live music, in its own voice — 1984 to right now. Ask it the way you&rsquo;d
          ask a friend who never misses a show.
        </p>

        <button type="button" className="ask-scene-composer" onClick={openBlank} aria-label="Ask the archive">
          <span className="ask-live-dot" aria-hidden="true" />
          <span className="ph">Ask me about a band, a venue, a year… or just say &ldquo;surprise me&rdquo;</span>
          <span className="send" aria-hidden="true">↑</span>
        </button>

        <p className="ask-scene-try">Try asking</p>
        <div className="ask-scene-prompts">
          {PROMPTS.map((p) => (
            <button key={p.label} type="button" onClick={() => openWith(p.q)}>
              {p.label}
            </button>
          ))}
        </div>

        <p className="ask-scene-funnel">
          Prefer to ask inside Claude?{' '}
          <a
            href="/about-mcp"
            onClick={() => analytics.trackEvent('ask_archive_invite_clicked', { path: 'connector_url' })}
          >
            Add the archive as a connector →
          </a>
        </p>
      </div>
    </section>
  )
}
