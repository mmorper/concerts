// The record-shaped cards (#593): one album, an act's studio albums, one song, one night's set.
// Album identity arrives in the envelope; covers, photos and every fallback resolve here.

import { getGenreColor, DEFAULT_GENRE_COLOR } from '@/constants/colors'
import { setlistDeepLink } from '@/utils/deepLinks'
import { normalizeArtistName } from '@/utils/normalize'
import type { AlbumExhibit, AlbumIdentity, DiscographyExhibit, ShowExhibit, SetSong, SongExhibit } from '@/types/exhibit'
import type { ArchiveLookups } from './types'
import { CameraMark, CoverArt, DerivedArt, FramedPhoto } from './AskMedia'
import { DeepLink, Frame, PhotoButton, Portrait, captionLookups, useFrameOpener, trackDeepLink, trackPhotoOpened } from './AskCardParts'
import {
  actPhotosOnNight,
  billSlugs,
  fmtDate,
  joinNames,
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

/** The act's avatar: my photo of them (opens its gatefold), else Deezer, else the derived tile. */
function ActAvatar({ archive, slug, name, color, kind }: { archive: ArchiveLookups; slug: string; name: string; color: string; kind: 'album' | 'discography' | 'song' }) {
  const lead = leadPhoto(archive.media, slug)
  const all = archive.media.byArtist.get(slug) ?? []
  const caption = (p: Photo) => photoCaption(p, { aboutAct: slug, ...captionLookups(archive) })
  const viewer = useFrameOpener(archive, trackPhotoOpened(kind))
  const portrait = <Portrait name={name} image={archive.artistFacts(slug).meta?.image} color={color} className="ex-photo" />
  if (!lead) return portrait
  return (
    <>
      <PhotoButton className="ex-photo-btn" onOpen={() => viewer.open(all, all.indexOf(lead))} label={caption(lead)}>
        <FramedPhoto photo={lead} aspect={1} alt={caption(lead)} className="ex-photo" fallback={portrait} />
      </PhotoButton>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// A · Album
// ---------------------------------------------------------------------------------------------

export function AlbumCard({ exhibit, archive }: { exhibit: AlbumExhibit; archive: ArchiveLookups }) {
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
  const viewer = useFrameOpener(archive, trackPhotoOpened('album'))
  const hits = live ? live.songs.filter(fromThis).length : 0
  const opening = live && normalizeArtistName(live.performer) !== live.headliner.slug

  return (
    <Frame>
      <div className="ask-album-head">
        <CoverArt album={a} size={500} color={color} className="ask-album-cover" />
        <div className="ask-album-title">
          <div className="ask-kick">Album</div>
          <div className="n">{a.title}</div>
          <div className="meta">{meta}</div>
          {exhibit.defining && <span className="ask-pill">Their defining record</span>}
        </div>
      </div>
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
          <DeepLink href={setlistDeepLink(normalizeArtistName(live.performer), live.date)} kind="album">
            See that night’s setlist
          </DeepLink>
        )}
        {exhibit.artist && (
          <DeepLink href={exhibit.artist.deepLink} kind="album">
            {exhibit.artist.name} on the site
          </DeepLink>
        )}
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------------------------
// F · Discography
// ---------------------------------------------------------------------------------------------

export function DiscographyCard({ exhibit, archive }: { exhibit: DiscographyExhibit; archive: ArchiveLookups }) {
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
    <Frame>
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
// S · One song, every night I heard it (built in the browser from a search match)
// ---------------------------------------------------------------------------------------------

export function SongCard({ exhibit, archive }: { exhibit: SongExhibit; archive: ArchiveLookups }) {
  const { artist, album } = exhibit
  const color = genreColor(archive, artist.slug)
  const meta = album ? `${artist.name} · from ${album.title}, ${yearOf(album.releaseDate)}` : artist.name
  const title = (
    <>
      <div className="ask-kick">Song</div>
      <div className="n">{exhibit.title}</div>
      <div className="meta">{meta}</div>
    </>
  )

  return (
    <Frame>
      {album ? (
        <div className="ask-album-head">
          <CoverArt album={album} size={500} color={color} className="ask-album-cover" />
          <div className="ask-album-title">{title}</div>
        </div>
      ) : (
        <div className="ex-head">
          <ActAvatar archive={archive} slug={artist.slug} name={artist.name} color={color} kind="song" />
          <div className="ex-title ask-album-title">{title}</div>
        </div>
      )}
      <div className="ask-song-nights">
        <div className="ask-kick">{exhibit.dates.length === 1 ? 'The night I heard it' : 'The nights I heard it'}</div>
        {exhibit.dates.map((date) => {
          const c = archive.concertByDate(date)
          const photo = actPhotosOnNight(archive.media, date, artist.slug)[0]
          const opening = c && c.headlinerNormalized !== artist.slug ? ` · opening for ${c.headliner}` : ''
          const href = setlistDeepLink(artist.slug, date)
          return (
            <a key={date} className="ask-row" href={href} onClick={() => trackDeepLink('song', href)}>
              <span className="yr">{date.slice(0, 4)}</span>
              <span className="th">
                {photo ? (
                  <FramedPhoto photo={photo} aspect={1} alt="" className="mine" fallback={<DerivedArt name={artist.name} color={color} />} />
                ) : (
                  <Portrait name={artist.name} image={archive.artistFacts(artist.slug).meta?.image} color={color} className="src" round />
                )}
              </span>
              <span className="who">
                {c?.venue ?? fmtDate(date)}
                {opening}
              </span>
              <span className="where">{c ? fmtDate(date, false) : ''}</span>
            </a>
          )
        })}
      </div>
      <DeepLink href={artist.deepLink} kind="song">
        See {artist.name} on the site
      </DeepLink>
    </Frame>
  )
}

// ---------------------------------------------------------------------------------------------
// C · One night
// ---------------------------------------------------------------------------------------------

// One night (Phase 6): a card with the night's picture, the date, the room and the bill, beside the
// setlist. The picture takes the first rung that exists: my photo of the act that night (or of
// anyone on the bill, or the room), then my photo of the act from another night, then the record
// they were touring, then the type-led tile.
export function ShowCard({ exhibit, archive }: { exhibit: ShowExhibit; archive: ArchiveLookups }) {
  const c = archive.concertById(exhibit.concertId)
  const color = c ? getGenreColor(c.genre) : genreColor(archive, exhibit.headliner.slug)
  const date = exhibit.date
  const performerSlug = normalizeArtistName(exhibit.performer)
  const lookups = captionLookups(archive)
  const viewer = useFrameOpener(archive, trackPhotoOpened('show'))

  const nightAll = archive.media.byDate.get(date) ?? []
  const slugs = c ? billSlugs(c) : [exhibit.headliner.slug]
  const tonight =
    actPhotosOnNight(archive.media, date, performerSlug)[0] ??
    slugs.map((s) => actPhotosOnNight(archive.media, date, s)[0]).find(Boolean) ??
    venuePhotosOnNight(archive.media, date)[0] ??
    null
  const elsewhere = tonight ? null : leadPhoto(archive.media, performerSlug) ?? leadPhoto(archive.media, exhibit.headliner.slug)
  const photo = tonight ?? elsewhere
  const caption = (p: Photo) => photoCaption(p, { aboutAct: performerSlug, aboutDate: date, ...lookups })
  const touring = exhibit.touring
  const derived = <DerivedArt name={exhibit.headliner.name} color={color} className="ask-night-art" />

  const bill = exhibit.isOpener
    ? `${exhibit.performer}, opening for ${exhibit.headliner.name}`
    : c?.openers.length
      ? `With ${joinNames(c.openers)}`
      : ''
  const heading = [
    exhibit.isOpener ? `${exhibit.performer}’s opening set` : 'The setlist',
    exhibit.songs.length ? `${exhibit.songs.length} ${exhibit.songs.length === 1 ? 'song' : 'songs'}` : '',
    touring ? `${touring.title} tour` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Frame>
      <div className="ask-night-card">
        <div className="ask-night-id">
          {photo ? (
            <PhotoButton
              className="ask-night-art"
              onOpen={() => {
                const set = tonight ? nightAll : (archive.media.byArtist.get(photo.artistNormalized ?? '') ?? [photo])
                viewer.open(set, Math.max(0, set.indexOf(photo)))
              }}
              label={caption(photo)}
            >
              <FramedPhoto photo={photo} aspect={1} alt={caption(photo)} fallback={derived} eager />
              {tonight && nightAll.length > 1 && <span className="ask-hero-count">{nightAll.length} photos</span>}
              <span className="ask-hero-cap">
                <CameraMark size={12} /> {caption(photo)}
              </span>
            </PhotoButton>
          ) : touring ? (
            <CoverArt album={touring} size={500} color={color} className="ask-night-art" />
          ) : (
            derived
          )}
          <div className="ask-night-text">
            <div className="d">{fmtDate(date)}</div>
            <div className="w">
              {exhibit.venue.name}
              {c?.city ? `, ${c.city}` : ''}
            </div>
            {bill && <div className="b">{bill}</div>}
            {/* On a phone the photo is too small for its caption, and a frame from another night
                must still say so. */}
            {elsewhere && (
              <div className="p">
                <CameraMark size={12} /> {caption(elsewhere)}
              </div>
            )}
          </div>
        </div>
        <div className="ask-night-set">
          <div className="ask-kick">{heading}</div>
          {exhibit.songs.length > 0 ? (
            <ol className="ask-set-cols" style={{ ['--rows' as string]: Math.ceil(exhibit.songs.length / 2) }}>
              {exhibit.songs.map((s, i) => (
                <li key={`${i}-${s.title}`}>
                  <span className="n">{i + 1}</span>
                  <span className="t">
                    {s.title}
                    {s.coverOf && <span className="cv"> ({s.coverOf} cover)</span>}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ask-note">No setlist on record for this night.</p>
          )}
        </div>
      </div>
      <div className="ask-links">
        {/* The set shown is the performer's — an opener's night opens their panel, not the headliner's. */}
        <DeepLink href={setlistDeepLink(performerSlug, date)} kind="show">
          Open this night on the site
        </DeepLink>
        <DeepLink href={exhibit.venue.deepLink} kind="show">
          {exhibit.venue.name}
        </DeepLink>
      </div>
    </Frame>
  )
}
