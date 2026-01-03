/**
 * useChangelogCheck Hook
 *
 * Determines toast visibility and provides control functions
 * Checks localStorage for last seen timestamp and compares with releases
 */

import { useEffect, useState } from 'react'
import type { ChangelogCheckResult, Release } from '../components/changelog/types'
import {
  getLastSeenChangelog,
  setLastSeenChangelog,
  isDismissedInSession,
  markDismissedInSession,
} from '../utils/changelogStorage'

/**
 * Hook to check if changelog toast should be shown
 * @param currentScene - The current scene number (1-5)
 * @returns Visibility state and control functions
 */
export function useChangelogCheck(currentScene: number): ChangelogCheckResult {
  const [state, setState] = useState<ChangelogCheckResult>({
    shouldShow: false,
    newFeatureCount: 0,
    latestRelease: null,
    newReleases: [],
    dismissToast: () => {},
    markAsSeen: () => {},
  })

  useEffect(() => {
    async function checkChangelog() {
      // Only check if on Scene 1 (homepage)
      if (currentScene !== 1) {
        setState((prev) => ({ ...prev, shouldShow: false }))
        return
      }

      try {
        // Load changelog data
        const data = await import('../data/changelog.json')
        const releases: Release[] = data.releases || []

        if (releases.length === 0) {
          // No releases, nothing to show
          return
        }

        const latestRelease = releases[0]

        // Get last seen timestamp
        const lastSeen = getLastSeenChangelog()
        const lastSeenDate = lastSeen ? new Date(lastSeen) : null

        // Check for new features
        const newReleases = lastSeenDate
          ? releases.filter((r) => new Date(r.date) > lastSeenDate)
          : []

        const hasNewFeatures = newReleases.length > 0

        // Check if dismissed in current session
        const isDismissed = isDismissedInSession(latestRelease.version)

        // Create control functions
        const dismissToast = () => {
          markDismissedInSession(latestRelease.version)
          setState((prev) => ({ ...prev, shouldShow: false }))
        }

        const markAsSeen = () => {
          setLastSeenChangelog()
          setState((prev) => ({ ...prev, shouldShow: false }))
        }

        // Update state
        setState({
          shouldShow: hasNewFeatures && !isDismissed,
          newFeatureCount: newReleases.length,
          latestRelease,
          newReleases,
          dismissToast,
          markAsSeen,
        })
      } catch (err) {
        console.error('Failed to check changelog:', err)
        // Fail silently - toast just won't show
      }
    }

    checkChangelog()
  }, [currentScene])

  return state
}
