/**
 * PhotosPanel — the owner's photographs from one night
 *
 * Slides out of the gatefold exactly as SetlistPanel does, on the same paper, so a print
 * tucked into the sleeve reads as the same gesture as the liner notes. One photo at a time,
 * hero first, with the rest of the bill and the room after it (`nightReel`).
 *
 * The crops are almost all 4:5 and the panel is square, so the spare width becomes a fixed
 * rail for the controls. Nothing sits on a face, and the arrows never move under the cursor
 * while someone clicks through. Clicking the photo opens the full-size viewer, which is the
 * only place a landscape original is seen whole.
 *
 * Desktop: slides from the left over the Spotify panel
 * Phone: full-screen overlay sliding from the right, photo above the controls
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { usePhotoViewer } from '../../ask/AskMedia'
import { focalPosition, photoCaption, type Photo } from '../../ask/media'
import { haptics } from '../../../utils/haptics'
import { analytics } from '../../../services/analytics'
import type { ArtistConcert } from './types'
import '../../ask/ask.css'

/** The frame every crop is shown in. 147 of 149 published crops are exactly this shape. */
const FRAME_ASPECT = 4 / 5
const CAPTION_HEIGHT = 44
const FRAME_INSET = 14
const SWIPE_THRESHOLD = 40

interface PhotosPanelProps {
  photos: Photo[]
  concert: ArtistConcert
  artistName: string
  artistSlug: string
  onClose: () => void
  isPhone?: boolean
  reducedMotion?: boolean
}

