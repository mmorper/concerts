// The record-shaped cards (#593): one album, an act's studio albums, one night's set.
// Album identity arrives in the envelope; covers, photos and every fallback resolve here.

import { getGenreColor, DEFAULT_GENRE_COLOR } from '@/constants/colors'
import { setlistDeepLink } from '@/utils/deepLinks'
import { normalizeArtistName } from '@/utils/normalize'
import type { Exchange } from '@/hooks/useAskArchive'
import type { AlbumExhibit, AlbumIdentity, DiscographyExhibit, ShowExhibit, SetSong } from '@/types/exhibit'
import type { ArchiveLookups } from './types'
import { CoverArt, DerivedArt, FramedPhoto, usePhotoViewer } from './AskMedia'
import { DeepLink, Frame, PhotoButton, PhotoHero, Portrait, Prose, captionLookups, trackPhotoOpened } from './AskCardParts'
import {
  actPhotosOnNight,
  billSlugs,
  fmtDate,
  leadPhoto,
  photoCaption,
  venuePhotosOnNight,
  yearOf,
  type Photo,
} from './media'

const genreColor = (archive: ArchiveLookups, slug: string | undefined): string => {
  if (!slug) return DEFAULT_GENRE_COLOR
  const f = archive.artistFacts(slug)
  const g = f.primaryGenre ?? f.meta?.genres?.[0]
  return g ? getGenreColor(g) : DEFAULT_GENRE_COLOR
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** A song row's record mark: the cover in miniature, or an empty box when nothing matched. */
function SongMark({ album, color }: { album: AlbumIdentity | null; color: string }) {
  if (!album) return <span className="ask-songmark none" aria-hidden="true" />
  return (
    <span className="ask-songmark" title={`${album.title} (${yearOf(album.releaseDate)})`}>
      <CoverArt album={album} color={color} />
    </span>
  )
}

/** The act's avatar: my photo of them (opens the lightbox), else Deezer, else the derived tile. */
function ActAvatar({ archive, slug, name, color, kind }: { archive: ArchiveLookups; slug: string; name: string; color: string; kind: 'album' | 'discography' }) {
  const lead = leadPhoto(archive.media, slug)
  const all = archive.media.byArtist.get(slug) ?? []
  const caption = (p: Photo) => photoCaption(p, { aboutAct: slug, ...captionLookups(archive) })
  const viewer = usePhotoViewer(caption, trackPhotoOpened(kind))
  const portrait = <Portrait name={name} image={archive.artistFacts(slug).meta?.image} color={color} className="ex-photo" />
  if (!lead) return portrait
  return (
    <>
      <PhotoButton className="ex-photo-btn" onOpen={() => viewer.open(all, all.indexOf(lead))} label={caption(lead)}>
        <FramedPhoto photo={lead} aspect={1} alt={caption(lead)} className="ex-photo" fallback={portrait} />
      </PhotoButton>
      {viewer.element}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// A · Album
// ---------------------------------------------------------------------------------------------

export function AlbumCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: AlbumExhibit; archive: ArchiveLookups }) {
  const a = exhibit.album
  const color = genreColor(archive, exhibit.artist?.slug)
  const live = exhibit.heardLive
  const meta = [exhibit.artistName, yearOf(a.releaseDate), exhibit.position && `studio album ${exhibit.position.index} of ${exhibit.position.total}`]
    .filter(Boolean)
    .join(' · ')

  const fromThis = (s: SetSong) => s.album?.mbid === a.mbid
  const asked = (s: SetSong) => !!exhibit.song && fold(s.title) === fold(exhibit.song)
  const performerSlug = live ? normalizeArtistName(live.performer) : ''
  const nightPhotos = live ? actPhotosOnNight(archive.media, live.date, performerSlug) : []
  const lookups = captionLookups(archive)
  const caption = (p: Photo) => photoCaption(p, { aboutAct: performerSlug, aboutDate: live?.date, ...lookups })
  const viewer = usePhotoViewer(caption, trackPhotoOpened('album'))
  const hits = live ? live.songs.filter(fromThis).length : 0
  const opening = live && normalizeArtistName(live.performer) !== live.headliner.slug

  return (
    <Frame color={color}>
      <div className="ask-album-head">
        <CoverArt album={a} size={500} color={color} className="ask-album-cover" />
        <div className="ask-album-title">
          <div className="ask-kick">Album</div>
          <div className="n">{a.title}</div>
          <div className="meta">{meta}</div>
          {exhibit.defining && <span className="ask-pill">Their defining record</span>}
        </div>
      </div>
      <Prose ex={ex} />
      {live && (
        <div className="ask-live">
          <div className="ask-live-head">
            {nightPhotos[0] && (
              <PhotoButton className="ask-live-photo" onOpen={() => viewer.open(nightPhotos, 0)} label={caption(nightPhotos[0])}>
                <FramedPhoto photo={nightPhotos[0]} aspect={1} alt={caption(nightPhotos[0])} fallback={<DerivedArt name={live.performer} color={color} />} />
              </PhotoButton>
            )}
            <div>
              <div className="ask-kick">The night I heard it</div>
              <div className="meta">
                {fmtDate(live.date)} · {live.venue.name}
                {opening ? ` · ${live.performer}, opening for ${live.headliner.name}` : ''}
              </div>
            </div>
          </div>
          <ol className="ask-set cols">
            {live.songs.map((s, i) => (
              <li key={`${i}-${s.title}`} className={[fromThis(s) ? 'hit' : '', asked(s) ? 'asked' : ''].join(' ')}>
                <span className="n">{i + 1}</span>
                <span className="t">{s.title}</span>
                {fromThis(s) && <SongMark album={a} color={color} />}
              </li>
            ))}
          </ol>
          {hits > 0 && (
            <div className="ask-note">
              {hits} of {live.songs.length} songs that night came off <em>{a.title}</em>.
            </div>
          )}
        </div>
      )}
      <div className="ask-links">
        {live && (
          <DeepLink href={setlistDeepLink(live.headliner.slug, live.date)} kind="album">
            See that night’s setlist
          </DeepLink>
        )}
        {exhibit.artist && (
          <DeepLink href={exhibit.artist.deepLink} kind="album">
            {exhibit.artist.name} on the site
          </DeepLink>
        )}
      </div>
      {viewer.element}
    </Frame>
  )
}

// ---------------------------------------------------------------------------------------------
// F · Discography
// ---------------------------------------------------------------------------------------------

export function DiscographyCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: DiscographyExhibit; archive: ArchiveLookups }) {
  const { artist, albums } = exhibit
  const color = genreColor(archive, artist.slug)
  const seenCycles = albums.filter((a) => a.seen.length > 0).length
  const first = albums[0]
  const last = albums[albums.length - 1]
  const span = first && last ? `${yearOf(first.releaseDate)}–${yearOf(last.releaseDate)}` : ''
  const meta = [
    `${albums.length} studio ${albums.length === 1 ? 'album' : 'albums'}`,
    span,
    seenCycles ? `seen in ${seenCycles} album ${seenCycles === 1 ? 'cycle' : 'cycles'}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Frame color={color}>
      <div className="ex-head">
        <ActAvatar archive={archive} slug={artist.slug} name={artist.name} color={color} kind="discography" />
        <div className="ex-title">
          <div className="n">{artist.name}</div>
          <div className="meta">
            <span className="gd" style={{ background: color }} />
            {meta}
          </div>
        </div>
      </div>
      <Prose ex={ex} />
      <div className="ask-disc-grid">
        {albums.map((a) => {
          const seen = a.seen.length > 0
          const years = [...new Set(a.seen.map((d) => d.slice(0, 4)))].join(', ')
          return (
            <div key={a.mbid} className={['ask-disc', seen ? 'seen' : '', seenCycles && !seen ? 'dim' : ''].join(' ')}>
              <div className="c">
                <CoverArt album={a} color={color} />
                {a.defining && <span className="ask-pill on-cover">Defining</span>}
                {seen && <span className="ask-pill on-cover seen">Seen ×{a.seen.length}</span>}
              </div>
              <span className="t">{a.title}</span>
              <span className="y">
                {yearOf(a.releaseDate)}
                {seen ? ` · saw them ${years}` : ''}
              </span>
            </div>
          )
        })}
      </div>
      {seenCycles > 0 && <div className="ask-note">Faded: no show of mine during that record’s cycle.</div>}
      {exhibit.truncated && <div className="ask-note">Their release list is long; the first and last here may not be the true first and last.</div>}
      <DeepLink href={artist.deepLink} kind="discography">
        See {artist.name} on the site
      </DeepLink>
    </Frame>
  )
}

// ---------------------------------------------------------------------------------------------
// C · One night
// ---------------------------------------------------------------------------------------------

export function ShowCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: ShowExhibit; archive: ArchiveLookups }) {
  const c = archive.concertById(exhibit.concertId)
  const color = c ? getGenreColor(c.genre) : genreColor(archive, exhibit.headliner.slug)
  const date = exhibit.date
  const names = c ? [c.headliner, ...c.openers] : [exhibit.headliner.name]
  const slugs = c ? billSlugs(c) : [exhibit.headliner.slug]
  const lookups = captionLookups(archive)
  const caption = (p: Photo) => photoCaption(p, { aboutAct: exhibit.headliner.slug, aboutDate: date, ...lookups })
  const viewer = usePhotoViewer(caption, trackPhotoOpened('show'))

  // One tile per act on the bill that I photographed, headliner first, each labelled with who it
  // is; the venue fills in when fewer than three acts are covered. At most three, all at the
  // crop's own 4:5 so every tile shows exactly the owner's framing.
  const acts = slugs
    .map((slug, i) => ({ label: `${names[i]} · ${i === 0 ? 'headliner' : 'opener'}`, photo: actPhotosOnNight(archive.media, date, slug)[0] }))
    .filter((t): t is { label: string; photo: Photo } => !!t.photo)
  const venueShot = venuePhotosOnNight(archive.media, date)[0]
  const tiles = [...acts, ...(venueShot ? [{ label: `${exhibit.venue.name} · the venue`, photo: venueShot }] : [])].slice(0, 3)
  const nightAll = archive.media.byDate.get(date) ?? []
  // No frame from this night: my photo of the headliner from another night (captioned as such).
  const elsewhere = tiles.length ? null : leadPhoto(archive.media, exhibit.headliner.slug)

  const withWhom = c?.openers.length ? ` · with ${c.openers.join(' and ')}` : ''
  const title = (
    <div className="ex-title">
      <div className="n">{exhibit.headliner.name}</div>
      <div className="meta">
        {fmtDate(date)} · {exhibit.venue.name}
        {c?.city ? `, ${c.city}` : ''}
        {withWhom}
      </div>
    </div>
  )

  // Records in the set: by count, then release; the touring record kept even at ×0.
  const counts = new Map<string, { album: AlbumIdentity; n: number }>()
  for (const s of exhibit.songs) {
    if (!s.album) continue
    const hit = counts.get(s.album.mbid) ?? { album: s.album, n: 0 }
    hit.n++
    counts.set(s.album.mbid, hit)
  }
  const records = [...counts.values()].sort((x, y) => y.n - x.n || x.album.releaseDate.localeCompare(y.album.releaseDate))
  const touring = exhibit.touring
  if (touring && !counts.has(touring.mbid)) records.push({ album: touring, n: 0 })
  const identified = exhibit.songs.filter((s) => s.album).length

  return (
    <Frame color={color}>
      {tiles.length > 1 ? (
        <>
          <div className={`ask-mosaic n${tiles.length}`}>
            {tiles.map((t) => (
              <PhotoButton key={t.photo.url} className="ask-tile" onOpen={() => viewer.open(nightAll, nightAll.indexOf(t.photo))} label={caption(t.photo)}>
                <FramedPhoto photo={t.photo} aspect={0.8} alt={caption(t.photo)} fallback={<DerivedArt name={t.label} color={color} />} />
                <span className="lbl">{t.label}</span>
              </PhotoButton>
            ))}
          </div>
          {title}
        </>
      ) : tiles.length === 1 || elsewhere ? (
        <PhotoHero
          photo={(tiles[0]?.photo ?? elsewhere)!}
          caption={caption((tiles[0]?.photo ?? elsewhere)!)}
          onOpen={() => {
            const p = (tiles[0]?.photo ?? elsewhere)!
            const set = tiles.length ? nightAll : (archive.media.byArtist.get(exhibit.headliner.slug) ?? [p])
            viewer.open(set, set.indexOf(p))
          }}
          count={tiles.length ? nightAll.length : 0}
          color={color}
          name={exhibit.headliner.name}
          side={title}
        />
      ) : (
        <div className="ex-head">
          <Portrait name={exhibit.headliner.name} image={archive.artistFacts(exhibit.headliner.slug).meta?.image} color={color} className="ex-photo" />
          {title}
        </div>
      )}
      <Prose ex={ex} />
      {records.length > 0 && (
        <div className="ask-records">
          <div className="ask-kick">Records in the set</div>
          <div className="ask-records-row">
            {records.map(({ album, n }) => (
              <div key={album.mbid} className={`ask-rec ${n === 0 ? 'none' : ''}`}>
                <CoverArt album={album} color={color} />
                <span className="x">×{n}</span>
                <span className="t">
                  {album.title}
                  <span className="y"> · {yearOf(album.releaseDate)}{touring?.mbid === album.mbid ? ' · touring' : ''}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {exhibit.songs.length > 0 && (
        <div className="ask-setlist">
          <div className="ask-kick">{exhibit.isOpener ? `${exhibit.performer}’s opening set` : 'Setlist'}</div>
          <ol className="ask-set">
            {exhibit.songs.map((s, i) => (
              <li key={`${i}-${s.title}`}>
                <span className="n">{i + 1}</span>
                <SongMark album={s.album} color={color} />
                <span className="t">
                  {s.title}
                  {s.coverOf && <span className="cv"> ({s.coverOf} cover)</span>}
                </span>
                <span className="al">{s.album?.title ?? ''}</span>
              </li>
            ))}
          </ol>
          {identified > 0 && (
            <div className="ask-note">
              {identified} of {exhibit.songs.length} songs matched to a record.
            </div>
          )}
        </div>
      )}
      <div className="ask-links">
        <DeepLink href={setlistDeepLink(exhibit.headliner.slug, date)} kind="show">
          Open this night on the site
        </DeepLink>
        <DeepLink href={exhibit.venue.deepLink} kind="show">
          {exhibit.venue.name}
        </DeepLink>
      </div>
      {viewer.element}
    </Frame>
  )
}
