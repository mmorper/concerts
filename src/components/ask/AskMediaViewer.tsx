// A night's photos and clips, shown inside Ask over the answer that led to them. Opening a frame
// used to leave Ask for the artist's gatefold, which buried the answer behind a page change for
// what is only a look. The gatefold is still one link away, for the setlist and the bill.
//
// A night here is the whole night, every act on the bill and the room, because Ask is not one
// act's gatefold. Every frame names its act, and an opener's says whose bill it was on.
//
// Three shapes, from the media mocks on the design canvas:
//   • one portrait photo: the photo beside its credits
//   • one clip: the player, its credits beneath
//   • a night of several: a bar with the place and the count, the stage, the credits, a strip

import { useEffect, useRef } from 'react'
import { Share } from 'lucide-react'
import { useMediaReel } from '@/hooks/useMediaReel'
import { useShareLink } from '@/hooks/useShareLink'
import { absoluteUrl, setlistDeepLink } from '@/utils/deepLinks'
import { analytics } from '@/services/analytics'
import { DEFAULT_GENRE_COLOR } from '@/constants/colors'
import type { AskViewerState } from './AskProvider'
import type { ArchiveLookups } from './types'
import { CameraMark, DerivedArt, LadderImage } from './AskMedia'
import {
  clipLength,
  cropAspect,
  focalPosition,
  frameLink,
  isClip,
  longDate,
  mediaId,
  viewerByline,
  viewerCredit,
  viewerKicker,
  viewerTitle,
  type ReelItem,
} from './media'

const SWIPE_THRESHOLD = 40

function BackButton({ onClose, buttonRef }: { onClose: () => void; buttonRef: React.RefObject<HTMLButtonElement> }) {
  return (
    <button ref={buttonRef} type="button" className="ask-viewer-back" onClick={onClose}>
      <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
        <path d="M8 2L2 8l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="long">Back to the answer</span>
      <span className="short">Answer</span>
    </button>
  )
}


function Thumb({ item, current, onPick }: { item: ReelItem; current: boolean; onPick: () => void }) {
  const fallback = <DerivedArt name={item.artist ?? 'The room'} color={DEFAULT_GENRE_COLOR} />
  const label = `${isClip(item) ? 'Clip' : 'Photo'}: ${viewerTitle(item)}`
  return (
    <button type="button" className="ask-viewer-thumb" aria-label={label} aria-current={current ? 'true' : undefined} onClick={onPick}>
      {isClip(item) ? (
        <LadderImage sources={[item.poster]} alt="" fallback={fallback} />
      ) : (
        <LadderImage sources={[item.url]} alt="" style={{ objectPosition: focalPosition(item, 1) }} fallback={fallback} />
      )}
      {isClip(item) && (
        <span className="dur" aria-hidden="true">
          <svg width="7" height="8" viewBox="0 0 12 14"><path d="M1 1l10 6-10 6z" fill="#fff" /></svg>
          {item.duration ? clipLength(item.duration) : 'Clip'}
        </span>
      )}
    </button>
  )
}

