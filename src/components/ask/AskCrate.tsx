// "Pull one from the crate" (global-ask-media Phase 6): the ideas from ./banner.ts in their daily
// order, so a show on this date leads. It is the Ask scene's carousel and the ⌘K overlay's empty
// state, one design for both. Five cards at a time in the scene, four in the narrower overlay, and
// one on a phone, with an arrow on each side.
//
// The track is a native scroll-snap row, so a phone swipes it with no gesture code. The arrows
// page it by one view. With reduced motion they jump instead of gliding.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ArchiveLookups } from './types'
import { bannerDeck, localDay, type BannerIdea } from './banner'
import { focalPosition, photoCaption } from './media'
import { captionLookups } from './AskCardParts'
import { CameraMark, DerivedArt, LadderImage } from './AskMedia'
import { DEFAULT_GENRE_COLOR, getGenreColor } from '@/constants/colors'
import { analytics } from '@/services/analytics'

/** The cards are tall, so any of my frames fits one. */
const anyFrame = () => true

/** The crop is held between the desktop card's 4:5 and the phone's square. */
const CARD_BOX = 0.9

/** Where the crate is. Analytics keeps the two apart. */
export type CrateSurface = 'scene' | 'overlay'

/** A photo or a clip still fills the card. A sourced image or the tile sits in it, smaller. */
type Shape = 'fill' | 'tile'
const shapeOf = (idea: BannerIdea): Shape => (idea.photo || idea.poster ? 'fill' : 'tile')

export function AskCrate({
  archive,
  onAsk,
  surface,
}: {
  archive: ArchiveLookups & { loading?: boolean }
  onAsk: (q: string) => void
  surface: CrateSurface
}) {
  // The lookups are new functions each render. The search entries change exactly when the data
  // behind them does, so they stand in for the whole archive here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => bannerDeck(archive, localDay(), anyFrame), [archive.searchEntries, archive.media])
  const trackRef = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const loading = !!archive.loading

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
    analytics.trackEvent('ask_crate_paged', { direction: dir > 0 ? 'next' : 'previous', surface })
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    t.scrollBy({ left: dir * t.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (!loading && deck.length === 0) return null

  return (
    <div className="ask-crate">
      <h2 className="ask-crate-h">Pull one from the crate</h2>
      <div className="ask-crate-row">
        <button type="button" className="ask-crate-arrow" aria-label="Previous cards" disabled={edge.start} onClick={() => page(-1)}>
          <Chevron flip />
        </button>
        <ul className="ask-crate-track" ref={trackRef} onScroll={measure} aria-label="Things to ask about">
          {loading
            ? Array.from({ length: 5 }, (_, i) => <li key={i} className="ask-crate-card loading" aria-hidden="true" />)
            : deck.map((idea, i) => (
                <li key={idea.key}>
                  <CrateCard idea={idea} position={i} archive={archive} onAsk={onAsk} surface={surface} />
                </li>
              ))}
        </ul>
        <button type="button" className="ask-crate-arrow" aria-label="Next cards" disabled={edge.end || loading} onClick={() => page(1)}>
          <Chevron />
        </button>
      </div>
    </div>
  )
}

function CrateCard({
  idea,
  position,
  archive,
  onAsk,
  surface,
}: {
  idea: BannerIdea
  position: number
  archive: ArchiveLookups
  onAsk: (q: string) => void
  surface: CrateSurface
}) {
  const shape = shapeOf(idea)
  const face = <CardFace idea={idea} archive={archive} />
  if (idea.href) {
    return (
      <a
        className={`ask-crate-card ask-band ${shape}`}
        href={idea.href}
        aria-label={`Play ${idea.title}, ${idea.sub}`}
        onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'crate', surface, target_scene: 'artists', media_kind: 'video' })}
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
        analytics.trackEvent('ask_suggested_prompt_clicked', { prompt: idea.question, position, source: 'crate', surface, idea_kind: idea.kind })
        onAsk(idea.question!)
      }}
    >
      {face}
    </button>
  )
}

/** The picture, then the kicker, title, line and byline. The byline sits under the text, clear of any face. */
function CardFace({ idea, archive }: { idea: BannerIdea; archive: ArchiveLookups }) {
  const fallback = <DerivedArt name={idea.title} color={idea.genre ? getGenreColor(idea.genre) : DEFAULT_GENRE_COLOR} />
  let picture: ReactNode = <span className="pic">{fallback}</span>
  let byline: string | null = null
  if (idea.photo) {
    const p = idea.photo
    byline = photoCaption(p, { aboutAct: idea.act, aboutDate: idea.aboutDate, ...captionLookups(archive) })
    const style = { '--pos-tall': focalPosition(p, CARD_BOX) } as CSSProperties
    picture = <LadderImage key={p.url} sources={[p.url]} alt="" style={style} fallback={fallback} eager />
  } else if (idea.sourced) {
    picture = (
      <span className="pic">
        <LadderImage key={idea.sourced} sources={[idea.sourced]} alt="" fallback={fallback} eager />
      </span>
    )
  } else if (idea.poster) {
    // A still from the clip, with no crop drawn. The performer is near the top of a stage video.
    picture = <LadderImage key={idea.poster} sources={[idea.poster]} alt="" style={{ '--pos-tall': '50% 18%' } as CSSProperties} fallback={fallback} eager />
  }
  return (
    <>
      {picture}
      <span className="shade" aria-hidden="true" />
      <span className="txt">
        <span className="k">{idea.kicker}</span>
        <span className="t">{idea.title}</span>
        <span className="s">{idea.sub}</span>
        {byline && (
          <span className="by-line">
            <CameraMark size={12} /> {byline}
          </span>
        )}
      </span>
      {idea.href && (
        <span className="play" aria-hidden="true">
          <svg width="18" height="20" viewBox="0 0 12 14">
            <path d="M1 1l10 6-10 6z" fill="#17143a" />
          </svg>
        </span>
      )}
    </>
  )
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
