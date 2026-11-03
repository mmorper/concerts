// The Ask scene (#142) — the final snap panel and the canonical home of "Ask the Archive".
// It fuses the end-of-scroll storytelling coda ("That's over forty years. Now ask me about it.") with
// the warmth of the old /ask page (the crate of ideas, the connector cross-sell). It is NOT a chat
// page: the composer and the crate's cards open the Spotlight overlay in place (the one chat
// surface), so there's a single invitation and no duplicated content. Deep-linkable at /?scene=ask.

import { useEffect, useRef } from 'react'
import { useAsk } from './AskProvider'
import { analytics } from '@/services/analytics'
import { haptics } from '@/utils/haptics'
import { SearchMark } from './AskMedia'
import { AskCrate } from './AskCrate'
import './ask.css'

export function AskScene() {
  const { openSpotlight, activate, archive } = useAsk()
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
    <section ref={ref} className="ask-scene snap-start snap-always" aria-label="Ask the Archive" data-testid="ask-scene">
      <div className="ask-scene-wrap">
        <p className="ask-scene-kicker">You&rsquo;ve reached the present</p>
        <h1>
          That&rsquo;s over forty years.
          <br />
          Now ask me about it.
        </h1>

        <button type="button" className="ask-scene-composer" onClick={openBlank} aria-label="Search or ask the archive">
          <SearchMark />
          <span className="ph">Search a band, venue, song or year, or ask anything</span>
        </button>

      </div>

      <AskCrate archive={archive} onAsk={openWith} />

      <div className="ask-scene-wrap">
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
