// Shareable answers (docs/specs/future/global-ask-shareable-answers.md, Phase 2): the Share button
// under an answer, and how a shared link opens.
//
// Three kinds of answer can be shared, each with its own link:
//   - a song card, built on the site: its link is known up front and needs no storage
//   - an answer reopened from a shared link: it shares on with the link it came from
//   - a model answer the Worker signed: the first click posts the signed copy to /share for an id
// Everything else (a refusal, a plain answer, a question back) has no button.

import { useEffect, useRef, useState } from 'react'
import { Share } from 'lucide-react'
import type { Exchange } from '@/hooks/useAskArchive'
import { useShareLink } from '@/hooks/useShareLink'
import { createShare, fetchShare } from '@/services/askArchive'
import { analytics } from '@/services/analytics'
import { absoluteUrl, askAnswerDeepLink, askSongDeepLink, isValidShareId } from '@/utils/deepLinks'
import { normalizeArtistName } from '@/utils/normalize'
import { useAsk } from './AskProvider'
import { songAnswer } from './search'

const FAILED_MS = 2000

/** The link an answer can be shared by before anything is stored, or null when it needs one made. */
export function knownShareLink(ex: Exchange): string | null {
  if (ex.shared) return askAnswerDeepLink(ex.shared.id)
  if (ex.exhibit?.kind === 'song') return askSongDeepLink(ex.exhibit.artist.slug, normalizeArtistName(ex.exhibit.title))
  return null
}

/** Whether an answer gets a Share button at all. */
export const canShare = (ex: Exchange): boolean => ex.status === 'done' && (!!knownShareLink(ex) || !!ex.share)


export function AskShareButton({ exchange }: { exchange: Exchange }) {
  const known = knownShareLink(exchange)
  const [made, setMade] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (failTimer.current) clearTimeout(failTimer.current)
  }, [])

  const exhibitKind = exchange.exhibit?.kind ?? 'none'
  const linkKind = exhibitKind === 'song' ? 'song' : 'answer'
  const { share, status } = useShareLink({
    url: known ? absoluteUrl(known) : (made ?? ''),
    title: exchange.question,
    text: `${exchange.question} — Ask the Archive`,
    analyticsEvent: { name: 'ask_answer_shared', params: { exhibit_kind: exhibitKind, link_kind: linkKind } },
  })

  if (!canShare(exchange)) return null

  const onClick = async () => {
    if (known || made) return share()
    if (!exchange.share || working) return
    setWorking(true)
    try {
      // On a phone the share sheet opens after this round trip. Where the browser no longer
      // counts that as the click, useShareLink falls back to copying the link.
      const url = absoluteUrl(askAnswerDeepLink(await createShare(exchange.share)))
      setMade(url)
      await share(url)
    } catch {
      analytics.trackEvent('ask_answer_shared', { exhibit_kind: exhibitKind, link_kind: linkKind, method: 'none', succeeded: false })
      setFailed(true)
      if (failTimer.current) clearTimeout(failTimer.current)
      failTimer.current = setTimeout(() => setFailed(false), FAILED_MS)
    } finally {
      setWorking(false)
    }
  }

  const label = working
    ? 'Getting a link…'
    : failed || status === 'error'
      ? 'Couldn’t share'
      : status === 'copied'
        ? 'Link copied'
        : 'Share'

  return (
    <button type="button" className="ask-share" onClick={onClick} disabled={working} aria-live="polite">
      <Share size={14} aria-hidden="true" />
      {label}
    </button>
  )
}


const MISSING = 'That answer isn’t here any more.'
const UNREACHABLE = 'That answer didn’t load.'

/**
 * Opens a shared link once, on arrival: `?scene=ask&answer=<id>` from the share store, or
 * `?scene=ask&artist=<slug>&song=<slug>` from song-index.json with no network call. Either opens
 * the overlay on the answer. A link that can't open says so above the empty overlay, never a
 * blank card. Lives in the Ask scene, which every visit to the main page mounts.
 */
export function useOpenSharedLink() {
  const { openSpotlight, show, archive, activate, setNotice } = useAsk()
  const done = useRef(false)

  const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const onAsk = params?.get('scene') === 'ask'
  const answer = onAsk ? params?.get('answer') : null
  const song = onAsk ? params?.get('song') : null
  const artist = onAsk ? params?.get('artist') : null

  // A shared answer: one read from the store.
  useEffect(() => {
    if (done.current || answer == null) return
    done.current = true
    const open = async () => {
      if (!isValidShareId(answer)) return missing('answer')
      try {
        const snap = await fetchShare(answer)
        if (snap === 'missing') return missing('answer')
        setNotice(null)
        openSpotlight('shared')
        show(snap.question, snap.prose, snap.exhibit, { id: answer, answeredOn: snap.answeredOn })
        analytics.trackEvent('ask_shared_answer_opened', { exhibit_kind: snap.exhibit.kind, link_kind: 'answer' })
      } catch {
        openSpotlight('shared')
        setNotice({ text: UNREACHABLE, retry: () => void open() })
      }
    }
    void open()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer])

  // A song card: wait for the archive, then build it the way a song match does.
  useEffect(() => {
    if (done.current || song == null || artist == null) return
    if (archive.searchEntries.length === 0) {
      activate()
      return
    }
    done.current = true
    const hit = archive.searchEntries.find((e) => e.song && e.song.slug === artist && normalizeArtistName(e.song.name) === song)?.song
    if (!hit) return missing('song')
    const { question, prose, exhibit } = songAnswer(hit)
    openSpotlight('shared')
    show(question, prose, exhibit)
    analytics.trackEvent('ask_shared_answer_opened', { exhibit_kind: 'song', link_kind: 'song' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, artist, archive.searchEntries])

  function missing(linkKind: 'answer' | 'song') {
    analytics.trackEvent('ask_shared_answer_missing', { link_kind: linkKind })
    openSpotlight('shared')
    setNotice({ text: MISSING })
  }
}

/** "Answered on November 2, 2026", for an answer reopened from a shared link. US order, as the site's bylines. */
export function answeredOnLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  return Number.isNaN(d.getTime())
    ? ''
    : `Answered on ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
}
