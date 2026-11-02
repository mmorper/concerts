// Cards for the three tools that used to answer in text only (#593): a night's place in the act's
// catalogue (era), where my nights fall across albums' lives (shape), and the songs I've heard
// most (songs). Same ladder as every other card: my photo → sourced → derived, and a cover that
// fails to load drops to the derived sleeve.

import { useEffect, useRef, type ReactNode } from 'react'
import { getGenreColor, DEFAULT_GENRE_COLOR } from '@/constants/colors'
import { setlistDeepLink } from '@/utils/deepLinks'
import type { ActsExhibit, EraExhibit, ShapeExhibit, SongsExhibit } from '@/types/exhibit'
import type { ArchiveLookups } from './types'
import { CameraMark, CoverArt, DerivedArt, FramedPhoto } from './AskMedia'
import { DeepLink, Frame, PhotoButton, Portrait, captionLookups, trackDeepLink, useFrameOpener, trackPhotoOpened } from './AskCardParts'
import { actRankSub, agePhrase, fmtDate, leadPhoto, monthsPhrase, nightPhoto, photoCaption, yearOf, type Photo } from './media'

const genreColor = (archive: ArchiveLookups, slug: string | undefined): string => {
  if (!slug) return DEFAULT_GENRE_COLOR
  const f = archive.artistFacts(slug)
  const g = f.primaryGenre ?? f.meta?.genres?.[0]
  return g ? getGenreColor(g) : DEFAULT_GENRE_COLOR
}

// ---------------------------------------------------------------------------------------------
// Era — "where were Depeche Mode in their career when I saw them in 1988?"
// ---------------------------------------------------------------------------------------------

