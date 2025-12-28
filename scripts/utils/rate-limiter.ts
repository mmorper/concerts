/**
 * Rate limiter to respect API call limits
 * Ensures we don't exceed the allowed calls per second
 */
export class RateLimiter {
  private lastCallTime: number = 0
  private minInterval: number

  /**
   * @param callsPerSecond - Maximum number of calls allowed per second
   */
  constructor(callsPerSecond: number) {
    this.minInterval = 1000 / callsPerSecond
  }

  /**
   * Wait if necessary to respect rate limit
   * Call this before making an API request
   */
  async wait(): Promise<void> {
    const now = Date.now()
    const timeSinceLastCall = now - this.lastCallTime

    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastCallTime = Date.now()
  }
}

/**
 * Simple delay helper
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
