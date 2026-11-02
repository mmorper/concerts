// The gallery exhibit: what a request to see photos or clips returns. A lead frame, then a grid;
// when a clip leads, a poster with that night's photos beside it. Every tile links to that exact
// frame in its gatefold, and a frame names its own act and night, because a gallery can span
// several of both.

import { analytics } from '@/services/analytics'
import { DEFAULT_GENRE_COLOR } from '@/constants/colors'
import type { GalleryExhibit, GalleryItem } from '@/types/exhibit'
import type { ArchiveLookups } from './types'
import { DerivedArt, FramedPhoto, LadderImage } from './AskMedia'
import { Frame } from './AskCardParts'
import { actPhotosOnNight, findMedia, fmtDate, frameLink, isClip, venuePhotosOnNight, type Photo } from './media'

/** The lead takes four cells, so it and eight tiles fill three rows. With more to see, the last is the way to them. */
const CELLS = 9

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

/** Photos beside the clip poster. The last one becomes the way to the rest of them. */
const SIDE = 3

// A clip leads (Phase 6): a large poster that opens it in its gatefold, with that night's photos
// beside it: the act's own, then the room's, never another act on the bill, whose frame would read
// as this one. The column holds as many rows as it has photos, and a night with none gives the
// poster the width, so no empty slot ever shows. The photos come from the site's own index: a
// request for clips returns clips only.
function ClipPoster({ item, archive }: { item: GalleryItem; archive: ArchiveLookups }) {
  const media = findMedia(archive.media, item.date, item.id)
  const act = media?.artistNormalized ?? ''
  const photos = [...actPhotosOnNight(archive.media, item.date, act), ...venuePhotosOnNight(archive.media, item.date)]
  const side = photos.slice(0, SIDE)
  const venue = archive.concertByDate(item.date)?.venue
  const title = item.song ?? item.act ?? 'A clip'
  const sub = [item.song ? item.act : null, venue, fmtDate(item.date)].filter(Boolean).join(' · ')
  const length = item.duration ? `, ${Math.round(item.duration)} seconds` : ''
  const fallback = <DerivedArt name={item.act ?? title} color={DEFAULT_GENRE_COLOR} />
  return (
    <div className={`ask-clip ${side.length ? '' : 'solo'}`}>
      <a className="ask-clip-poster" href={item.deepLink} aria-label={`Play ${title}${length}`} onClick={() => track(item)}>
        {media && isClip(media) ? <LadderImage sources={[media.poster]} alt="" fallback={fallback} eager /> : fallback}
        <span className="shade" aria-hidden="true" />
        <span className="txt">
          <span className="t">{title}</span>
          <span className="s">{sub}</span>
        </span>
        <span className="play" aria-hidden="true">
          <svg width="19" height="22" viewBox="0 0 12 14"><path d="M1 1l10 6-10 6z" fill="#17143a" /></svg>
        </span>
      </a>
      {side.length > 0 && (
        <div className="ask-clip-side" style={{ ['--n' as string]: side.length }}>
          {side.map((p, i) => {
            const rest = i === side.length - 1 && photos.length > SIDE
            const label = rest ? `See all ${photos.length} photos` : `Open photo ${i + 1} of ${photos.length}`
            const href = frameLink(p, act)
            return (
              <a key={p.url} className="ask-clip-thumb" href={href} aria-label={label} onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'gallery', target_scene: 'artists', media_kind: 'image' })}>
                <FramedPhoto photo={p} aspect={1} alt="" fallback={<DerivedArt name={item.act ?? 'The room'} color={DEFAULT_GENRE_COLOR} />} />
                {rest && <span className="all">All {photos.length} photos</span>}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function GalleryCard({ exhibit, archive }: { exhibit: GalleryExhibit; archive: ArchiveLookups }) {
  const lead = exhibit.items[0]?.kind === 'video' ? exhibit.items[0] : null
  const items = lead ? exhibit.items.slice(1) : exhibit.items
  const total = lead ? exhibit.total - 1 : exhibit.total
  const tiles = items.slice(0, total > CELLS ? CELLS - 1 : CELLS)
  const more = total - tiles.length
  const next = items[tiles.length]
  return (
    <Frame>
      <div className="ask-list-title">{exhibit.title}</div>
      {lead && <ClipPoster item={lead} archive={archive} />}
      {tiles.length > 0 && (
        <div className={`ask-gallery ${lead ? 'after-clip' : ''}`}>
          {tiles.map((item) => (
            <Tile key={`${item.date}-${item.id}`} item={item} archive={archive} />
          ))}
          {more > 0 && next && (
            <a className="ask-gal-tile more" href={next.deepLink} onClick={() => track(next)}>
              {more} more
            </a>
          )}
        </div>
      )}
    </Frame>
  )
}
