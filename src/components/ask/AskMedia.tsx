// The image atoms every exhibit card draws with (#593). Selection, framing and captions are pure
// functions in ./media.ts; this file is the rendering and the RUNTIME half of the fallback ladder:
// whatever a card picks, a URL that fails to load drops to the next tier instead of leaving a
// broken image. The last tier (DerivedArt) makes no request, so it cannot fail.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { coverUrls, cropAspect, focalPosition, yearOf, type Photo } from './media'
import type { AlbumIdentity } from '@/types/exhibit'
import { useAlbumCover } from './albumCovers'

/**
 * Tries each source in order; on a load error moves to the next; renders `fallback` when none is
 * left (or none was given). Lazy by default — a list card can carry a dozen of these.
 */
export function LadderImage({
  sources,
  alt,
  className,
  style,
  fallback,
  eager = false,
  wrap,
}: {
  sources: Array<string | null | undefined>
  alt: string
  className?: string
  style?: CSSProperties
  fallback: ReactNode
  eager?: boolean
  /** Decorate the image while it is showing (a caption, a map inset) — dropped with it on failure. */
  wrap?: (img: ReactNode) => ReactNode
}) {
  const list = sources.filter((s): s is string => !!s)
  const key = list.join('|')
  const [failed, setFailed] = useState<{ key: string; n: number }>({ key, n: 0 })
  const n = failed.key === key ? failed.n : 0 // a new source list starts from the top
  if (n >= list.length) return <>{fallback}</>
  const img = (
    <img
      key={list[n]}
      src={list[n]}
      alt={alt}
      className={className}
      style={style}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed({ key, n: n + 1 })}
    />
  )
  return <>{wrap ? wrap(img) : img}</>
}

/**
 * The derived floor: the genre colour with the name set over it. Never bare type on nothing —
 * it is a composed tile, and it is what every other tier falls to.
 */