export function AskMediaViewer({ viewer, archive, onClose }: { viewer: AskViewerState; archive: ArchiveLookups; onClose: () => void }) {
  const night = archive.concertByDate(viewer.date)
  const { index, item, many, go, goTo, onClipPlay, onClipPause, onClipEnded, mediaParams } = useMediaReel({
    reel: viewer.reel,
    initialId: viewer.initialId,
    date: viewer.date,
    artistName: (it) => it.artist ?? night?.headliner ?? '',
    surface: 'ask',
    initialSource: 'button',
  })
  const backRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const touchX = useRef<number | null>(null)
  // Only the frame it opened on plays by itself: a clip was asked for by the tap that opened it.
  const firstFrame = useRef(true)

  const headliner = night?.headlinerNormalized ?? ''
  const title = item ? viewerTitle(item) : ''
  const { share, status } = useShareLink({
    url: item ? absoluteUrl(frameLink(item, headliner)) : '',
    title: night ? `${title} at ${night.venue}` : title,
    analyticsEvent: { name: 'photo_link_shared', params: { ...mediaParams, surface: 'ask' } },
  })

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!firstFrame.current) return
    firstFrame.current = false
    if (item && isClip(item)) videoRef.current?.play().catch(() => undefined)
    // The first frame only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The arrow keys page, except in the box (the caret) or on the player (seeking).
  useEffect(() => {
    if (!many) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, video')) return
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, many])

  // Keep the frame on show in view in the strip.
  useEffect(() => {
    const on = stripRef.current?.querySelector<HTMLElement>('[aria-current="true"]')
    const strip = stripRef.current
    if (!on || !strip) return
    const left = on.offsetLeft - strip.offsetLeft
    if (left < strip.scrollLeft || left + on.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: left - strip.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' })
    }
  }, [index])

  if (!night || !item) return null

  const where = [night.venue, night.city].filter(Boolean).join(', ')
  const whole = setlistDeepLink(item.artistNormalized ?? headliner, viewer.date)
  const onWhole = () => analytics.trackEvent('ask_deeplink_clicked', { kind: 'media_viewer', target_scene: 'artists' })
  const shareButton = (
    <button type="button" className="ask-viewer-share" onClick={share} aria-label={`Share this ${isClip(item) ? 'clip' : 'photo'}`}>
      <Share size={14} aria-hidden="true" />
      <span aria-live="polite">{status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : 'Share'}</span>
    </button>
  )
  const label = `${title}, ${where}, ${longDate(viewer.date)}`

  // One portrait photo: the photo beside its credits, as the solo mock.
  if (!many && !isClip(item) && cropAspect(item) <= 1) {
    return (
      <section className="ask-viewer solo" aria-label={label}>
        <figure className="ask-viewer-pic">
          <img src={item.url} alt={`${title}, ${viewerCredit(item, night)}`} style={{ objectPosition: focalPosition(item, 0.68) }} />
        </figure>
        <div className="ask-viewer-info">
          <div>
            <BackButton onClose={onClose} buttonRef={backRef} />
          </div>
          <div className="grow" />
          <span className="k">{viewerKicker(item, 1)}</span>
          <h2 className="t">{title}</h2>
          <p className="place">{where}</p>
          <p className="place">{longDate(viewer.date)}</p>
          <p className="by">
            <CameraMark /> {viewerByline(item, night)}
          </p>
          <div className="foot">
            <a className="ask-viewer-whole" href={whole} onClick={onWhole}>
              The whole night: setlist and the bill <span aria-hidden="true">→</span>
            </a>
            {shareButton}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="ask-viewer" aria-label={label}>
      <div className="ask-viewer-bar">
        <BackButton onClose={onClose} buttonRef={backRef} />
        <span className="where">
          {where} · {longDate(viewer.date)}
        </span>
        {many && (
          <span className="count" aria-live="polite">
            {index + 1} of {viewer.reel.length}
          </span>
        )}
      </div>

      <div
        className="ask-viewer-stage"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchX.current
          const end = e.changedTouches[0]?.clientX
          touchX.current = null
          if (start == null || end == null || !many) return
          if (Math.abs(end - start) > SWIPE_THRESHOLD) go(end < start ? 1 : -1)
        }}
      >
        {isClip(item) ? (
          <video
            ref={videoRef}
            key={item.url}
            src={item.url}
            poster={item.poster ?? undefined}
            controls
            playsInline
            preload="metadata"
            aria-label={`Video: ${title}, ${viewerCredit(item, night)}`}
            onPlay={onClipPlay}
            onPause={onClipPause}
            onEnded={onClipEnded}
          />
        ) : (
          <img key={item.url} src={item.url} alt={`${title}, ${viewerCredit(item, night)}`} />
        )}
        {many && (
          <>
            <button type="button" className="ask-viewer-arrow prev" onClick={() => go(-1)} aria-label="Previous">
              <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
                <path d="M8 2L2 8l6 6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="ask-viewer-arrow next" onClick={() => go(1)} aria-label="Next">
              <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
                <path d="M2 2l6 6-6 6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="ask-viewer-cap">
        <div className="txt">
          <span className="k">{viewerKicker(item, viewer.reel.length)}</span>
          <span className="t">{title}</span>
          <span className="c">{viewerCredit(item, night)}</span>
        </div>
        <a className="ask-viewer-whole" href={whole} onClick={onWhole}>
          The whole night <span aria-hidden="true">→</span>
        </a>
        {shareButton}
      </div>

      {many && (
        <div className="ask-viewer-strip" ref={stripRef} role="group" aria-label="Every photo and clip from this night">
          {viewer.reel.map((r, i) => (
            <Thumb key={mediaId(r)} item={r} current={i === index} onPick={() => goTo(i)} />
          ))}
        </div>
      )}
    </section>
  )
}
