// The ⌘K banner: one large picture under the box, and "Pull another". The ideas and their order
// are in ./banner.ts. A clip opens in its gatefold; every other idea asks its question.

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { ArchiveLookups } from './types'
import { BANNER_BOX, bannerDeck, localDay, type BannerIdea } from './banner'
import { focalPosition, photoCaption } from './media'
import { captionLookups } from './AskCardParts'
import { CameraMark, DerivedArt, LadderImage } from './AskMedia'
import { DEFAULT_GENRE_COLOR } from '@/constants/colors'
import { analytics } from '@/services/analytics'

/** A phone holds the banner taller than wide. */
const PHONE_BOX = 0.9

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

  const face = <BannerFace idea={idea} archive={archive} />
  return (
    <div className="ask-banner" aria-live="polite">
      {idea.href ? (
        <a
          className="ask-band"
          href={idea.href}
          aria-label={`Play ${idea.title}, ${idea.sub}`}
          onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'banner', target_scene: 'artists', media_kind: 'video' })}
        >
          {face}
        </a>
      ) : (
        <button
          type="button"
          className="ask-band"
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

function BannerFace({ idea, archive }: { idea: BannerIdea; archive: ArchiveLookups }) {
  const fallback = <DerivedArt name={idea.title} color={DEFAULT_GENRE_COLOR} />
  let picture: ReactNode = fallback
  let byline: string | null = null
  if (idea.photo) {
    const p = idea.photo
    // Each shape keeps the owner's crop in view.
    const style = { '--pos-wide': focalPosition(p, BANNER_BOX), '--pos-tall': focalPosition(p, PHONE_BOX) } as CSSProperties
    byline = photoCaption(p, { aboutAct: idea.act, ...captionLookups(archive) })
    picture = <LadderImage key={p.url} sources={[p.url]} alt="" style={style} fallback={fallback} eager />
  } else if (idea.poster) {
    // A still from the clip, with no crop drawn. The performer is near the top of a stage video.
    picture = <LadderImage key={idea.poster} sources={[idea.poster]} alt="" style={{ '--pos-wide': '50% 18%', '--pos-tall': '50% 18%' } as CSSProperties} fallback={fallback} eager />
  }
  return (
    <>
      {picture}
      <span className="shade" aria-hidden="true" />
      <span className="txt">
        <span className="k">{idea.kicker}</span>
        <span className="t">{idea.title}</span>
        <span className="s">{idea.sub}</span>
      </span>
      {byline && (
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