export function DerivedArt({
  name,
  color,
  shape = 'tile',
  sub,
  className = '',
}: {
  name: string
  color: string
  shape?: 'tile' | 'round' | 'sleeve'
  /** A second line (an album's year). */
  sub?: string
  className?: string
}) {
  // A stable per-title tint for sleeves: ±36° around the genre hue.
  const tint = shape === 'sleeve' ? ([...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 73) - 36 : 0
  const initials = name
    .replace(/^the\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div role="img" aria-label={name} className={`ask-derived ask-derived-${shape} ${className}`} style={{ '--genre': color, '--tint': `${tint}deg` } as CSSProperties}>
      <span className="ring" aria-hidden="true" />
      {shape === 'sleeve' ? (
        <span className="t">
          <span className="n">{name}</span>
          {sub && <span className="s">{sub}</span>}
        </span>
      ) : (
        <span className="m" aria-hidden="true">{initials}</span>
      )}
    </div>
  )
}

/**
 * One of my photographs in a box of `aspect` (w ÷ h), positioned on the owner's crop. When `aspect`
 * is omitted the box takes the crop's own aspect, which shows exactly the frame the owner drew.
 * A missing file falls to `fallback`.
 */
export function FramedPhoto({
  photo,
  aspect,
  alt,
  className = '',
  fallback,
  eager,
}: {
  photo: Photo
  aspect?: number
  alt: string
  className?: string
  fallback: ReactNode
  eager?: boolean
}) {
  const a = aspect ?? cropAspect(photo)
  return (
    <LadderImage
      sources={[photo.url]}
      alt={alt}
      className={`ask-framed ${className}`}
      style={{ aspectRatio: String(a), objectPosition: focalPosition(photo, a) }}
      fallback={fallback}
      eager={eager}
    />
  )
}

/**
 * An album sleeve: the build-time iTunes cover, then Cover Art Archive, else the derived sleeve
 * with the title. While the iTunes index is still loading it shows the derived sleeve.
 */
export function CoverArt({
  album,
  size = 250,
  color,
  className = '',
  fallback,
}: {
  album: AlbumIdentity
  size?: 250 | 500
  color: string
  className?: string
  /** What to show when no sleeve loads. Default: the derived sleeve with the title. */
  fallback?: ReactNode
}) {
  const itunes = useAlbumCover(album.mbid)
  const sleeve = fallback ?? <DerivedArt name={album.title} sub={yearOf(album.releaseDate)} color={color} shape="sleeve" className={className} />
  return (
    <LadderImage
      sources={itunes === undefined ? [] : coverUrls(album.mbid, size, itunes, album.coverAvailable)}
      alt={`${album.title} cover`}
      className={`ask-cover ${className}`}
      fallback={sleeve}
    />
  )
}

/** Inline stroke camera mark: "this one is my photo". */
export function CameraMark({ size = 14 }: { size?: number }) {
  return (
    <svg className="ask-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------------------------

export interface ViewerState {
  photos: Photo[]
  index: number
}

/**
 * Full-size view of my photographs with the full caption. Portalled to <body>: the exhibit card
 * has a backdrop-filter, which would make it the containing block for a fixed overlay.
 *
 * Keys are caught on `window` in the CAPTURE phase so Escape closes the photo and not the
 * Spotlight underneath (whose handler listens on `document`), and Tab stays inside the viewer.
 */
export function Lightbox({
  state,
  caption,
  onClose,
  onIndex,
}: {
  state: ViewerState
  caption: (p: Photo) => string
  onClose: () => void
  onIndex: (i: number) => void
}) {
  const { photos, index } = state
  const photo = photos[index]
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowRight' && photos.length > 1) {
        e.stopPropagation()
        go(1)
      } else if (e.key === 'ArrowLeft' && photos.length > 1) {
        e.stopPropagation()
        go(-1)
      } else if (e.key === 'Tab') {
        // Cycle through the VISIBLE controls only — prev/next are display:none on a phone, and a
        // trap that counts them lets Tab walk straight out of the viewer.
        e.stopPropagation()
        e.preventDefault()
        const f = [...(rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])].filter(
          (el) => el.offsetParent !== null,
        )
        if (!f.length) return
        const at = f.indexOf(document.activeElement as HTMLElement)
        const next = at === -1 ? 0 : (at + (e.shiftKey ? -1 : 1) + f.length) % f.length
        f[next].focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, onClose, photos.length])

  // Swipe left/right to page on a phone, where the arrow buttons are hidden.
  const touchX = useRef<number | null>(null)

  if (!photo) return null
  const text = caption(photo)
  return createPortal(
    <div
      ref={rootRef}
      className="ask-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={text}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ask-lightbox-bar">
        <span className="count">{photos.length > 1 ? `${index + 1} of ${photos.length}` : ''}</span>
        <button ref={closeRef} type="button" className="ask-lightbox-btn" onClick={onClose} aria-label="Close photo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div
        className="ask-lightbox-stage"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchX.current
          touchX.current = null
          const end = e.changedTouches[0]?.clientX
          if (start == null || end == null || photos.length < 2) return
          if (Math.abs(end - start) > 40) go(end < start ? 1 : -1)
        }}
      >
        {photos.length > 1 && (
          <button type="button" className="ask-lightbox-btn nav prev" onClick={() => go(-1)} aria-label="Previous photo">
            ‹
          </button>
        )}
        <img src={photo.url} alt={text} />
        {photos.length > 1 && (
          <button type="button" className="ask-lightbox-btn nav next" onClick={() => go(1)} aria-label="Next photo">
            ›
          </button>
        )}
      </div>
      <p className="ask-lightbox-cap">
        <CameraMark /> {text}
      </p>
    </div>,
    document.body,
  )
}

/** One lightbox per card: `open(photos, i)` shows it, `element` renders it. */
export function usePhotoViewer(caption: (p: Photo) => string, onOpen?: (p: Photo) => void) {
  const [state, setState] = useState<ViewerState | null>(null)
  const open = useCallback(
    (photos: Photo[], index = 0) => {
      if (!photos.length) return
      setState({ photos, index })
      onOpen?.(photos[index])
    },
    [onOpen],
  )
  const element = state ? (
    <Lightbox state={state} caption={caption} onClose={() => setState(null)} onIndex={(i) => setState((s) => (s ? { ...s, index: i } : s))} />
  ) : null
  return { open, element }
}
