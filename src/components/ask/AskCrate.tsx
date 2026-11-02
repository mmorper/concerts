// "Pull one from the crate" — the Ask scene's carousel (global-ask-media Phase 6). The same ideas
// as the ⌘K banner, in the same daily order, so a show on this date leads here too. Five cards at a
// time on desktop and one on a phone, with an arrow on each side.
//
// The track is a native scroll-snap row, so a phone swipes it with no gesture code. The arrows
// page it by one view. With reduced motion they jump instead of gliding.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArchiveLookups } from './types'
import { bannerDeck, localDay, type BannerIdea } from './banner'
import { BannerFace, type Shape } from './AskBanner'
import { analytics } from '@/services/analytics'

/** The cards are tall, so any of my frames fits one. */
const anyFrame = () => true

/** A photo or a clip still fills the card. A sourced image or the tile sits in it, smaller. */
const shapeOf = (idea: BannerIdea): Shape => (idea.photo || idea.poster ? 'fill' : 'tile')

export function AskCrate({ archive, onAsk }: { archive: ArchiveLookups & { loading: boolean }; onAsk: (q: string) => void }) {
  // The search entries change exactly when the data behind them does, as in AskBanner.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => bannerDeck(archive, localDay(), anyFrame), [archive.searchEntries, archive.media])
  const trackRef = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const measure = () => {
    const t = trackRef.current
    if (!t) return
    setEdge({ start: t.scrollLeft <= 2, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 2 })
  }

  // The arrows reflect where the row is once the cards are in, and again whenever the row resizes.
  useEffect(() => {
    measure()
    const t = trackRef.current
    if (!t || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(t)
    return () => ro.disconnect()
  }, [deck])

  const page = (dir: 1 | -1) => {
    const t = trackRef.current
    if (!t) return
    analytics.trackEvent('ask_crate_paged', { direction: dir > 0 ? 'next' : 'previous' })
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    t.scrollBy({ left: dir * t.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (!archive.loading && deck.length === 0) return null

  return (
    <div className="ask-crate">
      <h2 className="ask-crate-h">Pull one from the crate</h2>
      <div className="ask-crate-row">
        <button type="button" className="ask-crate-arrow" aria-label="Previous cards" disabled={edge.start} onClick={() => page(-1)}>
          <Chevron flip />
        </button>
        <ul className="ask-crate-track" ref={trackRef} onScroll={measure} aria-label="Things to ask about">
          {archive.loading
            ? Array.from({ length: 5 }, (_, i) => <li key={i} className="ask-crate-card loading" aria-hidden="true" />)
            : deck.map((idea, i) => (
                <li key={idea.key}>
                  <CrateCard idea={idea} position={i} archive={archive} onAsk={onAsk} />
                </li>
              ))}
        </ul>
        <button type="button" className="ask-crate-arrow" aria-label="Next cards" disabled={edge.end || archive.loading} onClick={() => page(1)}>
          <Chevron />
        </button>
      </div>
    </div>
  )
}

function CrateCard({ idea, position, archive, onAsk }: { idea: BannerIdea; position: number; archive: ArchiveLookups; onAsk: (q: string) => void }) {
  const shape = shapeOf(idea)
  const face = <BannerFace idea={idea} shape={shape} archive={archive} bylineBelow />
  if (idea.href) {
    return (
      <a
        className={`ask-crate-card ask-band ${shape}`}
        href={idea.href}
        aria-label={`Play ${idea.title}, ${idea.sub}`}
        onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'crate', target_scene: 'artists', media_kind: 'video' })}
      >
        {face}
      </a>
    )
  }
  return (
    <button
      type="button"
      className={`ask-crate-card ask-band ${shape}`}
      aria-label={idea.question}
      onClick={() => {
        analytics.trackEvent('ask_suggested_prompt_clicked', { prompt: idea.question, position, source: 'crate', idea_kind: idea.kind })
        onAsk(idea.question!)
      }}
    >
      {face}
    </button>
  )
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
