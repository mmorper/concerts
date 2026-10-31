// Pieces every exhibit card is built from (moved out of AskExhibit.tsx for #593 so the record
// cards in AskRecordCards.tsx can share them without a circular import).

import type { CSSProperties, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cleanProse } from './prose'
import { analytics } from '@/services/analytics'
import type { Exchange } from '@/hooks/useAskArchive'
import type { EntityRef, Exhibit } from '@/types/exhibit'
import type { ArchiveLookups } from './types'
import { BANNER_ASPECT, heroLayout, type CaptionContext, type Photo } from './media'
import { CameraMark, DerivedArt, FramedPhoto, LadderImage } from './AskMedia'

export const sceneOf = (deepLink: string): string => new URLSearchParams(deepLink.split('?')[1] ?? '').get('scene') ?? ''

export const trackDeepLink = (kind: Exhibit['kind'], href: string) =>
  analytics.trackEvent('ask_deeplink_clicked', { kind, target_scene: sceneOf(href) })

export function DeepLink({ href, kind, children }: { href: string; kind: Exhibit['kind']; children: ReactNode }) {
  return (
    <a className="deep" href={href} onClick={() => trackDeepLink(kind, href)}>
      {children} <span className="arr">→</span>
    </a>
  )
}

// The model may emit markdown — bold, lists, and (when asked) GFM tables. Render it, don't print
// raw pipes. Tables get a horizontal-scroll wrapper so they never blow out a narrow card.
export function Prose({ ex }: { ex: Exchange }) {
  if (!ex.prose && ex.status === 'streaming') return null
  return (
    <div className="ex-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ table: ({ node, ...props }) => <div className="ex-table-wrap"><table {...props} /></div> }}
      >
        {cleanProse(ex.prose)}
      </ReactMarkdown>
      {ex.status === 'streaming' && <span className="cursor" />}
    </div>
  )
}

export function ChipLink({ entity, kind, color, avatar }: { entity: EntityRef; kind: Exhibit['kind']; color?: string; avatar?: ReactNode }) {
  return (
    <a className={`chip ${avatar ? 'with-av' : ''}`} href={entity.deepLink} onClick={() => trackDeepLink(kind, entity.deepLink)}>
      {avatar}
      {!avatar && color && <span className="d" style={{ background: color }} />}
      {entity.name}
    </a>
  )
}

export function Frame({ color, children, className = '' }: { color: string; children: ReactNode; className?: string }) {
  return (
    <div className={`ask-exhibit ${className}`}>
      <div className="spine" style={{ background: color }} />
      <div className="body">{children}</div>
    </div>
  )
}

export const yearSpan = (a?: number, b?: number) => (a && b ? (a === b ? `${a}` : `${a}–${b}`) : '')

/** Caption lookups for a photo's own night, from the archive's concerts. */
export function captionLookups(archive: ArchiveLookups): Pick<CaptionContext, 'venueOf' | 'headlinerOf'> {
  return {
    venueOf: (d) => archive.concertByDate(d)?.venue,
    headlinerOf: (d) => archive.concertByDate(d)?.headliner,
  }
}

/** Analytics for opening one of my photos — which card, and whose frame it was. */
export const trackPhotoOpened = (kind: Exhibit['kind']) => (p: Photo) =>
  analytics.trackEvent('ask_photo_opened', { kind, subject: p.subject, date: p.date })

/** A button that opens a photo in the lightbox; the photo itself is the label. */
export function PhotoButton({
  onOpen,
  label,
  className = '',
  style,
  children,
}: {
  onOpen: () => void
  label: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <button type="button" className={`ask-photo-btn ${className}`} style={style} onClick={onOpen} aria-label={`Open photo: ${label}`}>
      {children}
    </button>
  )
}

/** A sourced portrait (Deezer), else the derived tile. Never my photo — that is the hero's job. */
export function Portrait({ name, image, color, className, round = false }: { name: string; image?: string; color: string; className: string; round?: boolean }) {
  return (
    <LadderImage
      sources={[image]}
      alt={name}
      className={className}
      fallback={<DerivedArt name={name} color={color} shape={round ? 'round' : 'tile'} className={className} />}
    />
  )
}

/**
 * The lead photo, framed so the owner's crop survives: a 3:2 banner when it keeps ≥80% of the crop,
 * otherwise the photo beside `side` at the crop's own aspect.
 */
export function PhotoHero({ photo, caption, onOpen, count, color, name, side }: {
  photo: Photo
  caption: string
  onOpen: () => void
  count: number
  color: string
  name: string
  side: ReactNode
}) {
  const derived = <DerivedArt name={name} color={color} className="ask-hero-derived" />
  if (heroLayout(photo) === 'banner') {
    return (
      <>
        <PhotoButton className="ask-hero banner" onOpen={onOpen} label={caption}>
          <FramedPhoto photo={photo} aspect={BANNER_ASPECT} alt={caption} fallback={derived} eager />
          <span className="ask-hero-cap">
            <CameraMark /> {caption}
          </span>
          {count > 1 && <span className="ask-hero-count">{count} photos</span>}
        </PhotoButton>
        {side}
      </>
    )
  }
  return (
    <div className="ask-hero-row">
      <PhotoButton className="ask-hero portrait" onOpen={onOpen} label={caption}>
        <FramedPhoto photo={photo} alt={caption} fallback={derived} eager />
        {count > 1 && <span className="ask-hero-count">{count} photos</span>}
      </PhotoButton>
      <div className="ask-hero-side">
        {side}
        <p className="ask-cap">
          <CameraMark /> {caption}
        </p>
      </div>
    </div>
  )
}

/** Up to five thumbnails; the last one carries "+N" when there are more. */
export function Filmstrip({ photos, label, onOpen, caption, name, color }: {
  photos: Photo[]
  label: ReactNode
  onOpen: (i: number) => void
  caption: (p: Photo) => string
  name: string
  color: string
}) {
  if (!photos.length) return null
  const shown = photos.slice(0, 5)
  const more = photos.length - shown.length
  return (
    <div className="ask-strip">
      <div className="ask-strip-head">{label}</div>
      <div className="ask-strip-row">
        {shown.map((p, i) => (
          <PhotoButton key={p.url} className="ask-strip-thumb" onOpen={() => onOpen(i)} label={caption(p)}>
            <FramedPhoto photo={p} aspect={1} alt={caption(p)} fallback={<DerivedArt name={name} color={color} />} />
            {more > 0 && i === shown.length - 1 && <span className="more">+{more}</span>}
          </PhotoButton>
        ))}
      </div>
    </div>
  )
}

