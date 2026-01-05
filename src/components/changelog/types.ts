/**
 * Changelog Feature - TypeScript Type Definitions
 *
 * Defines all types for the "What's Playing" changelog system
 */

/**
 * Represents a single feature release entry
 */
export interface Release {
  /** Semantic version (e.g., "1.4.0") */
  version: string

  /** ISO date string (YYYY-MM-DD) */
  date: string

  /** Feature name (2-5 words, title case) */
  title: string

  /** One-liner description (60-120 chars) */
  description: string

  /** Deep link route (e.g., "/?scene=timeline") */
  route: string

  /** 2-4 bullet points (3-8 words each) */
  highlights: string[]
}

/**
 * Structure of changelog.json data file
 */
export interface ChangelogData {
  /** Array of releases, ordered newest first */
  releases: Release[]
}

/**
 * Return type for useChangelogCheck hook
 */
export interface ChangelogCheckResult {
  /** Whether toast should be visible */
  shouldShow: boolean

  /** Number of new features since last seen */
  newFeatureCount: number

  /** The most recent release */
  latestRelease: Release | null

  /** All releases newer than last seen */
  newReleases: Release[]

  /** Function to dismiss toast (session-based) */
  dismissToast: () => void

  /** Function to mark changelog as seen (persistent) */
  markAsSeen: () => void
}

/**
 * Props for ChangelogToast component
 */
export interface ChangelogToastProps {
  isVisible: boolean
  newFeatureCount: number
  latestRelease: Release
  newReleases: Release[]
  onDismiss: () => void
  onNavigate: () => void
}

/**
 * Props for ChangelogCard component
 */
export interface ChangelogCardProps {
  release: Release
  isLatest?: boolean
}
