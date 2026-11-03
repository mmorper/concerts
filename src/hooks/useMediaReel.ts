/**
 * useMediaReel — paging through one night's stills and clips, and counting what was seen
 *
 * Shared by the gatefold's Photos panel and Ask's media viewer, so a frame shown in either is
 * counted the same way. `surface` says which one it was.
 *
 * A frame is reached without a click on a share link and by paging, so this is the one place that
 * sees every frame. Paging back to a frame is a new view of it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isClip, mediaId, type ReelItem } from '../components/ask/media'
import { analytics } from '../services/analytics'
import { haptics } from '../utils/haptics'

export type MediaSurface = 'gatefold' | 'ask'
export type MediaViewSource = 'button' | 'deep_link' | 'paging'

interface UseMediaReelOptions {
  reel: ReelItem[]
  /** `mediaId` to open on. Falls back to the first item. */
  initialId?: string | null
  /** The night, for every event. */
  date: string
  /** The act an event names: one name for a gatefold, or per frame for a night of several acts. */
  artistName: string | ((item: ReelItem) => string)
  surface: MediaSurface
  /** How the first frame was reached. Defaults to a share link when `initialId` is set. */
  initialSource?: MediaViewSource
}

export function useMediaReel({ reel, initialId = null, date, artistName, surface, initialSource }: UseMediaReelOptions) {
  const [index, setIndex] = useState(() => {
    const at = initialId ? reel.findIndex((item) => mediaId(item) === initialId) : -1
    return at === -1 ? 0 : at
  })
  const [isPlaying, setIsPlaying] = useState(false)
  // Only the first frame can be reached any way but paging.
  const viewSource = useRef<MediaViewSource>(initialSource ?? (initialId ? 'deep_link' : 'button'))
  // A pause and a resume are one play, so each view of a clip counts once.
  const clipPlayed = useRef(false)
  const clipCompleted = useRef(false)

  const many = reel.length > 1
  const item = reel[index] as ReelItem | undefined
  const itemId = item ? mediaId(item) : ''
  const mediaKind = item && isClip(item) ? 'video' : 'photo'
  const name = !item ? '' : typeof artistName === 'function' ? artistName(item) : artistName
  const mediaParams = useMemo(() => ({ artist_name: name, concert_date: date, photo: itemId }), [name, date, itemId])

  useEffect(() => {
    if (!mediaParams.photo) return
    analytics.trackEvent('media_viewed', { ...mediaParams, media_kind: mediaKind, view_source: viewSource.current, surface })
    viewSource.current = 'paging'
    clipPlayed.current = false
    clipCompleted.current = false
  }, [mediaParams, mediaKind, surface])

  const goTo = useCallback(
    (i: number) => {
      if (!reel.length) return
      haptics.light()
      setIsPlaying(false)
      setIndex(((i % reel.length) + reel.length) % reel.length)
    },
    [reel.length]
  )

  const go = useCallback(
    (step: number) => {
      haptics.light()
      setIsPlaying(false)
      setIndex((i) => (i + step + reel.length) % reel.length)
    },
    [reel.length]
  )

  // Fetch the neighbouring stills now, so paging lands on a photo rather than a blank frame
  useEffect(() => {
    if (!many) return
    for (const step of [1, -1]) {
      const near = reel[(index + step + reel.length) % reel.length]
      if (!isClip(near)) new Image().src = near.url
    }
  }, [index, many, reel])

  const onClipPlay = useCallback(() => {
    setIsPlaying(true)
    if (clipPlayed.current || !item) return
    clipPlayed.current = true
    analytics.trackEvent('clip_played', { ...mediaParams, song: item.song ?? undefined, surface })
  }, [item, mediaParams, surface])

  const onClipPause = useCallback(() => setIsPlaying(false), [])

  const onClipEnded = useCallback(() => {
    setIsPlaying(false)
    if (clipCompleted.current || !item) return
    clipCompleted.current = true
    analytics.trackEvent('clip_completed', { ...mediaParams, song: item.song ?? undefined, surface })
  }, [item, mediaParams, surface])

  return { index, item, many, go, goTo, isPlaying, onClipPlay, onClipPause, onClipEnded, mediaParams }
}
