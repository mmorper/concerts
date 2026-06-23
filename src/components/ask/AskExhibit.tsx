// Exhibit rendering (#140). One composed card per kind, hydrated from local archive data via the
// slugs/ids in the thin envelope. Streaming UX: a stable frame scaffolds immediately, prose
// streams into it, and the kind-specific atoms (photo, genre spine, chips, map, stats) resolve
// when the `exhibit` event lands. Containers/positioning are #141.

import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './ask.css'
import { VenueMiniMap } from './VenueMiniMap'
import { cleanProse } from './prose'
import { getGenreColor, DEFAULT_GENRE_COLOR } from '@/constants/colors'
import { analytics } from '@/services/analytics'
import type { Exchange } from '@/hooks/useAskArchive'
import type { ArchiveLookups } from './types'
import type {
  ArtistExhibit,
  VenueExhibit,
  ListExhibit,
  SerendipityExhibit,
  DisambiguationExhibit,
  EntityRef,
  Exhibit,
} from '@/types/exhibit'

const sceneOf = (deepLink: string): string => new URLSearchParams(deepLink.split('?')[1] ?? '').get('scene') ?? ''

function DeepLink({ href, kind, children }: { href: string; kind: Exhibit['kind']; children: ReactNode }) {
  return (
    <a
      className="deep"
      href={href}
      onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind, target_scene: sceneOf(href) })}
    >
      {children} <span className="arr">→</span>
    </a>
  )
}


// The model may emit markdown — bold, lists, and (when asked) GFM tables. Render it, don't print
// raw pipes. Tables get a horizontal-scroll wrapper so they never blow out a narrow card.
function Prose({ ex }: { ex: Exchange }) {
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

function ChipLink({ entity, kind, color }: { entity: EntityRef; kind: Exhibit['kind']; color?: string }) {
  return (
    <a
      className="chip"
      href={entity.deepLink}
      onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind, target_scene: sceneOf(entity.deepLink) })}
    >
      {color && <span className="d" style={{ background: color }} />}
      {entity.name}
    </a>
  )
}

const yearSpan = (a?: number, b?: number) => (a && b ? (a === b ? `${a}` : `${a}–${b}`) : '')

// ---------- the seven kinds ----------

function ArtistCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: ArtistExhibit; archive: ArchiveLookups }) {
  const f = archive.artistFacts(exhibit.slug)
  const genre = f.primaryGenre ?? f.meta?.genres?.[0]
  const color = genre ? getGenreColor(genre) : DEFAULT_GENRE_COLOR
  const metaBits = [genre, f.count ? `${f.count} ${f.count === 1 ? 'show' : 'shows'}` : '', yearSpan(f.firstYear, f.lastYear)]
    .filter(Boolean)
    .join(' · ')
  const chips = f.shows.slice(0, 3)
  const extra = f.count - chips.length
  return (
    <Frame color={color}>
      <div className="ex-head">
        <div className="ex-photo" style={{ backgroundImage: f.meta?.image ? `url('${f.meta.image}')` : undefined, backgroundColor: color }} />
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
      <Prose ex={ex} />
      {chips.length > 0 && (
        <div className="shows">
          {chips.map((c) => (
            <a key={c.id} className="show" href={`/?scene=venues&venue=${c.venueNormalized}`} onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'artist', target_scene: 'venues' })}>
              <span className="yr">{c.year}</span>
              <span className="vn">{c.venue}</span>
            </a>
          ))}
          {extra > 0 && <span className="show"><span className="yr">+{extra} more</span></span>}
        </div>
      )}
      <DeepLink href={exhibit.deepLink} kind="artist">
        See all {f.count || ''} {exhibit.name} shows on the site
      </DeepLink>
    </Frame>
  )
}

function VenueCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: VenueExhibit; archive: ArchiveLookups }) {
  const f = archive.venueFacts(exhibit.slug)
  const color = f.primaryGenre ? getGenreColor(f.primaryGenre) : DEFAULT_GENRE_COLOR
  return (
    <Frame color={color}>
      <div className="ask-map-wrap">
        {f.location ? (
          <VenueMiniMap lat={f.location.lat} lng={f.location.lng} label={exhibit.name} />
        ) : (
          <div className="ask-map-fallback">
            <div className="pin" />
          </div>
        )}
        <div className="cap">{[exhibit.name, f.cityState].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="stats">
        {f.count > 0 && <div className="stat"><div className="v">{f.count}</div><div className="k">Shows</div></div>}
        {f.firstYear && <div className="stat"><div className="v">{f.firstYear}</div><div className="k">First</div></div>}
        {f.lastYear && <div className="stat"><div className="v">{`'${String(f.lastYear).slice(2)}`}</div><div className="k">Latest</div></div>}
      </div>
      <Prose ex={ex} />
      <DeepLink href={exhibit.deepLink} kind="venue">Open {exhibit.name} on the site</DeepLink>
    </Frame>
  )
}

function ListCard({ ex, exhibit }: { ex: Exchange; exhibit: ListExhibit }) {
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <div className="ask-list-title">{exhibit.title}</div>
      <Prose ex={ex} />
      {exhibit.rows.map((r) => (
        <a key={r.concertId} className="ask-row" href={r.artist.deepLink} onClick={() => analytics.trackEvent('ask_deeplink_clicked', { kind: 'list', target_scene: 'artists' })}>
          <span className="yr">{r.date.slice(0, 4)}</span>
          <span className="who">{r.artist.name}</span>
          <span className="where">{r.venue.name}</span>
        </a>
      ))}
    </Frame>
  )
}

function SerendipityCard({ ex, exhibit, archive }: { ex: Exchange; exhibit: SerendipityExhibit; archive: ArchiveLookups }) {
  const c = archive.concertById(exhibit.concertId)
  const af = archive.artistFacts(exhibit.artist.slug)
  const color = c ? getGenreColor(c.genre) : DEFAULT_GENRE_COLOR
  return (
    <Frame color={color}>
      <div className="ex-head">
        <div className="ex-photo" style={{ backgroundImage: af.meta?.image ? `url('${af.meta.image}')` : undefined, backgroundColor: color }} />
        <div className="ex-title">
          <div className="n">{exhibit.artist.name}</div>
          {c && (
            <div className="meta">
              <span className="gd" style={{ background: color }} />
              {[c.venue, c.cityState, c.year].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>
      <Prose ex={ex} />
      <DeepLink href={exhibit.artist.deepLink} kind="serendipity">See {exhibit.artist.name} on the site</DeepLink>
    </Frame>
  )
}

function DisambiguationCard({ ex, exhibit }: { ex: Exchange; exhibit: DisambiguationExhibit }) {
  return (
    <Frame color={DEFAULT_GENRE_COLOR}>
      <Prose ex={ex} />
      <div className="chips">
        {exhibit.candidates.map((c) => (
          <ChipLink key={c.slug} entity={c} kind="disambiguation" />
        ))}
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

function Frame({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className="ask-exhibit">
      <div className="spine" style={{ background: color }} />
      <div className="body">{children}</div>
    </div>
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
      return <ListCard ex={exchange} exhibit={exhibit} />
    case 'serendipity':
      return <SerendipityCard ex={exchange} exhibit={exhibit} archive={archive} />
    case 'disambiguation':
      return <DisambiguationCard ex={exchange} exhibit={exhibit} />
    case 'refusal':
      return <RefusalCard ex={exchange} />
    case 'plain':
    default:
      return <PlainCard ex={exchange} />
  }
}