export function EraCard({ exhibit, archive }: { exhibit: EraExhibit; archive: ArchiveLookups }) {
  const c = archive.concertById(exhibit.concertId)
  const color = c ? getGenreColor(c.genre) : genreColor(archive, exhibit.artist.slug)
  const pick = c ? nightPhoto(archive.media, c) : null
  const caption = (p: Photo) => photoCaption(p, { aboutAct: exhibit.artist.slug, aboutDate: exhibit.date, ...captionLookups(archive) })
  const viewer = useFrameOpener(archive, trackPhotoOpened('era'))
  const nightAll = archive.media.byDate.get(exhibit.date) ?? []
  const portrait = <Portrait name={exhibit.artist.name} image={archive.artistFacts(exhibit.artist.slug).meta?.image} color={color} className="ex-photo" />

  const before = exhibit.shelf.filter((a) => a.before).length
  // The shelf scrolls; bring the night's line into view instead of always showing the debut end.
  const shelfRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = shelfRef.current
    const mark = row?.querySelector<HTMLElement>('.first-after, .ask-shelf-end')
    if (!row || !mark) return
    const x = mark.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft
    row.scrollLeft = Math.max(0, x - row.clientWidth / 2)
  }, [before, exhibit.shelf.length])
  const t = exhibit.touring
  const d = exhibit.defining
  const touringLine = t
    ? [`Touring ${t.title}`, exhibit.daysSinceRelease !== null ? `${agePhrase(exhibit.daysSinceRelease)} old` : '', `studio album ${before} of ${exhibit.shelf.length}`]
        .filter(Boolean)
        .join(' · ')
    : 'Before their first studio album'

  return (
    <Frame>
      <div className="ex-head">
        {pick ? (
          <PhotoButton className="ex-photo-btn" onOpen={() => viewer.open(nightAll, nightAll.indexOf(pick.photo))} label={caption(pick.photo)}>
            <FramedPhoto photo={pick.photo} aspect={1} alt={caption(pick.photo)} className="ex-photo" fallback={portrait} />
          </PhotoButton>
        ) : (
          portrait
        )}
        <div className="ex-title">
          <div className="n">{exhibit.artist.name}</div>
          <div className="meta">
            <span className="gd" style={{ background: color }} />
            {fmtDate(exhibit.date)} · {exhibit.venue.name}
          </div>
        </div>
      </div>

      <div className="ask-era-now">
        {t ? (
          <CoverArt album={t} size={500} color={color} className="ask-era-cover" />
        ) : (
          <DerivedArt name="No record yet" color={color} shape="sleeve" className="ask-era-cover" />
        )}
        <div className="ask-era-now-text">
          <div className="ask-kick">That night</div>
          <div className="t">{touringLine}</div>
          {d?.ahead && d.monthsAway !== null && (
            <div className="ask-era-ahead">
              <em>{d.title}</em>, the record they’d be remembered for, was {monthsPhrase(d.monthsAway)} away.
            </div>
          )}
        </div>
      </div>


      {exhibit.shelf.length > 0 && (
        <div className="ask-shelf">
          <div className="ask-kick">Their studio albums · the line is the night I saw them</div>
          <div className="ask-shelf-row" role="list" ref={shelfRef}>
            {exhibit.shelf.map((a, i) => (
              <div key={a.mbid} role="listitem" className={['ask-shelf-item', a.before ? 'before' : 'after', i === before ? 'first-after' : '', d?.mbid === a.mbid ? 'defining' : ''].join(' ')}>
                <CoverArt album={a} color={color} />
                <span className="y">{yearOf(a.releaseDate)}</span>
                {d?.mbid === a.mbid && <span className="ask-pill on-cover">Defining</span>}
              </div>
            ))}
            {before === exhibit.shelf.length && <div className="ask-shelf-end" aria-hidden="true" />}
          </div>
          {exhibit.truncated && <div className="ask-note">Their release list is long; the shelf may not start or end at the true first and last.</div>}
        </div>
      )}

      <div className="ask-links">
        <DeepLink href={setlistDeepLink(exhibit.artist.slug, exhibit.date)} kind="era">
          Open this night on the site
        </DeepLink>
        <DeepLink href={exhibit.artist.deepLink} kind="era">
          {exhibit.artist.name}
        </DeepLink>
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------------------------
// Shape — "do I catch bands early or late?"
// ---------------------------------------------------------------------------------------------

const BUCKETS: Array<{ key: keyof ShapeExhibit['buckets']; label: string }> = [
  { key: 'fresh', label: 'First 3 months' },
  { key: 'current', label: 'First year' },
  { key: 'mature', label: '1–3 years' },
  { key: 'deep', label: '3–10 years' },
  { key: 'catalog', label: '10+ years' },
]

export function ShapeCard({ exhibit, archive }: { exhibit: ShapeExhibit; archive: ArchiveLookups }) {
  const total = BUCKETS.reduce((n, b) => n + exhibit.buckets[b.key], 0) || 1
  return (
    <Frame>
      <div className="ask-kick">How old the record was, the nights I went</div>
      <div className="ask-shape-bar" role="img" aria-label={BUCKETS.map((b) => `${b.label}: ${exhibit.buckets[b.key]}`).join(', ')}>
        {BUCKETS.map((b, i) => (
          <span key={b.key} className={`seg s${i}`} style={{ flexGrow: exhibit.buckets[b.key] / total }} />
        ))}
      </div>
      <div className="ask-shape-legend">
        {BUCKETS.map((b, i) => (
          <span key={b.key} className="lg">
            <span className={`sw s${i}`} />
            <b>{exhibit.buckets[b.key]}</b> {b.label}
          </span>
        ))}
      </div>
      <div className="ask-note">
        {exhibit.placed} of {exhibit.total} nights placed · the median night came {exhibit.medianMonths} months after the record.
      </div>
      {exhibit.ahead.length > 0 && (
        <div className="ask-ahead">
          <div className="ask-kick">Before the record existed · {exhibit.aheadCount} nights</div>
          <div className="ask-ahead-grid">
            {exhibit.ahead.map((a) => {
              const href = setlistDeepLink(a.artist.slug, a.date)
              return (
                <a key={a.concertId} className="ask-ahead-item" href={href} onClick={() => trackDeepLink('shape', href)}>
                  <CoverArt album={a.album} color={genreColor(archive, a.artist.slug)} />
                  <span className="t">
                    {a.artist.name} · {a.date.slice(0, 4)}
                  </span>
                  <span className="y">
                    {monthsPhrase(a.monthsAway)} before <em>{a.album.title}</em>
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------------------------------
// Rankings (Phase 6) — a picture beside a list with large numbers, for the songs I've heard most
// and the acts I've seen most. The number is the count; the rows say what it counts.
// ---------------------------------------------------------------------------------------------

interface RankRow {
  key: string
  count: number
  name: string
  sub: string
  href?: string
}

function Ranking({ kind, heading, picture, sourced, rows }: {
  kind: 'songs' | 'acts'
  heading: string
  picture: ReactNode
  /** No photo of mine to lead with: the sourced picture sits smaller, as on the artist card. */
  sourced: boolean
  rows: RankRow[]
}) {
  return (
    <div className={`ask-rank ${sourced ? 'sourced' : ''}`}>
      <div className="ask-rank-pic">{picture}</div>
      <div>
        <div className="ask-kick">{heading}</div>
        <ol className="ask-rank-list">
          {rows.map((r) => {
            const body = (
              <>
                <span className="n">{r.count}</span>
                <span className="b">
                  <span className="t">{r.name}</span>
                  {r.sub && <span className="s">{r.sub}</span>}
                </span>
              </>
            )
            return (
              <li key={r.key}>
                {r.href ? (
                  <a href={r.href} onClick={() => trackDeepLink(kind, r.href!)}>
                    {body}
                  </a>
                ) : (
                  <span className="row">{body}</span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/** My photo of the highest-ranked act I've photographed, bylined, opening that act's frames. */
function RankPhoto({ archive, slugs, kind }: { archive: ArchiveLookups; slugs: string[]; kind: 'songs' | 'acts' }) {
  const viewer = useFrameOpener(archive, trackPhotoOpened(kind))
  const slug = slugs.find((s) => leadPhoto(archive.media, s))
  const lead = slug ? leadPhoto(archive.media, slug) : null
  if (!slug || !lead) return null
  const all = archive.media.byArtist.get(slug) ?? [lead]
  const caption = photoCaption(lead, { aboutAct: slug, ...captionLookups(archive) })
  return (
    <PhotoButton className="ask-rank-photo" onOpen={() => viewer.open(all, all.indexOf(lead))} label={caption}>
      <FramedPhoto photo={lead} aspect={0.8} alt={caption} fallback={<DerivedArt name={lead.artist ?? ''} color={DEFAULT_GENRE_COLOR} />} eager />
      <span className="ask-hero-cap">
        <CameraMark size={12} /> {caption}
      </span>
    </PhotoButton>
  )
}

export function ActsCard({ exhibit, archive }: { exhibit: ActsExhibit; archive: ArchiveLookups }) {
  const slugs = exhibit.acts.map((a) => a.artist.slug)
  const photo = <RankPhoto archive={archive} slugs={slugs} kind="acts" />
  const top = exhibit.acts[0]
  const mine = slugs.some((s) => leadPhoto(archive.media, s))
  return (
    <Frame>
      <Ranking
        kind="acts"
        heading="The acts I’ve seen most · nights"
        sourced={!mine}
        picture={
          mine
            ? photo
            : top && (
                <Portrait name={top.artist.name} image={archive.artistFacts(top.artist.slug).meta?.image} color={genreColor(archive, top.artist.slug)} className="ask-rank-sourced" />
              )
        }
        rows={exhibit.acts.map((a) => ({ key: a.artist.slug, count: a.count, name: a.artist.name, sub: actRankSub(a), href: a.artist.deepLink }))}
      />
    </Frame>
  )
}

export function SongsCard({ exhibit, archive }: { exhibit: SongsExhibit; archive: ArchiveLookups }) {
  const slugs = exhibit.songs.flatMap((s) => [s.artist?.slug, s.lastAct?.slug]).filter((s): s is string => !!s)
  const mine = slugs.some((s) => leadPhoto(archive.media, s))
  const top = exhibit.songs[0]
  const color = genreColor(archive, top?.artist?.slug ?? top?.lastAct?.slug)
  const derived = <DerivedArt name={top?.coverOf ?? top?.title ?? ''} color={color} className="ask-rank-sourced" />
  // No photo of mine: the top song's record, square and uncropped, then the derived sleeve.
  const record = top?.album ?? top?.lastActAlbum
  return (
    <Frame>
      <Ranking
        kind="songs"
        heading="The songs I’ve heard most · times"
        sourced={!mine}
        picture={mine ? <RankPhoto archive={archive} slugs={slugs} kind="songs" /> : record ? <CoverArt album={record} size={500} color={color} fallback={derived} className="ask-rank-sourced" /> : derived}
        rows={exhibit.songs.map((s, i) => {
          const who = s.artistNames.length === 1 ? s.artistNames[0] : `${s.artistNames.length} acts`
          const from = s.album ? s.album.title : s.coverOf ? `${s.coverOf} cover` : ''
          return { key: `${i}-${s.title}`, count: s.count, name: s.title, sub: [who, from].filter(Boolean).join(' · '), href: s.artist?.deepLink }
        })}
      />
      <div className="ask-note">
        Counted from the {exhibit.withSetlist} of {exhibit.totalConcerts} shows with a setlist on record.
      </div>
    </Frame>
  )
}
