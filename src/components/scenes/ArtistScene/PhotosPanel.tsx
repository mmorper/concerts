/**
 * PhotosPanel — the owner's photographs and videos from one night
 *
 * Slides out of the gatefold exactly as SetlistPanel does, one image at a time, full bleed, with
 * the same credits as a social card over it: the byline top-left, the venue and month at the foot
 * (scripts/syndication/render-card.ts). Order is `nightReel`: this act only, hero leading, then
 * the room.
 *
 * The frame is square on desktop, so a 4:5 crop loses height. It keeps the TOP of the owner's crop
 * and gives up the bottom, because a stage shot is a face above a guitar. Clicking a still opens
 * the full-size viewer, the only place a whole landscape original is seen.
 *
 * Desktop: slides from the left over the Spotify panel, with everything on the image
 * Phone: full-screen overlay sliding from the right. The photo is the full width at 3:4 and the
 * credits sit beneath it, as they sit beside it on a share image, because a phone has the room
 * and a thumb has no business aiming at an overlay. Swiping pages, and dots show there is more.
 * Held sideways, the photo takes the height and the credits move beside it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Link2, X } from 'lucide-react'
import { usePhotoViewer } from '../../ask/AskMedia'
import {
  bylineDate,
  focalPosition,
  isClip,
  mediaId,
  monthYear,
  photoCaption,
  type Photo,
  type ReelItem
} from '../../ask/media'
import { useShareLink } from '../../../hooks/useShareLink'
import { absoluteUrl, photoDeepLink } from '../../../utils/deepLinks'
import { haptics } from '../../../utils/haptics'
import { analytics } from '../../../services/analytics'
import type { ArtistConcert } from './types'
import '../../ask/ask.css'

/** A phone has height to spare, and most masters are exactly this shape. */
const PHONE_ASPECT = 3 / 4
const SWIPE_THRESHOLD = 40

/** The social card's byline chip and scrim, so the two read as one voice. */
const CHIP_BACKGROUND = 'rgba(8, 10, 16, 0.58)'
const SCRIM = 'linear-gradient(to bottom, rgba(9,11,18,0) 0%, rgba(9,11,18,0.78) 52%, rgba(9,11,18,0.95) 100%)'
const OVERLAY_BUTTON =
  'w-11 h-11 rounded-full flex items-center justify-center text-white/90 hover:text-white transition-colors duration-150 touchable-subtle'

interface PhotosPanelProps {
  reel: ReelItem[]
  /** `mediaId` to open on, from a share link. Falls back to the first image. */
  initialId?: string | null
  concert: ArtistConcert
  artistName: string
  artistSlug: string
  onClose: () => void
  isPhone?: boolean
  reducedMotion?: boolean
}

