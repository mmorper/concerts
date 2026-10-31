// Cards for the three tools that used to answer in text only (#593): a night's place in the act's
// catalogue (era), where my nights fall across albums' lives (shape), and the songs I've heard
// most (songs). Same ladder as every other card: my photo → sourced → derived, and a cover that
// fails to load drops to the derived sleeve.

import { useEffect, useRef } from 'react'
import { getGenreColor, DEFAULT_GENRE_COLOR } from '@/constants/colors'
import { setlistDeepLink } from '@/utils/deepLinks'
import type { Exchange } from '@/hooks/useAskArchive'
import type { EraExhibit, ShapeExhibit, SongsExhibit } from '@/types/exhibit'
import type { ArchiveLookups } from './types'
import { CoverArt, DerivedArt, FramedPhoto, usePhotoViewer } from './AskMedia'
import { DeepLink, Frame, PhotoButton, Portrait, Prose, captionLookups, trackDeepLink, trackPhotoOpened } from './AskCardParts'
import { agePhrase, fmtDate, monthsPhrase, nightPhoto, photoCaption, yearOf, type Photo } from './media'

const genreColor = (archive: ArchiveLookups, slug: string | undefined): string => {
  if (!slug) return DEFAULT_GENRE_COLOR
  const f = archive.artistFacts(slug)
  const g = f.primaryGenre ?? f.meta?.genres?.[0]
  return g ? getGenreColor(g) : DEFAULT_GENRE_COLOR
}

// ---------------------------------------------------------------------------------------------
// Era — "where were Depeche Mode in their career when I saw them in 1988?"
// ---------------------------------------------------------------------------------------------

export function EraCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: EraExhibit; archive: ArchiveLookups }) {
  const c = archive.concertById(exhibit.concertId)
  const color = c ? getGenreColor(c.genre) : genreColor(archive, exhibit.artist.slug)
  const pick = c ? nightPhoto(archive.media, c) : null
  const caption = (p: Photo) => photoCaption(p, { aboutAct: exhibit.artist.slug, aboutDate: exhibit.date, ...captionLookups(archive) })
  const viewer = usePhotoViewer(caption, trackPhotoOpened('era'))
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
    <Frame color={color}>
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

      <Prose ex={ex} />

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
      {viewer.element}
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

export function ShapeCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: ShapeExhibit; archive: ArchiveLookups }) {
  const total = BUCKETS.reduce((n, b) => n + exhibit.buckets[b.key], 0) || 1
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
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
      <Prose ex={ex} />
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
// Songs — "what songs have I heard most?"
// ---------------------------------------------------------------------------------------------

export function SongsCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: SongsExhibit; archive: ArchiveLookups }) {
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <div className="ask-list-title">Most-heard songs</div>
      <Prose ex={ex} />
      <ol className="ask-songs">
        {exhibit.songs.map((s, i) => {
          const color = genreColor(archive, s.artist?.slug)
          const who = s.artistNames.length === 1 ? s.artistNames[0] : `${s.artistNames.length} acts`
          const from = s.album ? s.album.title : s.coverOf ? `${s.coverOf} cover` : ''
          // Always a record (owner's call): the song's own sleeve; if it has none or it fails, the
          // album of the act I last heard play it; only then the derived tile.
          const derived = <DerivedArt name={s.coverOf ?? s.title} color={color} />
          const actAlbum = s.lastActAlbum ? <CoverArt album={s.lastActAlbum} color={color} fallback={derived} /> : derived
          return (
            <li key={`${i}-${s.title}`}>
              <span className="n">{i + 1}</span>
              <span className="c">
                {s.album ? <CoverArt album={s.album} color={color} fallback={actAlbum} /> : actAlbum}
              </span>
              <span className="body">
                <span className="t">{s.title}</span>
                <span className="w">
                  {s.artist ? (
                    <a href={s.artist.deepLink} onClick={() => trackDeepLink('songs', s.artist!.deepLink)}>
                      {who}
                    </a>
                  ) : (
                    who
                  )}
                  {from && <span className="al"> · {from}</span>}
                </span>
              </span>
              <span className="x">×{s.count}</span>
            </li>
          )
        })}
      </ol>
      <div className="ask-note">
        Counted from the {exhibit.withSetlist} of {exhibit.totalConcerts} shows with a setlist on record.
      </div>
    </Frame>
  )
}
