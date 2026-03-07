/**
 * Returns true if the concert date is today or in the future.
 * Compares YYYY-MM-DD strings lexicographically — correct because both are ISO date strings.
 * Returns true ON the day of the concert, false the day after.
 */
export function isUpcomingConcert(concertDate: string): boolean {
  const today = new Date().toISOString().split('T')[0] // "YYYY-MM-DD"
  return concertDate >= today
}