export function PhotosPanel({
  photos,
  concert,
  artistName,
  artistSlug,
  onClose,
  isPhone = false,
  reducedMotion = false
}: PhotosPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const touchX = useRef<number | null>(null)
  const [index, setIndex] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const many = photos.length > 1
  const photo = photos[index]

  const caption = useCallback(
    (p: Photo) =>
      photoCaption(p, {
        aboutAct: artistSlug,
        aboutDate: concert.date,
        venueOf: () => concert.venue,
        // Only known when this act topped the bill. Without it the caption names the frame's
        // act and the night, which is still true.
        headlinerOf: () => (concert.isHeadliner ? artistName : undefined)
      }),
    [artistName, artistSlug, concert]
  )

  const trackOpened = useMemo(
    () => (p: Photo) =>
      analytics.trackEvent('artist_photo_opened', {
        artist_name: artistName,
        concert_date: concert.date,
        subject: p.subject
      }),
    [artistName, concert.date]
  )
  const viewer = usePhotoViewer(caption, trackOpened)

  const go = useCallback(
    (step: number) => {
      haptics.light()
      setIndex((i) => (i + step + photos.length) % photos.length)
    },
    [photos.length]
  )

  // Focus close button when panel opens (accessibility), as SetlistPanel does
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

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

  // Fetch the neighbours now, so paging lands on a photo rather than a blank frame
  useEffect(() => {
    if (!many) return
    for (const step of [1, -1]) {
      const near = photos[(index + step + photos.length) % photos.length]
      new Image().src = near.url
    }
  }, [index, many, photos])

  const handleClose = () => {
    haptics.light()
    setIsClosing(true)
    setTimeout(onClose, reducedMotion ? 0 : isPhone ? 250 : 350)
  }

  if (!photo) return null

  const text = caption(photo)
  const objectPosition = focalPosition(photo, FRAME_ASPECT)
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      touchX.current = e.touches[0]?.clientX ?? null
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = touchX.current
      const end = e.changedTouches[0]?.clientX
      touchX.current = null
      if (start == null || end == null || !many) return
      if (Math.abs(end - start) > SWIPE_THRESHOLD) go(end < start ? 1 : -1)
    }
  }

  const frame = (
    <button
      type="button"
      key={photo.url}
      onClick={() => viewer.open(photos, index)}
      className="photos-panel-frame block w-full h-full overflow-hidden"
      style={{ cursor: 'zoom-in', borderRadius: '2px', boxShadow: '0 3px 14px rgba(0, 0, 0, 0.28)' }}
      aria-label={`Open photo: ${text}`}
    >
      <img
        src={photo.url}
        alt={text}
        className="w-full h-full block"
        style={{ objectFit: 'cover', objectPosition, background: '#1a1a1a' }}
      />
    </button>
  )

  const stepper = many && (
    <>
      <RailButton label="Previous photo" onClick={() => go(-1)}>‹</RailButton>
      <span className="font-sans text-[0.8125rem] text-[#6a6a60] tabular-nums whitespace-nowrap" aria-live="polite">
        {index + 1} of {photos.length}
      </span>
      <RailButton label="Next photo" onClick={() => go(1)}>›</RailButton>
    </>
  )

  if (isPhone) {
    return (
      <>
        <div
          className={`absolute inset-0 z-20 flex flex-col ${reducedMotion ? '' : 'transition-transform duration-300 ease-out'} ${
            isVisible && !isClosing ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ background: 'linear-gradient(135deg, #f5f5f0 0%, #e8e8e0 100%)' }}
          role="dialog"
          aria-modal="false"
          aria-label={`Photos of ${artistName} at ${concert.venue}`}
          {...swipe}
        >
          <div className="flex justify-end flex-shrink-0 px-2 pt-2">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className="w-11 h-11 flex items-center justify-center text-[#4a4a40] touchable-subtle"
              aria-label="Close photos"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-4">
            <div className="w-full" style={{ aspectRatio: String(FRAME_ASPECT), maxHeight: '100%' }}>
              {frame}
            </div>
          </div>
          <p className="flex-shrink-0 px-5 pt-3 font-sans text-[0.8125rem] leading-snug text-[#5a5a50] text-center">{text}</p>
          <div className="flex-shrink-0 flex items-center justify-center gap-4 pt-1 pb-6 min-h-[60px]">{stepper}</div>
        </div>
        {/* Outside the swipe target: React bubbles through portals, so a swipe in the viewer
            would otherwise page the panel behind it too. */}
        {viewer.element}
      </>
    )
  }

  // Responsive sizing: 460px on desktop/tablet landscape (1024px+), 400px on smaller viewports
  const panelSize = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 460 : 400
  const contentSize = panelSize - 20
  const frameHeight = contentSize - FRAME_INSET * 2 - CAPTION_HEIGHT
  const frameWidth = Math.round(frameHeight * FRAME_ASPECT)

  return (
    <div
      className={`absolute top-0 right-0 photos-panel ${isClosing ? 'liner-notes-panel-closing' : 'liner-notes-panel'}`}
      style={{
        width: `${panelSize}px`,
        height: `${panelSize}px`,
        zIndex: 25, // Above Spotify panel (20) but below cover (30)
        background: 'linear-gradient(135deg, #f5f5f0 0%, #e8e8e0 100%)',
        padding: '10px'
      }}
      role="dialog"
      aria-modal="false"
      aria-label={`Photos of ${artistName} at ${concert.venue}`}
    >
      <div
        className="w-full h-full liner-notes-paper relative"
        style={{
          borderRadius: '4px',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6), inset -2px 0 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(180, 170, 150, 0.3)'
        }}
      >
        <div
          className="absolute top-[14px] left-[14px]"
          style={{ width: `${frameWidth}px`, height: `${frameHeight}px` }}
        >
          {frame}
        </div>

        {/* The rail: whatever width the 4:5 frame leaves over. */}
        <div
          className="absolute top-[14px] right-0 flex flex-col items-center"
          style={{ left: `${FRAME_INSET + frameWidth}px`, height: `${frameHeight}px` }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="w-11 h-11 flex items-center justify-center text-[#4a4a40] hover:text-[#1DB954] transition-all duration-150 hover:scale-110 touchable-subtle"
            aria-label="Close photos"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center gap-1">{stepper}</div>
        </div>

        <p
          className="absolute left-[14px] right-[14px] font-sans text-[0.8125rem] leading-snug text-[#5a5a50] overflow-hidden"
          style={{ top: `${FRAME_INSET + frameHeight + 8}px`, height: `${CAPTION_HEIGHT - 8}px` }}
        >
          {text}
        </p>
      </div>
      {viewer.element}
    </div>
  )
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-11 h-11 flex items-center justify-center font-sans text-[1.75rem] leading-none text-[#4a4a40] hover:text-[#1DB954] transition-colors duration-150 touchable-subtle"
      aria-label={label}
    >
      {children}
    </button>
  )
}
