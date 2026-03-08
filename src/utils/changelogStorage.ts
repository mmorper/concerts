/**
 * Changelog Feature - localStorage/sessionStorage Utilities
 *
 * Handles persistent and session-based storage for changelog tracking
 */

import { STORAGE_KEYS } from '../components/changelog/constants'

/**
 * Get last seen changelog timestamp
 * Returns null if never seen or storage unavailable
 */
export function getLastSeenChangelog(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SEEN)
  } catch (e) {
    console.warn('localStorage unavailable (private browsing?):', e)
    return null
  }
}

/**
 * Set last seen changelog timestamp
 * Uses current timestamp if none provided
 */
export function setLastSeenChangelog(timestamp?: string): void {
  try {
    const ts = timestamp || new Date().toISOString()
    localStorage.setItem(STORAGE_KEYS.LAST_SEEN, ts)
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

/**
 * Check if version is dismissed in current session
 */
export function isDismissedInSession(version: string): boolean {
  try {
    const dismissed = sessionStorage.getItem(STORAGE_KEYS.DISMISSED_SESSION)
    if (!dismissed) return false

    const versions: string[] = JSON.parse(dismissed)
    return versions.includes(version)
  } catch (e) {
    console.warn('sessionStorage read failed:', e)
    return false
  }
}

/**
 * Mark version as dismissed in current session
 */
export function markDismissedInSession(version: string): void {
  try {
    const dismissed = sessionStorage.getItem(STORAGE_KEYS.DISMISSED_SESSION)
    const versions: string[] = dismissed ? JSON.parse(dismissed) : []

    if (!versions.includes(version)) {
      versions.push(version)
      sessionStorage.setItem(STORAGE_KEYS.DISMISSED_SESSION, JSON.stringify(versions))
    }
  } catch (e) {
    console.warn('sessionStorage write failed:', e)
  }
}

/**
 * Clear all dismissed versions (for testing)
 */
export function clearDismissedVersions(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.DISMISSED_SESSION)
  } catch (e) {
    console.warn('sessionStorage clear failed:', e)
  }
}

/**
 * Clear last seen timestamp (for testing)
 */
export function clearLastSeenChangelog(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_SEEN)
  } catch (e) {
    console.warn('localStorage clear failed:', e)
  }
}

// ── Liner Notes Storage ────────────────────────────────────────

export function getLastSeenLinerNotes(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LINER_NOTES_LAST_SEEN)
  } catch (e) {
    return null
  }
}

export function setLastSeenLinerNotes(timestamp?: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LINER_NOTES_LAST_SEEN, timestamp || new Date().toISOString())
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

export function isLinerNotesDismissedInSession(key: string): boolean {
  try {
    const dismissed = sessionStorage.getItem(STORAGE_KEYS.LINER_NOTES_DISMISSED_SESSION)
    if (!dismissed) return false
    const keys: string[] = JSON.parse(dismissed)
    return keys.includes(key)
  } catch (e) {
    return false
  }
}

export function markLinerNotesDismissedInSession(key: string): void {
  try {
    const dismissed = sessionStorage.getItem(STORAGE_KEYS.LINER_NOTES_DISMISSED_SESSION)
    const keys: string[] = dismissed ? JSON.parse(dismissed) : []
    if (!keys.includes(key)) {
      keys.push(key)
      sessionStorage.setItem(STORAGE_KEYS.LINER_NOTES_DISMISSED_SESSION, JSON.stringify(keys))
    }
  } catch (e) {
    console.warn('sessionStorage write failed:', e)
  }
}
