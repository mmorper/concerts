/**
 * Rate Limiter
 *
 * Conservative rate limiting to avoid hitting API quotas.
 * Uses exponential backoff for retries.
 */

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerDay: number
  retryAttempts: number
  retryDelayMs: number // Base delay for exponential backoff
}

export interface RateLimiterStats {
  requestsThisMinute: number
  requestsToday: number
  remaining: {
    minute: number
    day: number
  }
  resetsAt: {
    minute: Date
    day: Date
  }
}

// ============================================================================
// Constants - Conservative limits
// ============================================================================

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  gsc: {
    requestsPerMinute: 60, // Well under 1,200 limit
    requestsPerDay: 1000, // Conservative daily cap
    retryAttempts: 3,
    retryDelayMs: 1000,
  },
  ga4: {
    requestsPerMinute: 30, // GA4 can be strict
    requestsPerDay: 5000, // Half of 10k limit
    retryAttempts: 3,
    retryDelayMs: 2000,
  },
  crux: {
    requestsPerMinute: 10, // Very conservative (150/day limit)
    requestsPerDay: 100,
    retryAttempts: 2,
    retryDelayMs: 5000,
  },
  backlinks: {
    requestsPerMinute: 10, // Paid APIs, be respectful
    requestsPerDay: 100,
    retryAttempts: 2,
    retryDelayMs: 3000,
  },
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

export class RateLimiter {
  private config: RateLimitConfig
  private minuteRequests: number[] = []
  private dayRequests: number[] = []
  private dayStart: number

  constructor(
    name: string,
    config?: Partial<RateLimitConfig>
  ) {
    const defaultConfig = RATE_LIMITS[name] || RATE_LIMITS.backlinks
    this.config = { ...defaultConfig, ...config }
    this.dayStart = this.getStartOfDay()
  }

  private getStartOfDay(): number {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }

  private cleanupOldRequests(): void {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000

    // Clean minute window
    this.minuteRequests = this.minuteRequests.filter((t) => t > oneMinuteAgo)

    // Reset day counter if new day
    const currentDayStart = this.getStartOfDay()
    if (currentDayStart !== this.dayStart) {
      this.dayRequests = []
      this.dayStart = currentDayStart
    }
  }

  /**
   * Check if we can make a request without exceeding limits
   */
  canMakeRequest(): boolean {
    this.cleanupOldRequests()
    return (
      this.minuteRequests.length < this.config.requestsPerMinute &&
      this.dayRequests.length < this.config.requestsPerDay
    )
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    const now = Date.now()
    this.minuteRequests.push(now)
    this.dayRequests.push(now)
  }

  /**
   * Wait until we can make a request
   */
  async waitForSlot(): Promise<void> {
    while (!this.canMakeRequest()) {
      const waitTime = this.getWaitTime()
      if (waitTime > 0) {
        await sleep(waitTime)
      }
      this.cleanupOldRequests()
    }
  }

  /**
   * Get time to wait until next available slot (ms)
   */
  private getWaitTime(): number {
    this.cleanupOldRequests()

    if (this.dayRequests.length >= this.config.requestsPerDay) {
      // Wait until tomorrow
      const tomorrow = this.dayStart + 24 * 60 * 60 * 1000
      return tomorrow - Date.now()
    }

    if (this.minuteRequests.length >= this.config.requestsPerMinute) {
      // Wait until oldest request falls out of minute window
      const oldestInMinute = Math.min(...this.minuteRequests)
      return oldestInMinute + 60 * 1000 - Date.now() + 100 // +100ms buffer
    }

    return 0
  }

  /**
   * Get current rate limiter stats
   */
  getStats(): RateLimiterStats {
    this.cleanupOldRequests()

    const now = new Date()
    const minuteReset = new Date(now.getTime() + 60 * 1000)
    const dayReset = new Date(this.dayStart + 24 * 60 * 60 * 1000)

    return {
      requestsThisMinute: this.minuteRequests.length,
      requestsToday: this.dayRequests.length,
      remaining: {
        minute: this.config.requestsPerMinute - this.minuteRequests.length,
        day: this.config.requestsPerDay - this.dayRequests.length,
      },
      resetsAt: {
        minute: minuteReset,
        day: dayReset,
      },
    }
  }

  /**
   * Get the retry configuration
   */
  getRetryConfig(): { attempts: number; baseDelayMs: number } {
    return {
      attempts: this.config.retryAttempts,
      baseDelayMs: this.config.retryDelayMs,
    }
  }
}

// ============================================================================
// Retry with Exponential Backoff
// ============================================================================

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('too many requests') ||
      message.includes('429')
    )
  }
  return false
}

/**
 * Check if an error is retryable (rate limit or transient)
 */
export function isRetryableError(error: unknown): boolean {
  if (isRateLimitError(error)) return true

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('500')
    )
  }
  return false
}

/**
 * Execute a function with retry and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: { attempts: number; baseDelayMs: number },
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === config.attempts) {
        throw lastError
      }

      if (!isRetryableError(error)) {
        throw lastError
      }

      // Exponential backoff: baseDelay * 2^(attempt-1)
      // e.g., 1000ms, 2000ms, 4000ms for base=1000
      const delay = config.baseDelayMs * Math.pow(2, attempt - 1)

      if (onRetry) {
        onRetry(attempt, lastError, delay)
      }

      await sleep(delay)
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed')
}

/**
 * Execute a function with rate limiting and retry
 */
export async function withRateLimitAndRetry<T>(
  limiter: RateLimiter,
  fn: () => Promise<T>,
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  // Wait for rate limit slot
  await limiter.waitForSlot()

  // Record the request
  limiter.recordRequest()

  // Execute with retry
  return withRetry(fn, limiter.getRetryConfig(), onRetry)
}

// ============================================================================
// Helper
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Global Rate Limiters (singleton instances)
// ============================================================================

const limiters: Map<string, RateLimiter> = new Map()

/**
 * Get or create a rate limiter for a service
 */
export function getRateLimiter(service: string): RateLimiter {
  if (!limiters.has(service)) {
    limiters.set(service, new RateLimiter(service))
  }
  return limiters.get(service)!
}

/**
 * Print rate limiter stats for all services
 */
export function printRateLimiterStats(): void {
  console.log('')
  console.log('📊 RATE LIMITER STATUS')
  console.log('═══════════════════════════════════════════════════════════════')

  limiters.forEach((limiter, name) => {
    const stats = limiter.getStats()
    console.log(`${name.toUpperCase()}:`)
    console.log(`  Requests this minute: ${stats.requestsThisMinute}/${RATE_LIMITS[name]?.requestsPerMinute || '?'}`)
    console.log(`  Requests today:       ${stats.requestsToday}/${RATE_LIMITS[name]?.requestsPerDay || '?'}`)
    console.log('')
  })

  console.log('═══════════════════════════════════════════════════════════════')
}
