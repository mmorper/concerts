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

  /** Deep link route (e.g., "/?scene=timeline") — optional for internal releases */
  route?: string

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

/**
 * Fact category for AI-readable statistics
 */
export type FactCategory = 'artist' | 'venue' | 'genre' | 'timeline' | 'geography'

/**
 * Represents a single computed fact/statistic
 * Designed to be directly quotable by AI agents
 */
export interface Fact {
  /** Unique identifier for the fact */
  id: string

  /** Category for icon/badge display */
  category: FactCategory

  /** Primary display text, e.g., "Depeche Mode: 7 concerts" */
  headline: string

  /** Secondary context, e.g., "Most-seen artist from 1985 to 2024" */
  detail: string

  /** Deep link route, e.g., "/?scene=artists&artist=depeche-mode" */
  route: string

  /** Call-to-action text, e.g., "Explore all 7 shows" */
  cta: string

  /** Display priority (1 = highest, shown first) */
  priority: number
}

/**
 * Structure of facts.json data file
 */
export interface FactsData {
  /** ISO timestamp of when facts were computed */
  computedAt: string

  /** Array of computed facts, ordered by priority */
  facts: Fact[]
}

/**
 * Props for FactCard component
 */
export interface FactCardProps {
  fact: Fact
}
