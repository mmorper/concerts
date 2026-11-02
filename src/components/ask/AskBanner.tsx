// The ⌘K banner: one large picture under the box, and "Pull another". The ideas and their order
// are in ./banner.ts. A clip opens in its gatefold; every other idea asks its question.
//
// Three shapes. A landscape photo or a clip still fills the banner. A portrait photo sits beside
// the text at the crop's own 4:5, so no head is cut off. A sourced image, or the type-led tile when
// nothing loads, sits beside the text as a smaller square, so my photos still outrank it.

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { ArchiveLookups } from './types'
import { BANNER_BOX, bannerDeck, fillsBanner, localDay, type BannerIdea } from './banner'
import { focalPosition, photoCaption } from './media'
import { captionLookups } from './AskCardParts'
import { CameraMark, DerivedArt, LadderImage } from './AskMedia'
import { DEFAULT_GENRE_COLOR, getGenreColor } from '@/constants/colors'
import { analytics } from '@/services/analytics'

/** A phone holds the banner taller than wide. */
const PHONE_BOX = 0.9
/** A portrait photo beside the text keeps the owner's 4:5 crop. */
const SIDE_BOX = 0.8

type Shape = 'fill' | 'side' | 'tile'
const shapeOf = (idea: BannerIdea): Shape => (idea.photo ? (fillsBanner(idea.photo) ? 'fill' : 'side') : idea.poster ? 'fill' : 'tile')

export function AskBanner({ archive, busy, onAsk }: { archive: ArchiveLookups; busy: boolean; onAsk: (q: string) => void }) {
  // The lookups are new functions each render. The search entries change exactly when the data
  // behind them does, so they stand in for the whole archive here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => bannerDeck(archive, localDay()), [archive.searchEntries, archive.media])
  const [n, setN] = useState(0)
  if (deck.length === 0) return null
  const idea = deck[n % deck.length]

  const pull = () => {
    analytics.trackEvent('ask_banner_pulled', { idea_kind: idea.kind, position: n })
    setN((i) => i + 1)
  }

  const shape = shapeOf(idea)
  const face = <BannerFace idea={idea} shape={shape} archive={archive} />
  return (
    <div className="ask-banner" aria-live="polite">
      {idea.href ? (
        <a
          className={`ask-band ${shape}`}
          href={idea.href}
          aria-label={`Play ${idea.title}, ${idea.sub}`}
          onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'banner', target_scene: 'artists', media_kind: 'video' })}
        >
          {face}
        </a>
      ) : (
        <button
          type="button"
          className={`ask-band ${shape}`}
          disabled={busy}
          aria-label={idea.question}
          onClick={() => {
            analytics.trackEvent('ask_suggested_prompt_clicked', { prompt: idea.question, position: n, source: 'banner', idea_kind: idea.kind })
            onAsk(idea.question!)
          }}
        >
          {face}
        </button>
      )}
      {deck.length > 1 && (
        <div className="ask-banner-foot">
          <button type="button" className="ask-pull" onClick={pull}>
            Pull another
          </button>
        </div>
      )}
    </div>
  )
}

function BannerFace({ idea, shape, archive }: { idea: BannerIdea; shape: Shape; archive: ArchiveLookups }) {
  const fallback = <DerivedArt name={idea.title} color={idea.genre ? getGenreColor(idea.genre) : DEFAULT_GENRE_COLOR} />
  let picture: ReactNode = <span className="pic">{fallback}</span>
  let byline: string | null = null
  if (idea.photo) {
    const p = idea.photo
    // Each shape keeps the owner's crop in view. On a phone a portrait frame fills the banner.
    const style = {
      '--pos-wide': focalPosition(p, shape === 'side' ? SIDE_BOX : BANNER_BOX),
      '--pos-tall': focalPosition(p, PHONE_BOX),
    } as CSSProperties
    byline = photoCaption(p, { aboutAct: idea.act, aboutDate: idea.aboutDate, ...captionLookups(archive) })
    const img = <LadderImage key={p.url} sources={[p.url]} alt="" style={style} fallback={fallback} eager />
    picture = shape === 'side' ? <span className="pic">{img}</span> : img
  } else if (idea.sourced) {
    picture = (
      <span className="pic">
        <LadderImage key={idea.sourced} sources={[idea.sourced]} alt="" fallback={fallback} eager />
      </span>
    )
  } else if (idea.poster) {
    // A still from the clip, with no crop drawn. The performer is near the top of a stage video.
    picture = <LadderImage key={idea.poster} sources={[idea.poster]} alt="" style={{ '--pos-wide': '50% 18%', '--pos-tall': '50% 18%' } as CSSProperties} fallback={fallback} eager />
  }
  return (
    <>
      {picture}
      <span className="shade" aria-hidden="true" />
      {idea.year && shape !== 'fill' && (
        <span className="yr" aria-hidden="true">
          {idea.year}
        </span>
      )}
      <span className="txt">
        <span className="k">{idea.kicker}</span>
        <span className="t">{idea.title}</span>
        <span className="s">{idea.sub}</span>
        {/* Beside a portrait photo the byline joins the text, clear of the face. */}
        {byline && shape === 'side' && (
          <span className="by-line">
            <CameraMark size={12} /> {byline}
          </span>
        )}
      </span>
      {byline && shape === 'fill' && (
        <span className="by">
          <CameraMark size={12} /> {byline}
        </span>
      )}
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
