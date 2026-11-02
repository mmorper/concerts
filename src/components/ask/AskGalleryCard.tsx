// The gallery exhibit: what a request to see photos or clips returns. A lead frame, then a grid.
// Every tile links to that exact frame in its gatefold, and a frame names its own act and night,
// because a gallery can span several of both.

import { analytics } from '@/services/analytics'
import { DEFAULT_GENRE_COLOR } from '@/constants/colors'
import type { Exchange } from '@/hooks/useAskArchive'
import type { GalleryExhibit, GalleryItem } from '@/types/exhibit'
import type { ArchiveLookups } from './types'
import { DerivedArt, FramedPhoto, LadderImage } from './AskMedia'
import { Frame, Prose } from './AskCardParts'
import { findMedia, fmtDate, isClip, type Photo } from './media'

/** A lead and seven tiles fill three rows. With more to see, the last cell is the way to them. */
const CELLS = 8

function caption(item: GalleryItem): string {
  const who = item.song ? `“${item.song}”` : (item.act ?? 'The room')
  return `${who} · ${fmtDate(item.date)}`
}

function track(item: GalleryItem) {
  analytics.trackEvent('ask_deeplink_clicked', { kind: 'gallery', target_scene: 'artists', media_kind: item.kind })
}

function Tile({ item, archive }: { item: GalleryItem; archive: ArchiveLookups }) {
  const media = findMedia(archive.media, item.date, item.id)
  if (!media) return null
  const label = item.act ? `${item.act}, ${caption(item)}` : caption(item)
  const fallback = <DerivedArt name={item.act ?? 'The room'} color={DEFAULT_GENRE_COLOR} />
  return (
    <a className="ask-gal-tile" href={item.deepLink} aria-label={`Open ${label}`} onClick={() => track(item)}>
      {isClip(media) ? (
        <LadderImage sources={[media.poster]} alt="" fallback={fallback} />
      ) : (
        <FramedPhoto photo={media as Photo} aspect={1} alt="" fallback={fallback} />
      )}
      {item.kind === 'video' && (
        <span className="play" aria-hidden="true">
          <svg width="11" height="13" viewBox="0 0 12 14"><path d="M1 1l10 6-10 6z" fill="#17143a" /></svg>
        </span>
      )}
      <span className="cap">{caption(item)}</span>
    </a>
  )
}

export function GalleryCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: GalleryExhibit; archive: ArchiveLookups }) {
  const tiles = exhibit.items.slice(0, exhibit.total > CELLS ? CELLS - 1 : CELLS)
  const more = exhibit.total - tiles.length
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <div className="ask-list-title">{exhibit.title}</div>
      <Prose ex={ex} />
      <div className="ask-gallery">
        {tiles.map((item) => (
          <Tile key={`${item.date}-${item.id}`} item={item} archive={archive} />
        ))}
        {more > 0 && exhibit.items[0] && (
          <a className="ask-gal-tile more" href={exhibit.items[0].deepLink} onClick={() => track(exhibit.items[0])}>
            {more} more in the gatefold
          </a>
        )}
      </div>
    </Frame>
  )
}
