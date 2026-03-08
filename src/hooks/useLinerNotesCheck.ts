/**
 * useLinerNotesCheck Hook
 *
 * Mirrors useChangelogCheck but for liner notes posts.
 * Compares publishedAt timestamps against lastSeen in localStorage.
 */

import { useEffect, useState } from 'react'
import type { LinerNotesPost } from '../components/changelog/types'
import {
  getLastSeenLinerNotes,
  setLastSeenLinerNotes,
  isLinerNotesDismissedInSession,
  markLinerNotesDismissedInSession,
} from '../utils/changelogStorage'

export interface LinerNotesCheckResult {
  shouldShow: boolean
  newPostCount: number
  latestPost: LinerNotesPost | null
  newPosts: LinerNotesPost[]
  dismissToast: () => void
  markAsSeen: () => void
}

export function useLinerNotesCheck(currentScene: number): LinerNotesCheckResult {
  const [state, setState] = useState<LinerNotesCheckResult>({
    shouldShow: false,
    newPostCount: 0,
    latestPost: null,
    newPosts: [],
    dismissToast: () => {},
    markAsSeen: () => {},
  })

  useEffect(() => {
    async function checkLinerNotes() {
      if (currentScene !== 1) {
        setState((prev) => ({ ...prev, shouldShow: false }))
        return
      }

      try {
        const data = await fetch('/data/liner-notes.json').then((r) => r.json())
        const posts: LinerNotesPost[] = (data.posts || []).map(
          (p: { id: string; slug: string; headline: string; prose: string; publishedAt: string; image?: { url: string; alt: string } }) => ({
            id: p.id,
            slug: p.slug,
            headline: p.headline,
            prose: p.prose,
            publishedAt: p.publishedAt,
            image: p.image,
          })
        )

        if (posts.length === 0) return

        const latestPost = posts[0]
        const lastSeen = getLastSeenLinerNotes()
        const lastSeenDate = lastSeen ? new Date(lastSeen) : null

        const newPosts = lastSeenDate
          ? posts.filter((p) => new Date(p.publishedAt) > lastSeenDate)
          : []

        const hasNewPosts = newPosts.length > 0
        const isDismissed = isLinerNotesDismissedInSession(latestPost.publishedAt)

        const dismissToast = () => {
          markLinerNotesDismissedInSession(latestPost.publishedAt)
          setState((prev) => ({ ...prev, shouldShow: false }))
        }

        const markAsSeen = () => {
          setLastSeenLinerNotes()
          setState((prev) => ({ ...prev, shouldShow: false }))
        }

        setState({
          shouldShow: hasNewPosts && !isDismissed,
          newPostCount: newPosts.length,
          latestPost,
          newPosts,
          dismissToast,
          markAsSeen,
        })
      } catch (err) {
        console.error('Failed to check liner notes:', err)
      }
    }

    checkLinerNotes()
  }, [currentScene])

  return state
}