export function PhotosPanel({
  reel,
  initialId = null,
  concert,
  artistName,
  artistSlug,
  onClose,
  isPhone = false,
  reducedMotion = false
}: PhotosPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const touchX = useRef<number | null>(null)
  const [index, setIndex] = useState(() => {
    const at = initialId ? reel.findIndex((item) => mediaId(item) === initialId) : -1
    return at === -1 ? 0 : at
  })
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  // How the next frame is reached. Only the first can be anything but paging.
  const viewSource = useRef<'button' | 'deep_link' | 'paging'>(initialId ? 'deep_link' : 'button')
  // A pause and a resume are one play, so each view of a clip counts once.
  const clipPlayed = useRef(false)
  const clipCompleted = useRef(false)

  const many = reel.length > 1
  const item = reel[index]
  const stills = useMemo(() => reel.filter((r): r is Photo => !isClip(r)), [reel])
  const itemId = item ? mediaId(item) : ''
  const mediaKind = item && isClip(item) ? 'video' : 'photo'
  const mediaParams = useMemo(
    () => ({ artist_name: artistName, concert_date: concert.date, photo: itemId }),
    [artistName, concert.date, itemId]
  )

  const caption = useCallback(
    (p: Photo) =>
      photoCaption(p, {
        aboutAct: artistSlug,
        aboutDate: concert.date,
        venueOf: () => concert.venue,
        headlinerOf: () => undefined
      }),
    [artistSlug, concert]
  )

  const trackOpened = useMemo(
    () => (p: Photo) =>
      analytics.trackEvent('artist_photo_opened', {
        artist_name: artistName,
        concert_date: concert.date,
        photo: mediaId(p),
        subject: p.subject
      }),
    [artistName, concert.date]
  )
  const viewer = usePhotoViewer(caption, trackOpened)

  const { share, status: shareStatus } = useShareLink({
    url: item ? absoluteUrl(photoDeepLink(artistSlug, concert.date, mediaId(item))) : '',
    title: `${artistName} at ${concert.venue}`,
    isPhone,
    analyticsEvent: {
      name: 'photo_link_shared',
      params: mediaParams
    }
  })

  // The panel opens without a click on a share link and pages without a request, so this is the
  // one place that sees every frame. Paging back to a frame is a new view of it.
  useEffect(() => {
    if (!mediaParams.photo) return
    analytics.trackEvent('media_viewed', { ...mediaParams, media_kind: mediaKind, view_source: viewSource.current })
    viewSource.current = 'paging'
    clipPlayed.current = false
    clipCompleted.current = false
  }, [mediaParams, mediaKind])

  const go = useCallback(
    (step: number) => {
      haptics.light()
      setIsPlaying(false)
      setIndex((i) => (i + step + reel.length) % reel.length)
    },
    [reel.length]
  )

  // Focus close button when panel opens (accessibility), as SetlistPanel does
  // Desktop only, as with the setlist overlay. On a phone the panel starts off-screen, and Safari
  // scrolled the modal sideways to reach a focused button, leaving the whole panel shifted and
  // clipped. Chromium never showed it, so only the iOS Simulator caught it.
  useEffect(() => {
    if (!isPhone) closeButtonRef.current?.focus({ preventScroll: true })
  }, [isPhone])

  // Phone overlay slides on a transition rather than the panel keyframes
  useEffect(() => {
    if (!isPhone) return
    if (reducedMotion) {
      setIsVisible(true)
      return
    }
    requestAnimationFrame(() => setIsVisible(true))
  }, [isPhone, reducedMotion])

  // The viewer handles its own keys in the capture phase and stops them, so this never pages
  // the panel behind an open lightbox.
  useEffect(() => {
    if (!many) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, many])

  // Fetch the neighbouring stills now, so paging lands on a photo rather than a blank frame
  useEffect(() => {
    if (!many) return
    for (const step of [1, -1]) {
      const near = reel[(index + step + reel.length) % reel.length]
      if (!isClip(near)) new Image().src = near.url
    }
  }, [index, many, reel])

  const handleClose = () => {
    haptics.light()
    setIsClosing(true)
    setTimeout(onClose, reducedMotion ? 0 : isPhone ? 250 : 350)
  }

  if (!item) return null

  const handleClipPlay = () => {
    setIsPlaying(true)
    if (clipPlayed.current) return
    clipPlayed.current = true
    analytics.trackEvent('clip_played', { ...mediaParams, song: item.song ?? undefined })
  }

  const handleClipEnded = () => {
    setIsPlaying(false)
    if (clipCompleted.current) return
    clipCompleted.current = true
    analytics.trackEvent('clip_completed', { ...mediaParams, song: item.song ?? undefined })
  }

  const aspect = isPhone ? PHONE_ASPECT : 1
  const footerHidden = isClip(item) && isPlaying

  const actions = (
    <div className="flex items-center gap-1">
      <div className="relative">
        <button
          type="button"
          onClick={share}
          className={OVERLAY_BUTTON}
          style={{ background: CHIP_BACKGROUND }}
          aria-label={`Copy link to this ${isClip(item) ? 'video' : 'photo'}`}
          title="Copy link"
        >
          <Link2 size={18} />
        </button>
        {(shareStatus === 'copied' || shareStatus === 'error') && (
          <div
            className="absolute top-full right-0 mt-1 px-2 py-1 bg-black/90 text-white text-xs font-medium rounded shadow-lg animate-fade-in pointer-events-none whitespace-nowrap z-10"
            role="status"
            aria-live="polite"
          >
            {shareStatus === 'copied' ? 'Copied!' : 'Copy failed'}
          </div>
        )}
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        onClick={handleClose}
        className={OVERLAY_BUTTON}
        style={{ background: CHIP_BACKGROUND }}
        aria-label="Close photos"
      >
        <X size={20} strokeWidth={2.5} />
      </button>
    </div>
  )

  const stage = (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#090b12' }}>
      {isClip(item) ? (
        <video
          key={item.url}
          src={item.url}
          poster={item.poster ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="photos-panel-frame block w-full h-full"
          style={{ objectFit: 'contain' }}
          aria-label={`Video of ${item.artist ?? artistName} at ${concert.venue}`}
          onPlay={handleClipPlay}
          onPause={() => setIsPlaying(false)}
          onEnded={handleClipEnded}
        />
      ) : (
        <button
          type="button"
          key={item.url}
          onClick={() => viewer.open(stills, stills.indexOf(item))}
          className="photos-panel-frame block w-full h-full"
          style={{ cursor: 'zoom-in' }}
          aria-label={`Open photo: ${caption(item)}`}
        >
          <img
            src={item.url}
            alt={caption(item)}
            className="block w-full h-full"
            style={{ objectFit: 'cover', objectPosition: focalPosition(item, aspect, 0) }}
          />
        </button>
      )}

      {/* Byline: one state, the capture date, as on the cards. It stays on the picture on a
          phone too, because it is a claim about the picture, but at the foot as on the wide
          card, where the taller frame would otherwise put it across a performer's hair. */}
      {!(isPhone && isClip(item)) && (
      <span
        className={`absolute ${isPhone ? 'bottom-3' : 'top-3'} left-3 font-sans ${isPhone ? 'text-xs landscape:text-[0.625rem]' : 'text-xs'} font-semibold text-white/80 rounded-full px-3 py-1.5 pointer-events-none whitespace-nowrap`}
        style={{ background: CHIP_BACKGROUND, letterSpacing: '0.03em' }}
      >
        Mike Morper · {bylineDate(item.date)}
      </span>
      )}

      {!isPhone && <div className="absolute top-1.5 right-1.5">{actions}</div>}

      {many && !isPhone && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className={`${OVERLAY_BUTTON} absolute left-1.5 top-1/2 -translate-y-1/2`}
            style={{ background: CHIP_BACKGROUND }}
            aria-label="Previous photo"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className={`${OVERLAY_BUTTON} absolute right-1.5 top-1/2 -translate-y-1/2`}
            style={{ background: CHIP_BACKGROUND }}
            aria-label="Next photo"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* The card's foot. A video's own controls need this space, so it steps aside on play. */}
      {!footerHidden && !isPhone && (
        <div
          className="absolute left-0 right-0 bottom-0 px-5 pb-4 pt-14 flex items-end justify-between gap-3 pointer-events-none"
          style={{ background: SCRIM }}
        >
          <p className="font-sans text-[0.8125rem] font-medium leading-snug min-w-0" style={{ color: '#9b90bd' }}>
            {item.song && <span className="block text-white">{item.song}</span>}
            <span className="block">
              {concert.venue} · {concert.city}
            </span>
            <span className="block">{monthYear(item.date)}</span>
          </p>
          {many && (
            <span
              className="font-sans text-xs font-medium tabular-nums whitespace-nowrap flex-shrink-0"
              style={{ color: '#9b90bd' }}
              aria-live="polite"
            >
              {index + 1} of {reel.length}
            </span>
          )}
        </div>
      )}
    </div>
  )

  if (isPhone) {
    // The same two lines as a share image: the act leads, and a frame of the room leads with the venue.
    const aboutTheAct = item.subject === 'artist'
    const phoneTitle = aboutTheAct ? (item.artist ?? artistName) : concert.venue
    const phonePlace = aboutTheAct ? `${concert.venue} · ${concert.city}` : concert.city
    return (
      <>
        <div
          className={`absolute inset-0 z-20 flex flex-col landscape:flex-row pt-14 landscape:pt-0 ${reducedMotion ? '' : 'transition-transform duration-300 ease-out'} ${
            isVisible && !isClosing ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ background: '#090b12' }}
          role="dialog"
          aria-modal="false"
          aria-label={`Photos of ${artistName} at ${concert.venue}`}
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
          <div className="absolute top-1.5 right-1.5 z-10">{actions}</div>
          <div
            className="min-h-0 overflow-hidden w-full landscape:w-auto landscape:h-full landscape:flex-shrink-0"
            style={{ aspectRatio: String(PHONE_ASPECT) }}
          >
            {stage}
          </div>
          {/* The credits always fit. On a small phone it is the photo that gives up height. */}
          <div className="flex-grow flex-shrink-0 landscape:flex-shrink min-w-0 flex flex-col px-5 pt-4 pb-5 landscape:pt-14">
            <h3 className="font-serif text-[1.75rem] leading-tight text-white">{phoneTitle}</h3>
            <p className="font-sans text-sm font-medium leading-snug mt-1.5" style={{ color: '#9b90bd' }}>
              {item.song && <span className="block text-white">{item.song}</span>}
              {phonePlace}
              <span className="block">{monthYear(item.date)}</span>
              {/* A video's own controls sit where the chip goes, so its credit comes down here. */}
              {isClip(item) && <span className="block mt-1 text-xs text-white/70">Mike Morper · {bylineDate(item.date)}</span>}
            </p>
            {many && (
              <div className="mt-auto pt-3 flex flex-wrap justify-center gap-1.5" aria-hidden="true">
                {reel.map((r, i) => (
                  <span
                    key={r.url}
                    className="w-1.5 h-1.5 rounded-full transition-colors duration-150"
                    style={{ background: i === index ? '#fff' : 'rgba(255, 255, 255, 0.28)' }}
                  />
                ))}
              </div>
            )}
            {many && (
              <span className="sr-only" aria-live="polite">
                {index + 1} of {reel.length}
              </span>
            )}
          </div>
        </div>
        {/* Outside the swipe target: React bubbles through portals, so a swipe in the viewer
            would otherwise page the panel behind it too. */}
        {viewer.element}
      </>
    )
  }

  // Responsive sizing: 460px on desktop/tablet landscape (1024px+), 400px on smaller viewports
  const panelSize = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 460 : 400

  return (
    <div
      className={`absolute top-0 right-0 photos-panel ${isClosing ? 'liner-notes-panel-closing' : 'liner-notes-panel'}`}
      style={{
        width: `${panelSize}px`,
        height: `${panelSize}px`,
        zIndex: 25, // Above Spotify panel (20) but below cover (30)
        borderRadius: '4px',
        overflow: 'hidden',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)'
      }}
      role="dialog"
      aria-modal="false"
      aria-label={`Photos of ${artistName} at ${concert.venue}`}
    >
      {stage}
      {viewer.element}
    </div>
  )
}
