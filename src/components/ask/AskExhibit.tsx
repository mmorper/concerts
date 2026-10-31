// Exhibit rendering (#140, media #593). One composed card per kind, hydrated from local archive
// data via the slugs/ids in the thin envelope. Streaming UX: a stable frame scaffolds immediately,
// prose streams into it, and the kind-specific atoms (photo, genre spine, chips, map, stats)
// resolve when the `exhibit` event lands. Containers/positioning are #141.
//
// Every image follows one ladder — my photo, then a sourced image, then the derived genre tile —
// and falls a rung at runtime if a file fails to load. See ./media.ts for the rules.

import type { ReactNode } from 'react'
import './ask.css'
import { VenueMiniMap } from './VenueMiniMap'
import { getGenreColor, DEFAULT_GENRE_COLOR } from '@/constants/colors'
import { analytics } from '@/services/analytics'
import type { Exchange } from '@/hooks/useAskArchive'
import type { ArchiveLookups } from './types'
import type { ArtistExhibit, VenueExhibit, ListExhibit, SerendipityExhibit, DisambiguationExhibit } from '@/types/exhibit'
import { CameraMark, DerivedArt, FramedPhoto, LadderImage, usePhotoViewer } from './AskMedia'
import { ChipLink, DeepLink, Filmstrip, Frame, PhotoButton, PhotoHero, Portrait, Prose, captionLookups, trackPhotoOpened, yearSpan } from './AskCardParts'
import { AlbumCard, DiscographyCard, ShowCard } from './AskRecordCards'
import { EraCard, ShapeCard, SongsCard } from './AskCareerCards'
import {
  BANNER_ASPECT,
  actPhotosOnNight,
  fmtDate,
  heroLayout,
  leadPhoto,
  nightPhoto,
  nightPhotoCount,
  photoCaption,
  venuePhotosOnNight,
  venueSourcedPhoto,
  type Photo,
} from './media'

// ---------- the cards ----------

function ArtistCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: ArtistExhibit; archive: ArchiveLookups }) {
  const f = archive.artistFacts(exhibit.slug)
  const genre = f.primaryGenre ?? f.meta?.genres?.[0]
  const color = genre ? getGenreColor(genre) : DEFAULT_GENRE_COLOR
  const metaBits = [genre, f.count ? `${f.count} ${f.count === 1 ? 'show' : 'shows'}` : '', yearSpan(f.firstYear, f.lastYear)]
    .filter(Boolean)
    .join(' · ')
  const chips = f.shows.slice(0, 3)
  const extra = f.count - chips.length

  const all = archive.media.byArtist.get(exhibit.slug) ?? []
  const lead = leadPhoto(archive.media, exhibit.slug)
  const lookups = captionLookups(archive)
  const caption = (p: Photo) => photoCaption(p, { aboutAct: exhibit.slug, ...lookups })
  const viewer = usePhotoViewer(caption, trackPhotoOpened('artist'))
  const rest = lead ? all.filter((p) => p !== lead) : []
  const nights = new Set(all.map((p) => p.date))
  const stripLabel =
    nights.size === 1 && lead
      ? `From ${lookups.venueOf(lead.date) ?? 'that night'}, ${lead.date.slice(0, 4)}`
      : `My photos · ${nights.size} nights`

  const title = (avatar: boolean) => (
    <div className="ex-head">
      {avatar && <Portrait name={exhibit.name} image={f.meta?.image} color={color} className={lead ? 'ex-avatar' : 'ex-photo'} />}
      <div className="ex-title">
        <div className="n">{exhibit.name}</div>
        {metaBits && (
          <div className="meta">
            <span className="gd" style={{ background: color }} />
            {metaBits}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Frame color={color}>
      {lead ? (
        <PhotoHero
          photo={lead}
          caption={caption(lead)}
          onOpen={() => viewer.open(all, all.indexOf(lead))}
          count={all.length}
          color={color}
          name={exhibit.name}
          side={title(true)}
        />
      ) : (
        title(true)
      )}
      <Prose ex={ex} />
      <Filmstrip
        photos={rest}
        label={stripLabel}
        onOpen={(i) => viewer.open(all, all.indexOf(rest[i]))}
        caption={caption}
        name={exhibit.name}
        color={color}
      />
      {chips.length > 0 && (
        <div className="shows">
          {chips.map((c) => {
            const mine = actPhotosOnNight(archive.media, c.date, exhibit.slug).length > 0
            return (
              <a key={c.id} className="show" href={`/?scene=venues&venue=${c.venueNormalized}`} onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'artist', target_scene: 'venues' })}>
                {mine && (
                  <span className="cam" title="I have photos from this night">
                    <CameraMark size={12} />
                  </span>
                )}
                <span className="yr">{c.year}</span>
                <span className="vn">{c.venue}</span>
                {f.opened.has(c.id) && <span className="role">opening for {c.headliner}</span>}
              </a>
            )
          })}
          {extra > 0 && <span className="show"><span className="yr">+{extra} more</span></span>}
        </div>
      )}
      <DeepLink href={exhibit.deepLink} kind="artist">
        See all {f.count || ''} {exhibit.name} shows on the site
      </DeepLink>
      {viewer.element}
    </Frame>
  )
}

function VenueCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: VenueExhibit; archive: ArchiveLookups }) {
  const f = archive.venueFacts(exhibit.slug)
  const color = f.primaryGenre ? getGenreColor(f.primaryGenre) : DEFAULT_GENRE_COLOR
  const lookups = captionLookups(archive)
  const newestFirst = [...f.shows].reverse()

  // Hero ladder: my venue shot (newest night first) → the sourced venue photo → the map.
  const mine = newestFirst.map((c) => venuePhotosOnNight(archive.media, c.date)[0]).find((p): p is Photo => !!p)
  const sourced = venueSourcedPhoto(f.meta)
  // One frame per night I was there, oldest first, at most four.
  const picks = newestFirst
    .map((c) => ({ c, pick: nightPhoto(archive.media, c) }))
    .filter((x): x is { c: (typeof x)['c']; pick: NonNullable<(typeof x)['pick']> } => !!x.pick)
    .slice(0, 4)
    .reverse()
  const stripPhotos = picks.map((x) => x.pick.photo)
  const viewerPhotos = mine && !stripPhotos.includes(mine) ? [mine, ...stripPhotos] : stripPhotos
  const caption = (p: Photo) => photoCaption(p, lookups)
  const viewer = usePhotoViewer(caption, trackPhotoOpened('venue'))

  const capText = [exhibit.name, f.cityState].filter(Boolean).join(' · ')
  const mapHero = (
    <div className="ask-map-wrap">
      {f.location ? (
        <VenueMiniMap lat={f.location.lat} lng={f.location.lng} label={exhibit.name} />
      ) : (
        <div className="ask-map-fallback">
          <div className="pin" />
        </div>
      )}
      <div className="cap">{capText}</div>
    </div>
  )
  const inset = f.location ? (
    <div className="ask-map-inset" aria-hidden="true">
      <VenueMiniMap lat={f.location.lat} lng={f.location.lng} label={exhibit.name} />
    </div>
  ) : null

  let hero: ReactNode
  if (mine) {
    const cap = caption(mine)
    const open = () => viewer.open(viewerPhotos, viewerPhotos.indexOf(mine))
    const derived = <DerivedArt name={exhibit.name} color={color} className="ask-hero-derived" />
    hero =
      heroLayout(mine) === 'banner' ? (
        <div className="ask-venue-hero">
          <PhotoButton className="ask-hero banner" onOpen={open} label={cap}>
            <FramedPhoto photo={mine} aspect={BANNER_ASPECT} alt={cap} fallback={derived} eager />
            <span className="ask-hero-cap">
              <CameraMark /> {cap}
            </span>
          </PhotoButton>
          {inset}
        </div>
      ) : (
        <div className="ask-venue-duo">
          <PhotoButton className="ask-hero portrait" onOpen={open} label={cap}>
            <FramedPhoto photo={mine} alt={cap} fallback={derived} eager />
          </PhotoButton>
          <div className="ask-venue-duo-side">
            {mapHero}
            <p className="ask-cap">
              <CameraMark /> {cap}
            </p>
          </div>
        </div>
      )
  } else if (sourced) {
    hero = (
      <LadderImage
        sources={[sourced]}
        alt={exhibit.name}
        className="ask-venue-sourced"
        fallback={mapHero}
        eager
        wrap={(img) => (
          <div className="ask-venue-hero">
            <div className="ask-hero banner">
              {img}
              <span className="ask-hero-cap">{capText}</span>
            </div>
            {inset}
          </div>
        )}
      />
    )
  } else {
    hero = mapHero
  }

  return (
    <Frame color={color}>
      {hero}
      <div className="stats">
        {f.count > 0 && <div className="stat"><div className="v">{f.count}</div><div className="k">Shows</div></div>}
        {f.firstYear && <div className="stat"><div className="v">{f.firstYear}</div><div className="k">First</div></div>}
        {f.lastYear && <div className="stat"><div className="v">{`'${String(f.lastYear).slice(2)}`}</div><div className="k">Latest</div></div>}
      </div>
      <Prose ex={ex} />
      {picks.length > 1 && (
        <div className="ask-nights">
          <div className="ask-strip-head">One frame from each night</div>
          <div className="ask-nights-row">
            {picks.map(({ c, pick }) => {
              const cap = caption(pick.photo)
              const sub =
                pick.relation === 'venue' ? 'The venue' : pick.relation === 'other-act' ? `Photo: ${pick.photo.artist}, same bill` : null
              return (
                <PhotoButton key={c.id} className="ask-night" onOpen={() => viewer.open(viewerPhotos, viewerPhotos.indexOf(pick.photo))} label={cap}>
                  <FramedPhoto photo={pick.photo} aspect={1} alt={cap} fallback={<DerivedArt name={c.headliner} color={getGenreColor(c.genre)} />} />
                  <span className="y">
                    {c.year} · {c.headliner}
                  </span>
                  {sub && <span className="w">{sub}</span>}
                </PhotoButton>
              )
            })}
          </div>
        </div>
      )}
      <DeepLink href={exhibit.deepLink} kind="venue">Open {exhibit.name} on the site</DeepLink>
      {viewer.element}
    </Frame>
  )
}

function ListCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: ListExhibit; archive: ArchiveLookups }) {
  const lookups = captionLookups(archive)
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <div className="ask-list-title">{exhibit.title}</div>
      <Prose ex={ex} />
      {exhibit.rows.map((r) => {
        const c = archive.concertById(r.concertId)
        const pick = c ? nightPhoto(archive.media, c) : null
        const color = c ? getGenreColor(c.genre) : DEFAULT_GENRE_COLOR
        const meta = archive.artistFacts(r.artist.slug).meta
        const count = nightPhotoCount(archive.media, r.date)
        return (
          <a key={r.concertId} className="ask-row" href={r.artist.deepLink} onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'list', target_scene: 'artists' })}>
            <span className="yr">{r.date.slice(0, 4)}</span>
            <span className="th">
              {pick ? (
                <>
                  <FramedPhoto
                    photo={pick.photo}
                    aspect={1}
                    alt={photoCaption(pick.photo, { aboutAct: r.artist.slug, ...lookups })}
                    className="mine"
                    fallback={<DerivedArt name={r.artist.name} color={color} />}
                  />
                  {count > 1 && <span className="b">{count}</span>}
                </>
              ) : (
                <Portrait name={r.artist.name} image={meta?.image} color={color} className="src" round />
              )}
            </span>
            <span className="who">
              {r.artist.name}
              {pick?.relation === 'venue' && <span className="vtag">venue</span>}
              {pick?.relation === 'other-act' && <span className="vtag">photo: {pick.photo.artist}</span>}
            </span>
            <span className="where">{r.venue.name}</span>
          </a>
        )
      })}
    </Frame>
  )
}

function SerendipityCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: SerendipityExhibit; archive: ArchiveLookups }) {
  const c = archive.concertById(exhibit.concertId)
  const af = archive.artistFacts(exhibit.artist.slug)
  const color = c ? getGenreColor(c.genre) : DEFAULT_GENRE_COLOR
  const lookups = captionLookups(archive)
  // This night's frame; else my photo of them from another night (the caption says so).
  const photo = (c && nightPhoto(archive.media, c)?.photo) || leadPhoto(archive.media, exhibit.artist.slug)
  const caption = (p: Photo) => photoCaption(p, { aboutAct: exhibit.artist.slug, aboutDate: c?.date, ...lookups })
  const nightPhotos = photo ? (archive.media.byDate.get(photo.date) ?? [photo]) : []
  const viewer = usePhotoViewer(caption, trackPhotoOpened('serendipity'))
  return (
    <Frame color={color}>
      <div className="ex-head">
        {photo ? (
          <PhotoButton className="ex-photo-btn" onOpen={() => viewer.open(nightPhotos, nightPhotos.indexOf(photo))} label={caption(photo)}>
            <FramedPhoto photo={photo} aspect={1} alt={caption(photo)} className="ex-photo" fallback={<Portrait name={exhibit.artist.name} image={af.meta?.image} color={color} className="ex-photo" />} />
          </PhotoButton>
        ) : (
          <Portrait name={exhibit.artist.name} image={af.meta?.image} color={color} className="ex-photo" />
        )}
        <div className="ex-title">
          <div className="n">{exhibit.artist.name}</div>
          {c && (
            <div className="meta">
              <span className="gd" style={{ background: color }} />
              {[c.venue, c.cityState, fmtDate(c.date)].filter(Boolean).join(' · ')}
            </div>
          )}
          {photo && (
            <div className="ask-cap small">
              <CameraMark size={12} /> {caption(photo)}
            </div>
          )}
        </div>
      </div>
      <Prose ex={ex} />
      <DeepLink href={exhibit.artist.deepLink} kind="serendipity">See {exhibit.artist.name} on the site</DeepLink>
      {viewer.element}
    </Frame>
  )
}

function DisambiguationCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: DisambiguationExhibit; archive: ArchiveLookups }) {
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <Prose ex={ex} />
      <div className="chips">
        {exhibit.candidates.map((c) => {
          if (c.entity !== 'artist') return <ChipLink key={c.slug} entity={c} kind="disambiguation" />
          // A face to choose by (#593): my photo of them, else the portrait, else the genre tile.
          const f = archive.artistFacts(c.slug)
          const genre = f.primaryGenre ?? f.meta?.genres?.[0]
          const color = genre ? getGenreColor(genre) : DEFAULT_GENRE_COLOR
          const mine = leadPhoto(archive.media, c.slug)
          const portrait = <Portrait name={c.name} image={f.meta?.image} color={color} className="chip-av" round />
          const avatar = mine ? <FramedPhoto photo={mine} aspect={1} alt="" className="chip-av" fallback={portrait} /> : portrait
          return <ChipLink key={c.slug} entity={c} kind="disambiguation" avatar={avatar} />
        })}
      </div>
    </Frame>
  )
}

function PlainCard({ ex }: { ex: Exchange }) {
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <Prose ex={ex} />
    </Frame>
  )
}

function RefusalCard({ ex }: { ex: Exchange }) {
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <p className="ex-prose" style={{ opacity: 0.75 }}>{ex.message || ex.prose}</p>
    </Frame>
  )
}

// ---------- entry point ----------

export function AskExhibit({ exchange, archive }: { exchange: Exchange; archive: ArchiveLookups }) {
  const { exhibit, status } = exchange

  // Refusal/error: one quiet card regardless of any partial exhibit.
  if (status === 'refused' || status === 'error') return <RefusalCard ex={exchange} />

  // Hold the card back until the answer is composed: rather than paint an empty frame (which
  // reads as "broken") and a churn of "consulting…" text, show one quiet loading cue and only
  // hydrate the real exhibit once the `exhibit` event lands.
  if (!exhibit) {
    return (
      <div className="ask-loading" role="status" aria-label="Composing an answer">
        <span className="ask-loading-dot" />
        <span className="ask-loading-dot" />
        <span className="ask-loading-dot" />
      </div>
    )
  }

  switch (exhibit.kind) {
    case 'artist':
      return <ArtistCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'venue':
      return <VenueCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'list':
      return <ListCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'serendipity':
      return <SerendipityCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'album':
      return <AlbumCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'discography':
      return <DiscographyCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'show':
      return <ShowCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'era':
      return <EraCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'shape':
      return <ShapeCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'songs':
      return <SongsCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'disambiguation':
      return <DisambiguationCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'refusal':
      return <RefusalCard ex={exchange} />
    case 'plain':
    default:
      // An unknown kind (a newer worker than this bundle) still renders its prose.
      return <PlainCard ex={exchange} />
  }
}
